// anchor-links.test.mjs — a link with a `#` on it must land on something.
//
//   node --test test/anchor-links.test.mjs
//
// ── WHY THIS FILE EXISTS (#2506) ─────────────────────────────────────────────
// The civic hub linked `<a href="/bulletin/#quests">the full board</a>`. The
// bulletin has no `quests` anchor — its whole rendered page carries exactly one
// id, `board-modal-title`, because its notices are cards keyed by `data-card`
// and not by id. So the reader was sent to a different page, to the top of it,
// with nothing to scroll to, AWAY from the board they were already looking at:
// the only `id="quests"` in the site is on the page doing the linking.
//
// Nothing caught it, and nothing could have. A fragment is invisible to every
// check the site owns: the nav suite proves a rail entry resolves to a PAGE
// (`nav.test.mjs`, "a read per page") and stops at the `#`; the build is happy
// to ship a link to an anchor that does not exist, because that is not an error
// in HTML, it is a link that quietly does nothing. This file is the watcher for
// the half nobody was watching.
//
// ── WHAT IT READS, AND WHY THAT AND NOT THE BUILT PAGES ──────────────────────
// The source under `town/pages/`, not `dist-town/`. The built pages are the
// truer surface and this file would rather read them, but `test.yml` runs
// `npm test` WITHOUT `npm run build`, so a `{ skip: !built }` arm is a
// falsifier that never runs in CI — the exact failure that workflow's own
// header was written about ("a falsifier nobody runs cannot fail"). A source
// read runs on every push, and for this corpus it is exact: every anchor target
// on the site today is a literal `id="…"` in the page's own file. If a page
// ever takes its anchor from a component, this reds and the fix is a declared
// entry below saying so — a loud false alarm, which is the safe direction.
//
// ── WHAT IT DOES NOT READ, EACH WITH ITS REASON ──────────────────────────────
//   · Computed hrefs — `href={`/bulletin/#${b.slug}`}` (town/pages/index.astro
//     :443) and the four same-page `href={`#${…}`}` rails. A static read cannot
//     resolve a template, so asserting on them would be theatre. Noted rather
//     than silently dropped: the computed bulletin link is a live instance of
//     the same class this file exists for — every bulletin teaser on the home
//     page deep-links a card slug the bulletin renders no id for.
//   · Links built in script, e.g. `var RECORDS = { "illuminator-name":
//     "/bulletin/#name-the-illuminator" }` (town/pages/votes/index.astro:127).
//     Same target as a real href below, so the class is already on the record.
//   · Off-site links. Another site's anchors are not ours to hold.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PAGES = join(ROOT, "town", "pages");

// ── THE KNOWN-OPEN LEDGER ────────────────────────────────────────────────────
// Dead anchors that are NOT this issue's to repair, each with the reason. The
// precedent is `nav.test.mjs`'s `held:` / `noActive:` escapes: a miss may be
// declared, and declaring it costs a sentence written where the next reader
// meets it. An UNDECLARED miss still reds, which is the whole point.
//
// Every one of these points at `/bulletin/`, and they are one finding, not
// three: the bulletin is a wall of cards with no ids on it, so EVERY deep link
// into it is dead. Repairing that is a decision about whether the bulletin's
// notices are addressable — a shape call for the founder, not a lane's fix —
// which is why #2506 repaired the link whose board was already elsewhere and
// left these standing. Reported on #2506.
//
// A stale entry is a lie too, so the second test below makes every entry prove
// its link is still written where it says it is.
const KNOWN_OPEN = [
  {
    page: "town/index.astro",
    href: "/bulletin/#marketplace",
    why: "same wall, same absence. Unlike #quests this one is NOT trivially repointable — the prose around it names the bulletin as the authority for the price rows, so where it should land is a content call, not a typo.",
  },
];

/** Every .astro page under town/pages, deepest included. */
function everyPageFile(dir = PAGES, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) everyPageFile(full, out);
    else if (name.endsWith(".astro")) out.push(full);
  }
  return out;
}

/** A route resolves the way Astro resolves it — nav.test.mjs's rule, kept identical. */
function pageFileFor(path) {
  const segs = path.split("/").filter(Boolean);
  const base = segs.length ? join(PAGES, ...segs) : join(PAGES, "index");
  for (const cand of segs.length ? [`${base}.astro`, join(base, "index.astro")] : [`${base}.astro`]) {
    if (existsSync(cand)) return cand;
  }
  return null;
}

