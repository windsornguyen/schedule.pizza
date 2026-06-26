import { Hono } from "hono";

import {
  listGoogleFreeBusyIntervals,
  readGoogleCalendarAccess,
  readGoogleCalendarId,
  type GoogleCalendarErrorCode,
} from "@/calendar/google.server";
import { createDb } from "@/db/client.server";
import { authorizeBookingCode } from "@/db/functions/booking_code_authorizations.server";
import { normalizeBookingCode } from "@/db/functions/booking_codes.server";
import { findBlockingBookingsForHost } from "@/db/functions/bookings.server";
import { normalizeUsername } from "@/db/functions/host_profiles.server";
import { readCloudflareClientIpHash } from "@/http/client_ip.server";
import {
  createSchedulingEngine,
  SCHEDULE_REQUEST_LIMITS,
  timeInterval,
  validateScheduleRequest,
  type BusyInterval,
  type BusyIntervalSource,
  type NoScheduleReason,
  type ScheduleRequestErrorCode,
  type ScheduleRequest,
  type ScheduleResult,
  type ScoredSlot,
  type TimeInterval,
} from "@/scheduling/engine";
import { parseUtcDateTimeMs } from "@/scheduling/utc_datetime";
import type { ServerEnv } from "@/server-context";
import {
  googleCalendarErrorBody,
  googleCalendarStatus,
} from "./google_calendar_errors";

type Bindings = ServerEnv;

type ParsedParticipant = {
  readonly bookingCode: string;
  readonly username: string;
};

export type ParsedScheduleBody = {
  readonly durationMinutes: number;
  readonly granularityMinutes: number;
  readonly maxAlternativeSlotCount: number;
  readonly maxExactSlotCount: number;
  readonly participants: readonly ParsedParticipant[];
  readonly timeZone: string;
  readonly window: TimeInterval;
};

type ScheduleBodyParseResult =
  | { readonly code: "parsed"; readonly body: ParsedScheduleBody }
  | { readonly code: "invalid_field" | "missing_field"; readonly field: string };

export type AuthorizedParticipant = {
  readonly authUserId: string;
  readonly calendarId: string | null;
  readonly hostId: string;
  readonly username: string;
};

type SerializedInterval = {
  readonly end: string;
  readonly start: string;
};

type SerializedScheduleConflict = {
  readonly interval: SerializedInterval;
  readonly user: string;
};

type SerializedSoftScheduleConflict = SerializedScheduleConflict & {
  readonly moveCost: number;
};

type SerializedScoredSlot = {
  readonly conflictCost: number;
  readonly hardConflicts: readonly SerializedScheduleConflict[];
  readonly slot: SerializedInterval;
  readonly softConflicts: readonly SerializedSoftScheduleConflict[];
};

export type SerializedScheduleResult =
  | { readonly kind: "exact"; readonly slots: readonly SerializedInterval[] }
  | {
      readonly kind: "alternatives";
      readonly slots: readonly SerializedScoredSlot[];
    }
  | { readonly kind: "none"; readonly reason: NoScheduleReason };

export type ScheduleExecutionResult =
  | { readonly body: SerializedScheduleResult; readonly code: "scheduled" }
  | { readonly code: "booking_code_invalid" }
  | { readonly code: "booking_code_rate_limited" }
  | {
      readonly code: "invalid_schedule_request";
      readonly requestCode: ScheduleRequestErrorCode;
    }
  | { readonly code: GoogleCalendarErrorCode };

class ScheduleCalendarError extends Error {
  constructor(readonly code: GoogleCalendarErrorCode) {
    super(code);
    this.name = "ScheduleCalendarError";
  }
}

export const scheduleRoute = new Hono<{ Bindings: Bindings }>();

