/** Database invariants run against PostgreSQL, not a SQL-string recorder. */
import { and, eq, inArray, isNull } from "drizzle-orm";
import { createHmac } from "node:crypto";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createDb } from "./client.server";
import { createAuth } from "@/auth.server";
import { authorizeBookingCode } from "./functions/booking_code_authorizations.server";
import {
  confirmCalendarBookings,
  createPendingCalendarBooking,
  createPendingCalendarBookings,
  markCalendarBookingsFailed,
  type PendingCalendarBookingInsert,
} from "./functions/bookings.server";
import { rotateBookingCode } from "./functions/booking_codes.server";
import {
  createHostProfileWithBookingCode,
  updateHostProfile,
} from "./functions/host_profiles.server";
import {
  booking,
  bookingCode,
  bookingCodeAttempt,
  bookingCodeGate,
  hostProfile,
  session,
  user,
} from "./schema";

const connectionString = process.env["TEST_DATABASE_URL"];
if (!connectionString)
  throw new Error(
    "TEST_DATABASE_URL must name a disposable PostgreSQL database",
  );
const pool = new Pool({ connectionString, max: 16 });
const db = createDb(pool);
const now = new Date("2026-09-23T12:00:00.000Z");
const userIds: string[] = [];

beforeAll(async () => {
  await migrate(db, { migrationsFolder: "./drizzle" });
  const clients = await Promise.all(Array.from({ length: 16 }, () => pool.connect()));
  for (const client of clients) client.release();
});
afterEach(async () => {
  if (userIds.length) await db.delete(user).where(inArray(user.id, userIds));
  userIds.length = 0;
});
afterAll(async () => {
  await pool.end();
});

async function host() {
  const id = crypto.randomUUID();
  userIds.push(id);
  await db
    .insert(user)
    .values({
      id,
      name: id,
      email: `${id}@example.com`,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    });
  const profileInput = {
    id,
    authUserId: id,
    username: id,
    displayName: id,
    timezone: "America/Los_Angeles",
    slotSizeMinutes: 30,
    calendarProvider: "google" as const,
    calendarAccountEmail: `${id}@example.com`,
    calendarId: "primary",
    now,
  };
  const created = await createHostProfileWithBookingCode(db, profileInput);
  expect(created.code).toBe("created_profile");
  const [code] = await db
    .select()
    .from(bookingCode)
    .where(eq(bookingCode.hostId, id));
  if (!code) throw new Error("initial code missing");
  return { id, code, profileInput };
}

function reservation(
  person: Awaited<ReturnType<typeof host>>,
  offset = 0,
): PendingCalendarBookingInsert {
  return {
    id: crypto.randomUUID(),
    hostId: person.id,
    hostUsername: person.id,
    bookingCodeId: person.code.id,
    createdAt: now,
    guestEmail: null,
    guestEmailNormalized: null,
    guestName: "Guest",
    guestTimezone: null,
    slotStartAt: new Date(now.getTime() + offset * 60_000),
    slotEndAt: new Date(now.getTime() + (offset + 30) * 60_000),
    source: "api",
  };
}

describe("Postgres booking invariants", () => {
  it("admits only one of concurrent overlapping reservations, even with different start times", async () => {
    const person = await host();
    const results = await Promise.all(
      Array.from({ length: 12 }, (_, n) =>
        createPendingCalendarBooking(db, reservation(person, n)),
      ),
    );
    expect(results.filter((result) => result !== null)).toHaveLength(1);
    expect(
      await db.select().from(booking).where(eq(booking.hostId, person.id)),
    ).toHaveLength(1);
  });

  it("admits adjacent intervals and releases failed reservations", async () => {
    const person = await host();
    const first = reservation(person);
    expect(await createPendingCalendarBooking(db, first)).not.toBeNull();
    expect(
      await createPendingCalendarBooking(db, reservation(person, 30)),
    ).not.toBeNull();
    expect(
      await createPendingCalendarBooking(db, reservation(person, 1)),
    ).toBeNull();
    await markCalendarBookingsFailed(db, {
      bookingIds: [first.id],
      failedAt: now,
    });
    expect(
      await createPendingCalendarBooking(db, reservation(person)),
    ).not.toBeNull();
  });

  it("locks group hosts in a consistent order and never reserves a partial group", async () => {
    const alice = await host();
    const bob = await host();
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, n) =>
        createPendingCalendarBookings(
          db,
          (n % 2 ? [alice, bob] : [bob, alice]).map((p) => reservation(p, n)),
        ),
      ),
    );
    expect(results.filter((result) => result !== null)).toHaveLength(1);
    expect(
      await db
        .select()
        .from(booking)
        .where(inArray(booking.hostId, [alice.id, bob.id])),
    ).toHaveLength(2);
  });

  it("rolls back the whole reservation when any row violates a foreign key", async () => {
    const alice = await host();
    const bob = await host();
    await expect(
      createPendingCalendarBookings(db, [
        reservation(alice),
        {
          ...reservation(bob),
          bookingCodeId: "missing",
        },
      ]),
    ).rejects.toMatchObject({ cause: { code: "23503" } });
    expect(
      await db
        .select()
        .from(booking)
        .where(inArray(booking.hostId, [alice.id, bob.id])),
    ).toHaveLength(0);
  });

  it("changes group state only if every booking is still pending", async () => {
    const alice = await host();
    const bob = await host();
    const first = reservation(alice);
    const second = reservation(bob);
    await createPendingCalendarBookings(db, [first, second]);
    await markCalendarBookingsFailed(db, {
      bookingIds: [first.id],
      failedAt: now,
    });
    expect(
      await confirmCalendarBookings(db, {
        bookingIds: [first.id, second.id],
        calendarEventId: "event",
        confirmedAt: now,
        provider: "google",
      }),
    ).toBeNull();
    const [row] = await db
      .select()
      .from(booking)
      .where(eq(booking.id, second.id));
    expect(row?.status).toBe("pending_calendar");
  });

  it("rejects empty and duplicate batches before writing", async () => {
    const person = await host();
    const input = reservation(person);
    await expect(createPendingCalendarBookings(db, [])).rejects.toMatchObject({
      code: "invalid_booking_batch",
    });
    await expect(
      createPendingCalendarBookings(db, [input, input]),
    ).rejects.toMatchObject({ code: "invalid_booking_batch" });
  });
});

