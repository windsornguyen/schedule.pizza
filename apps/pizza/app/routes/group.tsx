import { Form } from "react-router";

import {
  executeScheduleRequest,
  type ScheduleExecutionResult,
} from "@/api/v1_schedule";
import {
  bookGroupSlot,
  type BookGroupSlotResult,
} from "@/booking/book_group_slot.server";
import { parseRequiredGuestEmail } from "@/booking/guest_email";
import { parseOptionalGuestTimezone } from "@/booking/guest_timezone";
import { createDb } from "@/db/client.server";
import {
  parseGroupScheduleForm,
} from "@/group/group_schedule_form.server";
import {
  defaultGroupScheduleFormValues,
  type GroupScheduleFormValues,
} from "@/group/group_schedule_values";
import { readCloudflareClientIpHash } from "@/http/client_ip.server";
import { formatSlotLabel } from "@/scheduling/slot_labels";
import { parseUtcDateTime } from "@/scheduling/utc_datetime";
import { serverContext } from "@/server-context";
import type { Route } from "./+types/group";

type ScheduledResult = Extract<
  ScheduleExecutionResult,
  { readonly code: "scheduled" }
>["body"];

type GroupActionData =
  | {
      readonly code: "booked";
      readonly slot: { readonly end: string; readonly start: string };
      readonly timeZone: string;
      readonly values: GroupScheduleFormValues;
    }
  | {
      readonly code: "scheduled";
      readonly result: ScheduledResult;
      readonly timeZone: string;
      readonly values: GroupScheduleFormValues;
    }
  | {
      readonly code:
        | "booking_code_invalid"
        | "booking_code_rate_limited"
        | "booking_rate_limited"
        | "calendar_unavailable"
        | "client_ip_unavailable"
        | "invalid_field"
        | "invalid_schedule_request"
        | "missing_field"
        | "participant_email_missing"
        | "slot_unavailable";
      readonly field?: string;
      readonly message?: string;
      readonly values: GroupScheduleFormValues;
    };

export function meta() {
  return [
    { title: "group scheduling - schedule.pizza" },
    { name: "description", content: "find a time across several calendars." },
  ];
}

export async function action({
  context,
  request,
}: Route.ActionArgs): Promise<GroupActionData> {
  const now = new Date();
  const formData = await request.formData();
  const parsed = parseGroupScheduleForm(formData, now);

  if (parsed.code !== "parsed") {
    return {
      code: parsed.code,
      field: parsed.field,
      values: parsed.values,
    };
  }

  const isBookingIntent = formData.get("intent") === "book_group";
  const clientIpHash = await readCloudflareClientIpHash(request);

  if (clientIpHash.code === "client_ip_unavailable") {
    return {
      code: "client_ip_unavailable",
      values: parsed.values,
    };
  }

  const env = context.get(serverContext).env;
  const db = createDb(env.DB);

  if (isBookingIntent) {
    const bookingFields = parseGroupBookingFields(formData);

    if (bookingFields.code !== "parsed") {
      return {
        code: bookingFields.code,
        field: bookingFields.field,
        values: parsed.values,
      };
    }

    const booked = await bookGroupSlot(db, {
      body: parsed.body,
      env,
      guestEmail: bookingFields.guestEmail.value,
      guestEmailNormalized: bookingFields.guestEmail.normalized,
      guestName: bookingFields.guestName,
      guestTimezone: bookingFields.guestTimezone.value,
      ipHash: clientIpHash.ipHash,
      now,
      slotStartAt: bookingFields.slotStartAt,
      source: "web",
    });

    return groupActionDataFromBookResult(booked, {
      timeZone: parsed.body.timeZone,
      values: parsed.values,
    });
  }

  const scheduled = await executeScheduleRequest(db, {
    body: parsed.body,
    env,
    ipHash: clientIpHash.ipHash,
    now,
  });

  return groupActionDataFromScheduleResult(scheduled, {
    timeZone: parsed.body.timeZone,
    values: parsed.values,
  });
}

export default function Group({
  actionData,
}: Route.ComponentProps) {
  const values = actionData?.values ?? defaultGroupScheduleFormValues();

  return (
    <main className="mx-auto w-full max-w-[550px] px-4 pt-20 pb-24 antialiased">
      <h1 className="text-sm font-semibold">group scheduling</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Paste each person's schedule.pizza link. If everyone is free, you get
        exact times. If not, you get the closest times and the conflicts.
      </p>

      <GroupScheduleForm values={values} />
      <ActionMessage actionData={actionData ?? null} />
    </main>
  );
}

