// docs-road.test.mjs — /docs/ opens with a road into the public HANDBOOK (POS-855).
//
//   node --test test/docs-road.test.mjs
//
// Cold walks (11-01) found no road from the site to the law or to how-tos. The
// Docs now open with "Find your way": one line per thing a reader sets out to do,
// each linking the HANDBOOK shelf on GitHub; the three guides follow, unchanged.
// The road points and copies nothing. The built-page test is skipped until the
// page is built (POS-177), and CI's built-pages job builds first, so it runs
// there; the source tests run always, so a reverted page still fails.
// That every linked HANDBOOK path exists is not checked here: it needs the
// blueprints mirror, which a runner lacks, and a skip fails CI's built-pages
// job. It is tools/check-docs-road.mjs, run on a seat.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { GUIDES, ROAD, TO_WRITE, HANDBOOK_BASE, HANDBOOK_INDEX, handbookHref, roadHref, roadShelfHref } from "../src/lib/docs.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist-town");
const PAGE_SRC = join(ROOT, "town", "pages", "docs", "index.astro");
const BUILT = join(DIST, "docs", "index.html");

const BLOB = "https://github.com/postmark-town/postmark-blueprints/blob/main/HANDBOOK/";

// What a reader sets out to do (the brief's list), and the shelf each belongs to.
const TASKS = {
  arrive: "GUIDES/ARRIVING.md",
  letters: "GUIDES/MAIL.md",
  build: "GUIDES/BUILDING.md",
  stamps: "GUIDES/STAMPS.md",
  events: "GUIDES/EVENTS.md",
  bugs: "GUIDES/BUGS-AND-IDEAS.md",
  code: "GUIDES/CODE.md",
  words: "ONTOLOGY/INDEX.md",
  law: "LAW/INDEX.md",
  staff: "MEEPS/INDEX.md",
};

test("the road has a line for every task, each pointing at its HANDBOOK shelf", () => {
  assert.equal(HANDBOOK_BASE, BLOB);
  assert.deepEqual(ROAD.map((r) => r.key), Object.keys(TASKS));
  for (const r of ROAD) {
    assert.equal(r.path, TASKS[r.key], `${r.key} points at the wrong shelf`);
    assert.ok(r.name && r.says, `${r.key} has no line`);
    assert.ok(handbookHref(r.path).startsWith("https://github.com/postmark-town/postmark-blueprints/blob/main/HANDBOOK/"));
    // A signpost is one plain line, not a teaching page.
    assert.ok(r.says.length <= 140, `${r.key}'s line is more than a signpost`);
  }
  assert.equal(HANDBOOK_INDEX.path, "INDEX.md");
});

// The site's own page for a task: only the staff line has one (POS-855). Its main
// link goes to /meeps/, the fuller page; the HANDBOOK shelf stays as a second
// link. Every other line is the HANDBOOK shelf alone, untouched.
const SITE_PAGES = { staff: "/meeps/" };

test("the staff line goes to the site's /meeps/ and keeps the HANDBOOK shelf as a second link; no other line moves", () => {
  for (const r of ROAD) {
    if (SITE_PAGES[r.key]) {
      assert.equal(r.site, SITE_PAGES[r.key], `${r.key} does not point at its site page`);
      assert.equal(roadHref(r), SITE_PAGES[r.key]);
      assert.equal(roadShelfHref(r), `${BLOB}${TASKS[r.key]}`, `${r.key} lost its HANDBOOK shelf link`);
    } else {
      assert.equal(r.site, undefined, `${r.key} was given a site page: the brief moves the staff line only`);
      assert.equal(roadHref(r), `${BLOB}${TASKS[r.key]}`);
      assert.equal(roadShelfHref(r), null);
    }
  }
  assert.equal(ROAD.find((r) => r.key === "staff").path, "MEEPS/INDEX.md");
});

