import { describe, expect, it } from "vitest";

import {
  createPendingCalendarBookings,
  type PendingCalendarBookingInsert,
} from "./bookings.server";

type CapturedStatement = {
  readonly params: readonly unknown[];
  readonly sql: string;
};

describe("group booking reservations", () => {
  it("reserves pending calendar bookings with one D1 batch", async () => {
    const { database, statements } = createD1BatchRecorder();

    await expect(createPendingCalendarBookings(database, [
      pendingBooking("booking_1", "host_alice"),
      pendingBooking("booking_2", "host_bob"),
    ])).resolves.toEqual(["booking_1", "booking_2"]);
    expect(statements).toHaveLength(2);
    expect(compactSql(statements[0]?.sql ?? "")).toBe(
      "insert into booking ( id, hostId, hostUsername, bookingCodeId, guestName, guestEmail, guestEmailNormalized, guestTimezone, slotStartAt, slotEndAt, status, source, calendarProvider, calendarEventId, cancelledAt, createdAt, updatedAt ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, null, null, null, ?, ?)",
    );
    expect(statements[0]?.params).toEqual([
      "booking_1",
      "host_alice",
      "alice",
      "code_alice",
      "Ada",
      "ada@example.com",
      "ada@example.com",
      "America/Los_Angeles",
      1_782_489_600,
      1_782_491_400,
      "pending_calendar",
      "api",
      1_782_486_000,
      1_782_486_000,
    ]);
  });

  it("returns null when D1 rejects a conflicting reservation batch", async () => {
    const { database } = createD1BatchRecorder({
      error: new Error(
        "D1_ERROR: UNIQUE constraint failed: booking.hostId, booking.slotStartAt, booking.slotEndAt",
      ),
    });

    await expect(createPendingCalendarBookings(database, [
      pendingBooking("booking_1", "host_alice"),
    ])).resolves.toBeNull();
  });
});

function pendingBooking(
  id: string,
  hostId: string,
): PendingCalendarBookingInsert {
  return {
    id,
    hostId,
    hostUsername: hostId === "host_alice" ? "alice" : "bob",
    bookingCodeId: hostId === "host_alice" ? "code_alice" : "code_bob",
    createdAt: new Date("2026-06-26T15:00:00.000Z"),
    guestEmail: "ada@example.com",
    guestEmailNormalized: "ada@example.com",
    guestName: "Ada",
    guestTimezone: "America/Los_Angeles",
    slotEndAt: new Date("2026-06-26T16:30:00.000Z"),
    slotStartAt: new Date("2026-06-26T16:00:00.000Z"),
    source: "api",
  };
}

function createD1BatchRecorder(input?: { readonly error: Error }): {
  readonly database: D1Database;
  readonly statements: CapturedStatement[];
} {
  const captured = new WeakMap<D1PreparedStatement, CapturedStatement>();
  const statements: CapturedStatement[] = [];
  const database = {
    async batch(batchStatements: D1PreparedStatement[]) {
      if (input?.error !== undefined) {
        throw input.error;
      }

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
  // boundary used by createPendingCalendarBookings.
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
