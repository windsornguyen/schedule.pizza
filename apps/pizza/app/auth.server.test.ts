import { describe, expect, it } from "vitest";

import { AuthConfigError, parseAdminUserIds, readRequiredAuthEnv } from "./auth.server";

describe("parseAdminUserIds", () => {
  it("accepts missing and blank admin bootstrap config", () => {
    expect(parseAdminUserIds(null)).toEqual([]);
    expect(parseAdminUserIds("  ")).toEqual([]);
  });

  it("normalizes comma-separated user IDs", () => {
    expect(parseAdminUserIds("user_1, user_2")).toEqual(["user_1", "user_2"]);
  });

  it("rejects empty entries", () => {
    expect(() => parseAdminUserIds("user_1,,user_2")).toThrow(AuthConfigError);
  });
});

describe("readRequiredAuthEnv", () => {
  it("returns trimmed auth env values", () => {
    expect(readRequiredAuthEnv(" https://schedule.pizza ", "BETTER_AUTH_URL")).toBe(
      "https://schedule.pizza"
    );
  });

  it("rejects missing auth env values", () => {
    expect(() => readRequiredAuthEnv(null, "BETTER_AUTH_SECRET")).toThrow(AuthConfigError);
    expect(() => readRequiredAuthEnv(" ", "BETTER_AUTH_SECRET")).toThrow(AuthConfigError);
  });
});
