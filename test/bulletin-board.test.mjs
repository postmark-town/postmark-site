// bulletin-board.test.mjs — the Bulletin is a board (the Site Lift, POS-251).
//
//   node --test test/bulletin-board.test.mjs
//
// The board pins three kinds of thing, each the way into its page: this
// month's calendar (/calendar/), Ferry's Daily's front page (/daily/) and a
// post-it per posting (its notice, /bulletin/#<slug>). The rules live in
// src/lib/bulletin-board.mjs; the built-page tests below are skipped until the
// page is built, as POS-177 rules.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { POSTIT_PAPERS, TILTS, dailyFront, pinnedMonth, postitLook, tendedText } from "../src/lib/bulletin-board.mjs";
import { bulletinCards, bulletinPostings } from "../src/lib/bulletin-cards.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BULLETIN = JSON.parse(readFileSync(join(ROOT, "src", "data", "postmark", "bulletin.json"), "utf8"));
const DIST = join(ROOT, "dist-town");
const builtPage = (...segs) => join(DIST, ...segs, "index.html");

// ── the post-its ────────────────────────────────────────────────────────────

test("no two neighbouring notes share a paper or a lean, and none hangs square", () => {
  for (let i = 0; i < 60; i++) {
    const a = postitLook(i);
    const b = postitLook(i + 1);
    assert.notEqual(a.bg, b.bg, `notes ${i} and ${i + 1} share a paper`);
    assert.notEqual(a.tilt, b.tilt, `notes ${i} and ${i + 1} lean the same way`);
    assert.notEqual(a.tilt, 0, `note ${i} hangs square`);
  }
});

