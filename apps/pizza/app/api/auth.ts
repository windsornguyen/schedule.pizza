import { Hono } from "hono";
import type { ServerEnv } from "@/server-context";
import { createAuth } from "@/auth.server";

type Bindings = ServerEnv;

export const auth = new Hono<{ Bindings: Bindings }>();

auth.all("/*", async (c) => {
  const authInstance = createAuth(c.env);
  return authInstance.handler(c.req.raw);
});
