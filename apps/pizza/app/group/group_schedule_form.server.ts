/**
 * Human form parsing for group scheduling.
 *
 * The public API accepts a structured JSON body. This module owns the smaller
 * human boundary: pasted schedule.pizza links or `username code` lines become
 * the same typed request body used by agents.
 */

import {
  parseScheduleBody,
  type ParsedScheduleBody,
} from "@/api/v1_schedule";
import { normalizeBookingCode } from "@/db/functions/booking_codes.server";
import { normalizeUsername } from "@/db/functions/host_profiles.server";
import {
  DEFAULT_GROUP_DURATION_MINUTES,
  DEFAULT_GROUP_GRANULARITY_MINUTES,
  DEFAULT_GROUP_TIME_ZONE,
  type GroupScheduleFormValues,
} from "./group_schedule_values";

const DEFAULT_WINDOW_DAYS = 14;

type GroupScheduleFormParseResult =
  | {
      readonly body: ParsedScheduleBody;
      readonly code: "parsed";
      readonly values: GroupScheduleFormValues;
    }
  | {
      readonly code: "invalid_field" | "missing_field";
      readonly field: string;
      readonly values: GroupScheduleFormValues;
    };

type ScheduleParticipantInput = {
  readonly code: string;
  readonly user: string;
};

type GroupScheduleParticipantsParseResult =
  | {
      readonly code: "parsed";
      readonly participants: readonly ScheduleParticipantInput[];
    }
  | { readonly code: "invalid_field" | "missing_field" };

export function parseGroupScheduleForm(
  formData: FormData,
  now: Date,
): GroupScheduleFormParseResult {
  const values = readGroupScheduleFormValues(formData);
  const participants = parseGroupScheduleParticipants(values.participants);
  const durationMinutes = parseFormInteger(values.durationMinutes);
  const granularityMinutes = parseFormInteger(values.granularityMinutes);

  if (participants.code !== "parsed") {
    return { code: participants.code, field: "participants", values };
  }

  if (durationMinutes === null) {
    return { code: "invalid_field", field: "durationMinutes", values };
  }

  if (granularityMinutes === null) {
    return { code: "invalid_field", field: "granularityMinutes", values };
  }

  const body = {
    durationMinutes,
    granularityMinutes,
    maxAlternativeSlotCount: 5,
    maxExactSlotCount: 12,
    participants: participants.participants,
    timeZone: values.timeZone.trim(),
    window: {
      start: now.toISOString(),
      end: addUtcDays(now, DEFAULT_WINDOW_DAYS).toISOString(),
    },
  };
  const parsed = parseScheduleBody(body);

  if (parsed.code !== "parsed") {
    return { ...parsed, values };
  }

  return { code: "parsed", body: parsed.body, values };
}

export function parseGroupScheduleParticipant(
  value: string,
): ScheduleParticipantInput | null {
  return parseScheduleLink(value) ?? parseParticipantLine(value);
}

function readGroupScheduleFormValues(
  formData: FormData,
): GroupScheduleFormValues {
  return {
    durationMinutes: readFormString(formData, "durationMinutes", DEFAULT_GROUP_DURATION_MINUTES),
    granularityMinutes: readFormString(formData, "granularityMinutes", DEFAULT_GROUP_GRANULARITY_MINUTES),
    participants: readFormString(formData, "participants", ""),
    timeZone: readFormString(formData, "timeZone", DEFAULT_GROUP_TIME_ZONE),
  };
}

function parseGroupScheduleParticipants(
  value: string,
): GroupScheduleParticipantsParseResult {
  const lines = value
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line !== "");

  if (lines.length === 0) {
    return { code: "missing_field" };
  }

  const participants: ScheduleParticipantInput[] = [];

  for (const line of lines) {
    const participant = parseGroupScheduleParticipant(line);

    if (participant === null) {
      return { code: "invalid_field" };
    }

    participants.push(participant);
  }

  return { code: "parsed", participants };
}

function parseScheduleLink(value: string): ScheduleParticipantInput | null {
  const parsedUrl = parseScheduleUrl(value);

  if (parsedUrl === null) {
    return null;
  }

  const pathParts = parsedUrl.pathname.split("/").filter((part) => part !== "");
  const rawUser = pathParts[0];
  const rawCode = parsedUrl.searchParams.get("code");

  if (rawUser === undefined || pathParts.length !== 1 || rawCode === null) {
    return null;
  }

  const user = normalizeUsername(rawUser);
  const code = normalizeBookingCode(rawCode);

  return user === null || code === null ? null : { user, code };
}

function parseScheduleUrl(value: string): URL | null {
  const normalizedValue = value.trim();

  try {
    const url = new URL(
      /^[a-z][a-z0-9+.-]*:/iu.test(normalizedValue)
        ? normalizedValue
        : `https://${normalizedValue}`,
    );

    return url.hostname === "schedule.pizza" ||
      url.hostname === "www.schedule.pizza"
      ? url
      : null;
  } catch {
    return null;
  }
}

function parseParticipantLine(value: string): ScheduleParticipantInput | null {
  const [rawUser, ...rawCodeParts] = value.trim().split(/\s+/u);

  if (rawUser === undefined || rawCodeParts.length === 0) {
    return null;
  }

  const user = normalizeUsername(rawUser);
  const code = normalizeBookingCode(rawCodeParts.join("-"));

  return user === null || code === null ? null : { user, code };
}

function readFormString(
  formData: FormData,
  key: keyof GroupScheduleFormValues,
  fallback: string,
) {
  const value = formData.get(key);

  return typeof value === "string" ? value : fallback;
}

function parseFormInteger(value: string) {
  const trimmedValue = value.trim();

  return /^\d+$/u.test(trimmedValue) ? Number.parseInt(trimmedValue, 10) : null;
}

function addUtcDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1_000);
}
