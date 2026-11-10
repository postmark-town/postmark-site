// notification-bell.test.mjs — the mail bell looks again after each crossing while a page is open, on the PUBLISHED bake (POS-991, postmark#4436).
//
//   node --test test/notification-bell.test.mjs
//
// LAW (Wright, 2026-11-10 14:21:51Z, taking back his "within a minute" because it was written without measuring): "the published
// bake governs". After a crossing, while the page is open, the bell "looks again on a bounded schedule (for example every few
// minutes, up to about an hour) until it sees rows from that crossing. Then it stops. It never treats an older bake or the young
// local cache as fresh." And "the fixture should publish late (after the crossing, at a later bake)". The report: mail at 7 p.m.
// Eastern (a crossing), the bell an hour later, because the page looked once and trusted a 30-minute cache. The bell reads the
// site's BAKED letters.json, which the site's refresh publishes later (the :10/:40 timer plus a build of minutes).
//
// CHOSEN (the brief's example, stated): a follow-up every FIVE minutes, up to an hour after the crossing, or until mail it did
// not have shows up (the bake carrying the crossing has been published); a page loaded inside the window joins it.
//
// WHY THIS FILE RUNS THE LAYOUT'S OWN SCRIPT rather than a copy or a helper: the bell is an inline script in
// src/layouts/PostmarkLayout.astro (one /me, one receivedMail, one render), so a test of a time-formatting helper could stay
// green with the schedule deleted. This file slices the marked region ("BELL SCRIPT" to "END BELL SCRIPT") out of the real
// layout, strips its one import (the auth contract is injected), and runs it in a `vm` against a deterministic fake clock,
// fake timers, a fake localStorage, a fake letters.json that PUBLISHES LATE, and the smallest DOM the bell touches. Move the
// markers and the slice fails loudly; remove any piece of the fix and its oracle goes red (the flips at the end do exactly that).
//
// EVERYTHING IS INVENTED: the household, the handles and the letters. No network, no real token, no live mail.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { KEYS, tokenIsFresh } from "../src/lib/auth.mjs";

const SOURCE = readFileSync(new URL("../src/layouts/PostmarkLayout.astro", import.meta.url), "utf8");
const OPEN = "// ── BELL SCRIPT";
const CLOSE = "// ── END BELL SCRIPT ──";
const IMPORT = /^\s*import \{ AS, KEYS, tokenIsFresh \} from "@\/lib\/auth\.mjs";\s*$/m;

function bellSource(text = SOURCE) {
  const a = text.indexOf(OPEN), b = text.indexOf(CLOSE);
  assert.ok(a >= 0, `the bell's opening marker is gone from PostmarkLayout.astro: ${OPEN}`);
  assert.ok(b > a, `the bell's closing marker is gone from PostmarkLayout.astro: ${CLOSE}`);
  const region = text.slice(a, b);
  assert.ok(IMPORT.test(region), "the bell's one import (the auth contract) is where this file expects it");
  return region.replace(IMPORT, "");
}

// ── the smallest world the bell touches ─────────────────────────────────────────────────────────────────────────────

class El {
  constructor(tag = "div") { this.tag = tag; this.children = []; this.hidden = false; this.textContent = ""; this.innerHTML = ""; this.className = ""; this.href = ""; this.style = {}; this.attrs = {}; this.handlers = {}; this.classList = { add() {}, remove() {} }; }
  append(...kids) { this.children.push(...kids); }
  addEventListener(type, fn) { (this.handlers[type] ??= []).push(fn); }
  setAttribute(k, v) { this.attrs[k] = v; }
  getBoundingClientRect() { return { bottom: 0 }; }
  contains() { return false; }
}

const at = (iso) => Date.parse(iso);

