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

const rank = (slug) => {
  const i = ORDER.indexOf(slug);
  return i < 0 ? ORDER.length + 99 : i;
};

/**
 * Every posting the page can OPEN — its deep links, /bulletin/#<slug>. A
 * happening is unpinned but still opens: the home page's signed-in card band
 * links the newest postings by slug, doorsteps and letters carry these links,
 * and an old link that opens nothing is a broken link. Unpinning is the wall's
 * business; the address keeps answering.
 * @param {Array<{slug: string, data?: object}>} bulletin  bulletin.json
 */
export function bulletinPostings(bulletin) {
  return [...(bulletin ?? [])]
    .filter((p) => !NOT_A_CARD.has(p.slug))
    .sort((a, b) => rank(a.slug) - rank(b.slug));
}

/**
 * The cards the bulletin page PINS: every posting it can open, less the
 * happenings.
 * @param {Array<{slug: string, data?: object}>} bulletin  bulletin.json
 */
export function bulletinCards(bulletin) {
  return bulletinPostings(bulletin)
    .filter((p) => !isHappening(p));
}

// ── THE HOME PAGE'S SIGNED-IN CARD BAND (Site UX campaign, POS-855, D7) ──────
// The signed-in reader's front door shows the newest postings as teaser cards.
// It used to take the six newest of everything but Ferry's Daily, which hung
// the calendar's happenings (a trick-or-treat night, an ended invitation) on
// the front door after their day.
//
// THE RULE (D7, as amended 11-01 18:15). The band keeps the wall's "not the
// Daily" and does NOT drop happenings wholesale: the wall unpins them, so this
// band is the only door some of them have. It skips a posting whose OWN
// frontmatter marks it closed — `data.status`, the structured field the
// postings carry. "closed", "ended" and "past" mean finished: the town's word
// for a finished posting is `past` (Wright, 00:18Z); the other two are kept as
// the plain words. Any other word (open, live, resting) has no finished
// meaning, so it never hides a card: hiding a happening takes away its only
// door. Nothing is guessed from a date.

/** How many cards the lens band hangs at most. */
export const LENS_LIMIT = 6;

/**
 * The `data.status` words that mean the posting is over: it is not a current
 * posting. Anything else, or no status at all, is current. `past` is the town's
 * own word for a finished posting (Wright, 00:18Z).
 */
export const CLOSED_STATUSES = Object.freeze(["closed", "ended", "past"]);

/** A posting is closed when its own `status` says so. */
export function isClosed(posting) {
  return CLOSED_STATUSES.includes(String(posting?.data?.status ?? "").trim().toLowerCase());
}

// THE DATE A POSTING IS ORDERED BY (Site UX, POS-855, front-latest). Every
// bulletin date on the site is `data.posted`. A posting may also carry an
// optional `data.updated`, for a keeper who revises a posting and wants it back
// at the top. A posting cannot have been updated before it was posted, so the
// date it is ordered by is the LATER of the two: when `updated` is present (not
// blank) and later than `posted`, it is the date ordered by AND shown, worded
// "updated <date>"; otherwise (no `updated`, or one that is not later, a stray
// older date) `posted` is, exactly as before. No posting carries `updated`
// today, so nothing reorders until a keeper adds one (finding F-27).

/**
 * The date a posting is ordered and shown by: the later of `data.updated` and
 * `data.posted`, `posted` when `updated` is blank, missing or not later (taken
 * as written, so the order without `updated` is the old order, byte for byte).
 * Empty when the posting has neither.
 * @param {{data?: object}} posting
 * @returns {{date: string, updated: boolean}}
 */
export function postingStamp(posting) {
  const posted = String(posting?.data?.posted ?? "");
  const updated = String(posting?.data?.updated ?? "");
  if (updated.trim() && updated.trim().localeCompare(posted.trim()) > 0) return { date: updated, updated: true };
  return { date: posted, updated: false };
}

/**
 * The words that date a posting for a reader: "<date>", or "updated <date>"
 * when the posting is ordered by `updated`; empty when it has no date. `fmt`
 * words the date itself (the pages pass pm.mjs's fmtDate).
 * @param {{data?: object}} posting
 * @param {(iso: string) => string} [fmt]
 */
export function postingWhen(posting, fmt = (d) => d) {
  const { date, updated } = postingStamp(posting);
  if (!date) return "";
  return updated ? `updated ${fmt(date.trim())}` : fmt(date);
}

/**
 * The postings the signed-in card band shows: every posting but Ferry's Daily
 * and those marked closed (a happening that is not closed stays), newest
 * first by the later of `updated` and `posted` (postingStamp), at most
 * `limit`. Ties keep the bulletin's file order (a stable sort). An empty list
 * is a real answer: the page then shows the story band instead of an empty one.
 * Callers: the home page's signed-in band (LENS_LIMIT) and its signed-out
 * "Latest on the bulletin" list (latestPostings); nothing else.
 * @param {Array<{slug: string, data?: object}>} bulletin  bulletin.json
 * @param {number} [limit]
 */
export function lensPostings(bulletin, limit = LENS_LIMIT) {
  return (bulletin ?? [])
    .filter((p) => !NOT_A_CARD.has(p.slug) && !isClosed(p))
    .sort((a, b) => postingStamp(b).date.localeCompare(postingStamp(a).date))
    .slice(0, limit);
}

/** How many postings the signed-out front page lists under the story. */
export const LATEST_LIMIT = 3;

/**
 * The signed-out front page's "Latest on the bulletin": the first LATEST_LIMIT
 * of lensPostings, so it is the same postings in the same order the signed-in
 * band opens with, never a second rule.
 * @param {Array<{slug: string, data?: object}>} bulletin  bulletin.json
 */
export function latestPostings(bulletin) {
  return lensPostings(bulletin, LATEST_LIMIT);
}

// ── PINNED FOR EVERYONE (Keemin, 2026-09-27) ────────────────────────────────
// "For the notices, we should have a couple of them always pinned at the top:
// PSAs are an obvious choice … pin 1-2 more durable ones. These should be
// marked with a standout red pin." The two beside the PSAs are the town's
// standing orientation, the notices a newcomer needs whatever the week:
// settling in, and the doors every resident works through.
export const PINNED = Object.freeze(["public-service-announcements", "settling-in", "the-doors"]);

/** A notice the sub-board always pins first, under a red pin. */
export function isPinned(posting) {
  return PINNED.includes(posting?.slug);
}

/**
 * The notices' sub-board: the cards, with the pinned ones first in PINNED's
 * order and the rest in the wall's own order. A pinned slug the town has
 * retired simply drops out; nothing is made up to fill its place.
 * @param {Array<{slug: string, data?: object}>} bulletin  bulletin.json
 */
export function subBoard(bulletin) {
  const cards = bulletinCards(bulletin);
  const pinned = PINNED.map((s) => cards.find((p) => p.slug === s)).filter(Boolean);
  return [...pinned, ...cards.filter((p) => !isPinned(p))];
}
