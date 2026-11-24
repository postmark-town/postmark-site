// event-pages.test.mjs — the lasting event page, its states, its past-events list and the site's adapter to the one circle reader (CORE-82).
//
//   node --test test/event-pages.test.mjs
//
// LAW (Darko, CORE-70, as CORE-82 quotes it): "every event gets one page" that "becomes an after-page that stays" (calls 2, 13); "the after-page
// shows the circles in full" (14:11Z, 11-14); "the gallery is a spark's child sparks" (15:06Z); accepted ones only (call 16); the people who did a
// public act at the place, never an RSVP (call 4). And the producer contract (/var/tmp/POS-1035-envelopes.md): "Empty arrays are known none;
// null is unknown", "Before completion, don't infer Spark creation from the clock", "No combined evidence.frame, browser membership or footprint
// inference". The page draws the office's fields and works out none of them.
//
// THREE THINGS RUN HERE. (1) The pure rules (src/lib/calendar.mjs eventSections and friends), against the INVENTED fixture
// test/fixtures/events.sample.json. (2) The ingest (tools/lib/fetch-town-data.mjs fetchEvents) against a stub office that answers as the real one
// does today (the lasting list refused 422 "unknown argument past") and as the producer's contract says it will. (3) The BUILT pages: the real
// event, past-events and forwarding pages are copied into a scratch Astro project inside node_modules with their two data imports pointed at the
// fixture, and built with Astro's own programmatic build (seconds, no browser), so every claim below is read off the HTML a visitor receives.
// The adapter (src/lib/circle-reader-mount.mjs) is run against a fake reader module and a fake office.
//
// EVERY IDENTITY HERE IS INVENTED (the fixture says so); the live office is never read.

import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  EVENT_WORDS, allEventViews, eventForPage, eventHref, eventSections, evidenceRead, isRoomId, legacyEventHref, pictureOf, roomHref, roomIdOf,
} from "../src/lib/calendar.mjs";
import { EMPTY_EVENTS, EMPTY_CALENDAR, fetchEvents, fetchPastEvents, fetchEventEvidence, DATA_FILES, EVENTS_GAP, EMPTY_SPARKS, SPARKS_GAP, fetchSparks, sparkViewOfMark } from "../tools/lib/fetch-town-data.mjs";
import { READER_MODULE, circleUrl, loadReader, mountRoom, mountRooms, officeSource, roomUrl } from "../src/lib/circle-reader-mount.mjs";
import { CATALOGUE_WORDS, SPARK_FILTERS, collectSparks, eventOfSpark, sparkHref, sparkParam } from "../src/lib/sparks.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const FX = JSON.parse(readFileSync(join(ROOT, "test/fixtures/events.sample.json"), "utf8"));
const CAL = FX.calendar;
const EVENTS = FX.events;
const byId = (id) => allEventViews(CAL, EVENTS).find((e) => e.id === id);
const page = (id) => eventForPage(byId(id), EVENTS);

const SUPPER = "supperkeeper-test/harvest-supper-test";      // ended 10+ days before the as_of: outside the calendar's seven days
const QUIET = "teakeeper-test/quiet-tea-test";               // evidence: no rooms, proved (history complete), nobody present, no spark
const LOST = "lostkeeper-test/lost-read-test";               // the build's one-event read failed
const OLD = "oldkeeper-test/before-the-record-test";         // room history unavailable, present null, gallery null, a claim not accepted
const LIVE = "lanternkeeper-test/lantern-walk-test";
const COMING = "readerkeeper-test/reading-by-the-lamp-test";
const SORBET = "sorbetkeeper-test/sorbet-night-test";        // ended inside the seven days, accepted root spark, empty gallery

// ── (1) the pure rules ───────────────────────────────────────────────────────────────────────────────────────────────────

test("an event's address is permanent at /events/, the old /calendar/ address is only a forward, and an id that is not <host>/<slug> has none", () => {
  assert.equal(eventHref(SUPPER), "/events/supperkeeper-test/harvest-supper-test/");
  assert.equal(legacyEventHref(SUPPER), "/calendar/supperkeeper-test/harvest-supper-test/");
  assert.equal(eventHref("nope"), null);
  assert.equal(roomHref("t1-a b"), "/conversations/#t1-a%20b");
});

test("FALSIFIER: an ended event OUTSIDE the seven-day calendar list still has a page, from the lasting list, once, and the calendar's word wins a duplicate", () => {
  const inCalendar = new Set([...CAL.now, ...CAL.coming, ...CAL.ended].map((e) => e.id));
  assert.equal(inCalendar.has(SUPPER), false, "control: the supper is not on the calendar's three lists");
  const ids = allEventViews(CAL, EVENTS).map((e) => e.id);
  assert.ok(ids.includes(SUPPER) && ids.includes(QUIET) && ids.includes(LOST) && ids.includes(OLD), "every lasting-list event is built");
  assert.equal(new Set(ids).size, ids.length, "each event once");
  // a duplicate: the same event on the calendar's list and on the lasting list keeps the calendar's (newer) view
  const dup = { ...EVENTS, past: { ...EVENTS.past, events: [{ ...CAL.ended[0], title: "STALE TITLE" }, ...EVENTS.past.events] } };
  assert.equal(allEventViews(CAL, dup).find((e) => e.id === SORBET).title, CAL.ended[0].title);
  // the build's one-event read is laid over the list's view, and an unavailable read leaves the list's view alone
  assert.ok(page(SUPPER).evidence, "the supper carries its evidence");
  assert.equal(page(LOST).evidence, undefined, "an unavailable read adds no evidence");
  assert.equal(evidenceRead(byId(LOST), EVENTS), "unavailable");
  assert.equal(evidenceRead(byId(COMING), EVENTS), "absent");
});

test("the supper's after-page: the accepted root spark, the people who did a public act (never an RSVP), every room, and the gallery of accepted child sparks", () => {
  const s = eventSections(page(SUPPER));
  assert.equal(s.after, true);
  assert.equal(s.sparks.state, "known");
  assert.deepEqual(s.sparks.items.map((i) => i.kind), ["spark", "spark", "reference"], "every public completion spark and reference, in the producer's order, none chosen");
  assert.equal(s.sparks.items[0].spark.recounting, "A long table, too many dishes, and one very serious argument about pie.");
  assert.equal(s.sparks.items[2].status, "pending");
  assert.match(s.sparks.note, /cap may leave some rooms/);
  assert.deepEqual(s.circles.rooms.map(roomIdOf), ["t1792519260000-supperkeeper-test", "t1792520400000-guest-test"], "EVERY qualifying room, in the office's order, none chosen");
  assert.equal(s.circles.state, "rooms");
  assert.deepEqual(s.present.households, ["hh:supper-test-house", "solo:guest-test"]);
  // LAW (CORE-70 call 4): "who was there (a public act at the place in the window, never RSVPs)". The RSVP list has someone the evidence does not.
  const rsvps = byId(SUPPER).rsvps.residents;
  assert.ok(rsvps.includes("rsvponly-test"), "control: the fixture has an RSVP-only person");
  assert.equal(JSON.stringify(s.present).includes("rsvponly-test"), false, "an RSVP is not who-came evidence");
  assert.equal(s.gallery.state, "known");
  assert.deepEqual(s.gallery.sparks.map((x) => x.id), ["guest-test/the-pie-argument", "supperkeeper-test/the-last-slice"], "in the order the office accepted them");
  assert.equal(s.gallery.sparks.some((x) => x.id === SUPPER), false, "the root is not repeated in the gallery");
});

