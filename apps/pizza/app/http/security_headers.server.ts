/**
 * Shared security response headers for app and API responses.
 *
 * Booking URLs contain capability codes, so pages must not send full referrers
 * to third-party assets or outbound links.
 */

export const REFERRER_POLICY = "no-referrer";
export const X_CONTENT_TYPE_OPTIONS = "nosniff";
export const X_FRAME_OPTIONS = "DENY";

type MutableHeaders = Pick<Headers, "set">;

export function setSecurityHeaders(headers: MutableHeaders) {
  headers.set("Referrer-Policy", REFERRER_POLICY);
  headers.set("X-Content-Type-Options", X_CONTENT_TYPE_OPTIONS);
  headers.set("X-Frame-Options", X_FRAME_OPTIONS);
}
