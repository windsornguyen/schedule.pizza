export function meta() {
  return [
    { title: "privacy - schedule.pizza" },
    {
      name: "description",
      content: "privacy policy for schedule.pizza.",
    },
  ];
}

export default function Privacy() {
  return (
    <main className="mx-auto w-full max-w-[550px] px-4 pt-20 pb-24 antialiased">
      <h1 className="text-sm font-semibold">privacy</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        schedule.pizza stores the account, profile, booking-code, and booking
        data needed to show availability and place calendar events.
      </p>

      <section className="mt-10 space-y-3">
        <h2 className="text-sm font-semibold">google calendar</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          Hosts connect Google Calendar so schedule.pizza can read busy times
          and create events for confirmed bookings. Calendar busy blocks are
          used to compute availability. Event details are not shown to bookers.
        </p>
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="text-sm font-semibold">booking codes</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          Availability is gated by booking codes. A username alone should not
          reveal whether a host exists or when they are free.
        </p>
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="text-sm font-semibold">contact</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          Email privacy or security questions to{" "}
          <a
            href="mailto:security@schedule.pizza"
            className="underline decoration-border underline-offset-4 transition-colors hover:text-foreground"
          >
            security@schedule.pizza
          </a>
          .
        </p>
      </section>

      <nav className="mt-10 flex gap-3 text-sm text-muted-foreground">
        <a
          href="/terms"
          className="underline decoration-border underline-offset-4 transition-colors hover:text-foreground"
        >
          terms
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
