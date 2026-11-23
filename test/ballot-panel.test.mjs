// ballot-panel.test.mjs — the Ballot House panel on /town/ reads the office's open ballots live (POS-1060), and the two "works today · likely to change soon" chips (POS-1065's wording, after POS-1060's "changing soon" and the retracted "paused").
//
//   node --test test/ballot-panel.test.mjs
//
// Darko, 2026-11-15: the Ballot House "to be the main place where you see the ballots ... right now that portion is just kind of a redirect,
// unlike the quest guild or think tank." Wright's go: the open ballots in the civic panel, read live; /votes/ stays the full view; a real
// card (no "coming soon"); and, from POS-1065's site half, a "changing soon" chip on the Bounty Board and the Marketplace, "a label, not new
// state".
//
// WHAT THIS HOLDS: (1) the answer is sorted the way the office's lifecycle says (open vs past vs unsortable), and an answer that cannot be
// read is a different sentence from none; (2) every figure and word is the office's, escaped, with an unreadable figure never 0; (3) the
// mount reads the office's /votes, draws, and a second answer changes it with no rebuild, a slow older answer never puts an old tally back,
// and a failed refresh never leaves the last tally standing as current; (4) it only reads (no POST, no form); (5) the page's shell holds no
// tally and keeps the door to /votes/; (6) the Ballot House is live (no "coming soon") and the two chips are exactly two labels that leave
// both doors as they were. The rendered page is test/ballot-panel-browser.test.mjs.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readBallots, panelHtml, mountBallotPanel, stakedOf, OPEN_STATUSES, MAX_DESIGNS } from "../src/lib/ballot-panel.mjs";
import { LANES, CHANGE_SOON_LABEL } from "../src/lib/civic.mjs";
import { tutorialFor } from "../src/lib/civic-tutorial.mjs";

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

const d = (candidate, staked, backing_households) => ({ candidate, staked, ...(backing_households === undefined ? {} : { backing_households }) });
const OPEN = { topic: "harbor-lantern", title: "Pick the harbor lantern", status: "staking", window: "Backing closes at the 12:00 crossing", candidates: [d("Brass Fox", 14, 4), d("Reed Heron", 9, 3), d("Tin Moth", 0, 0)] };
const SUBMISSIONS = { topic: "ferry-name", title: "Name the new ferry", status: "submissions", window: "Designs are taken until the 18th", candidates: [] };
const CLOSED = { topic: "quay-banner", title: "Choose the quay banner", status: "closed", candidates: [d("Sea Green", 21, 6)] };

// ── (1) sorting ─────────────────────────────────────────────────────────────

test("an answer that cannot be read is unreadable, never 'no open ballots' (every shape)", () => {
  for (const bad of [null, undefined, "x", 7, [], {}, { topics: null }, { topics: "none" }, { topics: {} }, { error: "bounce" }, { note: "n", awaiting_intake: ["t"] }]) {
    assert.equal(readBallots(bad).state, "unreadable", JSON.stringify(bad));
    const html = panelHtml(bad);
    assert.match(html, /data-ballot-state="unreadable"/);
    assert.match(html, /could not be read/);
    assert.doesNotMatch(html, /No open ballots/, "an unreadable box is never said to be empty");
  }
});

test("only a readable empty list, or one with only past ballots, says none are open", () => {
  for (const data of [{ topics: [] }, { topics: [CLOSED] }, { topics: [CLOSED, { ...CLOSED, topic: "b" }] }]) {
    assert.equal(readBallots(data).state, "none");
    const html = panelHtml(data);
    assert.match(html, /data-ballot-state="none"/);
    assert.match(html, /No open ballots right now/);
    assert.match(html, /in the Ballot Box/, "and where the past ones are");
    assert.doesNotMatch(html, /Choose the quay banner|Sea Green/, "a past ballot is not drawn in this panel");
  }
  assert.match(panelHtml({ topics: [CLOSED, { ...CLOSED, topic: "b" }] }), /2 past ballots are in the Ballot Box/);
});

