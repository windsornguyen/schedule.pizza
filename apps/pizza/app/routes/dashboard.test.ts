import { describe, expect, it } from "vitest";

import { parseCreateProfileForm } from "./dashboard";

describe("dashboard profile form parser", () => {
  it("normalizes valid profile setup input", () => {
    const formData = new FormData();
    formData.set("username", "Alice");
    formData.set("timezone", "America/Los_Angeles");
    formData.set("slotSizeMinutes", "30");

    expect(parseCreateProfileForm(formData)).toEqual({
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

    expect(parseCreateProfileForm(formData)).toEqual({
      code: "invalid_field",
      field: "slotSizeMinutes",
    });
  });

  it("rejects non-numeric slot size suffixes", () => {
    const formData = new FormData();
    formData.set("username", "alice");
    formData.set("timezone", "America/Los_Angeles");
    formData.set("slotSizeMinutes", "30abc");

    expect(parseCreateProfileForm(formData)).toEqual({
      code: "invalid_field",
      field: "slotSizeMinutes",
    });
  });

  it("trims valid time zones", () => {
    const formData = new FormData();
    formData.set("username", "alice");
    formData.set("timezone", " America/Los_Angeles ");
    formData.set("slotSizeMinutes", "30");

    expect(parseCreateProfileForm(formData)).toEqual({
      code: "parsed",
      username: "alice",
      timezone: "America/Los_Angeles",
      slotSizeMinutes: 30,
    });
  });
});
