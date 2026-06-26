import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins/admin";
import { organization } from "better-auth/plugins/organization";
import { drizzle } from "drizzle-orm/d1";

import * as schema from "@/db/schema";
import type { ServerEnv } from "@/server-context";

type RequiredAuthEnvName = "BETTER_AUTH_SECRET" | "BETTER_AUTH_URL";

export class AuthConfigError extends Error {
  constructor(
    readonly code: "invalid_admin_user_ids" | "missing_auth_env",
    message: string
  ) {
    super(message);
    this.name = "AuthConfigError";
  }
}

export function readRequiredAuthEnv(
  value: string | null,
  name: RequiredAuthEnvName
): string {
  if (value === null || value.trim() === "") {
    throw new AuthConfigError("missing_auth_env", `${name} must be set.`);
  }

  return value.trim();
}

export function parseAdminUserIds(value: string | null): string[] {
  if (value === null || value.trim() === "") {
    return [];
  }

  const userIds = value.split(",").map((userId) => userId.trim());
  const hasEmptyUserId = userIds.some((userId) => userId === "");

  if (hasEmptyUserId) {
    throw new AuthConfigError(
      "invalid_admin_user_ids",
      "BETTER_AUTH_ADMIN_USER_IDS must be a comma-separated list without empty entries."
    );
  }

  return userIds;
}

export function createAuth(env: ServerEnv) {
  const db = drizzle(env.DB, { schema });

  return betterAuth({
    baseURL: readRequiredAuthEnv(env.BETTER_AUTH_URL ?? null, "BETTER_AUTH_URL"),
    database: drizzleAdapter(db, { provider: "sqlite" }),
    plugins: [
      admin({
        adminUserIds: parseAdminUserIds(env.BETTER_AUTH_ADMIN_USER_IDS ?? null),
      }),
      organization({
        allowUserToCreateOrganization: true,
        organizationLimit: 1,
      }),
    ],
    secret: readRequiredAuthEnv(env.BETTER_AUTH_SECRET ?? null, "BETTER_AUTH_SECRET"),
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        scope: [
          "email",
          "profile",
          "https://www.googleapis.com/auth/calendar.readonly",
        ],
        accessType: "offline",
        prompt: "select_account consent",
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
export type AuthSession = Awaited<ReturnType<Auth["api"]["getSession"]>>;

export function readAuthSession(env: ServerEnv, headers: Headers) {
  return createAuth(env).api.getSession({
    headers,
    query: { disableCookieCache: true },
  });
}
