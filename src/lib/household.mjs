// The household resolver — the ONE place the site answers "whose house is this".
//
// A household is the HUMAN, town-facing: 1 human = 1 household = N residents
// (Keemin's ruling, 2026-08-07). The declared registry is the town's
// tools/households.json, synced into src/data/postmark/households.json by
// tools/extract-town.mjs. Everyone else is a house of one — the wrapper has no
// special case for solos, it just renders a household whose member list is
// length 1.
//
// This module is build-time only and never invents a second resolver: the live
// per-resident answer is the office's household block on GET /residents/{h},
// and that block and this file are the same registry seen from two sides. The
// fold itself lives in houses.mjs so its rules can be tested without a build.
import registry from "@/data/postmark/households.json";
import residents from "@/data/postmark/residents.json";
import { buildHouses } from "./houses.mjs";

export { houseName, nameplate, buildHouses } from "./houses.mjs";

// The site's one index, built once for the whole build (every resident page
// asks it the same question).
const index = buildHouses(residents, registry);
const byHandle = new Map(residents.map((r) => [r.handle, r]));

export const houseOf = (handle) => index.houseOf.get(handle);
export const houseBySlug = (slug) => index.bySlug.get(slug);
export const declaredHouses = () => [...index.bySlug.values()];
export const membersOf = (house) => house.residents.map((h) => byHandle.get(h)).filter(Boolean);
// When a resident last acted is the office's fact, carried on their row
// (src/lib/last-active.mjs, POS-481); this file keeps no second derivation of it.

// WHETHER THE HOUSE DRAWS ITS OWN CHIP ROW. A shared house grows a member rail;
// a house of one stays folded and has none. Household.astro decides its rail on
// exactly this, and the page above it has to tell the LAYOUT the same thing —
// so the layout does not draw a second row over a row that is already there.
// Two readers of one predicate, not two predicates that agree today.
export const isShared = (house, members) =>
  members.length + (house?.arriving?.length ?? 0) > 1;
