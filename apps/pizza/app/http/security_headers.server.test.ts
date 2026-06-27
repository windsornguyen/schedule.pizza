import { describe, expect, it } from "vitest";

import { setSecurityHeaders } from "./security_headers.server";

describe("Worker security headers", () => {
  it("prevents capability URLs from leaking through referrers", () => {
    const headers = new Headers();

    setSecurityHeaders(headers);

    expect(headers.get("Referrer-Policy")).toBe("no-referrer");
  });
});
