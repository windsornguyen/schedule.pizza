export function meta() {
  return [
    { title: "terms - schedule.pizza" },
    {
      name: "description",
      content: "terms of service for schedule.pizza.",
    },
  ];
}

export default function Terms() {
  return (
    <main className="mx-auto w-full max-w-[550px] px-4 pt-20 pb-24 antialiased">
      <h1 className="text-sm font-semibold">terms</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        schedule.pizza is a small scheduling tool. Use it to share availability,
        find times, and book calendar events. Do not use it to spam people,
        scrape availability, probe accounts, or interfere with the service.
      </p>

      <section className="mt-10 space-y-3">
        <h2 className="text-sm font-semibold">accounts</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          You are responsible for the booking codes you share. Rotating a code
          revokes the old one. If your Google Calendar access is removed,
          bookings stop until you reconnect.
        </p>
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="text-sm font-semibold">bookings</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          A booking is confirmed only after schedule.pizza creates the calendar
          event. If the calendar write fails, the booking should fail closed.
        </p>
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="text-sm font-semibold">contact</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          Email{" "}
          <a
            href="mailto:security@schedule.pizza"
            className="underline decoration-border underline-offset-4 transition-colors hover:text-foreground"
          >
            security@schedule.pizza
          </a>{" "}
          for support, abuse, or security reports.
        </p>
      </section>

      <nav className="mt-10 flex gap-3 text-sm text-muted-foreground">
        <a
          href="/privacy"
          className="underline decoration-border underline-offset-4 transition-colors hover:text-foreground"
        >
          privacy
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
