const baseUrl = readBaseUrl(process.env["SCHEDULE_PIZZA_URL"]);

await checkHtml("/", "schedule.pizza", ["easiest way to find a time."]);
await checkHtml("/docs", "docs", ["group scheduling", "recommendations", "bookingUrl"]);
await checkHtml("/login", "login", ["free/busy access", "privacy policy"]);
await checkHtml("/privacy", "privacy", [
  "Google API Services User Data Policy",
  "Limited Use requirements",
]);
await checkText("/llms.txt", "llms", [
  "GET /api/v1/availability?url=",
  "POST /api/v1/recommend",
]);
await checkText("/robots.txt", "robots", ["Allow: /api/v1", "Disallow: /api/"]);
await checkText("/.well-known/security.txt", "security policy", [
  "Contact: mailto:security@schedule.pizza",
  "Expires:",
]);
await checkJson("/api/v1", "api descriptor", (body) => {
  assertRecord(body, "api descriptor");
  assertEqual(body["name"], "schedule.pizza", "api descriptor name");
  assertEqual(body["apiVersion"], "v1", "api descriptor version");
  assertField(body, ["limits", "maxProfileCount"]);
  assertField(body, ["examples", "schedule", "body", "participants"]);
  assertField(body, ["examples", "bookGroup", "body", "slot"]);
  assertEndpoint(body, "schedule");
  assertEndpoint(body, "recommend");
  assertEndpoint(body, "book");
  assertEndpoint(body, "bookGroup");
  assertField(body, ["endpoints", "schedule", "body", "maxExactSlotCount"]);
  assertField(body, ["endpoints", "schedule", "body", "maxAlternativeSlotCount"]);
  assertField(body, ["endpoints", "recommend", "response", "exact"]);
  assertField(body, ["endpoints", "recommend", "response", "alternatives"]);
  assertField(body, ["endpoints", "bookGroup", "body", "slot"]);
});
await checkJsonStatus("/api/v1/availability?user=alice", "availability without code", 400, (body) => {
  assertRecord(body, "availability without code");
  assertField(body, ["error", "code"]);
  assertEqual(body["error"]["code"], "missing_parameter", "availability error code");
});
await checkJson("/api/v1/health", "health", (body) => {
  assertRecord(body, "health");
  assertEqual(body["ok"], true, "health ok");
});

console.log(`smoke ok: ${baseUrl.origin}`);

function readBaseUrl(value) {
  const rawValue = value === undefined || value.trim() === ""
    ? "http://localhost:5173"
    : value;

  try {
    return new URL(rawValue);
  } catch {
    throw new Error(`SCHEDULE_PIZZA_URL is invalid: ${rawValue}`);
  }
}

async function checkHtml(path, label, requiredText) {
  const text = await fetchText(path, label);

  assertTextIncludes(text, label, requiredText);
}

async function checkText(path, label, requiredText) {
  const text = await fetchText(path, label);

  assertTextIncludes(text, label, requiredText);
}

function assertTextIncludes(text, label, requiredText) {
  for (const textFragment of requiredText) {
    if (!text.includes(textFragment)) {
      throw new Error(`${label} is missing ${textFragment}`);
    }
  }
}

async function checkJson(path, label, validate) {
  const response = await fetchResponse(path, label);
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    throw new Error(`${label} returned ${contentType || "no content type"}`);
  }

  validate(await response.json());
}

async function checkJsonStatus(path, label, expectedStatus, validate) {
  const response = await fetch(new URL(path, baseUrl));
  const contentType = response.headers.get("content-type") ?? "";

  if (response.status !== expectedStatus) {
    throw new Error(`${label} expected HTTP ${expectedStatus}, got ${response.status}`);
  }

  if (!contentType.includes("application/json")) {
    throw new Error(`${label} returned ${contentType || "no content type"}`);
  }

  validate(await response.json());
}

async function fetchText(path, label) {
  const response = await fetchResponse(path, label);

  return response.text();
}

async function fetchResponse(path, label) {
  const response = await fetch(new URL(path, baseUrl));

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

function assertEndpoint(body, name) {
  const endpoints = body["endpoints"];

  assertRecord(endpoints, "api endpoints");
  assertRecord(endpoints[name], `api endpoint ${name}`);
}

function assertField(body, path) {
  let value = body;

  for (let index = 0; index < path.length; index += 1) {
    const segment = path[index];
    const label = path.slice(0, index).join(".") || "api descriptor";

    assertRecord(value, label);

    if (!(segment in value)) {
      throw new Error(`api descriptor is missing ${path.join(".")}`);
    }

    value = value[segment];
  }
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label} expected ${String(expected)}, got ${String(actual)}`);
  }
}
