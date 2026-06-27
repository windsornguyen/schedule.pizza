import { describe, expect, it } from "vitest";

import { copyAuthResponseCookies } from "./auth_response_headers.server";

describe("copyAuthResponseCookies", () => {
  it("forwards every auth cookie from a response", () => {
    const source = new Headers();
    source.append("Set-Cookie", "better-auth.state=state; Path=/; HttpOnly");
    source.append("Set-Cookie", "better-auth.callback=callback; Path=/; HttpOnly");

    expect(copyAuthResponseCookies(source).getSetCookie()).toEqual([
      "better-auth.state=state; Path=/; HttpOnly",
      "better-auth.callback=callback; Path=/; HttpOnly",
    ]);
  });
});
