import { and, eq, gt, isNull, or } from "drizzle-orm";

import type { Database } from "@/db/client.server";
import { bookingCode, hostProfile } from "@/db/schema";

const BOOKING_CODE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

interface ActiveBookingCodeLookup {
  codeHash: string;
  now: Date;
  username: string;
}

export function normalizeBookingCode(value: string) {
  const code = value.trim().toLowerCase().split(/[\s-]+/u).join("-");

  if (!BOOKING_CODE_PATTERN.test(code)) {
    return null;
  }

  return code;
}

export async function hashNormalizedBookingCode(code: string) {
  const bytes = new TextEncoder().encode(code);
  const digest = await crypto.subtle.digest("SHA-256", bytes);

  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

export async function findActiveBookingCode(
  db: Database,
  lookup: ActiveBookingCodeLookup
) {
  const rows = await db
    .select({
      code: bookingCode,
      host: hostProfile,
    })
    .from(bookingCode)
    .innerJoin(hostProfile, eq(bookingCode.hostId, hostProfile.id))
    .where(
      and(
        eq(hostProfile.username, lookup.username),
        eq(bookingCode.codeHash, lookup.codeHash),
        isNull(bookingCode.revokedAt),
        or(isNull(bookingCode.expiresAt), gt(bookingCode.expiresAt, lookup.now))
      )
    )
    .limit(1);

  return rows[0] ?? null;
}

export async function markBookingCodeUsed(
  db: Database,
  input: { bookingCodeId: string; usedAt: Date }
) {
  await db
    .update(bookingCode)
    .set({ lastUsedAt: input.usedAt, updatedAt: input.usedAt })
    .where(eq(bookingCode.id, input.bookingCodeId));
}
