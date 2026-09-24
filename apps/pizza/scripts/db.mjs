// The public database CLI generates marked artifacts, checks drift, and applies Drizzle migrations.
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { checkMigrations, generateMigrations, MigrationArtifactError, stampMigrations } from "./migrations.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const args = process.argv.slice(2);
if (args[0] === "--") args.shift();
const [command, ...flags] = args;
if (process.env.GITHUB_ACTIONS === "true" && !process.env.MIGRATION_BASE_REF) {
  throw new MigrationArtifactError("missing_base_ref", "GitHub Actions must provide MIGRATION_BASE_REF");
}
const options = { baseRef: process.env.MIGRATION_BASE_REF ?? "HEAD" };

if (command === "generate" && flags.length === 1 && /^--name=[a-z][a-z0-9_]*$/.test(flags[0])) {
  await generateMigrations(root, flags[0].slice("--name=".length), options);
} else if (flags.length === 0 && ["check", "watermark", "migrate"].includes(command)) {
  if (command === "watermark") await stampMigrations(root, options);
  else await checkMigrations(root, options);
  if (command === "migrate") {
    if (!process.env.DATABASE_URL) throw new MigrationArtifactError("missing_database_url", "DATABASE_URL is required");
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    try { await migrate(drizzle(pool), { migrationsFolder: `${root}drizzle` }); }
    finally { await pool.end(); }
  }
} else {
  throw new MigrationArtifactError("invalid_command", "use db check, db generate --name=change, db migrate, or db watermark");
}
