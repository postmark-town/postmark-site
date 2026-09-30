// replay-scrub.test.mjs — the replay you can actually use (w41, Keemin
// 2026-09-30): scrub to any moment, the page never moves by itself, and the
// feed runs newest-on-top with a cap.
//
//   node --test test/replay-scrub.test.mjs
//
// The scrub is measured on the real record: crossing 213 is the 09-26 night
// (12:00Z to 00:00Z), the Snug Harbour's opening, from the pinned
// postmark-world package, with the world's own walk law.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  FEED_CAP, STEP_MS, timeline, feedRows, countAt, walkersAt, walkersKey,
  timeAtPointer, keyTime, paintFeed, holdFeedPlace, awayFromTop,
} from "../src/lib/replay-scrub.mjs";
import { buildFrame } from "../town/scripts/replay-record.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PKG = join(ROOT, "node_modules", "postmark-world");
const LAW = await import(pathToFileURL(join(PKG, "tools", "walk.mjs")).href);
const PAGE = readFileSync(join(ROOT, "town", "pages", "replay", "index.astro"), "utf8");
const LIB = readFileSync(join(ROOT, "src", "lib", "replay-scrub.mjs"), "utf8");

// ── 1. THE SCRUB: the map at any moment, computed, not played to ────────────

const F213 = buildFrame(PKG, 213);
const SNUG = { x: -358, y: 4972 };      // the Snug Mooring, as the record places its voices
const atSnug = (walkers) => walkers.filter((w) => Math.hypot(w.x - SNUG.x, w.y - SNUG.y) < 120).map((w) => w.handle).sort();
const T = (hhmm) => Date.parse(`2026-09-26T${hhmm}:00Z`);

test("the record's departures carry what the walk law needs (crossing, within, pace)", () => {
  assert.ok(F213, "crossing 213 is in the pinned record");
  const first = F213.moves.find((m) => !m.stopped);
  assert.ok(Number.isFinite(first.crossing), "a departure keeps the fractional crossing it was declared at");
  assert.ok("within" in first, "a departure keeps its target's extent (null for raw coordinates)");
  assert.equal(first.pace, 60, "a departure keeps its own stride");
  assert.equal(typeof F213.legs, "object", "the frame names the legs open at the snapshot");
});

test("walkersAt: the Snug fills as the night goes on, by the world's own law", () => {
  const open = atSnug(walkersAt(F213, T("12:00"), LAW));
  const early = atSnug(walkersAt(F213, T("21:30"), LAW));
  const later = atSnug(walkersAt(F213, T("22:13"), LAW));
  assert.deepEqual(open, atSnug(F213.walkers), "at the crossing's opening the map is the snapshot");
  assert.equal(open.length, 14);
  assert.equal(early.length, 32);
  assert.equal(later.length, 39);
  for (const h of early) assert.ok(later.includes(h), `${h} left the Snug between 21:30 and 22:13`);
  // named arrivals: Vireo and Draig reach the Snug between 21:30 and 22:13
  for (const h of ["vireo", "draig"]) assert.ok(!early.includes(h) && later.includes(h), h);
});

test("walkersAt is a function of the moment alone: a jump equals the same moment reached step by step", () => {
  const direct = walkersKey(walkersAt(F213, T("22:13"), LAW));
  for (let t = T("12:00"); t <= T("23:55"); t += STEP_MS) walkersAt(F213, t, LAW);
  assert.equal(walkersKey(walkersAt(F213, T("22:13"), LAW)), direct, "the same moment answers the same map, whatever came before");
  // and the whole crossing is one computation: under 50 ms for the busiest night
  const t0 = performance.now();
  walkersAt(F213, Date.parse(F213.to), LAW);
  assert.ok(performance.now() - t0 < 50);
});

