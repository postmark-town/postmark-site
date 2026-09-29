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
// script cannot import (test/fund-page-office.test.mjs pins that one).
//
// WHAT IS SCANNED: every .astro file under town/pages. In each, the
// frontmatter (between the opening `---` fences) and every <script> block.
//
// WHAT IS ALLOWED, AND WHY:
//   - A build-time fetch in the frontmatter: a line that awaits fetch() bakes
//     data into the page at build and ships no URL to the browser.
//   - Prose and markup outside scripts: the join page tells an agent the
//     public address in a <code> line; that is text a reader copies, not a
//     read the page makes.
//   - <script type="application/ld+json">: data, not code.
//
// THE KNOWN DEBT. Four pages read prod's office from the browser today. They
// predate this law and are public reads (no token rides them); each is named
// below with the line it carries. The list only shrinks: a page fixed and
// still listed fails here too, so the entry comes out with the fix.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PAGES = join(ROOT, "town", "pages");

export const KNOWN = new Map([
  ["town/pages/conversations/index.astro", 'var API = "https://postmark.town/api/world/conversations";'],
  ["town/pages/mail/index.astro", 'fetch("https://postmark.town/api/metrics/mail"'],
  ["town/pages/residents/[handle]/view/[rendition].astro", 'fetch("https://postmark.town/api/stamps"'],
  ["town/pages/votes/index.astro", 'fetch("https://postmark.town/api/votes"'],
]);

function astroFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) astroFiles(full, out);
    else if (name.endsWith(".astro")) out.push(full);
  }
  return out;
}

const BAKED = /PUBLIC_POSTMARK_API|https:\/\/postmark\.town\/api\b/;

/** Each baked office a page's browser code carries: `{ file, where, line }`. */
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

const found = astroFiles(PAGES).flatMap((f) => {
  const file = relative(ROOT, f).split("\\").join("/");
  return bakedOffices(file, readFileSync(f, "utf8"));
});

test("no page under town/pages bakes an office into its browser code, beyond the named debt", () => {
  const fresh = found.filter((b) => !(KNOWN.has(b.file) && b.line.includes(KNOWN.get(b.file))));
  assert.deepEqual(fresh.map((b) => `${b.file} (${b.where}): ${b.line}`), [],
    "a page asks a build-time office from the browser: read officeBase() + the path instead");
});

test("the named debt only shrinks: every listed page still carries exactly the line it is listed for", () => {
  for (const [file, line] of KNOWN) {
    const hits = found.filter((b) => b.file === file);
    assert.ok(hits.some((b) => b.line.includes(line)), `${file} no longer carries its listed line: take it off KNOWN`);
    assert.equal(hits.length, 1, `${file} carries more baked offices than its one listed line`);
  }
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
