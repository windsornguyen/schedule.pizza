import { describe, expect, it } from "vitest";

import {
  createHostProfileWithBookingCode,
  updateHostProfile,
} from "./host_profiles.server";

type CapturedStatement = {
  readonly params: readonly unknown[];
  readonly sql: string;
};

describe("host profile updates", () => {
  it("creates the profile and initial booking code in one D1 batch", async () => {
    const { database, statements } = createD1BatchRecorder();

    const created = await createHostProfileWithBookingCode(database, createInput());

    if (created.code !== "created_profile") {
      throw new Error("expected profile bootstrap to return a booking code");
    }

    expect(created.bookingCode.split("-")).toHaveLength(3);
    expect(created.profile).toEqual({ id: "host_1", username: "alice" });
    expect(statements.map((statement) => compactSql(statement.sql))).toEqual([
      "insert into host_profile ( id, authUserId, username, displayName, timezone, slotSizeMinutes, calendarProvider, calendarAccountEmail, calendarId, createdAt, updatedAt ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      "insert into booking_code ( id, hostId, hostUsername, label, codeHash, codeHashVersion, wordCount, lastUsedAt, expiresAt, revokedAt, createdAt, updatedAt ) values (?, ?, ?, null, ?, ?, ?, null, null, null, ?, ?)",
    ]);
    expect(statements[0]?.params).toEqual([
      "host_1",
      "auth_user_1",
      "alice",
      "alice",
      "America/Los_Angeles",
      30,
      "google",
      "alice@example.com",
      "primary",
      1_782_489_600,
      1_782_489_600,
    ]);
    expect(statements[1]?.params.slice(1, 8)).toEqual([
      "host_1",
      "alice",
      created.bookingCodeHash,
      1,
      3,
      1_782_489_600,
      1_782_489_600,
    ]);
  });

  it("reports a bootstrap conflict when D1 rejects the profile insert", async () => {
    const { database } = createD1BatchRecorder(
      [],
      [],
      new Error("D1_ERROR: UNIQUE constraint failed: host_profile.username"),
    );

    await expect(
      createHostProfileWithBookingCode(database, createInput()),
    ).resolves.toEqual({ code: "profile_conflict" });
  });

  it("updates ordinary profile settings with one D1 statement", async () => {
    const { database, statements } = createD1BatchRecorder();

    await expect(updateHostProfile(database, updateInput())).resolves.toEqual({
      code: "updated_profile",
      bookingCode: null,
    });
    expect(statements.map((statement) => compactSql(statement.sql))).toEqual([
      "update host_profile set username = ?, displayName = ?, timezone = ?, slotSizeMinutes = ?, calendarProvider = ?, calendarAccountEmail = ?, calendarId = ?, updatedAt = ? where authUserId = ? and id = ?",
    ]);
  });

  it("renames the profile and rotates the booking code in one D1 batch", async () => {
    const { database, statements } = createD1BatchRecorder();

    const updated = await updateHostProfile(database, updateInput({
      currentUsername: "alice",
      username: "alice-new",
    }));

    if (updated.code !== "updated_profile" || updated.bookingCode === null) {
      throw new Error("expected renamed profile to return a booking code");
    }

    expect(updated.bookingCode.split("-")).toHaveLength(3);
    expect(statements.map((statement) => compactSql(statement.sql))).toEqual([
      "update host_profile set username = ?, displayName = ?, timezone = ?, slotSizeMinutes = ?, calendarProvider = ?, calendarAccountEmail = ?, calendarId = ?, updatedAt = ? where authUserId = ? and id = ?",
      "update booking_code set revokedAt = ?, updatedAt = ? where hostId = ? and exists ( select 1 from host_profile where id = ? and authUserId = ? and username = ? ) and revokedAt is null and (expiresAt is null or expiresAt > ?)",
      "insert into booking_code ( id, hostId, hostUsername, label, codeHash, codeHashVersion, wordCount, lastUsedAt, expiresAt, revokedAt, createdAt, updatedAt ) select ?, ?, ?, null, ?, ?, ?, null, null, null, ?, ? where exists ( select 1 from host_profile where id = ? and authUserId = ? and username = ? )",
    ]);
    expect(statements[2]?.params.slice(1, 7)).toEqual([
      "host_1",
      "alice-new",
      expect.any(String),
      1,
      3,
      1_782_489_600,
    ]);
  });

  it("reports rename conflicts from D1 unique constraint errors", async () => {
    const { database } = createD1BatchRecorder(
      [],
      [],
      new Error("D1_ERROR: UNIQUE constraint failed: host_profile.username"),
    );

    await expect(updateHostProfile(database, updateInput({
      currentUsername: "alice",
      username: "alice-new",
    }))).resolves.toEqual({ code: "profile_conflict" });
  });
});

function createInput(): Parameters<typeof createHostProfileWithBookingCode>[1] {
  return {
    authUserId: "auth_user_1",
    calendarAccountEmail: "alice@example.com",
    calendarId: "primary",
    calendarProvider: "google",
    displayName: "alice",
    id: "host_1",
    now: new Date("2026-06-26T16:00:00.000Z"),
    slotSizeMinutes: 30,
    timezone: "America/Los_Angeles",
    username: "alice",
  };
}

function updateInput(
  override: Partial<Parameters<typeof updateHostProfile>[1]> = {},
): Parameters<typeof updateHostProfile>[1] {
  return {
    authUserId: "auth_user_1",
    calendarAccountEmail: "alice@example.com",
    calendarId: "primary",
    calendarProvider: "google",
    currentHostId: "host_1",
    currentUsername: "alice",
    displayName: "alice",
    now: new Date("2026-06-26T16:00:00.000Z"),
    slotSizeMinutes: 30,
    timezone: "America/Los_Angeles",
    username: "alice",
    ...override,
  };
}

function createD1BatchRecorder(
  changes: readonly number[] = [],
  results: readonly (readonly Record<string, unknown>[])[] = [],
  error?: Error,
): {
  readonly database: D1Database;
  readonly statements: CapturedStatement[];
} {
  const captured = new WeakMap<D1PreparedStatement, CapturedStatement>();
  const statements: CapturedStatement[] = [];
  const database = {
    async batch(batchStatements: D1PreparedStatement[]) {
      if (error !== undefined) {
        throw error;
      }

      for (const statement of batchStatements) {
        const capturedStatement = captured.get(statement);

        if (capturedStatement === undefined) {
          throw new Error("uncaptured D1 statement");
        }

        statements.push(capturedStatement);
      }

      return batchStatements.map((_, index) => ({
        meta: { changes: changes[index] ?? 1 },
        results: results[index] ?? [],
      }));
    },
    prepare(sql: string) {
      return createPreparedStatement(captured, sql, []);
    },
  };

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