// ── A COMMENT IS NOT AN ANCHOR (found by the reviewer's flip, 2026-09-14) ────
// The first cut of this file read raw source, and the reviewer's flip renamed
// ONLY the element's `id="quests"` and got six green tests back. The reason was
// this file's own doing: the explanatory comment left on that page QUOTES
// `id="quests"` in prose, the reader counted the quoted one, and a page with no
// anchor at all read as a page that had one.
//
// That is the worst failure shape a watcher can have. It does not merely miss
// the defect — it is HARDEST to fool while nobody has written about an anchor
// and EASIEST once somebody explains one, so the check goes blind on exactly
// the pages that got careful attention. Every id and every href is now read
// from source with its prose blanked out.
//
// Three forms, each blanked to spaces rather than deleted so that line
// structure survives:
//   · HTML          <!-- … -->
//   · JSX / Astro   a brace-wrapped block comment, and any bare block comment,
//                   which also covers the frontmatter and the <style> block
//   · line          `// …` to end of line, OUTSIDE quotes only
//
// ONE PASS, IN SOURCE ORDER (#2877, the sibling of #2867). The first cut ran
// the block shapes as regex passes FIRST and the line pass second, so a `/*`
// mentioned inside a `// …` line opened a fake block that swallowed real
// markup up to the next `*/` — two real hrefs on the 09-16 pages vanished
// before the walk saw them, and a dead link behind such a window passed. Now
// every opener is recognised at the position it opens, left to right, and
// whichever opens first consumes its body: a `/*` inside a line comment opens
// nothing, a `//` inside a block ends nothing.
//
// The line shape is the one with teeth, because `https://` is not a comment.
// Quotes — `"`, `'` and backtick — are tracked per line, a `//` inside any of
// them is prose, and a `//` preceded by `:` or `(` is a protocol or `url(//…)`.
// The block shapes are recognised regardless of quotes, as before: an id quoted
// inside a comment must not count, whatever the comment is standing in.
export function stripComments(src) {
  const s = String(src);
  let out = "";
  let i = 0;
  let quote = null;
  const blankTo = (end) => { out += s.slice(i, end).replace(/[^\n]/g, " "); i = end; };
  const closeOf = (openLen, close) => { const e = s.indexOf(close, i + openLen); return e < 0 ? s.length : e + close.length; };
  while (i < s.length) {
    const c = s[i];
    if (c === "\n") { out += c; i++; quote = null; continue; }
    if (s.startsWith("<!--", i)) { blankTo(closeOf(4, "-->")); continue; }
    const jsx = /^\{\s*\/\*/.exec(s.slice(i, i + 16));
    if (jsx) {
      const open = i + jsx[0].length - 2;            // the `/*` inside the brace
      const e = s.indexOf("*/", open + 2);
      const end = e < 0 ? s.length : e + 2;
      const brace = e < 0 ? null : /^\s*\}/.exec(s.slice(end, end + 16));
      if (brace) { blankTo(end + brace[0].length); continue; }   // `{ /* … */ }` whole
      out += s.slice(i, open); i = open; blankTo(end); continue; // a bare block after a brace
    }
    if (s.startsWith("/*", i)) { blankTo(closeOf(2, "*/")); continue; }
    if (quote) {
      if (c === "\\") { out += s.slice(i, i + 2); i += 2; continue; }
      if (c === quote) quote = null;
      out += c; i++; continue;
    }
    if (c === '"' || c === "'" || c === "`") { quote = c; out += c; i++; continue; }
    if (c === "/" && s[i + 1] === "/") {
      const before = s[i - 1];
      if (before === ":" || before === "(") { out += c; i++; continue; } // https://… and url(//…)
      const eol = s.indexOf("\n", i);
      blankTo(eol < 0 ? s.length : eol);                                  // the newline itself stays
      continue;
    }
    out += c; i++;
  }
  return out;
}

/** A page's source as the reader sees it: prose blanked, markup left alone. */
const sourceOf = (file) => stripComments(readFileSync(file, "utf8"));

