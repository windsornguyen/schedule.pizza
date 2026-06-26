import { createContext } from "react-router";

export type ServerEnv = {
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
  BETTER_AUTH_ADMIN_USER_IDS?: string;
  DB: D1Database;
};

export const serverContext = createContext<{
  env: ServerEnv;
  ctx: ExecutionContext;
}>();
