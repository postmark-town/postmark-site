// og-image.mjs — the picture a shared postmark.town link previews with
// (POS-616). Build-time and pure: a page hands in what it already has (its
// residents, the media map, the house pictures) and gets back the image its
// <head> names, plus the twitter card that fits that image's shape.
//
// Darko's ruling, 2026-10-13 22:34 EDT: "each page passes its own image to the
// layout, with the banner as the fallback." Before this, every town page
// previewed as the banner, so every link shared on Discord, Reddit or X looked
// identical, even a household page full of its residents' faces.
//
// THE PAGE'S OWN PICTURE, and where each page finds it (the gap read's G1–G6,
// closed by Wright the same night):
//
//   household   the first resident with a portrait, then any member's house
//               picture, then the banner                    householdPreview
//   resident    their own portrait, then their house's chain residentPreview
//   thread,     the first of the given handles with a portrait (the opener,
//   pair        then the other participant), then the Mail card
//   event       the host's portrait, then the calendar card  handlesPreview
//   any other   its section's card                           sectionCard
//
// A portrait is the face the household cards already wear: faces.mjs
// residentFace, shared rather than re-derived, so the card on the page and the
// card in the preview cannot drift apart.
//
// THE CARD FOLLOWS THE SHAPE (G2). Portraits are small squares (257 to 512 px),
// and X's large card crops a square to 2:1 and cuts the face off, so a portrait
// asks for "summary" (a square thumbnail beside the title). The banner, a
// section card and a house picture are wide, and keep "summary_large_image".

import { residentFace } from "./household-dashboard/faces.mjs";
import { sectionOf } from "./nav.mjs";

export const BANNER = "/banner.png";
export const LARGE = "summary_large_image";
export const SMALL = "summary";

/**
 * ONE CARD PER SECTION, in one place (G3/G4). Every entry is the banner for
 * now: nothing in the tree is drawn for a section, and a card is never
 * generated here. When one is drawn, it goes in as a one-line change to this
 * map, and every page of that section picks it up.
 *
 * Keyed by a page's `active`, then by its section's key (nav.mjs RAIL): the
 * calendar and the bulletin are named on their own because the ruling names
 * them, though both stand in The Town; the fund has no seat and no `active`,
 * so its pages ask for "fund" by name.
 */
export const SECTION_CARDS = Object.freeze({
  postmark: BANNER,
  town: BANNER,
  bulletin: BANNER,
  calendar: BANNER,
  fund: BANNER,
  world: BANNER,
  harbor: BANNER,
  mail: BANNER,
  households: BANNER,
  docs: BANNER,
  join: BANNER,
});

/** The card for a page's `active` key: its own entry, its section's, else the banner. */
export function sectionCard(active) {
  if (active && Object.hasOwn(SECTION_CARDS, active)) return SECTION_CARDS[active];
  const section = sectionOf(active);
  return (section && SECTION_CARDS[section.key]) || BANNER;
}

const wide = (image) => ({ image, card: LARGE });
const square = (image) => ({ image, card: SMALL });

/**
 * @typedef {{ media?: Record<string, { card?: string }>, homePicture?: (handle: string) => string | null }} Sources
 *   media        the build's media.json
 *   homePicture  home-picture.mjs homePictureOf (the household record's picture, POS-219)
 */

/** A resident's portrait URL, or null. @param {object} r @param {Sources} [src] */
export function portraitOf(r, { media = {}, homePicture = () => null } = {}) {
  if (!r?.handle) return null;
  return residentFace(r, media, homePicture(r.handle)).avatar ?? null;
}

/** A resident's house picture URL, or null — the face the household card wears. */
function housePictureOf(r, { media = {}, homePicture = () => null } = {}) {
  if (!r?.handle) return null;
  return residentFace(r, media, homePicture(r.handle)).homeFace ?? null;
}

/**
 * A household page's preview (G1). Members are in the house's own order, so
 * "the first resident with a portrait" and "then any member" are one walk.
 * @param {object[]} members  household.mjs membersOf(house)
 * @param {Sources} [src]
 */
export function householdPreview(members, src = {}) {
  for (const m of members ?? []) {
    const p = portraitOf(m, src);
    if (p) return square(p);
  }
  for (const m of members ?? []) {
    const h = housePictureOf(m, src);
    if (h) return wide(h);
  }
  return wide(BANNER);
}

/** A resident's page (G5): their own portrait, then their house's chain. */
export function residentPreview(r, members, src = {}) {
  const p = portraitOf(r, src);
  return p ? square(p) : householdPreview(members, src);
}

/**
 * A thread's handles, its opener first. threads.json sorts `participants` by
 * name, not by who wrote first (806 of 1,626 threads open with the second
 * name), so the opener is the first letter's sender, handed in by the page.
 */
export function openerFirst(participants, opener) {
  const rest = (participants ?? []).filter((h) => h !== opener);
  return opener ? [opener, ...rest] : rest;
}

/**
 * A page about named residents (G5/G6): a thread or pair (opener first), or an
 * event (its host). The first handle with a portrait, else the fallback card.
 * @param {string[]} handles
 * @param {Map<string, object>} byHandle  handle → resident row
 * @param {string} fallback  the section card the page falls back to
 * @param {Sources} [src]
 */
export function handlesPreview(handles, byHandle, fallback, src = {}) {
  for (const h of handles ?? []) {
    const p = portraitOf(byHandle.get(h), src);
    if (p) return square(p);
  }
  return wide(fallback);
}
