// event-archive.mjs — WHAT THE SITE KEEPS OF THE EVENTS IT HAS EVER BUILT A PAGE FOR (CORE-174, from the CORE-170 durability sitting).
//
// Darko, 2026-11-23: "sparks, galleries, conversations, they should all be durable"; the ruled Site half: "keep the viewers and their links; change archive coverage,
// not their browsing design." The build's two work budgets (PAST_PAGES_MAX past-list pages, EVIDENCE_MAX one-event reads) say how much the build ASKS the office in one
// run. They are not the archive. Two things are kept here, and both are pure (no read, no clock, no site rule about attendance, rooms or sparks):
//
//   the INVENTORY   every event the lasting list ever gave this site keeps its page (and its /calendar/<host>/<slug>/ forward) after a capped batch that no longer reaches
//                   it. The batch's own view of an event is the newer word and wins; an event only the committed snapshot holds is kept as it stands.
//   the EVIDENCE    the one-event reads the build already holds. A read that is REFUSED, FAILED or NOT ASKED this run is not a fresh empty answer: the evidence already held
//                   stands in the ARCHIVE'S STORE, exactly as it was read (its own `read_at`; events.json publishes only what this pass read: `unavailable` for a failed or
//                   degraded read, nothing for one not asked: see mergeEvidence), and a read that answers REPLACES it whole (never merged field by field, so one window's talk is never
//                   mixed into another read's). Work is ordered so a page that has never been read comes first and the rest rotate oldest-read first, so a gallery baked
//                   before an event's sparks were made is refreshed, not left to stand forever.
//
// The office decides what an event's evidence is, scoped to its own window (POS-1203); this file only decides what the site KEEPS and what it ASKS FIRST.

/** The office's phases at which an event page draws its gallery (the same section as after the event): doors open, under way, ended. Not `announced`; a cancelled event is excluded by the page. */
export const GALLERY_PHASES = new Set(["doors-open", "underway", "ended"]);

const ID = /^[^/]+\/[^/]+$/;
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/** An event the build may ask the one-event read for: it has had its doors open (not announced) and is not cancelled. */
export const wantsEvidence = (e) => !!e && typeof e.id === "string" && ID.test(e.id) && e.phase !== "announced" && !e.cancelled;

/**
 * The inventory for the next events.json: the batch's events in the batch's order, then every retained event the batch did not give, in their own order. An event
 * with no usable id is dropped (it could not have a page). Nothing is ever dropped for being absent from a capped batch.
 */
export function mergeArchive({ batch = [], retained = [] } = {}) {
  const seen = new Set();
  const out = [];
  for (const e of [...(Array.isArray(batch) ? batch : []), ...(Array.isArray(retained) ? retained : [])]) {
    if (!isObj(e) || typeof e.id !== "string" || !ID.test(e.id) || seen.has(e.id)) continue;
    seen.add(e.id);
    out.push(e);
  }
  return out;
}

/** When the held read was made, for rotation: the office's own `as_of` it was stamped with, or "" (the oldest) when it carries none. */
const readAt = (entry) => (entry && entry.read === "ok" && typeof entry.read_at === "string" ? entry.read_at : "");

/**
 * The ids to ask the one-event read for this run, at most `max`. Eligible events only (wantsEvidence). Ordered: a page with no good read held first (never read, or
 * only ever refused), newest end first; then the pages whose held read is OLDEST (rotation); ties by newest end, then id. With nothing held this is newest-end-first.
 */
export function pickEvidenceWork({ events = [], previous = {}, max = Infinity } = {}) {
  const prev = isObj(previous) ? previous : {};
  const has = (id) => prev[id]?.read === "ok";
  return events
    .filter(wantsEvidence)
    .sort((a, b) => (has(a.id) ? 1 : 0) - (has(b.id) ? 1 : 0)
      || readAt(prev[a.id]).localeCompare(readAt(prev[b.id]))
      || String(b.ends ?? "").localeCompare(String(a.ends ?? ""))
      || a.id.localeCompare(b.id))
    .slice(0, max)
    .map((e) => e.id);
}

/**
 * Two snapshots of events.json as one held state: the archive file's (`primary`, what the last build kept outside the tree) over the committed file's (`secondary`, which is
 * empty on the box but may hold events elsewhere). Events: the primary's in its order, then any only the secondary holds. Evidence: the primary's entry wins an id both hold.
 */
export function joinSnapshots(primary, secondary) {
  const p = isObj(primary) ? primary : {}, s = isObj(secondary) ? secondary : {};
  return {
    ...p,
    past: { ...(isObj(p.past) ? p.past : {}), events: mergeArchive({ batch: p.past?.events, retained: s.past?.events }) },
    evidence: { ...(isObj(s.evidence) ? s.evidence : {}), ...(isObj(p.evidence) ? p.evidence : {}) },
  };
}

/**
 * WHEN THE OFFICE READ WHAT THIS EVENT'S PAGE SAYS, for the footer's "As the office read it at" (CORE-174 FIX). Not always the calendar's read: an archived event's evidence may be
 * older. This event's OWN good read stamp (`read_at`) when the build holds one; a held good read with NO stamp is of unknown time and gets null (nothing is said), listed or not.
 * With no good read held: for an event the calendar lists now, the calendar's read; else the events file's own `as_of`; else the calendar's; else null.
 */
