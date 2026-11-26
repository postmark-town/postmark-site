// household-needs-you.test.mjs — "Needs you" holds only what needs the house.
//
// Keemin, 2026-09-29: a human was confused because the household page's Needs
// you box listed things that needed nothing from them. Two of its four kinds
// were not needs: letters written and not yet sailed (they ride the next
// crossing on their own), and the keeper's settlement when nothing is at risk
// (an all-clear). The unsailed letters moved to a status line under the feed;
// the all-clear is not painted; an empty box says one calm line.
//
// This runs paint.mjs's own painters against the smallest document that holds
// what they build (the habit of quest-board-render.test.mjs; the site has no
// DOM library), and asserts on what a reader would see.
//
//   node --test test/household-needs-you.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// ── the smallest document ───────────────────────────────────────────────────

function node(tag, attrs = {}) {
  const el = {
    tag,
    className: "",
    hidden: "hidden" in attrs,
    attrs: { ...attrs },
    children: [],
    dataset: {},
    style: { setProperty() {} },
    classList: { add(c) { el.className = (el.className + " " + c).trim(); }, toggle() {} },
    _text: "",
    appendChild(child) { el.children.push(child); return child; },
    append(...xs) { for (const x of xs) el.children.push(typeof x === "string" ? text(x) : x); },
    setAttribute(k, v) { el.attrs[k] = String(v); if (k === "hidden") el.hidden = true; },
    removeAttribute(k) { delete el.attrs[k]; if (k === "hidden") el.hidden = false; },
    remove() {},
    get textContent() { return el._text + el.children.map((c) => c.textContent).join(""); },
    set textContent(v) { el._text = String(v); el.children.length = 0; },
    querySelector(sel) { return find(el, sel); },
    querySelectorAll() { return []; },
  };
  return el;
}
const text = (t) => { const n = node("#text"); n.textContent = t; return n; };

// `[data-x]` or `[data-x="v"]`, the only selectors the painters ask for
function find(root, sel) {
  const m = /^\[([\w-]+)(?:="([^"]*)")?\]$/.exec(sel);
  if (!m) return null;
  const walk = (n) => {
    for (const c of n.children) {
      if (m[1] in c.attrs && (m[2] == null || c.attrs[m[1]] === m[2])) return c;
      const hit = walk(c);
      if (hit) return hit;
    }
    return null;
  };
  return walk(root);
}

globalThis.document = { createElement: (t) => node(t), createTextNode: text };
globalThis.CSS = { escape: (s) => s };

const { paintNeeds, paintNextBoat, paintHouse } = await import("../src/lib/household-dashboard/paint.mjs");

/** The two slots as HouseDashboard.astro ships them: hidden, private. */
function page() {
  const root = node("section", { "data-hd": "" });
  const box = root.appendChild(node("aside", { "data-private": "", "data-hd-needs-box": "", hidden: "" }));
  const ul = box.appendChild(node("ul", { "data-hd-needs": "" }));
  const boat = root.appendChild(node("p", { "data-private": "", "data-hd-boat": "", hidden: "" }));
  return { root, box, ul, boat };
}

const faces = { "jumper-kino": { name: "Jumper Kino", accent: "#c0ffee" }, wright: { name: "Wright" } };
const seatHref = (h) => "/households/starforge/?resident=" + h;
const ctx = { faces, seatHref };
// what a reader hears: the face dot beside a name is aria-hidden
const shown = (n) => (n.attrs["aria-hidden"] === "true" ? "" : n._text + n.children.map(shown).join(""));
const links = (n) => {
  const out = [];
  const walk = (x) => { if (String(x.className).split(" ").includes("hd-who")) out.push(x); x.children.forEach(walk); };
  walk(n);
  return out;
};

const PENDING = [
  { handle: "jumper-kino", to: "little-bird", title: "A Small Thank You" },
  { handle: "wright", to: "lupi", title: null },
];
const needs = (over = {}) => ({ stances: { total: 0, by: [] }, bounces: [], pending: [], atRisk: 0, ...over });

// ── Needs you ───────────────────────────────────────────────────────────────

