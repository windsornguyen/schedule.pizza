import { Hono, type Context } from "hono";
import { cors } from "hono/cors";

import { AuthConfigError, readAuthSession } from "@/auth.server";
import {
  cancelHostBooking,
  readHostBookingCancellation,
} from "@/booking/cancel_host_booking.server";
import {
  readGoogleCalendarAccess,
  type GoogleCalendarErrorCode,
} from "@/calendar/google.server";
import { bookGroupSlot } from "@/booking/book_group_slot.server";
import { bookHostSlot } from "@/booking/book_slot.server";
import { parseRequiredGuestEmail } from "@/booking/guest_email";
import { parseOptionalGuestTimezone } from "@/booking/guest_timezone";
import { createDb } from "@/db/client.server";
import { authorizeBookingCode } from "@/db/functions/booking_code_authorizations.server";
import {
  findActiveBookingCodeForHost,
  normalizeBookingCode,
  rotateBookingCode,
} from "@/db/functions/booking_codes.server";
import { listUpcomingConfirmedBookingsForHost } from "@/db/functions/bookings.server";
import {
  createHostProfileWithBookingCode,
  findHostProfileByAuthUserId,
  normalizeUsername,
  updateHostProfile,
} from "@/db/functions/host_profiles.server";
import { hostProfile } from "@/db/schema";
import { readCloudflareClientIpHash } from "@/http/client_ip.server";
import { listHostAvailableSlots } from "@/scheduling/host_availability.server";
import { SCHEDULE_REQUEST_LIMITS } from "@/scheduling/engine";
import {
  getDefaultSearchWindow,
  isValidSlotConfiguration,
  listDefaultCandidateSlots,
  parseSlotStart,
  serializeSlot,
} from "@/scheduling/slots.server";
import type { ServerEnv } from "@/server-context";
import {
  googleCalendarErrorBody,
  googleCalendarStatus,
} from "./google_calendar_errors";
import {
  executeScheduleRequest,
  parseScheduleBody,
  parseScheduleParticipantLink,
  scheduleRoute,
} from "./v1_schedule";
import type { ParsedScheduleBody } from "./v1_schedule";

type Bindings = ServerEnv;
type V1Context = Context<{ Bindings: Bindings }>;
type ApiSession = NonNullable<Awaited<ReturnType<typeof readAuthSession>>>;

type ParsedBookBody = {
  readonly bookingCode: string;
  readonly email: string;
  readonly emailNormalized: string;
  readonly guestName: string;
  readonly guestTimezone: string | null;
  readonly slotStartAt: Date;
  readonly username: string;
};

type ParsedAvailabilityTarget = {
  readonly bookingCode: string;
  readonly username: string;
};

type ParsedGroupBookBody = {
  readonly email: string;
  readonly emailNormalized: string;
  readonly guestName: string;
  readonly guestTimezone: string | null;
  readonly schedule: ParsedScheduleBody;
  readonly slotStartAt: Date;
};

type BookBodyParseResult =
  | { readonly body: ParsedBookBody; readonly code: "parsed" }
  | { readonly code: "invalid_field" | "missing_field"; readonly field: string };

type AvailabilityTargetReadResult =
  | { readonly body: ParsedAvailabilityTarget; readonly code: "parsed" }
  | {
      readonly code: "invalid_field" | "missing_parameter";
      readonly field: "code" | "url" | "user";
    };

type GroupBookBodyParseResult =
  | { readonly body: ParsedGroupBookBody; readonly code: "parsed" }
  | { readonly code: "invalid_field" | "missing_field"; readonly field: string };

type ParsedAccountProfileBody = {
  readonly calendarId: string;
  readonly displayName: string | null;
  readonly slotSizeMinutes: number;
  readonly timezone: string;
  readonly username: string;
};

type AccountProfileBodyParseResult =
  | { readonly body: ParsedAccountProfileBody; readonly code: "parsed" }
  | { readonly code: "invalid_field" | "missing_field"; readonly field: string };

const DAY_MS = 24 * 60 * 60 * 1_000;

export const v1 = new Hono<{ Bindings: Bindings }>();

v1.use("*", async (c, next) => {
  await next();
  c.header("Cache-Control", "no-store");
  c.header("Pragma", "no-cache");
});

v1.use("*", cors({
  allowHeaders: ["Content-Type"],
  allowMethods: ["GET", "POST", "PUT", "OPTIONS"],
  maxAge: 600,
  origin: "*",
}));

v1.route("/schedule", scheduleRoute);

