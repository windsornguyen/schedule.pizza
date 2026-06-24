import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/_index.tsx"),
  route("api/v1", "routes/api.v1._index.ts"),
  route("api/v1/availability", "routes/api.v1.availability.ts"),
  route("api/v1/book", "routes/api.v1.book.ts"),
] satisfies RouteConfig;
