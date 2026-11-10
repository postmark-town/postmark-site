// band-ballots.test.mjs — the household page's band hosts POS-502's ballot stake form (POS-984).
//
// Darko, 2026-11-09 15:38 EST (POS-684 call 4): "The human stakes from the site (POS-502), in the band." #403 publishes
// `mountBallotStake(root, { topic, choices })`, its CSS and the `pm:ballot-staked` event, and says the household page owns the host
// wiring. This holds the host: which ballots the band lists (the STAKING ones), that the form is mounted for each, that nothing is
// drawn for a house with no open ballot, that a refresh rewrites each choice's stamps IN PLACE (the form and its receipt stay),
// and that only the house's own human loads any of it. The form itself is #403's, tested in test/ballot-stake.test.mjs; the stake
// flow, the bubbling to the stage and the visitor's view are walked in a real browser (qa-shots/hearth-walk.mjs, scenario 13).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mountBandBallots, stakingTopics, topicTitle, choiceRows } from "../src/lib/hearth/band-ballots.mjs";

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const DIST = path.join(ROOT, "dist-town");
const built = fs.existsSync(path.join(DIST, "households"));

// the hand-rolled document of test/ballot-stake.test.mjs (the site carries no DOM library): elements with attributes, text, children,
// hidden, a select's value, listeners, and the document's head
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
  return listeners({ head: make("head"), createElement: make, querySelector: () => null, defaultView: { CustomEvent: class { constructor(type, init) { this.type = type; Object.assign(this, init); } } } });
}
const find = (root, pred) => { if (pred(root)) return root; for (const c of root.children ?? []) { const f = find(c, pred); if (f) return f; } return null; };
const all = (root, pred, out = []) => { if (pred(root)) out.push(root); for (const c of root.children ?? []) all(c, pred, out); return out; };
const byClass = (root, c) => find(root, (e) => (e.attrs?.class ?? e.className ?? "").split(" ").includes(c));
const byName = (root, n) => find(root, (e) => e.attrs?.name === n);
const settle = () => new Promise((r) => setTimeout(r, 0));

const VOTES = {
  topics: [
    { topic: "hearth-contest", status: "staking", window: "four weeks from the announcement", cap_per_household_per_candidate: 20,
      candidates: [{ candidate: "the-ledger", staked: 11, credit: "ada" }, { candidate: "starter-kit", staked: 3 }] },
    { topic: "illuminator-name", status: "closed", candidates: [{ candidate: "iris", staked: 40 }] },
  ],
};
const TOKEN = JSON.stringify({ access_token: "tok", obtained: Date.now(), expires_in: 3600 });
const reply = (status, json) => ({ ok: status < 300, status, json: async () => json });

test("the pure parts: the staking ballots only, a slug as a name, the choices as names and stamps", () => {
  assert.deepEqual(stakingTopics(VOTES).map((t) => t.topic), ["hearth-contest"], "a closed ballot is not staked on");
  assert.deepEqual(stakingTopics(null), []);
  assert.deepEqual(stakingTopics({ topics: [{ status: "staking" }, null, { topic: "", status: "staking" }] }), [], "a row with no topic is no ballot");
  assert.equal(topicTitle("hearth-contest"), "Hearth Contest");
  assert.deepEqual(choiceRows(VOTES.topics[0]), [{ name: "the-ledger", staked: 11 }, { name: "starter-kit", staked: 3 }]);
  assert.deepEqual(choiceRows({ candidates: ["ember", { candidate: "vela", staked: "5" }, { staked: 1 }] }), [{ name: "ember", staked: 0 }, { name: "vela", staked: 5 }]);
});

