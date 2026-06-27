import { describe, expect, it } from "vitest";

import { readHostCta } from "./_index";

describe("home host call to action", () => {
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
