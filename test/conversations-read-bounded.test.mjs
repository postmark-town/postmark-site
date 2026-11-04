// conversations-read-bounded.test.mjs — the bounded conversations read the cockpit and the house dashboard share (POS-779).
//
// The office's first page is the newest 40 live threads (80 lines each) with `next_threads` cursors. These tests drive the
// shared reader with a fetch they control: it follows the cursor while the threads are inside the consumer's window, stops
// at the cap, and says `partial`; a refusal is `unavailable`, never an empty town; the in-memory read is `legacy`.
//
//   node --test test/conversations-read-bounded.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readConversations, readNoteOf } from "../src/lib/conversations-read.mjs";

const NOW = Date.parse("2026-11-04T12:00:00Z");
const MIN = 60_000;
const thread = (n, ageMin, over = {}) => ({ id: `t${n}`, thread_of: String(n), voice_count: 1, latest: new Date(NOW - ageMin * MIN).toISOString(), voices: [{ act_id: String(n), handle: "h", said: "x", at_ms: NOW - ageMin * MIN }], ...over });
const answer = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

/** A fetch that answers from a script keyed by the `next_threads` cursor ("" is the first page); it records the urls. */
function office(script) {
  const urls = [];
  const fn = async (url) => {
    urls.push(url);
    const q = new URL(url, "http://x").searchParams.get("next_threads") ?? "";
    const a = script[q];
    if (a instanceof Error) throw a;
    return a ?? answer(404, {});
  };
  fn.urls = urls;
  return fn;
}
const page1 = (live, over = {}) => ({ live, closed: [], fade_minutes: 5, ...over });

