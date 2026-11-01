// docs-road.test.mjs — /docs/ opens with a road into the public HANDBOOK (POS-855).
//
//   node --test test/docs-road.test.mjs
//
// Cold walks (11-01) found no road from the site to the law or to how-tos. The
// Docs now open with "Find your way": one line per thing a reader sets out to do,
// each linking the HANDBOOK shelf on GitHub; the three guides follow, unchanged.
// The road points and copies nothing. Built-page tests are skipped until the page
// is built (POS-177); the source tests run always, so a reverted page still fails.
// The mirror test reads the read-only blueprints mirror and is skipped when it is
// absent. It reads HANDBOOK/ only.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { GUIDES, ROAD, HANDBOOK_BASE, HANDBOOK_INDEX, handbookHref } from "../src/lib/docs.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist-town");
const PAGE_SRC = join(ROOT, "town", "pages", "docs", "index.astro");
const BUILT = join(DIST, "docs", "index.html");
const MIRROR = "/srv/repos/postmark-blueprints";

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

test("the page source opens with the road, then the guides", () => {
  const src = readFileSync(PAGE_SRC, "utf8");
  const road = src.indexOf("Find your way");
  const guides = src.indexOf("GUIDES.map");
  assert.ok(road > 0, "the Docs have no 'Find your way'");
  assert.ok(src.indexOf("ROAD.map") > 0, "the page does not render the road");
  assert.ok(src.indexOf("HANDBOOK_INDEX") > 0, "the page does not link the HANDBOOK's INDEX");
  assert.ok(road < guides, "the road is not before the guides");
});

test("every HANDBOOK path the road links exists on the blueprints mirror's origin/main", { skip: !existsSync(MIRROR) }, () => {
  for (const p of [...ROAD.map((r) => r.path), HANDBOOK_INDEX.path]) {
    assert.doesNotThrow(() => execFileSync("git", ["-C", MIRROR, "cat-file", "-e", `origin/main:HANDBOOK/${p}`], { stdio: "pipe" }),
      `HANDBOOK/${p} is not on origin/main`);
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
    assert.match(li, new RegExp(`href="${BLOB.replace(/[./]/g, "\\$&")}${r.path.replace(/[./]/g, "\\$&")}"`), `${r.key} does not link ${r.path}`);
    assert.ok(text(li).includes(r.name) && text(li).includes(decode(r.says)), `${r.key}'s line is not in view`);
  }
  assert.match(road, new RegExp(`href="${BLOB.replace(/[./]/g, "\\$&")}INDEX\\.md"[^>]*data-road-index|data-road-index[^>]*href="${BLOB.replace(/[./]/g, "\\$&")}INDEX\\.md"`),
    "the road does not link the HANDBOOK's INDEX");
  const after = page.slice(guidesAt);
  assert.equal(GUIDES.length, 3);
  for (const g of GUIDES) assert.match(after, new RegExp(`data-guide="${g.key}"[\\s\\S]*?href="${g.href}"`), `${g.key} is no longer listed`);
});
