import { eq } from "drizzle-orm";

import type { Database } from "@/db/client.server";
import { hostProfile } from "@/db/schema";
import {
  generateBookingCode,
  hashNormalizedBookingCode,
} from "./booking_codes.server";

export { normalizeUsername } from "./host_profile_values";

type D1ProfileUpdateDatabase = Pick<D1Database, "batch" | "prepare">;

type HostProfileUpdateResult =
  | { readonly code: "profile_missing" }
  | {
      readonly bookingCode: string | null;
      readonly code: "updated_profile";
    };

type HostProfileUpdateInput = {
  readonly authUserId: string;
  readonly calendarAccountEmail: string;
  readonly calendarId: string;
  readonly calendarProvider: "google";
  readonly currentHostId: string;
  readonly currentUsername: string;
  readonly displayName: string;
  readonly now: Date;
  readonly slotSizeMinutes: number;
  readonly timezone: string;
  readonly username: string;
};

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

export async function updateHostProfile(
  database: D1ProfileUpdateDatabase,
  input: HostProfileUpdateInput,
): Promise<HostProfileUpdateResult> {
  if (input.currentUsername === input.username) {
    const results = await database.batch([profileUpdateStatement(database, input)]);
    const profileUpdate = results[0];

    return profileUpdate !== undefined && hasSingleChangedRow(profileUpdate)
      ? { code: "updated_profile", bookingCode: null }
      : { code: "profile_missing" };
  }

  const bookingCode = generateBookingCode(3);
  const codeHash = await hashNormalizedBookingCode(bookingCode);
  const results = await database.batch([
    profileUpdateStatement(database, input),
    database
      .prepare(
        `update booking_code
          set revokedAt = ?, updatedAt = ?
          where hostId = ?
            and exists (
              select 1 from host_profile
              where id = ? and authUserId = ?
            )
            and revokedAt is null
            and (expiresAt is null or expiresAt > ?)`,
      )
      .bind(
        toUnixSeconds(input.now),
        toUnixSeconds(input.now),
        input.currentHostId,
        input.currentHostId,
        input.authUserId,
        toUnixSeconds(input.now),
      ),
    database
      .prepare(
        `insert into booking_code (
          id, hostId, hostUsername, label, codeHash, codeHashVersion, wordCount,
          lastUsedAt, expiresAt, revokedAt, createdAt, updatedAt
        )
        select ?, ?, ?, null, ?, ?, ?, null, null, null, ?, ?
        where exists (
          select 1 from host_profile
          where id = ? and authUserId = ?
        )`,
      )
      .bind(
        crypto.randomUUID(),
        input.currentHostId,
        input.username,
        codeHash,
        1,
        3,
        toUnixSeconds(input.now),
        toUnixSeconds(input.now),
        input.currentHostId,
        input.authUserId,
      ),
  ]);

  const profileUpdate = results[0];
  const codeInsert = results[2];

  if (
    profileUpdate === undefined ||
    codeInsert === undefined ||
    !hasSingleChangedRow(profileUpdate) ||
    !hasSingleChangedRow(codeInsert)
  ) {
    return { code: "profile_missing" };
  }

  return { code: "updated_profile", bookingCode };
}

function profileUpdateStatement(
  database: D1ProfileUpdateDatabase,
  input: HostProfileUpdateInput,
) {
  return database
    .prepare(
      `update host_profile
        set username = ?,
            displayName = ?,
            timezone = ?,
            slotSizeMinutes = ?,
            calendarProvider = ?,
            calendarAccountEmail = ?,
            calendarId = ?,
            updatedAt = ?
        where authUserId = ? and id = ?`,
    )
    .bind(
      input.username,
      input.displayName,
      input.timezone,
      input.slotSizeMinutes,
      input.calendarProvider,
      input.calendarAccountEmail,
      input.calendarId,
      toUnixSeconds(input.now),
      input.authUserId,
      input.currentHostId,
    );
}

function hasSingleChangedRow(result: D1Result) {
  return result.meta.changes === 1;
}

function toUnixSeconds(date: Date) {
  return Math.floor(date.getTime() / 1_000);
}
