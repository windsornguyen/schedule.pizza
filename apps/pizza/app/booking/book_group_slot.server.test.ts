import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ParsedScheduleBody } from "@/api/v1_schedule";
import type * as v1ScheduleModule from "@/api/v1_schedule";
import { timeInterval } from "@/scheduling/engine";
import { bookGroupSlot } from "./book_group_slot.server";

type AsyncMock = (...args: unknown[]) => Promise<unknown>;
type ReadCalendarIdMock = (calendarId: string | null) => string;

const mocks = vi.hoisted(() => ({
  confirmCalendarBookings: vi.fn<AsyncMock>(),
  countRecentBookingsForCode: vi.fn<AsyncMock>(),
  createGoogleCalendarEvent: vi.fn<AsyncMock>(),
  createPendingCalendarBookings: vi.fn<AsyncMock>(),
  deleteGoogleCalendarEvent: vi.fn<AsyncMock>(),
  executeScheduleRequest: vi.fn<AsyncMock>(),
  markBookingCodeUsed: vi.fn<AsyncMock>(),
  markCalendarBookingsFailed: vi.fn<AsyncMock>(),
  readGoogleCalendarAccess: vi.fn<AsyncMock>(),
  readGoogleCalendarId: vi.fn<ReadCalendarIdMock>((calendarId) =>
    calendarId === null ? "primary" : calendarId,
  ),
}));

vi.mock("@/api/v1_schedule", async (importOriginal) => {
  const original = await importOriginal<typeof v1ScheduleModule>();

  return {
    ...original,
    executeScheduleRequest: mocks.executeScheduleRequest,
  };
});

vi.mock("@/calendar/google.server", () => ({
  createGoogleCalendarEvent: mocks.createGoogleCalendarEvent,
  deleteGoogleCalendarEvent: mocks.deleteGoogleCalendarEvent,
  readGoogleCalendarAccess: mocks.readGoogleCalendarAccess,
  readGoogleCalendarId: mocks.readGoogleCalendarId,
}));

vi.mock("@/db/functions/booking_codes.server", () => ({
  markBookingCodeUsed: mocks.markBookingCodeUsed,
}));

vi.mock("@/db/functions/bookings.server", () => ({
  confirmCalendarBookings: mocks.confirmCalendarBookings,
  countRecentBookingsForCode: mocks.countRecentBookingsForCode,
  createPendingCalendarBookings: mocks.createPendingCalendarBookings,
  markCalendarBookingsFailed: mocks.markCalendarBookingsFailed,
}));

const now = new Date("2026-06-26T15:00:00.000Z");
const slot = {
  startAt: new Date("2026-06-26T16:00:00.000Z"),
  endAt: new Date("2026-06-26T16:30:00.000Z"),
};
const db = {} as Parameters<typeof bookGroupSlot>[0];
const d1 = {} as D1Database;

