import { execFile } from "node:child_process";
import { randomBytes, randomUUID, webcrypto } from "node:crypto";
import { promisify } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";

// Production smoke test for the full public booking path. The command creates
// temporary state, books real Google Calendar events, and must prove cleanup.
const execFileAsync = promisify(execFile);
const repoRoot = fileURLToPath(new URL("../", import.meta.url));

if (isCliEntrypoint()) {
  await main(process.env);
}

export async function main(env) {
  const config = readLiveSmokeConfig(env);
  const bookingIds = new Set();
  const cleanedBookingIds = new Set();
  const primaryParticipant = {
    code: `smoke-${randomBytes(16).toString("hex")}`,
    codeId: randomUUID(),
    username: config.username,
  };
  const temporaryParticipant = createTemporaryGroupParticipantDraft();

  try {
    const host = await readHost(config);
    await createTemporaryCode(config, {
      code: primaryParticipant.code,
      codeId: primaryParticipant.codeId,
      host,
    });
    await createTemporaryGroupParticipant(config, host, temporaryParticipant);

    const availability = await getJson(
      config.baseUrl,
      `/api/v1/availability?user=${encodeURIComponent(config.username)}&code=${encodeURIComponent(primaryParticipant.code)}`,
      "availability",
    );
    const individualSlot = readAvailabilitySlotStart(availability, "availability", 0);
    const groupSlot = readAvailabilitySlotStart(availability, "availability", 1);
    const participants = [primaryParticipant, temporaryParticipant];
    const scheduleBody = readScheduleRequestBody(config, participants);
    const schedule = await postJson(config.baseUrl, "/api/v1/schedule", "schedule", scheduleBody);
    const recommend = await postJson(config.baseUrl, "/api/v1/recommend", "recommend", scheduleBody);
    const scheduleSummary = readScheduleLikeSummary(schedule, "schedule");
    const recommendSummary = readScheduleLikeSummary(recommend, "recommend");
    const individualBookingId = await bookIndividual(
      config,
      primaryParticipant.code,
      individualSlot,
      bookingIds,
    );

    await cleanupBookings(config, [individualBookingId]);
    cleanedBookingIds.add(individualBookingId);

    const groupBookingIds = await bookGroup(
      config,
      participants,
      groupSlot,
      bookingIds,
    );
    await cleanupBookings(config, groupBookingIds);
    for (const bookingId of groupBookingIds) cleanedBookingIds.add(bookingId);

    await revokeTemporaryCode(config, primaryParticipant.codeId);
    await assertTemporaryCodeRevoked(config, primaryParticipant.codeId);
    await deleteTemporaryGroupParticipant(config, temporaryParticipant);

    console.log([
      `live smoke ok: ${config.baseUrl.origin}`,
      `availability=${availability["slots"].length}`,
      `schedule=${scheduleSummary.kind}:${scheduleSummary.slotCount}`,
      `recommend=${recommendSummary.kind}:${recommendSummary.slotCount}`,
      `book=${individualBookingId}`,
      `group=${groupBookingIds.join(",")}`,
      "cleanup=deleted_cancelled",
    ].join(" "));
  } catch (error) {
    await cleanupAfterFailure(config, {
      bookingIds: Array.from(bookingIds),
      cleanedBookingIds: Array.from(cleanedBookingIds),
      codeId: primaryParticipant.codeId,
      temporaryParticipant,
    }).catch((cleanupError) => {
      throw new Error(
        `${readErrorMessage(error)}; cleanup failed: ${readErrorMessage(cleanupError)}`,
      );
    });
    throw error;
  }
}

export function readLiveSmokeConfig(env) {
  if (readOptionalEnvValue(env["SCHEDULE_PIZZA_LIVE_SMOKE"]) !== "1") {
    throw new Error("SCHEDULE_PIZZA_LIVE_SMOKE must be 1");
  }

  const baseUrl = readRequiredLiveUrl(env["SCHEDULE_PIZZA_URL"]);

  return {
    baseUrl,
    bookerEmail: readEmail(
      readRequiredEnvValue(
        env["SCHEDULE_PIZZA_LIVE_SMOKE_BOOKER_EMAIL"],
        "SCHEDULE_PIZZA_LIVE_SMOKE_BOOKER_EMAIL",
      ),
      "SCHEDULE_PIZZA_LIVE_SMOKE_BOOKER_EMAIL",
    ),
    bookerName: readOptionalEnvValue(env["SCHEDULE_PIZZA_LIVE_SMOKE_BOOKER_NAME"]) ??
      "schedule.pizza live smoke",
    databaseName: readOptionalEnvValue(env["SCHEDULE_PIZZA_LIVE_SMOKE_DB"]) ??
      "schedule-pizza-prod-db",
    timeZone: readTimeZone(
      readOptionalEnvValue(env["SCHEDULE_PIZZA_LIVE_SMOKE_TIMEZONE"]) ??
        "America/Los_Angeles",
      "SCHEDULE_PIZZA_LIVE_SMOKE_TIMEZONE",
    ),
    username: readUsername(
      readRequiredEnvValue(
        env["SCHEDULE_PIZZA_LIVE_SMOKE_USER"],
        "SCHEDULE_PIZZA_LIVE_SMOKE_USER",
      ),
      "SCHEDULE_PIZZA_LIVE_SMOKE_USER",
    ),
  };
}

