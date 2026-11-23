// ballot-caption.test.mjs — the Hearth ballot names a design "<design title>, by <household>" (CORE-126).
//
//   node --test test/ballot-caption.test.mjs
//
// Darko, 2026-11-18 16:57 EST: "the ballot box shows household names instead of theme/design names for each entry, it should show the theme name
// and by {household}". The fixtures are INVENTED: a folder id, an author and a credit that all differ, and a title with punctuation. This holds:
// (1) the caption is "<title>, by <credit>" from the authored title and the choice's published credit, never the folder or the entry's author;
// (2) it speaks only for the Hearth ballot, only for a known title, and invents nothing (unknown title -> the raw id; no credit -> the title alone);
// (3) a title never depends on previewability; (4) identities are untouched: the option VALUE, the request and the preview's id stay the folder id
// while the control and the site's own words show the caption; (5) both hosts are wired, /votes/ and the Ballot House panel.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { titlesOf, readTitles, captionOf, captionsOf } from "../src/lib/hearth/ballot-caption.mjs";
import { previewHrefs, HEARTH_BALLOT_TOPIC } from "../src/lib/hearth/ballot-links.mjs";
import { panelHtml } from "../src/lib/ballot-panel.mjs";
import { mountBallotStake, answerOf, nameFor, BALLOT_STAKE_CSS } from "../src/lib/ballot-stake.mjs";

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

// an invented design: folder `lantern-glow`, authored title with punctuation, entry author `quillfolk` (a handle), the choice's credit a DIFFERENT household
const ROWS = [
  { id: "lantern-glow", title: "Lantern & Glow: the \"harbor\" house, v2", author: "quillfolk", line: "x", html: "<p></p>", css: "" },
  { id: "plain-one", title: "Plain One", author: "someone-else", line: "x", html: "", css: "" },
];
const TITLES = titlesOf(ROWS);
const CHOICE = { candidate: "lantern-glow", credit: "the-harbor-house", staked: 4 };
const CAPTION = 'Lantern & Glow: the "harbor" house, v2, by the-harbor-house';

test("the caption is '<title>, by <credit>': the authored title and the choice's published credit, never the folder id or the entry's author", () => {
  assert.equal(captionOf(TITLES, HEARTH_BALLOT_TOPIC, "lantern-glow", "the-harbor-house"), CAPTION);
  assert.equal(CAPTION.includes("quillfolk") || CAPTION.includes("lantern-glow"), false);
});

test("it invents nothing: an unknown or unreadable title keeps the raw id; no credit is the title alone; another ballot sharing a design's name is untouched", () => {
  assert.equal(captionOf(TITLES, HEARTH_BALLOT_TOPIC, "never-heard-of", "x"), null, "unknown title: the caller keeps today's raw id");
  assert.equal(captionOf(titlesOf([{ id: "blank", title: "   " }, { id: "num", title: 7 }]), HEARTH_BALLOT_TOPIC, "blank", "x"), null);
  assert.equal(captionOf(TITLES, HEARTH_BALLOT_TOPIC, "plain-one", null), "Plain One", "no published credit: the title alone, no made-up household");
  assert.equal(captionOf(TITLES, "harbor-lantern", "plain-one", "x"), null, "a non-Hearth ballot sharing a design's name is not a design");
  assert.equal(captionOf(TITLES, HEARTH_BALLOT_TOPIC, "constructor", "x"), null, "own keys only");
  assert.deepEqual(captionsOf(TITLES, HEARTH_BALLOT_TOPIC, [CHOICE, { candidate: "never-heard-of", credit: "y" }, "plain-one"]), { "lantern-glow": CAPTION, "plain-one": "Plain One" });
});

