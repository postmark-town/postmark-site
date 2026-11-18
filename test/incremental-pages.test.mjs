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
