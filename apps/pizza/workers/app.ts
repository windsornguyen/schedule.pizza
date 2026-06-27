import { Hono } from "hono";
import {
  RouterContextProvider,
  createRequestHandler,
  type ServerBuild,
} from "react-router";
import { api } from "../app/api";
import { setSecurityHeaders } from "../app/http/security_headers.server";
import { serverContext, type ServerEnv } from "../app/server-context";

type Bindings = ServerEnv;

const app = new Hono<{ Bindings: Bindings }>();

app.use("*", async (c, next) => {
  await next();
  setSecurityHeaders(c.res.headers);
});

app.route("/api", api);

const reactRouterHandler = createRequestHandler(
  () =>
    import("virtual:react-router/server-build") as unknown as Promise<ServerBuild>,
  import.meta.env.MODE
);

app.all("*", async (c) => {
  const routerContext = new RouterContextProvider();
  routerContext.set(serverContext, { env: c.env, ctx: c.executionCtx as ExecutionContext });
  return reactRouterHandler(c.req.raw, routerContext);
});

export default app;
