import { and, eq, gt, lt } from "drizzle-orm";

import type { Database } from "@/db/client.server";
import { booking } from "@/db/schema";

export type ConfirmedBooking = typeof booking.$inferSelect;

type ConfirmedBookingWindow = {
  endsAt: Date;
  hostId: string;
  startsAt: Date;
};

type ConfirmedBookingInsert = {
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

export async function findConfirmedBookingsForHost(
  db: Database,
  window: ConfirmedBookingWindow
) {
  return db
    .select()
    .from(booking)
    .where(
      and(
        eq(booking.hostId, window.hostId),
        eq(booking.status, "confirmed"),
        lt(booking.slotStartAt, window.endsAt),
        gt(booking.slotEndAt, window.startsAt)
      )
    );
}

export async function createConfirmedBooking(
  db: Database,
  input: ConfirmedBookingInsert
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
      status: "confirmed",
      source: input.source,
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
    })
    .onConflictDoNothing()
    .returning({ id: booking.id });

  return rows[0] ?? null;
}
