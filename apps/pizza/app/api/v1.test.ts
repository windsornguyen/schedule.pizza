import { beforeEach, describe, expect, it, vi } from "vitest";

import type * as AuthServerModule from "@/auth.server";
import type * as CancelHostBookingModule from "@/booking/cancel_host_booking.server";
import type * as BookGroupSlotModule from "@/booking/book_group_slot.server";
import type * as BookSlotModule from "@/booking/book_slot.server";
import type * as GoogleCalendarModule from "@/calendar/google.server";
import type * as BookingCodeAuthorizationsModule from "@/db/functions/booking_code_authorizations.server";
import type * as BookingCodesModule from "@/db/functions/booking_codes.server";
import type * as BookingsModule from "@/db/functions/bookings.server";
import type * as HostProfilesModule from "@/db/functions/host_profiles.server";
import type * as HostAvailabilityModule from "@/scheduling/host_availability.server";
import { timeInterval } from "@/scheduling/engine";

import {
  parseAccountProfileBody,
  parseBookBody,
  parseGroupBookBody,
  readAvailabilityTarget,
  v1,
} from "./v1";

type AsyncMock = (...args: unknown[]) => Promise<unknown>;
type SyncMock = (...args: unknown[]) => unknown;

const mocks = vi.hoisted(() => ({
  authorizeBookingCode: vi.fn<AsyncMock>(),
  bookGroupSlot: vi.fn<AsyncMock>(),
  bookHostSlot: vi.fn<AsyncMock>(),
  cancelHostBooking: vi.fn<AsyncMock>(),
  createDb: vi.fn<SyncMock>(),
  createHostProfileWithBookingCode: vi.fn<AsyncMock>(),
  findActiveBookingCodeForHost: vi.fn<AsyncMock>(),
  findHostProfileByAuthUserId: vi.fn<AsyncMock>(),
  findHostProfileByUsername: vi.fn<AsyncMock>(),
  listHostAvailableSlots: vi.fn<AsyncMock>(),
  listUpcomingConfirmedBookingsForHost: vi.fn<AsyncMock>(),
  readAuthSession: vi.fn<AsyncMock>(),
  readGoogleCalendarAccess: vi.fn<AsyncMock>(),
  readHostBookingCancellation: vi.fn<AsyncMock>(),
  rotateBookingCode: vi.fn<AsyncMock>(),
  updateHostProfile: vi.fn<AsyncMock>(),
}));

vi.mock("@/auth.server", async (importOriginal) => {
  const actual = await importOriginal<typeof AuthServerModule>();

  return {
    ...actual,
    readAuthSession: mocks.readAuthSession,
  };
});

vi.mock("@/calendar/google.server", async (importOriginal) => {
  const actual = await importOriginal<typeof GoogleCalendarModule>();

  return {
    ...actual,
    readGoogleCalendarAccess: mocks.readGoogleCalendarAccess,
  };
});

vi.mock("@/booking/cancel_host_booking.server", async (importOriginal) => {
  const actual = await importOriginal<typeof CancelHostBookingModule>();

  return {
    ...actual,
    cancelHostBooking: mocks.cancelHostBooking,
    readHostBookingCancellation: mocks.readHostBookingCancellation,
  };
});

vi.mock("@/booking/book_group_slot.server", async (importOriginal) => {
  const actual = await importOriginal<typeof BookGroupSlotModule>();

  return {
    ...actual,
    bookGroupSlot: mocks.bookGroupSlot,
  };
});

vi.mock("@/booking/book_slot.server", async (importOriginal) => {
  const actual = await importOriginal<typeof BookSlotModule>();

  return {
    ...actual,
    bookHostSlot: mocks.bookHostSlot,
  };
});

vi.mock("@/db/client.server", () => ({
  createDb: mocks.createDb,
}));

vi.mock("@/db/functions/booking_code_authorizations.server", async (importOriginal) => {
  const actual = await importOriginal<typeof BookingCodeAuthorizationsModule>();

  return {
    ...actual,
    authorizeBookingCode: mocks.authorizeBookingCode,
  };
});

vi.mock("@/db/functions/booking_codes.server", async (importOriginal) => {
  const actual = await importOriginal<typeof BookingCodesModule>();

  return {
    ...actual,
    findActiveBookingCodeForHost: mocks.findActiveBookingCodeForHost,
    rotateBookingCode: mocks.rotateBookingCode,
  };
});

vi.mock("@/db/functions/bookings.server", async (importOriginal) => {
  const actual = await importOriginal<typeof BookingsModule>();

  return {
    ...actual,
    listUpcomingConfirmedBookingsForHost: mocks.listUpcomingConfirmedBookingsForHost,
  };
});

vi.mock("@/db/functions/host_profiles.server", async (importOriginal) => {
  const actual = await importOriginal<typeof HostProfilesModule>();

  return {
    ...actual,
    createHostProfileWithBookingCode: mocks.createHostProfileWithBookingCode,
    findHostProfileByAuthUserId: mocks.findHostProfileByAuthUserId,
    findHostProfileByUsername: mocks.findHostProfileByUsername,
    updateHostProfile: mocks.updateHostProfile,
  };
});

vi.mock("@/scheduling/host_availability.server", async (importOriginal) => {
  const actual = await importOriginal<typeof HostAvailabilityModule>();

  return {
    ...actual,
    listHostAvailableSlots: mocks.listHostAvailableSlots,
  };
});

