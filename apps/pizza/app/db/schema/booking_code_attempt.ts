import { boolean, index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { hostProfile } from "./host_profile";

export const bookingCodeAttempt = pgTable(
  "booking_code_attempt",
  {
    id: text("id").primaryKey(),
    username: text("username").notNull(),
    hostId: text("hostId").references(() => hostProfile.id, {
      onDelete: "set null",
    }),
    ipHash: text("ipHash").notNull(),
    success: boolean("success").notNull(),
    failureReason: text("failureReason"),
    createdAt: timestamp("createdAt", { withTimezone: true, precision: 3 }).notNull(),
  },
  (table) => [
    index("booking_code_attempt_username_createdAt_idx").on(
      table.username,
      table.createdAt
    ),
    index("booking_code_attempt_ipHash_createdAt_idx").on(
      table.ipHash,
      table.createdAt
    ),
    index("booking_code_attempt_hostId_createdAt_idx").on(
      table.hostId,
      table.createdAt
    ),
  ]
);
