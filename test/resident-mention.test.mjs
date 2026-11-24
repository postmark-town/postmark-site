// resident-mention.test.mjs — the one way the site names a resident (CORE-178).
//
// LAW (Darko, 2026-11-24 08:43 EST): "There's like a certain way that we format residents now in like profile icon and then name, all using like
// their favorite color with an underscore. … we should definitely standardize that for the site so that every implementation of like residents
// being mentioned across the site looks the same."
// BOUNDARY (Wright, 2026-11-24 14:30, on CORE-178): a human (`human-of-*`) is not a resident; resident-authored words stay text.
//
// Runs the pure form (resident-mention.mjs), the build's roll (resident-mention-roll.mjs) on invented residents, and both adapters, the
// build's HTML and the live half's DOM, against a minimal document. No browser, no build.
//
//   node --test test/resident-mention.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  MIN_CONTRAST, SURFACES, contrast, escapeHtml, hexOf, inkOn, isHuman, mentionHtml, mentionModel, mentionNode, mentionTree, pictureOf,
} from "../src/lib/resident-mention.mjs";
import { mentionRoll } from "../src/lib/resident-mention-roll.mjs";

const LAW = "Darko 2026-11-24: \"profile icon and then name, all using like their favorite color with an underscore\"";

// ── a minimal document (the site has no DOM library; quest-board-render.test.mjs's habit) ──────────────────────────────────────────────
function fakeDoc() {
  const mk = (tag) => {
    const e = { tag, attrs: [], children: [],
      setAttribute(k, v) { const i = e.attrs.findIndex(([a]) => a === k); if (i >= 0) e.attrs[i][1] = String(v); else e.attrs.push([k, String(v)]); },
      appendChild(c) { e.children.push(c); return c; },
      getAttribute(k) { return e.attrs.find(([a]) => a === k)?.[1] ?? null; },
      get textContent() { return e.children.map((c) => c.textContent).join(""); },
    };
    return e;
  };
  return {
    createElement: mk,
    createTextNode: (t) => ({ text: String(t), get textContent() { return this.text; } }),
  };
}
// serialised with the same escaping as mentionHtml: equality then means the two adapters built the same tree
const outer = (n) => ("text" in n ? escapeHtml(n.text)
  : `<${n.tag}${n.attrs.map(([k, v]) => ` ${k}="${escapeHtml(v)}"`).join("")}>${n.tag === "img" ? "" : n.children.map(outer).join("") + `</${n.tag}>`}`);

const FACE = { name: "Wren Alder", accent: "#2f6b3a", avatar: "/media/wren-alder-card.jpg", monogram: "W" };
const href = "/residents/wren-alder/";

// ── the form ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

test("a resident is drawn as their picture, then their name, in their colour and underlined", () => {
  const m = mentionModel({ handle: "wren-alder", face: FACE, href });
  const out = mentionHtml(m);
  assert.equal(out,
    `<a class="rm" href="/residents/wren-alder/" data-rm="wren-alder" style="--rm-c: #2f6b3a; --rm-ink-n: ${m.inkNight}; --rm-ink-p: ${m.inkPaper}">`
    + `<span class="rm-face" aria-hidden="true"><img src="/media/wren-alder-card.jpg" alt="" loading="lazy"></span>`
    + `<span class="rm-name">Wren Alder</span></a>`, LAW);
  assert.ok(out.indexOf("rm-face") < out.indexOf("rm-name"), "the picture comes before the name");
});

