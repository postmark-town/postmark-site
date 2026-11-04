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
  const make = new Function("API", "fetch", "redraw", "tick", `${earlierSrc}\nreturn { expanded, lineNotes, seen, gotoNewest, stateFor, mergedLines, showEarlier, showLater, backToNewest, anchorKey: () => anchorKey };`);
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

// ── keeping the reader's place across a change of generation: ONE request near the reader's line ──

const G1 = "a".repeat(32), G2 = "b".repeat(32), G3 = "c".repeat(32);
const vat = (id, at = Number(id) * 1000) => ({ act_id: String(id), said: "t" + id, at_ms: at });
/** A reader who has pulled lines `from`..`to-1` back under G1 and is looking at `seenLine`; the thread has since moved to `gen`. */
function readerOn({ from = 100, to = 300, seenLine = "110", gen = G2, win = null, over = {} } = {}) {
  const r = earlierRig();
  const lines = []; for (let i = from; i < to; i++) lines.push(vat(i));
  r.expanded["100"] = { generation: G1, lines, earlier: `${from * 1000}:${from}`, busy: false, error: null, token: 1, win };
  r.seen["100"] = { line: String(seenLine), rel: 12 };
  const now = thread({ generation: gen, earlier: "900000:900", voices: [vat(900), vat(901)], voice_count: 800, ...over });
  return { ...r, now };
}
const q = (r, i) => Object.fromEntries(new URL("http://x" + r.calls[i].url).searchParams);

test("FAR: a reader deeper than the near limit gets ONE request from a cut just after their line, and the window is not joined to the newest page", async () => {
  const r = readerOn({ seenLine: "110" });                      // 189 held lines after line 110: far
  const s = r.stateFor(r.now);
  assert.ok(s && s.re, "a re-anchor is running and the render gets its state");
  assert.deepEqual(s.lines, [], "nothing from the old generation is kept");
  await flush();
  assert.equal(r.calls.length, 1);
  assert.deepEqual(q(r, 0), { thread_of: "100", before: "151000:151", generation: G2, since: "5000", next: "open", limit: "80" }, "the ordinary earlier request, under the CURRENT generation, from the (at_ms:act id) of the line 41 after the reader's");
  r.calls[0].answer(200, { thread_of: "100", generation: G2, voices: Array.from({ length: 80 }, (_, k) => vat(71 + k)), earlier: "71000:71" });
  await flush();
  assert.equal(r.calls.length, 1, "no second request: the cost does not grow with the depth");
  const done = r.expanded["100"];
  assert.equal(done.busy, false); assert.equal(done.re, null);
  assert.deepEqual(done.win, { cut: "151000:151" });
  assert.deepEqual(done.restoreTo, { line: "110", rel: 12 }, "the same act id, at the same offset inside the list");
  assert.equal(done.earlier, "71000:71", "show earlier continues from the window's own cursor");
  assert.deepEqual(r.mergedLines(r.now, done).map((v) => v.act_id).slice(0, 2).concat(r.mergedLines(r.now, done).map((v) => v.act_id).slice(-2)), ["71", "72", "149", "150"], "the window stands alone: the newest page's lines (900, 901) are NOT appended as if contiguous");
  assert.equal(r.lineNotes["100"], undefined, "the window label says it; no second sentence");
  assert.deepEqual(done.ahead, ["191000:191", "231000:231", "271000:271"], "the cuts kept for reading on: one every 40 lines after the far cut, from lines the reader already had");
});

test("NEAR: a reader within reach of the newest page is read from the newest page's cursor in one request, contiguous with it", async () => {
  const r = readerOn({ seenLine: "250" });                      // 49 held lines after it: near
  r.stateFor(r.now);
  await flush();
  assert.equal(r.calls.length, 1);
  assert.deepEqual(q(r, 0), { thread_of: "100", before: "900000:900", generation: G2, since: "5000", next: "open", limit: "170" }, "from the newest page's own cursor: the distance, the newest page's own 80 and 40 lines of context");
  r.calls[0].answer(200, { thread_of: "100", generation: G2, voices: Array.from({ length: 90 }, (_, k) => vat(190 + k)), earlier: "190000:190" });
  await flush();
  const done = r.expanded["100"];
  assert.equal(done.win, null, "contiguous: the newest page follows it");
  assert.deepEqual(done.restoreTo, { line: "250", rel: 12 });
  assert.deepEqual(r.mergedLines(r.now, done).map((v) => v.act_id).slice(-3), ["279", "900", "901"], "the newest page follows the lines read again");
});

