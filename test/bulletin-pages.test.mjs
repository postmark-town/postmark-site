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
import { NOSCRIPT_NOTICES, viewOf } from "../src/lib/town-views.mjs";

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
  assert.equal(BOARD_NOTICES_PATH, "/bulletin/#the-notices");
});

test("the way back is an address that works with and without script, and the old one still opens the notices", () => {
  const hash = BOARD_NOTICES_PATH.slice(BOARD_NOTICES_PATH.indexOf("#"));
  const board = { view: null, inner: null, note: null };
  // with script: both addresses open the notices view
  assert.deepEqual(viewOf(hash, []), { ...board, view: "notices" });
  assert.deepEqual(viewOf("#notices", []), { ...board, view: "notices" });
  // without script: the address is the id of the list the board's <noscript> stands
  assert.equal(hash, `#${NOSCRIPT_NOTICES}`);
  assert.equal(BOARD_NOTICES_PATH, `/bulletin/${hash}`);
});

test("[source pin] the board carries the way back's address as the id of its no-script list, and as no other id", () => {
  const board = read("town/pages/bulletin/index.astro");
  const noscript = [...board.matchAll(/<noscript>([\s\S]*?)<\/noscript>/g)].map((m) => m[1]);
  assert.equal(noscript.filter((x) => x.includes("id={NOSCRIPT_NOTICES}")).length, 1, "the no-script list lost its id");
  // nothing outside <noscript> carries it, so with script there is nothing to jump to
  assert.equal(board.replace(/<noscript>[\s\S]*?<\/noscript>/g, "").includes("id={NOSCRIPT_NOTICES}"), false);
  assert.equal(/\bid="(?:the-notices|notices)"/.test(board), false, "an element carries a board address as its id");
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
  // BOTH back links: the one above the paper and the one in its footer. Each is
  // pinned in its own container, so breaking one cannot hide behind the other.
  const back = /<a href=\{BOARD_NOTICES_PATH\}>← the town bulletin<\/a>/;
  assert.match(/<p class="np-back">[\s\S]*?<\/p>/.exec(route)?.[0] ?? "", back, "the top back link is not the way back");
  assert.match(/<footer class="np-foot">[\s\S]*?<\/footer>/.exec(route)?.[0] ?? "", back, "the footer back link is not the way back");
  assert.equal(route.match(/href=\{BOARD_NOTICES_PATH\}/g)?.length, 2, "the page does not carry exactly two back links");
  assert.match(read("town/pages/bulletin/index.astro"), /const postings = bulletinPostings\(bulletin\)/);
});

test("[source pin] the front page's lens band sends each card to the posting's own page, not to a #slug on the board", () => {
  const home = read("town/pages/index.astro");
  const band = /<section class="cardband for-lens"[\s\S]*?<\/section>/.exec(home)?.[0] ?? "";
  assert.ok(band.includes("read the posting"), "the lens band was not found");
  assert.match(band, /<a class="c-paperlink" href=\{noticePath\(b\.slug\)\}>read the posting →<\/a>/);
  assert.equal(band.includes("/bulletin/#"), false, "a lens card links to a board address");
  assert.match(home, /import \{ noticePath \} from "@\/lib\/bulletin-notice\.mjs";/);
});

test("[source pin] the More postings note says 'not on the board above', not 'Not pinned', which the board's own pinned tag would contradict", () => {
  const board = read("town/pages/bulletin/index.astro");
  assert.equal(board.includes("Not pinned above"), false);
  assert.match(board, /<p class="mp-note">Postings not on the board above, newest first\.<\/p>/);
});

// ── THE BOARD'S OWN WORDS (Site UX, POS-855, cold walks of 11-02) ───────────
// "Pinned" belongs to the three PINNED notices, and only to them. The plaque,
// the cluster note, its aria-label and the no-JS heading name the whole set of
// notices ("on the board"); the tag on a card and the no-JS " (pinned)" keep
// the word for the three. Source pins: which line says what is the claim.

test("[source pin] the plaque, the cluster note, its aria-label and the no-JS heading call every notice 'on the board', never 'pinned for everyone'", () => {
  const board = read("town/pages/bulletin/index.astro");
  assert.equal(/pinned for everyone/i.test(board), false, "the board calls all its notices pinned again");
  assert.match(board, /<span class="plaque" aria-hidden="true">On the board<\/span>/);
  assert.match(board, /<b>On the board<\/b>/);
  assert.match(board, /aria-label=\{`The notices, \$\{cards\.length\} on the board`\}/);
  assert.match(/<noscript>[\s\S]*<\/noscript>/.exec(board)?.[0] ?? "", /<h2>On the board<\/h2>/, "the no-JS heading is not 'On the board'");
});

test("[source pin] 'pinned' stays on the three that are: the card's tag and the no-JS mark both ask isPinned", () => {
  const board = read("town/pages/bulletin/index.astro");
  assert.match(board, /<span class="st-kind">\{isPinned\(p\) \? "pinned" : \(p\.data\?\.kind \?\? "notice"\)\}/);
  assert.match(board, /\{isPinned\(p\) && " \(pinned\)"\}/);
  assert.match(board, /<span class:list=\{\["pin", \{ red: isPinned\(p\) \}\]\} aria-hidden="true">/);
});

test("[source pin] the board intro holds with scripts and without: it names both, and no longer promises an in-page opening to everyone", () => {
  const lede = /<p class="lede">([\s\S]*?)<\/p>/.exec(read("town/pages/bulletin/index.astro"))?.[1] ?? "";
  const text = lede.replace(/\s+/g, " ");
  assert.ok(text.length > 0, "the intro paragraph was not found");
  assert.equal(/Click anything pinned here/.test(text), false, "the intro says 'pinned' for every piece");
  assert.equal(/opens right on this page;/.test(text), false, "the intro promises the in-page opening with no condition");
  assert.match(text, /right on this page when scripts run/);
  assert.match(text, /when they don't, on its own page/);
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
    assert.equal(page.match(/<a[^>]*href="\/bulletin\/#the-notices"[^>]*>← the town bulletin<\/a>/g)?.length, 2, "a page does not carry both back links");
    assert.equal(/<meta name="robots"/.test(page), false, "a posting page names a robots rule of its own");
    // the permalink on the board points at this page
    assert.ok(board.includes(`data-page="/bulletin/${slug}/"`), "the window's permalink does not point at the page");
  }
});
