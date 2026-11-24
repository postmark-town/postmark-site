// resident-mention-callsites.test.mjs — every Site-owned place that names a resident draws the one mention (CORE-178).
//
// LAW (Darko, 2026-11-24 08:43 EST): "we should definitely standardize that for the site so that every implementation of like residents being
// mentioned across the site looks the same."
// BOUNDARY (Wright, 2026-11-24 14:30, on CORE-178): every place the Site itself names a resident takes the shared form; native <option>
// labels stay text-only; resident-authored prose, Daily artwork and Hearth designs stay untouched.
//
// Three instruments, each labelled for what it can see:
//   (1) BEHAVIOUR. The live painters (the household page's, the Hearth's two) run against a minimal document, the letterhead builder and the
//       projects fold run on invented data, and each is asked for the mention it drew.
//   (2) TEXT PINS (the weakest instrument, WIRING-AND-PINS): each moved build-time callsite draws ResidentMention / ResidentMentionModel and
//       no longer its old anchor. They can't see a render; the rendered proof is the build and Facet's capture phase.
//   (3) THE CENSUS (the guard): every resident-page link pattern still in the Site's own source, by file and count, each with the reason it
//       stays. A new one reds here until it is moved to the form or declared with its reason.
//
//   node --test test/resident-mention-callsites.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { inkOn } from "../src/lib/resident-mention.mjs";
import { mentionRoll } from "../src/lib/resident-mention-roll.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

