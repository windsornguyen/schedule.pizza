import { eq } from "drizzle-orm";

import type { Database } from "@/db/client.server";
import { hostProfile } from "@/db/schema";

const USERNAME_PATTERN = /^[a-z0-9][a-z0-9_-]{0,39}$/;

export function normalizeUsername(value: string) {
  const username = value.trim().toLowerCase();

  if (!USERNAME_PATTERN.test(username)) {
    return null;
  }

  return username;
}

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
