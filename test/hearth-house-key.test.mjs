// hearth-house-key.test.mjs — a household's saved Hearth is read and saved under its registry KEY, not its page's path (POS-984, Truey's review of 1ba836cd).
//
// A registry key over 96 bytes is a hash in the page's address (src/lib/houses.mjs § housePath), so for such a house `data-hearth-slug` (the path) is NOT
// the name the office knows the house by. The stage once read the saved choice under the path (the office's registry has no such key, so it answered nothing)
// and PATCHed /households/<path>/hearth. Hearth.astro now hands the stage the key beside the path (`data-hearth-key`); the read and the PATCH use the key, and
// the path is the page's own address only. (Until 2026-11-12 a confirm question named the page by its path; POS-999 round 3 removed the question.)
//
// This RUNS the real mountHearth against a hand-rolled DOM (the site carries no DOM library: the shape of test/ballot-stake.test.mjs) and a fetch spy standing
// in for the office, with a 129-byte key (Truey's probe). The office answers the saved-choice read only for the KEY and refuses any other name.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { housePath, buildHouses } from "../src/lib/houses.mjs";
import { KEYS } from "../src/lib/auth.mjs";

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const KEY = "the-household-with-a-key-longer-than-any-directory-name-will-hold-".repeat(2).slice(0, 129);
const PATH = housePath(KEY);

test("the fixture is a long key: 129 bytes, whose page path is a hash and not the key (so the two names differ and the test can tell them apart)", () => {
  assert.equal(new TextEncoder().encode(KEY).length, 129);
  assert.notEqual(PATH, KEY);
  const { bySlug } = buildHouses([{ handle: "wick" }], { households: { [KEY]: { residents: ["wick"] } } });
  const house = bySlug.get(PATH);
  assert.ok(house, "the house is at its hashed path");
  assert.equal(house.slug, KEY, "and still carries its key: the page can hand the stage both");
  assert.equal(house.path, PATH);
});

test("PIN the page hands the stage the key beside the path, and the stage keeps the two apart", () => {
  const page = fs.readFileSync(path.join(ROOT, "src/components/hearth/Hearth.astro"), "utf8");
  assert.match(page, /data-hearth-slug=\{slug\} data-hearth-baked=\{house\.hearth \?\? ""\} data-hearth-key=\{house\.slug \?\? ""\}/);
  const stage = fs.readFileSync(path.join(ROOT, "src/lib/hearth/stage.mjs"), "utf8");
  assert.match(stage, /const key = root\.dataset\.hearthKey \|\| slug;/);
  assert.match(stage, /readSavedHearth\(\{ handles, slug: key, api \}\)/, "the saved-choice read is under the key");
  assert.match(stage, /entries, slug: key, saved: /, "the picker saves to the key");
  assert.ok(!/mountHearthPicker\(pickerRoot, \{[^}]*\bpath: /.test(stage), "and is handed no path: it says nothing that names the page");
});

test("built: every household page carries its page path and its registry key, each in its own attribute", { skip: !fs.existsSync(path.join(ROOT, "dist-town", "households")) }, () => {
  const registry = JSON.parse(fs.readFileSync(path.join(ROOT, "src/data/postmark/households.json"), "utf8")).households;
  const slugs = fs.readdirSync(path.join(ROOT, "dist-town", "households")).filter((s) => fs.existsSync(path.join(ROOT, "dist-town", "households", s, "index.html")));
  assert.ok(slugs.length > 10);
  for (const slug of slugs) {
    const key = Object.keys(registry).find((k) => housePath(k) === slug);
    assert.ok(key, `${slug}: a registry key makes this page`);
    const html = fs.readFileSync(path.join(ROOT, "dist-town", "households", slug, "index.html"), "utf8");
    assert.ok(html.includes(` data-hearth-slug="${slug}" `), `${slug}: the path`);
    assert.ok(html.includes(` data-hearth-key="${key}" `), `${slug}: the key`);
  }
});

// ── a hand-rolled DOM, just enough for the stage ─────────────────────────────
const stub = (props = {}) => {
  const listeners = {};
  return { dataset: {}, attrs: {}, hidden: false, textContent: "", value: "", disabled: true, listeners, addEventListener(t, f) { (listeners[t] ??= []).push(f); }, setAttribute(k, v) { this.attrs[k] = String(v); }, removeAttribute(k) { delete this.attrs[k]; }, querySelector: () => null, querySelectorAll: () => [], replaceChildren() {}, closest: () => null, ...props };
};
const fire = async (el, type) => { for (const f of el.listeners[type] ?? []) await f({ target: el }); };
const until = async (cond, ms = 3000) => { const end = Date.now() + ms; while (!cond()) { if (Date.now() > end) throw new Error("timed out waiting"); await new Promise((r) => setTimeout(r, 10)); } };
const define = (name, value) => Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });

