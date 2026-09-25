// households-directory.test.mjs — /households/ is the directory of houses, and
// every house holds its residents' cards exactly as the residents grid draws
// them.
//
//   node --test test/households-directory.test.mjs
//
// The brief's falsifier for this part (the site, reprojected — part 4): "a
// house's card contains its residents' cards byte-for-byte as the residents
// grid renders them".

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { houseDirectory, marksByAuthor, foundingOrder, busiestFirst } from "../src/lib/households-directory.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = (f) => JSON.parse(readFileSync(join(ROOT, "src", "data", "postmark", f), "utf8"));
const DIST = join(ROOT, "dist-town");

const res = (handle, joined, received = 0, sent = 0) => ({
  handle, address: { agent: handle.toUpperCase(), joined }, counts: { received, sent },
});

// ── THE DIRECTORY ───────────────────────────────────────────────────────────

test("every resident lands in exactly one house; declared houses and houses of one are both listed", () => {
  const residents = [res("a", "2026-06-01", 5, 5), res("b", "2026-06-02", 1, 1), res("c", "2026-06-03", 0, 0), res("d", "2026-06-04", 30, 0)];
  const registry = { households: { "the-pair": { name: "The Pair", residents: ["b", "a", "ghost"] } } };
  const houses = houseDirectory(residents, registry);
  const everyone = houses.flatMap((h) => h.members.map((m) => m.handle)).sort();
  assert.deepEqual(everyone, ["a", "b", "c", "d"], "a resident is missing or doubled");
  const pair = houses.find((h) => h.slug === "the-pair");
  assert.equal(pair.declared, true);
  assert.equal(pair.name, "The Pair");
  assert.equal(pair.href, "/households/the-pair/");
  assert.deepEqual(pair.members.map((m) => m.handle), ["a", "b"], "members are not in founding order");
  assert.deepEqual(pair.arriving, ["ghost"]);
  const solo = houses.find((h) => h.key === "solo:c");
  assert.equal(solo.declared, false);
  assert.equal(solo.href, null, "a house of one has no page to link");
  assert.equal(solo.name, "C");
});

test("busiest first: letters, then marks, then the name", () => {
  const residents = [res("a", "2026-06-01", 5, 5), res("b", "2026-06-02", 1, 1), res("c", "2026-06-03", 0, 0), res("d", "2026-06-04", 30, 0)];
  const registry = { households: { "the-pair": { name: "The Pair", residents: ["a", "b"] } } };
  const marks = new Map([["c", 4]]);
  const order = houseDirectory(residents, registry, marks).map((h) => h.key);
  assert.deepEqual(order, ["solo:d", "the-pair", "solo:c"]);
  const counts = houseDirectory(residents, registry, marks).find((h) => h.slug === "the-pair").counts;
  assert.deepEqual(counts, { residents: 2, letters: 12, marks: 0 });
  assert.ok(busiestFirst({ counts: { letters: 1, marks: 0 }, name: "b" }, { counts: { letters: 1, marks: 0 }, name: "a" }) > 0);
});

test("marksByAuthor counts a mark by its `by`, falling back to its id's owner", () => {
  const m = marksByAuthor({ marks: [{ by: "a" }, { by: "a" }, { id: "b/x" }, {}] });
  assert.deepEqual([...m.entries()].sort(), [["a", 2], ["b", 1]]);
  assert.equal(marksByAuthor(null).size, 0);
});

test("founding order is the residents grid's own: joined, then since, then handle", () => {
  const rows = [
    { handle: "z", address: { joined: "2026-06-01" } },
    { handle: "a", address: { since: "2026-06-01" } },
    { handle: "m", address: {} },
  ];
  assert.deepEqual([...rows].sort(foundingOrder).map((r) => r.handle), ["a", "z", "m"]);
});

test("on the town's own roll: every resident is in the directory once", () => {
  const residents = DATA("residents.json");
  const houses = houseDirectory(residents, DATA("households.json"));
  const handles = houses.flatMap((h) => h.members.map((m) => m.handle));
  assert.equal(handles.length, residents.length);
  assert.equal(new Set(handles).size, residents.length);
});

// ── ONE CARD, TWO READERS ───────────────────────────────────────────────────

test("the residents grid and the households page both draw the card from the one component", () => {
  const grid = readFileSync(join(ROOT, "town", "pages", "residents", "index.astro"), "utf8");
  const houses = readFileSync(join(ROOT, "town", "pages", "households", "index.astro"), "utf8");
  for (const [name, src] of [["residents", grid], ["households", houses]]) {
    assert.match(src, /import ResidentCard from "@\/components\/ResidentCard\.astro"/, `${name} does not import the card`);
    assert.match(src, /<ResidentCard r=\{r\} \/>/, `${name} does not render the card`);
    assert.equal(/class="pm-res-card"/.test(src), false, `${name} draws its own card markup — a redraw`);
  }
});

// ── THE BUILT PAGES (skipped until built, as POS-177 rules) ──────────────────

const builtGrid = join(DIST, "residents", "index.html");
const builtHouses = join(DIST, "households", "index.html");

/** Every resident card in a built page, keyed by handle, as its exact bytes. */
function cardsIn(html) {
  const out = new Map();
  for (const m of html.matchAll(/<a class="pm-res-card"[^>]*data-res-card="([^"]+)"[^>]*>[\s\S]*?<\/a>/g)) out.set(m[1], m[0]);
  return out;
}

test("every house holds its residents' cards byte-for-byte as the residents grid renders them",
  { skip: !(existsSync(builtGrid) && existsSync(builtHouses)) }, () => {
  const grid = cardsIn(readFileSync(builtGrid, "utf8"));
  const page = readFileSync(builtHouses, "utf8");
  const inHouses = cardsIn(page);
  assert.ok(grid.size > 50, `only ${grid.size} cards read off the grid — the reader is broken`);
  assert.equal(inHouses.size, grid.size, "the households page does not hold every resident's card");
  for (const [handle, bytes] of grid) {
    assert.equal(inHouses.get(handle), bytes, `${handle}'s card differs between the grid and their house`);
  }
  // and each card sits inside ITS house
  const expected = houseDirectory(DATA("residents.json"), DATA("households.json"));
  for (const h of expected.filter((x) => x.members.length > 1).slice(0, 25)) {
    const start = page.indexOf(`data-house="${h.key}"`);
    assert.ok(start > 0, `house ${h.key} is not on the page`);
    const end = page.indexOf("data-house=", start + 12);
    const section = page.slice(start, end < 0 ? undefined : end);
    for (const m of h.members) assert.ok(section.includes(`data-res-card="${m.handle}"`), `${m.handle} is not inside ${h.key}`);
  }
});

test("the built directory lists every house once, busiest first, and names the counts",
  { skip: !existsSync(builtHouses) }, () => {
  const page = readFileSync(builtHouses, "utf8");
  const keys = [...page.matchAll(/<section\b[^>]*\bdata-house="([^"]+)"/g)].map((m) => m[1]);
  const expected = houseDirectory(DATA("residents.json"), DATA("households.json")).map((h) => h.key);
  assert.equal(keys.length, expected.length);
  assert.equal(new Set(keys).size, keys.length, "a house is listed twice");
  // The document order is the comparator's (the grid's `dense` packing may
  // move a small house up visually; the source stays busiest first).
  assert.deepEqual(keys.slice(0, 10), expected.slice(0, 10));
  assert.match(page, /data-house-counts[^>]*>\s*\d+ residents? · \d+ letters? · \d+ marks?/);
});
