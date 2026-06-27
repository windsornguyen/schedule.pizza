import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  readAccountHostUsername,
  readBookedBookingId,
  readFirstAvailabilitySlotStart,
  readScheduleLikeSummary,
  readSmokeTarget,
  readWriteSmokeConfig,
} from "./smoke-authorized.mjs";

describe("authorized smoke target parsing", () => {
  it("accepts one shared booking link as the capability", () => {
    assert.deepEqual(readSmokeTarget({
      SCHEDULE_PIZZA_SMOKE_URL: "schedule.pizza/Alice?code=moon tiger seven",
    }), {
      availabilityPath: "/api/v1/availability?url=https%3A%2F%2Fschedule.pizza%2FAlice%3Fcode%3Dmoon%2520tiger%2520seven",
      book: {
        bookingCode: "moon tiger seven",
        username: "alice",
      },
      expectedUser: "alice",
      participant: {
        url: "https://schedule.pizza/Alice?code=moon%20tiger%20seven",
      },
    });
  });

  it("rejects ambiguous booking capability input", () => {
    assert.throws(() => readSmokeTarget({
      SCHEDULE_PIZZA_SMOKE_CODE: "moon-tiger-seven",
      SCHEDULE_PIZZA_SMOKE_URL: "schedule.pizza/alice?code=moon-tiger-seven",
      SCHEDULE_PIZZA_SMOKE_USER: "alice",
    }), /Use SCHEDULE_PIZZA_SMOKE_URL/u);
  });
});

describe("authorized smoke write config", () => {
  it("keeps write smoke disabled by default", () => {
    assert.deepEqual(readWriteSmokeConfig({}), { enabled: false });
  });

  it("requires a cancellable host session when write smoke is enabled", () => {
    assert.throws(() => readWriteSmokeConfig({
      SCHEDULE_PIZZA_SMOKE_BOOKER_EMAIL: "ada@example.com",
      SCHEDULE_PIZZA_SMOKE_WRITE: "1",
    }), /SCHEDULE_PIZZA_SMOKE_SESSION_COOKIE is required/u);
  });

  it("accepts explicit write smoke settings", () => {
    assert.deepEqual(readWriteSmokeConfig({
      SCHEDULE_PIZZA_SMOKE_BOOKER_EMAIL: "ada@example.com",
      SCHEDULE_PIZZA_SMOKE_BOOKER_NAME: "Ada",
      SCHEDULE_PIZZA_SMOKE_SESSION_COOKIE: "better-auth.session_token=abc",
      SCHEDULE_PIZZA_SMOKE_TIMEZONE: "America/New_York",
      SCHEDULE_PIZZA_SMOKE_WRITE: "1",
    }), {
      bookerEmail: "ada@example.com",
      bookerName: "Ada",
      enabled: true,
      sessionCookie: "better-auth.session_token=abc",
      timeZone: "America/New_York",
    });
  });
});

describe("authorized smoke schedule result parsing", () => {
  it("accepts non-empty exact slots", () => {
    assert.deepEqual(readScheduleLikeSummary({
      kind: "exact",
      slots: [{ start: "2030-01-07T17:00:00.000Z" }],
    }, "schedule"), {
      kind: "exact",
      slotCount: 1,
    });
  });

  it("rejects alternatives for the single-participant launch smoke", () => {
    assert.throws(() => readScheduleLikeSummary({
      kind: "alternatives",
      slots: [{ slot: { start: "2030-01-07T17:00:00.000Z" } }],
    }, "recommend"), /recommend expected exact slots/u);
  });
});

describe("authorized smoke write response parsing", () => {
  it("reads the host username from the account session", () => {
    assert.equal(readAccountHostUsername({
      ok: true,
      account: { profile: { username: "alice" } },
    }, "write smoke account"), "alice");
  });

  it("rejects account sessions without a host profile", () => {
    assert.throws(() => readAccountHostUsername({
      ok: true,
      account: { profile: null },
    }, "write smoke account"), /account profile must be a JSON object/u);
  });

  it("reads the first availability slot start", () => {
    assert.equal(readFirstAvailabilitySlotStart({
      slots: [{ start: "2030-01-07T17:00:00.000Z" }],
    }, "availability"), "2030-01-07T17:00:00.000Z");
  });

  it("reads confirmed booking ids without Google event ids", () => {
    assert.equal(readBookedBookingId({
      ok: true,
      booking: {
        id: "booking_1",
        calendar: { provider: "google" },
        status: "confirmed",
      },
    }, "book smoke slot"), "booking_1");
  });

  it("rejects booking responses that leak Google event ids", () => {
    assert.throws(() => readBookedBookingId({
      ok: true,
      booking: {
        id: "booking_1",
        calendarEventId: "google_event_1",
      },
    }, "book smoke slot"), /must not expose calendarEventId/u);
  });
});
