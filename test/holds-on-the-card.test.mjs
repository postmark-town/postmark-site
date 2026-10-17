// holds-on-the-card.test.mjs — WLD-27: a held stack is drawn on its holder's card.
//
// "Held stacks appear on the holder's card and doorstep, NOT as free map pips.
// Supply … site rendering from the authoritative reads." The card's two rows are
// painted from the live office doorstep's `holds` block (fold.mjs § holdsOf,
// paint.mjs § paintHolds) — never from the build, never from a stored count.
//
// WHAT THIS PROVES, AND WHAT IT DOES NOT: the painter itself, driven over a
// card element carrying the exact slots ResidentCard.astro emits (read from the
// component below, not retyped), distinguishes a holding from an absent one —
// rows shown with the office's words, or hidden. It is NOT a browser render of
// the page; no browser runs here.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { holdsOf } from "../src/lib/household-dashboard/fold.mjs";
import { paintHolds } from "../src/lib/household-dashboard/paint.mjs";

const CARD = readFileSync(new URL("../src/components/household-dashboard/ResidentCard.astro", import.meta.url), "utf8");

/** The slots the component emits for the holds rows, as attribute names. */
const SLOTS = ["data-hd-holds-dt", "data-hd-holds", "data-hd-chests-dt", "data-hd-chests"];

/** A card element with exactly those slots, each hidden as the component ships them. */
function fakeCard() {
  const els = new Map();
  for (const a of SLOTS) {
    const m = CARD.match(new RegExp(`<(dt|dd) ${a}( hidden)?>`));
    assert.ok(m, `ResidentCard.astro emits ${a}`);
    els.set(a, { textContent: "", hidden: Boolean(m[2]), title: "" });
  }
  return { els, querySelector: (sel) => els.get(sel.replace(/^\[|\]$/g, "")) ?? null };
}

const doorstep = (holds) => ({ handle: "sbx-cy", holds });

test("a holding shows on the card in the office's own words", () => {
  const card = fakeCard();
  paintHolds(card, doorstep({ serves: "world.holdings", holds: { count: 2, shows: "Test Comets: 2", edges: [{ label: "test-comets", count: 2 }] }, chests: [] }));
  assert.deepEqual([card.els.get("data-hd-holds").textContent, card.els.get("data-hd-holds").hidden, card.els.get("data-hd-holds-dt").hidden], ["Test Comets: 2", false, false]);
  assert.equal(card.els.get("data-hd-chests").hidden, true, "no chests made, no chests row");
});

test("an absent holding is absent: empty hands and an office with no block both leave the rows hidden", () => {
  for (const d of [doorstep({ serves: "world.holdings", count: 0 }), { handle: "sbx-cy" }, doorstep({ unavailable: "could not be read" })]) {
    const card = fakeCard();
    paintHolds(card, d);
    for (const a of SLOTS) assert.equal(card.els.get(a).hidden, true, `${a} hidden for ${JSON.stringify(d)}`);
    assert.equal(card.els.get("data-hd-holds").textContent, "");
  }
});

test("a painted card repainted with empty hands hides the row again — no stale count survives", () => {
  const card = fakeCard();
  paintHolds(card, doorstep({ holds: { count: 3, shows: "101 candies" }, chests: [] }));
  assert.equal(card.els.get("data-hd-holds").hidden, false);
  paintHolds(card, doorstep({ count: 0 }));
  assert.equal(card.els.get("data-hd-holds").hidden, true);
  assert.equal(card.els.get("data-hd-holds").textContent, "");
});

test("the chests row: each chest's live count, or why it is empty", () => {
  const card = fakeCard();
  const h = paintHolds(card, doorstep({ holds: { count: 0 }, chests: [
    { chest: "sbx-cy/the-bowl", count: 18, shows: "Test Comets: 18" },
    { chest: "sbx-cy/the-tin", count: 0, shows: "empty", empty_because: "no candy was registered for sbx-cy, so the town has not stocked it" },
  ] }));
  assert.equal(card.els.get("data-hd-chests").textContent, "the bowl — Test Comets: 18 · the tin — empty: no candy registered yet");
  assert.match(card.els.get("data-hd-chests").title, /no candy was registered for sbx-cy/);
  assert.equal(card.els.get("data-hd-holds").hidden, true, "a resident whose candy is all in their chest holds nothing in hand");
  assert.equal(h.chests.length, 2);
});

test("holdsOf reads only the office's block — a top-level count of zero is empty hands", () => {
  assert.equal(holdsOf(null), null);
  assert.deepEqual(holdsOf(doorstep({ count: 0 })), { holds: null, chests: [] });
  assert.equal(holdsOf(doorstep({ unavailable: "x" })), null);
});

test("[source pin, not a render] the card painter paints the holds rows for each resident's live doorstep", () => {
  const src = readFileSync(new URL("../src/lib/household-dashboard/paint.mjs", import.meta.url), "utf8");
  const cards = src.slice(src.indexOf("function paintCards("), src.indexOf("function paintCards(") + 4000);
  assert.match(cards, /paintHolds\(card, reads\.doorsteps\?\.\[h\]\);/);
});

test("a chest they are carrying shows on their card with whose it is; one they made that someone carries says who", () => {
  const card = fakeCard();
  paintHolds(card, { handle: "sbx-cy", holds: { args: { handle: "sbx-cy" }, holds: { count: 0 }, chests: [
    { chest: "sbx-ana/the-bag", by: "sbx-ana", held_by: "sbx-cy", count: 30, shows: "Test Comets: 30" },
  ] } });
  assert.equal(card.els.get("data-hd-chests").textContent, "the bag (sbx-ana's) — Test Comets: 30");
  const maker = fakeCard();
  paintHolds(maker, { handle: "sbx-ana", holds: { args: { handle: "sbx-ana" }, holds: { count: 0 }, chests: [
    { chest: "sbx-ana/the-bag", by: "sbx-ana", held_by: "sbx-cy", count: 30, shows: "3 things" },
  ] } });
  assert.equal(maker.els.get("data-hd-chests").textContent, "the bag, carried by sbx-cy — 3 things");
});
