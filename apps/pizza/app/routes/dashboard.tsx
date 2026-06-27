import { Form, redirect } from "react-router";

import { readAuthSession } from "@/auth.server";
import {
  cancelHostBooking,
  readHostBookingCancellation,
} from "@/booking/cancel_host_booking.server";
import { readCalendarStatus } from "@/dashboard/calendar_status.server";
import {
  parseProfileForm,
  readDefaultUsernameFromEmail,
} from "@/dashboard/profile_form";
import { updateExistingProfile } from "@/dashboard/profile_update.server";
import { createDb } from "@/db/client.server";
import { listUpcomingConfirmedBookingsForHost } from "@/db/functions/bookings.server";
import {
  findActiveBookingCodeForHost,
  rotateBookingCode,
} from "@/db/functions/booking_codes.server";
import {
  createHostProfileWithBookingCode,
  findHostProfileByAuthUserId,
} from "@/db/functions/host_profiles.server";
import { formatSlotLabel } from "@/scheduling/slot_labels";
import { serverContext, type ServerEnv } from "@/server-context";
import type { Route } from "./+types/dashboard";

type DashboardActionData = NonNullable<Route.ComponentProps["actionData"]> | null;
type DashboardActionCode = NonNullable<DashboardActionData>["code"];
type DashboardCalendarStatus = "connected" | "reconnect_required";

export function meta() {
  return [{ title: "dashboard - schedule.pizza" }];
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(serverContext);
  const session = await readAuthSession(env, request.headers);

  if (session === null) {
    throw redirect("/login");
  }

  const db = createDb(env.DB);
  const profile = await findHostProfileByAuthUserId(db, session.user.id);

  if (profile === null) {
    return { email: session.user.email, profile: null };
  }

  const now = new Date();
  const [activeBookingCode, calendarStatus, bookings] = await Promise.all([
    findActiveBookingCodeForHost(db, {
      hostId: profile.id,
      now,
    }),
    readCalendarStatus(db, env, session.user.id, now),
    listUpcomingConfirmedBookingsForHost(db, {
      hostId: profile.id,
      limit: 5,
      now,
    }),
  ]);

  const serializedBookings = await Promise.all(
    bookings.map(async (booking) => {
      const cancellation = await readHostBookingCancellation(
        db,
        booking.calendarEventId,
      );

      return {
        canCancel: cancellation.canCancel,
        cancelDisabledReason: cancellation.disabledReason,
        id: booking.id,
        kind: cancellation.kind,
        guestEmail: booking.guestEmail,
        guestName: booking.guestName,
        slot: {
          start: booking.slotStartAt.toISOString(),
          end: booking.slotEndAt.toISOString(),
        },
      };
    }),
  );

  return {
    email: session.user.email,
    profile: {
      bookings: serializedBookings,
      calendarStatus,
      hasActiveBookingCode: activeBookingCode !== null,
      slotSizeMinutes: profile.slotSizeMinutes,
      timezone: profile.timezone,
      username: profile.username,
    },
  };
}

export async function action({ context, request }: Route.ActionArgs) {
  const { env } = context.get(serverContext);
  const originError = rejectCrossSiteDashboardAction(env, request);

  if (originError !== null) {
    throw originError;
  }

  const session = await readAuthSession(env, request.headers);

  if (session === null) {
    throw redirect("/login");
  }

  const db = createDb(env.DB);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create_profile") {
    return createProfileAndCode(db, {
      authUserId: session.user.id,
      email: session.user.email,
      env,
      formData,
    });
  }

  if (intent === "create_code") {
    return createCodeForExistingProfile(db, {
      authUserId: session.user.id,
      env,
    });
  }

  if (intent === "update_profile") {
    return updateExistingProfile(db, {
      authUserId: session.user.id,
      email: session.user.email,
      env,
      formData,
    });
  }

  if (intent === "cancel_booking") {
    return cancelExistingBooking(db, {
      authUserId: session.user.id,
      env,
      formData,
    });
  }

  return { code: "invalid_intent" as const };
}

