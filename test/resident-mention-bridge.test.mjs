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

import { mentionBridge, upgradePending, PENDING } from "../src/lib/resident-mention-bridge.mjs";
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

// ── the load order (Facet, CORE-178: "/window/ fetches once and paints a plain name if window.__pmMention is absent … a fast windows response plus
// delayed module leaves known residents plain permanently"; "data-first and bridge-first must both end in the shared form once available, preserving
// links/focus and without another data read") ──────────────────────────────────────────────────────────────────────────────────────────────
// A root that can find its marked elements, as document.querySelectorAll("[data-rm-pending]") does.
function rootOf(...kids) {
  const r = mk("div");
  for (const k of kids) r.appendChild(k);
  r.querySelectorAll = (sel) => {
    if (sel !== "[data-rm-pending]") throw new Error("the fake root knows only [data-rm-pending]");
    const out = [];
    const walk = (n) => { for (const c of n.children ?? []) { if (c.attrs && "data-rm-pending" in c.attrs) out.push(c); walk(c); } };
    walk(r);
    return out;
  };
  return r;
}
const META = { name: "Wren Alder", avatar: "/media/w.jpg", color: "#2f6b3a" };
// each consumer's plain fallback, exactly as its inline script marks it when the bridge is not here yet
const plainLink = (cls, text, href) => { const a = mk("a"); a.setAttribute("class", cls); a.setAttribute("href", href); a.appendChild(doc.createTextNode(text)); return a; };
const CONSUMERS = {
  "the window street (a span inside the card's link, the build's face)": () => {
    const s = mk("span"); s.appendChild(doc.createTextNode("Wren Alder"));
    s.setAttribute("data-rm-pending", "wren-alder"); s.setAttribute("data-rm-face", JSON.stringify(FACE)); s.setAttribute("data-rm-opts", JSON.stringify({ link: false }));
    return { el: s, want: mentionHtml(mentionModel({ handle: "wren-alder", face: FACE, href: null }), { link: false }) };
  },
  "the replay feed (a link, the residents-meta row)": () => {
    const a = plainLink("r-who", "Wren Alder", "/residents/wren-alder/");
    a.setAttribute("data-rm-pending", "wren-alder"); a.setAttribute("data-rm-meta", JSON.stringify(META)); a.setAttribute("data-rm-opts", JSON.stringify({ cls: "r-who" }));
    return { el: a, cls: "rm r-who", name: "Wren Alder", face: true };
  },
  "the Conversations lists (a link, the row, the name's styling beside the speaker's face)": () => {
    const a = plainLink("c-who", "wren-alder", "/residents/wren-alder/");
    a.setAttribute("data-rm-pending", "wren-alder"); a.setAttribute("data-rm-meta", JSON.stringify(META)); a.setAttribute("data-rm-opts", JSON.stringify({ cls: "c-who", face: false }));
    return { el: a, cls: "rm c-who", name: "Wren Alder", face: false };
  },
  "the household quest names (a link, no face on the page: the neutral mention)": () => {
    const a = plainLink("", "lupi", "/residents/lupi/"); a.removeAttribute("class");
    a.setAttribute("data-rm-pending", "lupi");
    return { el: a, cls: "rm is-neutral", name: "lupi", face: true };
  },
  "the front page's hero line (a link with its own title, the build's face)": () => {
    const a = plainLink("", "Wren Alder", "/residents/wren-alder/#window"); a.removeAttribute("class");
    a.setAttribute("title", "Wren Alder’s window");
    a.setAttribute("data-rm-pending", "wren-alder"); a.setAttribute("data-rm-face", JSON.stringify(FACE));
    return { el: a, cls: "rm", name: "Wren Alder", face: true, title: "Wren Alder’s window" };
  },
};

