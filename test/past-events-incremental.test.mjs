// past-events-incremental.test.mjs — CORE-180 (was POS-1225): the deploy's keyless budget is not spent re-reading the whole past calendar. The calendar rows of past events are read
// once and kept in the site's own last PUBLISHED events.json; a build reads the newest list page(s) only until it meets an event it already holds. Every wanted event's one-event
// read is still made every pass (Wright, 2026-11-25: the cache only saves requests; changeable evidence is as fresh as main's).
//
//   node --test test/past-events-incremental.test.mjs
//
// PURE. It runs tools/lib/past-events-cache.mjs and the real ingest (tools/lib/fetch-town-data.mjs fetchEvents) against a stub office that records the ORDER of what it is asked
// and can refuse any request, with INVENTED events (the real list's shape: 40 a page, 45 events, the second page the one that 429'd in run 45484503414); the live office and the live
// site are never read. The page, the projection and the release guard are not touched here.
//
// FALSIFIERS: a warm build that still asks the second list page; a seed that stands in for a read; a held event dropped for being beyond the page the build stopped at; a withdrawn
// event that stays (or a transient failure that removes one); changeable evidence frozen at its held read; held rows or evidence edited; a custom-API build seeded with production's
// events; a list failure that no longer fails the build.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { EMPTY_CALENDAR, EMPTY_EVENTS, EVIDENCE_MAX, PAST_PAGES_MAX, fetchEvents, shortFetchPlan } from "../tools/lib/fetch-town-data.mjs";
import { EVENT_WITHDRAWN_STATUSES, defaultEventsSeedUrl, joinHeld, mergeEvidence, mergePast, overlapsHeld, readEventsSeed } from "../tools/lib/past-events-cache.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OFFICE = "https://office.invalid";
const json = (status, body) => ({ ok: status >= 200 && status < 300, status, statusText: String(status), headers: { get: () => null }, json: async () => body });
const DAY = 86_400_000;
const NOW = "2026-11-24T23:00:00.000Z";
const iso = (daysAgo) => new Date(Date.parse(NOW) - daysAgo * DAY).toISOString();
const ev = (n, daysAgo, extra = {}) => ({ id: `h/e${n}`, title: `e${n}`, host: "h", phase: "ended", ends: iso(daysAgo), ...extra });
const evidenceOf = (n, over = {}) => ({ id: `h/e${n}`, evidence: { rooms: [{ id: `r${n}` }], room_history: "complete", present: [`p${n}`], gallery: { rooms: [], sparks: [] }, complete: true, ...over } });

// the town as the real list is: 45 past events, newest first (e0 ended hours ago, e1 a few days, the rest weeks back)
const TOWN = [ev(0, 0.2), ev(1, 3), ...[...Array(43).keys()].map((i) => ev(i + 2, 8 + i))];
const READS = Object.fromEntries(TOWN.map((e, i) => [e.id, evidenceOf(i)]));

