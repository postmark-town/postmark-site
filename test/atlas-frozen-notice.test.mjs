// atlas-frozen-notice.test.mjs — CORE-166: the Atlas MAP page (/atlas/town.html) says it is frozen, through the extractor's decoration pass.
//
//   node --test test/atlas-frozen-notice.test.mjs
//
// The map is the town's own drawing, regenerated twice a day, and tools/extract-town.mjs decorates it each time (the site doors, the image rewrites), so the words
// are added THERE, by the pure transform in tools/lib/atlas-frozen-notice.mjs, and never patched into generated HTML. This suite runs that transform over a fresh
// canonical-shaped page (the real page's header/main/body skeleton), and reads the extractor's source for the wiring. It does not run the extractor, fetch the town
// or build anything. Darko's words: "This map stopped changing in September 2026. Homes placed since then are on the World map."
//
// FALSIFIER: the words or the World link missing, doubled or altered; a second pass or a second extraction that loses or duplicates them; any other byte of the
// page (doors script, image refs, panel) changed; a notice that is fixed over the map; or the extractor no longer calling the transform.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { decorateFrozenNotice, FROZEN_WORDS, FROZEN_MARK } from "../tools/lib/atlas-frozen-notice.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const extractor = readFileSync(join(root, "tools/extract-town.mjs"), "utf8");

// the canonical map's own skeleton (the town's town.html): a header, the map, the panel, the body; its script defines openPanel, its images are rewritten later
const CANONICAL = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Postmark</title><style>header { text-align:center; }</style></head>
<body>
<div class="wrap">
  <header>
    <h1>Postmark</h1>
    <div class="sub">an atlas of the town, drawn from its own letters</div>
    <div class="stat">80 homes on the map, 69 of 80 lit · 12 of 38 pigeonholes lit</div>
  </header>
  <main class="mapwrap"><svg id="map-svg" viewBox="0 0 1500 2400"><image href="assets/aaaa.jpg"/></svg></main>
</div>
<aside class="panel" id="panel"><div id="panel-content"></div></aside>
<script>function openPanel(id) { document.getElementById('panel-content').textContent = id; }</script>
</body></html>`;

const textOf = (s) => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const noticeOf = (html) => html.match(/<p class="frozen-notice"[^>]*>[\s\S]*?<\/p>/g) ?? [];

test("the decorated map carries the exact words and a working World link, once, under the map's own header", () => {
  const out = decorateFrozenNotice(CANONICAL);
  const notices = noticeOf(out);
  assert.equal(notices.length, 1, "exactly one notice");
  assert.equal(textOf(notices[0]), FROZEN_WORDS, "the words, exactly");
  assert.equal(FROZEN_WORDS, "This map stopped changing in September 2026. Homes placed since then are on the World map.");
  assert.match(notices[0], /<a href="\/world\/" target="_top">World map<\/a>/, "the World link, out of the atlas's iframe like the site doors");
  assert.equal((out.match(/href="\/world\/"/g) ?? []).length, 1, "one World link");
  assert.ok(out.indexOf("</header>") < out.indexOf(FROZEN_MARK) && out.indexOf(FROZEN_MARK) < out.indexOf("<main"), "it sits between the header and the map, in the page's flow");
  assert.match(notices[0], /role="note"/);
});

test("a second pass over its own output, and a second extraction from the same fresh canonical, neither lose nor duplicate it", () => {
  const once = decorateFrozenNotice(CANONICAL);
  assert.equal(decorateFrozenNotice(once), once, "decorating the decorated page is a no-op");
  assert.equal(decorateFrozenNotice(CANONICAL), once, "the same canonical gives the same page every run");
  assert.equal(noticeOf(decorateFrozenNotice(once)).length, 1);
  assert.equal((decorateFrozenNotice(once).match(/data-frozen-notice/g) ?? []).length, 1, "the marker is not doubled");
});

test("nothing else in the page changes: the doors hook, the image refs, the panel and every other byte are exactly the canonical's", () => {
  const out = decorateFrozenNotice(CANONICAL);
  const cut = CANONICAL.indexOf("</header>") + "</header>".length;
  const head = out.slice(0, cut), tail = out.slice(out.length - (CANONICAL.length - cut));
  assert.equal(head, CANONICAL.slice(0, cut));
  assert.equal(tail, CANONICAL.slice(cut), "everything after the insertion is the canonical, byte for byte");
  assert.match(out, /function openPanel\(id\)/);
  assert.match(out, /<image href="assets\/aaaa\.jpg"\/>/);
});

test("the notice is an ordinary block in the page's flow: not fixed, not absolute, no z-index, so it can hide no control, and it wraps on a phone", () => {
  const out = decorateFrozenNotice(CANONICAL);
  const css = out.match(/<style>\s*\.frozen-notice[\s\S]*?<\/style>/)?.[0] ?? "";
  assert.ok(css, "its style travels with it");
  assert.ok(!/position\s*:|z-index|float\s*:/.test(css), "no positioning that could cover the map or its controls");
  assert.match(css, /max-width:\s*40rem/, "a readable measure that wraps at 390px");
  assert.match(css, /margin:\s*0 auto/);
});

test("a map with no header (or two) is said, not silently skipped: the extractor turns the throw into its FATAL", () => {
  assert.throws(() => decorateFrozenNotice("<body><main></main></body>"), /exactly one <\/header>/);
  assert.throws(() => decorateFrozenNotice(`${CANONICAL}<header></header>`), /exactly one <\/header>/);
});

test("the extractor's atlas pass calls the transform once, after the doors, and still has its openPanel check, image rewrite and doors", () => {
  assert.match(extractor, /import \{ decorateFrozenNotice \} from "\.\/lib\/atlas-frozen-notice\.mjs";/);
  assert.equal((extractor.match(/decorateFrozenNotice\(html\)/g) ?? []).length, 1, "called once on the atlas html");
  const calls = extractor.indexOf("decorateFrozenNotice(html)");
  assert.ok(extractor.indexOf('html = html.replace("</body>", `${DOORS}\\n</body>`);') < calls, "the notice is added after the doors are appended");
  assert.match(extractor.slice(calls - 40, calls + 200), /catch \(err\) \{ console\.error\(`FATAL: \$\{err\.message\}`\); process\.exit\(1\); \}/, "a layout change is a FATAL like the other decoration hooks");
  assert.match(extractor, /function openPanel\\s\*\\\(/, "the openPanel hook check is still there");
  assert.match(extractor, /html = html\.replace\(QUOTED_IMAGE_REF_RE/, "the image rewrite is still there");
  assert.match(extractor, /<div class="site-doors"|row\.className = 'site-doors'/, "the site doors are still there");
});

test("the /atlas/ landing no longer says the map redraws as the mail moves, and still sends the walkable town to the World", () => {
  const page = readFileSync(join(root, "town/pages/atlas.astro"), "utf8");
  const how = page.match(/<p class="how">([\s\S]*?)<\/p>/)?.[1] ?? "";
  assert.ok(how, "the intro paragraph is there");
  assert.ok(!/redraws/i.test(how) && !/as <a href="\/mail\/">the mail<\/a> moves/.test(how), "the contradictory clause is gone");
  assert.match(how, /<a href="\/world\/">the World<\/a>/);
  assert.match(textOf(how), /Click any place to read it in its holder's own words\. To walk the town rather than read its drawing, step into the World\./);
});
