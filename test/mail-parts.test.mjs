// mail-parts.test.mjs — the correspondences and conversations load in parts (POS-274).
//
//   node --test test/mail-parts.test.mjs
//
// The issue's parts, as falsifiers: a pair page and a thread page render only
// their newest LETTERS_PART_SIZE letters; every older letter is on exactly one
// static part page and in the JSON chunk of the same part, with the same
// markup; a link to an older letter names the part that holds it; the loader
// asks nothing of the office; the walkthrough's screenshots are files beside
// it, loaded lazily, in the same order.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { LETTERS_PART_SIZE, letterParts, letterPartHref, letterPartJson, pairThreadMarks } from "../src/lib/mail.mjs";
import { pairViews, threadViews } from "../src/lib/mail-letter.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = (f) => JSON.parse(readFileSync(join(ROOT, "src", "data", "postmark", f), "utf8"));
const DIST = join(ROOT, "dist-town");

// ── THE PARTS ARITHMETIC ────────────────────────────────────────────────────

test("parts count back from the newest and keep reading order inside", () => {
  const items = Array.from({ length: 45 }, (_, i) => i);
  const parts = letterParts(items, 20);
  assert.deepEqual(parts.map((p) => p.length), [20, 20, 5]);
  assert.deepEqual(parts[0], items.slice(25));
  assert.deepEqual(parts[2], items.slice(0, 5));
  assert.deepEqual(parts.slice().reverse().flat(), items);
  assert.deepEqual(letterParts([], 20), [[]]);
  assert.deepEqual(letterParts(items.slice(0, 20), 20), [items.slice(0, 20)]);
  assert.equal(letterPartHref(1, "/mail/with/a--b/"), "/mail/with/a--b/");
  assert.equal(letterPartHref(3, "/mail/with/a--b/"), "/mail/with/a--b/older/3/");
  assert.equal(letterPartJson(3, "/mail/x/"), "/mail/x/older/3.json");
});

test("the thread rules and colours are worked over the whole correspondence", () => {
  const ls = ["a", "a", "b", "a", "c"].map((t, i) => ({ id: `l${i}`, t }));
  const { order, marks } = pairThreadMarks(ls, (l) => l.t);
  assert.deepEqual(order, ["a", "b", "c"]);
  assert.deepEqual(marks.map((m) => m.divider), [null, null, "a new thread begins", "an earlier thread continues", "a new thread begins"]);
  assert.equal(marks[0].hue, marks[3].hue);
  assert.notEqual(marks[0].hue, marks[2].hue);
});

// ── THE BUILT PAGES (skipped until built, as POS-177 rules) ──────────────────

