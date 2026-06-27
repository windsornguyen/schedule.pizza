/**
 * UTC datetime parsing for public API boundaries.
 *
 * schedule.pizza emits instants as ISO strings ending in `Z`. External callers
 * must send the same unambiguous shape so JavaScript date-only and local-time
 * coercions cannot affect booking or group scheduling decisions.
 */

const ISO_UTC_DATETIME_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u;

export function parseUtcDateTime(value: string) {
  if (!ISO_UTC_DATETIME_PATTERN.test(value)) {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

export function parseUtcDateTimeMs(value: string) {
  return parseUtcDateTime(value)?.getTime() ?? null;
}
