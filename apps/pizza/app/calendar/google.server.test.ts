import { describe, expect, it } from "vitest";

import {
  GOOGLE_CALENDAR_EVENTS_SCOPE,
  GOOGLE_CALENDAR_FREEBUSY_SCOPE,
  createGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  hasGoogleCalendarScope,
  listGoogleFreeBusyIntervals,
  refreshGoogleAccessToken,
} from "./google.server";
import { timeInterval } from "@/scheduling/engine";

describe("google calendar scopes", () => {
  it("accepts the narrow scopes required by schedule.pizza", () => {
    expect(hasGoogleCalendarScope(GOOGLE_CALENDAR_FREEBUSY_SCOPE, "availability"))
      .toBe(true);
    expect(hasGoogleCalendarScope(GOOGLE_CALENDAR_EVENTS_SCOPE, "event_write"))
      .toBe(true);
  });

  it("accepts Better Auth comma-separated stored scopes", () => {
    expect(hasGoogleCalendarScope(
      `email,profile,${GOOGLE_CALENDAR_EVENTS_SCOPE}`,
      "event_write",
    )).toBe(true);
  });

  it("does not treat read-only calendar access as event-write access", () => {
    expect(hasGoogleCalendarScope(
      "https://www.googleapis.com/auth/calendar.readonly",
      "event_write",
    )).toBe(false);
  });
});

describe("refreshGoogleAccessToken", () => {
  it("parses a refreshed access token", async () => {
    const refreshed = await refreshGoogleAccessToken({
      clientId: "client_id",
      clientSecret: "client_secret",
      refreshToken: "refresh_token",
      now: new Date("2026-06-26T16:00:00.000Z"),
      fetcher: async (_input: string, init: RequestInit) => {
        expect(init.method).toBe("POST");
        expect(init.body).toBeInstanceOf(URLSearchParams);

        return Response.json({
          access_token: "access_token",
          expires_in: 3600,
          scope: GOOGLE_CALENDAR_EVENTS_SCOPE,
        });
      },
    });

    expect(refreshed).toEqual({
      code: "refreshed",
      accessToken: "access_token",
      expiresAt: new Date("2026-06-26T17:00:00.000Z"),
      refreshToken: null,
      scope: GOOGLE_CALENDAR_EVENTS_SCOPE,
    });
  });
});

describe("listGoogleFreeBusyIntervals", () => {
  it("maps google busy intervals into scheduler intervals", async () => {
    const result = await listGoogleFreeBusyIntervals({
      accessToken: "access_token",
      calendarId: "primary",
      timeZone: "UTC",
      window: interval("2026-06-26T16:00:00.000Z", "2026-06-26T18:00:00.000Z"),
      fetcher: async (_input: string, init: RequestInit) => {
        expect(init.method).toBe("POST");

        return Response.json({
          calendars: {
            primary: {
              busy: [
                {
                  start: "2026-06-26T16:30:00.000Z",
                  end: "2026-06-26T17:00:00.000Z",
                },
              ],
            },
          },
        });
      },
    });

    expect(result).toEqual({
      code: "listed",
      busy: [interval("2026-06-26T16:30:00.000Z", "2026-06-26T17:00:00.000Z")],
    });
  });
});

describe("createGoogleCalendarEvent", () => {
  it("creates a google event with the guest as an attendee", async () => {
    const result = await createGoogleCalendarEvent({
      accessToken: "access_token",
      calendarId: "primary",
      startAt: new Date("2026-06-26T16:00:00.000Z"),
      endAt: new Date("2026-06-26T16:30:00.000Z"),
      guestEmail: "ada@example.com",
      guestName: "Ada",
      timeZone: "America/Los_Angeles",
      fetcher: async (input: string, init: RequestInit) => {
        expect(input).toContain("sendUpdates=all");
        expect(init.method).toBe("POST");
        expect(JSON.parse(String(init.body))).toMatchObject({
          attendees: [{ displayName: "Ada", email: "ada@example.com" }],
          summary: "schedule.pizza: Ada",
        });

        return Response.json({ id: "google_event_1" });
      },
    });

    expect(result).toEqual({ code: "created", eventId: "google_event_1" });
  });
});

describe("deleteGoogleCalendarEvent", () => {
  it("deletes a Google event and asks Google to notify guests", async () => {
    const result = await deleteGoogleCalendarEvent({
      accessToken: "access_token",
      calendarId: "primary",
      eventId: "google_event_1",
      notifyGuests: true,
      fetcher: async (input: string, init: RequestInit) => {
        expect(input).toContain("/calendars/primary/events/google_event_1");
        expect(input).toContain("sendUpdates=all");
        expect(init.method).toBe("DELETE");

        return new Response(null, { status: 204 });
      },
    });

    expect(result).toEqual({ code: "deleted" });
  });
});

function interval(start: string, end: string) {
  return timeInterval({
    startAtMs: Date.parse(start),
    endAtMs: Date.parse(end),
  });
}
