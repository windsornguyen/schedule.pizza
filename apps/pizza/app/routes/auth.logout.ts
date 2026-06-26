import { redirect } from "react-router";

import { createAuth } from "@/auth.server";
import { serverContext } from "@/server-context";
import type { Route } from "./+types/auth.logout";

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(serverContext);
  const response = await createAuth(env).handler(
    new Request(new URL("/api/auth/sign-out", request.url), {
      method: "POST",
      headers: createAuthHeaders(request),
    }),
  );

  if (!response.ok) {
    throw new Response("sign-out failed", { status: 500 });
  }

  return redirect("/", {
    headers: copyAuthResponseCookies(response.headers),
  });
}

function createAuthHeaders(request: Request) {
  const url = new URL(request.url);
  const headers = new Headers({ Origin: url.origin });
  const cookie = request.headers.get("Cookie");

  if (cookie !== null) {
    headers.set("Cookie", cookie);
  }

  return headers;
}

function copyAuthResponseCookies(source: Headers) {
  const headers = new Headers();
  const setCookie = source.get("Set-Cookie");

  if (setCookie !== null) {
    headers.append("Set-Cookie", setCookie);
  }

  return headers;
}
