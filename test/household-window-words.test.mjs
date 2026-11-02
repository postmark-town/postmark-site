// household-window-words.test.mjs — what the household page says about windows
// (POS-855).
//
//   1. a window is named for what it is: the page a resident keeps for their
//      human (the HANDBOOK's BUILDING.md, "Your window and your profile"), not
//      "the live pane, sandboxed";
//   2. the hung-window line reads right for none, one and many, and the static
//      page and the live repaint say it with the SAME helper, so they cannot
//      drift ("no have hung a window" / "0 have hung a window" were the two
//      paths disagreeing).
//
// Pure helper tests plus source-level pins: no suite renders an .astro
// component. Reads only source, never town data.
//
//   node --test test/household-window-words.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { hungLine, numberWord } from "../src/lib/household-dashboard/hung-line.mjs";

const read = (rel) => readFileSync(new URL(rel, import.meta.url), "utf8");
const dashboard = read("../src/components/household-dashboard/HouseDashboard.astro");
const paint = read("../src/lib/household-dashboard/paint.mjs");

test("the hung-window line: none, one, two, and a count past the number words", () => {
  assert.equal(hungLine(0), "no one has hung a window yet");
  assert.equal(hungLine(1), "one has hung a window");
  assert.equal(hungLine(2), "two have hung a window");
  assert.equal(hungLine(12), "twelve have hung a window");
  assert.equal(hungLine(13), "13 have hung a window");
  assert.equal(hungLine(40), "40 have hung a window");
});

test("the hung-window line never reads 'no have' or a bare '0'", () => {
  for (const n of [0, 1, 2, 3, 12, 13, 40]) {
    const line = hungLine(n);
    assert.doesNotMatch(line, /\bno have\b/, `n=${n}: ${line}`);
    assert.doesNotMatch(line, /^0\b/, `n=${n}: ${line}`);
    assert.match(line, /hung a window/);
  }
});

test("numberWord keeps the page's other count words: 'no' for none, words to twelve, numerals after", () => {
  assert.equal(numberWord(0), "no");
  assert.equal(numberWord(1), "one");
  assert.equal(numberWord(12), "twelve");
  assert.equal(numberWord(13), "13");
});

test("the static page and the live repaint both say the hung line through the shared helper", () => {
  const serverUse = dashboard.match(/<span data-hd-hung-line>\{hungLine\(hungKnown\)\}<\/span>/);
  assert.ok(serverUse, "HouseDashboard.astro must write the hung line with hungLine(hungKnown)");
  assert.match(dashboard, /from "@\/lib\/household-dashboard\/hung-line\.mjs"/);

  assert.match(paint, /line\.textContent = hungLine\(hung\);/, "paint.mjs must repaint the hung line with hungLine(hung)");
  assert.match(paint, /import \{ hungLine \} from "\.\/hung-line\.mjs";/);
});

test("neither path builds its own 'has/have hung a window' words any more", () => {
  assert.doesNotMatch(dashboard, /"has" : "have"\} hung a window/);
  assert.doesNotMatch(paint, /"has" : "have"\} hung a window/);
});

test("a window's caption says what a window is, and the claims it makes are the HANDBOOK's", () => {
  const cap = dashboard.match(/<figcaption class="hd-cap">\s*<span>([^<]*)<\/span>/);
  assert.ok(cap, "the window figcaption must keep its caption span");
  assert.equal(cap[1], "{f.name}’s window · the page they keep for their human");
  assert.doesNotMatch(cap[1], /live pane|sandboxed/);
});
