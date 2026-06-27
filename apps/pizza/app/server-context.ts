import { createContext } from "react-router";

type GeneratedWorkerEnv = Env;

export type ServerEnv = Omit<
  GeneratedWorkerEnv,
  "BETTER_AUTH_ADMIN_USER_IDS" | "BETTER_AUTH_SECRET" | "BETTER_AUTH_URL"
> & {
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
  BETTER_AUTH_ADMIN_USER_IDS?: string;
};

export const serverContext = createContext<{
  env: ServerEnv;
  ctx: ExecutionContext;
}>();
