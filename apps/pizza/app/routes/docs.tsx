export function meta() {
  return [
    { title: "docs - schedule.pizza" },
    {
      name: "description",
      content: "how to use schedule.pizza from humans and agents.",
    },
  ];
}

export default function Docs() {
  return (
    <main className="mx-auto w-full max-w-[550px] px-4 pt-20 pb-24 antialiased">
      <h1 className="text-sm font-semibold">docs</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        schedule.pizza gives each host a booking code. If you have the code,
        you can ask for times, book a time, or ask the scheduler to find a time
        across several people.
      </p>

      <section className="mt-10 space-y-3">
        <h2 className="text-sm font-semibold">availability</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          Use this when you already know whose calendar you want. The code is
          required; username guesses do not expose availability. Slots exclude
          schedule.pizza bookings and the host's Google Calendar busy times.
        </p>
        <pre className="whitespace-pre-wrap break-words rounded-md border bg-muted p-3 font-mono text-sm">
          <code>GET /api/v1/availability?user=alice&code=moon-tiger-seven</code>
        </pre>
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="text-sm font-semibold">booking</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          Book the exact slot returned by availability. The server checks the
          booking code again and rejects the write if the slot is no longer
          free. A booking succeeds only after the Google Calendar event is
          created.
        </p>
        <pre className="whitespace-pre-wrap break-words rounded-md border bg-muted p-3 font-mono text-sm">
          <code>{`POST /api/v1/book
{
  "user": "alice",
  "code": "moon-tiger-seven",
  "slot": "2026-06-26T16:00:00.000Z",
  "name": "Ada",
  "email": "ada@example.com",
  "timezone": "America/Los_Angeles"
}`}</code>
        </pre>
        <p className="text-sm leading-6 text-muted-foreground">
          Success returns the schedule.pizza booking id, the confirmed slot, and
          the Google Calendar event id.
        </p>
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="text-sm font-semibold">group scheduling</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          Send every participant with their booking code. The scheduler returns
          exact slots when everyone is free. If none exist, it returns ranked
          alternatives with the conflicting people and time ranges. Google event
          details stay private.
        </p>
        <pre className="whitespace-pre-wrap break-words rounded-md border bg-muted p-3 font-mono text-sm">
          <code>{`POST /api/v1/schedule
{
  "participants": [
    { "user": "alice", "code": "moon-tiger-seven" },
    { "user": "bob", "code": "river-lime-harbor" }
  ],
  "durationMinutes": 30,
  "granularityMinutes": 15,
  "maxExactSlotCount": 10,
  "maxAlternativeSlotCount": 5,
  "timeZone": "America/Los_Angeles",
  "window": {
    "start": "2026-06-26T16:00:00.000Z",
    "end": "2026-06-27T01:00:00.000Z"
  }
}`}</code>
        </pre>
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="text-sm font-semibold">recommendations</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          A response with <code className="font-mono">kind: "exact"</code> is
          directly bookable. A response with{" "}
          <code className="font-mono">kind: "alternatives"</code> is a ranked
          recommendation: lower conflict cost is better, hard conflicts are
          shown before soft conflicts, and event details stay private.
        </p>
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="text-sm font-semibold">calendar errors</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          If a host has not granted calendar access, API calls fail with a typed
          Google Calendar error. The host fixes it by reconnecting Google from
          the dashboard.
        </p>
      </section>

      <nav className="mt-10 flex gap-3 text-sm text-muted-foreground">
        <a
          href="/api/v1"
          className="underline decoration-border underline-offset-4 transition-colors hover:text-foreground"
        >
          api json
        </a>
        <a
          href="/"
          className="underline decoration-border underline-offset-4 transition-colors hover:text-foreground"
        >
          home
        </a>
      </nav>
    </main>
  );
}
