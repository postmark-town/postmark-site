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
  stakeBody, stampsOf, residentsOf, choiceNames, answerOf, postStake, readStanding, freshToken, AMBIGUOUS, UNCONFIRMED, BALLOT_STAKE_CSS,
  holdsConfirm, mountBallotStake,
} from "../src/lib/ballot-stake.mjs";
import { topicHtml, votesHtml } from "../src/lib/votes-render.mjs";

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
  assert.deepEqual([refused.kind, refused.title, refused.lines], ["refused", '"ada" is not one of your residents', ["this key acts for: wright, rei", "Nothing was staked."]],
    "a 4xx confirm was judged before anything was written: a definite refusal");
});

test("a confirm the office answers with a 5xx is UNCONFIRMED, never 'refused': it goes to the check, in words that say an answer came", () => {
  // the office's stake can trip after the stake landed (votes.mjs § stakeViaOffice: "the stake pass tripped", 500)
  for (const [label, r] of [
    ["HTTP 500, the household door's bounce", { ok: false, status: 500, json: { error: "bounce", code: 500, defect: "the stake pass tripped", hint: "the office's own fault" } }],
    ["HTTP 200 carrying a 500 bounce", { ok: true, status: 200, json: { error: "bounce", code: 500, defect: "the stake pass tripped", refused: true } }],
    ["a 503", { ok: false, status: 503, json: { error: "bounce", code: 503, defect: "the stake landed in the town's ledger, and the office's record did not take its vote" } }],
    ["a 5xx with no body", { ok: false, status: 502, json: null }],
  ]) {
    const a = answerOf(r, { as: "rei", candidate: "vela" });
    assert.equal(a.kind, "ambiguous", label);
    assert.equal(a.title, UNCONFIRMED.title, label);
    assert.ok(holdsConfirm(a), `${label}: the confirm is held`);
    assert.doesNotMatch(`${a.title} ${a.lines.join(" ")}`, /did not answer|nothing was (staked|recorded|written)/i, `${label}: neither "no answer" nor "nothing moved"`);
    assert.ok(a.lines.some((l) => /Check what landed/.test(l)), label);
  }
  assert.ok(answerOf({ ok: false, status: 500, json: { error: "bounce", code: 500, defect: "the stake pass tripped" } }).lines.includes("The office said: the stake pass tripped"),
    "the office's own words ride along");
  // a PREVIEW's error is only a failure to say: it wrote nothing, and is not held
  const p = answerOf({ ok: false, status: 500, json: { error: "bounce", code: 500, defect: "the office could not read the ballot" } }, { preview: true });
  assert.deepEqual([p.kind, holdsConfirm(p)], ["refused", false]);
  assert.ok(p.lines.includes("Nothing is staked by a preview."));
  // the held kinds, and only those
  assert.deepEqual(["unreachable", "ambiguous", "refused", "zero", "staked", "preview"].map((kind) => holdsConfirm({ kind })), [true, true, false, false, false, false]);
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
  // the slot is drawn by the tally's one renderer (POS-983's votes-render.mjs § topicHtml); the page mounts the form after it draws
  const cands = [{ candidate: "vela", staked: 3 }];
  assert.match(topicHtml({ topic: "hearth", status: "staking", candidates: cands }), /<div class="v-stake" data-stake-slot="hearth"><\/div><\/article>$/);
  assert.doesNotMatch(topicHtml({ topic: "hearth", status: "closed", candidates: cands }), /data-stake-slot/);
  assert.match(topicHtml({ topic: `a"b`, status: "staking", candidates: [] }), /data-stake-slot="a&quot;b"/, "the slot's topic is escaped for its attribute");
  assert.equal(votesHtml({ topics: [{ topic: "a", status: "staking", candidates: [] }, { topic: "b", status: "staking", candidates: [] }] }).match(/data-stake-slot/g).length, 2);
  assert.match(PAGE, /box\.innerHTML = votesHtml\(data\);[\s\S]*if \(t\.status !== "staking"\) return;[\s\S]*mountBallotStake\(slot, \{ topic: t\.topic, choices: t\.candidates \}\)/);
  assert.doesNotMatch(MODULE, /innerHTML/, "every word goes in as text");
  assert.match(BALLOT_STAKE_CSS, /\.bs \.bs-out\.ambiguous/);
});

