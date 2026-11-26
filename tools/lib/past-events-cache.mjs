// past-events-cache.mjs — THE PAST CALENDAR, KEPT BETWEEN BUILDS (CORE-180, was POS-1225).
//
// Darko, 2026-11-24 17:55 EST: "Incremental build. Past events never change. Isn't that just the simple solution here?" The deploy's keyless budget (the office's nginx shield) was
// being spent re-reading the whole past calendar, and the list grows with the town: PAST_PAGES_MAX list pages every build, the second of which 429'd in run 45484503414.
// So the calendar ROWS of past events are read once and kept, and a build reads only the newest list page(s) until it meets what it already holds.
//
// WHERE IT IS KEPT. Not in the tree: the tracked src/data/postmark/events.json is the empty committed file on every clean checkout (Actions) and on every pass of the box's
// refresh (it force-checks-out and cleans before fetch-town.mjs). It is kept where the build ALREADY publishes it: the site's own last published file,
// `<town base>/data/events.json` (every pass writes it through writeDataFile, public/atelier/postmark/data). That file survives every checkout and reset by construction, is
// refreshed by every publishing pass, and reading it is one static GET outside the office's keyless limit zones. It is the site's own output, shape-checked here; it is a SEED,
// never a substitute for a read. It is OFF unless the build reads the production API (defaultEventsSeedUrl): another office's build never takes production's events.
//
// WHAT IS KEPT AND WHAT IS NEVER FROZEN (Wright, 2026-11-25 00:03Z / 01:59Z: the cache only saves requests, visitors see what they see today).
//   - ROWS: the list is followed newest-first and STOPS at the first page whose OLDEST event the build already holds (same id, same end): everything older is the held list's.
//     A stop keeps the held events older than that page, in order, and the held list's own cursor; nothing is dropped for being beyond a page the build did not need.
//   - EVIDENCE is NOT cached: every wanted event's one-event read is made every pass, exactly as before (changeable evidence, public-human presentation included, is as fresh
//     as it ever was). A read that fails, for any reason, is `unavailable` as on main: a held read is NEVER republished under this pass's time. Held ROWS are the cache.
//   - WITHDRAWAL: an event the build holds but the list no longer served this pass, whose one-event read the office DEFINITIVELY refused (404, 410), leaves the cache, row and
//     evidence, when the office is answering other reads this pass. A transient failure is never a withdrawal, and an event the list or the calendar served this pass is served.
//   - A failed list page still throws (the release lane then refuses to publish); a seed that is absent, refused, corrupt or not the events shape is no seed (the build reads
//     everything, as before, and says so).
//
// PURE except readEventsSeed's one GET; no clock, no rule about attendance, rooms, sparks or presentation. It never edits a row or an evidence entry.

const ID = /^[^/]+\/[^/]+$/;
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/** What the office answers when it no longer serves an event's one-event read: not found, gone. Everything else (429, 5xx, a timeout, a refusal that is the door's not the event's) is transient or unknown. */
export const EVENT_WITHDRAWN_STATUSES = new Set([404, 410]);

/** the events.json shape the site reads: `past.events` an array and `evidence` an object */
export const isEventsShape = (v) => isObj(v) && isObj(v.past) && Array.isArray(v.past.events) && isObj(v.evidence);

/** An event the build may ask the one-event read for: its doors have been open (not announced), it is not cancelled, and it has a <host>/<slug> id. */
export const wantsEvidence = (e) => !!e && typeof e.id === "string" && ID.test(e.id) && e.phase !== "announced" && !e.cancelled;

/**
 * Where the past calendar's seed is read from: an explicit POSTMARK_EVENTS_SEED_URL wins (the empty string is none); otherwise the site's own published file, and ONLY when the
 * build reads the default (production) API, so another office's build is never seeded with production's events.
 */
export function defaultEventsSeedUrl({ env = {}, api, defaultApi, townBase } = {}) {
  if (env.POSTMARK_EVENTS_SEED_URL !== undefined) return env.POSTMARK_EVENTS_SEED_URL || null;
  return api === defaultApi && townBase ? `${townBase}/data/events.json` : null;
}

/** True for a list page the build can stop at: its OLDEST event is one the build already holds, with the same end instant (so the held list continues exactly where the page ends). */
export function overlapsHeld(page, known) {
  const last = Array.isArray(page) ? page.at(-1) : null;
  return isObj(last) && typeof last.id === "string" && typeof last.ends === "string" && known.get(last.id)?.ends === last.ends;
}

