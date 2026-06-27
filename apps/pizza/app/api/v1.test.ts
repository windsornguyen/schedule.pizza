import { beforeEach, describe, expect, it, vi } from "vitest";

import type * as AuthServerModule from "@/auth.server";
import type * as BookingCodesModule from "@/db/functions/booking_codes.server";
import type * as HostProfilesModule from "@/db/functions/host_profiles.server";
import { timeInterval } from "@/scheduling/engine";

import {
  parseAccountProfileBody,
  parseBookBody,
  parseGroupBookBody,
  v1,
} from "./v1";

type AsyncMock = (...args: unknown[]) => Promise<unknown>;
type SyncMock = (...args: unknown[]) => unknown;

const mocks = vi.hoisted(() => ({
  createDb: vi.fn<SyncMock>(),
  findActiveBookingCodeForHost: vi.fn<AsyncMock>(),
  findHostProfileByAuthUserId: vi.fn<AsyncMock>(),
  findHostProfileByUsername: vi.fn<AsyncMock>(),
  readAuthSession: vi.fn<AsyncMock>(),
  readGoogleCalendarAccess: vi.fn<AsyncMock>(),
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

vi.mock("@/calendar/google.server", () => ({
  readGoogleCalendarAccess: mocks.readGoogleCalendarAccess,
}));

vi.mock("@/db/client.server", () => ({
  createDb: mocks.createDb,
}));

vi.mock("@/db/functions/booking_codes.server", async (importOriginal) => {
  const actual = await importOriginal<typeof BookingCodesModule>();

  return {
    ...actual,
    findActiveBookingCodeForHost: mocks.findActiveBookingCodeForHost,
    rotateBookingCode: mocks.rotateBookingCode,
  };
});

vi.mock("@/db/functions/host_profiles.server", async (importOriginal) => {
  const actual = await importOriginal<typeof HostProfilesModule>();

  return {
    ...actual,
    findHostProfileByAuthUserId: mocks.findHostProfileByAuthUserId,
    findHostProfileByUsername: mocks.findHostProfileByUsername,
    updateHostProfile: mocks.updateHostProfile,
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
  mocks.findActiveBookingCodeForHost.mockResolvedValue(null);
  mocks.readAuthSession.mockResolvedValue({
    session: { id: "session_1", userId: "auth_user_1" },
    user: { id: "auth_user_1", email: "alice@example.com" },
  });
  mocks.readGoogleCalendarAccess.mockResolvedValue({
    code: "authorized",
    accessToken: "google_access_token",
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
    expect(body["endpoints"]).toMatchObject({
      availability: {
        method: "GET",
        path: "/api/v1/availability",
        params: {
          user: expect.stringContaining("required"),
          code: expect.stringContaining("booking code"),
        },
      },
      bookGroup: {
        method: "POST",
        path: "/api/v1/book-group",
      },
      recommend: {
        method: "POST",
        path: "/api/v1/recommend",
      },
      schedule: {
        method: "POST",
        path: "/api/v1/schedule",
      },
    });
  });

  it("allows browser-hosted agents to read the API descriptor", async () => {
    const response = await v1.request("https://schedule.pizza/", {
      headers: { Origin: "https://agent.example" },
    });

    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
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

describe("account profile API", () => {
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
    mocks.findHostProfileByUsername.mockResolvedValue(null);
    mocks.updateHostProfile.mockResolvedValue({
      code: "updated_profile",
      bookingCode: "sun-river-ten",
    });

    const response = await v1.request("https://schedule.pizza/account/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
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
