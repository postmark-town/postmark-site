import { threadJsonPaths } from "../../routes.mjs";

export function getStaticPaths() {
  return threadJsonPaths();
}

export function GET({ props }) {
  return new Response(JSON.stringify(props), { headers: { "content-type": "application/json" } });
}