test("a long published credit (and title) is shown whole: control/bidi/whitespace are cleaned, but nothing is cut", () => {
  const credit = `${"household-".repeat(17)}END`;            // 173 characters
  assert.ok(credit.length > 160);
  const cap = captionOf(TITLES, HEARTH_BALLOT_TOPIC, "lantern-glow", credit);
  assert.ok(cap.endsWith(`, by ${credit}`), "the whole credit, ending in END");
  const longTitle = `Title ${"long ".repeat(50)}END`;
  assert.ok(captionOf(titlesOf([{ id: "long-one", title: longTitle }]), HEARTH_BALLOT_TOPIC, "long-one", null).endsWith("END"));
  assert.equal(captionOf(TITLES, HEARTH_BALLOT_TOPIC, "plain-one", "a‮b\n\tc  d"), "Plain One, by a b c d", "the cleanup stays");
});

test("the instructions on /votes/ never say a Hearth design is 'its name exactly as listed': the candidate is the office's id field, not the shown title", () => {
  const page = src("town/pages/votes/index.astro");
  const lede = /id="how-to-stake"[\s\S]*?<\/p>/.exec(page)[0];
  assert.equal(/written exactly as they are listed/.test(lede), false);
  assert.match(lede, /<span class="v-mono">candidate<\/span> field exactly as the office lists it/);
  assert.match(lede, /A Hearth design is shown on this page by its title, but its candidate is its id, not that title/);
  assert.match(page, /var captioned = t\.candidates\.some\(function \(c\) \{ return captionOf\(titles, t\.topic, c\.candidate, c\.credit\); \}\)/);
  assert.match(page, /captioned\s*\? " and the design is its candidate id, the office's own candidate field for the choice \(GET \/api\/votes\), not the title shown above\. "\s*: " and the design is its name exactly as listed\. "/,
    "a captioned card says the id; an uncaptioned card keeps today's words");
});

test("a title never depends on previewability: a design with no previewable house still gets its title, and the id -> href preview map keeps its shape", () => {
  const lookups = { houses: [], houseOf: () => null };          // nobody's house is declared: no design can be previewed
  assert.deepEqual(previewHrefs(ROWS, lookups), {}, "no preview link (unchanged)");
  assert.equal(captionOf(TITLES, HEARTH_BALLOT_TOPIC, "lantern-glow", "the-harbor-house"), CAPTION, "but the title is still there");
  const withHouse = previewHrefs(ROWS, { houses: [{ slug: "quillfolk", path: "quillfolk", declared: true }], houseOf: () => null });
  assert.deepEqual(Object.keys(withHouse), ["lantern-glow"]);
  assert.match(withHouse["lantern-glow"], /\?entry=lantern-glow$/, "the preview map is still id -> href");
});

test("the map as the page carries it reads back: own ids with a text title only", () => {
  assert.deepEqual(readTitles(JSON.stringify(TITLES)), TITLES);
  assert.deepEqual(readTitles("not json"), {});
  assert.deepEqual(readTitles(JSON.stringify(["a"])), {});
  assert.deepEqual(readTitles(JSON.stringify({ "BAD ID": "x", ok: 5, fine: "Fine" })), { fine: "Fine" });
});

const OPEN = { topic: HEARTH_BALLOT_TOPIC, title: "Postmark's default Hearth", status: "staking", window: "w", candidates: [CHOICE, { candidate: "mystery", credit: "ghost-house", staked: 1 }] };

test("the Ballot House panel names the design '<title>, by <credit>' (escaped), keeps the id in its preview attribute, and an unknown design keeps its raw id", () => {
  const html = panelHtml({ topics: [OPEN] }, { titles: TITLES, previews: { "lantern-glow": "/households/the-harbor-house/?entry=lantern-glow" } });
  assert.ok(html.includes("Lantern &amp; Glow: the &quot;harbor&quot; house, v2, by the-harbor-house"), "the caption, as escaped text");
  assert.ok(html.includes('data-hearth-preview="lantern-glow"'), "the preview keeps the design's id");
  assert.match(html, /<span class="bp-name">mystery/, "an unknown title: today's raw id, no invented household");
  const bare = panelHtml({ topics: [OPEN] });
  assert.match(bare, /<span class="bp-name">lantern-glow/, "a bare call (no titles) is exactly as before");
  const other = panelHtml({ topics: [{ ...OPEN, topic: "harbor-lantern" }] }, { titles: TITLES });
  assert.match(other, /<span class="bp-name">lantern-glow/, "another ballot sharing the name is unchanged");
});

