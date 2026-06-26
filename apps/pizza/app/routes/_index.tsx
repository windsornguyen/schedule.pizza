export function meta() {
  return [
    { title: "schedule.pizza" },
    {
      name: "description",
      content: "booking links with codes.",
    },
    { property: "og:title", content: "schedule.pizza" },
    {
      property: "og:description",
      content: "booking links with codes.",
    },
    { property: "og:url", content: "https://schedule.pizza" },
    { name: "twitter:title", content: "schedule.pizza" },
    {
      name: "twitter:description",
      content: "booking links with codes.",
    },
  ];
}

export function loader({ request }: { request: Request }) {
  const cookie = request.headers.get("Cookie") ?? "";
  const hasSession = /session=/.test(cookie);
  return { loggedIn: hasSession };
}

export default function Home({
  loaderData,
}: {
  loaderData: { loggedIn: boolean };
}) {
  return (
    <main className="mx-auto w-full max-w-[550px] px-4 pt-20 pb-24 antialiased">
      <h1 className="text-sm font-semibold">schedule.pizza</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        easiest way to find a time.
      </p>

      <form action="/search" method="get" className="mt-8">
        <input
          type="text"
          name="q"
          placeholder="username or link"
          // oxlint-disable-next-line jsx-a11y/no-autofocus -- search-only homepage, intentional
          autoFocus
          autoComplete="off"
          className="h-9 w-full max-w-[340px] rounded-md border border-input bg-transparent px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-[3px] focus:ring-ring/50"
        />
      </form>

      {loaderData.loggedIn && (
        <div className="mt-8 space-y-2">
          <p className="text-sm text-muted-foreground">
            your booking link:{" "}
            <span className="font-mono">schedule.pizza/you/code</span>
          </p>
          <a
            href="/auth/google"
            className="underline decoration-border underline-offset-4 transition-colors hover:text-foreground"
          >
            connect google calendar
          </a>
        </div>
      )}

      <nav className="mt-10 flex items-center gap-3 text-sm text-muted-foreground">
        <a
          href="/api/v1/availability?user=demo"
          className="underline decoration-border underline-offset-4 transition-colors hover:text-foreground"
        >
          api
        </a>
        <a
          href="/api/v1"
          className="underline decoration-border underline-offset-4 transition-colors hover:text-foreground"
        >
          docs
        </a>
        <a
          href="https://github.com/windsornguyen/schedule.pizza"
          className="underline decoration-border underline-offset-4 transition-colors hover:text-foreground"
        >
          source
        </a>
      </nav>
    </main>
  );
}
