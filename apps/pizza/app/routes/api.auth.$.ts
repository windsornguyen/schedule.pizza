import type { RouterContextProvider } from "react-router";
import { createAuth } from "@/auth.server";
import { serverContext } from "@/server-context";

export async function loader({ request, context }: { request: Request; context: RouterContextProvider }) {
  const { env } = context.get(serverContext);
  const auth = createAuth(env);
  return auth.handler(request);
}

export async function action({ request, context }: { request: Request; context: RouterContextProvider }) {
  const { env } = context.get(serverContext);
  const auth = createAuth(env);
  return auth.handler(request);
}
