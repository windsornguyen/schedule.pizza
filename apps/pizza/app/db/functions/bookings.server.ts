import { and, count, eq, gt, inArray, lt } from "drizzle-orm";

import type { Database } from "@/db/client.server";
import { booking } from "@/db/schema";

export type BlockingBooking = typeof booking.$inferSelect;

type BlockingBookingWindow = {
  endsAt: Date;
  hostId: string;
  startsAt: Date;
};

type PendingCalendarBookingInsert = {
  bookingCodeId: string;
  createdAt: Date;
  guestEmail: string | null;
  guestEmailNormalized: string | null;
  guestName: string;
  guestTimezone: string | null;
  hostId: string;
  hostUsername: string;
  id: string;
  slotEndAt: Date;
  slotStartAt: Date;
  source: "api" | "web";
};

export async function findBlockingBookingsForHost(
  db: Database,
  window: BlockingBookingWindow
) {
  return db
    .select()
    .from(booking)
    .where(
      and(
        eq(booking.hostId, window.hostId),
        inArray(booking.status, ["pending_calendar", "confirmed"]),
        lt(booking.slotStartAt, window.endsAt),
        gt(booking.slotEndAt, window.startsAt)
      )
    );
}

export async function createPendingCalendarBooking(
  db: Database,
  input: PendingCalendarBookingInsert
) {
  const rows = await db
    .insert(booking)
    .values({
      id: input.id,
      hostId: input.hostId,
      hostUsername: input.hostUsername,
      bookingCodeId: input.bookingCodeId,
      guestName: input.guestName,
      guestEmail: input.guestEmail,
      guestEmailNormalized: input.guestEmailNormalized,
      guestTimezone: input.guestTimezone,
      slotStartAt: input.slotStartAt,
      slotEndAt: input.slotEndAt,
      status: "pending_calendar",
      source: input.source,
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
    })
    .onConflictDoNothing()
    .returning({ id: booking.id });

  return rows[0] ?? null;
}

export async function countRecentBookingsForCode(
  db: Database,
  input: { bookingCodeId: string; since: Date },
) {
  const rows = await db
    .select({ bookings: count() })
    .from(booking)
    .where(
      and(
        eq(booking.bookingCodeId, input.bookingCodeId),
        inArray(booking.status, [
          "pending_calendar",
          "confirmed",
          "calendar_failed",
        ]),
        gt(booking.createdAt, input.since),
      ),
    );

  const row = rows[0];

  if (row === undefined) {
    throw new Error("booking count query returned no rows");
  }

  return row.bookings;
}

export async function confirmCalendarBooking(
  db: Database,
  input: {
    bookingId: string;
    calendarEventId: string;
    confirmedAt: Date;
    provider: "google";
  }
) {
  const rows = await db
    .update(booking)
    .set({
      calendarProvider: input.provider,
      calendarEventId: input.calendarEventId,
      status: "confirmed",
      updatedAt: input.confirmedAt,
    })
    .where(
      and(
        eq(booking.id, input.bookingId),
        eq(booking.status, "pending_calendar")
      )
    )
    .returning({ id: booking.id });

  return rows[0] ?? null;
}

export async function markCalendarBookingFailed(
  db: Database,
  input: { bookingId: string; failedAt: Date }
) {
  const rows = await db
    .update(booking)
    .set({
      status: "calendar_failed",
      updatedAt: input.failedAt,
    })
    .where(
      and(
        eq(booking.id, input.bookingId),
        eq(booking.status, "pending_calendar")
      )
    )
    .returning({ id: booking.id });

  return rows[0] ?? null;
}
