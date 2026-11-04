// conversations-poll-merge.test.mjs — the conversations page's MORE-THREADS observer, MERGED-THREAD keys, POLL ordering, and the cockpit's
// held voices (POS-779, whole-carrier review B1-B4).
//
// The rules live in the page's own inline script and in the cockpit mount, so this suite reads them out of the files (the way
// conversations-show-earlier.test.mjs does) and runs THAT text, with a fetch, an IntersectionObserver and a DOM it controls. Every
// control is PAIRED: the failing shape and the one that must keep working. Invented data only. It is a unit test of the state
// machines; the page in a real browser is a separate proof and nothing here claims to be it.
//
//   node --test test/conversations-poll-merge.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { recentVoices } from "../src/lib/world-cockpit.mjs";
import { voiceEntries } from "../src/lib/world-feed.mjs";

const page = readFileSync(new URL("../town/pages/conversations/index.astro", import.meta.url), "utf8");
const mount = readFileSync(new URL("../src/lib/world-cockpit-mount.mjs", import.meta.url), "utf8");
const cutOf = (text, from, to) => {
  const a = text.indexOf(from), b = text.indexOf(to, a);
  assert.ok(a > -1 && b > a, `the source still carries ${from} … ${to}`);
  return text.slice(a, b);
};
const cut = (from, to) => cutOf(page, from, to);
const flush = () => new Promise((r) => setImmediate(r));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ═════════════════════════════════════════════════════════════════════════════
// B2 — the "more conversations" observer against an office that keeps answering 503
// ═════════════════════════════════════════════════════════════════════════════
// The page's own paint + more-threads text, a spec-shaped IntersectionObserver (an initial entry when a target is observed, intersecting
// only while the target is attached) and a DOM stub that records buttons and their click handlers. The review's own reproduction
// (a persistent 503) made 444 requests in 500 ms; the control that answers 200 with the end of the list made 1.

const moreBlock = cut("var CHUNK = 8;", "// Pinned notices");

function dom() {
  const el = (tag, cls, text) => {
    const n = { tag, cls, text: text ?? "", attached: false, children: [], type: "", disabled: false, handlers: {}, setAttribute() {}, classList: { add() {} },
      addEventListener(ev, fn) { this.handlers[ev] = fn; },
      appendChild(c) { this.children.push(c); c.attached = true; return c; } };
    Object.defineProperty(n, "textContent", { get() { return this.text; }, set(v) { this.text = v; for (const c of this.children) c.attached = false; this.children = []; } });
    return n;
  };
  const box = () => { const b = el("div", "box"); b.attached = true; return b; };
  return { el, box };
}

function moreRig(answer) {
  const { el, box } = dom();
  const log = { fetches: [], observed: 0, ticks: 0 };
  class IO {
    constructor(cb) { this.cb = cb; }
    observe(t) { log.observed += 1; setTimeout(() => this.cb([{ target: t, isIntersecting: !!t.attached }]), 0); }
    unobserve() {}
  }
  const fetchStub = (url) => {
    const i = log.fetches.length;
    log.fetches.push(String(url));
    if (i >= 40) return new Promise(() => {}); // a storm is stopped here so that it FAILS the count below instead of hanging the run
    const { status, body } = answer(i, String(url));
    return Promise.resolve({ status, json: () => Promise.resolve(body) });
  };
  const liveBox = box(), closedBox = box();
  const make = new Function("IntersectionObserver", "fetch", "API", "el", "snapshotScroll", "restoreScroll", "threadNode", "liveBox", "closedBox", "tick",
    "expanded", "seen", "lineNotes", "gotoNewest", "CHANGED_WORDS",
    `${moreBlock}\nreturn { pageNext, extra, redraw, setPage: function (l, c) { lastLive = l; lastClosedPage = c; } };`);
  const rig = make(IO, fetchStub, "/api/world/conversations", el, () => null, () => {}, (t) => el("div", "thread", t.id), liveBox, closedBox, () => { log.ticks += 1; },
    {}, {}, {}, {}, "changed");
  // a page as the office sends it: eight closed threads shown and a closed cursor saying there are more
  rig.setPage([], Array.from({ length: 8 }, (_, i) => ({ id: "t" + i })));
  rig.pageNext.closed = "1730000000000:100:0123456789abcdef";
  const button = () => closedBox.children.filter((c) => c.cls === "c-more").at(-1);
  const lines = () => closedBox.children.map((c) => `${c.cls}:${c.text}`);
  return { ...rig, log, closedBox, button, lines, go: () => rig.redraw() };
}