function rejectCrossSiteDashboardAction(env: ServerEnv, request: Request) {
  const origin = request.headers.get("Origin");

  if (origin === null || origin.trim() === "") {
    return null;
  }

  const trustedOrigin = readTrustedDashboardOrigin(env);

  if (trustedOrigin.code === "runtime_secret_missing") {
    return new Response("runtime_secret_missing", { status: 503 });
  }

  return origin === trustedOrigin.origin
    ? null
    : new Response("forbidden_origin", { status: 403 });
}

function readTrustedDashboardOrigin(env: ServerEnv) {
  const authUrl = env.BETTER_AUTH_URL;

  if (authUrl === undefined || authUrl.trim() === "") {
    return { code: "runtime_secret_missing" as const };
  }

  try {
    return { code: "read" as const, origin: new URL(authUrl).origin };
  } catch {
    return { code: "runtime_secret_missing" as const };
  }
}

export default function Dashboard({
  actionData,
  loaderData,
}: Route.ComponentProps) {
  const dashboardActionData = actionData ?? null;

  return (
    <DashboardContent
      actionData={dashboardActionData}
      loaderData={loaderData}
    />
  );
}

export function DashboardContent({
  actionData,
  loaderData,
}: {
  readonly actionData: DashboardActionData;
  readonly loaderData: Route.ComponentProps["loaderData"];
}) {
  return (
    <main className="mx-auto w-full max-w-[550px] px-4 pt-20 pb-24 antialiased">
      <h1 className="text-sm font-semibold">dashboard</h1>
      <p className="mt-2 text-sm text-muted-foreground">{loaderData.email}</p>

      {loaderData.profile === null ? (
        <CreateProfileForm
          actionData={actionData}
          defaultUsername={readDefaultUsernameFromEmail(loaderData.email)}
        />
      ) : (
        <ProfilePanel actionData={actionData} profile={loaderData.profile} />
      )}
    </main>
  );
}

function CreateProfileForm({
  actionData,
  defaultUsername,
}: {
  readonly actionData: DashboardActionData;
  readonly defaultUsername: string;
}) {
  return (
    <Form method="post" className="mt-10 space-y-4">
      <input type="hidden" name="intent" value="create_profile" />
      <label className="block space-y-2">
        <span className="text-sm font-semibold">username</span>
        <input
          name="username"
          autoComplete="off"
          className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus:border-ring focus:ring-[3px] focus:ring-ring/50"
          defaultValue={defaultUsername}
          placeholder="alice"
        />
      </label>
      <label className="block space-y-2">
        <span className="text-sm font-semibold">time zone</span>
        <input
          name="timezone"
          autoComplete="off"
          className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus:border-ring focus:ring-[3px] focus:ring-ring/50"
          defaultValue="America/Los_Angeles"
        />
      </label>
      <label className="block space-y-2">
        <span className="text-sm font-semibold">slot minutes</span>
        <select
          name="slotSizeMinutes"
          className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus:border-ring focus:ring-[3px] focus:ring-ring/50"
          defaultValue="30"
        >
          <option value="15">15</option>
          <option value="30">30</option>
          <option value="45">45</option>
          <option value="60">60</option>
        </select>
      </label>
      <button
        type="submit"
        className="rounded-md border px-3 py-2 text-sm transition-colors hover:bg-muted"
      >
        create profile
      </button>
      <ActionMessage actionData={actionData} />
    </Form>
  );
}

