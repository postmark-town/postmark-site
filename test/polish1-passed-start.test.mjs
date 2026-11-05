// polish1-passed-start.test.mjs — POS-855 polish-1, item 4.
//
// whenLine() printed "starts in <gap>" from durationWords(starts_in_s), and
// durationWords takes an absolute value, so a NEGATIVE starts_in_s (a start that
// has already passed) in the announced / doors-open phase still read "starts in
// 4 min". A passed start must never print "starts in": the line is omitted. The
// office's phase badge is still shown; ended, underway and the future starts
// read as before.
//
// Pure: runs src/lib/calendar.mjs on synthetic events. No built page, no data.
//
//   node --test test/polish1-passed-start.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { durationWords, whenLine } from "../src/lib/calendar.mjs";

test("a start that has passed never prints 'starts in', in either pre-start phase", () => {
  for (const phase of ["announced", "doors-open"]) {
    for (const starts_in_s of [-1, -30, -240, -3600, -90000, "-240", -60]) {
      const line = whenLine({ phase, starts_in_s });
      assert.doesNotMatch(line, /starts in/, `${phase} ${starts_in_s} printed "${line}"`);
      assert.equal(line, "", `${phase} ${starts_in_s}: the line is omitted`);
    }
  }
});

test("a start still ahead (or right now) reads as before", () => {
  assert.equal(whenLine({ phase: "announced", starts_in_s: 4 * 86400 + 17 * 3600 }), "starts in 4 d 17 h");
  assert.equal(whenLine({ phase: "doors-open", starts_in_s: 20 * 60 }), "starts in 20 min");
  assert.equal(whenLine({ phase: "doors-open", starts_in_s: 30 }), "starts in under a minute");
  assert.equal(whenLine({ phase: "doors-open", starts_in_s: 0 }), "starts in under a minute");
  assert.equal(whenLine({ phase: "announced", starts_in_s: "1200" }), "starts in 20 min");
});

test("a missing or unreadable count still prints no line", () => {
  assert.equal(whenLine({ phase: "announced" }), "");
  assert.equal(whenLine({ phase: "announced", starts_in_s: null }), "");
  assert.equal(whenLine({ phase: "doors-open", starts_in_s: "soon" }), "");
});

test("ended and underway read as before (ended counts back from a negative ends_in_s)", () => {
  assert.equal(whenLine({ phase: "ended", ends_in_s: -3 * 3600 }), "ended 3 h ago");
  assert.equal(whenLine({ phase: "ended" }), "ended");
  assert.equal(whenLine({ phase: "underway", ends_in_s: 2 * 3600 + 5 * 60 }), "ends in 2 h 5 min");
});

test("durationWords itself is unchanged: it measures a gap, whichever way it points", () => {
  assert.equal(durationWords(-3 * 3600), "3 h");
  assert.equal(durationWords(4 * 60), "4 min");
  assert.equal(durationWords(null), null);
});