const db = {};
const env = {
  BETTER_AUTH_SECRET: "better_auth_secret",
  BETTER_AUTH_URL: "https://schedule.pizza",
  DB: {} as D1Database,
  GOOGLE_CLIENT_ID: "google_client_id",
  GOOGLE_CLIENT_SECRET: "google_client_secret",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createDb.mockReturnValue(db);
  mocks.authorizeBookingCode.mockResolvedValue({
    code: "authorized",
    access: {
      code: { id: "booking_code_1" },
      host: {
        authUserId: "auth_user_1",
        calendarId: "primary",
        id: "host_1",
        slotSizeMinutes: 30,
        timezone: "America/Los_Angeles",
        username: "alice",
      },
    },
  });
  mocks.bookGroupSlot.mockResolvedValue({
    code: "booked",
    bookingIds: ["booking_1", "booking_2"],
    calendarEventId: "google_event_1",
    slot: {
      startAt: new Date("2026-06-26T16:00:00.000Z"),
      endAt: new Date("2026-06-26T16:30:00.000Z"),
    },
  });
  mocks.bookHostSlot.mockResolvedValue({
    code: "booked",
    bookingId: "booking_1",
    calendarEventId: "google_event_1",
    slot: {
      startAt: new Date("2026-06-26T16:00:00.000Z"),
      endAt: new Date("2026-06-26T16:30:00.000Z"),
    },
  });
  mocks.cancelHostBooking.mockResolvedValue({
    code: "cancelled",
    bookingId: "booking_1",
  });
  mocks.createHostProfileWithBookingCode.mockResolvedValue({
    code: "created_profile",
    bookingCode: "moon-tiger-seven",
    bookingCodeHash: "booking_code_hash",
    profile: { id: "host_1", username: "alice" },
  });
  mocks.findActiveBookingCodeForHost.mockResolvedValue(null);
  mocks.listHostAvailableSlots.mockResolvedValue({
    code: "listed",
    slots: [
      {
        startAt: new Date("2030-01-07T17:00:00.000Z"),
        endAt: new Date("2030-01-07T17:30:00.000Z"),
      },
    ],
  });
  mocks.listUpcomingConfirmedBookingsForHost.mockResolvedValue([]);
  mocks.readAuthSession.mockResolvedValue({
    session: { id: "session_1", userId: "auth_user_1" },
    user: { id: "auth_user_1", email: "alice@example.com" },
  });
  mocks.readGoogleCalendarAccess.mockResolvedValue({
    code: "authorized",
    accessToken: "google_access_token",
  });
  mocks.readHostBookingCancellation.mockResolvedValue({
    canCancel: true,
    disabledReason: null,
    kind: "individual",
  });
  mocks.rotateBookingCode.mockResolvedValue({
    code: "sun-river-ten",
    codeHash: "booking_code_hash",
  });
});

