// events-archive-and-seed.test.mjs — the SEAM of "train/2026-w49 takes main": CORE-174's durable archive and CORE-180's published-file seed in ONE data path.
//
//   node --test test/events-archive-and-seed.test.mjs
//
// PURE (a stub office; nothing is read live). Each side keeps its own regression file (event-archive.test.mjs, past-events-incremental.test.mjs); these cases only
// pin what neither file could say alone: the archive is the DURABLE store of rows AND evidence, the seed is the request-saving store of ROWS only, and main's
// withdrawal rule (a definitive 404/410 of a held-only event, while the office answers others) applies to a held event from either home.

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { EMPTY_CALENDAR, EMPTY_EVENTS, fetchEventsArchived } from "../tools/lib/fetch-town-data.mjs";
import { readEventsArchive } from "../tools/lib/events-archive-state.mjs";

const OFFICE = "https://office.invalid";
const json = (status, body) => ({ ok: status >= 200 && status < 300, status, statusText: String(status), headers: { get: () => null }, json: async () => body });
const AS_OF = "2026-11-30T12:00:00.000Z";
const SEEN_AT = "2026-11-10T00:00:00.000Z";
const ev = (n) => ({ id: `h/e${n}`, title: `h/e${n}`, host: "h", phase: "ended", ends: `2026-11-${String(30 - n).padStart(2, "0")}T00:00:00.000Z` });
const sparky = (n) => ({ id: `h/e${n}`, evidence: { rooms: [], room_history: "complete", gallery: { rooms: ["r"], sparks: [{ id: `spark-${n}` }] }, complete: true } });

/** the office: one list page [e0, e1] (its oldest, e1, is held by the seed), reads by id (`reads[id]`, `status[id]` for a refusal; unknown ids 404) */
const office = ({ reads = {}, status = {}, asked = [] } = {}) => async (url) => {
  const u = new URL(url);
  asked.push(u.pathname + u.search);
  if (u.pathname === "/town/apex" && u.searchParams.get("read") === "calendar") {
    const args = JSON.parse(u.searchParams.get("args"));
    return args.before ? json(429, { error: "this page must never be asked" }) : json(200, { as_of: AS_OF, past: [ev(0), ev(1)], next: { past: true, before: "b1" }, note: null });
  }
  const m = /^\/calendar\/([^/]+)\/([^/]+)$/.exec(u.pathname);
  if (m) {
    const id = `${decodeURIComponent(m[1])}/${decodeURIComponent(m[2])}`;
    if (status[id]) return json(status[id], { error: "refused" });
    return reads[id] ? json(200, { event: reads[id] }) : json(404, { error: "bounce", code: 404 });
  }
  return json(404, { error: "bounce" });
};

// the archive (a VERSIONED file from an earlier pass) holds e8, whose evidence it read at SEEN_AT; the seed (the published file) holds e1 (the page's anchor) and e5
const archiveFile = () => {
  const home = mkdtempSync(join(tmpdir(), "takes-main-"));
  const path = join(home, "archive.json");
  writeFileSync(path, JSON.stringify({ version: 1, as_of: "2026-11-20T00:00:00.000Z", past: { events: [ev(8)], next: null, note: null, read: "office" }, evidence: { "h/e8": { read: "ok", read_at: SEEN_AT, event: sparky(8) } } }));
  return path;
};
const seed = () => ({ as_of: "2026-11-25T00:00:00.000Z", past: { events: [ev(1), ev(5)], next: { past: true, before: "held-cursor" }, note: null, read: "office" }, evidence: { "h/e5": { read: "ok", event: sparky(5) } } });
const run = (over) => fetchEventsArchived({ apiBase: OFFICE, retries: 1, calendar: EMPTY_CALENDAR, trackedSnapshot: EMPTY_EVENTS, ...over });
const ids = (r) => r.events.past.events.map((e) => e.id);
const saved = (path) => readEventsArchive(path).events.past.events.map((e) => e.id);
const SOME_ANSWER = { "h/e0": sparky(0), "h/e1": sparky(1) };

