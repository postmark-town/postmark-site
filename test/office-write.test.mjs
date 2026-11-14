// office-write.test.mjs — every site write tells the office it came from the site (POS-1024, POS-1028).
//
// LAW (Darko, 2026-11-13 09:07 EST, POS-1024): "I'd much rather we keep writes unified and update the existing write path". And POS-1024's
// ruled build list: "every site write sends the site header, so the human's log is whole (four writes today record as the resident's own act)".
// The office files the route from `x-postmark-channel: web` (office src/act-provenance.mjs § routeOfRequest): without it, an act the human takes
// on the site files as the resident's own, by the API.
//
// The behavioural arms drive the real request builders with a fake fetch and read the headers that went out. The census at the end is a TEXT PIN
// (the weakest instrument, labelled so): it finds every office write in the site's pages and components by its method, and asks that each one
// names the header or the helper, or is a named exception with its reason. It is what reaches the inline page scripts no import can.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CHANNEL_HEADER, CHANNEL_WEB, siteWriteHeaders, sendAct, DOOR_PATHS } from "../src/lib/office-write.mjs";
import { submitRsvp } from "../src/lib/rsvp.mjs";
import { postStake } from "../src/lib/ballot-stake.mjs";
import { saveHearth } from "../src/lib/hearth/choice.mjs";
import { profileRequest } from "../src/lib/profile-edit.mjs";
import { uploadFileRequest, uploadUrlRequest, setSheetRequest } from "../src/lib/sheet-upload.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LAW = "POS-1024: every site write sends the site header, so the human's log is whole";

function fakeFetch(answer = { ok: true, status: 200, body: {} }) {
  const seen = [];
  const f = async (url, init) => { seen.push({ url, init }); return { ok: answer.ok, status: answer.status, json: async () => answer.body }; };
  return { f, seen };
}

test("the header and its value are the office's own words (office src/channel.mjs: x-postmark-channel, web)", () => {
  assert.equal(CHANNEL_HEADER, "x-postmark-channel");
  assert.equal(CHANNEL_WEB, "web");
  const h = siteWriteHeaders("tok");
  assert.equal(h[CHANNEL_HEADER], "web", LAW);
  assert.equal(h.authorization, "Bearer tok");
  assert.equal("authorization" in siteWriteHeaders(null), false, "no token, no bearer: the header never stands in for a sign-in");
  assert.equal(siteWriteHeaders("t", { "content-type": "image/png" })["content-type"], "image/png", "a caller's own content type wins");
});

test("sendAct: one act to its door's web twin, as MCP sends it, with the site header; an unknown door sends nothing", async () => {
  const { f, seen } = fakeFetch({ ok: true, status: 200, body: { did: "rsvp" } });
  const r = await sendAct({ base: "https://o.test", door: "household", body: { do: "rsvp", args: { event: "e" } }, token: "tok", fetchImpl: f });
  assert.deepEqual([r.ok, r.status, r.body.did], [true, 200, "rsvp"]);
  assert.equal(seen[0].url, "https://o.test/household");
  assert.equal(seen[0].init.method, "POST");
  assert.equal(seen[0].init.headers[CHANNEL_HEADER], "web", LAW);
  assert.deepEqual(JSON.parse(seen[0].init.body), { do: "rsvp", args: { event: "e" } });
  assert.deepEqual(DOOR_PATHS, { household: "/household", world: "/world/apex", town: "/town/apex" });
  const bad = await sendAct({ base: "https://o.test", door: "elsewhere", body: {}, token: "tok", fetchImpl: f });
  assert.equal(bad.ok, false);
  assert.equal(seen.length, 1, "an unknown door is refused before any request");
  const down = await sendAct({ base: "https://o.test", door: "town", body: {}, token: "tok", fetchImpl: async () => { throw new Error("offline"); } });
  assert.deepEqual([down.ok, down.unreachable], [false, true], "no answer is said as no answer");
});

