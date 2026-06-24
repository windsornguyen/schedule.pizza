import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { hostProfile } from "./host_profile";

export const bookingCode = sqliteTable(
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
    lastUsedAt: integer("lastUsedAt", { mode: "timestamp" }),
    expiresAt: integer("expiresAt", { mode: "timestamp" }),
    revokedAt: integer("revokedAt", { mode: "timestamp" }),
    createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
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
