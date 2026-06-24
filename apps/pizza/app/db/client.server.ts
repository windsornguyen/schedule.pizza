import { drizzle } from "drizzle-orm/d1";

import * as schema from "@/db/schema";

export function createDb(database: D1Database) {
  return drizzle(database, { schema });
}

export type Database = ReturnType<typeof createDb>;
