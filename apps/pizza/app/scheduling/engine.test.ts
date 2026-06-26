import { describe, expect, expectTypeOf, it } from "vitest";

import {
  ScheduleEngineError,
  timeInterval,
  utcEpochMs,
  validateScheduleRequest,
} from "./engine";
import type {
  BusyIntervalSource,
  ScheduleRequest,
  ScheduleRequestErrorCode,
  ScheduleResult,
  SchedulingEngine,
} from "./engine";

const validWindow = timeInterval({
  startAtMs: Date.parse("2026-06-26T16:00:00.000Z"),
  endAtMs: Date.parse("2026-06-26T18:00:00.000Z"),
});

const validRequest = {
  requiredProfileIds: ["profile_alice", "profile_bob"],
  durationMinutes: 30,
  granularityMinutes: 5,
  maxExactSlotCount: 20,
  maxAlternativeSlotCount: 5,
  timeZone: "America/Los_Angeles",
  window: validWindow,
} satisfies ScheduleRequest;

const invalidRequestCases = [
  {
    name: "empty participant set",
    patch: { requiredProfileIds: [] },
    code: "empty_profile_set",
  },
  {
    name: "duplicate participant ids",
    patch: { requiredProfileIds: ["profile_alice", "profile_alice"] },
    code: "duplicate_profile_id",
  },
  {
    name: "impossible windows",
    patch: {
      window: {
        startAtMs: utcEpochMs(Date.parse("2026-06-26T18:00:00.000Z")),
        endAtMs: utcEpochMs(Date.parse("2026-06-26T16:00:00.000Z")),
      },
    },
    code: "invalid_window",
  },
  {
    name: "invalid time zones",
    patch: { timeZone: "Mars/Olympus_Mons" },
    code: "invalid_time_zone",
  },
] satisfies readonly {
  readonly code: ScheduleRequestErrorCode;
  readonly name: string;
  readonly patch: Partial<ScheduleRequest>;
}[];

describe("scheduling engine contract", () => {
  it("keeps request and result shapes serializable", async () => {
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
      findExactSlots: async () => [validWindow],
      rankAlternatives: async () => [
        {
          slot: validWindow,
          hardConflicts: [],
          softConflicts: [],
          conflictCost: 0,
        },
      ],
      schedule: async (): Promise<ScheduleResult> => ({
        kind: "exact",
        slots: [validWindow],
      }),
    };

    expectTypeOf(validRequest).toMatchTypeOf<ScheduleRequest>();
    expect(validateScheduleRequest(validRequest)).toEqual({ kind: "valid" });
    const busyIntervals = await source.fetchBusyIntervals({
      profileIds: validRequest.requiredProfileIds,
      window: validWindow,
    });
    const result = await engine.schedule(validRequest);

    expect(busyIntervals).toHaveLength(1);
    expect(result).toEqual({
      kind: "exact",
      slots: [validWindow],
    });
    expect(JSON.parse(JSON.stringify(validRequest))).toEqual({
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

  it.each(invalidRequestCases)("rejects $name", ({ code, patch }) => {
    const validation = validateScheduleRequest({ ...validRequest, ...patch });

    expect(validation).toEqual({
      kind: "invalid",
      code,
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