test("the request count does not depend on how deep the reader is", async () => {
  for (const [from, to, seenLine] of [[100, 300, "110"], [0, 700, "200"], [0, 700, "20"], [300, 700, "320"]]) {
    const r = readerOn({ from, to, seenLine });
    r.stateFor(r.now);
    await flush();
    assert.equal(r.calls.length, 1, `reader on ${seenLine} of ${to - from} held lines`);
    assert.equal(q(r, 0).limit, "80");
  }
});

test("a line the answer does not contain is a truthful reset to the newest page, never an old row", async () => {
  const r = readerOn({ seenLine: "110" });
  r.stateFor(r.now);
  await flush();
  r.calls[0].answer(200, { thread_of: "100", generation: G2, voices: [vat(140), vat(141)], earlier: "140000:140" });   // 110 is gone
  await flush();
  assert.equal("100" in r.expanded, false, "nothing from before is kept");
  assert.match(r.lineNotes["100"], /your place could not be found again, so it shows its newest statements/);
  assert.doesNotMatch(r.lineNotes["100"], /no longer part/, "absence from one sized answer is not a claim that the line has gone");
});

test("a change that lands under the request repeats it under the generation the office names, at most three times", async () => {
  const r = readerOn({ seenLine: "110" });
  r.stateFor(r.now);
  await flush();
  r.calls[0].answer(200, { regenerated: true, thread: thread({ generation: G3, earlier: "950000:950", voices: [vat(950)] }) });
  await flush();
  assert.equal(r.calls.length, 2);
  assert.deepEqual([q(r, 1).generation, q(r, 1).before], [G3, "151000:151"], "the same cut, the new generation");
  r.calls[1].answer(200, { regenerated: true, thread: thread({ generation: "d".repeat(32), earlier: "960000:960", voices: [vat(960)] }) });
  await flush();
  r.calls[2].answer(200, { regenerated: true, thread: thread({ generation: "e".repeat(32), earlier: "970000:970", voices: [vat(970)] }) });
  await flush();
  assert.equal(r.calls.length, 3, "the third change ends it");
  assert.match(r.lineNotes["100"], /changing too quickly/);
  assert.equal("100" in r.expanded, false);
});

test("a delayed answer to a request made under a generation the page no longer holds adds nothing", async () => {
  const r = readerOn({ seenLine: "110" });
  r.stateFor(r.now);
  await flush();
  const again = r.stateFor(thread({ generation: G3, earlier: "950000:950", voices: [vat(950)] }));      // the poll: it moved again
  assert.equal(again.re.tries, 2);
  r.calls[0].answer(200, { thread_of: "100", generation: G2, voices: [vat(110)], earlier: null });      // the OLD request's answer
  await flush();
  assert.deepEqual(r.expanded["100"].lines, [], "thrown away unread");
  assert.equal(r.expanded["100"].busy, true, "the newer request still owns the state");
});

test("ids are compared and cut as the office sent them: equal milliseconds and ids past 2^53 survive exactly", async () => {
  const big = (k) => String(9007199254740993n + BigInt(k));
  const same = 5_000_000;
  const lines = Array.from({ length: 300 }, (_, k) => ({ act_id: big(k), said: "x" + k, at_ms: same }));    // 300 voices in ONE millisecond
  const r = earlierRig();
  r.expanded["100"] = { generation: G1, lines, earlier: `${same}:${big(0)}`, busy: false, error: null, token: 1, win: null };
  r.seen["100"] = { line: big(20), rel: 5 };
  r.stateFor(thread({ generation: G2, earlier: "9000000:9000", voices: [vat(9000)] }));
  await flush();
  assert.equal(q(r, 0).before, `${same}:${big(61)}`, "the cut is the exact decimal string of the line 41 after, never a Number");
  assert.equal(q(r, 0).before, "5000000:9007199254741054");
  r.calls[0].answer(200, { thread_of: "100", generation: G2, voices: lines.slice(0, 61), earlier: null });
  await flush();
  assert.deepEqual(r.expanded["100"].restoreTo, { line: big(20), rel: 5 });
  assert.equal(new Set(r.expanded["100"].lines.map((v) => v.act_id)).size, 61, "each once");
});

