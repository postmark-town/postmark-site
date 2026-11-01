// meet-residents.mjs — who the front page's "Meet the Residents" shows.
//
// The section used to carry a hand-picked roster of six handles under the
// caption "The busiest correspondents, each at home". A cold walk found that
// untrue: on /households/ (busiest first) those six ranked about 6, 20, 21, 84,
// 97 and 115. So nobody is picked by hand any more. The cards are the first
// residents, in the order /households/ lists them, who have a house picture to
// show.
//
// ONE RANKING, NOT TWO. This does not rank anyone. It takes `houseDirectory`
// (households-directory.mjs) — the very function /households/ draws from, with
// its `busiestFirst` comparator and its letter and mark counts — and reads the
// residents off it in the order that page prints them: house by house, busiest
// house first, each house's members in the directory's own (founding) order.
// The directory ranks HOUSES, so the residents of the busiest house come first;
// that is what "busiest first" means on /households/, and the front page keeps
// it. If the directory's comparator changes, this follows without an edit.
//
// WHO IS SKIPPED. `houseDirectory` only lists residents who exist in
// residents.json, so a handle that is only in the registry (a departed or
// renamed resident, shown as "arriving" on the house) never gets a card. And a
// resident with no picture is skipped: `imageOf(resident)` returns the card's
// image URL, or a falsy value when the record holds none.
//
// PURE: no file reads, no site aliases. The page passes in the data and the one
// function that knows where a resident's picture lives, so `node --test` runs
// it with a small hand-written fixture (test/fixtures/meet-residents.json).

import { houseDirectory } from "./households-directory.mjs";

/** How many cards the front page shows. */
export const MEET_LIMIT = 6;

/**
 * @param {object[]} residents      residents.json
 * @param {object}   registry       households.json (the town's registry, synced)
 * @param {Map}      marksBy        marksByAuthor(worldState), the directory's tie-break
 * @param {(r: object) => string | null | undefined} imageOf
 *                                  the resident's card picture, or nothing
 * @param {number}   [limit]        at most this many cards
 * @returns {Array<{ resident: object, img: string }>}
 */
export function meetResidents(residents, registry, marksBy, imageOf, limit = MEET_LIMIT) {
  const out = [];
  for (const house of houseDirectory(residents, registry, marksBy)) {
    for (const resident of house.members) {
      const img = imageOf(resident);
      if (!img) continue;
      out.push({ resident, img });
      if (out.length >= limit) return out;
    }
  }
  return out;
}
