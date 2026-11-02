// bulletin-pages.test.mjs — every posting the bulletin board carries has a page
// of its own at /bulletin/<slug>/, and the page draws the body the same way the
// board's small window does (Site UX campaign, POS-855, cold walks of 11-01).
//
//   node --test test/bulletin-pages.test.mjs
//
// The pure helpers are checked against a hand-written fixture
// (test/fixtures/bulletin-pages.json); none of it reads the town's postings.
// The two wiring cases read source files and are labelled as pins. The
// built-page case reads only built HTML (never the town's data) and runs only
// in CI, as test/lens-cards.test.mjs does.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  noticePages, noticeBodyHtml, noticeKind, noticePath, NOTICE_REPO_DIR, BOARD_NOTICES_PATH,
} from "../src/lib/bulletin-notice.mjs";
import { bulletinPostings, bulletinCards, NOT_A_CARD } from "../src/lib/bulletin-cards.mjs";
import { postingsWithoutCard } from "../src/lib/bulletin-doors.mjs";
import { md } from "../src/lib/pm.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURE = JSON.parse(readFileSync(join(ROOT, "test", "fixtures", "bulletin-pages.json"), "utf8"));
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const slugs = (list) => list.map((p) => p.slug);

test("the fixture still holds what the assertions rest on", () => {
  assert.ok(FIXTURE.some((p) => NOT_A_CARD.has(p.slug)), "the fixture needs the Daily, which gets no page");
  assert.ok(postingsWithoutCard(FIXTURE).length >= 2, "the fixture needs postings the wall does not hang");
  assert.ok(bulletinCards(FIXTURE).length >= 3, "the fixture needs wall cards");
});

test("the page set is exactly the set the board carries a body for: none extra, none missing", () => {
  const carried = slugs(bulletinPostings(FIXTURE)).sort();
  const pages = slugs(noticePages(FIXTURE)).sort();
  assert.deepEqual(pages, carried);
  assert.equal(new Set(pages).size, pages.length, "a page is built twice");
  // not the Daily, which is its own page; and every unpinned happening has a page
  assert.equal(pages.includes("ferrys-daily"), false);
  for (const p of postingsWithoutCard(FIXTURE)) assert.ok(pages.includes(p.slug), `${p.slug} has no page`);
  // cards and doors together are the pages
  const both = [...bulletinCards(FIXTURE), ...postingsWithoutCard(FIXTURE)].map((p) => p.slug).sort();
  assert.deepEqual(both, pages);
});

test("nothing the board does not carry gets a page, and the input is not changed", () => {
  const extra = [...FIXTURE, { slug: "ferrys-daily", data: {}, body: "x" }];
  assert.deepEqual(slugs(noticePages(extra)), slugs(noticePages(FIXTURE)));
  const before = JSON.stringify(FIXTURE);
  noticePages(FIXTURE);
  assert.equal(JSON.stringify(FIXTURE), before);
  assert.deepEqual(noticePages([]), []);
  assert.deepEqual(noticePages(undefined), []);
});

test("a page's address is /bulletin/<slug>/ and its way back is the board's notices", () => {
  assert.equal(noticePath("settling-in"), "/bulletin/settling-in/");
  assert.equal(BOARD_NOTICES_PATH, "/bulletin/#notices");
});

test("the body is rendered by pm.md with the town-repo directory: raw HTML escaped, relative links to the repo", () => {
  for (const p of FIXTURE) assert.equal(noticeBodyHtml(p), md(p.body, { repoDir: NOTICE_REPO_DIR }));
  const markup = noticeBodyHtml(FIXTURE.find((p) => p.slug === "fixture-markup"));
  assert.equal(markup.includes("<script"), false, "raw <script> got through");
  assert.equal(markup.includes("onclick"), true, "the markup should survive as visible, escaped text");
  assert.equal(/<b[ >]/.test(markup), false, "raw <b> got through");
  const news = noticeBodyHtml(FIXTURE.find((p) => p.slug === "fixture-card-news"));
  assert.match(news, /href="https:\/\/github\.com\/postmark-town\/postmark\/blob\/main\/TOWN_BULLETIN\/docs\/guide\.md"/);
  assert.match(news, /src="https:\/\/raw\.githubusercontent\.com\/postmark-town\/postmark\/main\/TOWN_BULLETIN\/art\/pic\.png"/);
  assert.equal(noticeBodyHtml({ slug: "x" }), "");
});

