// sentinel-board.test.mjs — the late-settlement notice's judgment and the board's one reader (POS-1004).
//
//   node --test test/sentinel-board.test.mjs
//
// LAW (Wright's 2026-11-12 02:14Z build approval, on Darko's 20:08 EST ruling "a small notice on the World page and the town's
// front page, cleared automatically when the settlement lands"): ONE state. A readable board no more than 20 minutes old whose
// `settlement` probe is exactly DOWN shows the notice; anything else (OK, STALE, UNKNOWN, a missing or unreadable board or
// timestamp, no settlement probe, an old board) shows NOTHING: "No 'unconfirmed' message and no last-known warning latch."
//
// The fixture is the SHAPE THE BOX PUBLISHES (test/sentinel-alert.test.mjs copies it from /srv/postmark-sentinel/status.json):
// `generated_at` and `probes[{key,label,kind,verdict,reason}]`. Every word is invented for this file; no live board is read.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  BOARD_MAX_AGE_MS, BOARD_PATH, POLL_MS, SETTLEMENT_NOTICE_TEXT, SETTLEMENT_PROBE_KEY, readBoardEvery, settlementNoticeFromBoard,
} from "../src/lib/sentinel-board.mjs";

const NOW = Date.parse("2026-11-12T07:30:00.000Z");
const MIN = 60 * 1000;
const board = (settlementVerdict, { ageMin = 2, extra = [], generated_at } = {}) => ({
  schema: 1,
  generated_at: generated_at ?? new Date(NOW - ageMin * MIN).toISOString(),
  status: settlementVerdict === "OK" ? "OK" : "DOWN",
  probes: [
    { key: "site_home", label: "postmark.town", kind: "up", verdict: "OK", reason: "HTTP 200" },
    ...(settlementVerdict == null ? [] : [{ key: SETTLEMENT_PROBE_KEY, label: "the settlement", kind: "settlement", verdict: settlementVerdict, reason: "invented reason" }]),
    ...extra,
  ],
});
const shows = (b, nowMs = NOW) => settlementNoticeFromBoard(b, { nowMs }).show;

test("the words are exactly the approved ones, in one home", () => {
  assert.equal(SETTLEMENT_NOTICE_TEXT, "The latest World settlement is running late. It will show here as soon as it's published.");
  assert.equal(SETTLEMENT_PROBE_KEY, "settlement");
  assert.equal(BOARD_MAX_AGE_MS, 20 * 60 * 1000);
});

test("a fresh board whose settlement probe is DOWN shows the notice", () => {
  assert.equal(shows(board("DOWN")), true);
  assert.equal(shows(board("DOWN", { ageMin: 0 })), true, "a board made this instant");
  assert.equal(shows(board("DOWN", { ageMin: 20 })), true, "exactly twenty minutes old is still readable");
});

test("CONTROLS: OK, STALE, UNKNOWN and INFO show nothing, and there is no 'unconfirmed' state for them", () => {
  for (const v of ["OK", "STALE", "UNKNOWN", "INFO", "PARKED", "down", "Down", "", 7]) assert.equal(shows(board(v)), false, `verdict ${JSON.stringify(v)}`);
  const view = settlementNoticeFromBoard(board("STALE"), { nowMs: NOW });
  assert.deepEqual(view, { show: false }, "the answer carries no second state, no message and no latch to restore an 'unconfirmed' line");
  assert.deepEqual(Object.keys(settlementNoticeFromBoard(board("DOWN"), { nowMs: NOW })), ["show"], "and the shown answer is one bit too");
});

test("CONTROLS: a missing, malformed, old or future board shows nothing", () => {
  for (const bad of [null, undefined, "DOWN", 7, [], {}, { probes: [] }, { generated_at: "2026-11-12T07:28:00Z" }, { generated_at: "2026-11-12T07:28:00Z", probes: "nope" }]) {
    assert.equal(shows(bad), false, JSON.stringify(bad));
  }
  assert.equal(shows(board("DOWN", { generated_at: "not a date" })), false, "an unreadable timestamp");
  assert.equal(shows({ ...board("DOWN"), generated_at: undefined }), false, "no timestamp");
  assert.equal(shows(board("DOWN", { generated_at: 1731396480000 })), false, "a timestamp that is not a string");
  assert.equal(shows(board("DOWN", { ageMin: 21 })), false, "twenty-one minutes old: the board is old, say nothing (an operator alarm, not the town's)");
  assert.equal(shows(board("DOWN", { ageMin: 600 })), false, "ten hours old: no last-known latch");
  assert.equal(shows(board("DOWN", { ageMin: -5 })), false, "a board from the future cannot be trusted");
  assert.equal(shows(board(null)), false, "a board with no settlement probe at all");
});

