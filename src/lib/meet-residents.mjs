// meet-residents.mjs — who the front page's "Meet the Residents" shows.
//
// The section used to carry a hand-picked roster of six handles under the
// caption "The busiest correspondents, each at home". A cold walk found that
// untrue: on /households/ (busiest first) those six ranked about 6, 20, 21, 84,
// 97 and 115. So nobody is picked by hand any more. The cards are the busiest
// HOUSEHOLDS, in the order /households/ lists them: one resident from each.
//
// ONE RANKING, NOT TWO. This does not rank anyone. It takes `houseDirectory`
// (households-directory.mjs) — the very function /households/ draws from, with
// its `busiestFirst` comparator and its letter and mark counts — and walks its
// houses in that order. If the directory's comparator changes, this follows
// without an edit.
//
// ONE RESIDENT PER HOUSE (the coordinator's D8): from each house, its first
// member in the directory's own (founding) order who has a house picture and is
// not one of the town's working Meeps. A house with no such member is passed
// over, and the next house is looked at, so the six are six different houses.
//
// WHO IS SKIPPED
//   - a working Meep (`skip`, the handles of meeps.json): the Meeps have their
//     own quarter at /meeps/, and "Meet the Residents" is for households. A
//     house of Meeps only is passed over; a house that holds a Meep and a
//     resident shows the resident.
//   - a resident with no picture (`imageOf` gives nothing).
//   - a handle only the registry names (a departed or renamed resident, shown as
//     "arriving" on the house): the directory only lists residents who exist in
//     residents.json, so it never reaches a card.
// If fewer than the limit of houses qualify, the cards are the ones that do.
//
// PURE: no file reads, no site aliases. The page passes in the data and the one
// function that knows where a resident's picture lives (home-face.mjs's
// `cardImageOf`), so `node --test` runs it with a small hand-written fixture
// (test/fixtures/meet-residents.json).

import { houseDirectory } from "./households-directory.mjs";

/** How many cards the front page shows. */
export const MEET_LIMIT = 6;

/**
 * @param {object[]} residents      residents.json
 * @param {object}   registry       households.json (the town's registry, synced)
 * @param {Map}      marksBy        marksByAuthor(worldState), the directory's tie-break
 * @param {(r: object) => string | null | undefined} imageOf
 *                                  the resident's card picture, or nothing
 * @param {{ skip?: Iterable<string>, limit?: number }} [opts]
 *        skip: handles that are not offered (the working Meeps); limit: at most this many cards
 * @returns {Array<{ resident: object, img: string }>}  one per house, busiest house first
 */
export function meetResidents(residents, registry, marksBy, imageOf, { skip = [], limit = MEET_LIMIT } = {}) {
  const skipped = new Set(skip);
  const out = [];
  for (const house of houseDirectory(residents, registry, marksBy)) {
    for (const resident of house.members) {
      if (skipped.has(resident.handle)) continue;
      const img = imageOf(resident);
      if (!img) continue;
      out.push({ resident, img });
      break;
    }
    if (out.length >= limit) break;
  }
  return out;
}