function GroupScheduleForm({
  values,
}: {
  readonly values: GroupScheduleFormValues;
}) {
  return (
    <Form method="post" className="mt-10 space-y-4">
      <input type="hidden" name="intent" value="find" />
      <label className="block space-y-2">
        <span className="text-sm font-semibold">links</span>
        <textarea
          name="participants"
          required
          rows={5}
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm leading-6 outline-none focus:border-ring focus:ring-[3px] focus:ring-ring/50"
          placeholder={[
            "schedule.pizza/alice?code=moon-tiger-seven",
            "schedule.pizza/bob?code=river-lime-harbor",
          ].join("\n")}
          defaultValue={values.participants}
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-2">
          <span className="text-sm font-semibold">minutes</span>
          <input
            name="durationMinutes"
            inputMode="numeric"
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus:border-ring focus:ring-[3px] focus:ring-ring/50"
            defaultValue={values.durationMinutes}
          />
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-semibold">grain</span>
          <input
            name="granularityMinutes"
            inputMode="numeric"
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus:border-ring focus:ring-[3px] focus:ring-ring/50"
            defaultValue={values.granularityMinutes}
          />
        </label>
        <label className="block space-y-2 sm:col-span-2">
          <span className="text-sm font-semibold">time zone</span>
          <input
            name="timeZone"
            autoComplete="off"
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus:border-ring focus:ring-[3px] focus:ring-ring/50"
            defaultValue={values.timeZone}
          />
        </label>
      </div>

      <button
        type="submit"
        className="rounded-md border px-3 py-2 text-sm transition-colors hover:bg-muted"
      >
        find time
      </button>
    </Form>
  );
}

function ActionMessage({
  actionData,
}: {
  readonly actionData: GroupActionData | null;
}) {
  if (actionData === null) {
    return null;
  }

  if (actionData.code === "scheduled") {
    return (
      <ScheduleResultView
        result={actionData.result}
        timeZone={actionData.timeZone}
        values={actionData.values}
      />
    );
  }

  if (actionData.code === "booked") {
    return (
      <p className="mt-10 text-sm leading-6 text-muted-foreground">
        booked {formatSlotLabel(actionData.slot, actionData.timeZone)}.
        everyone gets a calendar invite.
      </p>
    );
  }

  return (
    <p className="mt-8 text-sm leading-6 text-destructive">
      {readErrorMessage(actionData)}
    </p>
  );
}

function ScheduleResultView({
  result,
  timeZone,
  values,
}: {
  readonly result: ScheduledResult;
  readonly timeZone: string;
  readonly values: GroupScheduleFormValues;
}) {
  if (result.kind === "exact") {
    return (
      <section className="mt-10 space-y-3">
        <h2 className="text-sm font-semibold">exact times</h2>
        {result.slots.map((slot) => (
          <p key={slot.start} className="text-sm text-muted-foreground">
            {formatSlotLabel(slot, timeZone)}
          </p>
        ))}
        <BookExactSlotForm
          slots={result.slots}
          timeZone={timeZone}
          values={values}
        />
      </section>
    );
  }

  if (result.kind === "alternatives") {
    return (
      <section className="mt-10 space-y-4">
        <h2 className="text-sm font-semibold">closest times</h2>
        {result.slots.map((slot) => (
          <div key={slot.slot.start} className="space-y-1">
            <p className="text-sm text-muted-foreground">
              {formatSlotLabel(slot.slot, timeZone)}
            </p>
            <ConflictText slot={slot} timeZone={timeZone} />
          </div>
        ))}
      </section>
    );
  }

  return (
    <p className="mt-10 text-sm text-muted-foreground">
      no candidate times in the next two weeks.
    </p>
  );
}

function BookExactSlotForm({
  slots,
  timeZone,
  values,
}: {
  readonly slots: readonly { readonly end: string; readonly start: string }[];
  readonly timeZone: string;
  readonly values: GroupScheduleFormValues;
}) {
  return (
    <Form method="post" className="mt-6 space-y-4">
      <input type="hidden" name="intent" value="book_group" />
      <input type="hidden" name="participants" value={values.participants} />
      <input type="hidden" name="durationMinutes" value={values.durationMinutes} />
      <input type="hidden" name="granularityMinutes" value={values.granularityMinutes} />
      <input type="hidden" name="timeZone" value={values.timeZone} />
      <input type="hidden" name="timezone" value={timeZone} />
      <label className="block space-y-2">
        <span className="text-sm font-semibold">name</span>
        <input
          name="name"
          required
          autoComplete="name"
          className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus:border-ring focus:ring-[3px] focus:ring-ring/50"
        />
      </label>
      <label className="block space-y-2">
        <span className="text-sm font-semibold">email</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus:border-ring focus:ring-[3px] focus:ring-ring/50"
        />
      </label>
      <div className="space-y-2">
        <p className="text-sm font-semibold">book</p>
        {slots.map((slot) => (
          <label key={slot.start} className="flex items-center gap-2 text-sm">
            <input type="radio" name="slot" value={slot.start} required />
            <span>{formatSlotLabel(slot, timeZone)}</span>
          </label>
        ))}
      </div>
      <button
        type="submit"
        className="rounded-md border px-3 py-2 text-sm transition-colors hover:bg-muted"
      >
        book group
      </button>
    </Form>
  );
}

