import { renderToStaticMarkup } from "react-dom/server";
import { createRoutesStub } from "react-router";
import { describe, expect, it } from "vitest";

import { GroupContent } from "./group";

describe("group scheduling page", () => {
  it("renders exact slots once as booking choices", () => {
    const html = renderGroup({
      code: "scheduled",
      result: {
        kind: "exact",
        slots: [{
          end: "2030-01-07T17:30:00.000Z",
          start: "2030-01-07T17:00:00.000Z",
        }],
      },
      timeZone: "America/Los_Angeles",
      values: groupValues(),
    });

    expect(html.match(/Mon, Jan 7, 9:00 AM - 9:30 AM PST/gu)).toHaveLength(1);
    expect(html).toContain("book group");
    expect(html).not.toContain('name="timezone"');
  });

  it("renders alternatives with conflicts but no booking form", () => {
    const html = renderGroup({
      code: "scheduled",
      result: {
        kind: "alternatives",
        slots: [{
          conflictCost: 4,
          hardConflicts: [{
            user: "alice",
            interval: {
              end: "2030-01-07T17:30:00.000Z",
              start: "2030-01-07T17:00:00.000Z",
            },
          }],
          slot: {
            end: "2030-01-07T18:30:00.000Z",
            start: "2030-01-07T18:00:00.000Z",
          },
          softConflicts: [{
            moveCost: 2,
            user: "bob",
            interval: {
              end: "2030-01-07T18:30:00.000Z",
              start: "2030-01-07T18:00:00.000Z",
            },
          }],
        }],
      },
      timeZone: "America/Los_Angeles",
      values: groupValues(),
    });

    expect(html).toContain("closest times");
    expect(html).toContain("Mon, Jan 7, 10:00 AM - 10:30 AM PST");
    expect(html).toContain("cost 4; alice is busy");
    expect(html).toContain("bob can move");
    expect(html).not.toContain("book group");
  });

  it("renders no-candidate scheduling results", () => {
    const html = renderGroup({
      code: "scheduled",
      result: { kind: "none", reason: "no_candidate_slots" },
      timeZone: "America/Los_Angeles",
      values: groupValues(),
    });

    expect(html).toContain("no candidate times in the next two weeks.");
  });

  it("renders booking confirmation", () => {
    const html = renderGroup({
      code: "booked",
      slot: {
        end: "2030-01-07T17:30:00.000Z",
        start: "2030-01-07T17:00:00.000Z",
      },
      timeZone: "America/Los_Angeles",
      values: groupValues(),
    });

    expect(html).toContain("booked Mon, Jan 7, 9:00 AM - 9:30 AM PST.");
    expect(html).toContain("everyone gets a calendar invite.");
  });

  it("renders typed booking-code rate-limit errors", () => {
    const html = renderGroup({
      code: "booking_code_rate_limited",
      values: groupValues(),
    });

    expect(html).toContain("too many booking-code checks. try again later.");
  });
});

function renderGroup(
  actionData: Parameters<typeof GroupContent>[0]["actionData"],
) {
  const Stub = createRoutesStub([{
    Component: () => (
      <GroupContent actionData={actionData} />
    ),
    path: "/group",
  }]);

  return renderToStaticMarkup(<Stub initialEntries={["/group"]} />);
}

function groupValues() {
  return {
    durationMinutes: "30",
    granularityMinutes: "15",
    participants: "schedule.pizza/alice?code=moon-tiger-seven",
    timeZone: "America/Los_Angeles",
  };
}