describe("v1 API CORS", () => {
  it("describes the API version without hardcoding release metadata", async () => {
    const response = await v1.request("https://schedule.pizza/");
    const body = await response.json() as Record<string, unknown>;

    expect(body["name"]).toBe("schedule.pizza");
    expect(body["apiVersion"]).toBe("v1");
    expect(body["version"]).toBeUndefined();
    expect(body["limits"]).toMatchObject({
      maxAlternativeSlotCount: 50,
      maxDurationMinutes: 480,
      maxExactSlotCount: 100,
      maxGranularityMinutes: 240,
      maxProfileCount: 8,
      maxWindowDays: 31,
    });
    expect(body["endpoints"]).toMatchObject({
      availability: {
        method: "GET",
        path: "/api/v1/availability",
        params: {
          url: expect.stringContaining("schedule.pizza link"),
          user: expect.stringContaining("unless url"),
          code: expect.stringContaining("unless url"),
        },
      },
      bookGroup: {
        method: "POST",
        path: "/api/v1/book-group",
      },
      accountBookings: {
        method: "GET",
        path: "/api/v1/account/bookings",
        response: {
          kind: expect.stringContaining("individual"),
          cancel: {
            allowed: "boolean",
            disabledReason: expect.stringContaining("group_booking"),
          },
        },
      },
      cancelBooking: {
        method: "POST",
        path: "/api/v1/account/bookings/:bookingId/cancel",
        headers: {
          Origin: "same origin as BETTER_AUTH_URL",
        },
      },
      recommend: {
        method: "POST",
        path: "/api/v1/recommend",
        response: {
          exact: expect.stringContaining("everyone is free"),
          alternatives: expect.stringContaining("conflict cost"),
        },
      },
      schedule: {
        method: "POST",
        path: "/api/v1/schedule",
      },
    });
    expect(body["examples"]).toMatchObject({
      availability: {
        method: "GET",
        url: "/api/v1/availability?url=https%3A%2F%2Fschedule.pizza%2Falice%3Fcode%3Dmoon-tiger-seven",
      },
      book: {
        method: "POST",
        path: "/api/v1/book",
        body: {
          url: "https://schedule.pizza/alice?code=moon-tiger-seven",
          slot: "2030-01-07T17:00:00.000Z",
          email: "ada@example.com",
        },
      },
      bookGroup: {
        method: "POST",
        path: "/api/v1/book-group",
        body: {
          slot: "2030-01-07T18:00:00.000Z",
        },
      },
      schedule: {
        method: "POST",
        path: "/api/v1/schedule",
        body: {
          participants: [
            { url: "https://schedule.pizza/alice?code=moon-tiger-seven" },
            { url: "https://schedule.pizza/bob?code=river-lime-harbor" },
          ],
        },
      },
      recommend: {
        method: "POST",
        path: "/api/v1/recommend",
        body: {
          participants: [
            { url: "https://schedule.pizza/alice?code=moon-tiger-seven" },
            { url: "https://schedule.pizza/bob?code=river-lime-harbor" },
          ],
          maxAlternativeSlotCount: 5,
        },
      },
      bootstrap: {
        method: "POST",
        path: "/api/v1/me/bootstrap",
        auth: "Better Auth session cookie",
        headers: {
          Origin: "https://schedule.pizza",
        },
        body: {
          username: "alice",
          slotSizeMinutes: 30,
        },
      },
      saveProfile: {
        method: "PUT",
        path: "/api/v1/account/profile",
        auth: "Better Auth session cookie",
        headers: {
          Origin: "https://schedule.pizza",
        },
      },
      rotateBookingCode: {
        method: "POST",
        path: "/api/v1/me/booking-code",
        auth: "Better Auth session cookie",
        headers: {
          Origin: "https://schedule.pizza",
        },
      },
      accountBookings: {
        method: "GET",
        path: "/api/v1/account/bookings",
        auth: "Better Auth session cookie",
      },
      cancelBooking: {
        method: "POST",
        path: "/api/v1/account/bookings/booking_123/cancel",
        auth: "Better Auth session cookie",
        headers: {
          Origin: "https://schedule.pizza",
        },
      },
    });
    expect(body["errors"]).toMatchObject({
      500: expect.not.arrayContaining([
        "database_schema_missing",
        "runtime_secret_missing",
      ]),
      503: ["database_unavailable", "runtime_secret_missing"],
    });
    expect(readDuplicateErrorCodes(body["errors"])).toEqual([]);
  });

  it("advertises every agent-callable route", async () => {
    const response = await v1.request("https://schedule.pizza/");
    const body = await response.json() as Record<string, unknown>;

    expect(readAdvertisedRoutes(body["endpoints"])).toEqual([
      "GET /api/v1/account",
      "GET /api/v1/account/bookings",
      "GET /api/v1/availability",
      "GET /api/v1/health",
      "GET /api/v1/me",
      "POST /api/v1/account/bookings/:bookingId/cancel",
      "POST /api/v1/book",
      "POST /api/v1/book-group",
      "POST /api/v1/me/booking-code",
      "POST /api/v1/me/bootstrap",
      "POST /api/v1/recommend",
      "POST /api/v1/schedule",
      "PUT /api/v1/account/profile",
    ]);
  });

  it("allows browser-hosted agents to read the API descriptor", async () => {
    const response = await v1.request("https://schedule.pizza/", {
      headers: { Origin: "https://agent.example" },
    });

    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("marks API responses as non-cacheable", async () => {
    const response = await v1.request("https://schedule.pizza/");

    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Pragma")).toBe("no-cache");
  });

  it("allows browser-hosted agents to preflight JSON schedule requests", async () => {
    const response = await v1.request("https://schedule.pizza/schedule", {
      method: "OPTIONS",
      headers: {
        Origin: "https://agent.example",
        "Access-Control-Request-Headers": "content-type",
        "Access-Control-Request-Method": "POST",
      },
    });

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe(
      "GET,POST,PUT,OPTIONS",
    );
    expect(response.headers.get("Access-Control-Allow-Headers")).toBe(
      "Content-Type",
    );
  });
});

function readDuplicateErrorCodes(errors: unknown): readonly string[] {
  if (typeof errors !== "object" || errors === null || Array.isArray(errors)) {
    throw new TypeError("API errors descriptor must be an object");
  }

  const duplicateCodes: string[] = [];

  for (const values of Object.values(errors)) {
    if (!Array.isArray(values)) {
      throw new TypeError("API errors descriptor values must be arrays");
    }

    const seenCodes = new Set<string>();

    for (const value of values) {
      if (typeof value !== "string") {
        throw new TypeError("API error codes must be strings");
      }

      if (seenCodes.has(value)) {
        duplicateCodes.push(value);
      }

      seenCodes.add(value);
    }
  }

  return duplicateCodes;
}

function readAdvertisedRoutes(endpoints: unknown): readonly string[] {
  if (typeof endpoints !== "object" || endpoints === null || Array.isArray(endpoints)) {
    throw new TypeError("API endpoints descriptor must be an object");
  }

  return Object.values(endpoints)
    .map((endpoint) => readAdvertisedRoute(endpoint))
    .sort();
}

function readAdvertisedRoute(endpoint: unknown): string {
  if (typeof endpoint !== "object" || endpoint === null || Array.isArray(endpoint)) {
    throw new TypeError("API endpoint descriptor must be an object");
  }

  const method = "method" in endpoint ? endpoint.method : null;
  const path = "path" in endpoint ? endpoint.path : null;

  if (typeof method !== "string" || typeof path !== "string") {
    throw new TypeError("API endpoint descriptor must include method and path");
  }

  return `${method} ${path}`;
}

describe("availability API", () => {
  it("accepts a shared schedule link as the capability", async () => {
    const response = await v1.request(
      "https://schedule.pizza/availability?url=https%3A%2F%2Fschedule.pizza%2FAlice%3Fcode%3Dmoon%2520tiger%2520seven",
      {
        headers: { "CF-Connecting-IP": "203.0.113.10" },
      },
      env,
    );

    await expect(response.json()).resolves.toEqual({
      user: "alice",
      timezone: "America/Los_Angeles",
      slotSizeMinutes: 30,
      slots: [
        {
          start: "2030-01-07T17:00:00.000Z",
          end: "2030-01-07T17:30:00.000Z",
        },
      ],
    });
    expect(response.status).toBe(200);
    expect(mocks.authorizeBookingCode).toHaveBeenCalledWith(db, {
      bookingCode: "moon-tiger-seven",
      ipHash: expect.any(String) as string,
      now: expect.any(Date) as Date,
      username: "alice",
    });
  });

  it("rejects ambiguous shared link parameters before authorization", async () => {
    const response = await v1.request(
      "https://schedule.pizza/availability?url=https%3A%2F%2Fschedule.pizza%2Falice%3Fcode%3Dmoon-tiger-seven&user=alice",
      {
        headers: { "CF-Connecting-IP": "203.0.113.10" },
      },
      env,
    );

    await expect(response.json()).resolves.toEqual({
      error: { code: "invalid_field", message: "url is invalid" },
    });
    expect(response.status).toBe(400);
    expect(mocks.authorizeBookingCode).not.toHaveBeenCalled();
  });
});

describe("availability API query parser", () => {
  it("parses split user and code params", () => {
    expect(readAvailabilityTarget({
      code: "moon tiger seven",
      url: null,
      user: "Alice",
    })).toEqual({
      code: "parsed",
      body: { username: "alice", bookingCode: "moon-tiger-seven" },
    });
  });

  it("reports missing split params precisely", () => {
    expect(readAvailabilityTarget({
      code: "moon-tiger-seven",
      url: null,
      user: null,
    })).toEqual({ code: "missing_parameter", field: "user" });
    expect(readAvailabilityTarget({
      code: null,
      url: null,
      user: "alice",
    })).toEqual({ code: "missing_parameter", field: "code" });
  });
});

describe("account bookings API", () => {
  it("lists upcoming host bookings without leaking calendar event ids", async () => {
    mocks.findHostProfileByAuthUserId.mockResolvedValue({
      authUserId: "auth_user_1",
      calendarId: "primary",
      id: "host_1",
      username: "alice",
    });
    mocks.listUpcomingConfirmedBookingsForHost.mockResolvedValue([
      {
        calendarEventId: "google_event_1",
        guestEmail: "ada@example.com",
        guestName: "Ada",
        id: "booking_1",
        slotEndAt: new Date("2026-06-26T16:30:00.000Z"),
        slotStartAt: new Date("2026-06-26T16:00:00.000Z"),
      },
    ]);

    const response = await v1.request(
      "https://schedule.pizza/account/bookings",
      {},
      env,
    );
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      bookings: [
        {
          canCancel: true,
          cancel: {
            allowed: true,
            disabledReason: null,
          },
          guest: {
            email: "ada@example.com",
            name: "Ada",
          },
          id: "booking_1",
          kind: "individual",
          slot: {
            start: "2026-06-26T16:00:00.000Z",
            end: "2026-06-26T16:30:00.000Z",
          },
          status: "confirmed",
        },
      ],
    });
    expect(JSON.stringify(body)).not.toContain("google_event_1");
    expect(mocks.listUpcomingConfirmedBookingsForHost).toHaveBeenCalledWith(db, {
      hostId: "host_1",
      limit: 20,
      now: expect.any(Date) as Date,
    });
    expect(mocks.readHostBookingCancellation).toHaveBeenCalledWith(
      db,
      "google_event_1",
    );
  });

  it("tells host agents why group bookings cannot be cancelled through account APIs", async () => {
    mocks.findHostProfileByAuthUserId.mockResolvedValue({
      authUserId: "auth_user_1",
      calendarId: "primary",
      id: "host_1",
      username: "alice",
    });
    mocks.listUpcomingConfirmedBookingsForHost.mockResolvedValue([
      {
        calendarEventId: "google_event_1",
        guestEmail: "ada@example.com",
        guestName: "Ada",
        id: "booking_1",
        slotEndAt: new Date("2026-06-26T16:30:00.000Z"),
        slotStartAt: new Date("2026-06-26T16:00:00.000Z"),
      },
    ]);
    mocks.readHostBookingCancellation.mockResolvedValue({
      canCancel: false,
      disabledReason: "group_booking",
      kind: "group",
    });

    const response = await v1.request(
      "https://schedule.pizza/account/bookings",
      {},
      env,
    );
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      bookings: [
        {
          canCancel: false,
          cancel: {
            allowed: false,
            disabledReason: "group_booking",
          },
          id: "booking_1",
          kind: "group",
        },
      ],
    });
  });

  it("confirms individual bookings without leaking Google event ids", async () => {
    const response = await v1.request("https://schedule.pizza/book", {
      method: "POST",
      headers: {
        "CF-Connecting-IP": "203.0.113.10",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user: "alice",
        code: "moon-tiger-seven",
        slot: "2026-06-26T16:00:00.000Z",
        name: "Ada",
        email: "ada@example.com",
        timezone: "America/Los_Angeles",
      }),
    }, env);
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      booking: {
        id: "booking_1",
        user: "alice",
        slot: {
          start: "2026-06-26T16:00:00.000Z",
          end: "2026-06-26T16:30:00.000Z",
        },
        booker: { name: "Ada", email: "ada@example.com" },
        calendar: { provider: "google" },
        status: "confirmed",
      },
    });
    expect(JSON.stringify(body)).not.toContain("google_event_1");
  });

  it("confirms group bookings without leaking Google event ids", async () => {
    const response = await v1.request("https://schedule.pizza/book-group", {
      method: "POST",
      headers: {
        "CF-Connecting-IP": "203.0.113.10",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(groupBookBody()),
    }, env);
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      booking: {
        ids: ["booking_1", "booking_2"],
        slot: {
          start: "2026-06-26T16:00:00.000Z",
          end: "2026-06-26T16:30:00.000Z",
        },
        booker: { name: "Ada", email: "ada@example.com" },
        calendar: { provider: "google" },
        status: "confirmed",
      },
    });
    expect(JSON.stringify(body)).not.toContain("google_event_1");
  });

  it("cancels a host-owned booking through the cancellation domain helper", async () => {
    mocks.findHostProfileByAuthUserId.mockResolvedValue({
      authUserId: "auth_user_1",
      calendarId: "primary",
      id: "host_1",
      username: "alice",
    });

    const response = await v1.request(
      "https://schedule.pizza/account/bookings/booking_1/cancel",
      { method: "POST", headers: { Origin: "https://schedule.pizza" } },
      env,
    );

    await expect(response.json()).resolves.toEqual({
      ok: true,
      booking: {
        id: "booking_1",
        status: "cancelled",
      },
    });
    expect(response.status).toBe(200);
    expect(mocks.cancelHostBooking).toHaveBeenCalledWith(db, {
      authUserId: "auth_user_1",
      bookingId: "booking_1",
      calendarId: "primary",
      env,
      hostId: "host_1",
      now: expect.any(Date) as Date,
    });
  });
});

