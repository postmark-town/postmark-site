// year-end-album.mjs — the year's-end album book on the Town's corkboard (CORE-173).
//
// Darko, 2026-11-23 19:21 EST (CORE-163/b): "during the duration of the event, we can just have a nice like end of year album book on
// our corkboard on the site that takes you straight to the event and the gallery." The album is an event whose gallery is the album
// (each picture a spark); Rei hosts it, "A Little Light at Year's End", an album table in the Town Centre (CORE-163/g, her answer of
// 2026-11-24 00:51Z). The season is ruled (CORE-163/c: pictures from December 1, featured to January 6, the album kept for good), and
// the event Rei posts is what realizes it.
//
// THE BOOK FOLLOWS ITS EVENT, NOTHING ELSE. It names one event by the Office's id (`host/slug`), and it is drawn only while the build's
// own calendar or lasting list carries that event, uncancelled, titled, and with a valid start and end that the build's clock falls
// between: the event's own window, as the Office posts it. No date is kept here: if the posted window differs from the ruled season,
// the book keeps to the posted one, and the difference is for the event's host, not this file. An event that can't be read, or one
// whose start or end is missing or not an instant, shows no book and leaves no gap where one would be. Its two ways in are the event's
// permanent page and that page's gallery (`#gallery`, the gallery section's address, CORE-174), both from calendar.mjs's eventHref, the
// one place an event's address is made. A page built inside the window and read after the event's end drops the book itself
// (albumGuardScript), as the Halloween hanger does.

import { allEventViews, eventHref } from "./calendar.mjs";

export const YEAR_END_ALBUM = Object.freeze({
  // Rei's event, as the Office names it (`host/slug`): confirmed by Rei, 2026-11-24 01:36Z (Wright, CORE-173). She posts it under this
  // id when the builds are ready; until the Office carries it, the board has no book.
  id: "rei/a-little-light-at-years-end",
  // the book's picture: civic-art.mjs BOARD_ART, the album table on the quay
  art: Object.freeze(["albumtable"]),
});

/** An Office time as an instant (ms), or null when it isn't one: a missing, non-string or unparseable time never opens a window. */
function instant(v) {
  if (typeof v !== "string" || !v.trim()) return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : null;
}

/** The event's own window `{ from, until }` (ms) from its `starts` and `ends`, or null when either is missing or invalid, or it ends before it starts. */
export function eventWindow(event) {
  const from = instant(event?.starts);
  const until = instant(event?.ends);
  return from !== null && until !== null && until > from ? { from, until } : null;
}

/**
 * The book the board pins at `now`, or null for no book. `title` is the event's own (a resident's words: drawn as text, never as
 * markup); `href` is its page and `gallery` that page's gallery; `until` is the event's end, the instant the page's guard drops it.
 * @returns {{ id: string, title: string, href: string, gallery: string, until: number, art: readonly string[] } | null}
 */
export function yearEndAlbum(calendar, events, now = Date.now(), cfg = YEAR_END_ALBUM) {
  const href = eventHref(cfg.id);
  if (!href) return null;
  const event = allEventViews(calendar, events).find((e) => e.id === cfg.id);
  if (!event || event.cancelled) return null;
  const title = typeof event.title === "string" ? event.title.trim() : "";
  if (!title) return null;
  const window = eventWindow(event);
  const t = typeof now === "number" ? now : new Date(now).getTime();
  if (!window || !Number.isFinite(t) || t < window.from || t >= window.until) return null;
  return { id: cfg.id, title, href, gallery: `${href}#gallery`, until: window.until, art: cfg.art };
}

/** The inline guard a built page carries with the book: from `until` (the event's end, ms) on, the book is removed. */
export function albumGuardScript(until) {
  if (!Number.isFinite(until)) throw new Error("year-end-album: the guard needs the event's end as an instant");
  return `<script>(function(){if(Date.now()>=${until}){var e=document.querySelectorAll("[data-year-end-album]");for(var i=0;i<e.length;i++)e[i].remove();}})();</script>`;
}
