import { Form } from "react-router";

import { bookHostSlot } from "@/booking/book_slot.server";
import { parseOptionalGuestEmail } from "@/booking/guest_email";
import { createDb } from "@/db/client.server";
import { authorizeBookingCode } from "@/db/functions/booking_code_authorizations.server";
import { normalizeBookingCode } from "@/db/functions/booking_codes.server";
import { normalizeUsername } from "@/db/functions/host_profiles.server";
import { readCloudflareClientIpHash } from "@/http/client_ip.server";
import { listHostAvailableSlots } from "@/scheduling/host_availability.server";
import { formatSlotLabel } from "@/scheduling/slot_labels";
import {
  getDefaultSearchWindow,
  isValidSlotConfiguration,
  listDefaultCandidateSlots,
  parseSlotStart,
  serializeSlot,
  type SlotRange,
} from "@/scheduling/slots.server";
import { serverContext } from "@/server-context";
import type { ServerEnv } from "@/server-context";
import type { Route } from "./+types/profile";

type ProfileActionData =
  | {
      readonly code: "booked";
      readonly slot: { readonly end: string; readonly start: string };
    }
  | {
      readonly code:
        | "calendar_unavailable"
        | "invalid_field"
        | "slot_unavailable";
    };

export function meta({ params }: Route.MetaArgs) {
  return [
    { title: `${params.username ?? "book"} - schedule.pizza` },
    { name: "description", content: "easiest way to find a time." },
  ];
}

export async function loader({ context, params, request }: Route.LoaderArgs) {
  const username = normalizeUsername(params.username ?? "");

  if (username === null) {
    throw new Response("not found", { status: 404 });
  }

  const url = new URL(request.url);
  const bookingCode = normalizeBookingCode(url.searchParams.get("code") ?? "");

  if (bookingCode === null) {
    return { state: "code_required" as const, username };
  }

  const slots = await loadAuthorizedSlots({
    bookingCode,
    env: context.get(serverContext).env,
    request,
    username,
  });

  if (slots.code === "unauthorized") {
    return { state: "code_required" as const, username };
  }

  if (slots.code === "calendar_unavailable") {
    return { state: "calendar_unavailable" as const, username };
  }

  return {
    state: "available" as const,
    username,
    bookingCode,
    slotSizeMinutes: slots.slotSizeMinutes,
    slots: slots.slots.map(serializeSlot),
    timezone: slots.timezone,
  };
}

export async function action({ context, params, request }: Route.ActionArgs) {
  const username = normalizeUsername(params.username ?? "");

  if (username === null) {
    throw new Response("not found", { status: 404 });
  }

  const formData = await request.formData();
  const bookingCode = readBookingCode(formData);
  const slotStartAt = readSlotStart(formData);
  const guestName = readRequiredString(formData, "name");
  const guestEmail = parseOptionalGuestEmail(formData.get("email"));

  if (
    bookingCode === null ||
    slotStartAt === null ||
    guestName === null ||
    guestEmail.code !== "parsed"
  ) {
    return { code: "invalid_field" as const };
  }

  const guestTimezone = readOptionalString(formData, "timezone");
  const result = await bookAuthorizedSlot({
    bookingCode,
    env: context.get(serverContext).env,
    guestEmail: guestEmail.value,
    guestName,
    guestTimezone,
    request,
    slotStartAt,
    username,
  });

  return result;
}

export default function Profile({
  actionData,
  loaderData,
}: Route.ComponentProps) {
  const profileActionData = actionData ?? null;
  const bookedSlotLabel = profileActionData?.code === "booked" &&
    loaderData.state === "available"
    ? formatSlotLabel(profileActionData.slot, loaderData.timezone)
    : null;

  return (
    <main className="mx-auto w-full max-w-[550px] px-4 pt-20 pb-24 antialiased">
      <h1 className="text-sm font-semibold">schedule with {loaderData.username}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        easiest way to find a time.
      </p>

      {bookedSlotLabel !== null ? (
        <p className="mt-8 text-sm text-muted-foreground">
          booked {bookedSlotLabel}
        </p>
      ) : null}

      <ProfileState actionData={profileActionData} loaderData={loaderData} />
    </main>
  );
}

