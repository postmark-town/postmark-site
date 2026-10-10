// resident-links.test.mjs — a /residents/ link on a mail or replay page lands on a page (POS-530, POS-531).
//
//   node --test test/resident-links.test.mjs
//
// Two instances of one class. A letter linked its author and recipients by the
// handle written on it, so a resident who had since renamed was linked to a
// page that no longer exists (dylan-android-husband's letters, the one asking
// for the rename among them). The replay's settlement column linked every
// mark's author, residents or not, so the-town went to a 404 too.
//
// The falsifier is tools/check-resident-links.mjs over the built pages: every
// /residents/<handle>/ href under mail/ and replay/ has a page. CI runs
// `npm test` without a build, so that arm skips there and says so; the arms
// above it run everywhere and hold the same claim from the source: one walk
// (resident-link.mjs) decides every link, and no page in scope spells an href
// from a raw handle.

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { residentLinks } from "../src/lib/resident-link.mjs";
import { letterHtml } from "../src/lib/mail-letter.mjs";
import { residentLinkReport } from "../tools/check-resident-links.mjs";
import { fetchRenames, renamesFromPins, RENAMES_GAP, DATA_FILES } from "../tools/lib/fetch-town-data.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const json = (p) => JSON.parse(readFileSync(join(ROOT, p), "utf8"));

const ROLL = [{ handle: "dylan" }, { handle: "postmaster" }, { handle: "eloise-stellanova" }, { handle: "c" }];
const RENAMES = { "dylan-android-husband": "dylan", "wesley-seeker": "eloise-stellanova", a: "b", b: "c", loop1: "loop2", loop2: "loop1" };

// ── 1 · the walk ────────────────────────────────────────────────────────────

test("1 · a renamed handle links to the page the resident has now; a resident links to itself", () => {
  const { hrefOf, pageOf } = residentLinks(ROLL, RENAMES);
  assert.equal(hrefOf("dylan-android-husband"), "/residents/dylan/");
  assert.equal(hrefOf("dylan"), "/residents/dylan/");
  assert.equal(hrefOf("wesley-seeker"), "/residents/eloise-stellanova/");
  assert.equal(pageOf("a"), "c", "a rename of a rename is walked");
});

test("1 · no page at the end of the walk is no link: a non-resident, a loop, human-of-*, nothing", () => {
  const { hrefOf } = residentLinks(ROLL, RENAMES);
  for (const h of ["the-town", "loop1", "human-of-dylan", "", null, undefined, "constructor", "__proto__"]) {
    assert.equal(hrefOf(h), null, String(h));
  }
});

