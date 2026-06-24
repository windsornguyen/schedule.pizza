import { createContext } from "react-router";

export interface AppEnv {
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  DB: D1Database;
}

export const serverContext = createContext<{
  env: AppEnv;
  ctx: ExecutionContext;
}>();