// ── a minimal document ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
class Node {
  constructor(tag) { this.tagName = tag; this.attrs = {}; this.children = []; this.hidden = false; this._text = ""; this.style = { setProperty() {} }; this.dataset = {}; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  removeAttribute(k) { delete this.attrs[k]; }
  appendChild(c) { this.children.push(c); return c; }
  append(...xs) { for (const x of xs) this.children.push(typeof x === "string" ? new Text(x) : x); }
  remove() {}
  set className(v) { this.attrs.class = v; } get className() { return this.attrs.class ?? ""; }
  get classList() { const n = this; return { add(c) { n.className = (n.className + " " + c).trim(); }, toggle() {}, contains: (c) => n.className.split(" ").includes(c) }; }
  set textContent(v) { this.children = []; this._text = String(v ?? ""); }
  get textContent() { return this._text + this.children.map((c) => c.textContent).join(""); }
  set src(v) { this.attrs.src = v; } set href(v) { this.attrs.href = v; } get href() { return this.attrs.href; } set title(v) { this.attrs.title = v; }
  *walk() { for (const c of this.children) if (c instanceof Node) { yield c; yield* c.walk(); } }
  querySelectorAll(sel) {
    const m = /^\[([a-z-]+)(?:="([^"]*)")?\]$/.exec(sel);
    if (!m) return [];
    return [...this.walk()].filter((n) => (m[2] === undefined ? m[1] in n.attrs : n.attrs[m[1]] === m[2]));
  }
  querySelector(sel) { return this.querySelectorAll(sel)[0] ?? null; }
}
class Text { constructor(t) { this.textContent = String(t); } }
globalThis.document = { createElement: (t) => new Node(t), createTextNode: (t) => new Text(t) };
globalThis.CSS = { escape: (s) => s };

const { paintNextBoat } = await import("../src/lib/household-dashboard/paint.mjs");
const { paintChart } = await import("../src/lib/hearth/paint.mjs");
const { paintWindows } = await import("../src/lib/hearth/paint-v2.mjs");
const { letterHtml } = await import("../src/lib/mail-letter.mjs");
const { handLabel } = await import("../src/lib/projects-page.mjs");

const FACES = {
  wren: { handle: "wren", name: "Wren", accent: "#2f6b3a", avatar: "/media/wren-card.jpg", monogram: "W" },
  pale: { handle: "pale", name: "Pale", accent: null, avatar: null, monogram: "P" },
};
const mentionsIn = (root) => [...root.walk()].filter((n) => n.className.split(" ").includes("rm"));
const node = (tag, attr) => { const n = new Node(tag); n.setAttribute(attr, ""); return n; };

/** The one form, as a painter drew it: the link, the picture first, then the name in the colour (or the quiet neutral). */
function assertMention(m, { handle, href, hook }) {
  const f = FACES[handle];
  assert.equal(m.tagName, "a");
  assert.equal(m.attrs.href, href);
  assert.equal(m.attrs["data-rm"], handle);
  assert.deepEqual(m.className.split(" "), ["rm", ...(f.accent ? [] : ["is-neutral"]), hook], "the mention, keeping the surface's hook");
  if (f.accent) {
    assert.equal(m.attrs.style, `--rm-c: ${f.accent}; --rm-ink-n: ${inkOn(f.accent, "night")}; --rm-ink-p: ${inkOn(f.accent, "paper")}`,
      "Darko 2026-11-24: the name in their favourite colour (held legible), the ring and underline in it exactly");
  } else assert.equal(m.attrs.style, undefined, "no colour chosen: no colour invented");
  const [face, name] = m.children;
  assert.equal(face.className, "rm-face");
  assert.equal(face.attrs["aria-hidden"], "true");
  if (f.avatar) assert.equal(face.children[0].attrs.src, f.avatar, "the profile picture");
  else assert.equal(face.textContent, f.monogram, "no picture: the initial");
  assert.equal(name.className, "rm-name");
  assert.equal(name.textContent, f.name, "then the name");
}

// ── (1) behaviour: the live painters ──────────────────────────────────────────────────────────────────────────────────────────────────

test("the household page's who (paint.mjs, the form's source) draws the mention to the seat, coloured and neutral", () => {
  const root = new Node("section");
  const boat = root.appendChild(node("p", "data-hd-boat"));
  const seatHref = (h) => `/households/h/?resident=${h}`;
  paintNextBoat(root, [{ handle: "wren", to: "x" }, { handle: "pale", to: "y" }], { faces: FACES, seatHref });
  const [w, p] = mentionsIn(boat).filter((n) => n.tagName === "a");
  assertMention(w, { handle: "wren", href: seatHref("wren"), hook: "hd-who" });
  assertMention(p, { handle: "pale", href: seatHref("pale"), hook: "hd-who" });
});

test("the Hearth's resident() (hearth/paint.mjs) draws the mention, keeping the stage's hx-who hook", () => {
  const root = new Node("div");
  const box = root.appendChild(node("div", "data-hx-chart"));
  paintChart(root, { doorsteps: { wren: { stamps: { assets: 3 } }, pale: { stamps: { assets: 1 } } } },
    { handles: ["wren", "pale"], faces: FACES, seatHref: (h) => `/residents/${h}/` });
  const drawn = mentionsIn(box).filter((n) => n.tagName === "a");
  assert.equal(drawn.length, 2, "one per resident row");
  assertMention(drawn[0], { handle: "wren", href: "/residents/wren/", hook: "hx-who" });
  assertMention(drawn[1], { handle: "pale", href: "/residents/pale/", hook: "hx-who" });
});

test("the Hearth's v2 who (hearth/paint-v2.mjs) draws the mention, keeping hx-who", () => {
  const root = new Node("div");
  const slot = root.appendChild(new Node("section"));
  slot.setAttribute("data-hearth-slot", "windows");
  slot.appendChild(node("div", "data-hx-windows"));
  paintWindows(root, ["wren"], { faces: FACES, residentHref: (h) => `/residents/${h}/` });
  const [w] = mentionsIn(root).filter((n) => n.tagName === "a");
  assertMention(w, { handle: "wren", href: "/residents/wren/", hook: "hx-who" });
});

// ── (1) behaviour: the build's string builders ────────────────────────────────────────────────────────────────────────────────────────

const ROLL = mentionRoll(
  [{ handle: "wren-alder", address: { agent: "Wren Alder" }, profile: { color: "#2f6b3a" } }, { handle: "lupi", address: { agent: "Lupi" }, profile: {} }],
  { "wren-old": "wren-alder" }, {});
const LETTER = { id: "2031-05-01-wren-old-to-lupi", from: "wren-old", to: "lupi", toList: ["lupi", "the-town"], date: "2031-05-01", body: "hello" };

test("the letterhead (mail-letter.mjs) names each resident on the route as the mention, and a non-resident as text", () => {
  const html = letterHtml(LETTER, { mentionOf: ROLL.mentionOf, hrefOf: ROLL.hrefOf });
  const route = /<span class="route">([\s\S]*?)<\/span><span class="when">/.exec(html)?.[1] ?? "";
  assert.match(route, /^<a class="rm" href="\/residents\/wren-alder\/" data-rm="wren-old" style="--rm-c: #2f6b3a; [^"]*"><span class="rm-face" aria-hidden="true">W<\/span><span class="rm-name">Wren Alder<\/span><\/a> → /,
    "the sender: through the rename to their page, their face, their name in their colour");
  assert.match(route, /<a class="rm is-neutral" href="\/residents\/lupi\/" data-rm="lupi"><span class="rm-face" aria-hidden="true">L<\/span><span class="rm-name">Lupi<\/span><\/a>, the-town$/,
    "a resident with no colour is the quiet mention; the-town is no resident, so text");
  // control: without mentionOf the letter is byte for byte what it was (every other caller, and the tests that pin it)
  const old = letterHtml(LETTER, { hrefOf: ROLL.hrefOf });
  assert.match(old, /<span class="route"><a href="\/residents\/wren-alder\/">wren-old<\/a> → <a href="\/residents\/lupi\/">lupi<\/a>, the-town<\/span>/);
});

