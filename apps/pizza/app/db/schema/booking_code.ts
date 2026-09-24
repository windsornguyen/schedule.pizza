import { index, integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

import { hostProfile } from "./host_profile";

export const bookingCode = pgTable(
  "booking_code",
  {
    id: text("id").primaryKey(),
    hostId: text("hostId")
      .notNull()
      .references(() => hostProfile.id, { onDelete: "cascade" }),
    hostUsername: text("hostUsername").notNull(),
    label: text("label"),
    codeHash: text("codeHash").notNull(),
    codeHashVersion: integer("codeHashVersion").notNull().default(1),
    wordCount: integer("wordCount").notNull().default(3),
    lastUsedAt: timestamp("lastUsedAt", { withTimezone: true, precision: 3 }),
    expiresAt: timestamp("expiresAt", { withTimezone: true, precision: 3 }),
    revokedAt: timestamp("revokedAt", { withTimezone: true, precision: 3 }),
    createdAt: timestamp("createdAt", { withTimezone: true, precision: 3 }).notNull(),
    updatedAt: timestamp("updatedAt", { withTimezone: true, precision: 3 }).notNull(),
  },
  (table) => [
    index("booking_code_hostId_idx").on(table.hostId),
    index("booking_code_hostUsername_idx").on(table.hostUsername),
    uniqueIndex("booking_code_hostId_codeHash_unique").on(
      table.hostId,
      table.codeHash
    ),
  ]
);
