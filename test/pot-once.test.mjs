// pot-once.test.mjs — a one-time pot reads as one-time everywhere it shows
// (POS-653; Darko, 2026-10-17 12:07 EDT: "a link to the actual product that I'm
// trying to buy. And a point that this is a one-time thing. It needs to be very
// apparent and clear that this is different from the other quests ... somewhere
// big and bright as like a sticker on the thing").
//
//   node --test test/pot-once.test.mjs
//
// A pot whose file says closes_at_fill (pot-meeps-home.json) wears the
// ONE-TIME sticker on its card (/fund/, /town/#pots, /stamps/#pots) and on its
// own page, names the fill where a monthly pot names its month, and links what
// its dollars buy. A monthly pot wears none of it.
//
// THE FLIPS: drop closes_at_fill or buys from extract-seam.mjs's base row and
// § 2 goes red; drop the sticker from PotCards.astro or [pot].astro and § 3 and
// § 4 go red; read closesAtFill as always false in toPot and § 1 goes red.

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { toPot, livePots, loadPots } from "../src/lib/funding.mjs";
import { seamFromTown } from "../tools/extract-seam.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");
const THANKS = {
  min_usd: 10, how_url: null, art: null,
  card: "Give $10 or more and we'll send you Postmark stickers as a thank-you, never a purchase.",
  line: "As a thank-you, never a purchase: once your household's gifts here total $10, Darko mails its human custom Postmark stickers; he asks where by email, outside the town, and no address ever enters it.",
};
const BUYS = { name: "Beelink SER8 (8745HS) mini PC", url: "https://us.bee-link.com/products/beelink-ser8-8745hs?variant=52636411855130" };

// a pot row as extract-seam.mjs emits it
const ROW = (over = {}) => ({
  pot: "meeps-home", subtype: "bounty", status: "open", title: "Give the meeps a home",
  source: "A one-time pot that buys the town's meeps a home of their own, a Beelink SER8 mini PC for $859, and closes the moment it fills. More.",
  target_usd_per_epoch: 859, epoch_cadence: "once", beneficiary: "keeminlee", uncapped: false,
  close: "epoch", epoch: "2026-10", received_usd: 0, staked: 0, stakers: [], patrons: [],
  closes_at_fill: true, buys: BUYS, thank_you: THANKS, ...over,
});

test("1 · toPot carries closes_at_fill and buys, and a one-time pot names no month", () => {
  const p = toPot(ROW());
  assert.equal(p.ok, true, p.reason);
  assert.equal(p.closesAtFill, true);
  assert.deepEqual(p.buys, BUYS);
  assert.equal(p.epochLabel, null, "\"October 2026\" beside a one-time pot read as a monthly pot");

  const monthly = toPot(ROW({ pot: "keeping-ec2", closes_at_fill: undefined, buys: undefined, epoch_cadence: "monthly" }));
  assert.equal(monthly.closesAtFill, false, "a pot that never said closes_at_fill has a calendar");
  assert.equal(monthly.buys, null);
  assert.equal(monthly.epochLabel, "October 2026", "a monthly pot still names its month");

  assert.equal(toPot(ROW({ closes_at_fill: "true" })).closesAtFill, false, "only a literal true carries");
  assert.equal(toPot(ROW({ buys: { name: "x", url: "http://example.com" } })).buys, null, "an http link is dropped");
  assert.equal(toPot(ROW({ buys: { name: "", url: BUYS.url } })).buys, null, "a nameless link is dropped");
  assert.equal(toPot(ROW({ buys: { name: "x", url: "javascript:alert(1)" } })).buys, null);
  assert.equal(toPot(ROW({ buys: "nope" })).ok, true, "a torn buys drops the link, never the pot");
});

