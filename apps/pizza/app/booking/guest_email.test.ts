import { describe, expect, it } from "vitest";

import { parseOptionalGuestEmail } from "./guest_email";

describe("guest email parsing", () => {
  it("normalizes valid guest emails", () => {
    expect(parseOptionalGuestEmail(" Ada@Example.COM ")).toEqual({
      code: "parsed",
      normalized: "ada@example.com",
      value: "Ada@Example.COM",
    });
  });

  it("treats omitted and blank emails as absent", () => {
    expect(parseOptionalGuestEmail(undefined)).toEqual({
      code: "parsed",
      normalized: null,
      value: null,
    });
    expect(parseOptionalGuestEmail(" ")).toEqual({
      code: "parsed",
      normalized: null,
      value: null,
    });
  });

  it("rejects malformed guest emails", () => {
    expect(parseOptionalGuestEmail("ada")).toEqual({ code: "invalid" });
    expect(parseOptionalGuestEmail("ada example.com")).toEqual({ code: "invalid" });
    expect(parseOptionalGuestEmail(7)).toEqual({ code: "invalid" });
  });
});