test("known none is not unknown: an empty set, a proved no-room, no spark yet; and unknown is never drawn as empty", () => {
  const q = eventSections(page(QUIET));
  assert.equal(q.circles.state, "none", "history complete and no rooms: nothing formed at the place");
  assert.equal(q.present.state, "known"); assert.deepEqual(q.present.households, []);
  assert.equal(q.sparks.state, "none", "an empty public collection is 'none yet', taken from the office's [] and not from the clock");
  assert.deepEqual(q.sparks.items, []);
  // null is UNAVAILABLE (with its note), absent is unknown, and neither is drawn as none; the singular `spark` of the old envelope is not read at all
  const ev = (over) => ({ id: "h/s", phase: "ended", cancelled: false, evidence: { rooms: [], room_history: "complete", present: [], gallery: { rooms: [], sparks: [] }, ...over } });
  const nul = eventSections(ev({ sparks: null, spark_note: "the collection could not be read" }));
  assert.equal(nul.sparks.state, "unavailable"); assert.equal(nul.sparks.note, "the collection could not be read");
  assert.equal(eventSections(ev({})).sparks.state, "unknown");
  assert.equal(eventSections(ev({ spark: { id: "x", accepted: true, body: "old singular alias" } })).sparks.state, "unknown", "the unpublished singular alias is ignored, never promoted to the collection");
  assert.equal(eventSections(ev({ sparks: [], gallery: null, gallery_note: "n" })).gallery.state, "unknown", "root and gallery availability are independent");
  assert.equal(q.gallery.state, "known"); assert.deepEqual(q.gallery.sparks, []);
  // a missing read on an event that has run: unavailable / unknown in EVERY section (the build asked and was not answered)
  const l = eventSections(page(LOST));
  assert.deepEqual([l.circles.state, l.present.state, l.sparks.state, l.gallery.state], ["unavailable", "unknown", "unknown", "unknown"]);
  // rooms unavailable, present null, gallery null, a claim: each its own honest state
  const o = eventSections(page(OLD));
  assert.equal(o.circles.state, "unavailable"); assert.match(o.circles.note, /oldest settlement/);
  assert.equal(o.present.state, "unknown");
  assert.deepEqual(o.sparks.items.map((i) => [i.kind, i.status]), [["reference", "claim awaiting acceptance"], ["reference", "withdrawn"]]);
  assert.equal(o.gallery.state, "unknown"); assert.match(o.gallery.note, /unknown/);
  // CONTROL for the arms above: the same function says "known" for the same shapes when the office served them
  assert.equal(eventSections(page(SUPPER)).present.state, "known");
});

test("before the doors open there is no evidence and the page says so; a running event shows its rooms so far; a cancelled event claims nothing", () => {
  const c = eventSections(page(COMING));
  assert.equal(c.circles.state, "before"); assert.equal(c.after, false);
  assert.equal(c.sparks.state, "none", "no spark is expected before the event, and none is worked out");
  const live = eventSections(page(LIVE));
  assert.equal(live.circles.state, "rooms"); assert.equal(live.after, false); assert.equal(live.complete, false);
  assert.equal(live.gallery.complete, false, "while the event is on, coverage is 'so far'");
  const cancelled = eventSections({ ...page(COMING), phase: "ended", cancelled: true });
  assert.equal(cancelled.circles.state, "cancelled");
  assert.deepEqual([cancelled.present.state, cancelled.sparks.state, cancelled.gallery.state], ["unknown", "unknown", "unknown"]);
  // a phase that is not 'announced' with NO evidence is unavailable, never 'before' (the page does not read a clock)
  assert.equal(eventSections({ ...page(COMING), phase: "underway" }).circles.state, "unavailable");
});

test("room ids are opaque string-or-number values: a positive number and zero survive, an empty string or a non-id is none, and no say id is inferred", () => {
  assert.equal(isRoomId("t1-pica"), true); assert.equal(isRoomId(7), true); assert.equal(isRoomId(0), true, "zero is a number, not an absence");
  for (const bad of ["", null, undefined, NaN, Infinity, {}, [], true]) assert.equal(isRoomId(bad), false, `${String(bad)} is no room id`);
  assert.equal(roomIdOf(7), 7, "a bare numeric coverage id"); assert.equal(roomIdOf(0), 0);
  assert.equal(roomIdOf({ id: 42, place: "x" }), 42, "a header's numeric id, as served"); assert.equal(roomIdOf({ id: 0 }), 0);
  assert.equal(roomIdOf({ id: "" }), null); assert.equal(roomIdOf({ place: "no id" }), null); assert.equal(roomIdOf(null), null);
  assert.equal(roomHref(0), "/conversations/#0"); assert.equal(roomHref(42), "/conversations/#42");
  // a room id is never a circle: no #circle- anchor is made from it
  assert.equal(roomHref(42).includes("circle-"), false);
});

test("an ABSENT completion flag on a served gallery is unknown, never complete; true and false stay literal", () => {
  const ev = (complete) => ({ id: "h/s", phase: "ended", cancelled: false, evidence: { rooms: [], room_history: "complete", present: [], sparks: [], gallery: { rooms: [], sparks: [] }, ...(complete === undefined ? {} : { complete }) } });
  assert.equal(eventSections(ev(true)).gallery.complete, true);
  assert.equal(eventSections(ev(false)).gallery.complete, false);
  assert.equal(eventSections(ev(undefined)).gallery.complete, null, "absent: unknown");
  assert.equal(eventSections(ev("yes")).gallery.complete, null, "a non-boolean is not a claim either");
  assert.equal(eventSections(ev(undefined)).complete, false, "and the page-level flag is true only when the office said true");
});

test("a spark's picture is drawn only from a site path or an https address; anything else is no picture", () => {
  assert.deepEqual(pictureOf({ picture: "/media/a.png" }), { src: "/media/a.png", alt: null });
  assert.deepEqual(pictureOf({ picture: { url: "https://example.invalid/x.png", alt: "a pie" } }), { src: "https://example.invalid/x.png", alt: "a pie" });
  for (const bad of [undefined, null, "", "  ", "http://x/y.png", "//evil/y.png", "javascript:alert(1)", "data:image/png;base64,AAAA", { url: 7 }, 5, ["/a.png"]])
    assert.equal(pictureOf({ picture: bad }), null, `${JSON.stringify(bad)} is no picture`);
});

// ── (2) the ingest ───────────────────────────────────────────────────────────────────────────────────────────────────────

const json = (status, body) => ({ ok: status >= 200 && status < 300, status, statusText: String(status), headers: { get: () => null }, json: async () => body });
const OFFICE = "https://office.invalid";
// THE SPARK REGISTER the ingest reads (CORE-121): the office's anonymous GET /world2/marks?all=true&full=true, INVENTED rows (the live office is never read)
const MARK = (slug, kind, over = {}) => ({ id: `uuid-${slug}`, slug, kind, owner: slug.split("/")[0], household: `hh:${slug.split("/")[0]}-house`, status: "standing", locked_window: 55, parent: null, geometry: null, body: `${slug} (invented)`, data: {}, ...over });
const REGISTER_MARKS = [
  MARK("eventless-test/lamp", "spark", { body: "A lamp left on the quay (invented, no event)", data: { recounting: "Left burning for the ferry that never came.", experienced_at: "2026-11-10T20:00:00.000Z", experienced_until: "2026-11-10T21:00:00.000Z" } }),
  MARK("guest-test/the-pie-argument", "spark", { body: "The pie argument (the register's own view)", data: { recounting: "Register recounting.", rooms: ["t1792519260000-supperkeeper-test"], picture: "https://media.postmark.town/media/guest-test/" + "a".repeat(64) + ".jpg" } }),
  MARK("littlebird-test/ferry", "spark", { body: "The ferry that waited (invented)", data: { rooms: ["t1-ferry"], event: "supperkeeper-test/harvest-supper-test", parent_spark: "eventless-test/lamp", circle: 70002, circle_path: [70001, 70002] } }),
  MARK("shop-test/a-stool", "thing"),
  MARK("hidden-test/not-listed", "spark", { status: "standing" }),
];
const registerOffice = (body, status = 200) => async (url) => { const u = new URL(url); return u.pathname === "/world2/marks" && u.searchParams.get("all") === "true" && u.searchParams.get("full") === "true" ? json(status, body) : json(404, { error: "bounce", code: 404 }); };
const REGISTER = (await fetchSparks({ apiBase: OFFICE, fetchImpl: registerOffice({ what: "marks", count: REGISTER_MARKS.length, marks: REGISTER_MARKS.filter((m) => m.slug !== "hidden-test/not-listed") }), retries: 1 })).sparks;

