import { pathToFileURL } from "node:url";

if (isCliEntrypoint()) {
  await main(process.env);
}

export async function main(env) {
  const baseUrl = readRequiredUrl(env["SCHEDULE_PIZZA_URL"]);
  const target = readSmokeTarget(env);
  const accountConfig = readAccountSmokeConfig(env);
  const writeConfig = readWriteSmokeConfig(env);
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
  const output = [
    `authorized smoke ok: ${baseUrl.origin}`,
    `availabilitySlots=${availability["slots"].length}`,
    `schedule=${schedule.kind}:${schedule.slotCount}`,
    `recommend=${recommend.kind}:${recommend.slotCount}`,
  ];

  if (accountConfig.enabled && !writeConfig.enabled) {
    const account = await checkSmokeAccountSession(baseUrl, target, accountConfig, "account smoke");

    output.push(`account=${account.username}`);
  }

  if (writeConfig.enabled) {
    const writeResult = await bookAndCancelSmoke(baseUrl, target.book, availability, writeConfig);

    output.push(`write=${writeResult.status}`);
  }

  console.log(output.join(" "));
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
      book: {
        bookingCode: readBookingCodeFromScheduleUrl(scheduleUrl),
        username: readUsernameFromScheduleUrl(scheduleUrl),
      },
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
    book: { bookingCode: code, username: user },
    expectedUser: user,
    participant: { code, user },
  };
}

export function readWriteSmokeConfig(env) {
  const enabled = readOptionalEnvValue(env["SCHEDULE_PIZZA_SMOKE_WRITE"]);

  if (enabled === null) {
    return { enabled: false };
  }

  if (enabled !== "1") {
    throw new Error("SCHEDULE_PIZZA_SMOKE_WRITE must be 1 when write smoke is enabled");
  }

  return {
    bookerEmail: readEmail(
      readRequiredEnvValue(env["SCHEDULE_PIZZA_SMOKE_BOOKER_EMAIL"], "SCHEDULE_PIZZA_SMOKE_BOOKER_EMAIL"),
      "SCHEDULE_PIZZA_SMOKE_BOOKER_EMAIL",
    ),
    bookerName: readOptionalEnvValue(env["SCHEDULE_PIZZA_SMOKE_BOOKER_NAME"]) ?? "schedule.pizza smoke",
    enabled: true,
    sessionCookie: readHeaderValue(
      readRequiredEnvValue(env["SCHEDULE_PIZZA_SMOKE_SESSION_COOKIE"], "SCHEDULE_PIZZA_SMOKE_SESSION_COOKIE"),
      "SCHEDULE_PIZZA_SMOKE_SESSION_COOKIE",
    ),
    timeZone: readTimeZone(
      readOptionalEnvValue(env["SCHEDULE_PIZZA_SMOKE_TIMEZONE"]) ?? "America/Los_Angeles",
      "SCHEDULE_PIZZA_SMOKE_TIMEZONE",
    ),
  };
}

export function readAccountSmokeConfig(env) {
  const sessionCookie = readOptionalEnvValue(env["SCHEDULE_PIZZA_SMOKE_SESSION_COOKIE"]);

  return sessionCookie === null
    ? { enabled: false }
    : {
        enabled: true,
        sessionCookie: readHeaderValue(
          sessionCookie,
          "SCHEDULE_PIZZA_SMOKE_SESSION_COOKIE",
        ),
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

function readBookingCodeFromScheduleUrl(url) {
  const bookingCode = url.searchParams.get("code");

  if (bookingCode === null || bookingCode.trim() === "") {
    throw new Error("SCHEDULE_PIZZA_SMOKE_URL must include a booking code");
  }

  return bookingCode.trim();
}

function readUsername(value, name) {
  const username = value.trim().toLowerCase();

  if (!/^[a-z0-9][a-z0-9_-]{0,39}$/u.test(username)) {
    throw new Error(`${name} contains an invalid username`);
  }

  return username;
}

function readEmail(value, name) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value)) {
    throw new Error(`${name} is invalid`);
  }

  return value;
}