describe("v1 health API", () => {
  it("reports healthy runtime configuration and D1 schema access", async () => {
    mocks.createDb.mockReturnValueOnce(healthyDb());

    const response = await v1.request("https://schedule.pizza/health", {}, env);

    await expect(response.json()).resolves.toEqual({
      ok: true,
      auth: {
        googleClientId: "google_client_id",
        googleRedirectUri: "https://schedule.pizza/api/auth/callback/google",
      },
      checks: {
        database: "healthy",
        runtime: "healthy",
      },
    });
    expect(response.status).toBe(200);
  });

  it("normalizes the Google redirect URI when auth URL has a trailing slash", async () => {
    mocks.createDb.mockReturnValueOnce(healthyDb());

    const response = await v1.request("https://schedule.pizza/health", {}, {
      ...env,
      BETTER_AUTH_URL: "https://schedule.pizza/",
    });

    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      auth: {
        googleRedirectUri: "https://schedule.pizza/api/auth/callback/google",
      },
    });
    expect(response.status).toBe(200);
  });

  it("fails closed before touching D1 when runtime secrets are missing", async () => {
    const response = await v1.request("https://schedule.pizza/health", {}, {
      ...env,
      BETTER_AUTH_SECRET: "",
    });

    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: {
        code: "runtime_secret_missing",
        message: "BETTER_AUTH_SECRET is missing",
      },
    });
    expect(response.status).toBe(503);
    expect(mocks.createDb).not.toHaveBeenCalled();
  });

  it("reports invalid auth URLs before claiming Google redirect health", async () => {
    const response = await v1.request("https://schedule.pizza/health", {}, {
      ...env,
      BETTER_AUTH_URL: "not a url",
    });

    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: {
        code: "runtime_secret_missing",
        message: "BETTER_AUTH_URL is invalid",
      },
    });
    expect(response.status).toBe(503);
    expect(mocks.createDb).not.toHaveBeenCalled();
  });

  it("rejects non-http auth URLs before claiming Google redirect health", async () => {
    const response = await v1.request("https://schedule.pizza/health", {}, {
      ...env,
      BETTER_AUTH_URL: "ftp://schedule.pizza",
    });

    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: {
        code: "runtime_secret_missing",
        message: "BETTER_AUTH_URL is invalid",
      },
    });
    expect(response.status).toBe(503);
    expect(mocks.createDb).not.toHaveBeenCalled();
  });

  it.each([
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
  ] as const)("reports missing %s without throwing", async (envName) => {
    const response = await v1.request("https://schedule.pizza/health", {}, {
      ...env,
      [envName]: undefined as unknown as string,
    });

    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: {
        code: "runtime_secret_missing",
        message: `${envName} is missing`,
      },
    });
    expect(response.status).toBe(503);
    expect(mocks.createDb).not.toHaveBeenCalled();
  });
});