/** a stub office: `pastPages` is the lasting list as the producer will serve it, or null for the office as it is today (422 unknown argument "past") */
const stubOffice = ({ pastPages = null, events = {}, asked = [] } = {}) => async (url) => {
  const u = new URL(url);
  asked.push(u.pathname + u.search);
  if (u.pathname === "/town/apex" && u.searchParams.get("read") === "calendar") {
    if (!pastPages) return json(422, { error: "bounce", code: 422, defect: 'unknown argument "past" for read_calendar', hint: "this read takes: event, post" });
    const args = JSON.parse(u.searchParams.get("args"));
    assert.equal(args.past, true);
    const i = args.before ? pastPages.findIndex((p) => p.before === args.before) : 0;
    return i < 0 ? json(422, { error: "bounce", code: 422 }) : json(200, pastPages[i].body);
  }
  const m = /^\/calendar\/([^/]+)\/([^/]+)$/.exec(u.pathname);
  if (m) {
    const id = `${decodeURIComponent(m[1])}/${decodeURIComponent(m[2])}`;
    return events[id] ? json(200, { event: events[id] }) : json(404, { error: "bounce", code: 404 });
  }
  return json(404, { error: "bounce", code: 404 });
};
const ev = (id, phase = "ended", extra = {}) => ({ id, title: id, host: id.split("/")[0], phase, ends: "2026-10-01T00:00:00.000Z", ...extra });

test("the lasting list refused as the office does today (422 unknown argument past) is `unavailable`, never an empty list, and the committed snapshot's events stand", async () => {
  const asked = [];
  const kept = { ...EMPTY_EVENTS, past: { ...EMPTY_EVENTS.past, events: [ev("kept/an-old-one")], read: "office" } };
  const r = await fetchEvents({ apiBase: OFFICE, fetchImpl: stubOffice({ asked }), retries: 1, calendar: EMPTY_CALENDAR, snapshot: kept });
  assert.equal(r.events.past.read, "unavailable");
  assert.deepEqual(r.events.past.events.map((e) => e.id), ["kept/an-old-one"], "the snapshot's events are kept, not dropped");
  assert.equal(r.events.past.next, null);
  assert.ok(r.gaps.includes(EVENTS_GAP), "and the gap is named");
  assert.ok(asked[0].startsWith('/town/apex?read=calendar&args=%7B%22past%22%3Atrue%7D'), `the keyless apex twin is what is asked: ${asked[0]}`);
  // with no snapshot the list is empty AND says unavailable (a reader of events.json cannot mistake the one for the other)
  const none = await fetchEvents({ apiBase: OFFICE, fetchImpl: stubOffice(), retries: 1, calendar: EMPTY_CALENDAR });
  assert.deepEqual([none.events.past.read, none.events.past.events.length], ["unavailable", 0]);
});

test("when the office serves the lasting list the build follows its continuation page by page, newest first, and reads each started event once", async () => {
  const asked = [];
  const p1 = { as_of: "2026-11-14T21:00:00.000Z", past: [ev("a/one", "ended", { ends: "2026-10-30T00:00:00.000Z" }), ev("a/two", "ended", { ends: "2026-10-29T00:00:00.000Z" })], next: { past: true, before: "2026-10-29T00:00:00.000Z" }, note: "40 a page" };
  const p2 = { as_of: p1.as_of, past: [ev("b/three", "ended", { ends: "2026-10-01T00:00:00.000Z" })], next: null, note: "40 a page" };
  const calendar = { as_of: p1.as_of, now: [ev("live/going", "underway")], coming: [ev("soon/later", "announced")], ended: [], total: 2 };
  const office = stubOffice({
    asked, pastPages: [{ before: undefined, body: p1 }, { before: "2026-10-29T00:00:00.000Z", body: p2 }],
    events: { "a/one": { id: "a/one", evidence: { rooms: [] } }, "live/going": { id: "live/going", evidence: { rooms: [] } } },
  });
  const r = await fetchEvents({ apiBase: OFFICE, fetchImpl: office, retries: 1, calendar });
  assert.deepEqual(r.events.past.events.map((e) => e.id), ["a/one", "a/two", "b/three"]);
  assert.equal(r.events.past.read, "office"); assert.equal(r.events.past.next, null);
  assert.equal(asked.filter((a) => a.startsWith("/town/apex")).length, 2, "two pages were followed, by the office's own `before`");
  const reads = asked.filter((a) => a.startsWith("/calendar/"));
  assert.ok(!reads.some((a) => a.includes("soon")), "an announced event has no evidence to read");
  assert.equal(r.events.evidence["a/one"].read, "ok");
  assert.equal(r.events.evidence["a/two"].read, "unavailable", "a one-event read that is not served is unavailable, not empty");
  assert.ok(r.gaps.some((g) => /one-event reads were not served/.test(g)), "and the count is said");
  assert.ok(DATA_FILES.includes("events.json"));
});

test("a continuation past the build's page cap is kept, so the page can say there are older events", async () => {
  const mk = (n, next) => ({ as_of: "x", past: [ev(`h/e${n}`)], next, note: null });
  const pages = [0, 1, 2].map((n) => ({ before: n ? `b${n}` : undefined, body: mk(n, { past: true, before: `b${n + 1}` }) }));
  const r = await fetchPastEvents({ apiBase: OFFICE, fetchImpl: stubOffice({ pastPages: pages }), retries: 1, maxPages: 2 });
  assert.equal(r.events.length, 2);
  assert.deepEqual(r.next, { past: true, before: "b2" }, "the unread continuation stands in the file");
});

test("a cancelled or announced event is not asked for evidence; the evidence list is bounded", async () => {
  const asked = [];
  const evs = [ev("a/x", "ended"), ev("a/y", "ended", { cancelled: true }), ev("a/z", "announced"), ev("a/w", "underway"), { id: "bad id" }];
  const e = await fetchEventEvidence({ apiBase: OFFICE, fetchImpl: stubOffice({ asked, events: {} }), retries: 1, events: evs });
  assert.deepEqual(Object.keys(e).sort(), ["a/w", "a/x"]);
  assert.equal(asked.length, 2);
  const capped = await fetchEventEvidence({ apiBase: OFFICE, fetchImpl: stubOffice({ events: {} }), retries: 1, events: [ev("a/1"), ev("a/2"), ev("a/3")], max: 2 });
  assert.equal(Object.keys(capped).length, 2);
});

// ── the adapter to the one reader ────────────────────────────────────────────────────────────────────────────────────────

test("the adapter asks only the keyless addresses the office issues, and refuses anything else before a request is made", () => {
  assert.equal(roomUrl("/api", "t1794686460000-pica"), "/api/world/conversations?room=t1794686460000-pica");
  assert.equal(roomUrl("/api/", "t 1/x"), "/api/world/conversations?room=t%201%2Fx");
  assert.equal(roomUrl("/api", ""), null);
  assert.equal(circleUrl("/api", 50105), "/api/world/conversations?circle=50105");
  assert.equal(circleUrl("/api", 50105, 50108), "/api/world/conversations?circle=50105&after=50108");
  for (const bad of ["abc", "1; drop", "-1", "1.5", ""]) assert.equal(circleUrl("/api", bad), null, `circle ${bad}`);
  assert.equal(circleUrl("/api", 5, "x"), null, "an `after` the office did not serve is not sent");
});

