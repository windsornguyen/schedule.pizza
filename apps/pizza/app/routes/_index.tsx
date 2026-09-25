export function meta() {
  return [
    { title: "schedule.pizza" },
    {
      name: "description",
      content: "easiest way to find a time.",
    },
    { property: "og:title", content: "schedule.pizza" },
    {
      property: "og:description",
      content: "easiest way to find a time.",
    },
    { property: "og:url", content: "https://schedule.pizza" },
    { name: "twitter:title", content: "schedule.pizza" },
    {
      name: "twitter:description",
      content: "easiest way to find a time.",
    },
  ];
}

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-[550px] px-4 pt-20 pb-24 antialiased">
      <h1 className="text-sm font-semibold">schedule.pizza</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        easiest way to find a time.
      </p>

      <HomeSearchForm />
    </main>
  );
}

export function HomeSearchForm() {
  return (
    <form action="/search" method="get" className="mt-8 flex w-full max-w-[420px] items-center gap-2">
      <input
        type="text"
        name="q"
        placeholder="username or link"
        // oxlint-disable-next-line jsx-a11y/no-autofocus -- search-only homepage, intentional
        autoFocus
        autoComplete="off"
        className="h-9 min-w-0 flex-1 rounded-md border border-input bg-transparent px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-[3px] focus:ring-ring/50"
      />
      <button
        type="submit"
        className="h-9 rounded-md border border-input px-3 text-sm transition-colors hover:bg-muted"
      >
        go
      </button>
    </form>
  );
}
