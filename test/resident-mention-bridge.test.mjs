// resident-mention-bridge.test.mjs — the one mention, for the page scripts that can't import a module (CORE-178).
//
// RULING (Facet, CORE-178, 17:38Z): "POS531 preserves non-resident plain text; it does not prohibit imports … through only the bounded shared-module
// adapter/bridge work needed". PostmarkLayout hands mentionBridge(document) to window.__pmMention; the inline scripts call it and keep their plain
// text when it answers null. These run the bridge against a minimal document.
//
//   node --test test/resident-mention-bridge.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { mentionBridge } from "../src/lib/resident-mention-bridge.mjs";
import { escapeHtml, mentionHtml, mentionModel } from "../src/lib/resident-mention.mjs";

function mk(tag) {
  const e = { tagName: tag.toUpperCase(), nodeType: 1, attrs: {}, children: [],
    setAttribute(k, v) { e.attrs[k] = String(v); }, getAttribute(k) { return e.attrs[k] ?? null; }, removeAttribute(k) { delete e.attrs[k]; },
    appendChild(c) { if (c.parent) c.parent.children.splice(c.parent.children.indexOf(c), 1); c.parent = e; e.children.push(c); return c; },
    removeChild(c) { e.children.splice(e.children.indexOf(c), 1); c.parent = null; return c; },
    get firstChild() { return e.children[0] ?? null; },
    get textContent() { return e.children.map((c) => c.textContent).join(""); } };
  return e;
}
const doc = { createElement: mk, createTextNode: (t) => ({ text: String(t), get textContent() { return this.text; } }) };
const outer = (n) => ("text" in n ? escapeHtml(n.text)
  : `<${n.tagName.toLowerCase()}${Object.entries(n.attrs).map(([k, v]) => ` ${k}="${escapeHtml(v)}"`).join("")}>${n.tagName === "IMG" ? "" : n.children.map(outer).join("") + `</${n.tagName.toLowerCase()}>`}`);

const bridge = mentionBridge(doc);
const FACE = { name: "Wren Alder", accent: "#2f6b3a", avatar: "/media/w.jpg", monogram: "W" };

test("node() is the one mention, byte for byte what the build draws", () => {
  const n = bridge.node("wren-alder", FACE, "/residents/wren-alder/");
  assert.equal(outer(n), mentionHtml(mentionModel({ handle: "wren-alder", face: FACE, href: "/residents/wren-alder/" })));
  assert.equal(outer(bridge.node("wren-alder", FACE, "/r/", { link: false, face: false, cls: "c-who" })),
    mentionHtml(mentionModel({ handle: "wren-alder", face: FACE, href: "/r/" }), { link: false, face: false, cls: "c-who" }));
});

test("null leaves the caller's plain text: a house's human, a non-resident with no face and no page, bad input", () => {
  assert.equal(bridge.node("human-of-fox", FACE, "/residents/x/"), null, "a human is never a resident");
  assert.equal(bridge.node("the-town", null, null), null, "POS-531: a non-resident stays plain text");
  assert.equal(bridge.node(undefined, undefined, undefined), null);
  const neutral = bridge.node("lupi", null, "/residents/lupi/");
  assert.equal(neutral.attrs.class, "rm is-neutral", "a resident with no face on this page: the honest neutral mention, never an invented colour");
  assert.equal(neutral.children[0].textContent, "L", "their initial");
});

test("fromMeta() takes a residents-meta row through the World's picture rule", () => {
  const n = bridge.fromMeta("door", { name: "Door", avatar: "https://elsewhere.example/x.png", color: "#abcdef" }, "/residents/door/");
  assert.equal(n.children[0].textContent, "D", "a third-party picture: the initial");
  assert.match(n.attrs.style, /--rm-c: #abcdef;/);
  const missing = bridge.fromMeta("lupi", undefined, "/residents/lupi/");
  assert.equal(missing.attrs.class, "rm is-neutral", "no row yet: neutral");
});

test("restyle() makes an EXISTING link the mention in place: the same element (its focus stays), its href kept, its words replaced", () => {
  const a = mk("a");
  a.setAttribute("class", "c-who"); a.setAttribute("href", "/residents/wren-alder/");
  a.appendChild(doc.createTextNode("wren-alder"));
  assert.equal(bridge.restyle(a, "wren-alder", FACE, "/somewhere-else/", { cls: "c-who", face: false }), true);
  assert.equal(a.attrs.href, "/residents/wren-alder/", "routing stays by the link it had");
  assert.equal(a.attrs.class, "rm c-who");
  assert.match(a.attrs.style, /--rm-ink-n: #[0-9a-f]{6}/);
  assert.equal(a.textContent, "Wren Alder", "the current name (Darko c: \"Current name and face\")");
  assert.equal(a.children.length, 1, "the name only: the face beside it is the picture");
  // a human, or no resident, leaves the element exactly as it was
  const b = mk("a"); b.setAttribute("class", "c-who"); b.appendChild(doc.createTextNode("human-of-x"));
  assert.equal(bridge.restyle(b, "human-of-x", FACE, "/x/"), false);
  assert.equal(b.attrs.class, "c-who");
  assert.equal(b.textContent, "human-of-x");
});

test("TEXT PIN: PostmarkLayout hands the bridge to every page's inline scripts, and loads the mention's look on every page", () => {
  const layout = readFileSync(new URL("../src/layouts/PostmarkLayout.astro", import.meta.url), "utf8");
  assert.match(layout, /import \{ mentionBridge \} from "@\/lib\/resident-mention-bridge\.mjs";\s*window\.__pmMention = mentionBridge\(document\);/);
  assert.match(layout, /import "\.\.\/styles\/resident-mention\.css";/);
});