test("a private or nonexistent member is the office's one generic 404: the page says it is no longer there", async () => {
  const r = readerOn({ seenLine: "110" });
  r.stateFor(r.now);
  await flush();
  r.calls[0].answer(404, { error: "bounce" });
  await flush();
  assert.equal("100" in r.expanded, false);
  assert.match(r.lineNotes["100"], /no longer there/);
});

test("from a far window: show earlier continues from the window's cursor, and another change re-anchors from the window's own lines and cut", async () => {
  const r = readerOn({ seenLine: "110" });
  r.stateFor(r.now); await flush();
  r.calls[0].answer(200, { thread_of: "100", generation: G2, voices: Array.from({ length: 80 }, (_, k) => vat(71 + k)), earlier: "71000:71" });
  await flush();
  const t2 = { ...r.now };
  r.seen["100"] = { line: "80", rel: 3 };
  r.showEarlier(t2);
  assert.equal(q(r, 1).before, "71000:71", "from the window's own cursor, under the window's generation");
  assert.equal(q(r, 1).generation, G2);
  r.calls[1].answer(200, { thread_of: "100", generation: G2, voices: Array.from({ length: 20 }, (_, k) => vat(51 + k)), earlier: "51000:51" });
  await flush();
  assert.deepEqual(r.expanded["100"].lines.map((v) => v.act_id).slice(0, 2), ["51", "52"], "prepended, in order");
  // the thread moves again while the reader is on 80
  const again = r.stateFor(thread({ generation: G3, earlier: "990000:990", voices: [vat(990)] }));
  await flush();
  assert.ok(again.re && again.re.old.win, "the saved neighbours come from the window");
  assert.equal(q(r, 2).before, "121000:121", "a cut 41 lines after line 80, from the window's own lines");
});

test("back to the newest statements drops the window and asks the next paint to end at the newest line", async () => {
  const r = readerOn({ seenLine: "110" });
  r.stateFor(r.now); await flush();
  r.calls[0].answer(200, { thread_of: "100", generation: G2, voices: Array.from({ length: 80 }, (_, k) => vat(71 + k)), earlier: "71000:71" });
  await flush();
  const before = r.log.redraw;
  r.backToNewest(r.now);
  assert.equal("100" in r.expanded, false);
  assert.equal(r.gotoNewest["100"], true);
  assert.ok(r.log.redraw > before);
});

test("at most three threads re-anchor at once; the rest fall back to the newest page with the sentence", () => {
  const r = earlierRig();
  const mk = (id) => { r.expanded[id] = { generation: G1, lines: [vat(Number(id) - 1), vat(Number(id))], earlier: "1:1", busy: false, error: null, token: 1 }; r.seen[id] = { line: String(Number(id) - 1), rel: 0 }; return thread({ thread_of: id, generation: G2, earlier: "9000:9" }); };
  const got = ["11", "21", "31", "41"].map(mk).map((t) => r.stateFor(t));
  assert.deepEqual(got.map((s) => !!s), [true, true, true, false]);
  assert.match(r.lineNotes["41"], /changed while you were reading/);
});

test("a reader on the newest page loses the pulled-back lines with the old sentence and no request", async () => {
  const r = readerOn({ seenLine: "900" });
  assert.equal(r.stateFor(r.now), null);
  await flush();
  assert.equal(r.calls.length, 0);
  assert.match(r.lineNotes["100"], /changed while you were reading/);
});

