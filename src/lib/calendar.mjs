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
//     office's own seconds from its `as_of`, and the page says that instant.

export const GROUPS = Object.freeze([
  { key: "now", label: "Now", empty: "Nothing is open right now." },
  { key: "coming", label: "Coming", empty: "Nothing is announced yet." },
  { key: "ended", label: "Lately", empty: "Nothing has ended in the last seven days." },
]);

export const PHASE_WORDS = Object.freeze({
  announced: "announced",
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

/**
 * Where the event is, as a link into the World. A mark's name is linked at the
 * mark's centre and a bare point reads "(x, y)"; both land through the World's
 * own `/world/?at=x,y` arrival (town/pages/world.astro, ARRIVING AT A PLACE).
 */
export function placeOf(place) {
  const x = Number(place?.x);
  const y = Number(place?.y);
  const at = Number.isFinite(x) && Number.isFinite(y);
  const point = at ? `(${x}, ${y})` : null;
  return {
    label: place?.name ?? point ?? "somewhere not recorded",
    bare: !place?.name,
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
  if (event?.phase === "announced" || event?.phase === "doors-open") {
    const until = durationWords(event.starts_in_s);
    return until ? `starts in ${until}` : "";
  }
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

/** The options the island hands the reader's browser, in one place so the floor and the island stay one family. */
export const LOCAL_FORMAT = Object.freeze({
  weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZoneName: "short",
});
