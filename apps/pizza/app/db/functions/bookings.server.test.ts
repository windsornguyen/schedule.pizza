import { describe, expect, it } from "vitest";

import {
  confirmCalendarBookings,
  createPendingCalendarBooking,
  createPendingCalendarBookings,
  markCalendarBookingsFailed,
  type PendingCalendarBookingInsert,
} from "./bookings.server";

type CapturedStatement = {
  readonly params: readonly unknown[];
  readonly sql: string;
};

describe("group booking reservations", () => {
  it("reserves one pending calendar booking only when no host booking overlaps", async () => {
    const { database, statements } = createD1Recorder();

    await expect(createPendingCalendarBooking(
      database,
      pendingBooking("booking_1", "host_alice"),
    )).resolves.toEqual({ id: "booking_1" });
    expect(statements).toHaveLength(1);
    expect(compactSql(statements[0]?.sql ?? "")).toBe(
      "insert into booking ( id, hostId, hostUsername, bookingCodeId, guestName, guestEmail, guestEmailNormalized, guestTimezone, slotStartAt, slotEndAt, status, source, calendarProvider, calendarEventId, cancelledAt, createdAt, updatedAt ) select ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, null, null, null, ?, ? where not exists ( select 1 from booking where hostId = ? and status in ('pending_calendar', 'confirmed') and slotStartAt < ? and slotEndAt > ? )",
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
      "host_alice",
      1_782_491_400,
      1_782_489_600,
    ]);
  });

  it("returns null when one pending calendar booking overlaps", async () => {
    const { database } = createD1Recorder({ changes: [0] });

    await expect(createPendingCalendarBooking(
      database,
      pendingBooking("booking_1", "host_alice"),
    )).resolves.toBeNull();
  });

  it("returns null when D1 rejects one conflicting reservation", async () => {
    const { database } = createD1Recorder({
      error: new Error(
        "D1_ERROR: UNIQUE constraint failed: booking.hostId, booking.slotStartAt, booking.slotEndAt",
      ),
    });

    await expect(createPendingCalendarBooking(
      database,
      pendingBooking("booking_1", "host_alice"),
    )).resolves.toBeNull();
  });

  it("reserves grouped bookings with one conditional insert", async () => {
    const { database, statements } = createD1Recorder({ changes: [2] });

    await expect(createPendingCalendarBookings(database, [
      pendingBooking("booking_1", "host_alice"),
      pendingBooking("booking_2", "host_bob"),
    ])).resolves.toEqual(["booking_1", "booking_2"]);
    expect(statements).toHaveLength(1);
    expect(compactSql(statements[0]?.sql ?? "")).toContain(
      "with requested ( id, hostId, hostUsername, bookingCodeId",
    );
    expect(compactSql(statements[0]?.sql ?? "")).toContain(
      "where not exists ( select 1 from requested join booking",
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
      "booking_2",
      "host_bob",
      "bob",
      "code_bob",
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

  it("returns null without partial inserts when any grouped booking overlaps", async () => {
    const { database, statements } = createD1Recorder({ changes: [0] });

    await expect(createPendingCalendarBookings(database, [
      pendingBooking("booking_1", "host_alice"),
      pendingBooking("booking_2", "host_bob"),
    ])).resolves.toBeNull();
    expect(statements).toHaveLength(1);
  });

  it("returns null when D1 rejects a conflicting reservation", async () => {
    const { database } = createD1Recorder({
      error: new Error(
        "D1_ERROR: UNIQUE constraint failed: booking.hostId, booking.slotStartAt, booking.slotEndAt",
      ),
    });

    await expect(createPendingCalendarBookings(database, [
      pendingBooking("booking_1", "host_alice"),
    ])).resolves.toBeNull();
  });
});

describe("group booking state transitions", () => {
  it("confirms grouped bookings with one conditional update", async () => {
    const { database, statements } = createD1Recorder({ changes: [2] });

    await expect(confirmCalendarBookings(database, {
      bookingIds: ["booking_1", "booking_2"],
      calendarEventId: "google_event_1",
      confirmedAt: new Date("2026-06-26T15:05:00.000Z"),
      provider: "google",
    })).resolves.toEqual(["booking_1", "booking_2"]);
    expect(statements).toHaveLength(1);
    expect(compactSql(statements[0]?.sql ?? "")).toContain(
      "with requested (id) as ( values (?), (?) ), ready (bookingCount) as",
    );
    expect(compactSql(statements[0]?.sql ?? "")).toContain(
      "and (select bookingCount from ready) = ?",
    );
    expect(statements[0]?.params).toEqual([
      "booking_1",
      "booking_2",
      "pending_calendar",
      "google",
      "google_event_1",
      "confirmed",
      1_782_486_300,
      "pending_calendar",
      2,
    ]);
  });

  it("returns null without partial grouped confirmation", async () => {
    const { database, statements } = createD1Recorder({ changes: [0] });

    await expect(confirmCalendarBookings(database, {
      bookingIds: ["booking_1", "booking_2"],
      calendarEventId: "google_event_1",
      confirmedAt: new Date("2026-06-26T15:05:00.000Z"),
      provider: "google",
    })).resolves.toBeNull();
    expect(statements).toHaveLength(1);
  });

  it("marks grouped bookings failed with one conditional update", async () => {
    const { database, statements } = createD1Recorder({ changes: [2] });

    await expect(markCalendarBookingsFailed(database, {
      bookingIds: ["booking_1", "booking_2"],
      failedAt: new Date("2026-06-26T15:05:00.000Z"),
    })).resolves.toEqual(["booking_1", "booking_2"]);
    expect(statements).toHaveLength(1);
    expect(compactSql(statements[0]?.sql ?? "")).toContain(
      "with requested (id) as ( values (?), (?) ), ready (bookingCount) as",
    );
    expect(compactSql(statements[0]?.sql ?? "")).toContain(
      "and (select bookingCount from ready) = ?",
    );
    expect(statements[0]?.params).toEqual([
      "booking_1",
      "booking_2",
      "pending_calendar",
      "calendar_failed",
      1_782_486_300,
      "pending_calendar",
      2,
    ]);
  });

  it("returns null without partial grouped failure marking", async () => {
    const { database, statements } = createD1Recorder({ changes: [0] });

    await expect(markCalendarBookingsFailed(database, {
      bookingIds: ["booking_1", "booking_2"],
      failedAt: new Date("2026-06-26T15:05:00.000Z"),
    })).resolves.toBeNull();
    expect(statements).toHaveLength(1);
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

function createD1Recorder(input?: {
  readonly changes?: readonly number[];
  readonly error?: Error;
}): {
  readonly database: D1Database;
  readonly statements: CapturedStatement[];
} {
  const captured = new WeakMap<D1PreparedStatement, CapturedStatement>();
  const statements: CapturedStatement[] = [];
  let runCount = 0;
  const database = {
    prepare(sql: string) {
      return createPreparedStatement({
        captured,
        onRun: (statement) => {
          if (input?.error !== undefined) {
            throw input.error;
          }

          const capturedStatement = captured.get(statement);

          if (capturedStatement === undefined) {
            throw new Error("uncaptured D1 statement");
          }

          statements.push(capturedStatement);
          const changes = input?.changes?.[runCount] ?? 1;
          runCount += 1;

          return changes;
        },
        params: [],
        sql,
      });
    },
  };

  // D1 is a platform object; this fake implements only the prepare boundary.
  return { database: database as unknown as D1Database, statements };
}

function createPreparedStatement(
  input: {
    readonly captured: WeakMap<D1PreparedStatement, CapturedStatement>;
    readonly onRun: (statement: D1PreparedStatement) => number;
    readonly params: readonly unknown[];
    readonly sql: string;
  },
): D1PreparedStatement {
  const statement = {
    async all() {
      return { meta: {}, results: [], success: true };
    },
    bind(...boundParams: unknown[]) {
      return createPreparedStatement({ ...input, params: boundParams });
    },
    async first() {
      return null;
    },
    async raw() {
      return [];
    },
    async run() {
      return {
        meta: { changes: input.onRun(statement) },
        results: [],
        success: true,
      };
    },
  } as unknown as D1PreparedStatement;

  input.captured.set(statement, {
    params: input.params,
    sql: input.sql,
  });

  return statement;
}

function compactSql(sql: string) {
  return sql.replace(/\s+/gu, " ").trim();
}
