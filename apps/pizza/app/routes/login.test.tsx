import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import Login from "./login";

describe("login page", () => {
  it("explains google calendar access before oauth", () => {
    const html = renderToStaticMarkup(<Login />);

    expect(html).toContain("free/busy access");
    expect(html).toContain("event access");
    expect(html).toContain("app verification screen");
  });
});