test("the projects fold (projects-page.mjs) hands the page one resident's handle, so the page names them as the mention", () => {
  const one = handLabel(["lupi"], { residents: [], houseOf: () => null, nameplate: () => "", displayName: (h) => h.toUpperCase() });
  assert.deepEqual(one, { label: "LUPI", href: "/residents/lupi/", handle: "lupi" });
  const house = { declared: true, slug: "s" };
  const many = handLabel(["a", "b"], { residents: [], houseOf: () => house, nameplate: () => "S House", displayName: (h) => h });
  assert.equal(many.label, "S House", "control: two residents of one house are named by the house");
  assert.equal(many.handle, undefined, "a household hand is a house, never a resident mention");
});

// ── (2) text pins: the moved build-time callsites ─────────────────────────────────────────────────────────────────────────────────────

const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/<!--[\s\S]*?-->/g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/^\s*\/\/.*$/gm, "");

const MOVED = {
  "src/components/CalendarCard.astro": [/<ResidentMention handle=\{e\.host\} \/>/, /<li><ResidentMention handle=\{h\} \/><\/li>/],
  "src/components/SparkCard.astro": [/by <ResidentMention handle=\{by\} \/>/],
  "town/pages/sparks/[...id].astro": [/<ResidentMention handle=\{by\} \/>/],
  "src/components/hearth/HearthSlot.astro": [/<ResidentMention handle=\{f\.handle\} face=\{f\} href=\{seat\(f\.handle\)\} cls="hx-who" \/>/, /<ResidentMention handle=\{r\.handle\} \/>/],
  "src/components/HallOfFame.astro": [/<span class="hof-who"><ResidentMention handle=\{r\.handle\} link=\{false\} \/><\/span>/, /<ResidentMention handle=\{h\.handle\} \/>/],
  "src/components/PotCards.astro": [/who\.attached \? <ResidentMention handle=\{who\.patron\} \/>/],
  "town/pages/fund/[pot].astro": [/r\.attached\s*\?\s*<ResidentMention handle=\{r\.patron\} \/>/, /s\.attached \? <ResidentMention handle=\{s\.patron\} \/>/],
  "town/pages/projects/index.astro": [/h\.handle \? <ResidentMention handle=\{h\.handle\} \/>/],
  "town/pages/index.astro": [/<ResidentMention handle="wright" \/> and/, /<ResidentMention handle="rei" \/>/],
  "town/pages/residents/[handle]/view/[rendition].astro": [/a rendition by <ResidentMention handle=\{rend\.author\} \/>/],
  "town/components/Household.astro": [/a pane authored by <ResidentMention handle=\{t\.handle\} \/>/],
  "town/pages/replay/index.astro": [/<ResidentMention handle=\{g\.who\} cls="r-who" \/>/],
  "town/pages/mail/[thread].astro": [/<ResidentMentionModel model=\{mentionAt\(i\)\} \/>/],
  "town/pages/mail/with/[pair].astro": [/<ResidentMentionModel model=\{mentions\.a\} \/>/, /<ResidentMentionModel model=\{mentions\.b\} \/>/],
};