function ProfilePanel({
  actionData,
  profile,
}: {
  readonly actionData: DashboardActionData;
  readonly profile: NonNullable<Route.ComponentProps["loaderData"]["profile"]>;
}) {
  return (
    <section className="mt-10 space-y-4">
      <p className="text-sm text-muted-foreground">
        schedule.pizza/{profile.username}
      </p>
      <p className="text-sm text-muted-foreground">
        {profile.slotSizeMinutes} minute slots, {profile.timezone}
      </p>
      <ActiveBookingCodeNotice
        calendarStatus={profile.calendarStatus}
        hasActiveBookingCode={profile.hasActiveBookingCode}
      />
      {profile.calendarStatus === "reconnect_required" ? (
        <CalendarReconnectNotice />
      ) : null}
      <Form method="post" className="space-y-4">
        <input type="hidden" name="intent" value="update_profile" />
        <label className="block space-y-2">
          <span className="text-sm font-semibold">username</span>
          <input
            name="username"
            autoComplete="off"
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus:border-ring focus:ring-[3px] focus:ring-ring/50"
            defaultValue={profile.username}
          />
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-semibold">time zone</span>
          <input
            name="timezone"
            autoComplete="off"
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus:border-ring focus:ring-[3px] focus:ring-ring/50"
            defaultValue={profile.timezone}
          />
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-semibold">slot minutes</span>
          <select
            name="slotSizeMinutes"
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus:border-ring focus:ring-[3px] focus:ring-ring/50"
            defaultValue={String(profile.slotSizeMinutes)}
          >
            <option value="15">15</option>
            <option value="30">30</option>
            <option value="45">45</option>
            <option value="60">60</option>
          </select>
        </label>
        <button
          type="submit"
          className="rounded-md border px-3 py-2 text-sm transition-colors hover:bg-muted"
        >
          save profile
        </button>
      </Form>
      {profile.calendarStatus === "connected" ? (
        <BookingCodeForm hasActiveBookingCode={profile.hasActiveBookingCode} />
      ) : null}
      <ActionMessage actionData={actionData} />
      <UpcomingBookings bookings={profile.bookings} timezone={profile.timezone} />
    </section>
  );
}

function ActiveBookingCodeNotice({
  calendarStatus,
  hasActiveBookingCode,
}: {
  readonly calendarStatus: DashboardCalendarStatus;
  readonly hasActiveBookingCode: boolean;
}) {
  return (
    <p className="text-sm text-muted-foreground">
      {readActiveBookingCodeNotice({ calendarStatus, hasActiveBookingCode })}
    </p>
  );
}

function CalendarReconnectNotice() {
  return (
    <p className="text-sm text-destructive">
      google calendar needs{" "}
      <a
        href="/auth/google"
        className="underline decoration-border underline-offset-4"
      >
        reconnect
      </a>{" "}
      before availability and bookings work.
    </p>
  );
}

function BookingCodeForm({
  hasActiveBookingCode,
}: {
  readonly hasActiveBookingCode: boolean;
}) {
  return (
    <Form method="post">
      <input type="hidden" name="intent" value="create_code" />
      <button
        type="submit"
        className="rounded-md border px-3 py-2 text-sm transition-colors hover:bg-muted"
      >
        {readBookingCodeActionLabel(hasActiveBookingCode)}
      </button>
    </Form>
  );
}

function UpcomingBookings({
  bookings,
  timezone,
}: {
  readonly bookings: NonNullable<Route.ComponentProps["loaderData"]["profile"]>["bookings"];
  readonly timezone: string;
}) {
  if (bookings.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold">upcoming</h2>
      {bookings.map((booking) => (
        <div key={booking.id} className="space-y-1">
          <p className="text-sm text-muted-foreground">
            {formatSlotLabel(booking.slot, timezone)}
            {" with "}
            {booking.guestName}
            {booking.guestEmail === null ? "" : ` <${booking.guestEmail}>`}
          </p>
          {booking.canCancel ? (
            <Form method="post">
              <input type="hidden" name="intent" value="cancel_booking" />
              <input type="hidden" name="bookingId" value={booking.id} />
              <button
                type="submit"
                className="rounded-md border px-3 py-2 text-sm transition-colors hover:bg-muted"
              >
                cancel
              </button>
            </Form>
          ) : (
            <p className="text-sm text-muted-foreground">
              {readBookingCancellationNotice(booking)}
            </p>
          )}
        </div>
      ))}
    </section>
  );
}

function readBookingCancellationNotice(
  booking: NonNullable<Route.ComponentProps["loaderData"]["profile"]>["bookings"][number],
) {
  if (booking.cancelDisabledReason === "group_booking") {
    return "group booking. ask the organizer to cancel from google calendar.";
  }

  return "calendar event missing. reconnect google calendar.";
}

