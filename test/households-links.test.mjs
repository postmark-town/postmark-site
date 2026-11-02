// households-links.test.mjs — no page links the bare /residents/ list; the directory is /households/.
//
//   node --test test/households-links.test.mjs
//
// POS-855 (Site UX campaign): the residents' directory moved to /households/
// (MOVED in src/lib/nav.mjs forwards "/residents/" there, through the "has
// moved" stop that town/pages/[...moved].astro builds). About ten links still
// pointed at the bare list, so a reader clicking them landed on the "moved"
// page first. Every such link now goes to /households/ directly.
//
// What this guards: source under town/ and src/ spelling the bare list as a
// link target. What it leaves alone, on purpose:
//   - /residents/<handle>/ (a resident's own page) and the prefix a script
//     builds one from ("/residents/" + handle), which is not the list;
//   - the office API paths ("/residents" with no trailing slash, "/api/residents");
//   - the one MOVED row, which must stay so old outside links keep working.
// It reads source files only: src/data (the generated town data) is never opened.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { MOVED } from "../src/lib/nav.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_EXT = /\.(astro|mjs|js|ts|html|md)$/;

// A string that IS the bare list's address: "/residents/", optionally with a
// fragment or query, closed by its quote, and not the start of a longer string
// being built ("/residents/" + handle). A host-qualified spelling counts too.
const BARE_LIST = /["'`](?:https?:\/\/postmark\.town)?\/residents\/(?:[#?][^"'`\s]*)?["'`](?!\s*\+)/g;
// The same address without its trailing slash, but only as a link target.
const BARE_LIST_NO_SLASH = /\bhref\s*[=:]\s*\{?\s*["'`]\/residents["'`]/g;

/** Every bare-list link target spelled in `text`, in order. */
export function bareListLinks(text) {
  return [...text.matchAll(BARE_LIST), ...text.matchAll(BARE_LIST_NO_SLASH)]
    .sort((a, b) => a.index - b.index)
    .map((m) => ({ spelled: m[0], line: text.slice(0, m.index).split("\n").length }));
}

// The one place the bare list may be named: the MOVED table's own row.
const MOVED_ROW = /^[ \t]*"\/residents\/":\s*"\/households\/",.*$/m;

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) {
      // src/data is the generated town data: not source, never opened.
      if (path === join(ROOT, "src", "data") || e.name === "node_modules") return [];
      return walk(path);
    }
    return SOURCE_EXT.test(e.name) ? [path] : [];
  });
}

const files = [...walk(join(ROOT, "town")), ...walk(join(ROOT, "src"))];
const NAV = join(ROOT, "src", "lib", "nav.mjs");

// ── the detector, on synthetic text ───────────────────────────────────────────

test("1 · the detector flags a bare-list link in each spelling the site uses", () => {
  for (const text of [
    '<a href="/residents/">the residents</a>',
    "<a class='pm-btn' href='/residents/'>Find</a>",
    'cta: { label: "Find them", href: "/residents/" },',
    '<a href="/residents/#window">x</a>',
    '<a href="/residents/?q=a">x</a>',
    '<a href="https://postmark.town/residents/">x</a>',
    "const to = `/residents/`;",
    '<a href="/residents">x</a>',
    'a.href = "/residents/";',
  ]) {
    assert.equal(bareListLinks(text).length, 1, `not flagged: ${text}`);
  }
});

test("2 · the detector leaves a resident's own page, the prefix, and the API alone", () => {
  for (const text of [
    '<a href="/residents/wick/">x</a>',
    '<a href="/residents/wick/#window">x</a>',
    'a.href = "/residents/" + encodeURIComponent(h) + "/";',
    'a.href = "/residents/"+h;',
    "location.href = `/residents/${handle}/`;",
    'fetch(OFFICE_BASE + "/residents", { headers: {} })',
    'door={{ mcp: \'town { read: "residents" }\', get: "/api/residents" }}',
    '<a href="/households/">the residents</a>',
    "// /residents/ forwards to /households/ (the rail's redirect)",
  ]) {
    assert.deepEqual(bareListLinks(text), [], `wrongly flagged: ${text}`);
  }
});

test("3 · the scan finds the sources it is meant to read", () => {
  const rel = new Set(files.map((f) => relative(ROOT, f).split(sep).join("/")));
  for (const must of [
    "town/components/Household.astro",
    "town/pages/atlas.astro",
    "town/pages/[...moved].astro",
    "src/lib/nav.mjs",
    "src/lib/tutorial-registry.mjs",
  ]) {
    assert.ok(rel.has(must), `${must} is not in the scan`);
  }
  assert.ok(![...rel].some((f) => f.startsWith("src/data/")), "the scan reached src/data");
});

// ── the sources ───────────────────────────────────────────────────────────────

test("4 · no page or script under town/ or src/ links the bare /residents/ list", () => {
  const offenders = [];
  for (const file of files) {
    let text = readFileSync(file, "utf8");
    if (file === NAV) text = text.replace(MOVED_ROW, "");
    for (const hit of bareListLinks(text)) {
      offenders.push(`${relative(ROOT, file).split(sep).join("/")}:${hit.line}  ${hit.spelled}`);
    }
  }
  assert.deepEqual(offenders, [], "link /households/ directly; /residents/ only forwards, through the moved stop");
});

test("5 · the MOVED row stays, so an old outside link to /residents/ still forwards", () => {
  assert.equal(MOVED["/residents/"], "/households/");
  assert.match(readFileSync(NAV, "utf8"), MOVED_ROW, "the MOVED row is spelled differently; update the exemption");
  const moved = readFileSync(join(ROOT, "town", "pages", "[...moved].astro"), "utf8");
  assert.match(moved, /Object\.entries\(MOVED\)/, "the forwarding page no longer builds a page per MOVED row");
});