test("RUN the stage on a long-keyed house: the saved choice is read under the KEY, and the green check PATCHes the KEY", async () => {
  const calls = [];
  define("fetch", async (url, init = {}) => {
    const u = new URL(String(url));
    calls.push({ method: init.method ?? "GET", path: decodeURIComponent(u.pathname), search: u.search, body: init.body ?? null });
    const json = (status, body) => ({ ok: status < 400, status, json: async () => body });
    if (u.pathname === "/api/households" && !init.method) return json(200, { registry: { households: { [KEY]: { hearth: "ledger" } } } });   // the office knows the house by its KEY only
    if (init.method === "PATCH") return decodeURIComponent(u.pathname) === `/api/households/${KEY}/hearth` ? json(200, { hearth: null }) : json(404, { defect: "no such household" });
    return json(404, {});
  });
  const store = { [KEYS.token]: JSON.stringify({ access_token: "a-token", obtained: Date.now(), expires_in: 3600 }) };
  const win = { localStorage: { getItem: (k) => store[k] ?? null }, matchMedia: () => ({ matches: false, addEventListener() {} }) };
  define("window", win);
  define("sessionStorage", { getItem: (k) => (k === "pm.oauth.handles" ? JSON.stringify(["wick"]) : null) });
  define("location", { href: `https://postmark.town/households/${PATH}/`, hostname: "postmark.town", origin: "https://postmark.town", search: "" });
  define("history", { replaceState() {} });
  define("CSS", { escape: (s) => s });
  define("document", { addEventListener() {}, querySelector: () => null, createElement: () => ({ content: { querySelectorAll: () => [] }, set innerHTML(_) {} }) });

  const entries = [{ id: "default", title: "Postmark's default", author: "postmark", css: "", html: "<p></p>" }, { id: "ledger", title: "The ledger", author: "postmark", css: "", html: "<p></p>" }];
  const select = stub({ value: "default" }), acts = stub({ hidden: true }), keep = stub(), by = stub();
  const parts = { "[data-hearth-pick]": select, "[data-hearth-by]": by, "[data-hearth-acts]": acts, "[data-hearth-keep]": keep, "[data-hearth-back]": stub(), "[data-hearth-refused]": stub(), "[data-hearth-said]": stub() };
  const pickerRoot = stub({ querySelector: (s) => parts[s] ?? null });
  const stage = stub({ dataset: { hearthEntry: "default" } });
  const at = {
    "[data-hearth-stage]": stage, "[data-hearth-bar]": stub(), "[data-hearth-faces]": { textContent: JSON.stringify({ handles: ["wick"], faces: {} }) },
    "[data-hearth-entries]": { textContent: JSON.stringify(entries) }, "[data-hearth-css]": stub(), "[data-hearth-note]": stub(), "[data-hearth-pick]": select,
    "[data-hearth-holo]": stub(), "[data-hearth-picker]": pickerRoot,
  };
  const root = stub({ dataset: { hearthSlug: PATH, hearthKey: KEY, hearthBaked: "" }, querySelector: (s) => at[s] ?? null });

  const { mountHearth } = await import("../src/lib/hearth/stage.mjs");
  mountHearth(root);

  // the read answered under the KEY: the picker knows the house kept the ledger
  await until(() => pickerRoot.dataset.hearthSaved === "ledger");
  const read = calls.find((c) => c.method === "GET" && c.path === "/api/households");
  assert.ok(read && read.search === "?h=wick", `the saved choice was read (${JSON.stringify(calls.map((c) => c.method + " " + c.path))})`);
  assert.equal(select.value, "ledger", "found under the key (the office's registry has no entry under the path): the dropdown is on the kept design");
  assert.equal(by.textContent, "Designed by postmark", "with its credit");
  assert.equal(acts.hidden, true, "on the kept design there is no check and no x");

  // the owner chooses the default in the dropdown: the check and the x show for the owner (a signed-in human of this house, the read answered); the check PATCHes the KEY
  select.value = "default";
  await fire(select, "change");
  assert.equal(acts.hidden, false, "another design: the check and the x");
  assert.ok(!calls.some((c) => c.method === "PATCH"), "choosing is a preview: nothing sent");
  await fire(keep, "click");
  await until(() => calls.some((c) => c.method === "PATCH"));
  const patch = calls.find((c) => c.method === "PATCH");
  assert.equal(patch.path, `/api/households/${KEY}/hearth`, "the save goes to the registry KEY");
  assert.notEqual(patch.path, `/api/households/${PATH}/hearth`, "and not to the page's hashed path");
  assert.equal(JSON.parse(patch.body).hearth, null);
  await until(() => pickerRoot.dataset.hearthSaved === "" && acts.hidden === true);
  assert.equal(select.attrs["aria-invalid"], undefined, "saved: the check and the x go, and nothing is marked");
});
