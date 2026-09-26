// docs.test.mjs — the Docs begin (the Site Lift, POS-257).
//
//   node --test test/docs.test.mjs
//
// /docs/ says what the guides are for and lists them; stamps, the numbers and
// the repos are its first three; the guides still to write are named, not
// linked. Every guide is in view: no "more", nothing only in a hover (POS-250's
// rule). Built-page tests are skipped until the page is built, as POS-177 rules.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { GUIDES, TO_WRITE } from "../src/lib/docs.mjs";
import { RAIL } from "../src/lib/nav.mjs";
import { REPOS } from "../src/lib/record.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist-town");
const built = (...segs) => existsSync(join(DIST, ...segs, "index.html"));
const html = (...segs) => readFileSync(join(DIST, ...segs, "index.html"), "utf8");

const decode = (s) => String(s)
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/g, "'")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const plain = (s) => decode(String(s)
  .replace(/<\/?(?:a|b|i|em|strong|code|span)\b[^>]*>/g, "")
  .replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
/** What a reader sees without opening or hovering anything. */
const inView = (page) => plain(page
  .replace(/<details\b[\s\S]*?<\/details>/g, "")
  .replace(/<span\b[^>]*class="[^"]*\bpm-sr\b[^"]*"[^>]*>[\s\S]*?<\/span>/g, ""));
/** The page's own body, from its container to the layout's foot: the rail
 * above it and the door line and socials under it are the layout's. */
const own = (page, cls) => {
  const from = page.indexOf(`class="${cls}"`);
  assert.ok(from > 0, `no .${cls} on the page`);
  return page.slice(from, page.indexOf('<footer class="pm-doorfoot"', from));
};

test("every written guide is a page under /docs/, and every guide the Docs seat lists is on the index", () => {
  for (const g of GUIDES) {
    assert.equal(g.href, `/docs/${g.key}/`);
    assert.ok(existsSync(join(ROOT, "town", "pages", "docs", g.key, "index.astro")), `${g.href} has no page`);
    assert.ok(g.what && g.asks.length > 0, `${g.key} says nothing of what it answers`);
  }
  const seat = RAIL.find((s) => s.key === "docs").members.filter((m) => m.href !== "/docs/");
  assert.deepEqual(GUIDES.map((g) => g.href).sort(), seat.map((m) => m.href).sort(),
    "the index and the Docs seat's chips list different guides");
});

test("a guide still to write is not a guide yet: it has no row in GUIDES", () => {
  const written = GUIDES.map((g) => g.name.toLowerCase());
  for (const t of TO_WRITE) assert.ok(!written.includes(t.toLowerCase()), `"${t}" is both written and still to write`);
});

test("the built index: the founder's line, then what the guides are for, then every guide in view", { skip: !built("docs") }, () => {
  const page = own(html("docs"), "dx");
  const seen = inView(page);
  const founder = seen.indexOf("We refuse to hide: the record is public.");
  const forWhat = seen.indexOf("a guide for each of its features, written for the people who use them");
  assert.ok(founder >= 0, "the founder's line left the Docs");
  assert.ok(forWhat > founder, "the index does not say what the guides are for, after the founder's line");
  assert.equal(/<details\b/.test(page), false, "the index has an expand");
  assert.equal(/\btitle="/.test(page), false, "the index carries something on a hover");
  for (const g of GUIDES) {
    const at = page.indexOf(`data-guide="${g.key}"`);
    assert.ok(at > 0, `${g.key} is not on the index`);
    const card = page.slice(at, page.indexOf("</li>", at));
    assert.match(card, new RegExp(`href="${g.href}"`), `${g.key}'s card does not link its page`);
    for (const s of [g.name, g.what, ...g.asks]) assert.ok(inView(card).includes(plain(s)), `not in view on ${g.key}'s card: "${s}"`);
  }
});

test("the built index names the guides still to write, and links none of them", { skip: !built("docs") }, () => {
  const page = own(html("docs"), "dx");
  const at = page.indexOf('class="dx-next"');
  assert.ok(at > 0, "the index leaves no room for the guides to come");
  const line = page.slice(at, page.indexOf("</p>", at));
  for (const t of TO_WRITE) assert.ok(plain(line).includes(t), `"${t}" is not named`);
  assert.equal(/<a\b/.test(line), false, "a guide not written yet is linked");
});

test("each built guide leads back to the index", () => {
  for (const g of GUIDES) {
    if (!built("docs", g.key)) continue;
    const crumb = /<p class="[a-z]+-crumb"[^>]*>([\s\S]*?)<\/p>/.exec(html("docs", g.key));
    assert.ok(crumb, `${g.href} has no crumb`);
    assert.match(crumb[1], /<a href="\/docs\/"[^>]*>DOCS<\/a>/, `${g.href}'s crumb does not reach the Docs`);
  }
});

test("the built repos page: what each repo holds and what its maintainers said, in view", { skip: !built("docs", "repos") }, () => {
  const page = own(html("docs", "repos"), "recdir");
  assert.equal(/<details\b/.test(page), false, "the repos page has an expand again");
  assert.equal(/\btitle="/.test(page), false, "a repo card carries something on its hover");
  assert.ok(inView(page).includes("The doors answer what the town holds; these are where it is kept."));
  for (const r of REPOS) {
    const start = page.indexOf(`data-repo="${r.key}"`);
    const card = inView(page.slice(start, page.indexOf("</a>", start)));
    for (const s of [r.holds, ...(r.said ? [r.said] : [])]) assert.ok(card.includes(plain(s)), `not in view on ${r.key}: "${s}"`);
  }
});