test("BOTH HOMES: the archive's row and the seed's rows behind the stop all survive a capped list; the page behind the stop is never asked; newest end first", async () => {
  const path = archiveFile(), asked = [];
  const r = await run({ eventsArchivePath: path, seed: seed(), fetchImpl: office({ reads: { ...SOME_ANSWER, "h/e5": sparky(5), "h/e8": sparky(8) }, asked }) });
  assert.deepEqual(ids(r), ["h/e0", "h/e1", "h/e5", "h/e8"]);
  assert.equal(asked.some((a) => /before/.test(decodeURIComponent(a))), false, "the overlap stop: the second page (429 in the real run) was not requested");
  assert.deepEqual(r.events.past.next, { past: true, before: "held-cursor" }, "the held list's own cursor stands: more beyond");
  assert.deepEqual(saved(path), ["h/e0", "h/e1", "h/e5", "h/e8"], "and the archive file was saved with every row");
});

const HELD_E8 = () => ({ read: "ok", read_at: SEEN_AT, event: sparky(8) });
const storedEvidence = (path, id) => readEventsArchive(path).events.evidence[id];
const DEGRADED_E8 = { id: "h/e8", evidence: { rooms: null, room_history: "unavailable", gallery: null, present: null } };
const FRESH_E8 = { id: "h/e8", evidence: { rooms: [], room_history: "complete", present: ["new-presentation"], gallery: { rooms: ["r"], sparks: [{ id: "spark-8-new" }] }, complete: true } };

test("DURABLE STORAGE, FRESH PUBLICATION (CORE-174 F1): repeated transient failures and a degraded 200 keep the archive's stored read and its own read_at across passes while events.json says `unavailable`; a good answer then updates both, presentation included", async () => {
  const path = archiveFile();
  const passes = [
    ["503", { status: { "h/e8": 503, "h/e5": 503 } }],
    ["503 again", { status: { "h/e8": 503, "h/e5": 503 } }],
    ["degraded 200", { status: { "h/e5": 503 }, extra: { "h/e8": DEGRADED_E8 } }],
    ["503 after it", { status: { "h/e8": 503, "h/e5": 503 } }],
  ];
  for (const [name, o] of passes) {
    const r = await run({ eventsArchivePath: path, seed: seed(), fetchImpl: office({ reads: { ...SOME_ANSWER, ...(o.extra ?? {}) }, status: o.status }) });
    assert.deepEqual(ids(r), ["h/e0", "h/e1", "h/e5", "h/e8"], `${name}: a failure is not a withdrawal`);
    assert.deepEqual(r.events.evidence["h/e8"], { read: "unavailable" }, `${name}: PUBLISHED unavailable, not the stored read under an old label`);
    assert.deepEqual(storedEvidence(path, "h/e8"), HELD_E8(), `${name}: the STORED read keeps its bytes and its own read_at`);
    assert.deepEqual(r.events.evidence["h/e5"], { read: "unavailable" }, `${name}: a seed's evidence is never read: unavailable, as on main (CORE-180 F1)`);
    assert.ok(r.gaps.some((g) => /of \d+ one-event reads (were not served|answered with less)/.test(g)) && r.gaps.some((g) => /the archive still stores the earlier read of 1 of them/.test(g)), `${name}: ${JSON.stringify(r.gaps)}`);
  }
  // a good, non-degraded answer publishes fresh and replaces the stored entry whole
  const good = await run({ eventsArchivePath: path, seed: seed(), fetchImpl: office({ reads: { ...SOME_ANSWER, "h/e8": FRESH_E8 }, status: { "h/e5": 503 } }) });
  assert.deepEqual(good.events.evidence["h/e8"], { read: "ok", event: FRESH_E8, read_at: AS_OF }, "published fresh, with the current presentation");
  assert.deepEqual(storedEvidence(path, "h/e8"), good.events.evidence["h/e8"], "and the stored entry is replaced whole: nothing of the old read mixed in");
});

test("UNKNOWN HELD TIME stays unknown and is never published as a read: a stored read with no stamp keeps no stamp through failed passes, and the published view carries no `ok`", async () => {
  const path = archiveFile();
  writeFileSync(path, JSON.stringify({ version: 1, past: { events: [ev(8)], next: null, note: null, read: "office" }, evidence: { "h/e8": { read: "ok", event: sparky(8) } } }));
  for (let pass = 1; pass <= 2; pass++) {
    const r = await run({ eventsArchivePath: path, seed: seed(), fetchImpl: office({ reads: SOME_ANSWER, status: { "h/e8": 503, "h/e5": 503 } }) });
    assert.equal(storedEvidence(path, "h/e8").read_at, undefined, `pass ${pass}: no time invented`);
    assert.equal(storedEvidence(path, "h/e8").read, "ok");
    assert.equal(r.events.evidence["h/e8"].read, "unavailable");
  }
});