/**
 * The last published events file as the build's HELD state. `url` is `<town base>/data/events.json`; an absent file (404) is a first build ("none"); a file that cannot be
 * fetched, parsed or is not the events shape is "unreadable" (the caller then reads in full, as the build always did, and says so). One try: this is a static file, not the
 * office's keyless API, and a refusal here is answered by the full read, never by a stale publication.
 * @returns {Promise<{ state: "unset"|"none"|"ok"|"unreadable", events?: object, reason?: string }>}
 */
export async function readEventsSeed({ url = null, fetchImpl = fetch, timeoutMs = 20_000 } = {}) {
  if (!url) return { state: "unset" };
  let res;
  try {
    res = await fetchImpl(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    return { state: "unreadable", reason: String(error?.message ?? error).slice(0, 160) };
  }
  if (res.status === 404) return { state: "none" };
  if (!res.ok) return { state: "unreadable", reason: `${res.status} ${res.statusText ?? ""}`.trim() };
  let body;
  try { body = await res.json(); } catch (error) { return { state: "unreadable", reason: `not JSON (${String(error?.message ?? error).slice(0, 100)})` }; }
  return isEventsShape(body) ? { state: "ok", events: body } : { state: "unreadable", reason: "it is not an events.json (past.events and evidence)" };
}

/**
 * Two held snapshots as one: the seed's (`primary`, the last published file) over the committed file's (`secondary`, empty on a clean checkout but not on a developer's tree).
 * Events: the primary's in its order, then any only the secondary holds. Evidence: the primary's entry wins an id both hold. The cursor is the primary's.
 */
export function joinHeld(primary, secondary) {
  const p = isObj(primary) ? primary : {}, s = isObj(secondary) ? secondary : {};
  const seen = new Set();
  const events = [...(Array.isArray(p.past?.events) ? p.past.events : []), ...(Array.isArray(s.past?.events) ? s.past.events : [])]
    .filter((e) => isObj(e) && typeof e.id === "string" && ID.test(e.id) && !seen.has(e.id) && seen.add(e.id));
  return {
    past: { events, next: p.past?.next ?? s.past?.next ?? null },
    evidence: { ...(isObj(s.evidence) ? s.evidence : {}), ...(isObj(p.evidence) ? p.evidence : {}) },
  };
}

/**
 * The list for the next events.json. `fresh` is what this build read (newest end first). When the read reached the END of the lasting list (`complete`) it is the whole list and
 * stands alone, exactly as before (an event the office no longer lists leaves). Otherwise (the build stopped at a page it already held, or was capped or refused) the held events
 * OLDER than the oldest read one follow it, in their own order (an equal end instant is kept: the office's page may have cut a tie); nothing is dropped for being beyond a page
 * the build did not need to read. A read row wins over a held one.
 */
export function mergePast({ fresh = [], held = [], complete = false } = {}) {
  if (complete) return fresh;
  const have = new Set(fresh.map((e) => e?.id));
  const ends = fresh.map((e) => e?.ends).filter((t) => typeof t === "string");
  const oldest = ends.length ? ends.reduce((a, b) => (b < a ? b : a)) : null;
  return [...fresh, ...held.filter((e) => !have.has(e.id) && (oldest === null || (typeof e.ends === "string" && e.ends <= oldest)))];
}

/**
 * The evidence map for the next events.json, over the events being published (`events`), after EVERY wanted event was asked (`fresh`, from fetchEventEvidence).
 *   answered ok                the fresh read, whole
 *   failed, for ANY reason    `{ read: "unavailable" }` (counted `failed`), exactly as on main: a 429, a 5xx, a timeout, a spent budget or a refusal. A held read is NEVER put back under this
 *                              pass's time (Wright, 2026-11-25: evidence stays as fresh as main's; a failed read says "couldn't be read", not an older answer, and not for ever)
 *   not asked                  no entry (the page reads that as never asked), as before
 * Held ROWS are the cache; held evidence is not. Nothing is edited.
 */
export function mergeEvidence({ events = [], fresh = {} } = {}) {
  const out = {};
  let refreshed = 0, failed = 0;
  for (const e of events) {
    if (!wantsEvidence(e)) continue;
    const got = fresh[e.id];
    if (!got) continue;
    if (got.read === "ok") { out[e.id] = got; refreshed++; }
    else { out[e.id] = { read: "unavailable" }; failed++; }
  }
  return { evidence: out, refreshed, failed };
}
