import { describe, expect, it } from "vitest";

import { rotateBookingCode } from "./booking_codes.server";

type CapturedStatement = {
  readonly params: readonly unknown[];
  readonly sql: string;
};

describe("booking code rotation", () => {
  it("revokes active host codes and inserts the replacement in one D1 batch", async () => {
    const { database, statements } = createD1BatchRecorder();

    const rotated = await rotateBookingCode(database, {
      hostId: "host_alice",
      hostUsername: "alice",
      label: null,
      now: new Date("2026-06-26T16:00:00.000Z"),
      wordCount: 3,
    });

    expect(rotated.code.split("-")).toHaveLength(3);
    expect(statements.map((statement) => compactSql(statement.sql))).toEqual([
      "update booking_code set revokedAt = ?, updatedAt = ? where hostId = ? and revokedAt is null and (expiresAt is null or expiresAt > ?)",
      "insert into booking_code ( id, hostId, hostUsername, label, codeHash, codeHashVersion, wordCount, lastUsedAt, expiresAt, revokedAt, createdAt, updatedAt ) values (?, ?, ?, ?, ?, ?, ?, null, null, null, ?, ?)",
    ]);
    expect(statements[0]?.params).toEqual([
      1_782_489_600,
      1_782_489_600,
      "host_alice",
      1_782_489_600,
    ]);
    expect(statements[1]?.params.slice(1, 8)).toEqual([
      "host_alice",
      "alice",
      null,
      rotated.codeHash,
      1,
      3,
      1_782_489_600,
    ]);
  });
});

function createD1BatchRecorder(): {
  readonly database: D1Database;
  readonly statements: CapturedStatement[];
} {
  const captured = new WeakMap<D1PreparedStatement, CapturedStatement>();
  const statements: CapturedStatement[] = [];
  const database = {
    async batch(batchStatements: D1PreparedStatement[]) {
      for (const statement of batchStatements) {
        const capturedStatement = captured.get(statement);

        if (capturedStatement === undefined) {
          throw new Error("uncaptured D1 statement");
        }

        statements.push(capturedStatement);
      }

      return [];
    },
    prepare(sql: string) {
      return createPreparedStatement(captured, sql, []);
    },
  };

  // D1 is a platform object; this fake implements only the prepare/batch
  // boundary used by rotateBookingCode.
  return { database: database as unknown as D1Database, statements };
}

function createPreparedStatement(
  captured: WeakMap<D1PreparedStatement, CapturedStatement>,
  sql: string,
  params: readonly unknown[],
): D1PreparedStatement {
  const statement = {
    async all() {
      return { meta: {}, results: [], success: true };
    },
    bind(...boundParams: unknown[]) {
      return createPreparedStatement(captured, sql, boundParams);
    },
    async first() {
      return null;
    },
    async raw() {
      return [];
    },
    async run() {
      return { meta: {}, results: [], success: true };
    },
  } as unknown as D1PreparedStatement;

  captured.set(statement, { params, sql });

  return statement;
}

function compactSql(sql: string) {
  return sql.replace(/\s+/gu, " ").trim();
}
