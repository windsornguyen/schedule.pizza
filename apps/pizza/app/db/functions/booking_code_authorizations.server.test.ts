import { beforeEach, describe, expect, it, vi } from "vitest";

import { authorizeBookingCode } from "./booking_code_authorizations.server";
import type * as bookingCodeAttemptsModule from "./booking_code_attempts.server";

type AsyncMock = (...args: unknown[]) => Promise<unknown>;

const mocks = vi.hoisted(() => ({
  countRecentFailedBookingCodeAttemptsByIp: vi.fn<AsyncMock>(),
  countRecentSuccessfulBookingCodeAttemptsByIpAndHost: vi.fn<AsyncMock>(),
  findActiveBookingCode: vi.fn<AsyncMock>(),
  hashNormalizedBookingCode: vi.fn<AsyncMock>(),
  recordBookingCodeAttempt: vi.fn<AsyncMock>(),
}));

vi.mock("./booking_code_attempts.server", async (importOriginal) => {
  const original =
    await importOriginal<typeof bookingCodeAttemptsModule>();

  return {
    ...original,
    countRecentFailedBookingCodeAttemptsByIp:
      mocks.countRecentFailedBookingCodeAttemptsByIp,
    countRecentSuccessfulBookingCodeAttemptsByIpAndHost:
      mocks.countRecentSuccessfulBookingCodeAttemptsByIpAndHost,
    recordBookingCodeAttempt: mocks.recordBookingCodeAttempt,
  };
});

vi.mock("./booking_codes.server", () => ({
  findActiveBookingCode: mocks.findActiveBookingCode,
  hashNormalizedBookingCode: mocks.hashNormalizedBookingCode,
}));

const db = {} as Parameters<typeof authorizeBookingCode>[0];
const now = new Date("2026-06-26T16:00:00.000Z");

describe("authorizeBookingCode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.countRecentFailedBookingCodeAttemptsByIp.mockResolvedValue(0);
    mocks.countRecentSuccessfulBookingCodeAttemptsByIpAndHost.mockResolvedValue(0);
    mocks.findActiveBookingCode.mockResolvedValue({
      code: { id: "code_1" },
      host: { id: "host_1" },
    });
    mocks.hashNormalizedBookingCode.mockResolvedValue("code_hash");
    mocks.recordBookingCodeAttempt.mockResolvedValue(null);
  });

  it("rate limits failed attempts before hashing or lookup", async () => {
    mocks.countRecentFailedBookingCodeAttemptsByIp.mockResolvedValueOnce(5);

    await expect(authorizeBookingCode(db, {
      bookingCode: "moon-tiger-seven",
      ipHash: "ip_hash",
      now,
      username: "alice",
    })).resolves.toEqual({ code: "booking_code_rate_limited" });
    expect(mocks.hashNormalizedBookingCode).not.toHaveBeenCalled();
    expect(mocks.findActiveBookingCode).not.toHaveBeenCalled();
    expect(mocks.recordBookingCodeAttempt).toHaveBeenCalledWith(db, {
      id: expect.any(String) as string,
      username: "alice",
      hostId: null,
      ipHash: "ip_hash",
      success: false,
      failureReason: "rate_limited",
      createdAt: now,
    });
  });

  it("returns the same invalid result for wrong codes and missing users", async () => {
    mocks.findActiveBookingCode.mockResolvedValueOnce(null);

    await expect(authorizeBookingCode(db, {
      bookingCode: "moon-tiger-seven",
      ipHash: "ip_hash",
      now,
      username: "unknown",
    })).resolves.toEqual({ code: "booking_code_invalid" });
    expect(mocks.findActiveBookingCode).toHaveBeenCalledWith(db, {
      codeHash: "code_hash",
      now,
      username: "unknown",
    });
    expect(
      mocks.countRecentSuccessfulBookingCodeAttemptsByIpAndHost,
    ).not.toHaveBeenCalled();
    expect(mocks.recordBookingCodeAttempt).toHaveBeenCalledWith(db, {
      id: expect.any(String) as string,
      username: "unknown",
      hostId: null,
      ipHash: "ip_hash",
      success: false,
      failureReason: "invalid_code",
      createdAt: now,
    });
  });

  it("rate limits successful code reads before recording another success", async () => {
    mocks.countRecentSuccessfulBookingCodeAttemptsByIpAndHost.mockResolvedValueOnce(120);

    await expect(authorizeBookingCode(db, {
      bookingCode: "moon-tiger-seven",
      ipHash: "ip_hash",
      now,
      username: "alice",
    })).resolves.toEqual({ code: "booking_code_rate_limited" });
    expect(mocks.recordBookingCodeAttempt).toHaveBeenCalledWith(db, {
      id: expect.any(String) as string,
      username: "alice",
      hostId: "host_1",
      ipHash: "ip_hash",
      success: false,
      failureReason: "rate_limited",
      createdAt: now,
    });
    expect(mocks.recordBookingCodeAttempt).not.toHaveBeenCalledWith(
      db,
      expect.objectContaining({ success: true }),
    );
  });
});
