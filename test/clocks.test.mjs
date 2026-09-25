// clocks.test.mjs — the two clocks read the next boundary correctly, across
// midnight, from marks read off the record.
//
//   node --test test/clocks.test.mjs
//
// The brief's falsifier for this part (the site, reprojected — part 7): "the
// clocks read the next boundary correctly across midnight".

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  FERRY_MARKS, SETTLEMENT_MARKS, marksFromDerivation, marksFromSettlements,
  nextMark, untilPhrase, marksPhrase, windowNumber,
} from "../src/lib/clocks.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const at = (iso) => Date.parse(iso);

// ── THE NEXT BOUNDARY ───────────────────────────────────────────────────────

test("the next ferry: 00:00 and 12:00 UTC, strictly after now, across midnight", () => {
  const cases = [
    ["2026-09-25T16:20:00Z", "2026-09-26T00:00:00.000Z"],   // afternoon → tonight's midnight
    ["2026-09-25T23:59:30Z", "2026-09-26T00:00:00.000Z"],   // the last half minute before midnight
    ["2026-09-26T00:00:00Z", "2026-09-26T12:00:00.000Z"],   // ON the mark: the next one, not this one
    ["2026-09-26T00:00:01Z", "2026-09-26T12:00:00.000Z"],
    ["2026-09-26T11:59:59Z", "2026-09-26T12:00:00.000Z"],
    ["2026-12-31T23:10:00Z", "2027-01-01T00:00:00.000Z"],   // across a year
  ];
  for (const [now, want] of cases) assert.equal(nextMark(at(now), FERRY_MARKS).toISOString(), want, `from ${now}`);
});

test("the next settlement: 06:00 and 18:00 UTC, across midnight", () => {
  const cases = [
    ["2026-09-25T16:20:00Z", "2026-09-25T18:00:00.000Z"],
    ["2026-09-25T18:00:00Z", "2026-09-26T06:00:00.000Z"],
    ["2026-09-25T23:30:00Z", "2026-09-26T06:00:00.000Z"],   // after midnight's ferry, before dawn's settlement
    ["2026-09-26T05:59:00Z", "2026-09-26T06:00:00.000Z"],
    ["2026-02-28T19:00:00Z", "2026-03-01T06:00:00.000Z"],   // across a month end
  ];
  for (const [now, want] of cases) assert.equal(nextMark(at(now), SETTLEMENT_MARKS).toISOString(), want, `from ${now}`);
});

test("nextMark takes fractional marks and refuses to guess without any", () => {
  assert.equal(nextMark(at("2026-09-25T17:00:00Z"), [5.75, 17.75]).toISOString(), "2026-09-25T17:45:00.000Z");
  assert.equal(nextMark(at("2026-09-25T18:00:00Z"), [5.75, 17.75]).toISOString(), "2026-09-26T05:45:00.000Z");
  assert.equal(nextMark(at("2026-09-25T18:00:00Z"), []), null);
  assert.equal(nextMark(NaN, FERRY_MARKS), null);
});

// ── THE MARKS, READ OFF THE RECORD ──────────────────────────────────────────

test("the ferry's marks come from the office's own derivation sentence", () => {
  assert.deepEqual(marksFromDerivation("12h crossings (00:00/12:00 UTC) since the ledger's first delivery day 2026-06-12"), [0, 12]);
  assert.deepEqual(marksFromDerivation("crossings (06:30/18:30 UTC)"), [6.5, 18.5]);
  assert.equal(marksFromDerivation("twice a day"), null);
  assert.equal(marksFromDerivation(undefined), null);
});

test("the settlement's marks come from where recent blessings actually landed — two to make a mark", () => {
  const recent = [
    { n: 81, date: "2026-09-25T06:00:24+00:00" },
    { n: 80, date: "2026-09-24T18:00:31+00:00" },
    { n: 79, date: "2026-09-24T06:00:27+00:00" },
    { n: 78, date: "2026-09-23T18:00:37+00:00" },
    { n: 62, date: "2026-09-08T05:45:29+00:00" },          // the old mark, once: not a mark any more
    { n: 61, date: "2026-09-07T21:12:00+00:00" },          // a late one-off: not a mark
  ];
  assert.deepEqual(marksFromSettlements({ recent }), [6, 18]);
  assert.equal(marksFromSettlements({ recent: recent.slice(4) }), null, "one blessing per hour makes no mark");
  assert.equal(marksFromSettlements(null), null);
});

test("the window's number is the office's count, GET /api/ crossing.number", () => {
  assert.equal(windowNumber({ crossing: { number: 211 } }), 211);
  assert.equal(windowNumber({ crossing: { number: "211" } }), null);
  assert.equal(windowNumber(null), null);
});

// ── WORDS ───────────────────────────────────────────────────────────────────

test("untilPhrase and marksPhrase speak a reader's units", () => {
  assert.equal(untilPhrase(30_000), "in under a minute");
  assert.equal(untilPhrase(12 * 60_000), "in 12 min");
  assert.equal(untilPhrase(3 * 3_600_000 + 12 * 60_000), "in 3 h 12 min");
  assert.equal(untilPhrase(2 * 3_600_000), "in 2 h");
  assert.equal(untilPhrase(-1), "");
  assert.equal(marksPhrase(FERRY_MARKS), "00:00 & 12:00 UTC");
  assert.equal(marksPhrase(SETTLEMENT_MARKS), "06:00 & 18:00 UTC");
});

// ── ON EVERY PAGE ───────────────────────────────────────────────────────────

test("the layout wears the clocks once, under the header", () => {
  const shell = readFileSync(join(ROOT, "src", "layouts", "PostmarkLayout.astro"), "utf8");
  assert.equal(shell.match(/^\s*<Clocks \/>/gm)?.length, 1);
  assert.ok(shell.indexOf("</header>") < shell.indexOf("<Clocks />"), "the clocks are not under the header");
});

const builtHome = join(ROOT, "dist-town", "index.html");
test("the built pages carry both clocks' floor, in UTC", { skip: !existsSync(builtHome) }, () => {
  for (const segs of [[], ["town"], ["records", "crossings"], ["join"]]) {
    const page = readFileSync(join(ROOT, "dist-town", ...segs, "index.html"), "utf8");
    assert.equal((page.match(/data-clocks\b/g) ?? []).length >= 1, true, `/${segs.join("/")} has no clocks`);
    assert.match(page, /data-clock="ferry"[\s\S]*?00:00 &amp; 12:00 UTC/, `/${segs.join("/")}: the ferry's floor`);
    assert.match(page, /data-clock="settlement"[\s\S]*?06:00 &amp; 18:00 UTC/, `/${segs.join("/")}: the settlement's floor`);
  }
});
