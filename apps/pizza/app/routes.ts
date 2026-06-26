import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/_index.tsx"),
  route("auth/google", "routes/auth.google.ts"),
  route("auth/logout", "routes/auth.logout.ts"),
  route("dashboard", "routes/dashboard.tsx"),
  route("design.md", "routes/design.md.ts"),
  route("docs", "routes/docs.tsx"),
  route("group", "routes/group.tsx"),
  route("login", "routes/login.tsx"),
  route("search", "routes/search.ts"),
  route(":username", "routes/profile.tsx"),
] satisfies RouteConfig;
