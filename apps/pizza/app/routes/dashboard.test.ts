import { describe, expect, it } from "vitest";

import {
  parseProfileForm,
  readDefaultUsernameFromEmail,
} from "@/dashboard/profile_form";
import { formatDashboardBookingUrl } from "./dashboard";

describe("dashboard profile form parser", () => {
  it("normalizes valid profile setup input", () => {
    const formData = new FormData();
    formData.set("username", "Alice");
    formData.set("timezone", "America/Los_Angeles");
    formData.set("slotSizeMinutes", "30");

    expect(parseProfileForm(formData)).toEqual({
      code: "parsed",
      username: "alice",
      timezone: "America/Los_Angeles",
      slotSizeMinutes: 30,
    });
  });

  it("rejects unsupported slot sizes", () => {
    const formData = new FormData();
    formData.set("username", "alice");
    formData.set("timezone", "America/Los_Angeles");
    formData.set("slotSizeMinutes", "17");

    expect(parseProfileForm(formData)).toEqual({
      code: "invalid_field",
      field: "slotSizeMinutes",
    });
  });

  it("rejects non-numeric slot size suffixes", () => {
    const formData = new FormData();
    formData.set("username", "alice");
    formData.set("timezone", "America/Los_Angeles");
    formData.set("slotSizeMinutes", "30abc");

    expect(parseProfileForm(formData)).toEqual({
      code: "invalid_field",
      field: "slotSizeMinutes",
    });
  });

  it("trims valid time zones", () => {
    const formData = new FormData();
    formData.set("username", "alice");
    formData.set("timezone", " America/Los_Angeles ");
    formData.set("slotSizeMinutes", "30");

    expect(parseProfileForm(formData)).toEqual({
      code: "parsed",
      username: "alice",
      timezone: "America/Los_Angeles",
      slotSizeMinutes: 30,
    });
  });

  it("derives a username default from the signed-in email", () => {
    expect(readDefaultUsernameFromEmail("Alice.Example+demo@example.com")).toBe(
      "alice-example-demo",
    );
  });

  it("drops unusable default usernames", () => {
    expect(readDefaultUsernameFromEmail("++@example.com")).toBe("");
  });

  it("formats the dashboard share link as an absolute schedule.pizza URL", () => {
    expect(formatDashboardBookingUrl({
      bookingCode: "moon-tiger-seven",
      username: "alice",
    })).toBe("https://schedule.pizza/alice?code=moon-tiger-seven");
  });
});
