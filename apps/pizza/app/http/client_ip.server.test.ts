import { describe, expect, it } from "vitest";

import { readCloudflareClientIpHash } from "./client_ip.server";

describe("Cloudflare client IP", () => {
  it("requires the canonical Cloudflare client IP header", async () => {
    await expect(
      readCloudflareClientIpHash(new Request("https://schedule.pizza")),
    ).resolves.toEqual({ code: "client_ip_unavailable" });
  });

  it("hashes the canonical Cloudflare client IP header", async () => {
    const result = await readCloudflareClientIpHash(
      new Request("https://schedule.pizza", {
        headers: { "CF-Connecting-IP": "203.0.113.4" },
      }),
    );

    expect(result).toEqual({
      code: "ok",
      ipHash:
        "5aa23fc6904a74c72a2a2a9067fc55d767282046799c2e98a281bb73575ce65d",
    });
  });
});