async function readHost(config) {
  const rows = await runD1(config.databaseName, `
    select
      account.accessToken as accessToken,
      account.accessTokenExpiresAt as accessTokenExpiresAt,
      account.accountId as accountId,
      account.idToken as idToken,
      account.refreshToken as refreshToken,
      account.refreshTokenExpiresAt as refreshTokenExpiresAt,
      account.scope as scope,
      host_profile.calendarAccountEmail as calendarAccountEmail,
      host_profile.calendarId as calendarId,
      host_profile.id as hostId,
      host_profile.slotSizeMinutes as slotSizeMinutes,
      host_profile.timezone as timezone,
      host_profile.username as username
    from host_profile
    inner join account
      on account.userId = host_profile.authUserId
      and account.providerId = 'google'
    where host_profile.username = ${sqlString(config.username)}
    limit 1
  `, "host profile");
  const row = readSingleRow(rows, "host profile");

  assertString(row["hostId"], "host profile hostId");
  assertEqual(row["username"], config.username, "host profile username");
  assertString(row["accountId"], "host profile accountId");
  assertString(row["scope"], "host profile scope");

  return {
    accessToken: readNullableString(row["accessToken"], "host profile accessToken"),
    accessTokenExpiresAt: readNullableNumber(
      row["accessTokenExpiresAt"],
      "host profile accessTokenExpiresAt",
    ),
    accountId: row["accountId"],
    calendarAccountEmail: readNullableString(
      row["calendarAccountEmail"],
      "host profile calendarAccountEmail",
    ),
    calendarId: readNullableString(row["calendarId"], "host profile calendarId"),
    id: row["hostId"],
    idToken: readNullableString(row["idToken"], "host profile idToken"),
    refreshToken: readNullableString(row["refreshToken"], "host profile refreshToken"),
    refreshTokenExpiresAt: readNullableNumber(
      row["refreshTokenExpiresAt"],
      "host profile refreshTokenExpiresAt",
    ),
    scope: row["scope"],
    slotSizeMinutes: readNumber(row["slotSizeMinutes"], "host profile slotSizeMinutes"),
    timezone: readString(row["timezone"], "host profile timezone"),
    username: row["username"],
  };
}

async function createTemporaryCode(config, input) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 60 * 60 * 1_000);
  const codeHash = await hashNormalizedBookingCode(input.code);

  await runD1(config.databaseName, `
    insert into booking_code (
      id, hostId, hostUsername, label, codeHash, codeHashVersion, wordCount,
      lastUsedAt, expiresAt, revokedAt, createdAt, updatedAt
    ) values (
      ${sqlString(input.codeId)},
      ${sqlString(input.host.id)},
      ${sqlString(input.host.username)},
      'smoke-live',
      ${sqlString(codeHash)},
      1,
      1,
      null,
      ${toUnixSeconds(expiresAt)},
      null,
      ${toUnixSeconds(now)},
      ${toUnixSeconds(now)}
    )
  `, "create temporary booking code");
}

export function createTemporaryGroupParticipantDraft() {
  const suffix = randomBytes(6).toString("hex");

  return {
    accountId: randomUUID(),
    code: `smoke-${randomBytes(16).toString("hex")}`,
    codeId: randomUUID(),
    hostId: randomUUID(),
    userId: randomUUID(),
    username: `smoke-${suffix}`,
  };
}

