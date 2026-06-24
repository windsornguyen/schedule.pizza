import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";

export const links: Route.LinksFunction = () => [
  { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap",
  },
];

function hasSession(request?: Request): boolean {
  const cookie = request?.headers.get("Cookie") ?? "";
  return /session=/.test(cookie);
}

export function loader({ request }: Route.LoaderArgs) {
  return { loggedIn: hasSession(request) };
}

export function Layout({
  children,
  loaderData,
}: {
  children: React.ReactNode;
  loaderData?: { loggedIn: boolean };
}) {
  const loggedIn = loaderData?.loggedIn ?? false;

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#F5E6D0" />
        <meta property="og:site_name" content="schedule.pizza" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://schedule.pizza/og.svg" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@schedulepizza" />
        <meta name="twitter:image" content="https://schedule.pizza/og.svg" />
        <Meta />
        <Links />
      </head>
      <body className="font-sans">
        <header className="fixed top-0 right-0 px-16 py-10">
          {loggedIn ? (
            <a
              href="/auth/logout"
              className="text-sm text-muted-foreground underline decoration-border underline-offset-4 transition-colors hover:text-foreground"
            >
              logout
            </a>
          ) : (
            <a
              href="/login"
              className="text-sm text-muted-foreground underline decoration-border underline-offset-4 transition-colors hover:text-foreground"
            >
              login
            </a>
          )}
        </header>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | null = null;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack ?? null;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <h1 className="text-2xl font-semibold tracking-tight">{message}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{details}</p>
      {stack && (
        <pre className="mt-4 w-full max-w-2xl overflow-x-auto rounded-lg bg-secondary p-4 font-mono text-xs">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
