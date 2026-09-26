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
import { excerpt } from "./pm.mjs";
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
 *   tended     the date his italic line says he last tended it ("last on **…**")
 *   crossing   the crossing number from his crossing line (ferryHeadline, the
 *              doorstep's own reader, so the two never read it differently)
 *   figures    the rest of that line: letters over, delivered, the roll
 *   lead       the first `##` story after the crossing line
 *   standfirst that story's first paragraph, excerpted
 *
 * Every field may be null: a Daily that changes its shape still pins a
 * newspaper with its masthead, never a broken one.
 */
export function dailyFront(bulletin) {
  const posting = (bulletin ?? []).find((p) => p?.slug === "ferrys-daily");
  const body = String(posting?.body ?? "");
  const tended = /last on \*{0,2}(\d{4}-\d{2}-\d{2})\*{0,2}/i.exec(body)?.[1] ?? null;
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
    figures: line?.headline ?? null,
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
