// conversations-poll.test.mjs — CORE-158: the Conversations page asks the office ONE AT A TIME and backs off while it does not answer.
//
// The rules are in the page's own inline script (town/pages/conversations/index.astro): `makePoller` (between POLL-SCHEDULER:BEGIN/END) and the main list's
// ask (POLL-ASK:BEGIN/END). This suite reads those blocks out of the page, the way conversations-show-earlier.test.mjs reads its SHOW-EARLIER block, and runs
// THAT text: the scheduler against a fake clock and held promises (real timing, not constants), the ask against a held fetch and the page's own words.
// Nothing here claims to be the page in a real browser; that is the picture in the PR. No browser, no network, one process.
//
//   node --test test/conversations-poll.test.mjs
//
// FALSIFIERS (each test below fails on the old setInterval page, or on a build that drops its half): a tick that fires while one is in flight; an ask
// that is never released after a rejection, a non-OK answer or a throw; a wait that does not grow, does not cap, or does not return to 7000 after a
// success; a failure that settles in a hidden tab and starts the poll again; a tab that comes back with a burst; a notice that says the town is
// quiet instead of that the page is waiting to retry; or POLL_MS / its sentence changed.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const PAGE = process.env.CORE158_PAGE ? new URL(process.env.CORE158_PAGE, "file:///").pathname : new URL("../town/pages/conversations/index.astro", import.meta.url);
const page = readFileSync(PAGE, "utf8");
const between = (a, b) => { const i = page.indexOf(a), j = page.indexOf(b); assert.ok(i > -1 && j > i, `the page still carries ${a} … ${b}`); return page.slice(i + a.length, j); };
const schedulerSrc = between("// POLL-SCHEDULER:BEGIN", "// POLL-SCHEDULER:END");
const askSrc = between("// POLL-ASK:BEGIN", "// POLL-ASK:END");
const { makePoller, POLL_BACKOFF_MS } = new Function(`${schedulerSrc}\nreturn { makePoller: makePoller, POLL_BACKOFF_MS: POLL_BACKOFF_MS };`)();

const PACE = 7000;

/** A clock whose timers fire only when the test says so, and a poller over it whose asks are PROMISES THE TEST HOLDS. */
function rig({ hidden = false } = {}) {
  const clock = { t: 0, timers: [], next: 1 };
  const env = { hidden };
  const asks = [];                                   // every ask the poller made: { settle(ok), reject(), at }
  const poller = makePoller({
    pace: PACE, steps: POLL_BACKOFF_MS,
    run: () => new Promise((ok, no) => asks.push({ at: clock.t, settle: ok, reject: no })),
    hidden: () => env.hidden, now: () => clock.t,
    setT: (fn, ms) => { const id = clock.next++; clock.timers.push({ id, at: clock.t + ms, fn }); return id; },
    clearT: (id) => { clock.timers = clock.timers.filter((x) => x.id !== id); },
  });
  const advance = (ms) => {
    const end = clock.t + ms;
    for (;;) {
      const due = clock.timers.filter((x) => x.at <= end).sort((a, b) => a.at - b.at)[0];
      if (!due) break;
      clock.timers = clock.timers.filter((x) => x !== due);
      clock.t = due.at; due.fn();
    }
    clock.t = end;
  };
  const flush = () => new Promise((r) => setImmediate(r));
  return { clock, env, asks, poller, advance, flush };
}

