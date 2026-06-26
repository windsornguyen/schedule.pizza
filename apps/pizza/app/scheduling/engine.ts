/**
 * Scheduling engine contract.
 *
 * This module defines the backend boundary shared by HTTP routes, future CLI
 * commands, agent entrypoints, and calendar-provider adapters. The contract is
 * deliberately serializable: callers parse external input before this boundary
 * and receive candidate slots, not booking writes.
 */

declare const utcEpochMsBrand: unique symbol;

export type ProfileId = string;
export type CalendarEventId = string;

export type UtcEpochMs = number & {
  readonly [utcEpochMsBrand]: "UtcEpochMs";
};

export type TimeInterval = {
  readonly endAtMs: UtcEpochMs;
  readonly startAtMs: UtcEpochMs;
};

export type HardBusyIntervalFlexibility = { readonly kind: "hard" };
export type SoftBusyIntervalFlexibility = {
  readonly kind: "soft";
  readonly moveCost: number;
};
export type BusyIntervalFlexibility =
  | HardBusyIntervalFlexibility
  | SoftBusyIntervalFlexibility;

type BusyIntervalBase = TimeInterval & {
  readonly eventId: CalendarEventId | null;
  readonly profileId: ProfileId;
};

export type HardBusyInterval = BusyIntervalBase & {
  readonly flexibility: HardBusyIntervalFlexibility;
};

export type SoftBusyInterval = BusyIntervalBase & {
  readonly flexibility: SoftBusyIntervalFlexibility;
};

export type BusyInterval = HardBusyInterval | SoftBusyInterval;

export type BusyIntervalQuery = {
  readonly profileIds: readonly ProfileId[];
  readonly window: TimeInterval;
};

export type BusyIntervalSource = {
  readonly fetchBusyIntervals: (
    query: BusyIntervalQuery,
  ) => Promise<readonly BusyInterval[]>;
};

export type HardScheduleConflict = {
  readonly busyInterval: HardBusyInterval;
};

export type SoftScheduleConflict = {
  readonly busyInterval: SoftBusyInterval;
};

export type ScoredSlot = {
  readonly conflictCost: number;
  readonly hardConflicts: readonly HardScheduleConflict[];
  readonly slot: TimeInterval;
  readonly softConflicts: readonly SoftScheduleConflict[];
};

export type ScheduleRequest = {
  readonly durationMinutes: number;
  readonly granularityMinutes: number;
  readonly maxAlternativeSlotCount: number;
  readonly maxExactSlotCount: number;
  readonly requiredProfileIds: readonly ProfileId[];
  readonly timeZone: string;
  readonly window: TimeInterval;
};

export type ScheduleRequestErrorCode =
  | "duplicate_profile_id"
  | "empty_profile_set"
  | "invalid_alternative_slot_limit"
  | "invalid_duration_minutes"
  | "invalid_exact_slot_limit"
  | "invalid_granularity_minutes"
  | "invalid_profile_id"
  | "invalid_time_zone"
  | "invalid_window"
  | "too_many_profile_ids"
  | "window_too_large";

export type ScheduleRequestValidation =
  | { readonly kind: "valid" }
  | { readonly code: ScheduleRequestErrorCode; readonly kind: "invalid" };

export type NoScheduleReason = "no_candidate_slots" | "window_too_small";

export type ScheduleResult =
  | { readonly kind: "exact"; readonly slots: readonly TimeInterval[] }
  | {
      readonly kind: "alternatives";
      readonly rankedSlots: readonly ScoredSlot[];
    }
  | { readonly kind: "none"; readonly reason: NoScheduleReason };

export type SchedulingEngine = {
  readonly findExactSlots: (
    request: ScheduleRequest,
  ) => Promise<readonly TimeInterval[]>;
  readonly rankAlternatives: (
    request: ScheduleRequest,
  ) => Promise<readonly ScoredSlot[]>;
  readonly schedule: (request: ScheduleRequest) => Promise<ScheduleResult>;
};

export type IntervalOps = {
  readonly intersect: (
    left: readonly TimeInterval[],
    right: readonly TimeInterval[],
  ) => readonly TimeInterval[];
  readonly intersectAll: (
    intervals: readonly (readonly TimeInterval[])[],
  ) => readonly TimeInterval[];
  readonly invert: (
    busy: readonly TimeInterval[],
    window: TimeInterval,
  ) => readonly TimeInterval[];
  readonly merge: (intervals: readonly TimeInterval[]) => readonly TimeInterval[];
  readonly slotify: (
    free: readonly TimeInterval[],
    durationMinutes: number,
    granularityMinutes: number,
  ) => readonly TimeInterval[];
};

const HARD_CONFLICT_COST = 1_000;
const MINUTE_MS = 60_000;