const OK_END = () => ({ status: 200, body: { threads: [], next_threads: null } });
const DOWN = () => ({ status: 503, body: { error: "bounce", defect: "the conversations cannot be read just now" } });

test("B2 · a persistent 503 is asked for ONCE by the scroll, says so on the button, and is not asked again by repainting", async () => {
  const r = moreRig(DOWN);
  r.go();
  await sleep(500);
  assert.equal(r.log.fetches.length, 1, `one request for 500 ms of 503s, not a storm (${r.log.fetches.length})`);
  assert.ok(r.log.observed <= 4, `and the page did not keep building and observing buttons (${r.log.observed})`);
  assert.match(r.extra.closed.error, /Couldn't load more conversations/);
  assert.ok(r.lines().some((l) => /is-error:/.test(l) || /Couldn't load more/.test(l)), "the failure is on the page, beside the button");
  assert.equal(r.button().disabled, false, "the control is there to try again");
});

test("B2 · the reader's click is the retry: one more request per click, still no storm, and a recovery appends the threads and clears the error", async () => {
  let up = false, pages = 0;
  const r = moreRig(() => (up ? (pages++ === 0 ? { status: 200, body: { threads: [{ id: "n1" }, { id: "n2" }], next_threads: null } } : OK_END()) : DOWN()));
  r.go();
  await sleep(200);
  assert.equal(r.log.fetches.length, 1);
  r.button().handlers.click();
  await sleep(300);
  assert.equal(r.log.fetches.length, 2, "one click, one request, and the 503 it got did not start a loop");
  up = true;
  r.button().handlers.click();
  await sleep(300);
  assert.equal(r.log.fetches.length, 3, "the recovery is one request");
  assert.equal(r.extra.closed.error, null, "the error is gone");
  assert.deepEqual(r.extra.closed.threads.map((t) => t.id), ["n1", "n2"], "the threads that came are held");
  assert.equal(r.extra.closed.next, null, "and the list is at its end");
  assert.equal(r.log.fetches.length, 3, "nothing more is asked of a list that has ended");
});

test("B2 control · the same page against an office that answers 200 with the end of the list asks exactly once", async () => {
  const r = moreRig(OK_END);
  r.go();
  await sleep(300);
  assert.equal(r.log.fetches.length, 1);
  assert.equal(r.extra.closed.next, null);
  assert.equal(r.extra.closed.error, null);
});

test("B2 control · successful paging goes on by the scroll: each page asks for the next from the cursor it was given, once each, to the end", async () => {
  const cursors = ["1730000000000:90:aaaaaaaaaaaaaaaa", "1730000000000:80:bbbbbbbbbbbbbbbb", null];
  const r = moreRig((i) => ({ status: 200, body: { threads: [{ id: "p" + i }], next_threads: cursors[i] } }));
  r.go();
  await sleep(500);
  assert.equal(r.log.fetches.length, 3, "three pages, three requests");
  const asked = r.log.fetches.map((u) => new URL("http://x" + u).searchParams.get("next_threads"));
  assert.deepEqual(asked, ["1730000000000:100:0123456789abcdef", cursors[0], cursors[1]], "each from the cursor before it");
  assert.deepEqual(r.extra.closed.threads.map((t) => t.id), ["p0", "p1", "p2"], "every thread once, in order");
});

test("B2 control · a 503 after good pages keeps what was loaded, shows the failure, and stops asking", async () => {
  const r = moreRig((i) => (i === 0 ? { status: 200, body: { threads: [{ id: "g0" }], next_threads: "1730000000000:90:aaaaaaaaaaaaaaaa" } } : DOWN()));
  r.go();
  await sleep(400);
  assert.equal(r.log.fetches.length, 2, "the good page, then one refusal");
  assert.deepEqual(r.extra.closed.threads.map((t) => t.id), ["g0"], "the good page is kept");
  assert.match(r.extra.closed.error, /Couldn't load more/);
});

// ═════════════════════════════════════════════════════════════════════════════
// B3 — a merge changes the key a held page is filed under
// ═════════════════════════════════════════════════════════════════════════════
const earlierSrc = cut("var expanded = {};", "function threadNode(t)");
const carrySrc = cut("var tips = {};", "var LIVE_EMPTY");

function mergeRig() {
  const calls = [];
  const fetchStub = (url) => new Promise((ok) => calls.push({ url, answer: (status, body) => ok({ status, json: () => Promise.resolve(body) }) }));
  const log = { redraw: 0, tick: 0 };
  const make = new Function("API", "fetch", "redraw", "tick",
    `${earlierSrc}\n${carrySrc}\nreturn { expanded, lineNotes, seen, gotoNewest, stateFor, noteTips, carryMerged, CHANGED_WORDS };`);
  const rig = make("/api/world/conversations", fetchStub, () => { log.redraw += 1; }, () => { log.tick += 1; });
  return { ...rig, calls, log };
}
const v = (id) => ({ act_id: String(id), said: `t${id}`, at_ms: Number(id) * 1000 });
const th = (over = {}) => ({ thread_of: "100", generation: "a".repeat(32), epoch: { since: 5000, next: null }, earlier: "9000:150", voice_count: 8,
  voices: [v(150), v(151), v(152)], ...over });
const held = (generation, lines) => ({ generation, lines, earlier: "1:1", busy: false, error: null, token: 1, win: null, ahead: [], base: { count: 8, newest: 3 }, gaps: [] });

test("B3 · two threads of one settlement merge: the page held under the LATER thread's key is carried to the merged thread's key and re-read, not dropped", async () => {
  const r = mergeRig();
  const A = th({ thread_of: "100", voices: [v(150), v(151)] });
  const B = th({ thread_of: "200", generation: "b".repeat(32), voices: [v(260), v(261)] });
  r.noteTips([A, B]);                       // the last paint: both threads, their newest lines
  r.expanded["200"] = held("b".repeat(32), [v(240), v(250), v(255)]);
  r.seen["200"] = { line: "250", rel: 12 };
  // the poll: ONE thread, named by its earliest act, carrying B's newest lines
  const N = th({ thread_of: "100", generation: "n".repeat(32), voice_count: 20, earlier: "9000:150", voices: [v(260), v(261), v(262)] });
  r.carryMerged([N]);
  assert.equal("200" in r.expanded, false, "nothing is left under a key no thread names");
  assert.equal(r.expanded["100"].generation, "b".repeat(32), "the held page is filed under the merged thread, still as the generation it was read under");
  assert.deepEqual(r.seen["100"], { line: "250", rel: 12 }, "and so is the reader's place");
  const shown = r.stateFor(N);
  await flush();
  assert.equal(r.calls.length, 1, "the thread changed generation: the reader's line is read again, one request");
  const u = new URL("http://x" + r.calls[0].url);
  assert.equal(u.searchParams.get("thread_of"), "100");
  assert.equal(u.searchParams.get("generation"), "n".repeat(32), "under the CURRENT generation, never the held one");
  assert.equal(u.searchParams.get("since"), "5000");
  assert.ok(shown === null || shown.busy, "no old line is shown while it is read again");
});

test("B3 control · the same merge WITHOUT the carry loses the held page without a word (what the review saw)", async () => {
  const r = mergeRig();
  r.noteTips([th({ thread_of: "100", voices: [v(150)] }), th({ thread_of: "200", generation: "b".repeat(32), voices: [v(260)] })]);
  r.expanded["200"] = held("b".repeat(32), [v(240), v(250)]);
  r.seen["200"] = { line: "250", rel: 12 };
  const N = th({ thread_of: "100", generation: "n".repeat(32), voices: [v(260), v(262)] });
  assert.equal(r.stateFor(N), null);
  await flush();
  assert.equal(r.calls.length, 0, "no request: the held page was never looked for");
  assert.equal(Object.keys(r.lineNotes).length, 0, "and no sentence says it went");
});

test("B3 · a thread that keeps its key is untouched; a held page of a thread nothing shows any more is not moved", () => {
  const r = mergeRig();
  const A = th({ thread_of: "100", voices: [v(150), v(151)] });
  r.noteTips([A]);
  r.expanded["100"] = held("a".repeat(32), [v(140)]);
  r.carryMerged([th({ thread_of: "100", voices: [v(150), v(151), v(152)] })]);
  assert.ok(r.expanded["100"], "named by a thread still: left where it is");
  const lone = mergeRig();
  lone.noteTips([th({ thread_of: "300", voices: [v(300)] })]);
  lone.expanded["300"] = held("a".repeat(32), [v(290)]);
  lone.carryMerged([th({ thread_of: "100", voices: [v(150)] })]);
  assert.ok(lone.expanded["300"], "no line of it shown anywhere: nothing says where it went, so it is left");
});

test("B3 · only within the SAME settlement: another settlement's thread that shows the same act id is not the same conversation", () => {
  const r = mergeRig();
  r.noteTips([th({ thread_of: "200", epoch: { since: 5000, next: 9000 }, voices: [v(260)] })]);
  r.expanded["200"] = held("b".repeat(32), [v(250)]);
  r.carryMerged([th({ thread_of: "100", epoch: { since: 9000, next: null }, voices: [v(260)] })]);
  assert.ok(r.expanded["200"], "left under its own key");
  assert.equal("100" in r.expanded, false, "and nothing is filed under the other settlement's thread");
});

test("B3 · both threads had a held page: the merged thread keeps its OWN, the other is dropped WITH the sentence; a busy page is never moved", () => {
  const both = mergeRig();
  both.noteTips([th({ thread_of: "100", voices: [v(150)] }), th({ thread_of: "200", voices: [v(260)] })]);
  both.expanded["100"] = held("a".repeat(32), [v(140)]);
  both.expanded["200"] = held("b".repeat(32), [v(250)]);
  both.carryMerged([th({ thread_of: "100", generation: "n".repeat(32), voices: [v(150), v(260)] })]);
  assert.equal(both.expanded["100"].generation, "a".repeat(32), "its own page, not the other's");
  assert.equal("200" in both.expanded, false);
  assert.equal(both.lineNotes["100"], both.CHANGED_WORDS, "and the card says it changed");
  const busy = mergeRig();
  busy.noteTips([th({ thread_of: "100", voices: [v(150)] }), th({ thread_of: "200", voices: [v(260)] })]);
  busy.expanded["200"] = { ...held("b".repeat(32), [v(250)]), busy: true };
  busy.carryMerged([th({ thread_of: "100", generation: "n".repeat(32), voices: [v(150), v(260)] })]);
  assert.equal("100" in busy.expanded, false, "an answer in flight belongs to the key it was asked under: not moved");
  assert.equal("200" in busy.expanded, false);
  assert.equal(busy.lineNotes["100"], busy.CHANGED_WORDS);
});

// ═════════════════════════════════════════════════════════════════════════════
// B4 — polls overlap and answer out of order
// ═════════════════════════════════════════════════════════════════════════════
const tickSrc = cut("var tickSeq = 0, shownSeq = 0;", "// The faces arrive on their own schedule");

function tickRig() {
  const calls = [];
  const fetchStub = () => new Promise((ok) => calls.push((status, body) => ok({ ok: status < 400, status, json: () => Promise.resolve(body) })));
  const log = { notes: [], painted: [], redraws: 0 };
  const make = new Function("API", "fetch", "setNote", "paint", "paintPinned", "sectionThreads", "carryMerged", "reachForHash", "redraw", "anchorFromHash", "liveBox", "dials", "POLL_MS",
    `var pageNext = null, lastLive = [], lastClosedPage = [], lastClosed = [], painted = false, anchored = false, pinNext = false, anchorKey = null;\n${tickSrc}\nreturn { tick, view: function () { return { lastLive: lastLive, painted: painted, pageNext: pageNext }; } };`);
  const rig = make("/api/world/conversations", fetchStub, (w) => log.notes.push(w), () => log.painted.push(1), () => {}, (_s, p) => p, () => {}, () => {},
    () => { log.redraws += 1; }, () => {}, {}, null, 7000);
  return { ...rig, calls, log };
}
const body = (gen, ...ids) => ({ live: [{ thread_of: "100", generation: gen, voices: ids.map(v) }], closed: [], next_threads: { live: null, closed: null }, earshot_m: 60 });

test("B4 · an older poll that answers AFTER a newer one is thrown away: the page stays on the newer generation", async () => {
  const r = tickRig();
  r.tick(); r.tick();                            // two polls in flight
  r.calls[1](200, body("g2", 150, 151, 152));    // the newer answers first
  await flush();
  assert.equal(r.view().lastLive[0].generation, "g2");
  assert.equal(r.log.redraws, 1);
  r.calls[0](200, body("g1", 150, 151));         // the older answers late
  await flush();
  assert.equal(r.view().lastLive[0].generation, "g2", "the page did not go back to the older generation");
  assert.equal(r.log.redraws, 1, "and nothing was redrawn from it");
});

test("B4 control · answers in order are all shown, and a failure that is older than a shown answer is not said over it", async () => {
  const r = tickRig();
  r.tick(); r.tick();
  r.calls[0](200, body("g1", 150));
  await flush();
  r.calls[1](200, body("g2", 150, 151));
  await flush();
  assert.equal(r.view().lastLive[0].generation, "g2");
  assert.equal(r.log.redraws, 2, "both were shown, in order");
  const late = tickRig();
  late.tick(); late.tick();
  late.calls[1](200, body("g2", 150));
  await flush();
  late.calls[0](503, { error: "bounce" });       // the older one failed, after the newer one succeeded
  await flush();
  assert.equal(late.log.notes.filter((w) => /can't be read/.test(w)).length, 0, "no 'can't be read' over a record that was read");
  const down = tickRig();
  down.tick();
  down.calls[0](503, { error: "bounce" });
  await flush();
  assert.equal(down.log.notes.filter((w) => /can't be read/.test(w)).length, 1, "a failure with nothing newer to contradict it is still said");
});

// ═════════════════════════════════════════════════════════════════════════════
// B1 — the cockpit keeps its bubbles when the read fails, and clears them when the town is quiet
// ═════════════════════════════════════════════════════════════════════════════
const pullSrc = cutOf(mount, "async function pullVoices() {", "  if (o.readVoices) {\n    pullVoices();");

function pullRig(answer) {
  const log = { ingested: 0, spoke: 0 };
  const state = { voices: [{ handle: "wren", said: "held line", at: { x: 1, y: 2 }, ageMs: 1000, freshness: 0.9 }] };
  const make = new Function("o", "recentVoices", "voiceEntries", "ingest", "state", "speech", `${pullSrc}\nreturn pullVoices;`);
  const pull = make({ readVoices: answer }, recentVoices, voiceEntries, () => { log.ingested += 1; }, state, () => { log.spoke += 1; });
  return { pull, state, log };
}
const nowish = () => Date.now();
const fresh = (said) => ({ at_ms: nowish() - 1000, said, handle: "moss", x: 5, y: 6 });

test("B1 · a read that FAILED (refused or thrown) keeps the bubbles the map holds and redraws nothing", async () => {
  for (const [label, answer] of [
    ["unavailable answer", async () => ({ unavailable: true, read_status: { state: "unavailable", http: 503, partial: false } })],
    ["no answer", async () => null],
    ["a throw", async () => { throw new Error("boom"); }],
  ]) {
    const r = pullRig(answer);
    await r.pull();
    assert.equal(r.state.voices.length, 1, `${label}: the held bubble stays`);
    assert.equal(r.state.voices[0].said, "held line");
    assert.equal(r.log.spoke, 0, `${label}: nothing is redrawn`);
    assert.equal(r.log.ingested, 0, `${label}: nothing is fed to the rail`);
  }
});

test("B1 control · a read that SUCCEEDED and found nothing in the window is the quiet town: the bubbles clear", async () => {
  const r = pullRig(async () => ({ live: [], closed: [], fade_minutes: 5, read_status: { state: "ok", partial: false } }));
  await r.pull();
  assert.equal(r.state.voices.length, 0, "a valid empty read is not a failure");
  assert.equal(r.log.spoke, 1);
});

test("B1 control · a partial or legacy read that carries lines draws them; the status is carried, never read as a failure", async () => {
  for (const state of ["partial", "legacy"]) {
    const r = pullRig(async () => ({ live: [{ thread_of: "1", voices: [fresh("hello there")] }], fade_minutes: 5, read_status: { state, partial: state === "partial" } }));
    await r.pull();
    assert.deepEqual(r.state.voices.map((x) => x.said), ["hello there"], `${state}: its lines are drawn`);
    assert.equal(r.log.spoke, 1);
  }
});

test("B1 · the source of WorldCockpit still answers { unavailable: true, read_status } on a failed read and the body plus read_status otherwise", () => {
  const astro = readFileSync(new URL("../src/components/WorldCockpit.astro", import.meta.url), "utf8");
  assert.match(astro, /return body \? \{ \.\.\.body, read_status: status \} : \{ unavailable: true, read_status: status \};/);
});
