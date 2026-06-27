import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import Privacy from "./privacy";

describe("privacy page", () => {
  it("discloses google calendar data use", () => {
    const html = renderToStaticMarkup(<Privacy />);

    expect(html).toContain("Google user data");
    expect(html).toContain("OAuth tokens");
    expect(html).toContain("Event details are not shown to bookers");
    expect(html).toContain("does not sell Google user data");
  });
});
