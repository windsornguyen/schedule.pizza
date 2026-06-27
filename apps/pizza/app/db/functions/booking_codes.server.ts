import { and, desc, eq, gt, isNull, or } from "drizzle-orm";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import type * as databaseSchema from "@/db/schema";
import { bookingCode, hostProfile } from "@/db/schema";
import { wordlist } from "@scure/bip39/wordlists/english.js";

const BOOKING_CODE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

type SchedulePizzaSqlite<RunResult> = BaseSQLiteDatabase<
  "async",
  RunResult,
  typeof databaseSchema
>;
type BookingCodeReader<RunResult> = Pick<SchedulePizzaSqlite<RunResult>, "select">;
type BookingCodeWriter<RunResult> = Pick<SchedulePizzaSqlite<RunResult>, "insert" | "update">;
type D1BatchDatabase = Pick<D1Database, "batch" | "prepare">;

export function generateBookingCode(wordCount: number): string {
  if (wordCount < 1) {
    throw new Error(`wordCount must be >= 1, got ${wordCount}`);
  }
  const bytes = new Uint32Array(wordCount);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b: number) => (wordlist as string[])[b % (wordlist as string[]).length]).join("-");
}

export async function createBookingCode<RunResult>(
  db: BookingCodeWriter<RunResult>,
  input: {
    hostId: string;
    hostUsername: string;
    wordCount: number;
    label: string | null;
    now: Date;
  },
) {
  const code = generateBookingCode(input.wordCount);
  const codeHash = await hashNormalizedBookingCode(code);

  await db.insert(bookingCode).values({
    id: crypto.randomUUID(),
    hostId: input.hostId,
    hostUsername: input.hostUsername,
    label: input.label,
    codeHash,
    codeHashVersion: 1,
    wordCount: input.wordCount,
    createdAt: input.now,
    updatedAt: input.now,
  });

  return { code, codeHash };
}

export async function rotateBookingCode(
  database: D1BatchDatabase,
  input: {
    hostId: string;
    hostUsername: string;
    wordCount: number;
    label: string | null;
    now: Date;
  },
) {
  const code = generateBookingCode(input.wordCount);
  const codeHash = await hashNormalizedBookingCode(code);

  await database.batch([
    database
      .prepare(
        `update booking_code
          set revokedAt = ?, updatedAt = ?
          where hostId = ?
            and revokedAt is null
            and (expiresAt is null or expiresAt > ?)`,
      )
      .bind(
        toUnixSeconds(input.now),
        toUnixSeconds(input.now),
        input.hostId,
        toUnixSeconds(input.now),
      ),
    database
      .prepare(
        `insert into booking_code (
          id, hostId, hostUsername, label, codeHash, codeHashVersion, wordCount,
          lastUsedAt, expiresAt, revokedAt, createdAt, updatedAt
        ) values (?, ?, ?, ?, ?, ?, ?, null, null, null, ?, ?)`,
      )
      .bind(
        crypto.randomUUID(),
        input.hostId,
        input.hostUsername,
        input.label,
        codeHash,
        1,
        input.wordCount,
        toUnixSeconds(input.now),
        toUnixSeconds(input.now),
      ),
  ]);

  return { code, codeHash };
}

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

export async function findActiveBookingCode<RunResult>(
  db: BookingCodeReader<RunResult>,
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

export async function findActiveBookingCodeForHost<RunResult>(
  db: BookingCodeReader<RunResult>,
  input: { hostId: string; now: Date },
) {
  const rows = await db
    .select({
      createdAt: bookingCode.createdAt,
      expiresAt: bookingCode.expiresAt,
      id: bookingCode.id,
      lastUsedAt: bookingCode.lastUsedAt,
      wordCount: bookingCode.wordCount,
    })
    .from(bookingCode)
    .where(
      and(
        eq(bookingCode.hostId, input.hostId),
        isNull(bookingCode.revokedAt),
        or(isNull(bookingCode.expiresAt), gt(bookingCode.expiresAt, input.now)),
      ),
    )
    .orderBy(desc(bookingCode.createdAt))
    .limit(1);

  return rows[0] ?? null;
}

export async function markBookingCodeUsed<RunResult>(
  db: BookingCodeWriter<RunResult>,
  input: { bookingCodeId: string; usedAt: Date }
) {
  await db
    .update(bookingCode)
    .set({ lastUsedAt: input.usedAt, updatedAt: input.usedAt })
    .where(eq(bookingCode.id, input.bookingCodeId));
}

function toUnixSeconds(date: Date) {
  return Math.floor(date.getTime() / 1_000);
}
