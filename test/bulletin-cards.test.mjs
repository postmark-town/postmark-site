// bulletin-cards.test.mjs — the bulletin pins no happening; the happenings are
// not deleted, only unpinned.
//
//   node --test test/bulletin-cards.test.mjs
//
// The brief's falsifier for this part (the site, reprojected — part 2): "the
// bulletin shows no HAPPENING card while the class still renders on the
// calendar fixture". The calendar is on feature/calendar and is not on this
// branch, so the second half is asserted as far as it can be here: the
// happening postings stay in the data this site serves.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { bulletinCards, bulletinPostings, isHappening, HAPPENING, ORDER } from "../src/lib/bulletin-cards.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BULLETIN = JSON.parse(readFileSync(join(ROOT, "src", "data", "postmark", "bulletin.json"), "utf8"));
const DIST = join(ROOT, "dist-town");

const post = (slug, kind) => ({ slug, data: kind === undefined ? {} : { kind } });

test("a happening is the posting's own `kind`, read the way the card's kicker reads it", () => {
  assert.equal(HAPPENING, "happening");
  assert.equal(isHappening(post("a", "happening")), true);
  assert.equal(isHappening(post("a", " Happening ")), true);
  for (const k of ["guidance", "notice", "news", "standing", undefined]) {
    assert.equal(isHappening(post("a", k)), false, `${k} read as a happening`);
  }
  assert.equal(isHappening(null), false);
  assert.equal(isHappening({ slug: "x" }), false);
});

test("the wall drops the happenings and the Daily, and keeps everything else in newcomer-first order", () => {
  const fixture = [
    post("zeta-news", "news"),
    post("a-party", "happening"),
    post("ferrys-daily"),
    post("the-doors", "guidance"),
    post("settling-in", "guidance"),
    post("build-your-home", "notice"),
    post("alpha-standing", "standing"),
  ];
  assert.deepEqual(bulletinCards(fixture).map((p) => p.slug),
    ["settling-in", "the-doors", "build-your-home", "zeta-news", "alpha-standing"]);
  assert.deepEqual(bulletinCards(undefined), []);
});

test("on the town's own bulletin: no card is a happening, and every other posting still hangs", () => {
  const cards = bulletinCards(BULLETIN);
  assert.equal(cards.some(isHappening), false);
  const happenings = BULLETIN.filter(isHappening).map((p) => p.slug);
  const expected = BULLETIN.filter((p) => p.slug !== "ferrys-daily" && !isHappening(p)).map((p) => p.slug).sort();
  assert.deepEqual(cards.map((p) => p.slug).sort(), expected);
  // Nothing else left the wall: the page lost exactly the happenings.
  assert.equal(cards.length, BULLETIN.length - 1 - happenings.length);
});

test("the order is the page's old order, less the happenings (the move changed no card's place)", () => {
  // The expression the page carried before this part, verbatim.
  const order = ORDER;
  const old = [...BULLETIN]
    .filter((p) => p.slug !== "ferrys-daily")
    .sort(
      (a, b) => (order.indexOf(a.slug) + 99 * (order.indexOf(a.slug) < 0)) - (order.indexOf(b.slug) + 99 * (order.indexOf(b.slug) < 0))
    )
    .filter((p) => !isHappening(p))
    .map((p) => p.slug);
  assert.deepEqual(bulletinCards(BULLETIN).map((p) => p.slug), old);
});

test("the happenings are unpinned, not deleted — the site still serves them in its bulletin data", () => {
  const served = JSON.parse(readFileSync(join(ROOT, "public", "atelier", "postmark", "data", "bulletin.json"), "utf8"));
  const inData = BULLETIN.filter(isHappening).map((p) => p.slug);
  const inServed = served.filter(isHappening).map((p) => p.slug);
  assert.deepEqual(inServed, inData);
});

// ── THE BUILT PAGE (skipped until it is built, as POS-177 rules) ────────────

const builtBulletin = join(DIST, "bulletin", "index.html");

test("the built bulletin pins no happening card and pins every other card",
  { skip: !existsSync(builtBulletin) }, () => {
  const page = readFileSync(builtBulletin, "utf8");
  const pinned = new Set([...page.matchAll(/data-card="([^"]+)"/g)].map((m) => m[1]));
  for (const p of BULLETIN.filter(isHappening)) {
    assert.equal(pinned.has(p.slug), false, `${p.slug} (a happening) is pinned on the built bulletin`);
  }
  for (const p of bulletinCards(BULLETIN)) {
    assert.equal(pinned.has(p.slug), true, `${p.slug} is missing from the built bulletin`);
  }
  assert.equal(/class="bc-kind"[^>]*>\s*happening/.test(page), false, "a card on the built wall wears the happening kicker");
  // The calendar landed and is pinned to the board itself (POS-251), so the
  // flagged "what's on" sentence is retired, not merely off.
  assert.equal(/data-whats-on/.test(page), false, "the retired what's-on sentence is back");
});

test("an unpinned happening still OPENS from its deep link — the store keeps every posting the wall used to",
  { skip: !existsSync(builtBulletin) }, () => {
  const page = readFileSync(builtBulletin, "utf8");
  const openable = new Set([...page.matchAll(/data-post="([^"]+)"/g)].map((m) => m[1]));
  for (const p of bulletinPostings(BULLETIN)) {
    assert.equal(openable.has(p.slug), true, `/bulletin/#${p.slug} opens nothing on the built page`);
  }
  assert.ok(BULLETIN.filter(isHappening).every((p) => openable.has(p.slug)));
});

test("bulletinPostings is the cards plus the happenings, never the Daily", () => {
  const all = bulletinPostings(BULLETIN).map((p) => p.slug);
  assert.equal(all.includes("ferrys-daily"), false);
  assert.deepEqual(all.filter((s) => bulletinCards(BULLETIN).some((c) => c.slug === s)), bulletinCards(BULLETIN).map((p) => p.slug));
  assert.deepEqual(all.filter((s) => !bulletinCards(BULLETIN).some((c) => c.slug === s)).sort(),
    BULLETIN.filter(isHappening).map((p) => p.slug).sort());
});