test(`TEXT PIN: each of the ${Object.keys(MOVED).length} moved build-time callsites draws the one mention`, () => {
  for (const [rel, pins] of Object.entries(MOVED)) {
    const src = code(read(rel));
    for (const pin of pins) assert.match(src, pin, `${rel}: ${pin}`);
    assert.match(src, /import ResidentMention(?:Model)? from "@\/components\/ResidentMention(?:Model)?\.astro"|import ResidentMention from "\.\.\/ResidentMention\.astro"/, `${rel} imports the component`);
  }
});

test("TEXT PIN: the build's adapters write no set:html, and the model drawer imports no data (an incremental page may use it)", () => {
  for (const rel of ["src/components/ResidentMention.astro", "src/components/ResidentMentionModel.astro"]) {
    assert.equal(/\sset:html\s*=/.test(code(read(rel))), false, `${rel} writes set:html: resident words must stay text`);
  }
  const model = code(read("src/components/ResidentMentionModel.astro"));
  assert.doesNotMatch(model, /data\/postmark|resident-mentions/, "ResidentMentionModel reads nothing outside its props");
  assert.match(model, /mentionTree\(model/, "and it draws the one tree");
});

// ── (3) the census ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
//
// Every resident-page link pattern (`/residents/${…}`, `"/residents/" + …`, `residentHref(`) still in the Site's own source, comments
// stripped. Each stays for a reason, and the reason is one of: it is the link a mention is drawn WITH (a seat, an href handed in); it is
// navigation, an API door, a fetch or a redirect, not a name; it belongs to an open PR (CORE-177, site #488) or is retired; it waits on a call
// sent up with CORE-178's hand-in (cards and chips; inline scripts that cannot import the module; out-of-house names with no face on the page).

const DECLARED = {
  // the link a mention is drawn with
  "src/components/hearth/HearthSlot.astro": [1, "seat(): the href the closest-correspondents mention and the residents' cards are drawn with"],
  "src/components/household-dashboard/HouseDashboard.astro": [2, "seat() and seatHref(): the hrefs paint.mjs's who() mention is drawn with"],
  "src/lib/hearth/stage.mjs": [1, "seatHref: the href the Hearth's mentions are drawn with"],
  "src/lib/hearth/paint-v2.mjs": [3, "who()'s href (2: the residentHref fallback) and other(): a resident outside the house, with no face on the page (sent up)"],
  "src/lib/household-dashboard/paint.mjs": [1, "other(): a resident outside the house, with no face on the page (sent up)"],
  "src/lib/mail-routes.mjs": [3, "residentHref: the links table and the letters' hrefOf, beside the mention models it supplies"],
  "src/lib/resident-link.mjs": [1, "the link rule itself"],
  "src/lib/projects-page.mjs": [1, "handLabel's href, carried beside the handle the page draws the mention from"],
  "src/lib/funding.mjs": [1, "patronLabel's href, carried beside `attached`, which the pages draw the mention from"],
  "src/lib/hall-of-fame.mjs": [3, "a ledger record's link (its label is the record's words), the row's \"…'s page →\" navigation link, and the holo row's href"],
  // navigation, an API door, a fetch or a redirect: not a name
  "src/components/WorldCockpit.astro": [1, "a fetch of the office's resident read"],
  "src/lib/home.mjs": [1, "householdHref: where a household button goes"],
  "src/lib/meeps-quarter.mjs": [1, "the \"resident page →\" button on a meep's card"],
  "src/lib/page-fallback.mjs": [1, "a fetch of the office's resident read"],
  "town/pages/404.astro": [2, "the API door's address, printed as an address"],
  "town/pages/residents/[handle].astro": [1, "the page's own API door"],
  "town/pages/residents/[handle]/appearance.astro": [5, "the back link, the API doors and the fetches"],
  "town/pages/residents/[handle]/view/[rendition].astro": [3, "the back link and the picker's navigation (the byline is moved)"],
  "town/pages/window/[handle].astro": [1, "a permanent redirect to the resident's window"],
  "town/components/HouseholdPage.astro": [1, "the old ?resident= address, redirected to the resident's page"],
  "town/pages/town/index.astro": [1, "a think-tank backer row naming a HOUSEHOLD key under /residents/ (not a resident handle; sent up)"],
  // belongs to an open PR, or retired
  "src/lib/calendar.mjs": [2, "residentHref's definition (CORE-177's file, site #488)"],
  "town/pages/conversations/index.astro": [1, "personLink (CORE-177 moves it into conversation-host.mjs, site #488)"],
  "town/pages/events/[host]/[slug].astro": [1, "the event page (CORE-177's file, site #488)"],
  "src/components/QuestStandings.astro": [1, "retired by POS-967: nothing renders it"],
  // waits on a call sent up with the hand-in
  "src/components/HouseRail.astro": [1, "the sub-rail's chips: a chip is a picture and a name already (Darko, 2026-11-11); card/chip shape sent up"],
  "src/components/ResidentCard.astro": [1, "the directory card: card/chip shape sent up"],
  "src/lib/write-someone-new.mjs": [1, "the dealt card's profile link: its build data carries no face (sent up)"],
  "src/layouts/PostmarkLayout.astro": [2, "the main rail's household-faces menu and the \"You're in\" notice (inline script; sent up)"],
  "town/pages/index.astro": [4, "the ticker, the hero's window line (inline script), its button, and the Meet-the-residents cards (sent up)"],
  "town/pages/replay/index.astro": [2, "the settlement column's residentHref gate (moved) and the live feed's personLink (inline module; sent up)"],
  "town/pages/window/index.astro": [1, "the street's window cards (inline script; sent up)"],
  "town/components/Household.astro": [8, "the appearance button, the tab URLs, the rendition egg, two fetches, and the quest 'Sent to today' names (inline script; sent up)"],
};

const DIRS = ["src/components", "src/lib", "src/layouts", "town/pages", "town/components"];
const walk = (d, out = []) => {
  for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p, out); else if (/\.(astro|mjs|js)$/.test(n)) out.push(p); }
  return out;
};
const PATTERN = new RegExp(["/residents/\\$\\{", "[\"'`]/residents/[\"'`]\\s*\\+", "residentHref\\("].join("|"), "g");

