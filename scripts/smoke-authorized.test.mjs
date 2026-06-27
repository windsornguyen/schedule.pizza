import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  readScheduleLikeSummary,
  readSmokeTarget,
} from "./smoke-authorized.mjs";

describe("authorized smoke target parsing", () => {
  it("accepts one shared booking link as the capability", () => {
    assert.deepEqual(readSmokeTarget({
      SCHEDULE_PIZZA_SMOKE_URL: "schedule.pizza/Alice?code=moon tiger seven",
    }), {
      availabilityPath: "/api/v1/availability?url=https%3A%2F%2Fschedule.pizza%2FAlice%3Fcode%3Dmoon%2520tiger%2520seven",
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
