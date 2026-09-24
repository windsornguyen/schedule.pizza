/** Profile creation and renaming commit together with their booking-code changes. */
import { and, eq } from "drizzle-orm";
import { DatabaseError } from "pg";

import type { Database } from "@/db/client.server";
import { hostProfile } from "@/db/schema";
import { rotateBookingCode } from "./booking_codes.server";

export { normalizeUsername } from "./host_profile_values";

type HostProfileCreateInput = {
  readonly authUserId: string;
  readonly calendarAccountEmail: string;
  readonly calendarId: string;
  readonly calendarProvider: "google";
  readonly displayName: string;
  readonly id: string;
  readonly now: Date;
  readonly slotSizeMinutes: number;
  readonly timezone: string;
  readonly username: string;
};

type HostProfileUpdateInput = Omit<HostProfileCreateInput, "id"> & {
  readonly currentHostId: string;
  readonly currentUsername: string;
};

type HostProfileCreateResult =
  | { readonly code: "profile_conflict" }
  | {
      readonly code: "created_profile";
      readonly bookingCode: string;
      readonly bookingCodeHash: string;
      readonly profile: { readonly id: string; readonly username: string };
    };

type HostProfileUpdateResult =
  | { readonly code: "profile_conflict" }
  | { readonly code: "profile_missing" }
  | { readonly code: "updated_profile"; readonly bookingCode: string | null };

export async function findHostProfileByUsername(
  db: Database,
  username: string,
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
  authUserId: string,
) {
  const rows = await db
    .select()
    .from(hostProfile)
    .where(eq(hostProfile.authUserId, authUserId))
    .limit(1);
  return rows[0] ?? null;
}

export async function createHostProfileWithBookingCode(
  database: Database,
  input: HostProfileCreateInput,
): Promise<HostProfileCreateResult> {
  try {
    return await database.transaction(async (tx) => {
      const { now, ...profile } = input;
      await tx
        .insert(hostProfile)
        .values({ ...profile, createdAt: now, updatedAt: now });
      const code = await rotateBookingCode(tx, {
        hostId: input.id,
        hostUsername: input.username,
        wordCount: 3,
        label: null,
        now,
      });
      return {
        code: "created_profile",
        bookingCode: code.code,
        bookingCodeHash: code.codeHash,
        profile: { id: input.id, username: input.username },
      };
    });
  } catch (error: unknown) {
    if (isHostProfileConflict(error)) return { code: "profile_conflict" };
    throw error;
  }
}

export async function updateHostProfile(
  database: Database,
  input: HostProfileUpdateInput,
): Promise<HostProfileUpdateResult> {
  try {
    return await database.transaction(async (tx) => {
      const owner = and(
        eq(hostProfile.id, input.currentHostId),
        eq(hostProfile.authUserId, input.authUserId),
      );
      const rows = await tx
        .select({ username: hostProfile.username })
        .from(hostProfile)
        .where(owner)
        .for("update");
      const current = rows[0];
      if (current === undefined) return { code: "profile_missing" };
      await tx
        .update(hostProfile)
        .set({
          username: input.username,
          displayName: input.displayName,
          timezone: input.timezone,
          slotSizeMinutes: input.slotSizeMinutes,
          calendarProvider: input.calendarProvider,
          calendarAccountEmail: input.calendarAccountEmail,
          calendarId: input.calendarId,
          updatedAt: input.now,
        })
        .where(owner);
      if (current.username === input.username)
        return { code: "updated_profile", bookingCode: null };
      const code = await rotateBookingCode(tx, {
        hostId: input.currentHostId,
        hostUsername: input.username,
        wordCount: 3,
        label: null,
        now: input.now,
      });
      return { code: "updated_profile", bookingCode: code.code };
    });
  } catch (error: unknown) {
    if (isHostProfileConflict(error)) return { code: "profile_conflict" };
    throw error;
  }
}

function isHostProfileConflict(error: unknown): boolean {
  if (error instanceof DatabaseError) {
    return (
      error.code === "23505" &&
      (error.constraint === "host_profile_authUserId_unique" ||
        error.constraint === "host_profile_username_unique")
    );
  }
  return (
    error instanceof Error &&
    error.cause !== undefined &&
    isHostProfileConflict(error.cause)
  );
}
