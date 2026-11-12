// settlement-notice.test.mjs — the late-settlement notice on the World page and the town's front page (POS-1004, part 2 of 2).
//
//   node --test test/settlement-notice.test.mjs      (no network, no browser, nothing live: invented boards only)
//
// LAW: Darko 20:08 EST, "a small notice on the World page and the town's front page, cleared automatically when the settlement
// lands"; Wright's 2026-11-12 02:14Z approval: ONE state, the words "The latest World settlement is running late. It will show
// here as soon as it's published.", seated on the World page below the top controls and above the view and on the front page
// below the live ticker and above the hero, a "temporary exclamation point", not a banner.
//
// THE PRODUCTION PATH, not a copy: this file takes the component's own client script out of
// src/components/SettlementNotice.astro, hands it the REAL reader and judgment (src/lib/sentinel-alert.mjs) bound to a fake
// browser (clock, fetch, visibility, one minute timer), and drives forced board payloads through it. The rendered check in a
// real browser, at desktop and phone width, is test/settlement-notice-browser.test.mjs.

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import vm from "node:vm";

import * as board from "../src/lib/sentinel-alert.mjs";

const here = (p) => new URL(`../${p}`, import.meta.url);
const read = (p) => readFileSync(here(p), "utf8");
const COMPONENT = read("src/components/SettlementNotice.astro");
const WORDS = "The latest World settlement is running late. It will show here as soon as it's published.";
const NOW = Date.parse("2026-11-12T07:30:00.000Z");
const MIN = 60 * 1000;

const fixture = (settlement, { ageMin = 2, extra = [] } = {}) => JSON.stringify({
  schema: 1, generated_at: new Date(NOW - ageMin * MIN).toISOString(),
  probes: [{ key: "site_home", verdict: "OK" }, ...(settlement ? [{ key: "settlement", label: "the settlement", verdict: settlement, reason: "invented" }] : []), ...extra],
});

// ── the component's own script, run against the real reader ─────────────────────────────────────────────────────────

function scriptOf(source) {
  const m = /<script>([\s\S]*?)<\/script>/.exec(source);
  assert.ok(m, "the component has its one client script");
  return m[1];
}

function page({ source = COMPONENT, moduleOverride = board, origins = [""], variant = "flow" } = {}) {
  const clock = { now: NOW };
  const intervals = [];
  const docL = {}, winL = {};
  const fetches = [];
  const state = { body: null, ok: true, hang: false };
  const env = {
    fetch: async (url, opts) => { fetches.push({ url, opts }); if (state.hang) return new Promise(() => {}); return { ok: state.ok, status: state.ok ? 200 : 404, text: async () => state.body ?? "" }; },
    setInterval: (fn, ms) => { intervals.push({ fn, ms, at: clock.now + ms }); return intervals.length; },
    clearInterval: (id) => { intervals[id - 1] = null; },
    document: { visibilityState: "visible", addEventListener: (t, f) => { (docL[t] ??= []).push(f); }, removeEventListener() {} },
    addEventListener: (t, f) => { (winL[t] ??= []).push(f); }, removeEventListener() {},
  };
  const els = origins.map((o) => ({ hidden: true, dataset: { snOrigin: o }, variant }));
  const sandbox = {
    document: { querySelectorAll: (sel) => (sel === "[data-settlement-notice]" ? els : []) },
    console,
    __board: { ...moduleOverride, readBoardEvery: (o, l, opts) => moduleOverride.readBoardEvery(o, l, { env, ...opts }), settlementNoticeFromBoard: (b) => moduleOverride.settlementNoticeFromBoard(b, { nowMs: clock.now }) },
  };
  const flush = async () => { for (let i = 0; i < 8; i += 1) await new Promise((ok) => setImmediate(ok)); };
  return {
    els, fetches, state, clock,
    start: async () => {
      const src = scriptOf(source).replace(/import\("@\/lib\/sentinel-alert\.mjs"\)/, "Promise.resolve(__board)");
      new vm.Script(`(function(){${src}\n})()`).runInNewContext(sandbox);
      await flush();
    },
    minute: async () => { clock.now += 60_000; for (const i of intervals) if (i && i.at <= clock.now) { i.at += i.ms; i.fn(); } await flush(); },
    ret: async () => { for (const f of docL.visibilitychange ?? []) f(); await flush(); },
    shown: () => els.map((e) => !e.hidden),
  };
}

