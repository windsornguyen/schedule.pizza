import { afterEach, describe, expect, it, vi } from "vitest";
import { withDatabase } from "./client.server";

const state = vi.hoisted(() => ({
  close: vi.fn<() => Promise<void>>(),
  onError: null as ((error: Error) => void) | null,
}));

vi.mock("pg", () => {
  class Pool {
    on(_event: string, handler: (error: Error) => void) {
      state.onError = handler;
    }
    async end() {
      await state.close();
    }
  }
  return { Pool, default: { Pool } };
});

afterEach(() => {
  vi.restoreAllMocks();
  state.close.mockClear();
});

describe("request database ownership", () => {
  it("sanitizes idle connection errors and closes the request pool exactly once", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await withDatabase("postgres://unused", async () => {
      if (!state.onError) throw new Error("pool error handler missing");
      state.onError(new Error("credential-bearing error must not be logged"));
      return "finished";
    });
    expect(result).toBe("finished");
    expect(log).toHaveBeenCalledWith({
      code: "postgres_idle_connection_error",
      name: "Error",
    });
    expect(state.close).toHaveBeenCalledTimes(1);
  });

  it("awaits pool cleanup when the request fails", async () => {
    await expect(
      withDatabase("postgres://unused", async () => {
        throw new Error("request failed");
      }),
    ).rejects.toThrow("request failed");
    expect(state.close).toHaveBeenCalledTimes(1);
  });
});
