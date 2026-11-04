// calendar.mjs — how the site reads the office's calendar (POS-211, 2026-09-24).
//
// The pages at /calendar/ and /calendar/<host>/<slug>/ render calendar.json,
// which is the office's `GET /calendar` kept verbatim by fetch-town (the
// contract is the office's docs/calendar-contract.md). What a page would
// otherwise decide inline lives here, so the suite can reach it: CI runs
// `npm test` without a build, so a rule that exists only inside an .astro file
// has no falsifier that runs on a push.
//
// Two rules from the contract shape everything below:
//   · THE RECORD IS UTC and the reader has a zone. The page bakes the UTC as
//     its floor (true for every reader, and in the `datetime`/`title` of each
//     <time>) and an island rewrites the text into the reader's zone with the
//     browser's own Intl, the way mail/compose.astro renders a crossing. No
//     offset is ever worked out here.
//   · PHASE IS THE OFFICE'S. The page shows the word the office sent and never
//     works a phase out from the times. The "starts in / ends in" lines are the
//     office's own seconds from its `as_of`, and the page says that instant
//     beside each line (CalendarCard's "as of"), because the page is built and
//     the count does not tick. A live countdown was the larger change and the
//     riskier: it could pass the start while the badge, which is the office's
//     word, still says the event is coming.
//   · THE ZONE IS SAID ONCE per page (ZONE_FLOOR, then zoneLine() once the
//     island has localised): the markup is UTC, the island makes it the
//     reader's own, and the one sentence is true for a reader with the island
//     and for one without.

export const GROUPS = Object.freeze([
  { key: "now", label: "Now", empty: "Nothing is open right now." },
  { key: "coming", label: "Coming", empty: "Nothing is announced yet." },
  { key: "ended", label: "Lately", empty: "Nothing has ended in the last seven days." },
]);

// The phase "announced" is the office's word for an event that is on the list
// and whose doors have not opened (the phase before "doors-open"); it is not
// about the host's announcements (an event's `announcements`, POS-281), which
// are a separate list on the event's page. The badge says "coming up" so that
// it cannot be read against a page that says "No announcements yet". The key
// stays the office's: the gate (rsvp.mjs OPEN_PHASES) and the dashboard read it.
export const PHASE_WORDS = Object.freeze({
  announced: "coming up",
  "doors-open": "doors open",
  underway: "under way",
  ended: "ended",
});

const byStarts = (a, b) => String(a.starts).localeCompare(String(b.starts));
const byEndsNewest = (a, b) => String(b.ends).localeCompare(String(a.ends));

/** The three groups in page order, each with its events in the contract's order. */
export function groupsOf(calendar) {
  return GROUPS.map((g) => {
    const list = Array.isArray(calendar?.[g.key]) ? [...calendar[g.key]] : [];
    list.sort(g.key === "ended" ? byEndsNewest : byStarts);
    return { ...g, events: list };
  });
}

/** Every event the calendar carries, once each: the event pages are built from this. */
export function eventsOf(calendar) {
  return GROUPS.flatMap((g) => (Array.isArray(calendar?.[g.key]) ? calendar[g.key] : []));
}

/** `<host>/<slug>` split into the event page's two route segments, or null. */
export function eventParams(id) {
  const m = /^([^/]+)\/([^/]+)$/.exec(String(id ?? ""));
  return m ? { host: m[1], slug: m[2] } : null;
}

export function eventHref(id) {
  const p = eventParams(id);
  return p ? `/calendar/${p.host}/${p.slug}/` : null;
}