function ActionMessage({
  actionData,
}: {
  readonly actionData: DashboardActionData;
}) {
  if (actionData === null) {
    return null;
  }

  if (actionData.code === "created_code" || actionData.code === "created_profile") {
    const bookingUrl = formatDashboardBookingUrl(actionData);

    return (
      <p className="text-sm text-muted-foreground">
        code: <span className="font-mono">{actionData.bookingCode}</span>
        <br />
        link:{" "}
        <a
          href={bookingUrl}
          className="break-all font-mono underline decoration-border underline-offset-4 transition-colors hover:text-foreground"
        >
          {bookingUrl}
        </a>
        {actionData.code === "created_code" ? (
          <>
            <br />
            previous codes are revoked.
          </>
        ) : null}
      </p>
    );
  }

  if (actionData.code === "updated_profile") {
    if (hasDashboardBookingUrl(actionData)) {
      const bookingUrl = formatDashboardBookingUrl(actionData);

      return (
        <p className="text-sm text-muted-foreground">
          saved. username changed, so previous codes are revoked.
          <br />
          code: <span className="font-mono">{actionData.bookingCode}</span>
          <br />
          link:{" "}
          <a
            href={bookingUrl}
            className="break-all font-mono underline decoration-border underline-offset-4 transition-colors hover:text-foreground"
          >
            {bookingUrl}
          </a>
        </p>
      );
    }

    return <p className="text-sm text-muted-foreground">saved.</p>;
  }

  if (actionData.code === "cancelled") {
    return <p className="text-sm text-muted-foreground">cancelled booking.</p>;
  }

  if (actionData.code === "invalid_field") {
    return (
      <p className="text-sm text-destructive">
        invalid field: <span className="font-mono">{actionData.field}</span>
      </p>
    );
  }

  if (actionData.code === "username_taken") {
    return <p className="text-sm text-destructive">username taken.</p>;
  }

  if (actionData.code === "auth_user_email_missing") {
    return <p className="text-sm text-destructive">account email missing.</p>;
  }

  if (actionData.code === "calendar_authorization_required") {
    return (
      <p className="text-sm text-destructive">
        <a
          href="/auth/google"
          className="underline decoration-border underline-offset-4"
        >
          reconnect google calendar
        </a>{" "}
        before creating or rotating booking codes.
      </p>
    );
  }

  const cancellationError = readCancellationErrorMessage(actionData.code);

  if (cancellationError !== null) {
    return <p className="text-sm text-destructive">{cancellationError}</p>;
  }

  const errorMessage = readDashboardActionErrorMessage(actionData.code);

  return errorMessage === null
    ? null
    : <p className="text-sm text-destructive">{errorMessage}</p>;
}

function readCancellationErrorMessage(code: DashboardActionCode) {
  if (code === "booking_missing") {
    return "booking not found.";
  }

  if (code === "group_booking_cancel_unsupported") {
    return "ask the group organizer to cancel from google calendar.";
  }

  if (
    code === "booking_calendar_missing" ||
    code === "booking_cancel_failed" ||
    code === "google_event_delete_failed"
  ) {
    return "could not cancel booking.";
  }

  return null;
}

export function readDashboardActionErrorMessage(code: DashboardActionCode) {
  if (
    code === "created_code" ||
    code === "created_profile" ||
    code === "updated_profile" ||
    code === "cancelled" ||
    code === "invalid_field" ||
    code === "username_taken" ||
    code === "auth_user_email_missing" ||
    code === "calendar_authorization_required" ||
    code === "booking_missing" ||
    code === "booking_calendar_missing" ||
    code === "booking_cancel_failed" ||
    code === "group_booking_cancel_unsupported" ||
    code === "google_event_delete_failed"
  ) {
    return null;
  }

  if (code === "profile_exists") {
    return "profile already exists.";
  }

  if (code === "profile_conflict") {
    return "username taken.";
  }

  if (code === "profile_missing") {
    return "profile missing. refresh and try again.";
  }

  if (code === "invalid_intent") {
    return "invalid dashboard action.";
  }

  if (
    code === "google_account_missing" ||
    code === "google_access_token_missing" ||
    code === "google_calendar_scope_missing" ||
    code === "google_refresh_token_missing"
  ) {
    return "reconnect google calendar.";
  }

  if (
    code === "google_event_insert_failed" ||
    code === "google_event_insert_response_invalid" ||
    code === "google_freebusy_failed" ||
    code === "google_freebusy_response_invalid" ||
    code === "google_token_refresh_failed" ||
    code === "google_token_response_invalid"
  ) {
    return "google calendar unavailable.";
  }

  const unhandledCode: never = code;
  return unhandledCode;
}

