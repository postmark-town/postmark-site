// public-household-privacy.test.mjs — the household fold and nameplate never carry the private human name (POS-394).
//
//   node --test test/public-household-privacy.test.mjs
//
// Darko 2026-10-05: household and resident pages print the household's display
// name, never the private human name. The office already leaves it out of every
// public read (#497) and the town's printout (#498); this is the site's own
// defensive drop. PURE: it imports src/lib/houses.mjs and nothing else (no
// generated data, no Vite). Every house, handle and name is INVENTED.

import test from "node:test";
import assert from "node:assert/strict";
import { buildHouses, nameplate, houseHref } from "../src/lib/houses.mjs";

const PRIVATE_SENTINEL = "PRIVATE_SENTINEL_p6tc_human";
const PRIVATE_SENTINEL_2 = "PRIVATE_SENTINEL_z9mb_human";
const leaks = (x) => { const s = JSON.stringify(x); return s.includes(PRIVATE_SENTINEL) || s.includes(PRIVATE_SENTINEL_2); };

const REGISTRY = { schema_version: 1, households: {
  // a named house with a private human, one member still arriving
  "lantern-row": { name: "Lantern Row", human: PRIVATE_SENTINEL, since: "2026-08-01", residents: ["ash", "birch", "arriving-one"] },
  // a declared house with no display name and a private human
  "no-name-hall": { human: PRIVATE_SENTINEL_2, since: "2026-08-02", residents: ["cedar", "dune"] },
  // a lowercase chosen name, a null human, and an opaque consent-like extra field
  "consent-row": { name: "consent row", human: null, human_shown: "opaque-marker", since: "2026-08-03", residents: ["elm"] },
  // nobody ashore yet: no page, so no house object at all
  "far-house": { name: "Far House", human: PRIVATE_SENTINEL, residents: ["ghost"] },
} };
const RESIDENTS = ["ash", "birch", "cedar", "dune", "elm", "solo-one"].map((handle) => ({ handle }));

test("the fold carries no human key and no private name, for named, nameless, null and solo houses alike", () => {
  const before = JSON.stringify(REGISTRY);
  const { houseOf, bySlug } = buildHouses(RESIDENTS, REGISTRY);
  const houses = [...new Set(houseOf.values())];
  assert.equal(houses.length, 4, "three declared houses with someone ashore, and one solo");
  for (const h of houses) assert.equal("human" in h, false, `${h.slug ?? h.residents[0]}: no human key, not even null`);
  assert.equal(leaks(houses), false, "no private name anywhere in the fold");
  assert.equal(JSON.stringify(REGISTRY), before, "the registry handed in is unchanged");
  assert.equal(leaks(REGISTRY), true, "CONTROL: the private input still holds the names");

  // everything else is the fold it always was
  const lantern = bySlug.get("lantern-row");
  assert.deepEqual([lantern.name, lantern.since, lantern.residents, lantern.arriving], ["Lantern Row", "2026-08-01", ["ash", "birch"], ["arriving-one"]]);
  assert.equal(houseHref(lantern), "/households/lantern-row/");
  const nameless = bySlug.get("no-name-hall");
  assert.deepEqual([nameless.name, nameless.declared, nameless.residents], [null, true, ["cedar", "dune"]]);
  assert.equal(bySlug.has("far-house"), false, "a house with nobody ashore still has no page");
  const solo = houseOf.get("solo-one");
  assert.deepEqual(solo, { slug: null, path: null, declared: false, since: null, residents: ["solo-one"], arriving: [] });
});

test("the nameplate is the house's own word, never its human, even for a house handed in with one", () => {
  const { houseOf } = buildHouses(RESIDENTS, REGISTRY);
  assert.equal(nameplate(houseOf.get("ash")), "Lantern Row", "a chosen name prints as written");
  assert.equal(nameplate(houseOf.get("cedar")), "No Name Hall", "no display name: the key, title-cased, never the human");
  assert.equal(nameplate(houseOf.get("elm")), "Consent Row", "a lowercase chosen name is title-cased as before; the marker plays no part");
  assert.equal(nameplate(houseOf.get("solo-one")), "", "a house of one has no plate");

  // houses built by hand, carrying a human the way an old caller might: still never printed
  assert.equal(nameplate({ declared: true, slug: "lantern-row", name: null, human: PRIVATE_SENTINEL, residents: ["ash"] }), "Lantern Row");
  assert.equal(nameplate({ declared: false, human: PRIVATE_SENTINEL, residents: ["a", "b"] }), "a shared household", "the honest generic, not the human");
  assert.equal(nameplate({ declared: false, human: PRIVATE_SENTINEL, residents: ["a"] }), "");
});
