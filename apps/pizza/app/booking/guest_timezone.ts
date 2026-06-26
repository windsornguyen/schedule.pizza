type OptionalGuestTimezone =
  | { readonly code: "parsed"; readonly value: string | null }
  | { readonly code: "invalid" };

export function parseOptionalGuestTimezone(
  value: unknown,
): OptionalGuestTimezone {
  if (value === undefined || value === null) {
    return { code: "parsed", value: null };
  }

  if (typeof value !== "string") {
    return { code: "invalid" };
  }

  const timeZone = value.trim();

  if (timeZone === "") {
    return { code: "parsed", value: null };
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return { code: "parsed", value: timeZone };
  } catch {
    return { code: "invalid" };
  }
}