/** Literal ids on a page. `id={expr}` is deliberately not counted — it cannot be resolved statically. */
export function idsIn(src) {
  return new Set(Array.from(src.matchAll(/\bid="([^"]+)"/g), (m) => m[1]));
}

/**
 * Every in-site fragment link written as a literal href.
 * `href="/town/#pots"` → { path: "/town/", frag: "pots" }
 * `href="#seam"`       → { path: "", frag: "seam" }  (the page itself)
 * Off-site and computed hrefs are not matched, by construction.
 */
export function fragmentLinksIn(src) {
  const out = [];
  for (const m of src.matchAll(/href="(\/[^"#\s]*|)#([^"\s]+)"/g)) {
    out.push({ path: m[1], frag: m[2], href: `${m[1]}#${m[2]}` });
  }
  return out;
}

const rel = (f) => relative(PAGES, f).split("\\").join("/");

/** Every fragment link on the site, resolved: { from, href, path, frag, target, dead, noPage } */
function survey() {
  const out = [];
  const idsCache = new Map();
  const idsOf = (f) => { if (!idsCache.has(f)) idsCache.set(f, idsIn(sourceOf(f))); return idsCache.get(f); };
  for (const file of everyPageFile()) {
    // BOTH SIDES read the stripped source, not just the ids. A link quoted in
    // prose is not a link either, and the two halves reading different text is
    // how a checker starts disagreeing with itself.
    for (const link of fragmentLinksIn(sourceOf(file))) {
      const target = link.path === "" ? file : pageFileFor(link.path);
      const noPage = target === null;
      const dead = noPage ? true : !idsOf(target).has(link.frag);
      out.push({ from: rel(file), ...link, target, noPage, dead });
    }
  }
  return out;
}

const declared = (l) => KNOWN_OPEN.some((k) => k.page === l.from && k.href === l.href);

// ── THE LAW ──────────────────────────────────────────────────────────────────

test("the survey reads something — a check over an empty corpus is not a check", () => {
  const all = survey();
  assert.ok(all.length >= 10,
    `only ${all.length} fragment links found under town/pages — the regex or the walk has stopped working`);
});

test("every in-site #anchor link lands on an id that exists on the page it names", () => {
  const undeclaredDead = survey().filter((l) => l.dead && !declared(l));
  assert.deepEqual(
    undeclaredDead.map((l) => `${l.from} → ${l.href}${l.noPage ? "  (no such page)" : "  (no such anchor on that page)"}`),
    [],
    "a link carries a fragment the destination page has no id for, so it lands at the top of that page with nothing to scroll to. " +
    "Either point it where the thing actually is, give the destination the anchor, or declare it in KNOWN_OPEN with the reason.",
  );
});

test("the civic hub's quest link names the page that renders the board (#2506)", () => {
  // The instance the file was born for, pinned by name so a repoint has to
  // argue with it rather than slip past the general law above.
  // Stripped, like everything else here: this page's comments discuss both the
  // old href and the id by name, and a pinned check that reads its own
  // explanation is the very hole this file was sent back to close.
  const hub = sourceOf(join(PAGES, "town", "index.astro"));
  assert.equal(hub.includes('href="/bulletin/#quests"'), false,
    "the hub links /bulletin/#quests again — the bulletin has no `quests` anchor, it never had one, and the board is on the hub itself");
  assert.ok(hub.includes('href="/town/#quests"'),
    "`the full board` no longer names /town/#quests — the Quests grid is the board and `id=\"quests\"` is where it lives");
  assert.ok(idsIn(hub).has("quests"),
    "the hub lost `id=\"quests\"`, so the link above now points at nothing on its own page");
});

test("no KNOWN_OPEN entry has gone stale — a declared miss must still be a miss that is written there", () => {
  const stale = [];
  for (const k of KNOWN_OPEN) {
    const file = join(PAGES, k.page);
    if (!existsSync(file)) { stale.push(`${k.page} — the page is gone`); continue; }
    if (!sourceOf(file).includes(`href="${k.href}"`)) {
      stale.push(`${k.page} → ${k.href} — no longer written there`);
    }
  }
  assert.deepEqual(stale, [],
    "a KNOWN_OPEN entry names a link that is no longer in the file. If it was repaired, delete the entry; " +
    "the ledger is only worth its lines while every line is still true.");
});

// ── THE PROBE CAN FAIL ───────────────────────────────────────────────────────
// Both halves, on synthetic input, so a green above is a green about the site
// and not about a regex that matches nothing.

test("the reader finds a dead anchor and passes a live one", () => {
  const page = '<a href="/town/#pots">a</a><a href="/town/#ghost">b</a><a href="#here">c</a><span id="here"></span>';
  const links = fragmentLinksIn(page);
  assert.deepEqual(links.map((l) => l.href), ["/town/#pots", "/town/#ghost", "#here"],
    "the href reader lost a link");
  assert.deepEqual([...idsIn(page)], ["here"], "the id reader lost an id");

  const townIds = idsIn(sourceOf(join(PAGES, "town", "index.astro")));
  assert.equal(townIds.has("pots"), true, "a live anchor must read as live");
  assert.equal(townIds.has("ghost"), false, "a dead anchor must read as dead");
});

test("an off-site or computed href is not mistaken for an in-site one", () => {
  const page =
    '<a href="https://example.com/x#y">off</a>' +
    "<a href={`/bulletin/#${b.slug}`}>computed</a>" +
    '<a href="/town/#board">in-site</a>';
  assert.deepEqual(fragmentLinksIn(page).map((l) => l.href), ["/town/#board"]);
});

// ── AN ANCHOR THAT ONLY EXISTS IN PROSE IS NOT AN ANCHOR ─────────────────────
// The regression the reviewer's flip found, written as the thing it is: a page
// whose ONLY `id="x"` is inside a comment, and a link to `#x` that has to red.

/** The one decision the whole file makes, on a page held in memory. */
const linkIsDead = (src, frag) => !idsIn(stripComments(src)).has(frag);

test("a page whose only `id` is quoted in a comment has no anchor, and a link to it is dead", () => {
  const jsx = [
    "<section>",
    "  {/* THE HISTORY: this lane used to carry id=\"ghost\" and the link below named it. */}",
    '  <a href="#ghost">the board</a>',
    "</section>",
  ].join("\n");
  const html = '<!-- once <div id="ghost"> lived here --><a href="#ghost">the board</a>';
  const line = '// the anchor used to be id="ghost"\n<a href="#ghost">the board</a>';

  for (const [form, src] of [["a JSX block comment", jsx], ["an HTML comment", html], ["a line comment", line]]) {
    assert.equal(idsIn(src).has("ghost"), true,
      `${form}: the raw text really does contain the id — otherwise this fixture proves nothing`);
    assert.equal(linkIsDead(src, "ghost"), true,
      `${form} kept a dead anchor alive. This is the reviewer's flip: rename the element and the prose about it still answers.`);
  }

  // AND THE OTHER DIRECTION, or the fix is just blindness: a REAL id beside the
  // same prose still counts, so stripping has not eaten the markup.
  const withReal = jsx.replace("<section>", '<section id="ghost">');
  assert.equal(linkIsDead(withReal, "ghost"), false,
    "the element's own id was stripped along with the comment that discusses it");
});

test("stripping keeps its hands off the markup — a URL is not a comment", () => {
  // `https://` is the case that makes a naive line-comment strip destroy a page.
  const url = '<a href="https://example.com/a/b">x</a><span id="kept"></span>';
  assert.deepEqual([...idsIn(stripComments(url))], ["kept"], "a protocol slash-slash ate the rest of the line");

  const inString = '<span data-note="see // below" id="kept"></span>';
  assert.deepEqual([...idsIn(stripComments(inString))], ["kept"], "a slash-slash inside a quoted string ate the rest of the line");

  const cssUrl = '.a { background: url(//cdn.example.com/x.png); }\n<span id="kept"></span>';
  assert.deepEqual([...idsIn(stripComments(cssUrl))], ["kept"], "a protocol-relative url() ate the rest of the line");

  const trailing = 'const lane = "quests";   // the section is id="ghost"\n<span id="kept"></span>';
  const ids = idsIn(stripComments(trailing));
  assert.equal(ids.has("kept"), true, "a trailing line comment ate the markup after it");
  assert.equal(ids.has("ghost"), false, "a trailing line comment's quoted id was counted");
});

test("every real page still parses to at least one id — stripping has not blanked the site", () => {
  // THE WHOLE-CORPUS CONTROL. A strip that was too greedy would pass every test
  // above by returning nothing at all, and the survey would go green on an
  // empty world. Ids must survive on the pages that have them.
  const ids = everyPageFile().map((f) => [rel(f), idsIn(sourceOf(f)).size]);
  const total = ids.reduce((n, [, k]) => n + k, 0);
  assert.ok(total >= 20, `only ${total} ids survive stripping across ${ids.length} pages — the strip is eating markup`);
  for (const anchor of ["quests", "pots", "board", "marketplace", "ideas", "ballot-house"]) {
    assert.ok(idsIn(sourceOf(join(PAGES, "town", "index.astro"))).has(anchor),
      `the hub's \`${anchor}\` anchor did not survive stripping`);
  }
});

// ── ONE PASS, IN SOURCE ORDER (#2877, sibling of #2867) ──────────────────────
// Block comments stripped first and line comments second let a `/*` mentioned
// inside a `// …` line open a fake block that swallowed real markup up to the
// next `*/`. Two real hrefs vanished that way before the walk saw them, and a
// dead link behind such a window would have passed.
test("a `/*` inside a line comment opens no block, and a `//` inside a block ends nothing", () => {
  const src = [
    "// the old reader used /* to open a block here",
    '<a href="#after">after the window</a>',
    '<section id="after"></section>',
    "/* a real block that mentions // a line comment",
    '   and ends here */ <span id="tail"></span>',
  ].join("\n");
  assert.deepEqual([...idsIn(stripComments(src))].sort(), ["after", "tail"],
    "the `/*` in the line comment swallowed the markup up to the real block's `*/`");
  assert.equal(linkIsDead(src, "after"), false, "the link to #after reads dead because its anchor was blanked");

  // AND THE FIXTURE BITES: the 09-16 order (blocks first) on the same text loses
  // the anchor — otherwise the assertion above proves nothing about the order.
  const blocksFirst = src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
  assert.equal(idsIn(blocksFirst).has("after"), false, "this fixture does not exercise the two-pass order");
});