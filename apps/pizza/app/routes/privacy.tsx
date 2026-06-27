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
        schedule.pizza stores the account, profile, booking-code, calendar
        connection, and booking data needed to show availability, place calendar
        events, and cancel bookings.
      </p>

      <section className="mt-10 space-y-3">
        <h2 className="text-sm font-semibold">google calendar</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          Hosts connect Google Calendar so schedule.pizza can read busy times,
          create events for confirmed bookings, and delete events for cancelled
          bookings. Google user data is used only for scheduling. Event details
          are not shown to bookers.
        </p>
        <p className="text-sm leading-6 text-muted-foreground">
          schedule.pizza stores Google account identifiers, OAuth tokens, token
          expiry times, granted scopes, and calendar ids needed to keep the
          calendar connection working. schedule.pizza does not sell Google user
          data or share it for advertising.
        </p>
        <p className="text-sm leading-6 text-muted-foreground">
          schedule.pizza's use and transfer of information received from Google
          APIs adheres to the Google API Services User Data Policy, including
          the Limited Use requirements. Humans do not read Google Calendar data
          except when needed for security, abuse, legal, or support work with
          the account holder's request.
        </p>
        <p className="text-sm leading-6 text-muted-foreground">
          You can revoke Google access from your Google Account settings. Email{" "}
          <a
            href="mailto:security@schedule.pizza"
            className="underline decoration-border underline-offset-4 transition-colors hover:text-foreground"
          >
            security@schedule.pizza
          </a>{" "}
          to request deletion of schedule.pizza account or booking data.
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
