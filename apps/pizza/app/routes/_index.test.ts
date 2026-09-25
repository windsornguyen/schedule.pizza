import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { createElement } from "react";
import Home, { HomeSearchForm } from "./_index";

describe("home host call to action", () => {
  it("makes username lookup discoverable without keyboard knowledge", () => {
    const html = renderToStaticMarkup(HomeSearchForm());

    expect(html).toContain('name="q"');
    expect(html).toContain('type="submit"');
    expect(html).toContain(">go</button>");
  });

  it("leaves account navigation to the header", () => {
    const html = renderToStaticMarkup(createElement(Home));
    expect(html).not.toContain('href="/dashboard"');
    expect(html).not.toContain("create your username and booking code");
  });
});
