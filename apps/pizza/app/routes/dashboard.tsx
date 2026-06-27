import { Form, redirect } from "react-router";

import { readAuthSession } from "@/auth.server";
import { readCalendarStatus } from "@/dashboard/calendar_status.server";
import {
  parseProfileForm,
  readDefaultUsernameFromEmail,
} from "@/dashboard/profile_form";
import { updateExistingProfile } from "@/dashboard/profile_update.server";
import { createDb } from "@/db/client.server";
import {
  createBookingCode,
  rotateBookingCode,
} from "@/db/functions/booking_codes.server";
import {
  createHostProfile,
  findHostProfileByAuthUserId,
} from "@/db/functions/host_profiles.server";
import { serverContext, type ServerEnv } from "@/server-context";
import type { Route } from "./+types/dashboard";

type DashboardActionData = NonNullable<Route.ComponentProps["actionData"]> | null;

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
  const calendarStatus = profile === null
    ? "missing_profile"
    : await readCalendarStatus(db, env, session.user.id);

  return {
    email: session.user.email,
    profile: profile === null ? null : {
      calendarStatus,
      slotSizeMinutes: profile.slotSizeMinutes,
      timezone: profile.timezone,
      username: profile.username,
    },
  };
}

export async function action({ context, request }: Route.ActionArgs) {
  const { env } = context.get(serverContext);
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

  return { code: "invalid_intent" as const };
}

export default function Dashboard({
  actionData,
  loaderData,
}: Route.ComponentProps) {
  const dashboardActionData = actionData ?? null;

  return (
    <main className="mx-auto w-full max-w-[550px] px-4 pt-20 pb-24 antialiased">
      <h1 className="text-sm font-semibold">dashboard</h1>
      <p className="mt-2 text-sm text-muted-foreground">{loaderData.email}</p>

      {loaderData.profile === null ? (
        <CreateProfileForm
          actionData={dashboardActionData}
          defaultUsername={readDefaultUsernameFromEmail(loaderData.email)}
        />
      ) : (
        <ProfilePanel actionData={dashboardActionData} profile={loaderData.profile} />
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
      <p className="text-sm text-muted-foreground">
        booking codes are shown only when created. rotate to make a new share
        link and revoke the old one.
      </p>
      {profile.calendarStatus === "reconnect_required" ? (
        <p className="text-sm text-destructive">
          google calendar needs{" "}
          <a
            href="/auth/google"
            className="underline decoration-border underline-offset-4"
          >
            reconnect
          </a>
          .
        </p>
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
      <Form method="post">
        <input type="hidden" name="intent" value="create_code" />
        <button
          type="submit"
          className="rounded-md border px-3 py-2 text-sm transition-colors hover:bg-muted"
        >
          rotate booking code
        </button>
      </Form>
      <ActionMessage actionData={actionData} />
    </section>
  );
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
    return (
      <p className="text-sm text-muted-foreground">
        code: <span className="font-mono">{actionData.bookingCode}</span>
        <br />
        link:{" "}
        <span className="font-mono">
          schedule.pizza/{actionData.username}?code={actionData.bookingCode}
        </span>
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
    return <p className="text-sm text-muted-foreground">saved.</p>;
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
        before creating a profile.
      </p>
    );
  }

  return <p className="text-sm text-destructive">{actionData.code}</p>;
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

  const profile = await createHostProfile(db, {
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

  if (profile === null) {
    return { code: "profile_conflict" as const };
  }

  const bookingCode = await createBookingCode(db, {
    hostId: profile.id,
    hostUsername: profile.username,
    wordCount: 3,
    label: null,
    now,
  });

  return {
    code: "created_profile" as const,
    bookingCode: bookingCode.code,
    username: profile.username,
  };
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
