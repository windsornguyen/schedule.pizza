import { beforeEach, describe, expect, it, vi } from "vitest";

import type * as AuthServerModule from "@/auth.server";
import type * as DbClientModule from "@/db/client.server";
import type * as HostProfilesModule from "@/db/functions/host_profiles.server";
import type * as CalendarStatusModule from "@/dashboard/calendar_status.server";
import { serverContext } from "@/server-context";
import { action } from "./dashboard";

type AsyncMock = (...args: unknown[]) => Promise<unknown>;
type SyncMock = (...args: unknown[]) => unknown;

const mocks = vi.hoisted(() => ({
  createDb: vi.fn<SyncMock>(),
  createHostProfileWithBookingCode: vi.fn<AsyncMock>(),
  findHostProfileByAuthUserId: vi.fn<AsyncMock>(),
  readAuthSession: vi.fn<AsyncMock>(),
  readCalendarStatus: vi.fn<AsyncMock>(),
}));

vi.mock("@/auth.server", async (importOriginal) => {
  const actual = await importOriginal<typeof AuthServerModule>();

  return {
    ...actual,
    readAuthSession: mocks.readAuthSession,
  };
});

vi.mock("@/dashboard/calendar_status.server", async (importOriginal) => {
  const actual = await importOriginal<typeof CalendarStatusModule>();

  return {
    ...actual,
    readCalendarStatus: mocks.readCalendarStatus,
  };
});

vi.mock("@/db/client.server", async (importOriginal) => {
  const actual = await importOriginal<typeof DbClientModule>();

  return {
    ...actual,
    createDb: mocks.createDb,
  };
});

vi.mock("@/db/functions/host_profiles.server", async (importOriginal) => {
  const actual = await importOriginal<typeof HostProfilesModule>();

  return {
    ...actual,
    createHostProfileWithBookingCode: mocks.createHostProfileWithBookingCode,
    findHostProfileByAuthUserId: mocks.findHostProfileByAuthUserId,
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

describe("dashboard action origin checks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createDb.mockReturnValue(db);
    mocks.createHostProfileWithBookingCode.mockResolvedValue({
      code: "created_profile",
      bookingCode: "moon-tiger-seven",
      profile: { id: "host_1", username: "alice" },
    });
    mocks.findHostProfileByAuthUserId.mockResolvedValue(null);
    mocks.readAuthSession.mockResolvedValue({
      session: { id: "session_1", userId: "auth_user_1" },
      user: { id: "auth_user_1", email: "alice@example.com" },
    });
    mocks.readCalendarStatus.mockResolvedValue("connected");
  });

  it("rejects cross-site dashboard mutations before reading the session", async () => {
    const formData = new FormData();
    formData.set("intent", "create_code");

    let thrown: unknown;

    try {
      await action(createActionArgs(new Request("https://schedule.pizza/dashboard", {
        method: "POST",
        headers: { Origin: "https://evil.example" },
        body: formData,
      })));
    } catch (error: unknown) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Response);

    if (!(thrown instanceof Response)) {
      throw new Error("expected cross-site dashboard action to throw");
    }

    expect(thrown.status).toBe(403);
    await expect(thrown.text()).resolves.toBe("forbidden_origin");
    expect(mocks.readAuthSession).not.toHaveBeenCalled();
  });

  it("rejects dashboard mutations without origin before reading the session", async () => {
    const formData = new FormData();
    formData.set("intent", "create_code");

    let thrown: unknown;

    try {
      await action(createActionArgs(new Request("https://schedule.pizza/dashboard", {
        method: "POST",
        body: formData,
      })));
    } catch (error: unknown) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Response);

    if (!(thrown instanceof Response)) {
      throw new Error("expected missing-origin dashboard action to throw");
    }

    expect(thrown.status).toBe(403);
    await expect(thrown.text()).resolves.toBe("forbidden_origin");
    expect(mocks.readAuthSession).not.toHaveBeenCalled();
  });

  it("rejects dashboard mutations when the trusted origin is not http", async () => {
    const formData = new FormData();
    formData.set("intent", "create_code");

    let thrown: unknown;

    try {
      await action(createActionArgs(
        new Request("https://schedule.pizza/dashboard", {
          method: "POST",
          headers: { Origin: "https://schedule.pizza" },
          body: formData,
        }),
        { ...env, BETTER_AUTH_URL: "ftp://schedule.pizza" },
      ));
    } catch (error: unknown) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Response);

    if (!(thrown instanceof Response)) {
      throw new Error("expected invalid trusted origin to throw");
    }

    expect(thrown.status).toBe(503);
    await expect(thrown.text()).resolves.toBe("runtime_secret_missing");
    expect(mocks.readAuthSession).not.toHaveBeenCalled();
  });

  it("fails closed before profile creation when the account email is missing", async () => {
    mocks.readAuthSession.mockResolvedValueOnce({
      session: { id: "session_1", userId: "auth_user_1" },
      user: { id: "auth_user_1", email: "" },
    });
    const formData = new FormData();
    formData.set("intent", "create_profile");
    formData.set("username", "alice");
    formData.set("timezone", "America/Los_Angeles");
    formData.set("slotSizeMinutes", "30");

    await expect(action(createActionArgs(new Request("https://schedule.pizza/dashboard", {
      method: "POST",
      headers: { Origin: "https://schedule.pizza" },
      body: formData,
    })))).resolves.toEqual({ code: "auth_user_email_missing" });
    expect(mocks.findHostProfileByAuthUserId).not.toHaveBeenCalled();
    expect(mocks.readCalendarStatus).not.toHaveBeenCalled();
    expect(mocks.createHostProfileWithBookingCode).not.toHaveBeenCalled();
  });
});

function createActionArgs(
  request: Request,
  actionEnv = env,
): Parameters<typeof action>[0] {
  return {
    context: {
      get(key: typeof serverContext) {
        if (key !== serverContext) {
          throw new Error("unexpected context key");
        }

        return { env: actionEnv, ctx: {} as ExecutionContext };
      },
    },
    params: {},
    request,
  } as Parameters<typeof action>[0];
}