test("a failed re-anchor says so on the thread, holds the newest page, does not retry, and the control comes back", async () => {
  const r = readerOn({ seenLine: "110" });
  r.stateFor(r.now); await flush();
  r.calls[0].answer(503, { error: "bounce" });
  await flush();
  const s = r.expanded["100"];
  assert.match(s.error, /Couldn't read the statements around your line again/);
  assert.equal(s.busy, false);
  assert.equal(r.calls.length, 1);
});

// ── v2: a burst of new voices, and reading on past a far window ──

test("NEAR with a burst: when the thread has grown past what one page reaches, the page asks FAR directly: one request, the act kept", async () => {
  const r = readerOn({ from: 540, to: 620, seenLine: "560" });
  r.expanded["100"].base = { count: 700, newest: 80 };
  r.now.voice_count = 800;                                           // 100 new voices: the newest page's cursor moved on by 100
  r.stateFor(r.now);
  await flush();
  assert.equal(r.calls.length, 1);
  assert.deepEqual(q(r, 0), { thread_of: "100", before: "601000:601", generation: G2, since: "5000", next: "open", limit: "80" }, "from the cut 41 lines after the reader's line, not from the newest page's cursor");
  r.calls[0].answer(200, { thread_of: "100", generation: G2, voices: Array.from({ length: 80 }, (_, k) => vat(521 + k)), earlier: "521000:521" });
  await flush();
  assert.deepEqual(r.expanded["100"].restoreTo, { line: "560", rel: 12 });
  assert.deepEqual(r.expanded["100"].win, { cut: "601000:601" });
});

test("NEAR that cannot be sized (nothing known of the growth) and misses: ONE far request follows, and the act is found", async () => {
  const r = readerOn({ from: 540, to: 620, seenLine: "560" });      // no base: growth unknown, the near request is tried
  r.stateFor(r.now);
  await flush();
  assert.equal(q(r, 0).before, "900000:900", "the near request first");
  r.calls[0].answer(200, { thread_of: "100", generation: G2, voices: Array.from({ length: 170 }, (_, k) => vat(730 + k)), earlier: "730000:730" });   // the burst moved the cursor: 560 is not in it
  await flush();
  assert.equal(r.calls.length, 2, "not evidence the line has gone: one more request, from the cut after the line");
  assert.equal(q(r, 1).before, "601000:601");
  assert.equal(q(r, 1).limit, "80");
  r.calls[1].answer(200, { thread_of: "100", generation: G2, voices: Array.from({ length: 80 }, (_, k) => vat(521 + k)), earlier: "521000:521" });
  await flush();
  assert.equal(r.calls.length, 2);
  assert.deepEqual(r.expanded["100"].restoreTo, { line: "560", rel: 12 });
  assert.equal(r.lineNotes["100"], undefined);
});

test("bursts of 1, 50 and 100 new voices: the act is kept and the requests never exceed two", async () => {
  for (const growth of [1, 50, 100]) {
    const r = readerOn({ from: 540, to: 620, seenLine: "560" });
    r.expanded["100"].base = { count: 700, newest: 80 };
    r.now.voice_count = 700 + growth;
    r.stateFor(r.now);
    await flush();
    const first = r.calls.length;
    r.calls[0].answer(200, { thread_of: "100", generation: G2, voices: Array.from({ length: 80 }, (_, k) => vat(521 + k)).slice(growth > 20 ? 0 : 0), earlier: "521000:521" });
    await flush();
    assert.ok(first === 1 && r.calls.length <= 2, `burst ${growth}: ${r.calls.length} requests`);
    assert.deepEqual(r.expanded["100"].restoreTo, { line: "560", rel: 12 }, `burst ${growth}`);
  }
});

/** A reader in a far window of lines 71..150 (cut 151000:151, 40-line steps ahead), under G2. */
async function inWindow() {
  const r = readerOn({ from: 100, to: 300, seenLine: "110" });
  r.stateFor(r.now); await flush();
  r.calls[0].answer(200, { thread_of: "100", generation: G2, voices: Array.from({ length: 80 }, (_, k) => vat(71 + k)), earlier: "71000:71" });
  await flush();
  return r;
}

test("READING ON: one request per click from a cut the reader already had; an overlap continues the window with nothing skipped or twice", async () => {
  const r = await inWindow();
  assert.deepEqual(r.expanded["100"].ahead, ["191000:191", "231000:231", "271000:271"]);
  r.showLater(r.now);
  assert.equal(r.calls.length, 2);
  assert.deepEqual(q(r, 1), { thread_of: "100", before: "191000:191", generation: G2, since: "5000", next: "open", limit: "80" });
  r.calls[1].answer(200, { thread_of: "100", generation: G2, voices: Array.from({ length: 80 }, (_, k) => vat(111 + k)), earlier: "111000:111" });   // 111..190: overlaps 111..150
  await flush();
  const s = r.expanded["100"];
  assert.deepEqual(s.lines.map((v) => v.act_id).slice(-3), ["188", "189", "190"], "the new lines continue the window");
  assert.equal(new Set(s.lines.map((v) => v.act_id)).size, s.lines.length, "each once");
  assert.deepEqual(s.lines.map((v) => Number(v.act_id)), Array.from({ length: 120 }, (_, k) => 71 + k), "71..190 in order, nothing skipped");
  assert.deepEqual(s.win, { cut: "191000:191" });
  assert.deepEqual(s.ahead, ["231000:231", "271000:271"]);
  r.showLater(r.now);
  assert.equal(q(r, 2).before, "231000:231", "the next click, the next saved cut: one request each, whatever the depth");
  assert.equal(r.calls.length, 3);
});

test("READING ON to the end: from the newest page's cursor, an overlap makes the window contiguous with the newest page again", async () => {
  const r = await inWindow();
  r.expanded["100"].ahead = [];                                       // the saved cuts are used up
  r.showLater(r.now);
  assert.deepEqual(q(r, 1), { thread_of: "100", before: "900000:900", generation: G2, since: "5000", next: "open", limit: "200" });
  r.calls[1].answer(200, { thread_of: "100", generation: G2, voices: Array.from({ length: 200 }, (_, k) => vat(121 + k)), earlier: "121000:121" });   // 121..320 overlaps 121..150
  await flush();
  const s = r.expanded["100"];
  assert.equal(s.win, null, "contiguous: no window label, the newest page follows");
  assert.deepEqual(r.mergedLines(r.now, s).map((v) => Number(v.act_id)).slice(-3), [320, 900, 901], "the tail of the answer, then the newest page");
  assert.equal(new Set(r.mergedLines(r.now, s).map((v) => v.act_id)).size, r.mergedLines(r.now, s).length);
});

test("READING ON without an overlap does not pretend: the gap is recorded, the tail is contiguous with the newest page, no later control is left", async () => {
  const r = await inWindow();
  r.expanded["100"].ahead = [];
  r.showLater(r.now);
  r.calls[1].answer(200, { thread_of: "100", generation: G2, voices: Array.from({ length: 200 }, (_, k) => vat(500 + k)), earlier: "500000:500" });   // nothing in common with 71..150
  await flush();
  const s = r.expanded["100"];
  assert.equal(s.lines.length, 200);
  assert.deepEqual(s.gaps, ["150"], "the last line that was on screen before the replacement");
  assert.equal(s.win, null, "an answer from the newest page's own cursor ends right before the newest page: contiguous with it, so nothing is left to read 'later'");
  assert.equal(s.earlier, "500000:500", "show earlier reads the omitted range, backward");
});

test("reading on: a click while one is in flight asks nothing more; a regenerated answer drops the window with the old sentence; a failure says so", async () => {
  const r = await inWindow();
  r.showLater(r.now); r.showLater(r.now);
  assert.equal(r.calls.length, 2, "one request");
  r.calls[1].answer(200, { regenerated: true, thread: thread({ generation: G3 }) });
  await flush();
  assert.equal("100" in r.expanded, false);
  assert.match(r.lineNotes["100"], /changed while you were reading/);
  const f = await inWindow();
  f.showLater(f.now);
  f.calls[1].answer(503, { error: "bounce" });
  await flush();
  assert.match(f.expanded["100"].error, /Couldn't read on just now/);
  assert.equal(f.expanded["100"].busy, false);
});

test("another poll while in a later window: re-anchored from the window's own lines, the saved cuts carried on, still one request", async () => {
  const r = await inWindow();
  r.showLater(r.now);
  r.calls[1].answer(200, { thread_of: "100", generation: G2, voices: Array.from({ length: 80 }, (_, k) => vat(111 + k)), earlier: "111000:111" });
  await flush();
  r.seen["100"] = { line: "170", rel: 7 };
  const again = r.stateFor(thread({ generation: G3, earlier: "990000:990", voices: [vat(990)], voice_count: 801 }));
  await flush();
  assert.ok(again.re.old.win);
  assert.equal(r.calls.length, 3, "one request for the change");
  assert.equal(q(r, 2).before, "191000:191", "line 170 is within 41 lines of the window's end: the window's own cut");
  r.calls[2].answer(200, { thread_of: "100", generation: G3, voices: Array.from({ length: 80 }, (_, k) => vat(111 + k)), earlier: "111000:111" });
  await flush();
  const s = r.expanded["100"];
  assert.deepEqual(s.restoreTo, { line: "170", rel: 7 });
  assert.deepEqual(s.ahead, ["231000:231", "271000:271"], "the saved cuts after the window are carried on");
});

test("reading on with ids past 2^53 in one millisecond: the cuts are the exact strings and each id appears once", async () => {
  const big = (k) => String(9007199254740993n + BigInt(k)), same = 7_000_000;
  const lines = Array.from({ length: 300 }, (_, k) => ({ act_id: big(k), said: "x" + k, at_ms: same }));
  const r = earlierRig();
  r.expanded["100"] = { generation: G1, lines, earlier: `${same}:${big(0)}`, busy: false, error: null, token: 1, win: null };
  r.seen["100"] = { line: big(20), rel: 5 };
  r.stateFor(thread({ generation: G2, earlier: "9000000:9000", voices: [vat(9000)] }));
  await flush();
  r.calls[0].answer(200, { thread_of: "100", generation: G2, voices: lines.slice(0, 61), earlier: null });
  await flush();
  const s = r.expanded["100"];
  assert.equal(s.ahead[0], `${same}:${big(101)}`, "the first cut for reading on, as the office sent it");
  r.showLater(thread({ generation: G2, earlier: "9000000:9000", epoch: { since: 5000, next: null } }));
  assert.equal(q(r, 1).before, `${same}:${big(101)}`);
  assert.equal(q(r, 1).before, "7000000:9007199254741094");
  r.calls[1].answer(200, { thread_of: "100", generation: G2, voices: lines.slice(21, 101), earlier: null });
  await flush();
  assert.equal(new Set(r.expanded["100"].lines.map((v) => v.act_id)).size, r.expanded["100"].lines.length);
  assert.equal(r.expanded["100"].lines.at(-1).act_id, big(100));
});

// ── v3: the saved cuts span the held range, and a gap stays until it is really closed ──

/** A simulated office for ONE public thread of n rows (the documented earlier request: the current generation, the `limit` rows strictly before a cut). */
function thread6000(n, generation) {
  const rows = Array.from({ length: n }, (_, i) => ({ act_id: String(4_000_000_000_000_000_000n + 7n * BigInt(i)), said: "s" + i, at_ms: 1_700_000_000_000 + i * 1000, i }));
  const cmp = (x, y) => (x.at_ms - y.at_ms) || (x.act_id.length - y.act_id.length) || (x.act_id < y.act_id ? -1 : x.act_id > y.act_id ? 1 : 0);
  const calls = [];
  const fetchStub = async (url) => {
    const p = Object.fromEntries(new URL("http://x" + url).searchParams);
    calls.push(p);
    if (p.generation !== generation.value) return { status: 200, json: async () => ({ regenerated: true, thread: { thread_of: p.thread_of, generation: generation.value, earlier: null, voices: [] } }) };
    const m = /^(\d+):(\d+)$/.exec(p.before); const cut = { at_ms: Number(m[1]), act_id: m[2] };
    let lo = 0, hi = n; while (lo < hi) { const mid = (lo + hi) >> 1; if (cmp(rows[mid], cut) < 0) lo = mid + 1; else hi = mid; }
    const from = Math.max(0, lo - Number(p.limit));
    return { status: 200, json: async () => ({ thread_of: p.thread_of, generation: generation.value, voices: rows.slice(from, lo).map(({ i, ...v }) => v), earlier: from > 0 ? `${rows[from].at_ms}:${rows[from].act_id}` : null }) };
  };
  const cursorAt = (i) => `${rows[i].at_ms}:${rows[i].act_id}`;
  return { rows, calls, fetchStub, cursorAt, voicesOf: (a, b) => rows.slice(a, b).map(({ i, ...v }) => v) };
}
/** The page's own script over that office; the reader held rows heldFrom..oldTotal-81 (contiguous with the newest page) under G1, on row `wantIdx`; the thread is now `n` rows under G2. */
function pageOver(n, wantIdx, oldTotal, heldFrom = Math.max(0, wantIdx - 10)) {
  const gen = { value: G2 };
  const off = thread6000(n, gen);
  const log = { redraw: 0, tick: 0 };
  const make = new Function("API", "fetch", "redraw", "tick", `${earlierSrc}\nreturn { expanded, seen, lineNotes, gotoNewest, stateFor, showLater, showEarlier, backToNewest, mergedLines };`);
  const page = make("/api/world/conversations", off.fetchStub, () => { log.redraw += 1; }, () => { log.tick += 1; });
  const key = off.rows[0].act_id;
  page.expanded[key] = { generation: G1, lines: off.voicesOf(heldFrom, oldTotal - 80), earlier: null, busy: false, error: null, token: 1, win: null, base: { count: oldTotal, newest: 80 } };
  page.seen[key] = { line: off.rows[wantIdx].act_id, rel: 0 };
  const t = { thread_of: key, generation: G2, epoch: { since: 5000, next: null }, earlier: off.cursorAt(n - 80), voices: off.voicesOf(n - 80, n), voice_count: n + 1, live: true };
  return { page, off, key, t, log, gen };
}
const idxs = (off, lines) => lines.map((v) => off.rows.findIndex((r) => r.act_id === v.act_id));
const contiguous = (a) => a.every((x, k) => k === 0 || x === a[k - 1] + 1);

test("v3: a reader who held 5,820 rows after the line (more than 100 cuts) reads on to the newest page without an omitted id", async () => {
  const { page, off, key, t } = pageOver(6000, 100, 6000);
  page.stateFor(t); await flush(); await flush();
  assert.ok(page.expanded[key].ahead.length > 100, `${page.expanded[key].ahead.length} saved cuts: one per 40 held rows, no 100 cap`);
  assert.equal(new Set(page.expanded[key].ahead).size, page.expanded[key].ahead.length, "each once");
  let clicks = 0;
  for (; clicks < 200; clicks++) {                                     // a fixed maximum, not a loop until green
    const s = page.expanded[key];
    if (!s || !s.win) break;
    const before = off.calls.length;
    page.showLater(t); await flush();
    assert.equal(off.calls.length - before, 1, "one request per click");
  }
  const s = page.expanded[key];
  assert.ok(clicks > 100 && clicks < 200, `${clicks} clicks`);
  assert.equal(s.win, null, "joined to the newest page");
  assert.deepEqual(s.gaps || [], [], "no gap: nothing was skipped");
  const merged = idxs(off, page.mergedLines(t, s));
  assert.ok(contiguous(merged), "the lines on screen are consecutive rows");
  assert.equal(merged.at(-1), 5999);
  assert.ok(merged[0] <= 100 + 41, "from the reader's line on");
});

test("v3 control below the old bound: 3,420 rows held after the line reaches the newest page contiguously", async () => {
  const { page, off, key, t } = pageOver(6000, 2500, 6000);
  page.stateFor(t); await flush(); await flush();
  for (let c = 0; c < 200 && page.expanded[key]?.win; c++) { page.showLater(t); await flush(); }
  const s = page.expanded[key];
  assert.equal(s.win, null); assert.deepEqual(s.gaps || [], []);
  assert.ok(contiguous(idxs(off, page.mergedLines(t, s))));
});

test("v3 never-held growth: the gap is recorded at the first answer that cannot overlap and is NOT hidden by the next click, a poll, a delayed answer or time", async () => {
  // the reader held 100 lines after the line; the thread grew by 6,000 voices while they were away
  const { page, off, key, t, gen } = pageOver(6280, 100, 280);
  page.stateFor(t); await flush(); await flush();
  let clicks = 0;
  for (; clicks < 200; clicks++) { const s = page.expanded[key]; if (!s || !s.win) break; page.showLater(t); await flush(); }
  let s = page.expanded[key];
  assert.ok(clicks <= 3, `${clicks} clicks: the few known cuts, then the newest cursor`);
  assert.equal(s.win, null);
  assert.equal(s.gaps.length, 1, "the gap is recorded");
  const lastOnScreen = s.gaps[0];
  const tail = idxs(off, s.lines);
  assert.ok(contiguous(tail) && tail.at(-1) === 6199, "the tail is the 200 rows right before the newest page");
  // the NEXT click: there is no later control and a call changes nothing
  const callsBefore = off.calls.length;
  page.showLater(t); await flush();
  assert.equal(off.calls.length, callsBefore, "no repeated useless request");
  assert.equal(page.expanded[key].gaps.length, 1, "the gap is still recorded");
  // a poll: the thread grows by a voice (a new generation) and the reader is on a tail line: the gap is carried on
  gen.value = "c".repeat(32);
  page.seen[key] = { line: s.lines[100].act_id, rel: 4 };
  const t2 = { ...t, generation: gen.value, voice_count: t.voice_count + 1 };
  page.stateFor(t2); await flush(); await flush();
  s = page.expanded[key];
  assert.ok(s && s.gaps && s.gaps.length === 1, "carried through the re-anchor");
  // reading backward from the tail: the gap closes only when the last line that was on screen is reached
  let guard = 0;
  while (page.expanded[key].gaps.length && guard++ < 100) { page.showEarlier(t2); await flush(); }
  s = page.expanded[key];
  assert.ok(guard < 100 && guard > 3, `${guard} backward clicks`);
  assert.deepEqual(s.gaps, [], "closed by actual coverage");
  assert.ok(idxs(off, s.lines).includes(off.rows.findIndex((r) => r.act_id === lastOnScreen)));
});

test("v3: back to the newest statements clears a gap on purpose; a refused or missing source keeps the neutral reset", async () => {
  const { page, off, key, t } = pageOver(6280, 100, 280);
  page.stateFor(t); await flush(); await flush();
  for (let c = 0; c < 200 && page.expanded[key]?.win; c++) { page.showLater(t); await flush(); }
  assert.equal(page.expanded[key].gaps.length, 1);
  page.backToNewest(t);
  assert.equal(key in page.expanded, false);
  assert.equal(page.gotoNewest[key], true);
});

test("v3: the saved cuts are rebuilt from the lines on screen at each change: repeated polls do not accumulate them", async () => {
  const { page, off, key, t, gen } = pageOver(3000, 100, 3000);
  page.stateFor(t); await flush(); await flush();
  const first = page.expanded[key].ahead.length;
  let tt = t;
  for (let k = 0; k < 5; k++) {
    gen.value = "0123456789abcdef"[k + 1].repeat(32);                   // a new generation every time
    tt = { ...tt, generation: gen.value, voice_count: tt.voice_count + 1 };
    const s = page.expanded[key];
    page.seen[key] = { line: s.lines[10].act_id, rel: 0 };
    page.stateFor(tt); await flush(); await flush();
  }
  assert.ok(page.expanded[key].ahead.length <= first, `${page.expanded[key].ahead.length} <= ${first}`);
  assert.equal(new Set(page.expanded[key].ahead).size, page.expanded[key].ahead.length);
});

test("v3: a delayed answer to a show-later request made under a generation the page has left adds no gap and no line", async () => {
  const r = await inWindow();
  r.expanded["100"].ahead = [];
  r.showLater(r.now);                                                   // from the newest cursor, still in flight
  assert.equal(r.calls.length, 2);
  r.seen["100"] = { line: "120", rel: 2 };
  const again = r.stateFor(thread({ generation: G3, earlier: "990000:990", voices: [vat(990)] }));   // the poll moved the thread on
  await flush();
  assert.ok(again.re);
  r.calls[1].answer(200, { thread_of: "100", generation: G2, voices: Array.from({ length: 200 }, (_, k) => vat(500 + k)), earlier: "500000:500" });   // the OLD answer: no overlap
  await flush();
  assert.deepEqual(r.expanded["100"].gaps, [], "the old answer was thrown away unread: no gap recorded from it");
  assert.deepEqual(r.expanded["100"].lines, [], "and none of its lines painted");
});