export const SCHEDULE_REQUEST_LIMITS = {
  maxAlternativeSlotCount: 50,
  maxDurationMinutes: 8 * 60,
  maxExactSlotCount: 100,
  maxGranularityMinutes: 4 * 60,
  maxProfileCount: 8,
  maxWindowMs: 31 * 24 * 60 * MINUTE_MS,
} as const;

export type ScheduleEngineErrorCode =
  | "busy_interval_source_failed"
  | "invalid_busy_interval"
  | "invalid_instant"
  | "invalid_interval"
  | "invalid_request"
  | "invalid_slot_configuration";

export class ScheduleEngineError extends Error {
  constructor(
    readonly code: ScheduleEngineErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ScheduleEngineError";
  }
}

export function utcEpochMs(value: number): UtcEpochMs {
  if (!Number.isSafeInteger(value)) {
    throw new ScheduleEngineError(
      "invalid_instant",
      "UTC epoch milliseconds must be a safe integer",
    );
  }

  return value as UtcEpochMs;
}

export function timeInterval(input: {
  readonly endAtMs: number;
  readonly startAtMs: number;
}): TimeInterval {
  const startAtMs = utcEpochMs(input.startAtMs);
  const endAtMs = utcEpochMs(input.endAtMs);

  if (startAtMs >= endAtMs) {
    throw new ScheduleEngineError(
      "invalid_interval",
      "interval start must be before interval end",
    );
  }

  return { endAtMs, startAtMs };
}

export function validateScheduleRequest(
  request: ScheduleRequest,
): ScheduleRequestValidation {
  const profileValidation = validateProfileIds(request.requiredProfileIds);

  if (profileValidation.kind === "invalid") {
    return profileValidation;
  }

  if (
    !isPositiveInteger(request.durationMinutes) ||
    request.durationMinutes > SCHEDULE_REQUEST_LIMITS.maxDurationMinutes
  ) {
    return { kind: "invalid", code: "invalid_duration_minutes" };
  }

  if (
    !isPositiveInteger(request.granularityMinutes) ||
    request.granularityMinutes > SCHEDULE_REQUEST_LIMITS.maxGranularityMinutes
  ) {
    return { kind: "invalid", code: "invalid_granularity_minutes" };
  }

  if (
    !isPositiveInteger(request.maxExactSlotCount) ||
    request.maxExactSlotCount > SCHEDULE_REQUEST_LIMITS.maxExactSlotCount
  ) {
    return { kind: "invalid", code: "invalid_exact_slot_limit" };
  }

  if (
    !isPositiveInteger(request.maxAlternativeSlotCount) ||
    request.maxAlternativeSlotCount >
      SCHEDULE_REQUEST_LIMITS.maxAlternativeSlotCount
  ) {
    return { kind: "invalid", code: "invalid_alternative_slot_limit" };
  }

  if (!isValidInterval(request.window)) {
    return { kind: "invalid", code: "invalid_window" };
  }

  if (
    request.window.endAtMs - request.window.startAtMs >
    SCHEDULE_REQUEST_LIMITS.maxWindowMs
  ) {
    return { kind: "invalid", code: "window_too_large" };
  }

  if (!isValidTimeZone(request.timeZone)) {
    return { kind: "invalid", code: "invalid_time_zone" };
  }

  return { kind: "valid" };
}

