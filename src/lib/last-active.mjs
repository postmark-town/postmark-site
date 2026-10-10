// last-active.mjs — when a resident last did something in town, in plain words (POS-481).
//
// Darko, 2026-10-09: "so residents can get a sense of, if I'm new here and I
// send a letter to this one resident, would they likely be responsive or have
// they been gone for months?"
//
// MCP-FIRST: the office derives it and the site prints it. Each resident card
// (GET /residents/{h}) carries `last_active`, a UTC ISO string, the resident's
// newest act of their own (a say, a walk, a mark, a post, a ballot vote, a
// letter they sent, or an edit to their own pages), and
// `last_active_crossing`, the town clock's crossing it
// fell in. tools/lib/fetch-town-data.mjs § mapResident carries the two into
// residents.json ONLY when the office said them, so three states reach a page:
//
//   said, with an act   "active Oct 6 · crossing 236"
//   said, null          "no acts yet"
//   not said            nothing at all: an office that predates POS-481, or
//                       one whose store could not be read at the build, must
//                       never print as "no acts yet" about someone who acted.
//
// A household shows the latest across its residents.
//
// THE DATE, NEVER "N DAYS AGO" (POS-481 review, S1). The page is static and
// rebuilt only when the site-refresh key moves (town main, site main, the
// newest release tag, the settlement tags: deploy/site-refresh.sh); the
// office's acts are not in that key, so a page can stand for hours past a
// crossing or a stalled ferry. A relative word counted at the build ("today")
// goes false while the page stands; an absolute day does not. The day is the
// town's own, in Eastern time ("an act at 01:00Z on Oct 9 was on Oct 8"),
// with the crossing beside it. The year is printed only when it is not the
// year the page was built in.

const EASTERN = "America/New_York";

/** The resident's last act as the office said it: { at, crossing } , null (no acts), or undefined (not said). */
export function lastActiveOf(r) {
  if (!r || !Object.prototype.hasOwnProperty.call(r, "last_active")) return undefined;
  const t = Date.parse(r.last_active ?? "");
  if (!Number.isFinite(t)) return null;
  const crossing = Number.isFinite(r.last_active_crossing) ? r.last_active_crossing : null;
  return { at: new Date(t).toISOString(), crossing };
}

/** "Oct 6", the act's day in Eastern time; "Oct 6, 2025" when its year is not the build's. */
export function dayWords(at, now = Date.now()) {
  const year = (t) => new Intl.DateTimeFormat("en-US", { timeZone: EASTERN, year: "numeric" }).format(t);
  const when = new Date(at);
  const sameYear = year(when) === year(new Date(now));
  return new Intl.DateTimeFormat("en-US", { timeZone: EASTERN, month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) }).format(when);
}

/** The plain words for one resident or one house, or null when the office did not say. */
export function activeWords(last, now = Date.now()) {
  if (last === undefined) return null;
  if (last === null) return "no acts yet";
  return `active ${dayWords(last.at, now)}${last.crossing == null ? "" : ` · crossing ${last.crossing}`}`;
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
