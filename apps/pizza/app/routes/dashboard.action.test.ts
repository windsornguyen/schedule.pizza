import { beforeEach, describe, expect, it, vi } from "vitest";

import type * as AuthServerModule from "@/auth.server";
import { serverContext } from "@/server-context";
import { action } from "./dashboard";

type AsyncMock = (...args: unknown[]) => Promise<unknown>;

const mocks = vi.hoisted(() => ({
  readAuthSession: vi.fn<AsyncMock>(),
}));

vi.mock("@/auth.server", async (importOriginal) => {
  const actual = await importOriginal<typeof AuthServerModule>();

  return {
    ...actual,
    readAuthSession: mocks.readAuthSession,
  };
});

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
    mocks.readAuthSession.mockResolvedValue({
      session: { id: "session_1", userId: "auth_user_1" },
      user: { id: "auth_user_1", email: "alice@example.com" },
    });
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
});

function createActionArgs(request: Request): Parameters<typeof action>[0] {
  return {
    context: {
      get(key: typeof serverContext) {
        if (key !== serverContext) {
          throw new Error("unexpected context key");
        }

        return { env, ctx: {} as ExecutionContext };
      },
    },
    params: {},
    request,
  } as Parameters<typeof action>[0];
}
