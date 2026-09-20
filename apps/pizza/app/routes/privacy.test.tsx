import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import Privacy from "./privacy";
import Terms from "./terms";

describe("privacy page", () => {
  it("discloses the complete Google data lifecycle in the public page", () => {
    const html = renderToStaticMarkup(<Privacy />);

    expect(html).toContain("Google user data");
    expect(html).toContain("OAuth tokens");
    expect(html).toContain("existing event titles");
    expect(html).toContain("calendar.freebusy");
    expect(html).toContain("calendar.events");
    expect(html).toContain("general-purpose AI");
    expect(html).toContain("Google API Services User Data Policy");
    expect(html).toContain("Limited Use requirements");
    expect(html).toContain("Cloudflare D1");
    expect(html).toContain("encrypted at rest");
    expect(html).toContain("not automatically deleted");
    expect(html).toContain("30 days");
    expect(html).toContain("manually");
    expect(html).toContain("mailto:security@schedule.pizza");
    expect(html).toContain("https://myaccount.google.com/connections");
    expect(html).toContain("https://developers.google.com/terms/api-services-user-data-policy");
  });

  it("publishes every review category without template placeholders", () => {
    const html = renderToStaticMarkup(<Privacy />);
    for (const heading of [
      "information we collect", "how we use information", "sharing",
      "storage and security", "retention and deletion", "your choices and rights",
    ]) {
      expect(html).toContain(`>${heading}</h2>`);
    }
    expect(html).not.toMatch(/\[DATE\]|\[INSERT|CompanyName|<mark>/u);
  });

  it("keeps hosted-service terms distinct from the open-source license", () => {
    const html = renderToStaticMarkup(<Terms />);
    expect(html).toContain('href="/privacy"');
    expect(html).toContain("open-source license");
    expect(html).toContain("calendar invitations");
    expect(html).toContain("security@schedule.pizza");
  });
});
