/** Reservations lock hosts in ID order; group state changes commit all or none. */
import { and, asc, count, eq, gt, inArray, lt, or } from "drizzle-orm";

import type { Database } from "@/db/client.server";
import { booking, hostProfile } from "@/db/schema";

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
export class BookingMutationError extends Error {
  constructor(readonly code: "invalid_booking_batch" | "booking_host_missing") {
    super(code);
    this.name = "BookingMutationError";
  }
}

export const PENDING_CALENDAR_BOOKING_TTL_MS = 15 * 60 * 1_000;

export function getPendingCalendarBookingExpiresBefore(now: Date) {
  return new Date(now.getTime() - PENDING_CALENDAR_BOOKING_TTL_MS);
}

export async function expireStalePendingCalendarBookingsForHost(
  db: Database,
  input: { expiredAt: Date; expiresBefore: Date; hostId: string },
) {
  await db
    .update(booking)
    .set({
      status: "calendar_failed",
      updatedAt: input.expiredAt,
    })
    .where(
      and(
        eq(booking.hostId, input.hostId),
        eq(booking.status, "pending_calendar"),
        lt(booking.updatedAt, input.expiresBefore),
      ),
    );
}

export async function findBlockingBookingsForHost(
  db: Database,
  window: BlockingBookingWindow,
) {
  return db
    .select()
    .from(booking)
    .where(
      and(
        eq(booking.hostId, window.hostId),
        inArray(booking.status, ["pending_calendar", "confirmed"]),
        lt(booking.slotStartAt, window.endsAt),
        gt(booking.slotEndAt, window.startsAt),
      ),
    );
}

export async function createPendingCalendarBooking(
  database: Database,
  input: PendingCalendarBookingInsert,
) {
  const ids = await createPendingCalendarBookings(database, [input]);
  return ids === null ? null : { id: input.id };
}

export async function createPendingCalendarBookings(
  database: Database,
  inputs: readonly PendingCalendarBookingInsert[],
) {
  const hostIds = inputs.map((input) => input.hostId);
  validateBookingIds(hostIds);
  validateBookingIds(inputs.map((input) => input.id));
  return database.transaction(
    async (tx) => {
      const hosts = await tx
        .select({ id: hostProfile.id })
        .from(hostProfile)
        .where(inArray(hostProfile.id, hostIds))
        .orderBy(asc(hostProfile.id))
        .for("update");
      if (hosts.length !== hostIds.length) {
        throw new BookingMutationError("booking_host_missing");
      }
      const conflicts = await tx
        .select({ id: booking.id })
        .from(booking)
        .where(
          and(
            inArray(booking.status, ["pending_calendar", "confirmed"]),
            or(
              ...inputs.map((input) =>
                and(
                  eq(booking.hostId, input.hostId),
                  lt(booking.slotStartAt, input.slotEndAt),
                  gt(booking.slotEndAt, input.slotStartAt),
                ),
              ),
            ),
          ),
        )
        .limit(1);
      if (conflicts.length !== 0) return null;
      await tx.insert(booking).values(
        inputs.map((input) => ({
          ...input,
          status: "pending_calendar" as const,
          updatedAt: input.createdAt,
        })),
      );
      return inputs.map((input) => input.id);
    },
    { isolationLevel: "read committed" },
  );
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
  },
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
        eq(booking.status, "pending_calendar"),
      ),
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
      and(eq(booking.id, input.bookingId), eq(booking.status, "confirmed")),
    )
    .returning({ id: booking.id });

  return rows[0] ?? null;
}

export async function confirmCalendarBookings(
  database: Database,
  input: {
    bookingIds: readonly string[];
    calendarEventId: string;
    confirmedAt: Date;
    provider: "google";
  },
) {
  return transitionPendingBookings(database, input.bookingIds, {
    status: "confirmed",
    calendarProvider: input.provider,
    calendarEventId: input.calendarEventId,
    updatedAt: input.confirmedAt,
  });
}

export async function markCalendarBookingFailed(
  db: Database,
  input: { bookingId: string; failedAt: Date },
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
        eq(booking.status, "pending_calendar"),
      ),
    )
    .returning({ id: booking.id });

  return rows[0] ?? null;
}

export async function markCalendarBookingsFailed(
  database: Database,
  input: { bookingIds: readonly string[]; failedAt: Date },
) {
  return transitionPendingBookings(database, input.bookingIds, {
    status: "calendar_failed",
    updatedAt: input.failedAt,
  });
}

async function transitionPendingBookings(
  database: Database,
  bookingIds: readonly string[],
  update: Pick<
    typeof booking.$inferInsert,
    "status" | "updatedAt" | "calendarProvider" | "calendarEventId"
  >,
) {
  validateBookingIds(bookingIds);
  return database.transaction(async (tx) => {
    const rows = await tx
      .select({ status: booking.status })
      .from(booking)
      .where(inArray(booking.id, [...bookingIds]))
      .orderBy(asc(booking.id))
      .for("update");
    if (
      rows.length !== bookingIds.length ||
      rows.some((row) => row.status !== "pending_calendar")
    ) {
      return null;
    }
    await tx
      .update(booking)
      .set(update)
      .where(inArray(booking.id, [...bookingIds]));
    return [...bookingIds];
  });
}

function validateBookingIds(bookingIds: readonly string[]) {
  if (
    bookingIds.length === 0 ||
    new Set(bookingIds).size !== bookingIds.length
  ) {
    throw new BookingMutationError("invalid_booking_batch");
  }
}