function ProfileState({
  actionData,
  loaderData,
}: {
  readonly actionData: ProfileActionData | null;
  readonly loaderData: Route.ComponentProps["loaderData"];
}) {
  if (loaderData.state === "code_required") {
    return <CodeForm username={loaderData.username} />;
  }

  if (loaderData.state === "calendar_unavailable") {
    return <CalendarUnavailable />;
  }

  return (
    <BookingForm
      actionData={actionData}
      bookingCode={loaderData.bookingCode}
      slots={loaderData.slots}
      timezone={loaderData.timezone}
    />
  );
}

function CalendarUnavailable() {
  return (
    <p className="mt-10 text-sm text-muted-foreground">
      calendar unavailable. ask the host to reconnect google calendar.
    </p>
  );
}

function CodeForm({ username }: { readonly username: string }) {
  return (
    <Form method="get" className="mt-10 space-y-4">
      <label className="block space-y-2">
        <span className="text-sm font-semibold">booking code</span>
        <input
          name="code"
          autoComplete="off"
          className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus:border-ring focus:ring-[3px] focus:ring-ring/50"
          placeholder="moon-tiger-seven"
        />
      </label>
      <button
        type="submit"
        className="rounded-md border px-3 py-2 text-sm transition-colors hover:bg-muted"
      >
        show times
      </button>
      <p className="text-sm text-muted-foreground">
        schedule.pizza/{username} needs a code.
      </p>
    </Form>
  );
}

function BookingForm({
  actionData,
  bookingCode,
  slots,
  timezone,
}: {
  readonly actionData: ProfileActionData | null;
  readonly bookingCode: string;
  readonly slots: readonly { readonly end: string; readonly start: string }[];
  readonly timezone: string;
}) {
  return (
    <Form method="post" className="mt-10 space-y-4">
      <input type="hidden" name="code" value={bookingCode} />
      <label className="block space-y-2">
        <span className="text-sm font-semibold">name</span>
        <input
          name="name"
          autoComplete="name"
          className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus:border-ring focus:ring-[3px] focus:ring-ring/50"
        />
      </label>
      <label className="block space-y-2">
        <span className="text-sm font-semibold">email</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus:border-ring focus:ring-[3px] focus:ring-ring/50"
        />
      </label>
      <input type="hidden" name="timezone" value={timezone} />
      <div className="space-y-2">
        <p className="text-sm font-semibold">time</p>
        {slots.length === 0 ? (
          <p className="text-sm text-muted-foreground">no slots available.</p>
        ) : (
          slots.slice(0, 12).map((slot) => (
            <label key={slot.start} className="flex items-center gap-2 text-sm">
              <input type="radio" name="slot" value={slot.start} />
              <span>{formatSlotLabel(slot, timezone)}</span>
            </label>
          ))
        )}
      </div>
      <button
        type="submit"
        className="rounded-md border px-3 py-2 text-sm transition-colors hover:bg-muted"
      >
        book
      </button>
      {actionData?.code === "slot_unavailable" ? (
        <p className="text-sm text-destructive">slot unavailable.</p>
      ) : null}
      {actionData?.code === "invalid_field" ? (
        <p className="text-sm text-destructive">fill the required fields.</p>
      ) : null}
      {actionData?.code === "calendar_unavailable" ? (
        <p className="text-sm text-destructive">
          calendar unavailable. ask the host to reconnect google calendar.
        </p>
      ) : null}
    </Form>
  );
}

