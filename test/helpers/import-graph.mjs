// import-graph.mjs — what a module can reach by import (POS-1085).
//
// Used by test/incremental-pages.test.mjs: a page that builds incrementally may read
// its data only through its props, so nothing in its import graph (the components,
// the layout, the helpers) may import a data JSON file either. Follows relative
// imports and the site's `@/` alias (src/), static `import`/`export ... from` and
// `import("...")`, in .astro files, scripts and .mjs/.js alike. Packages are not
// followed. Comments are stripped first so a comment may quote an import.
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const IMPORT = /(?:^|[\s;{}])(?:import|export)\s[^"'`;]*?from\s*["']([^"']+)["']|(?:^|[\s;{}])import\s*["']([^"']+)["']|\bimport\(\s*["']([^"']+)["']\s*\)/g;

const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

function resolveSpec(root, from, spec) {
  let base;
  if (spec.startsWith("@/")) base = resolve(root, "src", spec.slice(2));
  else if (spec.startsWith(".")) base = resolve(dirname(from), spec);
  else return null;
  for (const c of [base, `${base}.mjs`, `${base}.js`, `${base}.astro`, join(base, "index.mjs"), join(base, "index.js")]) {
    if (existsSync(c) && statSync(c).isFile()) return c;
  }
  return undefined; // an import that resolves to nothing
}

/**
 * @param {string} entry  absolute path of the module to start from
 * @param {{root: string, stop?: string[]}} opts  root = the site root (for `@/`); stop = file names not entered (the allowed supplier)
 * @returns {{files: string[], json: {from: string, spec: string}[], unresolved: {from: string, spec: string}[]}}
 */
export function importGraph(entry, { root, stop = [] }) {
  const seen = new Set();
  const json = [];
  const unresolved = [];
  const walk = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    const src = strip(readFileSync(file, "utf8"));
    for (const m of src.matchAll(IMPORT)) {
      const spec = m[1] ?? m[2] ?? m[3];
      if (/\.json$/.test(spec)) { json.push({ from: file, spec }); continue; }
      if (stop.some((s) => spec.endsWith(s))) continue;
      const r = resolveSpec(root, file, spec);
      if (r === undefined) unresolved.push({ from: file, spec });
      else if (r && /\.(mjs|js|astro)$/.test(r)) walk(r); // a stylesheet, an image: nothing to follow
    }
  };
  walk(entry);
  return { files: [...seen], json, unresolved };
}
