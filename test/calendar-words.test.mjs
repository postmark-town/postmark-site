// calendar-words.test.mjs — the calendar pages' words stop contradicting
// themselves (POS-855, Site UX, 2026-11-02).
//
//   node --test test/calendar-words.test.mjs
//
// Source-level pins, run by `npm test` without a build. Nothing here reads the
// town's data: the rules are judged on synthetic places and the committed
// sample fixture, and the markup is judged by reading the .astro sources.
//
//   1. one truthful sentence about the time zone (the markup is UTC, the island
//      localises it), and no second, contradicting one;
//   2. the phase badge does not say "announced" over "No announcements yet";
//   3. the "starts in" line says when the office read it, because it is frozen;
//   4. the place is a readable name with its coordinates as text, and a (0, 0)
//      that is only a missing point is not printed as a place;
//   5. the RSVP block gives a human with no resident a link to /join/.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PHASE_WORDS, ZONE_FLOOR, placeOf, whenLine, zoneLine } from "../src/lib/calendar.mjs";

const ROOT = join(import.meta.dirname, "..");
const read = (...p) => readFileSync(join(ROOT, ...p), "utf8");
const INDEX = read("town", "pages", "calendar", "index.astro");
const EVENT = read("town", "pages", "calendar", "[host]", "[slug].astro");
const MONTH_PAGE = read("town", "pages", "calendar", "[month].astro");
const CARD = read("src", "components", "CalendarCard.astro");
const MONTH = read("src", "components", "CalendarMonth.astro");
const PANEL = read("src", "components", "CalendarPanel.astro");
const SAMPLE = JSON.parse(read("test", "fixtures", "calendar.sample.json"));
// Markup only: the page's own comments name the old words, and a comment is not what a reader sees.
const markupOf = (src) => src.replace(/^---[\s\S]*?\n---\n/, "").replace(/<!--[\s\S]*?-->/g, "");

// ── 1. the time zone, said once and true ─────────────────────────────────────

test("the zone sentence is true for a reader with the island and one without: UTC in the markup, their own zone after", () => {
  assert.match(ZONE_FLOOR, /UTC/);
  assert.match(ZONE_FLOOR, /JavaScript/i, "the baked sentence must admit the change to the reader's zone needs the island");
  assert.match(ZONE_FLOOR, /own time zone/);
  assert.equal(zoneLine("CEST"), "Times are in your time zone (CEST).");
  assert.equal(zoneLine(undefined), "Times are in your own time zone.", "no zone name still does not say UTC once localised");
});

test("the calendar front page no longer claims 'shown in your own time zone' in its own words", () => {
  const markup = markupOf(INDEX);
  assert.equal(/time zone/i.test(markup), false, "index.astro says a time-zone claim by hand, beside the month's one sentence");
  assert.equal(/Times are in UTC\.?\s*</.test(markupOf(MONTH)), false, "the month says bare 'Times are in UTC.', which the island then contradicts");
});

test("each page carries exactly one zone sentence, from the one constant", () => {
  assert.match(MONTH, /data-cal-zone>\{ZONE_FLOOR\}</, "the month grid's sentence is the constant");
  assert.equal((markupOf(MONTH).match(/<p\b[^>]*\bdata-cal-zone\b/g) ?? []).length, 1);
  assert.match(CARD, /\{full && <p class="cal-zone" data-cal-zone-card>\{ZONE_FLOOR\}<\/p>\}/, "the event page's card carries the sentence, and only the full card");
  assert.equal(/ZONE_FLOOR|time zone/i.test(markupOf(PANEL)) || /ZONE_FLOOR|time zone/i.test(markupOf(MONTH_PAGE)), false, "the panel and the month page add no second sentence of their own");
  // The islands paint the same sentence back through zoneLine(), not a copy of it.
  assert.match(MONTH, /said\.textContent = zoneLine\(zone\)/);
  assert.match(CARD, /said\.textContent = zoneLine\(zone\)/);
});

test("every instant on the event page is a <time data-local>, so the one sentence covers the doors line too", () => {
  const attend = EVENT.slice(EVENT.indexOf("data-rsvp-attend"), EVENT.indexOf("data-rsvp-out"));
  assert.ok(attend.length > 100);
  assert.equal((attend.match(/<time\b[^>]*\bdata-local\b/g) ?? []).length, 2, "the doors-open and ends instants are plain UTC text the island never reaches");
});

// ── 2. the phase badge and the announcements ─────────────────────────────────

test("the office's 'announced' phase is a coming-up event, not a host announcement, and the badge says so", () => {
  assert.equal(PHASE_WORDS.announced, "coming up");
  for (const [phase, word] of Object.entries(PHASE_WORDS)) assert.equal(/announce/i.test(word), false, `the ${phase} badge says '${word}' over a page that can say 'No announcements yet'`);
  assert.deepEqual(Object.keys(PHASE_WORDS).sort(), ["announced", "doors-open", "ended", "underway"], "the office's phase keys are untouched");
  assert.match(EVENT, /No announcements yet\./, "the announcements line is the host's list, kept as it was");
});

// ── 3. the countdown is labelled with when it was read ───────────────────────