test("the band lists each STAKING ballot with its choices' stamps, the cap and the real stake form; a closed one gets none", async () => {
  const doc = fakeDocument(), host = doc.createElement("section"); host.hidden = true;
  const sent = [];
  const fetchImpl = async (url, init = {}) => {
    sent.push({ url, method: init.method ?? "GET" });
    if (url === "/api/votes") return reply(200, VOTES);
    if (url === "/api/me") return reply(200, { handles: ["wright", "rei"] });
    return reply(404, {});
  };
  const b = mountBandBallots(host, { doc, fetchImpl, storage: { getItem: (k) => (k === "pm.oauth.token" ? TOKEN : null) }, base: "/api" });
  await b.ready; await settle();
  assert.equal(host.hidden, false, "an open ballot shows the section");
  const blocks = all(host, (e) => e.attrs?.["data-hb-ballot"]);
  assert.deepEqual(blocks.map((e) => e.attrs["data-hb-ballot"]), ["hearth-contest"], "one block, for the staking ballot");
  assert.match(blocks[0].textContent, /Hearth Contest/);
  assert.match(blocks[0].textContent, /four weeks from the announcement/);
  assert.match(blocks[0].textContent, /cap 20 per household per choice/);
  assert.equal(find(blocks[0], (e) => e.attrs?.["data-hb-staked"] === "the-ledger").textContent, "11");
  assert.equal(find(blocks[0], (e) => e.attrs?.["data-hb-staked"] === "starter-kit").textContent, "3");
  const slot = find(blocks[0], (e) => e.attrs?.["data-hb-stake"] === "hearth-contest");
  assert.ok(byClass(slot, "bs-form"), "the stake form POS-502 publishes is mounted in the block");
  const options = all(byName(slot, "candidate"), (e) => e.tagName === "OPTION").map((o) => o.attrs.value);
  assert.deepEqual(options, ["the-ledger", "starter-kit"], "the form offers the ballot's choices");
  assert.equal(byClass(slot, "bs-form").hidden, false, "signed in as a resident: the form shows");
  assert.ok(sent.some((s) => s.url === "/api/votes" && s.method === "GET"), "the ballot is the office's public read");
  assert.ok(sent.every((s) => s.method === "GET"), "nothing is written by drawing the band");
});

test("no open ballot, or an office that cannot be read, draws nothing and keeps the section hidden", async () => {
  for (const [what, fetchImpl] of [
    ["no staking ballot", async () => reply(200, { topics: [VOTES.topics[1]] })],
    ["no ballots at all", async () => reply(200, { topics: [] })],
    ["a refusal", async () => reply(503, {})],
    ["no answer", async () => { throw new Error("offline"); }],
    ["not JSON", async () => ({ ok: true, status: 200, json: async () => { throw new Error("html"); } })],
  ]) {
    const doc = fakeDocument(), host = doc.createElement("section"); host.hidden = true;
    const b = mountBandBallots(host, { doc, fetchImpl, storage: { getItem: () => null }, base: "/api" });
    await b.ready;
    assert.equal(host.hidden, true, `${what}: the section stays hidden`);
    assert.equal(host.children.length, 0, `${what}: no block, no form`);
  }
});

test("a refresh rewrites each choice's stamps IN PLACE: the form and its receipt stay where they are", async () => {
  const doc = fakeDocument(), host = doc.createElement("section");
  let tally = { "the-ledger": 11, "starter-kit": 3 };
  const fetchImpl = async (url) => (url === "/api/votes"
    ? reply(200, { topics: [{ ...VOTES.topics[0], candidates: Object.entries(tally).map(([candidate, staked]) => ({ candidate, staked })) }] })
    : reply(200, { handles: ["rei"] }));
  const b = mountBandBallots(host, { doc, fetchImpl, storage: { getItem: (k) => (k === "pm.oauth.token" ? TOKEN : null) }, base: "/api" });
  await b.ready; await settle();
  const slot = find(host, (e) => e.attrs?.["data-hb-stake"]);
  const out = byClass(slot, "bs-out");
  out.textContent = "rei staked 5 of 5 on the-ledger";            // the receipt the form showed
  const ledger = () => find(host, (e) => e.attrs?.["data-hb-staked"] === "the-ledger");
  const before = ledger();
  tally = { "the-ledger": 16, "starter-kit": 3 };
  await b.refresh();
  assert.equal(ledger().textContent, "16", "the stamps moved");
  assert.equal(ledger(), before, "the same element: nothing was rebuilt");
  assert.equal(find(host, (e) => e.attrs?.["data-hb-staked"] === "starter-kit").textContent, "3", "an unchanged choice stays");
  assert.equal(find(host, (e) => e.attrs?.["data-hb-stake"]), slot, "the stake root is the one it was");
  assert.equal(byClass(slot, "bs-out"), out);
  assert.equal(out.textContent, "rei staked 5 of 5 on the-ledger", "the receipt is still on screen");
  tally = { "the-ledger": 16 };
  await b.refresh();
  assert.equal(find(host, (e) => e.attrs?.["data-hb-staked"] === "starter-kit").textContent, "3", "a choice the office stops listing keeps its last number, never a blank or a zero");
  // an unreadable refresh changes nothing and throws nothing
  const dead = mountBandBallots(doc.createElement("section"), { doc, fetchImpl: async () => { throw new Error("offline"); }, base: "/api" });
  await dead.refresh();
});

