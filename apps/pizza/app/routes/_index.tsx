export function meta() {
  return [
    { title: "schedule.pizza" },
    {
      name: "description",
      content: "The easiest way to find some time. Designed for agents, built for humans.",
    },
    { property: "og:title", content: "schedule.pizza" },
    {
      property: "og:description",
      content: "The easiest way to find some time. Designed for agents, built for humans.",
    },
    { property: "og:url", content: "https://schedule.pizza" },
    { name: "twitter:title", content: "schedule.pizza" },
    {
      name: "twitter:description",
      content: "The easiest way to find some time. Designed for agents, built for humans.",
    },
  ];
}

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <h1 className="text-4xl font-semibold tracking-tight">schedule.pizza</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        the easiest way to find some time
      </p>

      <form
        action="/search"
        method="get"
        className="mt-8 w-full max-w-md"
      >
        <input
          type="text"
          name="q"
          placeholder="enter a username or link"
          autoComplete="off"
          className="h-10 w-full rounded-lg border border-input bg-transparent px-4 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-[3px] focus:ring-ring/50"
        />
      </form>

      <nav className="mt-6 flex items-center gap-3 text-xs text-muted-foreground">
        <a
          href="/api/v1/availability?user=demo"
          className="transition-colors hover:text-foreground"
        >
          API
        </a>
        <span aria-hidden>·</span>
        <a
          href="/api/v1"
          className="transition-colors hover:text-foreground"
        >
          Docs
        </a>
      </nav>
    </div>
  );
}