test("the notice is HIDDEN in the markup and by default; only a fresh settlement DOWN reveals it", async () => {
  assert.match(COMPONENT, /<p class=\{`sn sn-\$\{variant\}`\} data-settlement-notice [^>]*role="status" hidden>/, "hidden in the HTML: a page with no script and no board shows nothing");
  const w = page();
  assert.deepEqual(w.shown(), [false], "before anything is read");
  w.state.body = fixture("DOWN");
  await w.start();
  assert.deepEqual(w.shown(), [true], "a fresh board whose settlement probe is DOWN");
});

test("CONTROLS: OK, STALE, UNKNOWN, INFO, no settlement probe, an old board and a board that is not one all leave it hidden", async () => {
  const cases = [
    ["OK", fixture("OK")], ["STALE", fixture("STALE")], ["UNKNOWN", fixture("UNKNOWN")], ["INFO", fixture("INFO")],
    ["no settlement probe", fixture(null)], ["a 21-minute-old DOWN", fixture("DOWN", { ageMin: 21 })], ["a 10-hour-old DOWN", fixture("DOWN", { ageMin: 600 })],
    ["another probe's DOWN", fixture("OK", { extra: [{ key: "site_refresh", verdict: "DOWN" }, { key: "settlement_tag", verdict: "DOWN" }] })],
    ["not json", "<html>"], ["an array", "[]"], ["empty", ""],
  ];
  for (const [label, body] of cases) {
    const w = page();
    w.state.body = body;
    await w.start();
    assert.deepEqual(w.shown(), [false], label);
  }
  const off = page(); off.state.ok = false; await off.start();
  assert.deepEqual(off.shown(), [false], "no board at all (404)");
});

test("DOWN then OK: the open page CLEARS without a reload, on the minute and on return; and a later DOWN shows it again", async () => {
  const w = page();
  w.state.body = fixture("DOWN");
  await w.start();
  assert.deepEqual(w.shown(), [true]);
  assert.equal(w.fetches.length, 1, "read on load");
  w.state.body = fixture("OK");
  await w.minute();
  assert.deepEqual(w.shown(), [false], "the settlement landed: cleared by the next minute's read, no reload");
  assert.equal(w.fetches.length, 2);
  w.state.body = fixture("DOWN");
  await w.ret();
  assert.deepEqual(w.shown(), [true], "on return to the page it reads at once, and shows again if the board says DOWN");
  w.state.body = fixture("OK");
  await w.ret();
  assert.deepEqual(w.shown(), [false], "and clears on the next return");
});

test("a board that goes old on an open page clears it: a stale reading is never a last-known warning", async () => {
  const w = page();
  w.state.body = fixture("DOWN", { ageMin: 18 });
  await w.start();
  assert.deepEqual(w.shown(), [true], "18 minutes old at load: still readable");
  await w.minute(); await w.minute(); await w.minute();                // the same published board, three minutes older: 21 minutes
  assert.deepEqual(w.shown(), [false], "the same board, past twenty minutes: nothing, not a latched warning");
});

