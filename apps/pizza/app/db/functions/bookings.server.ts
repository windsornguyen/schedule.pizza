import { and, asc, count, eq, gt, inArray, lt } from "drizzle-orm";

import type { Database } from "@/db/client.server";
import { booking } from "@/db/schema";

export type BlockingBooking = typeof booking.$inferSelect;

type BlockingBookingWindow = {
  endsAt: Date;
  hostId: string;
  startsAt: Date;
};

export type PendingCalendarBookingInsert = {
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
type D1BatchDatabase = Pick<D1Database, "batch" | "prepare">;

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

export async function createPendingCalendarBookings(
  database: D1BatchDatabase,
  inputs: readonly PendingCalendarBookingInsert[],
) {
  try {
    await database.batch(inputs.map((input) =>
      database
        .prepare(
          `insert into booking (
            id, hostId, hostUsername, bookingCodeId, guestName, guestEmail,
            guestEmailNormalized, guestTimezone, slotStartAt, slotEndAt,
            status, source, calendarProvider, calendarEventId, cancelledAt,
            createdAt, updatedAt
          ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, null, null, null, ?, ?)`,
        )
        .bind(
          input.id,
          input.hostId,
          input.hostUsername,
          input.bookingCodeId,
          input.guestName,
          input.guestEmail,
          input.guestEmailNormalized,
          input.guestTimezone,
          toUnixSeconds(input.slotStartAt),
          toUnixSeconds(input.slotEndAt),
          "pending_calendar",
          input.source,
          toUnixSeconds(input.createdAt),
          toUnixSeconds(input.createdAt),
        ),
    ));

    return inputs.map((input) => input.id);
  } catch (error: unknown) {
    if (isBookingReservationConflict(error)) {
      return null;
    }

    throw error;
  }
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

export async function listUpcomingConfirmedBookingsForHost(
  db: Database,
  input: { hostId: string; limit: number; now: Date },
) {
  return db
    .select({
      calendarEventId: booking.calendarEventId,
      calendarProvider: booking.calendarProvider,
      guestEmail: booking.guestEmail,
      guestName: booking.guestName,
      id: booking.id,
      slotEndAt: booking.slotEndAt,
      slotStartAt: booking.slotStartAt,
    })
    .from(booking)
    .where(
      and(
        eq(booking.hostId, input.hostId),
        eq(booking.status, "confirmed"),
        gt(booking.slotEndAt, input.now),
      ),
    )
    .orderBy(asc(booking.slotStartAt))
    .limit(input.limit);
}

export async function findConfirmedBookingForHost(
  db: Database,
  input: { bookingId: string; hostId: string },
) {
  const rows = await db
    .select({
      calendarEventId: booking.calendarEventId,
      calendarProvider: booking.calendarProvider,
      id: booking.id,
    })
    .from(booking)
    .where(
      and(
        eq(booking.id, input.bookingId),
        eq(booking.hostId, input.hostId),
        eq(booking.status, "confirmed"),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

export async function countConfirmedBookingsForCalendarEvent(
  db: Database,
  input: { calendarEventId: string },
) {
  const rows = await db
    .select({ bookings: count() })
    .from(booking)
    .where(
      and(
        eq(booking.calendarEventId, input.calendarEventId),
        eq(booking.status, "confirmed"),
      ),
    );
  const row = rows[0];

  if (row === undefined) {
    throw new Error("booking event count query returned no rows");
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

export async function markConfirmedBookingCancelled(
  db: Database,
  input: { bookingId: string; cancelledAt: Date },
) {
  const rows = await db
    .update(booking)
    .set({
      cancelledAt: input.cancelledAt,
      status: "cancelled",
      updatedAt: input.cancelledAt,
    })
    .where(
      and(
        eq(booking.id, input.bookingId),
        eq(booking.status, "confirmed"),
      ),
    )
    .returning({ id: booking.id });

  return rows[0] ?? null;
}

export async function confirmCalendarBookings(
  database: D1BatchDatabase,
  input: {
    bookingIds: readonly string[];
    calendarEventId: string;
    confirmedAt: Date;
    provider: "google";
  },
) {
  const results = await database.batch(input.bookingIds.map((bookingId) =>
    database
      .prepare(
        `update booking
          set calendarProvider = ?, calendarEventId = ?, status = ?, updatedAt = ?
          where id = ? and status = ?`,
      )
      .bind(
        input.provider,
        input.calendarEventId,
        "confirmed",
        toUnixSeconds(input.confirmedAt),
        bookingId,
        "pending_calendar",
      ),
  ));

  if (!results.every((result) => result.meta.changes === 1)) {
    return null;
  }

  return [...input.bookingIds];
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

export async function markCalendarBookingsFailed(
  database: D1BatchDatabase,
  input: { bookingIds: readonly string[]; failedAt: Date },
) {
  const results = await database.batch(input.bookingIds.map((bookingId) =>
    database
      .prepare(
        `update booking
          set status = ?, updatedAt = ?
          where id = ? and status = ?`,
      )
      .bind(
        "calendar_failed",
        toUnixSeconds(input.failedAt),
        bookingId,
        "pending_calendar",
      ),
  ));

  if (!results.every((result) => result.meta.changes === 1)) {
    return null;
  }

  return [...input.bookingIds];
}

function isBookingReservationConflict(error: unknown) {
  return error instanceof Error &&
    error.message.includes("UNIQUE constraint failed") &&
    error.message.includes("booking");
}

function toUnixSeconds(date: Date) {
  return Math.floor(date.getTime() / 1_000);
}
