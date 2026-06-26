import type { RouterContextProvider } from "react-router";

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
import { serverContext } from "@/server-context";
import {
  addMinutes,
  isValidSlotConfiguration,
  isDefaultCandidateSlot,
  parseSlotStart,
  removeBookedSlots,
  serializeSlot,
} from "@/scheduling/slots.server";

type BookingErrorCode =
  | "booking_code_invalid"
  | "booking_code_rate_limited"
  | "client_ip_unavailable"
  | "host_configuration_invalid"
  | "invalid_json"
  | "invalid_slot"
  | "method_not_allowed"
  | "missing_field"
  | "slot_unavailable";

type BookingInput = {
  bookingCode: string;
  email: string | null;
  emailNormalized: string | null;
  guestName: string;
  guestTimezone: string | null;
  slotStartAt: Date;
  username: string;
};

type ParsedBookingInput =
  | { code: "ok"; input: BookingInput }
  | { code: "invalid_slot" }
  | { code: "missing_field"; field: "code" | "name" | "slot" | "user" };

type JsonReadResult =
  | { code: "ok"; value: unknown }
  | { code: "invalid_json" };

export async function action({
  request,
  context,
}: {
  context: RouterContextProvider;
  request: Request;
}) {
  if (request.method !== "POST") {
    return errorResponse("method_not_allowed", "Method not allowed", 405);
  }

  const json = await readJson(request);

  if (json.code === "invalid_json") {
    return errorResponse("invalid_json", "Request body must be JSON", 400);
  }

  const parsed = parseBookingInput(json.value);

  if (parsed.code === "missing_field") {
    return errorResponse(
      "missing_field",
      `Missing required field: ${parsed.field}`,
      400,
    );
  }

  if (parsed.code === "invalid_slot") {
    return errorResponse("invalid_slot", "Slot must be a valid ISO date", 400);
  }

  const { env } = context.get(serverContext);
  const clientIpHash = await readCloudflareClientIpHash(request);

  if (clientIpHash.code === "client_ip_unavailable") {
    return errorResponse(
      "client_ip_unavailable",
      "Client IP header is unavailable",
      500,
    );
  }

  const db = createDb(env.DB);
  const now = new Date();
  const authorization = await authorizeBookingCode(db, {
    bookingCode: parsed.input.bookingCode,
    ipHash: clientIpHash.ipHash,
    now,
    username: parsed.input.username,
  });

  if (authorization.code === "booking_code_rate_limited") {
    return errorResponse(
      "booking_code_rate_limited",
      "Too many failed booking code attempts",
      429,
    );
  }

  if (authorization.code === "booking_code_invalid") {
    return errorResponse("booking_code_invalid", "Invalid booking code", 404);
  }

  if (
    !isValidSlotConfiguration({
      slotSizeMinutes: authorization.access.host.slotSizeMinutes,
      timeZone: authorization.access.host.timezone,
    })
  ) {
    return errorResponse(
      "host_configuration_invalid",
      "Host slot configuration is invalid",
      500,
    );
  }

  const slotEndAt = addMinutes(
    parsed.input.slotStartAt,
    authorization.access.host.slotSizeMinutes,
  );

  if (
    !isDefaultCandidateSlot({
      now,
      slotSizeMinutes: authorization.access.host.slotSizeMinutes,
      startAt: parsed.input.slotStartAt,
      timeZone: authorization.access.host.timezone,
    })
  ) {
    return errorResponse("invalid_slot", "Slot is not bookable", 400);
  }

  const existingBookings = await findConfirmedBookingsForHost(db, {
    hostId: authorization.access.host.id,
    startsAt: parsed.input.slotStartAt,
    endsAt: slotEndAt,
  });
  const availableSlot = removeBookedSlots(
    [{ startAt: parsed.input.slotStartAt, endAt: slotEndAt }],
    existingBookings,
  )[0];

  if (availableSlot === undefined) {
    return errorResponse("slot_unavailable", "Slot is unavailable", 409);
  }

  const created = await createConfirmedBooking(db, {
    id: crypto.randomUUID(),
    hostId: authorization.access.host.id,
    hostUsername: authorization.access.host.username,
    bookingCodeId: authorization.access.code.id,
    guestName: parsed.input.guestName,
    guestEmail: parsed.input.email,
    guestEmailNormalized: parsed.input.emailNormalized,
    guestTimezone: parsed.input.guestTimezone,
    slotStartAt: availableSlot.startAt,
    slotEndAt: availableSlot.endAt,
    source: "api",
    createdAt: now,
  });

  if (created === null) {
    return errorResponse("slot_unavailable", "Slot is unavailable", 409);
  }

  await markBookingCodeUsed(db, {
    bookingCodeId: authorization.access.code.id,
    usedAt: now,
  });

  return Response.json({
    ok: true,
    booking: {
      id: created.id,
      user: authorization.access.host.username,
      slot: serializeSlot(availableSlot),
      booker: {
        name: parsed.input.guestName,
        email: parsed.input.email,
      },
      status: "confirmed",
    },
  });
}

async function readJson(request: Request): Promise<JsonReadResult> {
  const text = await request.text();

  if (text.trim().length === 0) {
    return { code: "invalid_json" };
  }

  try {
    return { code: "ok", value: JSON.parse(text) as unknown };
  } catch {
    return { code: "invalid_json" };
  }
}

function parseBookingInput(value: unknown): ParsedBookingInput {
  if (typeof value !== "object" || value === null) {
    return { code: "missing_field", field: "user" };
  }

  const body = value as Record<string, unknown>;
  const username = parseUsername(body["user"]);

  if (username === null) {
    return { code: "missing_field", field: "user" };
  }

  const bookingCode = parseBookingCode(body["code"]);

  if (bookingCode === null) {
    return { code: "missing_field", field: "code" };
  }

  const slotStartAt = parseSlot(body["slot"]);

  if (slotStartAt === null) {
    return { code: "missing_field", field: "slot" };
  }

  const guestName = parseGuestName(body["name"]);

  if (guestName === null) {
    return { code: "missing_field", field: "name" };
  }

  return {
    code: "ok",
    input: {
      username,
      bookingCode,
      slotStartAt,
      guestName,
      ...parseOptionalEmail(body["email"]),
      guestTimezone: parseOptionalText(body["timezone"]),
    },
  };
}

function parseUsername(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  return normalizeUsername(value);
}

function parseBookingCode(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  return normalizeBookingCode(value);
}

function parseSlot(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  return parseSlotStart(value);
}

function parseGuestName(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const name = value.trim();
  return name.length === 0 ? null : name;
}

function parseOptionalEmail(value: unknown) {
  if (value === undefined || value === null) {
    return { email: null, emailNormalized: null };
  }

  if (typeof value !== "string") {
    return { email: null, emailNormalized: null };
  }

  const email = value.trim();

  if (email.length === 0) {
    return { email: null, emailNormalized: null };
  }

  return { email, emailNormalized: email.toLowerCase() };
}

function parseOptionalText(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const text = value.trim();
  return text.length === 0 ? null : text;
}

function errorResponse(code: BookingErrorCode, message: string, status: number) {
  return Response.json({ error: { code, message } }, { status });
}
