// incremental.mjs — which routes a build has to render (POS-1085).
//
// THE LAW A CONVERTED PAGE KEEPS. A page that calls `incremental()` from its
// getStaticPaths reads its data ONLY from `Astro.props` (and the shared layout,
// which the build's global key covers: tools/incremental-build.mjs). So a route's
// key is the hash of its params and its props: everything the page can show, by
// construction, with no map of "which file a page reads" to keep. Anything a
// page needs that a props object cannot carry as plain data (an opener looked up
// in letters.json, a portrait chosen from media.json, a rendered letter) is
// computed in getStaticPaths and handed in as props, so it is inside the key.
// test/incremental-pages.test.mjs forbids a converted page from importing
// data/postmark/*.json outside getStaticPaths.
//
// THE TWO ENVS (both unset in dev, in CI and in every ordinary build: then this
// returns `routes` untouched and writes nothing):
//   INCR_OUT   a directory. Every call writes `<family>.json` there: the key and
//              the output files of EVERY route of the family, rendered or not.
//   INCR_PREV  the previous release's merged manifest. A route whose key equals
//              the one recorded there is dropped from the list, i.e. not
//              rendered; the entry script carries its files over from the
//              previous release. Set only when the global key matched.
//
// A key that cannot be computed (a function, a symbol, a cycle in the props)
// throws: the build fails loudly and the entry script falls back to a full one.
// It never hashes something it could not see.

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Stable text for a value: sorted keys, Maps and Sets spelled out, nothing silently dropped. */
export function canon(v, seen = new Set()) {
  if (v === null) return "null";
  const t = typeof v;
  if (t === "string") return JSON.stringify(v);
  if (t === "number") return Number.isFinite(v) ? String(v) : `"num:${v}"`;
  if (t === "boolean") return String(v);
  if (t === "undefined") return "undefined";
  if (t !== "object") throw new Error(`incremental: cannot key a ${t} (a page prop must be plain data)`);
  if (seen.has(v)) throw new Error("incremental: cannot key a cyclic prop");
  seen.add(v);
  let out;
  if (Array.isArray(v)) out = `[${v.map((x) => canon(x, seen)).join(",")}]`;
  else if (v instanceof Map) out = `Map{${[...v].map(([k, x]) => `${canon(k, seen)}=>${canon(x, seen)}`).join(",")}}`;
  else if (v instanceof Set) out = `Set{${[...v].map((x) => canon(x, seen)).join(",")}}`;
  else if (v instanceof Date) out = `Date(${v.toISOString()})`;
  else {
    const proto = Object.getPrototypeOf(v);
    if (proto !== Object.prototype && proto !== null) throw new Error("incremental: cannot key a class instance (a page prop must be plain data)");
    out = `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k], seen)}`).join(",")}}`;
  }
  seen.delete(v);
  return out;
}

export const keyOf = (params, props) => createHash("sha256").update(canon({ params, props })).digest("hex").slice(0, 32);
export const routeId = (params) => canon(params);

let prevCache = null;
function previous() {
  const p = process.env.INCR_PREV;
  if (!p) return null;
  if (prevCache?.path !== p) prevCache = { path: p, manifest: JSON.parse(readFileSync(p, "utf8")) };
  return prevCache.manifest;
}

/**
 * @param {string} family  one name per route file ("mail-thread", "mail-pair-older-json", ...)
 * @param {{params: object, props: object}[]} routes  what getStaticPaths would return
 * @param {{files: (params: object) => string[]}} opts  the files (relative to the outDir) one route writes
 * @returns the routes to render
 */
export function incremental(family, routes, { files }) {
  const outDir = process.env.INCR_OUT;
  if (!outDir) return routes;
  const prev = previous()?.routes?.[family] ?? null;
  const entries = {};
  const render = [];
  for (const r of routes) {
    const id = routeId(r.params);
    const k = keyOf(r.params, r.props);
    entries[id] = { k, f: files(r.params) };
    if (!prev || prev[id]?.k !== k) render.push(r);
  }
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, `${family}.json`), JSON.stringify({ family, total: routes.length, rendered: render.length, entries }));
  return render;
}
