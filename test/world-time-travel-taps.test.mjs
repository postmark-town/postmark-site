// world-time-travel-taps.test.mjs — WLD-49: Time travel's box passes taps to the
// map; only what it holds takes them.
//
// The bug: on a phone place() pins .pm-tt left AND right, so the fixed box is
// as wide as its max-width while the pill sits at one end. Measured on prod
// (release/2026-w42.1) at 390 and 360: a 320×29 box round a 118×29 pill, and 8
// of 8 taps across the 202 px beside the pill hit the box, not the map. A desk
// with the panel open had the same kind of strip beside the pill (188×29).
//
// This suite has no browser, so this file pins the rule. The tap proof is
// elementFromPoint across the strip, before and after, at 390 and 360 and on a
// desk with the panel open (docs/2026-10-13/rail/WLD-48-49/).

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const PAGE = readFileSync(new URL("../town/pages/world.astro", import.meta.url), "utf8");
const ruleOf = (selector) => {
  const at = PAGE.search(new RegExp(`\\n\\s*${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{`));
  assert.ok(at >= 0, `the page has a ${selector} rule`);
  return PAGE.slice(at, PAGE.indexOf("}", at) + 1);
};

test("the Time travel box passes taps through, at every width", () => {
  const box = ruleOf(".pm-tt");
  assert.match(box, /position: fixed;/, "this is the box place() moves");
  assert.match(box, /pointer-events: none;/, "the box's empty part is not a control");
  // ⚑ THE FLIP: drop `pointer-events: none;` from .pm-tt → this line reds.
});

test("what the box holds takes its taps: the pill, and the open body", () => {
  assert.match(ruleOf(".pm-tt > *"), /pointer-events: auto;/, "every child of the box answers taps again");
  // the box's two children are the pill and the body (build()); nothing else is
  // put in it, so `> *` names exactly them
  const built = PAGE.slice(PAGE.indexOf("panel.innerHTML ="), PAGE.indexOf("document.body.appendChild(panel)"));
  assert.match(built, /class="pm-tt-open"/);
  assert.match(built, /class="pm-tt-body" hidden/);
  assert.doesNotMatch(PAGE, /\.pm-tt-(open|body)[^{]*\{[^}]*pointer-events: none/, "and nothing turns them off again");
});
