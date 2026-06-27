/**
 * Group booking writes one meeting across several schedule.pizza hosts.
 *
 * The function rechecks exact group availability immediately before writing,
 * reserves one local booking row per host in a transaction, creates one Google
 * organizer event with all attendees, then confirms every local row.
 */

import {
  createGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  readGoogleCalendarAccess,
  readGoogleCalendarId,
  type GoogleCalendarErrorCode,
  type GoogleCalendarEventAttendee,
} from "@/calendar/google.server";
import { executeScheduleRequest } from "@/api/v1_schedule";
import type {
  ParsedScheduleBody,
  SerializedScheduleResult,
} from "@/api/v1_schedule";
import type { Database } from "@/db/client.server";
import { markBookingCodeUsed } from "@/db/functions/booking_codes.server";
import {
  confirmCalendarBookings,
  countRecentBookingsForCode,
  createPendingCalendarBookings,
  markCalendarBookingsFailed,
  type PendingCalendarBookingInsert,
} from "@/db/functions/bookings.server";
import { timeInterval } from "@/scheduling/engine";
import type { ServerEnv } from "@/server-context";

const BOOKING_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const BOOKING_RATE_LIMIT_MAX = 12;
const MINUTE_MS = 60_000;

export type BookGroupSlotErrorCode =
  | GoogleCalendarErrorCode
  | "booking_code_invalid"
  | "booking_code_rate_limited"
  | "booking_confirmation_failed"
  | "booking_failure_record_failed"
  | "booking_rate_limited"
  | "invalid_slot"
  | "participant_email_missing"
  | "slot_unavailable";

export type BookGroupSlotResult =
  | {
      readonly bookingIds: readonly string[];
      readonly calendarEventId: string;
      readonly code: "booked";
      readonly slot: { readonly endAt: Date; readonly startAt: Date };
    }
  | { readonly code: BookGroupSlotErrorCode };

