import { describe, expect, it } from "vitest";

import {
  evaluateBookingCodeAttemptLimit,
  evaluateBookingCodeSuccessLimit,
} from "./booking_code_attempts.server";

describe("booking code attempt limits", () => {
  it("allows the fifth wrong-code check to be recorded before blocking", () => {
    expect(evaluateBookingCodeAttemptLimit(4)).toEqual({ code: "allowed" });
    expect(evaluateBookingCodeAttemptLimit(5)).toEqual({
      code: "rate_limited",
    });
  });

  it("allows the 120th valid-code read before blocking", () => {
    expect(evaluateBookingCodeSuccessLimit(119)).toEqual({ code: "allowed" });
    expect(evaluateBookingCodeSuccessLimit(120)).toEqual({
      code: "rate_limited",
    });
  });
});
