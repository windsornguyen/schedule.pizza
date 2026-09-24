/** Request-owned Postgres connections. Hyperdrive owns the origin connection pool. */
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "@/db/schema";

export function createDb(database: Pool) {
  return drizzle(database, { schema });
}

export type Database = Pick<
  NodePgDatabase<typeof schema>,
  | "select"
  | "insert"
  | "update"
  | "delete"
  | "transaction"
  | "execute"
  | "query"
>;

/** Each transaction checks out its own connection, isolated from parallel loaders. */
export async function withDatabase<T>(
  connectionString: string,
  run: (db: Database) => Promise<T>,
): Promise<T> {
  const pool = new Pool({ connectionString, max: 2 });
  pool.on("error", (error: Error) => {
    // oxlint-disable-next-line no-console -- report idle connection loss without credentials or query data
    console.error({ code: "postgres_idle_connection_error", name: error.name });
  });
  try {
    return await run(createDb(pool));
  } finally {
    await pool.end();
  }
}
