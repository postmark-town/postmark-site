// key-mint.test.mjs — who the household-key mint stands for (POS-323).
// The card on /join/ stands only for a sign-in that holds a household; signed
// out, expired, refused at /me, or a sign-in with no residents, it stays
// hidden. Driven with a stub section, storage and fetch: the same function the
// card's script calls with the browser's own.

import test from "node:test";
import assert from "node:assert/strict";
import { householdHandles, mintStandsFor, revealMintFor } from "../src/lib/key-mint.mjs";
import { KEYS } from "../src/lib/auth.mjs";

const NOW = Date.parse("2026-10-02T20:00:00Z");
const FRESH = { access_token: "tok-fresh", obtained: NOW - 60_000, expires_in: 3600 };
const STALE = { access_token: "tok-stale", obtained: NOW - 7200_000, expires_in: 3600 };

function storageWith(tok) {
  const m = new Map(tok === undefined ? [] : [[KEYS.token, typeof tok === "string" ? tok : JSON.stringify(tok)]]);
  return { getItem: (k) => (m.has(k) ? m.get(k) : null) };
}

// a stub office: answers /me for the token it is given, and records every call
function officeAnswering(byToken) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    const auth = (init.headers && init.headers.authorization) || "";
    calls.push({ url, auth });
    const tok = auth.replace(/^Bearer /, "");
    if (!(tok in byToken)) return { ok: false, status: 401, json: async () => ({ defect: "no key at the door" }) };
    const me = byToken[tok];
    if (me instanceof Error) throw me;
    return { ok: true, status: 200, json: async () => me };
  };
  return { fetchImpl, calls };
}

test("householdHandles reads either /me shape and keeps only names", () => {
  assert.deepEqual(householdHandles({ handles: ["wright", "rei"] }), ["wright", "rei"]);
  assert.deepEqual(householdHandles({ residents: ["vesper"] }), ["vesper"]);
  assert.deepEqual(householdHandles({ handles: ["", null, 7, "ok"] }), ["ok"]);
  assert.deepEqual(householdHandles({ handles: [] }), []);
  assert.deepEqual(householdHandles(null), []);
  assert.deepEqual(householdHandles("nope"), []);
});

test("mintStandsFor: a fresh sign-in that holds a household, and nothing else", () => {
  // CAN FAIL: show the mint to a reader the office would not mint a household key for.
  assert.equal(mintStandsFor(FRESH, { handles: ["wright"] }, NOW), true);
  assert.equal(mintStandsFor(FRESH, { handles: [] }, NOW), false, "signed in, no house");
  assert.equal(mintStandsFor(FRESH, null, NOW), false, "/me did not answer");
  assert.equal(mintStandsFor(STALE, { handles: ["wright"] }, NOW), false, "an expired sign-in");
  assert.equal(mintStandsFor(null, { handles: ["wright"] }, NOW), false, "signed out");
});

test("revealMintFor: signed out, the card stays hidden and the office is never asked", async () => {
  const section = { hidden: true };
  const office = officeAnswering({});
  const stands = await revealMintFor(section, { storage: storageWith(undefined), fetchImpl: office.fetchImpl, base: "/api", nowMs: NOW });
  assert.equal(stands, false);
  assert.equal(section.hidden, true);
  assert.equal(office.calls.length, 0);
});

test("revealMintFor: a signed-in household sees the card, asked at /me with its own sign-in", async () => {
  const section = { hidden: true };
  const office = officeAnswering({ "tok-fresh": { household: "starforge", handles: ["wright"] } });
  const stands = await revealMintFor(section, { storage: storageWith(FRESH), fetchImpl: office.fetchImpl, base: "http://127.0.0.1:4391", nowMs: NOW });
  assert.equal(stands, true);
  assert.equal(section.hidden, false);
  assert.deepEqual(office.calls, [{ url: "http://127.0.0.1:4391/me", auth: "Bearer tok-fresh" }]);
});

test("revealMintFor: signed in with no house, refused, unreachable, expired or garbled, the card stays hidden", async () => {
  const cases = [
    ["no residents", storageWith(FRESH), { "tok-fresh": { handles: [] } }],
    ["/me refuses", storageWith(FRESH), {}],
    ["/me unreachable", storageWith(FRESH), { "tok-fresh": new Error("offline") }],
    ["expired sign-in", storageWith(STALE), { "tok-stale": { handles: ["wright"] } }],
    ["garbled storage", storageWith("{not json"), {}],
  ];
  for (const [why, storage, answers] of cases) {
    const section = { hidden: false }; // even a card left showing is put away
    const office = officeAnswering(answers);
    const stands = await revealMintFor(section, { storage, fetchImpl: office.fetchImpl, base: "/api", nowMs: NOW });
    assert.equal(stands, false, why);
    assert.equal(section.hidden, true, why);
  }
});