v1.get("/", (c) => {
  return c.json({
    name: "schedule.pizza",
    apiVersion: "v1",
    limits: {
      maxAlternativeSlotCount: SCHEDULE_REQUEST_LIMITS.maxAlternativeSlotCount,
      maxDurationMinutes: SCHEDULE_REQUEST_LIMITS.maxDurationMinutes,
      maxExactSlotCount: SCHEDULE_REQUEST_LIMITS.maxExactSlotCount,
      maxGranularityMinutes: SCHEDULE_REQUEST_LIMITS.maxGranularityMinutes,
      maxProfileCount: SCHEDULE_REQUEST_LIMITS.maxProfileCount,
      maxWindowDays: SCHEDULE_REQUEST_LIMITS.maxWindowMs / DAY_MS,
    },
    endpoints: {
      availability: {
        method: "GET",
        path: "/api/v1/availability",
        params: {
          url: "string (optional schedule.pizza link; use instead of user/code)",
          user: "string (required unless url is provided)",
          code: "string (required unless url is provided)",
        },
        headers: { "CF-Connecting-IP": "string (injected by Cloudflare)" },
      },
      health: {
        method: "GET",
        path: "/api/v1/health",
        checks: ["runtime secrets", "D1 binding", "D1 schema"],
      },
      book: {
        method: "POST",
        path: "/api/v1/book",
        body: {
          url: "string (optional schedule.pizza link; use instead of user/code)",
          user: "string (required unless url is provided)",
          code: "string (required unless url is provided)",
          slot: "string (required, UTC ISO 8601 start time)",
          name: "string (required, booker name)",
          email: "string (required, valid booker email)",
          timezone: "string (optional, valid IANA timezone)",
        },
        headers: { "CF-Connecting-IP": "string (injected by Cloudflare)" },
      },
      bookGroup: {
        method: "POST",
        path: "/api/v1/book-group",
        body: {
          participants: [{
            url: "string (optional schedule.pizza link; use instead of user/code)",
            user: "string (required unless url is provided)",
            code: "string (required unless url is provided)",
          }],
          durationMinutes: "number (1-480)",
          granularityMinutes: "number (1-240)",
          maxExactSlotCount: "number (1-100)",
          maxAlternativeSlotCount: "number (1-50)",
          timeZone: "IANA time zone",
          window: {
            start: "UTC ISO 8601",
            end: "UTC ISO 8601, max 31 days",
          },
          slot: "string (required, UTC ISO 8601 exact slot start)",
          name: "string (required, booker name)",
          email: "string (required, valid booker email)",
          timezone: "string (optional, valid booker timezone)",
        },
        headers: { "CF-Connecting-IP": "string (injected by Cloudflare)" },
      },
      recommend: {
        method: "POST",
        path: "/api/v1/recommend",
        body: "same as /api/v1/schedule",
        response: {
          exact: "returned first when everyone is free",
          alternatives: "ranked by conflict cost when no exact slot exists",
        },
        headers: { "CF-Connecting-IP": "string (injected by Cloudflare)" },
      },
      schedule: {
        method: "POST",
        path: "/api/v1/schedule",
        body: {
          participants: [{
            url: "string (optional schedule.pizza link; use instead of user/code)",
            user: "string (required unless url is provided)",
            code: "string (required unless url is provided)",
          }],
          durationMinutes: "number (1-480)",
          granularityMinutes: "number (1-240)",
          maxExactSlotCount: "number (1-100)",
          maxAlternativeSlotCount: "number (1-50)",
          timeZone: "IANA time zone",
          window: {
            start: "UTC ISO 8601",
            end: "UTC ISO 8601, max 31 days",
          },
        },
        headers: { "CF-Connecting-IP": "string (injected by Cloudflare)" },
      },
      me: {
        method: "GET",
        path: "/api/v1/me",
        auth: "Better Auth session cookie",
      },
      account: {
        method: "GET",
        path: "/api/v1/account",
        auth: "Better Auth session cookie",
      },
      accountBookings: {
        method: "GET",
        path: "/api/v1/account/bookings",
        auth: "Better Auth session cookie",
        response: {
          kind: "individual, group, or unknown",
          cancel: {
            allowed: "boolean",
            disabledReason: "null, group_booking, or calendar_missing",
          },
        },
      },
      cancelBooking: {
        method: "POST",
        path: "/api/v1/account/bookings/:bookingId/cancel",
        auth: "Better Auth session cookie",
      },
      bootstrap: {
        method: "POST",
        path: "/api/v1/me/bootstrap",
        auth: "Better Auth session cookie",
        body: {
          username: "string (required)",
          timezone: "IANA time zone (required)",
          displayName: "string (optional)",
          slotSizeMinutes: "number (optional: 15, 30, 45, 60)",
          calendarId: "string (optional, defaults to primary)",
        },
      },
      saveProfile: {
        method: "PUT",
        path: "/api/v1/account/profile",
        auth: "Better Auth session cookie",
        body: {
          username: "string (required)",
          timezone: "IANA time zone (required)",
          displayName: "string (optional)",
          slotSizeMinutes: "number (optional: 15, 30, 45, 60)",
          calendarId: "string (optional, defaults to primary)",
        },
      },
      rotateBookingCode: {
        method: "POST",
        path: "/api/v1/me/booking-code",
        auth: "Better Auth session cookie",
      },
    },
    examples: {
      availability: {
        method: "GET",
        url: "/api/v1/availability?url=https%3A%2F%2Fschedule.pizza%2Falice%3Fcode%3Dmoon-tiger-seven",
      },
      book: {
        method: "POST",
        path: "/api/v1/book",
        body: {
          url: "https://schedule.pizza/alice?code=moon-tiger-seven",
          slot: "2030-01-07T17:00:00.000Z",
          name: "Ada",
          email: "ada@example.com",
          timezone: "America/Los_Angeles",
        },
      },
      schedule: {
        method: "POST",
        path: "/api/v1/schedule",
        body: {
          participants: [
            { url: "https://schedule.pizza/alice?code=moon-tiger-seven" },
            { url: "https://schedule.pizza/bob?code=river-lime-harbor" },
          ],
          durationMinutes: 30,
          granularityMinutes: 15,
          maxExactSlotCount: 10,
          maxAlternativeSlotCount: 5,
          timeZone: "America/Los_Angeles",
          window: {
            start: "2030-01-07T17:00:00.000Z",
            end: "2030-01-08T01:00:00.000Z",
          },
        },
      },
      recommend: {
        method: "POST",
        path: "/api/v1/recommend",
        body: {
          participants: [
            { url: "https://schedule.pizza/alice?code=moon-tiger-seven" },
            { url: "https://schedule.pizza/bob?code=river-lime-harbor" },
          ],
          durationMinutes: 30,
          granularityMinutes: 15,
          maxExactSlotCount: 10,
          maxAlternativeSlotCount: 5,
          timeZone: "America/Los_Angeles",
          window: {
            start: "2030-01-07T17:00:00.000Z",
            end: "2030-01-08T01:00:00.000Z",
          },
        },
      },
      bookGroup: {
        method: "POST",
        path: "/api/v1/book-group",
        body: {
          participants: [
            { url: "https://schedule.pizza/alice?code=moon-tiger-seven" },
            { url: "https://schedule.pizza/bob?code=river-lime-harbor" },
          ],
          durationMinutes: 30,
          granularityMinutes: 15,
          maxExactSlotCount: 10,
          maxAlternativeSlotCount: 5,
          timeZone: "America/Los_Angeles",
          window: {
            start: "2030-01-07T17:00:00.000Z",
            end: "2030-01-08T01:00:00.000Z",
          },
          slot: "2030-01-07T18:00:00.000Z",
          name: "Ada",
          email: "ada@example.com",
          timezone: "America/Los_Angeles",
        },
      },
      account: {
        method: "GET",
        path: "/api/v1/account",
        auth: "Better Auth session cookie",
      },
      bootstrap: {
        method: "POST",
        path: "/api/v1/me/bootstrap",
        auth: "Better Auth session cookie",
        body: {
          username: "alice",
          timezone: "America/Los_Angeles",
          displayName: "Alice",
          slotSizeMinutes: 30,
          calendarId: "primary",
        },
      },
      saveProfile: {
        method: "PUT",
        path: "/api/v1/account/profile",
        auth: "Better Auth session cookie",
        body: {
          username: "alice",
          timezone: "America/Los_Angeles",
          displayName: "Alice",
          slotSizeMinutes: 30,
          calendarId: "primary",
        },
      },
      rotateBookingCode: {
        method: "POST",
        path: "/api/v1/me/booking-code",
        auth: "Better Auth session cookie",
      },
      accountBookings: {
        method: "GET",
        path: "/api/v1/account/bookings",
        auth: "Better Auth session cookie",
      },
      cancelBooking: {
        method: "POST",
        path: "/api/v1/account/bookings/booking_123/cancel",
        auth: "Better Auth session cookie",
      },
    },
    errors: {
      400: [
        "missing_parameter",
        "invalid_json",
        "missing_field",
        "invalid_field",
        "invalid_slot",
        "invalid_schedule_request",
      ],
      401: ["unauthenticated"],
      403: ["forbidden_origin"],
      404: ["booking_code_invalid", "booking_missing"],
      409: [
        "booking_calendar_missing",
        "group_booking_cancel_unsupported",
        "host_profile_exists",
        "host_profile_missing",
        "slot_unavailable",
        "username_taken",
      ],
      422: ["host_unavailable", "participant_email_missing"],
      424: [
        "google_account_missing",
        "google_access_token_missing",
        "google_calendar_scope_missing",
        "google_refresh_token_missing",
      ],
      429: ["booking_code_rate_limited", "booking_rate_limited"],
      500: [
        "booking_confirmation_failed",
        "booking_cancel_failed",
        "booking_failure_record_failed",
        "auth_user_email_missing",
        "client_ip_unavailable",
        "host_configuration_invalid",
      ],
      502: [
        "google_event_delete_failed",
        "google_event_insert_failed",
        "google_event_insert_response_invalid",
        "google_freebusy_failed",
        "google_freebusy_response_invalid",
        "google_token_refresh_failed",
        "google_token_response_invalid",
      ],
      503: ["database_unavailable", "runtime_secret_missing"],
    },
  });
});

