// world-nav-seat.test.mjs — WLD-47: on a phone the site's nav folds into one pill
// that is measured clear of the map's buttons (Darko, 2026-10-14 11:44 EDT: "B,
// the fold"; the fix measures the control row, so a seventh button can't bring
// the bug back).
//
// The bug these pin: WorldSignIn parked its five links at a fixed top:50px, which
// lay over all six of the map's circles on a 390 px screen once the search pill
// wrapped them onto a second line (2026-09-13). seatFold is the rule that
// replaced the fixed number; the breakpoint test holds the site's 720 to the
// viewer's own, read from the pinned package.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { seatFold, PHONE_MAX, PHONE_QUERY, EDGE } from "../src/lib/world-nav-seat.mjs";

const rect = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height });
const hits = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
const seatRect = (at, pill) => rect(at.left, at.top, pill.width, pill.height);

// prod at 390×844, measured 2026-10-14 (docs/2026-10-13/rail/WLD-47/gap-shots/probe.json):
// the glyph top-left, the search pill top-right, the six circles wrapped under it
const GLYPH = rect(13, 13, 26, 26);
const SEARCH_390 = rect(148, 10, 232, 34);
const ROW_390 = rect(144, 51, 236, 34);
const PILL = { width: 97, height: 34 }; // the built pill, measured 2026-10-14
const SEARCH_360 = rect(118, 10, 232, 34);
const ROW_360 = rect(114, 50, 236, 35);

test("on a 390 px phone the pill sits beside the wrapped circles, clear of every one", () => {
  const at = seatFold({ pill: PILL, obstacles: [GLYPH, SEARCH_390, ROW_390], rowTop: ROW_390.top });
  assert.deepEqual(at, { left: EDGE, top: 51 });
  for (const o of [GLYPH, SEARCH_390, ROW_390]) assert.ok(!hits(seatRect(at, PILL), o), "the pill overlaps the viewer's chrome");
});

test("on a 360 px phone it still fits beside the row (the patch is 100 px; the pill is 97)", () => {
  const at = seatFold({ pill: PILL, obstacles: [GLYPH, SEARCH_360, ROW_360], rowTop: ROW_360.top });
  assert.deepEqual(at, { left: EDGE, top: 50 });
});

test("the old fixed seat is exactly the bug: top:50px with the links spread to the right edge lies over the circles", () => {
  // the pre-WLD-47 floating cluster: left 10, right 10, from top 50, two lines of links
  const old = rect(10, 50, 370, 58);
  assert.ok(hits(old, ROW_390), "the falsifier must reproduce the measured overlap");
});

test("a seventh circle that reaches the pill's patch moves the pill under the row, never onto it", () => {
  const wide = rect(100, 51, 280, 34); // the row grew left into the patch
  const at = seatFold({ pill: PILL, obstacles: [GLYPH, SEARCH_390, wide], rowTop: wide.top });
  assert.ok(at.top >= wide.bottom, `seated at ${at.top}, inside the row that ends at ${wide.bottom}`);
  for (const o of [GLYPH, SEARCH_390, wide]) assert.ok(!hits(seatRect(at, PILL), o));
});

test("a row that does not wrap leaves the glyph in the patch, so the pill goes under both", () => {
  const search = rect(250, 10, 232, 34), row = rect(488, 10, 222, 34); // a 720 px screen: one line
  const at = seatFold({ pill: PILL, obstacles: [GLYPH, search, row], rowTop: row.top });
  for (const o of [GLYPH, search, row]) assert.ok(!hits(seatRect(at, PILL), o));
  assert.ok(at.top < 60, "and no lower than it has to be");
});

test("chrome the page is not showing (no area) is not in the way", () => {
  const at = seatFold({ pill: PILL, obstacles: [null, rect(0, 0, 0, 0), ROW_390], rowTop: ROW_390.top });
  assert.deepEqual(at, { left: EDGE, top: 51 });
});

test("whatever the viewer draws, the seat it returns overlaps none of it", () => {
  let seed = 47;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 2000; i++) {
    const obstacles = Array.from({ length: 1 + Math.floor(rnd() * 4) }, () =>
      rect(Math.floor(rnd() * 380), Math.floor(rnd() * 120), 10 + Math.floor(rnd() * 240), 10 + Math.floor(rnd() * 40)));
    const rowTop = rnd() < 0.8 ? obstacles[obstacles.length - 1].top : null;
    const pill = { width: 60 + Math.floor(rnd() * 80), height: 34 };
    const at = seatFold({ pill, obstacles, rowTop });
    for (const o of obstacles) assert.ok(!hits(seatRect(at, pill), o), `case ${i}: ${JSON.stringify({ at, o, pill })}`);
  }
});

