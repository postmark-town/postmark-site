// main-rail-pages.test.mjs — a main-rail seat's pages, as a vertical list its header shows (CORE-164).
//
//   node --test test/main-rail-pages.test.mjs
//
// Darko, 2026-11-23 08:37 EST: "can we make it so you can hover over any of the main rail headers to see their pages as a vertical list?"
// THE ISSUE'S FIT: every header with pages gets a list and a header with none shows nothing; keyboard and phone reach it too; it never covers
// the page longer than the reader is using it; and the pages are the site's real ones, read from where the site already lists them.
//
// WHAT THIS HOLDS (the rendered page, with real hover, Tab and tap, is test/main-rail-pages-browser.test.mjs):
//   (1) membership: each seat's list is its chip row's members by the chip row's own rule (held never, a flagged one only while its flag is
//       on), or The Town's board pieces; in order, beta and external kept; the five one-door seats get none; no instance pages;
//   (2) the list sits inside the window's edges (shiftFor);
//   (3) open and close, on a hand-rolled document: the button, Escape, focus leaving, a press elsewhere, one list at a time; a mouse
//       pointing (never a finger); keyboard focus in a list holding it after the mouse leaves; aria-expanded always the shown state; on a
//       touch screen the seat's first tap opens its list and the second follows the link, while a mouse click or Enter always follows it;
//   (4) the wiring: the layout draws a list only for a seat that has pages, its button ships hidden, every seat link is the row measure's;
//       no caret anywhere on the rail (Darko, 2026-11-24 08:24 EST: "remove carets from rail, they look bad"), the button out of sight
//       until keyboard focus lands on it.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { RAIL, shownMembers, chipsFor } from "../src/lib/nav.mjs";
import { BOARD_PIECES } from "../src/lib/town-views.mjs";
import { railPages, railPageLists } from "../src/lib/rail-pages.mjs";
import { shiftFor, mountRailPages, EDGE } from "../src/lib/rail-pages-ui.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const seat = (key) => RAIL.find((s) => s.key === key);

// ── (1) membership ────────────────────────────────────────────────────────

