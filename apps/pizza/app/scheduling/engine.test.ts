import { describe, expect, expectTypeOf, it } from "vitest";

import {
  createSchedulingEngine,
  defaultIntervalOps,
  ScheduleEngineError,
  timeInterval,
  utcEpochMs,
  validateScheduleRequest,
} from "./engine";
import type {
  BusyInterval,
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
    name: "too many participant ids",
    patch: {
      requiredProfileIds: [
        "profile_1",
        "profile_2",
        "profile_3",
        "profile_4",
        "profile_5",
        "profile_6",
        "profile_7",
        "profile_8",
        "profile_9",
      ],
    },
    code: "too_many_profile_ids",
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
    name: "oversized windows",
    patch: {
      window: {
        startAtMs: utcEpochMs(Date.parse("2026-06-01T00:00:00.000Z")),
        endAtMs: utcEpochMs(Date.parse("2026-07-03T00:00:00.000Z")),
      },
    },
    code: "window_too_large",
  },
  {
    name: "invalid time zones",
    patch: { timeZone: "Mars/Olympus_Mons" },
    code: "invalid_time_zone",
  },
  {
    name: "oversized exact slot limits",
    patch: { maxExactSlotCount: 101 },
    code: "invalid_exact_slot_limit",
  },
  {
    name: "oversized alternative slot limits",
    patch: { maxAlternativeSlotCount: 51 },
    code: "invalid_alternative_slot_limit",
  },
  {
    name: "candidate slots outside the request window",
    patch: {
      candidateSlots: [
        interval("2026-06-26T18:00:00.000Z", "2026-06-26T18:30:00.000Z"),
      ],
    },
    code: "invalid_candidate_slot",
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

describe("default interval ops", () => {
  it("intersects merged free intervals and splits them into slots", () => {
    const free = defaultIntervalOps.intersectAll([
      [
        interval("2026-06-26T16:00:00.000Z", "2026-06-26T18:00:00.000Z"),
      ],
      [
        interval("2026-06-26T16:30:00.000Z", "2026-06-26T17:30:00.000Z"),
      ],
    ]);

    expect(defaultIntervalOps.slotify(free, 30, 15)).toEqual([
      interval("2026-06-26T16:30:00.000Z", "2026-06-26T17:00:00.000Z"),
      interval("2026-06-26T16:45:00.000Z", "2026-06-26T17:15:00.000Z"),
      interval("2026-06-26T17:00:00.000Z", "2026-06-26T17:30:00.000Z"),
    ]);
  });

  it("snaps slots to the requested granularity grid", () => {
    expect(
      defaultIntervalOps.slotify(
        [interval("2026-06-26T16:07:12.123Z", "2026-06-26T17:00:00.000Z")],
        30,
        15,
      ),
    ).toEqual([
      interval("2026-06-26T16:15:00.000Z", "2026-06-26T16:45:00.000Z"),
      interval("2026-06-26T16:30:00.000Z", "2026-06-26T17:00:00.000Z"),
    ]);
  });

  it("inverts busy intervals inside the requested window", () => {
    expect(
      defaultIntervalOps.invert(
        [
          interval("2026-06-26T16:30:00.000Z", "2026-06-26T17:00:00.000Z"),
          interval("2026-06-26T17:30:00.000Z", "2026-06-26T19:00:00.000Z"),
        ],
        interval("2026-06-26T16:00:00.000Z", "2026-06-26T18:00:00.000Z"),
      ),
    ).toEqual([
      interval("2026-06-26T16:00:00.000Z", "2026-06-26T16:30:00.000Z"),
      interval("2026-06-26T17:00:00.000Z", "2026-06-26T17:30:00.000Z"),
    ]);
  });
});

describe("default scheduling engine", () => {
  it("finds exact slots when every requested profile is free", async () => {
    const engine = createSchedulingEngine({
      busyIntervalSource: {
        fetchBusyIntervals: async () => [
          busy("profile_alice", "hard", "2026-06-26T16:30:00.000Z", "2026-06-26T17:00:00.000Z"),
          busy("profile_bob", "hard", "2026-06-26T17:30:00.000Z", "2026-06-26T18:00:00.000Z"),
        ],
      },
    });

    expect(await engine.schedule(validRequest)).toEqual({
      kind: "exact",
      slots: [
        interval("2026-06-26T16:00:00.000Z", "2026-06-26T16:30:00.000Z"),
        interval("2026-06-26T17:00:00.000Z", "2026-06-26T17:30:00.000Z"),
      ],
    });
  });

  it("does not return exact slots outside the candidate grid", async () => {
    const engine = createSchedulingEngine({
      busyIntervalSource: {
        fetchBusyIntervals: async () => [],
      },
    });

    expect(await engine.schedule({
      ...validRequest,
      candidateSlots: [
        interval("2026-06-26T17:00:00.000Z", "2026-06-26T17:30:00.000Z"),
      ],
    })).toEqual({
      kind: "exact",
      slots: [
        interval("2026-06-26T17:00:00.000Z", "2026-06-26T17:30:00.000Z"),
      ],
    });
  });

  it("ranks alternatives by hard conflicts and soft conflict cost", async () => {
    const request = {
      ...validRequest,
      window: interval("2026-06-26T16:00:00.000Z", "2026-06-26T17:00:00.000Z"),
      maxAlternativeSlotCount: 2,
      maxExactSlotCount: 20,
    } satisfies ScheduleRequest;
    const engine = createSchedulingEngine({
      busyIntervalSource: {
        fetchBusyIntervals: async () => [
          busy("profile_alice", "hard", "2026-06-26T16:00:00.000Z", "2026-06-26T18:00:00.000Z"),
          busy("profile_bob", "soft", "2026-06-26T16:30:00.000Z", "2026-06-26T17:00:00.000Z", 3),
        ],
      },
    });

    expect(await engine.schedule(request)).toMatchObject({
      kind: "alternatives",
      rankedSlots: [
        {
          conflictCost: 1_000,
          hardConflicts: [{ busyInterval: { profileId: "profile_alice" } }],
          softConflicts: [],
          slot: interval("2026-06-26T16:00:00.000Z", "2026-06-26T16:30:00.000Z"),
        },
        {
          conflictCost: 1_003,
          hardConflicts: [{ busyInterval: { profileId: "profile_alice" } }],
          softConflicts: [{ busyInterval: { profileId: "profile_bob" } }],
          slot: interval("2026-06-26T16:05:00.000Z", "2026-06-26T16:35:00.000Z"),
        },
      ],
    });
  });

  it("rejects malformed requests before provider I/O", async () => {
    let fetchCount = 0;
    const engine = createSchedulingEngine({
      busyIntervalSource: {
        fetchBusyIntervals: async () => {
          fetchCount += 1;
          return [];
        },
      },
    });

    await expect(
      engine.schedule({ ...validRequest, requiredProfileIds: [] }),
    ).rejects.toMatchObject({ code: "invalid_request" });
    expect(fetchCount).toBe(0);
  });
});

function interval(start: string, end: string) {
  return timeInterval({
    startAtMs: Date.parse(start),
    endAtMs: Date.parse(end),
  });
}

function busy(
  profileId: string,
  kind: "hard" | "soft",
  start: string,
  end: string,
  moveCost = 1,
): BusyInterval {
  if (kind === "hard") {
    return {
      ...interval(start, end),
      profileId,
      eventId: null,
      flexibility: { kind },
    };
  }

  return {
    ...interval(start, end),
    profileId,
    eventId: null,
    flexibility: { kind, moveCost },
  };
}
