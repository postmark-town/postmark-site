// hearth-preview-acts.test.mjs — a house's script acts only where its design is the house's saved choice; in a preview its acts are refused (POS-1029/a).
//
// LAW (Darko, 2026-11-13 13:1x EST, POS-1029/a): "Where chosen; previews read-only". A house that picks a scripted design gets its script in full. In a
// preview (`?entry=`, or any design that isn't the house's saved choice), the script runs, but `hearth.act` does nothing and says so. That way a link
// can never make someone act through a design they didn't choose.
//
// This RUNS the real mountHearth (stage.mjs) against a hand-rolled DOM (the shape of test/hearth-house-key.test.mjs) and a fetch spy standing in for the
// office, with a fake house script handed through mountHearth's `loadScript` seam. The script keeps the `hearth` object it is handed, and the test acts
// through it: so what is asserted is the stage's own wiring of the saved choice into the script's act, not a hand-built state.

import test from "node:test";
import assert from "node:assert/strict";
import { KEYS } from "../src/lib/auth.mjs";
import { PREVIEW_ONLY } from "../src/lib/hearth/script.mjs";

const R1029 = "POS-1029/a: \"Where chosen; previews read-only\"";
const KEY = "wick";
const STAKE = { door: "town", do: "stake", args: { post: "p", stamps: 1 } };

const stub = (props = {}) => {
  const listeners = {};
  return { dataset: {}, attrs: {}, hidden: false, textContent: "", value: "", disabled: true, listeners, addEventListener(t, f) { (listeners[t] ??= []).push(f); }, setAttribute(k, v) { this.attrs[k] = String(v); }, removeAttribute(k) { delete this.attrs[k]; }, querySelector: () => null, querySelectorAll: () => [], replaceChildren() {}, closest: () => null, ...props };
};
const fire = async (el, type) => { for (const f of el.listeners[type] ?? []) await f({ target: el }); };
const until = async (cond, ms = 3000) => { const end = Date.now() + ms; while (!cond()) { if (Date.now() > end) throw new Error("timed out waiting"); await new Promise((r) => setTimeout(r, 10)); } };
const define = (name, value) => Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });

/** Mount the real stage for the house `wick`, whose office says it kept `saved`, at the address `?entry=<entry>` (or none). The reader is wick's own human. */
async function mount({ saved, entry = null }) {
  const calls = [];
  let kept = saved;
  define("fetch", async (url, init = {}) => {
    const u = new URL(String(url));
    calls.push({ method: init.method ?? "GET", path: decodeURIComponent(u.pathname), body: init.body ?? null });
    const json = (status, body) => ({ ok: status < 400, status, json: async () => body });
    if (u.pathname === "/api/households" && !init.method) return json(200, { registry: { households: { [KEY]: { hearth: kept } } } });
    if (init.method === "PATCH" && u.pathname === `/api/households/${KEY}/hearth`) { kept = JSON.parse(init.body).hearth; return json(200, { hearth: kept }); }
    if (init.method === "POST" && u.pathname === "/api/town/apex") return json(200, { staked: true });
    return json(404, {});
  });
  const store = { [KEYS.token]: JSON.stringify({ access_token: "a-token", obtained: Date.now(), expires_in: 3600 }) };
  define("window", { localStorage: { getItem: (k) => store[k] ?? null }, matchMedia: () => ({ matches: false, addEventListener() {} }) });
  define("sessionStorage", { getItem: (k) => (k === "pm.oauth.handles" ? JSON.stringify(["wick"]) : null) });
  const href = `https://postmark.town/households/${KEY}/${entry ? `?entry=${entry}` : ""}`;
  define("location", { href, hostname: "postmark.town", origin: "https://postmark.town", search: entry ? `?entry=${entry}` : "" });
  define("history", { replaceState() {} });
  define("CSS", { escape: (s) => s });
  define("document", { addEventListener() {}, querySelector: () => null, createElement: () => ({ content: { querySelectorAll: () => [] }, set innerHTML(_) {} }) });

  const script = { hash: "0123456789abcdef", bytes: 10 };
  const entries = [
    { id: "default", title: "Postmark's default", author: "postmark", css: "", html: "<p></p>" },
    { id: "ledger", title: "The ledger", author: "postmark", css: "", html: "<p></p>", script },
    { id: "glow", title: "Glow", author: "fox", css: "", html: "<p></p>", script },
  ];
  const select = stub({ value: "default" }), acts = stub({ hidden: true }), keep = stub();
  const parts = { "[data-hearth-pick]": select, "[data-hearth-by]": stub(), "[data-hearth-acts]": acts, "[data-hearth-keep]": keep, "[data-hearth-back]": stub(), "[data-hearth-refused]": stub(), "[data-hearth-said]": stub() };
  const pickerRoot = stub({ querySelector: (s) => parts[s] ?? null });
  const stage = stub({ dataset: { hearthEntry: "default" } });
  const at = {
    "[data-hearth-stage]": stage, "[data-hearth-bar]": stub(), "[data-hearth-faces]": { textContent: JSON.stringify({ handles: ["wick"], faces: {} }) },
    "[data-hearth-entries]": { textContent: JSON.stringify(entries) }, "[data-hearth-css]": stub(), "[data-hearth-note]": stub(), "[data-hearth-pick]": select,
    "[data-hearth-holo]": stub(), "[data-hearth-picker]": pickerRoot,
  };
  const root = stub({ dataset: { hearthSlug: KEY, hearthKey: KEY, hearthBaked: "" }, querySelector: (s) => at[s] ?? null });

  // the fake house script: every design's script keeps the `hearth` it was handed, by the design it was handed for
  const handed = [];
  const loadScript = async (url) => ({ default: (hearth) => { handed.push({ url, hearth }); } });
  const { mountHearth } = await import("../src/lib/hearth/stage.mjs");
  mountHearth(root, { loadScript });
  // settled: the saved choice was read (the picker knows it), and the reader is known as the house's own (the owner view)
  await until(() => root.dataset.hearthShowing && pickerRoot.dataset.hearthSaved !== undefined && stage.dataset.hearthView === "owner");
  const newest = (id) => [...handed].reverse().find((h) => h.hearth.entry === id)?.hearth;
  const posts = () => calls.filter((c) => c.method === "POST");
  return { root, stage, select, keep, acts, pickerRoot, handed, newest, posts, calls };
}

