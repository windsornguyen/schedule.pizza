import { describe, expect, it } from "vitest";

import { parseOptionalGuestTimezone } from "./guest_timezone";

describe("parseOptionalGuestTimezone", () => {
  it("accepts IANA time zones", () => {
    expect(parseOptionalGuestTimezone("America/Los_Angeles")).toEqual({
      code: "parsed",
      value: "America/Los_Angeles",
    });
  });

  it("treats omitted and blank time zones as unset", () => {
    expect(parseOptionalGuestTimezone(undefined)).toEqual({
      code: "parsed",
      value: null,
    });
    expect(parseOptionalGuestTimezone(" ")).toEqual({
      code: "parsed",
      value: null,
    });
  });

  it("rejects malformed time zones", () => {
    expect(parseOptionalGuestTimezone("Mars/Olympus_Mons")).toEqual({
      code: "invalid",
    });
    expect(parseOptionalGuestTimezone(7)).toEqual({ code: "invalid" });
  });
});
