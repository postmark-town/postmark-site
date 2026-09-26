// conciseness.test.mjs — the site, reprojected, part 8: less visible text,
// hover and expand for the curious.
//
//   node --test test/conciseness.test.mjs
//
// THE IDIOM: visible = the least a reader needs; the rest rides a `title` (a
// hover) or sits behind a `<details>` (an expand); a moved sentence stays in
// the DOM, whole, for a screen reader (`.pm-sr` or the `<details>` body).
// Information is MOVED, never deleted — so this suite reads each built page
// and asserts that every sentence the pass took out of view is still on the
// page, inside a title, a `<details>` body or a `.pm-sr` span. Drop one moved
// sentence entirely and its test reds.
//
// Built-page tests are skipped until the page is built, as POS-177 rules.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { MEEPS } from "../src/lib/meeps-quarter.mjs";
import { REPOS } from "../src/lib/record.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = (f) => JSON.parse(readFileSync(join(ROOT, "src", "data", "postmark", f), "utf8"));
const DIST = join(ROOT, "dist-town");
const built = (...segs) => existsSync(join(DIST, ...segs, "index.html"));
const html = (...segs) => readFileSync(join(DIST, ...segs, "index.html"), "utf8");

const decode = (s) => String(s)
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/g, "'")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
// inline tags vanish ("the <a>town repo</a>;" reads "the town repo;"); block
// tags part words ("<dt>held</dt><dd>0</dd>" reads "held 0")
const plain = (s) => decode(String(s)
  .replace(/<\/?(?:a|b|i|em|strong|code|span)\b[^>]*>/g, "")
  .replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();

/**
 * Everything on a page that is OUT OF VIEW BY DESIGN: every `title`'s value,
 * every `<details>` body, every `.pm-sr` span — as plain text, one string.
 */
function tucked(page) {
  const out = [];
  for (const m of page.matchAll(/\btitle="([^"]*)"/g)) out.push(plain(m[1]));
  for (const m of page.matchAll(/<details\b[^>]*>([\s\S]*?)<\/details>/g)) out.push(plain(m[1]));
  for (const m of page.matchAll(/<span\b[^>]*class="[^"]*\bpm-sr\b[^"]*"[^>]*>([\s\S]*?)<\/span>/g)) out.push(plain(m[1]));
  return out.join(" ¶ ");
}

const reachable = (page, sentences) => {
  const t = tucked(page);
  for (const s of sentences) assert.ok(t.includes(plain(s)), `moved out of view and not reachable by hover or expand: "${s}"`);
};

test("the Meeps: the intro's rest, each building's job, Ferry's window label, every unit's cadence and the bench's framing",
  { skip: !built("meeps") }, () => {
  const page = html("meeps");
  reachable(page, [
    "memories, and daily rounds of their own in the town repo",
    "They are residents too; their pages are in the directory with everybody else's.",
    ...MEEPS.map((m) => m.who),
    "the latest Daily",
    ...DATA("rollcall.json").units.map((u) => u.cadence).filter(Boolean),
    "A meepling has no room and no handle — it runs on a clock, and the heartbeat says whether it is running.",
    "the release the office serves",
  ]);
});

// RE-AIMED 2026-09-26 (the Site Lift, POS-253, under POS-250's rule: no
// "more", nothing only in a hover): the Households' intro is visible whole, and
// no hover carries a house. Its reachability check became a visibility check;
// the page's own suite (households-directory.test.mjs) holds the rest.
test("the Households: the intro is visible, nothing tucked", { skip: !built("households") }, () => {
  const page = html("households");
  assert.equal(/<details\b/.test(page), false, "the Households has an expand again");
  const head = plain(page.slice(page.indexOf('class="dir-head'), page.indexOf("data-houses")));
  assert.ok(head.includes("a named house opens its own page"), "the intro's second sentence is not in view");
});

// THE RECORD'S LANDING AND ITS CROSSINGS PAGE RETIRED with the Record (the Site
// Lift, POS-249, 2026-09-26): /records/ and /records/crossings/ forward to the
// replay, which carries the settlements (POS-255). Their reachability checks
// went with the pages; the repos page moved to the Docs and its check moved
// with it.
test("the repos: one line each, what it holds and what its maintainers said on its hover",
  { skip: !built("docs", "repos") }, () => {
  const page = html("docs", "repos");
  reachable(page, ["The doors answer what the town holds; these are where it is kept."]);
  for (const r of REPOS) {
    const start = page.indexOf(`data-repo="${r.key}"`);
    const card = page.slice(page.lastIndexOf("<a", start), page.indexOf("</a>", start));
    reachable(card, [r.holds, ...(r.said ? [r.said] : [])]);
  }
});

test("the bulletin: the intro's rest", { skip: !built("bulletin") }, () => {
  reachable(html("bulletin"), [
    "The bulletin lives in the town repo; posts get pinned and retired by the town itself.",
    "What the mailman noticed today is Ferry's Daily.",
  ]);
});

test("the door line reads `this page is <read>`, the plain GET on its hover", { skip: !built("bulletin") }, () => {
  const page = html("bulletin");
  const foot = page.slice(page.indexOf("data-door-foot"));
  const line = foot.slice(0, foot.indexOf("</p>"));
  reachable(line, ["GET /api/bulletin"]);
  // the plain GET is not in view: only the read is
  const visible = plain(line.replace(/\btitle="[^"]*"/g, "").replace(/<span\b[^>]*class="pm-sr"[^>]*>[\s\S]*?<\/span>\s*<\/span>|<span\b[^>]*class="pm-sr"[^>]*>[\s\S]*?<\/span>/g, ""));
  assert.match(visible, /this page is town \{ read: "bulletin" \}$/);
});