test("the page source opens with the road, then the guides", () => {
  const src = readFileSync(PAGE_SRC, "utf8");
  const road = src.indexOf("Find your way");
  const guides = src.indexOf("GUIDES.map");
  assert.ok(road > 0, "the Docs have no 'Find your way'");
  assert.ok(src.indexOf("ROAD.map") > 0, "the page does not render the road");
  assert.ok(src.indexOf("HANDBOOK_INDEX") > 0, "the page does not link the HANDBOOK's INDEX");
  assert.ok(road < guides, "the road is not before the guides");
  // the main link is roadHref (a site page stays in the tab), the second is roadShelfHref
  assert.match(src, /href=\{roadHref\(r\)\}/, "the road's main link is not roadHref");
  assert.match(src, /href=\{roadShelfHref\(r\)\}[^>]*data-road-shelf/, "the road does not render the HANDBOOK shelf as a second link");
  assert.doesNotMatch(src, /href=\{handbookHref\(r\.path\)\}/, "the road's main link goes straight to the HANDBOOK again");
});

// "Still to write" must not name a task the road already signposts (the index
// once ended "Still to write: the calendar and RSVPs" while the road's EVENTS
// line sent the reader to that very guide). WORDS is the words a TO_WRITE item
// would use for a road task, by road key, only where a word means that task. It
// is deliberately small and explicit, not a search of the road's own prose. A
// key here that the road no longer has fails too, so a removed signpost makes
// someone look again. A task with no words here ("the boat")
// is not claimed by the road.
const WORDS = {
  arrive: ["arriv"],
  letters: ["letter", "mail"],
  build: ["window"],
  stamps: ["stamp"],
  events: ["calendar", "rsvp", "event", "gathering"],
  bugs: ["bug"],
  code: ["contribut"],
};

test("'still to write' names no task the road already signposts", () => {
  const roadKeys = ROAD.map((r) => r.key);
  for (const key of Object.keys(WORDS)) assert.ok(roadKeys.includes(key), `${key} is no longer on the road: re-read WORDS`);
  assert.ok(TO_WRITE.length > 0);
  for (const item of TO_WRITE) {
    for (const [key, words] of Object.entries(WORDS)) {
      for (const w of words) {
        assert.ok(!item.toLowerCase().includes(w), `"${item}" is still to write, but the road's "${key}" line already points to it ("${w}")`);
      }
    }
  }
});

const decode = (s) => String(s).replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/&#39;/g, "'").replace(/&quot;/g, '"');
const text = (s) => decode(s.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();

test("the built index: the road leads, every task links its shelf, the three guides follow", { skip: !existsSync(BUILT) }, () => {
  const page = readFileSync(BUILT, "utf8");
  const roadAt = page.indexOf('class="dx-road"');
  const guidesAt = page.indexOf('class="dx-guides"');
  assert.ok(roadAt > 0, "no road on the built index");
  assert.ok(roadAt < guidesAt, "the road is not before the guides");
  const road = page.slice(roadAt, guidesAt);
  assert.ok(text(road).includes("Find your way"));
  for (const r of ROAD) {
    const at = road.indexOf(`data-road="${r.key}"`);
    assert.ok(at > 0, `no line for ${r.key}`);
    const li = road.slice(at, road.indexOf("</li>", at));
    const main = roadHref(r).replace(/[./]/g, "\\$&");
    assert.match(li, new RegExp(`class="dx-road-link"[^>]*href="${main}"|href="${main}"[^>]*class="dx-road-link"`), `${r.key}'s main link is not ${roadHref(r)}`);
    if (r.site) assert.match(li, new RegExp(`href="${roadShelfHref(r).replace(/[./]/g, "\\$&")}"[^>]*data-road-shelf|data-road-shelf[^>]*href="${roadShelfHref(r).replace(/[./]/g, "\\$&")}"`), `${r.key} lost its HANDBOOK shelf link`);
    else assert.ok(!li.includes("data-road-shelf"), `${r.key} grew a second link`);
    assert.ok(text(li).includes(r.name) && text(li).includes(decode(r.says)), `${r.key}'s line is not in view`);
  }
  assert.match(road, new RegExp(`href="${BLOB.replace(/[./]/g, "\\$&")}INDEX\\.md"[^>]*data-road-index|data-road-index[^>]*href="${BLOB.replace(/[./]/g, "\\$&")}INDEX\\.md"`),
    "the road does not link the HANDBOOK's INDEX");
  const after = page.slice(guidesAt);
  assert.equal(GUIDES.length, 3);
  for (const g of GUIDES) assert.match(after, new RegExp(`data-guide="${g.key}"[\\s\\S]*?href="${g.href}"`), `${g.key} is no longer listed`);
});
