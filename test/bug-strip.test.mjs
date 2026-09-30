// bug-strip.test.mjs — the bug lane as a comic strip under the Bug Catcher's
// card, and the open-bugs board (POS-236, Keemin 2026-09-29).
//
//   node --test test/bug-strip.test.mjs
//
// The strip's numbers are the office's ladder, pinned here against a fixture
// copy of postmark-office src/bugs.mjs (test/fixtures/office-bug-ladder.json
// names its source). The bubbles open without script, the security road is the
// private advisory and never the mail or an issue, and a resident's title on
// the board is text, never markup.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

import {
  LADDER, CONFIRMED_CAP, STAGES, FINISHED, PANELS, ADVISORY_URL, NEW_ISSUE_URL, POST_CALL,
  boardOf, paintBoard, jarOf, paintJar, JAR_ART, JAR_EMPTY, plainOf,
} from "../src/lib/bug-strip.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FIX = JSON.parse(readFileSync(join(ROOT, "test", "fixtures", "office-bug-ladder.json"), "utf8"));
const SRC = readFileSync(join(ROOT, "src", "lib", "bug-strip.mjs"), "utf8");
const DIST = join(ROOT, "dist-town");
const builtMeeps = join(DIST, "meeps", "index.html");

// ── THE NUMBERS ──────────────────────────────────────────────────────────────

test("the ladder, the cap and the stages are the office's (fixture: postmark-office src/bugs.mjs)", () => {
  assert.deepEqual(JSON.parse(JSON.stringify(LADDER)), FIX.ladder, "the strip's ladder drifted from BUG_LADDER");
  assert.equal(CONFIRMED_CAP, FIX.confirmedCap, "the weekly cap drifted from CONFIRMED_CAP");
  assert.deepEqual([...STAGES], FIX.stages);
  assert.deepEqual([...FINISHED], FIX.finished);
});

test("every number in the strip is read from the ladder, never typed into a panel", () => {
  const block = SRC.slice(SRC.indexOf("export const PANELS"), SRC.indexOf("// ── THE JAR"));
  assert.ok(block.length > 500, "the PANELS block was not found");
  const stripped = block
    .replace(/\$\{[^}]*\}/g, "")        // interpolations read the ladder
    .replace(/^\s*n: \d+,$/gm, "")      // the panel's own number
    .replace(/^\s*img: "[^"]*",$/gm, "");  // its picture path
  const typed = stripped.match(/\d+/g) ?? [];
  assert.deepEqual(typed, [], "a number is typed into a panel instead of read from LADDER");
});

test("the captions and bubbles say the ladder's amounts, in order", () => {
  const L = FIX.ladder;
  const cap = PANELS.map((p) => plainOf(p.caption));
  assert.equal(PANELS.length, 7);
  assert.deepEqual(PANELS.map((p) => p.n), [1, 2, 3, 4, 5, 6, 7]);
  assert.match(cap[2], new RegExp(`\\+${L.confirmed.n}✦$`));
  assert.match(cap[3], new RegExp(`\\+${L.reproduced.n}✦$`));
  assert.match(cap[4], new RegExp(`\\+${L.diagnosed.n}✦ · \\+${L.briefed.n.light}✦$`));
  assert.match(cap[5], new RegExp(`\\+${L.fixed.n.S}✦ / ${L.fixed.n.M}✦ / ${L.fixed.n.L}✦$`));
  const all = (p) => [p.bubble.title, ...p.bubble.lines].map(plainOf).join(" ");
  assert.match(all(PANELS[2]), new RegExp(`paid for ${FIX.confirmedCap} confirmed reports a week`));
  assert.match(all(PANELS[4]), new RegExp(`pays ${L.briefed.n.light}✦, or ${L.briefed.n.heavy}✦ if it needed heavy revision`));
  assert.match(all(PANELS[6]), /Meeps never take stamps/);
  // the fixer names the bug (Keemin, 2026-09-29)
  assert.match(cap[5], /^Fixed, and named!/);
  assert.ok(PANELS[5].bubble.lines.map(plainOf).includes("…and whoever fixes it names the bug: it joins the Bug Catcher's jar."), "panel 6 does not say the fixer names the bug");
});

