import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import Docs from "./docs";

const LAUNCH_BASELINE_MS = Date.parse("2026-06-27T00:00:00.000Z");
const UTC_TIMESTAMP_PATTERN = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.000Z/gu;

describe("docs page examples", () => {
  it("keeps public booking examples in the future", () => {
    const html = renderToStaticMarkup(<Docs />);
    const timestamps = html.match(UTC_TIMESTAMP_PATTERN) ?? [];

    expect(timestamps.length).toBeGreaterThan(0);
    expect(
      timestamps.every((timestamp) => Date.parse(timestamp) > LAUNCH_BASELINE_MS),
    ).toBe(true);
  });

  it("keeps launch docs free of roadmap disclaimers", () => {
    const html = renderToStaticMarkup(<Docs />);

    expect(html).not.toContain("not exposed yet");
    expect(html).not.toContain("not supported yet");
  });

  it("documents host agent access to generated booking urls", () => {
    const html = renderToStaticMarkup(<Docs />);

    expect(html).toContain("/api/v1/account");
    expect(html).toContain("bookingUrl");
  });

  it("teaches agents to call availability with a booking link", () => {
    const html = renderToStaticMarkup(<Docs />);

    expect(html).toContain("/api/v1/availability?url=");
    expect(html).not.toContain("/api/v1/availability?user=");
  });
});