/** the office's lasting list as it serves it: `size` a page, a cursor (the page's last end instant) while more remain */
const pagesOf = (events, size) => {
  const pages = [];
  for (let i = 0; i < events.length; i += size) {
    const rows = events.slice(i, i + size), last = i + size >= events.length;
    pages.push({ before: i ? events[i - 1].ends : undefined, body: { as_of: NOW, past: rows, next: last ? null : { past: true, before: rows.at(-1).ends }, note: null } });
  }
  return pages;
};
/** a stub office that records the order of what it is asked. `fail` maps a request key ("list 2", "read h/e3") to a status (or "throw"); a read with no entry answers 404 */
const office = ({ events, reads = READS, size = 40, fail = {}, asked = [], listStatus = 200 }) => {
  const pages = pagesOf(events, size);
  return async (url) => {
    const u = new URL(url);
    if (u.pathname === "/town/apex" && u.searchParams.get("read") === "calendar") {
      const args = JSON.parse(u.searchParams.get("args"));
      const n = args.before ? pages.findIndex((p) => p.before === args.before) + 1 : 1;
      asked.push(`list ${n}`);
      const f = fail[`list ${n}`];
      if (f === "throw") throw new Error("socket hang up");
      if (f) return json(f, { error: "x" });
      if (listStatus !== 200) return json(listStatus, { error: "x" });
      return n ? json(200, pages[n - 1].body) : json(422, { error: "bounce" });
    }
    const m = /^\/calendar\/([^/]+)\/([^/]+)$/.exec(u.pathname);
    if (m) {
      const id = `${m[1]}/${m[2]}`;
      asked.push(`read ${id}`);
      const f = fail[`read ${id}`];
      if (f === "throw") throw new Error("socket hang up");
      if (f) return json(f, { error: "x" });
      return reads[id] ? json(200, { event: reads[id] }) : json(404, { error: "bounce", code: 404 });
    }
    return json(404, { error: "bounce", code: 404 });
  };
};
const lists = (asked) => asked.filter((a) => a.startsWith("list"));
const readsOf = (asked) => asked.filter((a) => a.startsWith("read")).map((a) => a.slice(5));
const run = (o) => fetchEvents({ apiBase: OFFICE, retries: 1, calendar: EMPTY_CALENDAR, ...o });
const published = async () => (await run({ fetchImpl: office({ events: TOWN }) })).events;     // what a build wrote and the box published

test("COLD: with no seed the build reads the whole list and every event, exactly as it always did; the list's second page 429 stops it (the release lane then refuses)", async () => {
  const asked = [];
  const r = await run({ fetchImpl: office({ events: TOWN, asked }) });
  assert.deepEqual(lists(asked), ["list 1", "list 2"], "45 events, 40 a page: two pages");
  assert.equal(readsOf(asked).length, 45);
  assert.deepEqual(r.events.past.events.map((e) => e.id), TOWN.map((e) => e.id));
  assert.equal(r.events.past.next, null);
  assert.deepEqual(r.gaps, [], "and says nothing about a cache it did not use");
  await assert.rejects(run({ fetchImpl: office({ events: TOWN, fail: { "list 2": 429 } }) }), /429|failed after/, "THE RUN'S FAILURE: page 2 refused fails the cold build");
});

test("SEEDED WARM: the held list's overlap on the FIRST page stops the list BEFORE the second page is asked: the request that 429'd is never made", async () => {
  const seed = await published();
  const asked = [];
  const r = await run({ seed, fetchImpl: office({ events: TOWN, fail: { "list 2": 429 }, asked }) });
  assert.deepEqual(lists(asked), ["list 1"], "only the newest page; the second page (429 in the real run) is not requested");
  assert.equal(asked[0], "list 1", "the list is the first thing asked, and nothing waits for it");
  assert.equal(asked.indexOf("list 2"), -1);
  assert.deepEqual(r.events.past.events.map((e) => e.id), TOWN.map((e) => e.id), "all 45, the 5 behind the page kept from the held list, in order");
  assert.deepEqual(r.events.past.events, seed.past.events, "the same rows");
  assert.equal(r.events.past.next, null, "the held list's own cursor stands");
  assert.match(r.gaps[0], /built from the last published file \(45 past events held\): the list was read in 1 page\(s\), stopping at the first page whose oldest event it already held; 45 one-event read\(s\), every wanted event as ever/);
});

