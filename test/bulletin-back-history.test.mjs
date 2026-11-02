// bulletin-back-history.test.mjs — the board's "back" controls and its history
// (Site UX, POS-855).
//
//   node --test test/bulletin-back-history.test.mjs
//
// A posting page's back link is /bulletin/#the-notices (BOARD_NOTICES_PATH),
// the no-script address of the notices, which the scripted board opens as the
// notices too. A reader who arrives there, opens a notice and closes it must
// go BACK through history, as one who arrived on #notices does: backTo
// compares the `from` that the move recorded with the hash it leads to, and
// "the-notices" is the same place as "notices". Before this, the two spellings
// mismatched and the close pushed a fresh entry (one extra Back press).
//
// Two checks, one on each side of the seam:
//   1. backAddress, the pure fold the page's script imports (town-views.mjs);
//   2. the page's own backTo, lifted out of town/pages/bulletin/index.astro and
//      run against a stand-in for history, so the call is the one that ships
//      and a page that stops using backAddress reds here.
// The page is read as source, never built: a built-page test would skip in CI
// (test.yml does not build) and be a falsifier that never runs.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

import { BOARD_PIECES, NOSCRIPT_NOTICES, backAddress } from "../src/lib/town-views.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PAGE = readFileSync(join(ROOT, "town", "pages", "bulletin", "index.astro"), "utf8");

// ── backAddress: which spellings are one place ──────────────────────────────

test("backAddress folds the no-script notices address to the notices, the board to nothing, and leaves every other address alone", () => {
  const notices = BOARD_PIECES.find((p) => p.key === "notices").hash;
  assert.equal(notices, "notices", "the notices piece moved: the page's backTo(\"notices\") must follow it");
  assert.equal(backAddress(NOSCRIPT_NOTICES), notices);
  assert.equal(backAddress("board"), "");
  // not folded: each is its own place, and "" is the board already
  for (const id of ["", "notices", "calendar", "daily", "meeps", "quarter", "quarter-quests", "meeps-postmaster", "some-notice-slug"]) {
    assert.equal(backAddress(id), id, `${id} was folded`);
  }
  // only the exact address folds, so a notice slug that merely contains it is a slug
  assert.equal(backAddress(`${NOSCRIPT_NOTICES}-2`), `${NOSCRIPT_NOTICES}-2`);
});

// ── the page's backTo, as shipped ────────────────────────────────────────────

/** The page's backTo, lifted from its script, run on a stand-in for history. */
function backToRun(state, hash) {
  const lifted = PAGE.match(/function backTo\(hash: string\) \{[\s\S]*?\n      \}\n/)?.[0];
  assert.ok(lifted, "town/pages/bulletin/index.astro has no backTo to lift: the check lost its subject");
  const calls = [];
  const ctx = { history: { state, back: () => calls.push("back") }, go: (h) => calls.push(`go:${h}`), backAddress };
  runInNewContext(`${lifted.replace("(hash: string)", "(hash)")}\nbackTo(${JSON.stringify(hash)});`, ctx);
  return calls;
}

test("closing a notice goes back through history when the reader arrived on #the-notices, exactly as on #notices", () => {
  // the entry a notice's open pushed: { town: true, from: <the hash it left> }
  assert.deepEqual(backToRun({ town: true, from: "notices" }, "notices"), ["back"], "control: arriving on #notices");
  assert.deepEqual(backToRun({ town: true, from: NOSCRIPT_NOTICES }, "notices"), ["back"], "arriving on #the-notices pushed a new entry");
});

test("every other move through backTo is what it was", () => {
  // a notice opened from the calendar, say, then closed: no entry of "notices" to go back to
  assert.deepEqual(backToRun({ town: true, from: "calendar" }, "notices"), ["go:notices"]);
  assert.deepEqual(backToRun({ town: true, from: "quarter-quests" }, "notices"), ["go:notices"]);
  // a notice opened from the board (no hash): the close still leads to the notices, so it pushes
  assert.deepEqual(backToRun({ town: true, from: "" }, "notices"), ["go:notices"]);
  // the "back to the board" control: the board is "" or "board", and a fresh arrival has no state
  assert.deepEqual(backToRun({ town: true, from: "" }, ""), ["back"]);
  assert.deepEqual(backToRun({ town: true, from: "board" }, ""), ["back"]);
  assert.deepEqual(backToRun({ town: true, from: NOSCRIPT_NOTICES }, ""), ["go:"], "the notices are not the board");
  assert.deepEqual(backToRun({ town: true, from: "notices" }, ""), ["go:"]);
  assert.deepEqual(backToRun(null, ""), ["go:"]);
  assert.deepEqual(backToRun(null, "notices"), ["go:notices"]);
  assert.deepEqual(backToRun({ other: 1 }, "notices"), ["go:notices"], "an entry that is not the board's is not read");
});