describe("account profile API", () => {
  it("does not return plaintext booking capabilities on account reads", async () => {
    mocks.findHostProfileByAuthUserId.mockResolvedValue({
      authUserId: "auth_user_1",
      displayName: "Alice",
      id: "host_1",
      slotSizeMinutes: 30,
      timezone: "America/Los_Angeles",
      username: "alice",
    });
    mocks.findActiveBookingCodeForHost.mockResolvedValue({
      createdAt: new Date("2030-01-07T17:00:00.000Z"),
      expiresAt: null,
      id: "booking_code_1",
      wordCount: 3,
    });

    const response = await v1.request("https://schedule.pizza/account", {}, env);
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      account: {
        profile: {
          username: "alice",
          calendarStatus: "connected",
        },
        profilePath: "/alice",
        activeBookingCode: {
          createdAt: "2030-01-07T17:00:00.000Z",
          expiresAt: null,
          wordCount: 3,
        },
        bookingCode: null,
        bookingPath: null,
        bookingUrl: null,
      },
    });
    expect(JSON.stringify(body)).not.toContain("moon-tiger-seven");
    expect(mocks.findActiveBookingCodeForHost).toHaveBeenCalledWith(db, {
      hostId: "host_1",
      now: expect.any(Date) as Date,
    });
  });

  it("bootstraps host profile and booking code through one atomic helper", async () => {
    mocks.findHostProfileByAuthUserId
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        authUserId: "auth_user_1",
        displayName: "Alice",
        id: "host_1",
        slotSizeMinutes: 30,
        timezone: "America/Los_Angeles",
        username: "alice",
      });
    const response = await v1.request("https://schedule.pizza/me/bootstrap", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://schedule.pizza",
      },
      body: JSON.stringify({
        username: "Alice",
        timezone: "America/Los_Angeles",
      }),
    }, env);
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      account: {
        profilePath: "/alice",
        bookingCode: "moon-tiger-seven",
        bookingPath: "/alice?code=moon-tiger-seven",
        bookingUrl: "https://schedule.pizza/alice?code=moon-tiger-seven",
      },
    });
    expect(mocks.createHostProfileWithBookingCode).toHaveBeenCalledWith(env.DB, {
      authUserId: "auth_user_1",
      calendarAccountEmail: "alice@example.com",
      calendarId: "primary",
      calendarProvider: "google",
      displayName: "alice",
      id: expect.any(String) as string,
      username: "alice",
      timezone: "America/Los_Angeles",
      slotSizeMinutes: 30,
      now: expect.any(Date) as Date,
    });
    expect(mocks.findHostProfileByUsername).not.toHaveBeenCalled();
  });

  it("rejects cross-site account mutations before rotating booking codes", async () => {
    mocks.findHostProfileByAuthUserId.mockResolvedValue({
      authUserId: "auth_user_1",
      id: "host_1",
      username: "alice",
    });

    const response = await v1.request("https://schedule.pizza/me/booking-code", {
      method: "POST",
      headers: { Origin: "https://evil.example" },
    }, env);

    await expect(response.json()).resolves.toEqual({
      error: {
        code: "forbidden_origin",
        message: "Cross-site account mutation rejected",
      },
    });
    expect(response.status).toBe(403);
    expect(mocks.rotateBookingCode).not.toHaveBeenCalled();
  });

  it("rejects missing-origin account mutations before reading the session", async () => {
    const response = await v1.request("https://schedule.pizza/me/booking-code", {
      method: "POST",
    }, env);

    await expect(response.json()).resolves.toEqual({
      error: {
        code: "forbidden_origin",
        message: "Cross-site account mutation rejected",
      },
    });
    expect(response.status).toBe(403);
    expect(mocks.readAuthSession).not.toHaveBeenCalled();
    expect(mocks.rotateBookingCode).not.toHaveBeenCalled();
  });

  it("rejects account mutations when the trusted origin is not http", async () => {
    const response = await v1.request("https://schedule.pizza/me/booking-code", {
      method: "POST",
      headers: { Origin: "https://schedule.pizza" },
    }, {
      ...env,
      BETTER_AUTH_URL: "ftp://schedule.pizza",
    });

    await expect(response.json()).resolves.toEqual({
      error: {
        code: "runtime_secret_missing",
        message: "Runtime auth URL is missing or invalid",
      },
    });
    expect(response.status).toBe(503);
    expect(mocks.readAuthSession).not.toHaveBeenCalled();
    expect(mocks.rotateBookingCode).not.toHaveBeenCalled();
  });

  it("allows same-site account mutations", async () => {
    mocks.findHostProfileByAuthUserId
      .mockResolvedValueOnce({
        authUserId: "auth_user_1",
        id: "host_1",
        username: "alice",
      })
      .mockResolvedValueOnce({
        authUserId: "auth_user_1",
        displayName: "Alice",
        id: "host_1",
        slotSizeMinutes: 30,
        timezone: "America/Los_Angeles",
        username: "alice",
      });

    const response = await v1.request("https://schedule.pizza/me/booking-code", {
      method: "POST",
      headers: { Origin: "https://schedule.pizza" },
    }, env);

    expect(response.status).toBe(200);
    expect(mocks.rotateBookingCode).toHaveBeenCalledWith(env.DB, {
      hostId: "host_1",
      hostUsername: "alice",
      wordCount: 3,
      label: null,
      now: expect.any(Date) as Date,
    });
  });

  it("returns public booking urls when auth runs on localhost", async () => {
    mocks.findHostProfileByAuthUserId
      .mockResolvedValueOnce({
        authUserId: "auth_user_1",
        id: "host_1",
        username: "alice",
      })
      .mockResolvedValueOnce({
        authUserId: "auth_user_1",
        displayName: "Alice",
        id: "host_1",
        slotSizeMinutes: 30,
        timezone: "America/Los_Angeles",
        username: "alice",
      });

    const response = await v1.request("http://localhost:5173/me/booking-code", {
      method: "POST",
      headers: { Origin: "http://localhost:5173" },
    }, {
      ...env,
      BETTER_AUTH_URL: "http://localhost:5173",
    });
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      account: {
        bookingCode: "sun-river-ten",
        bookingPath: "/alice?code=sun-river-ten",
        bookingUrl: "https://schedule.pizza/alice?code=sun-river-ten",
      },
    });
  });

  it("rotates and returns a fresh booking code when the username changes", async () => {
    mocks.findHostProfileByAuthUserId
      .mockResolvedValueOnce({
        authUserId: "auth_user_1",
        id: "host_1",
        username: "alice",
      })
      .mockResolvedValueOnce({
        authUserId: "auth_user_1",
        displayName: "Alice",
        id: "host_1",
        slotSizeMinutes: 30,
        timezone: "America/Los_Angeles",
        username: "alice-new",
      });
    mocks.updateHostProfile.mockResolvedValue({
      code: "updated_profile",
      bookingCode: "sun-river-ten",
    });

    const response = await v1.request("https://schedule.pizza/account/profile", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://schedule.pizza",
      },
      body: JSON.stringify({
        username: "Alice-New",
        timezone: "America/Los_Angeles",
      }),
    }, env);
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      account: {
        profilePath: "/alice-new",
        bookingCode: "sun-river-ten",
        bookingPath: "/alice-new?code=sun-river-ten",
        bookingUrl: "https://schedule.pizza/alice-new?code=sun-river-ten",
      },
    });
    expect(mocks.updateHostProfile).toHaveBeenCalledWith(env.DB, {
      authUserId: "auth_user_1",
      calendarAccountEmail: "alice@example.com",
      calendarId: "primary",
      calendarProvider: "google",
      currentHostId: "host_1",
      currentUsername: "alice",
      displayName: "alice-new",
      username: "alice-new",
      timezone: "America/Los_Angeles",
      slotSizeMinutes: 30,
      now: expect.any(Date) as Date,
    });
    expect(mocks.rotateBookingCode).not.toHaveBeenCalled();
    expect(mocks.findHostProfileByUsername).not.toHaveBeenCalled();
  });

  it("reports atomic profile rename conflicts as username taken", async () => {
    mocks.findHostProfileByAuthUserId.mockResolvedValueOnce({
      authUserId: "auth_user_1",
      id: "host_1",
      username: "alice",
    });
    mocks.updateHostProfile.mockResolvedValue({
      code: "profile_conflict",
    });

    const response = await v1.request("https://schedule.pizza/account/profile", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://schedule.pizza",
      },
      body: JSON.stringify({
        username: "Alice-New",
        timezone: "America/Los_Angeles",
      }),
    }, env);

    await expect(response.json()).resolves.toEqual({
      error: {
        code: "username_taken",
        message: "Username is taken",
      },
    });
    expect(response.status).toBe(409);
    expect(mocks.findHostProfileByUsername).not.toHaveBeenCalled();
  });
});

