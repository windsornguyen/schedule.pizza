import { describe, expect, it } from "vitest";

import {
  AuthConfigError,
  GOOGLE_OAUTH_SCOPES,
  parseAdminUserIds,
  readRequiredAuthEnv,
} from "./auth.server";
import {
  GOOGLE_CALENDAR_EVENTS_SCOPE,
  GOOGLE_CALENDAR_FREEBUSY_SCOPE,
} from "./calendar/google.server";

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

describe("GOOGLE_OAUTH_SCOPES", () => {
  it("requests only calendar scopes beyond Better Auth defaults", () => {
    expect(GOOGLE_OAUTH_SCOPES).toEqual([
      GOOGLE_CALENDAR_FREEBUSY_SCOPE,
      GOOGLE_CALENDAR_EVENTS_SCOPE,
    ]);
    expect(GOOGLE_OAUTH_SCOPES).not.toContain("email");
    expect(GOOGLE_OAUTH_SCOPES).not.toContain("profile");
    expect(GOOGLE_OAUTH_SCOPES).not.toContain("openid");
  });
});