v1.get("/health", async (c) => {
  const runtime = readRuntimeHealth(c.env);

  if (runtime.code !== "healthy") {
    return c.json({
      ok: false,
      error: { code: runtime.code, message: runtime.message },
    }, 503);
  }

  const database = await readDatabaseHealth(c.env);

  if (database.code !== "healthy") {
    return c.json({
      ok: false,
      error: { code: database.code, message: database.message },
    }, 503);
  }

  return c.json({
    ok: true,
    auth: {
      googleClientId: c.env.GOOGLE_CLIENT_ID,
      googleRedirectUri: new URL(
        "/api/auth/callback/google",
        runtime.authBaseUrl,
      ).toString(),
    },
    checks: {
      database: "healthy",
      runtime: "healthy",
    },
  });
});

v1.post("/recommend", async (c) => {
  return handleScheduleLikeRequest(c);
});

v1.get("/me", async (c) => {
  return handleAccountRead(c);
});

v1.get("/account", async (c) => {
  return handleAccountRead(c);
});

v1.get("/account/bookings", async (c) => {
  const session = await readApiSession(c);

  if (session.code !== "authenticated") {
    return apiSessionError(c, session.code);
  }

  const db = createDb(c.env.DB);
  const now = new Date();
  const profile = await findHostProfileByAuthUserId(db, session.session.user.id);

  if (profile === null) {
    return c.json({ error: { code: "host_profile_missing", message: "Host profile is missing" } }, 409);
  }

  return c.json(await buildHostBookingsPayload(db, {
    hostId: profile.id,
    limit: 20,
    now,
  }));
});

v1.post("/account/bookings/:bookingId/cancel", async (c) => {
  const originError = rejectCrossSiteAccountMutation(c);

  if (originError !== null) {
    return originError;
  }

  const session = await readApiSession(c);

  if (session.code !== "authenticated") {
    return apiSessionError(c, session.code);
  }

  const bookingId = readRouteParam(c.req.param("bookingId"));

  if (bookingId === null) {
    return c.json({ error: { code: "invalid_field", message: "bookingId is invalid" } }, 400);
  }

  const db = createDb(c.env.DB);
  const profile = await findHostProfileByAuthUserId(db, session.session.user.id);

  if (profile === null) {
    return c.json({ error: { code: "host_profile_missing", message: "Host profile is missing" } }, 409);
  }

  const cancelled = await cancelHostBooking(db, {
    authUserId: session.session.user.id,
    bookingId,
    calendarId: profile.calendarId,
    env: c.env,
    hostId: profile.id,
    now: new Date(),
  });

  if (cancelled.code === "cancelled") {
    return c.json({
      ok: true,
      booking: { id: cancelled.bookingId, status: "cancelled" },
    });
  }

  if (cancelled.code === "booking_missing") {
    return c.json({ error: { code: "booking_missing", message: "Booking not found" } }, 404);
  }

  if (
    cancelled.code === "booking_calendar_missing" ||
    cancelled.code === "group_booking_cancel_unsupported"
  ) {
    return c.json({ error: { code: cancelled.code, message: "Booking is not cancellable" } }, 409);
  }

  if (cancelled.code === "booking_cancel_failed") {
    return c.json({ error: { code: cancelled.code, message: "Booking cancellation failed" } }, 500);
  }

  return calendarError(c, cancelled.code);
});