describe("group book API body parser", () => {
  it("parses the agent group booking request shape", () => {
    expect(parseGroupBookBody(groupBookBody())).toEqual({
      code: "parsed",
      body: {
        schedule: {
          participants: [
            { username: "alice", bookingCode: "moon-tiger-seven" },
            { username: "bob", bookingCode: "river-lime-harbor" },
          ],
          durationMinutes: 30,
          granularityMinutes: 15,
          maxExactSlotCount: 10,
          maxAlternativeSlotCount: 5,
          timeZone: "America/Los_Angeles",
          window: timeInterval({
            startAtMs: Date.parse("2026-06-26T16:00:00.000Z"),
            endAtMs: Date.parse("2026-06-27T01:00:00.000Z"),
          }),
        },
        slotStartAt: new Date("2026-06-26T17:00:00.000Z"),
        guestName: "Ada",
        email: "ada@example.com",
        emailNormalized: "ada@example.com",
        guestTimezone: "America/Los_Angeles",
      },
    });
  });

  it("accepts schedule links for group booking participants", () => {
    expect(parseGroupBookBody({
      ...groupBookBody(),
      participants: [
        { url: "schedule.pizza/Alice?code=moon tiger seven" },
        { url: "schedule.pizza/bob?code=river-lime-harbor" },
      ],
    })).toEqual({
      code: "parsed",
      body: {
        schedule: {
          participants: [
            { username: "alice", bookingCode: "moon-tiger-seven" },
            { username: "bob", bookingCode: "river-lime-harbor" },
          ],
          durationMinutes: 30,
          granularityMinutes: 15,
          maxExactSlotCount: 10,
          maxAlternativeSlotCount: 5,
          timeZone: "America/Los_Angeles",
          window: timeInterval({
            startAtMs: Date.parse("2026-06-26T16:00:00.000Z"),
            endAtMs: Date.parse("2026-06-27T01:00:00.000Z"),
          }),
        },
        slotStartAt: new Date("2026-06-26T17:00:00.000Z"),
        guestName: "Ada",
        email: "ada@example.com",
        emailNormalized: "ada@example.com",
        guestTimezone: "America/Los_Angeles",
      },
    });
  });

  it("requires guest email before group booking writes can run", () => {
    const body = groupBookBody();
    delete body["email"];

    expect(parseGroupBookBody(body)).toEqual({
      code: "missing_field",
      field: "email",
    });
  });

  it("rejects malformed exact slots before group booking writes can run", () => {
    expect(parseGroupBookBody({
      ...groupBookBody(),
      slot: "not a time",
    })).toEqual({ code: "invalid_field", field: "slot" });
  });
});

