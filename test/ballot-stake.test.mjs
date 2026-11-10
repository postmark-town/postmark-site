// The household's human stakes on a ballot from /votes/ (POS-502).
//
// Resident-on-behalf v1: the signed-in human picks one of their own residents,
// previews, confirms, and reads an instant receipt; the office judges every
// stake (household { do: "stake-vote" }) and records the human's hand for the
// resident by the site. The site holds no money law and no secret. This pins:
// the body and the transport (the Bearer, the site's channel header, POST
// /household, the preview flag), the words for every answer (preview, staked,
// clipped, zero, refused), that an unanswered confirm is AMBIGUOUS and never
// "nothing was recorded", the standing read that checks what landed, and the
// page's wiring. The confirm/receipt flow itself is walked in a browser.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  stakeBody, stampsOf, residentsOf, choiceNames, answerOf, postStake, readStanding, freshToken, AMBIGUOUS, BALLOT_STAKE_CSS,
} from "../src/lib/ballot-stake.mjs";

const PAGE = readFileSync(new URL("../town/pages/votes/index.astro", import.meta.url), "utf8");
const MODULE = readFileSync(new URL("../src/lib/ballot-stake.mjs", import.meta.url), "utf8");

const fetchOnce = (status, json, seen) => async (url, init) => {
  seen.push({ url, init });
  return { ok: status >= 200 && status < 300, status, json: async () => (json instanceof Error ? (() => { throw json; })() : json) };
};

test("the body is the household door's stake-vote, as an agent's is; preview only when asked", () => {
  assert.deepEqual(stakeBody({ from: "rei", topic: "hearth", candidate: "vela", stamps: "3" }),
    { do: "stake-vote", args: { from: "rei", topic: "hearth", candidate: "vela", stamps: 3 } });
  assert.deepEqual(stakeBody({ from: "rei", topic: "hearth", candidate: "vela", stamps: 3, preview: true }).args.preview, true);
  assert.equal(stampsOf("4"), 4);
  for (const bad of ["0", "-1", "2.5", "", "x", null]) assert.equal(stampsOf(bad), null, String(bad));
});

test("the human acts only as their own residents; a visitor has none; choices are names", () => {
  assert.deepEqual(residentsOf({ handles: ["wright", "rei"] }), ["wright", "rei"]);
  assert.deepEqual(residentsOf({ visitor: true, handles: ["x"] }), []);
  assert.deepEqual(residentsOf(null), []);
  assert.deepEqual(choiceNames([{ candidate: "ember", credit: "ada" }, "vela", { staked: 1 }]), ["ember", "vela"]);
});

