// fund-close.test.mjs — the fund pages stop saying September once September
// has closed (POS-231, 2026-09-29).
//
//   node --test test/fund-close.test.mjs
//
// The pot cards and the pot page said "closes end of September" from the pot
// file's fixed first_close, on static pages that outlive the month. The rule
// (src/lib/fund-close.mjs): while first_close is ahead, say it; once it has
// passed, say the end of the reader's CURRENT month, in UTC (the close runs at
// 00:00 UTC, 20:00 EDT). Every test here pins "now": never the real clock.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { closeAt, paintCloses, firstCloseLabel, epochLabel } from "../src/lib/fund-close.mjs";
import * as funding from "../src/lib/funding.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const T = (iso) => Date.parse(iso);

test("closeAt: first_close ahead says its own month; once passed, the reader's current month", () => {
  assert.deepEqual(closeAt("2026-09-30", T("2026-09-29T12:00:00Z")), { closeLabel: "end of September", epoch: "2026-09", epochLabel: "September 2026" });
  assert.deepEqual(closeAt("2026-09-30", T("2026-10-01T00:00:00Z")), { closeLabel: "end of October", epoch: "2026-10", epochLabel: "October 2026" });
  assert.deepEqual(closeAt("2026-09-30", T("2026-11-15T09:00:00Z")), { closeLabel: "end of November", epoch: "2026-11", epochLabel: "November 2026" });
  assert.deepEqual(closeAt("2026-09-30", T("2027-01-03T00:00:00Z")), { closeLabel: "end of January", epoch: "2027-01", epochLabel: "January 2027" });
});

test("closeAt: the month boundary is UTC — the close runs at 00:00 UTC, which is 20:00 EDT the evening before", () => {
  // 19:59 EDT on the 30th is 23:59 UTC: still September's epoch
  assert.equal(closeAt("2026-09-30", T("2026-09-30T23:59:59Z")).closeLabel, "end of September");
  // 20:00 EDT on the 30th is 00:00 UTC on the 1st: October's
  assert.equal(closeAt("2026-09-30", T("2026-10-01T00:00:00Z")).closeLabel, "end of October");
  // a reader in New York at 21:00 EDT on the 30th already reads October
  assert.equal(closeAt("2026-09-30", T("2026-09-30T21:00:00-04:00")).closeLabel, "end of October");
  // the close runs at the END of its day: a mid-month first close holds its own
  // date through that whole UTC day, and only then gives way (a month-end close
  // cannot show this, because its day is still in the same month)
  assert.equal(closeAt("2026-09-12", T("2026-09-12T23:59:59Z")).closeLabel, "12 September");
  assert.equal(closeAt("2026-09-12", T("2026-09-13T00:00:00Z")).closeLabel, "end of September");
});

test("closeAt: meeps-fund's first_close 2026-10-31 reads 'end of October' until it passes", () => {
  assert.equal(closeAt("2026-10-31", T("2026-09-29T12:00:00Z")).closeLabel, "end of October");
  assert.equal(closeAt("2026-10-31", T("2026-09-29T12:00:00Z")).epochLabel, "October 2026", "an early dollar belongs to the first close's month (the first epoch rounds forward)");
  assert.equal(closeAt("2026-10-31", T("2026-10-15T12:00:00Z")).closeLabel, "end of October");
  assert.equal(closeAt("2026-10-31", T("2026-11-01T00:00:00Z")).closeLabel, "end of November");
});

test("closeAt: a first close not on a month's end keeps its date until it passes; no posted close says nothing", () => {
  assert.equal(closeAt("2026-09-12", T("2026-09-01T00:00:00Z")).closeLabel, "12 September");
  assert.equal(closeAt("2026-09-12", T("2026-09-20T00:00:00Z")).closeLabel, "end of September");
  for (const bad of [null, "", "2026-09", "soon", "2026-13-01"]) assert.equal(closeAt(bad, T("2026-10-01T00:00:00Z")), null);
});

test("ONE formatter: funding.mjs re-exports fund-close.mjs's, so the build and the browser say the same words", () => {
  assert.equal(funding.firstCloseLabel, firstCloseLabel);
  assert.equal(funding.epochLabel, epochLabel);
  assert.doesNotMatch(readFileSync(join(ROOT, "src", "lib", "fund-close.mjs"), "utf8"), /^import /m, "fund-close.mjs must load in the browser: it imports nothing");
});

