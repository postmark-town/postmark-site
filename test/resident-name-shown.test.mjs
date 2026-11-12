// resident-name-shown.test.mjs — POS-1005: the directory SHOWS at most 48 reader-characters of a resident's name, then "…"; the name itself is never cut.
//
//   node --test test/resident-name-shown.test.mjs
//
// Display only: the card's search string (residentKey), its link and the resident's own page keep the whole name, and the shared residents-meta is not touched.
// THE FLIPS: a UTF-16 or code-point cutter (it splits a family emoji or an accented letter), the card not calling shownName (the long name stretches the card),
// the own page or the search string using the shortened name.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { shownName, NAME_SHOWN } from "../src/lib/resident-name.mjs";
import { residentKey } from "../src/lib/households-directory.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = (p) => readFileSync(join(ROOT, p), "utf8");
const FAMILY = "\u{1F468}‍\u{1F469}‍\u{1F467}‍\u{1F466}";   // one reader-character, 11 UTF-16 units
const ACCENTED = "é";                                                  // one reader-character, two code points
const LEGACY = "The Long-Named Invented Assistant of the Far Lantern Houses";  // 59 characters, on file before the rule
const count = (t) => [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(t)].length;

test("a name of 48 reader-characters or fewer is shown whole; the limit is the town's own 48", () => {
  assert.equal(NAME_SHOWN, 48);
  assert.equal(shownName("Short"), "Short");
  assert.equal(shownName("x".repeat(48)), "x".repeat(48));
  assert.equal(shownName(FAMILY.repeat(48)), FAMILY.repeat(48), "48 family emoji are 528 UTF-16 units and still 48 characters: not cut");
  assert.equal(shownName(ACCENTED.repeat(48)), ACCENTED.repeat(48), "a code-point cutter would see 96");
  assert.equal(shownName(""), ""); assert.equal(shownName(null), ""); assert.equal(shownName(undefined), "");
});

test("a longer name is cut at 48 whole reader-characters and ends in an ellipsis", () => {
  const shown = shownName(LEGACY);
  assert.equal(shown, LEGACY.slice(0, 48) + "…");
  assert.equal(count(shown), 49, "48 characters and the ellipsis");
  assert.equal(shownName("x".repeat(49)), "x".repeat(48) + "…");
  const fam = shownName(FAMILY.repeat(60));
  assert.equal(fam, FAMILY.repeat(48) + "…", "never inside a family emoji");
  const acc = shownName(ACCENTED.repeat(60));
  assert.equal(acc, ACCENTED.repeat(48) + "…", "never between a letter and its accent");
});

test("a cut that lands after a space does not leave the ellipsis hanging off it", () => {
  const name = "a".repeat(47) + " b long";
  assert.equal(shownName(name), "a".repeat(47) + "…");
});

test("DISPLAY ONLY: the name is never changed: the search string and the own page keep it whole", () => {
  const r = { handle: "inv-lantern", address: { agent: LEGACY } };
  assert.ok(residentKey(r).includes(LEGACY.toLowerCase().split(" ").at(-1)), "the search string still holds the end of the name");
  assert.ok(residentKey(r).includes("far lantern houses"), "a search for the tail of a long name still finds the resident");
  const card = src("src/components/ResidentCard.astro");
  assert.match(card, /<b>\{shownName\(r\.address\?\.agent \?\? r\.handle\)\}<\/b>/, "the directory card shows the shortened name");
  assert.match(card, /data-search=\{residentKey\(r\)\}/, "and searches on the whole one");
  assert.match(card, /href=\{`\/residents\/\$\{r\.handle\}\/`\}/, "and links by the handle");
  assert.doesNotMatch(src("town/pages/residents/[handle].astro"), /shownName|resident-name/, "the resident's own page prints the name whole");
  assert.doesNotMatch(src("src/lib/households-directory.mjs"), /shownName/, "the directory's data is not shortened");
});

test("nothing else is shortened: the World map keeps its own elision, by-mail is untouched, residents-meta is not cut", () => {
  for (const p of ["town/pages/world.astro", "src/lib/world-bymail-panel.mjs"])
    assert.doesNotMatch(src(p), /shownName|resident-name\.mjs/, `${p} does not use the directory's shortener`);
});
