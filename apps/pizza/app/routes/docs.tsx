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
        schedule.pizza has one public object: a booking link. The link contains
        the username and the booking code. If you have it, you can read
        availability, book a slot, or ask the scheduler to find a time across
        several people. If you do not have it, username guesses should not
        expose availability.
      </p>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        Agents can pass the full link as{" "}
        <code className="font-mono">url</code>, or split it into{" "}
        <code className="font-mono">user</code> and{" "}
        <code className="font-mono">code</code>. Times are UTC ISO strings
        ending in <code className="font-mono">Z</code>.
      </p>

      <section className="mt-10 space-y-3">
        <h2 className="text-sm font-semibold">hosts</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          Sign in with Google, choose a username, and share the generated
          booking link. New links are shown once. If a host loses the code, they
          create a new link and the old code stops working. Confirmed bookings
          appear in the dashboard. Individual bookings can be cancelled there.
          Group bookings stay visible, but the group organizer cancels the
          shared event from Google Calendar.
        </p>
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="text-sm font-semibold">one person</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          Start with availability. Slots exclude schedule.pizza bookings and
          the host's Google Calendar busy times.
        </p>
        <pre className={CODE_BLOCK_CLASS}>
          <code>
            GET /api/v1/availability?user=alice&code=moon-tiger-seven
          </code>
        </pre>
        <p className="text-sm leading-6 text-muted-foreground">
          Then book the exact slot returned by availability. The server checks
          the code again and rejects the write if the slot is no longer free. A
          booking succeeds only after the Google Calendar event is created.
        </p>
        <pre className={CODE_BLOCK_CLASS}>
          <code>{`POST /api/v1/book
{
  "user": "alice",
  "code": "moon-tiger-seven",
  "slot": "2030-01-07T17:00:00.000Z",
  "name": "Ada",
  "email": "ada@example.com",
  "timezone": "America/Los_Angeles"
}`}</code>
        </pre>
        <p className="text-sm leading-6 text-muted-foreground">
          Email is required so Google can invite the booker. Public booking
          responses return the schedule.pizza booking id, not the Google event
          id.
        </p>
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="text-sm font-semibold">several people</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          Send every participant with their booking link. The scheduler returns
          exact slots when everyone is free. If none exist, it returns ranked
          recommendations with the conflicting people and time ranges. Google
          event details stay private.
        </p>
        <p className="text-sm leading-6 text-muted-foreground">
          For people, use <a
            href="/group"
            className="underline decoration-border underline-offset-4 transition-colors hover:text-foreground"
          >
            group scheduling
          </a>{" "}
          and paste one schedule.pizza link per line. For agents, call the API
          directly. Requests are capped at eight people and a 31-day window.
        </p>
        <pre className={CODE_BLOCK_CLASS}>
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
    "start": "2030-01-07T17:00:00.000Z",
    "end": "2030-01-08T01:00:00.000Z"
  }
}`}</code>
        </pre>
        <p className="text-sm leading-6 text-muted-foreground">
          <code className="font-mono">POST /api/v1/recommend</code> accepts the
          same body. It returns exact slots first. A response with{" "}
          <code className="font-mono">kind: "exact"</code> means everyone is
          free. A response with{" "}
          <code className="font-mono">kind: "alternatives"</code> is ranked by
          conflict cost. Lower is better.
        </p>
        <p className="text-sm leading-6 text-muted-foreground">
          To book an exact group slot, send the same scheduling body to{" "}
          <code className="font-mono">/api/v1/book-group</code> with the
          selected slot and booker identity.
        </p>
        <pre className={CODE_BLOCK_CLASS}>
          <code>{`POST /api/v1/book-group
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
    "start": "2030-01-07T17:00:00.000Z",
    "end": "2030-01-08T01:00:00.000Z"
  },
  "slot": "2030-01-07T18:00:00.000Z",
  "name": "Ada",
  "email": "ada@example.com",
  "timezone": "America/Los_Angeles"
}`}</code>
        </pre>
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="text-sm font-semibold">host agents</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          A signed-in host can read account state at{" "}
          <code className="font-mono">GET /api/v1/account</code>. Upcoming
          bookings are available at{" "}
          <code className="font-mono">GET /api/v1/account/bookings</code>.
          Each booking includes <code className="font-mono">kind</code> and a
          structured <code className="font-mono">cancel</code> object, so
          agents can tell individual bookings from shared group bookings.
          To update a host profile, call{" "}
          <code className="font-mono">PUT /api/v1/account/profile</code>.
          Renaming a profile revokes previous codes and returns a new{" "}
          <code className="font-mono">bookingUrl</code>.
          When a host creates or rotates a booking code, account responses
          include the absolute <code className="font-mono">bookingUrl</code>{" "}
          that can be handed to people or agents. Later account reads do not
          return the plaintext code. Account mutations require the Better Auth
          cookie and a same-site <code className="font-mono">Origin</code>{" "}
          header. To cancel an upcoming individual booking, call{" "}
          <code className="font-mono">
            POST /api/v1/account/bookings/:bookingId/cancel
          </code>.
        </p>
        <pre className={CODE_BLOCK_CLASS}>
          <code>{`Account mutation header:
Origin: https://schedule.pizza

POST /api/v1/me/bootstrap
{
  "username": "alice",
  "timezone": "America/Los_Angeles",
  "displayName": "Alice",
  "slotSizeMinutes": 30,
  "calendarId": "primary"
}

PUT /api/v1/account/profile
{
  "username": "alice",
  "timezone": "America/Los_Angeles",
  "displayName": "Alice",
  "slotSizeMinutes": 30,
  "calendarId": "primary"
}

POST /api/v1/me/booking-code

GET /api/v1/account/bookings
POST /api/v1/account/bookings/booking_123/cancel`}</code>
        </pre>
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="text-sm font-semibold">failure model</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          Public calls fail closed with typed error codes. Missing or wrong
          booking codes return <code className="font-mono">404</code>. Stale
          slots return <code className="font-mono">409</code>. Calendar access
          problems return typed Google Calendar errors. The host fixes those by
          reconnecting Google from the dashboard.
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

const CODE_BLOCK_CLASS =
  "overflow-x-auto whitespace-pre rounded-md border bg-muted p-3 font-mono text-sm leading-6";