describe("Postgres profile and code invariants", () => {
  it("preserves signed Better Auth sessions and revokes them through the pg adapter", async () => {
    const person = await host();
    const token = crypto.randomUUID();
    const secret = "postgres-integration-test-secret-with-32-characters";
    const current = new Date();
    const expiresAt = new Date(current.getTime() + 7 * 86_400_000);
    await db
      .insert(session)
      .values({
        id: crypto.randomUUID(),
        userId: person.id,
        token,
        createdAt: current,
        updatedAt: current,
        expiresAt,
      });
    const signature = createHmac("sha256", secret)
      .update(token)
      .digest("base64");
    const headers = new Headers({
      cookie: `__Secure-better-auth.session_token=${encodeURIComponent(`${token}.${signature}`)}`,
      origin: "https://schedule.pizza",
    });
    const auth = createAuth({
      database: db,
      BETTER_AUTH_URL: "https://schedule.pizza",
      BETTER_AUTH_SECRET: secret,
      GOOGLE_CLIENT_ID: "test",
      GOOGLE_CLIENT_SECRET: "test",
    });
    const authenticated = await auth.api.getSession({
      headers,
      query: { disableCookieCache: true },
    });
    expect(authenticated?.user.id).toBe(person.id);
    expect(authenticated?.session.expiresAt).toEqual(expiresAt);
    await auth.api.revokeSession({ headers, body: { token } });
    expect(
      await auth.api.getSession({
        headers,
        query: { disableCookieCache: true },
      }),
    ).toBeNull();
  });
  it("enforces the failed-code quota under concurrent requests", async () => {
    const ipHash = crypto.randomUUID();
    try {
      const results = await Promise.all(
        Array.from({ length: 12 }, () =>
          authorizeBookingCode(db, {
            bookingCode: "invalid-code",
            ipHash,
            now,
            username: "missing-user",
          }),
        ),
      );
      expect(
        results.filter((result) => result.code === "booking_code_invalid"),
      ).toHaveLength(5);
      expect(
        results.filter((result) => result.code === "booking_code_rate_limited"),
      ).toHaveLength(7);
    } finally {
      await db
        .delete(bookingCodeAttempt)
        .where(eq(bookingCodeAttempt.ipHash, ipHash));
      await db
        .delete(bookingCodeGate)
        .where(eq(bookingCodeGate.ipHash, ipHash));
    }
  });
  it("returns a typed profile conflict without inserting a second code", async () => {
    const person = await host();
    expect(
      await createHostProfileWithBookingCode(db, {
        ...person.profileInput,
        id: crypto.randomUUID(),
      }),
    ).toEqual({ code: "profile_conflict" });
    expect(
      await db
        .select()
        .from(bookingCode)
        .where(eq(bookingCode.hostId, person.id)),
    ).toHaveLength(1);
  });

  it("keeps exactly one active code after concurrent rotations", async () => {
    const person = await host();
    await Promise.all(
      Array.from({ length: 8 }, () =>
        rotateBookingCode(db, {
          hostId: person.id,
          hostUsername: person.id,
          label: null,
          wordCount: 3,
          now,
        }),
      ),
    );
    expect(
      await db
        .select()
        .from(bookingCode)
        .where(
          and(eq(bookingCode.hostId, person.id), isNull(bookingCode.revokedAt)),
        ),
    ).toHaveLength(1);
  });

  it("rolls back a conflicting rename without revoking the existing code", async () => {
    const alice = await host();
    const bob = await host();
    expect(
      await updateHostProfile(db, {
        ...alice.profileInput,
        currentHostId: alice.id,
        currentUsername: alice.id,
        username: bob.id,
      }),
    ).toEqual({ code: "profile_conflict" });
    const [profile] = await db
      .select()
      .from(hostProfile)
      .where(eq(hostProfile.id, alice.id));
    const [code] = await db
      .select()
      .from(bookingCode)
      .where(eq(bookingCode.id, alice.code.id));
    expect(profile?.username).toBe(alice.id);
    expect(code?.revokedAt).toBeNull();
  });

  it("commits a rename and replacement code together using the canonical username", async () => {
    const person = await host();
    const username = `${person.id}-renamed`;
    const result = await updateHostProfile(db, {
      ...person.profileInput,
      currentHostId: person.id,
      currentUsername: "stale-client-value",
      username,
    });
    expect(result.code).toBe("updated_profile");
    const [code] = await db
      .select()
      .from(bookingCode)
      .where(
        and(eq(bookingCode.hostId, person.id), isNull(bookingCode.revokedAt)),
      );
    expect(code?.hostUsername).toBe(username);
    expect(code?.id).not.toBe(person.code.id);
  });
});
