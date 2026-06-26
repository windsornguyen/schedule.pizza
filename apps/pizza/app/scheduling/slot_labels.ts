type SerializedSlot = {
  readonly end: string;
  readonly start: string;
};

export function formatSlotLabel(slot: SerializedSlot, timeZone: string) {
  const startAt = parseSlotInstant(slot.start);
  const endAt = parseSlotInstant(slot.end);
  const dateFormatter = new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone,
    weekday: "short",
  });
  const startTimeFormatter = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  });
  const endTimeFormatter = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
    timeZoneName: "short",
  });

  return [
    `${dateFormatter.format(startAt)},`,
    startTimeFormatter.format(startAt),
    "-",
    endTimeFormatter.format(endAt),
  ].join(" ");
}

function parseSlotInstant(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error("slot label input must be an ISO timestamp");
  }

  return date;
}