// A coordinate is a number or a numeric string. Number(null) and Number("") are
// 0, which is how an event with no recorded point used to print "(0, 0)" and
// link to the middle of the World; here they are no coordinate at all.
function coord(v) {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

// The office keeps a place's name as a slug ("the-snug-harbour") for some
// events: lower-case words joined by hyphens. That is made readable; a name
// with a space, a capital or no hyphen is a person's wording and is left alone.
function readableName(name) {
  const s = typeof name === "string" ? name.trim() : "";
  if (!s) return null;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(s)) return s;
  return s.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

/**
 * Where the event is, as a link into the World. `name` is the place's readable
 * name (its own name, else the leaf of its mark's id), `point` its coordinates
 * as "(x, y)", and `label` what the link says: the name, else the point, else
 * null, and a null label means the page prints no place at all (never a
 * stand-in). A point of exactly (0, 0) on a place with no mark is the missing
 * point read as a number, not somewhere anyone chose, so it is no point; a
 * mark's own centre is trusted. The link lands through the World's own
 * `/world/?at=x,y` arrival (town/pages/world.astro, ARRIVING AT A PLACE).
 */
export function placeOf(place) {
  const mark = typeof place?.mark === "string" && place.mark.trim() ? place.mark.trim() : null;
  let x = coord(place?.x);
  let y = coord(place?.y);
  if (x === null || y === null || (!mark && x === 0 && y === 0)) { x = null; y = null; }
  const at = x !== null;
  const point = at ? `(${x}, ${y})` : null;
  const name = readableName(place?.name) ?? (mark ? readableName(mark.split("/").pop()) : null);
  return {
    label: name ?? point,
    name,
    bare: !name,
    href: at ? `/world/?at=${x},${y}` : null,
    point,
  };
}

/** A resident's page when the roll has one; a handle the roll does not know renders as plain text. */
export function residentHref(handle, roll) {
  return roll?.has?.(handle) ? `/residents/${handle}/` : null;
}

/** Whole seconds as the few words a reader wants: "20 min", "4 h 20 min", "2 d 3 h". */
export function durationWords(seconds) {
  if (seconds == null || seconds === "") return null;
  const s = Math.abs(Math.round(Number(seconds)));
  if (!Number.isFinite(s)) return null;
  if (s < 60) return "under a minute";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return m % 60 ? `${h} h ${m % 60} min` : `${h} h`;
  const d = Math.floor(h / 24);
  return h % 24 ? `${d} d ${h % 24} h` : `${d} d`;
}

/** The line under an event's phase: how far it stood from the office's read. */
export function whenLine(event) {
  if (event?.phase === "ended") {
    const ago = durationWords(event.ends_in_s);
    return ago ? `ended ${ago} ago` : "ended";
  }
  // Doors open is still before the start, so the number a reader wants is how
  // long until it begins; only once it is under way is it how long is left.
  // durationWords reads the size of a gap, not its direction, so a start that has
  // already passed (a negative count: the office read it after the start while the
  // phase word was still announced/doors-open) must not reach it, or it would print
  // "starts in" for a start that is behind us. No line is the honest one here: the
  // office's phase badge still says what it said, and the page claims nothing more.
  if (event?.phase === "announced" || event?.phase === "doors-open") {
    if (Number(event.starts_in_s) < 0) return "";
    const until = durationWords(event.starts_in_s);
    return until ? `starts in ${until}` : "";
  }
  // The same direction problem at the other end: an under-way event whose end has
  // already passed (negative ends_in_s) must not read "ends in <gap>". No line.
  if (Number(event?.ends_in_s) < 0) return "";
  const left = durationWords(event?.ends_in_s);
  return left ? `ends in ${left}` : "";
}

// Spelled out from the UTC fields rather than through Intl, because Intl's
// short month is ICU data and varies by build ("Sep" in one Node, "Sept" in
// another): the floor is the one line every reader and every box must agree on.
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const two = (n) => String(n).padStart(2, "0");

/** The baked text of an instant: its UTC reading, labelled as UTC. The island replaces it. */
export function utcText(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso ?? "");
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}, ${two(d.getUTCHours())}:${two(d.getUTCMinutes())} UTC`;
}

/** The one zone sentence as the markup bakes it: true with the island and without it. */
export const ZONE_FLOOR = "Times are in UTC. With JavaScript on, they change to your own time zone.";

/** The same sentence once the island has put the times into the reader's zone. */
export function zoneLine(zone) {
  return zone ? `Times are in your time zone (${zone}).` : "Times are in your own time zone.";
}

/** The options the island hands the reader's browser, in one place so the floor and the island stay one family. */
export const LOCAL_FORMAT = Object.freeze({
  weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZoneName: "short",
});

// ── the month grid (POS-229, 2026-09-25) ─────────────────────────────────────
//
// The page draws the calendar as a month: its weeks as rows, Sunday first, each
// event on the day it starts. The grid is built here, at build time, so it is in
// the HTML for a reader with JavaScript off. Its days are UTC days, the same
// floor every <time> on the page bakes; the page's island then moves each event
// to its day in the reader's own zone and marks the reader's own today. Nothing
// here works out an offset.
//
// Months are static pages, /calendar/YYYY-MM/, one per month from the earliest
// month with an event (or the reference month) to the later of the month after
// the reference and the last month with an event. The reference instant is the
// office's `as_of` when the calendar carries one, else the build's clock.

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const WEEKDAYS = Object.freeze(DAYS);

const dayKeyOf = (d) => `${d.getUTCFullYear()}-${two(d.getUTCMonth() + 1)}-${two(d.getUTCDate())}`;

/** The UTC day of an instant as YYYY-MM-DD, or null. */
export function dayKey(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : dayKeyOf(d);
}

/** The UTC month of an instant as YYYY-MM, or null. */
export function monthKey(iso) {
  return dayKey(iso)?.slice(0, 7) ?? null;
}

const isMonthKey = (k) => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(k));

/** The month `n` months after `key` (negative for before). */
export function shiftMonth(key, n) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${two(d.getUTCMonth() + 1)}`;
}