test("NEW events on page 1: they are read and lead the list; the held ones that moved past the page are kept; a page whose oldest event is NOT held asks the next page", async () => {
  const seed = await published();
  const grown = [ev(60, 0.05), ev(61, 0.1), ...TOWN];                                                                  // two events ended since the seed was published
  const reads = { ...READS, "h/e60": evidenceOf(60), "h/e61": evidenceOf(61) };
  const asked = [];
  const r = await run({ seed, fetchImpl: office({ events: grown, reads, asked }) });
  assert.deepEqual(lists(asked), ["list 1"], "page 1 now ends at e38, which is held: stop");
  assert.deepEqual(r.events.past.events.map((e) => e.id), grown.map((e) => e.id), "the two new ones lead; e39..e44 moved to page 2 and are kept from the held list");
  assert.equal(readsOf(asked).length, 47, "every wanted event is asked, new ones included");
  assert.equal(r.events.evidence["h/e60"].read, "ok");
  // more new events than a page: the page's oldest is a NEW event, so the build goes on to the next page, until it meets one it holds
  const flood = [...Array(5).keys()].map((i) => ev(100 + i, 0.01 * (i + 1))), size = 4;
  const bigger = [...flood, ...TOWN.slice(0, 8)];
  const floodReads = { ...READS, ...Object.fromEntries(flood.map((e, i) => [e.id, evidenceOf(100 + i)])) };
  const a2 = [];
  const f = await run({ seed, maxPages: 99, fetchImpl: office({ events: bigger, reads: floodReads, size, asked: a2 }) });
  assert.deepEqual(lists(a2), ["list 1", "list 2"], "page 1 (four new events) has no held event; page 2 ends at e3, which is held");
  assert.deepEqual(f.events.past.events.map((e) => e.id), [...flood.map((e) => e.id), ...TOWN.map((e) => e.id)], "and the whole held list follows the new ones");
});

test("TIES and CURSORS: an equal end instant cut by the page boundary is kept; a held row whose end moved is not an anchor; the held cursor stands, and a complete read has none", async () => {
  const same = iso(20);
  const town = [ev(0, 1), ev(1, 5), ev(2, 10), { ...ev(3, 20), ends: same }, { ...ev(4, 20), ends: same }, ev(5, 30)];    // e3 and e4 end at the same instant
  const reads = Object.fromEntries(town.map((e, i) => [e.id, evidenceOf(i)]));
  const cursor = { past: true, before: iso(900) };
  const seed = { as_of: NOW, past: { events: town, next: cursor, note: null, read: "office" }, evidence: {} };
  const asked = [];
  const r = await run({ seed, fetchImpl: office({ events: town, reads, size: 4, asked }) });      // page 1 = e0..e3: its oldest (e3) is held, e4 shares its end instant
  assert.deepEqual(lists(asked), ["list 1"]);
  assert.deepEqual(r.events.past.events.map((e) => e.id), town.map((e) => e.id), "e4, equal to the page's oldest end and held, is kept, not cut by the page");
  assert.deepEqual(r.events.past.next, cursor, "completeness stays honest: the office had more beyond the held list, and the file still says so");
  // a held row whose END differs from the one the office serves now is not an anchor
  const moved = { ...seed, past: { ...seed.past, events: town.map((e) => (e.id === "h/e3" ? { ...e, ends: iso(21) } : e)) } };
  const a2 = [];
  await run({ seed: moved, fetchImpl: office({ events: town, reads, size: 4, asked: a2 }) });
  assert.deepEqual(lists(a2), ["list 1", "list 2"], "e3 does not match, so page 2 is read");
  // a read that reaches the list's own end stands alone: no cursor, and an event the office no longer lists leaves
  const a3 = [];
  const whole = await run({ seed: { ...seed, past: { ...seed.past, events: [ev(99, 400), ...town] } }, fetchImpl: office({ events: town.slice(0, 3), reads, size: 40, asked: a3 }) });
  assert.deepEqual(whole.events.past.events.map((e) => e.id), ["h/e0", "h/e1", "h/e2"]);
  assert.equal(whole.events.past.next, null);
});

