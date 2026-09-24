import { integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

import { user } from "./user";

export const hostProfile = pgTable(
  "host_profile",
  {
    id: text("id").primaryKey(),
    authUserId: text("authUserId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    username: text("username").notNull(),
    displayName: text("displayName").notNull(),
    timezone: text("timezone").notNull(),
    slotSizeMinutes: integer("slotSizeMinutes").notNull().default(30),
    calendarProvider: text("calendarProvider"),
    calendarAccountEmail: text("calendarAccountEmail"),
    calendarId: text("calendarId"),
    createdAt: timestamp("createdAt", { withTimezone: true, precision: 3 }).notNull(),
    updatedAt: timestamp("updatedAt", { withTimezone: true, precision: 3 }).notNull(),
  },
  (table) => [
    uniqueIndex("host_profile_authUserId_unique").on(table.authUserId),
    uniqueIndex("host_profile_username_unique").on(table.username),
  ]
);
