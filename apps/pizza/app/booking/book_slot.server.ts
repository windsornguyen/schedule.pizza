import {
  createGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  readGoogleCalendarAccess,
  readGoogleCalendarId,
  type GoogleCalendarErrorCode,
} from "@/calendar/google.server";
import type { Database } from "@/db/client.server";
import { markBookingCodeUsed } from "@/db/functions/booking_codes.server";
import {
  confirmCalendarBooking,
  countRecentBookingsForCode,
  createPendingCalendarBooking,
  markCalendarBookingFailed,
} from "@/db/functions/bookings.server";
import {
  addMinutes,
  isDefaultCandidateSlot,
  isValidSlotConfiguration,
  type SlotRange,
} from "@/scheduling/slots.server";
import { listHostAvailableSlots } from "@/scheduling/host_availability.server";
import type { ServerEnv } from "@/server-context";

const BOOKING_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const BOOKING_RATE_LIMIT_MAX = 12;

type BookSlotHost = {
  readonly authUserId: string;
  readonly calendarId: string | null;
  readonly id: string;
  readonly slotSizeMinutes: number;
  readonly timezone: string;
  readonly username: string;
};

export type BookSlotErrorCode =
  | GoogleCalendarErrorCode
  | "booking_confirmation_failed"
  | "booking_failure_record_failed"
  | "booking_rate_limited"
  | "host_configuration_invalid"
  | "invalid_slot"
  | "slot_unavailable";

export type BookSlotResult =
  | {
      readonly bookingId: string;
      readonly calendarEventId: string;
      readonly code: "booked";
      readonly slot: SlotRange;
    }
  | { readonly code: BookSlotErrorCode };

export async function bookHostSlot(
  db: Database,
  input: {
    readonly bookingCodeId: string;
    readonly env: ServerEnv;
    readonly guestEmail: string;
    readonly guestEmailNormalized: string;
    readonly guestName: string;
    readonly guestTimezone: string | null;
    readonly host: BookSlotHost;
    readonly now: Date;
    readonly slotStartAt: Date;
    readonly source: "api" | "web";
  },
): Promise<BookSlotResult> {
  if (!isValidSlotConfiguration({
    slotSizeMinutes: input.host.slotSizeMinutes,
    timeZone: input.host.timezone,
  })) {
    return { code: "host_configuration_invalid" };
  }

  if (!isDefaultCandidateSlot({
    now: input.now,
    slotSizeMinutes: input.host.slotSizeMinutes,
    startAt: input.slotStartAt,
    timeZone: input.host.timezone,
  })) {
    return { code: "invalid_slot" };
  }

  const slot = {
    startAt: input.slotStartAt,
    endAt: addMinutes(input.slotStartAt, input.host.slotSizeMinutes),
  };
  const availability = await listHostAvailableSlots(db, {
    candidateSlots: [slot],
    env: input.env,
    host: input.host,
    now: input.now,
    window: { startsAt: slot.startAt, endsAt: slot.endAt },
  });

  if (availability.code !== "listed") {
    return availability;
  }

  if (availability.slots[0] === undefined) {
    return { code: "slot_unavailable" };
  }

  const recentBookingCount = await countRecentBookingsForCode(db, {
    bookingCodeId: input.bookingCodeId,
    since: getBookingRateLimitWindowStart(input.now),
  });

  if (recentBookingCount >= BOOKING_RATE_LIMIT_MAX) {
    return { code: "booking_rate_limited" };
  }

  const pending = await createPendingCalendarBooking(db, {
    id: crypto.randomUUID(),
    hostId: input.host.id,
    hostUsername: input.host.username,
    bookingCodeId: input.bookingCodeId,
    guestName: input.guestName,
    guestEmail: input.guestEmail,
    guestEmailNormalized: input.guestEmailNormalized,
    guestTimezone: input.guestTimezone,
    slotStartAt: slot.startAt,
    slotEndAt: slot.endAt,
    source: input.source,
    createdAt: input.now,
  });

  if (pending === null) {
    return { code: "slot_unavailable" };
  }

  const googleAccess = await readGoogleCalendarAccess(db, {
    authUserId: input.host.authUserId,
    capability: "event_write",
    env: input.env,
    now: input.now,
  });

  if (googleAccess.code !== "authorized") {
    return failPendingBooking(db, pending.id, input.now, googleAccess.code);
  }

  const calendarId = readGoogleCalendarId(input.host.calendarId);
  const calendarEvent = await createGoogleCalendarEvent({
    accessToken: googleAccess.accessToken,
    calendarId,
    endAt: slot.endAt,
    guestEmail: input.guestEmail,
    guestName: input.guestName,
    startAt: slot.startAt,
    timeZone: input.host.timezone,
  });

  if (calendarEvent.code !== "created") {
    return failPendingBooking(db, pending.id, input.now, calendarEvent.code);
  }

  const confirmed = await confirmCalendarBooking(db, {
    bookingId: pending.id,
    calendarEventId: calendarEvent.eventId,
    confirmedAt: input.now,
    provider: "google",
  });

  if (confirmed === null) {
    const rolledBack = await rollBackConfirmedGoogleEvent(db, {
      accessToken: googleAccess.accessToken,
      calendarId,
      eventId: calendarEvent.eventId,
      failedAt: input.now,
      pendingBookingId: pending.id,
    });

    return rolledBack;
  }

  await markBookingCodeUsed(db, {
    bookingCodeId: input.bookingCodeId,
    usedAt: input.now,
  });

  return {
    code: "booked",
    bookingId: pending.id,
    calendarEventId: calendarEvent.eventId,
    slot,
  };
}

function getBookingRateLimitWindowStart(now: Date) {
  return new Date(now.getTime() - BOOKING_RATE_LIMIT_WINDOW_MS);
}

async function failPendingBooking(
  db: Database,
  bookingId: string,
  failedAt: Date,
  code: GoogleCalendarErrorCode,
): Promise<BookSlotResult> {
  const failed = await markCalendarBookingFailed(db, { bookingId, failedAt });

  if (failed === null) {
    return { code: "booking_failure_record_failed" };
  }

  return { code };
}

async function rollBackConfirmedGoogleEvent(
  db: Database,
  input: {
    readonly accessToken: string;
    readonly calendarId: string;
    readonly eventId: string;
    readonly failedAt: Date;
    readonly pendingBookingId: string;
  },
): Promise<BookSlotResult> {
  const deleted = await deleteGoogleCalendarEvent({
    accessToken: input.accessToken,
    calendarId: input.calendarId,
    eventId: input.eventId,
    notifyGuests: true,
  });
  const failed = await markCalendarBookingFailed(db, {
    bookingId: input.pendingBookingId,
    failedAt: input.failedAt,
  });

  if (failed === null) {
    return { code: "booking_failure_record_failed" };
  }

  return deleted.code === "deleted"
    ? { code: "booking_confirmation_failed" }
    : deleted;
}
