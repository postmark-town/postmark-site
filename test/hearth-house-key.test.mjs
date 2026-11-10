// hearth-house-key.test.mjs — a household's saved Hearth is read and saved under its registry KEY, not its page's path (POS-984, Truey's review of 1ba836cd).
//
// A registry key over 96 bytes is a hash in the page's address (src/lib/houses.mjs § housePath), so for such a house `data-hearth-slug` (the path) is NOT
// the name the office knows the house by. The stage once read the saved choice under the path (the office's registry has no such key, so it answered nothing)
// and PATCHed /households/<path>/hearth. Hearth.astro now hands the stage the key beside the path (`data-hearth-key`); the read and the PATCH use the key, and
// only the words about the PAGE (the confirm question) use the path.
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
  assert.match(stage, /entries, slug: key, path: slug,/, "the picker saves to the key and names the page by its path");
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
  return { dataset: {}, hidden: false, textContent: "", value: "", disabled: true, listeners, addEventListener(t, f) { (listeners[t] ??= []).push(f); }, querySelector: () => null, querySelectorAll: () => [], replaceChildren() {}, closest: () => null, ...props };
};
const fire = async (el, type) => { for (const f of el.listeners[type] ?? []) await f({ target: el }); };
const until = async (cond, ms = 3000) => { const end = Date.now() + ms; while (!cond()) { if (Date.now() > end) throw new Error("timed out waiting"); await new Promise((r) => setTimeout(r, 10)); } };
const define = (name, value) => Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });

test("RUN the stage on a long-keyed house: the saved choice is read under the KEY, and the save is PATCHed to the KEY; the confirm question names the PATH", async () => {
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

  const entries = [{ id: "default", title: "Postmark's default", css: "", html: "<p></p>" }, { id: "ledger", title: "The ledger", css: "", html: "<p></p>" }];
  const select = stub({ value: "default" }), owner = stub(), savedLine = stub(), question = stub(), save = stub(), yes = stub();
  const parts = { "[data-hearth-pick]": select, "[data-hearth-owner]": owner, "[data-hearth-saved]": savedLine, "[data-hearth-preview-line]": stub(), "[data-hearth-save]": save, "[data-hearth-clear]": stub(), "[data-hearth-confirm]": stub(), "[data-hearth-question]": question, "[data-hearth-confirm-yes]": yes, "[data-hearth-confirm-no]": stub(), "[data-hearth-said]": stub() };
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

  // the read answered under the KEY: the picker knows the house kept the ledger, and says so
  await until(() => /The ledger/.test(savedLine.textContent));
  const read = calls.find((c) => c.method === "GET" && c.path === "/api/households");
  assert.ok(read && read.search === "?h=wick", `the saved choice was read (${JSON.stringify(calls.map((c) => c.method + " " + c.path))})`);
  assert.equal(savedLine.textContent, "This house’s Hearth: The ledger.", "found under the key: the office's registry has no entry under the path");
  assert.equal(owner.hidden, false, "and the owner's save controls are shown (a signed-in human of this house, the read answered)");

  // the owner previews the default and saves it behind the second yes: the PATCH goes to the KEY
  select.value = "default";
  await fire(select, "change");
  await fire(save, "click");
  assert.match(question.textContent, new RegExp(`/households/${PATH}/\\?`), "the question names the PAGE by its path");
  assert.ok(!question.textContent.includes(KEY), "and never the 129-byte key");
  await fire(yes, "click");
  await until(() => calls.some((c) => c.method === "PATCH"));
  const patch = calls.find((c) => c.method === "PATCH");
  assert.equal(patch.path, `/api/households/${KEY}/hearth`, "the save goes to the registry KEY");
  assert.notEqual(patch.path, `/api/households/${PATH}/hearth`, "and not to the page's hashed path");
  assert.equal(JSON.parse(patch.body).hearth, null);
});
