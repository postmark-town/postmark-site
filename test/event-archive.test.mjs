// event-archive.test.mjs — CORE-174: the build's work budgets are not the archive. An event page, once made, is kept; the evidence already held stands until a read answers;
// a refused, failed or unasked read is not a fresh empty answer; and old pages are refreshed in rotation, so a gallery baked early does not stay stale forever.
//
//   node --test test/event-archive.test.mjs
//
// PURE. It runs src/lib/event-archive.mjs and the real ingest (tools/lib/fetch-town-data.mjs fetchEvents) against a stub office with small INJECTED budgets (maxPages,
// evidenceMax), not a scale run; the live office is never read. The page wiring is read as source. Calendar states (known none / unknown / folded / so-far), the circle
// adapter and the page's presentation are unchanged and are covered by test/event-pages.test.mjs.
//
// FALSIFIERS: an older URL or its /calendar/ forward dropping after a capped successful ingest; evidence held becoming a false none (or "unavailable") after a refused or
// unasked read; a stale gallery that no read can ever replace; one read's fields merged into another's window; or the page losing its #gallery target.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { knowsLess, mergeArchive, mergeEvidence, pickEvidenceWork, wantsEvidence } from "../src/lib/event-archive.mjs";
import { allEventViews, evidenceRead, eventForPage, eventSections } from "../src/lib/calendar.mjs";
import { EMPTY_CALENDAR, EMPTY_EVENTS, PAST_PAGES_MAX, EVIDENCE_MAX, fetchEvents } from "../tools/lib/fetch-town-data.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OFFICE = "https://office.invalid";
const json = (status, body) => ({ ok: status >= 200 && status < 300, status, statusText: String(status), headers: { get: () => null }, json: async () => body });
const ev = (id, ends, extra = {}) => ({ id, title: id, host: id.split("/")[0], phase: "ended", ends, ...extra });
const E = (n) => ev(`h/e${n}`, `2026-11-${String(30 - n).padStart(2, "0")}T00:00:00.000Z`);   // e0 newest … e9 oldest
const gallery = (...sparks) => ({ rooms: ["r1"], sparks });
const evidenceOf = (over = {}) => ({ rooms: [], room_history: "complete", present: [], gallery: gallery(), complete: true, ...over });

/** a stub office: the lasting list as `pages` (each { before, body }), the one-event reads by id (`events[id]` or 404; `refuse` ids answer 503) */
const stubOffice = ({ pages = [], events = {}, refuse = new Set(), asked = [] } = {}) => async (url) => {
  const u = new URL(url);
  asked.push(u.pathname + u.search);
  if (u.pathname === "/town/apex" && u.searchParams.get("read") === "calendar") {
    const args = JSON.parse(u.searchParams.get("args"));
    const i = args.before ? pages.findIndex((p) => p.before === args.before) : 0;
    return i < 0 ? json(422, { error: "bounce" }) : json(200, pages[i].body);
  }
  const m = /^\/calendar\/([^/]+)\/([^/]+)$/.exec(u.pathname);
  if (m) {
    const id = `${decodeURIComponent(m[1])}/${decodeURIComponent(m[2])}`;
    if (refuse.has(id)) return json(503, { error: "down" });
    return events[id] ? json(200, { event: events[id] }) : json(404, { error: "bounce", code: 404 });
  }
  return json(404, { error: "bounce", code: 404 });
};
const AS_OF = "2026-11-30T12:00:00.000Z";
const listPages = (cap) => {   // pages of 2 events each, e0.. ; `cap` pages are served
  const pages = [];
  for (let p = 0; p < cap; p++) pages.push({ before: p ? `b${p}` : undefined, body: { as_of: AS_OF, past: [E(p * 2), E(p * 2 + 1)], next: { past: true, before: `b${p + 1}` }, note: null } });
  return pages;
};

test("the work budgets stay what they were, and the archive is not them", () => {
  assert.equal(PAST_PAGES_MAX, 25);
  assert.equal(EVIDENCE_MAX, 400);
});

test("INVENTORY: a capped batch keeps the batch's order and its newer word, and every retained event it does not reach; nothing without an id is kept", () => {
  const batch = [{ ...E(2), title: "newer word" }, E(3)];
  const retained = [E(2), E(5), { id: "bad id" }, null, E(3), E(9)];
  const out = mergeArchive({ batch, retained });
  assert.deepEqual(out.map((e) => e.id), ["h/e2", "h/e3", "h/e5", "h/e9"], "batch first, then what only the snapshot holds, each once");
  assert.equal(out[0].title, "newer word", "the batch's view wins");
  assert.deepEqual(mergeArchive({ batch: [], retained: [E(1)] }).map((e) => e.id), ["h/e1"], "a list that is not served leaves the snapshot's events standing");
  assert.deepEqual(mergeArchive({}), []);
});

