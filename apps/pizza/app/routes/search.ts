import { redirect } from "react-router";

import { normalizeUsername } from "@/db/functions/host_profiles.server";
import type { Route } from "./+types/search";

export function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const target = readSearchTarget(url.searchParams.get("q"));

  throw redirect(target);
}

function readSearchTarget(value: string | null) {
  if (value === null || value.trim() === "") {
    return "/";
  }

  const parsedUrl = parseScheduleUrl(value);

  if (parsedUrl !== null) {
    return `${parsedUrl.pathname}${parsedUrl.search}`;
  }

  const username = normalizeUsername(value);

  return username === null ? "/" : `/${username}`;
}

function parseScheduleUrl(value: string) {
  try {
    const parsed = new URL(value.trim());

    return parsed.hostname === "schedule.pizza" ||
      parsed.hostname === "www.schedule.pizza"
      ? parsed
      : null;
  } catch {
    return null;
  }
}