test("EVIDENCE IS AS FRESH AS MAIN'S: every wanted event is asked every pass; a changed read (new human presentation, a gallery, a window closed) replaces the held one whole in the same pass", async () => {
  const seed = await published();
  seed.evidence["h/e5"] = { read: "ok", event: evidenceOf(5, { complete: false, present: ["old-name"] }) };
  const changed = { ...READS, "h/e5": evidenceOf(5, { complete: true, present: ["new-presentation"], participants: [{ handle: "h", presentation: "public" }] }) };
  const asked = [];
  const r = await run({ seed, fetchImpl: office({ events: TOWN, reads: changed, asked }) });
  assert.equal(readsOf(asked).length, 45, "every wanted event, as on main: nothing is held back");
  assert.deepEqual(r.events.evidence["h/e5"], { read: "ok", event: changed["h/e5"], read_at: r.events.as_of }, "the office's answer, whole: nothing of the held read is mixed in, stamped with the time of this read");
  assert.equal(JSON.stringify(Object.keys(r.events.evidence["h/e5"])), JSON.stringify(["read", "event", "read_at"]), "the one field added is the archive's own `read_at` (CORE-174, additive; the viewers' footer reads it)");
  assert.deepEqual(Object.keys(r.events).sort(), ["as_of", "evidence", "past"]);
});

test("WITHDRAWAL vs FAILURE: a held event the office stops serving leaves the cache, row and evidence; a 429, a 5xx, a throw or a spent budget removes nothing", async () => {
  const seed = await published();
  // e41 sits behind the page the build stops at, so only its own read can say it is gone
  const gone = async (status) => run({ seed, fetchImpl: office({ events: TOWN, fail: { "read h/e41": status } }) });
  for (const status of [404, 410]) {
    const r = await gone(status);
    assert.equal(r.events.past.events.some((e) => e.id === "h/e41"), false, `${status}: the cached row leaves`);
    assert.equal(r.events.evidence["h/e41"], undefined, `${status}: and its evidence`);
    assert.equal(r.events.past.events.length, 44);
    assert.ok(r.gaps.some((g) => /1 held past event\(s\) the office no longer serves.*h\/e41/.test(g)), JSON.stringify(r.gaps));
    assert.equal(Object.keys(r.events.evidence).length, 44);
  }
  for (const status of [429, 500, 502, 503, "throw"]) {
    const r = await gone(status);
    assert.equal(r.events.past.events.some((e) => e.id === "h/e41"), true, `${status}: a failure is not a withdrawal: the row stays`);
    assert.deepEqual(r.events.evidence["h/e41"], { read: "unavailable" }, `${status}: the evidence is "couldn't be read" as on main, NEVER the held read republished under this pass's time`);
    assert.notEqual(r.events.evidence["h/e41"].read, "ok");
    assert.ok(r.gaps.some((g) => /1 of 45 one-event reads were not served, so 1 of those events' pages say their evidence couldn't be read and 0 kept/.test(g)), `${status}: said`);
    assert.equal(r.gaps.some((g) => /keep the good read/.test(g)), false, `${status}: there is no keep-the-held-read fallback to name`);
  }
  // REPEATED failure, through the actual consumer: the same transient failure pass after pass never turns into a read the office did not just give
  let carried = seed;
  for (let pass = 1; pass <= 3; pass++) {
    const r = await run({ seed: carried, fetchImpl: office({ events: TOWN, fail: { "read h/e41": 503 } }) });
    assert.deepEqual(r.events.evidence["h/e41"], { read: "unavailable" }, `pass ${pass}: still unavailable`);
    assert.equal(r.events.past.events.some((e) => e.id === "h/e41"), true, `pass ${pass}: the held ROW stays on a transient failure`);
    carried = r.events;
  }
  const recovered = await run({ seed: carried, fetchImpl: office({ events: TOWN }) });
  assert.deepEqual(recovered.events.evidence["h/e41"], { read: "ok", event: READS["h/e41"], read_at: recovered.events.as_of }, "and the next answered read is the office's, whole");
  // an event the list served THIS pass is served: its refused read is `unavailable` as on main, and the row stays
  const onPage = await run({ seed, fetchImpl: office({ events: TOWN, fail: { "read h/e3": 404 } }) });
  assert.equal(onPage.events.past.events.some((e) => e.id === "h/e3"), true);
  assert.deepEqual(onPage.events.evidence["h/e3"], { read: "unavailable" }, "its read is refused as it would be on main: unavailable, the held read is not put back over the office's answer");
  // an event the CALENDAR lists this pass is served too
  const cal = { as_of: NOW, now: [], coming: [], ended: [TOWN[41]], total: 1 };
  const listed = await run({ seed, calendar: cal, fetchImpl: office({ events: TOWN, fail: { "read h/e41": 404 } }) });
  assert.equal(listed.events.past.events.some((e) => e.id === "h/e41"), true, "the calendar still lists it");
  // a door that refuses EVERYTHING is not a withdrawal of everything
  const dead = Object.fromEntries(TOWN.map((e) => [`read ${e.id}`, 404]));
  const all = await run({ seed, fetchImpl: office({ events: TOWN, fail: dead }) });
  assert.equal(all.events.past.events.length, 45, "no read was answered, so nothing was taken down");
  assert.ok(all.gaps.some((g) => /none was taken down/.test(g)));
  // the list not served at all (422): nothing is taken down, the held events stand, said
  const noList = await run({ seed, fetchImpl: office({ events: TOWN, listStatus: 422, fail: { "read h/e41": 404 } }) });
  assert.equal(noList.events.past.read, "unavailable");
  assert.equal(noList.events.past.events.length, 45);
  assert.ok(noList.gaps.some((g) => /lasting list of past events is not served yet/.test(g)));
});

