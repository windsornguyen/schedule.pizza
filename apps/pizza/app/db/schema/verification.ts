import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expiresAt", { withTimezone: true, precision: 3 }).notNull(),
    createdAt: timestamp("createdAt", { withTimezone: true, precision: 3 }).notNull(),
    updatedAt: timestamp("updatedAt", { withTimezone: true, precision: 3 }).notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)]
);