test("a DOWN shown at 18 minutes expires at 20 although the next fetch NEVER finishes: freshness does not wait on the network", async () => {
  const w = page();
  w.state.body = fixture("DOWN", { ageMin: 18 });
  await w.start();
  assert.deepEqual(w.shown(), [true]);
  w.state.hang = true;                                                   // from here every read is deferred forever
  await w.minute();                                                      // 19: the fetch is now pending
  assert.deepEqual(w.shown(), [true], "still readable at 19 minutes");
  await w.minute(); await w.minute();                                    // 21 minutes, the same fetch still pending
  assert.equal(w.fetches.length, 2, "one read is pending, not re-issued on every beat");
  assert.deepEqual(w.shown(), [false], "past twenty minutes it is gone with the fetch still unresolved");
});

test("a DOWN that is already expired at its first minute beat clears as the NEW read starts (that read never finishes)", async () => {
  const w = page();
  w.state.body = fixture("DOWN", { ageMin: 19.5 });
  await w.start();
  assert.deepEqual(w.shown(), [true], "19.5 minutes old at load");
  w.state.hang = true;                                                   // nothing pending yet: the next beat starts the hung read
  await w.minute();                                                      // 20.5 minutes: expired at this very beat
  assert.equal(w.fetches.length, 2, "the new read did start");
  assert.deepEqual(w.shown(), [false], "gone at the beat that starts the read, not a beat later");
});

test("RETURN to the page with an expired cached DOWN and an unresolved read clears it at once", async () => {
  const w = page();
  w.state.body = fixture("DOWN", { ageMin: 18 });
  await w.start();
  w.state.hang = true;
  await w.minute();                                                      // 19 minutes: a read is now pending and never finishes
  assert.deepEqual(w.shown(), [true]);
  w.clock.now += 2 * MIN;                                                // the tab slept two minutes: 21, no beat ran
  await w.ret();
  assert.deepEqual(w.shown(), [false], "on return the cached board is judged again without waiting for the pending read");
  assert.equal(w.fetches.length, 2, "and the pending read is joined, not doubled");
});

