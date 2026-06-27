import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServerEnv } from "@/server-context";
import { serverContext } from "@/server-context";
import { loader } from "./profile";

type AsyncMock = (...args: unknown[]) => Promise<unknown>;
type SyncMock = (...args: unknown[]) => unknown;

const mocks = vi.hoisted(() => ({
  authorizeBookingCode: vi.fn<AsyncMock>(),
  createDb: vi.fn<SyncMock>(),
  listHostAvailableSlots: vi.fn<AsyncMock>(),
  readCloudflareClientIpHash: vi.fn<AsyncMock>(),
}));

vi.mock("@/db/client.server", () => ({
  createDb: mocks.createDb,
}));

vi.mock("@/db/functions/booking_code_authorizations.server", () => ({
  authorizeBookingCode: mocks.authorizeBookingCode,
}));

vi.mock("@/http/client_ip.server", () => ({
  readCloudflareClientIpHash: mocks.readCloudflareClientIpHash,
}));

vi.mock("@/scheduling/host_availability.server", () => ({
  listHostAvailableSlots: mocks.listHostAvailableSlots,
}));

const db = {};
const env = {
  DB: {} as D1Database,
  GOOGLE_CLIENT_ID: "google_client_id",
  GOOGLE_CLIENT_SECRET: "google_client_secret",
} as ServerEnv;

describe("profile loader booking-code privacy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorizeBookingCode.mockResolvedValue({ code: "booking_code_invalid" });
    mocks.createDb.mockReturnValue(db);
    mocks.listHostAvailableSlots.mockResolvedValue({
      code: "listed",
      slots: [],
    });
    mocks.readCloudflareClientIpHash.mockResolvedValue({
      code: "ok",
      ipHash: "ip_hash",
    });
  });

  it("does not authorize or list slots when the code is missing", async () => {
    await expect(loader(createLoaderArgs({
      requestUrl: "https://schedule.pizza/Alice",
      username: "Alice",
    }))).resolves.toEqual({
      state: "code_required",
      username: "alice",
    });

    expect(mocks.authorizeBookingCode).not.toHaveBeenCalled();
    expect(mocks.listHostAvailableSlots).not.toHaveBeenCalled();
  });

  it("shows the same code-required state for wrong codes and missing users", async () => {
    await expect(loader(createLoaderArgs({
      requestUrl: "https://schedule.pizza/alice?code=wrong-code-alpha",
      username: "alice",
    }))).resolves.toEqual({
      state: "code_required",
      username: "alice",
    });
    await expect(loader(createLoaderArgs({
      requestUrl: "https://schedule.pizza/unknown-user?code=wrong-code-alpha",
      username: "unknown-user",
    }))).resolves.toEqual({
      state: "code_required",
      username: "unknown-user",
    });

    expect(mocks.authorizeBookingCode).toHaveBeenCalledTimes(2);
    expect(mocks.listHostAvailableSlots).not.toHaveBeenCalled();
  });
});

function createLoaderArgs(input: {
  readonly requestUrl: string;
  readonly username: string;
}): Parameters<typeof loader>[0] {
  return {
    context: {
      get(key: typeof serverContext) {
        if (key !== serverContext) {
          throw new Error("unexpected context key");
        }

        return { env, ctx: {} as ExecutionContext };
      },
    },
    params: { username: input.username },
    request: new Request(input.requestUrl, {
      headers: { "CF-Connecting-IP": "203.0.113.10" },
    }),
  } as Parameters<typeof loader>[0];
}
