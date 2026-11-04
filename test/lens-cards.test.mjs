// lens-cards.test.mjs — the signed-in front page's card band hangs current
// postings only (Site UX campaign, POS-855, D7 as amended 11-01 18:15).
//
//   node --test test/lens-cards.test.mjs
//
// A cold walk of prod on 11-01 found three or four of the six lens cards
// expired: Halloween happenings and an invitation that had ended. The band took
// "the six newest of everything but Ferry's Daily". It now also skips a posting
// whose OWN `status` marks it closed. It does NOT drop happenings wholesale:
// the bulletin wall unpins them, so the band is some postings' only door.
// Selection is the pure helper lensPostings (src/lib/bulletin-cards.mjs); the
// fixture is hand-written, so none of this reads the town's own postings.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { lensPostings, LENS_LIMIT, CLOSED_STATUSES, isClosed, isHappening, NOT_A_CARD } from "../src/lib/bulletin-cards.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURE = JSON.parse(readFileSync(join(ROOT, "test", "fixtures", "lens-postings.sample.json"), "utf8"));
const slugs = (list) => list.map((p) => p.slug);
const post = (slug, posted, kind, status) => ({ slug, data: { posted, ...(kind ? { kind } : {}), ...(status ? { status } : {}) } });

// The fixture's own shape is the test's premise: if it stops holding a newer
// closed happening, a newer Daily, a live happening and more current postings
// than the limit, every assertion below could pass without touching the defect.
test("the fixture still holds what the assertions rest on", () => {
  const newest = [...FIXTURE].sort((a, b) => String(b.data?.posted ?? "").localeCompare(String(a.data?.posted ?? "")));
  assert.equal(newest[0].slug, "ferrys-daily", "the Daily must be the newest posting");
  assert.equal(isHappening(newest[1]) && isClosed(newest[1]), true, "a closed happening must be the second newest");
  const live = FIXTURE.find((p) => isHappening(p) && !isClosed(p));
  assert.ok(live, "the fixture needs a live happening");
  assert.ok(FIXTURE.filter((p) => !NOT_A_CARD.has(p.slug) && !isClosed(p)).length > LENS_LIMIT,
    "the fixture needs more current postings than the limit, to see the cut");
  assert.ok(FIXTURE.some((p) => isClosed(p) && p.data.status !== p.data.status.trim().toLowerCase()), "one status must be spelled loosely");
});

test("the band is the six newest postings that are not the Daily and not marked closed", () => {
  assert.deepEqual(slugs(lensPostings(FIXTURE)), [
    "sample-spire-words", "sample-guidance-a", "sample-notice-b", "sample-news-c", "sample-standing-d", "sample-resting-e",
  ]);
  assert.equal(LENS_LIMIT, 6);
});

test("a closed posting never hangs, however new or loosely spelled, and neither does the Daily", () => {
  const out = slugs(lensPostings(FIXTURE, 99));
  for (const gone of ["sample-trick-or-treat", "sample-ended-invitation", "ferrys-daily"]) {
    assert.equal(out.includes(gone), false, `${gone} hung on the front door`);
  }
});

test("a happening that is not marked closed stays: the wall unpins it, so the band is its door", () => {
  assert.equal(slugs(lensPostings(FIXTURE))[0], "sample-spire-words");
  // no status at all is current too (a posting with no status field is not closed)
  assert.deepEqual(slugs(lensPostings([post("a-party", "2026-10-30", "happening")])), ["a-party"]);
});

test("a `status: past` posting is dropped: past is the town's word for a finished posting", () => {
  assert.equal(isClosed(post("x", "2026-10-01", "happening", "past")), true);
  assert.equal(isClosed(post("x", "2026-10-01", "happening", " Past ")), true);
  assert.deepEqual(slugs(lensPostings([post("x", "2026-10-01", "happening", "past")])), []);
  assert.equal(slugs(lensPostings(FIXTURE, 99)).includes("sample-past-happening"), false, "a past happening hung on the front door");
});

