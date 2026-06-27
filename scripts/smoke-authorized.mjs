import { pathToFileURL } from "node:url";

if (isCliEntrypoint()) {
  await main(process.env);
}

export async function main(env) {
  const baseUrl = readRequiredUrl(env["SCHEDULE_PIZZA_URL"]);
  const target = readSmokeTarget(env);
  const requestBody = readScheduleRequestBody(target.participant);

  const availability = await checkJson(
    baseUrl,
    target.availabilityPath,
    "availability",
  );
  assertRecord(availability, "availability");
  assertEqual(availability["user"], target.expectedUser, "availability user");
  assertNonEmptyArray(availability["slots"], "availability slots");

  const schedule = await checkScheduleLike(baseUrl, "/api/v1/schedule", "schedule", requestBody);
  const recommend = await checkScheduleLike(baseUrl, "/api/v1/recommend", "recommend", requestBody);

  console.log([
    `authorized smoke ok: ${baseUrl.origin}`,
    `availabilitySlots=${availability["slots"].length}`,
    `schedule=${schedule.kind}:${schedule.slotCount}`,
    `recommend=${recommend.kind}:${recommend.slotCount}`,
  ].join(" "));
}

function readRequiredUrl(value) {
  const rawValue = readRequiredEnvValue(value, "SCHEDULE_PIZZA_URL");

  try {
    return new URL(rawValue);
  } catch {
    throw new Error(`SCHEDULE_PIZZA_URL is invalid: ${rawValue}`);
  }
}

export function readSmokeTarget(env) {
  const url = readOptionalEnvValue(env["SCHEDULE_PIZZA_SMOKE_URL"]);

  if (url !== null) {
    if (
      readOptionalEnvValue(env["SCHEDULE_PIZZA_SMOKE_USER"]) !== null ||
      readOptionalEnvValue(env["SCHEDULE_PIZZA_SMOKE_CODE"]) !== null
    ) {
      throw new Error(
        "Use SCHEDULE_PIZZA_SMOKE_URL or SCHEDULE_PIZZA_SMOKE_USER/SCHEDULE_PIZZA_SMOKE_CODE, not both",
      );
    }

    const scheduleUrl = readScheduleUrl(url);

    if (scheduleUrl === null) {
      throw new Error("SCHEDULE_PIZZA_SMOKE_URL must be a schedule.pizza booking link");
    }

    return {
      availabilityPath: `/api/v1/availability?url=${encodeURIComponent(scheduleUrl.toString())}`,
      expectedUser: readUsernameFromScheduleUrl(scheduleUrl),
      participant: { url: scheduleUrl.toString() },
    };
  }

  const user = readUsername(
    readRequiredEnvValue(env["SCHEDULE_PIZZA_SMOKE_USER"], "SCHEDULE_PIZZA_SMOKE_USER"),
    "SCHEDULE_PIZZA_SMOKE_USER",
  );
  const code = readRequiredEnvValue(env["SCHEDULE_PIZZA_SMOKE_CODE"], "SCHEDULE_PIZZA_SMOKE_CODE");

  return {
    availabilityPath: `/api/v1/availability?user=${encodeURIComponent(user)}&code=${encodeURIComponent(code)}`,
    expectedUser: user,
    participant: { code, user },
  };
}

function readOptionalEnvValue(value) {
  return value === undefined || value.trim() === ""
    ? null
    : value.trim();
}

function readRequiredEnvValue(value, name) {
  if (value === undefined || value.trim() === "") {
    throw new Error(`${name} is required`);
  }

  return value.trim();
}

function readScheduleUrl(value) {
  const trimmedValue = value.trim();

  try {
    const url = new URL(
      /^[a-z][a-z0-9+.-]*:/iu.test(trimmedValue)
        ? trimmedValue
        : `https://${trimmedValue}`,
    );
    const pathParts = url.pathname.split("/").filter((part) => part !== "");
    const bookingCode = url.searchParams.get("code");

    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      (url.hostname === "schedule.pizza" || url.hostname === "www.schedule.pizza") &&
      pathParts.length === 1 &&
      bookingCode !== null &&
      bookingCode.trim() !== "" &&
      readUsernameFromScheduleUrl(url) !== null
    )
      ? url
      : null;
  } catch {
    return null;
  }
}

function readUsernameFromScheduleUrl(url) {
  const username = decodeURIComponent(url.pathname.split("/").filter((part) => part !== "")[0] ?? "");

  return readUsername(username, "SCHEDULE_PIZZA_SMOKE_URL");
}

function readUsername(value, name) {
  const username = value.trim().toLowerCase();

  if (!/^[a-z0-9][a-z0-9_-]{0,39}$/u.test(username)) {
    throw new Error(`${name} contains an invalid username`);
  }

  return username;
}

function readScheduleRequestBody(participant) {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1_000);

  return {
    participants: [participant],
    durationMinutes: 30,
    granularityMinutes: 15,
    maxExactSlotCount: 5,
    maxAlternativeSlotCount: 5,
    timeZone: "America/Los_Angeles",
    window: {
      start: now.toISOString(),
      end: windowEnd.toISOString(),
    },
  };
}

async function checkScheduleLike(baseUrl, path, label, body) {
  const responseBody = await postJson(baseUrl, path, label, body);

  return readScheduleLikeSummary(responseBody, label);
}

export function readScheduleLikeSummary(responseBody, label) {
  assertRecord(responseBody, label);

  if (responseBody["kind"] !== "exact") {
    throw new Error(`${label} expected exact slots, got ${String(responseBody["kind"])}`);
  }

  assertNonEmptyArray(responseBody["slots"], `${label} slots`);

  return { kind: responseBody["kind"], slotCount: responseBody["slots"].length };
}

async function checkJson(baseUrl, path, label) {
  const response = await fetchResponse(baseUrl, path, label, { method: "GET" });
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    throw new Error(`${label} returned ${contentType || "no content type"}`);
  }

  return response.json();
}

async function postJson(baseUrl, path, label, body) {
  const response = await fetchResponse(baseUrl, path, label, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    throw new Error(`${label} returned ${contentType || "no content type"}`);
  }

  return response.json();
}

async function fetchResponse(baseUrl, path, label, init) {
  const response = await fetch(new URL(path, baseUrl), init);

  if (!response.ok) {
    throw new Error(`${label} returned HTTP ${response.status}`);
  }

  return response;
}

function assertRecord(value, label) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object`);
  }
}

function assertArray(value, label) {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }
}

function assertNonEmptyArray(value, label) {
  assertArray(value, label);

  if (value.length === 0) {
    throw new Error(`${label} must not be empty`);
  }
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label} expected ${String(expected)}, got ${String(actual)}`);
  }
}

function isCliEntrypoint() {
  const scriptPath = process.argv[1];

  return scriptPath !== undefined &&
    import.meta.url === pathToFileURL(scriptPath).href;
}