test("the source REJECTS on every answer that is not the office's conversations read, so the reader can say 'couldn't read it' instead of 'empty'", async () => {
  const ok = { now: 1, earshot_m: 60, find: { room: { id: "r" }, history: "complete", circles: {} } };
  const mk = (status, body, throws = false) => async () => { if (throws) throw new TypeError("fetch failed"); return { status, json: async () => { if (body === undefined) throw new SyntaxError("<html>"); return body; } }; };
  assert.deepEqual(await officeSource({ fetchImpl: mk(200, ok) }).room("r"), ok);
  for (const [why, f] of Object.entries({
    "a 422 refusal": mk(422, { error: "bounce", defect: "say 9 is not in circle 5" }), "a 503": mk(503, { error: "bounce" }), "a network failure": mk(0, null, true),
    "a non-JSON 200": mk(200, undefined), "a 200 without `find`": mk(200, { now: 1 }), "a 404 from a server with no office behind it": mk(404, undefined),
  })) await assert.rejects(officeSource({ fetchImpl: f }).room("r"), (e) => e instanceof Error, why);
  const e = await officeSource({ fetchImpl: mk(422, { defect: "say 9 is not in circle 5" }) }).circle(5, 9).catch((x) => x);
  assert.equal(e.message, "say 9 is not in circle 5", "the office's own defect is carried");
  await assert.rejects(officeSource({ fetchImpl: mk(200, ok) }).circle("nope"), /not an address/);
});

const FAKE_READER = (log) => ({
  READER_CSS: ".fake{}",
  createCircleReader: (o) => ({ showRoom: async (id) => { log.push(["showRoom", id, Object.keys(o).sort()]); } }),
});
const fakeDoc = () => {
  const made = [];
  const head = { append: (n) => made.push(n) };
  return { made, head, documentElement: head, querySelector: () => null, createElement: () => ({ setAttribute() {}, textContent: "" }) };
};