// ── the breakpoint: one number, the viewer's ─────────────────────────────────
const viewer = readFileSync(new URL("../node_modules/postmark-world/spectator/viewer.mjs", import.meta.url), "utf8");
const signIn = readFileSync(new URL("../src/components/WorldSignIn.astro", import.meta.url), "utf8");
const worldPage = readFileSync(new URL("../town/pages/world.astro", import.meta.url), "utf8");

test("the site folds at the width where the pinned viewer hides its rail", () => {
  // the viewer's phone block is the one that takes .wv-nav away
  const at = viewer.indexOf(".wv-nav, .wv-view { display:none; }");
  assert.ok(at > 0, "the viewer's rail-hiding rule was not found; it moved, so re-read where the rail goes");
  const opens = [...viewer.slice(0, at).matchAll(/@media \(max-width:(\d+)px\)\{/g)];
  const m = opens[opens.length - 1];
  assert.equal(Number(m[1]), PHONE_MAX);
  assert.equal(PHONE_QUERY, `(max-width: ${PHONE_MAX}px)`);
  const css = (src) => [...src.matchAll(/@media \(max-width: (\d+)px\)/g)].map((x) => Number(x[1]));
  assert.ok(css(signIn).length >= 1);
  for (const n of css(signIn)) assert.equal(n, PHONE_MAX, "WorldSignIn breaks at a second number");
  assert.ok(css(worldPage).includes(PHONE_MAX), "the open-list rule breaks at the viewer's width");
});

test("the phone seat is measured, not parked: the island seats the pill with seatFold off the viewer's row", () => {
  assert.match(signIn, /import \{ PHONE_QUERY, seatFold \} from "@\/lib\/world-nav-seat\.mjs";/);
  assert.match(signIn, /seatFold\(\{ pill, obstacles: \[box\("\.wv-worldmark"\), box\("\.wv-search"\), row\], rowTop: row\.top \}\)/);
  // the stretched box is gone: right:auto, so no empty cluster box lies over the circles
  assert.match(signIn, /\.wa:not\(\.wa-slotted\) \{\s*top: 50px; left: 10px; right: auto;/);
  assert.doesNotMatch(signIn, /top: 50px; left: 10px; right: 10px;/);
});

test("the links fold behind one ☰ Postmark pill, sign in last", () => {
  const list = signIn.slice(signIn.indexOf('<div class="wa-list"'), signIn.indexOf("<script>"));
  const order = ["wa-back", "/replay/", "/conversations/", "/atlas/", "data-wa-signin", "data-wa-signout"].map((s) => list.indexOf(s));
  assert.ok(order.every((i) => i > 0), "every link is inside the fold's list");
  assert.deepEqual([...order].sort((a, b) => a - b), order, "the order is ← Postmark, the lenses, then sign in");
  assert.match(signIn, /data-wa-menu aria-expanded="false"\s+aria-controls="pm-world-auth-list"[^>]*>☰ Postmark<\/button>/);
  // off a phone the fold is invisible: no pill, and the list is no box at all
  assert.match(signIn, /\.wa-menu \{ display: none; \}\s*\n\s*\.wa-list \{ display: contents; \}/);
});

test("time travel hangs under the pill and the row, and moves when the cluster does", () => {
  assert.match(worldPage, /\["#pm-world-auth \[data-wa-menu\]", "\.wv-mapctl"\]\.forEach/);
  assert.match(worldPage, /window\.addEventListener\("pm-world-auth:placed", place\);/);
  assert.match(signIn, /window\.dispatchEvent\(new Event\("pm-world-auth:placed"\)\);/);
});

test("while the map shows a list, the site's floating chrome steps aside (phone only)", () => {
  const rule = /@media \(max-width: 720px\) \{\s*body:has\(\.wv-search-results:not\(\[hidden\]\), \.wv-bell-menu:not\(\[hidden\]\)\) #pm-world-auth:not\(\.wa-slotted\),\s*body:has\(\.wv-search-results:not\(\[hidden\]\), \.wv-bell-menu:not\(\[hidden\]\)\) \.pm-tt \{\s*visibility: hidden;/;
  assert.match(worldPage, rule);
});
