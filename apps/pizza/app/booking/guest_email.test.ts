import { describe, expect, it } from "vitest";

import { parseRequiredGuestEmail } from "./guest_email";

describe("guest email parsing", () => {
  it("normalizes valid guest emails", () => {
    expect(parseRequiredGuestEmail(" Ada@Example.COM ")).toEqual({
      code: "parsed",
      normalized: "ada@example.com",
      value: "Ada@Example.COM",
    });
  });

  it("rejects omitted and blank emails as missing", () => {
    expect(parseRequiredGuestEmail(undefined)).toEqual({ code: "missing" });
    expect(parseRequiredGuestEmail(" ")).toEqual({ code: "missing" });
  });

  it("rejects malformed guest emails", () => {
    expect(parseRequiredGuestEmail("ada")).toEqual({ code: "invalid" });
    expect(parseRequiredGuestEmail("ada example.com")).toEqual({ code: "invalid" });
    expect(parseRequiredGuestEmail(7)).toEqual({ code: "invalid" });
  });
});
