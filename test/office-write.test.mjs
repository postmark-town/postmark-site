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
// Not office acts, so not held to the header, each named with why: the sign-in's own authorization server (registering the client and trading the
// code), the key mint (an auth door, on Darko's before-merge list as auth), the operator's desk (its route is the operator's, not the site's), the
// fund page's chain verification (keyless, a read of Base), and the helper itself.
const EXCEPTIONS = [
  { file: "src/layouts/PostmarkLayout.astro", near: "AS.register", why: "the sign-in's client registration" },
  { file: "src/layouts/PostmarkLayout.astro", near: "AS.token", why: "the sign-in's code exchange" },
  { file: "src/components/WorldSignIn.astro", near: "AS.register", why: "the viewer sign-in's client registration" },
  { file: "src/components/KeysCard.astro", near: '"/keys"', why: "the key mint: an auth door" },
  { file: "town/pages/ops/desk/index.astro", near: '"/ops/gift"', why: "the operator's desk" },
  { file: "town/pages/fund/[pot].astro", near: '"/fund/verify"', why: "a keyless verification of a chain transaction" },
  { file: "src/lib/office-write.mjs", near: "siteWriteHeaders(token)", why: "the helper itself" },
];

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(mjs|js|astro|ts)$/.test(e.name)) out.push(p);
  }
  return out;
}

test("census (text pin): every office write in the site's pages, components and libraries sends the header, or is a named exception", () => {
  const method = ["method", ":\\s*[\"'](POST|PATCH|PUT|DELETE)[\"']"].join("");   // assembled, so this file is not its own hit
  const found = [];
  for (const file of [...walk(path.join(ROOT, "src")), ...walk(path.join(ROOT, "town"))]) {
    const rel = path.relative(ROOT, file).split(path.sep).join("/");
    const text = fs.readFileSync(file, "utf8");
    for (const m of text.matchAll(new RegExp(method, "g"))) {
      const call = text.slice(Math.max(0, m.index - 260), m.index + 260);
      found.push({ rel, call });
    }
  }
  assert.ok(found.length >= 15, `the census found the site's writes (${found.length}); a census that finds nothing proves nothing`);
  const bare = found.filter(({ rel, call }) => {
    if (/siteWriteHeaders\(|CHANNEL_HEADER|x-postmark-channel|headers: headers\(t\)|\.\.\.bearer\(token\)/.test(call)) return false;
    return !EXCEPTIONS.some((x) => x.file === rel && call.includes(x.near));
  }).map((x) => x.rel);
  assert.deepEqual(bare, [], LAW + "; these writes send no site header: " + bare.join(", "));
  // every exception still names a live write, so a stale one cannot hide a new write
  for (const x of EXCEPTIONS) assert.ok(found.some((f) => f.rel === x.file && f.call.includes(x.near)), `the exception for ${x.why} names a write that is still there`);
});
