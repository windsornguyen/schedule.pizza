/**
 * Dashboard profile form parsing.
 *
 * Both profile creation and profile updates use this boundary before touching
 * database state. Route modules import the pure helpers; server-only actions
 * compose them with persistence and calendar authorization.
 */

export type ProfileForm =
  | {
      readonly code: "parsed";
      readonly slotSizeMinutes: number;
      readonly timezone: string;
      readonly username: string;
    }
  | { readonly code: "invalid_field"; readonly field: string };

const USERNAME_PATTERN = /^[a-z0-9][a-z0-9_-]{0,39}$/;

export function parseProfileForm(formData: FormData): ProfileForm {
  const username = readNormalizedUsername(formData);
  if (username === null) return { code: "invalid_field", field: "username" };

  const timezone = readValidTimeZone(formData);
  if (timezone === null) return { code: "invalid_field", field: "timezone" };

  const slotSizeMinutes = readSlotSizeMinutes(formData);
  if (slotSizeMinutes === null) return { code: "invalid_field", field: "slotSizeMinutes" };

  return { code: "parsed", username, timezone, slotSizeMinutes };
}

export function readDefaultUsernameFromEmail(email: string) {
  const localPart = email.split("@")[0]?.toLowerCase() ?? "";
  const candidate = localPart
    .replace(/[^a-z0-9_-]+/gu, "-")
    .replace(/^[^a-z0-9]+/u, "")
    .slice(0, 40);

  return USERNAME_PATTERN.test(candidate) ? candidate : "";
}

function readNormalizedUsername(formData: FormData) {
  const value = formData.get("username");

  if (typeof value !== "string") {
    return null;
  }

  const username = value.trim().toLowerCase();

  return USERNAME_PATTERN.test(username) ? username : null;
}

function readValidTimeZone(formData: FormData) {
  const value = formData.get("timezone");

  if (typeof value !== "string") {
    return null;
  }

  const timeZone = value.trim();

  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return timeZone;
  } catch {
    return null;
  }
}

function readSlotSizeMinutes(formData: FormData) {
  const value = formData.get("slotSizeMinutes");

  if (typeof value !== "string") {
    return null;
  }

  if (!/^\d+$/u.test(value.trim())) {
    return null;
  }

  const slotSizeMinutes = Number.parseInt(value.trim(), 10);

  return [15, 30, 45, 60].includes(slotSizeMinutes) ? slotSizeMinutes : null;
}
