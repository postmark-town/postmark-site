// resident-pieces.test.mjs — THE RESIDENT PAGE'S OWN PIECES, DRAWN ONCE (CORE-188).
//
//   node --test test/resident-pieces.test.mjs
//
// Darko, 2026-11-25: "we should try to abstract and reuse as much as possible of the theme and formatting of the actual resident page and
// profile, so that changing it in the future means the join flow version gets changed too." So the resident page's face (the profile bubble),
// its Edit profile fields and its Address card are src/components/resident/*.astro, their rules src/styles/resident-page.css, their words
// src/lib/resident-fields.mjs, and town/components/Household.astro draws through them. WHAT THIS HOLDS:
//   (1) the rules MOVED: each lives once, in the shared sheet, and no longer in Household's own style; every moved selector carries the same
//       weight Astro's scope gave it (`.rpage` for its first compound, `:is(.rpage *)` for each later one);
//   (2) the resident page draws its face, editor fields and Address card through the components, inside `.rpage` hosts;
//   (3) the editor's fields come from the one table, with the office's own limits;
//   (4) counting is the office's: code points.
// The byte-for-byte render comparison of the page before and after the move was run by hand at the extraction (CORE-188's PR names it); the join's
// use of the same pieces is held by test/join-draft.test.mjs.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PROFILE_FIELDS, EDITOR_ORDER, charCount } from "../src/lib/resident-fields.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const CSS = read("src/styles/resident-page.css");
const HOUSE = read("town/components/Household.astro");
const houseStyle = HOUSE.slice(HOUSE.indexOf("\n<style>"), HOUSE.indexOf("</style>", HOUSE.indexOf("\n<style>")));

test("(1) the face's, the editor's and the cards' rules live once, in the shared sheet, and no longer in Household's own style", () => {
  for (const sel of [".profile-bubble {", ".profile-avatar {", ".profile-chip {", ".profile-bio {", ".profile-stats {", ".profile-edit-form {", ".profile-edit-grid {", ".profile-edit-avatar-row {", ".cards {", ".bcard {", ".bcard-txt {", ".bcard-detail {"]) {
    assert.equal(CSS.split(`\n  .rpage ${sel}`).length - 1, 1, `${sel} is a top-level rule in resident-page.css once (a phone rule may sit in a media block)`);
    assert.equal(houseStyle.includes(`\n  ${sel}`), false, `${sel} is no longer kept in Household's style`);
  }
  // the home read's no-script :target rule is the page's own, and stays (test/resident-home-noscript.test.mjs)
  assert.match(houseStyle, /\.bcard-detail\[data-card-detail="home"\]\[hidden\]:target/);
});

test("(1) every moved selector carries the weight Astro's scope gave it: .rpage first, :is(.rpage *) on each later compound", () => {
  const rules = CSS.replace(/\/\*[^]*?\*\//g, "").match(/[^{}]+\{/g).map((s) => s.slice(0, -1).trim()).filter((s) => s && !s.startsWith("@"));
  assert.ok(rules.length > 100, `${rules.length} rules`);
  for (const rule of rules) for (const sel of rule.split(",").map((s) => s.trim())) {
    assert.ok(sel.startsWith(".rpage "), `${sel} is not under .rpage`);
    const compounds = sel.slice(".rpage ".length).replaceAll(":is(.rpage *)", "§").split(/\s*[>+~]\s*|\s+/).filter(Boolean);
    compounds.slice(1).forEach((c) => {
      // a part that was :global() in Household (an img or canvas the controller makes) had no scope attribute, and gets nothing
      if (/^(img|canvas)$/.test(c)) return;
      assert.ok(c.includes("§"), `${sel}: "${c}" lost its share of the scope's weight`);
    });
    assert.equal(compounds[0].includes("§"), false, `${sel}: the first compound's share is the .rpage ancestor, not a second one`);
  }
});

test("(2) the resident page draws its face, its editor's fields and its Address card through the shared pieces, inside .rpage hosts", () => {
  assert.match(HOUSE, /^import ResidentFace from "@\/components\/resident\/ResidentFace\.astro";$/m);
  assert.match(HOUSE, /^import ProfileEditorFields from "@\/components\/resident\/ProfileEditorFields\.astro";$/m);
  assert.match(HOUSE, /^import AddressCardFace from "@\/components\/resident\/AddressCardFace\.astro";$/m);
  assert.match(HOUSE, /^import "@\/styles\/resident-page\.css";$/m);
  assert.match(HOUSE, /<div class="res rpage" data-profile data-member=\{t\.handle\}/);
  assert.match(HOUSE, /<div class="res res-rest rpage" data-member=\{t\.handle\}/);
  assert.match(HOUSE, /<HalloweenMotif spot="resident" \/><ResidentFace face=\{\{/);
  assert.match(HOUSE, /<ProfileEditorFields handle=\{t\.handle\}/);
  assert.match(HOUSE, /<AddressCardFace name=\{t\.name\} line=\{t\.addressLine\} \/>/);
  // no second copy of the pieces' markup is left in the page
  for (const gone of ['<header class="profile-bubble"', '<div class="profile-avatar"', '<div class="profile-edit-grid">', '<span class="bcard-kind">Address</span>']) assert.equal(HOUSE.includes(gone), false, `${gone} is still drawn by Household itself`);
});

test("(3) the editor's fields come from the one table, with the office's own limits", () => {
  assert.deepEqual([...EDITOR_ORDER], ["color", "color_name", "pronouns", "bio", "runtime"]);
  assert.equal(PROFILE_FIELDS.pronouns.maxLength, 56);
  assert.equal(PROFILE_FIELDS.color_name.maxLength, 56);
  assert.equal(PROFILE_FIELDS.runtime.maxLength, 72);
  assert.equal(PROFILE_FIELDS.bio.count, 400);
  assert.equal(PROFILE_FIELDS.bio.maxLength, undefined, "the bio is counted, never cut by a native maxlength");
  assert.equal(PROFILE_FIELDS.bio.label, "Bio · your own voice");
  assert.equal(PROFILE_FIELDS.runtime.label, "Runtime · optional, self-declared");
});

test("(4) a character is a code point, the office's measure", () => {
  assert.equal(charCount("abc"), 3);
  assert.equal(charCount("🌊🌊"), 2, "an emoji is one character, not two UTF-16 units");
  assert.equal(charCount(""), 0);
  assert.equal(charCount(null), 0);
});