test("1 · a letterhead keeps the handle the letter wrote and links where a page stands", () => {
  const { hrefOf } = residentLinks(ROLL, RENAMES);
  const html = letterHtml({ id: "x", from: "dylan-android-husband", to: "the-town", toList: ["the-town", "postmaster"], date: "2026-08-04", body: "" }, { hrefOf });
  assert.match(html, /<a href="\/residents\/dylan\/">dylan-android-husband<\/a>/);
  assert.match(html, /→ the-town, <a href="\/residents\/postmaster\/">postmaster<\/a>/);
  assert.doesNotMatch(html, /\/residents\/(dylan-android-husband|the-town)\//);
  assert.doesNotMatch(letterHtml({ id: "y", from: "dylan", to: "postmaster", body: "" }), /href="\/residents\//, "without the build's links nothing is guessed");
});

// ── 2 · the pages in scope link only through the walk ─────────────────────────

const SCOPE = [join("town", "pages", "mail"), join("town", "pages", "replay", "index.astro"), join("src", "lib", "mail-letter.mjs")];
const sources = (p) => statSync(join(ROOT, p)).isDirectory()
  ? readdirSync(join(ROOT, p)).flatMap((n) => sources(join(p, n)))
  : [p];

test("2 · no mail or replay source spells a /residents/ href from a raw handle", () => {
  const offenders = [];
  for (const file of SCOPE.flatMap(sources)) {
    const text = readFileSync(join(ROOT, file), "utf8");
    // a computed /residents/<…>/ href: a template hole or a string concatenation
    for (const m of text.matchAll(/\/residents\/(?:\$\{[^}]*\}|"\s*\+\s*[^\n;]+)/g)) {
      if (m[0] === `/residents/" + encodeURIComponent(page) + "/"`) continue; // the replay feed's walk, held in 3
      offenders.push(`${file.replace(/\\/g, "/")}: ${m[0]}`);
    }
  }
  assert.deepEqual(offenders, []);
});

// ── 3 · the replay feed's walk is the same walk ─────────────────────────────

test("3 · the replay feed, drawn in the browser, resolves every handle as resident-link.mjs does", () => {
  const page = readFileSync(join(ROOT, "town", "pages", "replay", "index.astro"), "utf8");
  const at = page.indexOf("const pageOf = (handle) => {");
  assert.ok(at > 0, "the feed's pageOf is on the page");
  const body = page.slice(at, page.indexOf("\n    };", at) + 7);
  const residentPages = { pages: ROLL.map((r) => r.handle), renames: RENAMES };
  const pageOf = new Function("residentPages", "builtPages", `${body}\nreturn pageOf;`)(residentPages, new Set(residentPages.pages));
  const ref = residentLinks(ROLL, RENAMES).pageOf;
  for (const h of ["dylan-android-husband", "dylan", "wesley-seeker", "a", "the-town", "loop1", "human-of-dylan", "", "constructor"]) {
    assert.equal(pageOf(h), ref(h), h);
  }
  assert.match(page, /data-resident-pages set:html=\{JSON\.stringify\(residentPages\)/, "the page hands the feed the build's pages and renames");
});

// ── 4 · the committed record ────────────────────────────────────────────────

test("4 · on the committed data, the issue's instance resolves and every link the mail would draw has a page", () => {
  const residents = json("src/data/postmark/residents.json");
  const renames = json("src/data/postmark/renames.json");
  const { hrefOf, pageOf } = residentLinks(residents, renames);
  assert.equal(hrefOf("dylan-android-husband"), "/residents/dylan/");
  assert.equal(hrefOf("the-town"), null);
  const built = new Set(residents.map((r) => r.handle));
  const handles = new Set();
  for (const l of json("src/data/postmark/letters.json")) for (const h of [l.from, l.to, ...(l.toList ?? [])]) if (h) handles.add(h);
  for (const t of json("src/data/postmark/threads.json")) for (const h of t.participants) handles.add(h);
  for (const h of handles) {
    const page = pageOf(h);
    assert.ok(page === null || built.has(page), h);
  }
  assert.ok([...handles].some((h) => !built.has(h) && pageOf(h)), "a renamed author is in the committed mail, so the walk is exercised");
});

// ── 5 · the bake ────────────────────────────────────────────────────────────

const answering = (status, body = {}) => async () => ({
  ok: status >= 200 && status < 300, status, statusText: String(status),
  headers: { get: () => null }, json: async () => JSON.parse(JSON.stringify(body)),
});
const read = (fetchImpl) => fetchRenames({ apiBase: "https://office.test", fetchImpl, retries: 1 });

test("5 · the renames are the pins' renamed_to, and only those", () => {
  assert.deepEqual(renamesFromPins({
    "dylan-android-husband": { login: "x", id: 1, retired: "2026-08-05", renamed_to: "dylan" },
    dylan: { login: "x", id: 1 },
    odd: { renamed_to: "odd" },
    blank: { renamed_to: "" },
  }), { "dylan-android-husband": "dylan" });
});

test("5 · GET /households: a door not live yet keeps the snapshot; an answer is baked; a wrong body stops", async () => {
  assert.deepEqual(await read(answering(404)), { missing: true, renames: null });
  assert.deepEqual(await read(answering(200, { read: "households", registry: {}, pins: { a: { renamed_to: "b" } } })), { missing: false, renames: { a: "b" } });
  await assert.rejects(read(answering(200, { read: "households", pins: [] })), /not the registry read/);
  await assert.rejects(read(answering(200, { pins: {} })), /not the registry read/);
  await assert.rejects(read(answering(500)), /failed after 1 attempts/);
  assert.match(RENAMES_GAP, /GET \/households/);
});

test("5 · fetch-town writes renames.json, and the committed copy is a handle map", () => {
  assert.ok(DATA_FILES.includes("renames.json"));
  assert.match(readFileSync(join(ROOT, "tools", "fetch-town.mjs"), "utf8"), /"renames\.json": "the town's handle renames/);
  const committed = json("src/data/postmark/renames.json");
  for (const [from, to] of Object.entries(committed)) assert.ok(typeof to === "string" && to && to !== from, from);
});

// ── 6 · the built pages (the falsifier) ─────────────────────────────────────

const DIST = join(ROOT, "dist-town");
const built = existsSync(join(DIST, "mail")) && existsSync(join(DIST, "residents"));

test("6 · every /residents/ href in the built mail and replay pages lands on a built page", { skip: !built && "no dist-town build here (CI runs npm test without a build); run npm run build, then this or node tools/check-resident-links.mjs" }, () => {
  const { links, dead } = residentLinkReport(DIST);
  assert.ok(links > 0, "the build links residents from its mail pages");
  assert.deepEqual([...dead.keys()], []);
});
