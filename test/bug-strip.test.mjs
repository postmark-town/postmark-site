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
  JAR_ART, plainOf, VIDEO_URL, VIDEO_THUMB, VIDEO_EMBED, playVideo,
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

// ── THE STUB DOCUMENT ───────────────────────────────────────────────────────

// A document just big enough for playVideo, whose innerHTML refuses: the
// painter must build with elements and textContent only. (The jar's and the
// board's folds, and their tests, gave way to the cards: test/bug-cards.test.mjs.)
function stubDoc() {
  const make = (tag) => {
    const el = {
      tagName: tag.toUpperCase(), className: "", dataset: {}, children: [], textContent: "", href: "", rel: "", target: "",
      append(...c) { el.children.push(...c); },
      attrs: {}, setAttribute(k, v) { el.attrs[k] = String(v); },
      replaceChildren(...c) { el.children = [...c]; },
    };
    Object.defineProperty(el, "innerHTML", { set() { throw new Error("innerHTML used"); }, get() { return ""; } });
    return el;
  };
  return { createElement: make, root: make("div") };
}
const textOf = (el) => (el.children.length ? el.children.map(textOf).join(" ") : el.textContent);
const find = (el, pred) => (pred(el) ? [el] : []).concat(...el.children.map((c) => find(c, pred)));

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
  const strip = bc.slice(bc.indexOf("data-bug-strip"), bc.indexOf("data-bug-cards"));
  const stars = [...strip.matchAll(/✦/g)].map((m) => m.index);
  for (const at of stars) {
    const before = strip.slice(0, at);
    assert.ok(before.lastIndexOf('<b class="bs-stamp"') > before.lastIndexOf("</b>"), `a ✦ at ${at} is outside a .bs-stamp`);
  }
  const amounts = PANELS.flatMap((p) => [p.caption, p.bubble.title, ...p.bubble.lines]).flatMap((x) => x.filter((s) => typeof s !== "string"));
  assert.equal(stars.length, amounts.length, "the built strip's ✦ are not one per stamp amount");
});

// ── THE VIDEO, ABOVE THE STRIP (Keemin, 2026-09-29: "watchable/embedded in the
// actual site, above the static cards") ─────────────────────────────────────

test("the video is typed once: the player's address is derived from VIDEO_URL, and the picture is on disk", () => {
  assert.equal(VIDEO_URL, "https://youtu.be/U7J0en2iBeg");
  assert.equal(VIDEO_EMBED, "https://www.youtube-nocookie.com/embed/U7J0en2iBeg?autoplay=1&rel=0");
  assert.equal(SRC.split("U7J0en2iBeg").length - 1, 1, "the video's id is typed more than once in bug-strip.mjs");
  const page = readFileSync(join(ROOT, "town", "pages", "meeps", "index.astro"), "utf8");
  assert.equal(/U7J0en2iBeg|youtu\.be\/|youtube(?:-nocookie)?\.com/i.test(page), false, "the page types a YouTube address instead of reading bug-strip.mjs");
  assert.ok(existsSync(join(ROOT, "public", "atelier", "postmark", ...VIDEO_THUMB.split("/").filter(Boolean))), `the player's picture ${VIDEO_THUMB} is missing`);
});

test("playVideo: a click swaps the box for the privacy-enhanced player, 16:9, with its title and permissions", () => {
  const doc = stubDoc();
  const parent = doc.createElement("section");
  const box = doc.createElement("a");
  box.replaceWith = (n) => { parent.children[parent.children.indexOf(box)] = n; };
  parent.append(box);
  const player = playVideo(box, doc);
  assert.equal(parent.children[0], player, "the box was not replaced");
  const frame = player.children[0];
  assert.equal(frame.tagName, "IFRAME");
  assert.ok(frame.src.startsWith("https://www.youtube-nocookie.com/embed/U7J0en2iBeg"), `the player asks ${frame.src}`);
  assert.equal(frame.title, "How a bug gets caught in Postmark");
  assert.equal(frame.attrs.allow, "autoplay; encrypted-media; picture-in-picture");
  assert.ok("allowfullscreen" in frame.attrs);
  assert.equal(textOf(player.children[1]), "How a bug gets caught in Postmark · 1 min");
});

