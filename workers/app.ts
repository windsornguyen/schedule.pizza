import {
  RouterContextProvider,
  createContext,
  createRequestHandler,
  type ServerBuild,
} from "react-router";

export interface AppEnv {
  // Add bindings here as needed: D1, KV, R2, etc.
}

export const cloudflareContext = createContext<{
  env: AppEnv;
  ctx: ExecutionContext;
}>();

const requestHandler = createRequestHandler(
  () =>
    import("virtual:react-router/server-build") as unknown as Promise<ServerBuild>,
  import.meta.env.MODE
);

export default {
  async fetch(request, env, ctx) {
    const routerContext = new RouterContextProvider();
    routerContext.set(cloudflareContext, { env, ctx });
    return requestHandler(request, routerContext);
  },
} satisfies ExportedHandler<AppEnv>;
