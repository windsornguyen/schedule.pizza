// One-time, fail-closed transfer from a restored D1 export to the Drizzle schema.
// Never prints records or credentials. Rehearsal always rolls back its inserts.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import pg from "pg";
import { convertD1Value } from "./import-d1-values.mjs";

const tables = ["user", "organization", "account", "session", "verification", "rateLimit",
  "member", "invitation", "host_profile", "booking_code", "booking", "booking_code_attempt"];
const snapshot = JSON.parse(readFileSync(new URL("../drizzle/meta/0000_snapshot.json", import.meta.url), "utf8"));
const sourcePath = process.argv[2];
const mode = process.argv[3];
const repairMilliseconds = process.argv[4] === "--repair-booking-code-milliseconds";
const repairs = {};
if (!sourcePath || !["--rehearse", "--import", "--verify"].includes(mode)) {
  throw new Error("usage: import-d1.mjs RESTORED.sqlite --rehearse|--import|--verify");
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const source = new DatabaseSync(sourcePath, { readOnly: true });
const target = new pg.Client({ connectionString: process.env.DATABASE_URL });
const quote = (name) => `"${name.replaceAll('"', '""')}"`;

function readTable(name) {
  const columns = Object.values(snapshot.tables[`public.${name}`].columns);
  const sourceColumns = source.prepare(`pragma table_info(${quote(name)})`).all().map((column) => column.name).sort();
  if (JSON.stringify(sourceColumns) !== JSON.stringify(columns.map((column) => column.name).sort())) {
    throw new Error(`source schema mismatch: ${name}`);
  }
  const rows = source.prepare(`select * from ${quote(name)} order by id`).all();
  return { columns, rows: rows.map((row) => columns.map((column) => {
    const converted = convertD1Value(name, row[column.name], column, repairMilliseconds);
    if (converted.repaired) {
      const key = `${name}.${column.name}`;
      repairs[key] = (repairs[key] ?? 0) + 1;
    }
    return converted.value;
  })) };
}

async function verifyTable(name, columns, rows) {
  const result = await target.query(`select ${columns.map((column) => quote(column.name)).join(",")} from ${quote(name)}`);
  const actual = result.rows.map((row) => columns.map((column) => {
    const value = row[column.name];
    if (value === null) return null;
    if (column.type.startsWith("timestamp")) return value.toISOString();
    if (column.type === "bigint") return Number(value);
    return value;
  }));
  const sort = (values) => values.map((row) => JSON.stringify(row)).sort();
  const expected = JSON.stringify(sort(rows));
  if (expected !== JSON.stringify(sort(actual))) throw new Error(`row parity mismatch: ${name}`);
  return { table: name, rows: rows.length, sha256: createHash("sha256").update(expected).digest("hex") };
}

try {
  if (source.prepare("pragma integrity_check").get().integrity_check !== "ok") throw new Error("source integrity check failed");
  if (source.prepare("pragma foreign_key_check").all().length) throw new Error("source foreign key check failed");
  const unknown = source.prepare("select name from sqlite_master where type = 'table'").all()
    .map((row) => row.name).filter((name) => !tables.includes(name) && !["_cf_KV", "d1_migrations", "sqlite_sequence"].includes(name));
  if (unknown.length) throw new Error(`unmapped source tables: ${unknown.join(", ")}`);
  await target.connect();
  await target.query("begin isolation level repeatable read");
  if (mode !== "--verify") {
    await target.query(`lock table ${tables.map(quote).join(",")} in access exclusive mode`);
    for (const name of tables) {
      const { rows } = await target.query(`select 1 from ${quote(name)} limit 1`);
      if (rows.length) throw new Error(`target is not empty: ${name}`);
    }
  }
  const receipt = [];
  for (const name of tables) {
    const { columns, rows } = readTable(name);
    if (mode !== "--verify") {
      const statement = `insert into ${quote(name)} (${columns.map((c) => quote(c.name)).join(",")}) values (${columns.map((_, n) => `$${n + 1}`).join(",")})`;
      for (const row of rows) await target.query(statement, row);
    }
    receipt.push(await verifyTable(name, columns, rows));
  }
  await target.query(mode === "--import" ? "commit" : "rollback");
  // oxlint-disable-next-line no-console -- emit aggregate migration proof without row data or credentials
  console.log(JSON.stringify({ mode, source: sourcePath, repairs, receipt }));
} finally {
  source.close();
  await target.end();
}
