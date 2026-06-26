import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/_index.tsx"),
  route("design.md", "routes/design.md.ts"),
  route("login", "routes/login.tsx"),
] satisfies RouteConfig;
