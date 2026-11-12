// world-bymail-panel.test.mjs — POS-1006: "In town by mail" behind a button beside Time travel, opened as a floating card, closed by a press outside.
//
// Darko, 2026-11-11 22:10 and 22:15 EST: not "a giant blob at the bottom of the world page"; "hide it behind a button next to time travel ... it just opens
// like a panel that has the names, and you can click off of it"; a floating card of its own in Time travel's panel look, clear of the edges, its own scroll,
// long labels cut with "…" inside the card. The viewer keeps filling its ONE list (spectator/viewer.mjs § renderByMail: it replaces `.wv-bymail-list`'s
// contents and toggles the section's `hidden`, including to empty); the site only reads it. This file runs the pure parts over stand-ins that do exactly
// those operations, and pins how world.astro wires them. The rendered interaction (real browser, hit targets, shots) is on the PR.
//
//   node --test test/world-bymail-panel.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { bymailCount, bymailLabel, panelBox, isOutside } from "../src/lib/world-bymail-panel.mjs";

const PAGE = readFileSync(new URL("../town/pages/world.astro", import.meta.url), "utf8");

/** A stand-in for the viewer's section: what renderByMail does to it (replace the list's names, toggle `hidden`). */
const section = (names, hidden = names.length === 0) => ({
  hidden,
  querySelector: (sel) => (sel === ".wv-bymail-list" ? { children: names.map((n) => ({ n })) } : null),
});

test("the count is the viewer's own list: its names, zero when the viewer hides the section or the list is empty, zero for no section", () => {
  assert.equal(bymailCount(section(["a", "b", "c"])), 3);
  assert.equal(bymailCount(section([])), 0, "nobody in town by mail: the viewer's empty list");
  assert.equal(bymailCount(section(["a"], true)), 0, "the viewer's `hidden` means none, whatever the list still holds");
  assert.equal(bymailCount(null), 0); assert.equal(bymailCount({ hidden: false, querySelector: () => null }), 0);
});

test("the refreshed names are followed: the count tracks each replacement the viewer makes, including back to empty and back again", () => {
  const s = section(["a", "b"]);
  assert.equal(bymailCount(s), 2);
  const refreshed = section(["x", "y", "z", "w"]);                     // renderByMail: list.innerHTML = …; box.hidden = length === 0
  assert.equal(bymailCount(refreshed), 4);
  assert.equal(bymailCount(section([])), 0, "emptied: the button goes");
  assert.equal(bymailCount(section(["back"])), 1);
  assert.equal(bymailLabel(1), "In town by mail · 1"); assert.equal(bymailLabel(36), "In town by mail · 36");
});

for (const [w, h] of [[1280, 800], [1920, 1080], [2556, 1200], [390, 844]]) {
  test(`${w}×${h}: the card is wholly inside the window, 10px clear of its edges, no wider than 304px, bounded to what is left; above the button on a desk, below it on a phone`, () => {
    const btn = w >= 721 ? { left: 340, top: h - 43, right: 520, bottom: h - 14 } : { left: 150, top: 137, right: 380, bottom: 166 };
    const fromTop = w < 721;
    const b = panelBox(btn, { width: w, height: h, fromTop });
    assert.ok(b.width <= 304 && b.width <= w - 20, `width ${b.width}`);
    assert.ok(b.left >= 10 && b.left + b.width <= w - 10, `left ${b.left}, width ${b.width}`);
    if (fromTop) { assert.ok(b.top >= btn.bottom, "below the button"); assert.ok(b.top + b.maxHeight <= h - 10, "its scroll bound ends 10px above the window's bottom"); }
    else { assert.ok(h - b.bottom <= btn.top, "above the button"); assert.ok(b.bottom >= 10); assert.ok(h - b.bottom - b.maxHeight >= 10 - 1, "its scroll bound ends 10px below the window's top"); }
    assert.ok(b.maxHeight >= 80 && b.maxHeight < h && b.maxHeight <= 384, "a card, bounded to the viewport and to 24rem");
  });
}

