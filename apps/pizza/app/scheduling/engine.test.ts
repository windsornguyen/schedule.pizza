import { describe, expect, expectTypeOf, it } from "vitest";

import {
  ScheduleEngineError,
  timeInterval,
  utcEpochMs,
} from "./engine";
import type {
  BusyIntervalSource,
  ScheduleRequest,
  ScheduleResult,
  SchedulingEngine,
} from "./engine";

describe("scheduling engine contract", () => {
  it("keeps request and result shapes serializable", async () => {
    const window = timeInterval({
      startAtMs: Date.parse("2026-06-26T16:00:00.000Z"),
      endAtMs: Date.parse("2026-06-26T18:00:00.000Z"),
    });
    const request = {
      requiredProfileIds: ["profile_alice", "profile_bob"],
      durationMinutes: 30,
      granularityMinutes: 5,
      maxExactSlotCount: 20,
      maxAlternativeSlotCount: 5,
      timeZone: "America/Los_Angeles",
      window,
    } satisfies ScheduleRequest;
    const source: BusyIntervalSource = {
      fetchBusyIntervals: async () => [
        {
          profileId: "profile_bob",
          eventId: "event_bob_1",
          flexibility: { kind: "soft", moveCost: 10 },
          startAtMs: utcEpochMs(Date.parse("2026-06-26T16:30:00.000Z")),
          endAtMs: utcEpochMs(Date.parse("2026-06-26T17:00:00.000Z")),
        },
      ],
    };
    const engine: SchedulingEngine = {
      findExactSlots: async () => [window],
      rankAlternatives: async () => [
        {
          slot: window,
          hardConflicts: [],
          softConflicts: [],
          conflictCost: 0,
        },
      ],
      schedule: async (): Promise<ScheduleResult> => ({
        kind: "exact",
        slots: [window],
      }),
    };

    expectTypeOf(request).toMatchTypeOf<ScheduleRequest>();
    const busyIntervals = await source.fetchBusyIntervals({
      profileIds: request.requiredProfileIds,
      window,
    });
    const result = await engine.schedule(request);

    expect(busyIntervals).toHaveLength(1);
    expect(result).toEqual({
      kind: "exact",
      slots: [window],
    });
    expect(JSON.parse(JSON.stringify(request))).toEqual({
      requiredProfileIds: ["profile_alice", "profile_bob"],
      durationMinutes: 30,
      granularityMinutes: 5,
      maxExactSlotCount: 20,
      maxAlternativeSlotCount: 5,
      timeZone: "America/Los_Angeles",
      window: {
        startAtMs: Date.parse("2026-06-26T16:00:00.000Z"),
        endAtMs: Date.parse("2026-06-26T18:00:00.000Z"),
      },
    });
  });

  it("rejects invalid intervals with a typed error code", () => {
    let thrown: unknown;

    try {
      timeInterval({
        startAtMs: Date.parse("2026-06-26T18:00:00.000Z"),
        endAtMs: Date.parse("2026-06-26T16:00:00.000Z"),
      });
    } catch (error: unknown) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(ScheduleEngineError);

    if (!(thrown instanceof ScheduleEngineError)) {
      throw new Error("expected invalid interval to throw a scheduling error");
    }

    expect(thrown.code).toBe("invalid_interval");
  });
});
