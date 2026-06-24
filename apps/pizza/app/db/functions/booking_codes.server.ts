import { and, eq, gt, isNull, or } from "drizzle-orm";

import type { Database } from "~/db/client.server";
import { bookingCode, hostProfile } from "~/db/schema";

interface ActiveBookingCodeLookup {
  codeHash: string;
  now: Date;
  username: string;
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