test("the rail maps a pointer and a key to a moment of the crossing", () => {
  const from = T("12:00"), to = Date.parse("2026-09-27T00:00:00Z");
  const rect = { left: 100, width: 1200 };
  assert.equal(timeAtPointer(100, rect, from, to), from);
  assert.equal(timeAtPointer(1300, rect, from, to), to);
  assert.equal(timeAtPointer(-50, rect, from, to), from, "clamped at the left end");
  assert.equal(timeAtPointer(100 + 1200 * (10 / 12), rect, from, to), T("22:00"));
  assert.equal(keyTime("ArrowRight", T("22:00"), from, to), T("22:05"));
  assert.equal(keyTime("ArrowLeft", from, from, to), from);
  assert.equal(keyTime("Home", T("22:00"), from, to), null, "Home is the rail's key only when the rail has focus");
  assert.equal(keyTime("End", T("22:00"), from, to, { rail: true }), to);
  assert.equal(keyTime("PageUp", T("22:00"), from, to, { rail: true }), T("21:00"));
});

test("the page wires the rail to the clock and the lens to the moment", () => {
  assert.match(PAGE, /walkers: replay\.walkersNow \? replay\.walkersNow\(\) : frame\.walkers/,
    "the lens answers the viewer's walker read with the walkers at the clock");
  assert.match(PAGE, /lib\.walkersAt\(frame, at, LAW\)/, "the page computes the walkers at the moment on screen");
  assert.match(PAGE, /import \{ positionAt, fractionalCrossing \} from "\/world-engine\/tools\/walk\.mjs"/,
    "the law is the file the viewer imports");
  assert.match(PAGE, /railTrack\.addEventListener\("pointerdown"/, "the rail takes a pointer");
  assert.match(PAGE, /role="slider"/, "the rail is a slider to assistive tech");
});

// ── 2. THE PAGE NEVER MOVES BY ITSELF ───────────────────────────────────────

// The replay page's own scripts: everything between its <script> tags.
const scripts = [...PAGE.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join("\n");

test("no script on the replay scrolls the page", () => {
  for (const [what, re] of [
    ["scrollIntoView", /scrollIntoView\s*\(/],
    ["window.scrollTo / scroll", /\b(?:window\.)?scroll(?:To|By)?\s*\(/],
    ["scrollingElement", /scrollingElement/],
    ["a location.hash write", /location\.hash\s*=[^=]/],
    ["the document's scrollTop", /(?:documentElement|body)\.scrollTop\s*=/],
  ]) {
    assert.doesNotMatch(scripts, re, `the replay page's script calls ${what}`);
    assert.doesNotMatch(LIB, re, `replay-scrub.mjs calls ${what}`);
  }
});

test("the only scrollTop writes are the feed's own, and only to hold or return", () => {
  const writes = [...scripts.matchAll(/([\w.]+)\.scrollTop\s*=[^=]/g)].map((m) => m[1]);
  assert.deepEqual(writes, ["feedEl"], "the page writes one scrollTop: the chip's return to the feed's top");
  const libWrites = [...LIB.matchAll(/([\w.]+)\.scrollTop\s*=[^=]/g)].map((m) => m[1]);
  assert.deepEqual(libWrites, ["list"], "the lib writes one scrollTop: holdFeedPlace, keeping a row still");
  assert.match(scripts, /railTrack\.focus\(\{ preventScroll: true \}\)/, "focusing the rail never scrolls to it");
});

// ── WHAT THIS IS, ON ASK (Keemin 2026-09-30) ─────────────────────────────────

test("the explanation under the map waits behind a closed 'What is this?' control, words unchanged", () => {
  const m = /<details class="r-about"([^>]*)>\s*<summary class="r-about-btn">What is this\?<\/summary>\s*<p class="r-map-note">([\s\S]*?)<\/p>\s*<\/details>/.exec(PAGE);
  assert.ok(m, "the map note sits inside a <details> whose <summary> says 'What is this?'");
  assert.doesNotMatch(m[1], /\bopen\b/, "closed by default");
  assert.match(m[2], /<b>What is history here, exactly\.<\/b>/, "the same words, starting where they always did");
  assert.match(m[2], /positions between crossings are worked out from each\s+walk's recorded departure and pace/);
  assert.equal([...PAGE.matchAll(/class="r-map-note"/g)].length, 1, "one copy of the note, not a second one outside");
  assert.match(PAGE, /t\.closest\("button, summary"\)/, "space on the control opens it; the page's play key yields to it");
});

// ── 3. THE FEED: newest on top, capped, and never yanking ───────────────────

// A list element with just what paintFeed and holdFeedPlace touch. Rows are
// 20 px tall, so a row's offsetTop is its index times 20.
function fakeList() {
  const list = {
    children: [],
    scrollTop: 0,
    removeChild(n) { this.children.splice(this.children.indexOf(n), 1); n.parent = null; },
    insertBefore(n, ref) {
      const at = this.children.indexOf(n);
      if (at >= 0) this.children.splice(at, 1);
      const i = ref ? this.children.indexOf(ref) : -1;
      if (i < 0) this.children.push(n); else this.children.splice(i, 0, n);
      n.parent = this;
    },
  };
  return list;
}
function fakeRow() {
  return {
    dataset: {}, offsetHeight: 20, parent: null,
    get offsetTop() { return this.parent.children.indexOf(this) * 20; },
  };
}
const synthetic = (n) => ({
  from: "2026-09-26T12:00:00.000Z",
  voices: Array.from({ length: n }, (_, i) => ({ handle: `r${i % 40}`, said: `line ${i}`, at_ms: T("12:00") + i * 1000 })),
  moves: [],
});

test("the feed holds the newest rows on top, never more than the cap, reusing every row it drew", () => {
  const line = timeline(synthetic(1000));
  const list = fakeList();
  let built = 0;
  const build = () => { built += 1; return fakeRow(); };
  let max = 0;
  for (let k = 1; k <= 1000; k += 7) {
    const t = line[k - 1].at;
    const { rows, total } = feedRows(line, t);
    paintFeed(list, rows, build);
    max = Math.max(max, list.children.length);
    assert.equal(total, k);
    assert.equal(list.children[0].dataset.key, line[k - 1].key, "the newest moment is the top row");
    if (list.children.length > 1)
      assert.equal(list.children[1].dataset.key, line[k - 2].key, "and the one before it is under it");
  }
  assert.equal(max, FEED_CAP, "the DOM never held more than the cap");
  // 1000 moments played in steps of 7 drew each row once: no redraws of old rows
  assert.ok(built <= 1000, `drew ${built} rows for 1000 moments`);
});

test("a scrub back and forth lands the same rows, and a jump is one cut, not a replay", () => {
  const line = timeline(synthetic(900));
  const list = fakeList();
  const build = () => fakeRow();
  paintFeed(list, feedRows(line, line[899].at).rows, build);
  paintFeed(list, feedRows(line, line[99].at).rows, build);
  assert.equal(list.children.length, 100);
  assert.equal(list.children[0].dataset.key, line[99].key);
  assert.equal(countAt(line, line[99].at), 100);
});

test("scrolled away from the top, new rows arrive above without moving what the reader is reading", () => {
  const line = timeline(synthetic(300));
  const list = fakeList();
  const build = () => fakeRow();
  paintFeed(list, feedRows(line, line[99].at).rows, build);
  list.scrollTop = 400;                       // the reader is on the 21st row
  const reading = list.children[20].dataset.key;
  assert.ok(awayFromTop(list));
  const created = holdFeedPlace(list, () => paintFeed(list, feedRows(line, line[109].at).rows, build));
  assert.equal(created.length, 10, "ten new moments arrived");
  assert.equal(list.children[0].dataset.key, line[109].key, "they went in at the top");
  const row = list.children.find((n) => n.dataset.key === reading);
  assert.equal(row.offsetTop - list.scrollTop, 0, "the row being read did not move under the reader");
  assert.equal(list.scrollTop, 600, "held by exactly the ten rows that arrived above");

  list.scrollTop = 0;                         // at the top, new rows simply appear
  holdFeedPlace(list, () => paintFeed(list, feedRows(line, line[119].at).rows, build));
  assert.equal(list.scrollTop, 0, "a reader at the top stays at the top");
});

test("the page paints the feed through the lib, beside the map, with the 'N new' chip", () => {
  assert.match(PAGE, /lib\.holdFeedPlace\(feedEl, \(\) => lib\.paintFeed\(feedEl, rows, buildRow\)\)/);
  assert.match(PAGE, /lib\.feedRows\(line, at, lib\.FEED_CAP\)/);
  assert.match(PAGE, /data-feed-new/);
  assert.match(PAGE, /class="r-feed-list"[^>]*data-feed/);
  assert.doesNotMatch(PAGE, /data-voices|data-moves/, "the long said/moved columns are gone");
});
