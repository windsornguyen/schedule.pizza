import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AccountHeader, DocumentSecurityMeta, links } from "./root";

describe("root account header", () => {
  it("carries the launch-video logo mark on every page", () => {
    const html = renderToStaticMarkup(<AccountHeader loggedIn={false} />);

    expect(html).toContain('aria-label="schedule.pizza home"');
    expect(html).toContain('viewBox="0 0 32 32"');
    expect(html).toContain("M10.8 25V8.2");
    expect(html).toContain("schedule.pizza");
  });

  it("keeps signed-in account links grouped", () => {
    const html = renderToStaticMarkup(<AccountHeader loggedIn />);

    expect(html).toContain('<nav class="flex items-center gap-3">');
    expect(html).toContain('href="/dashboard"');
    expect(html).toContain('href="/auth/logout"');
  });
});

describe("root browser chrome", () => {
  it("publishes the launch-video mark to install and favicon surfaces", () => {
    expect(links()).toEqual(expect.arrayContaining([
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/site.webmanifest" },
    ]));
  });
});

describe("root document security", () => {
  it("prevents booking-code URLs from leaking through referrers", () => {
    const html = renderToStaticMarkup(<DocumentSecurityMeta />);

    expect(html).toContain('<meta name="referrer" content="no-referrer"/>');
  });
});
