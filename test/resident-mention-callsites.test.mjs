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

test("write-someone-new carries the dealt resident's PUBLIC face (colour, picture, initial), so the card names them as the mention", async () => {
  const { publicHouses, deal } = await import("../src/lib/write-someone-new.mjs");
  const NOW = Date.parse("2031-05-01T12:00:00Z");
  const member = { handle: "wren-alder", address: { agent: "Wren Alder" }, counts: { sent: 3 } };
  const houses = [{ key: "h", name: "H", href: null, members: [member] }];
  const opts = { now: NOW, houseLast: () => ({ at: new Date(NOW - 86_400_000).toISOString() }), noteOf: () => "a line", nameOf: (r) => r.address.agent };
  const withFace = publicHouses(houses, { ...opts, faceOf: () => ({ accent: "#2f6b3a", avatar: "/m/w.jpg", monogram: "W", bioLine: "private-ish", homeImages: ["x"] }) });
  assert.deepEqual(withFace.houses[0].members[0].face, { name: "Wren Alder", accent: "#2f6b3a", avatar: "/m/w.jpg", monogram: "W" }, "only the public face fields");
  const without = publicHouses(houses, opts);
  assert.equal("face" in without.houses[0].members[0], false, "control: without faceOf the card's data is exactly what it was");
  const dealt = deal(withFace, { now: NOW, rng: () => 0 });
  assert.equal(dealt.status, "ok");
  assert.deepEqual(dealt.face, withFace.houses[0].members[0].face, "the deal hands the page the face");
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
  // the ruling of 17:38Z: cards and chips take the name's styling beside their own portrait (b), the ticker and labels the whole mention
  "src/components/HouseRail.astro": [/<ResidentMention handle=\{f\.handle\} face=\{f\} link=\{false\} noFace cls="pm-chip-name" \/>/, /--pm-chip-color: \$\{inkOn\(f\.accent, "night"\) \?\? NEUTRAL\}/],
  // CORE-178 FIX (Facet): the directory tile's big picture is the household's HOME art, not the resident's portrait, so the name wears its face
  "src/components/ResidentCard.astro": [/<b><ResidentMention handle=\{r\.handle\} link=\{false\} \/><\/b>/],
  "src/components/household-dashboard/ResidentCard.astro": [/<ResidentMention handle=\{f\.handle\} face=\{f\} href=\{href\} noFace cls="hd-card-name" \/>/],
  "town/pages/meeps/index.astro": [/<span class="cq-name">\{m\.profile\.inRoll \? <ResidentMention handle=\{m\.handle\} link=\{false\} noFace \/> : m\.display\}<\/span>/, /<h2>\{m\.profile\.inRoll \? <ResidentMention/],
  "town/pages/bulletin/index.astro": [/<span class="hand-name">\{m\.handle \? <ResidentMention handle=\{m\.handle\} link=\{false\} noFace surface=\{HAND_PLATE\} \/> : m\.name\}<\/span>/, /const HAND_PLATE = "#2f3a56";/],
};
// and the front page's newer ones (the same file as its credits, above)
const FRONT_MORE = [
  // CORE-178 FIX (Facet): "Meet the Residents" tiles show the household's HOME art, so the name wears the resident's face
  /<b class="rc-name"><ResidentMention handle=\{m\.handle\} link=\{false\} \/><\/b>/,
  /<ResidentMention handle=\{it\.parts\.from\} link=\{false\} \/> → <ResidentMention handle=\{it\.parts\.to\} link=\{false\} \/>/,
  /★ <ResidentMention handle=\{it\.arrival\.handle\} link=\{false\} \/> joined the white pages/,
  /h\.handle \? <ResidentMention handle=\{h\.handle\} link=\{false\} \/> : h\.label/,
];
test("TEXT PIN: the front page's resident cards, its makers and its ticker draw the mention", () => {
  const src = code(read("town/pages/index.astro"));
  for (const pin of FRONT_MORE) assert.match(src, pin, String(pin));
});

// the inline scripts, which reach the one mention through PostmarkLayout's bridge (window.__pmMention), and the bundled one that imports it
const BRIDGED = {
  // F2: each resolves a recorded handle to the resident it is now (the replay's own pageOf walk; the build's renames elsewhere) before it looks up a face or a page
  "town/pages/replay/index.astro": [/const href = "\/residents\/" \+ encodeURIComponent\(page\) \+ "\/";[\s\S]*?const row = faces\[page\] \?\? faces\[handle\];\s*const mention = window\.__pmMention\?\.fromMeta\(handle, row, href, \{ cls: "r-who" \}\);/],
  "town/pages/conversations/index.astro": [/var key = currentHandle\(handle\);\s*var href = "\/residents\/" \+ encodeURIComponent\(key\) \+ "\/";/, /window\.__pmMention\.fromMeta\(handle, faces\[key\], href, \{ cls: "c-who", face: false \}\)/, /window\.__pmMention\.restyleFromMeta\(link, h, faces\[currentHandle\(h\)\], link\.getAttribute\("href"\), \{ cls: "c-who", face: false \}\)/, /var meta = \(faces && faces\[currentHandle\(handle\)\]\) \|\| null;/],
  "town/components/Household.astro": [/var other = \(typeof residentAliases === "object" && residentAliases && Object\.prototype\.hasOwnProperty\.call\(residentAliases, u\.other\)\) \? residentAliases\[u\.other\] : u\.other;/, /window\.__pmMention\.node\(other, null, /, /window\.__pmMention\.node\(cur, null, /, /residentAliases: mentionAliases/],
  "town/pages/index.astro": [/window\.__pmMention\.node\(h, info\.face, href\)/],
  "town/pages/window/index.astro": [/window\.__pmMention\.node\(h, streetFaces\[h\], "\/residents\/" \+ encodeURIComponent\(h\) \+ "\/", \{ link: false \}\)/],
  "town/pages/households/index.astro": [/import \{ mentionModel, mentionNode \} from "@\/lib\/resident-mention\.mjs";/, /name\.replaceChildren\(mentionNode\(document, m, \{ link: false \}\)\)/],
};
test(`TEXT PIN: the ${Object.keys(BRIDGED).length} script-drawn callsites reach the one mention, and keep their plain text without it`, () => {
  for (const [rel, pins] of Object.entries(BRIDGED)) {
    const src = code(read(rel));
    for (const pin of pins) assert.match(src, pin, `${rel}: ${pin}`);
  }
});

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
// stripped. Each stays for a reason, and since Facet's ruling of 17:38Z the reason is one of: it is the link a mention is drawn WITH (a seat, an
// href handed in, a card's or chip's own link whose name inside is the mention); it is navigation, an API door, a fetch or a redirect, not a name;
// it is a household's key, kept distinct from residents; it is uncalled or retired; or it is a picture-only
// cluster Darko ruled (the main rail's corner faces: "just for the profile pictures", 2026-11-11), with no name on it to style.

const DECLARED = {
  // the link a mention is drawn with
  "src/components/hearth/HearthSlot.astro": [1, "seat(): the href the closest-correspondents mention and the residents' cards are drawn with"],
  "src/components/household-dashboard/HouseDashboard.astro": [2, "seat() and seatHref(): the hrefs paint.mjs's who() mention is drawn with"],
  "src/lib/hearth/stage.mjs": [1, "seatHref: the href the Hearth's mentions are drawn with"],
  "src/lib/hearth/paint-v2.mjs": [3, "who()'s href (2: the residentHref fallback) and other()'s: the neutral mention of a resident outside the house is drawn with it"],
  "src/lib/hearth/paint.mjs": [1, "outsider()'s href: the neutral mention of a host outside the house is drawn with it"],
  "src/lib/household-dashboard/paint.mjs": [1, "other()'s href: the neutral mention of a resident outside the house is drawn with it"],
  "src/lib/mail-routes.mjs": [3, "residentHref: the links table and the letters' hrefOf, beside the mention models it supplies"],
  "src/lib/resident-link.mjs": [1, "the link rule itself"],
  "src/lib/resident-identity.mjs": [1, "speakerHref: the href the reader's speaker identity (the mention) is drawn with, as the Conversations page links its residents"],
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
  // a household's key, kept distinct from residents (Facet, 17:38Z)
  "town/pages/town/index.astro": [1, "a think-tank backer row: a HOUSEHOLD key under /residents/, not a resident handle, so never drawn as a resident mention"],
  // uncalled, or retired (an open sibling PR is no boundary: Facet, ~19:1xZ)
  "src/lib/calendar.mjs": [2, "residentHref's definition: a link rule no page calls since CORE-178 (the calendar card and the spark page draw the mention); left, not deleted, and its own test still holds it"],
  "town/pages/events/[host]/[slug].astro": [1, "'Who was there': a household-of-one id the office wrote (solo:<handle>), a household key kept distinct from residents; the page's room speakers take the identity (resident-identity.test.mjs)"],
  "src/components/QuestStandings.astro": [1, "retired by POS-967: nothing renders it"],
  // a card's or chip's own link: the name inside it is the mention (Darko b: one face per resident)
  "src/components/HouseRail.astro": [1, "the chip's own link; its name is the mention's styling beside the chip's face"],
  "src/components/ResidentCard.astro": [1, "the directory card's own link; its name is the mention's styling"],
  "src/lib/write-someone-new.mjs": [1, "the dealt card's profile link; the page draws the mention inside it from the card's public face"],
  "town/pages/index.astro": [4, "the arrival's ticker link, the hero line's href (handed to the bridge) and its button, and a resident card's own link"],
  "town/pages/window/index.astro": [2, "a window card's own link, and the href handed to the bridge for the mention inside it"],
  // the hrefs the inline scripts hand the bridge (window.__pmMention), and the plain links they keep when it is absent
  "town/pages/conversations/index.astro": [1, "personLink's href: the mention's (through the bridge), or the plain link's before the faces land"],
  "town/pages/replay/index.astro": [2, "the settlement column's residentHref gate, and the live feed's one resolved href (resident-links.test.mjs 2 holds its form), for the bridge's mention and its plain link"],
  "town/components/Household.astro": [10, "the appearance button, the tab URLs, the rendition egg, two fetches, and the quest lines' hrefs (the bridge's neutral mention, or the plain link), twice each"],
  // a picture-only cluster Darko ruled, and a notice that names no one
  "src/layouts/PostmarkLayout.astro": [2, "the main rail's corner faces (Darko 2026-11-11: \"just for the profile pictures\"; no name on them to style) and the \"You're in\" notice's link to your own page"],
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

// CORE-178 FIX (Facet, on the frames): page rules out-ranked the shared mention's ink (.rm.rm, 0,2,0), so names wore wax, accent or gold-bright instead
// of their own colour. The FIX-round probe found each by the ink it drew; every one now leaves .rm alone. A rule that colours a page's links or a
// page's own hook class must not reach a resident mention (Darko a: the favourite hue at readable darkness, everywhere).
test("no page link rule or hook-class rule paints over a resident mention's ink (the rules the frames caught)", () => {
  // `:where(:not(.rm))`: the rule no longer matches a mention, and its weight stays what it was, so every OTHER element it styles resolves exactly as
  // before (a bare `:not(.rm)` adds (0,1,0) and out-ranked the waiting page's own link colour: page-fallback-browser caught it, 4.17:1)
  const NOT = String.raw`:where\(:not\(\.rm\)\)`;
  const rules = [
    ["src/styles/postmark.css", new RegExp(String.raw`\.pm \.pm-paper a${NOT} \{ color: var\(--pm-accent\); \}`), /\.pm \.pm-paper a(:not\(\.rm\))? \{ color:/],
    ["src/styles/postmark.css", new RegExp(String.raw`\.pm \.pm-paper a${NOT}:hover \{ color: var\(--pm-wax\); \}`), /\.pm \.pm-paper a(:not\(\.rm\))?:hover \{/],
    ["town/pages/events/[host]/[slug].astro", new RegExp(String.raw`\.ev-sec\.pm-paper a${NOT} \{ color: var\(--pm-wax\);`), /\.ev-sec\.pm-paper a(:not\(\.rm\))? \{/],
    ["town/pages/events/[host]/[slug].astro", new RegExp(String.raw`\.ev-sec:not\(\.pm-paper\) a${NOT} \{ color: var\(--pm-gold-bright\); \}`), /\.ev-sec:not\(\.pm-paper\) a(:not\(\.rm\))? \{/],
    ["town/pages/events/[host]/[slug].astro", new RegExp(String.raw`\.ev-sec\.pm-paper :global\(a${NOT}\) \{ color: var\(--pm-wax\);`), /\.ev-sec\.pm-paper :global\(a(:not\(\.rm\))?\) \{/],
    ["town/pages/conversations/index.astro", new RegExp(String.raw`\.convo \.c-who${NOT} \{\s*color: var\(--pm-gold-bright\);`), /\.convo \.c-who(:not\(\.rm\))? \{/],
    ["town/pages/conversations/index.astro", new RegExp(String.raw`\.convo \.c-who${NOT}:hover \{`), /\.convo \.c-who(:not\(\.rm\))?:hover \{/],
    ["town/pages/replay/index.astro", new RegExp(String.raw`\.replay \.r-who${NOT} \{\s*color: var\(--pm-gold-bright\);`), /\.replay \.r-who(:not\(\.rm\))? \{/],
    ["town/pages/replay/index.astro", new RegExp(String.raw`\.replay \.r-who${NOT}:hover \{`), /\.replay \.r-who(:not\(\.rm\))?:hover \{/],
  ];
  for (const [file, now, was] of rules) {
    const src = read(file);
    assert.match(src, now, `${file}: the rule leaves .rm alone`);
    assert.doesNotMatch(src, was, `${file}: the old form that out-ranked .rm.rm is gone`);
  }
  // the humans' and the plain-text names' own looks stay: a human is never a mention
  assert.match(read("town/pages/conversations/index.astro"), /\.convo \.c-who\.is-human \{/);
  assert.match(read("town/pages/replay/index.astro"), /\.replay \.r-who\.is-human \{/);
});

// CORE-178 (Facet's bounded completion: the opened Hearth tab's closest correspondents measured 3.99-4.36:1). A name inside an element drawn with
// opacity is faded with it, and no ink measured for the surface can undo that, so the Hearth's small lines that hold names fade their words by colour.
test("the Hearth's small lines that hold names fade their words through colour, never the element's opacity", () => {
  const css = read("src/components/hearth/hearth-host.css");
  const rule = css.match(/\.hearth-stage \.hx-note, \.hearth-stage \.hx-when, \.hearth-stage \.hx-state, \.hearth-stage \.hx-with \{([^}]*)\}/)?.[1];
  assert.ok(rule, "the four hooks share one rule");
  assert.match(rule, /color: color-mix\(in srgb, var\(--hx-ink\) 85%, transparent\);/, "the words fade through their colour");
  assert.doesNotMatch(rule, /opacity/, "no opacity on a line a name sits in");
  // and these are the lines that hold names (the closest correspondents' "with …", an event's host)
  assert.match(read("src/components/hearth/HearthSlot.astro"), /<span class="hx-with"> with \{rows\.map\(\(r, i\) => <>\{i > 0 && ", "\}<ResidentMention handle=\{r\.handle\} \/>/);
  assert.match(read("src/lib/hearth/paint.mjs"), /const meta = el\("span", "hx-when",[\s\S]{0,400}meta\.appendChild\(ctx\.faces\[e\.host\] \? resident\(/);
});

// CORE-178 FIX (Facet, the frames): a home-art card is not a portrait card. The directory tile and the front page's "Meet the Residents" tile show the
// household's HOME art (cardImageOf; alt "…'s home"), so their names wear the resident's own face; the actual portrait cards keep one face.
test("home-art cards give the name its face; actual portrait cards keep one face", () => {
  const card = read("src/components/ResidentCard.astro");
  assert.match(card, /const img = cardImageOf\(r, media, homePictureOf\);/, "the directory tile's picture is the home art");
  assert.match(card, /alt=\{`\$\{r\.handle\}'s home`\}/);
  assert.doesNotMatch(card, /<ResidentMention[^>]*noFace/, "the name is not stripped of its face under home art");
  const front = read("town/pages/index.astro");
  assert.match(front, /alt=\{`\$\{m\.home\} — \$\{m\.name\}'s home: \$\{m\.words\}`\}/, "the Meet tile's picture is the home art");
  assert.doesNotMatch(front, /<b class="rc-name"><ResidentMention[^>]*noFace/, "the Meet tile's name is not stripped of its face");
  // the portrait cards and chips keep the no-second-face form (Darko b)
  assert.match(read("src/components/household-dashboard/ResidentCard.astro"), /noFace cls="hd-card-name"/);
  assert.match(read("src/components/HouseRail.astro"), /noFace cls="pm-chip-name"/);
  assert.match(read("town/pages/meeps/index.astro"), /<span class="cq-name">\{m\.profile\.inRoll \? <ResidentMention handle=\{m\.handle\} link=\{false\} noFace \/>/);
});

// CORE-178 FIX (Facet, Truey's FIX): the bulletin's Meeps roster drew a sprite-less meep with a portrait (Iris) as an initial, while the quay showed her
// face. The roster takes the quay's own choice: the sprite, else the portrait, else the monogram.
test("the bulletin's Meeps roster stands each meep as its sprite, else its portrait, else its monogram (the quay's order)", () => {
  const page = read("town/pages/bulletin/index.astro");
  assert.match(page, /import \{ MEEPS, displayName, profileOf \} from "@\/lib\/meeps-quarter\.mjs";/);
  assert.match(page, /const portrait = profileOf\(m, byHandle\.get\(m\.handle\), media\)\.portrait \?\? null;/, "the portrait the quay uses");
  assert.match(page, /face: sprite \? "sprite" : portrait \? "portrait" : "monogram",/, "the quay's order");
  assert.match(page, /m\.face === "sprite"\s*\? <svg class="px"[\s\S]*?: m\.face === "portrait"\s*\? <img class="portrait" src=\{m\.portrait\} alt="" loading="lazy" \/>\s*: <span class="mono">\{m\.monogram\}<\/span>/, "sprite, then portrait, then monogram, drawn");
  // the same order the quay draws (meeps/index.astro), so the two never disagree
  assert.match(read("town/pages/meeps/index.astro"), /face: sprite \? "sprite" : profile\.portrait \? "portrait" : "monogram",/);
});

// CORE-178 (Facet's profile-label FIX, Truey's FIX on fb2dd59a): the resident's own page painted its visible person labels straight from `t.name`
// (the heading, the Write buttons, the Address and Window cards, the window, marks, projects and letters copy, empty branches included), and the
// rendition page's back label printed the raw agent. Every visible label is the site's one mention now; attributes (ARIA, alt, title, data) stay plain.
test("the own page's visible person labels and the rendition back label are the site's one mention; attributes stay plain", () => {
  const page = code(read("town/components/Household.astro"));
  const raw = [...page.matchAll(/(?<![=$])\{t\.name\}/g)];
  assert.equal(raw.length, 0, `a visible label still paints t.name: ${raw.map((m) => page.slice(m.index - 40, m.index + 12).replace(/\s+/g, " ")).join(" | ")}`);
  assert.match(page, /<h1><ResidentMention handle=\{t\.handle\} link=\{false\} noFace whole \/><\/h1>/, "the heading: whole, and no second face beside the bubble's avatar");
  assert.match(page, /✍ Write to <ResidentMention handle=\{t\.handle\} link=\{false\} noFace whole surface=\{BTN_PLATE\} \/><\/a>/, "the header's Write button, inked for the button's gold");
  assert.match(page, /✍ Write to <ResidentMention handle=\{t\.handle\} link=\{false\} whole surface=\{BTN_PLATE\} \/><\/a>/, "the empty mailbox's Write button, likewise");
  assert.match(page, /const BTN_PLATE = "#e8c48b";/, "the solid button's darker gradient stop (--pm-gold)");
  assert.ok((page.match(/<ResidentMention handle=\{t\.handle\} link=\{false\} whole \/>/g) ?? []).length >= 13, "the cards, window, marks, projects and letters labels, with their faces");
  assert.match(page, /<img src=\{t\.avatarUrl\} alt=\{t\.name\} \/>/, "the avatar's alt stays plain text");
  assert.match(page, /aria-label=\{`Visit \$\{t\.name\}`\}/, "ARIA stays plain text");
  // the rendition page's back label
  const rv = read("town/pages/residents/[handle]/view/[rendition].astro");
  assert.match(rv, /data-rv-town>← <ResidentMention handle=\{handle\} link=\{false\} \/>'s page<\/a>/, "the person in the back label is the mention; the link and its words stay");
  assert.doesNotMatch(rv, /\{payloadBase\.agent\}'s page/, "the raw agent is gone from the label");
});

// CORE-178 (Truey's Finding 3, Facet's FIX): the resident page's correspondent cards painted `<span class="corr-name">{c.name}</span>`, a plain name over
// the correspondent's HOME scenery. Their destination is a mail pair, so the resident-page-link census never saw them. The name is the site's one mention
// now, through the alias-aware roll; the pair key, the recorded handle and the counts are the accounting and do not move.
test("the correspondent cards name each correspondent with the site's one mention; an old handle shows the current resident; the pair link does not move", () => {
  const page = code(read("town/components/Household.astro"));
  assert.match(page, /<span class="corr-name">\{mentionOf\(c\.handle\)\.kind === "resident" \? <ResidentMention handle=\{c\.handle\} link=\{false\} \/> : c\.name\}<\/span>/,
    "the card's name: the mention for a resident, inside the card's own link; a plain label otherwise");
  assert.doesNotMatch(page, /<span class="corr-name">\{c\.name\}<\/span>/, "the raw name is gone");
  assert.match(page, /<a class:list=\{\["corr-card", c\.img && "has-bg"\]\} href=\{c\.pairPath\}/, "the card still goes to its pair");
  assert.match(page, /<span class="corr-handle">\{c\.handle\}<\/span>/, "the recorded handle is still shown as it was written");
  // the accounting: the pair key is built from the RECORDED handle, never the current one (correspondents.mjs)
  const corr = read("src/lib/correspondents.mjs");
  assert.match(corr, /pairPath: "\/mail\/with\/" \+ \[handle, h\]\.sort\(\)\.join\("--"\) \+ "\/",/);
  // a known alias: letters recorded under `dylan-android-husband` (renamed `dylan`) show Dylan's current name, face and page on the card,
  // while the card's pair is still the recorded pair
  const json = (p) => JSON.parse(read(p));
  const roll = mentionRoll(json("src/data/postmark/residents.json"), json("src/data/postmark/renames.json"), json("src/data/postmark/media.json"));
  const m = roll.mentionOf("dylan-android-husband");
  assert.equal(m.kind, "resident", "the old handle is a resident");
  assert.equal(m.href, "/residents/dylan/", "named as the resident they are now");
  assert.equal(m.name, roll.mentionOf("dylan").name, "with the current name");
  assert.notEqual(m.name, "dylan-android-husband");
  const pairOf = (handle, h) => "/mail/with/" + [handle, h].sort().join("--") + "/";
  assert.equal(pairOf("postmaster", "dylan-android-husband"), "/mail/with/dylan-android-husband--postmaster/", "the pair destination keeps the recorded handle");
  // a handle with no resident behind it stays a plain word: the card keeps its own label
  assert.equal(roll.mentionOf("the-town").kind, "text");
});

test("control: the census pattern catches each written form, and comments are not counted", () => {
  const forms = ["href={`/residents/${h}/`}", 'a.href = "/residents/" + h;', "residentHref(h)", "'/residents/' + h"];
  for (const f of forms) assert.equal((code(f).match(PATTERN) ?? []).length, 1, f);
  assert.equal((code("// a.href = \"/residents/\" + h;\n").match(PATTERN) ?? []).length, 0, "a comment is not a callsite");
});
