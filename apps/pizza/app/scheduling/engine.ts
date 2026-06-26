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
  | "invalid_window";

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

export type ScheduleEngineErrorCode =
  | "busy_interval_source_failed"
  | "invalid_instant"
  | "invalid_interval";

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

  if (!isPositiveInteger(request.durationMinutes)) {
    return { kind: "invalid", code: "invalid_duration_minutes" };
  }

  if (!isPositiveInteger(request.granularityMinutes)) {
    return { kind: "invalid", code: "invalid_granularity_minutes" };
  }

  if (!isPositiveInteger(request.maxExactSlotCount)) {
    return { kind: "invalid", code: "invalid_exact_slot_limit" };
  }

  if (!isPositiveInteger(request.maxAlternativeSlotCount)) {
    return { kind: "invalid", code: "invalid_alternative_slot_limit" };
  }

  if (!isValidInterval(request.window)) {
    return { kind: "invalid", code: "invalid_window" };
  }

  if (!isValidTimeZone(request.timeZone)) {
    return { kind: "invalid", code: "invalid_time_zone" };
  }

  return { kind: "valid" };
}

function validateProfileIds(
  profileIds: readonly ProfileId[],
): ScheduleRequestValidation {
  if (profileIds.length === 0) {
    return { kind: "invalid", code: "empty_profile_set" };
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