test("FALSIFIER: after a capped SUCCESSFUL ingest an older event page and its /calendar/ forward are still built: both routes read the same kept list", async () => {
  // the committed file holds e0..e9; this run's list budget reaches only the two newest pages (e0..e3)
  const snapshot = { ...EMPTY_EVENTS, past: { ...EMPTY_EVENTS.past, events: Array.from({ length: 10 }, (_, i) => E(i)), read: "office" } };
  const r = await fetchEvents({ apiBase: OFFICE, fetchImpl: stubOffice({ pages: listPages(2) }), retries: 1, calendar: EMPTY_CALENDAR, snapshot, maxPages: 2, evidenceMax: 400 });
  assert.equal(r.events.past.read, "office");
  assert.deepEqual(r.events.past.events.map((e) => e.id), ["h/e0", "h/e1", "h/e2", "h/e3", "h/e4", "h/e5", "h/e6", "h/e7", "h/e8", "h/e9"], "the batch's four, then the six it did not reach");
  const routes = allEventViews(EMPTY_CALENDAR, r.events).map((e) => e.id);
  for (let i = 0; i < 10; i++) assert.ok(routes.includes(`h/e${i}`), `h/e${i}: its page and forward are still built`);
  assert.deepEqual(r.events.past.next, { past: true, before: "b2" }, "and the unread continuation is still said");
});

test("FALSIFIER: evidence held is not made a false none by a read that is refused, failed or not asked this run; an answered read replaces it whole", async () => {
  const held = (n, extra = {}) => ({ read: "ok", read_at: "2026-11-01T00:00:00.000Z", event: { id: `h/e${n}`, evidence: evidenceOf({ present: [`hh:old-${n}`], gallery: gallery({ id: `old-${n}` }), ...extra }) } });
  const snapshot = { ...EMPTY_EVENTS, as_of: "2026-11-01T00:00:00.000Z", past: { ...EMPTY_EVENTS.past, events: [E(0), E(1), E(2), E(3)], read: "office" }, evidence: { "h/e0": held(0), "h/e1": held(1), "h/e2": held(2), "h/e3": held(3) } };
  const asked = [];
  // budget: two reads this run. Held reads are all "ok", so the OLDEST-read go first (they are equal here: newest end breaks the tie): e0 then e1.
  // e0 answers (new gallery, NO `present` field: a whole replacement, never a field-by-field merge); e1 is refused (503); e2 and e3 are not asked.
  const r = await fetchEvents({
    apiBase: OFFICE, retries: 1, calendar: EMPTY_CALENDAR, snapshot, evidenceMax: 2,
    fetchImpl: stubOffice({ pages: listPages(1), asked, events: { "h/e0": { id: "h/e0", evidence: { rooms: [], room_history: "complete", gallery: gallery({ id: "fresh-0" }), complete: true } } }, refuse: new Set(["h/e1"]) }),
    maxPages: 1,
  });
  assert.equal(asked.filter((a) => a.startsWith("/calendar/")).length, 2, "only the budget was asked");
  const ev0 = r.events.evidence["h/e0"];
  assert.equal(ev0.read, "ok");
  assert.deepEqual(ev0.event.evidence.gallery.sparks.map((s) => s.id), ["fresh-0"], "the answered read replaced the stale gallery");
  assert.equal("present" in ev0.event.evidence, false, "whole replacement: nothing of the old read is mixed into the new one's window");
  assert.equal(ev0.read_at, AS_OF, "and it is stamped with when it was read");
  assert.deepEqual(r.events.evidence["h/e1"], snapshot.evidence["h/e1"], "a refused read leaves the evidence held exactly as it was read (its own read_at)");
  assert.deepEqual(r.events.evidence["h/e2"], snapshot.evidence["h/e2"], "an unasked read leaves it too");
  assert.deepEqual(r.events.evidence["h/e3"], snapshot.evidence["h/e3"]);
  // the page reads the kept evidence as what it was read: the held gallery, not none and not unavailable
  for (const id of ["h/e1", "h/e2", "h/e3"]) {
    const event = allEventViews(EMPTY_CALENDAR, r.events).find((e) => e.id === id);
    assert.equal(evidenceRead(event, r.events), "ok");
    const s = eventSections(eventForPage(event, r.events));
    assert.equal(s.gallery.state, "known");
    assert.equal(s.gallery.sparks[0].id, `old-${id.slice(3)}`, `${id}: the held gallery still stands`);
  }
  assert.ok(r.gaps.some((g) => /1 of 2 one-event reads were not served/.test(g) && /1 kept the evidence they already held/.test(g)), `the gap says what happened: ${JSON.stringify(r.gaps)}`);
});

