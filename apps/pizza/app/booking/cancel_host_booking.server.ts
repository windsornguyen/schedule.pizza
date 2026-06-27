/**
 * Host-owned booking cancellation.
 *
 * Dashboard actions call this helper after authenticating the host. The helper
 * deletes the primary Google event before marking the local booking cancelled,
 * so availability is not reopened unless the external calendar write succeeds.
 */

import {
  deleteGoogleCalendarEvent,
  readGoogleCalendarAccess,
  readGoogleCalendarId,
  type GoogleCalendarErrorCode,
} from "@/calendar/google.server";
import type { Database } from "@/db/client.server";
import {
  countConfirmedBookingsForCalendarEvent,
  findConfirmedBookingForHost,
  markConfirmedBookingCancelled,
} from "@/db/functions/bookings.server";
import type { ServerEnv } from "@/server-context";

export type CancelHostBookingErrorCode =
  | GoogleCalendarErrorCode
  | "booking_calendar_missing"
  | "booking_cancel_failed"
  | "booking_missing"
  | "group_booking_cancel_unsupported";

export type CancelHostBookingResult =
  | { readonly bookingId: string; readonly code: "cancelled" }
  | { readonly code: CancelHostBookingErrorCode };

export async function cancelHostBooking(
  db: Database,
  input: {
    readonly authUserId: string;
    readonly bookingId: string;
    readonly calendarId: string | null;
    readonly env: ServerEnv;
    readonly hostId: string;
    readonly now: Date;
  },
): Promise<CancelHostBookingResult> {
  const booking = await findConfirmedBookingForHost(db, {
    bookingId: input.bookingId,
    hostId: input.hostId,
  });

  if (booking === null) {
    return { code: "booking_missing" };
  }

  if (booking.calendarProvider !== "google" || booking.calendarEventId === null) {
    return { code: "booking_calendar_missing" };
  }

  const eventBookingCount = await countConfirmedBookingsForCalendarEvent(db, {
    calendarEventId: booking.calendarEventId,
  });

  if (eventBookingCount !== 1) {
    return { code: "group_booking_cancel_unsupported" };
  }

  const googleAccess = await readGoogleCalendarAccess(db, {
    authUserId: input.authUserId,
    capability: "event_write",
    env: input.env,
    now: input.now,
  });

  if (googleAccess.code !== "authorized") {
    return { code: googleAccess.code };
  }

  const deleted = await deleteGoogleCalendarEvent({
    accessToken: googleAccess.accessToken,
    calendarId: readGoogleCalendarId(input.calendarId),
    eventId: booking.calendarEventId,
    notifyGuests: true,
  });

  if (deleted.code !== "deleted") {
    return deleted;
  }

  const cancelled = await markConfirmedBookingCancelled(db, {
    bookingId: booking.id,
    cancelledAt: input.now,
  });

  return cancelled === null
    ? { code: "booking_cancel_failed" }
    : { code: "cancelled", bookingId: cancelled.id };
}
