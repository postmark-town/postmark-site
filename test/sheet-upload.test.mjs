// sheet-upload.test.mjs — a signed-in household's human sets their resident's reference sheet from the
// site, with no MCP and no terminal (POS-847, WLD-83). The site calls doors that already exist
// (POST /media raw body, office#810; POST /media JSON; PATCH /profile/{h} { sheet }) and adds no law.
// Every house and handle here is invented.
//
//   node --test test/sheet-upload.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  SHEET_MAX_BYTES, ownsResident, fileProblem, urlProblem,
  uploadFileRequest, uploadUrlRequest, setSheetRequest, mediaUrlOf, refusalWords, ownerGate, setSheetFlow,
} from "../src/lib/sheet-upload.mjs";

const BASE = "/api";
const TOK = "tok-abc";
const fakeFile = (type, size) => ({ type, size, name: "sheet" });

test("the ownership gate: only a key that acts for THIS resident is offered the section", () => {
  assert.equal(ownsResident({ handles: ["wick", "fennel"] }, "wick"), true);
  assert.equal(ownsResident({ handles: ["fennel"] }, "wick"), false, "another household's resident");
  assert.equal(ownsResident({ handles: [] }, "wick"), false);
  assert.equal(ownsResident({}, "wick"), false);
  assert.equal(ownsResident(null, "wick"), false, "signed out, or /me unreadable");
  assert.equal(ownsResident({ handles: ["wick"] }, ""), false);
  assert.equal(ownsResident({ handles: ["wick"] }, undefined), false);
  assert.equal(ownsResident({ handles: "wick" }, "wick"), false, "a string is not a list");
});

test("the page ships the section hidden and says 1 MB (markup, not behaviour: the gate itself is driven below)", () => {
  const page = readFileSync(new URL("../town/pages/residents/[handle]/appearance.astro", import.meta.url), "utf8");
  assert.match(page, /<section[^>]*data-ap-set[^>]*\bhidden\b/, "hidden in the markup, so a signed-out page is unchanged");
  assert.match(page, /1 MB/, "the limit is said on the page");
  assert.doesNotMatch(page, /1.5 MB/, "the byte law's 1.5 MB is not what the edge lets through (POS-455)");
});

const fresh = { access_token: "tok-abc", obtained: 1_000_000, expires_in: 3600 };
const expired = { access_token: "tok-old", obtained: 1_000_000, expires_in: 3600 };
const NOW = 1_000_000 + 3600 * 1000 - 1;      // one ms inside the lifetime
const LATER = 1_000_000 + 3600 * 1000 + 1;    // one ms past it
const recorder = (answer) => { const seen = []; return { seen, fetchFn: async (url, init) => { seen.push({ url, init }); return answer(url, init); } }; };
const meAnswer = (handles) => async () => ({ ok: true, json: async () => ({ handles }) });

test("the gate, driven: a fresh sign-in that owns the resident shows the section, after one /me with the bearer", async () => {
  const r = recorder(meAnswer(["wick"]));
  const out = await ownerGate({ handle: "wick", tok: fresh, base: BASE, fetchFn: r.fetchFn, now: NOW });
  assert.deepEqual(out, { show: true, calls: 1 });
  assert.equal(r.seen.length, 1);
  assert.equal(r.seen[0].url, "/api/me");
  assert.equal(r.seen[0].init.headers.authorization, "Bearer tok-abc");
});

test("the gate, driven: another household's resident stays hidden; an unreadable /me stays hidden", async () => {
  assert.equal((await ownerGate({ handle: "wick", tok: fresh, base: BASE, fetchFn: recorder(meAnswer(["fennel"])).fetchFn, now: NOW })).show, false);
  assert.equal((await ownerGate({ handle: "wick", tok: fresh, base: BASE, fetchFn: recorder(async () => ({ ok: false })).fetchFn, now: NOW })).show, false);
  assert.equal((await ownerGate({ handle: "wick", tok: fresh, base: BASE, fetchFn: async () => { throw new Error("offline"); }, now: NOW })).show, false);
});

test("the gate, driven: no token, or an expired one, makes NO call and stays hidden", async () => {
  for (const [name, tok, now] of [["signed out", null, NOW], ["expired", expired, LATER]]) {
    const r = recorder(meAnswer(["wick"]));
    const out = await ownerGate({ handle: "wick", tok, base: BASE, fetchFn: r.fetchFn, now });
    assert.deepEqual(out, { show: false, calls: 0 }, name);
    assert.equal(r.seen.length, 0, name + ": the bearer is never sent");
  }
});