test("an event with NO evidence held that is not asked stays 'absent' (never asked), and one that is asked and refused with none held is 'unavailable': neither is an empty answer", async () => {
  const snapshot = { ...EMPTY_EVENTS, past: { ...EMPTY_EVENTS.past, events: [E(0), E(1), E(2)], read: "office" }, evidence: {} };
  const r = await fetchEvents({ apiBase: OFFICE, retries: 1, calendar: EMPTY_CALENDAR, snapshot, evidenceMax: 2, maxPages: 0,
    fetchImpl: stubOffice({ pages: [], events: {}, refuse: new Set(["h/e0"]) }) });
  const views = allEventViews(EMPTY_CALENDAR, r.events);
  const read = (id) => evidenceRead(views.find((e) => e.id === id), r.events);
  assert.equal(read("h/e0"), "unavailable", "asked, refused, nothing held");
  assert.equal(read("h/e1"), "unavailable", "asked (404), nothing held");
  assert.equal(read("h/e2"), "absent", "not asked this run, nothing held: never asked, not empty");
  assert.equal(eventSections(eventForPage(views.find((e) => e.id === "h/e2"), r.events)).circles.state, "unavailable", "and the page says it could not be read, not that there was no talk");
});

test("ROTATION: pages never read come first (newest end first), then the oldest-read; so a stale baked gallery is asked again, and the budget never starves a page", () => {
  const events = [E(0), E(1), E(2), E(3), E(4)];
  const previous = {
    "h/e0": { read: "ok", read_at: "2026-11-20T00:00:00.000Z", event: {} },
    "h/e1": { read: "ok", read_at: "2026-11-01T00:00:00.000Z", event: {} },        // the oldest read
    "h/e2": { read: "ok", event: {} },                                              // read, but no stamp: the oldest of all
    "h/e3": { read: "unavailable" },                                                // only ever refused: no good read held
    // h/e4 never read
  };
  assert.deepEqual(pickEvidenceWork({ events, previous }), ["h/e3", "h/e4", "h/e2", "h/e1", "h/e0"],
    "no good read held first (e3 ended after e4), then a read with no stamp, then the oldest stamp");
  assert.deepEqual(pickEvidenceWork({ events, previous, max: 2 }), ["h/e3", "h/e4"]);
  assert.deepEqual(pickEvidenceWork({ events, previous: {}, max: 3 }), ["h/e0", "h/e1", "h/e2"], "with nothing held it is newest end first, as it always was");
  // across runs the same budget walks the whole list: ask 2 of 5 each run, stamping the answered, and every page is read within three runs
  let held = {};
  const seen = new Set();
  for (let run = 1; run <= 3; run++) {
    const ids = pickEvidenceWork({ events, previous: held, max: 2 });
    ids.forEach((id) => seen.add(id));
    held = mergeEvidence({ previous: held, fresh: Object.fromEntries(ids.map((id) => [id, { read: "ok", event: { id } }])), asOf: `2026-11-2${run}T00:00:00.000Z` }).evidence;
  }
  assert.equal(seen.size, 5, "three runs of two reads cover five pages");
});

test("cancelled, announced and id-less events are not asked for evidence, whatever the budget", () => {
  assert.equal(wantsEvidence(E(0)), true);
  assert.equal(wantsEvidence({ ...E(1), phase: "announced" }), false);
  assert.equal(wantsEvidence({ ...E(2), cancelled: true }), false);
  assert.equal(wantsEvidence({ id: "bad id" }), false);
  assert.deepEqual(pickEvidenceWork({ events: [E(0), { ...E(1), cancelled: true }, { ...E(2), phase: "announced" }] }), ["h/e0"]);
});