test("a refusal, a failure and a body without a live list are UNAVAILABLE, never an empty town", async () => {
  for (const a of [answer(503, { error: "bounce" }), answer(200, { nope: 1 }), new Error("offline")]) {
    const r = await readConversations(office({ "": a }), "https://o/api", { windowMs: 5 * MIN, now: NOW });
    assert.equal(r.body, null);
    assert.equal(r.status.state, "unavailable");
    assert.match(readNoteOf(r.status, "what the house said"), /can't be read just now/);
    assert.match(readNoteOf(r.status), /not that nobody spoke/);
  }
});

test("a first page with no cursor is OK, one fetch, and says nothing", async () => {
  const f = office({ "": answer(200, page1([thread(1, 1)])) });
  const r = await readConversations(f, "https://o/api/", { windowMs: 5 * MIN, now: NOW });
  assert.equal(r.status.state, "ok");
  assert.equal(r.body.live.length, 1);
  assert.equal(f.urls.length, 1);
  assert.equal(f.urls[0], "https://o/api/world/conversations", "the ordinary endpoint, no parameter on the first page");
  assert.equal(readNoteOf(r.status), null);
});

test("it follows next_threads while the last thread it holds is inside the window, and appends in order", async () => {
  const f = office({
    "": answer(200, page1([thread(1, 1), thread(2, 2)], { next_threads: { live: "c1" } })),
    c1: answer(200, { threads: [thread(3, 3), thread(4, 4)], next_threads: "c2" }),
    c2: answer(200, { threads: [thread(5, 9)], next_threads: null }),
  });
  const r = await readConversations(f, "https://o/api", { windowMs: 5 * MIN, sections: ["live"], now: NOW });
  assert.deepEqual(r.body.live.map((t) => t.thread_of), ["1", "2", "3", "4", "5"]);
  assert.equal(r.status.state, "ok");
  assert.equal(f.urls.length, 3);
  assert.match(f.urls[1], /next_threads=c1$/);
});

test("it stops when the threads it holds are older than the window: the rest cannot hold a line inside it", async () => {
  const f = office({
    "": answer(200, page1([thread(1, 1), thread(2, 30)], { next_threads: { live: "c1" } })),
    c1: answer(200, { threads: [thread(3, 40)], next_threads: null }),
  });
  const r = await readConversations(f, "https://o/api", { windowMs: 5 * MIN, sections: ["live"], now: NOW });
  assert.equal(f.urls.length, 1, "no follow: the last thread is already 30 minutes old");
  assert.equal(r.status.state, "ok", "a cursor the window does not need is not a cut");
});

test("the cap stops a long run of in-window threads and the read says PARTIAL", async () => {
  const script = { "": answer(200, page1([thread(1, 1)], { next_threads: { live: "c1" } })) };
  for (let i = 1; i <= 6; i++) script["c" + i] = answer(200, { threads: [thread(10 + i, 1)], next_threads: "c" + (i + 1) });
  const f = office(script);
  const r = await readConversations(f, "https://o/api", { windowMs: 5 * MIN, sections: ["live"], maxPages: 3, now: NOW });
  assert.equal(f.urls.length, 4, "the first page and exactly maxPages follows");
  assert.equal(r.body.live.length, 4);
  assert.equal(r.status.state, "partial");
  assert.deepEqual(r.status.cut, ["live"]);
  assert.match(readNoteOf(r.status), /Only the newest conversations were read/);
});

test("a follow that fails, regenerates or comes lean is PARTIAL, and what was read is kept", async () => {
  const mk = (follow) => office({ "": answer(200, page1([thread(1, 1)], { next_threads: { live: "c1" } })), c1: follow });
  for (const follow of [answer(503, {}), answer(200, { regenerated: true, threads: [] }), answer(200, { threads: [thread(2, 1, { voices: [] })], next_threads: null })]) {
    const r = await readConversations(mk(follow), "https://o/api", { windowMs: 5 * MIN, sections: ["live"], now: NOW });
    assert.equal(r.status.state, "partial");
    assert.equal(r.body.live[0].thread_of, "1");
  }
});

test("the in-memory read's incomplete_legacy is LEGACY and the note says it is the short record", async () => {
  const f = office({ "": answer(200, page1([thread(1, 1)], { incomplete_legacy: "this is the office's in-memory record" })) });
  const r = await readConversations(f, "https://o/api", { windowMs: 5 * MIN, now: NOW });
  assert.equal(r.status.state, "legacy");
  assert.match(readNoteOf(r.status), /short in-memory record/);
});

test("both sections are followed for the dashboard, each from its own cursor", async () => {
  const f = office({
    "": answer(200, page1([thread(1, 60)], { closed: [thread(8, 60)], next_threads: { live: "L1", closed: "C1" } })),
    L1: answer(200, { threads: [thread(2, 90)], next_threads: null }),
    C1: answer(200, { threads: [thread(9, 90)], next_threads: null }),
  });
  const r = await readConversations(f, "https://o/api", { windowMs: 24 * 60 * MIN, now: NOW });
  assert.deepEqual(r.body.live.map((t) => t.thread_of), ["1", "2"]);
  assert.deepEqual(r.body.closed.map((t) => t.thread_of), ["8", "9"]);
  assert.equal(r.status.state, "ok");
});

// ── the consumers are wired to it (no suite renders an .astro file, so the wiring is read from the source) ──
const src = (rel) => readFileSync(new URL(rel, import.meta.url), "utf8");

test("the household dashboard reads through it and paints its status beside the feed; a null body is no longer read as silence", () => {
  const reads = src("../src/lib/household-dashboard/reads.mjs");
  assert.match(reads, /readConversations\(fetch, api, \{ windowMs: 86_400_000 \}\)/);
  assert.match(reads, /conversations: said\.body, conversationsStatus: said\.status/);
  const paint = src("../src/lib/household-dashboard/paint.mjs");
  assert.match(paint, /paintReadNote\(root, reads, drewWords\);/);
  assert.match(paint, /readNoteOf\(reads\.conversationsStatus, "what the house said"\)/);
  assert.match(src("../src/components/household-dashboard/HouseDashboard.astro"), /data-hd-readnote role="status" hidden/);
});

test("the cockpit's speech read follows the window and carries its status; a failure is not null", () => {
  const cockpit = src("../src/components/WorldCockpit.astro");
  assert.match(cockpit, /readConversations\(fetch, OFFICE, \{ windowMs: 5 \* 60_000, sections: \["live"\] \}\)/);
  assert.match(cockpit, /\{ unavailable: true, read_status: status \}/);
});