test("STAMPS ARE PURPLE: every stamp amount in the strip is a stamp segment, never a bare number in the text", () => {
  // The site's law (postmark.css, Keemin 2026-07-29), asked of the strip by
  // Keemin 2026-09-29: "use the stamp purple font for the numbers and stamps".
  // A plain-text segment may carry a number only when it is not stamps: the
  // weekly cap counts reports.
  const texts = PANELS.flatMap((p) => [p.caption, p.bubble.title, ...p.bubble.lines]);
  const bare = texts.flatMap((x) => x.filter((s) => typeof s === "string").flatMap((s) => s.match(/\d+/g) ?? []));
  assert.deepEqual(bare, [String(FIX.confirmedCap)], "a stamp amount is typed as plain text, so it will not wear the stamp family");
  const stamps = texts.flatMap((x) => x.filter((s) => typeof s !== "string").map((s) => s.stamps));
  const L = FIX.ladder;
  for (const n of [L.confirmed.n, L.reproduced.n, L.diagnosed.n, L.briefed.n.light, L.briefed.n.heavy, L.fixed.n.S, L.fixed.n.M, L.fixed.n.L]) {
    assert.ok(stamps.some((s) => s.replace("+", "") === String(n)), `the ladder's ${n} never appears as a stamp`);
  }
  assert.deepEqual(PANELS.map((p) => p.caption.filter((s) => typeof s !== "string").length), [0, 0, 1, 1, 2, 3, 0], "a caption's stamp amounts are not all marked");
});

test("each panel has one picture path, and the drawn pictures are the tool's (bug-strip-art --check)", () => {
  for (const p of PANELS) {
    assert.match(p.img, /^\/meeps\/bug-strip\/[a-z0-9-]+\.svg$/, `panel ${p.n}'s picture is not one path`);
    assert.ok(existsSync(join(ROOT, "public", "atelier", "postmark", ...p.img.split("/").filter(Boolean))), `panel ${p.n}'s picture ${p.img} is missing`);
    assert.ok(p.scene.length > 10, `panel ${p.n} has no alt text`);
  }
  for (const img of Object.values(JAR_ART)) assert.ok(existsSync(join(ROOT, "public", "atelier", "postmark", ...img.split("/").filter(Boolean))), `the jar's picture ${img} is missing`);
  execFileSync(process.execPath, [join(ROOT, "tools", "bug-strip-art.mjs"), "--check"], { stdio: "pipe" });
});

test("the security road is the private advisory: never the mail, never an issue", () => {
  const two = PANELS[1].bubble;
  assert.equal(two.locked.link.href, ADVISORY_URL);
  assert.equal(ADVISORY_URL, "https://github.com/postmark-town/postmark/security/advisories/new");
  assert.doesNotMatch(JSON.stringify(two.locked), /mailto:|\/issues/, "the locked door points at the mail or an issue");
  assert.match(two.locked.text, /Never put it in a letter/);
  // the three open roads, each a real road
  assert.equal(two.call, POST_CALL);
  assert.equal(POST_CALL, 'town { do: "post", args: { class: "bug", title, body } }');
  assert.deepEqual(two.links.map((l) => l.href), [NEW_ISSUE_URL]);
  assert.match(two.lines.join(" "), /letter to bugcatcher/);
});

// ── THE BOARD ────────────────────────────────────────────────────────────────

