// polish1-cancelled-card.test.mjs — POS-855 polish-1, item 3.
//
// A cancelled event in the calendar's Coming group read "cancelled coming up",
// and then "· starts in 4 d (as of ...)" after it. A cancelled event is not
// coming up and does not start in anything: its badge now says "cancelled" and
// nothing else. Every other phase reads as it did.
//
// SOURCE ONLY: reads src/components/CalendarCard.astro and runs the pure words
// in src/lib/calendar.mjs on synthetic events. No built page, no town data.
// (No suite renders an .astro file, so the markup is judged by its branches.)
//
//   node --test test/polish1-cancelled-card.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PHASE_WORDS, whenLine } from "../src/lib/calendar.mjs";

const card = readFileSync(join(import.meta.dirname, "..", "src", "components", "CalendarCard.astro"), "utf8");
const markup = card.replace(/^---[\s\S]*?\n---\n/, "").replace(/<!--[\s\S]*?-->/g, "");

// The phase line: <p class="cal-phase"> ... </p>
const phaseP = markup.slice(markup.indexOf('<p class="cal-phase">'), markup.indexOf("</p>", markup.indexOf('<p class="cal-phase">')));
// {e.cancelled ? <cancelled branch> : <everything else>}
const q = phaseP.indexOf("{e.cancelled");
const mark = phaseP.indexOf("? <span", q);
const colon = phaseP.indexOf(": <>", mark);
const cancelledBranch = phaseP.slice(mark, colon);
const otherBranch = phaseP.slice(colon);

test("the phase line chooses between 'cancelled' and the phase, never both", () => {
  assert.ok(q >= 0 && mark > q && colon > mark, "the phase line must be a ternary on e.cancelled");
  assert.equal((phaseP.match(/\{e\.cancelled\b/g) ?? []).length, 1, "e.cancelled is tested once in the phase line");
});

test("a cancelled event's badge says 'cancelled' alone: no phase word, no starts-in line", () => {
  assert.match(cancelledBranch, /<span class="cal-cancelled" data-cancelled>cancelled<\/span>/);
  assert.doesNotMatch(cancelledBranch, /cal-phase-word|\{phase\}/, "the phase word must not follow 'cancelled'");
  assert.doesNotMatch(cancelledBranch, /\{when\b|cal-when|data-when-asof/, "no 'starts in ... (as of ...)' after 'cancelled'");
});

test("every other event still gets its phase word and its when line, with the as-of", () => {
  assert.match(otherBranch, /<span class="cal-phase-word">\{phase\}<\/span>/);
  assert.match(otherBranch, /\{when && \(/);
  assert.match(otherBranch, /<span class="cal-when"> · \{when\}\{" "\}/);
  assert.match(otherBranch, /data-when-asof>\(as of /);
  assert.doesNotMatch(otherBranch, /data-cancelled/);
});

test("the card is still marked cancelled (strikethrough, dimmed) and still carries its phase on the article", () => {
  assert.match(card, /class:list=\{\["cal-card", "pm-paper", \{ "is-cancelled": e\.cancelled \}\]\} data-event=\{e\.id\} data-phase=\{e\.phase\}/);
});

test("the other phases read as before", () => {
  assert.deepEqual({ ...PHASE_WORDS }, { announced: "coming up", "doors-open": "doors open", underway: "under way", ended: "ended" });
  assert.equal(whenLine({ phase: "announced", starts_in_s: 4 * 86400 + 17 * 3600 }), "starts in 4 d 17 h");
  assert.equal(whenLine({ phase: "doors-open", starts_in_s: 20 * 60 }), "starts in 20 min");
  assert.equal(whenLine({ phase: "underway", ends_in_s: 2 * 3600 + 5 * 60 }), "ends in 2 h 5 min");
  assert.equal(whenLine({ phase: "ended", ends_in_s: -3 * 3600 }), "ended 3 h ago");
});
