import type { BlockingBooking } from "@/db/functions/bookings.server";

const DEFAULT_WINDOW_DAYS = 14;
const WORKDAY_END_MINUTE = 17 * 60;
const WORKDAY_START_MINUTE = 9 * 60;

type LocalDate = {
  day: number;
  month: number;
  year: number;
};

export type SlotRange = {
  endAt: Date;
  startAt: Date;
};

type BusyRange = Pick<BlockingBooking, "slotEndAt" | "slotStartAt">;

export function listDefaultCandidateSlots(
  input: { now: Date; slotSizeMinutes: number; timeZone: string },
): SlotRange[] {
  assertValidSlotConfiguration(input);

  const slots: SlotRange[] = [];
  const firstDay = getTimeZoneDate(input.now, input.timeZone);

  for (let dayOffset = 0; dayOffset < DEFAULT_WINDOW_DAYS; dayOffset += 1) {
    const day = addLocalDays(firstDay, dayOffset);

    if (!isWeekday(day)) {
      continue;
    }

    slots.push(
      ...listWorkdaySlots(
        day,
        input.now,
        input.slotSizeMinutes,
        input.timeZone,
      ),
    );
  }

  return slots;
}

export function removeBookedSlots(
  slots: SlotRange[],
  bookings: BusyRange[],
) {
  return slots.filter(
    (slot) =>
      !bookings.some(
        (booking) =>
          slot.startAt < booking.slotEndAt && slot.endAt > booking.slotStartAt,
      ),
  );
}

export function serializeSlot(slot: SlotRange) {
  return {
    start: slot.startAt.toISOString(),
    end: slot.endAt.toISOString(),
  };
}

export function parseSlotStart(value: string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

export function isDefaultCandidateSlot(input: {
  now: Date;
  slotSizeMinutes: number;
  startAt: Date;
  timeZone: string;
}) {
  return listDefaultCandidateSlots(input).some(
    (slot) => slot.startAt.getTime() === input.startAt.getTime(),
  );
}

export function getDefaultSearchWindow(now: Date) {
  return {
    startsAt: now,
    endsAt: addUtcDays(startOfUtcDay(now), DEFAULT_WINDOW_DAYS),
  };
}

export function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

export function isValidSlotConfiguration(input: {
  slotSizeMinutes: number;
  timeZone: string;
}) {
  return (
    isValidSlotSizeMinutes(input.slotSizeMinutes) &&
    isValidTimeZone(input.timeZone)
  );
}

function addUtcDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function startOfUtcDay(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function assertValidSlotConfiguration(input: {
  slotSizeMinutes: number;
  timeZone: string;
}) {
  if (!isValidSlotConfiguration(input)) {
    throw new Error("invalid slot configuration");
  }
}

function addLocalDays(date: LocalDate, days: number): LocalDate {
  const next = new Date(Date.UTC(date.year, date.month - 1, date.day + days));

  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
  };
}

function isValidSlotSizeMinutes(slotSizeMinutes: number) {
  return (
    Number.isInteger(slotSizeMinutes) &&
    slotSizeMinutes > 0 &&
    slotSizeMinutes <= 240 &&
    (24 * 60) % slotSizeMinutes === 0
  );
}

function isValidTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

function isWeekday(date: LocalDate) {
  const day = new Date(
    Date.UTC(date.year, date.month - 1, date.day),
  ).getUTCDay();
  return day >= 1 && day <= 5;
}

function listWorkdaySlots(
  day: LocalDate,
  now: Date,
  slotSizeMinutes: number,
  timeZone: string,
) {
  const slots: SlotRange[] = [];

  for (
    let minute = WORKDAY_START_MINUTE;
    minute + slotSizeMinutes <= WORKDAY_END_MINUTE;
    minute += slotSizeMinutes
  ) {
    const startAt = localMinuteToUtcDate(day, minute, timeZone);
    const endAt = localMinuteToUtcDate(
      day,
      minute + slotSizeMinutes,
      timeZone,
    );

    if (startAt > now) {
      slots.push({ startAt, endAt });
    }
  }

  return slots;
}

function localMinuteToUtcDate(
  date: LocalDate,
  minuteOfDay: number,
  timeZone: string,
) {
  const localUtcTime = Date.UTC(
    date.year,
    date.month - 1,
    date.day,
    Math.floor(minuteOfDay / 60),
    minuteOfDay % 60,
  );
  const firstGuess = new Date(localUtcTime);
  const firstOffset = getTimeZoneOffsetMs(firstGuess, timeZone);
  const secondGuess = new Date(localUtcTime - firstOffset);
  const secondOffset = getTimeZoneOffsetMs(secondGuess, timeZone);

  return new Date(localUtcTime - secondOffset);
}

function getTimeZoneOffsetMs(date: Date, timeZone: string) {
  const parts = getTimeZoneDateTime(date, timeZone);
  const localTimeAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  return localTimeAsUtc - date.getTime();
}

function getTimeZoneDate(date: Date, timeZone: string): LocalDate {
  const parts = getTimeZoneDateTime(date, timeZone);

  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
  };
}

function getTimeZoneDateTime(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = formatter.formatToParts(date);

  return {
    year: readNumericPart(parts, "year"),
    month: readNumericPart(parts, "month"),
    day: readNumericPart(parts, "day"),
    hour: readNumericPart(parts, "hour"),
    minute: readNumericPart(parts, "minute"),
    second: readNumericPart(parts, "second"),
  };
}

function readNumericPart(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
) {
  const part = parts.find((candidate) => candidate.type === type);

  if (part === undefined) {
    throw new Error(`time zone formatter omitted ${type}`);
  }

  const value = Number.parseInt(part.value, 10);

  if (!Number.isInteger(value)) {
    throw new Error(`time zone formatter returned invalid ${type}`);
  }

  return value;
}
