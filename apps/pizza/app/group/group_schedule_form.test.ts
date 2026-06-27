import { describe, expect, it } from "vitest";

import { timeInterval } from "@/scheduling/engine";
import { defaultGroupScheduleFormValues } from "./group_schedule_values";
import {
  parseGroupScheduleForm,
  parseGroupScheduleParticipant,
} from "./group_schedule_form.server";

const now = new Date("2026-06-26T16:00:00.000Z");

describe("group schedule form parsing", () => {
  it("parses schedule.pizza links into participants", () => {
    expect(
      parseGroupScheduleParticipant(
        "schedule.pizza/Alice?code=moon tiger seven",
      ),
    ).toEqual({ user: "alice", code: "moon-tiger-seven" });
  });

  it("parses shorthand participant lines", () => {
    expect(parseGroupScheduleParticipant("Alice moon tiger seven")).toEqual({
      user: "alice",
      code: "moon-tiger-seven",
    });
  });

  it("rejects external links", () => {
    expect(
      parseGroupScheduleParticipant(
        "https://example.com/alice?code=moon-tiger-seven",
      ),
    ).toBeNull();
  });

  it("rejects non-http links", () => {
    expect(
      parseGroupScheduleParticipant(
        "ftp://schedule.pizza/alice?code=moon-tiger-seven",
      ),
    ).toBeNull();
  });

  it("reports malformed participant lines as invalid", () => {
    const formData = new FormData();
    formData.set("participants", "https://example.com/alice?code=moon-tiger-seven");

    expect(parseGroupScheduleForm(formData, now)).toEqual({
      code: "invalid_field",
      field: "participants",
      values: {
        ...defaultGroupScheduleFormValues(),
        participants: "https://example.com/alice?code=moon-tiger-seven",
      },
    });
  });

  it("builds the API schedule body with launch defaults", () => {
    const formData = new FormData();
    formData.set("participants", [
      "schedule.pizza/alice?code=moon-tiger-seven",
      "bob river lime harbor",
    ].join("\n"));

    expect(parseGroupScheduleForm(formData, now)).toEqual({
      code: "parsed",
      values: {
        ...defaultGroupScheduleFormValues(),
        participants: [
          "schedule.pizza/alice?code=moon-tiger-seven",
          "bob river lime harbor",
        ].join("\n"),
      },
      body: {
        participants: [
          { username: "alice", bookingCode: "moon-tiger-seven" },
          { username: "bob", bookingCode: "river-lime-harbor" },
        ],
        durationMinutes: 30,
        granularityMinutes: 15,
        maxExactSlotCount: 12,
        maxAlternativeSlotCount: 5,
        timeZone: "America/Los_Angeles",
        window: timeInterval({
          startAtMs: Date.parse("2026-06-26T16:00:00.000Z"),
          endAtMs: Date.parse("2026-07-10T16:00:00.000Z"),
        }),
      },
    });
  });

  it("rejects malformed duration before booking-code authorization", () => {
    const formData = new FormData();
    formData.set("participants", "alice moon tiger seven");
    formData.set("durationMinutes", "lol");

    expect(parseGroupScheduleForm(formData, now)).toEqual({
      code: "invalid_field",
      field: "durationMinutes",
      values: {
        ...defaultGroupScheduleFormValues(),
        durationMinutes: "lol",
        participants: "alice moon tiger seven",
      },
    });
  });
});