async function createTemporaryGroupParticipant(config, sourceHost, participant) {
  const now = new Date();
  const email = `${participant.username}@schedule.pizza.invalid`;
  const attendeeEmail = readSyntheticAttendeeEmail(config.bookerEmail);

  await runD1(config.databaseName, `
    insert into user (
      id, name, email, emailVerified, image, role, banned, banReason,
      banExpires, createdAt, updatedAt
    ) values (
      ${sqlString(participant.userId)},
      ${sqlString(participant.username)},
      ${sqlString(email)},
      1,
      null,
      null,
      0,
      null,
      null,
      ${toUnixSeconds(now)},
      ${toUnixSeconds(now)}
    )
  `, "create temporary group user");

  await runD1(config.databaseName, `
    insert into account (
      id, accountId, providerId, userId, accessToken, refreshToken, idToken,
      accessTokenExpiresAt, refreshTokenExpiresAt, scope, password, createdAt,
      updatedAt
    ) values (
      ${sqlString(participant.accountId)},
      ${sqlString(sourceHost.accountId)},
      'google',
      ${sqlString(participant.userId)},
      ${sqlNullableString(sourceHost.accessToken)},
      ${sqlNullableString(sourceHost.refreshToken)},
      ${sqlNullableString(sourceHost.idToken)},
      ${sqlNullableNumber(sourceHost.accessTokenExpiresAt)},
      ${sqlNullableNumber(sourceHost.refreshTokenExpiresAt)},
      ${sqlString(sourceHost.scope)},
      null,
      ${toUnixSeconds(now)},
      ${toUnixSeconds(now)}
    )
  `, "create temporary group account");

  await runD1(config.databaseName, `
    insert into host_profile (
      id, authUserId, username, displayName, timezone, slotSizeMinutes,
      calendarProvider, calendarAccountEmail, calendarId, createdAt, updatedAt
    ) values (
      ${sqlString(participant.hostId)},
      ${sqlString(participant.userId)},
      ${sqlString(participant.username)},
      ${sqlString(participant.username)},
      ${sqlString(sourceHost.timezone)},
      ${sourceHost.slotSizeMinutes},
      'google',
      ${sqlString(attendeeEmail)},
      ${sqlNullableString(sourceHost.calendarId)},
      ${toUnixSeconds(now)},
      ${toUnixSeconds(now)}
    )
  `, "create temporary group host");

  await createTemporaryCode(config, {
    code: participant.code,
    codeId: participant.codeId,
    host: { id: participant.hostId, username: participant.username },
  });
}

async function bookIndividual(config, code, slot, bookingIds) {
  const body = await postJson(config.baseUrl, "/api/v1/book", "book smoke slot", {
    code,
    email: config.bookerEmail,
    name: config.bookerName,
    slot,
    timezone: config.timeZone,
    user: config.username,
  });
  const bookingId = readRawBookedBookingId(body, "book smoke slot");

  bookingIds.add(bookingId);
  assertNoCalendarEventLeak(body["booking"], "book smoke slot");
  return bookingId;
}

async function bookGroup(config, participants, slot, bookingIds) {
  const body = await postJson(config.baseUrl, "/api/v1/book-group", "book group smoke slot", {
    ...readScheduleRequestBody(config, participants),
    email: config.bookerEmail,
    name: config.bookerName,
    slot,
    timezone: config.timeZone,
  });
  const bookedIds = readRawBookedBookingIds(
    body,
    "book group smoke slot",
    participants.length,
  );

  for (const bookingId of bookedIds) bookingIds.add(bookingId);
  assertNoCalendarEventLeak(body["booking"], "book group smoke slot");
  return bookedIds;
}

async function cleanupAfterFailure(config, input) {
  const cleanupBookingIds = input.bookingIds.filter((bookingId) =>
    !input.cleanedBookingIds.includes(bookingId)
  );
  const errors = [];

  if (cleanupBookingIds.length > 0) {
    await cleanupBookings(config, cleanupBookingIds, { allowCancelled: true }).catch((error) => {
      errors.push(`booking cleanup failed: ${readErrorMessage(error)}`);
    });
  }

  await revokeTemporaryCode(config, input.codeId).catch((error) => {
    errors.push(`code cleanup failed: ${readErrorMessage(error)}`);
  });

  if (input.temporaryParticipant !== null) {
    await deleteTemporaryGroupParticipant(config, input.temporaryParticipant).catch((error) => {
      errors.push(`temporary participant cleanup failed: ${readErrorMessage(error)}`);
    });
  }

  if (errors.length > 0) {
    throw new Error(errors.join("; "));
  }
}

