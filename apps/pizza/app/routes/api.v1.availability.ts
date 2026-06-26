import type { RouterContextProvider } from "react-router";

import { createDb } from "@/db/client.server";
import { authorizeBookingCode } from "@/db/functions/booking_code_authorizations.server";
import { normalizeBookingCode } from "@/db/functions/booking_codes.server";
import { findConfirmedBookingsForHost } from "@/db/functions/bookings.server";
import { normalizeUsername } from "@/db/functions/host_profiles.server";
import { readCloudflareClientIpHash } from "@/http/client_ip.server";
import { serverContext } from "@/server-context";
import {
  getDefaultSearchWindow,
  isValidSlotConfiguration,
  listDefaultCandidateSlots,
  removeBookedSlots,
  serializeSlot,
} from "@/scheduling/slots.server";

type AvailabilityErrorCode =
  | "booking_code_invalid"
  | "booking_code_rate_limited"
  | "client_ip_unavailable"
  | "host_configuration_invalid"
  | "host_unavailable"
  | "missing_parameter";

type AvailabilityParams =
  | { code: "ok"; bookingCode: string; username: string }
  | { code: "missing_parameter"; parameter: "code" | "user" };

export async function loader({
  request,
  context,
}: {
  context: RouterContextProvider;
  request: Request;
}) {
  const params = parseAvailabilityParams(new URL(request.url));

  if (params.code === "missing_parameter") {
    return errorResponse(
      "missing_parameter",
      `Missing required parameter: ${params.parameter}`,
      400,
    );
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
    bookingCode: params.bookingCode,
    ipHash: clientIpHash.ipHash,
    now,
    username: params.username,
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

  const window = getDefaultSearchWindow(now);
  const bookings = await findConfirmedBookingsForHost(db, {
    hostId: authorization.access.host.id,
    startsAt: window.startsAt,
    endsAt: window.endsAt,
  });
  const candidateSlots = listDefaultCandidateSlots({
    now,
    slotSizeMinutes: authorization.access.host.slotSizeMinutes,
    timeZone: authorization.access.host.timezone,
  });

  if (candidateSlots.length === 0) {
    return errorResponse("host_unavailable", "Host is unavailable", 422);
  }

  return Response.json({
    user: authorization.access.host.username,
    timezone: authorization.access.host.timezone,
    slotSizeMinutes: authorization.access.host.slotSizeMinutes,
    slots: removeBookedSlots(candidateSlots, bookings).map(serializeSlot),
  });
}

function parseAvailabilityParams(url: URL): AvailabilityParams {
  const username = normalizeUsername(url.searchParams.get("user") ?? "");

  if (username === null) {
    return { code: "missing_parameter", parameter: "user" };
  }

  const bookingCode = normalizeBookingCode(url.searchParams.get("code") ?? "");

  if (bookingCode === null) {
    return { code: "missing_parameter", parameter: "code" };
  }

  return { code: "ok", bookingCode, username };
}

function errorResponse(
  code: AvailabilityErrorCode,
  message: string,
  status: number,
) {
  return Response.json({ error: { code, message } }, { status });
}