test("a failed read with none held is `unavailable` (as on main), never an empty answer; it is asked again next pass", async () => {
  const seed = await published();
  const grown = [ev(60, 0.05), ...TOWN];
  const reads = { ...READS, "h/e60": evidenceOf(60) };
  const r = await run({ seed, fetchImpl: office({ events: grown, reads, fail: { "read h/e60": 503 } }) });
  assert.deepEqual(r.events.evidence["h/e60"], { read: "unavailable" });
  assert.ok(r.gaps.some((g) => /1 of 46 one-event reads were not served, so 1 of those events' pages say their evidence couldn't be read and 0 kept/.test(g)), JSON.stringify(r.gaps));
  const again = [];
  const r2 = await run({ seed: r.events, fetchImpl: office({ events: grown, reads, asked: again }) });
  assert.ok(readsOf(again).includes("h/e60"));
  assert.equal(r2.events.evidence["h/e60"].read, "ok");
});

test("PROJECTION: held rows pass through byte-identical; an answered read is the office's, whole; the seed object is not mutated", async () => {
  const seed = await published();
  const before = JSON.stringify(seed);
  const r = await run({ seed, fetchImpl: office({ events: TOWN }) });
  assert.equal(JSON.stringify(seed), before);
  for (const e of TOWN) assert.deepEqual(r.events.past.events.find((x) => x.id === e.id), e, `${e.id}: the row as served`);
  for (const e of TOWN) assert.deepEqual(r.events.evidence[e.id], { read: "ok", event: READS[e.id], read_at: r.events.as_of }, `${e.id}: the office's answer, whole, plus only the archive's additive read_at`);
});

test("RESTORED after a fresh checkout: the tracked events.json is the EMPTY committed one and the seed comes from the published file over HTTP", async () => {
  const web = [];
  const seed = await readEventsSeed({ url: "https://postmark.invalid/data/events.json", fetchImpl: async (url) => { web.push(String(url)); return json(200, await published()); } });
  assert.equal(seed.state, "ok");
  assert.deepEqual(web, ["https://postmark.invalid/data/events.json"], "one static GET");
  const asked = [];
  const r = await run({ snapshot: EMPTY_EVENTS, seed: seed.events, fetchImpl: office({ events: TOWN, fail: { "list 2": 429 }, asked }) });
  assert.deepEqual(lists(asked), ["list 1"]);
  assert.equal(r.events.past.events.length, 45, "all 45 events, from a tree that held none");
});

