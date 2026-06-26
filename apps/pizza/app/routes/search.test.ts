import { describe, expect, it } from "vitest";

import { readSearchTarget } from "./search";

describe("search target parsing", () => {
  it("routes usernames to profile pages", () => {
    expect(readSearchTarget("Alice")).toBe("/alice");
  });

  it("routes fully qualified schedule.pizza links", () => {
    expect(readSearchTarget("https://schedule.pizza/alice?code=moon-tiger-seven"))
      .toBe("/alice?code=moon-tiger-seven");
  });

  it("routes bare schedule.pizza links", () => {
    expect(readSearchTarget("schedule.pizza/alice?code=moon-tiger-seven"))
      .toBe("/alice?code=moon-tiger-seven");
  });

  it("rejects external links", () => {
    expect(readSearchTarget("https://example.com/alice?code=moon-tiger-seven"))
      .toBe("/");
  });
});
