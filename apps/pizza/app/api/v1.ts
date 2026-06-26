import { Hono } from "hono";

import { createDb } from "@/db/client.server";
import { authorizeBookingCode } from "@/db/functions/booking_code_authorizations.server";
import {
  markBookingCodeUsed,
  normalizeBookingCode,
} from "@/db/functions/booking_codes.server";
import {
  createConfirmedBooking,
  findConfirmedBookingsForHost,
} from "@/db/functions/bookings.server";
import { normalizeUsername } from "@/db/functions/host_profiles.server";
import { readCloudflareClientIpHash } from "@/http/client_ip.server";
import {
  addMinutes,
  getDefaultSearchWindow,
  isDefaultCandidateSlot,
  isValidSlotConfiguration,
  listDefaultCandidateSlots,
  parseSlotStart,
  removeBookedSlots,
  serializeSlot,
} from "@/scheduling/slots.server";
import type { ServerEnv } from "@/server-context";
import { scheduleRoute } from "./v1_schedule";

type Bindings = ServerEnv;

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
        headers: { "CF-Connecting-IP": "string (required, set by Cloudflare)" },
      },
      book: {
        method: "POST",
        path: "/api/v1/book",
        body: {
          user: "string (required)",
          code: "string (required, booking code)",
          slot: "string (required, ISO 8601 start time)",
          name: "string (required, booker name)",
          email: "string (optional, booker email)",
          timezone: "string (optional, booker timezone)",
        },
        headers: { "CF-Connecting-IP": "string (required, set by Cloudflare)" },
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
        headers: { "CF-Connecting-IP": "string (required, set by Cloudflare)" },
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
      429: ["booking_code_rate_limited"],
      500: ["client_ip_unavailable", "host_configuration_invalid"],
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
  const bookings = await findConfirmedBookingsForHost(db, {
    hostId: host.id,
    startsAt: window.startsAt,
    endsAt: window.endsAt,
  });
  const candidateSlots = listDefaultCandidateSlots({
    now,
    slotSizeMinutes: host.slotSizeMinutes,
    timeZone: host.timezone,
  });

  if (candidateSlots.length === 0) {
    return c.json({ error: { code: "host_unavailable", message: "Host is unavailable" } }, 422);
  }

  return c.json({
    user: host.username,
    timezone: host.timezone,
    slotSizeMinutes: host.slotSizeMinutes,
    slots: removeBookedSlots(candidateSlots, bookings).map(serializeSlot),
  });
});

v1.post("/book", async (c) => {
  const text = await c.req.text();
  if (text.trim().length === 0) {
    return c.json({ error: { code: "invalid_json", message: "Request body must be JSON" } }, 400);
  }

  interface BookBody {
    user?: string;
    code?: string;
    slot?: string;
    name?: string;
    email?: string;
    timezone?: string;
  }

  let body: BookBody;
  try {
    body = JSON.parse(text) as BookBody;
  } catch {
    return c.json({ error: { code: "invalid_json", message: "Request body must be JSON" } }, 400);
  }

  if (typeof body !== "object" || body === null) {
    return c.json({ error: { code: "missing_field", message: "Missing required field: user" } }, 400);
  }

  const username = typeof body.user === "string" ? normalizeUsername(body.user) : null;
  if (username === null) return c.json({ error: { code: "missing_field", message: "Missing required field: user" } }, 400);

  const bookingCode = typeof body.code === "string" ? normalizeBookingCode(body.code) : null;
  if (bookingCode === null) return c.json({ error: { code: "missing_field", message: "Missing required field: code" } }, 400);

  const slotStartAt = typeof body.slot === "string" ? parseSlotStart(body.slot) : null;
  if (slotStartAt === null) return c.json({ error: { code: "missing_field", message: "Missing required field: slot" } }, 400);

  const guestName = typeof body.name === "string" && body.name.trim().length > 0 ? body.name.trim() : null;
  if (guestName === null) return c.json({ error: { code: "missing_field", message: "Missing required field: name" } }, 400);

  const email = typeof body.email === "string" && body.email.trim().length > 0 ? body.email.trim() : null;
  const emailNormalized = email ? email.toLowerCase() : null;
  const guestTimezone = typeof body.timezone === "string" && body.timezone.trim().length > 0 ? body.timezone.trim() : null;

  const clientIpHash = await readCloudflareClientIpHash(c.req.raw);
  if (clientIpHash.code === "client_ip_unavailable") {
    return c.json({ error: { code: "client_ip_unavailable", message: "Client IP header is unavailable" } }, 500);
  }

  const db = createDb(c.env.DB);
  const now = new Date();
  const authorization = await authorizeBookingCode(db, { bookingCode, ipHash: clientIpHash.ipHash, now, username });

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

  const slotEndAt = addMinutes(slotStartAt, host.slotSizeMinutes);

  if (!isDefaultCandidateSlot({ now, slotSizeMinutes: host.slotSizeMinutes, startAt: slotStartAt, timeZone: host.timezone })) {
    return c.json({ error: { code: "invalid_slot", message: "Slot is not bookable" } }, 400);
  }

  const existingBookings = await findConfirmedBookingsForHost(db, { hostId: host.id, startsAt: slotStartAt, endsAt: slotEndAt });
  const availableSlot = removeBookedSlots([{ startAt: slotStartAt, endAt: slotEndAt }], existingBookings)[0];

  if (availableSlot === undefined) {
    return c.json({ error: { code: "slot_unavailable", message: "Slot is unavailable" } }, 409);
  }

  const created = await createConfirmedBooking(db, {
    id: crypto.randomUUID(),
    hostId: host.id,
    hostUsername: host.username,
    bookingCodeId: authorization.access.code.id,
    guestName,
    guestEmail: email,
    guestEmailNormalized: emailNormalized,
    guestTimezone,
    slotStartAt: availableSlot.startAt,
    slotEndAt: availableSlot.endAt,
    source: "api",
    createdAt: now,
  });

  if (created === null) {
    return c.json({ error: { code: "slot_unavailable", message: "Slot is unavailable" } }, 409);
  }

  await markBookingCodeUsed(db, { bookingCodeId: authorization.access.code.id, usedAt: now });

  return c.json({
    ok: true,
    booking: {
      id: created.id,
      user: host.username,
      slot: serializeSlot(availableSlot),
      booker: { name: guestName, email },
      status: "confirmed",
    },
  });
});
