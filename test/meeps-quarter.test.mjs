// meeps-quarter.test.mjs — the Meeps quarter: five meeps with rooms, never a
// sixth; their latest in their own words, as text; the meeplings' bench from
// the box's roll-call.
//
//   node --test test/meeps-quarter.test.mjs
//
// The brief's falsifier for this part (the site, reprojected — part 3): "the
// Meeps page shows exactly five meep cards and the meeplings' row from the
// manifest".

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  MEEPS, meepLinks, ownWords, latestLetterFrom, dailyWindow, settlementWindow,
  bench, heartbeatFor, textOf, clip, allowancePhrase, HEARTBEAT_PROBES, SENTINEL_UNIT,
} from "../src/lib/meeps-quarter.mjs";
import { SPRITES, paint, checkAllSprites } from "../src/lib/civic-art.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = (f) => JSON.parse(readFileSync(join(ROOT, "src", "data", "postmark", f), "utf8"));
const DIST = join(ROOT, "dist-town");

// ── WHO ─────────────────────────────────────────────────────────────────────

test("five meeps, the five with rooms, in the quarter's order — never a sixth", () => {
  assert.deepEqual(MEEPS.map((m) => m.key), ["postmaster", "illuminator", "registrar", "worldkeeper", "architect"]);
  assert.equal(new Set(MEEPS.map((m) => m.handle)).size, 5);
  // The notary is machinery, not a meep (Keemin: "the notary is a meep now?").
  assert.equal(MEEPS.some((m) => /notary/i.test(`${m.key} ${m.name} ${m.plaque}`)), false);
  // Every meep the site's own meeps extract names is one of the five: a room
  // the extract knows and the quarter does not would be a meep left outside.
  for (const m of DATA("meeps.json")) {
    assert.ok(MEEPS.some((x) => x.handle === m.name), `meeps.json names ${m.name}, who has no building`);
  }
});

test("every building is drawn, well-formed, and the five read apart", () => {
  assert.deepEqual(checkAllSprites(), {});
  for (const m of MEEPS) assert.ok(SPRITES[m.key], `no building for ${m.key}`);
  const palettes = MEEPS.map((m) => [...new Set(paint(m.key).map((r) => r.fill))].sort().join(","));
  assert.equal(new Set(palettes).size, MEEPS.length, "two meeps' buildings share a palette");
});

