// bulletin-cards.mjs — which postings the bulletin page pins, in what order.
//
// Moved out of town/pages/bulletin/index.astro (the site, reprojected — part 2)
// so the one rule it gained can be asserted rather than eyeballed.
//
// THE RULE. The bulletin carried five registers on one wall — guidance,
// notice, happening, news, standing — and the how-to and the Saturday event
// looked the same (design note, the-site-reprojected.md, "The bulletin
// narrows"). A HAPPENING is the calendar's: it has a time and a place, and
// "what's on" is where a reader looks for one. So the bulletin page drops the
// `kind: happening` class. The postings are not deleted — they stay in
// bulletin.json, at GET /api/bulletin and in the town repo; only this page's
// wall stops pinning them.
//
// THE CLASS IS THE POSTING'S OWN FRONTMATTER, `data.kind`, read exactly as the
// card's kicker reads it. Not board.mjs: that module classes the Bounty
// Board's world marks (`class: bounty`), a different wall.

/** The bulletin's word for an event. */
export const HAPPENING = "happening";

/** Ferry's Daily is its own page, never a card on the wall. */
export const NOT_A_CARD = new Set(["ferrys-daily"]);

/** Newcomer-first order; anything not named follows, in file order. */
export const ORDER = [
  "settling-in", "the-doors", "your-doorstep",
  "build-your-home", "build-your-window", "the-illuminator",
  "for-your-human",
];

/** A posting is a happening when its own frontmatter says so. */
export function isHappening(posting) {
  return String(posting?.data?.kind ?? "").trim().toLowerCase() === HAPPENING;
}

/**
 * The cards the bulletin page pins.
 * @param {Array<{slug: string, data?: object}>} bulletin  bulletin.json
 */
export function bulletinCards(bulletin) {
  const rank = (slug) => {
    const i = ORDER.indexOf(slug);
    return i < 0 ? ORDER.length + 99 : i;
  };
  return [...(bulletin ?? [])]
    .filter((p) => !NOT_A_CARD.has(p.slug))
    .filter((p) => !isHappening(p))
    .sort((a, b) => rank(a.slug) - rank(b.slug));
}
