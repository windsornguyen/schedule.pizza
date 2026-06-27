import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  readBookedBookingId,
  readBookedBookingIds,
  readAvailabilitySlotStart,
  readCleanupRows,
  readD1Result,
  readD1Rows,
  readFirstAvailabilitySlotStart,
  readLiveSmokeConfig,
  readScheduleLikeSummary,
  sqlString,
} from "./smoke-live.mjs";

describe("live smoke config", () => {
  it("keeps live mutation disabled by default", () => {
    assert.throws(() => readLiveSmokeConfig({}), /SCHEDULE_PIZZA_LIVE_SMOKE must be 1/u);
  });

  it("accepts explicit production settings", () => {
    const config = readLiveSmokeConfig({
      SCHEDULE_PIZZA_LIVE_SMOKE: "1",
      SCHEDULE_PIZZA_LIVE_SMOKE_BOOKER_EMAIL: "ada@example.com",
      SCHEDULE_PIZZA_LIVE_SMOKE_BOOKER_NAME: "Ada",
      SCHEDULE_PIZZA_LIVE_SMOKE_DB: "schedule-pizza-prod-db",
      SCHEDULE_PIZZA_LIVE_SMOKE_TIMEZONE: "America/New_York",
      SCHEDULE_PIZZA_LIVE_SMOKE_USER: "Alice",
      SCHEDULE_PIZZA_URL: "https://schedule.pizza",
    });

    assert.equal(config.baseUrl.href, "https://schedule.pizza/");
    assert.equal(config.bookerEmail, "ada@example.com");
    assert.equal(config.bookerName, "Ada");
    assert.equal(config.databaseName, "schedule-pizza-prod-db");
    assert.equal(config.timeZone, "America/New_York");
    assert.equal(config.username, "alice");
  });

  it("rejects non-production URLs", () => {
    assert.throws(() => readLiveSmokeConfig({
      SCHEDULE_PIZZA_LIVE_SMOKE: "1",
      SCHEDULE_PIZZA_LIVE_SMOKE_BOOKER_EMAIL: "ada@example.com",
      SCHEDULE_PIZZA_LIVE_SMOKE_USER: "alice",
      SCHEDULE_PIZZA_URL: "http://localhost:5173",
    }), /SCHEDULE_PIZZA_URL must be https:\/\/schedule.pizza/u);
  });
});

describe("live smoke response parsing", () => {
  it("accepts exact schedule results", () => {
    assert.deepEqual(readScheduleLikeSummary({
      kind: "exact",
      slots: [{ start: "2030-01-07T17:00:00.000Z" }],
    }, "schedule"), {
      kind: "exact",
      slotCount: 1,
    });
  });

  it("reads availability slot starts", () => {
    assert.equal(readFirstAvailabilitySlotStart({
      slots: [{ start: "2030-01-07T17:00:00.000Z" }],
    }, "availability"), "2030-01-07T17:00:00.000Z");
  });

  it("reads later availability slots for independent writes", () => {
    assert.equal(readAvailabilitySlotStart({
      slots: [
        { start: "2030-01-07T17:00:00.000Z" },
        { start: "2030-01-07T17:30:00.000Z" },
      ],
    }, "availability", 1), "2030-01-07T17:30:00.000Z");
  });

  it("reads individual booking ids without Google event ids", () => {
    assert.equal(readBookedBookingId({
      ok: true,
      booking: { id: "booking_1", status: "confirmed" },
    }, "book"), "booking_1");
  });

  it("reads group booking ids without Google event ids", () => {
    assert.deepEqual(readBookedBookingIds({
      ok: true,
      booking: { ids: ["booking_1"], status: "confirmed" },
    }, "book group"), ["booking_1"]);
  });

  it("rejects public booking responses that expose Google event ids", () => {
    assert.throws(() => readBookedBookingId({
      ok: true,
      booking: {
        calendarEventId: "google_event_1",
        id: "booking_1",
      },
    }, "book"), /must not expose calendarEventId/u);
  });
});

describe("live smoke cleanup parsing", () => {
  it("escapes SQL string literals", () => {
    assert.equal(sqlString("ada's pizza"), "'ada''s pizza'");
  });

  it("parses wrangler D1 JSON rows", () => {
    assert.deepEqual(readD1Rows(JSON.stringify([{
      results: [{ ok: 1 }],
      success: true,
    }]), "d1"), [{ ok: 1 }]);
  });

  it("parses wrangler D1 update metadata", () => {
    assert.deepEqual(readD1Result(JSON.stringify([{
      meta: { changes: 1 },
      success: true,
    }]), "d1 update"), {
      meta: { changes: 1 },
      success: true,
    });
  });

  it("requires confirmed Google rows before cleanup", () => {
    assert.deepEqual(readCleanupRows([{
      accessToken: "access_token",
      calendarEventId: "event_1",
      calendarProvider: "google",
      id: "booking_1",
      status: "confirmed",
    }], ["booking_1"]), [{
      accessToken: "access_token",
      calendarEventId: "event_1",
      calendarProvider: "google",
      id: "booking_1",
      status: "confirmed",
    }]);
  });

  it("rejects cleanup rows without a Google event id", () => {
    assert.throws(() => readCleanupRows([{
      accessToken: "access_token",
      calendarEventId: null,
      calendarProvider: "google",
      id: "booking_1",
      status: "confirmed",
    }], ["booking_1"]), /booking cleanup calendarEventId/u);
  });

  it("accepts already-cancelled rows during failure cleanup", () => {
    assert.deepEqual(readCleanupRows([{
      calendarEventId: "event_1",
      cancelledAt: 1_782_577_942,
      id: "booking_1",
      status: "cancelled",
    }], ["booking_1"], { allowCancelled: true }), [{
      calendarEventId: "event_1",
      cancelledAt: 1_782_577_942,
      id: "booking_1",
      status: "cancelled",
    }]);
  });

  it("rejects cleanup rows for unexpected bookings", () => {
    assert.throws(() => readCleanupRows([{
      accessToken: "access_token",
      calendarEventId: "event_2",
      calendarProvider: "google",
      id: "booking_2",
      status: "confirmed",
    }], ["booking_1"]), /unexpected booking booking_2/u);
  });
});
