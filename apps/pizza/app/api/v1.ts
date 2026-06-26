import { Hono, type Context } from "hono";

import type { GoogleCalendarErrorCode } from "@/calendar/google.server";
import { bookHostSlot } from "@/booking/book_slot.server";
import { parseOptionalGuestEmail } from "@/booking/guest_email";
import { createDb } from "@/db/client.server";
import { authorizeBookingCode } from "@/db/functions/booking_code_authorizations.server";
import { normalizeBookingCode } from "@/db/functions/booking_codes.server";
import { normalizeUsername } from "@/db/functions/host_profiles.server";
import { readCloudflareClientIpHash } from "@/http/client_ip.server";
import { listHostAvailableSlots } from "@/scheduling/host_availability.server";
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
import { scheduleRoute } from "./v1_schedule";

type Bindings = ServerEnv;
type V1Context = Context<{ Bindings: Bindings }>;

type ParsedBookBody = {
  readonly bookingCode: string;
  readonly email: string | null;
  readonly emailNormalized: string | null;
  readonly guestName: string;
  readonly guestTimezone: string | null;
  readonly slotStartAt: Date;
  readonly username: string;
};

type BookBodyParseResult =
  | { readonly body: ParsedBookBody; readonly code: "parsed" }
  | { readonly code: "invalid_field" | "missing_field"; readonly field: string };

export const v1 = new Hono<{ Bindings: Bindings }>();

v1.route("/schedule", scheduleRoute);

v1.get("/", (c) => {
  return c.json({
    name: "schedule.pizza",
    version: "0.0.1",
    endpoints: {
      availability: {
        method: "GET",
        path: "/api/v1/availability",
        params: { user: "string (required)", code: "string (required, booking code)" },
        headers: { "CF-Connecting-IP": "string (injected by Cloudflare)" },
      },
      book: {
        method: "POST",
        path: "/api/v1/book",
        body: {
          user: "string (required)",
          code: "string (required, booking code)",
          slot: "string (required, ISO 8601 start time)",
          name: "string (required, booker name)",
          email: "string (optional, valid booker email)",
          timezone: "string (optional, booker timezone)",
        },
        headers: { "CF-Connecting-IP": "string (injected by Cloudflare)" },
      },
      schedule: {
        method: "POST",
        path: "/api/v1/schedule",
        body: {
          participants: [{ user: "string", code: "string" }],
          durationMinutes: "number",
          granularityMinutes: "number",
          maxExactSlotCount: "number",
          maxAlternativeSlotCount: "number",
          timeZone: "IANA time zone",
          window: { start: "ISO 8601", end: "ISO 8601" },
        },
        headers: { "CF-Connecting-IP": "string (injected by Cloudflare)" },
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
      404: ["booking_code_invalid"],
      409: ["slot_unavailable"],
      422: ["host_unavailable"],
      424: [
        "google_account_missing",
        "google_access_token_missing",
        "google_calendar_scope_missing",
        "google_refresh_token_missing",
      ],
      429: ["booking_code_rate_limited"],
      500: [
        "booking_confirmation_failed",
        "booking_failure_record_failed",
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
    },
  });
});

v1.get("/availability", async (c) => {
  const username = normalizeUsername(c.req.query("user") ?? "");
  if (username === null) {
    return c.json({ error: { code: "missing_parameter", message: "Missing required parameter: user" } }, 400);
  }

  const bookingCode = normalizeBookingCode(c.req.query("code") ?? "");
  if (bookingCode === null) {
    return c.json({ error: { code: "missing_parameter", message: "Missing required parameter: code" } }, 400);
  }

  const clientIpHash = await readCloudflareClientIpHash(c.req.raw);
  if (clientIpHash.code === "client_ip_unavailable") {
    return c.json({ error: { code: "client_ip_unavailable", message: "Client IP header is unavailable" } }, 500);
  }

  const db = createDb(c.env.DB);
  const now = new Date();
  const authorization = await authorizeBookingCode(db, {
    bookingCode,
    ipHash: clientIpHash.ipHash,
    now,
    username,
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

v1.post("/book", async (c) => {
  const text = await c.req.text();
  if (text.trim().length === 0) {
    return c.json({ error: { code: "invalid_json", message: "Request body must be JSON" } }, 400);
  }

  let body: unknown;
  try {
    body = JSON.parse(text) as unknown;
  } catch {
    return c.json({ error: { code: "invalid_json", message: "Request body must be JSON" } }, 400);
  }

  const parsed = parseBookBody(body);
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
      calendar: { provider: "google", eventId: booked.calendarEventId },
      status: "confirmed",
    },
  });
});

export function parseBookBody(body: unknown): BookBodyParseResult {
  if (!isRecord(body)) {
    return { code: "missing_field", field: "user" };
  }

  const username = readUsername(body["user"]);
  if (username.code !== "parsed") return { code: username.code, field: "user" };

  const bookingCode = readBookingCode(body["code"]);
  if (bookingCode.code !== "parsed") return { code: bookingCode.code, field: "code" };

  const slotStartAt = readSlotStart(body["slot"]);
  if (slotStartAt.code !== "parsed") return { code: slotStartAt.code, field: "slot" };

  const guestName = readRequiredString(body["name"]);
  if (guestName === null) return { code: "missing_field", field: "name" };

  const email = parseOptionalGuestEmail(body["email"]);
  if (email.code !== "parsed") return { code: "invalid_field", field: "email" };

  const guestTimezone = readOptionalString(body["timezone"]);
  if (guestTimezone.code !== "parsed") {
    return { code: "invalid_field", field: "timezone" };
  }

  return {
    code: "parsed",
    body: {
      username: username.value,
      bookingCode: bookingCode.value,
      slotStartAt: slotStartAt.value,
      guestName,
      email: email.value,
      emailNormalized: email.normalized,
      guestTimezone: guestTimezone.value,
    },
  };
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

function readRequiredString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function readOptionalString(value: unknown):
  | { readonly code: "parsed"; readonly value: string | null }
  | { readonly code: "invalid" } {
  if (value === undefined || value === null) {
    return { code: "parsed", value: null };
  }

  if (typeof value !== "string") {
    return { code: "invalid" };
  }

  const trimmed = value.trim();

  return { code: "parsed", value: trimmed === "" ? null : trimmed };
}

function calendarError(c: V1Context, code: GoogleCalendarErrorCode) {
  return c.json(
    googleCalendarErrorBody(code),
    googleCalendarStatus(code),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
