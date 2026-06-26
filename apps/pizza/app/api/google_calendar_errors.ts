import type { GoogleCalendarErrorCode } from "@/calendar/google.server";

export function googleCalendarStatus(code: GoogleCalendarErrorCode): 424 | 502 {
  if (
    code === "google_account_missing" ||
    code === "google_access_token_missing" ||
    code === "google_calendar_scope_missing" ||
    code === "google_refresh_token_missing"
  ) {
    return 424;
  }

  return 502;
}

export function googleCalendarErrorBody(code: GoogleCalendarErrorCode) {
  return { error: { code, message: "Google Calendar is unavailable" } };
}
