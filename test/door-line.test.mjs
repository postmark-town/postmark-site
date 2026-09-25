// door-line.test.mjs — the foot of every page names its door, and carries the
// town's rooms beyond the door.
//
//   node --test test/door-line.test.mjs
//
// THE DESIGN, verbatim (G:/Starstory/docs/2026-09-25/design-notes/
// the-site-reprojected.md, "One rule on every page"):
//
//   "the foot names its door (`this page is town { read: "calendar" } · GET
//    /api/calendar · as the office read it 4 min ago`)"
//
// and the brief's falsifier for this part: "the door line renders the declared
// read on a page and nothing on Join".

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { doorLine, SOCIALS, OFFICE_ORIGIN } from "../src/lib/door-line.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PAGES = join(ROOT, "town", "pages");
const DIST = join(ROOT, "dist-town");

function everyPageFile(dir = PAGES) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...everyPageFile(full));
    else if (name.endsWith(".astro")) out.push(full);
  }
  return out;
}

const openingTag = (file) => /<PostmarkLayout\b[^>]*>/s.exec(readFileSync(file, "utf8"))?.[0] ?? null;

// ── THE PROP IS DECLARED, EVERY TIME ──────────────────────────────────────

test("every page that renders PostmarkLayout declares its door — an object or null, never silence", () => {
  const pages = everyPageFile().filter((f) => openingTag(f));
  // A walk that found nothing proves nothing: the town has thirty such pages.
  assert.ok(pages.length >= 25, `only ${pages.length} layout pages found — the walk is broken`);
  const silent = pages.filter((f) => !/\bdoor=\{/.test(openingTag(f))).map((f) => relative(ROOT, f));
  assert.deepEqual(silent, [], "these pages render the layout without declaring `door`");
});

test("Join declares null, so its foot claims no read", () => {
  const tag = openingTag(join(PAGES, "join", "index.astro"));
  assert.match(tag, /\bdoor=\{null\}/);
});

test("the layout renders the foot exactly once, after the page body", () => {
  const shell = readFileSync(join(ROOT, "src", "layouts", "PostmarkLayout.astro"), "utf8");
  assert.equal(shell.match(/<DoorLine\b/g)?.length, 1, "PostmarkLayout must render exactly one <DoorLine>");
  assert.ok(shell.indexOf("<slot />") < shell.indexOf("<DoorLine"), "the foot sits below the page's own body");
});

// ── THE LINE ITSELF ───────────────────────────────────────────────────────

test("doorLine: null and an empty door are no line; a read and a GET are both kept", () => {
  assert.equal(doorLine(null), null);
  assert.equal(doorLine(undefined), null);
  assert.equal(doorLine({}), null);
  assert.equal(doorLine({ mcp: "  ", get: "" }), null);
  assert.deepEqual(doorLine({ mcp: 'town { read: "bulletin" }', get: "/api/bulletin" }), {
    mcp: 'town { read: "bulletin" }',
    get: "/api/bulletin",
    getHref: `${OFFICE_ORIGIN}/api/bulletin`,
  });
  assert.deepEqual(doorLine({ mcp: 'town { read: "asks" }' }), { mcp: 'town { read: "asks" }', get: null, getHref: null });
});

test("doorLine: a templated GET prints but does not link (a link to a brace is a 404)", () => {
  const l = doorLine({ mcp: 'town { read: "letter" }', get: "/api/letters/{id}" });
  assert.equal(l.get, "/api/letters/{id}");
  assert.equal(l.getHref, null);
});

test("doorLine: a GET not spelled from /api/ is refused, not printed", () => {
  assert.throws(() => doorLine({ get: "/bulletin" }), /spelled from \/api\//);
  assert.throws(() => doorLine("town"), TypeError);
});

// ── THE SOCIALS ───────────────────────────────────────────────────────────

test("six socials, in the design's order", () => {
  assert.deepEqual(SOCIALS.map((s) => s.name), ["Discord", "Reddit", "X", "Bluesky", "YouTube", "TikTok"]);
  for (const s of SOCIALS) assert.match(s.path, /^M/, `${s.name} has no icon path`);
});

test("only a URL the town already links is linked; TikTok is soon; the rest are names", () => {
  const by = Object.fromEntries(SOCIALS.map((s) => [s.key, s]));
  // The Discord is the one the home page's last beat names — one invite, not two.
  const home = readFileSync(join(PAGES, "index.astro"), "utf8");
  assert.ok(home.includes(`href="${by.discord.href}"`), "the foot's Discord is not the home page's Discord");
  assert.equal(by.reddit.href, "https://www.reddit.com/r/PostmarkTown/");
  // X and Bluesky were given by Keemin on 2026-09-25 (site #144); YouTube still has no URL anywhere.
  assert.equal(by.x.href, "https://x.com/PostmarkTown");
  assert.equal(by.bluesky.href, "https://bsky.app/profile/postmark-town.bsky.social");
  assert.equal(by.youtube.href, null, "youtube has a URL no repo links");
  assert.equal(by.tiktok.soon, true);
  assert.equal(by.tiktok.href, null);
});

// ── THE BUILT PAGES (skipped until the family is built, as POS-177 rules) ──

const built = (...segs) => existsSync(join(DIST, ...segs, "index.html"));
const html = (...segs) => readFileSync(join(DIST, ...segs, "index.html"), "utf8");

test("the built bulletin's foot names its door", { skip: !built("bulletin") }, () => {
  const page = html("bulletin");
  const foot = page.slice(page.indexOf("data-door-foot"));
  assert.match(foot, /data-door-line/);
  assert.match(foot, /town \{ read: (&quot;|")bulletin(&quot;|") \}/);
  assert.match(foot, /href="https:\/\/postmark\.town\/api\/bulletin"/);
  assert.match(foot, /GET \/api\/bulletin/);
});

test("the built Join page carries the socials and no door line", { skip: !built("join") }, () => {
  const page = html("join");
  assert.equal(page.match(/data-door-foot/g)?.length, 1);
  assert.equal(/data-door-line/.test(page), false, "Join's foot claims a read");
  assert.match(page, /data-social="discord"/);
});

test("the built home page's foot carries all six socials, once", { skip: !built() }, () => {
  const page = html();
  assert.equal(page.match(/data-door-foot/g)?.length, 1);
  for (const s of SOCIALS) assert.equal(page.match(new RegExp(`data-social="${s.key}"`, "g"))?.length, 1, s.key);
});
