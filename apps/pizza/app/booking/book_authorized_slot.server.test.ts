import { beforeEach, describe, expect, it, vi } from "vitest";

import { bookAuthorizedSlot } from "./book_authorized_slot.server";

type AsyncMock = (...args: unknown[]) => Promise<unknown>;
type SyncMock = (...args: unknown[]) => unknown;

const mocks = vi.hoisted(() => ({
  authorizeBookingCode: vi.fn<AsyncMock>(),
  bookHostSlot: vi.fn<AsyncMock>(),
  createDb: vi.fn<SyncMock>(),
  readCloudflareClientIpHash: vi.fn<AsyncMock>(),
}));

vi.mock("@/booking/book_slot.server", () => ({
  bookHostSlot: mocks.bookHostSlot,
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

const db = {};
const env = { DB: {} as D1Database } as Parameters<typeof bookAuthorizedSlot>[0]["env"];
const slotStartAt = new Date("2030-01-07T17:00:00.000Z");
const slotEndAt = new Date("2030-01-07T17:30:00.000Z");

describe("authorized profile booking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createDb.mockReturnValue(db);
    mocks.readCloudflareClientIpHash.mockResolvedValue({
      code: "ok",
      ipHash: "ip_hash",
    });
    mocks.authorizeBookingCode.mockResolvedValue({
      code: "authorized",
      access: {
        code: { id: "booking_code_1" },
        host: { id: "host_1", username: "alice" },
      },
    });
    mocks.bookHostSlot.mockResolvedValue({
      code: "booked",
      slot: { startAt: slotStartAt, endAt: slotEndAt },
    });
  });

  it("passes the parser-owned normalized guest email to booking writes", async () => {
    await bookAuthorizedSlot({
      bookingCode: "moon-tiger-seven",
      env,
      guestEmail: "Ada@Example.COM",
      guestEmailNormalized: "ada@example.com",
      guestName: "Ada",
      guestTimezone: "America/Los_Angeles",
      request: new Request("https://schedule.pizza/alice"),
      slotStartAt,
      username: "alice",
    });

    expect(mocks.bookHostSlot).toHaveBeenCalledWith(db, expect.objectContaining({
      guestEmail: "Ada@Example.COM",
      guestEmailNormalized: "ada@example.com",
    }));
  });
});
