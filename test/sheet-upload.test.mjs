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
  uploadFileRequest, uploadUrlRequest, setSheetRequest, mediaUrlOf, refusalWords,
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

test("the page wires the gate: the section starts hidden and is shown only by ownsResident", () => {
  const page = readFileSync(new URL("../town/pages/residents/[handle]/appearance.astro", import.meta.url), "utf8");
  assert.match(page, /<section[^>]*data-ap-set[^>]*\bhidden\b/, "hidden in the markup, so a signed-out page is unchanged");
  assert.match(page, /box\.hidden = !ownsResident\(me, handle\)/);
  assert.match(page, /pm:lens/, "re-checked when the sign-in lands late");
  assert.match(page, /1 MB/, "the limit is said on the page");
  assert.doesNotMatch(page, /1\.5 MB/, "the byte law's 1.5 MB is not what the edge lets through (POS-455)");
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
});
