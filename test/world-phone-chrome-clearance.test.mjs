// world-phone-chrome-clearance.test.mjs — CORE-54 (Darko 2026-11-20 picks: "1. Buttons cover titles", "4. Small targets"; Wright 13:50:53Z).
//
//   node --test test/world-phone-chrome-clearance.test.mjs
//
// The host half of the phone fixes. On a phone the site's floating buttons (the folded Postmark pill, the Time-travel bar) ride over the World's full-height
// column; the World reserves room in its column when the host says where the floating chrome ends (`--wv-chrome-bottom`, px from the top of the screen).
// This page is the host: it measures its own pill and bar where it places them and publishes that, only when the World has no rail (a phone), and withdraws it
// otherwise. The World half (the column nav's min-height from that variable) is held by postmark-world tools/phone-targets.test.mjs; the real-browser
// 390 px before/after pictures are in the PR report. Also here: the thumb-sized targets this page owns (the Time-travel arrows and its "replay page" link,
// the folded menu's rows).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const WORLD = readFileSync(join(ROOT, "town/pages/world.astro"), "utf8");
const SIGNIN = readFileSync(join(ROOT, "src/components/WorldSignIn.astro"), "utf8");

test("the host publishes where its floating chrome ends, on a phone only, from the pill and the bar it placed", () => {
  assert.match(WORLD, /function publishChrome\(\) \{/);
  // placed, then published: every place() (mount, resize, the world-auth placed event) re-measures
  assert.match(WORLD, /s\.alignItems = "flex-end";\s*\}\s*publishChrome\(\);\s*\}/);
  // a rail (desktop) means nothing floats over the column: the variable is withdrawn, the World is unchanged
  assert.match(WORLD, /if \(!panel \|\| \(nav && nav\.getClientRects\(\)\.length\)\) \{ root\.style\.removeProperty\("--wv-chrome-bottom"\); return; \}/);
  // the lower of the folded pill and the Time-travel bar, plus air
  assert.match(WORLD, /\["#pm-world-auth \[data-wa-menu\]", "\.pm-tt-bar"\]\.forEach/);
  assert.match(WORLD, /root\.style\.setProperty\("--wv-chrome-bottom", Math\.ceil\(low \+ 8\) \+ "px"\)/);
});

test("the targets this page owns reach a thumb: the Time-travel arrows 44 px, the 'replay page' link a 44 px press target without moving a word, the folded menu's rows 44 px", () => {
  assert.match(WORLD, /@media \(max-width: 720px\), \(pointer: coarse\) \{\s*\.pm-tt-arrow \{ width: 2\.75rem; height: 2\.75rem; \}\s*\.pm-tt-fine a \{ position: relative; \}\s*\.pm-tt-fine a::after \{ content: ""; position: absolute; inset: -17px -8px; \}/);
  assert.match(SIGNIN, /\.wa-open:not\(\.wa-slotted\) \.wa-list \.wa-btn \{ min-height: 44px; display: flex; align-items: center; box-sizing: border-box; \}/);
  // the gold sign-in row stays centred (a flex row would have left-aligned it)
  assert.match(SIGNIN, /\[data-wa-signin\],\s*\.wa-open:not\(\.wa-slotted\) \.wa-list \[data-wa-signout\] \{ justify-content: center; \}/);
});
