export function meta() {
  return [{ title: "dashboard — schedule.pizza" }];
}

export default function Dashboard() {
  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">dashboard</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        welcome back
      </p>

      <div className="mt-8 space-y-6">
        <div>
          <h2 className="text-sm font-medium">your booking link</h2>
          <p className="mt-1 font-mono text-sm text-muted-foreground">
            schedule.pizza/username/booking-code
          </p>
        </div>

        <div>
          <h2 className="text-sm font-medium">calendar</h2>
          <a
            href="/auth/google"
            className="mt-1 inline-block text-sm underline decoration-border underline-offset-4 transition-colors hover:text-foreground"
          >
            connect google calendar
          </a>
        </div>

        <div className="pt-4">
          <a
            href="/"
            className="text-xs text-muted-foreground underline decoration-border underline-offset-4 transition-colors hover:text-foreground"
          >
            sign out
          </a>
        </div>
      </div>
    </div>
  );
}