// ── the stake form: the control shows the caption, the value and the request are the id ──
function fakeDocument() {
  const on = (o) => { o._on = {}; o.addEventListener = (t, f) => { (o._on[t] ??= []).push(f); }; o.dispatchEvent = (ev) => { for (const f of o._on[ev.type] ?? []) f(ev); return true; }; return o; };
  const make = (tag) => {
    const e = on({ tagName: tag.toUpperCase(), attrs: {}, children: [], hidden: false, disabled: false, className: "", _text: "", _value: undefined });
    e.setAttribute = (k, v) => { e.attrs[k] = String(v); };
    e.getAttribute = (k) => e.attrs[k] ?? null;
    e.append = (...kids) => { e.children.push(...kids); };
    e.classList = { add: (c) => { e.className = `${e.className} ${c}`.trim(); } };
    Object.defineProperty(e, "textContent", { get: () => e._text + e.children.map((c) => c.textContent).join(" "), set: (v) => { e._text = String(v); e.children = []; } });
    Object.defineProperty(e, "value", { get: () => e._value ?? (e.tagName === "SELECT" ? e.children[0]?.attrs.value ?? "" : e.tagName === "OPTION" ? e.attrs.value : ""), set: (v) => { e._value = String(v); } });
    return e;
  };
  return on({ head: make("head"), createElement: make, querySelector: () => null, defaultView: { CustomEvent: class { constructor(type, init) { this.type = type; Object.assign(this, init); } } } });
}
const find = (root, pred) => { if (pred(root)) return root; for (const c of root.children ?? []) { const f = find(c, pred); if (f) return f; } return null; };
const byClass = (root, c) => find(root, (e) => (e.attrs?.class ?? e.className ?? "").split(" ").includes(c));
const byName = (root, n) => find(root, (e) => e.attrs?.name === n);
const settle = () => new Promise((r) => setTimeout(r, 0));

async function stakeRun(captions) {
  const doc = fakeDocument(), root = doc.createElement("div"), sent = [];
  const storage = { getItem: (k) => (k === "pm.oauth.token" ? JSON.stringify({ access_token: "tok", obtained: Date.now(), expires_in: 3600 }) : null) };
  const fetchImpl = async (url, init = {}) => {
    const body = init.body ? JSON.parse(init.body) : null;
    sent.push({ url, body });
    const reply = (status, json) => ({ ok: status < 300, status, json: async () => json });
    if (url.endsWith("/me")) return reply(200, { handles: ["rei"] });
    if (url.endsWith("/votes/hearth-default")) return reply(200, { candidates: [{ candidate: "lantern-glow", staked: 11 }], your_household: { headroom: { "lantern-glow": 9 } } });
    return reply(200, { result: { preview: !!body?.args?.preview, handle: "rei", candidate: body.args.candidate, requested: 2, applied: 2, clipped: false, household_headroom_before: 11, household_headroom_after: 9, balance_before: 15, balance_after: 13, vote_minted: false } });
  };
  mountBallotStake(root, { topic: "hearth-default", choices: [CHOICE, { candidate: "plain-one" }], doc, storage, fetchImpl, base: "/api", ...(captions ? { captions } : {}) });
  await settle();
  const sel = byName(root, "candidate"), out = byClass(root, "bs-out"), form = byClass(root, "bs-form");
  byName(root, "from").value = "rei"; sel.value = "lantern-glow"; byName(root, "stamps").value = "2";
  form.dispatchEvent({ type: "submit", preventDefault() {} }); await settle();
  byClass(root, "bs-confirm").dispatchEvent({ type: "click" }); await settle();
  byClass(root, "bs-check") && null;
  return { sel, out, sent, root };
}

