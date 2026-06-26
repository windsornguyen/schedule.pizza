import { Hono } from "hono";
import {
  RouterContextProvider,
  createRequestHandler,
  type ServerBuild,
} from "react-router";
import { api } from "../app/api";
import { serverContext, type ServerEnv } from "../app/server-context";

type Bindings = ServerEnv;

const app = new Hono<{ Bindings: Bindings }>();

app.route("/api", api);

const reactRouterHandler = createRequestHandler(
  () =>
    import("virtual:react-router/server-build") as unknown as Promise<ServerBuild>,
  import.meta.env.MODE
);

app.all("*", async (c) => {
  const routerContext = new RouterContextProvider();
  routerContext.set(serverContext, { env: c.env, ctx: c.executionCtx });
  return reactRouterHandler(c.req.raw, routerContext);
});

export default app;
