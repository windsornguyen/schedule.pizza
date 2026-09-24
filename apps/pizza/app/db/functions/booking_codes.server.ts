import { and, desc, eq, gt, isNull, or } from "drizzle-orm";
import type { Database } from "@/db/client.server";
import { bookingCode, hostProfile } from "@/db/schema";
import { wordlist } from "@scure/bip39/wordlists/english.js";

const BOOKING_CODE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

type BookingCodeReader = Pick<Database, "select">;

export function generateBookingCode(wordCount: number): string {
  if (wordCount < 1) {
    throw new Error(`wordCount must be >= 1, got ${wordCount}`);
  }
  const bytes = new Uint32Array(wordCount);
  crypto.getRandomValues(bytes);
  return Array.from(
    bytes,
    (b: number) => (wordlist as string[])[b % (wordlist as string[]).length],
  ).join("-");
}

export async function rotateBookingCode(
  database: Database,
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

  await database.transaction(async (tx) => {
    const hosts = await tx
      .select({ username: hostProfile.username })
      .from(hostProfile)
      .where(eq(hostProfile.id, input.hostId))
      .for("update");
    const host = hosts[0];
    if (host === undefined)
      throw new BookingCodeMutationError("booking_code_host_missing");
    await tx
      .update(bookingCode)
      .set({ revokedAt: input.now, updatedAt: input.now })
      .where(
        and(
          eq(bookingCode.hostId, input.hostId),
          isNull(bookingCode.revokedAt),
        ),
      );
    await tx.insert(bookingCode).values({
      id: crypto.randomUUID(),
      hostId: input.hostId,
      hostUsername: host.username,
      label: input.label,
      codeHash,
      wordCount: input.wordCount,
      createdAt: input.now,
      updatedAt: input.now,
    });
  });

  return { code, codeHash };
}

interface ActiveBookingCodeLookup {
  codeHash: string;
  now: Date;
  username: string;
}

export function normalizeBookingCode(value: string) {
  const code = value
    .trim()
    .toLowerCase()
    .split(/[\s-]+/u)
    .join("-");

  if (!BOOKING_CODE_PATTERN.test(code)) {
    return null;
  }

  return code;
}

export async function hashNormalizedBookingCode(code: string) {
  const bytes = new TextEncoder().encode(code);
  const digest = await crypto.subtle.digest("SHA-256", bytes);

  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function findActiveBookingCode(
  db: BookingCodeReader,
  lookup: ActiveBookingCodeLookup,
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
        or(
          isNull(bookingCode.expiresAt),
          gt(bookingCode.expiresAt, lookup.now),
        ),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

export async function findActiveBookingCodeForHost(
  db: BookingCodeReader,
  input: { hostId: string; now: Date },
) {
  const rows = await db
    .select({
      createdAt: bookingCode.createdAt,
      expiresAt: bookingCode.expiresAt,
      id: bookingCode.id,
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

export class BookingCodeMutationError extends Error {
  constructor(readonly code: "booking_code_host_missing") {
    super(code);
    this.name = "BookingCodeMutationError";
  }
}