test("the adapter loads the staged module, mounts one room, and when the reader is NOT there it says so (the page keeps its floor)", async () => {
  assert.equal(READER_MODULE, "/world-engine/spectator/circle-reader.mjs");
  const log = [];
  const doc = fakeDoc();
  const m = await mountRoom({ doc, host: {}, roomId: "r1", importImpl: async (u) => { log.push(["import", u]); return FAKE_READER(log); } });
  assert.equal(m.ok, true);
  assert.deepEqual(log[0], ["import", READER_MODULE]);
  assert.deepEqual(log[1], ["showRoom", "r1", ["canReply", "doc", "host", "hrefForCircle", "onNavigate", "onReply", "roomId", "source"]]);
  assert.equal(doc.made.length, 1, "the reader's CSS is added once");
  // CONTROL for the arms below: the same call succeeded above, so what follows is the module's absence and not a broken harness
  for (const [why, importImpl] of Object.entries({
    "the pinned World predates the reader (404)": async () => { throw new TypeError("Failed to fetch dynamically imported module"); },
    "a module without the reader": async () => ({ nothing: true }),
  })) {
    const r = await mountRoom({ doc: fakeDoc(), host: {}, roomId: "r1", importImpl });
    assert.equal(r.ok, false, why);
    assert.match(r.why, /not on this site's pinned World/, why);
  }
  assert.equal((await mountRoom({ doc: fakeDoc(), host: null, roomId: "r1", importImpl: async () => FAKE_READER([]) })).ok, false, "no host");
  assert.equal(await loadReader({ importImpl: async () => { throw new Error("x"); } }), null);
});

test("several rooms mount in the office's order, none ranked or chosen, and one failing room does not stop the rest", async () => {
  const log = [];
  let n = 0;
  const importImpl = async () => { n++; return n === 2 ? null : FAKE_READER(log); };     // the 2nd room's import comes back with no reader
  const out = await mountRooms({ doc: fakeDoc(), hosts: [{ host: {}, roomId: "a" }, { host: {}, roomId: "b" }, { host: {}, roomId: "c" }], importImpl });
  assert.deepEqual(out.map((o) => [o.roomId, o.ok]), [["a", true], ["b", false], ["c", true]]);
  assert.deepEqual(log.filter((l) => l[0] === "showRoom").map((l) => l[1]), ["a", "c"]);
});

// ── (3) the BUILT pages, from the fixture ────────────────────────────────────────────────────────────────────────────────

let OUT = null;
let DIST = null;
before(async () => {
  OUT = mkdtempSync(join(ROOT, "node_modules", ".core82-event-test-"));
  const src = join(OUT, "town", "pages"), data = join(OUT, "data");
  for (const d of [join(src, "events", "[host]"), join(src, "calendar", "[host]"), join(src, "sparks"), data, join(OUT, "public")]) mkdirSync(d, { recursive: true });
  writeFileSync(join(data, "calendar.json"), JSON.stringify(CAL));
  writeFileSync(join(data, "events.json"), JSON.stringify(EVENTS));
  writeFileSync(join(data, "sparks.json"), JSON.stringify(REGISTER));       // the register as the ingest reads it (fetchSparks, over the stub office below)
  // the page files are COPIED with their two data imports pointed at the fixture: nothing tracked is touched
  const point = (t) => t.replaceAll('"@/data/postmark/calendar.json"', JSON.stringify(join(data, "calendar.json"))).replaceAll('"@/data/postmark/events.json"', JSON.stringify(join(data, "events.json"))).replaceAll('"@/data/postmark/sparks.json"', JSON.stringify(join(data, "sparks.json")));
  for (const rel of ["events/index.astro", "events/[host]/[slug].astro", "calendar/[host]/[slug].astro", "sparks/index.astro", "sparks/[...id].astro"]) writeFileSync(join(src, rel), point(readFileSync(join(ROOT, "town/pages", rel), "utf8")));
  const { build } = await import("astro");
  await build({
    root: ROOT, configFile: false, srcDir: join(OUT, "town"), outDir: join(OUT, "dist"), publicDir: join(OUT, "public"), site: "https://postmark.town",
    logLevel: "silent", vite: { resolve: { alias: [{ find: "@", replacement: join(ROOT, "src") }] }, logLevel: "silent" },
  });
  DIST = join(OUT, "dist");
});
after(() => { if (OUT) rmSync(OUT, { recursive: true, force: true }); });   // the scratch folder this file made itself, and nothing else

const built = (...segs) => { const f = join(DIST, ...segs, "index.html"); return existsSync(f) ? readFileSync(f, "utf8") : null; };
const eventHtml = (id) => built("events", ...id.split("/"));
const textOf = (html) => html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ");
const section = (html, marker) => { const i = html.indexOf(marker); if (i < 0) return ""; const j = html.indexOf("</section>", i); return html.slice(i, j < 0 ? undefined : j); };

test("BUILT FALSIFIER: the ended event outside the seven-day list has its page at /events/<host>/<slug>/, with the after-page parts and the accepted child gallery", () => {
  const html = eventHtml(SUPPER);
  assert.ok(html, "the supper's page was not built");
  assert.match(html, /data-event-page[^>]*data-after/);
  const t = textOf(html);
  assert.ok(t.includes("Harvest Supper (invented; ended outside the seven-day list)"));
  // the sparks: EVERY public completion spark, in the producer's order, each with headline, recounting and credit; then the public reference and the note
  const spark = section(html, "data-ev-sparks");
  // the PICTURED one is the picture and one caption (CORE-121, Darko 13:14 EST): its recounting is on its own page, not on the card
  assert.equal(/A long table, too many dishes, and one very serious argument about pie\./.test(textOf(spark)), false, "an image card carries no recounting");
  assert.match(textOf(built("sparks", "supperkeeper-test", "harvest-supper-test")), /A long table, too many dishes, and one very serious argument about pie\./, "the bigger view has every served word");
  assert.match(textOf(spark), /The second room kept talking about pie until the lamps went out\./);
  assert.deepEqual([...spark.matchAll(/data-spark="([^"]*)"/g)].map((m) => m[1]), ["supperkeeper-test/harvest-supper-test", "supperkeeper-test/harvest-supper-guests-test"], "both completion sparks, none chosen as the default");
  assert.equal((spark.match(/data-spark-picture/g) ?? []).length, 1, "only the spark that has a picture draws a picture tile");
  assert.match(spark, /data-spark-credit/);
  assert.match(spark, /data-spark-ref="supperkeeper-test\/harvest-supper-pending-test"/); assert.match(textOf(spark), /the office says: pending/);
  assert.match(spark, /data-ev-spark-note/); assert.match(textOf(spark), /a cap may leave some rooms without one/);
  // the gallery: both accepted child sparks, no completion spark among them
  const gal = section(html, "data-ev-gallery");
  assert.equal((gal.match(/data-spark="/g) ?? []).length, 2);
  assert.ok(gal.includes("The pie argument") && gal.includes("The last slice"));
  assert.equal(gal.includes('data-spark="supperkeeper-test/harvest-supper-test"') || gal.includes("harvest-supper-guests-test"), false, "no completion spark is repeated in the gallery");
  // both rooms, in the office's order, each with the no-JS floor and a link to its whole talk
  const circ = section(html, "data-ev-circles");
  const roomsAt = [...circ.matchAll(/data-ev-room="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(roomsAt, ["t1792519260000-supperkeeper-test", "t1792520400000-guest-test"]);
  for (const r of roomsAt) assert.ok(circ.includes(`href="/conversations/#${r}"`), `${r}: no link to its whole talk`);
  assert.match(circ, /data-ev-floor/);
  assert.match(circ, /data-live=|data-event=/);
});

test("BUILT: a spark with no picture still shows its headline, recounting and credit and draws NO picture tile; one with a picture draws exactly its own", () => {
  const gal = section(eventHtml(SUPPER), "data-ev-gallery");
  const cards = gal.split("<article").slice(1);
  assert.equal(cards.length, 2);
  const [pie, slice] = cards;
  assert.match(pie, /data-spark-picture/); assert.match(pie, /<img src="\/media\/invented-pie-argument\.png"/);
  assert.equal(/data-spark-picture|<img/.test(slice), false, "the no-picture spark has no picture tile at all");
  const t = textOf(slice);
  assert.ok(t.includes("The last slice") && t.includes("Nobody would take it, so it went to the dog.") && t.includes("by supperkeeper-test"));
});

test("BUILT FALSIFIER: who was there lists only the households the office served as public-act evidence; the RSVP-only resident appears only as an RSVP", () => {
  const html = eventHtml(SUPPER);
  const present = section(html, "data-ev-present");
  assert.match(present, /hh:supper-test-house/); assert.match(present, /solo:guest-test/);
  assert.equal(present.includes("rsvponly-test"), false, "an RSVP is not a public act");
  assert.match(textOf(present), /Saying you will come \(an RSVP\) does not count\./);
  // the approved past layout (CORE-121) draws no RSVP list on an ended page at all, so an RSVP-only resident is nowhere on it; the CONTROL that the page could
  // have listed them is the same fixture's RSVP row, which on a RUNNING event's page still carries its RSVP list
  assert.equal(textOf(html).includes("rsvponly-test"), false, "an ended page lists no RSVP names, so none can be mistaken for who was there");
  assert.ok(eventHtml(LIVE).includes("data-rsvp"), "control: a running event's page still has its RSVP block");
});

test("BUILT: an empty completion collection beside a populated gallery: the gallery card stands and the empty sentence does not deny it", () => {
  const LEGACY = "legacykeeper-test/legacy-draft-test";
  const s = eventSections(page(LEGACY));
  assert.equal(s.sparks.state, "none"); assert.equal(s.gallery.state, "known"); assert.equal(s.gallery.sparks.length, 1);
  const html = eventHtml(LEGACY);
  assert.ok(html, "the legacy event's page was built");
  // the case is producer-consistent: a qualifying room in the window, the same room covered by the gallery and named by the gallery Spark, and the present household
  assert.equal(s.circles.state, "rooms"); assert.deepEqual(s.circles.rooms.map(roomIdOf), ["t1790856000000-lawn-test"]);
  assert.deepEqual(s.gallery.rooms, ["t1790856000000-lawn-test"]); assert.deepEqual(s.gallery.sparks[0].rooms, ["t1790856000000-lawn-test"]);
  assert.deepEqual(s.present.households, ["hh:legacy-test-house"]);
  assert.ok(section(html, "data-ev-circles").includes('data-ev-room="t1790856000000-lawn-test"'), "the room's circles are on the page, above the gallery");
  assert.equal(textOf(section(html, "data-ev-circles")).includes("No conversation formed"), false, "so the page does not say no conversation formed");
  const t = (marker) => textOf(section(html, marker));
  assert.ok(t("data-ev-sparks").includes("No public completion sparks are listed here."), "the empty collection says exactly that");
  assert.equal(EVENT_WORDS.sparks.none, "No public completion sparks are listed here.");
  assert.ok(section(html, "data-ev-gallery").includes('data-spark="legacy-gallery-spark-test"'), "the ordinary accepted Spark still stands in the gallery");
  assert.ok(t("data-ev-gallery").includes("A lawn spark (invented; an ordinary accepted Spark in the gallery)"));
  // the old sentence is the falsifier: it claimed no spark had been made from the event, which the gallery card contradicts
  assert.equal(html.includes("No public spark has been made from this event yet"), false, "the denying sentence is gone");
  assert.doesNotMatch(t("data-ev-sparks"), /No (public )?spark has been made/);
  assert.equal(t("data-ev-gallery").includes(EVENT_WORDS.gallery.none), false, "and the gallery is not drawn as none");
});

test("BUILT: each state is its own sentence: known none, unknown, a claim not accepted, before the doors open, and a running event's rooms so far", () => {
  const q = eventHtml(QUIET);
  const say = (html, marker) => textOf(section(html, marker));     // text, so an escaped apostrophe is the apostrophe a reader sees
  assert.equal(say(q, "data-ev-circles").includes(EVENT_WORDS.circles.none), true);
  assert.ok(say(q, "data-ev-present").includes(EVENT_WORDS.present.none));
  assert.ok(say(q, "data-ev-sparks").includes(EVENT_WORDS.sparks.none));
  assert.ok(say(q, "data-ev-gallery").includes(EVENT_WORDS.gallery.none));
  const l = eventHtml(LOST);
  for (const [marker, words] of [["data-ev-circles", EVENT_WORDS.circles.unavailable], ["data-ev-present", EVENT_WORDS.present.unknown], ["data-ev-sparks", EVENT_WORDS.sparks.unknown], ["data-ev-gallery", EVENT_WORDS.gallery.unknown]]) {
    assert.ok(say(l, marker).includes(words), `${marker}: unavailable is said as unavailable`);
    assert.equal(say(l, marker).includes(EVENT_WORDS.circles.none) || say(l, marker).includes(EVENT_WORDS.gallery.none), false, `${marker}: and never as none`);
  }
  const o = eventHtml(OLD);
  assert.match(textOf(section(o, "data-ev-sparks")), /claim awaiting acceptance/); assert.match(textOf(section(o, "data-ev-sparks")), /withdrawn/);
  assert.equal((section(o, "data-ev-sparks").match(/data-spark-ref=/g) ?? []).length, 2, "every public reference, none chosen");
  assert.match(textOf(section(o, "data-ev-circles")), /oldest settlement/);
  const c = eventHtml(COMING);
  assert.ok(say(c, "data-ev-circles").includes(EVENT_WORDS.circles.before));
  assert.equal(c.includes("data-ev-sparks"), false, "no sparks section before the event");
  const live = eventHtml(LIVE);
  assert.match(live, /data-ev-circles[^>]*data-live/, "a running event refreshes its rooms from the office");
  // a room whose id is the NUMBER 0 is a room: drawn, linked, and mounted by its id, never lost to a truthiness check
  const circ = section(live, "data-ev-circles");
  assert.deepEqual([...circ.matchAll(/data-ev-room="([^"]+)"/g)].map((m) => m[1]), ["t1794686460000-walker-test", "0"], "both rooms, the numeric one included, in the office's order");
  assert.ok(circ.includes('href="/conversations/#0"'), "the numeric room links to its own anchor");
  // the SAME gallery section as the ended page, once the doors are open (CORE-174 FIX): the so-far note and the known none; never before the event
  assert.match(live, /<section[^>]*id="gallery"[^>]*data-ev-gallery|<section[^>]*data-ev-gallery[^>]*id="gallery"/, "a running event has the gallery at its #gallery anchor");
  assert.ok(say(live, "data-ev-gallery").includes(EVENT_WORDS.gallery.none), "an empty gallery of a running event is said as none");
  assert.equal(c.includes("data-ev-gallery"), false, "no gallery before the event (announced)");
  assert.match(textOf(live), /RSVP/); assert.match(live, /data-rsvp-how/, "its RSVP doors are as they were");
  assert.equal(eventHtml(SUPPER).includes("data-rsvp-how"), false, "an ended event does not teach how to RSVP");
});

test("BUILT: the old /calendar/<host>/<slug>/ address forwards (script, meta refresh and a link) to the permanent page, for every event the site builds", () => {
  for (const e of allEventViews(CAL, EVENTS)) {
    const to = eventHref(e.id);
    const old = built("calendar", ...e.id.split("/"));
    assert.ok(old, `${e.id}: no forward`);
    assert.ok(old.includes(`url=${to}`) && old.includes(`href="${to}"`) && old.includes("location.replace"), `${e.id}: does not forward to ${to}`);
    assert.match(old, /name="robots" content="noindex"/);
    assert.ok(eventHtml(e.id), `${e.id}: the forward points at a page that is not built`);
  }
});

test("BUILT: /events/ lists every ended event once, newest end first, past the calendar's seven days, names the office's continuation, and its list isn't called unavailable", () => {
  const html = built("events");
  assert.ok(html, "/events/ is not built");
  const items = [...html.matchAll(/data-event="([^"]+)"/g)].map((m) => m[1]).filter((id) => id.includes("/"));
  assert.deepEqual(items, [SORBET, SUPPER, QUIET, LOST, OLD, "legacykeeper-test/legacy-draft-test"], "newest end first, each once");
  assert.match(html, /data-past-more data-before="2026-10-01T00:00:00.000Z"/, "the office's own continuation, never a guess");
  assert.ok(textOf(html).includes(EVENT_WORDS.past.more));
  assert.equal(html.includes('data-past-note="unavailable"'), false, "the lasting list was read, so the page does not say it is unavailable");
});

test("the real /events/ page states an unavailable lasting list as unavailable, not as 'no past events'", () => {
  // the page's own source, run through the fixture build with the file in its 'unavailable' state would need a second build; the rule is
  // the page's one branch, so pin it from the source AND from the ingest above (read: "unavailable" is what the page branches on)
  const src = readFileSync(join(ROOT, "town/pages/events/index.astro"), "utf8");
  assert.match(src, /read !== "office" && <p[^>]*data-past-note="unavailable"/);
  assert.match(src, /read === "office" && <p[^>]*data-past-note="none"/, "'none' is said only when the office answered and listed none");
});

// ── (4) CORE-121: the Sparks catalogue, the whole-card link, the detail pages and the past layout ─────────────────────────────────────

const SPARKS = collectSparks(CAL, EVENTS, REGISTER.sparks);
const SPARK_IDS = ["sorbetkeeper-test/sorbet-night-test", "supperkeeper-test/harvest-supper-test", "supperkeeper-test/harvest-supper-guests-test", "guest-test/the-pie-argument", "supperkeeper-test/the-last-slice", "legacy-gallery-spark-test", "eventless-test/lamp", "littlebird-test/ferry"];

test("the Spark register ingest: kind spark rows only, canonical id the slug (never the store UUID), read into the producer's own common view; known none is `ok` with none; every failure is `unavailable`, never an empty list", async () => {
  assert.equal(REGISTER.read, "ok"); assert.equal(REGISTER.count, 3);
  assert.deepEqual(REGISTER.sparks.map((s) => s.id), ["eventless-test/lamp", "guest-test/the-pie-argument", "littlebird-test/ferry"], "sparks only, in the register's slug order; the thing is not one");
  const lamp = REGISTER.sparks[0];
  assert.deepEqual(lamp, { id: "eventless-test/lamp", credit: { by: "eventless-test", household: "hh:eventless-test-house" }, body: "A lamp left on the quay (invented, no event)", accepted: true, accepted_window: 55,
    recounting: "Left burning for the ferry that never came.", experienced_at: "2026-11-10T20:00:00.000Z", experienced_until: "2026-11-10T21:00:00.000Z" }, "absent properties stay absent (nothing filled in); the UUID is not the id");
  const ferry = REGISTER.sparks[2];
  assert.deepEqual([ferry.rooms, ferry.event, ferry.circle, ferry.circle_path, ferry.own_link], [["t1-ferry"], "supperkeeper-test/harvest-supper-test", 70002, [70001, 70002], "eventless-test/lamp"]);
  assert.equal("room" in ferry, false, "no scalar room alias");
  assert.deepEqual(sparkViewOfMark(REGISTER_MARKS[0]), lamp, "the same mapping the page's fixtures use");
  // known none: a valid register with no Spark rows is `ok`, count 0
  const none = await fetchSparks({ apiBase: OFFICE, fetchImpl: registerOffice({ what: "marks", count: 1, marks: [REGISTER_MARKS[3]] }), retries: 1 });
  assert.deepEqual([none.sparks.read, none.sparks.count, none.sparks.sparks.length, none.gaps.length], ["ok", 0, 0, 0]);
  // every failure is unavailable (and says so with a gap): a refusal, a server error, a body that is not the register, a Spark row that is not a standing slugged mark
  const bad = [["404", registerOffice({}, 404)], ["500", registerOffice({}, 500)], ["not the register", registerOffice({ what: "marks" })], ["no slug", registerOffice({ marks: [{ kind: "spark", status: "standing", body: "x" }] })],
    ["not standing", registerOffice({ marks: [MARK("a/b", "spark", { status: "draft" })] })], ["network", async () => { throw new Error("connection refused"); }]];
  for (const [name, fetchImpl] of bad) {
    const r = await fetchSparks({ apiBase: OFFICE, fetchImpl, retries: 1 });
    assert.equal(r.sparks.read, "unavailable", name); assert.deepEqual(r.sparks.sparks, [], name); assert.deepEqual(r.gaps, [SPARKS_GAP], name);
  }
  assert.equal(EMPTY_SPARKS.read, "absent"); assert.ok(DATA_FILES.includes("sparks.json"));
});

test("sparkHref / sparkParam: the producer's own id, each part a path segment, never a guessed slug; an id that cannot be a path has none", () => {
  assert.equal(sparkHref("supperkeeper-test/harvest-supper-test"), "/sparks/supperkeeper-test/harvest-supper-test/");
  assert.equal(sparkHref("legacy-gallery-spark-test"), "/sparks/legacy-gallery-spark-test/");
  assert.equal(sparkHref("a b/c?d"), "/sparks/a%20b/c%3Fd/", "each part is encoded");
  for (const bad of ["", "  ", null, undefined, 7, {}]) assert.equal(sparkHref(bad), null);
  assert.equal(sparkParam("x/../y"), null); assert.equal(sparkParam("x//y"), null); assert.equal(sparkParam("x/y"), "x/y");
});

test("collectSparks: every ACCEPTED Spark the event reads served, once, in the producer's order; a reference is not a Spark; own event tie is not worked out from a room", () => {
  assert.deepEqual(SPARKS.map((e) => e.id).sort(), [...SPARK_IDS].sort(), "all the accepted ones, and none of the pending/withdrawn references");
  assert.equal(new Set(SPARKS.map((e) => e.id)).size, SPARKS.length, "once each");
  const by = (id) => SPARKS.find((e) => e.id === id);
  assert.equal(by("supperkeeper-test/harvest-supper-test").eventId, "supperkeeper-test/harvest-supper-test", "a completion Spark names its event (its own field)");
  assert.equal(by("guest-test/the-pie-argument").eventId, null, "a gallery Spark with no event field of its own has NO event: nothing is inferred from the room or the page it was served on");
  assert.equal(by("guest-test/the-pie-argument").seenIn, "supperkeeper-test/harvest-supper-test", "but the build knows which event read served it");
  assert.equal(by("legacy-gallery-spark-test").eventId, null);
  // a named catalogue source (`extra`) is read first and de-duplicates; nothing else stands in for it
  const extra = [{ id: "eventless-test/lamp", accepted: true, body: "A lamp (eventless)" }, { id: "guest-test/the-pie-argument", accepted: true, body: "dup" }, { id: "ref-test", accepted: false, status: "pending" }];
  const all = collectSparks(CAL, EVENTS, extra);
  assert.equal(all[0].id, "eventless-test/lamp"); assert.equal(all[0].origin, "catalogue");
  assert.equal(all.filter((e) => e.id === "guest-test/the-pie-argument").length, 1);
  assert.equal(all.some((e) => e.id === "ref-test"), false);
});

test("the drawn filters are predicates over what the producer served: events, without an event, with a picture", () => {
  assert.deepEqual(SPARK_FILTERS.map((f) => f.key), ["all", "events", "none", "picture"]);
  const run = (k) => SPARKS.filter(SPARK_FILTERS.find((f) => f.key === k).test).map((e) => e.id).sort();
  assert.equal(run("all").length, SPARK_IDS.length);
  assert.deepEqual(run("events"), ["littlebird-test/ferry", "sorbetkeeper-test/sorbet-night-test", "supperkeeper-test/harvest-supper-guests-test", "supperkeeper-test/harvest-supper-test"]);
  assert.deepEqual(run("none"), ["eventless-test/lamp", "guest-test/the-pie-argument", "legacy-gallery-spark-test", "supperkeeper-test/the-last-slice"], "the eventless ones are included, the register's among them");
  assert.ok(run("picture").includes("supperkeeper-test/harvest-supper-test") && !run("picture").includes("supperkeeper-test/harvest-supper-guests-test"));
  assert.equal(eventOfSpark(SPARKS.find((e) => e.id === "supperkeeper-test/harvest-supper-test"), CAL, EVENTS)?.href, "/events/supperkeeper-test/harvest-supper-test/");
  assert.equal(eventOfSpark(SPARKS.find((e) => e.id === "legacy-gallery-spark-test"), CAL, EVENTS), null);
});

// the cards of a page's HTML
const cardsOf = (html) => html.split("<article").slice(1).map((c) => "<article" + c.split("</article>")[0] + "</article>").filter((c) => /class="[^"]*spark-card/.test(c));

test("BUILT: every Spark card, in both event sections, is ONE real link to its canonical page: the headline anchor is stretched over the whole card, nothing nests, the other links stay", () => {
  const html = eventHtml(SUPPER);
  const cards = cardsOf(html);
  assert.equal(cards.length, 4, "two completion Sparks + two gallery Sparks (the pending reference is not a card)");
  for (const card of cards) {
    const id = /data-spark="([^"]*)"/.exec(card)[1];
    const opens = [...card.matchAll(/<a\b[^>]*data-spark-open[^>]*>/g)];
    assert.equal(opens.length, 1, `${id}: exactly one card-wide anchor`);
    assert.match(opens[0][0], new RegExp(`href="/sparks/${id}/"`), `${id}: it goes to the canonical address`);
    assert.equal((card.match(/<a\b/g) ?? []).length, (card.match(/<\/a>/g) ?? []).length);
    assert.doesNotMatch(card, /<a\b[^>]*>(?:(?!<\/a>)[\s\S])*<a\b/, `${id}: no anchor inside another anchor`);
    assert.match(card, /spark-card[^>]*is-link/, `${id}: drawn as a link card`);
  }
  assert.ok(cards.some((c) => /data-spark-rooms[\s\S]*href="\/conversations\/#/.test(c)), "the room links keep working");
  // the card-wide link's stretch and focus ring are in the component's own CSS (the browser does the rest: new-tab, modifiers, Enter)
  const css = readFileSync(join(ROOT, "src/components/SparkCard.astro"), "utf8");
  assert.match(css, /\.spark-open::after \{ content: ""; position: absolute; inset: 0;/); assert.match(css, /:has\(\.spark-open:focus-visible\) \{ outline: 3px solid/);
  assert.match(css, /\.spark-credit a, \.spark-rooms a \{ position: relative; z-index: 2; \}/, "other links sit above the stretched one");
});

test("image-first CSS contract (pinned from the card's source): the pictured card's caption is ONE visual line, and the bigger view enlarges a small source instead of leaving it at its natural size", () => {
  const css = readFileSync(join(ROOT, "src/components/SparkCard.astro"), "utf8");
  const rule = (sel) => { const m = new RegExp(`${sel.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`).exec(css); assert.ok(m, `no rule for ${sel}`); return m[1]; };
  assert.match(rule(".spark-card.is-image-card .spark-cap"), /flex-wrap:\s*nowrap/); assert.match(rule(".spark-card.is-image-card .spark-cap"), /white-space:\s*nowrap/);
  assert.match(rule(".spark-card.is-image-card .spark-head"), /text-overflow:\s*ellipsis/); assert.match(rule(".spark-card.is-image-card .spark-head"), /overflow:\s*hidden/);
  assert.equal(css.includes("spark-maker"), false, "the pictured caption is the NAME only: no maker fragment");
  const big = rule(".spark-card.is-big .spark-pic img");
  assert.match(big, /width:\s*100%/, "a small valid source is enlarged to the view's width");
  assert.doesNotMatch(big, /width:\s*auto/, "the bigger view never leaves a small source at its natural size");
  assert.match(big, /max-height:\s*85vh/); assert.match(big, /object-fit:\s*contain/, "bounded by the viewport and kept whole");
});

test("BUILT: a Spark's headline is dark on its cream card (an own colour, never the page's pale heading) and a no-picture Spark still has no empty tile", () => {
  const css = readFileSync(join(ROOT, "src/components/SparkCard.astro"), "utf8");
  assert.match(css, /\.spark-head \{[^}]*color: var\(--pm-ink\)/);
  const guests = cardsOf(eventHtml(SUPPER)).find((c) => c.includes("harvest-supper-guests-test"));
  assert.ok(guests && !guests.includes("data-spark-picture"), "no picture, no tile");
});

test("BUILT: /sparks/ (register read OK) lists ONLY the register's Sparks, once each, with a whole-card link, the filters and the empty Flares place; event-carried Sparks are not relisted as global discovery; unaccepted references are absent", () => {
  const html = built("sparks");
  assert.ok(html, "/sparks/ is not built");
  const cards = cardsOf(html);
  const REGISTER_IDS = ["eventless-test/lamp", "guest-test/the-pie-argument", "littlebird-test/ferry"];
  assert.deepEqual(cards.map((c) => /data-spark="([^"]*)"/.exec(c)[1]).sort(), [...REGISTER_IDS].sort(), "the grid is the register's rows, not the union with the event reads");
  for (const id of SPARK_IDS.filter((i) => !REGISTER_IDS.includes(i))) assert.equal(html.includes(`data-spark="${id}"`), false, `${id} is event-carried only: it has its page but is not in the register grid`);
  assert.match(html, /For agents:/); assert.ok(html.includes("GET /api/world2/marks?all=true&amp;full=true") || html.includes("GET /api/world2/marks?all=true&full=true"), "the foot names the actual REST producer");
  assert.equal(html.includes('read: "calendar"'), false, "and invents no MCP read");
  assert.equal(/Every accepted Spark/i.test(textOf(html)) || /every accepted Spark/i.test(html), false, "no unconditional 'every accepted Spark' lead or meta");
  for (const c of cards) {
    assert.match(c, /data-spark-open/);
    if (/data-spark-picture/.test(c)) {
      // IMAGE-FIRST: the picture fills the card, ONE caption (name, maker); no recounting, date, room, household or Flares panel on it
      assert.match(c, /is-image-card/); assert.match(c, /data-spark-caption/);
      for (const gone of ["data-spark-recounting", "data-spark-when", "data-spark-rooms", "data-spark-flares", "data-spark-credit", "hh:", " by "]) assert.equal(c.includes(gone), false, `a pictured card carries no ${gone}`);
      assert.ok(c.indexOf("data-spark-picture") < c.indexOf("data-spark-caption"), "the caption is below the picture");
    } else assert.match(c, /data-spark-flares/, "an unpictured card is as before, empty Flares place and all");
  }
  const cells = html.split("data-spark-cell ").slice(1);
  assert.ok(cells.some((c) => c.includes('data-has-picture="1"')), "the fixture has a pictured card");
  assert.equal(html.includes("spk-tag"), false, "the old sibling tag row is gone");
  for (const c of cells) {
    const [inCard, afterCard = ""] = [c.slice(0, c.indexOf("</article>")), c.slice(c.indexOf("</article>"))];
    if (c.includes('data-has-picture="1"')) assert.equal(c.includes("data-spark-event"), false, "a pictured card is the picture and one caption: no event line on it or under it");
    else {
      // CORE-121 (Darko 15:36 EST): an unpictured card carries its event / 'no event named' line INSIDE the card, never as a sibling below its border
      assert.ok(inCard.includes("data-spark-event"), "the unpictured card's event line is inside its card");
      assert.equal(afterCard.includes("data-spark-event"), false, "and nothing of it sits outside the card");
    }
  }
  // the row: the cells of a row share its height and a card fills its cell with no margin of its own (pinned from the page's own styles)
  const gallery = readFileSync(join(ROOT, "town/pages/sparks/index.astro"), "utf8");
  assert.doesNotMatch(gallery.match(/\.spk-grid \{[^}]*\}/)[0], /align-items:\s*start/, "the grid no longer pins cards to the top of a taller row");
  assert.match(gallery, /\.spk-cell \{[^}]*display: flex;/);
  assert.match(gallery, /\.spk-cell > :global\(\.spark-card\) \{[^}]*flex: 1 1 auto;[^}]*margin: 0;/, "a card fills its cell and has no margin of its own");
  assert.doesNotMatch(html, /harvest-supper-pending-test|withdrawn-one-test|before-the-record-test/, "a pending/withdrawn reference is not a Spark here");
  assert.match(html, /data-spark-filters/); for (const f of SPARK_FILTERS) assert.ok(html.includes(`data-filter="${f.key}"`), f.key);
  assert.equal((html.match(/data-has-event="0"/g) ?? []).length, 2, "the register's eventless Sparks are drawn, the lamp among them");
  assert.ok(textOf(html).includes("no event named"), "a missing own event tie is 'no event named', not a claim about provenance");
  assert.ok(textOf(html).includes(CATALOGUE_WORDS.register), "the page says what the list is: the public register, not every Spark");
  assert.match(html, /data-spark-register[^>]*data-state="ok"/);
  assert.equal(html.includes("hidden-test/not-listed"), false, "a Spark the public register does not carry is not invented into the list");
  assert.ok(html.includes('data-spark="guest-test/the-pie-argument"') && textOf(html).includes("The pie argument (the register's own view)"), "the register's view wins a duplicate");
  // the unread register is its own sentence and never an empty list or 'no Sparks' (the page's branches, pinned from its source)
  const src = readFileSync(join(ROOT, "town/pages/sparks/index.astro"), "utf8");
  assert.match(src, /registerOk \? CATALOGUE_WORDS\.register : CATALOGUE_WORDS\.unavailable/);
  assert.match(src, /: registerOk && <p[^>]*data-spark-none>/, "'none' is said only when the register was read");
  assert.ok(textOf(html).includes(CATALOGUE_WORDS.flares) && textOf(html).includes(CATALOGUE_WORDS.flaresNone));
});

test("BUILT: every Spark has its page at its canonical address: its card in full (no card-wide link on itself), where it came from, the maker, and the empty Flares place", () => {
  for (const id of SPARK_IDS) {
    const html = built("sparks", ...id.split("/"));
    assert.ok(html, `/sparks/${id}/ is not built`);
    assert.match(html, /data-spark-detail/); assert.ok(html.includes(`data-spark-id="${id}"`));
    assert.doesNotMatch(html, /data-spark-open/, `${id}: the detail's own card does not link to itself`);
    assert.match(html, /data-spark-came/); assert.match(html, /data-spark-maker/);
    const t = textOf(section(html, "data-spark-flares-place"));
    assert.ok(t.includes(CATALOGUE_WORDS.flares) && t.includes(CATALOGUE_WORDS.flaresNone), `${id}: the empty Flares place`);
  }
  // a PICTURED Spark's page is the larger, image-first view: the picture first and whole (own big-card class, no thumbnail cap), every served word below it
  const big = built("sparks", "supperkeeper-test", "harvest-supper-test");
  assert.match(big, /class="[^"]*\bis-big\b/); assert.match(big, /spk-detail[^"]*is-pictured/);
  assert.ok(big.indexOf("data-spark-picture") < big.indexOf("data-spark-recounting"), "the picture comes before the text");
  for (const kept of ["data-spark-recounting", "data-spark-credit", "data-spark-when", "data-spark-came", "data-spark-flares-place"]) assert.ok(big.includes(kept), `the bigger view keeps ${kept}`);
  const rootHtml = built("sparks", "supperkeeper-test", "harvest-supper-test");
  assert.ok(textOf(rootHtml).includes("Event:") && textOf(rootHtml).includes("Harvest Supper (invented; ended outside the seven-day list)"));
  assert.match(rootHtml, /href="\/events\/supperkeeper-test\/harvest-supper-test\/"/, "the event link is the event's page");
  const eventless = built("sparks", "legacy-gallery-spark-test");
  assert.equal(eventless.includes("data-spark-event"), false, "an eventless Spark simply has no Event line");
  assert.match(eventless, /data-spark-rooms/, "but keeps its room");
  assert.match(eventless, /data-spark-seen/, "and says which event's gallery served it");
});

test("BUILT: the approved PAST layout: an ended event draws no future-tense 'Who is coming' list and no RSVP form (open or closed); the recorded count stays; a running event is as it was", () => {
  const ended = eventHtml(SUPPER);
  const t = textOf(ended);
  assert.equal(t.includes("Who is coming"), false); assert.equal(t.includes("No one has RSVPed yet"), false);
  assert.equal(ended.includes("data-rsvp"), false, "no RSVP section, form or closed line");
  assert.equal(t.includes("RSVPs closed"), false);
  assert.match(t, /RSVPs\s+3 residents/, "the recorded RSVP count stays in the card, as history");
  assert.ok(ended.includes("data-ev-present"), "who was THERE is its own section (public acts), never the RSVP list");
  assert.match(section(ended, "data-ev-gallery"), /data-ev-onward[^>]*>\s*<a href="\/sparks\/"[^>]*>/, "the event's gallery keeps its onward row to the full /sparks/ gallery (approved mockup)");
  const live = eventHtml(LIVE);
  assert.ok(textOf(live).includes("Who is coming") && live.includes("data-rsvp"), "while it runs the page keeps its RSVP block");
});

test("the nav has one Sparks door, /sparks/", () => {
  assert.match(readFileSync(join(ROOT, "src/lib/nav.mjs"), "utf8"), /\{ key: "sparks", label: "Sparks", href: "\/sparks\/" \}/);
});
