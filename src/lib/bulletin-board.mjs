// bulletin-board.mjs — what the Bulletin's board pins, and how each piece looks
// (the Site Lift, POS-251, 2026-09-26).
//
// Keemin, 2026-09-26: the Bulletin is "widgets disguised as items on a bulletin
// board … with a calendar, a bunch of post-it notes (the town bulletin) and a
// newspaper all pinned to it, to form a much nicer subrail". So /bulletin/ is
// one board with three kinds of thing on it, and each is the way into its page:
//
//   the calendar   this month, today marked, the whole of it a link to /calendar/
//   the newspaper  Ferry's Daily's front page, a link to /daily/
//   the post-its   the bulletin's own postings (bulletinCards), each opening
//                  its notice at /bulletin/#<slug>
//
// What the page would otherwise decide inline lives here, so the suite can
// hold it without a build (CI runs `npm test` on a push, unbuilt).

import { ferryHeadline } from "../../tools/lib/doorstep.mjs";
import { excerpt, townFile } from "./pm.mjs";
import { groupsOf, monthGrid, monthKey, referenceInstant } from "./calendar.mjs";

/**
 * The post-its' papers, each a colour the site already wears (the style guide,
 * 2026-09-25). Stamp violet is left out on purpose: violet is the stamps', by
 * law (2026-07-29), and a violet note would read as money.
 */
export const POSTIT_PAPERS = Object.freeze([
  { name: "bright gold", bg: "#f6dcae" },
  { name: "holo mint", bg: "#93d6c4" },
  { name: "pale coral", bg: "#f3b9a6" },
  { name: "foam", bg: "#d6e7ef" },
  { name: "cream", bg: "#f7efdc" },
]);

/** The tilts a note may hang at, in degrees. Never 0: a pinned note is never square. */
export const TILTS = Object.freeze([-2.2, 1.6, -1.1, 2.4, -1.8, 0.9, 1.9, -2.6]);

const at = (list, i) => list[((i % list.length) + list.length) % list.length];

/**
 * How the note at position `i` hangs. Paper and tilt both go by position, on
 * cycles of different lengths, so two neighbours never share a colour or lean
 * the same way.
 */
export function postitLook(i) {
  const paper = at(POSTIT_PAPERS, i);
  return { paper: paper.name, bg: paper.bg, tilt: at(TILTS, i) };
}

/**
 * The calendar as the board pins it: this month's grid (the calendar page's
 * own monthGrid, so the two can never disagree on a day), and the one event
 * the note names: the first that is on now, else the first coming. Which group
 * an event is in is the office's word, never worked out here from the times
 * (calendar.mjs's rule). `ref` is the office's as_of, else the build's clock.
 */
export function pinnedMonth(calendar, now = new Date()) {
  const ref = referenceInstant(calendar, now);
  const month = monthGrid(calendar, monthKey(ref), ref);
  const groups = groupsOf(calendar);
  const pick = (key) => groups.find((g) => g.key === key).events.find((e) => !e.cancelled) ?? null;
  const onNow = pick("now");
  const coming = pick("coming");
  const next = onNow ? { event: onNow, now: true } : coming ? { event: coming, now: false } : null;
  return { ...month, next };
}

/**
 * Ferry's Daily's front page, read from the posting the town keeps it in
 * (TOWN_BULLETIN/ferrys-daily.md, in bulletin.json as `ferrys-daily`):
 *
 *   tended     the date his italic line says he last tended it ("last on **…**",
 *              and since September "Tended on **…**")
 *   crossing   the crossing number from his crossing line (ferryHeadline, the
 *              doorstep's own reader, so the two never read it differently)
 *   figures    the rest of that line: letters over, delivered, the roll, with
 *              his separators read as the board's middots (he has written both
 *              "·" and "--"; the doorstep's reader strips only the first char
 *              of a "--", so its leftover dash is dropped here too)
 *   lead       the first `##` story after the crossing line
 *   standfirst that story's first paragraph, excerpted
 *
 * Every field may be null: a Daily that changes its shape still pins a
 * newspaper with its masthead, never a broken one.
 */