const READ = {
  as_of: "2026-09-29T20:00:00.000Z", class: "bug", finished: ["shipped", "duplicate", "not-a-bug"], total: 5,
  posts: [
    { class: "bug", id: "mari/the-map-forgets", title: "The map forgets my pin", author: "mari", state: "confirmed", fields: { issue: "https://github.com/postmark-town/postmark/issues/3300" } },
    { class: "bug", id: "vermillion/<b>bold</b>", title: "<img src=x onerror=alert(1)> letters vanish", author: "vermillion", state: "reported", fields: { issue: "javascript:alert(1)" } },
    { class: "bug", id: "sage/old", title: "Fixed long ago", author: "sage", state: "shipped", fields: {} },
    { class: "bug", id: "sage/dupe", title: "A duplicate", author: "sage", state: "duplicate", fields: { of: "mari/the-map-forgets" } },
    { class: "bug", id: "odd/state", title: "An unknown state", author: "odd", state: "exploded", fields: {} },
  ],
};

test("boardOf: the open bugs grouped by stage in the lifecycle's order; finished and unknown states left off", () => {
  const b = boardOf(READ);
  assert.equal(b.ok, true);
  assert.equal(b.open, 2);
  assert.deepEqual(b.groups.map((g) => [g.stage, g.rows.map((r) => r.id)]), [
    ["reported", ["vermillion/<b>bold</b>"]],
    ["confirmed", ["mari/the-map-forgets"]],
  ]);
  const mari = b.groups[1].rows[0];
  assert.deepEqual(mari, { id: "mari/the-map-forgets", title: "The map forgets my pin", reporter: "mari", stage: "confirmed", issue: "https://github.com/postmark-town/postmark/issues/3300" });
  assert.equal(b.groups[0].rows[0].issue, null, "a non-issue URL became a link");
});

test("boardOf: an empty board is empty; a failed read is a failed read, never an empty board", () => {
  assert.deepEqual(boardOf({ ...READ, posts: [] }), { ok: true, groups: [], open: 0 });
  for (const bad of [null, undefined, {}, { posts: "no" }, "<html>"]) assert.equal(boardOf(bad).ok, false, `${JSON.stringify(bad)} read as a board`);
});

// A document just big enough for paintBoard, whose innerHTML refuses: the
// painter must build with elements and textContent only.
function stubDoc() {
  const make = (tag) => {
    const el = {
      tagName: tag.toUpperCase(), className: "", dataset: {}, children: [], textContent: "", href: "", rel: "", target: "",
      append(...c) { el.children.push(...c); },
      replaceChildren(...c) { el.children = [...c]; },
    };
    Object.defineProperty(el, "innerHTML", { set() { throw new Error("innerHTML used"); }, get() { return ""; } });
    return el;
  };
  return { createElement: make, root: make("div") };
}
const textOf = (el) => (el.children.length ? el.children.map(textOf).join(" ") : el.textContent);
const find = (el, pred) => (pred(el) ? [el] : []).concat(...el.children.map((c) => find(c, pred)));

test("paintBoard: stages, titles and reporters as text; a title's markup stays text", () => {
  const doc = stubDoc();
  paintBoard(doc.root, boardOf(READ), doc);
  const text = textOf(doc.root);
  assert.match(text, /Reported · 1/);
  assert.match(text, /Spotted · 1/);
  assert.doesNotMatch(text, /Caught ·/, "a confirmed bug is spotted; caught is the jar's word, at the fix");
  assert.match(text, /<img src=x onerror=alert\(1\)> letters vanish/, "the title was not kept as text");
  assert.match(text, /reported by mari/);
  const links = find(doc.root, (e) => e.tagName === "A");
  assert.deepEqual(links.map((a) => [a.href, a.textContent]), [["https://github.com/postmark-town/postmark/issues/3300", "issue #3300"]]);
  assert.doesNotMatch(SRC.slice(SRC.indexOf("export function paintBoard")), /innerHTML|insertAdjacentHTML|outerHTML/);
});