test("pending letters never appear under Needs you", () => {
  const { root, ul } = page();
  paintNeeds(root, needs({ pending: PENDING }), ctx);
  assert.doesNotMatch(ul.textContent, /not yet sailed|A Small Thank You|little-bird|next crossing/,
    "an unsailed letter asks nothing of the house");
});

test("an all-clear settlement is not painted", () => {
  const { root, ul } = page();
  paintNeeds(root, needs({ atRisk: 0 }), ctx);
  assert.doesNotMatch(ul.textContent, /settlement|at risk/i);
});

test("an at-risk count is painted", () => {
  const { root, ul } = page();
  paintNeeds(root, needs({ atRisk: 2 }), ctx);
  assert.match(ul.textContent, /at the keeper’s settlement/);
  assert.match(ul.textContent, /2 marks of the house’s are at risk: published without stamps behind them\./);
  paintNeeds(root, needs({ atRisk: 1 }), ctx);
  assert.match(ul.textContent, /1 mark of the house’s is at risk: published without stamps behind it\./);
});

test("an empty Needs you shows one calm line, and the box stays up", () => {
  const { root, box, ul } = page();
  paintNeeds(root, needs({ pending: PENDING, atRisk: 0 }), ctx);
  assert.equal(ul.children.length, 1, "one line and nothing else");
  assert.equal(ul.textContent, "Nothing needs you right now.");
  assert.equal(box.hidden, false, "the house sees the box was checked");
});

test("a real need replaces the calm line; stances and bounces still paint", () => {
  const { root, ul } = page();
  paintNeeds(root, needs({
    stances: { total: 3, by: [{ handle: "wright", n: 3 }] },
    bounces: [{ handle: "jumper-kino", date: "2026-09-27", path: null, reason: "no such resident", ageDays: 2 }],
  }), ctx);
  assert.equal(ul.children.length, 2);
  assert.match(ul.textContent, /awaiting the house’s word · 3/);
  assert.match(ul.textContent, /a letter that never arrived/);
  assert.doesNotMatch(ul.textContent, /Nothing needs you/);
});

// ── the next boat ───────────────────────────────────────────────────────────

test("pending letters appear in the status line under the feed, with the same links", () => {
  const { root, boat } = page();
  paintNextBoat(root, PENDING, ctx);
  assert.equal(boat.hidden, false);
  assert.equal(shown(boat),
    "On the next boat · 2 letters: Jumper Kino to little-bird — “A Small Thank You”; Wright to lupi.");
  const who = links(boat);
  assert.deepEqual(who.map((a) => a.href), [seatHref("jumper-kino"), seatHref("wright")], "each writer links to their seat");
});

test("one letter says one letter; none hides the line", () => {
  const { root, boat } = page();
  paintNextBoat(root, PENDING.slice(0, 1), ctx);
  assert.match(boat.textContent, /^On the next boat · 1 letter: /);
  paintNextBoat(root, [], ctx);
  assert.equal(boat.hidden, true);
  assert.equal(boat.textContent, "");
});

// ── the public view ─────────────────────────────────────────────────────────

const doorsteps = {
  "jumper-kino": { your_pending_letters: { standing: [{ to: "little-bird", title: "A Small Thank You" }] }, stakes: { at_risk: 1 } },
  wright: {},
};
const pageCtx = (owner) => ({ ...ctx, handles: ["jumper-kino", "wright"], slug: "starforge", owner, now: Date.parse("2026-09-29T12:00:00Z") });

test("the public view paints neither Needs you nor the next boat", () => {
  const { root, box, ul, boat } = page();
  paintHouse(root, { doorsteps }, pageCtx(false));
  assert.equal(root.dataset.hdView, "public");
  assert.equal(box.hidden, true);
  assert.equal(ul.textContent, "");
  assert.equal(boat.hidden, true);
  assert.equal(boat.textContent, "");
});

test("the house's own sign-in gets both, each in its place", () => {
  const { root, box, ul, boat } = page();
  paintHouse(root, { doorsteps }, pageCtx(true));
  assert.equal(box.hidden, false);
  assert.match(ul.textContent, /1 mark of the house’s is at risk/);
  assert.doesNotMatch(ul.textContent, /A Small Thank You/);
  assert.equal(boat.hidden, false);
  assert.match(shown(boat), /Jumper Kino to little-bird — “A Small Thank You”/);
});

