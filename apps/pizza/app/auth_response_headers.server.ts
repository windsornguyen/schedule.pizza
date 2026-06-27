/**
 * Copies Better Auth response cookies through route-level redirects.
 *
 * Social sign-in and sign-out can set multiple cookies. React Router route
 * redirects must forward each value separately or OAuth state validation can
 * fail after the browser returns from Google.
 */

import { splitSetCookieHeader } from "better-auth/cookies";

type HeadersWithSetCookieList = Headers & {
  readonly getSetCookie?: () => string[];
};

export function copyAuthResponseCookies(source: Headers) {
  const headers = new Headers();

  for (const setCookie of readSetCookieHeaders(source)) {
    headers.append("Set-Cookie", setCookie);
  }

  return headers;
}

function readSetCookieHeaders(source: Headers) {
  const sourceWithCookieList = source as HeadersWithSetCookieList;
  const setCookieList = sourceWithCookieList.getSetCookie?.();

  if (setCookieList !== undefined) {
    return setCookieList;
  }

  const setCookie = source.get("Set-Cookie");

  return setCookie === null ? [] : splitSetCookieHeader(setCookie);
}