// A document just big enough for paintCloses.
function stubDoc(elements) {
  return { querySelectorAll: (sel) => (sel === "[data-first-close]" ? elements : []) };
}
const el = (fc, say) => ({ textContent: "end of September", getAttribute: (k) => (k === "data-first-close" ? fc : k === "data-say" ? say ?? null : null) });

test("paintCloses: the reader's clock rewrites every close and epoch the page was built with", () => {
  const close = el("2026-09-30");
  const epoch = el("2026-09-30", "epoch");
  const meeps = el("2026-10-31");
  paintCloses(stubDoc([close, epoch, meeps]), T("2026-10-01T08:00:00Z"));
  assert.equal(close.textContent, "end of October");
  assert.equal(epoch.textContent, "October 2026");
  assert.equal(meeps.textContent, "end of October");
});

// ── THE PAGES ────────────────────────────────────────────────────────────────

const CARDS = readFileSync(join(ROOT, "src", "components", "PotCards.astro"), "utf8");
const POT = readFileSync(join(ROOT, "town", "pages", "fund", "[pot].astro"), "utf8");

test("the pages say the close through closeAt, marked for the reader's clock; never the pot file's fixed label", () => {
  for (const [name, src] of [["PotCards.astro", CARDS], ["[pot].astro", POT]]) {
    assert.doesNotMatch(src, /closes \{p(?:ot)?\.firstCloseLabel\}/, `${name} still prints the fixed first-close label`);
    assert.match(src, /closes <span data-first-close=\{p(?:ot)?\.firstClose\}>\{closeAt\(p(?:ot)?\.firstClose\)\.closeLabel\}<\/span>/, `${name}'s close is not closeAt's, marked for the browser`);
    assert.match(src, /import \{ paintCloses \} from "@\/lib\/fund-close\.mjs";\s*paintCloses\(\);/, `${name} does not repaint the close at the reader's time`);
  }
  assert.doesNotMatch(POT, /first close is at the/, "the pot page still speaks of a FIRST close, which will have passed");
  assert.doesNotMatch(POT, /belong to the <strong>\{pot\.epochLabel\}<\/strong> epoch/, "the pot page still names the file's fixed epoch");
  assert.match(POT, /data-first-close=\{pot\.firstClose\} data-say="epoch">\{closeAt\(pot\.firstClose\)\.epochLabel\}/);
});

test("an elastic pot keeps its own words about the floor", () => {
  assert.match(CARDS, /in the roll — closes at month's end,/);
  assert.match(POT, /Past its floor — closes at month's end, <span class="f-dim">no cap<\/span>; it keeps taking until then\./);
});

// The built pages, when built: every close they name is marked for the reader's
// clock, its static words are closeAt's as of the file's own build time, and a
// reader on 2026-10-01 (a fixed date, never the real clock) sees no September.
const DIST = join(ROOT, "dist-town", "fund");
const builtFund = () => [join(DIST, "index.html"), ...readdirSync(DIST, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => join(DIST, d.name, "index.html"))].filter(existsSync);

test("the built fund pages: every close is marked, true as of the build, and names no September to a reader on 2026-10-01",
  { skip: !existsSync(join(DIST, "index.html")) }, () => {
  let seen = 0;
  for (const file of builtFund()) {
    const html = readFileSync(file, "utf8");
    const builtAt = statSync(file).mtimeMs;
    // no close phrase outside a marked element
    const unmarked = html.replace(/<(span|strong)\b[^>]*data-first-close="[^"]*"[^>]*>[^<]*<\/\1>/g, "");
    assert.doesNotMatch(unmarked, /closes end of (?:January|February|March|April|May|June|July|August|September|October|November|December)|first close is at/, `${file} names a close the reader's clock cannot rewrite`);
    for (const m of html.matchAll(/<(?:span|strong)\b[^>]*data-first-close="([^"]*)"([^>]*)>([^<]*)</g)) {
      seen++;
      const say = /data-say="epoch"/.test(m[2]) ? "epochLabel" : "closeLabel";
      assert.equal(m[3], closeAt(m[1], builtAt)[say], `${file}: "${m[3]}" is not closeAt's as of the build`);
      assert.doesNotMatch(closeAt(m[1], T("2026-10-01T00:00:00Z"))[say], /September/, `${file}: a reader on 2026-10-01 would read September`);
    }
  }
  assert.ok(seen > 0, "no marked close was found on the built fund pages");
});
