// resident-mention-surface.test.mjs — a mention's ink measured on its actual surface (CORE-178).
//
// LAW (Darko, 2026-11-24 12:25 EST, a): "get everything to readable darkness". Wright, 17:29 (Facet's ruling, 17:38Z): "uses the favourite hue at
// readable darkness on its actual surface, including authored light-glass surfaces … Support the actual host surface; night/paper assumptions alone
// do not cover glass."
//
// Pure: the pass is driven with invented surfaces through its `getStyle` seam (the page hands it window.getComputedStyle). What the browser's own
// computed colours look like on a real design is the capture phase's to show.
//
//   node --test test/resident-mention-surface.test.mjs

import test from "node:test";
import assert from "node:assert/strict";

import { FLOOR, composite, inkOnActualSurface, parseColour, surfaceUnder } from "../src/lib/resident-mention-surface.mjs";
import { MIN_CONTRAST, contrast, inkOn, mentionModel, mentionNode } from "../src/lib/resident-mention.mjs";

// a minimal DOM: elements with a parent, attributes, a class list and a style that keeps custom properties in the style attribute
function el(tag, bg = null, parent = null) {
  const n = {
    nodeType: 1, tag, bg, parentElement: parent, children: [], attrs: {},
    setAttribute(k, v) { n.attrs[k] = String(v); }, getAttribute(k) { return n.attrs[k] ?? null; },
    appendChild(c) { c.parentElement = n; n.children.push(c); return c; },
    get classList() { return { contains: (c) => (n.attrs.class ?? "").split(" ").includes(c), add: (c) => { if (!(n.attrs.class ?? "").split(" ").includes(c)) n.attrs.class = ((n.attrs.class ?? "") + " " + c).trim(); } }; },
    style: { setProperty(k, v) { n.attrs.style = ((n.attrs.style ?? "").replace(new RegExp(`;?\\s*${k}:[^;]*`), "") + `; ${k}: ${v}`).replace(/^;\s*/, ""); } },
    querySelectorAll(sel) {
      if (sel !== ".rm") throw new Error("the fake knows only .rm");
      const out = [];
      const walk = (x) => { for (const c of x.children) { if ((c.attrs?.class ?? "").split(" ").includes("rm")) out.push(c); if (c.children) walk(c); } };
      walk(n);
      return out;
    },
  };
  return n;
}
const doc = { createElement: (t) => el(t), createTextNode: (t) => ({ textContent: String(t) }) };
const getStyle = (n) => ({ backgroundColor: n.bg ?? "rgba(0, 0, 0, 0)" });
const inkOf = (m) => /--rm-ink:\s*(#[0-9a-f]{6})/.exec(m.attrs.style ?? "")?.[1] ?? null;

const GOLD = { name: "Gold", accent: "#e8c48b" };       // reads on the night (8.34:1), not on paper (1.30:1)
const mention = (face, handle = "g") => mentionNode(doc, mentionModel({ handle, face, href: `/residents/${handle}/` }));

test("parseColour reads what getComputedStyle hands back, and refuses what it can't read", () => {
  assert.deepEqual(parseColour("rgb(13, 20, 38)"), { r: 13, g: 20, b: 38, a: 1 });
  assert.deepEqual(parseColour("rgba(13, 20, 38, 0.62)"), { r: 13, g: 20, b: 38, a: 0.62 });
  assert.deepEqual(parseColour("rgb(255 255 255 / 50%)"), { r: 255, g: 255, b: 255, a: 0.5 });
  assert.deepEqual(parseColour("#ABC"), { r: 170, g: 187, b: 204, a: 1 });
  assert.equal(parseColour("transparent").a, 0);
  for (const bad of ["", "red", "url(x)", "rgb(a, b, c)", null]) assert.equal(parseColour(bad), null, String(bad));
});

test("composite lays translucent layers over the first opaque one, or over the page's night", () => {
  assert.equal(composite([], FLOOR), FLOOR, "nothing opaque: the night");
  assert.equal(composite([{ r: 255, g: 255, b: 255, a: 1 }]), "#ffffff");
  assert.equal(composite([{ r: 255, g: 255, b: 255, a: 0.5 }], "#000000"), "#808080", "half white over black");
  // the nearest layer is on top: a red half-glass over a white card
  assert.equal(composite([{ r: 255, g: 0, b: 0, a: 0.5 }, { r: 255, g: 255, b: 255, a: 1 }]), "#ff8080");
});

test("surfaceUnder walks up to the first opaque background and composites what lies above it", () => {
  const page = el("main", "rgb(7, 11, 21)");
  const card = page.appendChild(el("section", "rgba(255, 255, 255, 0.9)"));
  const line = card.appendChild(el("p"));
  const m = line.appendChild(mention(GOLD));
  assert.equal(surfaceUnder(m, getStyle), composite([{ r: 255, g: 255, b: 255, a: 0.9 }, { r: 7, g: 11, b: 21, a: 1 }]));
  const lone = el("p");
  assert.equal(surfaceUnder(lone.appendChild(mention(GOLD)), getStyle), FLOOR, "no background anywhere: the night");
});

test("on an authored LIGHT glass, a gold that reads on the night is re-inked darker, and the ink reads there (ring and underline follow it)", () => {
  const stage = el("div", "rgb(7, 11, 21)");
  const glass = stage.appendChild(el("section", "rgb(246, 243, 236)"));       // a design's light glass
  const m = glass.appendChild(mention(GOLD));
  assert.equal(inkOnActualSurface(stage, { getStyle }), 1);
  const ink = inkOf(m);
  assert.ok(ink, "the mention carries a measured ink");
  assert.ok(m.classList.contains("on-ink"), "and says so, so resident-mention.css paints it");
  assert.ok(contrast(ink, "#f6f3ec") >= MIN_CONTRAST, `LAW: readable darkness on the actual surface (${ink} is ${contrast(ink, "#f6f3ec").toFixed(2)}:1)`);
  assert.notEqual(ink, "#e8c48b", "no exact-colour exception: the raw gold does not read there");
  assert.equal(ink, inkOn("#e8c48b", "#f6f3ec"));
});

test("on the night, the measured ink is the night's: the gold itself", () => {
  const stage = el("div", "rgb(7, 11, 21)");
  const m = stage.appendChild(el("section", "rgba(13, 20, 38, 0.62)")).appendChild(mention(GOLD));
  inkOnActualSurface(stage, { getStyle });
  assert.equal(inkOf(m), "#e8c48b");
});

test("a neutral mention (no colour chosen) is left alone, a repeat pass overwrites rather than stacks, and no seam is no pass", () => {
  const stage = el("div", "rgb(255, 255, 255)");
  const plain = stage.appendChild(mention({ name: "Pale" }, "pale"));
  const gold = stage.appendChild(mention(GOLD));
  assert.equal(inkOnActualSurface(stage, { getStyle }), 1);
  assert.equal(inkOf(plain), null, "no colour: no invented colour");
  assert.equal(plain.classList.contains("on-ink"), false);
  inkOnActualSurface(stage, { getStyle });
  assert.equal((gold.attrs.style.match(/--rm-ink:/g) ?? []).length, 1, "one --rm-ink, however many passes");
  assert.equal(inkOnActualSurface(stage, {}), 0, "no getStyle: nothing touched");
  assert.equal(inkOnActualSurface(null, { getStyle }), 0);
});

test("a getStyle that throws on one layer skips it, and the pass still inks", () => {
  const stage = el("div", "rgb(255, 255, 255)");
  const m = stage.appendChild(el("span")).appendChild(mention(GOLD));
  const flaky = (n) => { if (n.tag === "span") throw new Error("detached"); return getStyle(n); };
  assert.equal(inkOnActualSurface(stage, { getStyle: flaky }), 1);
  assert.ok(contrast(inkOf(m), "#ffffff") >= MIN_CONTRAST);
});