scheduleRoute.post("/", async (c) => {
  const text = await c.req.text();
  const parsedJson = parseJsonBody(text);

  if (parsedJson.code === "invalid_json") {
    return c.json({ error: { code: "invalid_json", message: "Request body must be JSON" } }, 400);
  }

  const parsedBody = parseScheduleBody(parsedJson.body);

  if (parsedBody.code !== "parsed") {
    return c.json({
      error: {
        code: parsedBody.code,
        message: `${parsedBody.field} is ${parsedBody.code === "missing_field" ? "required" : "invalid"}`,
      },
    }, 400);
  }

  const clientIpHash = await readCloudflareClientIpHash(c.req.raw);

  if (clientIpHash.code === "client_ip_unavailable") {
    return c.json({ error: { code: "client_ip_unavailable", message: "Client IP header is unavailable" } }, 500);
  }

  const db = createDb(c.env.DB);
  const now = new Date();
  const scheduled = await executeScheduleRequest(db, {
    body: parsedBody.body,
    env: c.env,
    ipHash: clientIpHash.ipHash,
    now,
  });

  if (scheduled.code === "booking_code_rate_limited") {
    return c.json({ error: { code: "booking_code_rate_limited", message: "Too many failed booking code attempts" } }, 429);
  }

  if (scheduled.code === "booking_code_invalid") {
    return c.json({ error: { code: "booking_code_invalid", message: "Invalid booking code" } }, 404);
  }

  if (scheduled.code === "invalid_schedule_request") {
    return c.json({
      error: {
        code: "invalid_schedule_request",
        message: scheduled.requestCode,
      },
    }, 400);
  }

  if (scheduled.code !== "scheduled") {
    return c.json(
      googleCalendarErrorBody(scheduled.code),
      googleCalendarStatus(scheduled.code),
    );
  }

  return c.json(scheduled.body);
});

export async function executeScheduleRequest(
  db: ReturnType<typeof createDb>,
  input: {
    readonly body: ParsedScheduleBody;
    readonly env: ServerEnv;
    readonly ipHash: string;
    readonly now: Date;
  },
): Promise<ScheduleExecutionResult> {
  const authorizedParticipants: AuthorizedParticipant[] = [];

  for (const participant of input.body.participants) {
    const authorization = await authorizeBookingCode(db, {
      bookingCode: participant.bookingCode,
      ipHash: input.ipHash,
      now: input.now,
      username: participant.username,
    });

    if (authorization.code === "booking_code_rate_limited") {
      return { code: "booking_code_rate_limited" };
    }

    if (authorization.code === "booking_code_invalid") {
      return { code: "booking_code_invalid" };
    }

    authorizedParticipants.push({
      authUserId: authorization.access.host.authUserId,
      calendarId: authorization.access.host.calendarId,
      hostId: authorization.access.host.id,
      username: authorization.access.host.username,
    });
  }

  const engine = createSchedulingEngine({
    busyIntervalSource: createD1BusyIntervalSource(input.env, db, {
      now: input.now,
      participants: authorizedParticipants,
    }),
  });
  const scheduleRequest = {
    durationMinutes: input.body.durationMinutes,
    granularityMinutes: input.body.granularityMinutes,
    maxAlternativeSlotCount: input.body.maxAlternativeSlotCount,
    maxExactSlotCount: input.body.maxExactSlotCount,
    requiredProfileIds: authorizedParticipants.map((participant) => participant.hostId),
    timeZone: input.body.timeZone,
    window: input.body.window,
  } satisfies ScheduleRequest;
  const validation = validateScheduleRequest(scheduleRequest);

  if (validation.kind === "invalid") {
    return {
      code: "invalid_schedule_request",
      requestCode: validation.code,
    };
  }

  const result = await engine.schedule(scheduleRequest).catch((error: unknown) => {
    if (error instanceof ScheduleCalendarError) {
      return error;
    }

    throw error;
  });

  if (result instanceof ScheduleCalendarError) {
    return { code: result.code };
  }

  return {
    code: "scheduled",
    body: serializeScheduleResult(result, authorizedParticipants),
  };
}

export function parseScheduleBody(body: unknown): ScheduleBodyParseResult {
  if (!isRecord(body)) {
    return { code: "missing_field", field: "participants" };
  }

  const participants = parseParticipants(body["participants"]);

  if (participants.code !== "parsed") {
    return participants;
  }

  const durationMinutes = parseRequiredPositiveInteger(
    body["durationMinutes"],
    SCHEDULE_REQUEST_LIMITS.maxDurationMinutes,
  );
  if (durationMinutes.code !== "parsed") return { code: durationMinutes.code, field: "durationMinutes" };

  const granularityMinutes = parseRequiredPositiveInteger(
    body["granularityMinutes"],
    SCHEDULE_REQUEST_LIMITS.maxGranularityMinutes,
  );
  if (granularityMinutes.code !== "parsed") return { code: granularityMinutes.code, field: "granularityMinutes" };

  const maxExactSlotCount = parseRequiredPositiveInteger(
    body["maxExactSlotCount"],
    SCHEDULE_REQUEST_LIMITS.maxExactSlotCount,
  );
  if (maxExactSlotCount.code !== "parsed") return { code: maxExactSlotCount.code, field: "maxExactSlotCount" };

  const maxAlternativeSlotCount = parseRequiredPositiveInteger(
    body["maxAlternativeSlotCount"],
    SCHEDULE_REQUEST_LIMITS.maxAlternativeSlotCount,
  );
  if (maxAlternativeSlotCount.code !== "parsed") return { code: maxAlternativeSlotCount.code, field: "maxAlternativeSlotCount" };

  const timeZone = parseRequiredTimeZone(body["timeZone"]);
  if (timeZone.code !== "parsed") return { code: timeZone.code, field: "timeZone" };

  const window = parseWindow(body["window"]);
  if (window.code !== "parsed") return window;

  return {
    code: "parsed",
    body: {
      durationMinutes: durationMinutes.value,
      granularityMinutes: granularityMinutes.value,
      maxAlternativeSlotCount: maxAlternativeSlotCount.value,
      maxExactSlotCount: maxExactSlotCount.value,
      participants: participants.participants,
      timeZone: timeZone.value,
      window: window.window,
    },
  };
}