test("the transport: POST /household, the Bearer, and the site's channel header (the office records the site and via: web from it)", async () => {
  const seen = [];
  const a = await postStake({ base: "/api", token: "tok", body: stakeBody({ from: "rei", topic: "hearth", candidate: "vela", stamps: 2, preview: true }),
    fetchImpl: fetchOnce(200, { result: { preview: true, handle: "rei", candidate: "vela", requested: 2, applied: 2, clipped: false,
      household_headroom_before: 20, household_headroom_after: 18, balance_before: 15, balance_after: 14, vote_minted: true } }, seen) });
  assert.equal(seen.length, 1);
  assert.equal(seen[0].url, "/api/household");
  assert.equal(seen[0].init.method, "POST");
  assert.equal(seen[0].init.headers.authorization, "Bearer tok");
  assert.equal(seen[0].init.headers["x-postmark-channel"], "web");
  assert.deepEqual(JSON.parse(seen[0].init.body), { do: "stake-vote", args: { from: "rei", topic: "hearth", candidate: "vela", stamps: 2, preview: true } });
  assert.equal(a.kind, "preview");
  assert.equal(a.title, "rei would stake 2 of 2 on vela");
  assert.ok(a.lines.some((l) => /18 stamps of headroom left on vela; rei's balance 14/.test(l)));
  assert.ok(a.lines.some((l) => /first stake on this ballot, so it mints them \+1/.test(l)));
});

test("every answer, in the page's words: staked, clipped, zero, refused", () => {
  const staked = answerOf({ ok: true, status: 200, json: { result: { handle: "rei", candidate: "vela", requested: 14, applied: 11, clipped: true,
    household_headroom_before: 11, household_headroom_after: 0, balance_before: 15, balance_after: 5, vote_minted: true, commit: "abcdef1234567" } } });
  assert.equal(staked.kind, "staked");
  assert.equal(staked.title, "rei staked 11 of 14 on vela");
  assert.match(staked.lines.join("\n"), /The rest clipped: your household had 11 left on vela/);
  assert.match(staked.lines.join("\n"), /headroom left on vela: 0\. rei's balance: 5\./);
  assert.match(staked.lines.join("\n"), /commit abcdef12/);
  const zero = answerOf({ ok: true, status: 200, json: { result: { requested: 1, applied: 0, reason: "your household has no headroom left on this candidate" } } });
  assert.deepEqual([zero.kind, zero.title], ["zero", "no stamps applied: your household has no headroom left on this candidate"]);
  const zeroPreview = answerOf({ ok: true, status: 200, json: { result: { preview: true, requested: 1, applied: 0, reason: "your balance has no stamps free to stake" } } });
  assert.deepEqual([zeroPreview.kind, zeroPreview.preview], ["zero", true]);
  const refused = answerOf({ ok: true, status: 200, json: { error: "bounce", code: 403, defect: '"ada" is not one of your residents', hint: "this key acts for: wright, rei", refused: true } });
  assert.deepEqual([refused.kind, refused.title, refused.lines], ["refused", '"ada" is not one of your residents', ["this key acts for: wright, rei"]]);
  assert.equal(answerOf({ ok: false, status: 500, json: null }).kind, "refused");
});

test("an unanswered confirm is AMBIGUOUS, never 'nothing was recorded': the page checks what landed before it stakes again", async () => {
  const seen = [];
  assert.deepEqual(await postStake({ base: "/api", token: "t", body: stakeBody({ from: "rei", topic: "h", candidate: "v", stamps: 1 }),
    fetchImpl: async (url, init) => { seen.push(url); throw new TypeError("network"); } }), { kind: "unreachable" });
  assert.deepEqual(await postStake({ base: "/api", token: "t", body: stakeBody({ from: "rei", topic: "h", candidate: "v", stamps: 1 }),
    fetchImpl: fetchOnce(200, new SyntaxError("cut off"), []) }), { kind: "unreachable" }, "an answer cut off is no answer");
  assert.equal(seen.length, 1, "sent once, never again by itself");
  assert.match(AMBIGUOUS.title, /may or may not have landed/);
  assert.doesNotMatch(JSON.stringify(AMBIGUOUS), /nothing was (recorded|staked)/i);
  // the mount: an unreachable confirm blocks the confirm until the standing is read and a fresh preview passes
  assert.match(MODULE, /if \(a\.kind === "unreachable"\) \{ blocked = true; checkBtn\.hidden = false; return say\(AMBIGUOUS\); \}/);
  assert.match(MODULE, /if \(sending \|\| !previewed \|\| blocked\) return;/);
  assert.match(MODULE, /if \(a\.kind === "preview" && !blocked\)/);

  const reads = [];
  const st = await readStanding({ base: "/api", token: "t", topic: "hearth", candidate: "vela",
    fetchImpl: async (url, init) => { reads.push([url, init.method ?? "GET", init.headers.authorization]); return { ok: true, json: async () => ({ candidates: [{ candidate: "vela", staked: 25 }], your_household: { headroom: { vela: 0 } } }) }; } });
  assert.deepEqual(st, { staked: 25, headroom: 0 });
  assert.deepEqual(reads, [["/api/votes/hearth", "GET", "Bearer t"]], "the check is a read, never a write");
});

test("the token: only a fresh one is used; signed out, nothing is sent", () => {
  const store = (v) => ({ getItem: () => (v == null ? null : JSON.stringify(v)) });
  assert.equal(freshToken(store({ access_token: "a", obtained: 1_000, expires_in: 10 }), 5_000), "a");
  assert.equal(freshToken(store({ access_token: "a", obtained: 1_000, expires_in: 10 }), 50_000), null);
  assert.equal(freshToken(store(null)), null);
  assert.equal(freshToken({ getItem: () => "{not json" }), null);
});

test("the page: a staking ballot carries the stake form; a closed one does not; the form is the one module, and builds no markup from office words", () => {
  assert.match(PAGE, /import \{ mountBallotStake \} from "@\/lib\/ballot-stake\.mjs"/);
  assert.match(PAGE, /\(open \? '<div class="v-stake" data-stake-slot="' \+ esc\(t\.topic\) \+ '"><\/div>' : ""\)/);
  assert.match(PAGE, /if \(t\.status !== "staking"\) return;[\s\S]*mountBallotStake\(slot, \{ topic: t\.topic, choices: t\.candidates \}\)/);
  assert.doesNotMatch(MODULE, /innerHTML/, "every word goes in as text");
  assert.match(BALLOT_STAKE_CSS, /\.bs \.bs-out\.ambiguous/);
});