test("a confirmed stake, through the real form: the form raises pm:ballot-staked on its root, with the topic, the choice and the resident", async () => {
  const doc = fakeDocument(), host = doc.createElement("section");
  const fetchImpl = async (url, init = {}) => {
    const body = init.body ? JSON.parse(init.body) : null;
    if (url === "/api/votes") return reply(200, VOTES);
    if (url === "/api/me") return reply(200, { handles: ["wright", "rei"] });
    if (body?.args?.preview) return reply(200, { result: { preview: true, handle: "rei", candidate: "the-ledger", requested: 5, applied: 5, clipped: false, household_headroom_before: 20, household_headroom_after: 15, balance_before: 30, balance_after: 25 } });
    return reply(200, { result: { handle: "rei", candidate: "the-ledger", requested: 5, applied: 5, clipped: false, household_headroom_before: 20, household_headroom_after: 15, balance_before: 30, balance_after: 25 } });
  };
  const b = mountBandBallots(host, { doc, fetchImpl, storage: { getItem: (k) => (k === "pm.oauth.token" ? TOKEN : null) }, base: "/api" });
  await b.ready; await settle();
  const slot = find(host, (e) => e.attrs?.["data-hb-stake"]);
  const raised = [];
  slot.addEventListener("pm:ballot-staked", (ev) => raised.push(ev.detail));
  byName(slot, "from").value = "rei"; byName(slot, "candidate").value = "the-ledger"; byName(slot, "stamps").value = "5";
  byClass(slot, "bs-form").dispatchEvent({ type: "submit", preventDefault() {} }); await settle();
  byClass(slot, "bs-confirm").dispatchEvent({ type: "click" }); await settle();
  assert.deepEqual(raised, [{ topic: "hearth-contest", candidate: "the-ledger", from: "rei" }]);
  assert.match(byClass(slot, "bs-out").textContent, /rei staked 5 of 5 on the-ledger/);
});

// ── the wiring (source pins, labelled as such; the browser walk reads the behaviour) ──

// Until 2026-11-10 these two held the band's wiring: the stage mounted the ballots for the house's own sign-in, and the built page shipped the section.
// The band is gone (Darko, 17:14–17:28 EST: the theme is the page; the stake form is off the household page and on /votes/), so they are inverted:
// nothing a household page loads carries the ballots, and /votes/ is where the form is mounted.
test("PIN the household page carries no ballots: the stage imports neither module, and /votes/ is where the stake form is mounted", () => {
  const stage = read("src/lib/hearth/stage.mjs");
  assert.ok(!/band-ballots|ballot-stake|mountBandBallots|pm:ballot-staked/.test(stage), "the household page's script has no ballots and no stake form");
  for (const f of ["src/components/hearth/Hearth.astro", "town/components/HouseholdPage.astro", "town/components/Household.astro", "town/pages/households/[slug].astro"]) {
    assert.ok(!/band-ballots|ballot-stake|data-hb-|hband/.test(read(f)), `${f} names no ballots and no band`);
  }
  const votes = read("town/pages/votes/index.astro");
  assert.match(votes, /import \{ mountBallotStake \} from "@\/lib\/ballot-stake\.mjs";/, "the form is /votes/'s");
  assert.match(votes, /mountBallotStake\(slot, \{ topic: t\.topic, choices: t\.candidates \}\)/, "mounted under each STAKING ballot");
  assert.match(votes, /if \(t\.status !== "staking"\) return;/);
});

test("PIN the words stay text: the band's ballots build no markup from office words, and the form's one module does not either", () => {
  for (const f of ["src/lib/hearth/band-ballots.mjs", "src/lib/ballot-stake.mjs"]) {
    const src = read(f).replace(/\/\/[^\n]*/g, "");
    assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(|new Function|setAttribute\(["']on|\.action\s*=|["']action["']/.test(src), `${f} builds elements and sets text only, with no inline handler and no form action`);
  }
});

test("built: no household page carries a ballots section or a stake form, and /votes/ still ships the slot the form mounts into", { skip: !built }, () => {
  const slugs = fs.readdirSync(path.join(DIST, "households")).filter((s) => fs.existsSync(path.join(DIST, "households", s, "index.html")));
  assert.ok(slugs.length > 10, `household pages read: ${slugs.length}`);
  for (const slug of slugs) {
    const html = fs.readFileSync(path.join(DIST, "households", slug, "index.html"), "utf8");
    assert.ok(!/data-hband|hband-|data-hb-ballot|data-hb-stake|class="bs[ "]|bs-form|bs-confirm/.test(html), `${slug}: no band, no ballots section and no stake form (a resident’s own prose may say stake-vote, so the form’s markers are what is looked for)`);
  }
  assert.ok(fs.readFileSync(path.join(DIST, "votes", "index.html"), "utf8").includes("data-votes"), "/votes/ is built, with the box the tally and the form are drawn into");
});
