export const DEFAULT_GROUP_DURATION_MINUTES = "30";
export const DEFAULT_GROUP_GRANULARITY_MINUTES = "15";
export const DEFAULT_GROUP_TIME_ZONE = "America/Los_Angeles";

export type GroupScheduleFormValues = {
  readonly durationMinutes: string;
  readonly granularityMinutes: string;
  readonly participants: string;
  readonly timeZone: string;
};

export function defaultGroupScheduleFormValues(): GroupScheduleFormValues {
  return {
    durationMinutes: DEFAULT_GROUP_DURATION_MINUTES,
    granularityMinutes: DEFAULT_GROUP_GRANULARITY_MINUTES,
    participants: "",
    timeZone: DEFAULT_GROUP_TIME_ZONE,
  };
}