test("the built Bug Catcher panel has the play box BEFORE the strip: the plain link, the thumbnail, real alt text; the old card is gone",
  { skip: !existsSync(builtMeeps) }, () => {
  const bc = panelOf(readFileSync(builtMeeps, "utf8"), "bugcatcher");
  const at = bc.indexOf("data-bug-player");
  assert.ok(at > 0 && at < bc.indexOf("data-strip-panel="), "the play box is not above the strip");
  const open = bc.lastIndexOf("<a ", at);
  const box = bc.slice(open, bc.indexOf("</a>", at));
  assert.match(box, new RegExp(`href="${VIDEO_URL}"`));
  assert.match(box, /target="_blank"/);
  assert.match(box, /rel="noopener"/);
  assert.ok(box.includes(`src="${VIDEO_THUMB}"`), "the box's picture is not the thumbnail");
  assert.match(box, /alt="Play the video: [^"]{20,}"/, "the box's picture has no real alt text");
  assert.match(box, /How a bug gets caught in Postmark · 1 min/);
  assert.doesNotMatch(bc, /data-bug-video|class="bs-video"/, "the old link card under the strip is still there");
});

test("nothing from YouTube loads before the click: no iframe, no iframe API, no preconnect; the player lives only in the click's script",
  { skip: !existsSync(builtMeeps) }, () => {
  const page = readFileSync(builtMeeps, "utf8");
  assert.doesNotMatch(page, /<iframe\b/i, "an iframe is on the built Meeps page");
  assert.doesNotMatch(page, /youtube\.com\/iframe_api|youtube\.com\/embed/i, "a YouTube player API is wired into the page");
  assert.doesNotMatch(page, /<link\b[^>]*\b(?:preconnect|dns-prefetch|preload)\b[^>]*(?:youtube|ytimg|googlevideo)/i, "the page warms a connection to YouTube before the click");
  // a YouTube address in the HTML is only ever a plain link someone clicks (the
  // play box's, and the footer's channel link), never a src, a <link> or a script
  const YT = /https?:\/\/[^"'\s)]*(?:youtube|youtu\.be|ytimg)[^"'\s)]*/i;
  const withoutLinks = page.replace(/<a\b[^>]*>/gi, "");
  assert.doesNotMatch(withoutLinks, YT, "a YouTube address is on the page outside a plain link");
  assert.ok([...page.matchAll(/<a\b[^>]*\bhref="([^"]+)"/gi)].some((m) => m[1] === VIDEO_URL), "the play box's link is not a plain <a href>");
  // and the player's address rides only in the page's own script, for the click
  const scripts = [...page.matchAll(/<script\b[^>]*\bsrc="\/_astro\/([^"]+\.js)"/g)].map((m) => readFileSync(join(DIST, "_astro", m[1]), "utf8"));
  const js = scripts.join("\n");
  const deps = [...js.matchAll(/from\s*"\.\/([^"]+\.js)"/g)].map((m) => m[1]).filter((d) => existsSync(join(DIST, "_astro", d)));
  const all = [js, ...deps.map((d) => readFileSync(join(DIST, "_astro", d), "utf8"))].join("\n");
  assert.match(all, /youtube-nocookie\.com\/embed/, "the click's script does not carry the privacy-enhanced player");
  assert.doesNotMatch(all, /www\.youtube\.com\/(?:embed|iframe_api)/, "the script reaches the tracking domain");
});

test("the built security panel opens onto the advisory page, and never the mail or an issue",
  { skip: !existsSync(builtMeeps) }, () => {
  const bc = panelOf(readFileSync(builtMeeps, "utf8"), "bugcatcher");
  const locked = bc.slice(bc.indexOf("data-locked"), bc.indexOf("</details>", bc.indexOf("data-locked")));
  assert.ok(locked.length > 50, "no locked door in panel 2");
  assert.match(locked, new RegExp(`href="${ADVISORY_URL.replace(/[/.]/g, "\\$&")}"`));
  assert.doesNotMatch(locked, /mailto:|\/issues\b/);
});

test("the built jar: one list of cards read live from the office's bug posts, after the strip, a placeholder that says so, and the Report button (POS-547)",
  { skip: !existsSync(builtMeeps) }, () => {
  const bc = panelOf(readFileSync(builtMeeps, "utf8"), "bugcatcher");
  // the cards name no office: the script asks officeBase() (test/meeps-page-office.test.mjs)
  assert.match(bc, /<div class="bc-root[^"]*" data-bug-cards aria-live="polite"/);
  assert.doesNotMatch(bc, /postmark\.town\/api/);
  assert.match(bc, /class="bc-empty"[^>]*>The bugs are read live from the office/);
  assert.ok(bc.indexOf("data-bug-cards") > bc.lastIndexOf("data-strip-panel="), "the cards are not after the strip");
  // the jar and the board are one list now, not two
  assert.doesNotMatch(bc, /data-bug-jar|data-bug-board/);
  assert.match(bc, new RegExp(`<a class="pm-btn" href="${NEW_ISSUE_URL}"[^>]*\\bdata-report\\b[^>]*>Report a bug</a>`));
});