v1.post("/me/bootstrap", async (c) => {
  const originError = rejectCrossSiteAccountMutation(c);

  if (originError !== null) {
    return originError;
  }

  const session = await readApiSession(c);

  if (session.code !== "authenticated") {
    return apiSessionError(c, session.code);
  }

  const parsedJson = parseJsonText(await c.req.text());

  if (parsedJson.code === "invalid_json") {
    return c.json({ error: { code: "invalid_json", message: "Request body must be JSON" } }, 400);
  }

  const parsed = parseAccountProfileBody(parsedJson.body);

  if (parsed.code !== "parsed") {
    return invalidParsedField(c, parsed);
  }

  const db = createDb(c.env.DB);
  const existingProfile = await findHostProfileByAuthUserId(db, session.session.user.id);

  if (existingProfile !== null) {
    return c.json({ error: { code: "host_profile_exists", message: "Host profile already exists" } }, 409);
  }

  const calendarStatus = await readConnectedCalendarStatus(db, c.env, session.session.user.id);

  if (calendarStatus.code !== "connected") {
    return calendarError(c, calendarStatus.code);
  }

  const email = readSessionEmail(session.session);

  if (email === null) {
    return c.json({ error: { code: "auth_user_email_missing", message: "Authenticated user email is missing" } }, 500);
  }

  const now = new Date();
  const created = await createHostProfileWithBookingCode(c.env.DB, {
    id: crypto.randomUUID(),
    authUserId: session.session.user.id,
    calendarAccountEmail: email,
    calendarId: parsed.body.calendarId,
    calendarProvider: "google",
    displayName: parsed.body.displayName ?? parsed.body.username,
    username: parsed.body.username,
    timezone: parsed.body.timezone,
    slotSizeMinutes: parsed.body.slotSizeMinutes,
    now,
  });

  if (created.code === "profile_conflict") {
    return c.json({ error: { code: "username_taken", message: "Username is taken" } }, 409);
  }

  return c.json(await buildAccountPayload(db, c.env, session.session, {
    bookingCode: created.bookingCode,
    now,
  }));
});

v1.put("/account/profile", async (c) => {
  const originError = rejectCrossSiteAccountMutation(c);

  if (originError !== null) {
    return originError;
  }

  const session = await readApiSession(c);

  if (session.code !== "authenticated") {
    return apiSessionError(c, session.code);
  }

  const parsedJson = parseJsonText(await c.req.text());

  if (parsedJson.code === "invalid_json") {
    return c.json({ error: { code: "invalid_json", message: "Request body must be JSON" } }, 400);
  }

  const parsed = parseAccountProfileBody(parsedJson.body);

  if (parsed.code !== "parsed") {
    return invalidParsedField(c, parsed);
  }

  const db = createDb(c.env.DB);
  const existingProfile = await findHostProfileByAuthUserId(db, session.session.user.id);

  if (existingProfile === null) {
    return c.json({ error: { code: "host_profile_missing", message: "Host profile is missing" } }, 409);
  }

  const calendarStatus = await readConnectedCalendarStatus(db, c.env, session.session.user.id);

  if (calendarStatus.code !== "connected") {
    return calendarError(c, calendarStatus.code);
  }

  const email = readSessionEmail(session.session);

  if (email === null) {
    return c.json({ error: { code: "auth_user_email_missing", message: "Authenticated user email is missing" } }, 500);
  }

  const now = new Date();
  const updated = await updateHostProfile(c.env.DB, {
    authUserId: session.session.user.id,
    calendarAccountEmail: email,
    calendarId: parsed.body.calendarId,
    calendarProvider: "google",
    currentHostId: existingProfile.id,
    currentUsername: existingProfile.username,
    displayName: parsed.body.displayName ?? parsed.body.username,
    username: parsed.body.username,
    timezone: parsed.body.timezone,
    slotSizeMinutes: parsed.body.slotSizeMinutes,
    now,
  });

  if (updated.code === "profile_missing") {
    return c.json({ error: { code: "host_profile_missing", message: "Host profile is missing" } }, 409);
  }

  if (updated.code === "profile_conflict") {
    return c.json({ error: { code: "username_taken", message: "Username is taken" } }, 409);
  }

  return c.json(await buildAccountPayload(
    db,
    c.env,
    session.session,
    updated.bookingCode === null
      ? { now }
      : { bookingCode: updated.bookingCode, now },
  ));
});

v1.post("/me/booking-code", async (c) => {
  const originError = rejectCrossSiteAccountMutation(c);

  if (originError !== null) {
    return originError;
  }

  const session = await readApiSession(c);

  if (session.code !== "authenticated") {
    return apiSessionError(c, session.code);
  }

  const db = createDb(c.env.DB);
  const profile = await findHostProfileByAuthUserId(db, session.session.user.id);

  if (profile === null) {
    return c.json({ error: { code: "host_profile_missing", message: "Host profile is missing" } }, 409);
  }

  const calendarStatus = await readConnectedCalendarStatus(db, c.env, session.session.user.id);

  if (calendarStatus.code !== "connected") {
    return calendarError(c, calendarStatus.code);
  }

  const now = new Date();
  const code = await rotateBookingCode(c.env.DB, {
    hostId: profile.id,
    hostUsername: profile.username,
    wordCount: 3,
    label: null,
    now,
  });

  return c.json(await buildAccountPayload(db, c.env, session.session, {
    bookingCode: code.code,
    now,
  }));
});

v1.get("/availability", async (c) => {
  const target = readAvailabilityTarget({
    code: c.req.query("code") ?? null,
    url: c.req.query("url") ?? null,
    user: c.req.query("user") ?? null,
  });

  if (target.code !== "parsed") {
    return c.json({
      error: {
        code: target.code,
        message: target.code === "missing_parameter"
          ? `Missing required parameter: ${target.field}`
          : `${target.field} is invalid`,
      },
    }, 400);
  }

  const clientIpHash = await readCloudflareClientIpHash(c.req.raw);
  if (clientIpHash.code === "client_ip_unavailable") {
    return c.json({ error: { code: "client_ip_unavailable", message: "Client IP header is unavailable" } }, 500);
  }

  const db = createDb(c.env.DB);
  const now = new Date();
  const authorization = await authorizeBookingCode(db, {
    bookingCode: target.body.bookingCode,
    ipHash: clientIpHash.ipHash,
    now,
    username: target.body.username,
  });

  if (authorization.code === "booking_code_rate_limited") {
    return c.json({ error: { code: "booking_code_rate_limited", message: "Too many failed booking code attempts" } }, 429);
  }
  if (authorization.code === "booking_code_invalid") {
    return c.json({ error: { code: "booking_code_invalid", message: "Invalid booking code" } }, 404);
  }

  const host = authorization.access.host;
  if (!isValidSlotConfiguration({ slotSizeMinutes: host.slotSizeMinutes, timeZone: host.timezone })) {
    return c.json({ error: { code: "host_configuration_invalid", message: "Host slot configuration is invalid" } }, 500);
  }

  const window = getDefaultSearchWindow(now);
  const candidateSlots = listDefaultCandidateSlots({
    now,
    slotSizeMinutes: host.slotSizeMinutes,
    timeZone: host.timezone,
  });

  if (candidateSlots.length === 0) {
    return c.json({ error: { code: "host_unavailable", message: "Host is unavailable" } }, 422);
  }

  const availability = await listHostAvailableSlots(db, {
    candidateSlots,
    env: c.env,
    host,
    now,
    window,
  });

  if (availability.code !== "listed") {
    return calendarError(c, availability.code);
  }

  return c.json({
    user: host.username,
    timezone: host.timezone,
    slotSizeMinutes: host.slotSizeMinutes,
    slots: availability.slots.map(serializeSlot),
  });
});

