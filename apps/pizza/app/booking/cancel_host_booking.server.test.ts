import { beforeEach, describe, expect, it, vi } from "vitest";

import { cancelHostBooking } from "./cancel_host_booking.server";

type AsyncMock = (...args: unknown[]) => Promise<unknown>;
type ReadCalendarIdMock = (calendarId: string | null) => string;

const mocks = vi.hoisted(() => ({
  countConfirmedBookingsForCalendarEvent: vi.fn<AsyncMock>(),
  deleteGoogleCalendarEvent: vi.fn<AsyncMock>(),
  findConfirmedBookingForHost: vi.fn<AsyncMock>(),
  markConfirmedBookingCancelled: vi.fn<AsyncMock>(),
  readGoogleCalendarAccess: vi.fn<AsyncMock>(),
  readGoogleCalendarId: vi.fn<ReadCalendarIdMock>((calendarId) =>
    calendarId === null ? "primary" : calendarId,
  ),
}));

vi.mock("@/calendar/google.server", () => ({
  deleteGoogleCalendarEvent: mocks.deleteGoogleCalendarEvent,
  readGoogleCalendarAccess: mocks.readGoogleCalendarAccess,
  readGoogleCalendarId: mocks.readGoogleCalendarId,
}));

vi.mock("@/db/functions/bookings.server", () => ({
  countConfirmedBookingsForCalendarEvent: mocks.countConfirmedBookingsForCalendarEvent,
  findConfirmedBookingForHost: mocks.findConfirmedBookingForHost,
  markConfirmedBookingCancelled: mocks.markConfirmedBookingCancelled,
}));

const db = {} as Parameters<typeof cancelHostBooking>[0];
const env = {
  GOOGLE_CLIENT_ID: "google_client_id",
  GOOGLE_CLIENT_SECRET: "google_client_secret",
} as Parameters<typeof cancelHostBooking>[1]["env"];
const now = new Date("2026-06-26T16:00:00.000Z");

describe("cancelHostBooking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.countConfirmedBookingsForCalendarEvent.mockResolvedValue(1);
    mocks.deleteGoogleCalendarEvent.mockResolvedValue({ code: "deleted" });
    mocks.findConfirmedBookingForHost.mockResolvedValue({
      calendarEventId: "google_event_1",
      calendarProvider: "google",
      id: "booking_1",
    });
    mocks.markConfirmedBookingCancelled.mockResolvedValue({ id: "booking_1" });
    mocks.readGoogleCalendarAccess.mockResolvedValue({
      code: "authorized",
      accessToken: "google_access_token",
    });
  });

  it("deletes the Google event before marking the booking cancelled", async () => {
    await expect(cancelHostBooking(db, input())).resolves.toEqual({
      bookingId: "booking_1",
      code: "cancelled",
    });
    expect(mocks.deleteGoogleCalendarEvent).toHaveBeenCalledWith({
      accessToken: "google_access_token",
      calendarId: "primary",
      eventId: "google_event_1",
      notifyGuests: true,
    });
    expect(mocks.markConfirmedBookingCancelled).toHaveBeenCalledWith(db, {
      bookingId: "booking_1",
      cancelledAt: now,
    });
  });

  it("does not cancel local state when Google deletion fails", async () => {
    mocks.deleteGoogleCalendarEvent.mockResolvedValueOnce({
      code: "google_event_delete_failed",
    });

    await expect(cancelHostBooking(db, input())).resolves.toEqual({
      code: "google_event_delete_failed",
    });
    expect(mocks.markConfirmedBookingCancelled).not.toHaveBeenCalled();
  });

  it("rejects group bookings before deleting a shared calendar event", async () => {
    mocks.countConfirmedBookingsForCalendarEvent.mockResolvedValueOnce(2);

    await expect(cancelHostBooking(db, input())).resolves.toEqual({
      code: "group_booking_cancel_unsupported",
    });
    expect(mocks.deleteGoogleCalendarEvent).not.toHaveBeenCalled();
    expect(mocks.markConfirmedBookingCancelled).not.toHaveBeenCalled();
  });

  it("requires a host-owned confirmed booking", async () => {
    mocks.findConfirmedBookingForHost.mockResolvedValueOnce(null);

    await expect(cancelHostBooking(db, input())).resolves.toEqual({
      code: "booking_missing",
    });
    expect(mocks.deleteGoogleCalendarEvent).not.toHaveBeenCalled();
  });
});

function input(): Parameters<typeof cancelHostBooking>[1] {
  return {
    authUserId: "auth_user_1",
    bookingId: "booking_1",
    calendarId: "primary",
    env,
    hostId: "host_1",
    now,
  };
}