test("THE CENSUS: every resident-page link left in the Site's source is declared, with its count and its reason", () => {
  const found = {};
  for (const d of DIRS) for (const f of walk(join(ROOT, d))) {
    const n = (code(readFileSync(f, "utf8")).match(PATTERN) ?? []).length;
    if (n) found[relative(ROOT, f).split(sep).join("/")] = n;
  }
  assert.ok(Object.keys(found).length > 20, `the census read the tree (${Object.keys(found).length} files)`);
  const declared = Object.fromEntries(Object.entries(DECLARED).map(([f, [n]]) => [f, n]));
  assert.deepEqual(found, declared, "a resident-page link was added (draw the mention, or declare it with its reason) or one was moved (take it off the list)");
  for (const [f, [, why]] of Object.entries(DECLARED)) assert.ok(why.length > 10, `${f} has a reason`);
});

test("control: the census pattern catches each written form, and comments are not counted", () => {
  const forms = ["href={`/residents/${h}/`}", 'a.href = "/residents/" + h;', "residentHref(h)", "'/residents/' + h"];
  for (const f of forms) assert.equal((code(f).match(PATTERN) ?? []).length, 1, f);
  assert.equal((code("// a.href = \"/residents/\" + h;\n").match(PATTERN) ?? []).length, 0, "a comment is not a callsite");
});
