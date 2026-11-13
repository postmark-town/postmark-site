// /hearths/<id>.js — a registered Hearth entry's own script, served from the site's own origin (POS-1024/a, POS-1028).
//
// Written by the build beside every other page, from the same rows the Hearth draws (src/data/postmark/hearths.json, copied from the town repo's
// PROJECTS/household-hearths/<id>/hearth.js by tools/sync-hearths.mjs). Only entries the registry ACCEPTED have one, and only when they carry a
// script under the cap (entries.mjs). The household page imports it as a module and runs it on the page (lib/hearth/script.mjs): no frame and
// no separate origin, on Darko's 2026-11-13 09:21 EST word. Its gate is the town PR: at least 100 lifetime stamps, every line read by hand.
import rows from "@/data/postmark/hearths.json";
import { entries } from "@/lib/hearth/registry.mjs";

export function getStaticPaths() {
  const raw = new Map((Array.isArray(rows) ? rows : []).map((r) => [String(r?.id ?? ""), r]));
  return entries
    .filter((e) => e.script && typeof raw.get(e.id)?.js === "string")
    .map((e) => ({ params: { id: e.id }, props: { js: raw.get(e.id).js } }));
}

export function GET({ props }) {
  return new Response(props.js, { headers: { "content-type": "text/javascript; charset=utf-8" } });
}