test("the 'starts in' line is followed by the instant the office read it, since the page is built and it does not tick", () => {
  assert.match(CARD, /\{when &&/);
  assert.match(CARD, /data-when-asof/);
  assert.match(CARD, /\(as of \{asOf/);
  assert.match(CARD, /<time datetime=\{asOf\}[^>]*data-local>/, "the as-of instant is localised like every other time");
  assert.match(CARD, /"the last build"/, "no as_of still says what the count is relative to");
  assert.match(PANEL, /<CalendarCard event=\{e\} roll=\{roll\} asOf=\{calendar\?\.as_of \?\? null\} \/>/);
  assert.match(EVENT, /<CalendarCard event=\{event\} roll=\{roll\} asOf=\{calendar\.as_of \?\? null\} full \/>/);
  // The count itself is still the office's seconds: not worked out from the clock.
  assert.equal(whenLine(SAMPLE.coming[0]), "starts in 1 d 2 h");
  assert.equal(/Date\.now|new Date\(\)\.getTime/.test(CARD), false, "a client-side countdown crept in without its edge cases");
});

// ── 4. the place ─────────────────────────────────────────────────────────────

test("a place with a name and a point prints both as text, in the data's own order", () => {
  const p = placeOf(SAMPLE.now[0].place);
  assert.equal(p.name, "The Snug Harbour");
  assert.equal(p.point, "(-350, 4978)");
  assert.equal(p.label, "The Snug Harbour");
  assert.match(CARD, /\{place\.name && place\.point && <span class="cal-coords" data-place-point> \{place\.point\}<\/span>\}/, "the coordinates are visible text beside the name");
  assert.equal(/title=\{[^}]*place\.point/.test(CARD), false, "the coordinates are back in a tooltip only");
});

test("a slug used as a name reads as words; a person's own wording is left alone", () => {
  assert.equal(placeOf({ name: "the-snug-harbour", x: 1, y: 2 }).label, "The Snug Harbour");
  assert.equal(placeOf({ name: "Old Mill", x: 1, y: 2 }).label, "Old Mill");
  assert.equal(placeOf({ name: "harbour", x: 1, y: 2 }).label, "harbour");
  assert.equal(placeOf({ mark: "someone/the-old-mill", name: null, x: 1, y: 2 }).name, "The Old Mill", "a mark with no name falls back to its id's last part");
});

test("a missing point is not (0, 0): null, empty and absent coordinates are no point and no link", () => {
  // Number(null) and Number("") are 0: that is where "(0, 0)" came from.
  for (const place of [{ x: null, y: null }, { x: "", y: "" }, { x: undefined, y: undefined }, {}, null, undefined, { x: 5, y: null }]) {
    const p = placeOf(place);
    assert.equal(p.point, null, JSON.stringify(place));
    assert.equal(p.href, null, JSON.stringify(place));
    assert.equal(p.label, null, `${JSON.stringify(place)} prints a stand-in`);
  }
});

test("(0, 0) on a place with no mark is a missing point; with a mark it is the mark's centre", () => {
  assert.equal(placeOf({ mark: null, name: null, x: 0, y: 0 }).label, null);
  assert.equal(placeOf({ mark: null, name: null, x: 0, y: 0 }).href, null);
  const named = placeOf({ mark: null, name: "Old Mill", x: 0, y: 0 });
  assert.equal(named.label, "Old Mill", "the name stays when its point is only the placeholder");
  assert.equal(named.point, null);
  assert.equal(named.href, null);
  assert.equal(placeOf({ mark: "h/old-mill", name: "Old Mill", x: 0, y: 0 }).point, "(0, 0)");
  assert.equal(placeOf({ mark: null, name: null, x: 120, y: 64 }).label, "(120, 64)", "a real bare point still reads as one");
});

test("a place with nothing to show prints no row, in the card and in the month's agenda", () => {
  assert.match(CARD, /\{place\.label && <dt>at<\/dt>\}/);
  assert.match(CARD, /\{place\.label && \(\s*<dd data-place>/);
  assert.equal(/somewhere not recorded/.test(CARD + MONTH + read("src", "lib", "calendar.mjs")), false, "a stand-in place is back");
  assert.match(MONTH, /return pl\.label \? `at \$\{pl\.label\}/, "the agenda prints 'at ...' only with a label");
  assert.equal(/\bat \{placeOf/.test(markupOf(MONTH)), false, "the agenda writes 'at' before a label that may be empty");
});

// ── 5. the RSVP block for a human with no resident ───────────────────────────

test("the signed-out RSVP line and the signed-in-with-no-resident line each link a human to /join/", () => {
  const out = EVENT.slice(EVENT.indexOf("<div data-rsvp-out>"), EVENT.indexOf("data-rsvp-signin"));
  assert.match(out, /RSVP as a resident your household holds\./);
  assert.match(out, /No resident yet\? <a href="\/join\/">/);
  const none = EVENT.slice(EVENT.indexOf("data-rsvp-none"), EVENT.indexOf("<form class=\"cal-rsvp-form\""));
  assert.match(none, /<a href="\/join\/">/);
  assert.match(none, /nobody to RSVP as/);
});