export async function bookGroupSlot(
  db: Database,
  input: {
    readonly body: ParsedScheduleBody;
    readonly env: ServerEnv;
    readonly guestEmail: string;
    readonly guestEmailNormalized: string;
    readonly guestName: string;
    readonly guestTimezone: string | null;
    readonly ipHash: string;
    readonly now: Date;
    readonly slotStartAt: Date;
    readonly source: "api" | "web";
  },
): Promise<BookGroupSlotResult> {
  if (input.slotStartAt <= input.now) {
    return { code: "invalid_slot" };
  }

  const slot = {
    startAt: input.slotStartAt,
    endAt: new Date(input.slotStartAt.getTime() + input.body.durationMinutes * MINUTE_MS),
  };
  const exactAvailability = await executeScheduleRequest(db, {
    body: {
      ...input.body,
      maxAlternativeSlotCount: 1,
      maxExactSlotCount: 1,
      window: timeInterval({
        startAtMs: input.slotStartAt.getTime(),
        endAtMs: slot.endAt.getTime(),
      }),
    },
    env: input.env,
    ipHash: input.ipHash,
    now: input.now,
  });

  if (exactAvailability.code === "invalid_schedule_request") {
    return { code: "invalid_slot" };
  }

  if (exactAvailability.code !== "scheduled") {
    return exactAvailability;
  }

  if (!hasExactSlot(exactAvailability.body, slot)) {
    return { code: "slot_unavailable" };
  }

  const participantEmails = readParticipantAttendees({
    guestEmailNormalized: input.guestEmailNormalized,
    participants: exactAvailability.authorizedParticipants,
  });

  if (participantEmails === null) {
    return { code: "participant_email_missing" };
  }

  for (const participant of exactAvailability.authorizedParticipants) {
    const recentBookingCount = await countRecentBookingsForCode(db, {
      bookingCodeId: participant.bookingCodeId,
      since: getBookingRateLimitWindowStart(input.now),
    });

    if (recentBookingCount >= BOOKING_RATE_LIMIT_MAX) {
      return { code: "booking_rate_limited" };
    }
  }

  const pendingBookingIds = await createPendingCalendarBookings(
    input.env.DB,
    exactAvailability.authorizedParticipants.map(
      (participant): PendingCalendarBookingInsert => ({
        id: crypto.randomUUID(),
        hostId: participant.hostId,
        hostUsername: participant.username,
        bookingCodeId: participant.bookingCodeId,
        guestName: input.guestName,
        guestEmail: input.guestEmail,
        guestEmailNormalized: input.guestEmailNormalized,
        guestTimezone: input.guestTimezone,
        slotStartAt: slot.startAt,
        slotEndAt: slot.endAt,
        source: input.source,
        createdAt: input.now,
      }),
    ),
  );

  if (pendingBookingIds === null) {
    return { code: "slot_unavailable" };
  }

  const organizer = exactAvailability.authorizedParticipants[0];

  if (organizer === undefined) {
    return failPendingGroupBooking(input.env.DB, pendingBookingIds, input.now, "slot_unavailable");
  }

  const googleAccess = await readGoogleCalendarAccess(db, {
    authUserId: organizer.authUserId,
    capability: "event_write",
    env: input.env,
    now: input.now,
  });

  if (googleAccess.code !== "authorized") {
    return failPendingGroupBooking(input.env.DB, pendingBookingIds, input.now, googleAccess.code);
  }

  const calendarId = readGoogleCalendarId(organizer.calendarId);
  const calendarEvent = await createGoogleCalendarEvent({
    accessToken: googleAccess.accessToken,
    additionalAttendees: participantEmails,
    calendarId,
    endAt: slot.endAt,
    guestEmail: input.guestEmail,
    guestName: input.guestName,
    startAt: slot.startAt,
    timeZone: input.body.timeZone,
  });

  if (calendarEvent.code !== "created") {
    return failPendingGroupBooking(input.env.DB, pendingBookingIds, input.now, calendarEvent.code);
  }

  const confirmedBookingIds = await confirmCalendarBookings(input.env.DB, {
    bookingIds: pendingBookingIds,
    calendarEventId: calendarEvent.eventId,
    confirmedAt: input.now,
    provider: "google",
  });

  if (confirmedBookingIds === null) {
    const deleted = await deleteGoogleCalendarEvent({
      accessToken: googleAccess.accessToken,
      calendarId,
      eventId: calendarEvent.eventId,
      notifyGuests: true,
    });

    return deleted.code === "deleted"
      ? { code: "booking_confirmation_failed" }
      : deleted;
  }

  await Promise.all(
    exactAvailability.authorizedParticipants.map((participant) =>
      markBookingCodeUsed(db, {
        bookingCodeId: participant.bookingCodeId,
        usedAt: input.now,
      }),
    ),
  );

  return {
    code: "booked",
    bookingIds: confirmedBookingIds,
    calendarEventId: calendarEvent.eventId,
    slot,
  };
}

function hasExactSlot(
  result: SerializedScheduleResult,
  slot: { readonly endAt: Date; readonly startAt: Date },
) {
  return result.kind === "exact" &&
    result.slots.some(
      (candidate) =>
        candidate.start === slot.startAt.toISOString() &&
        candidate.end === slot.endAt.toISOString(),
    );
}

function readParticipantAttendees(input: {
  readonly guestEmailNormalized: string;
  readonly participants: readonly {
    readonly calendarAccountEmail: string | null;
    readonly hostId: string;
    readonly username: string;
  }[];
}): readonly GoogleCalendarEventAttendee[] | null {
  const attendees: GoogleCalendarEventAttendee[] = [];
  const seenEmails = new Set([input.guestEmailNormalized]);

  for (const participant of input.participants.slice(1)) {
    const email = participant.calendarAccountEmail?.trim().toLowerCase();

    if (email === undefined || email === "") {
      return null;
    }

    if (seenEmails.has(email)) {
      continue;
    }

    seenEmails.add(email);
    attendees.push({ displayName: participant.username, email });
  }

  return attendees;
}

function getBookingRateLimitWindowStart(now: Date) {
  return new Date(now.getTime() - BOOKING_RATE_LIMIT_WINDOW_MS);
}

async function failPendingGroupBooking(
  database: D1Database,
  bookingIds: readonly string[],
  failedAt: Date,
  code: Exclude<BookGroupSlotErrorCode, "booking_confirmation_failed">,
): Promise<BookGroupSlotResult> {
  const failed = await markCalendarBookingsFailed(database, { bookingIds, failedAt });

  if (failed === null) {
    return { code: "booking_failure_record_failed" };
  }

  return { code };
}