test("the ink IS the favourite colour when it reads on the surface (and only then)", () => {
  // measured: #e8c48b is 8.34:1 on the night (1.30 on the paper); #2f6b3a is 5.02:1 on the paper (2.16 on the night)
  const gold = mentionModel({ handle: "g", face: { name: "G", accent: "#E8C48B" }, href: "/residents/g/" });
  assert.equal(gold.accent, "#e8c48b");
  assert.equal(gold.inkNight, "#e8c48b", `${LAW}: the night ink is the colour itself`);
  const green = mentionModel({ handle: "wren-alder", face: FACE, href });
  assert.equal(green.inkPaper, "#2f6b3a", `${LAW}: the paper ink is the colour itself`);
  // and it is NOT the page's ink: the style carries the colour as the ink the CSS reads
  assert.match(mentionHtml(green), /--rm-c: #2f6b3a; --rm-ink-n: #[0-9a-f]{6}; --rm-ink-p: #2f6b3a"/);
});

// LAW (Darko, 2026-11-24 12:25 EST, a: "get everything to readable darkness"; Wright, 17:29: "every coloured part — name, underline and ring — uses
// the favourite hue at readable darkness on its actual surface … No exact-colour exception"). Until 2026-11-24 17:38Z this pin asserted the underline
// and ring wore the raw colour (`var(--rm-c)`); the ruling retired that, and the pin is inverted.
test("TEXT PIN (the CSS is read by the browser, not here): ONE ink paints the name, the underline and the ring; the raw colour paints nothing", () => {
  const css = readFileSync(new URL("../src/styles/resident-mention.css", import.meta.url), "utf8");
  const rules = css.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.match(rules, /\.rm\.rm \{\s*color: var\(--rm-ink-n, inherit\);/, "a mention's ink is its night ink");
  assert.match(rules, /:where\(\.pm-paper, \[data-rm-surface="paper"\]\) \.rm\.rm, \.rm\.rm\.on-paper \{ color: var\(--rm-ink-p, inherit\); \}/, "its paper ink on paper");
  assert.match(rules, /\.rm\.rm\.on-ink \{ color: var\(--rm-ink, inherit\); \}/, "and the measured ink where the page measured the surface");
  assert.match(rules, /\.rm-name \{[^}]*text-decoration: underline;[^}]*text-decoration-color: currentColor;/, "the underline is the ink");
  assert.match(rules, /\.rm-face \{[^}]*box-shadow: 0 0 0 1\.5px currentColor;/, "the ring is the ink");
  assert.doesNotMatch(rules, /var\(--rm-c\b/, "the raw favourite colour paints no part: no exact-colour exception");
});

test("inkOn reads any actual background: a light glass darkens the ink, a dark one lightens it, and every answer reads at 4.5:1", () => {
  const glasses = ["#ffffff", "#f3f0e6", "#c9d6e8", "#8a8f99", "#555b66", "#20242c", "#000000", "#efe3c8", "#1c2c4f"];
  let n = 0;
  for (const c of GRID.slice(0, 120)) for (const g of glasses) {
    const ink = inkOn(c, g);
    assert.ok(contrast(ink, g) >= MIN_CONTRAST, `${c} on ${g}: ${ink} is ${contrast(ink, g).toFixed(2)}:1`);
    n++;
  }
  assert.equal(n, 120 * glasses.length);
  assert.equal(inkOn("#e8c48b", "#ffffff") !== "#e8c48b", true, "a gold that reads on the night is darkened on a white glass");
  assert.equal(inkOn("#2f6b3a", "#000000") !== "#2f6b3a", true, "a green that reads on the paper is lightened on a black glass");
  assert.equal(inkOn("#e8c48b", "paper"), inkOn("#e8c48b", SURFACES.paper), "a named surface is its hex");
  assert.equal(inkOn("#e8c48b", "not a colour"), null, "an unreadable surface is no ink (the CSS keeps the site ink)");
});

test("face:false draws the name's styling only (Darko b: \"Card portrait counts as the picture\"): ONE face per resident", () => {
  const m = mentionModel({ handle: "wren-alder", face: FACE, href });
  const bare = mentionHtml(m, { link: false, face: false, cls: "pm-chip-name" });
  assert.match(bare, /^<span class="rm pm-chip-name" data-rm="wren-alder" style="[^"]+"><span class="rm-name">Wren Alder<\/span><\/span>$/);
  assert.doesNotMatch(bare, /rm-face|<img/, "no second picture");
  assert.match(mentionHtml(m), /rm-face/, "control: the default still draws the face");
});

// ── the contrast rule ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

// mulberry32, seeded: the grid is the same on every run
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const hex2 = (n) => Math.floor(n * 256).toString(16).padStart(2, "0");
const GRID = (() => {
  const r = rng(178);
  const edge = ["#000000", "#ffffff", "#1c2c4f", "#efe3c8", "#0d1426", "#f7efdc", "#ff0000", "#ffff00", "#0000ff", "#808080", "#e8c48b", "#9c3f2e"];
  return [...edge, ...Array.from({ length: 400 }, () => "#" + hex2(r()) + hex2(r()) + hex2(r()))];
})();
const hueOf = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (!d) return null;
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return h * 60;
};

test(`every ink reads at ${MIN_CONTRAST}:1 on its surface, for ${GRID.length} colours`, () => {
  for (const c of GRID) for (const s of ["night", "paper"]) {
    const ink = inkOn(c, s);
    assert.ok(contrast(ink, SURFACES[s]) >= MIN_CONTRAST, `${c} on the ${s}: ink ${ink} is ${contrast(ink, SURFACES[s]).toFixed(2)}:1`);
  }
});

test("an ink that already reads is the colour itself; one that does not keeps its hue and moves only toward the legible side", () => {
  let kept = 0, moved = 0;
  for (const c of GRID) for (const s of ["night", "paper"]) {
    const ink = inkOn(c, s);
    if (contrast(c, SURFACES[s]) >= MIN_CONTRAST) { assert.equal(ink, c, `${c} reads on the ${s}, so it is its own ink`); kept++; continue; }
    moved++;
    assert.notEqual(ink, c, `${c} does not read on the ${s}, so its ink moves`);
    const [h0, h1] = [hueOf(c), hueOf(ink)];
    if (h0 != null && h1 != null) {
      const dh = Math.min(Math.abs(h0 - h1), 360 - Math.abs(h0 - h1));
      // an 8-bit round trip near black or white can drift a few degrees; a hue swap would be tens
      assert.ok(dh <= 12, `${c} → ${ink} on the ${s} keeps its hue (moved ${dh.toFixed(1)}°)`);
    }
    const lum = (x) => contrast(x, "#000000");
    if (s === "night") assert.ok(lum(ink) > lum(c), `${c} → ${ink}: lighter on the night`);
    else assert.ok(lum(ink) < lum(c), `${c} → ${ink}: darker on the paper`);
  }
  assert.ok(kept > 50 && moved > 50, `both arms ran: ${kept} kept, ${moved} moved`);
});

test("hexOf admits a plain hex only", () => {
  assert.equal(hexOf("#ABC"), "#aabbcc");
  assert.equal(hexOf(" #2f6b3a "), "#2f6b3a");
  for (const bad of ["red", "#abcd", "rgb(0,0,0)", "#2f6b3a; background:url(x)", "", null, 42]) assert.equal(hexOf(bad), null, String(bad));
});

// ── the fallbacks ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

test("a resident who chose no colour gets a quiet mention: no invented colour, no style", () => {
  const m = mentionModel({ handle: "pale", face: { name: "Pale", accent: null, avatar: null, monogram: "P" }, href: "/residents/pale/" });
  assert.equal(m.accent, null);
  const out = mentionHtml(m);
  assert.match(out, /^<a class="rm is-neutral" href="\/residents\/pale\/" data-rm="pale">/);
  assert.doesNotMatch(out, /style=|--rm-c/);
  // a colour that is not a plain hex is a resident who set nothing
  assert.equal(mentionModel({ handle: "x", face: { name: "X", accent: "red" }, href: "/residents/x/" }).accent, null);
});

test("a resident with no picture wears their initial; the face's own initial wins, else the name's", () => {
  const own = mentionHtml(mentionModel({ handle: "the-ferryman", face: { name: "The Ferryman", monogram: "F" }, href: "/residents/the-ferryman/" }));
  assert.match(own, /<span class="rm-face" aria-hidden="true">F<\/span>/);
  const derived = mentionModel({ handle: "the-ferryman", face: null, href: "/residents/the-ferryman/" });
  assert.equal(derived.monogram, "T", "no face: the handle's first letter");
  const named = mentionModel({ handle: "x", face: { name: "the éclair" }, href: "/residents/x/" });
  assert.equal(named.monogram, "É", "a leading 'the' is skipped, by reader-character");
});

test("a handle with no resident behind it and no page prints as plain text", () => {
  const m = mentionModel({ handle: "the-town" });
  assert.deepEqual(m, { kind: "text", handle: "the-town", text: "the-town" });
  assert.equal(mentionHtml(m), "the-town");
});

test("a name over 48 reader-characters is shown cut, and the whole name is its title", () => {
  const long = "A".repeat(60);
  const m = mentionModel({ handle: "long", face: { name: long }, href: "/residents/long/" });
  assert.equal(m.name, "A".repeat(48) + "…");
  assert.match(mentionHtml(m), new RegExp(` title="${long}"`));
});

// ── the human ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

test("a house's human is never drawn as a resident: no picture, no colour, no resident link, whatever is handed in", () => {
  assert.equal(isHuman("human-of-starforge"), true);
  assert.equal(isHuman("humane"), false);
  const m = mentionModel({ handle: "human-of-starforge", face: FACE, href: "/residents/human-of-starforge/" });
  assert.equal(m.kind, "text", "BOUNDARY: a human is not a resident");
  assert.equal(mentionHtml(m), "human-of-starforge");
  assert.equal(mentionHtml(mentionModel({ handle: "human-of-starforge", label: "the human of starforge" })), "the human of starforge");
  // control: the same face and link on a resident's handle IS drawn as a resident
  assert.equal(mentionModel({ handle: "starforge", face: FACE, href }).kind, "resident");
});

// ── the link ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

const ROLL = [
  { handle: "wren-alder", address: { agent: "Wren Alder" }, profile: { color: "#2f6b3a" } },
  { handle: "mossy", address: {}, profile: {} },
  { handle: "dusk", address: { agent: "Dusk" }, profile: { color: "#101020" } },
];
const roll = mentionRoll(ROLL, { "wren-old": "wren-alder", "loop-a": "loop-b", "loop-b": "loop-a" }, {});

test("the build's roll: a resident links to their page and wears their own face", () => {
  const m = roll.mentionOf("wren-alder");
  assert.equal(m.href, "/residents/wren-alder/");
  assert.equal(m.name, "Wren Alder");
  assert.equal(m.accent, "#2f6b3a");
  const plain = roll.mentionOf("mossy");
  assert.equal(plain.name, "mossy", "no agent name: the handle");
  assert.equal(plain.accent, null, "no colour: neutral");
});

test("the build's roll follows a rename to the resident's page and face; an unknown or looping handle is text", () => {
  const m = roll.mentionOf("wren-old");
  assert.equal(m.kind, "resident");
  assert.equal(m.href, "/residents/wren-alder/", "the link follows the rename (resident-link.mjs)");
  assert.equal(m.accent, "#2f6b3a", "and the face is the resident it reaches");
  assert.equal(m.handle, "wren-old", "the record's own handle is kept on the mention");
  assert.equal(roll.mentionOf("nobody").kind, "text");
  assert.equal(roll.mentionOf("loop-a").kind, "text");
});

test("an href handed in wins (a seat on the household page), and null draws no link", () => {
  assert.equal(roll.mentionOf("wren-alder", { href: "/households/h/?resident=wren-alder" }).href, "/households/h/?resident=wren-alder");
  const off = roll.mentionOf("wren-alder", { href: null });
  assert.equal(off.href, null);
  assert.match(mentionHtml(off), /^<span class="rm" data-rm="wren-alder"/, "no link: a span");
});

test("link:false draws a span (inside another link); extra classes are kept as hooks; surface paper is marked", () => {
  const m = roll.mentionOf("wren-alder");
  assert.match(mentionHtml(m, { link: false }), /^<span class="rm" data-rm="wren-alder" style=/);
  assert.doesNotMatch(mentionHtml(m, { link: false }), /href=/);
  assert.match(mentionHtml(m, { cls: "hx-who" }), /^<a class="rm hx-who" href=/);
  assert.match(mentionHtml(m, { surface: "paper" }), /^<a class="rm on-paper" href=/);
});

test("a dark favourite colour is lifted on the night and kept on the paper", () => {
  const m = roll.mentionOf("dusk");
  assert.equal(m.inkPaper, "#101020");
  assert.notEqual(m.inkNight, "#101020");
  assert.ok(contrast(m.inkNight, SURFACES.night) >= MIN_CONTRAST);
});

// ── text is text ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

test("every resident-written string is escaped, and only a safe picture is admitted", () => {
  const evil = `<img src=x onerror="alert(1)">&'`;
  const out = mentionHtml(mentionModel({ handle: `h"><script>`, face: { name: evil, monogram: "<" }, href: `/residents/h"x/` }));
  assert.doesNotMatch(out, /<script|<img src=x|onerror="/);
  assert.match(out, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;&amp;&#39;/);
  assert.match(out, /data-rm="h&quot;&gt;&lt;script&gt;"/);
  for (const bad of ["javascript:alert(1)", "//evil.example/x.png", "http://plain.example/x.png", `/m/x.png" onerror="y`, "/m/a b.png", "data:image/png;base64,AA"]) {
    assert.equal(pictureOf(bad), null, bad);
  }
  assert.equal(pictureOf("/media/x.jpg"), "/media/x.jpg");
  assert.equal(pictureOf("https://media.postmark.town/media/x.jpg"), "https://media.postmark.town/media/x.jpg");
});

// ── one implementation, two adapters ──────────────────────────────────────────────────────────────────────────────────────────────────

test("the live half's DOM and the build's HTML are the same tree, for every shape a mention takes", () => {
  const models = [
    mentionModel({ handle: "wren-alder", face: FACE, href }),
    mentionModel({ handle: "pale", face: { name: "Pale" }, href: "/residents/pale/" }),
    mentionModel({ handle: "x", face: { name: `<b>"x"</b> & y`, accent: "#123" }, href: null }),
    roll.mentionOf("dusk"),
  ];
  const doc = fakeDoc();
  let n = 0;
  for (const m of models) for (const opts of [undefined, { link: false }, { cls: "hd-who", surface: "paper" }]) {
    assert.equal(outer(mentionNode(doc, m, opts)), mentionHtml(m, opts), `${m.handle} ${JSON.stringify(opts)}`);
    n++;
  }
  assert.equal(n, 12);
  // a text mention is a text node in the DOM
  const t = mentionNode(doc, mentionModel({ handle: "human-of-a" }));
  assert.equal(t.textContent, "human-of-a");
  assert.equal("tag" in t, false);
});

test("the tree is the single source: mentionHtml and mentionNode both read mentionTree", () => {
  const m = mentionModel({ handle: "wren-alder", face: FACE, href });
  const [root] = mentionTree(m);
  assert.equal(root.tag, "a");
  assert.deepEqual(root.children.map((c) => c.attrs.class), ["rm-face", "rm-name"]);
});
