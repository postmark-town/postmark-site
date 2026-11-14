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
  EVENT_WORDS, allEventViews, eventForPage, eventHref, eventSections, evidenceRead, legacyEventHref, pictureOf, roomHref, roomIdOf,
} from "../src/lib/calendar.mjs";
import { EMPTY_EVENTS, EMPTY_CALENDAR, fetchEvents, fetchPastEvents, fetchEventEvidence, DATA_FILES, EVENTS_GAP } from "../tools/lib/fetch-town-data.mjs";
import { READER_MODULE, circleUrl, loadReader, mountRoom, mountRooms, officeSource, roomUrl } from "../src/lib/circle-reader-mount.mjs";

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
  assert.equal(s.spark.state, "spark");
  assert.equal(s.spark.spark.recounting, "A long table, too many dishes, and one very serious argument about pie.");
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
  assert.equal(q.spark.state, "none", "a null spark is 'none yet', taken from the office's null and not from the clock");
  assert.equal(q.gallery.state, "known"); assert.deepEqual(q.gallery.sparks, []);
  // a missing read on an event that has run: unavailable / unknown in EVERY section (the build asked and was not answered)
  const l = eventSections(page(LOST));
  assert.deepEqual([l.circles.state, l.present.state, l.spark.state, l.gallery.state], ["unavailable", "unknown", "unknown", "unknown"]);
  // rooms unavailable, present null, gallery null, a claim: each its own honest state
  const o = eventSections(page(OLD));
  assert.equal(o.circles.state, "unavailable"); assert.match(o.circles.note, /oldest settlement/);
  assert.equal(o.present.state, "unknown");
  assert.equal(o.spark.state, "claim"); assert.equal(o.spark.status, "claim awaiting acceptance");
  assert.equal(o.gallery.state, "unknown"); assert.match(o.gallery.note, /unknown/);
  // CONTROL for the arms above: the same function says "known" for the same shapes when the office served them
  assert.equal(eventSections(page(SUPPER)).present.state, "known");
});

test("before the doors open there is no evidence and the page says so; a running event shows its rooms so far; a cancelled event claims nothing", () => {
  const c = eventSections(page(COMING));
  assert.equal(c.circles.state, "before"); assert.equal(c.after, false);
  assert.equal(c.spark.state, "none", "no spark is expected before the event, and none is worked out");
  const live = eventSections(page(LIVE));
  assert.equal(live.circles.state, "rooms"); assert.equal(live.after, false); assert.equal(live.complete, false);
  assert.equal(live.gallery.complete, false, "while the event is on, coverage is 'so far'");
  const cancelled = eventSections({ ...page(COMING), phase: "ended", cancelled: true });
  assert.equal(cancelled.circles.state, "cancelled");
  assert.deepEqual([cancelled.present.state, cancelled.spark.state, cancelled.gallery.state], ["unknown", "unknown", "unknown"]);
  // a phase that is not 'announced' with NO evidence is unavailable, never 'before' (the page does not read a clock)
  assert.equal(eventSections({ ...page(COMING), phase: "underway" }).circles.state, "unavailable");
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
  for (const d of [join(src, "events", "[host]"), join(src, "calendar", "[host]"), data, join(OUT, "public")]) mkdirSync(d, { recursive: true });
  writeFileSync(join(data, "calendar.json"), JSON.stringify(CAL));
  writeFileSync(join(data, "events.json"), JSON.stringify(EVENTS));
  // the page files are COPIED with their two data imports pointed at the fixture: nothing tracked is touched
  const point = (t) => t.replaceAll('"@/data/postmark/calendar.json"', JSON.stringify(join(data, "calendar.json"))).replaceAll('"@/data/postmark/events.json"', JSON.stringify(join(data, "events.json")));
  for (const rel of ["events/index.astro", "events/[host]/[slug].astro", "calendar/[host]/[slug].astro"]) writeFileSync(join(src, rel), point(readFileSync(join(ROOT, "town/pages", rel), "utf8")));
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
  // the spark: headline, recounting, credit
  const spark = section(html, "data-ev-spark");
  assert.match(textOf(spark), /A long table, too many dishes, and one very serious argument about pie\./);
  assert.match(spark, /data-spark-root/); assert.match(spark, /data-spark-credit/);
  // the gallery: both accepted child sparks, the root not among them
  const gal = section(html, "data-ev-gallery");
  assert.equal((gal.match(/data-spark="/g) ?? []).length, 2);
  assert.ok(gal.includes("The pie argument") && gal.includes("The last slice"));
  assert.equal(gal.includes('data-spark="supperkeeper-test/harvest-supper-test"'), false, "the root is not repeated in the gallery");
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
  assert.ok(textOf(html).includes("rsvponly-test"), "control: the RSVP list on the same page does carry them, in the card's own 'Who is coming'");
  assert.ok(html.indexOf("rsvponly-test") < html.indexOf("data-ev-present"), "and that is the RSVP list, not the evidence");
});

test("BUILT: each state is its own sentence: known none, unknown, a claim not accepted, before the doors open, and a running event's rooms so far", () => {
  const q = eventHtml(QUIET);
  const say = (html, marker) => textOf(section(html, marker));     // text, so an escaped apostrophe is the apostrophe a reader sees
  assert.equal(say(q, "data-ev-circles").includes(EVENT_WORDS.circles.none), true);
  assert.ok(say(q, "data-ev-present").includes(EVENT_WORDS.present.none));
  assert.ok(say(q, "data-ev-spark").includes(EVENT_WORDS.spark.none));
  assert.ok(say(q, "data-ev-gallery").includes(EVENT_WORDS.gallery.none));
  const l = eventHtml(LOST);
  for (const [marker, words] of [["data-ev-circles", EVENT_WORDS.circles.unavailable], ["data-ev-present", EVENT_WORDS.present.unknown], ["data-ev-spark", EVENT_WORDS.spark.unknown], ["data-ev-gallery", EVENT_WORDS.gallery.unknown]]) {
    assert.ok(say(l, marker).includes(words), `${marker}: unavailable is said as unavailable`);
    assert.equal(say(l, marker).includes(EVENT_WORDS.circles.none) || say(l, marker).includes(EVENT_WORDS.gallery.none), false, `${marker}: and never as none`);
  }
  const o = eventHtml(OLD);
  assert.match(textOf(section(o, "data-ev-spark")), /waiting on acceptance/); assert.match(textOf(section(o, "data-ev-spark")), /claim awaiting acceptance/);
  assert.match(textOf(section(o, "data-ev-circles")), /oldest settlement/);
  const c = eventHtml(COMING);
  assert.ok(say(c, "data-ev-circles").includes(EVENT_WORDS.circles.before));
  assert.equal(c.includes("data-ev-spark"), false, "no spark section before the event");
  const live = eventHtml(LIVE);
  assert.match(live, /data-ev-circles[^>]*data-live/, "a running event refreshes its rooms from the office");
  assert.equal(live.includes("data-ev-gallery"), false, "no gallery while it is on");
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
  assert.deepEqual(items, [SORBET, SUPPER, QUIET, LOST, OLD], "newest end first, each once");
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