function ConflictText({
  slot,
  timeZone,
}: {
  readonly slot: Extract<ScheduledResult, { readonly kind: "alternatives" }>["slots"][number];
  readonly timeZone: string;
}) {
  const conflicts = [
    ...slot.hardConflicts.map((conflict) =>
      `${conflict.user} is busy ${formatSlotLabel(conflict.interval, timeZone)}`,
    ),
    ...slot.softConflicts.map((conflict) =>
      `${conflict.user} can move ${formatSlotLabel(conflict.interval, timeZone)}`,
    ),
  ];

  return (
    <p className="text-sm leading-6 text-muted-foreground">
      cost {slot.conflictCost}
      {conflicts.length > 0 ? `; ${conflicts.join("; ")}` : ""}
    </p>
  );
}

function groupActionDataFromScheduleResult(
  scheduled: ScheduleExecutionResult,
  input: {
    readonly timeZone: string;
    readonly values: GroupScheduleFormValues;
  },
): GroupActionData {
  if (scheduled.code === "scheduled") {
    return {
      code: "scheduled",
      result: scheduled.body,
      timeZone: input.timeZone,
      values: input.values,
    };
  }

  if (scheduled.code === "invalid_schedule_request") {
    return {
      code: "invalid_schedule_request",
      message: scheduled.requestCode,
      values: input.values,
    };
  }

  if (
    scheduled.code === "booking_code_invalid" ||
    scheduled.code === "booking_code_rate_limited"
  ) {
    return { code: scheduled.code, values: input.values };
  }

  return { code: "calendar_unavailable", values: input.values };
}

function groupActionDataFromBookResult(
  booked: BookGroupSlotResult,
  input: {
    readonly timeZone: string;
    readonly values: GroupScheduleFormValues;
  },
): GroupActionData {
  if (booked.code === "booked") {
    return {
      code: "booked",
      slot: {
        start: booked.slot.startAt.toISOString(),
        end: booked.slot.endAt.toISOString(),
      },
      timeZone: input.timeZone,
      values: input.values,
    };
  }

  if (
    booked.code === "booking_code_invalid" ||
    booked.code === "booking_code_rate_limited" ||
    booked.code === "booking_rate_limited" ||
    booked.code === "participant_email_missing"
  ) {
    return { code: booked.code, values: input.values };
  }

  if (booked.code === "invalid_slot" || booked.code === "slot_unavailable") {
    return { code: "slot_unavailable", values: input.values };
  }

  return { code: "calendar_unavailable", values: input.values };
}

function parseGroupBookingFields(formData: FormData):
  | {
      readonly code: "parsed";
      readonly guestEmail: { readonly normalized: string; readonly value: string };
      readonly guestName: string;
      readonly guestTimezone: { readonly value: string | null };
      readonly slotStartAt: Date;
    }
  | { readonly code: "invalid_field" | "missing_field"; readonly field: string } {
  const rawSlot = formData.get("slot");

  if (rawSlot === null) {
    return { code: "missing_field", field: "slot" };
  }

  const slotStartAt = typeof rawSlot === "string" ? parseUtcDateTime(rawSlot) : null;

  if (slotStartAt === null) {
    return { code: "invalid_field", field: "slot" };
  }

  const guestName = readRequiredString(formData, "name");

  if (guestName === null) {
    return { code: "missing_field", field: "name" };
  }

  const guestEmail = parseRequiredGuestEmail(formData.get("email"));

  if (guestEmail.code !== "parsed") {
    return {
      code: guestEmail.code === "missing" ? "missing_field" : "invalid_field",
      field: "email",
    };
  }

  const guestTimezone = parseOptionalGuestTimezone(formData.get("timezone"));

  if (guestTimezone.code !== "parsed") {
    return { code: "invalid_field", field: "timezone" };
  }

  return {
    code: "parsed",
    guestEmail: { normalized: guestEmail.normalized, value: guestEmail.value },
    guestName,
    guestTimezone: { value: guestTimezone.value },
    slotStartAt,
  };
}

function readRequiredString(formData: FormData, field: string) {
  const value = formData.get(field);

  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  return value.trim();
}

function readErrorMessage(actionData: Exclude<GroupActionData, { code: "booked" | "scheduled" }>) {
  if (actionData.code === "missing_field" || actionData.code === "invalid_field") {
    return `${actionData.field ?? "field"} is ${actionData.code === "missing_field" ? "required" : "invalid"}.`;
  }

  if (actionData.code === "booking_code_invalid") {
    return "one of those links has the wrong booking code.";
  }

  if (actionData.code === "booking_code_rate_limited") {
    return "too many booking-code checks. try again later.";
  }

  if (actionData.code === "booking_rate_limited") {
    return "too many bookings for one of these codes. ask for a new code.";
  }

  if (actionData.code === "client_ip_unavailable") {
    return "cloudflare did not provide a client ip header.";
  }

  if (actionData.code === "slot_unavailable") {
    return "that time is no longer available.";
  }

  if (actionData.code === "invalid_schedule_request") {
    return actionData.message ?? "schedule request is invalid.";
  }

  if (actionData.code === "participant_email_missing") {
    return "one participant needs to reconnect google calendar.";
  }

  return "calendar unavailable. ask the host to reconnect google calendar.";
}
