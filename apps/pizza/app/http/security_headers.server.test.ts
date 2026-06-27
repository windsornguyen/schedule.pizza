import { describe, expect, it } from "vitest";

import { setSecurityHeaders } from "./security_headers.server";

describe("Worker security headers", () => {
  it("prevents capability URLs from leaking through referrers", () => {
    const headers = new Headers();

    setSecurityHeaders(headers);

    expect(headers.get("Referrer-Policy")).toBe("no-referrer");
  });

  it("sets baseline browser hardening headers", () => {
    const headers = new Headers();

    setSecurityHeaders(headers);

    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("X-Frame-Options")).toBe("DENY");
  });
});