async function cleanupBookings(config, bookingIds, options = { allowCancelled: false }) {
  if (bookingIds.length === 0) return;

  const rows = await runD1(config.databaseName, `
    select
      booking.id as id,
      booking.status as status,
      booking.calendarProvider as calendarProvider,
      booking.calendarEventId as calendarEventId,
      booking.cancelledAt as cancelledAt,
      host_profile.calendarId as calendarId,
      account.accessToken as accessToken
    from booking
    inner join host_profile on host_profile.id = booking.hostId
    inner join account
      on account.userId = host_profile.authUserId
      and account.providerId = 'google'
    where booking.id in (${bookingIds.map(sqlString).join(", ")})
  `, "booking cleanup rows");
  const cleanupRows = readCleanupRows(rows, bookingIds, options);
  const deletedEvents = new Set();

  for (const row of cleanupRows) {
    if (row["status"] === "cancelled") continue;

    const eventKey = `${readCalendarId(row["calendarId"])}\0${row["calendarEventId"]}`;
    if (!deletedEvents.has(eventKey)) {
      await deleteGoogleEvent(row);
      deletedEvents.add(eventKey);
    }

    await cancelBookingRecord(config, row["id"]);
    await assertBookingCancelled(config, row["id"]);
  }
}

async function deleteGoogleEvent(row) {
  const calendarId = readCalendarId(row["calendarId"]);
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(row["calendarEventId"])}?sendUpdates=all`,
    { method: "DELETE", headers: { Authorization: `Bearer ${row["accessToken"]}` } },
  );

  if (response.status !== 204) {
    throw new Error(`Google event delete expected HTTP 204, got ${response.status}`);
  }
}

async function cancelBookingRecord(config, bookingId) {
  const now = toUnixSeconds(new Date());
  const result = await runD1Statement(config.databaseName, `
    update booking
    set status = 'cancelled',
      cancelledAt = ${now},
      updatedAt = ${now}
    where id = ${sqlString(bookingId)}
      and status = 'confirmed'
  `, "cancel booking record");

  assertD1Changed(result, "cancel booking record");
}

async function assertBookingCancelled(config, bookingId) {
  const rows = await runD1(config.databaseName, `
    select id, status, calendarEventId, cancelledAt
    from booking
    where id = ${sqlString(bookingId)}
  `, "cancelled booking audit");
  const row = readSingleRow(rows, "cancelled booking audit");

  assertEqual(row["status"], "cancelled", "cancelled booking status");
  assertString(row["calendarEventId"], "cancelled booking calendarEventId");
  assertNumber(row["cancelledAt"], "cancelled booking cancelledAt");
}

async function revokeTemporaryCode(config, codeId) {
  const now = toUnixSeconds(new Date());

  await runD1(config.databaseName, `
    update booking_code
    set revokedAt = ${now},
      updatedAt = ${now}
    where id = ${sqlString(codeId)}
      and revokedAt is null
  `, "revoke temporary booking code");
}

async function assertTemporaryCodeRevoked(config, codeId) {
  const rows = await runD1(config.databaseName, `
    select id, revokedAt
    from booking_code
    where id = ${sqlString(codeId)}
  `, "temporary booking code audit");
  const row = readSingleRow(rows, "temporary booking code audit");

  assertNumber(row["revokedAt"], "temporary booking code revokedAt");
}

async function deleteTemporaryGroupParticipant(config, participant) {
  await runD1Statement(config.databaseName, `
    delete from booking_code_attempt
    where hostId = ${sqlString(participant.hostId)}
      or username = ${sqlString(participant.username)}
  `, "delete temporary group booking attempts");
  await runD1Statement(config.databaseName, `
    delete from booking_code
    where id = ${sqlString(participant.codeId)}
  `, "delete temporary group booking code");
  await runD1Statement(config.databaseName, `
    delete from host_profile
    where id = ${sqlString(participant.hostId)}
  `, "delete temporary group host");
  await runD1Statement(config.databaseName, `
    delete from account
    where id = ${sqlString(participant.accountId)}
  `, "delete temporary group account");
  await runD1Statement(config.databaseName, `
    delete from user
    where id = ${sqlString(participant.userId)}
  `, "delete temporary group user");
}

export function readScheduleRequestBody(config, participants) {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1_000);

  return {
    durationMinutes: 30,
    granularityMinutes: 15,
    maxAlternativeSlotCount: 5,
    maxExactSlotCount: 10,
    participants: participants.map((participant) => ({
      code: participant.code,
      user: participant.username,
    })),
    timeZone: config.timeZone,
    window: { start: now.toISOString(), end: windowEnd.toISOString() },
  };
}

export function readScheduleLikeSummary(responseBody, label) {
  assertRecord(responseBody, label);

  if (responseBody["kind"] !== "exact") {
    throw new Error(`${label} expected exact slots, got ${String(responseBody["kind"])}`);
  }

  assertNonEmptyArray(responseBody["slots"], `${label} slots`);

  return { kind: responseBody["kind"], slotCount: responseBody["slots"].length };
}

export function readFirstAvailabilitySlotStart(responseBody, label) {
  return readAvailabilitySlotStart(responseBody, label, 0);
}

export function readAvailabilitySlotStart(responseBody, label, index) {
  assertRecord(responseBody, label);
  assertNonEmptyArray(responseBody["slots"], `${label} slots`);
  if (responseBody["slots"].length <= index) {
    throw new Error(`${label} expected slot ${index}, got ${responseBody["slots"].length}`);
  }

  assertRecord(responseBody["slots"][index], `${label} slot ${index}`);

  const start = responseBody["slots"][index]["start"];
  if (typeof start !== "string" || start.trim() === "") {
    throw new Error(`${label} slot ${index} start must be a string`);
  }

  return start;
}

export function readBookedBookingId(responseBody, label) {
  const bookingId = readRawBookedBookingId(responseBody, label);

  assertNoCalendarEventLeak(responseBody["booking"], label);
  return bookingId;
}

function readRawBookedBookingId(responseBody, label) {
  assertRecord(responseBody, label);
  assertEqual(responseBody["ok"], true, `${label} ok`);
  assertRecord(responseBody["booking"], `${label} booking`);

  const bookingId = responseBody["booking"]["id"];
  if (typeof bookingId !== "string" || bookingId.trim() === "") {
    throw new Error(`${label} booking id must be a string`);
  }

  return bookingId;
}

export function readBookedBookingIds(responseBody, label, expectedCount) {
  const bookingIds = readRawBookedBookingIds(responseBody, label, expectedCount);

  assertNoCalendarEventLeak(responseBody["booking"], label);
  return bookingIds;
}

function readRawBookedBookingIds(responseBody, label, expectedCount) {
  assertRecord(responseBody, label);
  assertEqual(responseBody["ok"], true, `${label} ok`);
  assertRecord(responseBody["booking"], `${label} booking`);
  assertNonEmptyArray(responseBody["booking"]["ids"], `${label} booking ids`);

  if (responseBody["booking"]["ids"].length !== expectedCount) {
    throw new Error(
      `${label} expected ${expectedCount} booking ids, got ${responseBody["booking"]["ids"].length}`,
    );
  }

  return responseBody["booking"]["ids"].map((bookingId, index) => {
    if (typeof bookingId !== "string" || bookingId.trim() === "") {
      throw new Error(`${label} booking ids[${index}] must be a string`);
    }

    return bookingId;
  });
}

export function readCleanupRows(rows, bookingIds, options = { allowCancelled: false }) {
  if (rows.length !== bookingIds.length) {
    throw new Error(`booking cleanup expected ${bookingIds.length} rows, got ${rows.length}`);
  }

  const expectedIds = new Set(bookingIds);
  for (const row of rows) {
    assertString(row["id"], "booking cleanup id");
    if (!expectedIds.delete(row["id"])) {
      throw new Error(`booking cleanup returned unexpected booking ${row["id"]}`);
    }

    if (row["status"] === "cancelled" && options.allowCancelled) {
      assertNumber(row["cancelledAt"], "booking cleanup cancelledAt");
      assertString(row["calendarEventId"], "booking cleanup calendarEventId");
      continue;
    }

    assertEqual(row["status"], "confirmed", "booking cleanup status");
    assertEqual(row["calendarProvider"], "google", "booking cleanup provider");
    assertString(row["calendarEventId"], "booking cleanup calendarEventId");
    assertString(row["accessToken"], "booking cleanup accessToken");
  }

  return rows;
}

export function readD1Rows(stdout, label) {
  const result = readD1Result(stdout, label);
  const rows = result["results"];

  if (rows === undefined) {
    return [];
  }

  assertArray(rows, `${label} rows`);
  return rows;
}

export function readD1Result(stdout, label) {
  const payload = parseJson(stdout, label);

  if (!Array.isArray(payload) || payload.length !== 1) {
    throw new Error(`${label} expected one D1 result`);
  }

  const result = payload[0];
  assertRecord(result, `${label} result`);
  assertEqual(result["success"], true, `${label} success`);

  return result;
}

export function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function sqlNullableString(value) {
  return value === null ? "null" : sqlString(value);
}

function sqlNullableNumber(value) {
  return value === null ? "null" : String(value);
}

function readSyntheticAttendeeEmail(bookerEmail) {
  const [localPart, domain] = bookerEmail.split("@");

  if (localPart === undefined || domain === undefined || localPart === "" || domain === "") {
    throw new Error("booker email cannot produce synthetic attendee email");
  }

  return `${localPart}+schedule-pizza-smoke@${domain}`;
}

async function hashNormalizedBookingCode(code) {
  const bytes = new TextEncoder().encode(code);
  const digest = await webcrypto.subtle.digest("SHA-256", bytes);

  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

async function runD1(databaseName, sql, label) {
  const result = await runD1Statement(databaseName, sql, label);
  const rows = result["results"];

  if (rows === undefined) {
    return [];
  }

  assertArray(rows, `${label} rows`);
  return rows;
}

async function runD1Statement(databaseName, sql, label) {
  const { stdout } = await execFileAsync("pnpm", [
    "--filter",
    "@schedule.pizza/web",
    "exec",
    "wrangler",
    "d1",
    "execute",
    databaseName,
    "--remote",
    "--command",
    sql,
    "--json",
  ], { cwd: repoRoot });

  return readD1Result(stdout, label);
}

async function getJson(baseUrl, path, label) {
  const response = await fetch(new URL(path, baseUrl));

  return readJsonResponse(response, label);
}

async function postJson(baseUrl, path, label, body) {
  const response = await fetch(new URL(path, baseUrl), {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method: "POST",
  });

  return readJsonResponse(response, label);
}

async function readJsonResponse(response, label) {
  const contentType = response.headers.get("content-type") ?? "";

  if (!response.ok) {
    throw new Error(`${label} returned HTTP ${response.status}`);
  }

  if (!contentType.includes("application/json")) {
    throw new Error(`${label} returned ${contentType || "no content type"}`);
  }

  return response.json();
}

function readRequiredLiveUrl(value) {
  const rawValue = readRequiredEnvValue(value, "SCHEDULE_PIZZA_URL");
  const url = parseUrl(rawValue, "SCHEDULE_PIZZA_URL");

  if (url.protocol !== "https:" || url.hostname !== "schedule.pizza") {
    throw new Error("SCHEDULE_PIZZA_URL must be https://schedule.pizza");
  }

  return url;
}

function parseUrl(value, name) {
  try {
    return new URL(value);
  } catch {
    throw new Error(`${name} is invalid: ${value}`);
  }
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

function readTimeZone(value, name) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
  } catch {
    throw new Error(`${name} is invalid`);
  }

  return value;
}

function readCalendarId(value) {
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : "primary";
}

function readString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} must be a string`);
  }

  return value.trim();
}

