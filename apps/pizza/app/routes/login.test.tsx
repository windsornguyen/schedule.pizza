import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type * as AuthServerModule from "@/auth.server";
import { serverContext } from "@/server-context";
import { loader, default as Login } from "./login";

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
  DB: {} as D1Database,
  GOOGLE_CLIENT_ID: "google_client_id",
  GOOGLE_CLIENT_SECRET: "google_client_secret",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.readAuthSession.mockResolvedValue(null);
});

describe("login page", () => {
  it("explains google calendar access before oauth", () => {
    const html = renderToStaticMarkup(<Login />);

    expect(html).toContain("free/busy access");
    expect(html).toContain("event access");
    expect(html).toContain("app verification screen");
  });

  it("renders for guests", async () => {
    await expect(loader(createLoaderArgs())).resolves.toBeNull();
  });

  it("redirects signed-in users to the dashboard", async () => {
    mocks.readAuthSession.mockResolvedValueOnce({
      session: { id: "session_1", userId: "user_1" },
      user: { id: "user_1", email: "alice@example.com" },
    });

    let thrown: unknown;

    try {
      await loader(createLoaderArgs());
    } catch (error: unknown) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Response);

    if (!(thrown instanceof Response)) {
      throw new Error("expected signed-in login loader to redirect");
    }

    expect(thrown.status).toBe(302);
    expect(thrown.headers.get("Location")).toBe("/dashboard");
  });
});

function createLoaderArgs(): Parameters<typeof loader>[0] {
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
    request: new Request("https://schedule.pizza/login"),
  } as Parameters<typeof loader>[0];
}
