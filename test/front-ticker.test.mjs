// front-ticker.test.mjs — the front page's ticker keeps punctuation and shows
// more of the town (POS-855).
//
//   node --test test/front-ticker.test.mjs
//
// Falsifiers: take the per-sender cap out of spreadDeliveries (the "cap" and
// "order" tests fail), or make restoreApostrophes return its input (the
// "punctuation" tests fail), or point the page back at slice(0, 8) /
// threadTitle (the "wiring" test fails).

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { spreadDeliveries, deliveryTitle, restoreApostrophes } from "../src/lib/front-ticker.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FIX = JSON.parse(readFileSync(join(ROOT, "test", "fixtures", "front-ticker.sample.json"), "utf8"));
const letterById = new Map(FIX.letters.map((l) => [l.id, l]));

test("cap: no sender fills more than 2 of the 8 slots, and the strip still fills", () => {
  const picked = spreadDeliveries(FIX.latestDeliveries);
  const per = {};
  for (const d of picked) per[d.from] = (per[d.from] ?? 0) + 1;
  assert.ok(Math.max(...Object.values(per)) <= 2, JSON.stringify(per));
  // the fixture has four senders, so 2 + 2 + 2 + 1 = 7 is the most the cap allows
  assert.equal(picked.length, 7);
  assert.deepEqual(per, { alder: 2, birch: 2, cedar: 2, dune: 1 });
});

test("order: newest first is kept, and the first two of a dominant sender are the newest two", () => {
  const picked = spreadDeliveries(FIX.latestDeliveries);
  assert.deepEqual(picked.map((d) => d.id), [
    "alder-2026-10-30-you-d-like-one",
    "alder-2026-10-30-it-s-the-third-lamp",
    "birch-2026-10-28-don-t-forget-the-ferry",
    "cedar-2026-10-27-a-plain-title",
    "cedar-2026-10-27-i-m-here",
    "dune-2026-10-26-vitamin-d-for-the-lamps",
    "birch-2026-10-25-second-from-birch",
  ]);
});

test("size: never more than 8, and the cap is a parameter", () => {
  const many = Array.from({ length: 30 }, (_, i) => ({ id: `s${i}-x`, from: `s${i}`, date: "2026-10-01" }));
  assert.equal(spreadDeliveries(many).length, 8);
  assert.equal(spreadDeliveries(FIX.latestDeliveries, { perSender: 1 }).length, 4);
  assert.deepEqual(spreadDeliveries(null), []);
  assert.deepEqual(spreadDeliveries([]), []);
});

test("punctuation: a dropped apostrophe comes back as the page's curly one", () => {
  const t = (id) => deliveryTitle({ id }, letterById);
  assert.equal(t("alder-2026-10-30-you-d-like-one"), "you’d like one");
  assert.equal(t("alder-2026-10-30-it-s-the-third-lamp"), "it’s the third lamp");
  assert.equal(t("alder-2026-10-29-we-ll-need-more-rope"), "we’ll need more rope");
  assert.equal(t("birch-2026-10-28-don-t-forget-the-ferry"), "don’t forget the ferry");
  assert.equal(t("cedar-2026-10-27-i-m-here"), "i’m here");
  assert.equal(restoreApostrophes("they re sure you ve seen it, kai s garden"), "they’re sure you’ve seen it, kai’s garden");
});

test("punctuation: words that only look like contractions are left alone", () => {
  assert.equal(deliveryTitle({ id: "dune-2026-10-26-vitamin-d-for-the-lamps" }, letterById), "vitamin d for the lamps");
  assert.equal(restoreApostrophes("plan t is a go"), "plan t is a go");
  assert.equal(restoreApostrophes("re entry"), "re entry");
  assert.equal(restoreApostrophes(""), "");
});

test("fallback: a letter's own title wins; with none, the slug (apostrophes restored); an id with no slug is itself", () => {
  assert.equal(deliveryTitle({ id: "cedar-2026-10-27-a-plain-title" }, letterById), "A plain title, with its own comma");
  assert.equal(deliveryTitle({ id: "alder-2026-10-29-more-from-alder" }, letterById), "more from alder");
  assert.equal(deliveryTitle({ id: "alder-2026-10-29-more-from-alder" }), "more from alder", "no letter book: the slug");
  assert.equal(deliveryTitle({ id: "alder-2026-10-29" }, letterById), "alder-2026-10-29", "threadTitle's own fallback is unchanged");
});

test("wiring: the front page's ticker reads these helpers, and keeps arrivals and the all-deliveries link", () => {
  const page = readFileSync(join(ROOT, "town", "pages", "index.astro"), "utf8");
  assert.match(page, /spreadDeliveries\(stats\.latestDeliveries\)/);
  assert.match(page, /deliveryTitle\(d, letterById\)/);
  assert.doesNotMatch(page, /latestDeliveries\.slice\(0, 8\)/);
  assert.match(page, /stats\.arrivals\.slice\(0, 3\)/);
  assert.match(page, /href: letterHref\(d\.id, letterBook\)/);
  assert.match(page, /all \{stats\.deliveries\} deliveries →/);
});
