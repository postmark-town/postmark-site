// daily-frame-escape.test.mjs — links inside the framed Daily open in a new tab.
//
//   node --test test/daily-frame-escape.test.mjs
//
// ── THE LAW (postmark#2769 / POS-129) ──────────────────────────────────────
//
// /daily/ shows Ferry's Daily inside an <iframe> (town/pages/daily.astro:37-41).
// The copy step in tools/extract-town.mjs rewrites the Daily's repo-relative
// document links to GitHub blob URLs (githubUrl), and GitHub answers with
// X-Frame-Options: deny. So a reader who clicks a link inside the frame
// navigates the FRAME to a page that refuses to be framed, and the Daily is
// replaced by a blank panel. The page's own full-screen button already carries
// target="_blank" (daily.astro:45), which is exactly why that route survives
// and the in-frame one does not.
//
// The fix lives in the site's copy step, not in Ferry's template: the town owns
// TOWN_BULLETIN/ferrys-daily.html, the site owns the decision to frame it. One
// <base target="_blank"> in the copied <head> makes every link in the document
// land in a new tab while the frame keeps showing the Daily.
//
// ── WHAT EACH TEST BELOW CAN CATCH ─────────────────────────────────────────
//
// The function tests redden if injectBaseTarget stops injecting, injects twice,
// stops honouring a <base> that is already there, or stops being idempotent
// (the copy runs on every sync, so a non-idempotent pass would grow the file
// without bound and churn writeIfChanged on every run).
//
// THE ANCHOR GUARD is the one that watches something outside this file. A
// <base target> sends in-page #anchors to a new tab too. Today's Daily carries
// ZERO of them — measured 2026-09-20 on the town's live TOWN_BULLETIN copy and
// on the served copy in public/ — so no per-link target="_self" pass was built:
// that would be machinery guarding a case the document has never had. The day
// Ferry writes a table of contents, the last test here goes red and someone
// rules on it, rather than the anchor quietly opening a tab nobody asked for.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { injectBaseTarget } from "../tools/lib/mirror.mjs";

const SITE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SERVED_DAILY = join(SITE_ROOT, "public", "atelier", "postmark", "daily", "ferrys-daily.html");

const basesIn = (html) => html.match(/<base\b[^>]*>/gi) ?? [];

// A Daily in the shape the copy step hands over: refs already rewritten to
// GitHub, plus an in-page anchor, which today's Daily does not have.
const FIXTURE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>The office — Ferry's Daily · Postmark</title>
</head>
<body>
<p><a href="https://github.com/postmark-town/postmark/blob/main/WHITE_PAGES/mail-ledger.md">the ledger</a></p>
<p><a href="#crossing-196">jump to the crossing</a></p>
<img src="assets/postmark-night.png" alt="">
</body>
</html>
`;

test("the copied Daily gains a base that sends its links out of the frame", () => {
  const out = injectBaseTarget(FIXTURE);
  const bases = basesIn(out);
  assert.equal(bases.length, 1, `expected exactly one <base>, got ${bases.length}`);
  assert.match(bases[0], /target="_blank"/);
});

test("the base opens the head — every link in the document is under it, none above", () => {
  const out = injectBaseTarget(FIXTURE);
  const baseAt = out.search(/<base\b/i);
  const headAt = out.search(/<head\b/i);
  assert.ok(baseAt > headAt, "the base must sit inside <head>, after it opens");
  // A link that appears BEFORE the base is not governed by it. There must be
  // none — this is what makes "every link" true rather than "most links".
  const firstLinkAt = out.search(/<a\b[^>]*href=/i);
  assert.ok(firstLinkAt > baseAt, "a link above the base would keep navigating the frame");
});

test("the base carries no href, so it moves where links LAND and not where they RESOLVE", () => {
  const out = injectBaseTarget(FIXTURE);
  assert.doesNotMatch(basesIn(out)[0], /\bhref=/i,
    "an href on the injected base would silently re-root every relative ref in the Daily");
});

test("nothing else in the document moves — the refs the copy step rewrote are untouched", () => {
  const out = injectBaseTarget(FIXTURE);
  const hrefs = (html) => html.match(/(?:src|href)="[^"]*"/gi) ?? [];
  assert.deepEqual(hrefs(out), hrefs(FIXTURE));
});

test("a Daily that already carries a base GAINS target, and gains no second base", () => {
  const withBase = FIXTURE.replace("<head>", '<head>\n<base href="https://postmark.town/daily/">');
  const out = injectBaseTarget(withBase);
  const bases = basesIn(out);
  assert.equal(bases.length, 1, "a second <base> is dead markup — browsers honour only the first");
  assert.match(bases[0], /href="https:\/\/postmark\.town\/daily\/"/, "the existing href must survive");
  assert.match(bases[0], /target="_blank"/);
});

test("a base whose target points back into the frame is overwritten, not left alone", () => {
  const withSelf = FIXTURE.replace("<head>", '<head>\n<base target="_self">');
  const out = injectBaseTarget(withSelf);
  const bases = basesIn(out);
  assert.equal(bases.length, 1);
  assert.match(bases[0], /target="_blank"/);
  assert.doesNotMatch(bases[0], /_self/);
});

test("the pass is idempotent — the copy runs on every sync", () => {
  const once = injectBaseTarget(FIXTURE);
  assert.equal(injectBaseTarget(once), once);
  assert.equal(injectBaseTarget(injectBaseTarget(once)), once);
});

test("a document with no <head> is handed back untouched rather than guessed at", () => {
  const headless = "<p><a href=\"https://example.com\">a link</a></p>\n";
  assert.equal(injectBaseTarget(headless), headless);
});

test("the REAL served Daily gets exactly one base, and every link it carries keeps its URL", () => {
  assert.ok(existsSync(SERVED_DAILY), `the served Daily is missing: ${SERVED_DAILY}`);
  const served = readFileSync(SERVED_DAILY, "utf8");
  const out = injectBaseTarget(served);
  const bases = basesIn(out);
  assert.equal(bases.length, 1, `expected exactly one <base>, got ${bases.length}`);
  assert.match(bases[0], /target="_blank"/);
  const hrefs = (html) => html.match(/(?:src|href)="[^"]*"/gi) ?? [];
  assert.deepEqual(hrefs(out), hrefs(served), "the injection must not touch a single ref");
  assert.ok(hrefs(served).length > 0, "a Daily with no refs cannot prove this");
});

test("THE ANCHOR GUARD — the served Daily carries no in-page #anchor for the base to hijack", () => {
  const served = readFileSync(SERVED_DAILY, "utf8");
  const anchors = served.match(/href="#[^"]*"/gi) ?? [];
  assert.deepEqual(anchors, [],
    "a <base target=\"_blank\"> opens in-page anchors in a new tab too. The Daily has had " +
    "none; if one arrives, either leave it a target=\"_self\" in the copy step or accept the " +
    "new tab deliberately — do not let this test be deleted to make the red go away.");
});