function parseJsonBody(text: string):
  | { readonly body: unknown; readonly code: "parsed" }
  | { readonly code: "invalid_json" } {
  if (text.trim().length === 0) {
    return { code: "invalid_json" };
  }

  try {
    return { code: "parsed", body: JSON.parse(text) as unknown };
  } catch {
    return { code: "invalid_json" };
  }
}

function parseParticipants(value: unknown):
  | { readonly code: "parsed"; readonly participants: readonly ParsedParticipant[] }
  | { readonly code: "invalid_field" | "missing_field"; readonly field: string } {
  if (!Array.isArray(value) || value.length === 0) {
    return { code: "missing_field", field: "participants" };
  }

  if (value.length > SCHEDULE_REQUEST_LIMITS.maxProfileCount) {
    return { code: "invalid_field", field: "participants" };
  }

  const participants: ParsedParticipant[] = [];
  const usernames = new Set<string>();

  for (const rawParticipant of value) {
    if (!isRecord(rawParticipant)) {
      return { code: "invalid_field", field: "participants" };
    }

    const username = typeof rawParticipant["user"] === "string" ? normalizeUsername(rawParticipant["user"]) : null;
    const bookingCode = typeof rawParticipant["code"] === "string" ? normalizeBookingCode(rawParticipant["code"]) : null;

    if (username === null || bookingCode === null) {
      return { code: "invalid_field", field: "participants" };
    }

    if (usernames.has(username)) {
      return { code: "invalid_field", field: "participants" };
    }

    usernames.add(username);
    participants.push({ username, bookingCode });
  }

  return { code: "parsed", participants };
}

function parseWindow(value: unknown):
  | { readonly code: "parsed"; readonly window: TimeInterval }
  | { readonly code: "invalid_field" | "missing_field"; readonly field: string } {
  if (!isRecord(value)) {
    return { code: "missing_field", field: "window" };
  }

  if (typeof value["start"] !== "string" || typeof value["end"] !== "string") {
    return { code: "missing_field", field: "window" };
  }

  const startAtMs = parseUtcDateTimeMs(value["start"]);
  const endAtMs = parseUtcDateTimeMs(value["end"]);

  if (startAtMs === null || endAtMs === null) {
    return { code: "invalid_field", field: "window" };
  }

  try {
    const window = timeInterval({ startAtMs, endAtMs });

    if (window.endAtMs - window.startAtMs > SCHEDULE_REQUEST_LIMITS.maxWindowMs) {
      return { code: "invalid_field", field: "window" };
    }

    return { code: "parsed", window };
  } catch {
    return { code: "invalid_field", field: "window" };
  }
}

function parseRequiredPositiveInteger(value: unknown, maxValue: number):
  | { readonly code: "parsed"; readonly value: number }
  | { readonly code: "invalid_field" | "missing_field" } {
  if (value === undefined || value === null) {
    return { code: "missing_field" };
  }

  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value > 0 &&
    value <= maxValue
  )
    ? { code: "parsed", value }
    : { code: "invalid_field" };
}

function parseRequiredTimeZone(value: unknown):
  | { readonly code: "parsed"; readonly value: string }
  | { readonly code: "invalid_field" | "missing_field" } {
  if (value === undefined || value === null) {
    return { code: "missing_field" };
  }

  if (typeof value !== "string") {
    return { code: "invalid_field" };
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return { code: "parsed", value };
  } catch {
    return { code: "invalid_field" };
  }
}

