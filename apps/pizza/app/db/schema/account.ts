import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "./user";

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("accountId").notNull(),
    providerId: text("providerId").notNull(),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("accessToken"),
    refreshToken: text("refreshToken"),
    idToken: text("idToken"),
    accessTokenExpiresAt: timestamp("accessTokenExpiresAt", { withTimezone: true, precision: 3 }),
    refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt", { withTimezone: true, precision: 3 }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("createdAt", { withTimezone: true, precision: 3 }).notNull(),
    updatedAt: timestamp("updatedAt", { withTimezone: true, precision: 3 }).notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)]
);
