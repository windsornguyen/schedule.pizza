import { redirect } from "react-router";

import { copyAuthResponseCookies } from "@/auth_response_headers.server";
import { createAuth } from "@/auth.server";
import { serverContext } from "@/server-context";
import type { Route } from "./+types/auth.google";

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(serverContext);
  const response = await createAuth(env).handler(
    new Request(new URL("/api/auth/sign-in/social", request.url), {
      method: "POST",
      headers: createAuthHeaders(request),
      body: JSON.stringify({
        provider: "google",
        callbackURL: "/dashboard",
      }),
    }),
  );
  const redirectUrl = readOAuthRedirectUrl(await response.json());

  if (redirectUrl === null) {
    throw new Response("google sign-in did not return a redirect url", {
      status: 500,
    });
  }

  return redirect(redirectUrl, {
    headers: copyAuthResponseCookies(response.headers),
  });
}

function createAuthHeaders(request: Request) {
  const url = new URL(request.url);
  const headers = new Headers({
    "Content-Type": "application/json",
    Origin: url.origin,
  });
  const cookie = request.headers.get("Cookie");

  if (cookie !== null) {
    headers.set("Cookie", cookie);
  }

  return headers;
}

function readOAuthRedirectUrl(value: unknown) {
  if (
    typeof value === "object" &&
    value !== null &&
    "url" in value &&
    typeof value.url === "string"
  ) {
    return value.url;
  }

  return null;
}