function world({ now, letters, storage = {}, household = "hh:moss-house", handles = ["moss"] }) {
  const clock = { now };
  const timers = [];
  let nextId = 1;
  const fetches = [];
  const state = { letters, failLetters: false, failMode: "throw" };
  class FakeDate extends Date {
    constructor(...a) { if (a.length) super(...a); else super(clock.now); }
    static now() { return clock.now; }
  }
  const store = new Map(Object.entries(storage));
  const localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => { store.set(k, String(v)); } };
  const me = { household, handles, visitor: false };
  const nodes = { bell: new El("button"), badge: new El("span"), panel: new El(), body: new El(), seen: new El("button") };
  nodes.panel.hidden = true; nodes.badge.hidden = true;
  const map = { "[data-notif-bell]": nodes.bell, "[data-notif-badge]": nodes.badge, "[data-notif-panel]": nodes.panel, "[data-notif-body]": nodes.body, "[data-notif-seen]": nodes.seen };
  const root = new El(); root.hidden = true; root.querySelector = (s) => map[s] ?? null;
  const document = {
    querySelector: (s) => (s === "[data-notif]" ? root : null),
    createElement: (t) => new El(t), addEventListener() {}, dispatchEvent() { return true; },
  };
  const window = { matchMedia: () => ({ matches: false }) };
  const fetchFn = async (url, opts = {}) => {
    fetches.push({ url: String(url), opts, at: clock.now });
    if (String(url) === AS.me) return { ok: true, json: async () => me };
    if (String(url) === "/data/letters.json") {
      if (state.failLetters) { if (state.failMode === "throw") throw new Error("offline"); return { ok: false, json: async () => [] }; }
      return { ok: true, json: async () => JSON.parse(JSON.stringify(state.letters)) };
    }
    return { ok: false, json: async () => null };
  };
  const setTimeoutFn = (fn, ms) => { const id = nextId++; timers.push({ id, at: clock.now + ms, fn }); return id; };
  const clearTimeoutFn = (id) => { const i = timers.findIndex((t) => t.id === id); if (i >= 0) timers.splice(i, 1); };
  const sandbox = { Date: FakeDate, document, window, localStorage, fetch: fetchFn, setTimeout: setTimeoutFn, clearTimeout: clearTimeoutFn,
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init?.detail; } }, console, JSON, Set, Map, Promise, Array, String, Number, Object, Math, Error };
  const AS = { me: "https://office.test/api/me" };
  const flush = async () => { for (let i = 0; i < 12; i += 1) await new Promise((ok) => setImmediate(ok)); };
  return {
    sandbox, AS, state, store, fetches, nodes, clock, timers,
    start: async (source) => {
      store.set(KEYS.token, JSON.stringify({ access_token: "fake-token-not-real" }));
      new vm.Script(`(function (AS, KEYS, tokenIsFresh) {\n${source}\n})`).runInNewContext(sandbox)(AS, KEYS, tokenIsFresh);
      await flush();
    },
    advanceTo: async (t) => {
      for (;;) {
        const due = timers.filter((x) => x.at <= t).sort((a, b) => a.at - b.at || a.id - b.id)[0];
        if (!due) break;
        timers.splice(timers.indexOf(due), 1);
        clock.now = Math.max(clock.now, due.at);
        due.fn();
        await flush();
      }
      clock.now = t;
      await flush();
    },
    // A SLEEP, not a replay: the machine slept, so NO callback ran while the clock moved; it wakes at `t` and every overdue timer
    // runs NOW, with the clock at `t` (advanceTo above replays callbacks at their old due times, which is not this case).
    wake: async (t) => {
      clock.now = t;
      for (;;) {
        const due = timers.filter((x) => x.at <= t).sort((a, b) => a.at - b.at || a.id - b.id)[0];
        if (!due) break;
        timers.splice(timers.indexOf(due), 1);
        due.fn();
        await flush();
      }
      await flush();
    },
    unread: () => (nodes.badge.hidden ? 0 : Number(nodes.badge.textContent)),
    rows: () => nodes.body.children.map((c) => c.innerHTML),
    lettersFetches: () => fetches.filter((f) => f.url === "/data/letters.json"),
  };
}

const letter = (id, from, to = "moss", date = "2026-11-10") => ({ id, from, to, box: "inbox", date });
const MOSS_HOUSE = "hh:moss-house";
const CACHE = "pm.notif.mailcache." + MOSS_HOUSE;
const MIN = 60 * 1000;
const HOURS12 = 12 * 60 * MIN;
const NOON = at("2026-11-10T12:00:00Z");
const MIDNIGHT = at("2026-11-11T00:00:00Z");

// ── the oracle: LATE PUBLICATION. The mail is delivered at the crossing; the bake that carries it is published LATER ──

