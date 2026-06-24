import { getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import {
  account,
  booking,
  bookingCode,
  bookingCodeAttempt,
  hostProfile,
  rateLimit,
  session,
  user,
  verification,
} from "./index";

describe("database schema", () => {
  it("exports the expected table names", () => {
    expect([
      getTableName(account),
      getTableName(booking),
      getTableName(bookingCode),
      getTableName(bookingCodeAttempt),
      getTableName(hostProfile),
      getTableName(rateLimit),
      getTableName(session),
      getTableName(user),
      getTableName(verification),
    ]).toEqual([
      "account",
      "booking",
      "booking_code",
      "booking_code_attempt",
      "host_profile",
      "rateLimit",
      "session",
      "user",
      "verification",
    ]);
  });
});
