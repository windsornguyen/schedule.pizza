import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const organization = sqliteTable("organization", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logo: text("logo"),
  metadata: text("metadata"),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
});