test("a button near the right edge slides the card left so it stays whole", () => {
  const b = panelBox({ left: 1200, top: 757, right: 1270, bottom: 786 }, { width: 1280, height: 800 });
  assert.equal(b.left + b.width, 1270);
});

test("a press is outside unless it lands on the card or the button", () => {
  const card = { contains: (n) => n.in === "card" }, btn = { contains: (n) => n.in === "btn" };
  assert.equal(isOutside({ in: "map" }, card, btn), true);
  assert.equal(isOutside({ in: "card" }, card, btn), false, "a name in the card is not outside");
  assert.equal(isOutside({ in: "btn" }, card, btn), false, "the button toggles; it is not an outside press");
  assert.equal(isOutside(btn, card, btn), false);
});

test("world.astro wires it: the viewer's one section is hidden until opened, restyled as a floating card, followed by observers, and never copied", () => {
  assert.match(PAGE, /body \.wv-bymail \{ display: none; \}/, "the strip is never shown open under the map");
  assert.match(PAGE, /body \.wv-bymail\.pm-bymail-open:not\(\[hidden\]\) \{\s*display: block; position: fixed; z-index: 8100;/, "open: a fixed card, and only while the viewer's own flag says there are names");
  assert.match(PAGE, /border-radius: 14px;\s*background: rgba\(13, 20, 38, 0\.96\); box-shadow: 0 10px 34px rgba\(0, 0, 0, 0\.5\)/, "Time travel's panel look (.pm-tt-body)");
  assert.match(PAGE, /text-overflow: ellipsis; white-space: nowrap/, "a very long label is cut with an ellipsis inside the card");
  assert.match(PAGE, /attributeFilter: \["hidden"\]/, "the viewer's `hidden` toggles are followed");
  assert.match(PAGE, /watch\.observe\(list, \{ childList: true \}\)/, "and so are the names it replaces");
  assert.match(PAGE, /pointerdown[\s\S]{0,120}isOutside\(/, "a press outside closes");
  assert.match(PAGE, /e\.key === "Escape"/, "so does Escape");
  assert.doesNotMatch(PAGE, /cloneNode|\.wv-bymail-list"\)\.innerHTML|wv-bymail-list[^\n]*innerHTML\s*=/, "the site never copies or rewrites the viewer's list");
  assert.doesNotMatch(PAGE, /place\(\)'s desktop branch|lifted above the In-town-by-mail strip/, "the superseded lift is gone, not layered");
});

test("POS-1006 review: the card closes when Time travel is ACTIVATED by any input, not only on an outside pointer press (Enter/Space fire a click with no pointerdown)", () => {
  // the interlock: a capture-phase CLICK listener on Time travel's pill closes the open card; the pointerdown rule alone left the keyboard path open
  assert.match(PAGE, /document\.addEventListener\("click", \(e\) => \{ if \(section!\.classList\.contains\(OPEN\) && \(e\.target as Element \| null\)\?\.closest\?\.\("\.pm-tt-open"\)\) close\(\); \}, true\);/);
  // and Time travel itself still opens on a click, which is the event both a pointer and the keyboard produce
  assert.match(PAGE, /openEl\.addEventListener\("click", function \(\) \{/);
  // open() closes Time travel's body BEFORE it adds the open class, so that programmatic click cannot close the card it is about to open
  const open = PAGE.slice(PAGE.indexOf("function open() {"), PAGE.indexOf("function sync() {"));
  assert.ok(open.indexOf('.pm-tt-open") as HTMLElement | null)?.click()') < open.indexOf("section.classList.add(OPEN)"));
  // the real-DOM keyboard run (Tab-free focus + Enter / Space on both buttons, in a real browser, before: card and Time travel both open and overlapping; after: card closed, Time travel open, no overlap) is on the PR
});
