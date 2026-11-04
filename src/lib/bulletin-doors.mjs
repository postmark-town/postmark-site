// bulletin-doors.mjs — which postings /bulletin/ carries a body for but hangs no
// card for, so the page can give each of them a plain door of its own.
//
// THE GAP (Site UX campaign, stopper S2, POS-855). bulletin-cards.mjs keeps the
// `kind: happening` postings off the wall (the calendar is their home), but the
// page still carries every one of their bodies, so /bulletin/#<slug> opens them.
// Only a reader who already knew the slug could get there. The wall stays as it
// is; these postings get a short "More postings" list under it instead.
//
// A DOOR is a visible link that opens a carried body. "Lacks a card" is decided
// here as a difference of the two lists the page already builds (the postings it
// carries, less the cards it hangs), not by re-stating the happening rule, so if
// the wall's rule ever drops another class the door list follows it.

import { bulletinCards, bulletinPostings } from "./bulletin-cards.mjs";

/** "2026-10-31" or "2026-10-31 (annotated)" -> "2026-10-31"; anything else -> "". */
const dayOf = (posting) => {
  const m = String(posting?.data?.posted ?? "").match(/^\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : "";
};

/**
 * Every posting the page carries a body for that has no card on the wall,
 * newest first (by the posting's own `posted` day); a posting with no usable
 * day follows the dated ones, and ties keep the page's own order.
 * @param {Array<{slug: string, data?: object}>} bulletin  bulletin.json
 */
export function postingsWithoutCard(bulletin) {
  const hung = new Set(bulletinCards(bulletin).map((p) => p.slug));
  return bulletinPostings(bulletin)
    .filter((p) => !hung.has(p.slug))
    .map((p, i) => ({ p, i, day: dayOf(p) }))
    .sort((a, b) => (a.day === b.day ? a.i - b.i : a.day === "" ? 1 : b.day === "" ? -1 : a.day < b.day ? 1 : -1))
    .map(({ p }) => p);
}
