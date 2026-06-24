import { eq } from "drizzle-orm";

import type { Database } from "~/db/client.server";
import { hostProfile } from "~/db/schema";

export async function findHostProfileByUsername(
  db: Database,
  username: string
) {
  const rows = await db
    .select()
    .from(hostProfile)
    .where(eq(hostProfile.username, username))
    .limit(1);

  return rows[0] ?? null;
}