describe("bookGroupSlot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.confirmCalendarBookings.mockResolvedValue(["booking_1", "booking_2"]);
    mocks.countRecentBookingsForCode.mockResolvedValue(0);
    mocks.createGoogleCalendarEvent.mockResolvedValue({
      code: "created",
      eventId: "google_event_1",
    });
    mocks.createPendingCalendarBookings.mockResolvedValue([
      "booking_1",
      "booking_2",
    ]);
    mocks.deleteGoogleCalendarEvent.mockResolvedValue({ code: "deleted" });
    mocks.executeScheduleRequest.mockResolvedValue(exactSchedule());
    mocks.markBookingCodeUsed.mockResolvedValue(null);
    mocks.markCalendarBookingsFailed.mockResolvedValue([
      "booking_1",
      "booking_2",
    ]);
    mocks.readGoogleCalendarAccess.mockResolvedValue({
      code: "authorized",
      accessToken: "google_access_token",
    });
  });

  it("books one organizer event after reserving every participant locally", async () => {
    await expect(bookGroupSlot(db, createInput())).resolves.toEqual({
      code: "booked",
      bookingIds: ["booking_1", "booking_2"],
      calendarEventId: "google_event_1",
      slot,
    });
    expect(mocks.createPendingCalendarBookings).toHaveBeenCalledWith(d1, [
      expect.objectContaining({
        hostId: "host_alice",
        bookingCodeId: "code_alice",
        slotStartAt: slot.startAt,
        slotEndAt: slot.endAt,
      }),
      expect.objectContaining({
        hostId: "host_bob",
        bookingCodeId: "code_bob",
        slotStartAt: slot.startAt,
        slotEndAt: slot.endAt,
      }),
    ]);
    expect(mocks.createGoogleCalendarEvent).toHaveBeenCalledWith({
      accessToken: "google_access_token",
      additionalAttendees: [{ displayName: "bob", email: "bob@example.com" }],
      calendarId: "primary",
      endAt: slot.endAt,
      guestEmail: "ada@example.com",
      guestName: "Ada",
      startAt: slot.startAt,
      timeZone: "America/Los_Angeles",
    });
    expect(mocks.confirmCalendarBookings).toHaveBeenCalledWith(d1, {
      bookingIds: ["booking_1", "booking_2"],
      calendarEventId: "google_event_1",
      confirmedAt: now,
      provider: "google",
    });
  });

  it("does not reserve or write calendars when the selected slot is no longer exact", async () => {
    mocks.executeScheduleRequest.mockResolvedValueOnce({
      ...exactSchedule(),
      body: { kind: "alternatives", slots: [] },
    });

    await expect(bookGroupSlot(db, createInput())).resolves.toEqual({
      code: "slot_unavailable",
    });
    expect(mocks.createPendingCalendarBookings).not.toHaveBeenCalled();
    expect(mocks.createGoogleCalendarEvent).not.toHaveBeenCalled();
  });

  it("does not write Google Calendar when local reservation fails", async () => {
    mocks.createPendingCalendarBookings.mockResolvedValueOnce(null);

    await expect(bookGroupSlot(db, createInput())).resolves.toEqual({
      code: "slot_unavailable",
    });
    expect(mocks.createGoogleCalendarEvent).not.toHaveBeenCalled();
  });

  it("marks local reservations failed when Google event creation fails", async () => {
    mocks.createGoogleCalendarEvent.mockResolvedValueOnce({
      code: "google_event_insert_failed",
    });

    await expect(bookGroupSlot(db, createInput())).resolves.toEqual({
      code: "google_event_insert_failed",
    });
    expect(mocks.markCalendarBookingsFailed).toHaveBeenCalledWith(d1, {
      bookingIds: ["booking_1", "booking_2"],
      failedAt: now,
    });
    expect(mocks.confirmCalendarBookings).not.toHaveBeenCalled();
  });

  it("deletes the Google event when local confirmation fails", async () => {
    mocks.confirmCalendarBookings.mockResolvedValueOnce(null);

    await expect(bookGroupSlot(db, createInput())).resolves.toEqual({
      code: "booking_confirmation_failed",
    });
    expect(mocks.deleteGoogleCalendarEvent).toHaveBeenCalledWith({
      accessToken: "google_access_token",
      calendarId: "primary",
      eventId: "google_event_1",
      notifyGuests: true,
    });
    expect(mocks.markCalendarBookingsFailed).toHaveBeenCalledWith(d1, {
      bookingIds: ["booking_1", "booking_2"],
      failedAt: now,
    });
  });

  it("surfaces a typed error when failed group confirmation cannot be recorded", async () => {
    mocks.confirmCalendarBookings.mockResolvedValueOnce(null);
    mocks.markCalendarBookingsFailed.mockResolvedValueOnce(null);

    await expect(bookGroupSlot(db, createInput())).resolves.toEqual({
      code: "booking_failure_record_failed",
    });
  });
});

function createInput(): Parameters<typeof bookGroupSlot>[1] {
  return {
    body: scheduleBody,
    env: {
      DB: d1,
      GOOGLE_CLIENT_ID: "google_client_id",
      GOOGLE_CLIENT_SECRET: "google_client_secret",
    } as Parameters<typeof bookGroupSlot>[1]["env"],
    guestEmail: "ada@example.com",
    guestEmailNormalized: "ada@example.com",
    guestName: "Ada",
    guestTimezone: "America/Los_Angeles",
    ipHash: "ip_hash",
    now,
    slotStartAt: slot.startAt,
    source: "api",
  };
}

function exactSchedule() {
  return {
    code: "scheduled",
    authorizedParticipants: [
      {
        authUserId: "user_alice",
        bookingCodeId: "code_alice",
        calendarAccountEmail: "alice@example.com",
        calendarId: "primary",
        hostId: "host_alice",
        username: "alice",
      },
      {
        authUserId: "user_bob",
        bookingCodeId: "code_bob",
        calendarAccountEmail: "bob@example.com",
        calendarId: "primary",
        hostId: "host_bob",
        username: "bob",
      },
    ],
    body: {
      kind: "exact",
      slots: [
        {
          start: slot.startAt.toISOString(),
          end: slot.endAt.toISOString(),
        },
      ],
    },
  };
}

const scheduleBody = {
  participants: [
    { username: "alice", bookingCode: "moon-tiger-seven" },
    { username: "bob", bookingCode: "river-lime-harbor" },
  ],
  durationMinutes: 30,
  granularityMinutes: 15,
  maxExactSlotCount: 12,
  maxAlternativeSlotCount: 5,
  timeZone: "America/Los_Angeles",
  window: timeInterval({
    startAtMs: Date.parse("2026-06-26T16:00:00.000Z"),
    endAtMs: Date.parse("2026-06-27T16:00:00.000Z"),
  }),
} satisfies ParsedScheduleBody;
