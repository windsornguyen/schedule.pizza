import designMd from "../../../../docs/design.md?raw";

export function loader() {
  return new Response(designMd, {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
}