test("1b · toPot carries the thank-you whole or not at all; a torn link or image drops itself", () => {
  assert.deepEqual(toPot(ROW()).thankYou, THANKS);
  assert.equal(toPot(ROW({ thank_you: undefined })).thankYou, null, "a pot that posts none shows none");
  assert.equal(toPot(ROW({ thank_you: { ...THANKS, line: "" } })).thankYou, null, "a thank-you missing its page line is not said half");
  assert.equal(toPot(ROW({ thank_you: { ...THANKS, min_usd: 0 } })).thankYou, null);
  assert.equal(toPot(ROW({ thank_you: { ...THANKS, how_url: "http://example.com" } })).thankYou.how_url, null, "an http address route is dropped");
  assert.equal(toPot(ROW({ thank_you: { ...THANKS, how_url: "https://postmark.town/stickers/" } })).thankYou.how_url, "https://postmark.town/stickers/");
  assert.equal(toPot(ROW({ thank_you: { ...THANKS, art: "//evil.example/a.png" } })).thankYou.art, null, "a protocol-relative image is dropped");
  assert.equal(toPot(ROW({ thank_you: { ...THANKS, art: "/art/sticker.png" } })).thankYou.art, "/art/sticker.png");
});

// ── 2 · the emitter carries both fields by name ────────────────────────────
const TOWN = [process.env.POSTMARK_TOWN, ...[".postmark-checkout", "../postmark", "../../seam-overnight/town-main", "../../postmark"]
  .map((p) => resolve(ROOT, p))]
  .filter(Boolean)
  .find((p) => existsSync(join(p, "tools", "stamp-mint.mjs")));

test("2 · extract-seam carries closes_at_fill and buys from the pot file", { skip: !TOWN }, async () => {
  const mint = await import(pathToFileURL(join(TOWN, "tools", "stamp-mint.mjs")).href);
  const entries = mint.parseStampLedger(readFileSync(join(TOWN, "WHITE_PAGES", "stamp-ledger.md"), "utf8"));
  const base = mint.potFile(TOWN, "keeping-ec2");
  const DIAL = { sigma: 0.5, rho: 0.5, rhoCeiling: 0.5, treasury: "the-town" };
  const once = { ...base, pot: "once-test", closes_at_fill: true, buys: BUYS, thank_you: THANKS };
  const seam = seamFromTown({ mint, entries, potFiles: [base, once], dial: DIAL, asOf: "2026-10-17" });
  const row = seam.pots.find((r) => r.pot === "once-test");
  assert.equal(row.closes_at_fill, true);
  assert.deepEqual(row.buys, BUYS);
  assert.deepEqual(row.thank_you, THANKS);
  const monthly = seam.pots.find((r) => r.pot === "keeping-ec2");
  assert.equal(monthly.closes_at_fill, false);
  assert.equal(monthly.buys, null);
  const p = toPot(row);
  assert.equal(p.ok, true, p.reason);
  assert.equal(p.closesAtFill, true);
});

// ── 3 · the source: one sticker, worn on the card and the page ─────────────
const CARDS = read("src/components/PotCards.astro");
const PAGE = read("town/pages/fund/[pot].astro");
const STICKER = read("src/components/OneTimeSticker.astro");

test("3 · the card and the page wear the sticker, name the fill and link what the dollars buy", () => {
  assert.match(STICKER, /ONE-TIME/);
  assert.match(STICKER, /closes when it fills/);
  assert.match(CARDS, /\{p\.closesAtFill && <span class="m-sticker"><OneTimeSticker \/><\/span>\}/, "the card wears it");
  assert.match(PAGE, /\{pot\.closesAtFill && <OneTimeSticker size="page" \/>\}/, "the page wears it, at page size");
  assert.ok(CARDS.includes(`{!p.closesAtFill && <p class="m-kind">`), "the card's kicker names no epoch, and leaves the fill to the sticker");
  assert.ok(PAGE.includes(`{!pot.closesAtFill && <>{pot.firstCloseLabel ?`), "the page's kicker names no epoch, and leaves the fill to the sticker");
  for (const [name, src, v] of [["card", CARDS, "p"], ["page", PAGE, "pot"]]) {
    assert.ok(src.includes(`<a href={${v}.buys.url} target="_blank" rel="noopener">What we're buying →</a>`), `the ${name} links what the dollars buy, in a new tab`);
  }
  assert.ok(PAGE.includes(`{!pot.closesAtFill && <span class="f-dim">this epoch</span>}`), "the page's money line drops \"this epoch\"");
  assert.ok(CARDS.includes("{p.thankYou.card}"), "the card says the thank-you's short line");
  assert.ok(PAGE.includes("{pot.thankYou.line}"), "the page says the thank-you's full line");
  for (const src of [CARDS, PAGE]) assert.ok(src.includes("data-thanks-art"), "and each keeps the sticker image's slot");
});