export function readAvailabilityTarget(input: {
  readonly code: string | null;
  readonly url: string | null;
  readonly user: string | null;
}): AvailabilityTargetReadResult {
  if (input.url !== null) {
    const parsed = parseScheduleParticipantLink(input.url);

    return input.user !== null || input.code !== null || parsed === null
      ? { code: "invalid_field", field: "url" }
      : { code: "parsed", body: parsed };
  }

  if (input.user === null || input.user.trim() === "") {
    return { code: "missing_parameter", field: "user" };
  }

  const username = normalizeUsername(input.user);
  if (username === null) {
    return { code: "invalid_field", field: "user" };
  }

  if (input.code === null || input.code.trim() === "") {
    return { code: "missing_parameter", field: "code" };
  }

  const bookingCode = normalizeBookingCode(input.code);
  if (bookingCode === null) {
    return { code: "invalid_field", field: "code" };
  }

  return { code: "parsed", body: { username, bookingCode } };
}

v1.post("/book", async (c) => {
  const parsedJson = parseJsonText(await c.req.text());

  if (parsedJson.code === "invalid_json") {
    return c.json({ error: { code: "invalid_json", message: "Request body must be JSON" } }, 400);
  }

  const parsed = parseBookBody(parsedJson.body);
  if (parsed.code !== "parsed") {
    return c.json({
      error: {
        code: parsed.code,
        message: `${parsed.field} is ${parsed.code === "missing_field" ? "required" : "invalid"}`,
      },
    }, 400);
  }

  const clientIpHash = await readCloudflareClientIpHash(c.req.raw);
  if (clientIpHash.code === "client_ip_unavailable") {
    return c.json({ error: { code: "client_ip_unavailable", message: "Client IP header is unavailable" } }, 500);
  }

  const db = createDb(c.env.DB);
  const now = new Date();
  const authorization = await authorizeBookingCode(db, {
    bookingCode: parsed.body.bookingCode,
    ipHash: clientIpHash.ipHash,
    now,
    username: parsed.body.username,
  });

  if (authorization.code === "booking_code_rate_limited") {
    return c.json({ error: { code: "booking_code_rate_limited", message: "Too many failed booking code attempts" } }, 429);
  }
  if (authorization.code === "booking_code_invalid") {
    return c.json({ error: { code: "booking_code_invalid", message: "Invalid booking code" } }, 404);
  }

  const host = authorization.access.host;
  if (!isValidSlotConfiguration({ slotSizeMinutes: host.slotSizeMinutes, timeZone: host.timezone })) {
    return c.json({ error: { code: "host_configuration_invalid", message: "Host slot configuration is invalid" } }, 500);
  }

  const booked = await bookHostSlot(db, {
    env: c.env,
    host,
    bookingCodeId: authorization.access.code.id,
    guestName: parsed.body.guestName,
    guestEmail: parsed.body.email,
    guestEmailNormalized: parsed.body.emailNormalized,
    guestTimezone: parsed.body.guestTimezone,
    source: "api",
    now,
    slotStartAt: parsed.body.slotStartAt,
  });

  if (booked.code === "invalid_slot") {
    return c.json({ error: { code: "invalid_slot", message: "Slot is not bookable" } }, 400);
  }

  if (booked.code === "slot_unavailable") {
    return c.json({ error: { code: "slot_unavailable", message: "Slot is unavailable" } }, 409);
  }

  if (booked.code === "booking_rate_limited") {
    return c.json({ error: { code: "booking_rate_limited", message: "Too many bookings for this code" } }, 429);
  }

  if (booked.code === "host_configuration_invalid") {
    return c.json({ error: { code: "host_configuration_invalid", message: "Host slot configuration is invalid" } }, 500);
  }

  if (booked.code === "booking_confirmation_failed" || booked.code === "booking_failure_record_failed") {
    return c.json({ error: { code: booked.code, message: "Booking state transition failed" } }, 500);
  }

  if (booked.code !== "booked") {
    return calendarError(c, booked.code);
  }

  return c.json({
    ok: true,
    booking: {
      id: booked.bookingId,
      user: host.username,
      slot: serializeSlot(booked.slot),
      booker: { name: parsed.body.guestName, email: parsed.body.email },
      calendar: { provider: "google" },
      status: "confirmed",
    },
  });
});

