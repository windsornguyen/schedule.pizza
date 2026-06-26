import { getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import {
  account,
  booking,
  bookingCode,
  bookingCodeAttempt,
  hostProfile,
  invitation,
  member,
  organization,
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
      getTableName(invitation),
      getTableName(member),
      getTableName(organization),
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
      "invitation",
      "member",
      "organization",
      "rateLimit",
      "session",
      "user",
      "verification",
    ]);
  });
});
