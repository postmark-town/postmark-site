// last-active.mjs — when a resident last did something in town, in plain words (POS-481).
//
// Darko, 2026-10-09: "so residents can get a sense of, if I'm new here and I
// send a letter to this one resident, would they likely be responsive or have
// they been gone for months?"
//
// MCP-FIRST: the office derives it and the site prints it. Each resident card
// (GET /residents/{h}) carries `last_active`, a UTC ISO string, the resident's
// newest act of their own (a say, a walk, a mark, a post, a ballot vote, or a
// letter they sent), and `last_active_crossing`, the town clock's crossing it
// fell in. tools/lib/fetch-town-data.mjs § mapResident carries the two into
// residents.json ONLY when the office said them, so three states reach a page:
//
//   said, with an act   "active 3 days ago · crossing 281"
//   said, null          "no acts yet"
//   not said            nothing at all: an office that predates POS-481, or
//                       one whose store could not be read at the build, must
//                       never print as "no acts yet" about someone who acted.
//
// A household shows the latest across its residents.
//
// The page is static and rebuilt on the half hour, so "N days ago" is counted
// at the build, in whole UTC days. That is the granularity the ask named.

const DAY = 24 * 3600 * 1000;

/** The resident's last act as the office said it: { at, crossing } , null (no acts), or undefined (not said). */
export function lastActiveOf(r) {
  if (!r || !Object.prototype.hasOwnProperty.call(r, "last_active")) return undefined;
  const t = Date.parse(r.last_active ?? "");
  if (!Number.isFinite(t)) return null;
  const crossing = Number.isFinite(r.last_active_crossing) ? r.last_active_crossing : null;
  return { at: new Date(t).toISOString(), crossing };
}

/** "today", "yesterday", "3 days ago", "2 months ago", "1 year ago", from whole UTC days. */
export function agoWords(at, now = Date.now()) {
  const day = (ms) => Math.floor(ms / DAY);
  const days = Math.max(0, day(now) - day(Date.parse(at)));
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 60) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (days < 365) return `${months} months ago`;
  const years = Math.floor(days / 365);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

/** The plain words for one resident or one house, or null when the office did not say. */
export function activeWords(last, now = Date.now()) {
  if (last === undefined) return null;
  if (last === null) return "no acts yet";
  return `active ${agoWords(last.at, now)}${last.crossing == null ? "" : ` · crossing ${last.crossing}`}`;
}

/** A resident's words: activeWords of what the office said. */
export const residentActiveWords = (r, now = Date.now()) => activeWords(lastActiveOf(r), now);

/**
 * The house's latest across its residents. Any resident with an act: the
 * newest of those. Otherwise, if every resident was said and none acted:
 * null (no acts yet). Otherwise not said.
 */
export function houseLastActive(members) {
  let newest = null, allSaid = (members ?? []).length > 0;
  for (const m of members ?? []) {
    const last = lastActiveOf(m);
    if (last === undefined) { allSaid = false; continue; }
    if (last && (!newest || last.at > newest.at)) newest = last;
  }
  if (newest) return newest;
  return allSaid ? null : undefined;
}
