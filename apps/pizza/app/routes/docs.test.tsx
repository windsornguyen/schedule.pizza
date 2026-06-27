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
    expect(html).toContain("/api/v1/me/bootstrap");
    expect(html).toContain("/api/v1/account/profile");
    expect(html).toContain("/api/v1/me/booking-code");
    expect(html).toContain("/api/v1/account/bookings/booking_123/cancel");
    expect(html).toContain("bookingUrl");
    expect(html).toContain("Renaming a profile revokes previous codes");
    expect(html).toContain("same-site");
    expect(html).toContain("Origin");
    expect(html).toContain("group organizer cancels");
  });

  it("describes recommendation response priority", () => {
    const html = renderToStaticMarkup(<Docs />);

    expect(html).toContain("It returns exact slots first");
    expect(html).toContain("kind: &quot;alternatives&quot;");
    expect(html).toContain("ranked by conflict cost");
  });

  it("keeps availability examples readable while documenting booking links", () => {
    const html = renderToStaticMarkup(<Docs />);

    expect(html).toContain("/api/v1/availability?user=alice&amp;code=moon-tiger-seven");
    expect(html).toContain("Agents can pass the full link as");
    expect(html).toContain("url");
    expect(html).not.toContain("https%3A%2F%2Fschedule.pizza");
  });
});
