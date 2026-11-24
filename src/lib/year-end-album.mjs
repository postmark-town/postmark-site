// year-end-album.mjs — the year's-end album book on the Town's corkboard (CORE-173).
//
// Darko, 2026-11-23 19:21 EST (CORE-163/b): "during the duration of the event, we can just have a nice like end of year album book on
// our corkboard on the site that takes you straight to the event and the gallery." The album is an event whose gallery is the album
// (each picture a spark); Rei hosts it, "A Little Light at Year's End", an album table in the Town Centre (CORE-163/g, her answer of
// 2026-11-24 00:51Z). The season is ruled (CORE-163/c): pictures from December 1, featured to January 6, the album kept for good. The
// book is the featuring, so it is on the board from December 1 through January 6 and gone after; the event's page and gallery stay.
//
// THE BOOK NEVER GUESSES ITS EVENT. It names one event by the Office's id (`host/slug`), and it is drawn only when the build's own
// calendar or lasting list carries that event, uncancelled and titled. With no id (Rei's is not confirmed yet), a malformed one, or an
// event the build couldn't read, there is no book and no gap where one would be: the board is as it is today. Its two ways in are the
// event's permanent page and that page's gallery (`#gallery`, the gallery section's address, CORE-174), both from calendar.mjs's
// eventHref, the one place an event's address is made.
//
// THE WINDOW IS THE TOWN'S CLOCK, EASTERN (the town keeps Darko's: Halloween ended at 02:00 EDT, halloween-frame.mjs), and the build
// decides it; a page built inside the window and read after it drops the book itself (albumGuardScript), as the Halloween hanger does.

import { allEventViews, eventHref } from "./calendar.mjs";

export const YEAR_END_ALBUM = Object.freeze({
  // Rei's event, as the Office names it (`host/slug`). Not confirmed yet: Wright is asking her (CORE-173, 2026-11-24 01:26Z), and the
  // book stays off the board until this is the id she posted under. Never a guessed slug.
  id: null,
  from: "2026-12-01T05:00:00Z", // December 1, 00:00 EST
  until: "2027-01-07T05:00:00Z", // the end of January 6, EST
  // the book's picture: civic-art.mjs BOARD_ART, the album table on the quay
  art: Object.freeze(["albumtable"]),
});

/** Whether `now` is inside the album's window: from `from`, up to (not at) `until`. */
export function albumWindowOn(now = Date.now(), { from, until } = YEAR_END_ALBUM) {
  const t = typeof now === "number" ? now : new Date(now).getTime();
  return Number.isFinite(t) && t >= Date.parse(from) && t < Date.parse(until);
}

/**
 * The book the board pins at `now`, or null for no book. `title` is the event's own (a resident's words: drawn as text, never as
 * markup); `href` is its page and `gallery` that page's gallery.
 * @returns {{ id: string, title: string, href: string, gallery: string, until: string, art: readonly string[] } | null}
 */
export function yearEndAlbum(calendar, events, now = Date.now(), cfg = YEAR_END_ALBUM) {
  if (!albumWindowOn(now, cfg)) return null;
  const href = eventHref(cfg.id);
  if (!href) return null;
  const event = allEventViews(calendar, events).find((e) => e.id === cfg.id);
  if (!event || event.cancelled) return null;
  const title = typeof event.title === "string" ? event.title.trim() : "";
  if (!title) return null;
  return { id: cfg.id, title, href, gallery: `${href}#gallery`, until: cfg.until, art: cfg.art };
}

/** The inline guard a built page carries with the book: from `until` on, the book is removed, so a page read after the season shows none. */
export function albumGuardScript(cfg = YEAR_END_ALBUM) {
  const until = Date.parse(cfg.until);
  return `<script>(function(){if(Date.now()>=${until}){var e=document.querySelectorAll("[data-year-end-album]");for(var i=0;i<e.length;i++)e[i].remove();}})();</script>`;
}
