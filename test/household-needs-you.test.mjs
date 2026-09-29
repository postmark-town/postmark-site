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