test("mergeEvidence never drops a held entry, stamps only an answered read, and counts what happened", () => {
  const previous = { a: { read: "ok", read_at: "t0", event: { id: "a" } }, z: { read: "ok", read_at: "t0", event: { id: "z" } } };
  const m = mergeEvidence({ previous, fresh: { a: { read: "unavailable" }, b: { read: "ok", event: { id: "b" } }, c: { read: "unavailable" } }, asOf: "t1" });
  assert.deepEqual(m.evidence.a, previous.a, "refused: held stands");
  assert.deepEqual(m.evidence.b, { read: "ok", event: { id: "b" }, read_at: "t1" });
  assert.deepEqual(m.evidence.c, { read: "unavailable" });
  assert.deepEqual(m.evidence.z, previous.z, "not asked: held stands");
  assert.deepEqual([m.refreshed, m.kept, m.failed], [1, 1, 1]);
  assert.deepEqual(mergeEvidence({ previous, fresh: { b: { read: "ok", event: { id: "b" } } } }).evidence.b, { read: "ok", event: { id: "b" } }, "no as_of, no stamp invented");
});

test("FALSIFIER: a read the office answers 200 but with LESS than the page holds (rooms unavailable, gallery null: the 60-settlement edge) does not erase the held gallery; a known none does replace it", () => {
  const held = { read: "ok", read_at: "t0", event: { id: "a", evidence: evidenceOf({ rooms: [{ id: "r1" }], gallery: gallery({ id: "kept-spark" }) }) } };
  const degraded = { read: "ok", event: { id: "a", evidence: { rooms: null, room_history: "unavailable", gallery: null, present: null } } };
  const one = mergeEvidence({ previous: { a: held }, fresh: { a: degraded }, asOf: "t1" });
  assert.deepEqual(one.evidence.a, held, "the held read stands, with its own read_at");
  assert.deepEqual([one.refreshed, one.kept, one.failed], [0, 1, 0]);
  assert.equal(knowsLess(degraded.event, held.event), true);
  // only the gallery lost, or only the rooms lost: still less
  assert.equal(knowsLess({ evidence: evidenceOf({ gallery: null }) }, held.event), true);
  assert.equal(knowsLess({ evidence: evidenceOf({ rooms: null }) }, held.event), true);
  assert.equal(knowsLess({ evidence: evidenceOf({ rooms: [], room_history: "unavailable" }) }, held.event), true);
  // an answer that KNOWS: an empty gallery is a known none, so it replaces (the office says there are none), and a degraded read with nothing held is just stored
  const none = { read: "ok", event: { id: "a", evidence: evidenceOf({ rooms: [], gallery: gallery() }) } };
  assert.deepEqual(mergeEvidence({ previous: { a: held }, fresh: { a: none }, asOf: "t1" }).evidence.a, { ...none, read_at: "t1" }, "known none replaces");
  assert.deepEqual(mergeEvidence({ previous: {}, fresh: { a: degraded }, asOf: "t1" }).evidence.a, { ...degraded, read_at: "t1" }, "with nothing held the degraded answer is stored as read (the page says unknown)");
  // a held read that itself knew nothing is replaced by anything
  const poor = { read: "ok", read_at: "t0", event: { id: "a", evidence: { rooms: null, room_history: "unavailable", gallery: null } } };
  assert.deepEqual(mergeEvidence({ previous: { a: poor }, fresh: { a: degraded }, asOf: "t1" }).evidence.a, { ...degraded, read_at: "t1" });
});

test("PAGE: the historical page keeps its presentation and gains the stable #gallery target; the one-event read is asked on running AND ended pages, only to ADD rooms through the same reader", () => {
  const src = readFileSync(join(ROOT, "town/pages/events/[host]/[slug].astro"), "utf8");
  assert.match(src, /<section class="ev-sec" aria-label="The gallery" id="gallery" data-ev-gallery/, "CORE-173's album can link to #gallery");
  assert.match(src, /data-live=\{!sections\.after \? "" : undefined\} data-refresh=\{sections\.after \? "" : undefined\}/, "running pages keep data-live; ended pages say they refresh");
  assert.match(src, /circ\.hasAttribute\("data-live"\) \|\| circ\.hasAttribute\("data-refresh"\)/);
  assert.match(src, /import \{ mountRoom \} from "@\/lib\/circle-reader-mount\.mjs";/, "the World's one reader through the unchanged adapter");
  assert.equal((src.match(/mountRoom\(/g) ?? []).length, 1, "no second reader");
  assert.equal(/new SparkCard|sparkCardHtml|innerHTML\s*=/.test(src), false, "no second card renderer: the baked gallery is still SparkCard's");
  assert.match(src, /<SparkCard spark=\{s\} roll=\{roll\} \/>/, "the gallery still draws SparkCard as before");
});
