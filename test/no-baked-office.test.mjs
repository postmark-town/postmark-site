// no-baked-office.test.mjs — no page's browser code asks a build-time office
// (2026-09-29).
//
//   node --test test/no-baked-office.test.mjs
//
// THE CLASS. A page that bakes https://postmark.town/api (or
// PUBLIC_POSTMARK_API, which defaults to it) into what the browser runs asks
// PROD's office from every deployment, dev included. It bit twice in a day:
// the fund page sent a dev sign-in's token to prod (#197), and the Meeps
// page's open-bugs board asked prod for /posts it did not have yet while dev's
// own office answered it. A browser read asks the page's own office:
// officeBase() (src/lib/auth.mjs), or a restatement of it where an inline
// script cannot import (every restatement is held to the one expression below).
//
// WHAT IS SCANNED: every .astro file under town/pages, town/components,
// src/components and src/layouts. In each, the frontmatter (between the
// opening `---` fences) and every <script> block.
//
// WHAT IS ALLOWED, AND WHY:
//   - A build-time fetch in the frontmatter: a line that awaits fetch() bakes
//     data into the page at build and ships no URL to the browser.
//   - Prose and markup outside scripts: the join page tells an agent the
//     public address in a <code> line; that is text a reader copies, not a
//     read the page makes.
//   - <script type="application/ld+json">: data, not code.
//   - PUBLISHED, below: the town's public address shown to a person or handed
//     to an agent as text to copy, never fetched by the page. Each is named
//     with its line, and must still carry it.
//
// THE DEBT IS PAID. Four pages and four component scripts read prod's office
// from the browser until 2026-09-29; every one now asks officeBase(). There is
// no debt list any more: a new one is simply red.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ROOTS = ["town/pages", "town/components", "src/components", "src/layouts"].map((d) => join(ROOT, d));

/** The town's public address, published as text to copy: never a read. */
export const PUBLISHED = new Map([
  // the Connect-your-agent box: the MCP connector's address, in a <pre> a human copies
  ["src/components/ConnectAgent.astro", 'export const MCP_URL = "https://postmark.town/api/mcp";'],
  // the signed-in keys card's hand-off prompt: text an agent is given, two lines of it
  ["src/components/household-dashboard/KeysCard.astro", '"The door is plain HTTP. The base is https://postmark.town/api,'],
  ["src/components/household-dashboard/KeysCard.astro#mcp", '"If your shape prefers tools to HTTP, the same office answers MCP at https://postmark.town/api/mcp'],
]);
const fileOf = (key) => key.split("#")[0];

function astroFiles(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) astroFiles(full, out);
    else if (name.endsWith(".astro")) out.push(full);
  }
  return out;
}

const BAKED = /PUBLIC_POSTMARK_API|https:\/\/postmark\.town\/api\b/;

/** Each baked office a file's browser code carries: `{ file, where, line }`. */
export function bakedOffices(file, src) {
  const out = [];
  const text = src.replace(/\r\n/g, "\n");
  const fm = /^---\n([\s\S]*?)\n---/.exec(text);
  if (fm) {
    for (const line of fm[1].split("\n")) {
      if (BAKED.test(line) && !/await\s+fetch\(/.test(line)) out.push({ file, where: "frontmatter", line: line.trim() });
    }
  }
  const body = fm ? text.slice(fm[0].length) : text;
  for (const m of body.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (/type=["']application\/ld\+json["']/.test(m[1])) continue;
    for (const line of m[2].split("\n")) if (BAKED.test(line)) out.push({ file, where: "script", line: line.trim() });
  }
  return out;
}

const files = ROOTS.flatMap((d) => astroFiles(d)).map((f) => [relative(ROOT, f).split("\\").join("/"), readFileSync(f, "utf8")]);
const found = files.flatMap(([file, src]) => bakedOffices(file, src));
const published = (b) => [...PUBLISHED].some(([key, line]) => fileOf(key) === b.file && b.line.includes(line));

test("no page or component bakes an office into its browser code", () => {
  const fresh = found.filter((b) => !published(b));
  assert.deepEqual(fresh.map((b) => `${b.file} (${b.where}): ${b.line}`), [],
    "a page asks a build-time office from the browser: read officeBase() + the path instead");
});

test("every published address is still where it is named, and is the only office its file names", () => {
  for (const [key, line] of PUBLISHED) {
    const file = fileOf(key);
    assert.ok(found.some((b) => b.file === file && b.line.includes(line)), `${key} no longer publishes its line: take it off PUBLISHED`);
  }
  for (const file of new Set([...PUBLISHED.keys()].map(fileOf))) {
    const hits = found.filter((b) => b.file === file);
    assert.ok(hits.every(published), `${file} names an office beyond its published address`);
  }
});

test("every inline restatement of officeBase() is the one expression (pm.office.base, else /api, trailing slash trimmed)", () => {
  const CANON = 'String(window.localStorage.getItem("pm.office.base") || "/api").replace(/\\/+$/, "")';
  const restated = files.flatMap(([file, src]) => src.split(/\r?\n/).filter((l) => l.includes('"pm.office.base"')).map((l) => [file, l.trim()]));
  assert.ok(restated.length >= 4, `only ${restated.length} restatements found: the scan is not reading what it names`);
  for (const [file, line] of restated) assert.ok(line.includes(CANON), `${file} restates officeBase() differently: ${line}`);
  // and the expression answers what officeBase() answers
  const run = (base) => new Function("window", `return ${CANON};`)({ localStorage: { getItem: (k) => (k === "pm.office.base" ? base : null) } });
  assert.equal(run(null), "/api");
  assert.equal(run("https://dev.postmark.town/api/"), "https://dev.postmark.town/api");
});

test("the scanner sees what it names: a frontmatter const, a bundled script, an inline script; and passes a build-time fetch and prose", () => {
  const page = [
    "---",
    'const API = import.meta.env.PUBLIC_POSTMARK_API ?? "https://postmark.town/api";',
    'const baked = await fetch("https://postmark.town/api/town").then((r) => r.json());',
    "---",
    "<p><code>POST https://postmark.town/api/household</code></p>",
    "<script>",
    '  fetch("https://postmark.town/api/votes");',
    "</script>",
    "<script is:inline>",
    '  var API = "https://postmark.town/api/x";',
    "</script>",
    '<script type="application/ld+json">{"url":"https://postmark.town/api"}</script>',
  ].join("\n");
  assert.deepEqual(bakedOffices("t.astro", page).map((b) => b.where), ["frontmatter", "script", "script"]);
});
