import { beforeEach, describe, expect, it, vi } from "vitest";

import type * as bookingFunctions from "@/db/functions/bookings.server";
import {
  executeScheduleRequest,
  parseScheduleBody,
} from "./v1_schedule";

type AsyncMock = (...args: unknown[]) => Promise<unknown>;
type ReadCalendarIdMock = (calendarId: string | null) => string;

const mocks = vi.hoisted(() => ({
  authorizeBookingCode: vi.fn<AsyncMock>(),
  expireStalePendingCalendarBookingsForHost: vi.fn<AsyncMock>(),
  findBlockingBookingsForHost: vi.fn<AsyncMock>(),
  listGoogleFreeBusyIntervals: vi.fn<AsyncMock>(),
  readGoogleCalendarAccess: vi.fn<AsyncMock>(),
  readGoogleCalendarId: vi.fn<ReadCalendarIdMock>((calendarId) =>
    calendarId === null ? "primary" : calendarId,
  ),
}));

vi.mock("@/calendar/google.server", () => ({
  listGoogleFreeBusyIntervals: mocks.listGoogleFreeBusyIntervals,
  readGoogleCalendarAccess: mocks.readGoogleCalendarAccess,
  readGoogleCalendarId: mocks.readGoogleCalendarId,
}));

vi.mock("@/db/functions/booking_code_authorizations.server", () => ({
  authorizeBookingCode: mocks.authorizeBookingCode,
}));

vi.mock("@/db/functions/bookings.server", async (importOriginal) => {
  const original = await importOriginal<typeof bookingFunctions>();

  return {
    ...original,
    expireStalePendingCalendarBookingsForHost:
      mocks.expireStalePendingCalendarBookingsForHost,
    findBlockingBookingsForHost: mocks.findBlockingBookingsForHost,
  };
});

const now = new Date("2026-06-26T15:00:00.000Z");
const db = {} as Parameters<typeof executeScheduleRequest>[0];

describe("executeScheduleRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorizeBookingCode.mockResolvedValue({
      code: "authorized",
      access: {
        code: { id: "booking_code_1" },
        host: {
          authUserId: "auth_user_1",
          calendarAccountEmail: "alice@example.com",
          calendarId: "primary",
          id: "host_1",
          username: "alice",
        },
      },
    });
    mocks.expireStalePendingCalendarBookingsForHost.mockResolvedValue(undefined);
    mocks.findBlockingBookingsForHost.mockResolvedValue([]);
    mocks.listGoogleFreeBusyIntervals.mockResolvedValue({
      code: "listed",
      busy: [],
    });
    mocks.readGoogleCalendarAccess.mockResolvedValue({
      code: "authorized",
      accessToken: "google_access_token",
    });
  });

  it("expires stale pending reservations before multi-party busy reads", async () => {
    const parsed = parseScheduleBody({
      participants: [{ url: "schedule.pizza/alice?code=moon-tiger-seven" }],
      durationMinutes: 30,
      granularityMinutes: 15,
      maxExactSlotCount: 2,
      maxAlternativeSlotCount: 2,
      timeZone: "America/Los_Angeles",
      window: {
        start: "2026-06-26T16:00:00.000Z",
        end: "2026-06-26T18:00:00.000Z",
      },
    });

    if (parsed.code !== "parsed") {
      throw new Error("expected schedule body to parse");
    }

    await expect(executeScheduleRequest(db, {
      body: parsed.body,
      env: {
        DB: {} as D1Database,
        GOOGLE_CLIENT_ID: "google_client_id",
        GOOGLE_CLIENT_SECRET: "google_client_secret",
      } as Parameters<typeof executeScheduleRequest>[1]["env"],
      ipHash: "ip_hash",
      now,
    })).resolves.toMatchObject({ code: "scheduled" });

    expect(mocks.expireStalePendingCalendarBookingsForHost).toHaveBeenCalledWith(db, {
      expiredAt: now,
      expiresBefore: new Date("2026-06-26T14:45:00.000Z"),
      hostId: "host_1",
    });
    expect(
      mocks.expireStalePendingCalendarBookingsForHost.mock.invocationCallOrder[0],
    ).toBeLessThan(mocks.findBlockingBookingsForHost.mock.invocationCallOrder[0] ?? 0);
  });
});
