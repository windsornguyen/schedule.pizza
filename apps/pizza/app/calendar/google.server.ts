import { and, eq } from "drizzle-orm";

import type { Database } from "@/db/client.server";
import { account } from "@/db/schema";
import { timeInterval, type TimeInterval } from "@/scheduling/engine";
import type { ServerEnv } from "@/server-context";

const ACCESS_TOKEN_REFRESH_SKEW_MS = 120_000;
const GOOGLE_CALENDAR_API_URL = "https://www.googleapis.com/calendar/v3";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

export const GOOGLE_CALENDAR_EVENTS_SCOPE =
  "https://www.googleapis.com/auth/calendar.events";
export const GOOGLE_CALENDAR_FREEBUSY_SCOPE =
  "https://www.googleapis.com/auth/calendar.freebusy";

type Fetcher = (input: string, init: RequestInit) => Promise<Response>;

export type GoogleCalendarCapability = "availability" | "event_write";

export type GoogleCalendarErrorCode =
  | "google_account_missing"
  | "google_access_token_missing"
  | "google_calendar_scope_missing"
  | "google_event_delete_failed"
  | "google_event_insert_failed"
  | "google_event_insert_response_invalid"
  | "google_freebusy_failed"
  | "google_freebusy_response_invalid"
  | "google_refresh_token_missing"
  | "google_token_refresh_failed"
  | "google_token_response_invalid";

type GoogleCalendarAccess =
  | { readonly accessToken: string; readonly code: "authorized" }
  | { readonly code: GoogleCalendarErrorCode };

type RefreshAccessTokenResult =
  | {
      readonly accessToken: string;
      readonly code: "refreshed";
      readonly expiresAt: Date;
      readonly refreshToken: string | null;
      readonly scope: string | null;
    }
  | {
      readonly code:
        | "google_token_refresh_failed"
        | "google_token_response_invalid";
    };

type JsonParseResult =
  | { readonly body: unknown; readonly code: "parsed" }
  | { readonly code: "invalid_json" };

export type GoogleCalendarEventAttendee = {
  readonly displayName: string;
  readonly email: string;
};

export async function readGoogleCalendarAccess(
  db: Database,
  input: {
    readonly authUserId: string;
    readonly capability: GoogleCalendarCapability;
    readonly env: Pick<ServerEnv, "GOOGLE_CLIENT_ID" | "GOOGLE_CLIENT_SECRET">;
    readonly fetcher?: Fetcher;
    readonly now: Date;
  },
): Promise<GoogleCalendarAccess> {
  const rows = await db
    .select()
    .from(account)
    .where(
      and(
        eq(account.providerId, "google"),
        eq(account.userId, input.authUserId),
      ),
    )
    .limit(1);
  const googleAccount = rows[0];

  if (googleAccount === undefined) {
    return { code: "google_account_missing" };
  }

  if (!hasGoogleCalendarScope(googleAccount.scope, input.capability)) {
    return { code: "google_calendar_scope_missing" };
  }

  if (
    googleAccount.accessToken !== null &&
    googleAccount.accessToken.trim() !== "" &&
    googleAccount.accessTokenExpiresAt !== null &&
    googleAccount.accessTokenExpiresAt.getTime() >
      input.now.getTime() + ACCESS_TOKEN_REFRESH_SKEW_MS
  ) {
    return { code: "authorized", accessToken: googleAccount.accessToken };
  }

  if (
    googleAccount.refreshToken === null ||
    googleAccount.refreshToken.trim() === ""
  ) {
    return { code: "google_refresh_token_missing" };
  }

  const refreshed = await refreshGoogleAccessToken({
    clientId: input.env.GOOGLE_CLIENT_ID,
    clientSecret: input.env.GOOGLE_CLIENT_SECRET,
    fetcher: input.fetcher ?? defaultFetcher,
    now: input.now,
    refreshToken: googleAccount.refreshToken,
  });

  if (refreshed.code !== "refreshed") {
    return refreshed;
  }

  const scope = refreshed.scope ?? googleAccount.scope;

  await db
    .update(account)
    .set({
      accessToken: refreshed.accessToken,
      accessTokenExpiresAt: refreshed.expiresAt,
      refreshToken: refreshed.refreshToken ?? googleAccount.refreshToken,
      scope,
      updatedAt: input.now,
    })
    .where(eq(account.id, googleAccount.id));

  if (!hasGoogleCalendarScope(scope, input.capability)) {
    return { code: "google_calendar_scope_missing" };
  }

  return { code: "authorized", accessToken: refreshed.accessToken };
}

