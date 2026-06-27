import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AccountHeader } from "./root";

describe("root account header", () => {
  it("carries the launch-video logo mark on every page", () => {
    const html = renderToStaticMarkup(<AccountHeader loggedIn={false} />);

    expect(html).toContain('aria-label="schedule.pizza home"');
    expect(html).toContain(">p</span>");
    expect(html).toContain("schedule.pizza");
  });
});
