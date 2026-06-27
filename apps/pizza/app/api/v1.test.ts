import { describe, expect, it } from "vitest";

import { timeInterval } from "@/scheduling/engine";

import { parseBookBody, parseGroupBookBody, v1 } from "./v1";

describe("v1 API CORS", () => {
  it("describes the API version without hardcoding release metadata", async () => {
    const response = await v1.request("https://schedule.pizza/");
    const body = await response.json() as Record<string, unknown>;

    expect(body["name"]).toBe("schedule.pizza");
    expect(body["apiVersion"]).toBe("v1");
    expect(body["version"]).toBeUndefined();
  });

  it("allows browser-hosted agents to read the API descriptor", async () => {
    const response = await v1.request("https://schedule.pizza/", {
      headers: { Origin: "https://agent.example" },
    });

    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("allows browser-hosted agents to preflight JSON schedule requests", async () => {
    const response = await v1.request("https://schedule.pizza/schedule", {
      method: "OPTIONS",
      headers: {
        Origin: "https://agent.example",
        "Access-Control-Request-Headers": "content-type",
        "Access-Control-Request-Method": "POST",
      },
    });

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe(
      "GET,POST,OPTIONS",
    );
    expect(response.headers.get("Access-Control-Allow-Headers")).toBe(
      "Content-Type",
    );
  });
});

describe("group book API body parser", () => {
  it("parses the agent group booking request shape", () => {
    expect(parseGroupBookBody(groupBookBody())).toEqual({
      code: "parsed",
      body: {
        schedule: {
          participants: [
            { username: "alice", bookingCode: "moon-tiger-seven" },
            { username: "bob", bookingCode: "river-lime-harbor" },
          ],
          durationMinutes: 30,
          granularityMinutes: 15,
          maxExactSlotCount: 10,
          maxAlternativeSlotCount: 5,
          timeZone: "America/Los_Angeles",
          window: timeInterval({
            startAtMs: Date.parse("2026-06-26T16:00:00.000Z"),
            endAtMs: Date.parse("2026-06-27T01:00:00.000Z"),
          }),
        },
        slotStartAt: new Date("2026-06-26T17:00:00.000Z"),
        guestName: "Ada",
        email: "ada@example.com",
        emailNormalized: "ada@example.com",
        guestTimezone: "America/Los_Angeles",
      },
    });
  });

  it("requires guest email before group booking writes can run", () => {
    const body = groupBookBody();
    delete body["email"];

    expect(parseGroupBookBody(body)).toEqual({
      code: "missing_field",
      field: "email",
    });
  });

  it("rejects malformed exact slots before group booking writes can run", () => {
    expect(parseGroupBookBody({
      ...groupBookBody(),
      slot: "not a time",
    })).toEqual({ code: "invalid_field", field: "slot" });
  });
});

function groupBookBody(): Record<string, unknown> {
  return {
    participants: [
      { user: "Alice", code: "moon tiger seven" },
      { user: "Bob", code: "river lime harbor" },
    ],
    durationMinutes: 30,
    granularityMinutes: 15,
    maxExactSlotCount: 10,
    maxAlternativeSlotCount: 5,
    timeZone: "America/Los_Angeles",
    window: {
      start: "2026-06-26T16:00:00.000Z",
      end: "2026-06-27T01:00:00.000Z",
    },
    slot: "2026-06-26T17:00:00.000Z",
    name: "Ada",
    email: "ada@example.com",
    timezone: "America/Los_Angeles",
  };
}

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

  it("requires guest email so Google can invite the booker", () => {
    expect(parseBookBody({
      user: "alice",
      code: "moon-tiger-seven",
      slot: "2026-06-26T16:00:00.000Z",
      name: "Ada",
    })).toEqual({ code: "missing_field", field: "email" });
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
    {
      name: "malformed emails",
      body: {
        user: "alice",
        code: "moon-tiger-seven",
        slot: "2026-06-26T16:00:00.000Z",
        name: "Ada",
        email: "not an email",
      },
      field: "email",
    },
    {
      name: "malformed time zones",
      body: {
        user: "alice",
        code: "moon-tiger-seven",
        slot: "2026-06-26T16:00:00.000Z",
        name: "Ada",
        email: "ada@example.com",
        timezone: "Mars/Olympus_Mons",
      },
      field: "timezone",
    },
  ])("rejects $name as invalid fields", ({ body, field }) => {
    expect(parseBookBody(body)).toEqual({ code: "invalid_field", field });
  });
});
