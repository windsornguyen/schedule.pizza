import { beforeEach, describe, expect, it, vi } from "vitest";

import type * as bookingFunctions from "@/db/functions/bookings.server";
import { listHostAvailableSlots } from "./host_availability.server";

type AsyncMock = (...args: unknown[]) => Promise<unknown>;
type ReadCalendarIdMock = (calendarId: string | null) => string;

const mocks = vi.hoisted(() => ({
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
const db = {} as Parameters<typeof listHostAvailableSlots>[0];

describe("listHostAvailableSlots", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it("expires stale pending calendar reservations before listing slots", async () => {
    const slots = [{
      startAt: new Date("2026-06-26T16:00:00.000Z"),
      endAt: new Date("2026-06-26T16:30:00.000Z"),
    }];

    await expect(listHostAvailableSlots(db, {
      candidateSlots: slots,
      env: {
        DB: {} as D1Database,
        GOOGLE_CLIENT_ID: "google_client_id",
        GOOGLE_CLIENT_SECRET: "google_client_secret",
      } as Parameters<typeof listHostAvailableSlots>[1]["env"],
      host: {
        authUserId: "auth_user_1",
        calendarId: "primary",
        id: "host_1",
        timezone: "America/Los_Angeles",
      },
      now,
      window: {
        startsAt: new Date("2026-06-26T16:00:00.000Z"),
        endsAt: new Date("2026-06-26T18:00:00.000Z"),
      },
    })).resolves.toEqual({ code: "listed", slots });

    expect(mocks.expireStalePendingCalendarBookingsForHost).toHaveBeenCalledWith(db, {
      expiredAt: now,
      expiresBefore: new Date("2026-06-26T14:45:00.000Z"),
      hostId: "host_1",
    });
    expect(
      mocks.expireStalePendingCalendarBookingsForHost.mock.invocationCallOrder[0],
    ).toBeLessThan(mocks.readGoogleCalendarAccess.mock.invocationCallOrder[0] ?? 0);
  });
});
