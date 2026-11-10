// notification-bell.test.mjs — the mail bell rechecks right after each crossing while a page is open (POS-991, postmark#4436).
//
//   node --test test/notification-bell.test.mjs
//
// LAW (Wright, 2026-11-09 owner answer on #4436 and his 2026-11-10 queue ruling): "while a signed-in page is open, the bell
// rechecks right after each crossing (00:00 and 12:00 UTC), so mail that just landed shows within a minute or so", and "treat
// the household cache as stale from the moment a crossing passes". The report: mail at 7 p.m. Eastern (a crossing), the bell an
// hour later, because the page looked once and trusted a 30-minute cache.
//
// WHY THIS FILE RUNS THE LAYOUT'S OWN SCRIPT rather than a copy or a helper: the bell is an inline script in
// src/layouts/PostmarkLayout.astro (one /me, one receivedMail, one render), so a test of a time-formatting helper could stay
// green with the recheck deleted. This file slices the marked region ("BELL SCRIPT" to "END BELL SCRIPT") out of the real
// layout, strips its one import (the auth contract is injected), and runs it in a `vm` against a deterministic fake clock,
// fake timers, a fake localStorage, a fake letters.json, and the smallest DOM the bell touches. Move the markers and the slice
// fails loudly; delete the recheck or the cache rule and the scenario goes red (the flips at the end do exactly that).
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

const HALF = 12 * 60 * 60 * 1000;
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
    unread: () => (nodes.badge.hidden ? 0 : Number(nodes.badge.textContent)),
    rows: () => nodes.body.children.map((c) => c.innerHTML),
    lettersFetches: () => fetches.filter((f) => f.url === "/data/letters.json"),
  };
}

const letter = (id, from, to = "moss", date = "2026-11-10") => ({ id, from, to, box: "inbox", date });
const MOSS_HOUSE = "hh:moss-house";

// ── the scenario: the production script, a fake clock, a fixture that changes at the crossing ────────────────────────

async function scenario(source) {
  const t0 = at("2026-11-10T11:50:00Z");                              // the page is open, ten minutes before the noon crossing
  const w = world({ now: t0, letters: [letter("L1", "ash")] });
  await w.start(source);
  assert.equal(w.unread(), 1, "the page opened: one unread correspondent");
  assert.equal(w.lettersFetches().length, 1, "read once, at load");
  const youngCache = JSON.parse(w.store.get("pm.notif.mailcache." + MOSS_HOUSE));
  assert.equal(youngCache.ts, t0, "the cache was just filled: it is young");

  // new mail lands AT the crossing, while the page stays open
  w.state.letters = [letter("L1", "ash"), letter("L2", "birch", "moss", "2026-11-10T12:00:00Z")];
  await w.advanceTo(at("2026-11-10T11:59:59Z"));
  assert.equal(w.lettersFetches().length, 1, "nothing is read before the crossing (no poll)");
  assert.equal(w.unread(), 1);
  await w.advanceTo(at("2026-11-10T12:00:50Z"));                      // fifty seconds after the crossing
  assert.equal(w.lettersFetches().length, 2, "the bell looked again just after the crossing, though its cache was twenty minutes young");
  assert.equal(w.lettersFetches()[1].opts.cache, "no-cache", "and asked the browser to revalidate the file");
  assert.equal(w.unread(), 2, "the newly delivered mail shows without navigation: two unread correspondents");
  assert.ok(w.rows().some((r) => r.includes("birch")), "the new correspondent has its row in the panel's list");

  // the next crossing is scheduled: midnight, and the one after
  w.state.letters = [...w.state.letters, letter("L3", "cedar", "moss", "2026-11-11T00:00:00Z")];
  await w.advanceTo(at("2026-11-10T23:59:59Z"));
  assert.equal(w.lettersFetches().length, 2, "no read between crossings");
  await w.advanceTo(at("2026-11-11T00:00:50Z"));
  assert.equal(w.lettersFetches().length, 3, "the next crossing is rechecked too");
  assert.equal(w.unread(), 3, "and its mail shows");
  assert.equal(w.timers.length, 1, "exactly one timer stands: the crossing after that");
  assert.equal(w.timers[0].at, at("2026-11-11T12:00:00Z") + 45 * 1000, "at the next crossing plus the grace");
  return true;
}

test("THE SCENARIO on the layout's own script: a page open across a crossing shows newly delivered mail without navigation, and the next crossing stays scheduled", async () => {
  assert.equal(await scenario(bellSource()), true);
});