test("each card names its door as a read or a GET, spelled the office's way", () => {
  for (const m of MEEPS) {
    assert.ok(m.door.mcp || m.door.get, `${m.key} has no door`);
    if (m.door.get) assert.match(m.door.get, /^\/api\//);
  }
  assert.equal(MEEPS.find((m) => m.key === "worldkeeper").door.get, "/api/world/settlements");
});

test("links: the resident page always; the round and the room in the town repo", () => {
  const ferry = meepLinks(MEEPS[0]);
  assert.deepEqual(ferry.map((l) => l.href), [
    "/residents/postmaster/",
    "https://github.com/postmark-town/postmark/blob/main/MEEPS/SKILLS/postmaster-round.md",
    "https://github.com/postmark-town/postmark/tree/main/MEEPS/postmaster",
  ]);
  const reg = meepLinks(MEEPS.find((m) => m.key === "registrar"));
  assert.equal(reg.length, 2, "a meep with no round on file links none");
});

// ── TEXT, NEVER MARKUP (the reading law) ─────────────────────────────────────

test("textOf strips every tag and decodes entities; nothing a meep wrote can become markup", () => {
  assert.equal(textOf(`<b>Ten</b> &amp; <script>alert(1)</script>thousand&nbsp;&#8212;&#x2014;`), "Ten & alert(1)thousand ——");
  assert.equal(/[<>]/.test(textOf("<img src=x onerror=alert(1)>hello")), false);
});

test("clip cuts at a word and says so", () => {
  assert.equal(clip("short", 20), "short");
  const c = clip("one two three four five six seven", 15);
  assert.ok(c.endsWith("…") && c.length <= 16, c);
});

test("ownWords: the first paragraph that says something, as one plain line", () => {
  const r = { address: { body: "# The Worldkeeper\n\nThe office of the crossings. Twice a day — **6:00 and 18:00 UTC** — the [World](x)'s record is folded.\n\nMore." } };
  assert.equal(ownWords(r), "The office of the crossings. Twice a day — 6:00 and 18:00 UTC — the World's record is folded.");
  assert.equal(ownWords(null), null);
  assert.equal(ownWords({ address: { body: "" } }), null);
});

test("latestLetterFrom: the newest letter SENT, its opening past the salutation, never someone else's", () => {
  const letters = [
    { id: "a", from: "registrar", to: "wright", date: "2026-09-20", body: "Wright —\n\nThe roll is **ninety** today." },
    { id: "b", from: "registrar", to: "rei", date: "2026-09-22", body: "Rei —\n\nYour [fold](x) landed." },
    { id: "c", from: "rei", to: "registrar", date: "2026-09-24", body: "Newer, but not the registrar's." },
    { id: "d", from: "registrar", toList: ["a", "b", "c"], to: "a", date: "2026-09-22", body: "Everyone —\n\nA notice." },
  ];
  const l = latestLetterFrom(letters, "registrar");
  assert.equal(l.id, "d", "a same-day tie resolves by id, the same on every build");
  assert.equal(l.to, "3 residents");
  assert.equal(l.excerpt, "A notice.");
  assert.equal(latestLetterFrom(letters, "nobody"), null);
  assert.equal(latestLetterFrom(letters.slice(0, 2), "registrar").excerpt, "Your fold landed.");
});

// ── FERRY'S WINDOW ───────────────────────────────────────────────────────────

test("dailyWindow: the first <h2> is the headline, the first paragraph after it is the window", () => {
  const html = `<h1>The office — Ferry's Daily</h1><p><em>A curated look</em></p>
    <h2>Crossing 211 -- 54 letters over</h2><p></p><p>The town crossed <strong>10,000</strong> letters &amp; kept going.</p><h2>Ten thousand</h2>`;
  assert.deepEqual(dailyWindow(html), { headline: "Crossing 211 -- 54 letters over", paragraph: "The town crossed 10,000 letters & kept going." });
  assert.equal(dailyWindow("<p>no headline</p>"), null);
  assert.equal(dailyWindow(null), null);
});

test("dailyWindow reads the Daily this site carries", () => {
  const html = readFileSync(join(ROOT, "public", "atelier", "postmark", "daily", "ferrys-daily.html"), "utf8");
  const w = dailyWindow(html);
  assert.ok(w?.headline, "the carried Daily yields no headline");
  assert.ok(w.paragraph.length > 0);
});

// ── THE WORLDKEEPER'S LINE ───────────────────────────────────────────────────

test("settlementWindow: last blessed from `current`, next = last + the cadence the record shows", () => {
  const body = {
    current: { n: 81, sha: "6408352b2", date: "2026-09-25T06:00:24+00:00" },
    recent: [
      { n: 81, date: "2026-09-25T06:00:24+00:00" },
      { n: 80, date: "2026-09-24T18:00:31+00:00" },
    ],
  };
  assert.deepEqual(settlementWindow(body), { n: 81, blessedAt: "2026-09-25T06:00:24.000Z", next: "2026-09-25T18:00:00.000Z" });
  // no previous settlement to read a cadence from: no "next", never a guess
  assert.equal(settlementWindow({ current: body.current, recent: [body.recent[0]] }).next, null);
  // a gap that is an outage, not a cadence
  assert.equal(settlementWindow({ current: body.current, recent: [body.recent[0], { n: 80, date: "2026-09-20T06:00:00Z" }] }).next, null);
  assert.equal(settlementWindow({}), null);
  assert.equal(settlementWindow(null), null);
});

// ── THE MEEPLINGS' BENCH ─────────────────────────────────────────────────────

test("the bench is the roll-call: every unit, in the manifest's order, parked ones marked", () => {
  const rc = DATA("rollcall.json");
  assert.match(rc.tag, /^release\//, "the snapshot names the release it was read at");
  const rows = bench(rc);
  assert.equal(rows.length, rc.units.length);
  assert.deepEqual(rows.map((r) => r.unit), rc.units.map((u) => u.unit));
  assert.deepEqual(rows.filter((r) => r.parked).map((r) => r.unit), rc.units.filter((u) => u.stage === "parked").map((u) => u.unit));
  assert.deepEqual(bench(null), []);
});

test("allowancePhrase: the manifest's stale-after, in a reader's units", () => {
  assert.equal(allowancePhrase(45), "45 min");
  assert.equal(allowancePhrase(780), "13 h");
  assert.equal(allowancePhrase(100), "100 min");
  assert.equal(allowancePhrase(null), null);
});

test("a live beat only where the sentinel watches the unit by name", () => {
  const board = {
    generated_at: "2026-09-25T16:20:00Z",
    probes: [
      { key: "usdc_watch", verdict: "OK", reason: "ticked 0 min ago" },
      { key: "office_api", verdict: "DOWN", reason: "did not answer at all" },
    ],
  };
  const now = Date.parse("2026-09-25T16:25:00Z");
  const row = (unit) => bench({ units: [{ unit, label: unit }] })[0];
  assert.deepEqual(heartbeatFor(row("postmark-usdc-watch.timer"), board, now), { verdict: "OK", text: "ticked 0 min ago" });
  assert.deepEqual(heartbeatFor(row("postmark-office.service"), board, now), { verdict: "DOWN", text: "did not answer at all" });
  assert.deepEqual(heartbeatFor(row(SENTINEL_UNIT), board, now), { verdict: "OK", text: "ticked 5 min ago" });
  assert.equal(heartbeatFor(row("postmark-ferry.timer"), board, now), null, "an unwatched unit got a beat");
  assert.equal(heartbeatFor(row("postmark-stripe-watch.timer"), board, now), null, "a probe missing from the board is no beat");
  for (const unit of Object.keys(HEARTBEAT_PROBES)) {
    assert.ok(DATA("rollcall.json").units.some((u) => u.unit === unit), `the probe map names ${unit}, which the roll-call does not`);
  }
});

// ── THE BUILT PAGE (skipped until it is built, as POS-177 rules) ────────────

const builtMeeps = join(DIST, "meeps", "index.html");

test("the built Meeps page: exactly five buildings, five cards, and the bench from the manifest",
  { skip: !existsSync(builtMeeps) }, () => {
  const page = readFileSync(builtMeeps, "utf8");
  // Read off the ELEMENTS — the page's own switching CSS names every key too.
  const buildings = [...page.matchAll(/<a\b[^>]*\bdata-meep="([^"]+)"/g)].map((m) => m[1]);
  const panels = [...page.matchAll(/<section\b[^>]*\bdata-panel="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(buildings, MEEPS.map((m) => m.key));
  assert.deepEqual(panels, MEEPS.map((m) => m.key));
  const units = [...page.matchAll(/<li\b[^>]*\bdata-unit="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(units, DATA("rollcall.json").units.map((u) => u.unit));
  assert.ok(page.includes(DATA("rollcall.json").tag), "the bench does not say which release it was read at");
});

test("the built Post Office card carries the Daily as its window, and the Daily page still stands",
  { skip: !existsSync(builtMeeps) }, () => {
  const page = readFileSync(builtMeeps, "utf8");
  const ferry = page.slice(page.indexOf('<section class="mq-panel" id="postmaster"'), page.indexOf('<section class="mq-panel" id="illuminator"'));
  assert.ok(ferry.length > 0, "Ferry's panel was not found in the built page");
  assert.match(ferry, /data-daily-window/);
  assert.match(ferry, /href="\/daily\/"[^>]*>read the whole Daily →/);
  const w = dailyWindow(readFileSync(join(ROOT, "public", "atelier", "postmark", "daily", "ferrys-daily.html"), "utf8"));
  // Astro's own text escaping: & < > " and the apostrophe as &#39;
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  assert.ok(ferry.includes(esc(w.headline)), "the Daily's headline is not in Ferry's card");
  assert.ok(existsSync(join(DIST, "daily", "index.html")), "/daily/ stopped building");
});

test("the built page prints what the meeps wrote as text — no markup rides in from a letter",
  { skip: !existsSync(builtMeeps) }, () => {
  const page = readFileSync(builtMeeps, "utf8");
  const panels = page.slice(page.indexOf('class="mq-panels"'), page.indexOf('class="bench"'));
  // The panels' own markup is a fixed vocabulary; anything else arrived from content.
  const tags = new Set([...panels.matchAll(/<([a-z][a-z0-9-]*)\b/gi)].map((m) => m[1].toLowerCase()));
  const allowed = new Set(["div", "section", "article", "svg", "rect", "h2", "p", "span", "a", "b", "code"]);
  assert.deepEqual([...tags].filter((t) => !allowed.has(t)), [], "a tag the page does not write is inside the cards");
});
