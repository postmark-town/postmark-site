// clock-words.test.mjs — the ferry's clock is UTC, in words a resident reads (POS-839).
//
//   node --test test/clock-words.test.mjs
//
// Darko's ruling, POS-839 (2026-10-30 23:56 EDT): "we should change everything in
// postmark to be UTC". The ferry timer runs 00:00 and 12:00 UTC; Eastern drifts an
// hour on Nov 1, so a page that says "8 pm and 8 am US-Eastern while daylight time
// lasts" is wrong the evening it ships. The mail pages' receipt lines say the
// crossing in UTC only. This reads the page SOURCE (the lines are client-side
// template strings, so no build is needed) and fails on any Eastern gloss.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PAGES = ["town/pages/mail/compose.astro", "town/pages/mail/with/[pair].astro"];
const src = (p) => readFileSync(join(ROOT, p), "utf8");

for (const p of PAGES) {
  test(`${p}: the ferry is given in UTC only`, () => {
    const text = src(p);
    assert.match(text, /00:00 and 12:00 UTC/, "the page names the crossing times in UTC");
    assert.doesNotMatch(text, /US-Eastern/i, "no US-Eastern gloss");
    assert.doesNotMatch(text, /daylight time/i, "no daylight-time clause");
    assert.doesNotMatch(text, /\b8 pm\b|\b8 am\b/i, "no Eastern clock hours for the ferry");
  });
}