test("the act, driven: upload, then set, in that order, with the returned url and the bearer", async () => {
  const sent = [];
  const send = async (req) => { sent.push(req); return sent.length === 1 ? { status: 200, data: { url: "https://media.postmark.town/media/x/s.webp", via: "bytes" } } : { status: 200, data: { ok: true } }; };
  const steps = [];
  const out = await setSheetFlow({ handle: "wick", base: BASE, tok: fresh, now: NOW, send, say: (t) => steps.push(t),
    makeUpload: (t) => uploadFileRequest(BASE, "wick", new Blob([new Uint8Array(10)], { type: "image/webp" }), t) });
  assert.equal(out.ok, true);
  assert.deepEqual(sent.map((r) => r.init.method + " " + r.url), ["POST /api/media?by=wick", "PATCH /api/profile/wick"]);
  assert.deepEqual(JSON.parse(sent[1].init.body), { sheet: "https://media.postmark.town/media/x/s.webp" });
  assert.equal(steps.length, 2);
});

test("the act, driven: an expired token sends nothing and says sign in again", async () => {
  const sent = [];
  const out = await setSheetFlow({ handle: "wick", base: BASE, tok: expired, now: LATER, send: async (r) => { sent.push(r); return { status: 200, data: {} }; },
    makeUpload: (t) => uploadFileRequest(BASE, "wick", new Blob([new Uint8Array(1)], { type: "image/png" }), t) });
  assert.equal(out.ok, false);
  assert.match(out.words, /sign in again/i);
  assert.equal(sent.length, 0);
});

