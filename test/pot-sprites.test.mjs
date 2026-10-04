// pot-sprites.test.mjs — each pot wears a little pixel sprite (Keemin,
// 2026-10-02: "little pixel art sprites for each pot? to make them cute …
// like my DARKO token in pixel art for the cyan eyes, the meeplings for the
// town box, and ferry's sprite for the meeps").
//
//   node --test test/pot-sprites.test.mjs
//
// The map is civic-art.mjs § POT_SPRITES; the drawing is PotSprite.astro. The
// built-page half skips until `npm run build` has written dist-town/.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { SPRITES, POT_SPRITES, DARKO_EYE, potSprite, paint, checkAllSprites } from "../src/lib/civic-art.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist-town");
const built = (pot) => join(DIST, "fund", pot, "index.html");

// The three pots open on 2026-10-02 and the drawing each one asked for.
const ASKED = { "darko-fund": "darko", "keeping-ec2": "meeplings", "meeps-fund": "postmaster" };

test("every sprite is still a well-formed map, DARKO among them", () => {
  assert.ok(SPRITES.darko, "DARKO is not drawn");
  assert.deepEqual(checkAllSprites(), {});
});

test("each open pot maps to the sprite it asked for, and that sprite paints", () => {
  for (const [pot, name] of Object.entries(ASKED)) {
    assert.equal(POT_SPRITES[pot], name, `${pot} wears "${POT_SPRITES[pot]}", not ${name}`);
    assert.ok(SPRITES[name], `${pot} maps to "${name}", which is not drawn`);
    assert.deepEqual(potSprite(pot), paint(name));
  }
  // every line in the map names a drawing (a typo would ship a pot with a hole)
  for (const [pot, name] of Object.entries(POT_SPRITES)) assert.ok(SPRITES[name], `${pot} → "${name}" is not drawn`);
});

test("a pot with no line in the map wears no sprite, and nothing throws", () => {
  assert.equal(potSprite("a-pot-nobody-drew"), null);
  assert.equal(potSprite(undefined), null);
  // an inherited key is not a line in the map
  assert.equal(potSprite("constructor"), null);
  // the component draws only what potSprite answers: one guard, no fallback art
  const component = readFileSync(join(ROOT, "src", "components", "PotSprite.astro"), "utf8");
  assert.match(component, /\{rects && \(/);
});

test("DARKO's eyes are the token's cyan, and they are painted", () => {
  const fills = new Set(paint("darko").map((r) => r.fill));
  assert.ok(fills.has(DARKO_EYE), "the eyes are not drawn in the token's cyan");
});

// Keemin, 2026-10-04: "just my base avatar of just the black circle with cyan
// eyes instead of the dressed one with the hat". The DARKO fund wears the base
// token: a disc of night ink with the eyes in it, and nothing else on it.
test("darko-fund wears the base token: a black circle and cyan eyes, no cap, hood or jacket", () => {
  const rows = SPRITES[POT_SPRITES["darko-fund"]];
  const inks = new Set(rows.join("").replace(/\./g, ""));
  // only the night ink, the eyes' two cyans and the catchlight's paper
  assert.deepEqual([...inks].sort(), ["C", "c", "k", "p"], `inks ${[...inks].sort().join("")}`);
  // a round disc: every row is one unbroken run, symmetric about the middle
  for (const [i, r] of rows.entries()) {
    assert.match(r, /^\.*[^.]+\.*$/, `row ${i} is not one run`);
    assert.equal(r.match(/^\.*/)[0].length, r.match(/\.*$/)[0].length, `row ${i} is lopsided`);
  }
  assert.ok(rows[0].includes("k") && rows[23].includes("k"), "the disc does not fill the frame top to bottom");
});

test("the sprite rides the cards, the pot's heading and its tabs, hidden from readers", () => {
  const cards = readFileSync(join(ROOT, "src", "components", "PotCards.astro"), "utf8");
  const page = readFileSync(join(ROOT, "town", "pages", "fund", "[pot].astro"), "utf8");
  assert.match(cards, /<PotSprite pot=\{p\.pot\} size=\{48\} \/>/);
  assert.match(page, /<PotSprite pot=\{pot\.pot\} size=\{72\} \/>/);
  assert.match(page, /<PotSprite pot=\{t\.pot\} size=\{24\} \/>/);
  const component = readFileSync(join(ROOT, "src", "components", "PotSprite.astro"), "utf8");
  assert.match(component, /aria-hidden="true"/);
  assert.match(component, /shape-rendering="crispEdges"/);
});

test("the built pot pages wear their sprites (after a build)", { skip: !existsSync(DIST) && "no dist-town" }, () => {
  for (const pot of Object.keys(ASKED)) {
    if (!existsSync(built(pot))) continue; // a pot the build's snapshot does not hold
    const html = readFileSync(built(pot), "utf8");
    const sprites = html.match(/<svg[^>]*class="pot-sprite[^"]*"[^>]*>/g) ?? [];
    // the heading's own, plus one on each open pot's tab
    assert.ok(sprites.length >= 2, `${pot}: ${sprites.length} sprites on its page`);
    for (const s of sprites) assert.match(s, /aria-hidden="true"/);
    assert.match(html, /<svg[^>]*class="pot-sprite[^"]*"[^>]*width="72"/, `${pot}: no 72px heading sprite`);
  }
});