test("FLIP: a reader that re-judges only when a read is already pending, or only on a beat, FAILS the two assertions above", async () => {
  const dir = mkdtempSync(join(tmpdir(), "pos1004-flip-"));
  try {
    const src = read("src/lib/sentinel-alert.mjs");
    const beat = "if (!visible()) return; announce(); read();";
    const ret = "if (!visible()) return; announce(); read();";
    assert.equal(src.split(beat).length - 1, 2, "both anchors are in the module");
    const noBeat = src.replace(beat, "if (!visible()) return; if (reader.inflight && reader.last !== undefined) announce(); read();");   // the d29 reader
    const noReturn = src.replace(`const onReturn = () => { ${ret} };`, "const onReturn = () => { if (visible()) read(); };");
    assert.notEqual(noBeat, src); assert.notEqual(noReturn, src);
    const load = async (name, text) => { writeFileSync(join(dir, name), text); return import(pathToFileURL(join(dir, name)).href); };
    const first = async (mod) => { const w = page({ moduleOverride: mod }); w.state.body = fixture("DOWN", { ageMin: 19.5 }); await w.start(); w.state.hang = true; await w.minute(); assert.deepEqual(w.shown(), [false]); };
    const back = async (mod) => { const w = page({ moduleOverride: mod }); w.state.body = fixture("DOWN", { ageMin: 18 }); await w.start(); w.state.hang = true; await w.minute(); w.clock.now += 2 * MIN; await w.ret(); assert.deepEqual(w.shown(), [false]); };
    await first(board); await back(board);
    await assert.rejects(first(await load("a.mjs", noBeat)), (e) => e?.name === "AssertionError", "the d29 reader keeps a first-expired DOWN up while the new read hangs");
    await assert.rejects(back(await load("b.mjs", noReturn)), (e) => e?.name === "AssertionError", "a return that only joins the pending read keeps it up");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("FLIP: a reader that repaints only when a fetch finishes FAILS the deferred-fetch expiry above", async () => {
  const dir = mkdtempSync(join(tmpdir(), "pos1004-flip-"));
  try {
    const src = read("src/lib/sentinel-alert.mjs");
    const text = src.replaceAll("announce(); read();", "read();");
    assert.notEqual(text, src, "the flip's anchor is still in the module");
    writeFileSync(join(dir, "sentinel-alert.mjs"), text);
    const mutant = await import(pathToFileURL(join(dir, "sentinel-alert.mjs")).href);
    const run = async (mod) => {
      const w = page({ moduleOverride: mod });
      w.state.body = fixture("DOWN", { ageMin: 18 });
      await w.start();
      w.state.hang = true;
      await w.minute(); await w.minute(); await w.minute();
      assert.deepEqual(w.shown(), [false]);
    };
    await run(board);
    await assert.rejects(run(mutant), (e) => e?.name === "AssertionError", "the network-gated repaint keeps a stale warning up");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("both notices on one page (the front page's flow seat and the World's overlay are separate pages, but a page may hold more than one) share ONE read", async () => {
  const w = page({ origins: ["", ""] });
  w.state.body = fixture("DOWN");
  await w.start();
  assert.deepEqual(w.shown(), [true, true]);
  assert.equal(w.fetches.length, 1, "one fetch for both, and the header glyph shares it too (its own test pins the shared reader)");
});

test("a failure on load is silent and leaves it hidden (a dev or local build has no sentinel)", async () => {
  const w = page({ moduleOverride: { ...board, readBoardEvery: () => { throw new Error("no reader here"); } } });
  const seen = [];
  const saved = console.debug; console.debug = (...a) => seen.push(a.join(" "));
  try { await w.start(); } finally { console.debug = saved; }
  assert.deepEqual(w.shown(), [false]);
  assert.ok(seen.some((s) => s.includes("stood down")), "it says so at debug and nothing louder");
});

// ── the words, the seats, and "no unconfirmed state" ──────────────────────────────────────────────────────────────────

function srcFiles(dir, out = []) {
  for (const e of readdirSync(new URL(`../${dir}/`, import.meta.url), { withFileTypes: true })) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) srcFiles(p, out); else if (/\.(astro|mjs|js|ts|css|md)$/.test(e.name)) out.push(p);
  }
  return out;
}

test("THE WORDS live in ONE home and are exactly the approved ones; the component renders that constant", () => {
  assert.equal(board.SETTLEMENT_NOTICE_TEXT, WORDS);
  assert.match(COMPONENT, /import \{ SETTLEMENT_NOTICE_TEXT \} from "@\/lib\/sentinel-alert\.mjs";/);
  assert.match(COMPONENT, /<span class="sn-text">\{SETTLEMENT_NOTICE_TEXT\}<\/span>/, "rendered from the one constant at build time");
  const homes = [...srcFiles("src"), ...srcFiles("town")].filter((p) => read(p).includes("It will show here as soon as it's published"));
  assert.deepEqual(homes.filter((p) => !p.startsWith("src/lib/sentinel-alert.mjs")), [], "no second copy of the sentence in the site's source");
});

test("NO 'unconfirmed' STATE exists anywhere: restoring the earlier design is not possible without failing this", () => {
  for (const p of ["src/lib/sentinel-alert.mjs", "src/components/SettlementNotice.astro"]) {
    const text = read(p).replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/<!--[\s\S]*?-->/g, "");
    // sentinel-alert.mjs also holds the header glyph's older code; only the notice's own section is held to this
    const own = p.endsWith("sentinel-alert.mjs") ? text.slice(text.indexOf("export const SETTLEMENT_NOTICE_TEXT")) : text;
    assert.ok(!/can[’']?t confirm|unconfirmed|cannot confirm|is delayed/i.test(own), `${p}: no unconfirmed or 'delayed' wording`);
  }
  assert.deepEqual(board.settlementNoticeFromBoard(JSON.parse(fixture("STALE")), { nowMs: NOW }), { show: false });
  assert.deepEqual(board.settlementNoticeFromBoard(JSON.parse(fixture("UNKNOWN")), { nowMs: NOW }), { show: false });
});

test("FLIP: a judgment that shows on STALE/UNKNOWN or on an old board ('unconfirmed' restored) FAILS the acceptance above", async () => {
  const dir = mkdtempSync(join(tmpdir(), "pos1004-flip-"));
  try {
    // the 'unconfirmed' design: STALE and UNKNOWN (and an old board) say something too
    const text = read("src/lib/sentinel-alert.mjs")
      .replace('return probe && probe.verdict === "DOWN" ? { show: true } : hide;', 'return probe && (probe.verdict === "DOWN" || probe.verdict === "STALE" || probe.verdict === "UNKNOWN") ? { show: true } : hide;')
      .replace("if (age < 0 || age > BOARD_MAX_AGE_MS) return hide;", "");
    assert.notEqual(text, read("src/lib/sentinel-alert.mjs"), "the flip's anchors are still in the module");
    writeFileSync(join(dir, "sentinel-alert.mjs"), text);
    const mutant = await import(pathToFileURL(join(dir, "sentinel-alert.mjs")).href);
    const accept = async (mod) => {
      for (const body of [fixture("STALE"), fixture("UNKNOWN"), fixture("DOWN", { ageMin: 600 })]) {
        const w = page({ moduleOverride: mod });
        w.state.body = body;
        await w.start();
        assert.deepEqual(w.shown(), [false]);
      }
    };
    await accept(board);                                                // the real module passes
    await assert.rejects(accept(mutant), (e) => e?.name === "AssertionError", "the 'unconfirmed' design shows where it must not");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("SEATS: the front page, below the live ticker and above the hero; the World, after the viewer's top controls and before the view's other islands", () => {
  const index = read("town/pages/index.astro");
  const tick = index.indexOf('class="ticker"'), notice = index.indexOf('<SettlementNotice variant="flow" />'), hero = index.indexOf('<section class="hero">');
  assert.ok(tick > 0 && notice > tick && hero > notice, "ticker < notice < hero");
  assert.match(index, /import SettlementNotice from "@\/components\/SettlementNotice\.astro";/);
  assert.equal((index.match(/<SettlementNotice/g) ?? []).length, 1, "once");
  const world = read("town/pages/world.astro");
  assert.match(world, /import SettlementNotice from '@\/components\/SettlementNotice\.astro';/);
  assert.equal((world.match(/<SettlementNotice/g) ?? []).length, 1, "once");
  assert.ok(world.indexOf("<WorldSignIn />") > 0 && world.indexOf('<SettlementNotice variant="over" />') > world.indexOf("<WorldSignIn />"), "after the viewer's top controls cluster");
  assert.ok(world.indexOf('<SettlementNotice variant="over" />') < world.indexOf("<WorldCockpit />"), "and before the cockpit over the view");
});

test("it is a small notice, not a banner: one line, a ring mark, no close button, no full-width block", () => {
  const css = COMPONENT.slice(COMPONENT.indexOf("<style>"));
  assert.ok(!/\.sn[^{]*\{[^}]*(width:\s*100vw|position:\s*sticky)/.test(css), "no full-bleed banner");
  assert.match(css, /\.sn-mark \{[^}]*border-radius: 50%/, "the exclamation point is a small ring");
  assert.ok(!/<button/.test(COMPONENT.slice(0, COMPONENT.indexOf("<script>"))), "no close button: it clears itself");
  assert.match(COMPONENT, /pointer-events: none/, "the floating one never sits in front of a control");
});

test("the layout's glyph still reads the same shared reader (one fetch for both) and its own alert judgment is untouched", () => {
  const layout = read("src/layouts/PostmarkLayout.astro");
  assert.match(layout, /readBoardEvery\(origin, paint\)/);
  assert.match(layout, /alertFromBoard\(board\)/);
  assert.ok(relative(".", ".") === "");
});
