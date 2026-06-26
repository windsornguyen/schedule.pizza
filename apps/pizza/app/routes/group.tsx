import { Form } from "react-router";

import {
  executeScheduleRequest,
  type ScheduleExecutionResult,
} from "@/api/v1_schedule";
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
import { serverContext } from "@/server-context";
import type { Route } from "./+types/group";

type ScheduledResult = Extract<
  ScheduleExecutionResult,
  { readonly code: "scheduled" }
>["body"];

type GroupActionData =
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
        | "calendar_unavailable"
        | "client_ip_unavailable"
        | "invalid_field"
        | "invalid_schedule_request"
        | "missing_field";
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
  const parsed = parseGroupScheduleForm(await request.formData(), now);

  if (parsed.code !== "parsed") {
    return {
      code: parsed.code,
      field: parsed.field,
      values: parsed.values,
    };
  }

  const clientIpHash = await readCloudflareClientIpHash(request);

  if (clientIpHash.code === "client_ip_unavailable") {
    return {
      code: "client_ip_unavailable",
      values: parsed.values,
    };
  }

  const env = context.get(serverContext).env;
  const scheduled = await executeScheduleRequest(createDb(env.DB), {
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

      <div className="grid gap-4 sm:grid-cols-3">
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
        <label className="block space-y-2">
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
      />
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
}: {
  readonly result: ScheduledResult;
  readonly timeZone: string;
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

function readErrorMessage(actionData: Exclude<GroupActionData, { code: "scheduled" }>) {
  if (actionData.code === "missing_field" || actionData.code === "invalid_field") {
    return `${actionData.field ?? "field"} is ${actionData.code === "missing_field" ? "required" : "invalid"}.`;
  }

  if (actionData.code === "booking_code_invalid") {
    return "one of those links has the wrong booking code.";
  }

  if (actionData.code === "booking_code_rate_limited") {
    return "too many booking-code checks. try again later.";
  }

  if (actionData.code === "client_ip_unavailable") {
    return "cloudflare did not provide a client ip header.";
  }

  if (actionData.code === "invalid_schedule_request") {
    return actionData.message ?? "schedule request is invalid.";
  }

  return "calendar unavailable. ask the host to reconnect google calendar.";
}
