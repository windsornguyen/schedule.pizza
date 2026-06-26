import type { Database } from "@/db/client.server";

import {
  countRecentFailedBookingCodeAttemptsByIp,
  evaluateBookingCodeAttemptLimit,
  getBookingCodeAttemptWindowStart,
  recordBookingCodeAttempt,
} from "./booking_code_attempts.server";
import {
  findActiveBookingCode,
  hashNormalizedBookingCode,
} from "./booking_codes.server";

export type BookingCodeAuthorization =
  | {
      access: NonNullable<Awaited<ReturnType<typeof findActiveBookingCode>>>;
      code: "authorized";
    }
  | { code: "booking_code_invalid" }
  | { code: "booking_code_rate_limited" };

export async function authorizeBookingCode(
  db: Database,
  input: {
    bookingCode: string;
    ipHash: string;
    now: Date;
    username: string;
  },
): Promise<BookingCodeAuthorization> {
  const failedAttemptCount = await countRecentFailedBookingCodeAttemptsByIp(db, {
    ipHash: input.ipHash,
    since: getBookingCodeAttemptWindowStart(input.now),
  });
  const limit = evaluateBookingCodeAttemptLimit(failedAttemptCount);

  if (limit.code === "rate_limited") {
    await recordBookingCodeAttempt(db, {
      id: crypto.randomUUID(),
      username: input.username,
      hostId: null,
      ipHash: input.ipHash,
      success: false,
      failureReason: "rate_limited",
      createdAt: input.now,
    });

    return { code: "booking_code_rate_limited" };
  }

  const codeHash = await hashNormalizedBookingCode(input.bookingCode);
  const access = await findActiveBookingCode(db, {
    codeHash,
    now: input.now,
    username: input.username,
  });

  if (access === null) {
    await recordBookingCodeAttempt(db, {
      id: crypto.randomUUID(),
      username: input.username,
      hostId: null,
      ipHash: input.ipHash,
      success: false,
      failureReason: "invalid_code",
      createdAt: input.now,
    });

    return { code: "booking_code_invalid" };
  }

  await recordBookingCodeAttempt(db, {
    id: crypto.randomUUID(),
    username: input.username,
    hostId: access.host.id,
    ipHash: input.ipHash,
    success: true,
    failureReason: null,
    createdAt: input.now,
  });

  return { code: "authorized", access };
}