export async function refreshGoogleAccessToken(input: {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly fetcher: Fetcher;
  readonly now: Date;
  readonly refreshToken: string;
}): Promise<RefreshAccessTokenResult> {
  const body = new URLSearchParams({
    client_id: input.clientId,
    client_secret: input.clientSecret,
    grant_type: "refresh_token",
    refresh_token: input.refreshToken,
  });
  const response = await input
    .fetcher(GOOGLE_TOKEN_URL, {
      body,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      method: "POST",
    })
    .catch((): null => null);

  if (response === null || !response.ok) {
    return { code: "google_token_refresh_failed" };
  }

  const parsed = await readJson(response);

  if (parsed.code !== "parsed" || !isRecord(parsed.body)) {
    return { code: "google_token_response_invalid" };
  }

  const accessToken = parsed.body["access_token"];
  const expiresIn = parsed.body["expires_in"];
  const refreshToken = parsed.body["refresh_token"];
  const scope = parsed.body["scope"];

  if (
    typeof accessToken !== "string" ||
    accessToken.trim() === "" ||
    typeof expiresIn !== "number" ||
    !Number.isFinite(expiresIn) ||
    expiresIn <= 0
  ) {
    return { code: "google_token_response_invalid" };
  }

  return {
    code: "refreshed",
    accessToken,
    expiresAt: new Date(input.now.getTime() + expiresIn * 1_000),
    refreshToken: typeof refreshToken === "string" ? refreshToken : null,
    scope: typeof scope === "string" ? scope : null,
  };
}

export async function listGoogleFreeBusyIntervals(input: {
  readonly accessToken: string;
  readonly calendarId: string;
  readonly fetcher?: Fetcher;
  readonly timeZone: string;
  readonly window: TimeInterval;
}): Promise<
  | { readonly busy: readonly TimeInterval[]; readonly code: "listed" }
  | {
      readonly code:
        | "google_freebusy_failed"
        | "google_freebusy_response_invalid";
    }
> {
  const response = await (input.fetcher ?? defaultFetcher)(
    `${GOOGLE_CALENDAR_API_URL}/freeBusy`,
    {
      body: JSON.stringify({
        timeMin: new Date(input.window.startAtMs).toISOString(),
        timeMax: new Date(input.window.endAtMs).toISOString(),
        timeZone: input.timeZone,
        items: [{ id: input.calendarId }],
      }),
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    },
  ).catch((): null => null);

  if (response === null || !response.ok) {
    return { code: "google_freebusy_failed" };
  }

  const parsed = await readJson(response);

  if (parsed.code !== "parsed" || !isRecord(parsed.body)) {
    return { code: "google_freebusy_response_invalid" };
  }

  const calendars = parsed.body["calendars"];

  if (!isRecord(calendars)) {
    return { code: "google_freebusy_response_invalid" };
  }

  const calendar = calendars[input.calendarId];

  if (!isRecord(calendar)) {
    return { code: "google_freebusy_response_invalid" };
  }

  const errors = calendar["errors"];

  if (Array.isArray(errors) && errors.length > 0) {
    return { code: "google_freebusy_failed" };
  }

  const busy = calendar["busy"];

  if (!Array.isArray(busy)) {
    return { code: "google_freebusy_response_invalid" };
  }

  const intervals = parseBusyIntervals(busy);

  if (intervals.code !== "parsed") {
    return { code: "google_freebusy_response_invalid" };
  }

  return { code: "listed", busy: intervals.busy };
}

export async function createGoogleCalendarEvent(input: {
  readonly additionalAttendees?: readonly GoogleCalendarEventAttendee[];
  readonly accessToken: string;
  readonly calendarId: string;
  readonly endAt: Date;
  readonly fetcher?: Fetcher;
  readonly guestEmail: string | null;
  readonly guestName: string;
  readonly startAt: Date;
  readonly timeZone: string;
}): Promise<
  | { readonly code: "created"; readonly eventId: string }
  | {
      readonly code:
        | "google_event_insert_failed"
        | "google_event_insert_response_invalid";
    }
> {
  const url = new URL(
    `${GOOGLE_CALENDAR_API_URL}/calendars/${encodeURIComponent(input.calendarId)}/events`,
  );

  if (hasGoogleEventAttendees(input)) {
    url.searchParams.set("sendUpdates", "all");
  }

  const response = await (input.fetcher ?? defaultFetcher)(url.toString(), {
    body: JSON.stringify(buildGoogleEventBody(input)),
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  }).catch((): null => null);

  if (response === null || !response.ok) {
    return { code: "google_event_insert_failed" };
  }

  const parsed = await readJson(response);

  if (parsed.code !== "parsed" || !isRecord(parsed.body)) {
    return { code: "google_event_insert_response_invalid" };
  }

  const eventId = parsed.body["id"];

  if (typeof eventId !== "string" || eventId.trim() === "") {
    return { code: "google_event_insert_response_invalid" };
  }

  return { code: "created", eventId };
}

export async function deleteGoogleCalendarEvent(input: {
  readonly accessToken: string;
  readonly calendarId: string;
  readonly eventId: string;
  readonly fetcher?: Fetcher;
  readonly notifyGuests: boolean;
}): Promise<
  | { readonly code: "deleted" }
  | { readonly code: "google_event_delete_failed" }