export const defaultIntervalOps = {
  merge(intervals) {
    const sortedIntervals = [...intervals].sort(compareIntervals);
    const mergedIntervals: TimeInterval[] = [];

    for (const interval of sortedIntervals) {
      assertValidInterval(interval, "invalid_interval");
      const previous = mergedIntervals.at(-1);

      if (previous === undefined || previous.endAtMs < interval.startAtMs) {
        mergedIntervals.push(interval);
        continue;
      }

      if (interval.endAtMs > previous.endAtMs) {
        mergedIntervals[mergedIntervals.length - 1] = {
          startAtMs: previous.startAtMs,
          endAtMs: interval.endAtMs,
        };
      }
    }

    return mergedIntervals;
  },

  invert(busy, window) {
    assertValidInterval(window, "invalid_interval");
    const freeIntervals: TimeInterval[] = [];
    let cursorMs = window.startAtMs;

    for (const interval of clipIntervalsToWindow(this.merge(busy), window)) {
      if (cursorMs < interval.startAtMs) {
        freeIntervals.push({ startAtMs: cursorMs, endAtMs: interval.startAtMs });
      }

      cursorMs = interval.endAtMs;
    }

    if (cursorMs < window.endAtMs) {
      freeIntervals.push({ startAtMs: cursorMs, endAtMs: window.endAtMs });
    }

    return freeIntervals;
  },

  intersect(left, right) {
    const intersections: TimeInterval[] = [];
    const leftIntervals = this.merge(left);
    const rightIntervals = this.merge(right);
    let leftIndex = 0;
    let rightIndex = 0;

    while (leftIndex < leftIntervals.length && rightIndex < rightIntervals.length) {
      const leftInterval = leftIntervals[leftIndex];
      const rightInterval = rightIntervals[rightIndex];

      if (leftInterval === undefined || rightInterval === undefined) {
        throw new ScheduleEngineError(
          "invalid_interval",
          "interval intersection index escaped bounds",
        );
      }

      const intersection = intersectIntervals(leftInterval, rightInterval);

      if (intersection !== null) {
        intersections.push(intersection);
      }

      if (leftInterval.endAtMs < rightInterval.endAtMs) {
        leftIndex += 1;
      } else {
        rightIndex += 1;
      }
    }

    return intersections;
  },

  intersectAll(intervalLists) {
    const [firstIntervals, ...remainingIntervals] = intervalLists;

    if (firstIntervals === undefined) {
      return [];
    }

    return remainingIntervals.reduce(
      (free, next) => this.intersect(free, next),
      this.merge(firstIntervals),
    );
  },

  slotify(free, durationMinutes, granularityMinutes) {
    assertValidSlotConfiguration(durationMinutes, granularityMinutes);
    const durationMs = durationMinutes * MINUTE_MS;
    const granularityMs = granularityMinutes * MINUTE_MS;
    const slots: TimeInterval[] = [];

    for (const interval of this.merge(free)) {
      for (
        let startAtMs = interval.startAtMs;
        startAtMs + durationMs <= interval.endAtMs;
        startAtMs = utcEpochMs(startAtMs + granularityMs)
      ) {
        slots.push({
          startAtMs,
          endAtMs: utcEpochMs(startAtMs + durationMs),
        });
      }
    }

    return slots;
  },
} satisfies IntervalOps;

export function createSchedulingEngine(input: {
  readonly busyIntervalSource: BusyIntervalSource;
  readonly intervalOps?: IntervalOps;
}): SchedulingEngine {
  const intervalOps = input.intervalOps ?? defaultIntervalOps;

  return {
    findExactSlots: async (request) =>
      planSchedule(request, input.busyIntervalSource, intervalOps).then(
        (plan) => plan.exactSlots,
      ),
    rankAlternatives: async (request) =>
      planSchedule(request, input.busyIntervalSource, intervalOps).then(
        (plan) => plan.rankedSlots,
      ),
    schedule: async (request) => {
      const plan = await planSchedule(request, input.busyIntervalSource, intervalOps);

      if (plan.exactSlots.length > 0) {
        return { kind: "exact", slots: plan.exactSlots };
      }

      if (plan.rankedSlots.length > 0) {
        return { kind: "alternatives", rankedSlots: plan.rankedSlots };
      }

      return { kind: "none", reason: plan.noneReason };
    },
  };
}

function validateProfileIds(
  profileIds: readonly ProfileId[],
): ScheduleRequestValidation {
  if (profileIds.length === 0) {
    return { kind: "invalid", code: "empty_profile_set" };
  }

  if (profileIds.length > SCHEDULE_REQUEST_LIMITS.maxProfileCount) {
    return { kind: "invalid", code: "too_many_profile_ids" };
  }

  const seenProfileIds = new Set<ProfileId>();

  for (const profileId of profileIds) {
    if (profileId.trim().length === 0) {
      return { kind: "invalid", code: "invalid_profile_id" };
    }

    if (seenProfileIds.has(profileId)) {
      return { kind: "invalid", code: "duplicate_profile_id" };
    }

    seenProfileIds.add(profileId);
  }

  return { kind: "valid" };
}

function assertValidInterval(
  interval: TimeInterval,
  code: "invalid_busy_interval" | "invalid_interval",
) {
  if (!isValidInterval(interval)) {
    throw new ScheduleEngineError(code, "interval start must be before interval end");
  }
}

function assertValidSlotConfiguration(
  durationMinutes: number,
  granularityMinutes: number,
) {
  if (!isPositiveInteger(durationMinutes) || !isPositiveInteger(granularityMinutes)) {
    throw new ScheduleEngineError(
      "invalid_slot_configuration",
      "duration and granularity must be positive integers",
    );
  }
}

function clipIntervalsToWindow(
  intervals: readonly TimeInterval[],
  window: TimeInterval,
) {
  const clippedIntervals: TimeInterval[] = [];

  for (const interval of intervals) {
    if (interval.endAtMs <= window.startAtMs || interval.startAtMs >= window.endAtMs) {
      continue;
    }

    clippedIntervals.push({
      startAtMs: utcEpochMs(Math.max(interval.startAtMs, window.startAtMs)),
      endAtMs: utcEpochMs(Math.min(interval.endAtMs, window.endAtMs)),
    });
  }

  return clippedIntervals;
}