test("a note's paper is one the site already wears, and never the stamps' violet", () => {
  const violets = ["#aa8fd8", "#d8c7ef", "#65517f"];
  for (const p of POSTIT_PAPERS) {
    assert.match(p.bg, /^#[0-9a-f]{6}$/);
    assert.equal(violets.includes(p.bg), false, `${p.name} is a stamp violet`);
  }
  assert.ok(TILTS.every((t) => Math.abs(t) > 0 && Math.abs(t) <= 3), "a tilt is slight: askew, not fallen");
});

// ── the newspaper ───────────────────────────────────────────────────────────

const DAILY = [
  "# The office — Ferry's Daily",
  "",
  "*A curated look, kept by Ferry. Tended each round; last on **2026-09-25** (Friday night).*",
  "",
  "### ⛴ **Crossing 210 · 88 letters over · the roll is 140 · no bounces**",
  "",
  "## The Snug opens its doors",
  "",
  "**The pub on the Doubled Coast opened tonight.** Two sets, and every room was full.",
  "",
  "## A second story",
  "",
  "Not the lead.",
].join("\n");

test("the newspaper reads Ferry's crossing line, his date and his lead story", () => {
  const front = dailyFront([{ slug: "settling-in", body: "# x" }, { slug: "ferrys-daily", body: DAILY }]);
  assert.deepEqual(front, {
    tended: "2026-09-25",
    crossing: 210,
    figures: "88 letters over · the roll is 140 · no bounces",
    lead: "The Snug opens its doors",
    standfirst: "The pub on the Doubled Coast opened tonight. Two sets, and every room was full.",
  });
});

test("a Daily that changes its shape still pins a newspaper, with nothing made up", () => {
  const empty = { tended: null, crossing: null, figures: null, lead: null, standfirst: null };
  assert.deepEqual(dailyFront([]), empty);
  assert.deepEqual(dailyFront(undefined), empty);
  assert.deepEqual(dailyFront([{ slug: "ferrys-daily", body: "Just prose, no headings." }]), empty);
});

test("on the town's own bulletin the newspaper has a lead story and a crossing", () => {
  const front = dailyFront(BULLETIN);
  assert.ok(front.lead, "the town's Daily reads with no lead story");
  assert.equal(Number.isInteger(front.crossing), true);
});

test("the dateline's date is written out, and anything that is not a date is dropped", () => {
  assert.equal(tendedText("2026-08-26"), "26 August 2026");
  assert.equal(tendedText("yesterday"), null);
  assert.equal(tendedText(null), null);
});

// ── the calendar ────────────────────────────────────────────────────────────

const ev = (id, starts, extra = {}) => ({ id, title: id, starts, ends: starts, place: { x: 1, y: 1 }, ...extra });

test("the pinned month is the office's month, with its day marked as today", () => {
  const m = pinnedMonth({ as_of: "2026-10-03T12:00:00Z", now: [], coming: [ev("a/b", "2026-10-09T19:00:00Z")], ended: [] });
  assert.equal(m.key, "2026-10");
  const today = m.weeks.flat().filter((d) => d.today).map((d) => d.date);
  assert.deepEqual(today, ["2026-10-03"]);
  assert.equal(m.weeks.flat().find((d) => d.date === "2026-10-09").events.length, 1, "the event is on its day");
});

test("the note names what is on now before what is coming, and never a cancelled event", () => {
  const now = ev("h/now", "2026-10-03T11:00:00Z");
  const soon = ev("h/soon", "2026-10-05T11:00:00Z");
  const off = ev("h/off", "2026-10-04T11:00:00Z", { cancelled: true });
  const as_of = "2026-10-03T12:00:00Z";
  assert.deepEqual(pinnedMonth({ as_of, now: [now], coming: [soon], ended: [] }).next, { event: now, now: true });
  assert.deepEqual(pinnedMonth({ as_of, now: [], coming: [off, soon], ended: [] }).next, { event: soon, now: false });
  assert.equal(pinnedMonth({ as_of, now: [], coming: [off], ended: [] }).next, null);
});

test("with no as_of the month is the build's own", () => {
  const m = pinnedMonth({}, new Date("2026-09-26T15:00:00Z"));
  assert.equal(m.key, "2026-09");
  assert.equal(m.next, null);
});

// ── THE BUILT PAGES ─────────────────────────────────────────────────────────

const bulletinHtml = builtPage("bulletin");

test("the built board pins the calendar and the Daily, each linking its page",
  { skip: !existsSync(bulletinHtml) }, () => {
  const page = readFileSync(bulletinHtml, "utf8");
  assert.match(page, /<a[^>]*href="\/calendar\/"[^>]*data-pinned="calendar"/, "the calendar is not pinned as a link to /calendar/");
  assert.match(page, /<a[^>]*href="\/daily\/"[^>]*data-pinned="daily"/, "the newspaper is not pinned as a link to /daily/");
  assert.match(page, /data-board-month="\d{4}-\d{2}"/);
  assert.match(page, /<td[^>]*class="[^"]*\btoday\b[^"]*"/, "the pinned month marks no today");
});

test("every note is a plain link to its notice, and every notice answers its #slug without a script",
  { skip: !existsSync(bulletinHtml) }, () => {
  const page = readFileSync(bulletinHtml, "utf8");
  for (const p of bulletinCards(BULLETIN)) {
    const note = new RegExp(`<a[^>]*href="#${p.slug}"[^>]*data-card="${p.slug}"`);
    assert.match(page, note, `${p.slug}'s note is not a link to #${p.slug}`);
  }
  for (const p of bulletinPostings(BULLETIN)) {
    assert.match(page, new RegExp(`<article[^>]*id="${p.slug}"[^>]*data-post="${p.slug}"`),
      `/bulletin/#${p.slug} lands on no notice`);
  }
  assert.match(page, /id="board"/, "#board, the fold years' anchor, lands nowhere");
  assert.equal(/<button\b[^>]*data-card/.test(page), false, "a note is a button again: it opens nothing without a script");
});

test("the board keeps no 'more' behind an expand (POS-250's rule)", { skip: !existsSync(bulletinHtml) }, () => {
  const page = readFileSync(bulletinHtml, "utf8");
  const main = page.slice(page.indexOf("<main"), page.indexOf("</main>"));
  assert.equal(/<details\b/.test(main), false, "the bulletin hides text behind an expand");
  assert.equal(/class="pm-more"/.test(main), false);
});

for (const [name, segs] of [["the calendar", ["calendar"]], ["Ferry's Daily", ["daily"]]]) {
  test(`${name} carries a way back to the board`, { skip: !existsSync(builtPage(...segs)) }, () => {
    const page = readFileSync(builtPage(...segs), "utf8");
    assert.match(page, /data-board-back[^>]*>\s*<a href="\/bulletin\/"/, `${name} has no way back to the bulletin`);
  });
}
