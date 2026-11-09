// fold.mjs — the arithmetic behind the Hearth slots the dashboard has no part for (POS-959).
//
// Pure: it takes what reads.mjs fetched and answers what a slot should say. The
// dashboard's own parts (the feed, Needs you, the numbers, the cards, coming up)
// keep their folds in household-dashboard/fold.mjs and are drawn by its
// paintHouse; this file adds only the parts a Hearth can name that the
// dashboard did not draw: posts, marks, the private mail summary, the town's
// boards, the residents map, the stamps chart and the countdown.
//
// A read that did not answer is `null` here and says so on the page; it is never
// folded into a zero. "No posts" is a count of zero from an answer; "could not
// read the posts" is something else.

import { cardNumbersOf, needsOf, clocksOf, parseAt } from "../household-dashboard/fold.mjs";

const asArray = (v) => (Array.isArray(v) ? v : []);
const str = (v) => (v == null ? "" : String(v));
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

export const POSTS_CLASSES = Object.freeze(["idea", "bug"]);
export const POSTS_SHOWN = 8;

/**
 * The house's posts: the ideas and bugs its residents put up, newest act first.
 * `answers` is `{ idea, bug }`, each a `GET /posts?class=` answer or null. A class
 * whose page was cut short (`total` above the rows read) says so, so a house whose
 * older post fell off the page is not told it has none.
 * @returns {null | { rows, partial: Array<{class, read, total}>, missing: string[] }}  null when no class answered
 */
export function postsOf(answers, handles, slug) {
  const house = new Set(handles);
  const key = slug ? "hh:" + slug : null;
  const rows = [];
  const partial = [];
  const missing = [];
  let answered = 0;
  for (const cls of POSTS_CLASSES) {
    const a = answers?.[cls];
    if (!a || !Array.isArray(a.posts)) { missing.push(cls); continue; }
    answered++;
    const total = num(a.total);
    if (total != null && total > a.posts.length) partial.push({ class: cls, read: a.posts.length, total });
    for (const p of a.posts) {
      if (!p || !(house.has(p.author) || (key && p.household === key))) continue;
      rows.push({
        class: cls, id: str(p.id), title: str(p.title), author: str(p.author), state: str(p.state),
        at: parseAt(p.latest?.at), responses: num(p.responses) ?? 0,
      });
    }
  }
  if (!answered) return null;
  rows.sort((a, b) => (b.at ?? 0) - (a.at ?? 0) || a.id.localeCompare(b.id));
  return { rows: rows.slice(0, POSTS_SHOWN), count: rows.length, partial, missing };
}

/** The house's marks: the crossings' rulings on what it published, from the feed the dashboard already folds. */
export function marksOf(items, shown = POSTS_SHOWN) {
  return asArray(items).filter((i) => i?.kind === "mark").slice(0, shown);
}

/**
 * The private mail summary, for the house's own sign-in only. The doorstep fields it reads are the
 * ones the dashboard already shows an owner (the cards' feet, Needs you, the next boat).
 * @returns {null | { newInbound, awaitingStance, waiting, bounced, complete }}  null when no doorstep answered
 */
export function mailOf(handles, doorsteps) {
  const answered = handles.filter((h) => doorsteps?.[h]);
  if (!answered.length) return null;
  let newInbound = 0, awaitingStance = 0, waiting = 0;
  for (const h of answered) {
    const n = cardNumbersOf(doorsteps[h]);
    newInbound += n?.newInbound ?? 0;
    awaitingStance += n?.awaitingStance ?? 0;
    waiting += n?.pending ?? 0;
  }
  const needs = needsOf(handles, doorsteps);
  return { newInbound, awaitingStance, waiting, bounced: needs.bounces.length, complete: answered.length === handles.length };
}

/** Around town: the next events on the town's calendar, from every house. Null when the calendar did not answer. */
export function townEventsOf(calendar, shown = 5) {
  if (!calendar || typeof calendar !== "object") return null;
  return [...asArray(calendar.now), ...asArray(calendar.coming)]
    .filter((e) => e && !e.cancelled && e.id)
    .map((e) => ({
      id: str(e.id), title: str(e.title), host: str(e.host), phase: str(e.phase),
      starts: parseAt(e.starts), place: e.place?.name ? str(e.place.name).replace(/-/g, " ") : null,
    }))
    .sort((a, b) => (a.starts ?? 0) - (b.starts ?? 0))
    .slice(0, shown);
}

/** The residents map: who stands at which place, from the walkers read. Null when it did not answer. */
export function placesOf(handles, walkers) {
  if (!walkers || !Array.isArray(walkers.walkers)) return null;
  const leaf = (s) => str(s).split("/").pop().replace(/-/g, " ");
  const by = new Map();
  for (const h of handles) {
    const w = walkers.walkers.find((x) => x?.handle === h);
    const place = w ? (w.moving && w.toward ? leaf(w.toward) : w.mark_id ? leaf(w.mark_id) : null) : null;
    const moving = !!(w && w.moving && w.toward);
    const k = place ?? "";
    if (!by.has(k)) by.set(k, { place, moving, who: [] });
    by.get(k).who.push(h);
  }
  return [...by.values()].sort((a, b) => (a.place === null) - (b.place === null) || b.who.length - a.who.length || String(a.place).localeCompare(String(b.place)));
}

/** The stamps chart: what each resident holds. A resident whose doorstep did not answer is a bar with no number, not a zero. */
export function chartOf(handles, doorsteps) {
  const rows = handles.map((h) => ({ handle: h, held: num(cardNumbersOf(doorsteps?.[h])?.held) }));
  if (rows.every((r) => r.held == null)) return null;
  const max = Math.max(1, ...rows.map((r) => r.held ?? 0));
  return rows.map((r) => ({ ...r, share: r.held == null ? null : r.held / max }));
}

/** The countdown's two moments, from the clocks the dashboard already reads. */
export function countdownOf(handles, doorsteps) {
  const c = clocksOf(handles, doorsteps);
  if (!c || (!c.crossing?.at && !c.settlement?.at)) return null;
  return { crossing: c.crossing?.at ? { n: c.crossing.n, at: c.crossing.at } : null, settlement: c.settlement?.at ? { at: c.settlement.at } : null };
}

/** "3h 12m", "4m 05s", "2d 3h": what is left until `at`, or null once it has come. */
export function leftWords(at, now) {
  const ms = at - now;
  if (!(ms > 0)) return null;
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${m}m ${String(sec).padStart(2, "0")}s`;
}