test("a seat with a chip row lists exactly its members, in order, by the chip row's own rule; beta and external kept", () => {
  for (const key of ["world", "docs"]) {
    const s = seat(key);
    assert.ok(s.members?.length >= 2, `${key} has a chip row in the rail source`);
    const rows = railPages(s);
    assert.deepEqual(rows.map((r) => [r.key, r.label, r.href, r.external, r.beta]),
      shownMembers(s).map((m) => [m.key, m.label, m.href, !!m.external, !!m.beta]), `${key}: the members, as the chip row shows them`);
    assert.deepEqual(rows.map((r) => r.key), chipsFor(s.key).chips.map((c) => c.key), `${key}: the same rows, in the same order, as its chip row`);
  }
  const harbor = railPages(seat("world")).find((r) => r.key === "harbor");
  assert.deepEqual([harbor.external, harbor.beta, /^https:\/\//.test(harbor.href)], [true, true, true], "the harbor keeps its own domain and its beta mark");
  assert.equal(railPages(seat("docs")).find((r) => r.key === "stamps").beta, true, "stamps keeps its beta mark");
});

test("a held member never lists, a flagged one only while its flag is on: the chip row's rule, not a copy of it", () => {
  const invented = { key: "invented", label: "Invented", href: "/invented/", members: [
    { key: "a", label: "a", href: "/a/" }, { key: "b", label: "b", href: "/b/", held: "not yet" }, { key: "c", label: "c", href: "/c/", flag: "cFlag" }] };
  assert.deepEqual(railPages(invented).map((r) => r.key), ["a"]);
  assert.deepEqual(railPages(invented, { flags: { cFlag: true } }).map((r) => r.key), ["a", "c"]);
  assert.equal(railPages({ ...invented, members: [{ key: "b", label: "b", href: "/b/", held: "x" }] }), null, "a seat whose every member is held has no list");
});

test("The Town lists its board's pieces, in the board's order: each at its own page, the notices at their view on the board", () => {
  const rows = railPages(seat("town"));
  assert.deepEqual(rows.map((r) => r.key), BOARD_PIECES.map((p) => p.key));
  assert.deepEqual(rows.map((r) => r.href), BOARD_PIECES.map((p) => p.page ?? `/bulletin/#${p.hash}`));
  assert.equal(rows.find((r) => r.key === "notices").href, "/bulletin/#notices", "the notices have no page of their own");
  assert.ok(rows.every((r) => !r.external && !r.beta));
});

test("a one-door seat has no list (no empty dropdown), and no list enumerates residents, letters, Sparks or houses", () => {
  for (const key of ["postmark", "mail", "sparks", "households", "join"]) assert.equal(railPages(seat(key)), null, `${key} has no pages to list`);
  assert.deepEqual(Object.keys(railPageLists()).sort(), ["docs", "town", "world"], "the three seats with pages, and only they");
  const hrefs = Object.values(railPageLists()).flat().map((r) => r.href);
  for (const h of hrefs) assert.doesNotMatch(h, /\/(residents|households|mail|sparks)\/[^/#?]+/, `${h} is an instance, not a section page`);
});

test("the row the reader is on is marked by its address, and only an internal row", () => {
  assert.deepEqual(railPages(seat("docs"), { path: "/docs/stamps/" }).filter((r) => r.here).map((r) => r.key), ["stamps"]);
  assert.deepEqual(railPages(seat("town"), { path: "/town/" }).filter((r) => r.here).map((r) => r.key), ["quarter"], "the civic quarter, though /town/'s key is the seat's own");
  assert.deepEqual(railPages(seat("world"), { path: "/mail/" }).filter((r) => r.here), []);
});

// ── (2) inside the window ─────────────────────────────────────────────────

test("a list is moved sideways only as far as keeps it inside the window's edges", () => {
  assert.equal(EDGE, 8);
  assert.equal(shiftFor(100, 300, 1440), 0, "inside: not moved");
  assert.equal(shiftFor(300, 420, 390), -38, "past the right edge: back by the overhang plus the edge");
  assert.equal(shiftFor(2, 200, 390), 6, "past the left edge: right by the shortfall");
  assert.equal(shiftFor(50, 450, 390), -42, "wider than the room: kept at the left edge");
});

// ── (3) open and close, on a hand-rolled document ─────────────────────────
function fakeDom() {
  const on = (o) => { o._on = {}; o.addEventListener = (t, f) => { (o._on[t] ??= []).push(f); }; o.fire = (type, ev = {}) => { for (const f of o._on[type] ?? []) f({ type, ...ev }); }; return o; };
  const el = (attrs = {}) => {
    const e = on({ attrs: { ...attrs }, dataset: {}, hidden: false, children: [], parent: null, style: { props: {}, setProperty(k, v) { this.props[k] = v; } } });
    e.setAttribute = (k, v) => { e.attrs[k] = String(v); };
    e.getAttribute = (k) => e.attrs[k] ?? null;
    e.append = (...k) => { for (const c of k) { c.parent = e; e.children.push(c); } };
    e.contains = (x) => { for (let n = x; n; n = n.parent) if (n === e) return true; return false; };
    e.querySelector = (sel) => e.querySelectorAll(sel)[0] ?? null;
    e.querySelectorAll = (sel) => { const a = /^\[([a-z-]+)\]$/.exec(sel)?.[1]; const out = []; const walk = (n) => { for (const c of n.children) { if (a in c.attrs) out.push(c); walk(c); } }; walk(e); return out; };
    e.focus = () => { doc.focused = e; doc.activeElement = e; };
    e.getBoundingClientRect = () => e.rect ?? { left: 0, right: 0, width: 0 };
    return e;
  };
  const doc = on({ documentElement: { clientWidth: 390 }, focused: null, activeElement: null });
  const nav = el();
  const seats = ["world", "docs"].map((k) => {
    const s = el({ "data-rail-seat": "" }), link = el({ "data-rail-top": "" }), btn = el({ "data-rail-more": "", "aria-expanded": "false" }), list = el({ "data-rail-pages": "" });
    btn.hidden = true;
    s.append(link, btn, list);
    nav.append(s);
    return { s, link, btn, list, k };
  });
  return { doc, nav, seats, el };
}

test("the button opens and closes its list and says so; one list is open at a time", () => {
  const { doc, nav, seats: [w, d] } = fakeDom();
  mountRailPages(nav, { doc });
  assert.deepEqual([w.btn.hidden, d.btn.hidden], [false, false], "the script reveals each seat's button");
  w.btn.fire("click");
  assert.ok("open" in w.s.dataset);
  assert.equal(w.btn.getAttribute("aria-expanded"), "true");
  d.btn.fire("click");
  assert.ok(!("open" in w.s.dataset) && "open" in d.s.dataset, "opening Docs shuts The World");
  assert.equal(w.btn.getAttribute("aria-expanded"), "false");
  d.btn.fire("click");
  assert.ok(!("open" in d.s.dataset), "the button shuts its own list");
  assert.equal(d.btn.getAttribute("aria-expanded"), "false");
});

test("Escape shuts the list and puts focus on its button; a list shown by pointing stays shut until the pointer leaves", () => {
  const { doc, nav, seats: [w] } = fakeDom();
  mountRailPages(nav, { doc });
  w.btn.fire("click");
  w.s.fire("keydown", { key: "Tab" });
  assert.ok("open" in w.s.dataset, "another key does nothing");
  w.s.fire("keydown", { key: "Escape" });
  assert.ok(!("open" in w.s.dataset));
  assert.equal(doc.focused, w.btn, "focus is back on the button, never stranded in a hidden list");
  assert.ok(!("shut" in w.s.dataset), "no mouse on the seat: nothing to keep shut, so the next pointing shows it");
  w.s.fire("pointerenter", { pointerType: "mouse" });
  assert.ok("open" in w.s.dataset);
  w.s.fire("keydown", { key: "Escape" });
  assert.ok(!("open" in w.s.dataset), "Escape shuts a list shown by pointing too");
  assert.equal(w.btn.getAttribute("aria-expanded"), "false");
  w.s.fire("pointermove", { pointerType: "mouse" });
  assert.ok(!("open" in w.s.dataset), "and the mouse still on the seat doesn't show it again");
  w.s.fire("pointerleave", { pointerType: "mouse" });
  w.s.fire("pointerenter", { pointerType: "mouse" });
  assert.ok("open" in w.s.dataset, "until the pointer has left and come back");
});

test("a mouse pointing shows the list and the button says so; leaving lets it go; a finger never points", () => {
  const { doc, nav, seats: [w, d] } = fakeDom();
  mountRailPages(nav, { doc });
  assert.ok("railJs" in nav.dataset, "the stylesheet's own hover rule stands down for the script");
  w.s.fire("pointerenter", { pointerType: "touch" });
  assert.ok(!("open" in w.s.dataset), "a finger is not pointing: a tap's sticky hover holds nothing open");
  w.s.fire("pointerenter", { pointerType: "mouse" });
  assert.ok("open" in w.s.dataset);
  assert.equal(w.btn.getAttribute("aria-expanded"), "true", "shown by pointing, and the button says it is shown");
  w.s.fire("pointerleave", { pointerType: "mouse" });
  assert.ok(!("open" in w.s.dataset));
  assert.equal(w.btn.getAttribute("aria-expanded"), "false");
  w.s.fire("pointerenter", { pointerType: "mouse" });
  w.btn.fire("click");
  assert.ok(!("open" in w.s.dataset), "the button shuts a list shown by pointing (it said expanded, so it collapses)");
  assert.equal(w.btn.getAttribute("aria-expanded"), "false");
  w.btn.fire("click");
  assert.ok("open" in w.s.dataset, "and opens it again");
  d.s.fire("pointerenter", { pointerType: "mouse" });
  assert.deepEqual(["open" in w.s.dataset, "open" in d.s.dataset], [false, true], "pointing at Docs shows Docs and lets The World go");
  assert.deepEqual([w.btn.getAttribute("aria-expanded"), d.btn.getAttribute("aria-expanded")], ["false", "true"]);
});

test("pointed at, Tabbed into, then the mouse leaves: the list stays with focus in it until focus leaves or Escape", () => {
  const { doc, nav, seats: [w, d], el } = fakeDom();
  mountRailPages(nav, { doc });
  const row = el(); w.list.append(row);
  w.s.fire("pointerenter", { pointerType: "mouse" });
  row.focus();
  w.s.fire("focusin", { target: row });
  w.s.fire("pointerleave", { pointerType: "mouse" });
  assert.ok("open" in w.s.dataset, "keyboard focus is still using the list");
  assert.equal(w.btn.getAttribute("aria-expanded"), "true");
  d.s.fire("pointerenter", { pointerType: "mouse" });
  assert.deepEqual(["open" in w.s.dataset, "open" in d.s.dataset], [true, false], "pointing at another seat leaves the list focus is using");
  d.s.fire("pointerleave", { pointerType: "mouse" });
  w.s.fire("focusout", { relatedTarget: d.link });
  assert.ok(!("open" in w.s.dataset), "focus leaving the seat lets it go");
  assert.equal(w.btn.getAttribute("aria-expanded"), "false");
  w.s.fire("pointerenter", { pointerType: "mouse" });
  w.s.fire("focusin", { target: row });
  w.s.fire("pointerleave", { pointerType: "mouse" });
  w.s.fire("keydown", { key: "Escape" });
  assert.ok(!("open" in w.s.dataset), "Escape lets it go");
  assert.equal(doc.focused, w.btn, "with focus on the button, not left in the hidden list");
  w.s.fire("focusin", { target: w.btn });
  assert.ok(!("open" in w.s.dataset), "focus on the button itself holds nothing open");
});

test("focus leaving the seat, or a press outside it, shuts the list; focus moving inside it does not", () => {
  const { doc, nav, seats: [w, d], el } = fakeDom();
  mountRailPages(nav, { doc });
  const inside = el(); w.list.append(inside);
  w.btn.fire("click");
  w.s.fire("focusout", { relatedTarget: inside });
  assert.ok("open" in w.s.dataset, "Tab from the button into the list keeps it open");
  w.s.fire("focusout", { relatedTarget: d.link });
  assert.ok(!("open" in w.s.dataset), "Tab past the list to the next seat shuts it");
  w.btn.fire("click");
  doc.fire("pointerdown", { target: inside });
  assert.ok("open" in w.s.dataset, "a press inside the list keeps it");
  doc.fire("pointerdown", { target: el() });
  assert.ok(!("open" in w.s.dataset), "a press anywhere else shuts it");
});

test("on a touch screen the seat's first tap opens its list and the second goes to the seat; a mouse click and Enter always go", () => {
  const { doc, nav, seats: [w, d] } = fakeDom();
  mountRailPages(nav, { doc });
  const click = (link) => { const ev = { defaultPrevented: false }; link.fire("click", { preventDefault() { ev.defaultPrevented = true; } }); return ev; };
  const tap = (link, pointerType = "touch") => { link.fire("pointerdown", { pointerType }); doc.fire("pointerdown", { target: link }); return click(link); };
  let ev = tap(w.link);
  assert.equal(ev.defaultPrevented, true, "the first tap does not follow the link");
  assert.ok("open" in w.s.dataset, "it opens The World's list");
  assert.equal(w.btn.getAttribute("aria-expanded"), "true", "and the button says so");
  ev = tap(w.link);
  assert.equal(ev.defaultPrevented, false, "a tap with the list shown goes to the seat");
  ev = tap(d.link, "pen");
  assert.equal(ev.defaultPrevented, true, "a pen taps like a finger");
  assert.deepEqual(["open" in w.s.dataset, "open" in d.s.dataset], [false, true], "one list at a time: Docs opens, The World shuts");
  doc.fire("pointerdown", { target: {} });
  assert.ok(!("open" in d.s.dataset), "a press elsewhere shuts it");
  d.link.fire("pointerdown", { pointerType: "mouse" });
  ev = click(d.link);
  assert.equal(ev.defaultPrevented, false, "a mouse click goes to the seat");
  assert.ok(!("open" in d.s.dataset), "and opens nothing");
  ev = click(d.link);
  assert.equal(ev.defaultPrevented, false, "Enter on the link (a click with no press before it) goes to the seat");
  d.link.fire("pointerdown", { pointerType: "touch" });
  doc.fire("pointerdown", { target: {} });                 // the finger lifted elsewhere: no click came
  d.link.fire("pointerdown", { pointerType: "mouse" });
  ev = click(d.link);
  assert.equal(ev.defaultPrevented, false, "a touch press that never became a click doesn't make the next mouse click a tap");
});

test("an open list is placed inside the window: its shift is written where the stylesheet reads it", () => {
  const { doc, nav, seats: [w] } = fakeDom();
  mountRailPages(nav, { doc });
  w.list.rect = { left: 300, right: 470, width: 170 };
  w.btn.fire("click");
  assert.equal(w.list.style.props["--pm-rail-shift"], `${shiftFor(300, 470, 390)}px`);
  w.list.rect = { left: 20, right: 190, width: 170 };
  w.btn.fire("click");
  w.s.fire("pointerenter", { pointerType: "mouse" });
  assert.equal(w.list.style.props["--pm-rail-shift"], "0px", "pointing places it too");
});

// ── (4) the wiring ────────────────────────────────────────────────────────

test("PIN the layout draws a list only where a seat has pages, its button hidden until the script, and the row measure counts seats only", () => {
  const layout = read("src/layouts/PostmarkLayout.astro");
  assert.match(layout, /const pageLists = railPageLists\(\{ path: Astro\.url\.pathname, flags: navFlags\(import\.meta\.env\) \}\);/, "the build's own flags and this page's path");
  assert.match(layout, /\{RAIL\.filter\(\(n\) => !n\.lantern\)\.map\(\(n\) => pageLists\[n\.key\] \? \(/, "a seat gets the list only when it has pages");
  assert.match(layout, /<button type="button" class="pm-rail-more" data-rail-more aria-expanded="false" aria-controls=\{`pm-rail-pages-\$\{n\.key\}`\} hidden>/);
  assert.equal((layout.match(/data-rail-top/g) ?? []).length >= 3, true, "both kinds of seat link carry the measure's mark");
  assert.match(layout, /querySelectorAll\("\.pm-townnav-links \[data-rail-top\]"\)/, "the row measure counts the seats, not a list's links");
  assert.doesNotMatch(layout, /querySelectorAll\("\.pm-townnav-links a"\)/, "and never every link in the nav");
  assert.match(layout, /import \{ mountRailPages \} from "@\/lib\/rail-pages-ui\.mjs";\s*mountRailPages\(document\.querySelector\("\.pm-townnav-links"\)\);/);
  const css = read("src/styles/postmark.css");
  assert.match(css, /\.pm \.pm-rail-pages \{\s*display: none; position: absolute; top: 100%;/, "shut and out of the tab order by default, hung from the seat with no gap");
  assert.match(css, /\.pm \.pm-rail-seat\[data-open\] > \.pm-rail-pages \{ display: block; \}/, "with the script, its shown state alone shows it");
  assert.match(css, /@media \(hover: hover\) and \(pointer: fine\) \{\s*\.pm \.pm-townnav-links:not\(\[data-rail-js\]\) \.pm-rail-seat:hover > \.pm-rail-pages,\s*\.pm \.pm-townnav-links:not\(\[data-rail-js\]\) \.pm-rail-pages:focus-within \{ display: block; \}\s*\}/,
    "without it, pointing where the device reports hover, kept while focus is in the list");
  assert.equal((css.match(/\.pm-rail-seat:hover/g) ?? []).length, 1, "and nowhere else: no hover rule the script's aria-expanded can't see, none a tap could hold open");
  assert.doesNotMatch(css, /data-mouse/);
  assert.match(css, /transform: translateX\(var\(--pm-rail-shift, 0px\)\);/, "the script's shift is what moves it");
});

test("PIN no caret on the rail: the button has no glyph and is out of sight until keyboard focus lands on it", () => {
  // Darko, 2026-11-24 08:24 EST: "remove carets from rail, they look bad"
  const layout = read("src/layouts/PostmarkLayout.astro");
  const seatMarkup = /<span class="pm-rail-seat" data-rail-seat>[\s\S]*?<\/span>\s*\) : \(/.exec(layout)?.[0] ?? "";
  assert.ok(seatMarkup.includes("data-rail-more"), "the slice is the seat's markup (control: it holds the button)");
  assert.doesNotMatch(seatMarkup, /<svg|[▾▼⌄⌃›❯▸▿]|&#9662;|chevron/i, "no glyph in the seat: no svg, no caret character");
  assert.match(seatMarkup, /<span class="pm-rail-more-word" aria-hidden="true">pages<\/span>/, "what keyboard focus shows is a word");
  const css = read("src/styles/postmark.css");
  const rule = (sel) => new RegExp(`${sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\{([^}]*)\\}`).exec(css)?.[1] ?? "";
  const rest = rule(".pm .pm-rail-more"), focused = rule(".pm .pm-rail-more:focus");
  assert.match(rest, /position: absolute;/, "it takes no room in the rail");
  assert.match(rest, /width: 1px; height: 1px;/);
  assert.match(rest, /clip-path: inset\(50%\);/, "out of sight at rest");
  assert.match(rest, /pointer-events: none;/, "a pointer passes through it: shown, it lies over the next seat, and must not take that seat's mouse");
  assert.doesNotMatch(focused, /pointer-events/, "and focus doesn't give the pointer back");
  assert.match(focused, /clip-path: none;/, "in sight while focused");
  assert.match(focused, /outline: 2px solid/, "with a focus ring");
  assert.doesNotMatch(css, /pm-rail-more[^{]*svg|rotate\(180deg\)/, "no chevron rule left behind");
});