test("the page keeps its pace and its sentence: POLL_MS is 7000 and the page still says it refreshes every N seconds from it", () => {
  assert.match(page, /var POLL_MS = 7000;/);
  assert.match(page, /This page refreshes every " \+ \(POLL_MS \/ 1000\) \+ " seconds\./);
  assert.deepEqual([...POLL_BACKOFF_MS], [15000, 30000, 60000], "the back-off steps are the issue's 15 → 30 → 60");
  assert.equal(/setInterval\(tick/.test(page), false, "no fixed-interval poll is left: the next ask is armed from the settlement");
});

test("a tick is SKIPPED while one is in flight: nothing asks the office twice, however many ways into tick there are", async () => {
  const r = rig();
  assert.equal(r.poller.tick(), true);
  for (let i = 0; i < 5; i++) assert.equal(r.poller.tick(), false, "a second, third … tick while the first is held does nothing");
  r.advance(60_000);                                   // time passing is not a reason to ask either: the timer is not armed while an ask is out
  assert.equal(r.asks.length, 1, "ONE request in flight, however many ticks and however long");
  assert.equal(r.poller.state().inFlight, true);
  r.asks[0].settle(true); await r.flush();
  assert.equal(r.poller.state().inFlight, false, "released on settlement");
  assert.equal(r.poller.tick(), true, "and the next tick is allowed");
  assert.equal(r.asks.length, 2);
});

test("the guard is released on EVERY way an ask can end: answered, answered false, rejected (an abort or a timeout), a throw before a promise", async () => {
  const outcomes = [["true", (a) => a.settle(true)], ["false", (a) => a.settle(false)], ["rejection", (a) => a.reject(new Error("aborted"))]];
  for (const [name, end] of outcomes) {
    const r = rig();
    r.poller.tick(); end(r.asks[0]); await r.flush();
    assert.equal(r.poller.state().inFlight, false, `released after ${name}`);
    assert.equal(r.poller.tick(), true, `ticks again after ${name}`);
  }
  let calls = 0;
  const thrower = makePoller({ pace: PACE, steps: POLL_BACKOFF_MS, run: () => { calls++; throw new Error("sync"); }, hidden: () => false, now: () => 0, setT: () => 1, clearT: () => {} });
  assert.equal(thrower.tick(), true);
  assert.equal(thrower.state().inFlight, false, "a throw is a failure and releases the guard");
  assert.equal(thrower.state().fails, 1);
  assert.equal(thrower.tick(), true);
  assert.equal(calls, 2);
});

test("the next ask is armed from the SETTLEMENT at the pace: 7000 ms after an answer, measured on the clock, not before", async () => {
  const r = rig();
  r.poller.tick(); r.advance(20_000);                  // the ask is held 20 s: the pace does not run meanwhile
  assert.equal(r.asks.length, 1);
  r.asks[0].settle(true); await r.flush();
  r.advance(PACE - 1);
  assert.equal(r.asks.length, 1, "6999 ms after the settlement: no ask");
  r.advance(1);
  assert.equal(r.asks.length, 2, "7000 ms after the settlement: the next ask");
});

test("BACK-OFF: each consecutive failure waits longer (15 → 30 → 60 s), is capped at the last step, and one success returns to 7000", async () => {
  const r = rig();
  r.poller.tick();
  const waits = [];
  for (let i = 0; i < 5; i++) {
    const n = r.asks.length;
    r.asks[n - 1].settle(false); await r.flush();
    const t0 = r.clock.t;
    const expected = [15000, 30000, 60000, 60000, 60000][i];
    r.advance(expected - 1);
    assert.equal(r.asks.length, n, `failure ${i + 1}: no ask 1 ms before ${expected}`);
    r.advance(1);
    assert.equal(r.asks.length, n + 1, `failure ${i + 1}: the ask comes at ${expected}`);
    waits.push(r.clock.t - t0);
  }
  assert.deepEqual(waits, [15000, 30000, 60000, 60000, 60000], "the waits actually waited");
  // a success returns to the normal pace, and the next failure starts the ladder again at the first step
  r.asks[r.asks.length - 1].settle(true); await r.flush();
  const n = r.asks.length;
  r.advance(PACE - 1); assert.equal(r.asks.length, n); r.advance(1); assert.equal(r.asks.length, n + 1, "back at 7000 after a success");
  r.asks[r.asks.length - 1].settle(false); await r.flush();
  assert.equal(r.poller.state().wait, 15000, "the ladder starts again at the first step");
});

test("a rejected ask (an abort, a timeout) backs off like any failure", async () => {
  const r = rig();
  r.poller.tick(); r.asks[0].reject(new Error("timeout")); await r.flush();
  assert.equal(r.poller.state().fails, 1);
  assert.equal(r.poller.state().wait, 15000);
});

test("a visitor-driven tick (a say, a hash change, the back link) during a back-off asks at once if nothing is in flight, and its outcome counts", async () => {
  const r = rig();
  r.poller.tick(); r.asks[0].settle(false); await r.flush();   // backed off: 15 s armed
  assert.equal(r.poller.tick(), true, "the visitor's own act is not made to wait");
  assert.equal(r.asks.length, 2);
  assert.equal(r.poller.state().armed, false, "the armed timer is replaced, not doubled");
  r.asks[1].settle(false); await r.flush();
  assert.equal(r.poller.state().wait, 30000, "and its failure is the second");
  r.advance(29_999); assert.equal(r.asks.length, 2); r.advance(1); assert.equal(r.asks.length, 3);
});

test("THE FACES LANDING is an AUTOMATIC ask: after a failed read the page's own faces-ready callback makes no ask before the owed retry, leaves that retry armed and due, and the next ask comes at its due time", async () => {
  const facesSrc = between("// POLL-FACES:BEGIN", "// POLL-FACES:END");
  const calls = [];
  const wire = (r) => new Function("poller", "tick", "refreshReaders", "liveBox", "closedBox", `var faces = null;\n${facesSrc}\nreturn { facesReady: facesReady, faces: function () { return faces; } };`)(
    r.poller, () => r.poller.tick(), (box, redraw) => calls.push([box, redraw]), "live", "closed");
  const meta = { residents: { pica: { name: "Pica" } } };

  // the list's read failed; the faces arrive 5 s later (the real callback, not a bare tick)
  const r = rig(); const page = wire(r);
  r.poller.tick(); r.asks[0].settle(false); await r.flush();          // backed off: the retry is owed at 15000
  r.advance(5000);
  page.facesReady(meta);
  assert.equal(r.asks.length, 1, "the faces landing made no main-list ask before the owed retry");
  assert.equal(r.poller.state().armed, true, "the armed retry is intact");
  assert.equal(r.poller.state().fails, 1, "and the ladder did not move");
  assert.deepEqual(page.faces(), meta.residents, "the faces are still taken");
  assert.deepEqual(calls, [["live", true], ["closed", true]], "and the open readers are still asked to redraw with them");
  r.advance(9999); assert.equal(r.asks.length, 1, "nothing at 14999");
  r.advance(1); assert.equal(r.asks.length, 2, "the next automatic ask comes at its due time, 15000 after the failure");

  // normal pace: the faces landing repaints with an ask, as it always did; an ask already out is not doubled
  const n = rig(); const pn = wire(n);
  pn.facesReady(meta);
  assert.equal(n.asks.length, 1, "no failure owed: the faces landing asks (the repaint)");
  pn.facesReady(meta);
  assert.equal(n.asks.length, 1, "and not twice while that ask is out");
  n.asks[0].settle(true); await n.flush(); n.advance(PACE);
  assert.equal(n.asks.length, 2, "the 7000 ms pace is unchanged");
  // a success after a backed-off stretch is back to normal, so the faces landing asks again
  const b = rig(); const pb = wire(b);
  b.poller.tick(); b.asks[0].settle(false); await b.flush(); b.advance(15000); b.asks[1].settle(true); await b.flush();
  pb.facesReady(meta);
  assert.equal(b.asks.length, 3, "after a success the ladder is cleared and the faces landing may ask");
  // no residents in the answer: nothing happens
  const z = rig(); const pz = wire(z); pz.facesReady(null); pz.facesReady({});
  assert.equal(z.asks.length, 0);
});

test("HIDDEN TAB: nothing is armed; a failure that settles while hidden does not start the poll again; coming back is ONE ask (or what is left of a back-off), never a burst", async () => {
  // a failure settles while hidden
  const r = rig();
  r.poller.tick();
  r.env.hidden = true; r.poller.pause();
  r.asks[0].settle(false); await r.flush();
  assert.equal(r.poller.state().armed, false, "no timer armed for a hidden tab");
  r.advance(10 * 60_000);
  assert.equal(r.asks.length, 1, "ten minutes hidden: no ask");
  // coming back: the back-off it owed is respected (15 s from the failure, long gone here), then exactly one ask
  r.env.hidden = false; r.poller.resume();
  assert.equal(r.asks.length, 2, "the wait has passed: one ask on return");
  r.poller.resume(); r.poller.resume();
  assert.equal(r.asks.length, 2, "repeated visibility events while that ask is out add nothing");

  // back soon after a failure: it owes what is left, not an immediate ask
  const s = rig();
  s.poller.tick(); s.asks[0].settle(false); await s.flush();     // t=0, backed off until 15000
  s.advance(4000); s.env.hidden = true; s.poller.pause();
  s.advance(3000); s.env.hidden = false; s.poller.resume();       // t=7000: 8000 ms of the wait are left
  assert.equal(s.asks.length, 1, "no burst on return while still backed off");
  s.advance(7999); assert.equal(s.asks.length, 1);
  s.advance(1); assert.equal(s.asks.length, 2, "asks when the original wait is up");

  // an ask out when the tab hides and comes back: nothing extra, and its settlement re-arms the normal pace
  const q = rig();
  q.poller.tick(); q.env.hidden = true; q.poller.pause(); q.env.hidden = false; q.poller.resume();
  assert.equal(q.asks.length, 1, "still the one ask in flight");
  q.asks[0].settle(true); await q.flush();
  q.advance(PACE); assert.equal(q.asks.length, 2);
});

test("the page's main-list ask answers false and SAYS it is waiting to retry (not that the town is quiet) when the office fails, true when it answers", async () => {
  const said = [];
  const held = [];
  let retryMs = 15000;
  const make = (fetchImpl) => new Function("fetch", "paint", "paintPinned", "holdNewest", "redraw", "refreshReaders", "refreshSelected", "anchorFromHash", "liveBox", "closedBox", "poller", "pageUrl", "POLL_MS", "dials",
    `var anchored = false, pinNext = true; ${askSrc}\nreturn ask;`)(
    fetchImpl, (box, threads, words) => said.push([threads, words]), () => {}, () => false, () => {}, () => {}, () => {}, () => {}, "live", "closed", { retryMs: () => retryMs }, () => "/api/world/conversations?closed=40", 7000, null);
  const body = (b) => ({ ok: true, json: () => Promise.resolve(b) });
  // the office answers
  assert.equal(await make(() => Promise.resolve(body({ live: [], closed: [], pinned: [] })))(), true);
  assert.equal(said.at(-1)[1].startsWith("The town is quiet."), true, "an answer of no talk is still the quiet line");
  // not OK
  assert.equal(await make(() => Promise.resolve({ ok: false, json: () => Promise.resolve({}) }))(), false);
  // OK but not JSON
  assert.equal(await make(() => Promise.resolve({ ok: true, json: () => Promise.reject(new SyntaxError("bad json")) }))(), false);
  // the request itself fails (a network error, an abort)
  assert.equal(await make(() => Promise.reject(new TypeError("Failed to fetch")))(), false);
  // a held request that never answers is held: the ask neither resolves nor says anything
  const hung = make(() => new Promise(() => {}))();
  let settled = false; hung.then(() => { settled = true; }); await new Promise((r) => setImmediate(r));
  assert.equal(settled, false);
  const silent = said.filter(([threads]) => threads === null).map(([, words]) => words);
  assert.equal(silent.length, 3, "each failed ask said so once");
  for (const words of silent) {
    assert.match(words, /isn't answering/, "the page still says the office is silent (the browser battery looks for this)");
    assert.match(words, /waiting 15 seconds to retry/, "and that it is waiting to retry, with the wait");
    assert.doesNotMatch(words, /quiet/i, "never that the town is quiet");
    assert.match(words, /\/api\/world\/conversations/, "the live door is still named");
  }
  retryMs = 60000;
  said.length = 0; await make(() => Promise.reject(new Error("x")))();
  assert.match(said[0][1], /waiting 60 seconds to retry/, "the words follow the ladder");
});
