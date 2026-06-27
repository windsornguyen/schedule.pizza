import { describe, expect, it } from "vitest";

import {
  parseScheduleBody,
  serializeScheduleResult,
} from "./v1_schedule";
import { timeInterval } from "@/scheduling/engine";
import type { ScheduleResult } from "@/scheduling/engine";

describe("schedule API body parser", () => {
  it("parses the agent scheduling request shape", () => {
    expect(parseScheduleBody({
      participants: [
        { user: "Alice", code: "moon tiger seven" },
        { user: "bob", code: "river-lime" },
      ],
      durationMinutes: 30,
      granularityMinutes: 15,
      maxExactSlotCount: 10,
      maxAlternativeSlotCount: 5,
      timeZone: "America/Los_Angeles",
      window: {
        start: "2026-06-26T16:00:00.000Z",
        end: "2026-06-26T18:00:00.000Z",
      },
    })).toEqual({
      code: "parsed",
      body: {
        participants: [
          { username: "alice", bookingCode: "moon-tiger-seven" },
          { username: "bob", bookingCode: "river-lime" },
        ],
        durationMinutes: 30,
        granularityMinutes: 15,
        maxExactSlotCount: 10,
        maxAlternativeSlotCount: 5,
        timeZone: "America/Los_Angeles",
        window: interval("2026-06-26T16:00:00.000Z", "2026-06-26T18:00:00.000Z"),
      },
    });
  });

  it("rejects missing participants before booking-code authorization", () => {
    expect(parseScheduleBody({
      durationMinutes: 30,
      granularityMinutes: 15,
      maxExactSlotCount: 10,
      maxAlternativeSlotCount: 5,
      timeZone: "America/Los_Angeles",
      window: {
        start: "2026-06-26T16:00:00.000Z",
        end: "2026-06-26T18:00:00.000Z",
      },
    })).toEqual({ code: "missing_field", field: "participants" });
  });

  it("rejects missing numeric limits before booking-code authorization", () => {
    expect(parseScheduleBody({
      participants: [
        { user: "Alice", code: "moon tiger seven" },
      ],
      granularityMinutes: 15,
      maxExactSlotCount: 10,
      maxAlternativeSlotCount: 5,
      timeZone: "America/Los_Angeles",
      window: {
        start: "2026-06-26T16:00:00.000Z",
        end: "2026-06-26T18:00:00.000Z",
      },
    })).toEqual({ code: "missing_field", field: "durationMinutes" });
  });

  it("rejects malformed numeric limits before booking-code authorization", () => {
    expect(parseScheduleBody({
      participants: [
        { user: "Alice", code: "moon tiger seven" },
      ],
      durationMinutes: 0,
      granularityMinutes: 15,
      maxExactSlotCount: 10,
      maxAlternativeSlotCount: 5,
      timeZone: "America/Los_Angeles",
      window: {
        start: "2026-06-26T16:00:00.000Z",
        end: "2026-06-26T18:00:00.000Z",
      },
    })).toEqual({ code: "invalid_field", field: "durationMinutes" });
  });

  it("rejects malformed time zones before booking-code authorization", () => {
    expect(parseScheduleBody({
      participants: [
        { user: "Alice", code: "moon tiger seven" },
      ],
      durationMinutes: 30,
      granularityMinutes: 15,
      maxExactSlotCount: 10,
      maxAlternativeSlotCount: 5,
      timeZone: "Mars/Olympus_Mons",
      window: {
        start: "2026-06-26T16:00:00.000Z",
        end: "2026-06-26T18:00:00.000Z",
      },
    })).toEqual({ code: "invalid_field", field: "timeZone" });
  });

  it("rejects duplicate participants before booking-code authorization", () => {
    expect(parseScheduleBody({
      participants: [
        { user: "Alice", code: "moon tiger seven" },
        { user: "alice", code: "river-lime" },
      ],
      durationMinutes: 30,
      granularityMinutes: 15,
      maxExactSlotCount: 10,
      maxAlternativeSlotCount: 5,
      timeZone: "America/Los_Angeles",
      window: {
        start: "2026-06-26T16:00:00.000Z",
        end: "2026-06-26T18:00:00.000Z",
      },
    })).toEqual({ code: "invalid_field", field: "participants" });
  });

  it("rejects too many participants before booking-code authorization", () => {
    expect(parseScheduleBody({
      participants: [
        { user: "user1", code: "moon tiger seven" },
        { user: "user2", code: "moon tiger seven" },
        { user: "user3", code: "moon tiger seven" },
        { user: "user4", code: "moon tiger seven" },
        { user: "user5", code: "moon tiger seven" },
        { user: "user6", code: "moon tiger seven" },
        { user: "user7", code: "moon tiger seven" },
        { user: "user8", code: "moon tiger seven" },
        { user: "user9", code: "moon tiger seven" },
      ],
      durationMinutes: 30,
      granularityMinutes: 15,
      maxExactSlotCount: 10,
      maxAlternativeSlotCount: 5,
      timeZone: "America/Los_Angeles",
      window: {
        start: "2026-06-26T16:00:00.000Z",
        end: "2026-06-26T18:00:00.000Z",
      },
    })).toEqual({ code: "invalid_field", field: "participants" });
  });

  it("rejects oversized slot limits before booking-code authorization", () => {
    expect(parseScheduleBody({
      participants: [
        { user: "Alice", code: "moon tiger seven" },
      ],
      durationMinutes: 30,
      granularityMinutes: 15,
      maxExactSlotCount: 101,
      maxAlternativeSlotCount: 5,
      timeZone: "America/Los_Angeles",
      window: {
        start: "2026-06-26T16:00:00.000Z",
        end: "2026-06-26T18:00:00.000Z",
      },
    })).toEqual({ code: "invalid_field", field: "maxExactSlotCount" });
  });

  it("rejects oversized windows before booking-code authorization", () => {
    expect(parseScheduleBody({
      participants: [
        { user: "Alice", code: "moon tiger seven" },
      ],
      durationMinutes: 30,
      granularityMinutes: 15,
      maxExactSlotCount: 10,
      maxAlternativeSlotCount: 5,
      timeZone: "America/Los_Angeles",
      window: {
        start: "2026-06-01T00:00:00.000Z",
        end: "2026-07-03T00:00:00.000Z",
      },
    })).toEqual({ code: "invalid_field", field: "window" });
  });

  it("rejects ambiguous windows before booking-code authorization", () => {
    expect(parseScheduleBody({
      participants: [
        { user: "Alice", code: "moon tiger seven" },
      ],
      durationMinutes: 30,
      granularityMinutes: 15,
      maxExactSlotCount: 10,
      maxAlternativeSlotCount: 5,
      timeZone: "America/Los_Angeles",
      window: {
        start: "2026-06-26",
        end: "2026-06-26T18:00:00",
      },
    })).toEqual({ code: "invalid_field", field: "window" });
  });
});

