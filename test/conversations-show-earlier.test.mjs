// conversations-show-earlier.test.mjs — the conversations page's SHOW EARLIER and MORE-THREADS state machines (POS-779).
//
// The page keeps what a reader pulled back per thread, and per list. The rules that keep it honest are in the page's own inline
// script, so this suite reads them out of the page (the way conversations-face.test.mjs reads the avatar guard) and runs THAT
// text, with a fetch it controls, a redraw and a tick it can count. It is a unit test of the state machine: the page in a real
// browser against a real office is the separate proof in the lane's report, and nothing here claims to be it.
//
//   node --test test/conversations-show-earlier.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../town/pages/conversations/index.astro", import.meta.url), "utf8");
const cut = (from, to) => {
  const a = page.indexOf(from), b = page.indexOf(to, a);
  assert.ok(a > -1 && b > a, `the page still carries ${from} … ${to}`);
  return page.slice(a, b);
};
const earlierSrc = cut("var expanded = {};", "function threadNode(t)");
const moreSrc = cut("var pageNext = {", "function moreThreadsButton(scope)");

/** The page's SHOW EARLIER block over a fetch the test drives. Each fetch call waits for `answer(i, resolveWith)`. */
function earlierRig() {
  const calls = [];
  const fetchStub = (url) => new Promise((ok) => calls.push({ url, answer: (status, body) => ok({ status, json: () => Promise.resolve(body) }) }));
  const log = { redraw: 0, tick: 0 };
  const make = new Function("API", "fetch", "redraw", "tick", `${earlierSrc}\nreturn { expanded, lineNotes, stateFor, mergedLines, showEarlier, anchorKey: () => anchorKey };`);
  const rig = make("/api/world/conversations", fetchStub, () => { log.redraw += 1; }, () => { log.tick += 1; });
  return { ...rig, calls, log };
}
const voice = (id, text = `t${id}`) => ({ act_id: String(id), said: text, at_ms: Number(id) * 1000 });
const thread = (over = {}) => ({ thread_of: "100", generation: "g".repeat(32), epoch: { since: 5000, next: null }, earlier: "9000:150", voice_count: 8, voices: [voice(150), voice(151)], ...over });
const flush = () => new Promise((r) => setImmediate(r));

test("merged lines are the pulled-back lines first, then the newest page, each act id once", () => {
  const { mergedLines } = earlierRig();
  const t = thread({ voices: [voice(103), voice(104), voice(105)] });
  const held = { lines: [voice(101), voice(102), voice(103)] };
  assert.deepEqual(mergedLines(t, held).map((v) => v.act_id), ["101", "102", "103", "104", "105"], "103 sits in both lists and is shown once");
  assert.deepEqual(mergedLines(t, null).map((v) => v.act_id), ["103", "104", "105"]);
});

test("a held page belongs to the generation it was pulled under: any other generation drops it and says why", () => {
  const { expanded, lineNotes, stateFor } = earlierRig();
  expanded["100"] = { generation: "a".repeat(32), lines: [voice(90)], earlier: "1:1", busy: false, error: null, token: 1 };
  assert.ok(stateFor(thread({ generation: "a".repeat(32) })), "the same generation keeps it");
  assert.equal(stateFor(thread({ generation: "b".repeat(32) })), null, "another generation drops it");
  assert.equal("100" in expanded, false);
  assert.match(lineNotes["100"], /changed while you were reading/);
  assert.equal(stateFor({ generation: "x" }), null, "a legacy thread (no thread_of) has no held page");
});

test("show earlier asks for the lines strictly before the oldest held, under the generation shown, in the epoch named", async () => {
  const { showEarlier, calls, expanded, log } = earlierRig();
  const t = thread();
  showEarlier(t);
  assert.equal(calls.length, 1);
  const u = new URL("http://x" + calls[0].url);
  assert.equal(u.pathname, "/api/world/conversations");
  assert.deepEqual(Object.fromEntries(u.searchParams), { thread_of: "100", before: "9000:150", generation: "g".repeat(32), since: "5000", next: "open", limit: "80" });
  assert.equal(expanded["100"].busy, true);
  assert.ok(log.redraw >= 1, "the button shows it is busy");
  calls[0].answer(200, { thread_of: "100", generation: "g".repeat(32), voices: [voice(140), voice(141)], earlier: "8000:140" });
  await flush();
  assert.deepEqual(expanded["100"].lines.map((v) => v.act_id), ["140", "141"]);
  assert.equal(expanded["100"].earlier, "8000:140", "the next page goes back from the oldest line now held");
  assert.equal(expanded["100"].busy, false);
  // a closed epoch names its end
  const closed = earlierRig();
  closed.showEarlier(thread({ epoch: { since: 5000, next: 9999 } }));
  assert.equal(new URL("http://x" + closed.calls[0].url).searchParams.get("next"), "9999");
});

test("a second press while one is in flight asks nothing more", () => {
  const { showEarlier, calls } = earlierRig();
  const t = thread();
  showEarlier(t); showEarlier(t); showEarlier(t);
  assert.equal(calls.length, 1);
});

test("the office saying the generation moved drops what is held and re-polls; a 404 does too, with its sentence", async () => {
  const a = earlierRig();
  a.showEarlier(thread());
  a.calls[0].answer(200, { regenerated: true, thread: thread() });
  await flush();
  assert.equal("100" in a.expanded, false);
  assert.equal(a.log.tick, 1, "the page asks again at once");
  assert.match(a.lineNotes["100"], /changed while you were reading/);
  const b = earlierRig();
  b.showEarlier(thread());
  b.calls[0].answer(404, { error: "bounce" });
  await flush();
  assert.equal("100" in b.expanded, false);
  assert.match(b.lineNotes["100"], /no longer there/);
  assert.equal(b.log.tick, 1);
});

