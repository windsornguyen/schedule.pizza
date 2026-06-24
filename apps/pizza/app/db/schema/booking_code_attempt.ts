import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { hostProfile } from "./host_profile";

export const bookingCodeAttempt = sqliteTable(
  "booking_code_attempt",
  {
    id: text("id").primaryKey(),
    username: text("username").notNull(),
    hostId: text("hostId").references(() => hostProfile.id, {
      onDelete: "set null",
    }),
    ipHash: text("ipHash").notNull(),
    success: integer("success", { mode: "boolean" }).notNull(),
    failureReason: text("failureReason"),
    createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
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
