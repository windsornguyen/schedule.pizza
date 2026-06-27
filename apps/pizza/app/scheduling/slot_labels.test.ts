import { describe, expect, it } from "vitest";

import { formatSlotLabel } from "./slot_labels";

describe("slot labels", () => {
  it("formats bookable slots in the host timezone", () => {
    expect(formatSlotLabel({
      start: "2026-06-26T16:00:00.000Z",
      end: "2026-06-26T16:30:00.000Z",
    }, "America/Los_Angeles")).toBe("Fri, Jun 26, 9:00 AM - 9:30 AM PDT");
  });

  it("rejects malformed slot timestamps", () => {
    expect(() => formatSlotLabel({
      start: "not a timestamp",
      end: "2026-06-26T16:30:00.000Z",
    }, "America/Los_Angeles")).toThrow("slot label input must be an ISO timestamp");
  });
});
