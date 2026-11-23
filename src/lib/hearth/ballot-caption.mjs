// ballot-caption.mjs — how a Hearth ballot's choice is NAMED to a reader: "<design title>, by <household>" (CORE-126).
//
// Darko, 2026-11-18 16:57 EST: "the ballot box shows household names instead of theme/design names for each entry, it should show the theme name
// and by {household}". On the Hearth ballot (topic `hearth-default`) the office's candidate is the design's FOLDER id; the design's title is the one
// its own hearth.md authors (tools/sync-hearths.mjs § readMeta, already in src/data/postmark/hearths.json), and the household is the choice's published
// `credit`, not the entry's `author`. This file is the one place that turns those into words. PURE: no fetch, no DOM.
//
// WHAT IT NEVER DOES. It never changes an identity: the id stays the option value, the stake's candidate, the preview and confirm request and the
// answer's; a caption is only what a reader is shown. It never invents: no title known (a folder this build does not carry, an empty or unreadable
// title) means NO caption and the caller keeps today's raw id; no credit means the title alone, never a made-up household. It only speaks for the Hearth
// ballot; another ballot whose choice shares a design's name ("default") is not a design and gets nothing. It is independent of preview eligibility
// (ballot-links.mjs): a design this build cannot draw still has its title.

import { HEARTH_BALLOT_TOPIC } from "./ballot-links.mjs";
import { ENTRY_ID } from "./slots.mjs";

// control / bidi characters out and whitespace collapsed; NO length cut: a published credit (and an authored title) is shown whole, as it was before this file
const clean = (s) => String(s).replace(/[\u0000-\u001f\u007f-\u009f‪-‮⁦-⁩]/g, " ").replace(/\s+/g, " ").trim();

/** `{ [design id]: title }` from the registered entries' metadata (hearths.json rows), whatever their preview or render eligibility. Build-time. */
export function titlesOf(rows) {
  const out = {};
  for (const r of Array.isArray(rows) ? rows : []) {
    if (!r || typeof r.id !== "string" || !ENTRY_ID.test(r.id) || typeof r.title !== "string") continue;
    const t = clean(r.title);
    if (t) out[r.id] = t;
  }
  return out;
}

/** The map as the page carries it (a data attribute's JSON), read back: own ids with a text title only. */
export function readTitles(text) {
  let raw = null;
  try { raw = JSON.parse(String(text ?? "")); } catch { return {}; }
  const out = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [id, t] of Object.entries(raw)) {
    if (ENTRY_ID.test(id) && typeof t === "string" && clean(t)) out[id] = clean(t);
  }
  return out;
}

/**
 * The caption for one choice, or null (keep the raw id). `credit` is the choice's published credit as the office sent it.
 * Only on the Hearth ballot, only for a design whose title this build knows.
 */
export function captionOf(titles, topic, candidate, credit) {
  if (topic !== HEARTH_BALLOT_TOPIC || typeof candidate !== "string" || !titles || !Object.hasOwn(titles, candidate)) return null;
  const title = typeof titles[candidate] === "string" ? clean(titles[candidate]) : "";
  if (!title) return null;
  const by = typeof credit === "string" ? clean(credit) : "";
  return by ? `${title}, by ${by}` : title;
}

/** `{ [candidate id]: caption }` for a ballot's choices as the office sent them (rows or bare names): only the ones that have a caption. */
export function captionsOf(titles, topic, choices) {
  const out = {};
  for (const c of Array.isArray(choices) ? choices : []) {
    const id = typeof c === "string" ? c : c?.candidate;
    const cap = captionOf(titles, topic, id, typeof c === "string" ? null : c?.credit);
    if (cap) out[id] = cap;
  }
  return out;
}
