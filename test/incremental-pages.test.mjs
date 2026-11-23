// incremental-pages.test.mjs — a converted page reads only its props (POS-1085).
//
//   node --test test/incremental-pages.test.mjs
//
// LAW (POS-1085, Darko 2026-11-16 13:53 EST): "incremental builds is a must". A route
// is skipped when the hash of its params and props is unchanged, so what the page
// reads outside its props is a hidden input no key can see. Every page that builds
// incrementally therefore imports no data/postmark JSON, no resident-pages (which
// reads the residents and renames files), and reads no clock: those lookups happen
// in getStaticPaths (src/lib/mail-routes.mjs) and ride in as props.
//
// LABEL: these are TEXT PINS (the weakest instrument, WIRING-AND-PINS). The
// behavioural reader beside them is test/incremental-build.test.mjs, which builds
// a fixture whose page reads a neighbour's title only through props and proves the
// neighbour rebuilds; the full-site proof is the PR's measured before/after build.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PAGES = join(ROOT, "town", "pages");

function walk(dir, out = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

// Code only: strip comments so a page may explain what it no longer reads.
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const converted = walk(PAGES)
  .filter((f) => /@\/lib\/mail-routes\.mjs/.test(readFileSync(f, "utf8")))
  .map((f) => relative(PAGES, f).split(sep).join("/"))
  .sort();

test("the converted pages are the seven the mail families are made of", () => {
  assert.deepEqual(converted, [
    "[...moved].astro",
    "mail/[thread].astro",
    "mail/[thread]/older/[part].astro",
    "mail/[thread]/older/[part].json.js",
    "mail/with/[pair].astro",
    "mail/with/[pair]/older/[part].astro",
    "mail/with/[pair]/older/[part].json.js",
  ]);
});

for (const rel of converted) {
  test(`${rel} reads nothing outside its props`, () => {
    const src = code(readFileSync(join(PAGES, rel), "utf8"));
    assert.doesNotMatch(src, /data\/postmark/, "imports a data/postmark file");
    assert.doesNotMatch(src, /resident-pages/, "imports resident-pages (its link table reads the residents and renames files)");
    assert.doesNotMatch(src, /Date\.now\(|new Date\(\s*\)/, "reads the clock"); // date arithmetic on a prop (new Date(x)) is fine
    assert.doesNotMatch(src, /process\.env|import\.meta\.env/, "reads the environment");
    assert.match(src, /getStaticPaths\(\)\s*\{\s*return \w+Paths\(\);\s*\}/, "getStaticPaths is not the one-line call into mail-routes.mjs");
  });
}

test("every route builder in mail-routes.mjs goes through incremental()", () => {
  const src = code(readFileSync(join(ROOT, "src", "lib", "mail-routes.mjs"), "utf8"));
  const builders = [...src.matchAll(/export function (\w+Paths)\(\)/g)].map((m) => m[1]);
  assert.equal(builders.length, 7);
  for (const b of builders) {
    const body = src.slice(src.indexOf(`export function ${b}(`)).split(/\nexport function /)[0];
    assert.match(body, /return incremental\("[a-z-]+", /, `${b} does not return incremental(...)`);
  }
  // and each family name is used once, so two route files never share a manifest file
  const names = [...src.matchAll(/return incremental\("([a-z-]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(names).size, names.length, names.join(","));
});

// ── the whole import graph, not only the page file ───────────────────────────
// LAW (POS-1085, Truey's finding on #451): a read hidden in a component, a layout or a
// helper the page imports is as invisible to the route key as one in the page. So
// nothing a converted page can reach by import, except the one supplier
// (mail-routes.mjs, which getStaticPaths calls and whose data rides in as props),
// may import a data JSON file.
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { after } from "node:test";
import { importGraph } from "./helpers/import-graph.mjs";

const SCRATCH = mkdtempSync(join(tmpdir(), "incr-graph-"));
after(() => rmSync(SCRATCH, { recursive: true, force: true })); // the temp folder this file made itself

test("control: the walker finds a data import hidden three imports deep, and a clean tree is clean", () => {
  const w = (rel, text) => { const p = join(SCRATCH, rel); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, text); return p; };
  w("src/data/postmark/residents.json", "[]");
  w("src/lib/names.mjs", 'import people from "@/data/postmark/residents.json";\nexport const n = people.length;\n');
  w("src/lib/clean.mjs", "export const c = 1;\n");
  w("src/components/Footer.astro", '---\nimport { n } from "../lib/names.mjs";\n---\n<p>{n}</p>\n');
  w("src/components/Plain.astro", '---\nimport { c } from "../lib/clean.mjs";\n---\n<p>{c}</p>\n');
  w("src/layouts/Layout.astro", '---\nimport Footer from "../components/Footer.astro";\n---\n<slot /><Footer />\n');
  w("src/layouts/Clean.astro", '---\nimport Plain from "../components/Plain.astro";\n---\n<slot /><Plain />\n');
  const page = w("town/pages/p.astro", '---\nimport Layout from "@/layouts/Layout.astro";\n---\n<Layout />\n');
  const clean = w("town/pages/q.astro", '---\nimport Layout from "@/layouts/Clean.astro";\n// import x from "@/data/postmark/residents.json"; (a comment)\n---\n<Layout />\n');
  const hidden = importGraph(page, { root: SCRATCH });
  assert.equal(hidden.json.length, 1);
  assert.match(hidden.json[0].spec, /residents\.json$/);
  assert.ok(hidden.files.length >= 4, hidden.files.join("\n"));
  const ok = importGraph(clean, { root: SCRATCH });
  assert.deepEqual(ok.json, []);
  assert.ok(ok.files.length >= 4, "the clean walk must have walked something");
  // a dynamic import and a script's import are followed too
  w("src/components/Late.astro", '---\n---\n<script>\n  const m = await import("../lib/names.mjs");\n</script>\n');
  const late = w("town/pages/r.astro", '---\nimport Late from "@/components/Late.astro";\n---\n<Late />\n');
  assert.equal(importGraph(late, { root: SCRATCH }).json.length, 1);
  // the supplier is the one door left open: its imports are not entered
  w("src/lib/supplier.mjs", 'import people from "@/data/postmark/residents.json";\nexport const s = people;\n');
  const viaSupplier = w("town/pages/s.astro", '---\nimport { s } from "@/lib/supplier.mjs";\n---\n<p>{s.length}</p>\n');
  assert.equal(importGraph(viaSupplier, { root: SCRATCH, stop: ["supplier.mjs"] }).json.length, 0);
  assert.equal(importGraph(viaSupplier, { root: SCRATCH }).json.length, 1);
});

for (const rel of converted) {
  test(`${rel}: nothing it imports (components, layout, helpers) imports a data JSON`, () => {
    const g = importGraph(join(PAGES, rel), { root: ROOT, stop: ["mail-routes.mjs"] });
    assert.deepEqual(g.json.map((j) => `${relative(ROOT, j.from).split(sep).join("/")} imports ${j.spec}`), []);
    assert.deepEqual(g.unresolved.map((u) => `${relative(ROOT, u.from).split(sep).join("/")} imports ${u.spec}`), [], "an import the walker could not resolve is a read it could not see");
    if (rel.endsWith(".astro") && !rel.startsWith("[...moved]")) assert.ok(g.files.length > 5, `the walk reached only ${g.files.length} modules: the layout was not followed`);
  });
}
