import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  out: "./drizzle",
  schema: "./app/db/schema/index.ts",
  strict: true,
  verbose: true,
});