function compareIntervals(left: TimeInterval, right: TimeInterval) {
  return left.startAtMs - right.startAtMs || left.endAtMs - right.endAtMs;
}

function intersectIntervals(left: TimeInterval, right: TimeInterval) {
  const startAtMs = utcEpochMs(Math.max(left.startAtMs, right.startAtMs));
  const endAtMs = utcEpochMs(Math.min(left.endAtMs, right.endAtMs));

  if (startAtMs >= endAtMs) {
    return null;
  }

  return { startAtMs, endAtMs };
}

type SchedulePlan = {
  readonly exactSlots: readonly TimeInterval[];
  readonly noneReason: NoScheduleReason;
  readonly rankedSlots: readonly ScoredSlot[];
};

async function planSchedule(
  request: ScheduleRequest,
  source: BusyIntervalSource,
  intervalOps: IntervalOps,
): Promise<SchedulePlan> {
  const validation = validateScheduleRequest(request);

  if (validation.kind === "invalid") {
    throw new ScheduleEngineError("invalid_request", validation.code);
  }

  const allCandidateSlots = intervalOps.slotify(
    [request.window],
    request.durationMinutes,
    request.granularityMinutes,
  );
  const busyIntervals = await source.fetchBusyIntervals({
    profileIds: request.requiredProfileIds,
    window: request.window,
  });
  const exactSlots = findExactSlots(
    request,
    busyIntervals,
    intervalOps,
  ).slice(0, request.maxExactSlotCount);

  return {
    exactSlots,
    noneReason: allCandidateSlots.length === 0 ? "window_too_small" : "no_candidate_slots",
    rankedSlots: rankCandidateSlots(
      allCandidateSlots,
      busyIntervals,
      request.maxAlternativeSlotCount,
    ),
  };
}

function findExactSlots(
  request: ScheduleRequest,
  busyIntervals: readonly BusyInterval[],
  intervalOps: IntervalOps,
) {
  const freeByProfile = request.requiredProfileIds.map((profileId) => {
    const busyForProfile = busyIntervals.filter(
      (interval) => interval.profileId === profileId,
    );

    return intervalOps.invert(busyForProfile, request.window);
  });

  return intervalOps.slotify(
    intervalOps.intersectAll(freeByProfile),
    request.durationMinutes,
    request.granularityMinutes,
  );
}

function rankCandidateSlots(
  candidateSlots: readonly TimeInterval[],
  busyIntervals: readonly BusyInterval[],
  limit: number,
) {
  return candidateSlots
    .map((slot) => scoreCandidateSlot(slot, busyIntervals))
    .sort(compareScoredSlots)
    .slice(0, limit);
}

function scoreCandidateSlot(
  slot: TimeInterval,
  busyIntervals: readonly BusyInterval[],
): ScoredSlot {
  const hardConflicts: HardScheduleConflict[] = [];
  const softConflicts: SoftScheduleConflict[] = [];

  for (const busyInterval of busyIntervals) {
    assertValidInterval(busyInterval, "invalid_busy_interval");

    if (!overlaps(slot, busyInterval)) {
      continue;
    }

    if (isHardBusyInterval(busyInterval)) {
      hardConflicts.push({ busyInterval });
    } else if (isSoftBusyInterval(busyInterval)) {
      softConflicts.push({ busyInterval });
    }
  }

  return {
    slot,
    hardConflicts,
    softConflicts,
    conflictCost:
      hardConflicts.length * HARD_CONFLICT_COST +
      softConflicts.reduce((sum, conflict) => sum + conflict.busyInterval.flexibility.moveCost, 0),
  };
}

function compareScoredSlots(left: ScoredSlot, right: ScoredSlot) {
  return (
    left.hardConflicts.length - right.hardConflicts.length ||
    left.conflictCost - right.conflictCost ||
    left.slot.startAtMs - right.slot.startAtMs
  );
}

function overlaps(left: TimeInterval, right: TimeInterval) {
  return left.startAtMs < right.endAtMs && left.endAtMs > right.startAtMs;
}

function isHardBusyInterval(interval: BusyInterval): interval is HardBusyInterval {
  return interval.flexibility.kind === "hard";
}

function isSoftBusyInterval(interval: BusyInterval): interval is SoftBusyInterval {
  return interval.flexibility.kind === "soft";
}

function isPositiveInteger(value: number) {
  return Number.isInteger(value) && value > 0;
}

function isValidInterval(interval: TimeInterval) {
  return (
    Number.isSafeInteger(interval.startAtMs) &&
    Number.isSafeInteger(interval.endAtMs) &&
    interval.startAtMs < interval.endAtMs
  );
}

function isValidTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch (error: unknown) {
    if (error instanceof RangeError) {
      return false;
    }

    throw error;
  }
}