v1.post("/book-group", async (c) => {
  const parsedJson = parseJsonText(await c.req.text());

  if (parsedJson.code === "invalid_json") {
    return c.json({ error: { code: "invalid_json", message: "Request body must be JSON" } }, 400);
  }

  const parsed = parseGroupBookBody(parsedJson.body);

  if (parsed.code !== "parsed") {
    return c.json({
      error: {
        code: parsed.code,
        message: `${parsed.field} is ${parsed.code === "missing_field" ? "required" : "invalid"}`,
      },
    }, 400);
  }

  const clientIpHash = await readCloudflareClientIpHash(c.req.raw);

  if (clientIpHash.code === "client_ip_unavailable") {
    return c.json({ error: { code: "client_ip_unavailable", message: "Client IP header is unavailable" } }, 500);
  }

  const booked = await bookGroupSlot(createDb(c.env.DB), {
    body: parsed.body.schedule,
    env: c.env,
    guestName: parsed.body.guestName,
    guestEmail: parsed.body.email,
    guestEmailNormalized: parsed.body.emailNormalized,
    guestTimezone: parsed.body.guestTimezone,
    ipHash: clientIpHash.ipHash,
    source: "api",
    now: new Date(),
    slotStartAt: parsed.body.slotStartAt,
  });

  if (booked.code === "booking_code_rate_limited") {
    return c.json({ error: { code: "booking_code_rate_limited", message: "Too many failed booking code attempts" } }, 429);
  }

  if (booked.code === "booking_code_invalid") {
    return c.json({ error: { code: "booking_code_invalid", message: "Invalid booking code" } }, 404);
  }

  if (booked.code === "invalid_slot") {
    return c.json({ error: { code: "invalid_slot", message: "Slot is not bookable" } }, 400);
  }

  if (booked.code === "slot_unavailable") {
    return c.json({ error: { code: "slot_unavailable", message: "Slot is unavailable" } }, 409);
  }

  if (booked.code === "booking_rate_limited") {
    return c.json({ error: { code: "booking_rate_limited", message: "Too many bookings for this code" } }, 429);
  }

  if (booked.code === "participant_email_missing") {
    return c.json({ error: { code: "participant_email_missing", message: "Participant calendar email is missing" } }, 422);
  }

  if (booked.code === "booking_confirmation_failed" || booked.code === "booking_failure_record_failed") {
    return c.json({ error: { code: booked.code, message: "Booking state transition failed" } }, 500);
  }

  if (booked.code !== "booked") {
    return calendarError(c, booked.code);
  }

  return c.json({
    ok: true,
    booking: {
      ids: booked.bookingIds,
      slot: {
        start: booked.slot.startAt.toISOString(),
        end: booked.slot.endAt.toISOString(),
      },
      booker: { name: parsed.body.guestName, email: parsed.body.email },
      calendar: { provider: "google" },
      status: "confirmed",
    },
  });
});

export function parseAccountProfileBody(
  body: unknown,
): AccountProfileBodyParseResult {
  if (!isRecord(body)) {
    return { code: "missing_field", field: "username" };
  }

  const username = readUsername(body["username"]);
  if (username.code !== "parsed") return { code: username.code, field: "username" };

  const timezone = readRequiredTimeZone(body["timezone"]);
  if (timezone.code !== "parsed") return { code: timezone.code, field: "timezone" };

  const displayName = readOptionalTrimmedString(body["displayName"]);
  if (displayName.code !== "parsed") return { code: "invalid_field", field: "displayName" };

  const slotSizeMinutes = readOptionalSlotSizeMinutes(body["slotSizeMinutes"]);
  if (slotSizeMinutes.code !== "parsed") return { code: slotSizeMinutes.code, field: "slotSizeMinutes" };

  const calendarId = readOptionalCalendarId(body["calendarId"]);
  if (calendarId.code !== "parsed") return { code: calendarId.code, field: "calendarId" };

  return {
    code: "parsed",
    body: {
      calendarId: calendarId.value,
      displayName: displayName.value,
      slotSizeMinutes: slotSizeMinutes.value,
      timezone: timezone.value,
      username: username.value,
    },
  };
}

export function parseGroupBookBody(body: unknown): GroupBookBodyParseResult {
  const schedule = parseScheduleBody(body);

  if (schedule.code !== "parsed") {
    return schedule;
  }

  if (!isRecord(body)) {
    return { code: "missing_field", field: "participants" };
  }

  const slotStartAt = readSlotStart(body["slot"]);
  if (slotStartAt.code !== "parsed") return { code: slotStartAt.code, field: "slot" };

  const guestName = readRequiredString(body["name"]);
  if (guestName === null) return { code: "missing_field", field: "name" };

  const email = parseRequiredGuestEmail(body["email"]);
  if (email.code === "missing") return { code: "missing_field", field: "email" };
  if (email.code === "invalid") return { code: "invalid_field", field: "email" };

  const guestTimezone = parseOptionalGuestTimezone(body["timezone"]);
  if (guestTimezone.code !== "parsed") {
    return { code: "invalid_field", field: "timezone" };
  }

  return {
    code: "parsed",
    body: {
      email: email.value,
      emailNormalized: email.normalized,
      guestName,
      guestTimezone: guestTimezone.value,
      schedule: schedule.body,
      slotStartAt: slotStartAt.value,
    },
  };
}

export function parseBookBody(body: unknown): BookBodyParseResult {
  if (!isRecord(body)) {
    return { code: "missing_field", field: "user" };
  }

  const target = readBookingTarget(body);
  if (target.code !== "parsed") return target;

  const slotStartAt = readSlotStart(body["slot"]);
  if (slotStartAt.code !== "parsed") return { code: slotStartAt.code, field: "slot" };

  const guestName = readRequiredString(body["name"]);
  if (guestName === null) return { code: "missing_field", field: "name" };

  const email = parseRequiredGuestEmail(body["email"]);
  if (email.code === "missing") return { code: "missing_field", field: "email" };
  if (email.code === "invalid") return { code: "invalid_field", field: "email" };

  const guestTimezone = parseOptionalGuestTimezone(body["timezone"]);
  if (guestTimezone.code !== "parsed") {
    return { code: "invalid_field", field: "timezone" };
  }

  return {
    code: "parsed",
    body: {
      username: target.username,
      bookingCode: target.bookingCode,
      slotStartAt: slotStartAt.value,
      guestName,
      email: email.value,
      emailNormalized: email.normalized,
      guestTimezone: guestTimezone.value,
    },
  };
}

function readBookingTarget(body: Record<string, unknown>):
  | { readonly bookingCode: string; readonly code: "parsed"; readonly username: string }
  | { readonly code: "invalid_field" | "missing_field"; readonly field: string } {
  const hasUrl = body["url"] !== undefined;
  const hasUser = body["user"] !== undefined;
  const hasCode = body["code"] !== undefined;

  if (hasUrl) {
    const parsed = typeof body["url"] === "string"
      ? parseScheduleParticipantLink(body["url"])
      : null;

    return hasUser || hasCode || parsed === null
      ? { code: "invalid_field", field: "url" }
      : { code: "parsed", ...parsed };
  }

  const username = readUsername(body["user"]);
  if (username.code !== "parsed") return { code: username.code, field: "user" };

  const bookingCode = readBookingCode(body["code"]);
  if (bookingCode.code !== "parsed") return { code: bookingCode.code, field: "code" };

  return {
    code: "parsed",
    username: username.value,
    bookingCode: bookingCode.value,
  };
}

