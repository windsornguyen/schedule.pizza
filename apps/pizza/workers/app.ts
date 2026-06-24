import {
  RouterContextProvider,
  createRequestHandler,
  type ServerBuild,
} from "react-router";
import { serverContext, type ServerEnv } from "../app/server-context";

const requestHandler = createRequestHandler(
  () =>
    import("virtual:react-router/server-build") as unknown as Promise<ServerBuild>,
  import.meta.env.MODE
);

export default {
  async fetch(request, env, ctx) {
    const routerContext = new RouterContextProvider();
    routerContext.set(serverContext, { env, ctx });
    return requestHandler(request, routerContext);
  },
} satisfies ExportedHandler<ServerEnv>;