describe("account profile API body parser", () => {
  it("parses the agent profile bootstrap shape", () => {
    expect(parseAccountProfileBody({
      username: "Alice",
      timezone: " America/Los_Angeles ",
      displayName: " Ada ",
      slotSizeMinutes: 30,
      calendarId: "primary",
    })).toEqual({
      code: "parsed",
      body: {
        username: "alice",
        timezone: "America/Los_Angeles",
        displayName: "Ada",
        slotSizeMinutes: 30,
        calendarId: "primary",
      },
    });
  });

  it("defaults optional profile fields", () => {
    expect(parseAccountProfileBody({
      username: "alice",
      timezone: "America/Los_Angeles",
    })).toEqual({
      code: "parsed",
      body: {
        username: "alice",
        timezone: "America/Los_Angeles",
        displayName: null,
        slotSizeMinutes: 30,
        calendarId: "primary",
      },
    });
  });

  it.each([
    { body: { timezone: "America/Los_Angeles" }, code: "missing_field", field: "username" },
    { body: { username: "alice" }, code: "missing_field", field: "timezone" },
    {
      body: { username: "!!!", timezone: "America/Los_Angeles" },
      code: "invalid_field",
      field: "username",
    },
    {
      body: { username: "alice", timezone: "Mars/Olympus_Mons" },
      code: "invalid_field",
      field: "timezone",
    },
    {
      body: {
        username: "alice",
        timezone: "America/Los_Angeles",
        slotSizeMinutes: 10,
      },
      code: "invalid_field",
      field: "slotSizeMinutes",
    },
  ] as const)("rejects invalid $field before account writes", ({ body, code, field }) => {
    expect(parseAccountProfileBody(body)).toEqual({ code, field });
  });
});

