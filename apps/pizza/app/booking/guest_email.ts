const GUEST_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

export type OptionalGuestEmail =
  | { readonly code: "invalid" }
  | { readonly code: "parsed"; readonly normalized: string | null; readonly value: string | null };

export function parseOptionalGuestEmail(value: unknown): OptionalGuestEmail {
  if (value === undefined || value === null) {
    return { code: "parsed", normalized: null, value: null };
  }

  if (typeof value !== "string") {
    return { code: "invalid" };
  }

  const email = value.trim();

  if (email === "") {
    return { code: "parsed", normalized: null, value: null };
  }

  if (!GUEST_EMAIL_PATTERN.test(email)) {
    return { code: "invalid" };
  }

  return { code: "parsed", normalized: email.toLowerCase(), value: email };
}