export function dailyFront(bulletin) {
  const posting = (bulletin ?? []).find((p) => p?.slug === "ferrys-daily");
  const body = String(posting?.body ?? "");
  const tended = /(?:last|tended) on \*{0,2}(\d{4}-\d{2}-\d{2})\*{0,2}/i.exec(body)?.[1] ?? null;
  const line = ferryHeadline(body);

  let lead = null;
  let standfirst = null;
  const crossingAt = body.search(/^#{1,6}\s.*\bCrossing\s+\d+/im);
  const rest = crossingAt < 0 ? body : body.slice(crossingAt).replace(/^.*\r?\n/, "");
  const story = /^##\s+(.+?)\s*$/m.exec(rest);
  if (story) {
    lead = story[1].replace(/\*+/g, "").trim() || null;
    const after = rest.slice(story.index + story[0].length);
    const para = after.split(/\r?\n\s*\r?\n/).map((b) => b.trim()).find((b) => b && !/^#/.test(b));
    standfirst = para ? excerpt(para, 200) || null : null;
  }
  return {
    tended,
    crossing: line?.crossing ?? null,
    figures: line?.headline
      ? line.headline.replace(/^[\s·—:|-]+/, "").replace(/\s+(?:--|—)\s+/g, " · ").trim() || null
      : null,
    lead,
    standfirst,
  };
}

/** "26 August 2026" for the Daily's dateline, from its YYYY-MM-DD; null if it is not one. */
export function tendedText(ymd) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(ymd ?? ""))) return null;
  const d = new Date(`${ymd}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

// ── THE PINNED ITEMS (Darko, 2026-10-10 18:58, POS-566) ─────────────────────
//
// "the main town page needs to have a couple more corkboard items … Dom
// Pidgey's chapbook as a corkboard item on the main corkboard, outside of the
// town bulletin. And we should also have the Halloween event candy declaration
// on the main corkboard." Each is pinned on the board itself, and neither is
// a piece: no view of its own, so nothing here is in BOARD_PIECES.
//
// ILLUSTRATED, AND EACH ITS OWN OBJECT (Darko, 19:21: "artistically represent
// each of the two new main corkboard items instead of just having the raw
// text"; and keep to the board's DIVERSITY: neither may look like a card
// already there, or like the other). The board is a collage (a calendar, a
// torn newspaper, a postcard, a staff strip, stamps, a sea chart), so `form`
// names what each one is:
//
//   book     the chapbook: a little cloth-bound book, stitched at the spine,
//            its page edges showing, a gold-framed plate on the cover, held
//            up by washi tape, a ribbon bookmark trailing from it
//   hanger   Halloween: a door-hanger in plum card stock, hung on a nail
//            through its punched hole, the doorstep seen through an arched
//            window cut in it
//
// Neither wears the postcard's striped quay band or the harbor's pill: each
// ends in a plain underlined line, the way into what it pins.
//
// `art` names the civic-art.mjs BOARD_ART maps each one's picture shows, side
// by side on the quay, at the buildings' pixel scale.
//
// DOM PIDGEY'S OWN SPRITE (Darko, 2026-10-10 19:48: use his sprite on the
// chapbook's plate, not one we drew). `sprite` is his: the `idle` frame of the
// SPRITES his own page draws him with, https://foundoutanyway.github.io/pidgey/
// pidgeys-pigeonholes.html, a plain 169×184 RGBA PNG (IHDR, IDAT, IEND only),
// copied byte for byte into public/atelier/postmark/art/residents/dom-pidgey/
// sprite.png so the board does not hang on his site staying up. It is drawn at
// its native size (its art is 1×, so any smaller is a lossy cut) and credited
// on the book.
//
// The words are the town's, never new prose: the chapbook's line is its
// bulletin item's teaser, cut to its first and last clauses
// (TOWN_BULLETIN/lamp-flower-chapbook.md, posted 2026-10-05; nine pages since town #3623, 10-10), and its weight
// is from that item's body; the Halloween card's are its bulletin page's
// (TOWN_BULLETIN/halloween.md, town main 12cde8d71).
//
//   href    a pin that leaves the town: the chapbook is Dom Pidgey's own
//           page, opened in a new tab, like the harbor and the stickers
//   note    a pin that is a bulletin page: the Halloween card opens its notice
//           in place at /bulletin/#halloween, the address every doorstep uses
//           for one (pinLink, below)
export const BOARD_PINS = Object.freeze([
  Object.freeze({
    key: "chapbook",
    art: Object.freeze(["lampflower"]),
    sprite: Object.freeze({
      src: "/art/residents/dom-pidgey/sprite.png",
      w: 169,
      h: 184,
      credit: "sprite by Dom Pidgey",
      source: "https://foundoutanyway.github.io/pidgey/pidgeys-pigeonholes.html",
    }),
    form: "book",
    kind: null,
    title: "The Lamp-Flower Chapbook",
    by: "resident pigeon Dom Pidgey",
    words: "The pigeon's compendium of postmark.town, for old residents and new arrivals alike.",
    steps: Object.freeze([]),
    href: "https://foundoutanyway.github.io/pidgey/lamp-flower-chapbook/",
    foot: "read the chapbook (nine light pages) ↗",
  }),
  Object.freeze({
    key: "halloween",
    art: Object.freeze(["door", "pumpkin"]),
    form: "hanger",
    kind: "Saturday, October 31st, all day",
    title: "Halloween: what's on the doorsteps",
    by: null,
    words: null,
    steps: Object.freeze([
      "**Choose your candy.** One each: every resident can have their own.",
      "**Write to postmaster** with the candy's name and its line.",
      "**RSVP to the event** \"Halloween in Postmark\" on the town calendar.",
    ]),
    after: "When the time comes, the town will show you how to make your candy, so you have some to give.",
    href: null,
    note: "halloween",
    foot: "how to take part, and the tally →",
  }),
]);

/**
 * Where a pinned item's click goes. A pin that leaves the town goes to its
 * own page. A bulletin page's pin opens its notice in place, at the address
 * the notices answer; and while the baked board does not carry that notice
 * yet (the town merged it after this build fetched), the pin is a link to its
 * file in the town repo, so a click never opens nothing.
 * @param {{ href?: string|null, note?: string }} pin  one of BOARD_PINS
 * @param {Iterable<string>} slugs  every notice slug the page can open
 * @returns {{ href: string, note: string|null, leaves: boolean }}
 */
export function pinLink(pin, slugs = []) {
  if (!pin?.note) return { href: pin.href, note: null, leaves: true };
  if (new Set(slugs).has(pin.note)) return { href: `#${pin.note}`, note: pin.note, leaves: false };
  return { href: townFile(`TOWN_BULLETIN/${pin.note}.md`), note: null, leaves: true };
}

// The pieces, their views and their addresses live in town-views.mjs, which
// the page's script imports too: it is plain data and one pure function, so
// the browser gets it without this file's doorstep and calendar readers.
export { BOARD_PIECES, FRAMED, NOSCRIPT_NOTICES, boardIds, viewOf } from "./town-views.mjs";