function healthyDb() {
  return {
    select: () => ({
      from: () => ({
        limit: async () => [{ id: "host_1" }],
      }),
    }),
  };
}

function groupBookBody(): Record<string, unknown> {
  return {
    participants: [
      { user: "Alice", code: "moon tiger seven" },
      { user: "Bob", code: "river lime harbor" },
    ],
    durationMinutes: 30,
    granularityMinutes: 15,
    maxExactSlotCount: 10,
    maxAlternativeSlotCount: 5,
    timeZone: "America/Los_Angeles",
    window: {
      start: "2026-06-26T16:00:00.000Z",
      end: "2026-06-27T01:00:00.000Z",
    },
    slot: "2026-06-26T17:00:00.000Z",
    name: "Ada",
    email: "ada@example.com",
    timezone: "America/Los_Angeles",
  };
}

describe("book API body parser", () => {
  it("parses the agent booking request shape", () => {
    expect(parseBookBody({
      user: "Alice",
      code: "moon tiger seven",
      slot: "2026-06-26T16:00:00.000Z",
      name: "Ada",
      email: "ada@example.com",
      timezone: "America/Los_Angeles",
    })).toEqual({
      code: "parsed",
      body: {
        username: "alice",
        bookingCode: "moon-tiger-seven",
        slotStartAt: new Date("2026-06-26T16:00:00.000Z"),
        guestName: "Ada",
        email: "ada@example.com",
        emailNormalized: "ada@example.com",
        guestTimezone: "America/Los_Angeles",
      },
    });
  });

  it("parses a schedule link as the booking target", () => {
    expect(parseBookBody({
      url: "schedule.pizza/Alice?code=moon tiger seven",
      slot: "2026-06-26T16:00:00.000Z",
      name: "Ada",
      email: "ada@example.com",
      timezone: "America/Los_Angeles",
    })).toEqual({
      code: "parsed",
      body: {
        username: "alice",
        bookingCode: "moon-tiger-seven",
        slotStartAt: new Date("2026-06-26T16:00:00.000Z"),
        guestName: "Ada",
        email: "ada@example.com",
        emailNormalized: "ada@example.com",
        guestTimezone: "America/Los_Angeles",
      },
    });
  });

  it("rejects ambiguous booking target capability fields", () => {
    expect(parseBookBody({
      url: "schedule.pizza/alice?code=moon-tiger-seven",
      user: "alice",
      slot: "2026-06-26T16:00:00.000Z",
      name: "Ada",
      email: "ada@example.com",
    })).toEqual({ code: "invalid_field", field: "url" });
  });

  it("rejects missing required fields before booking-code authorization", () => {
    expect(parseBookBody({
      code: "moon-tiger-seven",
      slot: "2026-06-26T16:00:00.000Z",
      name: "Ada",
    })).toEqual({ code: "missing_field", field: "user" });
  });

  it("requires guest email so Google can invite the booker", () => {
    expect(parseBookBody({
      user: "alice",
      code: "moon-tiger-seven",
      slot: "2026-06-26T16:00:00.000Z",
      name: "Ada",
    })).toEqual({ code: "missing_field", field: "email" });
  });

  it.each([
    {
      name: "malformed users",
      body: {
        user: "!!!",
        code: "moon-tiger-seven",
        slot: "2026-06-26T16:00:00.000Z",
        name: "Ada",
      },
      field: "user",
    },
    {
      name: "malformed booking codes",
      body: {
        user: "alice",
        code: "!!!",
        slot: "2026-06-26T16:00:00.000Z",
        name: "Ada",
      },
      field: "code",
    },
    {
      name: "malformed slots",
      body: {
        user: "alice",
        code: "moon-tiger-seven",
        slot: "not a time",
        name: "Ada",
      },
      field: "slot",
    },
    {
      name: "malformed emails",
      body: {
        user: "alice",
        code: "moon-tiger-seven",
        slot: "2026-06-26T16:00:00.000Z",
        name: "Ada",
        email: "not an email",
      },
      field: "email",
    },
    {
      name: "malformed time zones",
      body: {
        user: "alice",
        code: "moon-tiger-seven",
        slot: "2026-06-26T16:00:00.000Z",
        name: "Ada",
        email: "ada@example.com",
        timezone: "Mars/Olympus_Mons",
      },
      field: "timezone",
    },
  ])("rejects $name as invalid fields", ({ body, field }) => {
    expect(parseBookBody(body)).toEqual({ code: "invalid_field", field });
  });
});
