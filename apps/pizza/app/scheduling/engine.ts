/**
 * Scheduling engine contract.
 *
 * This module defines the backend scheduling boundary shared by HTTP, CLI, and
 * future calendar-provider implementations. The contract is deliberately
 * serializable: callers parse external inputs before this boundary and receive
 * candidate slots, not booking writes.
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

export type ScheduleConflict = HardScheduleConflict | SoftScheduleConflict;

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

export type ScheduleEngineErrorCode =
  | "busy_interval_source_failed"
  | "invalid_duration"
  | "invalid_granularity"
  | "invalid_instant"
  | "invalid_interval"
  | "invalid_limit"
  | "invalid_profile_set"
  | "invalid_time_zone";

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
      "utc epoch milliseconds must be a safe integer",
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