test("only `closed`, `ended` and `past` close a posting: `resting` (and open, live) never hide a card", () => {
  assert.deepEqual([...CLOSED_STATUSES].sort(), ["closed", "ended", "past"], "the closed set changed: `resting` has no finished meaning, and `past` is the town's word");
  for (const s of ["resting", "open", "live", "paused"]) {
    assert.equal(isClosed(post("x", "2026-10-01", "happening", s)), false, `${s} read as closed`);
    assert.deepEqual(slugs(lensPostings([post("x", "2026-10-01", "happening", s)])), ["x"], `a ${s} happening lost its door`);
  }
  assert.equal(slugs(lensPostings(FIXTURE)).includes("sample-resting-e"), true);
});

test("an undated posting sorts last, and fewer than six remaining shows what remains", () => {
  assert.deepEqual(slugs(lensPostings(FIXTURE, 99)).slice(-2), ["sample-notice-i", "sample-undated-h"]);
  const few = [post("a-news", "2026-10-02", "news"), post("a-party", "2026-10-30", "happening", "closed"), post("ferrys-daily", "2026-10-31"), post("b-notice", "2026-10-01", "notice", "open")];
  assert.deepEqual(slugs(lensPostings(few)), ["a-news", "b-notice"]);
});

test("none remaining is an empty list, not a filler", () => {
  assert.deepEqual(lensPostings([post("a-party", "2026-10-30", "happening", "closed"), post("ferrys-daily", "2026-10-31")]), []);
  assert.deepEqual(lensPostings([]), []);
  assert.deepEqual(lensPostings(undefined), []);
});

test("equal dates keep the bulletin's own order, and the input is not reordered", () => {
  const input = [post("z-first", "2026-10-02", "news"), post("a-second", "2026-10-02", "notice"), post("m-third", "2026-10-02")];
  const before = slugs(input);
  assert.deepEqual(slugs(lensPostings(input)), before);
  assert.deepEqual(slugs(input), before);
});

// ── THE PAGE (source pin, labelled: the choice of which band shows is made by
// markup and CSS, which only the browser runs) ────────────────────────────────

const read = (p) => readFileSync(join(ROOT, p), "utf8");

test("[source pin] the page takes its lens band from lensPostings and draws none when it is empty", () => {
  const page = read("town/pages/index.astro");
  // (front-latest added latestPostings and postingWhen to this import: the signed-out list and the dates)
  assert.match(page, /import \{[^}]*\blensPostings\b[^}]*\} from "@\/lib\/bulletin-cards\.mjs"/);
  assert.match(page, /const lensCards = lensPostings\(bulletin\)/);
  assert.match(page, /\{lensCards\.length > 0 && \(\s*<section class="cardband for-lens"/, "the lens band renders even when empty");
  // the story band stays for a signed-in reader exactly when the lens band is absent
  assert.match(page, /"no-lens-cards": lensCards\.length === 0/);
  assert.match(page, /html\[data-lens\]\) \.cardband\.for-vanilla:not\(\.no-lens-cards\) \{ display: none; \}/);
});

// ── THE BUILT PAGE (CI only) ────────────────────────────────────────────────
// This case reads the generated bulletin data and the built HTML. It runs only
// when CI asks for it: GitHub Actions sets CI=true on every job (no workflow
// here sets it by hand), and the `built-pages` job builds first. Locally it
// skips, even when a dist-town exists.

const built = join(ROOT, "dist-town", "index.html");

test("the built front page hangs exactly lensPostings' cards in the lens band",
  { skip: !(process.env.CI && existsSync(built)) }, () => {
  const BULLETIN = JSON.parse(readFileSync(join(ROOT, "src", "data", "postmark", "bulletin.json"), "utf8"));
  const page = readFileSync(built, "utf8");
  const want = slugs(lensPostings(BULLETIN));
  const band = /<section[^>]*class="[^"]*for-lens[^"]*"[\s\S]*?<\/section>/.exec(page)?.[0] ?? "";
  // each card goes to the posting's own page, /bulletin/<slug>/, not to a #slug on the board
  const hung = [...band.matchAll(/href="\/bulletin\/([^"#\/]+)\/"/g)].map((m) => m[1]);
  assert.deepEqual(hung, want);
  assert.equal(band.includes("/bulletin/#"), false, "a lens card links to a board address");
  assert.equal(band === "", want.length === 0, "the lens band's presence must match whether any posting remains");
  assert.equal(/class="[^"]*no-lens-cards[^"]*"/.test(page), want.length === 0, "the story band's no-lens-cards flag must match");
});