test("a page LOADED just after a crossing does not trust a cache filled just before it", async () => {
  const w = world({
    now: at("2026-11-10T12:00:10Z"), letters: [letter("L1", "ash"), letter("L2", "birch")],
    storage: { ["pm.notif.mailcache." + MOSS_HOUSE]: JSON.stringify({ ts: at("2026-11-10T11:59:00Z"), rows: [{ id: "L1", from: "ash", to: "moss", date: "2026-11-10" }] }) },
  });
  await w.start(bellSource());
  assert.equal(w.lettersFetches().length, 1, "the pre-crossing cache (filled a minute before the crossing) is stale from the moment the crossing passed");
  assert.equal(w.unread(), 2);
  // the control: the same cache, filled AFTER the crossing, is still honoured within its TTL
  const c = world({
    now: at("2026-11-10T12:20:00Z"), letters: [letter("L1", "ash"), letter("L2", "birch")],
    storage: { ["pm.notif.mailcache." + MOSS_HOUSE]: JSON.stringify({ ts: at("2026-11-10T12:10:00Z"), rows: [{ id: "L1", from: "ash", to: "moss", date: "2026-11-10" }] }) },
  });
  await c.start(bellSource());
  assert.equal(c.lettersFetches().length, 0, "a cache filled after the crossing and within thirty minutes is used");
  assert.equal(c.unread(), 1);
});

test("the recheck keeps the seen set, the household's namespaces and the grouping: seen mail stays read, new mail is unread, another household's cache is untouched", async () => {
  const other = "pm.notif.mailcache.hh:other-house";
  const w = world({
    now: at("2026-11-10T11:50:00Z"), letters: [letter("L1", "ash")],
    storage: { ["pm.notif.seen." + MOSS_HOUSE]: JSON.stringify({ ids: ["L1"] }), [other]: JSON.stringify({ ts: 1, rows: [{ id: "X" }] }) },
  });
  await w.start(bellSource());
  assert.equal(w.unread(), 0, "L1 was seen: the badge is clear");
  w.state.letters = [letter("L1", "ash"), letter("L2", "birch"), letter("L2b", "birch")];
  await w.advanceTo(at("2026-11-10T12:00:50Z"));
  assert.equal(w.unread(), 1, "two new letters from one neighbour are one unread row (grouped), and the seen letter stays read");
  assert.equal(JSON.parse(w.store.get("pm.notif.seen." + MOSS_HOUSE)).ids.join(), "L1", "the seen set is not rewritten by a recheck");
  assert.equal(JSON.parse(w.store.get(other)).ts, 1, "another household's cache key is not touched");
});

test("a FAILED recheck keeps what is on screen (a throw, and a non-OK answer), and the next crossing is still scheduled", async () => {
  for (const mode of ["throw", "notok"]) {
    const w = world({ now: at("2026-11-10T11:50:00Z"), letters: [letter("L1", "ash"), letter("L2", "birch")] });
    await w.start(bellSource());
    assert.equal(w.unread(), 2);
    w.store.delete("pm.notif.mailcache." + MOSS_HOUSE);               // no cache to fall back on: only the rows on screen remain
    w.state.failLetters = true; w.state.failMode = mode === "throw" ? "throw" : "notok";
    await w.advanceTo(at("2026-11-10T12:00:50Z"));
    assert.equal(w.unread(), 2, `${mode}: the bell is not blanked by a failed look`);
    assert.equal(w.timers.length, 1, `${mode}: the next crossing is still scheduled`);
  }
});

test("a signed-out reader (no /me) gets no bell and no timer", async () => {
  const w = world({ now: at("2026-11-10T11:50:00Z"), letters: [letter("L1", "ash")] });
  const src = bellSource();
  w.sandbox.fetch = async () => ({ ok: false, json: async () => null });
  await w.start(src);
  assert.equal(w.timers.length, 0, "no identity, no recheck");
  assert.equal(w.unread(), 0);
});

// ── THE FLIP: the scenario goes red on the layout with each piece of the fix removed ──────────────────────────────────

const MUTANTS = [
  ["no-recheck", "      scheduleCrossingRecheck();\n", "", "the crossing recheck is deleted"],
  ["cache-ignores-crossing", " && cached.ts >= lastCrossingAt(Date.now())", "", "a young pre-crossing cache is trusted"],
  ["no-revalidate", "...(opts.revalidate ? { cache: \"no-cache\" } : {})", "", "the recheck lets the browser's HTTP cache answer"],
];
for (const [label, from, to, why] of MUTANTS) {
  test(`FLIP ${label}: the scenario is red on a layout where ${why}`, async () => {
    const text = readFileSync(new URL("../src/layouts/PostmarkLayout.astro", import.meta.url), "utf8");
    assert.ok(text.includes(from), `the flip's anchor is still in the layout: ${label}`);
    await assert.rejects(scenario(bellSource(text.split(from).join(to))), (e) => e?.name === "AssertionError", `${label} must be caught`);
  });
}
test("FLIP no-failure-fallback: the failed-recheck test is red on a layout whose recheck drops the rows on screen when the look fails", async () => {
  const text = readFileSync(new URL("../src/layouts/PostmarkLayout.astro", import.meta.url), "utf8");
  const from = "{ revalidate: true, fallback: rows }";
  assert.ok(text.includes(from));
  const w = world({ now: at("2026-11-10T11:50:00Z"), letters: [letter("L1", "ash"), letter("L2", "birch")] });
  await w.start(bellSource(text.split(from).join("{ revalidate: true }")));
  w.store.delete("pm.notif.mailcache." + MOSS_HOUSE);
  w.state.failLetters = true;
  await w.advanceTo(at("2026-11-10T12:00:50Z"));
  assert.notEqual(w.unread(), 2, "without the fallback a failed look blanks the bell: the real test above would be red");
});
