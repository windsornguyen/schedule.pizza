import { sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

import { bookingCode } from "./booking_code";
import { hostProfile } from "./host_profile";

export const bookingStatuses = [
  "pending_calendar",
  "confirmed",
  "calendar_failed",
  "cancelled",
] as const;
export const bookingSources = ["web", "api"] as const;

export const booking = pgTable(
  "booking",
  {
    id: text("id").primaryKey(),
    hostId: text("hostId")
      .notNull()
      .references(() => hostProfile.id, { onDelete: "cascade" }),
    hostUsername: text("hostUsername").notNull(),
    bookingCodeId: text("bookingCodeId").references(() => bookingCode.id, {
      onDelete: "set null",
    }),
    guestName: text("guestName").notNull(),
    guestEmail: text("guestEmail"),
    guestEmailNormalized: text("guestEmailNormalized"),
    guestTimezone: text("guestTimezone"),
    slotStartAt: timestamp("slotStartAt", { withTimezone: true, precision: 3 }).notNull(),
    slotEndAt: timestamp("slotEndAt", { withTimezone: true, precision: 3 }).notNull(),
    status: text("status", { enum: bookingStatuses }).notNull(),
    source: text("source", { enum: bookingSources }).notNull(),
    calendarProvider: text("calendarProvider"),
    calendarEventId: text("calendarEventId"),
    cancelledAt: timestamp("cancelledAt", { withTimezone: true, precision: 3 }),
    createdAt: timestamp("createdAt", { withTimezone: true, precision: 3 }).notNull(),
    updatedAt: timestamp("updatedAt", { withTimezone: true, precision: 3 }).notNull(),
  },
  (table) => [
    check(
      "booking_slot_order_check",
      sql`${table.slotEndAt} > ${table.slotStartAt}`
    ),
    check(
      "booking_status_check",
      sql`${table.status} in ('pending_calendar', 'confirmed', 'calendar_failed', 'cancelled')`
    ),
    check("booking_source_check", sql`${table.source} in ('web', 'api')`),
    index("booking_hostId_idx").on(table.hostId),
    index("booking_hostUsername_idx").on(table.hostUsername),
    index("booking_bookingCodeId_idx").on(table.bookingCodeId),
    uniqueIndex("booking_confirmed_slot_unique")
      .on(table.hostId, table.slotStartAt, table.slotEndAt)
      .where(sql`${table.status} in ('pending_calendar', 'confirmed')`),
  ]
);
