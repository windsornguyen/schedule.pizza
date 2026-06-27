import { renderToStaticMarkup } from "react-dom/server";
import { createRoutesStub } from "react-router";
import { describe, expect, it } from "vitest";

import { GroupContent } from "./group";

describe("group scheduling page", () => {
  it("renders exact slots once as booking choices", () => {
    const Stub = createRoutesStub([{
      Component: () => (
        <GroupContent
          actionData={{
            code: "scheduled",
            result: {
              kind: "exact",
              slots: [{
                end: "2030-01-07T17:30:00.000Z",
                start: "2030-01-07T17:00:00.000Z",
              }],
            },
            timeZone: "America/Los_Angeles",
            values: {
              durationMinutes: "30",
              granularityMinutes: "15",
              participants: "schedule.pizza/alice?code=moon-tiger-seven",
              timeZone: "America/Los_Angeles",
            },
          }}
        />
      ),
      path: "/group",
    }]);
    const html = renderToStaticMarkup(<Stub initialEntries={["/group"]} />);

    expect(html.match(/Mon, Jan 7, 9:00 AM - 9:30 AM PST/gu)).toHaveLength(1);
  });
});