test("RUN the stage, chosen: the house kept glow and the page draws it; its script's act is sent, as the house's own human", async () => {
  const m = await mount({ saved: "glow" });
  await until(() => m.newest("glow"));
  assert.equal(m.root.dataset.hearthShowing, "glow", "the saved choice is drawn");
  const r = await m.newest("glow").act(STAKE);
  assert.equal(r.ok, true, R1029);
  assert.equal(m.posts().length, 1, "one act reached the office");
  assert.equal(m.posts()[0].path, "/api/town/apex");
});

test("RUN the stage, preview via ?entry=: the house kept ledger, a link draws glow; glow's script runs, but its act is refused, says so, and sends nothing", async () => {
  const m = await mount({ saved: "ledger", entry: "glow" });
  await until(() => m.newest("glow"));
  assert.equal(m.root.dataset.hearthShowing, "glow", "the link's design is drawn");
  assert.equal(m.pickerRoot.dataset.hearthSaved, "ledger", "and the house's saved choice is still ledger");
  assert.ok(m.handed.some((h) => h.hearth.entry === "glow"), "the previewed design's script ran");
  const r = await m.newest("glow").act(STAKE);
  assert.equal(r, PREVIEW_ONLY, R1029);
  assert.match(r.body.defect, /only being previewed/);
  assert.equal(m.posts().length, 0, "a preview's act sends nothing");
});

test("RUN the stage, preview then kept: the owner keeps the previewed design with the green check; the redrawn design's script acts at once, without a reload", async () => {
  const m = await mount({ saved: "ledger", entry: "glow" });
  await until(() => m.newest("glow"));
  assert.equal(await m.newest("glow").act(STAKE), PREVIEW_ONLY, "a preview first");
  await until(() => m.acts.hidden === false);   // the check and the x show for the owner on a design that is not the kept one
  const before = m.handed.length;
  await fire(m.keep, "click");
  await until(() => m.pickerRoot.dataset.hearthSaved === "glow" && m.handed.length > before);
  const r = await m.newest("glow").act(STAKE);
  assert.equal(r.ok, true, `kept, so chosen: ${R1029}`);
  assert.equal(m.posts().length, 1);
});

test("RUN the stage, the other way round: the house kept glow, a link previews ledger (also scripted); ledger's act is refused", async () => {
  const m = await mount({ saved: "glow", entry: "ledger" });
  await until(() => m.newest("ledger"));
  assert.equal(m.root.dataset.hearthShowing, "ledger");
  assert.equal(await m.newest("ledger").act(STAKE), PREVIEW_ONLY, R1029);
  assert.equal(m.posts().length, 0);
});
