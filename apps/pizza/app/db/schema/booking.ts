import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { bookingCode } from "./booking_code";
import { hostProfile } from "./host_profile";

export const bookingStatuses = ["confirmed", "cancelled"] as const;
export const bookingSources = ["web", "api"] as const;

export const booking = sqliteTable(
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
    slotStartAt: integer("slotStartAt", { mode: "timestamp" }).notNull(),
    slotEndAt: integer("slotEndAt", { mode: "timestamp" }).notNull(),
    status: text("status", { enum: bookingStatuses }).notNull(),
    source: text("source", { enum: bookingSources }).notNull(),
    calendarProvider: text("calendarProvider"),
    calendarEventId: text("calendarEventId"),
    cancelledAt: integer("cancelledAt", { mode: "timestamp" }),
    createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    check(
      "booking_slot_order_check",
      sql`${table.slotEndAt} > ${table.slotStartAt}`
    ),
    check(
      "booking_status_check",
      sql`${table.status} in ('confirmed', 'cancelled')`
    ),
    check("booking_source_check", sql`${table.source} in ('web', 'api')`),
    index("booking_hostId_idx").on(table.hostId),
    index("booking_hostUsername_idx").on(table.hostUsername),
    index("booking_bookingCodeId_idx").on(table.bookingCodeId),
    uniqueIndex("booking_confirmed_slot_unique")
      .on(table.hostId, table.slotStartAt, table.slotEndAt)
      .where(sql`${table.status} = 'confirmed'`),
  ]
);
