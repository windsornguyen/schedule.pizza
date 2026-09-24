import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "./user";

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expiresAt", { withTimezone: true, precision: 3 }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("createdAt", { withTimezone: true, precision: 3 }).notNull(),
    updatedAt: timestamp("updatedAt", { withTimezone: true, precision: 3 }).notNull(),
    ipAddress: text("ipAddress"),
    userAgent: text("userAgent"),
    activeOrganizationId: text("activeOrganizationId"),
    impersonatedBy: text("impersonatedBy"),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)]
);
