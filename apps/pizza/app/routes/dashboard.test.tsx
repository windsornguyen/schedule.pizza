import { renderToStaticMarkup } from "react-dom/server";
import { createRoutesStub } from "react-router";
import { describe, expect, it } from "vitest";

import {
  parseProfileForm,
  readDefaultUsernameFromEmail,
} from "@/dashboard/profile_form";
import {
  DashboardContent,
  formatDashboardBookingUrl,
  readActiveBookingCodeNotice,
  readBookingCodeActionLabel,
} from "./dashboard";

describe("dashboard profile form parser", () => {
  it("normalizes valid profile setup input", () => {
    const formData = new FormData();
    formData.set("username", "Alice");
    formData.set("timezone", "America/Los_Angeles");
    formData.set("slotSizeMinutes", "30");

    expect(parseProfileForm(formData)).toEqual({
      code: "parsed",
      username: "alice",
      timezone: "America/Los_Angeles",
      slotSizeMinutes: 30,
    });
  });

  it("rejects unsupported slot sizes", () => {
    const formData = new FormData();
    formData.set("username", "alice");
    formData.set("timezone", "America/Los_Angeles");
    formData.set("slotSizeMinutes", "17");

    expect(parseProfileForm(formData)).toEqual({
      code: "invalid_field",
      field: "slotSizeMinutes",
    });
  });

  it("rejects non-numeric slot size suffixes", () => {
    const formData = new FormData();
    formData.set("username", "alice");
    formData.set("timezone", "America/Los_Angeles");
    formData.set("slotSizeMinutes", "30abc");

    expect(parseProfileForm(formData)).toEqual({
      code: "invalid_field",
      field: "slotSizeMinutes",
    });
  });

  it("trims valid time zones", () => {
    const formData = new FormData();
    formData.set("username", "alice");
    formData.set("timezone", " America/Los_Angeles ");
    formData.set("slotSizeMinutes", "30");

    expect(parseProfileForm(formData)).toEqual({
      code: "parsed",
      username: "alice",
      timezone: "America/Los_Angeles",
      slotSizeMinutes: 30,
    });
  });

  it("derives a username default from the signed-in email", () => {
    expect(readDefaultUsernameFromEmail("Alice.Example+demo@example.com")).toBe(
      "alice-example-demo",
    );
  });

  it("drops unusable default usernames", () => {
    expect(readDefaultUsernameFromEmail("++@example.com")).toBe("");
  });

  it("formats the dashboard share link as an absolute schedule.pizza URL", () => {
    expect(formatDashboardBookingUrl({
      bookingCode: "moon-tiger-seven",
      username: "alice",
    })).toBe("https://schedule.pizza/alice?code=moon-tiger-seven");
  });

  it("tells hosts when there is no active booking code", () => {
    expect(readActiveBookingCodeNotice({
      calendarStatus: "connected",
      hasActiveBookingCode: false,
    })).toBe(
      "no share link yet. create one to reveal the code.",
    );
  });

  it("tells hosts when an active booking code is hidden", () => {
    expect(readActiveBookingCodeNotice({
      calendarStatus: "connected",
      hasActiveBookingCode: true,
    })).toBe(
      "a share link exists. create a new one to reveal it and revoke the old one.",
    );
  });

  it("tells hosts when calendar reconnect pauses an active code", () => {
    expect(readActiveBookingCodeNotice({
      calendarStatus: "reconnect_required",
      hasActiveBookingCode: true,
    })).toBe(
      "a share link exists. reconnect google calendar before people or agents can see times.",
    );
  });

  it("names booking-code actions by the host outcome", () => {
    expect(readBookingCodeActionLabel(false)).toBe("create share link");
    expect(readBookingCodeActionLabel(true)).toBe("create new share link");
  });

  it("renders a newly created share link before upcoming bookings", () => {
    const Stub = createRoutesStub([{
      Component: () => <DashboardContent
        actionData={{
          code: "created_code",
          bookingCode: "moon-tiger-seven",
          username: "alice",
        }}
        loaderData={{
          email: "alice@example.com",
          profile: {
            bookings: [{
              canCancel: true,
              guestEmail: "ada@example.com",
              guestName: "Ada",
              id: "booking_1",
              slot: {
                start: "2030-01-07T17:00:00.000Z",
                end: "2030-01-07T17:30:00.000Z",
              },
            }],
            calendarStatus: "connected",
            hasActiveBookingCode: true,
            slotSizeMinutes: 30,
            timezone: "America/Los_Angeles",
            username: "alice",
          },
        }}
      />,
      path: "/dashboard",
    }]);
    const html = renderToStaticMarkup(
      <Stub initialEntries={["/dashboard"]} />,
    );

    expect(html.indexOf("moon-tiger-seven")).toBeLessThan(
      html.indexOf("upcoming"),
    );
  });
});
