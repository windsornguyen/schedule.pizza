import { describe, expect, it } from "vitest";

import { evaluateBookingCodeAttemptLimit } from "./booking_code_attempts.server";

describe("booking code attempt limits", () => {
  it("allows the fifth wrong-code check to be recorded before blocking", () => {
    expect(evaluateBookingCodeAttemptLimit(4)).toEqual({ code: "allowed" });
    expect(evaluateBookingCodeAttemptLimit(5)).toEqual({
      code: "rate_limited",
    });
  });
});