async function handleScheduleLikeRequest(c: V1Context) {
  const parsedJson = parseJsonText(await c.req.text());

  if (parsedJson.code === "invalid_json") {
    return c.json({ error: { code: "invalid_json", message: "Request body must be JSON" } }, 400);
  }

  const parsedBody = parseScheduleBody(parsedJson.body);

  if (parsedBody.code !== "parsed") {
    return invalidParsedField(c, parsedBody);
  }

  const clientIpHash = await readCloudflareClientIpHash(c.req.raw);

  if (clientIpHash.code === "client_ip_unavailable") {
    return c.json({ error: { code: "client_ip_unavailable", message: "Client IP header is unavailable" } }, 500);
  }

  const scheduled = await executeScheduleRequest(createDb(c.env.DB), {
    body: parsedBody.body,
    env: c.env,
    ipHash: clientIpHash.ipHash,
    now: new Date(),
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
    return calendarError(c, scheduled.code);
  }

  return c.json(scheduled.body);
}

async function handleAccountRead(c: V1Context) {
  const session = await readApiSession(c);

  if (session.code !== "authenticated") {
    return apiSessionError(c, session.code);
  }

  return c.json(await buildAccountPayload(
    createDb(c.env.DB),
    c.env,
    session.session,
    { now: new Date() },
  ));
}

async function buildHostBookingsPayload(
  db: ReturnType<typeof createDb>,
  input: {
    readonly hostId: string;
    readonly limit: number;
    readonly now: Date;
  },
) {
  const bookings = await listUpcomingConfirmedBookingsForHost(db, input);
  const serializedBookings = await Promise.all(
    bookings.map(async (booking) => {
      const cancellation = await readHostBookingCancellation(
        db,
        booking.calendarEventId,
      );

      return {
        canCancel: cancellation.canCancel,
        cancel: {
          allowed: cancellation.canCancel,
          disabledReason: cancellation.disabledReason,
        },
        guest: {
          email: booking.guestEmail,
          name: booking.guestName,
        },
        id: booking.id,
        kind: cancellation.kind,
        slot: {
          start: booking.slotStartAt.toISOString(),
          end: booking.slotEndAt.toISOString(),
        },
        status: "confirmed" as const,
      };
    }),
  );

  return { ok: true, bookings: serializedBookings };
}

async function readApiSession(c: V1Context):
  Promise<
    | { readonly code: "authenticated"; readonly session: ApiSession }
    | { readonly code: "runtime_secret_missing" | "unauthenticated" }
  > {
  try {
    const session = await readAuthSession(c.env, c.req.raw.headers);

    return session === null
      ? { code: "unauthenticated" }
      : { code: "authenticated", session };
  } catch (error: unknown) {
    if (error instanceof AuthConfigError && error.code === "missing_auth_env") {
      return { code: "runtime_secret_missing" };
    }

    throw error;
  }
}

function apiSessionError(
  c: V1Context,
  code: "runtime_secret_missing" | "unauthenticated",
) {
  if (code === "runtime_secret_missing") {
    return c.json({ error: { code, message: "Runtime auth secret is missing" } }, 503);
  }

  return c.json({ error: { code, message: "Authentication required" } }, 401);
}

function rejectCrossSiteAccountMutation(c: V1Context) {
  const origin = c.req.header("Origin");

  if (origin === undefined || origin.trim() === "") {
    return null;
  }

  const trustedOrigin = readTrustedAccountOrigin(c.env);

  if (trustedOrigin.code === "runtime_secret_missing") {
    return c.json({
      error: {
        code: trustedOrigin.code,
        message: "Runtime auth URL is missing or invalid",
      },
    }, 503);
  }

  if (origin !== trustedOrigin.origin) {
    return c.json({
      error: {
        code: "forbidden_origin",
        message: "Cross-site account mutation rejected",
      },
    }, 403);
  }

  return null;
}

function readTrustedAccountOrigin(env: ServerEnv) {
  const authUrl = env.BETTER_AUTH_URL;

  if (authUrl === undefined || authUrl.trim() === "") {
    return { code: "runtime_secret_missing" as const };
  }

  try {
    const url = new URL(authUrl);

    return url.protocol === "http:" || url.protocol === "https:"
      ? { code: "read" as const, origin: url.origin }
      : { code: "runtime_secret_missing" as const };
  } catch {
    return { code: "runtime_secret_missing" as const };
  }
}

async function buildAccountPayload(
  db: ReturnType<typeof createDb>,
  env: ServerEnv,
  session: ApiSession,
  input: { readonly bookingCode?: string; readonly now: Date },
) {
  const email = readSessionEmail(session);
  const profile = await findHostProfileByAuthUserId(db, session.user.id);

  if (profile === null) {
    return {
      ok: true,
      account: {
        email,
        profile: null,
        profilePath: null,
        activeBookingCode: null,
        bookingCode: input.bookingCode ?? null,
        bookingPath: null,
        bookingUrl: null,
      },
    };
  }

  const activeBookingCode = await findActiveBookingCodeForHost(db, {
    hostId: profile.id,
    now: input.now,
  });
  const calendarStatus = await readConnectedCalendarStatus(
    db,
    env,
    session.user.id,
  );

  return {
    ok: true,
    account: {
      email,
      profile: {
        username: profile.username,
        displayName: profile.displayName,
        timezone: profile.timezone,
        slotSizeMinutes: profile.slotSizeMinutes,
        calendarStatus: calendarStatus.code === "connected"
          ? "connected"
          : "reconnect_required",
      },
      profilePath: `/${profile.username}`,
      activeBookingCode: activeBookingCode === null
        ? null
        : {
            createdAt: activeBookingCode.createdAt.toISOString(),
            expiresAt: activeBookingCode.expiresAt?.toISOString() ?? null,
            wordCount: activeBookingCode.wordCount,
          },
      bookingCode: input.bookingCode ?? null,
      bookingPath: input.bookingCode === undefined
        ? null
        : `/${profile.username}?code=${input.bookingCode}`,
      bookingUrl: input.bookingCode === undefined
        ? null
        : new URL(
            `/${profile.username}?code=${input.bookingCode}`,
            env.BETTER_AUTH_URL,
          ).toString(),
    },
  };
}

async function readConnectedCalendarStatus(
  db: ReturnType<typeof createDb>,
  env: ServerEnv,
  authUserId: string,
): Promise<{ readonly code: "connected" } | { readonly code: GoogleCalendarErrorCode }> {
  const availability = await readGoogleCalendarAccess(db, {
    authUserId,
    capability: "availability",
    env,
    now: new Date(),
  });

  if (availability.code !== "authorized") {
    return { code: availability.code };
  }

  const eventWrite = await readGoogleCalendarAccess(db, {
    authUserId,
    capability: "event_write",
    env,
    now: new Date(),
  });

  return eventWrite.code === "authorized"
    ? { code: "connected" }
    : { code: eventWrite.code };
}

function readRuntimeHealth(env: ServerEnv):
  | { readonly authBaseUrl: URL; readonly code: "healthy" }
  | { readonly code: "runtime_secret_missing"; readonly message: string } {
  if (isMissingRuntimeString(env.BETTER_AUTH_SECRET ?? null)) {
    return { code: "runtime_secret_missing", message: "BETTER_AUTH_SECRET is missing" };
  }

  if (isMissingRuntimeString(env.BETTER_AUTH_URL ?? null)) {
    return { code: "runtime_secret_missing", message: "BETTER_AUTH_URL is missing" };
  }

  const authBaseUrl = readRuntimeUrl(env.BETTER_AUTH_URL ?? null);

  if (authBaseUrl === null) {
    return { code: "runtime_secret_missing", message: "BETTER_AUTH_URL is invalid" };
  }

  if (isMissingRuntimeString(env.GOOGLE_CLIENT_ID ?? null)) {
    return { code: "runtime_secret_missing", message: "GOOGLE_CLIENT_ID is missing" };
  }

  if (isMissingRuntimeString(env.GOOGLE_CLIENT_SECRET ?? null)) {
    return { code: "runtime_secret_missing", message: "GOOGLE_CLIENT_SECRET is missing" };
  }

  return { code: "healthy", authBaseUrl };
}

function isMissingRuntimeString(value: string | null) {
  return value === null || value.trim() === "";
}

function readRuntimeUrl(value: string | null) {
  if (value === null) {
    return null;
  }

  try {
    const url = new URL(value);

    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

async function readDatabaseHealth(env: ServerEnv):
  Promise<
    | { readonly code: "healthy" }
    | { readonly code: "database_unavailable"; readonly message: string }
  > {
  try {
    await createDb(env.DB).select({ id: hostProfile.id }).from(hostProfile).limit(1);
    return { code: "healthy" };
  } catch {
    return { code: "database_unavailable", message: "D1 schema query failed" };
  }
}

function readSessionEmail(session: ApiSession) {
  const email = session.user.email;

  return typeof email === "string" && email.trim() !== ""
    ? email.trim()
    : null;
}

function invalidParsedField(
  c: V1Context,
  parsed: { readonly code: "invalid_field" | "missing_field"; readonly field: string },
) {
  return c.json({
    error: {
      code: parsed.code,
      message: `${parsed.field} is ${parsed.code === "missing_field" ? "required" : "invalid"}`,
    },
  }, 400);
}

function readRouteParam(value: string) {
  const trimmedValue = value.trim();

  return trimmedValue === "" ? null : trimmedValue;
}

type RequiredParsedValue<T> =
  | { readonly code: "parsed"; readonly value: T }
  | { readonly code: "invalid_field" | "missing_field" };

function readUsername(value: unknown): RequiredParsedValue<string> {
  if (value === undefined || value === null) {
    return { code: "missing_field" };
  }

  if (typeof value !== "string") {
    return { code: "invalid_field" };
  }

  const username = normalizeUsername(value);

  return username === null
    ? { code: "invalid_field" }
    : { code: "parsed", value: username };
}

function readBookingCode(value: unknown): RequiredParsedValue<string> {
  if (value === undefined || value === null) {
    return { code: "missing_field" };
  }

  if (typeof value !== "string") {
    return { code: "invalid_field" };
  }

  const bookingCode = normalizeBookingCode(value);

  return bookingCode === null
    ? { code: "invalid_field" }
    : { code: "parsed", value: bookingCode };
}

function readSlotStart(value: unknown): RequiredParsedValue<Date> {
  if (value === undefined || value === null) {
    return { code: "missing_field" };
  }

  if (typeof value !== "string") {
    return { code: "invalid_field" };
  }

  const slotStartAt = parseSlotStart(value);

  return slotStartAt === null
    ? { code: "invalid_field" }
    : { code: "parsed", value: slotStartAt };
}

function readRequiredTimeZone(value: unknown): RequiredParsedValue<string> {
  if (value === undefined || value === null) {
    return { code: "missing_field" };
  }

  if (typeof value !== "string") {
    return { code: "invalid_field" };
  }

  const timeZone = value.trim();

  if (timeZone === "") {
    return { code: "missing_field" };
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return { code: "parsed", value: timeZone };
  } catch {
    return { code: "invalid_field" };
  }
}

function readOptionalTrimmedString(value: unknown):
  | { readonly code: "parsed"; readonly value: string | null }
  | { readonly code: "invalid_field" } {
  if (value === undefined || value === null) {
    return { code: "parsed", value: null };
  }

  if (typeof value !== "string") {
    return { code: "invalid_field" };
  }

  const trimmedValue = value.trim();

  return {
    code: "parsed",
    value: trimmedValue === "" ? null : trimmedValue,
  };
}

function readOptionalSlotSizeMinutes(value: unknown):
  | { readonly code: "parsed"; readonly value: number }
  | { readonly code: "invalid_field" } {
  if (value === undefined || value === null) {
    return { code: "parsed", value: 30 };
  }

  return typeof value === "number" &&
    Number.isInteger(value) &&
    [15, 30, 45, 60].includes(value)
    ? { code: "parsed", value }
    : { code: "invalid_field" };
}

function readOptionalCalendarId(value: unknown):
  | { readonly code: "parsed"; readonly value: string }
  | { readonly code: "invalid_field" } {
  if (value === undefined || value === null) {
    return { code: "parsed", value: "primary" };
  }

  if (typeof value !== "string") {
    return { code: "invalid_field" };
  }

  const calendarId = value.trim();

  return calendarId === ""
    ? { code: "parsed", value: "primary" }
    : { code: "parsed", value: calendarId };
}

function readRequiredString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function calendarError(c: V1Context, code: GoogleCalendarErrorCode) {
  return c.json(
    googleCalendarErrorBody(code),
    googleCalendarStatus(code),
  );
}

function parseJsonText(text: string):
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
