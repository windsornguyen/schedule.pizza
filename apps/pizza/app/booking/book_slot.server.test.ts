import { beforeEach, describe, expect, it, vi } from "vitest";

import { bookHostSlot } from "./book_slot.server";

type AsyncMock = (...args: unknown[]) => Promise<unknown>;
type ReadCalendarIdMock = (calendarId: string | null) => string;

const mocks = vi.hoisted(() => ({
  confirmCalendarBooking: vi.fn<AsyncMock>(),
  createGoogleCalendarEvent: vi.fn<AsyncMock>(),
  createPendingCalendarBooking: vi.fn<AsyncMock>(),
  listHostAvailableSlots: vi.fn<AsyncMock>(),
  markBookingCodeUsed: vi.fn<AsyncMock>(),
  markCalendarBookingFailed: vi.fn<AsyncMock>(),
  readGoogleCalendarAccess: vi.fn<AsyncMock>(),
  readGoogleCalendarId: vi.fn<ReadCalendarIdMock>((calendarId) =>
    calendarId === null ? "primary" : calendarId,
  ),
}));

vi.mock("@/calendar/google.server", () => ({
  createGoogleCalendarEvent: mocks.createGoogleCalendarEvent,
  readGoogleCalendarAccess: mocks.readGoogleCalendarAccess,
  readGoogleCalendarId: mocks.readGoogleCalendarId,
}));

vi.mock("@/db/functions/booking_codes.server", () => ({
  markBookingCodeUsed: mocks.markBookingCodeUsed,
}));

vi.mock("@/db/functions/bookings.server", () => ({
  confirmCalendarBooking: mocks.confirmCalendarBooking,
  createPendingCalendarBooking: mocks.createPendingCalendarBooking,
  markCalendarBookingFailed: mocks.markCalendarBookingFailed,
}));

vi.mock("@/scheduling/host_availability.server", () => ({
  listHostAvailableSlots: mocks.listHostAvailableSlots,
}));

type BookHostSlotInput = Parameters<typeof bookHostSlot>[1];

const now = new Date("2026-06-26T15:00:00.000Z");
const slot = {
  startAt: new Date("2026-06-26T16:00:00.000Z"),
  endAt: new Date("2026-06-26T16:30:00.000Z"),
};
const db = {} as Parameters<typeof bookHostSlot>[0];

describe("bookHostSlot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.confirmCalendarBooking.mockResolvedValue({ id: "booking_1" });
    mocks.createGoogleCalendarEvent.mockResolvedValue({
      code: "created",
      eventId: "google_event_1",
    });
    mocks.createPendingCalendarBooking.mockResolvedValue({ id: "booking_1" });
    mocks.listHostAvailableSlots.mockResolvedValue({
      code: "listed",
      slots: [slot],
    });
    mocks.markBookingCodeUsed.mockResolvedValue(null);
    mocks.markCalendarBookingFailed.mockResolvedValue({ id: "booking_1" });
    mocks.readGoogleCalendarAccess.mockResolvedValue({
      code: "authorized",
      accessToken: "google_access_token",
    });
  });

  it("confirms the booking only after Google Calendar creates an event", async () => {
    const result = await bookHostSlot(db, createInput());

    expect(result).toEqual({
      code: "booked",
      bookingId: "booking_1",
      calendarEventId: "google_event_1",
      slot,
    });
    expect(mocks.createGoogleCalendarEvent).toHaveBeenCalledWith({
      accessToken: "google_access_token",
      calendarId: "primary",
      endAt: slot.endAt,
      guestEmail: "ada@example.com",
      guestName: "Ada",
      startAt: slot.startAt,
      timeZone: "America/Los_Angeles",
    });
    expect(mocks.confirmCalendarBooking).toHaveBeenCalledWith(db, {
      bookingId: "booking_1",
      calendarEventId: "google_event_1",
      confirmedAt: now,
      provider: "google",
    });
    expect(mocks.markBookingCodeUsed).toHaveBeenCalledWith(db, {
      bookingCodeId: "booking_code_1",
      usedAt: now,
    });
    expect(mocks.markCalendarBookingFailed).not.toHaveBeenCalled();
  });

  it("marks the pending booking failed when Google event creation fails", async () => {
    mocks.createGoogleCalendarEvent.mockResolvedValueOnce({
      code: "google_event_insert_failed",
    });

    await expect(bookHostSlot(db, createInput())).resolves.toEqual({
      code: "google_event_insert_failed",
    });
    expect(mocks.markCalendarBookingFailed).toHaveBeenCalledWith(db, {
      bookingId: "booking_1",
      failedAt: now,
    });
    expect(mocks.confirmCalendarBooking).not.toHaveBeenCalled();
    expect(mocks.markBookingCodeUsed).not.toHaveBeenCalled();
  });
});

function createInput(): BookHostSlotInput {
  return {
    bookingCodeId: "booking_code_1",
    env: {
      GOOGLE_CLIENT_ID: "google_client_id",
      GOOGLE_CLIENT_SECRET: "google_client_secret",
    } as BookHostSlotInput["env"],
    guestEmail: "ada@example.com",
    guestEmailNormalized: "ada@example.com",
    guestName: "Ada",
    guestTimezone: "America/Los_Angeles",
    host: {
      authUserId: "auth_user_1",
      calendarId: "primary",
      id: "host_1",
      slotSizeMinutes: 30,
      timezone: "America/Los_Angeles",
      username: "alice",
    },
    now,
    slotStartAt: slot.startAt,
    source: "api",
  };
}
