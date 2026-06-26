import { describe, expect, it } from "vitest";

import { parseBookBody } from "./v1";

describe("book API body parser", () => {
  it("parses the agent booking request shape", () => {
    expect(parseBookBody({
      user: "Alice",
      code: "moon tiger seven",
      slot: "2026-06-26T16:00:00.000Z",
      name: "Ada",
      email: "ada@example.com",
      timezone: "America/Los_Angeles",
    })).toEqual({
      code: "parsed",
      body: {
        username: "alice",
        bookingCode: "moon-tiger-seven",
        slotStartAt: new Date("2026-06-26T16:00:00.000Z"),
        guestName: "Ada",
        email: "ada@example.com",
        emailNormalized: "ada@example.com",
        guestTimezone: "America/Los_Angeles",
      },
    });
  });

  it("rejects missing required fields before booking-code authorization", () => {
    expect(parseBookBody({
      code: "moon-tiger-seven",
      slot: "2026-06-26T16:00:00.000Z",
      name: "Ada",
    })).toEqual({ code: "missing_field", field: "user" });
  });

  it.each([
    {
      name: "malformed users",
      body: {
        user: "!!!",
        code: "moon-tiger-seven",
        slot: "2026-06-26T16:00:00.000Z",
        name: "Ada",
      },
      field: "user",
    },
    {
      name: "malformed booking codes",
      body: {
        user: "alice",
        code: "!!!",
        slot: "2026-06-26T16:00:00.000Z",
        name: "Ada",
      },
      field: "code",
    },
    {
      name: "malformed slots",
      body: {
        user: "alice",
        code: "moon-tiger-seven",
        slot: "not a time",
        name: "Ada",
      },
      field: "slot",
    },
  ])("rejects $name as invalid fields", ({ body, field }) => {
    expect(parseBookBody(body)).toEqual({ code: "invalid_field", field });
  });
});