for (const [name, make] of Object.entries(CONSUMERS)) {
  test(`DATA FIRST, then the bridge: ${name} becomes the mention in place, its link and focus kept, nothing read again`, () => {
    const c = make();
    const href = c.el.getAttribute("href");
    const root = rootOf(c.el);
    const focused = c.el;                                        // the element a reader may be focused on
    assert.equal(upgradePending(root, mentionBridge(doc)), 1, "the bridge drew the marked element on arrival");
    assert.equal(root.children[0], focused, "the same element: its focus stays");
    if (c.want) assert.equal(outer(c.el), c.want, "the same mention the bridge-first path draws");
    else {
      assert.equal(c.el.attrs.class, c.cls);
      assert.equal(c.el.attrs.href, href, "its link (routing by handle) is kept");
      assert.match(c.el.attrs.style ?? "", c.cls.includes("is-neutral") ? /^$/ : /--rm-ink-n: #[0-9a-f]{6}/);
      assert.equal(c.el.children.at(-1).textContent, c.name, "the current name");
      assert.equal(c.el.children.some((k) => k.attrs?.class === "rm-face"), c.face, c.face ? "with its face" : "with no second face");
    }
    if (c.title) assert.equal(c.el.attrs.title, c.title, "its own title stays");
    for (const k of PENDING) assert.equal(k in c.el.attrs, false, `the mark ${k} is gone`);
    assert.equal(upgradePending(root, mentionBridge(doc)), 0, "a second pass draws nothing twice");
  });
}

test("BRIDGE FIRST, then the data: a consumer that finds the bridge draws the mention at once and marks nothing, so the arrival pass has nothing to redo", () => {
  const bridge = mentionBridge(doc);
  // what each inline script does when window.__pmMention is already there
  const drawn = [
    bridge.node("wren-alder", FACE, "/residents/wren-alder/", { link: false }),
    bridge.fromMeta("wren-alder", META, "/residents/wren-alder/", { cls: "r-who" }),
    bridge.fromMeta("wren-alder", META, "/residents/wren-alder/", { cls: "c-who", face: false }),
    bridge.node("lupi", null, "/residents/lupi/"),
    bridge.node("wren-alder", FACE, "/residents/wren-alder/#window"),
  ];
  for (const n of drawn) { assert.ok(n, "drawn"); assert.match(n.attrs.class, /^rm\b/); assert.equal("data-rm-pending" in n.attrs, false); }
  assert.equal(upgradePending(rootOf(...drawn), bridge), 0);
});

test("the honest floor: a mark the bridge can't draw (a house's human, a broken mark) stays as it was, plain, and no bridge is no pass", () => {
  const human = plainLink("c-who", "human-of-fox", "/residents/human-of-fox/");
  human.setAttribute("data-rm-pending", "human-of-fox");
  const broken = mk("span"); broken.appendChild(doc.createTextNode("x"));
  broken.setAttribute("data-rm-pending", "x"); broken.setAttribute("data-rm-face", "{not json");
  const root = rootOf(human, broken);
  assert.equal(upgradePending(root, mentionBridge(doc)), 0, "nothing it can't vouch for is drawn");
  assert.equal(human.attrs.class, "c-who");
  assert.equal(human.textContent, "human-of-fox");
  assert.equal(broken.textContent, "x");
  assert.equal(upgradePending(root, null), 0);
  assert.equal(upgradePending(null, mentionBridge(doc)), 0);
});

test("TEXT PIN (the inline scripts can't be imported; their fallbacks are read as source): each consumer marks its plain fallback for the bridge", () => {
  const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
  const marks = {
    "town/pages/window/index.astro": [/plain\.setAttribute\("data-rm-pending", h\);/, /plain\.setAttribute\("data-rm-face", JSON\.stringify\(streetFaces\[h\]\)\);/],
    // the resolved row (F2: a speaker recorded under an old handle carries the resident's current face)
    "town/pages/replay/index.astro": [/if \(!window\.__pmMention\) \{\s*a\.setAttribute\("data-rm-pending", handle\);/, /if \(row\) a\.setAttribute\("data-rm-meta", JSON\.stringify\(row\)\)/],
    "town/pages/conversations/index.astro": [/markPending\(a, handle\);/, /else if \(link\) markPending\(link, h\);/, /a\.setAttribute\("data-rm-meta", JSON\.stringify\(faces\[key\]\)\);/],
    "town/components/Household.astro": [/!window\.__pmMention\) a\.setAttribute\("data-rm-pending", other\);/, /!window\.__pmMention\) a\.setAttribute\("data-rm-pending", cur\);/],
    "town/pages/index.astro": [/if \(!window\.__pmMention && info\.face\) \{\s*a\.setAttribute\("data-rm-pending", h\);/],
  };
  for (const [rel, pins] of Object.entries(marks)) for (const pin of pins) assert.match(src(rel), pin, `${rel}: ${pin}`);
  const layout = src("src/layouts/PostmarkLayout.astro");
  const at = layout.indexOf("upgradePending(document, window.__pmMention);");
  assert.ok(at > 0 && at > layout.indexOf("window.__pmMention = mentionBridge(document);") && at < layout.indexOf('new CustomEvent("pm:mention-ready")'),
    "the layout draws every mark between setting the bridge and saying it is ready");
});

test("TEXT PIN: PostmarkLayout hands the bridge to every page's inline scripts, and loads the mention's look on every page", () => {
  const layout = readFileSync(new URL("../src/layouts/PostmarkLayout.astro", import.meta.url), "utf8");
  assert.match(layout, /import \{ mentionBridge, upgradePending \} from "@\/lib\/resident-mention-bridge\.mjs";\s*window\.__pmMention = mentionBridge\(document\);/);
  assert.match(layout, /import "\.\.\/styles\/resident-mention\.css";/);
});