async function lateBake(source) {
  const w = world({ now: at("2026-11-10T11:50:00Z"), letters: [letter("L1", "ash")] });
  await w.start(source);
  assert.equal(w.unread(), 1, "the page opened: one unread correspondent");
  assert.equal(w.lettersFetches().length, 1, "read once, at load");
  const preCache = w.store.get(CACHE);
  assert.equal(JSON.parse(preCache).ts, NOON - 10 * MIN, "the cache is young, filled ten minutes before the crossing");

  await w.advanceTo(NOON - 1000);
  assert.equal(w.lettersFetches().length, 1, "nothing is read before the crossing (no poll)");
  // the crossing passes; the mail is delivered, but the site's published bake still holds the OLD letters.json
  await w.advanceTo(NOON + 4 * MIN);
  assert.equal(w.lettersFetches().length, 1, "no look inside the first five minutes after the crossing");
  await w.advanceTo(NOON + 5 * MIN + 1000);
  assert.equal(w.lettersFetches().length, 2, "the first follow-up, five minutes after the crossing");
  assert.equal(w.lettersFetches()[1].opts.cache, "no-cache", "a forced look: the browser's own cache must revalidate");
  assert.equal(w.unread(), 1, "it read the OLD bake: nothing new to show");
  assert.equal(w.store.get(CACHE), preCache, "and an unchanged older bake was NOT stamped fresh: the cache is exactly as it was");
  await w.advanceTo(NOON + 10 * MIN + 1000);
  assert.equal(w.lettersFetches().length, 3, "the second follow-up, still the old bake");
  assert.equal(w.unread(), 1);

  // ANOTHER TAB (an old bake read at +11 min) fills a young post-crossing cache before the next forced look
  await w.advanceTo(NOON + 11 * MIN);
  w.store.set(CACHE, JSON.stringify({ ts: w.clock.now, rows: [{ id: "L1", from: "ash", to: "moss", date: "2026-11-10" }] }));
  // the bake carrying the crossing's mail is published at +12 min
  await w.advanceTo(NOON + 12 * MIN);
  w.state.letters = [letter("L1", "ash"), letter("L2", "birch", "moss", "2026-11-10T12:00:00Z")];
  await w.advanceTo(NOON + 15 * MIN + 1000);                           // the next forced look
  assert.equal(w.lettersFetches().length, 4, "the third follow-up went to the network though a young local cache stood");
  assert.equal(w.unread(), 2, "the late bake's mail shows without navigation");
  assert.ok(w.rows().some((r) => r.includes("birch")), "the new correspondent has its row");
  assert.equal(JSON.parse(w.store.get(CACHE)).rows.length, 2, "and the cache now carries the new rows");

  // delivery seen: the follow-ups STOP until the next crossing
  await w.advanceTo(NOON + 59 * MIN);
  assert.equal(w.lettersFetches().length, 4, "no more looks this window once the mail was seen");
  // the next crossing: its window opens, and its own follow-ups run (the bake carrying it is published by +5 min this time)
  w.state.letters = [...w.state.letters, letter("L3", "cedar", "moss", "2026-11-11T00:00:00Z")];
  await w.advanceTo(MIDNIGHT + 5 * MIN + 1000);
  assert.equal(w.lettersFetches().length, 5, "the next crossing's first follow-up");
  assert.equal(w.unread(), 3, "its mail shows");
  assert.equal(w.timers.length, 1, "exactly one timer stands");
  assert.equal(w.timers[0].at, MIDNIGHT + HOURS12 + 5 * MIN, "for the crossing after that, plus five minutes");
  return true;
}

// ── the oracle: the BOUND. No delivery at all: the follow-ups stop an hour after the crossing, the next crossing is scheduled ──

async function noDelivery(source) {
  const w = world({ now: at("2026-11-10T11:50:00Z"), letters: [letter("L1", "ash")] });
  await w.start(source);
  await w.advanceTo(NOON + 90 * MIN);                                  // an hour and a half after the crossing
  assert.deepEqual(w.lettersFetches().slice(1).map((f) => (f.at - NOON) / MIN), [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60],
    "twelve follow-ups, five minutes apart, up to an hour after the crossing, and no more");
  assert.equal(w.unread(), 1, "the unchanged rows are still on screen");
  assert.equal(w.timers.length, 1, "one timer stands: the next crossing's first look");
  assert.equal(w.timers[0].at, MIDNIGHT + 5 * MIN, "at the next crossing plus five minutes");
  return true;
}

// ── the oracle: A SLEEP ACROSS A CROSSING. The tab's noon timer is overdue when the machine wakes at 00:02 ─────────────────────