test("the kicker: pinned for everyone, its own kind, a plain notice, or on the calendar", () => {
  const by = (s) => FIXTURE.find((p) => p.slug === s);
  assert.equal(noticeKind(by("settling-in"), FIXTURE), "pinned for everyone");
  assert.equal(noticeKind(by("fixture-card-news"), FIXTURE), "news");
  assert.equal(noticeKind(by("fixture-card-no-kind"), FIXTURE), "notice");
  assert.equal(noticeKind(by("fixture-party"), FIXTURE), "on the calendar");
});

// ── THE WIRING (source pins, labelled: which file calls which is the claim) ──

test("[source pin] the window's template and the posting's page draw the body through the one component, and neither calls md itself", () => {
  const body = read("src/components/NoticeBody.astro");
  assert.match(body, /import \{[^}]*\bnoticeBodyHtml\b[^}]*\} from "@\/lib\/bulletin-notice\.mjs"/);
  assert.match(body, /set:html=\{noticeBodyHtml\(posting\)\}/);
  assert.equal(/\bmd\(/.test(body), false, "NoticeBody renders with its own md call");
  for (const file of ["town/pages/bulletin/index.astro", "town/pages/bulletin/[slug].astro"]) {
    const src = read(file);
    assert.match(src, /import NoticeBody from "@\/components\/NoticeBody\.astro"/, `${file} does not use the shared component`);
    assert.match(src, /<NoticeBody posting=\{p\} \/>/, `${file} does not render the shared component`);
    assert.equal(/[^.\w]md\(/.test(src), false, `${file} renders a body with its own md call`);
  }
  // the window's template sits inside the board's loop over the carried postings
  assert.match(read("town/pages/bulletin/index.astro"), /\{postings\.map\(\(p\) => \(\s*<template data-note=\{p\.slug\}/);
});

test("[source pin] the page route is built from noticePages, the set the templates come from", () => {
  const route = read("town/pages/bulletin/[slug].astro");
  assert.match(route, /return noticePages\(bulletin\)\.map\(\(p\) => \(\{ params: \{ slug: p\.slug \}/);
  assert.match(route, /href=\{BOARD_NOTICES_PATH\}>← the town bulletin</);
  assert.match(read("town/pages/bulletin/index.astro"), /const postings = bulletinPostings\(bulletin\)/);
});

test("[source pin] the More postings note no longer says 'Not pinned', which the 'Pinned for everyone' plaque contradicts", () => {
  const board = read("town/pages/bulletin/index.astro");
  assert.equal(board.includes("Not pinned above"), false);
  assert.match(board, /<p class="mp-note">Postings not on the board above, newest first\.<\/p>/);
});

// ── THE BUILT PAGES (CI only) ───────────────────────────────────────────────
// Reads only built HTML: the board's templates against the posting pages, with
// no look at the town's data. GitHub Actions sets CI=true; locally this skips.

const dist = join(ROOT, "dist-town", "bulletin");
const builtBoard = join(dist, "index.html");

test("built: a page exists for every template on the board, and says what the template says",
  { skip: !(process.env.CI && existsSync(builtBoard)) }, () => {
  const board = readFileSync(builtBoard, "utf8");
  const templates = [...board.matchAll(/<template[^>]*data-note="([^"]+)"[^>]*>([\s\S]*?)<\/template>/g)];
  assert.ok(templates.length > 0, "the board carries no templates");
  const bodyOf = (html) => /<div class="notice-body"[^>]*>([\s\S]*?)<\/div>/.exec(html)?.[1];
  for (const [, slug, inner] of templates) {
    const file = join(dist, slug, "index.html");
    assert.ok(existsSync(file), `no page for a posting the board carries`);
    const page = readFileSync(file, "utf8");
    assert.ok(bodyOf(inner), "a template has no body");
    assert.equal(bodyOf(page), bodyOf(inner), "a page's body differs from its template's");
    assert.match(page, /<a[^>]*href="\/bulletin\/#notices"[^>]*>← the town bulletin<\/a>/);
    assert.equal(/<meta name="robots"/.test(page), false, "a posting page names a robots rule of its own");
    // the permalink on the board points at this page
    assert.ok(board.includes(`data-page="/bulletin/${slug}/"`), "the window's permalink does not point at the page");
  }
});