test("a seed that is absent, refused, corrupt or the wrong shape is never a read: the build falls back to the whole list, and the 429 on page 2 then fails it as before", async () => {
  const states = [];
  for (const [name, fetchImpl] of [
    ["404", async () => json(404, {})], ["500", async () => json(500, {})], ["throw", async () => { throw new Error("socket hang up"); }],
    ["not json", async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError("Unexpected token <"); } })],
    ["wrong shape", async () => json(200, { hello: "world" })], ["no evidence", async () => json(200, { past: { events: [] } })], ["array", async () => json(200, [])],
  ]) states.push([name, (await readEventsSeed({ url: "https://x.invalid/data/events.json", fetchImpl })).state]);
  assert.deepEqual(states, [["404", "none"], ["500", "unreadable"], ["throw", "unreadable"], ["not json", "unreadable"], ["wrong shape", "unreadable"], ["no evidence", "unreadable"], ["array", "unreadable"]]);
  assert.equal((await readEventsSeed({ url: null })).state, "unset");
  const asked = [];
  await run({ seed: null, fetchImpl: office({ events: TOWN, asked }) });
  assert.deepEqual(lists(asked), ["list 1", "list 2"]);
  await assert.rejects(run({ seed: null, fetchImpl: office({ events: TOWN, fail: { "list 2": 429 } }) }), /429|failed after/);
});

test("FAILED PUBLICATION IS STILL REFUSED: a seeded build whose newest list page fails (429, 5xx, a throw) rejects, so the release lane keeps the last good release; a list the office does not serve (422) keeps the held events", async () => {
  const seed = await published();
  for (const status of [429, 500, 503, "throw"]) {
    await assert.rejects(run({ seed, fetchImpl: office({ events: TOWN, fail: { "list 1": status } }) }), /failed after|429|500|503|socket/, `list 1 ${status}`);
  }
  const r = await run({ seed, fetchImpl: office({ events: TOWN, listStatus: 422 }) });
  assert.equal(r.events.past.read, "unavailable");
  assert.deepEqual(r.events.past.events.map((e) => e.id), TOWN.map((e) => e.id));
  assert.equal(r.events.past.next, null);
  assert.equal(shortFetchPlan({ channel: "release" }).exitCode, 1);
  assert.equal(shortFetchPlan({ channel: "snapshot" }).exitCode, 0);
});

test("THE SEED IS OFF FOR ANOTHER OFFICE: the default is the production API's published file only; an explicit address opts in, the empty string opts out", () => {
  const prod = { api: "https://postmark.town/api", defaultApi: "https://postmark.town/api", townBase: "https://postmark.town" };
  assert.equal(defaultEventsSeedUrl({ env: {}, ...prod }), "https://postmark.town/data/events.json");
  assert.equal(defaultEventsSeedUrl({ env: {}, ...prod, api: "https://office.example/api" }), null, "POSTMARK_API / --api naming another office: no production seed");
  assert.equal(defaultEventsSeedUrl({ env: {}, ...prod, api: "http://127.0.0.1:4380/api" }), null, "the box's loopback office reads in full, as it always did");
  assert.equal(defaultEventsSeedUrl({ env: { POSTMARK_EVENTS_SEED_URL: "https://other.example/events.json" }, ...prod, api: "https://office.example/api" }), "https://other.example/events.json", "an explicit address is the caller's word");
  assert.equal(defaultEventsSeedUrl({ env: { POSTMARK_EVENTS_SEED_URL: "" }, ...prod }), null, "the empty string is none");
  const entry = readFileSync(join(ROOT, "tools/fetch-town.mjs"), "utf8");
  assert.match(entry, /const EVENTS_SEED_URL = defaultEventsSeedUrl\(\{ env: process\.env, api: API, defaultApi: DEFAULT_API, townBase: TOWN_BASE \}\);/);
  assert.match(entry, /letterCachePath: LETTER_CACHE, eventsArchivePath: EVENTS_ARCHIVE, eventsSeedUrl: EVENTS_SEED_URL, lettersSeedUrl: LETTERS_SEED_URL \}\)/);
  const data = readFileSync(join(ROOT, "tools/lib/fetch-town-data.mjs"), "utf8");
  assert.match(data, /eventsSeedUrl = null,\n[^}]*lettersSeedUrl = null,\n\} = \{\}\) \{/, "options with a null default: unset, the bare call is unchanged");
  assert.match(data, /const seedRead = await readEventsSeed\(\{ url: eventsSeedUrl, fetchImpl \}\);/);
  assert.equal(PAST_PAGES_MAX, 25, "the full-read budgets are what they were");
  assert.equal(EVIDENCE_MAX, 400);
});

