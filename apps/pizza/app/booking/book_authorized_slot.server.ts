import { bookHostSlot } from "@/booking/book_slot.server";
import { createDb } from "@/db/client.server";
import { authorizeBookingCode } from "@/db/functions/booking_code_authorizations.server";
import { readCloudflareClientIpHash } from "@/http/client_ip.server";
import { serializeSlot } from "@/scheduling/slots.server";
import type { ServerEnv } from "@/server-context";

export async function bookAuthorizedSlot(input: {
  readonly bookingCode: string;
  readonly env: ServerEnv;
  readonly guestEmail: string;
  readonly guestEmailNormalized: string;
  readonly guestName: string;
  readonly guestTimezone: string | null;
  readonly request: Request;
  readonly slotStartAt: Date;
  readonly username: string;
}) {
  const clientIpHash = await readCloudflareClientIpHash(input.request);
  if (clientIpHash.code === "client_ip_unavailable") {
    throw new Response("client ip unavailable", { status: 500 });
  }

  const db = createDb(input.env.DB);
  const now = new Date();
  const authorization = await authorizeBookingCode(db, {
    bookingCode: input.bookingCode,
    ipHash: clientIpHash.ipHash,
    now,
    username: input.username,
  });

  if (authorization.code !== "authorized") {
    return { code: "slot_unavailable" as const };
  }

  const host = authorization.access.host;
  const booked = await bookHostSlot(db, {
    env: input.env,
    host,
    bookingCodeId: authorization.access.code.id,
    guestName: input.guestName,
    guestEmail: input.guestEmail,
    guestEmailNormalized: input.guestEmailNormalized,
    guestTimezone: input.guestTimezone,
    source: "web",
    now,
    slotStartAt: input.slotStartAt,
  });

  if (booked.code === "booked") {
    return { code: "booked" as const, slot: serializeSlot(booked.slot) };
  }

  if (booked.code === "invalid_slot" || booked.code === "slot_unavailable") {
    return { code: "slot_unavailable" as const };
  }

  if (booked.code === "booking_rate_limited") {
    return { code: "booking_rate_limited" as const };
  }

  if (booked.code === "host_configuration_invalid") {
    throw new Response("host slot configuration invalid", { status: 500 });
  }

  if (
    booked.code === "booking_confirmation_failed" ||
    booked.code === "booking_failure_record_failed"
  ) {
    throw new Response(booked.code, { status: 500 });
  }

  return { code: "calendar_unavailable" as const };
}
