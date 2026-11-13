// hearth-v2-paint.test.mjs — the v2 painters run, over a minimal DOM (POS-1028; review of #420).
//
// LAW (POS-1024, ruled by Darko 2026-11-13 09:17 EST: "I want both"): "<hearth-windows> for the residents' panes", and the bundle parts. The site's
// contract for them (HearthSlot.astro, paint-v2.mjs): "A part whose data has not arrived draws nothing", and a part that answered with nothing says so.
//
// This drives paint-v2.mjs's real painters on a stage built the way HearthSlot.astro draws the slots, through a small DOM shim: elements with
// attributes, children, `hidden`, text, and the attribute selectors the painters use. It reads what the painter left: which slots show, the
// window frames' addresses and sandbox, that a repaint keeps the same frame (a pane is never reloaded), and the ties rows.

import test from "node:test";
import assert from "node:assert/strict";
import { paintWindows, paintTies, paintTown, paintWent, paintDay } from "../src/lib/hearth/paint-v2.mjs";
import { FEED_SHOWN } from "../src/lib/hearth/bundle.mjs";

// ── a minimal DOM ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
class Node {
  constructor(tag) { this.tagName = tag; this.attrs = {}; this.children = []; this.hidden = false; this._text = ""; this.style = { setProperty() {} }; this.parent = null; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  appendChild(c) { c.parent = this; this.children.push(c); return c; }
  set className(v) { this.attrs.class = v; }
  get className() { return this.attrs.class ?? ""; }
  set textContent(v) { this.children = []; this._text = String(v ?? ""); }
  get textContent() { return this._text + this.children.map((c) => c.textContent).join(""); }
  set src(v) { this.attrs.src = v; } get src() { return this.attrs.src; }
  set href(v) { this.attrs.href = v; } get href() { return this.attrs.href; }
  set title(v) { this.attrs.title = v; } get title() { return this.attrs.title; }
  set target(v) { this.attrs.target = v; } set rel(v) { this.attrs.rel = v; } set type(v) { this.attrs.type = v; }
  *walk() { for (const c of this.children) { if (c instanceof Node) { yield c; yield* c.walk(); } } }
  matches(sel) {
    const m = /^\[([a-z-]+)(?:="([^"]*)")?\]$/.exec(sel);
    if (!m) throw new Error("the shim knows only [attr] and [attr=\"v\"] selectors, not " + sel);
    return m[2] === undefined ? m[1] in this.attrs : this.attrs[m[1]] === m[2];
  }
  querySelectorAll(sel) { return [...this.walk()].filter((n) => n.matches(sel)); }
  querySelector(sel) { return this.querySelectorAll(sel)[0] ?? null; }
}
class Text { constructor(t) { this.textContent = String(t); } }
globalThis.document = { createElement: (t) => new Node(t), createTextNode: (t) => new Text(t) };

const el = (tag, attrs = {}, ...kids) => { const n = new Node(tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); for (const k of kids) n.appendChild(k); return n; };
/** A stage holding the windows, ties and town slots as HearthSlot.astro draws them: each section ships hidden. */
function stage() {
  const s = el("div", { "data-hearth-stage": "" });
  const windows = el("section", { "data-hearth-slot": "windows" }, el("div", { "data-hx-windows": "" })); windows.hidden = true;
  const ties = el("section", { "data-hearth-slot": "ties" }, el("ul", { "data-hx-ties": "" })); ties.hidden = true;
  const town = el("section", { "data-hearth-slot": "town" }, el("div", { "data-hx-feed-sorts": "" }), el("ul", { "data-hx-feed": "" })); town.hidden = true;
  const went = el("section", { "data-hearth-slot": "stamps-went" }, el("div", { "data-hx-went": "" })); went.hidden = true;
  const day = el("section", { "data-hearth-slot": "day" }, el("ul", { "data-hx-day": "" })); day.hidden = true;
  s.appendChild(windows); s.appendChild(ties); s.appendChild(town); s.appendChild(went); s.appendChild(day);
  return { s, windows, ties, town, went, day };
}
// POS-1027's envelope: { read: "hearth", household, parts }, each part { via, data }
const env = (parts) => ({ read: "hearth", household: "fox-and-owl", parts });
const part = (data) => ({ via: { door: "household", read: "x", args: {} }, data });
const CTX = { handles: ["fox", "owl"], faces: { fox: { name: "Fox", accent: "#f80" }, owl: { name: "Owl" } }, now: Date.parse("2026-11-13T15:00:00Z"), feedSort: "newest" };

// ── the windows slot ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

test("windows: no answer from the panes origin draws nothing; an answer with none says so; each hung window is its own pane on its own origin", () => {
  const { s, windows } = stage();
  paintWindows(s, null, CTX);
  assert.equal(windows.hidden, true, "no answer: the slot stays hidden (draws nothing)");
  paintWindows(s, [], CTX);
  assert.equal(windows.hidden, false, "an answer is shown");
  assert.match(windows.textContent, /No resident of this house has hung a window yet\./, "and an answer with none says so");
  paintWindows(s, ["fox", "owl"], CTX);
  const frames = windows.querySelectorAll("[data-win-frame]");
  assert.deepEqual(frames.map((f) => f.src), ["https://panes.postmark.town/~fox/", "https://panes.postmark.town/~owl/"]);
  assert.deepEqual(frames.map((f) => f.getAttribute("sandbox")), ["allow-scripts", "allow-scripts"], "a resident's window keeps a window's own rules");
  assert.deepEqual(frames.map((f) => f.tagName), ["iframe", "iframe"]);
  assert.match(windows.textContent, /Fox's window · open full screen/);
  assert.ok(!/No resident/.test(windows.textContent), "the none line is gone once windows hang");
});

test("windows: a repaint with the same hung list keeps the same frames (a pane is never reloaded); a changed list redraws", () => {
  const { s, windows } = stage();
  paintWindows(s, ["fox"], CTX);
  const first = windows.querySelector("[data-win-frame]");
  paintWindows(s, ["fox"], CTX);
  assert.equal(windows.querySelector("[data-win-frame]"), first, "the same frame object: nothing reloaded");
  paintWindows(s, ["fox", "owl"], CTX);
  assert.equal(windows.querySelectorAll("[data-win-frame]").length, 2);
  paintWindows(s, null, CTX);
  assert.equal(windows.hidden, true, "and an answer that goes away hides the slot again");
});

// ── a bundle part: ties ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

test("ties: no bundle, or a bundle without the part, draws nothing; an answered part draws its rows; an empty one says so", () => {
  const { s, ties } = stage();
  paintTies(s, null, CTX);
  assert.equal(ties.hidden, true, "no bundle: hidden");
  paintTies(s, env({ feed: part({ rows: [] }) }), CTX);
  assert.equal(ties.hidden, true, "a bundle without the closer part: hidden");
  paintTies(s, env({
    closer: part({ rows: [{ with: "hare", letters: 5 }, { with: "robin", letters: 2 }] }),
    pairs: [part({ a: "fox", b: "hare", letters: { a_to_b: 3, b_to_a: 2 }, latest: { a_to_b: { line: "Come by." }, b_to_a: { line: "I will." } } })],
  }), CTX);
  assert.equal(ties.hidden, false);
  const rows = ties.querySelector("[data-hx-ties]").children;
  assert.equal(rows.length, 2);
  assert.match(rows[0].textContent, /^Fox and hare · 3 out, 2 back/);
  assert.match(rows[0].textContent, /Come by\.I will\./, "both quotes, by rule");
  assert.match(rows[1].textContent, /^robin · 2 letters with the house/, "a correspondent with no pair on the page: the house's total, no direction made up");
  paintTies(s, env({ closer: part({ rows: [] }) }), CTX);
  assert.equal(ties.hidden, false);
  assert.match(ties.textContent, /No letters have crossed between these residents and others yet\./);
});

// ── the town feed: "most backed" is of the whole feed ───────────────────────────────────────────────────────────────────────────────────────

test("town: 'most backed' sorts the whole feed before it is cut, so a well-backed older row is not lost behind the newest twelve", () => {
  const { s, town } = stage();
  const rows = Array.from({ length: FEED_SHOWN + 4 }, (_, i) => ({ kind: "idea", title: "row " + i, at: `2026-11-${String(20 - i).padStart(2, "0")}T00:00:00Z`, backed: 0 }));
  rows[rows.length - 1].backed = 40;   // the oldest row is the most backed
  const bundle = env({ feed: part({ rows }) });
  paintTown(s, bundle, { ...CTX, feedSort: "newest" });
  const titles = () => town.querySelector("[data-hx-feed]").children.map((li) => li.children[1].textContent);
  assert.equal(titles().length, FEED_SHOWN);
  assert.ok(!titles().includes("row " + (rows.length - 1)), "newest: the oldest row is past the cut");
  paintTown(s, bundle, { ...CTX, feedSort: "backed" });
  assert.equal(titles()[0], "row " + (rows.length - 1), "most backed: it leads, though it is the oldest");
  assert.equal(titles().length, FEED_SHOWN);
  paintTown(s, null, CTX);
  assert.equal(town.hidden, true, "no bundle: hidden");
});

// ── unavailable is missing, not empty (review of #420 at 40993488) ──────────────────────────────────────────────────────────────────────────

// LAW (POS-1027, Rivet): "unavailable history must not masquerade as a quiet day". One test per slot, so a red names its slot.
const U = "the store could not be read: unknown, not none";
for (const [name, key, paint, none] of [
  ["ties", "closer", paintTies, /No letters have crossed/],
  ["town", "feed", paintTown, /Nothing new around town\./],
  ["went", "went", paintWent, /No stamps have gone out from this house yet\./],
]) {
  test(`painted: an answer the office marks unavailable draws nothing in ${name}; its unmarked twin says 'none'`, () => {
    const st = stage();
    paint(st.s, env({ [key]: part({ rows: [], unavailable: U }) }), CTX);
    assert.equal(st[name].hidden, true, `${name}: an unavailable answer draws nothing`);
    paint(st.s, env({ [key]: part({ rows: [] }) }), CTX);
    assert.equal(st[name].hidden, false, `${name}: control, an answered none shows`);
    assert.match(st[name].textContent, none, `${name}: and says so`);
  });
}

test("painted: a resident's day the office could not read is 'not read.', never quiet; a whole unreadable collection draws nothing", () => {
  const { s, day } = stage();
  paintDay(s, env({ days: [part({ handle: "fox", date: "2026-11-13", sentences: ["A quiet day."] }), part({ handle: "owl", date: "2026-11-13", sentences: [], unavailable: U })] }), CTX);
  assert.equal(day.hidden, false);
  const rows = day.querySelector("[data-hx-day]").children.map((li) => li.textContent);
  assert.deepEqual(rows, ["Fox: A quiet day.", "Owl: not read."], "the office's own quiet sentence for fox; owl's unreadable day is not read, not quiet");
  paintDay(s, env({ days: { unavailable: U } }), CTX);
  assert.equal(day.hidden, true, "a whole collection the office could not read draws nothing");
});
