import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import { readAuthSession } from "./auth.server";
import { LogoMark } from "./components/logo_mark";
import type { Route } from "./+types/root";
import { serverContext } from "./server-context";
import "./app.css";

export const links: Route.LinksFunction = () => [
  { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
  {
    rel: "icon",
    type: "image/x-icon",
    sizes: "16x16 32x32 48x48",
    href: "/favicon.ico",
  },
  { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
  { rel: "manifest", href: "/site.webmanifest" },
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,100..900&family=Geist+Mono:wght@400;500&display=swap",
  },
];

export async function loader({ context, request }: Route.LoaderArgs) {
  const session = await readAuthSession(
    context.get(serverContext).env,
    request.headers,
  );

  return {
    currentPath: new URL(request.url).pathname,
    loggedIn: session !== null,
  };
}

export function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <DocumentSecurityMeta />
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
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export function DocumentSecurityMeta() {
  return <meta name="referrer" content="no-referrer" />;
}

export default function App({ loaderData }: Route.ComponentProps) {
  return (
    <>
      <AccountHeader
        currentPath={loaderData.currentPath}
        loggedIn={loaderData.loggedIn}
      />
      <Outlet />
    </>
  );
}

export function AccountHeader({
  currentPath,
  loggedIn,
}: {
  readonly currentPath: string;
  readonly loggedIn: boolean;
}) {
  const showLoginLink = !loggedIn && currentPath !== "/login";

  return (
    <header className="mx-auto flex w-full max-w-[550px] items-center justify-between gap-3 px-4 pt-8">
      <a
        href="/"
        aria-label="schedule.pizza home"
        className="flex items-center gap-2 text-sm font-semibold text-foreground"
      >
        <LogoMark className="size-6 shrink-0 text-foreground" />
        <span>schedule.pizza</span>
      </a>
      {loggedIn ? (
        <nav className="flex items-center gap-3">
          <a
            href="/dashboard"
            className="text-sm text-muted-foreground underline decoration-border underline-offset-4 transition-colors hover:text-foreground"
          >
            dashboard
          </a>
          <a
            href="/auth/logout"
            className="text-sm text-muted-foreground underline decoration-border underline-offset-4 transition-colors hover:text-foreground"
          >
            logout
          </a>
        </nav>
      ) : null}
      {showLoginLink ? (
        <a
          href="/login"
          className="text-sm text-muted-foreground underline decoration-border underline-offset-4 transition-colors hover:text-foreground"
        >
          login
        </a>
      ) : null}
    </header>
  );
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
    <main className="mx-auto w-full max-w-[550px] px-4 pt-20 pb-24">
      <h1 className="text-sm font-semibold">{message}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{details}</p>
      {stack && (
        <pre className="mt-4 w-full overflow-x-auto rounded-md bg-secondary p-4 font-mono text-sm">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
