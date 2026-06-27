import { bookHostSlot, type BookSlotResult } from "@/booking/book_slot.server";
import { createDb } from "@/db/client.server";
import { authorizeBookingCode } from "@/db/functions/booking_code_authorizations.server";
import { readCloudflareClientIpHash } from "@/http/client_ip.server";
import { serializeSlot } from "@/scheduling/slots.server";
import type { ServerEnv } from "@/server-context";

export type BookAuthorizedSlotResult =
  | {
      readonly code: "booked";
      readonly slot: { readonly end: string; readonly start: string };
    }
  | {
      readonly code:
        | "booking_rate_limited"
        | "booking_unavailable"
        | "calendar_unavailable"
        | "slot_unavailable";
    };

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
}): Promise<BookAuthorizedSlotResult> {
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

  if (authorization.code === "booking_code_rate_limited") {
    return { code: "booking_rate_limited" as const };
  }

  if (authorization.code === "booking_code_invalid") {
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

  return mapBookSlotResult(booked);
}

function mapBookSlotResult(booked: BookSlotResult): BookAuthorizedSlotResult {
  switch (booked.code) {
    case "booked":
      return { code: "booked", slot: serializeSlot(booked.slot) };

    case "invalid_slot":
    case "slot_unavailable":
      return { code: "slot_unavailable" };

    case "booking_rate_limited":
      return { code: "booking_rate_limited" };

    case "booking_confirmation_failed":
    case "booking_failure_record_failed":
      return { code: "booking_unavailable" };

    case "host_configuration_invalid":
      throw new Response("host slot configuration invalid", { status: 500 });

    case "google_account_missing":
    case "google_access_token_missing":
    case "google_calendar_scope_missing":
    case "google_event_delete_failed":
    case "google_event_insert_failed":
    case "google_event_insert_response_invalid":
    case "google_freebusy_failed":
    case "google_freebusy_response_invalid":
    case "google_refresh_token_missing":
    case "google_token_refresh_failed":
    case "google_token_response_invalid":
      return { code: "calendar_unavailable" };

    default:
      return assertUnreachableBookSlotResult(booked);
  }
}

function assertUnreachableBookSlotResult(result: never): never {
  throw new Response(`unhandled booking result: ${JSON.stringify(result)}`, {
    status: 500,
  });
}
