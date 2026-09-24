import { boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull(),
  image: text("image"),
  role: text("role"),
  banned: boolean("banned").default(false),
  banReason: text("banReason"),
  banExpires: timestamp("banExpires", { withTimezone: true, precision: 3 }),
  createdAt: timestamp("createdAt", { withTimezone: true, precision: 3 }).notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true, precision: 3 }).notNull(),
});