test("the choice control and the site's own preview / receipt words show the caption; the option VALUE, the request and the id are untouched", async () => {
  const caps = captionsOf(TITLES, HEARTH_BALLOT_TOPIC, [CHOICE, "plain-one"]);
  const { sel, out, sent } = await stakeRun(caps);
  const opts = sel.children;
  assert.deepEqual(opts.map((o) => o.attrs.value), ["lantern-glow", "plain-one"], "values are the original ids");
  assert.deepEqual(opts.map((o) => o.textContent), [CAPTION, "Plain One"], "the reader sees the caption");
  const posts = sent.filter((s) => s.body?.args);
  assert.equal(posts.length, 2, "a preview and a confirm");
  for (const p of posts) assert.equal(p.body.args.candidate, "lantern-glow", "the preview and confirm request carry the id");
  assert.ok(out.textContent.includes(`on ${CAPTION}`), "the receipt names the caption");
  assert.equal(out.textContent.includes("on lantern-glow"), false, "and not the folder id");
});

test("a long caption in the choice control cannot push the form past its column (the row is capped at its container, phone width)", () => {
  assert.match(BALLOT_STAKE_CSS, /\.bs \.bs-row \{[^}]*max-width: 100%;[^}]*min-width: 0;/);
});

test("a bare call (no captions) and an unknown design are exactly today's words", async () => {
  const { sel, out } = await stakeRun(null);
  assert.deepEqual(sel.children.map((o) => o.textContent), ["lantern-glow", "plain-one"]);
  assert.ok(out.textContent.includes("on lantern-glow"));
  assert.equal(nameFor(null, "x"), "x"); assert.equal(nameFor({}, "x"), "x"); assert.equal(nameFor({ x: "X, by y" }, "x"), "X, by y"); assert.equal(nameFor({}, "constructor"), "constructor");
  assert.match(answerOf({ ok: true, status: 200, json: { result: { preview: true, handle: "rei", candidate: "k", requested: 1, applied: 1, household_headroom_before: 3, household_headroom_after: 2, balance_before: 5, balance_after: 4 } } }).title, /on k$/);
  assert.match(answerOf({ ok: true, status: 200, json: { result: { preview: true, handle: "rei", candidate: "k", requested: 1, applied: 1, household_headroom_before: 3, household_headroom_after: 2, balance_before: 5, balance_after: 4 } } }, { names: { k: "K, by z" } }).title, /on K, by z$/);
});

test("the office's own defect words are as sent (a refusal never has the caption rewritten into it)", () => {
  const r = answerOf({ ok: false, status: 409, json: { error: "bounce", code: 409, defect: 'ballot "hearth-default" has no candidate "lantern-glow"' } }, { candidate: "lantern-glow", names: { "lantern-glow": CAPTION } });
  assert.equal(r.title, 'ballot "hearth-default" has no candidate "lantern-glow"');
});

test("both hosts are wired: /votes/ and the Ballot House panel read the build's title map and name the design by its caption", () => {
  const votes = src("town/pages/votes/index.astro"), town = src("town/pages/town/index.astro");
  for (const page of [votes, town]) {
    assert.match(page, /import \{ hearthTitles \} from "@\/lib\/hearth\/ballot-titles\.mjs"/);
    assert.match(page, /data-hearth-titles=\{JSON\.stringify\(hearthTitles\)\}/);
    assert.match(page, /readTitles\(/);
  }
  assert.match(votes, /captionOf\(titles, t\.topic, c\.candidate, c\.credit\)/);
  assert.match(votes, /el\("span", "v-cand-name", caption \|\| c\.candidate\)/);
  assert.match(votes, /captions: captionsOf\(titles, t\.topic, t\.raw\)/);
  assert.match(town, /titles: readTitles\(host\?\.getAttribute\("data-hearth-titles"\)\)/);
  assert.match(src("src/lib/hearth/ballot-titles.mjs"), /from "\.\.\/\.\.\/data\/postmark\/hearths\.json"/, "the title map reads the entries' metadata, not the prepared registry");
});