// ── 4 · the built pages, when built ────────────────────────────────────────
const DIST = join(ROOT, "dist-town");
const built = existsSync(join(DIST, "index.html")) && existsSync(join(DIST, "fund", "index.html"));
const html = (...segs) => readFileSync(join(DIST, ...segs, "index.html"), "utf8");
const count = (text, needle) => text.split(needle).length - 1;
// what a reader sees: the scripts and styles out (the witness script's own " this epoch." is a branch, not a sentence)
const visible = (page) => page.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "");
// the words alone, tags and their attributes out (an aria-label is not a second sentence on the card)
const text = (page) => visible(page).replace(/<[^>]+>/g, " ");

test("4 · every built pot surface wears one sticker per open one-time pot, and a monthly pot's page wears none", { skip: !built }, () => {
  const board = livePots(loadPots());
  const openOnce = board.pots.filter((p) => p.status === "open" && p.closesAtFill);
  for (const rel of [["fund"], ["town"], ["docs", "stamps"]]) {
    const page = html(...rel);
    assert.equal(count(page, "data-once-sticker"), openOnce.length, `/${rel.join("/")}/ wears one sticker per open one-time pot`);
    assert.equal(count(page, ">ONE-TIME<"), openOnce.length);
    // ONCE per one-time card, on its sticker (Darko, 2026-10-17 12:38: "we don't need to repeat 'closes when it fills'")
    assert.equal(count(text(page).toLowerCase(), "closes when it fills"), openOnce.length, `/${rel.join("/")}/ says "closes when it fills" once per one-time card`);
    const plain = visible(page).replace(/&#39;|&#x27;/g, "'").replace(/&amp;/g, "&");
    for (const p of board.pots.filter((q) => q.status === "open" && q.thankYou)) {
      assert.ok(plain.includes(p.thankYou.card), `/${rel.join("/")}/ carries ${p.pot}'s thank-you on its card`);
    }
    for (const p of openOnce.filter((q) => q.buys)) {
      assert.ok(page.includes(`href="${p.buys.url.replace(/&/g, "&amp;")}" target="_blank" rel="noopener"`) || page.includes(`href="${p.buys.url}" target="_blank" rel="noopener"`),
        `/${rel.join("/")}/ links what ${p.pot} buys`);
    }
  }
  const pages = new Map();
  for (const p of [...board.pots, ...board.drafts]) if (p.status !== "closed") pages.set(p.pot, p);
  for (const [slug, p] of pages) {
    if (!existsSync(join(DIST, "fund", slug, "index.html"))) continue;
    const page = html("fund", slug);
    assert.equal(count(page, "data-once-sticker"), p.closesAtFill ? 1 : 0, `/fund/${slug}/ wears the sticker iff it is one-time`);
    if (p.closesAtFill) {
      assert.ok(!visible(page).includes("this epoch"), `/fund/${slug}/ says no "this epoch"`);
      assert.ok(!/(January|February|March|April|May|June|July|August|September|October|November|December) 20\d\d/.test(visible(page)), `/fund/${slug}/ names no month`);
      assert.equal(count(text(page).toLowerCase(), "closes when it fills"), 1, `/fund/${slug}/ says "closes when it fills" once, on the sticker`);
      if (p.buys) assert.ok(page.includes("What we're buying →"));
      if (p.thankYou) {
        const plain = visible(page).replace(/&#39;|&#x27;/g, "'").replace(/&amp;/g, "&");
        assert.ok(plain.includes(p.thankYou.line), `/fund/${slug}/ says the thank-you, out of the fine print`);
        assert.ok(/class="f-thanks"/.test(page));
      }
    }
  }
});
