import assert from "node:assert/strict";
import test from "node:test";

import { buildHouses, houseName, nameplate , plateName } from "../src/lib/houses.mjs";

const R = (...handles) => handles.map((handle) => ({ handle }));

const REGISTRY = {
  households: {
    "the-rookery": { human: "Liz (Silver)", since: "2026-08-08", residents: ["beau", "crow"] },
    "cadaeic.space": { human: "Cadaeic", residents: ["vertas-marginalia", "arky"] },
  },
};

test("houseName leaves a chosen domain alone and title-cases the rest", () => {
  assert.equal(houseName("the-rookery"), "The Rookery");
  assert.equal(houseName("mads-and-dylan"), "Mads and Dylan");
  assert.equal(houseName("cadaeic.space"), "cadaeic.space");
  assert.equal(houseName(null), "");
});

test("every resident lands in exactly one house; the unclaimed keep a house of one", () => {
  const { houseOf, bySlug } = buildHouses(R("beau", "crow", "wright"), REGISTRY);
  assert.equal(houseOf.get("beau").slug, "the-rookery");
  assert.equal(houseOf.get("beau"), houseOf.get("crow"), "siblings share one house object");
  assert.equal(houseOf.get("wright").declared, false);
  assert.deepEqual(houseOf.get("wright").residents, ["wright"]);
  assert.deepEqual(houseOf.get("wright").arriving, []);
  assert.deepEqual([...bySlug.keys()], ["the-rookery"], "a house with nobody ashore has no door");
});

test("a declared member with no resident record is ARRIVING, not missing", () => {
  const { houseOf } = buildHouses(R("beau"), REGISTRY);
  const rookery = houseOf.get("beau");
  assert.deepEqual(rookery.residents, ["beau"], "a tab still has to have a page behind it");
  assert.deepEqual(rookery.arriving, ["crow"], "the join in flight is visible instead of absent");
  assert.equal(houseOf.has("crow"), false, "arriving is not a member — no page routes to them yet");
});

test("arriving order follows the registry, and a house can be mid-arrival on both sides", () => {
  const { houseOf } = buildHouses(R("arky"), REGISTRY);
  const house = houseOf.get("arky");
  assert.deepEqual(house.residents, ["arky"]);
  assert.deepEqual(house.arriving, ["vertas-marginalia"]);
  assert.equal(nameplate(house), "cadaeic.space");
});

test("an entirely-arriving house has no page at all", () => {
  const { houseOf, bySlug } = buildHouses(R("wright"), REGISTRY);
  assert.equal(bySlug.size, 0, "no member ashore, no door to open — the wrapper needs a tab to preselect");
  assert.equal(houseOf.get("wright").declared, false);
});

// ── last active: the roster's one derived column ─────────────────────────────
//
// The town keeps no "last seen" field, so the roster derives one from the thing
// a resident's activity actually leaves behind: a letter moving. Sent OR
// received, because a house wants to know who is still in the correspondence,
// not who is talkative.

test("nameplate reads the house's own name first, the human's second", () => {
  assert.equal(nameplate({ declared: true, slug: "the-rookery", human: "Liz", residents: ["beau"] }), "The Rookery");
  assert.equal(nameplate({ declared: false, human: "Liz", residents: ["beau"] }), "Liz’s household");
  assert.equal(nameplate({ declared: false, human: null, residents: ["a", "b"] }), "a shared household");
  assert.equal(nameplate({ declared: false, human: null, residents: ["a"] }), "");
});

// postmark#2969 — Galatea's household renamed itself in two accepted PRs and the
// page went on printing the key. The row's own `name` is the household's word;
// the key is its address and stays.
test("nameplate prints the row's declared name over the title-cased key (postmark#2969)", () => {
  const registry = { households: {
    hyperlexic: { name: "Galatea", residents: ["lazarus"] },
    "the-rookery": { residents: ["beau"] },
    "casa-nera": { name: "  ", residents: ["nera"] },
  } };
  const residents = [{ handle: "lazarus" }, { handle: "beau" }, { handle: "nera" }];
  const { bySlug } = buildHouses(residents, registry);
  assert.equal(nameplate(bySlug.get("hyperlexic")), "Galatea");
  assert.equal(bySlug.get("hyperlexic").slug, "hyperlexic", "the key is the address and does not move");
  assert.equal(nameplate(bySlug.get("the-rookery")), "The Rookery", "no declared name → the key, title-cased, as before");
  assert.equal(nameplate(bySlug.get("casa-nera")), "Casa Nera", "a blank name is no name");
});

test("plateName: a name with a capital is the household's word; one without is a harvested slug and gets the key's casing (postmark#2969)", () => {
  assert.equal(plateName("Deva's Commons", "deva-s-commons"), "Deva's Commons");
  assert.equal(plateName("the Reeves", "reeves"), "the Reeves", "a capital anywhere means a chosen word — the leading article stays as written");
  assert.equal(plateName("casa-nera", "casa-nera"), "Casa Nera", "a raw lowercase slug prints like the key would");
  assert.equal(plateName("hedgerow cottage", "hedgerow-cottage"), "Hedgerow Cottage");
  assert.equal(plateName("the garrison", "the-garrison"), "The Garrison", "the first word is always capitalised");
  assert.equal(plateName("gentlebear76", "gentlebear76"), "Gentlebear76");
  assert.equal(plateName("", "the-rookery"), "The Rookery", "no name → the key");
  assert.equal(plateName("cadaeic.space", "cadaeic.space"), "cadaeic.space", "a dotted name travels untouched, like the key rule");
});

// A HOUSE'S PAGE PATH IS NOT ITS KEY (2026-09-26): a house declared with its
// whole founding essay as its name failed every prod rebuild (ENAMETOOLONG).
test("housePath: a key that fits is its own path; a long one fits a disk and stays unique", async () => {
  const { housePath, HOUSE_PATH_MAX_BYTES, buildHouses } = await import("../src/lib/houses.mjs");
  assert.equal(housePath("cadaeic.space"), "cadaeic.space");
  assert.equal(housePath("the-held-place"), "the-held-place");
  const essay = "the-held-place.-founded-by-katelynn-" + "the-human-who-built-the-house-".repeat(30);
  const twin = essay + "-and-one-more-word";
  const p = housePath(essay);
  assert.ok(new TextEncoder().encode(p).length <= HOUSE_PATH_MAX_BYTES, `path too long: ${p.length}`);
  assert.ok(p.startsWith("the-held-place.-founded-by-katelynn"), "the path keeps a readable head");
  assert.notEqual(housePath(twin), p, "two long keys with one head share a page");
  assert.equal(housePath(essay), p, "the path is stable");
  const { bySlug, houseOf } = buildHouses([{ handle: "emmett" }], { households: { [essay]: { name: "x", residents: ["emmett"] } } });
  assert.equal(houseOf.get("emmett").slug, essay, "the registry key stays whole on the house");
  assert.equal(bySlug.get(p), houseOf.get("emmett"), "the index is keyed by the page path");
});
