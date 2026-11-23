// rail-pages.mjs — a main-rail seat's pages, for the list its header shows (CORE-164).
//
// Darko, 2026-11-23 08:37 EST: "can we make it so you can hover over any of the main rail headers to see their pages as a vertical list?"
//
// THE PAGES ARE READ FROM WHERE THE SITE ALREADY LISTS THEM, never from a second hand-kept copy:
//   · a seat with a chip row (The World, Docs) lists its members, through nav.mjs § shownMembers, the same rule the chip row uses: a held
//     member never, a flagged one only while its flag is on; in the row's order, with its beta mark and its external address;
//   · The Town has no chip row (the Site Lift: the board holds the town), and its pages are the board's pieces, town-views.mjs § BOARD_PIECES,
//     in the board's order: a piece with a page of its own links there (what the piece links to with JavaScript off), and the notices,
//     which have none, link to their view on the board (/bulletin/#notices, which viewOf opens);
//   · every other seat (Postmark, The Mail, Sparks, The Households, Join) has no list: one door and its own instances (a letter, a Spark, a
//     resident, a house) are content, not the section's navigation, so a header without pages shows nothing.
//
// Pure: data in, rows out. `here` marks the row whose own address is the page the reader is on (by path, because the board's pieces carry
// no page keys: /town/ answers to "town", the seat's own key, not to its piece's "quarter").

import { RAIL, shownMembers } from "./nav.mjs";
import { BOARD_PIECES } from "./town-views.mjs";

/** The Town's pages: the board's pieces, each at its own page, or at its view on the board when it has none. */
const townPages = () => BOARD_PIECES.map((p) => ({ key: p.key, label: p.label, href: p.page ?? `/bulletin/#${p.hash}` }));

/**
 * A seat's pages as `[{ key, label, href, external, beta, here }]`, or null when the seat has none (no list is drawn).
 * `path` is the page's own root-relative path (Astro.url.pathname), `flags` the build's nav flags.
 */
export function railPages(seat, { path = null, flags = {} } = {}) {
  if (!seat || seat.lantern) return null;
  const rows = seat.members ? shownMembers(seat, flags).map((m) => ({ key: m.key, label: m.label, href: m.href, external: !!m.external, beta: !!m.beta }))
    : seat.key === "town" ? townPages()
    : [];
  if (!rows.length) return null;
  return rows.map((r) => ({ external: false, beta: false, ...r, here: !!path && !r.external && r.href === path }));
}

/** Every seat's list, keyed by the seat (only the seats that have one): what the layout draws. */
export const railPageLists = (opts) => Object.fromEntries(RAIL.map((s) => [s.key, railPages(s, opts)]).filter(([, rows]) => rows));