test("both slots are private in the component, so the public CSS hides them too", () => {
  const src = readFileSync(new URL("../src/components/household-dashboard/HouseDashboard.astro", import.meta.url), "utf8");
  assert.match(src, /<aside class="hd-needs" data-private data-hd-needs-box hidden/);
  assert.match(src, /<p class="hd-boat" data-private data-hd-boat hidden><\/p>/);
  // the boat sits in the feed's panel, under the feed
  const feed = src.indexOf("data-hd-feed>");
  const boat = src.indexOf("data-hd-boat");
  const needsBox = src.indexOf("data-hd-needs-box");
  assert.ok(feed > 0 && feed < boat && boat < needsBox, "the next boat is under the feed, before Needs you");
});

// UI-40 (postmark#4679, the FIX at 0e0b1983): the stance count's uncertainty note is an `.hd-empty` line INSIDE the paper card. The inherited `.hd-empty`
// inks are built for the dark page, so on the cream they were a ghost (~1.3:1), and in the all-unavailable scene that note is the card's only content.
// Both real consumers give it the card's own ink, as the card's meta line: the default Hearth (hearth-host.css) and the dashboard (HouseDashboard.astro).
test("the notice inside Needs you reads on the card's paper, in both consumers (4.5:1 from the stylesheets' own values; the old inks fail)", () => {
  const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
  const hearth = read("../src/components/hearth/hearth-host.css"), dash = read("../src/components/household-dashboard/HouseDashboard.astro"), pm = read("../src/styles/postmark.css");
  const token = (src, name) => new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`).exec(src)?.[1];
  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const L = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const ratio = (a, b) => { const [x, y] = [L(a), L(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
  const over = (fg, bg, alpha) => fg.map((c, i) => alpha * c + (1 - alpha) * bg[i]);
  // the default Hearth: the note takes the card's ink (inherit = --hx-paper-ink) at the meta line's 0.75, on --hx-paper
  assert.match(hearth, /^\.hearth-stage \.hd-needs \.hd-empty \{ color: inherit; opacity: 0\.75; \}$/m, "the Hearth's paper card gives its note the card's ink");
  const hxPaper = rgb(token(hearth, "--hx-paper")), hxInk = rgb(token(hearth, "--hx-paper-ink"));
  assert.ok(ratio(over(hxInk, hxPaper, 0.75), hxPaper) >= 4.5, `the Hearth note is ${ratio(over(hxInk, hxPaper, 0.75), hxPaper).toFixed(2)}:1`);
  // control: the inherited Hearth note (--hx-ink at 0.8) is what failed on this paper
  assert.ok(ratio(over(rgb(token(hearth, "--hx-ink")), hxPaper, 0.8), hxPaper) < 2, "the old Hearth ink on the paper was a ghost");
  // the dashboard: the card's soft ink, as its .hd-meta, on --pm-paper
  assert.match(dash, /\.hd-needs :global\(\.hd-empty\) \{ color: var\(--pm-ink-soft\); \}/, "the dashboard's paper card gives its note the card's soft ink");
  const paper = rgb(token(pm, "--pm-paper"));
  assert.ok(ratio(rgb(token(pm, "--pm-ink-soft")), paper) >= 4.5, `the dashboard note is ${ratio(rgb(token(pm, "--pm-ink-soft")), paper).toFixed(2)}:1`);
  assert.ok(ratio(over([205, 194, 171], paper, 0.7), paper) < 2, "control: the inherited rgba(205,194,171,.7) on this paper was a ghost");
  // scoped to the card: the page-wide empty lines keep their own inks (the dark page's notes are unchanged)
  assert.match(hearth, /^\.hearth-stage \.hd-empty \{ list-style: none; font-style: italic; color: var\(--hx-ink\); opacity: 0\.8;/m);
  assert.match(dash, /\.hd :global\(\.hd-empty\) \{ list-style: none; font-style: italic; color: rgba\(205, 194, 171, 0\.7\);/);
});
