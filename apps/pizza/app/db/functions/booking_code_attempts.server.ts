import { and, count, eq, gt } from "drizzle-orm";

import type { Database } from "@/db/client.server";
import { bookingCodeAttempt } from "@/db/schema";

const BOOKING_CODE_ATTEMPT_WINDOW_MS = 60 * 60 * 1000;
const BOOKING_CODE_MAX_FAILED_ATTEMPTS = 5;
const BOOKING_CODE_MAX_SUCCESSFUL_ATTEMPTS = 120;

export type BookingCodeAttemptFailureReason =
  | "invalid_code"
  | "rate_limited";

type BookingCodeAttemptLimit =
  | { code: "allowed" }
  | { code: "rate_limited" };

type BookingCodeAttemptInsert = {
  createdAt: Date;
  hostId: string | null;
  id: string;
  ipHash: string;
  username: string;
} & (
  | { failureReason: BookingCodeAttemptFailureReason; success: false }
  | { failureReason: null; success: true }
);

export function getBookingCodeAttemptWindowStart(now: Date) {
  return new Date(now.getTime() - BOOKING_CODE_ATTEMPT_WINDOW_MS);
}

export function evaluateBookingCodeAttemptLimit(
  failedAttemptCount: number,
): BookingCodeAttemptLimit {
  if (failedAttemptCount >= BOOKING_CODE_MAX_FAILED_ATTEMPTS) {
    return { code: "rate_limited" };
  }

  return { code: "allowed" };
}

export function evaluateBookingCodeSuccessLimit(
  successfulAttemptCount: number,
): BookingCodeAttemptLimit {
  if (successfulAttemptCount >= BOOKING_CODE_MAX_SUCCESSFUL_ATTEMPTS) {
    return { code: "rate_limited" };
  }

  return { code: "allowed" };
}

export async function countRecentFailedBookingCodeAttemptsByIp(
  db: Database,
  input: { ipHash: string; since: Date },
) {
  const rows = await db
    .select({ failedAttempts: count() })
    .from(bookingCodeAttempt)
    .where(
      and(
        eq(bookingCodeAttempt.ipHash, input.ipHash),
        eq(bookingCodeAttempt.success, false),
        gt(bookingCodeAttempt.createdAt, input.since),
      ),
    );

  const row = rows[0];

  if (row === undefined) {
    throw new Error("booking code attempt count query returned no rows");
  }

  return row.failedAttempts;
}

export async function countRecentSuccessfulBookingCodeAttemptsByIpAndHost(
  db: Database,
  input: { hostId: string; ipHash: string; since: Date },
) {
  const rows = await db
    .select({ successfulAttempts: count() })
    .from(bookingCodeAttempt)
    .where(
      and(
        eq(bookingCodeAttempt.hostId, input.hostId),
        eq(bookingCodeAttempt.ipHash, input.ipHash),
        eq(bookingCodeAttempt.success, true),
        gt(bookingCodeAttempt.createdAt, input.since),
      ),
    );

  const row = rows[0];

  if (row === undefined) {
    throw new Error("booking code success count query returned no rows");
  }

  return row.successfulAttempts;
}

export async function recordBookingCodeAttempt(
  db: Database,
  input: BookingCodeAttemptInsert,
) {
  await db.insert(bookingCodeAttempt).values({
    id: input.id,
    username: input.username,
    hostId: input.hostId,
    ipHash: input.ipHash,
    success: input.success,
    failureReason: input.failureReason,
    createdAt: input.createdAt,
  });
}
