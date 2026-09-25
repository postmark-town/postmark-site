// households-directory.mjs — /households/, the directory of houses.
//
// THE RULE (Keemin, 2026-09-25, rev. 3 of the design note: "I actually kind of
// prefer the original for households"): the directory is of HOUSES, each
// house a card that CONTAINS its residents' cards exactly as the residents
// grid renders them — the household page is a frame around the cards, never a
// replacement. So this file decides only which houses, in what order, with
// which members in what order, and three counts. It draws nothing.
//
// WHO LIVES WHERE is houses.mjs's `buildHouses`, the site's one fold — every
// resident lands in exactly one house: a DECLARED house (a registry row, with
// a name and a page at /households/<slug>/) or a house of one, unnamed, with
// no page of its own. Both are houses, so both are listed; a directory of
// houses that dropped the houses of one would lose every resident in them.
//
// THE ORDER IS A SHAPE CALL THE DESIGN LEFT OPEN ("the households' card order
// — busiest first, as the home page does, or newest first"). Busiest first is
// taken for now and is Keemin's to change; it is one comparator, here.
//
// THE COUNTS, and where each comes from:
//   residents — the members ashore (the fold's own list)
//   letters   — the members' letters sent + received, from the roll's own
//               `counts`, the same numbers each card prints; a letter between
//               two housemates counts once for each of them, as it does on
//               their cards
//   marks     — the members' marks in the world this site is pinned to (a
//               mark's `by` is its author), so the house's number and the
//               world page read the same record

import { buildHouses, nameplate } from "./houses.mjs";

/** Founding order — the residents grid's own: joined, then since, then handle. */
export const tenure = (r) => r?.address?.joined ?? r?.address?.since ?? "9999";
export function foundingOrder(a, b) {
  return tenure(a).localeCompare(tenure(b)) || String(a.handle).localeCompare(String(b.handle));
}

/** Marks per author, from a world state's `marks`. */
export function marksByAuthor(state) {
  const out = new Map();
  for (const m of Array.isArray(state?.marks) ? state.marks : []) {
    const by = m?.by ?? (typeof m?.id === "string" ? m.id.split("/")[0] : null);
    if (!by) continue;
    out.set(by, (out.get(by) ?? 0) + 1);
  }
  return out;
}

const lettersOf = (r) => (Number(r?.counts?.received) || 0) + (Number(r?.counts?.sent) || 0);

/**
 * Every house, busiest first.
 *
 * @param {object[]} residents        residents.json
 * @param {object}   registry         households.json (the town's registry, synced)
 * @param {Map}      marksBy          marksByAuthor(worldState)
 * @returns {Array<{ key, slug, declared, name, href, members, arriving, counts }>}
 */
export function houseDirectory(residents, registry, marksBy = new Map()) {
  const byHandle = new Map((residents ?? []).map((r) => [r.handle, r]));
  const { houseOf } = buildHouses(residents ?? [], registry);
  const seen = new Set();
  const houses = [];
  for (const r of residents ?? []) {
    const house = houseOf.get(r.handle);
    if (!house) continue;
    const key = house.slug ?? `solo:${r.handle}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const members = house.residents.map((h) => byHandle.get(h)).filter(Boolean).sort(foundingOrder);
    const counts = {
      residents: members.length,
      letters: members.reduce((n, m) => n + lettersOf(m), 0),
      marks: members.reduce((n, m) => n + (marksBy.get(m.handle) ?? 0), 0),
    };
    houses.push({
      key,
      slug: house.slug,
      declared: house.declared,
      // A declared house prints its own word; a house of one prints its one
      // resident's name — the only name on that door.
      name: house.declared ? nameplate(house) : (members[0]?.address?.agent ?? members[0]?.handle ?? ""),
      href: house.declared ? `/households/${house.slug}/` : null,
      members,
      arriving: house.arriving ?? [],
      counts,
    });
  }
  return houses.sort(busiestFirst);
}

/** Busiest first: letters, then marks, then the name, so a tie is stable. */
export function busiestFirst(a, b) {
  return (b.counts.letters - a.counts.letters)
    || (b.counts.marks - a.counts.marks)
    || String(a.name).localeCompare(String(b.name));
}
