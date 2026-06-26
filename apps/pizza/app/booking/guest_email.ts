const GUEST_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

export type RequiredGuestEmail =
  | { readonly code: "invalid" }
  | { readonly code: "missing" }
  | { readonly code: "parsed"; readonly normalized: string; readonly value: string };

export function parseRequiredGuestEmail(value: unknown): RequiredGuestEmail {
  if (value === undefined || value === null) {
    return { code: "missing" };
  }

  if (typeof value !== "string") {
    return { code: "invalid" };
  }

  const email = value.trim();

  if (email === "") {
    return { code: "missing" };
  }

  if (!GUEST_EMAIL_PATTERN.test(email)) {
    return { code: "invalid" };
  }

  return { code: "parsed", normalized: email.toLowerCase(), value: email };
}