test("paintBoard: says 'No open bugs right now.' for an empty board, and something else for a failed read", () => {
  const empty = stubDoc();
  paintBoard(empty.root, boardOf({ ...READ, posts: [] }), empty);
  assert.equal(textOf(empty.root), "No open bugs right now.");
  const failed = stubDoc();
  paintBoard(failed.root, boardOf(null), failed);
  assert.match(textOf(failed.root), /can't be read right now/);
  assert.doesNotMatch(textOf(failed.root), /No open bugs/);
});

// ── THE JAR ──────────────────────────────────────────────────────────────────

const POSTS = JSON.parse(readFileSync(join(ROOT, "test", "fixtures", "office-bug-posts.json"), "utf8"));

test("jarOf: a slot for every bug, named by fields.critter and fields.named_by (fixture: office #260); side exits get none", () => {
  const j = jarOf(POSTS);
  assert.equal(j.ok, true);
  assert.deepEqual(j.slots.map((s) => [s.id, s.finished, s.critter]), [
    ["mari/the-map-forgets-my-pin", true, "Pinwhistle"],
    ["vermillion/letters-vanish", false, null],
    ["sage/old-crack", true, "<b>Crackle</b>"],
    ["odd/fixed-before-names", true, null],
  ]);
  assert.equal(j.finished, 3);
  assert.deepEqual(j.slots[0], { id: "mari/the-map-forgets-my-pin", title: "The map forgets my pin after a crossing", finished: true, critter: "Pinwhistle", namedBy: "lupi" });
  assert.deepEqual(j.slots[1], { id: "vermillion/letters-vanish", title: "Letters vanish from my outbox", finished: false, critter: null, namedBy: null });
  // the field names are the office's: rename either and the names fall silent
  const renamed = { ...POSTS, posts: POSTS.posts.map((p) => ({ ...p, fields: Object.fromEntries(Object.entries(p.fields).map(([k, v]) => [k === "critter" ? "name" : k, v])) })) };
  assert.equal(jarOf(renamed).slots.filter((s) => s.critter).length, 0);
});

test("jarOf: an empty jar is empty; a failed read is a failed read", () => {
  assert.deepEqual(jarOf({ ...POSTS, posts: [] }), { ok: true, slots: [], finished: 0 });
  for (const bad of [null, {}, { posts: 3 }]) assert.equal(jarOf(bad).ok, false);
});

test("paintJar: the critter, 'named by', and the title as text; an open bug is '?'; a critter's markup stays text", () => {
  const doc = stubDoc();
  paintJar(doc.root, jarOf(POSTS), doc);
  const slots = find(doc.root, (e) => e.tagName === "LI");
  assert.equal(slots.length, 4);
  assert.equal(textOf(slots[0]), " Pinwhistle named by lupi The map forgets my pin after a crossing");
  assert.equal(textOf(slots[1]), " ? Letters vanish from my outbox");
  assert.match(textOf(slots[2]), /<b>Crackle<\/b> named by sage/, "the critter's name was not kept as text");
  assert.doesNotMatch(textOf(doc.root), /The jar is empty|still being caught/, "a jar with fixed bugs says none is fixed");
  assert.doesNotMatch(SRC.slice(SRC.indexOf("export function paintJar"), SRC.indexOf("// ── THE BOARD")), /innerHTML|insertAdjacentHTML|outerHTML/);
});

test("paintJar: only an open bug is '?'; a finished bug with no name gets the lit jar and 'unnamed' (Wright's review, 2026-09-29)", () => {
  const doc = stubDoc();
  paintJar(doc.root, jarOf(POSTS), doc);
  const slots = find(doc.root, (e) => e.tagName === "LI");
  assert.equal(textOf(slots[3]), " unnamed Fixed before the jar", "a finished bug without a name reads as open");
  assert.deepEqual(find(doc.root, (e) => e.tagName === "IMG").map((i) => i.src),
    [JAR_ART.finished, JAR_ART.open, JAR_ART.finished, JAR_ART.finished], "only the open bug wears the silhouette");
  assert.deepEqual(slots.filter((li) => /\?/.test(textOf(li))).map((li) => li.dataset.post), ["vermillion/letters-vanish"], "a '?' stands on a bug that is not open");
});

test("paintJar: the empty line only with no slot at all; slots with none fixed say they are still being caught", () => {
  const empty = stubDoc();
  paintJar(empty.root, jarOf({ ...POSTS, posts: [] }), empty);
  assert.equal(textOf(empty.root), JAR_EMPTY);
  assert.equal(JAR_EMPTY, "The jar is empty: no bug has been fixed yet.");
  const openOnly = stubDoc();
  paintJar(openOnly.root, jarOf({ ...POSTS, posts: [POSTS.posts[1]] }), openOnly);
  assert.match(textOf(openOnly.root), /^No bug has been fixed yet\. These are still being caught\. .*\?/);
  assert.doesNotMatch(textOf(openOnly.root), /The jar is empty/, "the jar says it is empty above its own slots");
  const unnamedOnly = stubDoc();
  paintJar(unnamedOnly.root, jarOf({ ...POSTS, posts: [POSTS.posts[3]] }), unnamedOnly);
  assert.doesNotMatch(textOf(unnamedOnly.root), /still being caught|The jar is empty/, "a fixed bug without a name reads as none fixed");
  const failed = stubDoc();
  paintJar(failed.root, jarOf(null), failed);
  assert.equal(textOf(failed.root), "The jar can't be read right now.");
});

// ── THE BUILT PAGE (skipped until it is built, as POS-177 rules) ────────────

function panelOf(page, key) {
  const at = page.indexOf(`<section class="mq-panel" id="${key}"`);
  assert.ok(at >= 0, `no panel for ${key}`);
  const next = page.indexOf('<section class="mq-panel"', at + 1);
  return page.slice(at, next > 0 ? next : page.indexOf("<script", at));
}

test("the built strip stands under the Bug Catcher's card only, seven panels, each bubble a <details>",
  { skip: !existsSync(builtMeeps) }, () => {
  const page = readFileSync(builtMeeps, "utf8");
  assert.equal(page.split("data-bug-strip").length - 1, 1, "the strip stands more than once");
  const bc = panelOf(page, "bugcatcher");
  assert.ok(bc.includes("data-bug-strip"), "the strip is not under the Bug Catcher's card");
  assert.ok(bc.indexOf("data-bug-strip") > bc.indexOf("</article>"), "the strip is not after his card");
  const panels = [...bc.matchAll(/<li\b[^>]*data-strip-panel="(\d)"/g)].map((m) => Number(m[1]));
  assert.deepEqual(panels, [1, 2, 3, 4, 5, 6, 7]);
  const bubbles = [...bc.matchAll(/<details\b[^>]*class="bs-bubble"[^>]*>\s*<summary\b[^>]*>([\s\S]*?)<\/summary>/g)].map((m) => m[1].replace(/<[^>]*>/g, "").trim());
  assert.equal(bubbles.length, 7, "a bubble is not a <details> with a summary");
  for (const s of bubbles) assert.doesNotMatch(s, /^(?:\+ ?)?(?:read |show |see )?more\b/i, `a bubble opens on a bare "more": ${s}`);
  for (const p of PANELS) assert.ok(bc.includes(`src="${p.img}"`), `panel ${p.n}'s picture is not its img path`);
  for (const m of ["postmaster", "illuminator", "registrar", "worldkeeper", "architect"]) {
    assert.doesNotMatch(panelOf(page, m), /data-bug-strip|bs-bubble/, `the strip leaked into ${m}'s panel`);
  }
});

// THE TWIN of the town page's falsifier (test/civic-hub.test.mjs, "THE LAW:
// stamps are purple — every ✦ on this page wears the one family"), for the
// Meeps page: every ✦ its markup renders sits inside a stamp-family element,
// and the family is read from postmark.css's tokens, never typed.
test("THE LAW: stamps are purple — every ✦ on the Meeps page wears the one family (the town page's falsifier, twinned)", () => {
  const page = readFileSync(join(ROOT, "town", "pages", "meeps", "index.astro"), "utf8");
  const markup = page.slice(page.indexOf("---", 3) + 3);
  const naked = markup.split("\n").map((l, i) => [i, l]).filter(([, l]) => l.includes("✦") && !/(bs-stamp|m-stamp)/.test(l));
  assert.deepEqual(naked.map(([, l]) => l.trim()), [], "a ✦ renders outside the stamp family");
  const style = page.slice(page.indexOf("<style>"));
  assert.match(style, /\.bs-stamp \{ color: var\(--pm-stamp-dark\);/, "the strip's stamps do not read the family's token");
  const declarations = style.replace(/\/\*[\s\S]*?\*\//g, " ");
  assert.equal(/#(aa8fd8|d8c7ef|65517f)/i.test(declarations), false, "a stamp hex is typed into the Meeps page — the tokens own those three");
  assert.equal(/rgba\(var\(--pm-stamp(-bright|-dark)?\)/.test(declarations), false, "a stamp colour token is fed to rgba() — only the -rgb channel lists work there");
});

test("the built strip: every ✦ sits in a .bs-stamp, one per stamp amount",
  { skip: !existsSync(builtMeeps) }, () => {
  const bc = panelOf(readFileSync(builtMeeps, "utf8"), "bugcatcher");
  const strip = bc.slice(bc.indexOf("data-bug-strip"), bc.indexOf("data-bug-jar"));
  const stars = [...strip.matchAll(/✦/g)].map((m) => m.index);
  for (const at of stars) {
    const before = strip.slice(0, at);
    assert.ok(before.lastIndexOf('<b class="bs-stamp"') > before.lastIndexOf("</b>"), `a ✦ at ${at} is outside a .bs-stamp`);
  }
  const amounts = PANELS.flatMap((p) => [p.caption, p.bubble.title, ...p.bubble.lines]).flatMap((x) => x.filter((s) => typeof s !== "string"));
  assert.equal(stars.length, amounts.length, "the built strip's ✦ are not one per stamp amount");
});

test("the built security panel opens onto the advisory page, and never the mail or an issue",
  { skip: !existsSync(builtMeeps) }, () => {
  const bc = panelOf(readFileSync(builtMeeps, "utf8"), "bugcatcher");
  const locked = bc.slice(bc.indexOf("data-locked"), bc.indexOf("</details>", bc.indexOf("data-locked")));
  assert.ok(locked.length > 50, "no locked door in panel 2");
  assert.match(locked, new RegExp(`href="${ADVISORY_URL.replace(/[/.]/g, "\\$&")}"`));
  assert.doesNotMatch(locked, /mailto:|\/issues\b/);
});

test("the built board: read live from the office's bug posts, a placeholder that says so, and the Report button",
  { skip: !existsSync(builtMeeps) }, () => {
  const bc = panelOf(readFileSync(builtMeeps, "utf8"), "bugcatcher");
  // the board names no office: the script asks officeBase() (test/meeps-page-office.test.mjs)
  assert.match(bc, /<div class="bb-list" data-bug-board aria-live="polite"/);
  assert.doesNotMatch(bc, /postmark\.town\/api/);
  assert.match(bc, /class="bb-empty"[^>]*>The board is read live from the office/);
  // the jar stands between the strip and the open bugs
  const jar = bc.indexOf("data-bug-jar");
  assert.ok(jar > bc.lastIndexOf("data-strip-panel=") && jar < bc.indexOf("data-bug-board"), "the jar is not between the strip and the board");
  assert.match(bc, /class="jar-empty"[^>]*>The jar is read live from the office/);
  assert.match(bc, new RegExp(`<a class="pm-btn" href="${NEW_ISSUE_URL}"[^>]*\\bdata-report\\b[^>]*>Report a bug</a>`));
});