async function cancelExistingBooking(
  db: ReturnType<typeof createDb>,
  input: {
    readonly authUserId: string;
    readonly env: ServerEnv;
    readonly formData: FormData;
  },
) {
  const bookingId = readRequiredFormString(input.formData, "bookingId");

  if (bookingId === null) {
    return { code: "invalid_field" as const, field: "bookingId" };
  }

  const profile = await findHostProfileByAuthUserId(db, input.authUserId);

  if (profile === null) {
    return { code: "profile_missing" as const };
  }

  return cancelHostBooking(db, {
    authUserId: input.authUserId,
    bookingId,
    calendarId: profile.calendarId,
    env: input.env,
    hostId: profile.id,
    now: new Date(),
  });
}

async function createProfileAndCode(
  db: ReturnType<typeof createDb>,
  input: {
    readonly authUserId: string;
    readonly email: string;
    readonly env: ServerEnv;
    readonly formData: FormData;
  },
) {
  const parsed = parseProfileForm(input.formData);

  if (parsed.code !== "parsed") {
    return parsed;
  }

  const existingProfile = await findHostProfileByAuthUserId(db, input.authUserId);

  if (existingProfile !== null) {
    return { code: "profile_exists" as const };
  }

  const now = new Date();
  const calendarStatus = await readCalendarStatus(db, input.env, input.authUserId, now);

  if (calendarStatus !== "connected") {
    return { code: "calendar_authorization_required" as const };
  }

  const created = await createHostProfileWithBookingCode(input.env.DB, {
    id: crypto.randomUUID(),
    authUserId: input.authUserId,
    calendarAccountEmail: input.email,
    calendarId: "primary",
    calendarProvider: "google",
    displayName: parsed.username,
    username: parsed.username,
    timezone: parsed.timezone,
    slotSizeMinutes: parsed.slotSizeMinutes,
    now,
  });

  if (created.code === "profile_conflict") {
    return { code: "profile_conflict" as const };
  }

  return {
    code: "created_profile" as const,
    bookingCode: created.bookingCode,
    username: created.profile.username,
  };
}

export function formatDashboardBookingUrl(input: {
  readonly bookingCode: string;
  readonly username: string;
}) {
  return `https://schedule.pizza/${input.username}?code=${input.bookingCode}`;
}

export function readActiveBookingCodeNotice(input: {
  readonly calendarStatus: DashboardCalendarStatus;
  readonly hasActiveBookingCode: boolean;
}) {
  if (input.calendarStatus === "reconnect_required") {
    return input.hasActiveBookingCode
      ? "a share link exists. reconnect google calendar before people or agents can see times."
      : "reconnect google calendar before creating a share link.";
  }

  return input.hasActiveBookingCode
    ? "a share link exists. create a new one to reveal it and revoke the old one."
    : "no share link yet. create one to reveal the code.";
}

export function readBookingCodeActionLabel(hasActiveBookingCode: boolean) {
  return hasActiveBookingCode ? "create new share link" : "create share link";
}

function hasDashboardBookingUrl(
  actionData: NonNullable<DashboardActionData>,
): actionData is NonNullable<DashboardActionData> & {
  readonly bookingCode: string;
  readonly username: string;
} {
  return "bookingCode" in actionData &&
    "username" in actionData &&
    typeof actionData.bookingCode === "string" &&
    typeof actionData.username === "string";
}

function readRequiredFormString(formData: FormData, field: string) {
  const value = formData.get(field);

  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : null;
}

async function createCodeForExistingProfile(
  db: ReturnType<typeof createDb>,
  input: {
    readonly authUserId: string;
    readonly env: ServerEnv;
  },
) {
  const profile = await findHostProfileByAuthUserId(db, input.authUserId);

  if (profile === null) {
    return { code: "profile_missing" as const };
  }

  const now = new Date();
  const calendarStatus = await readCalendarStatus(db, input.env, input.authUserId, now);

  if (calendarStatus !== "connected") {
    return { code: "calendar_authorization_required" as const };
  }

  const bookingCode = await rotateBookingCode(input.env.DB, {
    hostId: profile.id,
    hostUsername: profile.username,
    wordCount: 3,
    label: null,
    now,
  });

  return {
    code: "created_code" as const,
    bookingCode: bookingCode.code,
    username: profile.username,
  };
}