test("the four writes the proposal named now send the header: the RSVP, the pot stake, the compose page's letter, the World page's act", async () => {
  const rsvp = fakeFetch({ ok: true, status: 200, body: {} });
  await submitRsvp({ base: "https://o.test", token: "tok", body: { do: "rsvp", args: {} }, fetchImpl: rsvp.f });
  assert.equal(rsvp.seen[0].init.headers[CHANNEL_HEADER], "web", "the RSVP: " + LAW);
  // the ballot stake already sent it; it now sends it through the same helper
  const stake = fakeFetch({ ok: true, status: 200, body: {} });
  await postStake({ base: "https://o.test", token: "tok", body: { do: "stake-vote", args: {} }, fetchImpl: stake.f });
  assert.equal(stake.seen[0].init.headers[CHANNEL_HEADER], "web");
  // the three inline or page-script writes are read from their source (text pins, below the census too)
  const pot = fs.readFileSync(path.join(ROOT, "town/pages/fund/[pot].astro"), "utf8");
  assert.match(pot, /var headers = function \(t\) \{ return \{[^}]*"x-postmark-channel": "web"/, "the pot stake (an is:inline script, so it names the header): " + LAW);
  assert.match(fs.readFileSync(path.join(ROOT, "town/pages/mail/compose.astro"), "utf8"), /OFFICE_BASE \+ "\/letters", \{\s*method: "POST",\s*\/\/[^\n]*\n\s*headers: siteWriteHeaders\(tok\.access_token\)/, "the compose page's letter");
  assert.match(fs.readFileSync(path.join(ROOT, "src/components/WorldCockpit.astro"), "utf8"), /body: JSON\.stringify\(envelope\)/);
  assert.match(fs.readFileSync(path.join(ROOT, "src/components/WorldCockpit.astro"), "utf8"), /authed\(\{ "content-type": "application\/json", \[CHANNEL_HEADER\]: CHANNEL_WEB \}\),\s*body: JSON\.stringify\(envelope\)/, "the World page's act");
});

test("the human's other site writes send it too: the Hearth choice, the profile, the sheet upload", async () => {
  const save = fakeFetch({ ok: true, status: 200, body: { hearth: "desk" } });
  await saveHearth({ slug: "fox", id: "desk", token: "tok", api: "https://o.test", fetchImpl: save.f });
  assert.equal(save.seen[0].init.headers[CHANNEL_HEADER], "web", "the Hearth choice");
  assert.equal(profileRequest("https://o.test", "fox", {}, "tok").init.headers[CHANNEL_HEADER], "web", "the profile");
  for (const req of [uploadFileRequest("https://o.test", "fox", { type: "image/png" }, "tok"), uploadUrlRequest("https://o.test", "fox", "https://x/y.png", "tok"), setSheetRequest("https://o.test", "fox", "/media/x.png", "tok")]) {
    assert.equal(req.init.headers[CHANNEL_HEADER], "web", "the sheet: " + req.url);
    assert.equal(req.init.headers.authorization, "Bearer tok");
  }
});

// ── the census (a TEXT PIN) ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// EACH WRITE IS JUDGED BY ITS OWN CALL (review of #420): the request options object that holds its method, found by matching braces in the
// code (strings and comments skipped; an .astro file's <script> blocks only), so a bare write cannot pass beside a neighbour that has the header.
// An exception is matched on that call's own address: the text from its `fetch` to its options object.
// Not office acts, so not held to the header, each named with why: the sign-in's own authorization server (registering the client and trading the
// code), the key mint (an auth door, on Darko's before-merge list as auth), and the fund page's chain verification (keyless, a read of Base).
// (Until the #420 review the operator's desk was excepted too; the office files no operator route, so its gift now sends the header like the rest.)
const EXCEPTIONS = [
  { file: "src/layouts/PostmarkLayout.astro", near: "AS.register", why: "the sign-in's client registration" },
  { file: "src/layouts/PostmarkLayout.astro", near: "AS.token", why: "the sign-in's code exchange" },
  { file: "src/components/WorldSignIn.astro", near: "AS.register", why: "the viewer sign-in's client registration" },
  { file: "src/components/KeysCard.astro", near: '"/keys"', why: "the key mint: an auth door" },
  { file: "town/pages/fund/[pot].astro", near: '"/fund/verify"', why: "a keyless verification of a chain transaction" },
];
// Two file-local helpers that carry the header, each pinned to its own definition below; allowed in their own file only.
const LOCAL_HELPERS = [
  { file: "town/pages/fund/[pot].astro", call: /headers: headers\(t\)/, def: /var headers = function \(t\) \{ return \{[^}]*"x-postmark-channel": "web"/ },
  { file: "src/lib/sheet-upload.mjs", call: /\.\.\.bearer\(token\)/, def: /const bearer = \(token\) => \(\{ authorization: "Bearer " \+ token, \[CHANNEL_HEADER\]: CHANNEL_WEB \}\);/ },
];
const CARRIES = /siteWriteHeaders\(|\[CHANNEL_HEADER\]: CHANNEL_WEB|"x-postmark-channel": "web"/;

/** Every `{` in `code` paired with its `}`, skipping strings, template text and comments: [[open, close], …]. */
function braces(code) {
  const pairs = [], stack = [], modes = [];   // modes: "code" | "tpl" (inside a template literal's text)
  let mode = "code";
  for (let i = 0; i < code.length; i++) {
    const c = code[i], n = code[i + 1];
    if (mode === "tpl") {
      if (c === "\\") { i++; continue; }
      if (c === "`") { mode = modes.pop() ?? "code"; continue; }
      if (c === "$" && n === "{") { modes.push("tpl"); stack.push([i + 1, "tplexpr"]); mode = "code"; i++; }
      continue;
    }
    if (c === "/" && n === "/") { const e = code.indexOf("\n", i); i = e === -1 ? code.length : e; continue; }
    if (c === "/" && n === "*") { const e = code.indexOf("*/", i + 2); i = e === -1 ? code.length : e + 1; continue; }
    if (c === '"' || c === "'") { let j = i + 1; while (j < code.length && code[j] !== c && code[j] !== "\n") j += code[j] === "\\" ? 2 : 1; i = j; continue; }
    if (c === "`") { modes.push("code"); mode = "tpl"; continue; }
    if (c === "{") stack.push([i, "obj"]);
    else if (c === "}") {
      const top = stack.pop();
      if (!top) continue;
      if (top[1] === "tplexpr") { mode = modes.pop() ?? "tpl"; continue; }
      pairs.push([top[0], i]);
    }
  }
  return pairs;
}

/** The writes in one file: { rel, opts (its options object's text), callee (from its fetch to the object) }. */
function writesIn(rel, text) {
  const method = new RegExp(["method", ":\\s*[\"'](POST|PATCH|PUT|DELETE)[\"']"].join(""), "g");   // assembled, so this file is not its own hit
  const chunks = rel.endsWith(".astro")
    ? [...text.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1])
    : [text];
  const out = [];
  for (const code of chunks) {
    const pairs = braces(code);
    for (const m of code.matchAll(method)) {
      const own = pairs.filter(([a, b]) => a < m.index && m.index < b).sort((x, y) => (y[0] - x[0]))[0];
      if (!own) { out.push({ rel, opts: "", callee: "" }); continue; }
      const opts = code.slice(own[0], own[1] + 1);
      const f = code.lastIndexOf("fetch", own[0]);
      const callee = f !== -1 && own[0] - f < 300 ? code.slice(f, own[0]) : "";
      out.push({ rel, opts, callee });
    }
  }
  return out;
}

/** A write's verdict: "header", "exception: <why>", or "bare". */
function verdict(w) {
  if (CARRIES.test(w.opts)) return "header";
  if (LOCAL_HELPERS.some((h) => h.file === w.rel && h.call.test(w.opts))) return "header";
  const x = EXCEPTIONS.find((e) => e.file === w.rel && w.callee.includes(e.near));
  return x ? "exception: " + x.why : "bare";
}

test("the census judges each write by its own call: a bare write beside one with the header is still bare (control on synthetic code)", () => {
  const code = [
    `async function a(t) { await fetch(API + "/household", { method: "POST", headers: siteWriteHeaders(t), body: "{}" }); }`,
    `async function b(t) { await fetch(API + "/letters", { method: "POST", headers: { authorization: "Bearer " + t }, body: JSON.stringify({ x: "}{" }) }); }`,
    `async function c() { await fetch(\`\${API}/x/\${id}\`, { method: "PATCH", headers: { "x-postmark-channel": "web" } }); }`,
  ].join("\n");
  const ws = writesIn("src/lib/synthetic.mjs", code);
  assert.deepEqual(ws.map(verdict), ["header", "bare", "header"], "within 260 characters of a header, the old window passed b; each call is its own now");
  // an exception is matched on the call's own address, not a neighbour's
  const near = writesIn("src/components/KeysCard.astro", `<script>fetch(BASE + "/keys", { method: "POST" }); fetch(BASE + "/other", { method: "POST" });</script>`);
  assert.deepEqual(near.map(verdict), ["exception: the key mint: an auth door", "bare"]);
});

test("the two file-local helpers carry the header in their own definitions", () => {
  for (const h of LOCAL_HELPERS) assert.match(fs.readFileSync(path.join(ROOT, h.file), "utf8"), h.def, h.file);
});

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(mjs|js|astro|ts)$/.test(e.name)) out.push(p);
  }
  return out;
}

test("census (text pin): every office write in the site's pages, components and libraries sends the header on its own call, or is a named exception", () => {
  const found = [];
  for (const file of [...walk(path.join(ROOT, "src")), ...walk(path.join(ROOT, "town"))]) {
    const rel = path.relative(ROOT, file).split(path.sep).join("/");
    found.push(...writesIn(rel, fs.readFileSync(file, "utf8")));
  }
  assert.ok(found.length >= 20, `the census found the site's writes (${found.length}); a census that finds nothing proves nothing`);
  assert.equal(found.filter((w) => !w.opts).length, 0, "every write's own options object was found (none fell back to a guess)");
  const bare = found.filter((w) => verdict(w) === "bare").map((w) => `${w.rel}: ${w.callee.slice(0, 60)}`);
  assert.deepEqual(bare, [], LAW + "; these writes send no site header: " + bare.join(" · "));
  // every exception still names a live write, so a stale one cannot hide a new write
  for (const x of EXCEPTIONS) assert.ok(found.some((w) => verdict(w) === "exception: " + x.why), `the exception for ${x.why} names a write that is still there`);
});
