import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import faviconSvg from "../public/favicon.svg?raw";
import ogSvg from "../public/og.svg?raw";
import siteManifest from "../public/site.webmanifest?raw";
import { LOGO_MARK_PATH } from "./components/logo_mark";
import { AccountHeader, DocumentSecurityMeta, links } from "./root";

describe("root account header", () => {
  it("carries the launch-video logo mark on every page", () => {
    const html = renderToStaticMarkup(<AccountHeader currentPath="/" loggedIn={false} />);

    expect(html).toContain('aria-label="schedule.pizza home"');
    expect(html).toContain('viewBox="0 0 32 32"');
    expect(html).toContain(LOGO_MARK_PATH);
    expect(html).toContain("schedule.pizza");
  });

  it("keeps signed-in account links grouped", () => {
    const html = renderToStaticMarkup(<AccountHeader currentPath="/" loggedIn />);

    expect(html).toContain('<nav class="flex items-center gap-3">');
    expect(html).toContain('href="/dashboard"');
    expect(html).toContain('href="/auth/logout"');
  });

  it("does not link the login page to itself", () => {
    const html = renderToStaticMarkup(
      <AccountHeader currentPath="/login" loggedIn={false} />,
    );

    expect(html).not.toContain('href="/login"');
  });
});

describe("root browser chrome", () => {
  it("publishes the launch-video mark to install and favicon surfaces", () => {
    expect(links()).toEqual(expect.arrayContaining([
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      {
        rel: "icon",
        type: "image/x-icon",
        sizes: "16x16 32x32 48x48",
        href: "/favicon.ico",
      },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/site.webmanifest" },
    ]));
  });

  it("uses the same mark in static brand assets", () => {
    expect(faviconSvg).toContain(LOGO_MARK_PATH);
    expect(ogSvg).toContain(LOGO_MARK_PATH);
    expect(JSON.parse(siteManifest)).toMatchObject({
      icons: [
        { src: "/favicon.svg", sizes: "any", type: "image/svg+xml" },
        { src: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
      ],
    });
  });
});

describe("root document security", () => {
  it("prevents booking-code URLs from leaking through referrers", () => {
    const html = renderToStaticMarkup(<DocumentSecurityMeta />);

    expect(html).toContain('<meta name="referrer" content="no-referrer"/>');
  });
});