async function sleepAcrossNoon(source) {
  const w = world({ now: at("2026-11-10T11:50:00Z"), letters: [letter("L1", "ash")] });
  await w.start(source);
  assert.equal(w.unread(), 1, "page open at 11:50 with one unread correspondent");
  assert.equal(w.timers.length, 1, "the noon follow-up is scheduled");
  // the machine sleeps across noon: no callback runs. Only NOON's bake is published (it carries noon's mail) when it wakes at 00:02.
  w.state.letters = [letter("L1", "ash"), letter("L2", "birch", "moss", "2026-11-10T12:00:00Z")];
  await w.wake(MIDNIGHT + 2 * MIN);
  assert.equal(w.lettersFetches().length, 2, "the overdue noon look ran at wake");
  assert.equal(w.lettersFetches()[1].at, MIDNIGHT + 2 * MIN, "with the clock at 00:02, not at its old due time");
  assert.equal(w.unread(), 2, "it found noon's mail");
  assert.equal(w.timers.length, 1, "and MIDNIGHT's window is still scheduled");
  assert.equal(w.timers[0].at, MIDNIGHT + 5 * MIN, "its first look at 00:05: noon's delivery did not settle midnight");
  // midnight's bake is published later; midnight's follow-ups then find it without navigation
  w.state.letters = [...w.state.letters, letter("L3", "cedar", "moss", "2026-11-11T00:00:00Z")];
  await w.advanceTo(MIDNIGHT + 6 * MIN);
  assert.equal(w.unread(), 3, "midnight's mail shows without navigation (the 00:05 look)");
  return true;
}

test("A SLEEP ACROSS A CROSSING on the layout's own script: an overdue noon look that wakes at 00:02 settles NOON, not midnight, so midnight's late bake still shows without navigation", async () => {
  assert.equal(await sleepAcrossNoon(bellSource()), true);
});

test("LATE PUBLICATION on the layout's own script: the bake carrying a crossing's mail is published after it; follow-ups find it, a young cache from another tab does not hide it, and they stop", async () => {
  assert.equal(await lateBake(bellSource()), true);
});

test("THE BOUND: with no delivery the follow-ups run every five minutes up to an hour after the crossing, then stop, and the next crossing is scheduled", async () => {
  assert.equal(await noDelivery(bellSource()), true);
});

async function loadedInWindow(source) {
  const w = world({
    now: NOON + 20 * MIN, letters: [letter("L1", "ash")],
    storage: { [CACHE]: JSON.stringify({ ts: NOON - MIN, rows: [{ id: "L1", from: "ash", to: "moss", date: "2026-11-10" }] }) },
  });
  await w.start(source);
  assert.equal(w.lettersFetches().length, 1, "the pre-crossing cache is stale from the moment the crossing passed: read at load");
  w.state.letters = [letter("L1", "ash"), letter("L2", "birch")];       // the bake lands after the page loaded
  await w.advanceTo(NOON + 26 * MIN);
  assert.equal(w.lettersFetches().length, 2, "the next grid point after the load (+25 min)");
  assert.equal(w.unread(), 2, "the late bake's mail shows");
  return true;
}

test("a page LOADED inside the window joins it: a cache filled just before the crossing is not trusted, and the follow-ups carry on from there", async () => {
  assert.equal(await loadedInWindow(bellSource()), true);
  // the control: a cache filled AFTER the crossing, within the TTL, still answers a plain load
  const c = world({
    now: NOON + 40 * MIN, letters: [letter("L1", "ash"), letter("L2", "birch")],
    storage: { [CACHE]: JSON.stringify({ ts: NOON + 35 * MIN, rows: [{ id: "L1", from: "ash", to: "moss", date: "2026-11-10" }] }) },
  });
  await c.start(bellSource());
  assert.equal(c.lettersFetches().length, 0, "a cache filled after the crossing and within thirty minutes answers a plain load");
  assert.equal(c.unread(), 1);
});

test("the follow-ups keep the seen set, the household's namespaces and the grouping: seen mail stays read, new mail is unread, another household's cache is untouched", async () => {
  const other = "pm.notif.mailcache.hh:other-house";
  const w = world({
    now: at("2026-11-10T11:50:00Z"), letters: [letter("L1", "ash")],
    storage: { ["pm.notif.seen." + MOSS_HOUSE]: JSON.stringify({ ids: ["L1"] }), [other]: JSON.stringify({ ts: 1, rows: [{ id: "X" }] }) },
  });
  await w.start(bellSource());
  assert.equal(w.unread(), 0, "L1 was seen: the badge is clear");
  w.state.letters = [letter("L1", "ash"), letter("L2", "birch"), letter("L2b", "birch")];
  await w.advanceTo(NOON + 5 * MIN + 1000);
  assert.equal(w.unread(), 1, "two new letters from one neighbour are one unread row (grouped), and the seen letter stays read");
  assert.equal(JSON.parse(w.store.get("pm.notif.seen." + MOSS_HOUSE)).ids.join(), "L1", "the seen set is not rewritten by a follow-up");
  assert.equal(JSON.parse(w.store.get(other)).ts, 1, "another household's cache key is not touched");
});

