import {
  listGoogleFreeBusyIntervals,
  readGoogleCalendarAccess,
  readGoogleCalendarId,
  type GoogleCalendarErrorCode,
} from "@/calendar/google.server";
import type { Database } from "@/db/client.server";
import {
  expireStalePendingCalendarBookingsForHost,
  findBlockingBookingsForHost,
  getPendingCalendarBookingExpiresBefore,
} from "@/db/functions/bookings.server";
import { timeInterval, type TimeInterval } from "@/scheduling/engine";
import { removeBookedSlots, type SlotRange } from "@/scheduling/slots.server";
import type { ServerEnv } from "@/server-context";

type HostAvailabilityProfile = {
  readonly authUserId: string;
  readonly calendarId: string | null;
  readonly id: string;
  readonly timezone: string;
};

type HostAvailabilityWindow = {
  readonly endsAt: Date;
  readonly startsAt: Date;
};

type HostAvailabilityResult =
  | { readonly code: "listed"; readonly slots: readonly SlotRange[] }
  | { readonly code: GoogleCalendarErrorCode };

export async function listHostAvailableSlots(
  db: Database,
  input: {
    readonly candidateSlots: readonly SlotRange[];
    readonly env: ServerEnv;
    readonly host: HostAvailabilityProfile;
    readonly now: Date;
    readonly window: HostAvailabilityWindow;
  },
): Promise<HostAvailabilityResult> {
  await expireStalePendingCalendarBookingsForHost(db, {
    expiredAt: input.now,
    expiresBefore: getPendingCalendarBookingExpiresBefore(input.now),
    hostId: input.host.id,
  });

  const googleAccess = await readGoogleCalendarAccess(db, {
    authUserId: input.host.authUserId,
    capability: "availability",
    env: input.env,
    now: input.now,
  });

  if (googleAccess.code !== "authorized") {
    return googleAccess;
  }

  const window = toTimeInterval(input.window);
  const googleBusy = await listGoogleFreeBusyIntervals({
    accessToken: googleAccess.accessToken,
    calendarId: readGoogleCalendarId(input.host.calendarId),
    timeZone: input.host.timezone,
    window,
  });

  if (googleBusy.code !== "listed") {
    return googleBusy;
  }

  const bookings = await findBlockingBookingsForHost(db, {
    hostId: input.host.id,
    startsAt: input.window.startsAt,
    endsAt: input.window.endsAt,
  });
  const busyRanges = [
    ...bookings,
    ...googleBusy.busy.map((busy) => ({
      slotStartAt: new Date(busy.startAtMs),
      slotEndAt: new Date(busy.endAtMs),
    })),
  ];

  return {
    code: "listed",
    slots: removeBookedSlots([...input.candidateSlots], busyRanges),
  };
}

function toTimeInterval(window: HostAvailabilityWindow): TimeInterval {
  return timeInterval({
    startAtMs: window.startsAt.getTime(),
    endAtMs: window.endsAt.getTime(),
  });
}