test("ANOTHER probe's DOWN never triggers it, whatever its key or label says", () => {
  const b = board("OK", { extra: [
    { key: "site_refresh", label: "the box's site refresh", verdict: "DOWN", reason: "x" },
    { key: "settlement_tag", label: "the settlement", verdict: "DOWN", reason: "a label that says settlement is not the probe" },
    { key: "settlements", label: "settlements", verdict: "DOWN", reason: "a near key" },
    null, "x", 3,
  ] });
  assert.equal(shows(b), false);
  const both = board("DOWN", { extra: [{ key: "site_refresh", verdict: "DOWN" }] });
  assert.equal(shows(both), true, "and the settlement probe's own DOWN still shows, beside another DOWN");
});

test("the judgment never throws, whatever it is handed", () => {
  for (const weird of [Object.create(null), new Proxy({}, { get() { return undefined; } }), { generated_at: { toString() { throw new Error("x"); } }, probes: [] }, { probes: [{ get key() { return "settlement"; }, verdict: "DOWN" }], generated_at: new Date(NOW).toISOString() }]) {
    assert.doesNotThrow(() => settlementNoticeFromBoard(weird, { nowMs: NOW }));
  }
});

// ── the one reader: one fetch per page, shared, on load, once a minute while visible, and on return ─────────────────────

function fakeEnv({ visible = true } = {}) {
  const clock = { now: 0 };
  const intervals = [];
  const docListeners = {}, winListeners = {};
  const fetches = [];
  const state = { body: null, ok: true, fail: false };
  const env = {
    fetch: async (url, opts) => {
      fetches.push({ url, opts, at: clock.now });
      if (state.fail) throw new Error("offline");
      return { ok: state.ok, status: state.ok ? 200 : 404, text: async () => state.body ?? "" };
    },
    setInterval: (fn, ms) => { intervals.push({ fn, ms, at: clock.now + ms, every: ms }); return intervals.length; },
    clearInterval: (id) => { intervals[id - 1] = null; },
    document: {
      visibilityState: visible ? "visible" : "hidden",
      addEventListener: (t, f) => { (docListeners[t] ??= []).push(f); },
      removeEventListener: (t, f) => { docListeners[t] = (docListeners[t] ?? []).filter((x) => x !== f); },
    },
    addEventListener: (t, f) => { (winListeners[t] ??= []).push(f); },
    removeEventListener: (t, f) => { winListeners[t] = (winListeners[t] ?? []).filter((x) => x !== f); },
  };
  const flush = async () => { for (let i = 0; i < 6; i += 1) await new Promise((ok) => setImmediate(ok)); };
  return {
    env, fetches, state, clock, flush,
    tick: async (ms) => { clock.now += ms; for (const i of intervals) if (i && i.at <= clock.now) { i.at += i.every; i.fn(); } await flush(); },
    fire: async (where, type) => { for (const f of ((where === "doc" ? docListeners : winListeners)[type] ?? [])) f(); await flush(); },
    setVisible: (v) => { env.document.visibilityState = v ? "visible" : "hidden"; },
  };
}
const boardText = (b) => JSON.stringify(b);

test("one fetch per page, shared by every subscriber: on load, and a late subscriber gets the board already read", async () => {
  const w = fakeEnv();
  w.state.body = boardText(board("DOWN"));
  const a = [], b = [];
  const offA = readBoardEvery("", (x) => a.push(x), { env: w.env });
  const offB = readBoardEvery("", (x) => b.push(x), { env: w.env });
  await w.flush();
  assert.equal(w.fetches.length, 1, "two subscribers, one read");
  assert.equal(w.fetches[0].url, BOARD_PATH, "the town's own board, at the town's origin");
  assert.equal(w.fetches[0].opts.cache, "no-store", "no-store: a stale board is a wrong alarm");
  assert.equal(a.length, 1);
  assert.equal(b.length, 1, "the second subscriber was handed the board already read, with no second fetch");
  assert.equal(shows(a[0]), true);
  const late = [];
  readBoardEvery("", (x) => late.push(x), { env: w.env });
  assert.equal(late.length, 1, "a subscriber that arrives later is told at once");
  assert.equal(w.fetches.length, 1);
  offA(); offB();
});