// ── the mount, on a hand-rolled document (the site carries no DOM library; test/fund-household.test.mjs is the precedent) ──
// Only what the mount touches: elements with attributes, text, children, hidden/disabled, a select's value
// (its first option's until set), listeners, and the document's head, query and events.
function fakeDocument() {
  const listeners = (o) => { o._on = {}; o.addEventListener = (t, f) => { (o._on[t] ??= []).push(f); }; o.dispatchEvent = (ev) => { for (const f of o._on[ev.type] ?? []) f(ev); return true; }; return o; };
  const make = (tag) => {
    const e = listeners({ tagName: tag.toUpperCase(), attrs: {}, children: [], hidden: false, disabled: false, className: "", _text: "", _value: undefined });
    e.setAttribute = (k, v) => { e.attrs[k] = String(v); };
    e.getAttribute = (k) => e.attrs[k] ?? null;
    e.append = (...kids) => { e.children.push(...kids); };
    e.classList = { add: (c) => { e.className = `${e.className} ${c}`.trim(); } };
    Object.defineProperty(e, "textContent", {
      get: () => e._text + e.children.map((c) => c.textContent).join(" "),
      set: (v) => { e._text = String(v); e.children = []; },
    });
    Object.defineProperty(e, "value", {
      get: () => e._value ?? (e.tagName === "SELECT" ? e.children[0]?.attrs.value ?? "" : e.tagName === "OPTION" ? e.attrs.value : ""),
      set: (v) => { e._value = String(v); },
    });
    return e;
  };
  const head = make("head");
  const doc = listeners({ head, createElement: make, querySelector: () => null, defaultView: { CustomEvent: class { constructor(type, init) { this.type = type; Object.assign(this, init); } } } });
  return doc;
}
const find = (root, pred) => { if (pred(root)) return root; for (const c of root.children ?? []) { const f = find(c, pred); if (f) return f; } return null; };
const byClass = (root, c) => find(root, (e) => (e.attrs?.class ?? e.className ?? "").split(" ").includes(c));
const byName = (root, n) => find(root, (e) => e.attrs?.name === n);
const settle = () => new Promise((r) => setTimeout(r, 0));

test("the held confirm, end to end in the mount: a JSON 500 confirm holds the confirm, a preview cannot release it, the check does, and a fresh preview offers it again; nothing is resent", async () => {
  const doc = fakeDocument();
  const root = doc.createElement("div");
  const storage = { getItem: (k) => (k === "pm.oauth.token" ? JSON.stringify({ access_token: "tok", obtained: Date.now(), expires_in: 3600 }) : null) };
  const sent = [];
  let confirmAnswer = { status: 500, json: { error: "bounce", code: 500, defect: "the stake pass tripped", hint: "the office's own fault" } };
  const fetchImpl = async (url, init = {}) => {
    const body = init.body ? JSON.parse(init.body) : null;
    sent.push({ url, method: init.method ?? "GET", body });
    const reply = (status, json) => ({ ok: status < 300, status, json: async () => json });
    if (url.endsWith("/me")) return reply(200, { handles: ["wright", "rei"] });
    if (url.endsWith("/votes/hearth")) return reply(200, { candidates: [{ candidate: "vela", staked: 11 }], your_household: { headroom: { vela: 9 } } });
    if (body?.args?.preview) return reply(200, { result: { preview: true, handle: body.args.from, candidate: body.args.candidate, requested: 2, applied: 2, clipped: false,
      household_headroom_before: 11, household_headroom_after: 9, balance_before: 15, balance_after: 13, vote_minted: false } });
    return reply(confirmAnswer.status, confirmAnswer.json);
  };
  mountBallotStake(root, { topic: "hearth", choices: [{ candidate: "ember" }, { candidate: "vela" }], doc, storage, fetchImpl, base: "/api" });
  await settle();
  const form = byClass(root, "bs-form"), out = byClass(root, "bs-out");
  const confirm = byClass(root, "bs-confirm"), check = byClass(root, "bs-check");
  assert.equal(form.hidden, false, "signed in: the form shows");
  byName(root, "from").value = "rei"; byName(root, "candidate").value = "vela"; byName(root, "stamps").value = "2";
  const preview = async () => { form.dispatchEvent({ type: "submit", preventDefault() {} }); await settle(); };
  const clickConfirm = async () => { confirm.dispatchEvent({ type: "click" }); await settle(); };
  const confirms = () => sent.filter((s) => s.method === "POST" && !s.body?.args?.preview).length;

  await preview();
  assert.equal(confirm.hidden, false, "previewed: the confirm is offered");
  await clickConfirm();
  assert.equal(confirms(), 1);
  assert.match(out.className, /ambiguous/);
  assert.match(out.textContent, /answered with an error, and could not confirm whether this stake landed/);
  assert.match(out.textContent, /The office said: the stake pass tripped/);
  assert.doesNotMatch(out.textContent, /refused|did not answer|Nothing was staked/);
  assert.deepEqual([confirm.hidden, check.hidden], [true, false], "the confirm is held; the check is offered");

  await clickConfirm();
  assert.equal(confirms(), 1, "a held confirm sends nothing");
  await preview();
  assert.equal(confirm.hidden, true, "a fresh preview does not release a held confirm before the check");

  check.dispatchEvent({ type: "click" }); await settle();
  assert.ok(sent.some((s) => s.url === "/api/votes/hearth" && s.method === "GET"), "the check is the ballot's own read");
  assert.match(out.textContent, /as it stands: vela holds 11 stamps/);
  assert.equal(check.hidden, true);
  assert.equal(confirm.hidden, true, "the check alone offers no confirm");
  await preview();
  assert.equal(confirm.hidden, false, "checked, then previewed afresh: the confirm is offered again");

  // and a definite 4xx refusal is not held: nothing was written, and the human may correct and preview
  confirmAnswer = { status: 409, json: { error: "bounce", code: 409, defect: 'ballot "hearth" is not staking (status: closed)' } };
  await clickConfirm();
  assert.equal(confirms(), 2);
  assert.match(out.className, /refused/);
  assert.match(out.textContent, /Nothing was staked\./);
  assert.equal(check.hidden, true, "a definite refusal needs no check");
  await preview();
  assert.equal(confirm.hidden, false, "after a definite refusal a fresh preview offers the confirm");
});