test("the pure pieces: the overlap anchor, the join, the merge of rows, the merge of evidence", () => {
  const known = new Map([["h/e1", ev(1, 30)], ["h/e2", ev(2, 31)]]);
  assert.equal(overlapsHeld([ev(9, 1), ev(2, 31)], known), true, "the page's oldest event is held, same id and end");
  assert.equal(overlapsHeld([ev(1, 30), ev(9, 40)], known), false, "an unheld oldest event");
  assert.equal(overlapsHeld([ev(2, 32)], known), false, "same id, a different end");
  assert.equal(overlapsHeld([], known), false);
  assert.equal(overlapsHeld(null, known), false);
  assert.deepEqual([...EVENT_WITHDRAWN_STATUSES].sort(), [404, 410]);
  const j = joinHeld({ past: { events: [ev(1, 1), { id: "bad id" }], next: { past: true, before: "b" } }, evidence: { "h/e1": { read: "ok", event: { a: 1 } } } },
    { past: { events: [ev(1, 1, { title: "tracked" }), ev(2, 2)], next: null }, evidence: { "h/e1": { read: "ok", event: { a: 2 } }, "h/e2": { read: "unavailable" } } });
  assert.deepEqual(j.past.events.map((e) => e.id), ["h/e1", "h/e2"]);
  assert.equal(j.past.events[0].title, "e1", "the seed's row wins");
  assert.deepEqual(j.past.next, { past: true, before: "b" });
  assert.equal(j.evidence["h/e1"].event.a, 1);
  assert.deepEqual(mergePast({ fresh: [ev(1, 1)], held: [ev(1, 1, { title: "old" }), ev(2, 9), ev(3, 0.5)], complete: false }).map((e) => e.id), ["h/e1", "h/e2"], "a held event NEWER than the oldest read one is not resurrected; older ones follow");
  assert.deepEqual(mergePast({ fresh: [ev(1, 1)], held: [ev(2, 9)], complete: true }).map((e) => e.id), ["h/e1"]);
  const m = mergeEvidence({ events: [ev(1, 5), ev(2, 6), ev(3, 7), ev(4, 8), ev(5, 9)], held: { "h/e1": { read: "ok", event: { was: 1 } } }, fresh: { "h/e1": { read: "unavailable" }, "h/e2": { read: "ok", event: { now: 2 } }, "h/e3": { read: "unavailable" } } });
  assert.deepEqual(m.evidence["h/e1"], { read: "unavailable" }, "failed: unavailable, even with a good read held (a `held` argument is not even read)");
  assert.deepEqual(m.evidence["h/e2"], { read: "ok", event: { now: 2 } }, "answered: the fresh read, whole");
  assert.deepEqual(m.evidence["h/e3"], { read: "unavailable" }, "failed");
  assert.equal(m.evidence["h/e4"], undefined, "not asked: no entry");
  assert.deepEqual([m.refreshed, m.failed], [1, 2]);
});
