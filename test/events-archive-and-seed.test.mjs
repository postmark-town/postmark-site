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

test("DURABLE EVIDENCE: a transient failure (503) on the archive's event keeps the evidence it held, with its OWN read time; the seed's event, held rows only, is `unavailable`", async () => {
  const path = archiveFile();
  const r = await run({ eventsArchivePath: path, seed: seed(), fetchImpl: office({ reads: SOME_ANSWER, status: { "h/e8": 503, "h/e5": 503 } }) });
  assert.deepEqual(ids(r), ["h/e0", "h/e1", "h/e5", "h/e8"], "a failure is not a withdrawal");
  assert.equal(r.events.evidence["h/e8"].read, "ok", "the archive HELD this read: it stands on a failed read");
  assert.equal(r.events.evidence["h/e8"].read_at, SEEN_AT, "labelled by its own time, never this pass's");
  assert.deepEqual(r.events.evidence["h/e5"], { read: "unavailable" }, "a seed's evidence is never read: a failed read with no archive entry is `unavailable`, as on main (CORE-180 F1)");
  assert.ok(r.gaps.some((g) => /2 of \d+ one-event reads were not served, so 1 of those events' pages say their evidence couldn't be read and 1 kept/.test(g)), JSON.stringify(r.gaps));
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
  assert.equal(none.events.evidence["h/e8"].read, "ok");
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
