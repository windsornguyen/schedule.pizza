import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  out: "./drizzle",
  schema: "./app/db/schema/index.ts",
  strict: true,
  verbose: true,
  dbCredentials: { url: process.env["DATABASE_URL"] ?? "" },
});
