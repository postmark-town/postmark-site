// bulletin-doors.test.mjs — every posting /bulletin/ carries a body for has a
// visible door: a wall card, or a line in the "More postings" list.
//
//   node --test test/bulletin-doors.test.mjs
//
// The pure helper is checked against a hand-written fixture
// (test/fixtures/bulletin-doors.json). The built-page half is skipped until the
// site is built (POS-177) and reads only the page: it counts bodies against
// doors, without opening the town's own bulletin text.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { postingsWithoutCard } from "../src/lib/bulletin-doors.mjs";
import { bulletinCards, bulletinPostings } from "../src/lib/bulletin-cards.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURE = JSON.parse(readFileSync(join(ROOT, "test", "fixtures", "bulletin-doors.json"), "utf8"));

test("the postings without a card are the carried ones the wall does not hang, newest first", () => {
  assert.deepEqual(postingsWithoutCard(FIXTURE).map((p) => p.slug), [
    "fixture-party-new",             // 2026-10-31
    "fixture-party-mid",             // 2026-10-10, the date carries a hand note; file order puts it before the next
    "fixture-party-same-day-a",      // 2026-10-10 as well, after it in the file
    "fixture-party-old",             // 2026-07-14
    "fixture-party-undated",         // no day: after every dated one
  ]);
});

test("the Daily is never a door, and no wall card is listed twice", () => {
  const doors = postingsWithoutCard(FIXTURE).map((p) => p.slug);
  assert.equal(doors.includes("ferrys-daily"), false);
  const cards = bulletinCards(FIXTURE).map((p) => p.slug);
  assert.deepEqual(doors.filter((s) => cards.includes(s)), []);
});

test("cards and doors together are every carried posting, with none missing and none doubled", () => {
  const carried = bulletinPostings(FIXTURE).map((p) => p.slug).sort();
  const both = [...bulletinCards(FIXTURE), ...postingsWithoutCard(FIXTURE)].map((p) => p.slug).sort();
  assert.deepEqual(both, carried);
  assert.equal(new Set(both).size, both.length);
});

test("an empty or missing bulletin has no doors", () => {
  assert.deepEqual(postingsWithoutCard([]), []);
  assert.deepEqual(postingsWithoutCard(undefined), []);
});

// ── THE BUILT PAGE (skipped until it is built, as POS-177 rules) ────────────

const builtBulletin = join(ROOT, "dist-town", "bulletin", "index.html");

test("on the built bulletin every carried body has a visible door, and the no-script list covers them all",
  { skip: !existsSync(builtBulletin) }, () => {
  const page = readFileSync(builtBulletin, "utf8");
  const bodies = [...page.matchAll(/<template[^>]*data-note="([^"]+)"/g)].map((m) => m[1]);
  const cards = [...page.matchAll(/data-card="([^"]+)"/g)].map((m) => m[1]);
  const doors = [...page.matchAll(/data-door="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(bodies.length > 0, "the page carries no bodies");
  assert.deepEqual([...cards, ...doors].sort(), [...bodies].sort(), "bodies and doors are not the same set");
  // each door is a real link to the address that opens its body
  for (const slug of doors) {
    assert.match(page, new RegExp(`<a[^>]*href="#${slug}"[^>]*data-note-open="${slug}"[^>]*data-door="${slug}"`), `${slug} has a door that is not a link to #${slug}`);
  }
  // without a script: the notices list names every body's file
  const nojs = [...page.matchAll(/<noscript>([\s\S]*?)<\/noscript>/g)].map((m) => m[1]).find((x) => x.includes("nojs-notices")) ?? "";
  for (const slug of bodies) {
    assert.ok(nojs.includes(`TOWN_BULLETIN/${slug}.md`), `${slug} is not listed for a reader without a script`);
  }
});
