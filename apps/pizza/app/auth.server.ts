import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/d1";

import * as schema from "@/db/schema";
import type { ServerEnv } from "@/server-context";

export function createAuth(env: ServerEnv) {
  const db = drizzle(env.DB, { schema });

  return betterAuth({
    database: drizzleAdapter(db, { provider: "sqlite" }),
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