test("the origin is carried: the harbor's mirrored vhost reads the TOWN's board; a different origin is a different reader", async () => {
  const w = fakeEnv();
  w.state.body = boardText(board("OK"));
  readBoardEvery("https://postmark.town", () => {}, { env: w.env });
  readBoardEvery("", () => {}, { env: w.env });
  await w.flush();
  assert.deepEqual(w.fetches.map((f) => f.url).sort(), ["/ops/sentinel.json", "https://postmark.town/ops/sentinel.json"]);
});

test("once a minute while the page is visible, and NOT while it is hidden; on return it reads at once", async () => {
  const w = fakeEnv();
  w.state.body = boardText(board("DOWN"));
  const seen = [];
  readBoardEvery("", (x) => seen.push(x), { env: w.env });
  await w.flush();
  assert.equal(w.fetches.length, 1, "load");
  await w.tick(POLL_MS);
  assert.equal(w.fetches.length, 2, "a minute later");
  await w.tick(POLL_MS);
  assert.equal(w.fetches.length, 3);
  w.setVisible(false);
  await w.tick(POLL_MS); await w.tick(POLL_MS); await w.tick(POLL_MS);
  assert.equal(w.fetches.length, 3, "hidden: no reads");
  w.setVisible(true);
  await w.fire("doc", "visibilitychange");
  assert.equal(w.fetches.length, 4, "return to the page: a read at once, without waiting for the minute");
  await w.fire("win", "pageshow");
  assert.equal(w.fetches.length, 5, "a page restored from the back-forward cache reads too");
  w.setVisible(false);
  await w.fire("doc", "visibilitychange");
  assert.equal(w.fetches.length, 5, "going hidden is not a return");
  assert.equal(POLL_MS, 60_000);
});

test("DOWN then OK: the next board clears it, without a reload (the subscriber is told each time)", async () => {
  const w = fakeEnv();
  w.state.body = boardText(board("DOWN"));
  const verdicts = [];
  readBoardEvery("", (x) => verdicts.push(shows(x, NOW)), { env: w.env });
  await w.flush();
  assert.deepEqual(verdicts, [true]);
  w.state.body = boardText(board("OK"));
  await w.tick(POLL_MS);
  assert.deepEqual(verdicts, [true, false], "cleared by the next read");
});

test("a failed read, a non-OK answer and a body that is not a board all hand the listener null (and speak only at debug)", async () => {
  const loud = [];
  const saved = { w: console.warn, e: console.error, l: console.log };
  console.warn = console.error = console.log = (...a) => loud.push(a.join(" "));
  try {
    for (const make of [(s) => { s.fail = true; }, (s) => { s.ok = false; }, (s) => { s.body = "<html>not json"; }, (s) => { s.body = "[1,2]"; }, (s) => { s.body = ""; }]) {
      const w = fakeEnv();
      make(w.state);
      const got = [];
      readBoardEvery("", (x) => got.push(x), { env: w.env });
      await w.flush();
      assert.deepEqual(got, [null]);
      assert.equal(shows(got[0]), false, "and null shows nothing");
    }
  } finally { console.warn = saved.w; console.error = saved.e; console.log = saved.l; }
  assert.deepEqual(loud, [], "nothing louder than console.debug: a dev build has no sentinel and must be quiet");
});

test("a listener that throws does not stop the others, and the last unsubscribe stops the timer", async () => {
  const w = fakeEnv();
  w.state.body = boardText(board("DOWN"));
  const ok = [];
  const off1 = readBoardEvery("", () => { throw new Error("a listener's own fault"); }, { env: w.env });
  const off2 = readBoardEvery("", (x) => ok.push(x), { env: w.env });
  await w.flush();
  assert.equal(ok.length, 1, "the other listener still heard");
  off1();
  await w.tick(POLL_MS);
  assert.equal(ok.length, 2, "still reading while one subscriber remains");
  off2();
  const before = w.fetches.length;
  await w.tick(POLL_MS); await w.tick(POLL_MS);
  assert.equal(w.fetches.length, before, "no subscribers: no reads");
});

test("the reader's source speaks only at console.debug", () => {
  const src = readFileSync(new URL("../src/lib/sentinel-board.mjs", import.meta.url), "utf8").replace(/^\s*\/\/.*$/gm, "");
  for (const loud of ["console.warn", "console.error", "console.log", "alert("]) assert.ok(!src.includes(loud), loud);
});
