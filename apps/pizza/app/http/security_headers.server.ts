/**
 * Shared security response headers for app and API responses.
 *
 * Booking URLs contain capability codes, so pages must not send full referrers
 * to third-party assets or outbound links.
 */

export const REFERRER_POLICY = "no-referrer";

type MutableHeaders = Pick<Headers, "set">;

export function setSecurityHeaders(headers: MutableHeaders) {
  headers.set("Referrer-Policy", REFERRER_POLICY);
}