test("open means staking or submissions; closed is past; an unknown status is never drawn as open and never taken for past", () => {
  assert.deepEqual(Object.keys(OPEN_STATUSES).sort(), ["staking", "submissions"]);
  const r = readBallots({ topics: [OPEN, SUBMISSIONS, CLOSED] });
  assert.deepEqual([r.state, r.open.map((b) => b.topic), r.past, r.unsorted], ["open", ["harbor-lantern", "ferry-name"], 1, 0]);
  // inherited names are not statuses: only the two own keys are open
  for (const inherited of ["constructor", "toString", "hasOwnProperty", "__proto__", "valueOf"]) {
    const r2 = readBallots({ topics: [{ ...OPEN, status: inherited }] });
    assert.deepEqual([r2.state, r2.unsorted], ["none", 1], `${inherited} is not an open status`);
    assert.doesNotMatch(panelHtml({ topics: [{ ...OPEN, status: inherited }] }), /Pick the harbor lantern/);
  }
  const odd = readBallots({ topics: [{ ...OPEN, status: "paused" }] });
  assert.deepEqual([odd.state, odd.unsorted, odd.past], ["none", 1, 0]);
  const html = panelHtml({ topics: [{ ...OPEN, status: "paused" }] });
  assert.match(html, /No ballot is shown as open here/);
  assert.match(html, /not a promise that none is open/, "unsortable is not 'none'");
  assert.doesNotMatch(html, /No open ballots right now/);
  // alongside an open ballot, an unsortable one is a warning, not a silent drop
  assert.match(panelHtml({ topics: [OPEN, null, { topic: "x" }] }), /another ballot may be open/);
});

// ── (2) the office's words and figures ───────────────────────────────────────

test("a ballot shows its name, window, each design's stamps and backing households, and its status in the site's words", () => {
  const html = panelHtml({ topics: [OPEN, SUBMISSIONS] });
  assert.match(html, /data-ballot-state="open"/);
  assert.match(html, /<h3 class="bp-title">Pick the harbor lantern<\/h3>/);
  assert.match(html, /Backing closes at the 12:00 crossing/);
  assert.match(html, /Brass Fox<\/span><span class="bp-n">14 stamps<\/span><span class="bp-houses">4 households backing/);
  assert.match(html, /Reed Heron<\/span><span class="bp-n">9 stamps<\/span><span class="bp-houses">3 households backing/);
  assert.match(html, /Tin Moth<\/span><span class="bp-n">0 stamps<\/span><span class="bp-houses">0 households backing/, "a design the office lists at 0 is shown at 0");
  assert.match(html, /open for backing/);
  assert.match(html, /taking designs/);
  assert.match(html, /No design has been put forward yet/);
});

test("a stake that is not a number is 'not readable', never 0; households only when the office counted them", () => {
  for (const bad of ["lots", null, undefined, {}, NaN, Infinity, -3, "9".repeat(400)]) assert.equal(stakedOf(bad), null, String(bad).slice(0, 20));
  assert.equal(stakedOf(0), 0);
  assert.equal(stakedOf("12"), 12);
  const html = panelHtml({ topics: [{ ...OPEN, candidates: [d("Odd", "lots", undefined), d("Plain", 3)] }] });
  assert.match(html, /Odd<\/span><span class="bp-n is-unreadable">not readable<\/span>/);
  assert.doesNotMatch(html, /Odd<\/span><span class="bp-n">0/);
  assert.doesNotMatch(html, /households backing/, "no household count was sent, none is invented");
  assert.match(html, /Plain<\/span><span class="bp-n">3 stamps<\/span>/);
});