> {
  const url = new URL(
    `${GOOGLE_CALENDAR_API_URL}/calendars/${encodeURIComponent(input.calendarId)}/events/${encodeURIComponent(input.eventId)}`,
  );

  if (input.notifyGuests) {
    url.searchParams.set("sendUpdates", "all");
  }

  const response = await (input.fetcher ?? defaultFetcher)(url.toString(), {
    headers: { Authorization: `Bearer ${input.accessToken}` },
    method: "DELETE",
  }).catch((): null => null);

  return response !== null && response.ok
    ? { code: "deleted" }
    : { code: "google_event_delete_failed" };
}

export function hasGoogleCalendarScope(
  scope: string | null,
  capability: GoogleCalendarCapability,
) {
  const scopes = parseScopes(scope);

  if (scopes.has("https://www.googleapis.com/auth/calendar")) {
    return true;
  }

  if (capability === "event_write") {
    return scopes.has(GOOGLE_CALENDAR_EVENTS_SCOPE);
  }

  return (
    scopes.has(GOOGLE_CALENDAR_FREEBUSY_SCOPE) ||
    scopes.has("https://www.googleapis.com/auth/calendar.events.freebusy") ||
    scopes.has("https://www.googleapis.com/auth/calendar.readonly")
  );
}

export function readGoogleCalendarId(calendarId: string | null) {
  return calendarId === null || calendarId.trim() === ""
    ? "primary"
    : calendarId.trim();
}

function buildGoogleEventBody(input: {
  readonly additionalAttendees?: readonly GoogleCalendarEventAttendee[];
  readonly endAt: Date;
  readonly guestEmail: string | null;
  readonly guestName: string;
  readonly startAt: Date;
  readonly timeZone: string;
}) {
  const base = {
    description: "Booked through schedule.pizza.",
    end: {
      dateTime: input.endAt.toISOString(),
      timeZone: input.timeZone,
    },
    start: {
      dateTime: input.startAt.toISOString(),
      timeZone: input.timeZone,
    },
    summary: `schedule.pizza: ${input.guestName}`,
  };

  const attendees = buildGoogleEventAttendees(input);

  if (attendees.length === 0) {
    return base;
  }

  return {
    ...base,
    attendees,
  };
}

function buildGoogleEventAttendees(input: {
  readonly additionalAttendees?: readonly GoogleCalendarEventAttendee[];
  readonly guestEmail: string | null;
  readonly guestName: string;
}) {
  const attendees: GoogleCalendarEventAttendee[] = [];
  const guestEmail = input.guestEmail;

  if (guestEmail !== null) {
    attendees.push({ displayName: input.guestName, email: guestEmail });
  }

  attendees.push(...(input.additionalAttendees ?? []));

  return dedupeGoogleEventAttendees(attendees);
}

function dedupeGoogleEventAttendees(
  attendees: readonly GoogleCalendarEventAttendee[],
) {
  const seenEmails = new Set<string>();
  const dedupedAttendees: GoogleCalendarEventAttendee[] = [];

  for (const attendee of attendees) {
    const email = attendee.email.trim().toLowerCase();

    if (email === "" || seenEmails.has(email)) {
      continue;
    }

    seenEmails.add(email);
    dedupedAttendees.push({ ...attendee, email });
  }

  return dedupedAttendees;
}

function hasGoogleEventAttendees(input: {
  readonly additionalAttendees?: readonly GoogleCalendarEventAttendee[];
  readonly guestEmail: string | null;
}) {
  return input.guestEmail !== null || (input.additionalAttendees?.length ?? 0) > 0;
}

function defaultFetcher(input: string, init: RequestInit) {
  return fetch(input, init);
}

function parseBusyIntervals(busy: readonly unknown[]):
  | { readonly busy: readonly TimeInterval[]; readonly code: "parsed" }
  | { readonly code: "invalid" } {
  const intervals: TimeInterval[] = [];

  for (const item of busy) {
    if (!isRecord(item)) {
      return { code: "invalid" };
    }

    const start = item["start"];
    const end = item["end"];

    if (typeof start !== "string" || typeof end !== "string") {
      return { code: "invalid" };
    }

    const startAtMs = Date.parse(start);
    const endAtMs = Date.parse(end);

    if (!Number.isSafeInteger(startAtMs) || !Number.isSafeInteger(endAtMs)) {
      return { code: "invalid" };
    }

    try {
      intervals.push(timeInterval({ startAtMs, endAtMs }));
    } catch {
      return { code: "invalid" };
    }
  }

  return { code: "parsed", busy: intervals };
}

async function readJson(response: Response): Promise<JsonParseResult> {
  try {
    return { code: "parsed", body: await response.json() as unknown };
  } catch {
    return { code: "invalid_json" };
  }
}

function parseScopes(scope: string | null) {
  if (scope === null || scope.trim() === "") {
    return new Set<string>();
  }

  return new Set(scope.split(/[,\s]+/u).filter((value) => value !== ""));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