test("a FAILED follow-up keeps what is on screen (a throw, and a non-OK answer, even with an OLDER cache present), and the schedule carries on", async () => {
  for (const mode of ["throw", "notok"]) {
    const w = world({ now: at("2026-11-10T11:50:00Z"), letters: [letter("L1", "ash"), letter("L2", "birch")] });
    await w.start(bellSource());
    assert.equal(w.unread(), 2);
    w.store.set(CACHE, JSON.stringify({ ts: at("2026-11-10T11:00:00Z"), rows: [{ id: "L1", from: "ash", to: "moss", date: "2026-11-10" }] }));   // an older, smaller cache
    w.state.failLetters = true; w.state.failMode = mode;
    await w.advanceTo(NOON + 5 * MIN + 1000);
    assert.equal(w.unread(), 2, `${mode}: the bell shows what it had, not the older cache and not nothing`);
    assert.equal(w.timers.length, 1, `${mode}: the next look is scheduled`);
  }
});

test("a signed-out reader (no /me) gets no bell and no timer", async () => {
  const w = world({ now: at("2026-11-10T11:50:00Z"), letters: [letter("L1", "ash")] });
  const src = bellSource();
  w.sandbox.fetch = async () => ({ ok: false, json: async () => null });
  await w.start(src);
  assert.equal(w.timers.length, 0, "no identity, no follow-up");
  assert.equal(w.unread(), 0);
});

// ── THE FLIPS: each oracle goes red on the layout with a piece of the fix removed ─────────────────────────────────────

const LAYOUT = () => readFileSync(new URL("../src/layouts/PostmarkLayout.astro", import.meta.url), "utf8");
const FLIPS = [
  ["no-follow-ups", "      scheduleFollowUp();\n", "", "no follow-up is ever scheduled", lateBake],
  ["cache-ignores-crossing", " && cached.ts >= lastCrossingAt(Date.now())", "", "a young pre-crossing cache is trusted at load", loadedInWindow],
  ["force-uses-young-cache", "if (!opts.force && cachedRows && cached.ts", "if (cachedRows && cached.ts", "a forced look lets a young local cache answer (another tab's old-bake read)", lateBake],
  ["no-http-revalidate", "...(opts.force ? { cache: \"no-cache\" } : {})", "", "a forced look lets the browser's HTTP cache answer", lateBake],
  ["unchanged-bake-stamped-fresh", "if (!(opts.force && sameRows(rows, opts.previous))) writeJSON(", "if (true) writeJSON(", "an unchanged older bake is stamped as a fresh cache", lateBake],
  ["never-stops", "if (delivered) settledFor = forCrossing;", "", "the follow-ups never stop on delivery", lateBake],
  ["settles-the-current-crossing", "if (delivered) settledFor = forCrossing;", "if (delivered) settledFor = lastCrossingAt(Date.now());", "a delivery settles the crossing current when the callback runs (e22f85ae), so an overdue look settles the next window", sleepAcrossNoon],
  ["no-bound", "if (n <= c + FOLLOW_UNTIL_MS) return n;", "return n;", "the follow-ups have no bound", noDelivery],
];
for (const [label, from, to, why, oracle] of FLIPS) {
  test(`FLIP ${label}: red on a layout where ${why}`, async () => {
    const text = LAYOUT();
    assert.ok(text.includes(from), `the flip's anchor is still in the layout: ${label}`);
    await assert.rejects(oracle(bellSource(text.split(from).join(to))), (e) => e?.name === "AssertionError", `${label} must be caught`);
  });
}
test("FLIP no-failure-fallback: a failed follow-up regresses the bell on a layout without the fallback", async () => {
  const text = LAYOUT();
  const from = "fallback: was }";
  assert.ok(text.includes(from));
  const w = world({ now: at("2026-11-10T11:50:00Z"), letters: [letter("L1", "ash"), letter("L2", "birch")] });
  await w.start(bellSource(text.split(from).join("}")));
  w.store.set(CACHE, JSON.stringify({ ts: at("2026-11-10T11:00:00Z"), rows: [{ id: "L1", from: "ash", to: "moss", date: "2026-11-10" }] }));
  w.state.failLetters = true;
  await w.advanceTo(NOON + 5 * MIN + 1000);
  assert.notEqual(w.unread(), 2, "without the fallback a failed look regresses to the older cache: the real test above would be red");
});
