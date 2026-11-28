// conversations-ago.test.mjs — UI-42: a message on the Conversations page says how long ago it was said, not a UTC clock.
//
// LAW (Darko, 2026-11-26, UI-42): "I'd also prefer if we could return the "ago" time instead of Z time for conversations/", then, narrowing it: "For this, I
// specifically mean next to individual messages. I think the Z timestamps for each room or conversation is totally [fine]".
//
// The rule is in the page's own inline script (town/pages/conversations/index.astro, between AGO:BEGIN and AGO:END). An inline script cannot import, so the
// words are restated there; this suite reads THAT block out of the page, the way conversations-reading.test.mjs reads ROOM-SHAPE, runs it, and holds it to the
// site's own reader units (`agePhrase`, src/lib/page-freshness.mjs) word for word, so the page never grows a second way of saying an age. What the page DRAWS
// with it, in a real browser, is test/conversations-circles.test.mjs ("UI-42 ·", and the B test's row).
//
//   node --test test/conversations-ago.test.mjs
//
// FALSIFIERS: a message time that is still a clock ("20:01Z"); words that drift from agePhrase; a week-old message given an age in days instead of its date; a
// reader's clock running behind printing nothing; the minute tick rewording a time whose words did not change, or touching anything but a message's time.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { agePhrase } from "../src/lib/page-freshness.mjs";

// CORE156_PAGE (a file path) points a run at a COPY of the page: a flip is made on a copy, never in the tree (the page's other suites read the same variable)
const PAGE = process.env.CORE156_PAGE || new URL("../town/pages/conversations/index.astro", import.meta.url);
const page = readFileSync(PAGE, "utf8").replace(/\r\n/g, "\n");
const between = (a, b) => { const i = page.indexOf(a), j = page.indexOf(b); assert.ok(i > -1 && j > i, `the page still carries ${a} … ${b}`); return page.slice(i + a.length, j); };
const agoSrc = between("// AGO:BEGIN", "// AGO:END");
const { agoOf, refreshAgo, AGO_WEEK } = new Function(`${agoSrc}\nreturn { agoOf: agoOf, refreshAgo: refreshAgo, AGO_WEEK: AGO_WEEK };`)();

const NOW = Date.parse("2026-11-26T15:30:00.000Z");
const MIN = 60_000, HOUR = 60 * MIN, DAY = 24 * HOUR;
const iso = (ms) => new Date(ms).toISOString();
const CLOCK = /\d{2}:\d{2}Z/;

test("a message said under a week ago reads in the site's own reader units, word for word what agePhrase says, and never as a UTC clock", () => {
  // every edge agePhrase has (2 minutes, an hour, the rounding at 90 minutes, a day, the rounding at 36 hours), and the last minute before a week
  const grid = [0, 59_000, MIN, 2 * MIN - 1, 2 * MIN, 4 * MIN, 59 * MIN + 59_000, HOUR, 89 * MIN, 90 * MIN, 3 * HOUR, 23 * HOUR + 29 * MIN, 23 * HOUR + 31 * MIN,
    DAY, 35 * HOUR, 36 * HOUR, 2 * DAY, 6 * DAY + 12 * HOUR, 7 * DAY - MIN];
  for (const ms of grid) {
    const said = agoOf(iso(NOW - ms), NOW);
    assert.equal(said, agePhrase(ms), `${ms} ms ago: the page says what the site's reader units say`);
    assert.doesNotMatch(said, CLOCK, `${ms} ms ago: and it is NOT a clock`);
  }
  // the words a reader sees, named (Darko's "ago" time), each from the grid above
  assert.deepEqual([0, 4 * MIN, HOUR, 3 * HOUR, DAY, 2 * DAY].map((ms) => agoOf(iso(NOW - ms), NOW)),
    ["just now", "4 minutes ago", "an hour ago", "3 hours ago", "yesterday", "2 days ago"]);
  // CONTROL: the pure helper and the page's copy can tell these apart (a copy that answered one fixed string would fail the grid, not pass it)
  assert.equal(new Set(grid.map((ms) => agoOf(iso(NOW - ms), NOW))).size > 8, true, "the grid exercises many different words");
});

test("past a week a message shows the day it was said ('Nov 14'), with its year only when that is not this year", () => {
  assert.equal(agoOf(iso(NOW - AGO_WEEK + MIN), NOW), "7 days ago", "control: a minute short of a week is still an age");
  assert.equal(agoOf("2026-11-14T20:01:00.000Z", NOW), "Nov 14", "a message from the 14th, twelve days ago");
  assert.equal(agoOf(iso(NOW - AGO_WEEK), NOW), "Nov 19", "exactly a week ago is a date");
  assert.equal(agoOf("2025-12-30T23:59:00.000Z", NOW), "Dec 30, 2025", "last year's message says its year");
  assert.equal(agoOf("2026-01-02T00:00:00.000Z", Date.parse("2027-01-01T00:00:00.000Z")), "Jan 2, 2026", "and the year is the message's, read in UTC like its title");
  for (const at of ["2026-11-14T20:01:00.000Z", "2025-12-30T23:59:00.000Z"]) assert.doesNotMatch(agoOf(at, NOW), CLOCK);
});