test("a failed pull says so on the thread, holds nothing new, and the control comes back", async () => {
  const { showEarlier, calls, expanded } = earlierRig();
  showEarlier(thread());
  calls[0].answer(503, { error: "bounce" });
  await flush();
  assert.match(expanded["100"].error, /Couldn't load the earlier statements/);
  assert.equal(expanded["100"].busy, false);
  assert.deepEqual(expanded["100"].lines, []);
  showEarlier(thread()); // the retry is allowed
  assert.equal(calls.length, 2);
});

test("an answer to a request made under a generation the page no longer holds is THROWN AWAY unread", async () => {
  const { showEarlier, stateFor, calls, expanded } = earlierRig();
  showEarlier(thread());
  // the poll brings the thread back under another generation before the answer arrives
  assert.equal(stateFor(thread({ generation: "z".repeat(32) })), null);
  calls[0].answer(200, { thread_of: "100", generation: "g".repeat(32), voices: [voice(140)], earlier: null });
  await flush();
  assert.equal("100" in expanded, false, "nothing was added back");
  // and one that arrives after the reader pressed again under the same generation (an older token) is also ignored
  const r = earlierRig();
  r.showEarlier(thread());
  r.expanded["100"].token += 1; // as a second request would have done
  r.calls[0].answer(200, { thread_of: "100", generation: "g".repeat(32), voices: [voice(140)], earlier: null });
  await flush();
  assert.deepEqual(r.expanded["100"].lines, []);
  assert.equal(r.expanded["100"].busy, true, "the newer request still owns the state");
});

test("an answer for another thread or another generation than asked is not trusted", async () => {
  const { showEarlier, calls, expanded } = earlierRig();
  showEarlier(thread());
  calls[0].answer(200, { thread_of: "999", generation: "g".repeat(32), voices: [voice(140)], earlier: null });
  await flush();
  assert.deepEqual(expanded["100"].lines, []);
  assert.match(expanded["100"].error, /Couldn't load/);
});

// ── the next threads of a cut list ──

function moreRig() {
  const calls = [];
  const fetchStub = (url) => new Promise((ok) => calls.push({ url, answer: (status, body) => ok({ status, json: () => Promise.resolve(body) }) }));
  const log = { redraw: 0, tick: 0 };
  const make = new Function("API", "fetch", "redraw", "tick", `${moreSrc}\nreturn { pageNext: () => pageNext, setPageNext: (v) => { pageNext = v; }, extra, sectionThreads, sectionCursor, loadMoreThreads };`);
  return { ...make("/api/world/conversations", fetchStub, () => { log.redraw += 1; }, () => { log.tick += 1; }), calls, log };
}

test("more threads: the cursor of the page is asked, the threads are appended, the new cursor is the next", async () => {
  const m = moreRig();
  m.setPageNext({ live: "c1", closed: null });
  assert.equal(m.sectionCursor("live"), "c1");
  m.loadMoreThreads("live");
  assert.equal(new URL("http://x" + m.calls[0].url).searchParams.get("next_threads"), "c1");
  m.calls[0].answer(200, { threads: [{ thread_of: "7" }, { thread_of: "8" }], next_threads: "c2" });
  await flush();
  assert.deepEqual(m.sectionThreads("live", [{ thread_of: "1" }]).map((t) => t.thread_of), ["1", "7", "8"]);
  assert.equal(m.sectionCursor("live"), "c2");
  m.loadMoreThreads("live");
  m.calls[1].answer(200, { threads: [{ thread_of: "9" }], next_threads: null });
  await flush();
  assert.equal(m.sectionCursor("live"), null, "the list is whole");
});

test("more threads: threads fetched after a cursor that no longer stands are dropped, never stitched on", async () => {
  const m = moreRig();
  m.setPageNext({ live: "c1", closed: null });
  m.loadMoreThreads("live");
  m.calls[0].answer(200, { threads: [{ thread_of: "7" }], next_threads: "c2" });
  await flush();
  m.setPageNext({ live: "c9", closed: null }); // the next poll's page has a different cursor: its list changed
  assert.deepEqual(m.sectionThreads("live", [{ thread_of: "1" }]).map((t) => t.thread_of), ["1"]);
  assert.equal(m.sectionCursor("live"), "c9");
});

test("more threads: a list that changed under the cursor re-polls; a failure says so and can be retried; a late answer after a reset is ignored", async () => {
  const a = moreRig();
  a.setPageNext({ live: "c1", closed: null });
  a.loadMoreThreads("live");
  a.calls[0].answer(200, { regenerated: true, threads: [], next_threads: null });
  await flush();
  assert.equal(a.extra.live, null);
  assert.equal(a.log.tick, 1);
  const b = moreRig();
  b.setPageNext({ live: "c1", closed: null });
  b.loadMoreThreads("live");
  b.calls[0].answer(503, { error: "bounce" });
  await flush();
  assert.match(b.extra.live.error, /Couldn't load more conversations/);
  b.loadMoreThreads("live"); // the retry
  assert.equal(b.calls.length, 2);
  const c = moreRig();
  c.setPageNext({ live: "c1", closed: null });
  c.loadMoreThreads("live");
  c.setPageNext({ live: "c9", closed: null });
  c.sectionThreads("live", []); // the next poll drops the stale extras
  c.calls[0].answer(200, { threads: [{ thread_of: "7" }], next_threads: null });
  await flush();
  assert.deepEqual(c.sectionThreads("live", [{ thread_of: "1" }]).map((t) => t.thread_of), ["1"], "the answer to a request from a dropped list adds nothing");
});