function createD1BusyIntervalSource(
  env: ServerEnv,
  db: ReturnType<typeof createDb>,
  input: {
    readonly now: Date;
    readonly participants: readonly AuthorizedParticipant[];
  },
): BusyIntervalSource {
  return {
    fetchBusyIntervals: async (query) => {
      const participantByHostId = new Map(
        input.participants.map((participant) => [participant.hostId, participant]),
      );
      const busyIntervals = await Promise.all(
        query.profileIds.map(async (profileId) => {
          const participant = participantByHostId.get(profileId);

          if (participant === undefined) {
            throw new Error(`authorized participant missing for ${profileId}`);
          }

          const bookings = await findBlockingBookingsForHost(db, {
            hostId: participant.hostId,
            startsAt: new Date(query.window.startAtMs),
            endsAt: new Date(query.window.endAtMs),
          });
          const googleBusy = await fetchGoogleBusyIntervals({
            db,
            env,
            now: input.now,
            participant,
            window: query.window,
          });

          return [
            ...bookings.map((booking): BusyInterval => ({
              ...timeInterval({
                startAtMs: booking.slotStartAt.getTime(),
                endAtMs: booking.slotEndAt.getTime(),
              }),
              eventId: booking.id,
              flexibility: { kind: "hard" },
              profileId: participant.hostId,
            })),
            ...googleBusy,
          ];
        }),
      );

      return busyIntervals.flat();
    },
  };
}

async function fetchGoogleBusyIntervals(input: {
  readonly db: ReturnType<typeof createDb>;
  readonly env: ServerEnv;
  readonly now: Date;
  readonly participant: AuthorizedParticipant;
  readonly window: TimeInterval;
}): Promise<readonly BusyInterval[]> {
  const access = await readGoogleCalendarAccess(input.db, {
    authUserId: input.participant.authUserId,
    capability: "availability",
    env: input.env,
    now: input.now,
  });

  if (access.code !== "authorized") {
    throw new ScheduleCalendarError(access.code);
  }

  const freeBusy = await listGoogleFreeBusyIntervals({
    accessToken: access.accessToken,
    calendarId: readGoogleCalendarId(input.participant.calendarId),
    timeZone: "UTC",
    window: input.window,
  });

  if (freeBusy.code !== "listed") {
    throw new ScheduleCalendarError(freeBusy.code);
  }

  return freeBusy.busy.map((busy): BusyInterval => ({
    ...busy,
    eventId: null,
    flexibility: { kind: "hard" },
    profileId: input.participant.hostId,
  }));
}

export function serializeScheduleResult(
  result: ScheduleResult,
  participants: readonly AuthorizedParticipant[],
): SerializedScheduleResult {
  const usernameByHostId = new Map(
    participants.map((participant) => [participant.hostId, participant.username]),
  );

  if (result.kind === "exact") {
    return { kind: "exact", slots: result.slots.map(serializeInterval) };
  }

  if (result.kind === "alternatives") {
    return {
      kind: "alternatives",
      slots: result.rankedSlots.map((slot) => serializeScoredSlot(slot, usernameByHostId)),
    };
  }

  return result;
}

function serializeScoredSlot(
  scoredSlot: ScoredSlot,
  usernameByHostId: ReadonlyMap<string, string>,
): SerializedScoredSlot {
  return {
    slot: serializeInterval(scoredSlot.slot),
    conflictCost: scoredSlot.conflictCost,
    hardConflicts: scoredSlot.hardConflicts.map((conflict) => ({
      user: readUsername(usernameByHostId, conflict.busyInterval.profileId),
      interval: serializeInterval(conflict.busyInterval),
    })),
    softConflicts: scoredSlot.softConflicts.map((conflict) => ({
      user: readUsername(usernameByHostId, conflict.busyInterval.profileId),
      interval: serializeInterval(conflict.busyInterval),
      moveCost: conflict.busyInterval.flexibility.moveCost,
    })),
  };
}

function serializeInterval(interval: TimeInterval): SerializedInterval {
  return {
    start: new Date(interval.startAtMs).toISOString(),
    end: new Date(interval.endAtMs).toISOString(),
  };
}

function readUsername(
  usernameByHostId: ReadonlyMap<string, string>,
  hostId: string,
) {
  const username = usernameByHostId.get(hostId);

  if (username === undefined) {
    throw new Error(`username missing for ${hostId}`);
  }

  return username;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
