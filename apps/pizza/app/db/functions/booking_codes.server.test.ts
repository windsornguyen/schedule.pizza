import { drizzle } from "drizzle-orm/sqlite-proxy";
import { describe, expect, it } from "vitest";

import * as schema from "@/db/schema";
import { rotateBookingCode } from "./booking_codes.server";

describe("booking code rotation", () => {
  it("revokes active host codes before inserting the replacement", async () => {
    const queries: {
      readonly method: string;
      readonly params: readonly unknown[];
      readonly sql: string;
    }[] = [];
    const db = drizzle(
      async (sql, params, method) => {
        queries.push({ method, params, sql });
        return { rows: [] };
      },
      { schema },
    );

    const rotated = await rotateBookingCode(db, {
      hostId: "host_alice",
      hostUsername: "alice",
      label: null,
      now: new Date("2026-06-26T16:00:00.000Z"),
      wordCount: 3,
    });

    expect(rotated.code.split("-")).toHaveLength(3);
    expect(queries.map((query) => query.sql)).toEqual([
      "begin",
      'update "booking_code" set "revokedAt" = ?, "updatedAt" = ? where ("booking_code"."hostId" = ? and "booking_code"."revokedAt" is null and ("booking_code"."expiresAt" is null or "booking_code"."expiresAt" > ?))',
      'insert into "booking_code" ("id", "hostId", "hostUsername", "label", "codeHash", "codeHashVersion", "wordCount", "lastUsedAt", "expiresAt", "revokedAt", "createdAt", "updatedAt") values (?, ?, ?, ?, ?, ?, ?, null, null, null, ?, ?)',
      "commit",
    ]);
    expect(queries[1]?.params).toEqual([
      1_782_489_600,
      1_782_489_600,
      "host_alice",
      1_782_489_600,
    ]);
  });
});
