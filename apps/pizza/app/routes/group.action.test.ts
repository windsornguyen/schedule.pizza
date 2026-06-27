import { beforeEach, describe, expect, it, vi } from "vitest";

import { serverContext } from "@/server-context";
import { action } from "./group";

type AsyncMock = (...args: unknown[]) => Promise<unknown>;
type SyncMock = (...args: unknown[]) => unknown;

const mocks = vi.hoisted(() => ({
  bookGroupSlot: vi.fn<AsyncMock>(),
  createDb: vi.fn<SyncMock>(),
  readCloudflareClientIpHash: vi.fn<AsyncMock>(),
}));

vi.mock("@/booking/book_group_slot.server", () => ({
  bookGroupSlot: mocks.bookGroupSlot,
}));

vi.mock("@/db/client.server", () => ({
  createDb: mocks.createDb,
}));

vi.mock("@/http/client_ip.server", () => ({
  readCloudflareClientIpHash: mocks.readCloudflareClientIpHash,
}));

const db = {};
const env = {
  DB: {} as D1Database,
  GOOGLE_CLIENT_ID: "google_client_id",
  GOOGLE_CLIENT_SECRET: "google_client_secret",
};

describe("group scheduling action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createDb.mockReturnValue(db);
    mocks.readCloudflareClientIpHash.mockResolvedValue({
      code: "ok",
      ipHash: "ip_hash",
    });
  });

  it("passes the selected schedule timezone into group bookings", async () => {
    mocks.bookGroupSlot.mockResolvedValueOnce({
      code: "booked",
      slot: {
        startAt: new Date("2030-01-07T17:00:00.000Z"),
        endAt: new Date("2030-01-07T17:30:00.000Z"),
      },
    });

    await expect(action(createActionArgs(groupBookingRequest()))).resolves.toMatchObject({
      code: "booked",
      timeZone: "America/Los_Angeles",
    });
    expect(mocks.bookGroupSlot).toHaveBeenCalledWith(db, expect.objectContaining({
      guestTimezone: "America/Los_Angeles",
      source: "web",
    }));
  });

  it("maps booking state transition failures to booking unavailable", async () => {
    mocks.bookGroupSlot.mockResolvedValueOnce({
      code: "booking_confirmation_failed",
    });

    await expect(action(createActionArgs(groupBookingRequest()))).resolves.toEqual({
      code: "booking_unavailable",
      values: {
        durationMinutes: "30",
        granularityMinutes: "15",
        participants: "schedule.pizza/alice?code=moon-tiger-seven",
        timeZone: "America/Los_Angeles",
      },
    });
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

function groupBookingRequest() {
  const formData = new FormData();
  formData.set("intent", "book_group");
  formData.set("participants", "schedule.pizza/alice?code=moon-tiger-seven");
  formData.set("durationMinutes", "30");
  formData.set("granularityMinutes", "15");
  formData.set("timeZone", "America/Los_Angeles");
  formData.set("timezone", "America/Los_Angeles");
  formData.set("slot", "2030-01-07T17:00:00.000Z");
  formData.set("name", "Ada");
  formData.set("email", "ada@example.com");

  return new Request("https://schedule.pizza/group", {
    method: "POST",
    headers: { "CF-Connecting-IP": "203.0.113.10" },
    body: formData,
  });
}