function readHeaderValue(value, name) {
  if (/[\r\n]/u.test(value)) {
    throw new Error(`${name} contains invalid header characters`);
  }

  return value;
}

function readTimeZone(value, name) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
  } catch {
    throw new Error(`${name} is invalid`);
  }

  return value;
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

async function bookAndCancelSmoke(baseUrl, target, availability, config) {
  await checkSmokeAccountSession(baseUrl, target, config, "write smoke");

  const slotStart = readFirstAvailabilitySlotStart(availability, "availability");
  const booked = await postJson(baseUrl, "/api/v1/book", "book smoke slot", {
    code: target.bookingCode,
    email: config.bookerEmail,
    name: config.bookerName,
    slot: slotStart,
    timezone: config.timeZone,
    user: target.username,
  });
  const bookingId = readBookedBookingId(booked, "book smoke slot");

  try {
    await postJson(
      baseUrl,
      `/api/v1/account/bookings/${encodeURIComponent(bookingId)}/cancel`,
      "cancel smoke booking",
      {},
      { Cookie: config.sessionCookie, Origin: baseUrl.origin },
    );
  } catch (error) {
    throw new Error(`smoke booking ${bookingId} cancellation failed: ${readErrorMessage(error)}`);
  }

  return { status: "booked_cancelled" };
}

async function checkSmokeAccountSession(baseUrl, target, config, label) {
  const account = await checkJson(baseUrl, "/api/v1/account", `${label} account`, {
    Cookie: config.sessionCookie,
  });
  const username = readAccountHostUsername(account, `${label} account`);

  if (username !== target.username) {
    throw new Error(`${label} account expected ${target.username}, got ${username}`);
  }

  return { username };
}

export function readAccountHostUsername(responseBody, label) {
  assertRecord(responseBody, label);
  assertEqual(responseBody["ok"], true, `${label} ok`);
  assertRecord(responseBody["account"], `${label} account`);
  assertRecord(responseBody["account"]["profile"], `${label} account profile`);

  const username = responseBody["account"]["profile"]["username"];
  if (typeof username !== "string" || username.trim() === "") {
    throw new Error(`${label} account profile username must be a string`);
  }

  return username;
}

export function readFirstAvailabilitySlotStart(responseBody, label) {
  assertRecord(responseBody, label);
  assertNonEmptyArray(responseBody["slots"], `${label} slots`);
  assertRecord(responseBody["slots"][0], `${label} first slot`);

  const start = responseBody["slots"][0]["start"];
  if (typeof start !== "string" || start.trim() === "") {
    throw new Error(`${label} first slot start must be a string`);
  }

  return start;
}

export function readBookedBookingId(responseBody, label) {
  assertRecord(responseBody, label);
  assertEqual(responseBody["ok"], true, `${label} ok`);
  assertRecord(responseBody["booking"], `${label} booking`);

  if (Object.hasOwn(responseBody["booking"], "calendarEventId")) {
    throw new Error(`${label} must not expose calendarEventId`);
  }

  const bookingId = responseBody["booking"]["id"];
  if (typeof bookingId !== "string" || bookingId.trim() === "") {
    throw new Error(`${label} booking id must be a string`);
  }

  return bookingId;
}

async function checkJson(baseUrl, path, label, headers = {}) {
  const response = await fetchResponse(baseUrl, path, label, {
    method: "GET",
    headers: smokeHeaders(headers),
  });
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    throw new Error(`${label} returned ${contentType || "no content type"}`);
  }

  return response.json();
}

async function postJson(baseUrl, path, label, body, headers = {}) {
  const response = await fetchResponse(baseUrl, path, label, {
    method: "POST",
    headers: smokeHeaders({ "content-type": "application/json", ...headers }),
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

function smokeHeaders(headers = {}) {
  return { "CF-Connecting-IP": "203.0.113.250", ...headers };
}

function readErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
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