async function loadAuthorizedSlots(input: {
  readonly bookingCode: string;
  readonly env: ServerEnv;
  readonly request: Request;
  readonly username: string;
}): Promise<
  | {
      readonly code: "authorized";
      readonly slotSizeMinutes: number;
      readonly slots: readonly SlotRange[];
      readonly timezone: string;
    }
  | { readonly code: "calendar_unavailable" }
  | { readonly code: "unauthorized" }
> {
  const clientIpHash = await readCloudflareClientIpHash(input.request);
  if (clientIpHash.code === "client_ip_unavailable") {
    throw new Response("client ip unavailable", { status: 500 });
  }

  const db = createDb(input.env.DB);
  const now = new Date();
  const authorization = await authorizeBookingCode(db, {
    bookingCode: input.bookingCode,
    ipHash: clientIpHash.ipHash,
    now,
    username: input.username,
  });

  if (authorization.code !== "authorized") {
    return { code: "unauthorized" };
  }

  const host = authorization.access.host;
  if (!isValidSlotConfiguration({ slotSizeMinutes: host.slotSizeMinutes, timeZone: host.timezone })) {
    throw new Response("host slot configuration invalid", { status: 500 });
  }

  const window = getDefaultSearchWindow(now);
  const availability = await listHostAvailableSlots(db, {
    candidateSlots: listDefaultCandidateSlots({
      now,
      slotSizeMinutes: host.slotSizeMinutes,
      timeZone: host.timezone,
    }),
    env: input.env,
    host,
    now,
    window,
  });

  if (availability.code !== "listed") {
    return { code: "calendar_unavailable" };
  }

  return {
    code: "authorized",
    slotSizeMinutes: host.slotSizeMinutes,
    slots: availability.slots,
    timezone: host.timezone,
  };
}

async function bookAuthorizedSlot(input: {
  readonly bookingCode: string;
  readonly env: ServerEnv;
  readonly guestEmail: string | null;
  readonly guestName: string;
  readonly guestTimezone: string | null;
  readonly request: Request;
  readonly slotStartAt: Date;
  readonly username: string;
}) {
  const clientIpHash = await readCloudflareClientIpHash(input.request);
  if (clientIpHash.code === "client_ip_unavailable") {
    throw new Response("client ip unavailable", { status: 500 });
  }

  const db = createDb(input.env.DB);
  const now = new Date();
  const authorization = await authorizeBookingCode(db, {
    bookingCode: input.bookingCode,
    ipHash: clientIpHash.ipHash,
    now,
    username: input.username,
  });

  if (authorization.code !== "authorized") {
    return { code: "slot_unavailable" as const };
  }

  const host = authorization.access.host;
  const booked = await bookHostSlot(db, {
    env: input.env,
    host,
    bookingCodeId: authorization.access.code.id,
    guestName: input.guestName,
    guestEmail: input.guestEmail,
    guestEmailNormalized: input.guestEmail?.toLowerCase() ?? null,
    guestTimezone: input.guestTimezone,
    source: "web",
    now,
    slotStartAt: input.slotStartAt,
  });

  if (booked.code === "booked") {
    return { code: "booked" as const, slot: serializeSlot(booked.slot) };
  }

  if (booked.code === "invalid_slot" || booked.code === "slot_unavailable") {
    return { code: "slot_unavailable" as const };
  }

  if (booked.code === "host_configuration_invalid") {
    throw new Response("host slot configuration invalid", { status: 500 });
  }

  if (
    booked.code === "booking_confirmation_failed" ||
    booked.code === "booking_failure_record_failed"
  ) {
    throw new Response(booked.code, { status: 500 });
  }

  return { code: "calendar_unavailable" as const };
}

function readBookingCode(formData: FormData) {
  const value = formData.get("code");
  return typeof value === "string" ? normalizeBookingCode(value) : null;
}

function readSlotStart(formData: FormData) {
  const value = formData.get("slot");
  return typeof value === "string" ? parseSlotStart(value) : null;
}

function readRequiredString(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readOptionalString(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}