export function eventReadAt(event, calendarAsOf, events, inCalendar = false) {
  const held = events?.evidence?.[event?.id];
  if (held?.read === "ok") {
    // held evidence with no stamp (a legacy or bare seed with no time) has an UNKNOWN time: no date, even for an event a fresh calendar lists (calendar metadata is not a fresh read of the held gallery).
    return typeof held.read_at === "string" && held.read_at ? held.read_at : null;
  }
  if (inCalendar && calendarAsOf) return calendarAsOf;
  return (typeof events?.as_of === "string" && events.as_of) || calendarAsOf || null;
}

/**
 * A snapshot's held reads, each carrying the time of the snapshot it came from where that is known: every good read with no `read_at` gets the snapshot's OWN `as_of` (a bare
 * published events.json predates stamping, so its evidence would otherwise read as fresh as the next pass). A snapshot with no `as_of` stamps nothing: the time stays unknown, it
 * is never invented from the pass that happens to carry it. Pure; returns a new object.
 */
export function stampHeld(events) {
  if (!isObj(events) || !isObj(events.evidence)) return events;
  const at = typeof events.as_of === "string" && events.as_of ? events.as_of : null;
  if (!at) return events;
  const evidence = {};
  for (const [id, entry] of Object.entries(events.evidence)) {
    evidence[id] = entry?.read === "ok" && !(typeof entry.read_at === "string" && entry.read_at) ? { ...entry, read_at: at } : entry;
  }
  return { ...events, evidence };
}

// What a one-event read KNOWS (the office's own states: a rooms array whose history is not "unavailable"; a gallery that is an object with a sparks array, empty included).
// Until the office keeps rooms durably (POS-1203) it answers an old event 200 with rooms "unavailable" and a null gallery once the event's window has passed its memory;
// that is a degraded answer, not news, and it must not erase a gallery the build already holds.
const roomsKnown = (e) => Array.isArray(e?.evidence?.rooms) && e.evidence.room_history !== "unavailable";
const galleryKnown = (e) => isObj(e?.evidence?.gallery) && Array.isArray(e.evidence.gallery.sparks);
/**
 * True when the fresh read knows LESS than the held one on either axis (rooms or gallery): then the held read stands, WHOLE. That is the deliberate trade (review low 3): a fresh read
 * that knows more on one axis (newly known rooms) but less on the other (the gallery gone unknown) does not win, because a field-by-field merge would mix two reads' windows;
 * the held read is refreshed by the next read that knows at least as much on both. `read_at` is the list's or calendar's `as_of` the read was stamped with, not the one-event read's own clock.
 */
export const knowsLess = (fresh, held) => (galleryKnown(held) && !galleryKnown(fresh)) || (roomsKnown(held) && !roomsKnown(fresh));

/**
 * The evidence map for the next events.json. `previous` is what the committed file held; `fresh` is this run's reads (`{ <id>: { read: "ok", event } | { read: "unavailable" } }`,
 * only for the events actually asked). `asOf` stamps a fresh good read.
 * STORED (`evidence`):
 *   fresh ok                     replaces the held entry whole, stamped `read_at` ... unless it KNOWS LESS than the held one (knowsLess: the rooms or the gallery
 *                                went from known to unknown), then the held entry stands, as for a refusal
 *   fresh unavailable, held ok   the held entry stands untouched (a failed refresh is not a new answer, and not an empty one)
 *   fresh unavailable, none held `{ read: "unavailable" }`
 *   not asked this run           the held entry stands; with none held there is no entry
 * Nothing held is ever dropped. PUBLISHED (`published`, only the events asked this run): the fresh good read, else `{ read: "unavailable" }`; nothing for an event not asked.
 */
export function mergeEvidence({ previous = {}, fresh = {}, asOf = null } = {}) {
  const out = { ...(isObj(previous) ? previous : {}) };
  // TWO VIEWS, never aliased (CORE-174 F1 on #507): `evidence` is what the archive STORES (durable, the table above); `published` is what THIS pass's events.json says. Durable storage is
  // not permission to publish a stale read as current (Wright, CORE-180: changeable evidence stays as fresh as main's, one publishing pass at most): an asked read that failed, or answered
  // with less than the stored one holds, is published `unavailable` as on main while the stored entry keeps its bytes and its own `read_at` for the next good read. An event not asked this
  // pass has no published entry (the page's "never asked"): the file holding it is not a read made now.
  const published = {};
  let refreshed = 0, kept = 0, failed = 0, degraded = 0;
  for (const [id, got] of Object.entries(isObj(fresh) ? fresh : {})) {
    if (got?.read === "ok" && isObj(got.event)) {
      if (out[id]?.read === "ok" && knowsLess(got.event, out[id].event)) {
        kept++; degraded++;                     // answered, but with less: the stored read stands, whole, and is NOT published as current
        published[id] = { read: "unavailable" };
        continue;
      }
      out[id] = { read: "ok", event: got.event, ...(typeof asOf === "string" && asOf ? { read_at: asOf } : {}) };
      published[id] = out[id];                  // never mutated after this: a demotion replaces the published entry, it does not edit the stored one
      refreshed++;
    } else if (out[id]?.read === "ok") {
      kept++; failed++;                         // the stored read stands exactly as it was read; this pass publishes `unavailable`
      published[id] = { read: "unavailable" };
    } else {
      out[id] = { read: "unavailable" };
      published[id] = { read: "unavailable" };
      failed++;
    }
  }
  return { evidence: out, published, refreshed, kept, failed, degraded };
}
