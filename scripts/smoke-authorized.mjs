const baseUrl = readRequiredUrl(process.env["SCHEDULE_PIZZA_URL"]);
const user = readRequiredEnv("SCHEDULE_PIZZA_SMOKE_USER");
const code = readRequiredEnv("SCHEDULE_PIZZA_SMOKE_CODE");
const requestBody = readScheduleRequestBody({ code, user });

const availability = await checkJson(
  `/api/v1/availability?user=${encodeURIComponent(user)}&code=${encodeURIComponent(code)}`,
  "availability",
);
assertRecord(availability, "availability");
assertEqual(availability["user"], user, "availability user");
assertNonEmptyArray(availability["slots"], "availability slots");

const schedule = await checkScheduleLike("/api/v1/schedule", "schedule", requestBody);
const recommend = await checkScheduleLike("/api/v1/recommend", "recommend", requestBody);

console.log([
  `authorized smoke ok: ${baseUrl.origin}`,
  `availabilitySlots=${availability["slots"].length}`,
  `schedule=${schedule.kind}:${schedule.slotCount}`,
  `recommend=${recommend.kind}:${recommend.slotCount}`,
].join(" "));

function readRequiredUrl(value) {
  const rawValue = readRequiredEnvValue(value, "SCHEDULE_PIZZA_URL");

  try {
    return new URL(rawValue);
  } catch {
    throw new Error(`SCHEDULE_PIZZA_URL is invalid: ${rawValue}`);
  }
}

function readRequiredEnv(name) {
  return readRequiredEnvValue(process.env[name], name);
}

function readRequiredEnvValue(value, name) {
  if (value === undefined || value.trim() === "") {
    throw new Error(`${name} is required`);
  }

  return value.trim();
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

async function checkScheduleLike(path, label, body) {
  const responseBody = await postJson(path, label, body);

  assertRecord(responseBody, label);

  if (responseBody["kind"] !== "exact" && responseBody["kind"] !== "alternatives") {
    throw new Error(`${label} returned invalid kind`);
  }

  assertNonEmptyArray(responseBody["slots"], `${label} slots`);

  return { kind: responseBody["kind"], slotCount: responseBody["slots"].length };
}

async function checkJson(path, label) {
  const response = await fetchResponse(path, label, { method: "GET" });
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    throw new Error(`${label} returned ${contentType || "no content type"}`);
  }

  return response.json();
}

async function postJson(path, label, body) {
  const response = await fetchResponse(path, label, {
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

async function fetchResponse(path, label, init) {
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
