import { redirect } from "react-router";

import { readAuthSession } from "@/auth.server";
import { serverContext } from "@/server-context";
import type { Route } from "./+types/login";

export function meta() {
  return [
    { title: "login - schedule.pizza" },
    {
      name: "description",
      content: "connect google calendar to host a schedule.pizza booking link.",
    },
  ];
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const session = await readAuthSession(
    context.get(serverContext).env,
    request.headers,
  );

  if (session !== null) {
    throw redirect("/dashboard");
  }

  return null;
}

export default function Login() {
  return (
    <main className="mx-auto w-full max-w-[550px] px-4 pt-20 pb-24">
      <h1 className="text-sm font-semibold">login</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        connect google calendar to create a booking link. schedule.pizza asks
        for free/busy access to show times and event access to write confirmed
        bookings.
      </p>
      <p className="mt-4 text-sm leading-6 text-muted-foreground">
        google may show an app verification screen while launch access is under
        review.
      </p>
      <p className="mt-4 text-sm leading-6 text-muted-foreground">
        Read the{" "}
        <a
          href="/privacy"
          className="underline decoration-border underline-offset-4 transition-colors hover:text-foreground"
        >
          privacy policy
        </a>{" "}
        before connecting calendar access.
      </p>

      <p className="mt-8">
        <a
          href="/auth/google"
          className="text-sm underline decoration-border underline-offset-4 transition-colors hover:text-foreground"
        >
          sign in with google
        </a>
      </p>
    </main>
  );
}
