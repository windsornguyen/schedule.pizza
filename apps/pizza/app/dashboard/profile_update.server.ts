/**
 * Dashboard profile update action.
 *
 * The profile row owns host-visible scheduling settings. Updates verify that
 * the signed-in user owns the target username, has a usable account email, and
 * still has Google Calendar access before changing host availability state.
 */

import type { createDb } from "@/db/client.server";
import { rotateBookingCode } from "@/db/functions/booking_codes.server";
import {
  findHostProfileByAuthUserId,
  findHostProfileByUsername,
  updateHostProfile,
} from "@/db/functions/host_profiles.server";
import type { ServerEnv } from "@/server-context";
import { readCalendarStatus } from "./calendar_status.server";
import { parseProfileForm } from "./profile_form";

export async function updateExistingProfile(
  db: ReturnType<typeof createDb>,
  input: {
    readonly authUserId: string;
    readonly email: unknown;
    readonly env: ServerEnv;
    readonly formData: FormData;
  },
) {
  const parsed = parseProfileForm(input.formData);

  if (parsed.code !== "parsed") {
    return parsed;
  }

  const existingProfile = await findHostProfileByAuthUserId(db, input.authUserId);

  if (existingProfile === null) {
    return { code: "profile_missing" as const };
  }

  const usernameOwner = await findHostProfileByUsername(db, parsed.username);

  if (
    usernameOwner !== null &&
    usernameOwner.authUserId !== input.authUserId
  ) {
    return { code: "username_taken" as const };
  }

  const email = readAccountEmail(input.email);

  if (email === null) {
    return { code: "auth_user_email_missing" as const };
  }

  const now = new Date();
  const calendarStatus = await readCalendarStatus(db, input.env, input.authUserId, now);

  if (calendarStatus !== "connected") {
    return { code: "calendar_authorization_required" as const };
  }

  const updated = await updateHostProfile(db, {
    authUserId: input.authUserId,
    calendarAccountEmail: email,
    calendarId: existingProfile.calendarId ?? "primary",
    calendarProvider: "google",
    displayName: parsed.username,
    username: parsed.username,
    timezone: parsed.timezone,
    slotSizeMinutes: parsed.slotSizeMinutes,
    now,
  });

  if (updated === null) {
    return { code: "profile_missing" as const };
  }

  if (existingProfile.username === parsed.username) {
    return { code: "updated_profile" as const };
  }

  const bookingCode = await rotateBookingCode(input.env.DB, {
    hostId: existingProfile.id,
    hostUsername: parsed.username,
    wordCount: 3,
    label: null,
    now,
  });

  return {
    code: "updated_profile" as const,
    bookingCode: bookingCode.code,
    username: parsed.username,
  };
}

function readAccountEmail(email: unknown) {
  return typeof email === "string" && email.trim() !== ""
    ? email.trim()
    : null;
}
