// bulletin-notice.mjs — one posting, read as a notice: the set of postings that
// get a page of their own, the address of each, and the one function that turns
// a posting's body into the HTML a reader sees.
//
// THE GAP (Site UX campaign, POS-855, cold walks of 11-01). A posting had no
// page of its own: /bulletin/<slug>/ was a 404, and the body lived only in a
// <template data-note> that a script copies into the small window on /bulletin/.
// A reader without JavaScript, and an agent fetching text, could not read it.
//
// THE RULE. Every posting the board already CARRIES (bulletinPostings, the set
// that gets a <template data-note>) has a static page at /bulletin/<slug>/,
// built from the same public projection and nothing else. No posting the board
// does not carry gets one, and nothing the board does not show is shown here.
// The page and the small window draw the body through ONE function,
// noticeBodyHtml, by way of ONE component (src/components/NoticeBody.astro), so
// the rendering and sanitising rules (pm.mjs md: raw HTML is escaped, relative
// links resolve to the town repo) cannot drift between them.

import { md } from "./pm.mjs";
import { NOSCRIPT_NOTICES } from "./town-views.mjs";
import { bulletinCards, bulletinPostings, isPinned } from "./bulletin-cards.mjs";

/** The town-repo directory the postings are filed in (relative links resolve to it). */
export const NOTICE_REPO_DIR = "TOWN_BULLETIN";

/**
 * Where a page's "back to the board" goes: the board, at the notices. It uses
 * the notices' no-script address, NOSCRIPT_NOTICES, because that one address
 * works both ways. With script, viewOf (town-views.mjs) reads it as the notices
 * view and no element carries it, so nothing scrolls. Without script, it is the
 * id of the notices' list in the board's <noscript>, the same address the board's
 * own notices piece links to. `#notices` still opens the notices with script; it
 * just has no element to land on without it.
 */
export const BOARD_NOTICES_PATH = `/bulletin/#${NOSCRIPT_NOTICES}`;

// THE QUEST BOARD IS A NOTICE, NOT A PAGE SECTION (site-ux, POS-855). Its card
// is the sticky note whose slug is `quests`: a click opens that notice in the
// small window, and `#quests` is its address on the board, not an anchor to
// scroll to. What the notice holds is the standings, so without script the card
// goes to the standings page, and the notice carries a plain road to the quests
// a reader can take. Nothing about which quests exist or how they count is read
// or changed here.
export const QUEST_NOTICE = "quests";
export const QUEST_STANDINGS = "/town/quests/";
export const QUEST_OFFERS = "/town/#quests";

/** The static address of one posting's page. */
export const noticePath = (slug) => `/bulletin/${slug}/`;

/**
 * Every posting that gets a page: exactly the postings the board carries a body
 * for, in the board's own order. It is bulletinPostings itself, not a second
 * rule, so the page set cannot grow or shrink apart from the set of templates.
 * @param {Array<{slug: string, data?: object}>} bulletin  bulletin.json
 */
export function noticePages(bulletin) {
  return bulletinPostings(bulletin);
}

/**
 * The HTML of a posting's body. The one call both the small window's template
 * and the posting's own page make (through NoticeBody.astro).
 * @param {{body?: string}} posting
 */
export function noticeBodyHtml(posting) {
  return md(posting?.body, { repoDir: NOTICE_REPO_DIR });
}

/**
 * The kicker a notice wears: "pinned for everyone", its own kind, or "on the
 * calendar" for a posting the wall does not hang (the happenings).
 * @param {{slug: string, data?: object}} posting
 * @param {Array<{slug: string, data?: object}>} bulletin  bulletin.json
 */
export function noticeKind(posting, bulletin) {
  const hung = bulletinCards(bulletin).some((c) => c.slug === posting.slug);
  if (!hung) return "on the calendar";
  return isPinned(posting) ? "pinned for everyone" : (posting.data?.kind ?? "notice");
}
