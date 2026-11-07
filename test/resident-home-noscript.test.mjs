// resident-home-noscript.test.mjs — "⌂ Visit home" works with the script off
// (POS-855: a cold walk found the Home read `hidden` until the card script opens
// it, so a no-script reader, or a fresh load of /residents/<h>/#home, saw nothing).
//
//   node --test test/resident-home-noscript.test.mjs
//
// Pinned at the source of town/components/Household.astro: a render needs the
// residents' data, which a test does not read. The fix is two things that must
// stay together: the Home read carries the id the link points at, and a :target
// rule shows it, but only where there is no script (so a page with script is as
// it was: the script's closeAll sets `hidden` while the hash stays #home, and a
// bare :target rule would hold the read open).

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PAGE = readFileSync(join(ROOT, "town", "components", "Household.astro"), "utf8");

test("the link points at #home and the Home read (the one a home has) carries that id, once", () => {
  assert.match(PAGE, /<a class="pm-btn ghost" href="#home">⌂ Visit home<\/a>/);
  const ids = PAGE.match(/<section class="bcard-detail" id=\{t\.isActive \? "home" : undefined\} data-card-detail="home" hidden>/g) || [];
  assert.equal(ids.length, 1, "exactly one Home read (the founded home's) takes the id");
  // the unfounded home's founding form is not what "Visit home" visits: it takes no id
  assert.equal((PAGE.match(/id=\{t\.isActive \? "home" : undefined\}/g) || []).length, 1);
});

test("a :target rule shows the hidden Home read, only inside (scripting: none)", () => {
  const m = PAGE.match(/@media \(scripting: none\) \{\s*([^}]*\})\s*\}/);
  assert.ok(m, "no (scripting: none) block");
  assert.match(m[1], /\.bcard-detail\[data-card-detail="home"\]\[hidden\]:target\s*\{\s*display:\s*block;?\s*\}/);
  // the same rule must not exist outside the media query, or script-on pages change
  const outside = PAGE.replace(m[0], "");
  assert.equal(/\[data-card-detail="home"\][^{]*:target/.test(outside), false, "a bare :target rule would hold the read open when a script closes it");
});

test("the script still owns open and close: closeAll hides, openCard shows", () => {
  assert.match(PAGE, /details\.forEach\(function \(d\) \{ d\.hidden = true; \}\);/);
  assert.match(PAGE, /if \(detail\) detail\.hidden = false;/);
  assert.match(PAGE, /var hash = \(location\.hash \|\| ""\)\.replace\("#", ""\);\s*if \(hash\) \{\s*go\(hash, false\);/);
});
