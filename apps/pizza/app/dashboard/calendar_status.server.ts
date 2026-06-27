/**
 * Dashboard calendar authorization status.
 *
 * Profile writes require both Google free/busy reads and event writes. This
 * helper gives dashboard loaders/actions one fail-closed status before they
 * create, update, or rotate booking capabilities.
 */

import { readGoogleCalendarAccess } from "@/calendar/google.server";
import type { createDb } from "@/db/client.server";
import type { ServerEnv } from "@/server-context";

export async function readCalendarStatus(
  db: ReturnType<typeof createDb>,
  env: Parameters<typeof readGoogleCalendarAccess>[1]["env"],
  authUserId: string,
  now = new Date(),
) {
  const availability = await readGoogleCalendarAccess(db, {
    authUserId,
    capability: "availability",
    env,
    now,
  });

  if (availability.code !== "authorized") {
    return "reconnect_required" as const;
  }

  const eventWrite = await readGoogleCalendarAccess(db, {
    authUserId,
    capability: "event_write",
    env,
    now,
  });

  return eventWrite.code === "authorized"
    ? "connected" as const
    : "reconnect_required" as const;
}

export type DashboardCalendarEnv = Pick<
  ServerEnv,
  "GOOGLE_CLIENT_ID" | "GOOGLE_CLIENT_SECRET"
>;
