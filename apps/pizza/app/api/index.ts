import { Hono } from "hono";
import type { ServerEnv } from "@/server-context";
import { v1 } from "./v1";
import { auth } from "./auth";

type Bindings = ServerEnv;

const api = new Hono<{ Bindings: Bindings }>();

api.route("/v1", v1);
api.route("/auth", auth);

export { api };