const at = (...segs) => join(DIST, ...segs);
const built = (...segs) => existsSync(at(...segs, "index.html"));
const html = (...segs) => readFileSync(at(...segs, "index.html"), "utf8");
const articleIds = (page) => [...page.matchAll(/<article class="pm-letter[^"]*" id="([^"]+)"/g)].map((m) => m[1]);
const chunk = (base, part) => JSON.parse(readFileSync(at(...letterPartJson(part, base).split("/").filter(Boolean)), "utf8"));
const segsOf = (href) => href.split("/").filter(Boolean);

/** The page, its static parts and its chunks, against the view's own parts. */
function checkParts(base, parts, label) {
  const ids = (ls) => ls.map((l) => l.id);
  assert.deepEqual(articleIds(html(...segsOf(base))), ids(parts[0]), `${label}: the page is not the newest part`);
  for (let k = 2; k <= parts.length; k++) {
    const page = html(...segsOf(letterPartHref(k, base)));
    const c = chunk(base, k);
    assert.deepEqual(articleIds(page), ids(parts[k - 1]), `${label}: part ${k}'s page`);
    assert.deepEqual(c.ids, ids(parts[k - 1]), `${label}: part ${k}'s chunk`);
    assert.deepEqual(articleIds(c.html), c.ids, `${label}: part ${k}'s chunk html`);
    assert.ok(page.includes(c.html), `${label}: part ${k}'s page and chunk differ in markup`);
  }
  // no part past the last
  assert.equal(built(...segsOf(letterPartHref(parts.length + 1, base))), false, `${label}: a part past the last`);
}

test("every correspondence renders its newest part; every older letter is on one part page and in its chunk",
  { skip: !built("mail") }, () => {
  const views = [...pairViews(DATA("letters.json"), DATA("threads.json"), DATA("ledger.json")).values()];
  let parted = 0;
  for (const v of views) {
    if (v.parts.length > 1) parted++;
    assert.ok(v.parts[0].length <= LETTERS_PART_SIZE);
    checkParts(`/mail/with/${v.key}/`, v.parts, v.key);
  }
  assert.ok(parted > 0, "no correspondence is long enough to have parts: the check checked nothing");
});

test("every conversation renders its newest part; every older letter is on one part page and in its chunk",
  { skip: !built("mail") }, () => {
  const views = threadViews(DATA("threads.json"), DATA("letters.json"));
  assert.ok(views.some((v) => v.parts.length > 1), "no conversation is long enough to have parts");
  for (const v of views) checkParts(`/mail/${v.thread.key}/`, v.parts, v.thread.key);
});

test("a pair page's rail and calendar name the part that holds an older letter", { skip: !built("mail") }, () => {
  const v = [...pairViews(DATA("letters.json"), DATA("threads.json"), DATA("ledger.json")).values()].find((x) => x.parts.length > 2);
  const base = `/mail/with/${v.key}/`;
  const page = html(...segsOf(base));
  const rail = new Map([...page.matchAll(/<a class="rail-item" href="([^"]*)#([^"]+)"/g)].map((m) => [m[2], m[1]]));
  assert.equal(rail.size, v.pairLetters.length);
  v.parts.forEach((ls, i) => ls.forEach((l) => assert.equal(rail.get(l.id), i === 0 ? "" : letterPartHref(i + 1, base), l.id)));
  for (const m of page.matchAll(/<a class="heat-cell lit" href="([^"]*)#([^"]+)"/g)) {
    const i = v.parts.findIndex((ls) => ls.some((l) => l.id === m[2]));
    assert.equal(m[1], i === 0 ? "" : letterPartHref(i + 1, base), `calendar → ${m[2]}`);
  }
});

test("without JavaScript the older-letters control is a link to a built part page", { skip: !built("mail") }, () => {
  const v = [...pairViews(DATA("letters.json"), DATA("threads.json"), DATA("ledger.json")).values()].find((x) => x.parts.length > 1);
  const page = html(...segsOf(`/mail/with/${v.key}/`));
  const href = page.match(/<a class="pm-btn ghost" href="([^"]+)" data-older-next/)?.[1];
  assert.equal(href, letterPartHref(2, `/mail/with/${v.key}/`));
  assert.ok(built(...segsOf(href)));
});

test("the older letters come from the build, never the office", () => {
  const src = readFileSync(join(ROOT, "src", "components", "MailOlder.astro"), "utf8");
  const fetches = [...src.matchAll(/fetch\((\w+\([^)]*\)|[^,)]+)/g)].map((m) => m[1].trim());
  assert.deepEqual(fetches, ["letterPartJson(part, base)"]);
  assert.doesNotMatch(src, /OFFICE|\/api\//);
});

// ── THE WALKTHROUGH ────────────────────────────────────────────────────────

test("the walkthrough's screenshots are files beside it, loaded lazily, in order", () => {
  const dir = join(ROOT, "public", "atelier", "postmark", "walkthroughs", "chat-only");
  const page = readFileSync(join(dir, "index.html"), "utf8");
  assert.doesNotMatch(page, /data:image/);
  const imgs = [...page.matchAll(/<img [^>]*>/g)].map((m) => m[0]);
  assert.equal(imgs.length, 22);
  const srcs = imgs.map((t) => t.match(/src="\/walkthroughs\/chat-only\/(shot-\d\d\.webp)"/)?.[1]);
  for (const [i, t] of imgs.entries()) {
    assert.match(t, /loading="lazy"/, `picture ${i + 1} is not lazy`);
    assert.ok(srcs[i] && existsSync(join(dir, srcs[i])), `picture ${i + 1}: ${t}`);
  }
  // the order as extracted: a picture repeated is the same file, first seen first
  assert.deepEqual(srcs.map((s) => Number(s.slice(5, 7))),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 1, 15, 16, 2, 17, 18, 6, 1]);
});
