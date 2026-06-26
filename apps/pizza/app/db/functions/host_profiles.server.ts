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

export async function findHostProfileByAuthUserId(
  db: Database,
  authUserId: string
) {
  const rows = await db
    .select()
    .from(hostProfile)
    .where(eq(hostProfile.authUserId, authUserId))
    .limit(1);

  return rows[0] ?? null;
}

export async function createHostProfile(
  db: Database,
  input: {
    authUserId: string;
    calendarAccountEmail: string;
    calendarId: string;
    calendarProvider: "google";
    displayName: string;
    id: string;
    now: Date;
    slotSizeMinutes: number;
    timezone: string;
    username: string;
  }
) {
  const rows = await db
    .insert(hostProfile)
    .values({
      id: input.id,
      authUserId: input.authUserId,
      username: input.username,
      displayName: input.displayName,
      timezone: input.timezone,
      slotSizeMinutes: input.slotSizeMinutes,
      calendarProvider: input.calendarProvider,
      calendarAccountEmail: input.calendarAccountEmail,
      calendarId: input.calendarId,
      createdAt: input.now,
      updatedAt: input.now,
    })
    .onConflictDoNothing()
    .returning();

  return rows[0] ?? null;
}
