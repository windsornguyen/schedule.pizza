const baseUrl = readBaseUrl(process.env["SCHEDULE_PIZZA_URL"]);

await checkHtml("/", "schedule.pizza", ["easiest way to find a time."]);
await checkSecurityHeaders("/", "homepage security headers");
await checkHtml("/", "homepage metadata", [
  "https://schedule.pizza/og.svg",
  "summary_large_image",
]);
await checkRedirect(
  "/search?q=schedule.pizza%2Falice%3Fcode%3Dmoon-tiger-seven",
  "booking link search",
  "/alice?code=moon-tiger-seven",
);
await checkHtml("/docs", "docs", ["group scheduling", "recommendations", "bookingUrl"]);
await checkHtml("/group", "group scheduling", ["schedule.pizza link", "closest times"]);
await checkHtml("/login", "login", ["free/busy access", "privacy policy"]);
await checkHtml("/privacy", "privacy", [
  "Google API Services User Data Policy",
  "Limited Use requirements",
]);
await checkText("/llms.txt", "llms", [
  "GET /api/v1/availability?url=",
  "POST /api/v1/recommend",
  "GET /api/v1/me",
  "PUT /api/v1/account/profile",
  "same-site `Origin`",
  "GET /api/v1/account/bookings",
  "kind",
  "structured `cancel`",
  "object",
  "plaintext booking code",
  "group organizer cancels",
]);
await checkText("/robots.txt", "robots", ["Allow: /api/v1", "Disallow: /api/"]);
await checkText("/sitemap.xml", "sitemap", [
  "https://schedule.pizza/",
  "https://schedule.pizza/docs",
  "https://schedule.pizza/group",
]);
await checkText("/.well-known/security.txt", "security policy", [
  "Contact: mailto:security@schedule.pizza",
  "Expires:",
]);
await checkText("/og.svg", "open graph image", [
  "#F1C34B",
  "schedule.pizza",
  "easiest way to find a",
]);
await checkText("/logo.svg", "logo wordmark", [
  "#F1C34B",
  "#171512",
  "schedule.pizza",
]);
await checkText("/logo-mark.svg", "logo mark", ["#F1C34B", "#171512"]);
await checkText("/favicon.svg", "favicon svg", ["#F1C34B", "#171512"]);
await checkAsset("/favicon.ico", "favicon ico", [
  "image/x-icon",
  "image/vnd.microsoft.icon",
]);
await checkAsset("/favicon-32x32.png", "favicon png", "image/png");
await checkAsset("/apple-touch-icon.png", "apple touch icon", "image/png");
await checkAsset("/icon-192.png", "web app icon 192", "image/png");
await checkAsset("/icon-512.png", "web app icon 512", "image/png");
await checkJson("/site.webmanifest", "web manifest", (body) => {
  assertRecord(body, "web manifest");
  assertManifestIcon(body, "/favicon.svg");
  assertManifestIcon(body, "/favicon-32x32.png");
  assertManifestIcon(body, "/apple-touch-icon.png");
  assertManifestIcon(body, "/icon-192.png");
  assertManifestIcon(body, "/icon-512.png");
});
await checkJson("/api/v1", "api descriptor", (body) => {
  assertRecord(body, "api descriptor");
  assertEqual(body["name"], "schedule.pizza", "api descriptor name");
  assertEqual(body["apiVersion"], "v1", "api descriptor version");
  assertField(body, ["limits", "maxProfileCount"]);
  assertField(body, ["examples", "schedule", "body", "participants"]);
  assertField(body, ["examples", "recommend", "body", "participants"]);
  assertField(body, ["examples", "bookGroup", "body", "slot"]);
  assertField(body, ["examples", "bootstrap", "body", "username"]);
  assertField(body, ["examples", "rotateBookingCode", "path"]);
  assertField(body, ["examples", "accountBookings", "path"]);
  assertField(body, ["examples", "cancelBooking", "path"]);
  assertField(body, ["endpoints", "accountBookings", "response", "kind"]);
  assertField(body, ["endpoints", "accountBookings", "response", "cancel", "allowed"]);
  assertEndpoint(body, "schedule");
  assertEndpoint(body, "recommend");
  assertEndpoint(body, "book");
  assertEndpoint(body, "bookGroup");
  assertEndpoint(body, "bootstrap");
  assertEndpoint(body, "rotateBookingCode");
  assertEndpoint(body, "accountBookings");
  assertEndpoint(body, "cancelBooking");
  assertField(body, ["endpoints", "bootstrap", "headers", "Origin"]);
  assertField(body, ["endpoints", "saveProfile", "headers", "Origin"]);
  assertField(body, ["endpoints", "rotateBookingCode", "headers", "Origin"]);
  assertField(body, ["endpoints", "cancelBooking", "headers", "Origin"]);
  assertField(body, ["endpoints", "schedule", "body", "maxExactSlotCount"]);
  assertField(body, ["endpoints", "schedule", "body", "maxAlternativeSlotCount"]);
  assertField(body, ["endpoints", "recommend", "response", "exact"]);
  assertField(body, ["endpoints", "recommend", "response", "alternatives"]);
  assertField(body, ["endpoints", "bookGroup", "body", "slot"]);
});
await checkSecurityHeaders("/api/v1", "api security headers");
await checkJsonStatus("/api/v1/availability?user=alice", "availability without code", 400, (body) => {
  assertRecord(body, "availability without code");
  assertField(body, ["error", "code"]);
  assertEqual(body["error"]["code"], "missing_parameter", "availability error code");
});
await checkJsonStatus("/api/v1/account", "account without session", 401, (body) => {
  assertRecord(body, "account without session");
  assertField(body, ["error", "code"]);
  assertEqual(body["error"]["code"], "unauthenticated", "account error code");
});
await checkJsonStatus("/api/v1/me", "me without session", 401, (body) => {
  assertRecord(body, "me without session");
  assertField(body, ["error", "code"]);
  assertEqual(body["error"]["code"], "unauthenticated", "me error code");
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

async function checkAsset(path, label, expectedContentTypes) {
  const response = await fetchResponse(path, label);
  const contentType = response.headers.get("content-type") ?? "";
  const expectedTypes = Array.isArray(expectedContentTypes)
    ? expectedContentTypes
    : [expectedContentTypes];

  if (!expectedTypes.some((expectedContentType) => contentType.includes(expectedContentType))) {
    throw new Error(`${label} returned ${contentType || "no content type"}`);
  }
}

async function checkSecurityHeaders(path, label) {
  const response = await fetchResponse(path, label);

  assertHeader(response.headers, "Referrer-Policy", "no-referrer", label);
  assertHeader(response.headers, "X-Content-Type-Options", "nosniff", label);
  assertHeader(response.headers, "X-Frame-Options", "DENY", label);
}

function assertTextIncludes(text, label, requiredText) {
  for (const textFragment of requiredText) {
    if (!text.includes(textFragment)) {
      throw new Error(`${label} is missing ${textFragment}`);
    }
  }
}

function isJsonContentType(contentType) {
  return contentType.includes("application/json") || contentType.includes("+json");
}

async function checkJson(path, label, validate) {
  const response = await fetchResponse(path, label);
  const contentType = response.headers.get("content-type") ?? "";

  if (!isJsonContentType(contentType)) {
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

  if (!isJsonContentType(contentType)) {
    throw new Error(`${label} returned ${contentType || "no content type"}`);
  }

  validate(await response.json());
}

async function checkRedirect(path, label, expectedLocation) {
  const response = await fetch(new URL(path, baseUrl), { redirect: "manual" });
  const location = response.headers.get("location");

  if (response.status < 300 || response.status > 399) {
    throw new Error(`${label} expected redirect, got HTTP ${response.status}`);
  }

  if (location !== expectedLocation) {
    throw new Error(`${label} expected ${expectedLocation}, got ${location ?? "no location"}`);
  }
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

function assertHeader(headers, name, expected, label) {
  const actual = headers.get(name);

  if (actual !== expected) {
    throw new Error(`${label} expected ${name}: ${expected}, got ${actual ?? "missing"}`);
  }
}

function assertEndpoint(body, name) {
  const endpoints = body["endpoints"];

  assertRecord(endpoints, "api endpoints");
  assertRecord(endpoints[name], `api endpoint ${name}`);
}

function assertManifestIcon(body, src) {
  const icons = body["icons"];

  if (!Array.isArray(icons)) {
    throw new Error("web manifest icons must be an array");
  }

  if (!icons.some((icon) => icon?.src === src)) {
    throw new Error(`web manifest is missing ${src}`);
  }
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
