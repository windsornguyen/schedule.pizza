import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { HomeSearchForm, readHostCta } from "./_index";

describe("home host call to action", () => {
  it("makes username lookup discoverable without keyboard knowledge", () => {
    const html = renderToStaticMarkup(HomeSearchForm());

    expect(html).toContain('name="q"');
    expect(html).toContain('type="submit"');
    expect(html).toContain(">go</button>");
  });

  it("lets new hosts start from the public homepage", () => {
    expect(readHostCta(false)).toEqual({
      href: "/login",
      text: "sign in with google",
    });
  });

  it("sends signed-in hosts to the dashboard", () => {
    expect(readHostCta(true)).toEqual({
      href: "/dashboard",
      text: "dashboard",
    });
  });
});