describe("schedule API serializer", () => {
  it("serializes conflicts without exposing booking event ids", () => {
    const result = {
      kind: "alternatives",
      rankedSlots: [
        {
          slot: interval("2026-06-26T16:00:00.000Z", "2026-06-26T16:30:00.000Z"),
          conflictCost: 1_000,
          hardConflicts: [
            {
              busyInterval: {
                ...interval("2026-06-26T16:00:00.000Z", "2026-06-26T17:00:00.000Z"),
                profileId: "host_alice",
                eventId: "booking_secret",
                flexibility: { kind: "hard" },
              },
            },
          ],
          softConflicts: [],
        },
      ],
    } satisfies ScheduleResult;

    expect(serializeScheduleResult(result, [
      {
        authUserId: "user_alice",
        bookingCodeId: "code_alice",
        calendarAccountEmail: "alice@example.com",
        calendarId: "primary",
        hostId: "host_alice",
        username: "alice",
      },
    ])).toEqual({
      kind: "alternatives",
      slots: [
        {
          slot: {
            start: "2026-06-26T16:00:00.000Z",
            end: "2026-06-26T16:30:00.000Z",
          },
          conflictCost: 1_000,
          hardConflicts: [
            {
              user: "alice",
              interval: {
                start: "2026-06-26T16:00:00.000Z",
                end: "2026-06-26T17:00:00.000Z",
              },
            },
          ],
          softConflicts: [],
        },
      ],
    });
  });
});

function interval(start: string, end: string) {
  return timeInterval({
    startAtMs: Date.parse(start),
    endAtMs: Date.parse(end),
  });
}