test("no time served is no words, and a message the reader's clock puts a little in the future was said 'just now', never nothing", () => {
  for (const none of [undefined, null, "", "not a time", "2026-13-45"]) assert.equal(agoOf(none, NOW), "", `${JSON.stringify(none)}: nothing to say`);
  assert.equal(agoOf(iso(NOW + 90_000), NOW), "just now", "a reader's clock ninety seconds behind the office's");
  assert.equal(agePhrase(-90_000), null, "control: the helper itself has no words for a negative age, which is why the page clamps it");
});

// A fake root honouring what refreshAgo depends on: querySelectorAll over ONE selector (asserted, so the fake cannot answer a different question than the
// browser would), getAttribute, and textContent that counts its writes.
function fakeRoot(times) {
  const asked = [];
  const nodes = times.map(({ datetime, text }) => {
    const n = { writes: 0, _text: text, getAttribute: (k) => (k === "datetime" ? datetime : null) };
    Object.defineProperty(n, "textContent", { get() { return n._text; }, set(v) { n._text = v; n.writes += 1; } });
    return n;
  });
  return { asked, nodes, querySelectorAll(sel) { asked.push(sel); return nodes; } };
}

test("the minute tick rewords each message's time in place, only where the words changed, and touches nothing but a message's own <time>", () => {
  const root = fakeRoot([
    { datetime: iso(NOW - 4 * MIN), text: "3 minutes ago" },      // a minute has passed since it was drawn
    { datetime: iso(NOW - 3 * HOUR), text: "3 hours ago" },       // still true
    { datetime: "2026-11-14T20:01:00.000Z", text: "Nov 14" },     // still true
  ]);
  const before = root.nodes.slice();
  assert.equal(refreshAgo(root, NOW), 1, "one time changed its words");
  assert.deepEqual(root.asked, ["time[data-ago][datetime]"], "it asks only for a message's time (the room card's began/latest and a pin's notes are not <time data-ago>)");
  assert.deepEqual(root.nodes.map((n) => n.textContent), ["4 minutes ago", "3 hours ago", "Nov 14"]);
  assert.deepEqual(root.nodes.map((n) => n.writes), [1, 0, 0], "and it is NOT a rewrite of every time: an unchanged one is left alone (no needless announcement in the live region)");
  assert.equal(root.nodes.every((n, i) => n === before[i]), true, "the same elements: nothing was redrawn");
  // an hour on, the same nodes again
  assert.equal(refreshAgo(root, NOW + HOUR), 2);
  assert.deepEqual(root.nodes.map((n) => n.textContent), ["an hour ago", "4 hours ago", "Nov 14"]);
  assert.equal(refreshAgo(null, NOW), 0, "no box, nothing to do");
});

// ── the wiring, as LABELLED TEXT PINS (the weakest instrument): what the browser shows is test/conversations-circles.test.mjs ("UI-42 ·", the B row) ──
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'\\])\/\/[^\n]*/g, "$1");
const inline = code(between("<script is:inline>", "</script>"));

test("text pins: a message's time is drawn from agoOf and marked for the tick; the tick runs every minute over both lists; the room card keeps its UTC clock", () => {
  assert.ok(inline.length > 20000 && inline.length < between("<script is:inline>", "</script>").length, "control: the strip took comments and left code");
  assert.match(inline, /el\("time", "c-ago", agoOf\(iso, Date\.now\(\)\)\)/, "a message's time is its age when drawn");
  assert.match(inline, /when\.setAttribute\("datetime", iso\); when\.setAttribute\("data-ago", ""\); when\.setAttribute\("aria-live", "off"\); when\.title = dateTimeOf\(iso\);/,
    "the exact UTC time stays in datetime and the hover title, and the tick's rewording is quiet (aria-live off on the <time>; the drawn attribute is asserted in conversations-circles' UI-42 · AGO)");
  assert.equal(/\bclockOf\b/.test(inline), false, "the message clock is gone");
  assert.match(inline, /window\.setInterval\(agoTick, AGO_MINUTE\)/, "the tick runs every minute");
  assert.match(inline, /refreshAgo\(liveBox, Date\.now\(\)\); refreshAgo\(closedBox, Date\.now\(\)\);/, "over both lists");
  // Darko's narrowing: the room's own times are fine as they are
  assert.match(inline, /return d \? "latest " \+ d : "";/, "the card's latest keeps the UTC date and clock");
  assert.match(inline, /"began " \+ dateTimeOf\(t\.started\)/, "and its began");
  assert.match(inline, /el\("time", "c-pin-ann-at", String\(a\.at \|\| ""\)\.slice\(11, 16\) \+ "Z"\)/, "and a pin's notes keep their clock");
});