/** "September 2026". */
export function monthLabel(key) {
  const [y, m] = key.split("-").map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

export function monthHref(key) {
  return `/calendar/${key}/`;
}

/** The instant the page reads "today" from: the office's as_of, else the build's clock. */
export function referenceInstant(calendar, now = new Date()) {
  const asOf = calendar?.as_of;
  if (asOf && !Number.isNaN(new Date(asOf).getTime())) return new Date(asOf).toISOString();
  return now.toISOString();
}

/** Every month that gets a page, oldest first. */
export function monthsOf(calendar, ref) {
  const refMonth = monthKey(ref);
  const starts = eventsOf(calendar).map((e) => monthKey(e.starts)).filter(Boolean).sort();
  let first = refMonth;
  let last = shiftMonth(refMonth, 1);
  if (starts.length && starts[0] < first) first = starts[0];
  if (starts.length && starts[starts.length - 1] > last) last = starts[starts.length - 1];
  const out = [];
  for (let k = first; k <= last; k = shiftMonth(k, 1)) out.push(k);
  return out;
}

/**
 * One month as the page draws it: whole weeks, Sunday first, with the days of
 * the months on either side filling the first and last rows (marked out of the
 * month, and carrying their events too, so a reader at a month's edge sees the
 * week whole). Each day holds the events that start on it, earliest first.
 * `prev` and `next` are null past the first and last month that has a page.
 */
export function monthGrid(calendar, key, ref, months = monthsOf(calendar, ref)) {
  if (!isMonthKey(key)) throw new Error(`monthGrid: "${key}" is not a YYYY-MM month`);
  const byDay = new Map();
  for (const e of eventsOf(calendar)) {
    const k = dayKey(e.starts);
    if (!k) continue;
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k).push(e);
  }
  for (const list of byDay.values()) list.sort(byStarts);

  const [y, m] = key.split("-").map(Number);
  const firstOfMonth = new Date(Date.UTC(y, m - 1, 1));
  const cursor = new Date(Date.UTC(y, m - 1, 1 - firstOfMonth.getUTCDay()));
  const today = dayKey(ref);
  const weeks = [];
  let count = 0;
  do {
    const week = [];
    for (let i = 0; i < 7; i++) {
      const date = dayKeyOf(cursor);
      const inMonth = date.startsWith(key);
      const events = byDay.get(date) ?? [];
      if (inMonth) count += events.length;
      week.push({ date, day: cursor.getUTCDate(), weekday: DAYS[cursor.getUTCDay()], inMonth, today: date === today, events });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    weeks.push(week);
  } while (cursor.getUTCMonth() === m - 1);

  const at = months.indexOf(key);
  return {
    key,
    label: monthLabel(key),
    weeks,
    count,
    events: weeks.flat().filter((d) => d.inMonth).flatMap((d) => d.events),
    prev: at > 0 ? months[at - 1] : null,
    next: at >= 0 && at < months.length - 1 ? months[at + 1] : null,
    empty: `Nothing is on the calendar in ${monthLabel(key)}.`,
  };
}

/** The baked text of a start in a grid cell: its UTC clock time. The island replaces it. */
export function utcClock(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : `${two(d.getUTCHours())}:${two(d.getUTCMinutes())}`;
}

/** The island's options for a grid cell's time: the clock only, the zone is said once above the grid. */
export const LOCAL_CLOCK = Object.freeze({ hour: "2-digit", minute: "2-digit" });