test("a design list that is missing is unreadable, not 'no designs'; a real empty list says none; extra designs are counted", () => {
  assert.match(panelHtml({ topics: [{ ...OPEN, candidates: undefined }] }), /designs could not be read, so none are shown\. That does not mean it has none/);
  assert.match(panelHtml({ topics: [{ ...OPEN, candidates: [] }] }), /The office lists no designs on this ballot yet/);
  assert.match(panelHtml({ topics: [{ ...OPEN, candidates: [d("ok", 1), null, { candidate: 4 }] }] }), /Some of this ballot's designs could not be read/);
  // a NONEMPTY list in which no row can be read is unreadable, never "no designs" (the office did send rows)
  for (const rows of [[{}], [null], [{ candidate: 4 }], [{ candidate: "" }, "x"]]) {
    const html = panelHtml({ topics: [{ ...OPEN, candidates: rows }] });
    assert.match(html, /designs could not be read, so none are shown\. That does not mean it has none/, JSON.stringify(rows));
    assert.doesNotMatch(html, /lists no designs/, JSON.stringify(rows));
  }
  assert.match(panelHtml({ topics: [{ ...SUBMISSIONS, candidates: [{}] }] }), /could not be read, so none are shown/, "also on a ballot taking designs");
  assert.match(panelHtml({ topics: [{ ...SUBMISSIONS, candidates: [] }] }), /No design has been put forward yet/, "a true [] is still empty");
  const many = Array.from({ length: MAX_DESIGNS + 3 }, (_, i) => d(`Design ${i}`, i));
  const html = panelHtml({ topics: [{ ...OPEN, candidates: many }] });
  assert.equal((html.match(/class="bp-design"/g) ?? []).length, MAX_DESIGNS);
  assert.match(html, /\+ 3 more designs in the Ballot Box/);
});

test("every word from the office is escaped text: markup, quotes and links stay strings", () => {
  const evil = '<img src=x onerror="alert(1)"> & "q" \'s\' https://example.com/x';
  const html = panelHtml({ topics: [{ topic: 'a"b<c', title: evil, status: "staking", window: evil, candidates: [d(evil, 1, 1)] }] });
  assert.doesNotMatch(html, /<img|onerror="alert|<script/);
  assert.match(html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
  assert.match(html, /data-ballot="a&quot;b&lt;c"/);
  assert.doesNotMatch(html, /<a /, "no link is drawn from the office's text");
  // a title is the office's; the slug's words are only the fallback
  assert.match(panelHtml({ topics: [{ topic: "ferry-name", status: "staking", candidates: [] }] }), /<h3 class="bp-title">ferry name<\/h3>/);
});

// ── (3)(4) the mount ─────────────────────────────────────────────────────────

const fakeHost = () => ({ innerHTML: "", attrs: {}, setAttribute(k, v) { this.attrs[k] = String(v); } });
const ok = (body) => ({ ok: true, json: async () => body });
const settle = () => new Promise((r) => setTimeout(r, 0));

test("it reads GET <office>/votes (public, JSON) and draws; nothing else is ever asked or sent", async () => {
  const calls = [];
  const host = fakeHost();
  const p = mountBallotPanel(host, { fetchImpl: async (url, init) => { calls.push([url, init]); return ok({ topics: [OPEN] }); }, base: "/api" });
  await p.ready;
  assert.deepEqual(calls.map(([u]) => u), ["/api/votes"]);
  assert.equal(calls[0][1].method ?? "GET", "GET");
  assert.deepEqual(calls[0][1].headers, { accept: "application/json" });
  assert.equal(calls[0][1].body, undefined, "a read sends no body");
  assert.match(host.innerHTML, /Pick the harbor lantern/);
  assert.equal(host.attrs["aria-busy"], "false");
});

test("a second answer changes the panel with no rebuild: more backing, a closed ballot leaves, the box can go empty", async () => {
  let answer = { topics: [OPEN, CLOSED] };
  let t = 0;
  const host = fakeHost();
  const p = mountBallotPanel(host, { fetchImpl: async () => ok(answer), base: "/api", now: () => t, minAge: 1000 });
  await p.ready;
  assert.match(host.innerHTML, /Brass Fox<\/span><span class="bp-n">14 stamps/);
  answer = { topics: [{ ...OPEN, candidates: [d("Brass Fox", 20, 6), d("Reed Heron", 9, 3)] }] };
  await p.refresh();                          // inside minAge: not read again, so the old tally stands only for those few seconds
  assert.match(host.innerHTML, /14 stamps/);
  t = 5000;
  await p.refresh();
  assert.match(host.innerHTML, /Brass Fox<\/span><span class="bp-n">20 stamps<\/span><span class="bp-houses">6 households backing/);
  assert.doesNotMatch(host.innerHTML, /Tin Moth/, "a design that left the answer leaves the panel");
  answer = { topics: [CLOSED] };
  await p.refresh({ force: true });
  assert.match(host.innerHTML, /No open ballots right now/);
  assert.doesNotMatch(host.innerHTML, /harbor lantern/i);
});

test("unreadable then readable: a failed read says so at once, and the next refresh recovers without waiting out minAge", async () => {
  const replies = [{ topics: [OPEN] }, "refuse", "throw", "garbage", { topics: [OPEN] }];
  let t = 0;
  const host = fakeHost();
  const fetchImpl = async () => {
    const r = replies.shift();
    if (r === "refuse") return { ok: false, status: 503, json: async () => ({ awaiting_intake: ["harbor-lantern"] }) };
    if (r === "throw") throw new Error("connection dropped");
    if (r === "garbage") return { ok: true, json: async () => { throw new SyntaxError("not json"); } };
    return ok(r);
  };
  const p = mountBallotPanel(host, { fetchImpl, base: "/api", now: () => t, minAge: 60_000 });
  await p.ready;
  assert.match(host.innerHTML, /Pick the harbor lantern/);
  await p.refresh({ force: true });
  assert.match(host.innerHTML, /data-ballot-state="unreadable"/, "a refusal is unreadable, and the last good tally is NOT left standing as current");
  assert.doesNotMatch(host.innerHTML, /harbor lantern/);
  await p.refresh();                          // still unreadable: read again at once, not after minAge
  assert.match(host.innerHTML, /data-ballot-state="unreadable"/);
  await p.refresh();
  assert.match(host.innerHTML, /data-ballot-state="unreadable"/);
  await p.refresh();
  assert.match(host.innerHTML, /Pick the harbor lantern/, "recovered");
});

test("only the LATEST read draws: a slow older answer cannot put an old tally back", async () => {
  let release;
  const slow = new Promise((r) => { release = r; });
  const answers = [() => slow.then(() => ok({ topics: [{ ...OPEN, candidates: [d("Brass Fox", 1)] }] })), () => ok({ topics: [{ ...OPEN, candidates: [d("Brass Fox", 99)] }] })];
  const host = fakeHost();
  const p = mountBallotPanel(host, { fetchImpl: () => answers.shift()(), base: "/api", minAge: 0 });
  const second = p.refresh({ force: true });     // waits for ready, so release the first and let it settle
  release();
  await p.ready;
  await second;
  await settle();
  assert.match(host.innerHTML, /99 stamps/);
  assert.doesNotMatch(host.innerHTML, /1 stamp</, "the older answer did not draw over the newer");
});

test("it re-reads when the reader opens the panel (the fragment becoming #ballot-house) and for no other fragment", async () => {
  const listeners = [];
  const win = { location: { hash: "" }, addEventListener: (type, fn) => { if (type === "hashchange") listeners.push(fn); } };
  let answer = { topics: [OPEN] }, reads = 0;
  const host = fakeHost();
  const p = mountBallotPanel(host, { fetchImpl: async () => { reads += 1; return ok(answer); }, base: "/api", win, now: () => 0, minAge: 0 });
  await p.ready;
  assert.equal(listeners.length, 1, "one listener");
  answer = { topics: [{ ...OPEN, candidates: [d("Brass Fox", 77, 9)] }] };
  win.location.hash = "#quests"; listeners[0](); await settle();
  assert.equal(reads, 1, "another panel's fragment reads nothing");
  win.location.hash = "#ballot-house"; listeners[0](); await settle(); await settle();
  assert.equal(reads, 2);
  assert.match(host.innerHTML, /77 stamps/, "opening the panel shows the office's newer answer");
});

test("no host, no fetch: a missing mount point is a no-op, and a missing fetch is unreadable, never a crash or an empty box", async () => {
  await mountBallotPanel(null).ready;
  const host = fakeHost();
  await mountBallotPanel(host, { fetchImpl: undefined, base: "/api" }).ready;
  assert.match(host.innerHTML, /data-ballot-state="unreadable"/);
});

// ── (5) the page's shell ─────────────────────────────────────────────────────

test("the Town page's Ballot House shell holds no tally, keeps the door to /votes/, and mounts the read once", () => {
  const page = read("town/pages/town/index.astro");
  // the panel's markup, without the page's own `{/* … */}` comments (they explain, and are not served)
  const panel = page.slice(page.indexOf('id="ballot-house"'), page.indexOf("end of the panel")).replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
  assert.ok(panel.includes("data-ballot-panel"), "the live region is there");
  assert.match(panel, /Reading the ballot box…/, "and says it is reading until the office answers");
  assert.match(panel, /<noscript>[\s\S]*href="\/votes\/"/, "with no script the door to the full view is still a link");
  assert.match(panel, /<a class="c-door" href="\/votes\/">Open the Ballot Box →<\/a>/, "the full-view door stays");
  assert.match(panel, /<LaneTutorial lane=\{LANE_BY\.votes\}/, "the '?' the live-lane law asks for is mounted");
  for (const baked of [/harbor|lantern|Iris|illuminator|hearth-contest/i, /\d+ stamps/, /open for backing/, /No open ballots/, /could not be read/]) assert.doesNotMatch(panel, baked, `baked into the page: ${baked}`);
  assert.doesNotMatch(panel, /fetch\(|innerHTML/, "the read is the helper's, not inline in the shell");
  const script = page.slice(page.indexOf('import { mountBallotPanel }'));
  // POS-1066 A: the mount is handed the build's Hearth preview map, read back from the panel's own attribute
  assert.match(script.slice(0, 900), /const host = document\.querySelector\("\[data-ballot-panel\]"\);[\s\S]*mountBallotPanel\(host, \{ previews: readPreviews\(host\?\.getAttribute\("data-hearth-previews"\)\), titles: readTitles\(host\?\.getAttribute\("data-hearth-titles"\)\) \}\)/);
  assert.ok(!page.includes('addEventListener("hashchange"'), "the page holds no hashchange listener (a founder law: a click's hashchange must not scroll): the helper re-reads on it");
  // the page ships no stake form or sign-in for this panel
  assert.doesNotMatch(read("src/lib/ballot-panel.mjs").replace(/^\s*\/\/.*$/gm, ""), /ballot-stake|mountBallotStake|\bPOST\b|method:|oauth|\btoken\b|\bbody:/i, "the panel's code only reads");
});

// ── (6) the card and the chips ───────────────────────────────────────────────

test("the Ballot House is live: no 'coming soon' on its building or its panel, and the world's standing stays a separate fact", () => {
  const votes = LANES.find((l) => l.key === "votes");
  assert.equal(votes.live, true);
  assert.deepEqual(tutorialFor("votes").map((s) => s.step), ["Read the ballots", "Back a design", "Or back it by mail"], "the live-lane law's deck, as POS-1054 wrote it");
  const page = read("town/pages/town/index.astro");
  assert.match(page, /\{!lane\.live && !lane\.changeSoon && <span class="cq-coming">coming soon<\/span>\}/, "the badge is still read from the flag, for the not-live lanes that do not carry the change-soon label");
  assert.ok(page.includes("not standing yet") && /quarter\.built\[lane\.key\]/.test(page), "'not standing yet' is still the world's answer");
  assert.equal(LANES.filter((l) => !l.live).map((l) => l.key).join(), "listings", "only the Marketplace is not live (and it reads works-today-likely-to-change-soon, not coming soon: test/paused-wording.test.mjs)");
});

test("exactly two chips, 'works today · likely to change soon' (POS-1065), on the Bounty Board and the Marketplace: a label that changes no door", () => {
  assert.equal(CHANGE_SOON_LABEL, "works today · likely to change soon");
  assert.deepEqual(LANES.filter((l) => l.changeSoon).map((l) => l.key), ["bounties", "listings"]);
  // both lanes read exactly as they did: live flags and places untouched (the Marketplace is still not live, the Bounty Board live)
  const by = Object.fromEntries(LANES.map((l) => [l.key, l]));
  assert.equal(by.bounties.live, true);
  assert.equal(by.listings.live, false);
  assert.equal(by.bounties.id, "board");
  assert.equal(by.listings.id, "marketplace");
  const page = read("town/pages/town/index.astro");
  assert.equal((page.match(/class="cq-change"/g) ?? []).length, 1, "one chip in the card loop, drawn from the flag");
  assert.match(page, /\{lane\.changeSoon && <span class="cq-change">\{CHANGE_SOON_LABEL\}<\/span>\}/);
  // the building is the same anchor to the same panel; nothing here disables it
  assert.match(page, /<a class="cq-b" href=\{`#\$\{LANE_ANCHORS\[lane\.key\]\}`\} data-lane=\{lane\.key\}>/);
  const css = page.slice(page.indexOf(".cq-change {"), page.indexOf(".cq-change {") + 500);
  assert.doesNotMatch(css, /pointer-events|opacity|filter|display:\s*none/, "the chip dims and blocks nothing");
  assert.doesNotMatch(page, /aria-disabled|tabindex="-1"[^>]*cq-b|cq-b[^>]*aria-disabled/, "no building is disabled");
  assert.doesNotMatch(read("src/lib/civic.mjs"), /\bchangeSoon:[^\n]*(disabled|status|flag)/i, "no state rides the label");
});
