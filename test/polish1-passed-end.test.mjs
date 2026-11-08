// polish1-passed-end.test.mjs — POS-855 polish-1, item 6 (the Unsure from item 4).
//
// whenLine() printed "ends in <gap>" for an under-way event from
// durationWords(ends_in_s), and durationWords takes an absolute value, so a
// NEGATIVE ends_in_s (an end that has already passed) read "ends in 5 min".
// A passed end must never print "ends in": the line is omitted, as a passed
// start is (polish1-passed-start.test.mjs). Ended and the future ends read
// as before.
//
// Pure: runs src/lib/calendar.mjs on synthetic events. No built page, no data.
//
//   node --test test/polish1-passed-end.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { whenLine } from "../src/lib/calendar.mjs";

test("an under-way event whose end has passed never prints 'ends in'", () => {
  for (const ends_in_s of [-1, -30, -300, -3600, -90000, "-300"]) {
    const line = whenLine({ phase: "underway", ends_in_s });
    assert.doesNotMatch(line, /ends in/, `underway ${ends_in_s} printed "${line}"`);
    assert.equal(line, "", `underway ${ends_in_s}: the line is omitted`);
  }
});

test("an end still ahead (or right now) reads as before", () => {
  assert.equal(whenLine({ phase: "underway", ends_in_s: 2 * 3600 + 5 * 60 }), "ends in 2 h 5 min");
  assert.equal(whenLine({ phase: "underway", ends_in_s: 20 * 60 }), "ends in 20 min");
  assert.equal(whenLine({ phase: "underway", ends_in_s: 0 }), "ends in under a minute");
  assert.equal(whenLine({ phase: "underway", ends_in_s: "1200" }), "ends in 20 min");
});

test("a missing or unreadable end count still prints no line", () => {
  assert.equal(whenLine({ phase: "underway" }), "");
  assert.equal(whenLine({ phase: "underway", ends_in_s: null }), "");
  assert.equal(whenLine({ phase: "underway", ends_in_s: "soon" }), "");
});

test("ended still counts back from a negative ends_in_s, and the pre-start phases are unchanged", () => {
  assert.equal(whenLine({ phase: "ended", ends_in_s: -3 * 3600 }), "ended 3 h ago");
  assert.equal(whenLine({ phase: "ended" }), "ended");
  assert.equal(whenLine({ phase: "announced", starts_in_s: 20 * 60 }), "starts in 20 min");
  assert.equal(whenLine({ phase: "doors-open", starts_in_s: -240 }), "");
});
