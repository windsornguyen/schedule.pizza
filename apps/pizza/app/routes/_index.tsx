export function meta() {
  return [
    { title: "schedule.pizza" },
    {
      name: "description",
      content:
        "The easiest way to find some time. Designed for agents, built for humans.",
    },
    { property: "og:title", content: "schedule.pizza" },
    {
      property: "og:description",
      content:
        "The easiest way to find some time. Designed for agents, built for humans.",
    },
    { property: "og:url", content: "https://schedule.pizza" },
    { name: "twitter:title", content: "schedule.pizza" },
    {
      name: "twitter:description",
      content:
        "The easiest way to find some time. Designed for agents, built for humans.",
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
    <div className="flex min-h-screen flex-col items-center justify-center px-4 antialiased">
      <div className="w-full max-w-[550px]">
        <h1 className="text-sm font-semibold">schedule.pizza</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          the easiest way to find some time
        </p>

        <form action="/search" method="get" className="mt-10">
          <input
            type="text"
            name="q"
            placeholder="username or link"
            autoComplete="off"
            className="h-9 w-full max-w-[260px] rounded-md border border-input bg-transparent px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-[3px] focus:ring-ring/50"
          />
        </form>

        {loaderData.loggedIn && (
          <div className="mt-6 space-y-2">
            <p className="text-sm text-muted-foreground">
              your booking link:{" "}
              <span className="font-mono">schedule.pizza/you/code</span>
            </p>
            <a
              href="/auth/google"
              className="text-sm underline decoration-border underline-offset-4 transition-colors hover:text-foreground"
            >
              connect google calendar
            </a>
          </div>
        )}

        <nav className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
          <a
            href="/api/v1/availability?user=demo"
            className="underline decoration-border underline-offset-4 transition-colors hover:text-foreground"
          >
            api
          </a>
          <span aria-hidden>·</span>
          <a
            href="/api/v1"
            className="underline decoration-border underline-offset-4 transition-colors hover:text-foreground"
          >
            docs
          </a>
          <span aria-hidden>·</span>
          <a
            href="https://github.com/windsornguyen/schedule.pizza"
            className="underline decoration-border underline-offset-4 transition-colors hover:text-foreground"
          >
            source
          </a>
        </nav>
      </div>
    </div>
  );
}
