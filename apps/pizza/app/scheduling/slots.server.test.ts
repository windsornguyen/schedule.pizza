import { describe, expect, it } from "vitest";

import {
  listDefaultCandidateSlots,
  parseSlotStart,
  removeBookedSlots,
  serializeSlot,
} from "./slots.server";

describe("default slots", () => {
  it("returns future weekday slots at the host slot size", () => {
    const slots = listDefaultCandidateSlots({
      now: new Date("2026-06-26T15:15:00.000Z"),
      slotSizeMinutes: 30,
      timeZone: "America/Los_Angeles",
    });

    expect(slots.map(serializeSlot).slice(0, 3)).toEqual([
      {
        start: "2026-06-26T16:00:00.000Z",
        end: "2026-06-26T16:30:00.000Z",
      },
      {
        start: "2026-06-26T16:30:00.000Z",
        end: "2026-06-26T17:00:00.000Z",
      },
      {
        start: "2026-06-26T17:00:00.000Z",
        end: "2026-06-26T17:30:00.000Z",
      },
    ]);
  });

  it("rejects invalid slot configuration instead of hiding it as no availability", () => {
    expect(() =>
      listDefaultCandidateSlots({
        now: new Date("2026-06-26T15:15:00.000Z"),
        slotSizeMinutes: 0,
        timeZone: "America/Los_Angeles",
      }),
    ).toThrow("invalid slot configuration");
  });

  it("removes slots that overlap confirmed bookings", () => {
    const slots = [
      {
        startAt: new Date("2026-06-26T16:00:00.000Z"),
        endAt: new Date("2026-06-26T16:30:00.000Z"),
      },
    ];

    const available = removeBookedSlots(slots, [
      {
        slotStartAt: new Date("2026-06-26T16:15:00.000Z"),
        slotEndAt: new Date("2026-06-26T16:45:00.000Z"),
      },
    ]);

    expect(available).toEqual([]);
  });

  it("parses serialized UTC slot starts", () => {
    expect(parseSlotStart("2026-06-26T16:00:00.000Z")).toEqual(
      new Date("2026-06-26T16:00:00.000Z"),
    );
  });

  it("rejects ambiguous slot starts", () => {
    expect(parseSlotStart("2026-06-26")).toBeNull();
    expect(parseSlotStart("2026-06-26T16:00:00")).toBeNull();
    expect(parseSlotStart("not a time")).toBeNull();
  });
});