test("UNASKED within the budget: a stored read the pass did not ask is not published as a current read, and stays stored untouched (no extra call, no new budget)", async () => {
  const path = archiveFile();
  const r = await run({ eventsArchivePath: path, seed: seed(), evidenceMax: 1, fetchImpl: office({ reads: SOME_ANSWER }) });
  assert.equal(Object.keys(r.events.evidence).length, 1, "one read asked, one published");
  assert.equal(r.events.evidence["h/e8"], undefined, "e8 was not asked: no published read");
  assert.deepEqual(storedEvidence(path, "h/e8"), HELD_E8(), "and the stored one is untouched");
});

test("WITHDRAWAL reaches both homes: a definitive 404/410 of a held-only event (archive's or seed's) while the office answers others removes row and evidence, and the saved archive forgets it", async () => {
  for (const code of [404, 410]) {
    const path = archiveFile();
    const r = await run({ eventsArchivePath: path, seed: seed(), fetchImpl: office({ reads: SOME_ANSWER, status: { "h/e8": code, "h/e5": code } }) });
    assert.deepEqual(ids(r), ["h/e0", "h/e1"], `${code}: both held-only events leave`);
    assert.equal(r.events.evidence["h/e8"], undefined);
    assert.equal(r.events.evidence["h/e5"], undefined);
    assert.ok(r.gaps.some((g) => /2 held past event\(s\) the office no longer serves/.test(g)), JSON.stringify(r.gaps));
    assert.deepEqual(saved(path), ["h/e0", "h/e1"], `${code}: not resurrected from the file next pass`);
  }
  // a door that refuses EVERYTHING withdraws nothing, and the archive's evidence stands
  const path = archiveFile();
  const none = await run({ eventsArchivePath: path, seed: seed(), fetchImpl: office({ reads: {} }) });
  assert.deepEqual(ids(none), ["h/e0", "h/e1", "h/e5", "h/e8"], "no read was answered: nothing is taken down");
  assert.deepEqual(storedEvidence(path, "h/e8"), HELD_E8(), "the stored evidence stands");
  assert.ok(none.gaps.some((g) => /none was taken down/.test(g)));
});

test("FAIL-CLOSED survives the seed: an unreadable archive still REJECTS with a seed present (the file untouched); a failed save still rejects; a seed does not make the archive optional", async () => {
  const home = mkdtempSync(join(tmpdir(), "takes-main-bad-"));
  const bad = join(home, "bad.json");
  writeFileSync(bad, "{ not json");
  await assert.rejects(run({ eventsArchivePath: bad, seed: seed(), fetchImpl: office({ reads: SOME_ANSWER }) }), (e) => /exists but could not be read/.test(e.message) && /refusing to publish/.test(e.message));
  assert.equal(readFileSync(bad, "utf8"), "{ not json");
  const blocker = join(home, "afile");
  writeFileSync(blocker, "x");
  await assert.rejects(run({ eventsArchivePath: join(blocker, "sub", "a.json"), seed: seed(), fetchImpl: office({ reads: SOME_ANSWER }) }), (e) => /could not be written/.test(e.message));
  assert.equal(readEventsArchive(bad).state, "unreadable");
});

test("NO ARCHIVE, a seed: exactly main's behaviour (the box-less build); NO SEED, an archive: exactly the train's (the full capped read, no overlap stop)", async () => {
  const s = await run({ eventsArchivePath: null, seed: seed(), fetchImpl: office({ reads: { ...SOME_ANSWER, "h/e5": sparky(5) } }) });
  assert.deepEqual(ids(s), ["h/e0", "h/e1", "h/e5"]);
  assert.equal(s.events.evidence["h/e5"].read, "ok");
  const asked = [];
  const a = await run({ eventsArchivePath: archiveFile(), seed: null, fetchImpl: office({ reads: { ...SOME_ANSWER, "h/e8": sparky(8) }, asked }) }).catch((e) => e);
  assert.ok(a instanceof Error, "without a seed the list is read on to its next page (429 here), and a refused page fails the pass as it always did");
  assert.ok(asked.some((x) => /before/.test(decodeURIComponent(x))));
});
