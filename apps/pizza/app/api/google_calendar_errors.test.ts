import { describe, expect, it } from "vitest";

import { readGoogleCalendarErrorMessage } from "./google_calendar_errors";

describe("google calendar API error messages", () => {
  it("tells callers to reconnect when Google auth state is stale", () => {
    expect(readGoogleCalendarErrorMessage("google_calendar_scope_missing")).toBe(
      "Reconnect Google Calendar.",
    );
  });

  it("keeps upstream calendar failures distinct from reconnectable auth state", () => {
    expect(readGoogleCalendarErrorMessage("google_freebusy_failed")).toBe(
      "Google Calendar is unavailable.",
    );
  });
});
