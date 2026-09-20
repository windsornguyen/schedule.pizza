export function meta() {
  return [
    { title: "service providers - schedule.pizza" },
    { name: "description", content: "Providers that process personal information for schedule.pizza." },
  ];
}

export default function Subprocessors() {
  return (
    <main className="mx-auto w-full max-w-[550px] px-4 pt-20 pb-24 antialiased [&_a]:underline [&_a]:decoration-border [&_a]:underline-offset-4 [&_a:hover]:text-foreground">
      <h1 className="text-sm font-semibold">service providers</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Updated September 20, 2026. These services process personal information
        when you use schedule.pizza. Their role depends on the service: an
        infrastructure processor is different from the Google account you choose
        to connect. See our <a href="/privacy">privacy policy</a> for how and why
        we use and share information.
      </p>
      <section className="mt-10 space-y-3">
        <h2 className="text-sm font-semibold">Cloudflare</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          Hosts the app and database and provides network security and diagnostics.
          Processes account identifiers, names, email addresses, authorization
          tokens, booking and availability data, and technical request records
          as our infrastructure provider. Data is processed on its global network.
        </p>
        <p className="text-sm leading-6 text-muted-foreground">
          <a href="https://www.cloudflare.com/privacypolicy/">Cloudflare privacy policy</a>
        </p>
      </section>
      <section className="mt-10 space-y-3">
        <h2 className="text-sm font-semibold">Google</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          Provides the sign-in and calendar services you connect. Processes
          identity and authorization information, calendar queries, booking
          events, and invitees' names and email addresses. Separately, Google
          Fonts receives your IP address and browser request metadata when fonts
          load. Google's own terms and privacy practices apply to these services;
          it is not described here solely as a subprocessor acting on our behalf.
        </p>
        <p className="text-sm leading-6 text-muted-foreground">
          <a href="https://policies.google.com/privacy">Google privacy policy</a>
        </p>
      </section>
      <nav className="mt-10 flex flex-wrap gap-3 text-sm text-muted-foreground">
        <a href="/privacy">privacy</a>
        <a href="/terms">terms</a>
        <a href="/">home</a>
      </nav>
    </main>
  );
}