function readNullableString(value, label) {
  if (value === null) {
    return null;
  }

  return readString(value, label);
}

function readNumber(value, label) {
  if (typeof value !== "number") {
    throw new Error(`${label} must be a number`);
  }

  return value;
}

function readNullableNumber(value, label) {
  if (value === null) {
    return null;
  }

  return readNumber(value, label);
}

function readSingleRow(rows, label) {
  if (rows.length !== 1) {
    throw new Error(`${label} expected one row, got ${rows.length}`);
  }

  return rows[0];
}

function assertD1Changed(result, label) {
  assertRecord(result["meta"], `${label} meta`);

  if (result["meta"]["changes"] !== 1) {
    throw new Error(`${label} expected one changed row, got ${String(result["meta"]["changes"])}`);
  }
}

function assertNoCalendarEventLeak(value, label) {
  if (Object.hasOwn(value, "calendarEventId")) {
    throw new Error(`${label} must not expose calendarEventId`);
  }
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

function assertString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} must be a string`);
  }
}

function assertNumber(value, label) {
  if (typeof value !== "number") {
    throw new Error(`${label} must be a number`);
  }
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label} expected ${String(expected)}, got ${String(actual)}`);
  }
}

function parseJson(value, label) {
  try {
    return JSON.parse(value);
  } catch {
    throw new Error(`${label} returned invalid JSON`);
  }
}

function toUnixSeconds(date) {
  return Math.floor(date.getTime() / 1_000);
}

function readErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function isCliEntrypoint() {
  const scriptPath = process.argv[1];

  return scriptPath !== undefined &&
    import.meta.url === pathToFileURL(scriptPath).href;
}