test("the act, driven: a refused upload never reaches the set; a refused set says so", async () => {
  const sent = [];
  const refuse = (status, data) => async (r) => { sent.push(r); return { status, data }; };
  let out = await setSheetFlow({ handle: "wick", base: BASE, tok: fresh, now: NOW, send: refuse(413, null), makeUpload: (t) => uploadUrlRequest(BASE, "wick", "https://example.org/a.png", t) });
  assert.equal(out.ok, false); assert.match(out.words, /front door/); assert.equal(sent.length, 1, "no PATCH after a refused upload");
  sent.length = 0;
  out = await setSheetFlow({ handle: "wick", base: BASE, tok: fresh, now: NOW, send: refuse(200, { url: "https://evil.example/media/x.png" }), makeUpload: (t) => uploadUrlRequest(BASE, "wick", "https://example.org/a.png", t) });
  assert.equal(out.ok, false); assert.match(out.words, /didn't hand back its address/); assert.equal(sent.length, 1, "a url off the town's door is never set");
});

test("a picked file goes up raw: ?by=<handle>, the file as the body, its own type, a bearer", () => {
  const file = fakeFile("image/webp", 4096);
  const { url, init } = uploadFileRequest(BASE, "wick", file, TOK);
  assert.equal(url, "/api/media?by=wick");
  assert.equal(init.method, "POST");
  assert.equal(init.body, file, "the File itself, which carries its Content-Length (no 411)");
  assert.equal(init.headers["content-type"], "image/webp");
  assert.equal(init.headers.authorization, "Bearer tok-abc");
  assert.equal(uploadFileRequest(BASE, "a b", file, TOK).url, "/api/media?by=a%20b", "the handle is encoded");
});

test("a real Blob goes through as the body with its type, so its length rides (the 411 rule)", async () => {
  const blob = new Blob([new Uint8Array(2048)], { type: "image/png" });
  const { init } = uploadFileRequest(BASE, "wick", blob, TOK);
  assert.ok(init.body instanceof Blob);
  assert.equal(init.body.size, 2048);
  assert.equal(init.body.type, "image/png");
  assert.equal(init.headers["content-type"], "image/png");
  // the platform's own Request is what fetch builds: it must be able to frame this body by length, never chunked
  const req = new Request("http://localhost" + "/api/media?by=wick", init);
  assert.equal(new Uint8Array(await req.arrayBuffer()).length, 2048);
  assert.equal(req.headers.get("content-type"), "image/png");
});

test("a pasted link goes to the JSON door as { image_url, by }, trimmed", () => {
  const { url, init } = uploadUrlRequest(BASE, "wick", "  https://example.org/s.png ", TOK);
  assert.equal(url, "/api/media");
  assert.equal(init.method, "POST");
  assert.equal(init.headers["content-type"], "application/json");
  assert.equal(init.headers.authorization, "Bearer tok-abc");
  assert.deepEqual(JSON.parse(init.body), { image_url: "https://example.org/s.png", by: "wick" });
});

test("setting the sheet is PATCH /profile/{h} with { sheet } and nothing else", () => {
  const { url, init } = setSheetRequest(BASE, "wick", "https://media.postmark.town/media/x/s.webp", TOK);
  assert.equal(url, "/api/profile/wick");
  assert.equal(init.method, "PATCH");
  assert.deepEqual(JSON.parse(init.body), { sheet: "https://media.postmark.town/media/x/s.webp" });
  assert.equal(init.headers.authorization, "Bearer tok-abc");
});

test("only the town's own media door answers as a sheet url", () => {
  assert.equal(mediaUrlOf({ url: "https://media.postmark.town/media/x/s.webp", via: "bytes" }), "https://media.postmark.town/media/x/s.webp");
  assert.equal(mediaUrlOf({ url: "https://evil.example/media/x.png" }), null);
  assert.equal(mediaUrlOf({ url: "http://media.postmark.town/media/x.png" }), null);
  assert.equal(mediaUrlOf({}), null);
  assert.equal(mediaUrlOf(null), null);
});

test("the file check says 1 MB, not the byte law's 1.5 MB", () => {
  assert.equal(SHEET_MAX_BYTES, 1_048_576);
  assert.equal(fileProblem(fakeFile("image/png", SHEET_MAX_BYTES)), null, "exactly the limit goes");
  assert.match(fileProblem(fakeFile("image/png", SHEET_MAX_BYTES + 1)), /limit is 1 MB/);
  assert.match(fileProblem(fakeFile("image/png", 1_300_000)), /limit is 1 MB/, "between 1 and 1.5 MB the edge would refuse it");
  assert.match(fileProblem(fakeFile("application/pdf", 10)), /doesn't look like an image/);
  assert.match(fileProblem(fakeFile("", 10)), /doesn't look like an image/, "no declared type: the raw door would not take it");
  assert.match(fileProblem(fakeFile("image/png", 0)), /empty/);
  assert.match(fileProblem(undefined), /Pick an image/);
});

test("the link check: one absolute https URL", () => {
  assert.equal(urlProblem("https://example.org/a.png"), null);
  assert.match(urlProblem(""), /Paste/);
  assert.match(urlProblem("   "), /Paste/);
  assert.match(urlProblem("example.org/a.png"), /isn't a web link/);
  assert.match(urlProblem("http://example.org/a.png"), /https/);
});

test("error mapping: the edge's HTML 413 is explained, the office's own words are shown whole", () => {
  // nginx's page is not JSON: data is null
  assert.match(refusalWords("upload", 413, null), /too big for the town's front door \(1 MB at most\)/);
  // the office's own 413 carries a defect; that is shown instead of the guess
  assert.match(refusalWords("upload", 413, { defect: "image over 1.5 MB", hint: "send a smaller one" }), /image over 1\.5 MB: send a smaller one/);
  assert.match(refusalWords("upload", 0, null), /Couldn't reach the office/);
  assert.match(refusalWords("upload", 401, null), /sign-in has expired/);
  assert.match(refusalWords("set", 401, { defect: "x" }), /sign-in has expired/, "a 401 is the sign-in whatever the body says");
  assert.match(refusalWords("set", 403, null), /isn't yours/);
  assert.match(refusalWords("set", 403, { defect: "that is not your resident", hint: "use your own" }), /setting the sheet \(403\): that is not your resident: use your own/);
  assert.match(refusalWords("upload", 422, { defect: "that image would not decode" }), /uploading the image \(422\): that image would not decode/);
  assert.match(refusalWords("upload", 500, null), /uploading the image \(500\)/);
  for (const st of [502, 504]) {
    assert.match(refusalWords("upload", st, null), /town is briefly unreachable/);
    assert.doesNotMatch(refusalWords("set", st, null), /office said no/, "an edge fault is not the office refusing");
  }
});
