// world-time-travel-bymail.test.mjs — POS-1006: Time travel and the In-town-by-mail button share one bar, and nothing of the old lift or the old open strip is left.
//
// History: Little Bird (2026-11-11) saw the Time travel pill on top of the strip POS-945 put under the map. A first fix lifted the pill above the strip;
// Darko (22:10 EST) ruled the strip itself should not be a blob at the bottom: a button beside Time travel opens the names as a card. The lift is
// superseded and removed, not layered. The rendered interaction (1280 / 1920 / 2556 / 390, hit targets, shots) is on the PR; the card's pure parts are in
// test/world-bymail-panel.test.mjs.
//
//   node --test test/world-time-travel-bymail.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const PAGE = readFileSync(new URL("../town/pages/world.astro", import.meta.url), "utf8");
const built = PAGE.slice(PAGE.indexOf("panel.innerHTML ="), PAGE.indexOf("document.body.appendChild(panel)"));

test("Time travel is unchanged inside a bar, and the button joins that bar: the pill, then the button, one row", () => {
  assert.match(built, /<div class="pm-tt-bar"><button type="button" class="pm-tt-open" aria-expanded="false">/, "the pill is the bar's first child, as before");
  assert.match(built, /Time travel<\/span><\/button><\/div>/);
  assert.match(PAGE, /querySelector\("\.pm-tt-bar"\)[\s\S]{0,900}bar\.appendChild\(button\)/, "the site's button is appended to that bar");
  assert.match(PAGE, /\.pm-tt-bar \{ display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; \}/);
  assert.match(PAGE, /\.pm-tt-bar \{ align-self: flex-end; \}/, "the phone rule moved from the pill to its bar: the same seat");
});

test("the button exists only while the viewer's list holds a name, and the card is closed unless opened", () => {
  assert.match(PAGE, /button\.hidden = n === 0;/);
  assert.match(PAGE, /\.pm-bymail-btn\[hidden\] \{ display: none; \}/);
  assert.match(PAGE, /if \(n === 0\) close\(\);/, "an emptied list closes an open card");
  assert.match(PAGE, /button\.type = "button"; button\.className = "pm-bymail-btn"; button\.hidden = true;/, "hidden until the viewer says there is a name");
});

test("THE OLD DESIGNS FAIL: no lift in place(), and the strip is never shown open under the map", () => {
  const place = PAGE.slice(PAGE.indexOf("function place() {"), PAGE.indexOf("function build() {"));
  assert.doesNotMatch(place, /wv-bymail|clientHeight - sb\.top/, "the pill is seated by the rail and the cluster only; no strip lookup (the lift is removed)");
  assert.doesNotMatch(PAGE, /stripWatched|watchStrip|ResizeObserver\(place\)/);
  // the always-open strip (the viewer's own CSS) is overridden: without this rule the section would be a bottom-docked box again
  assert.match(PAGE, /body \.wv-bymail \{ display: none; \}/);
  const sectionRules = [...PAGE.matchAll(/(body \.wv-bymail(?:\.pm-bymail-open(?::not\(\[hidden\]\))?)?)\s*\{([^}]*)\}/g)].map(([, sel, body]) => [sel, /display:\s*(block|flex)/.test(body)]);
  assert.deepEqual(sectionRules, [["body .wv-bymail", false], ["body .wv-bymail.pm-bymail-open:not([hidden])", true]], "the section itself is a block only as the open card");
});

test("a phone gets the same button beside the pill (approved), and the list-open hide rule is as it was", () => {
  assert.match(PAGE, /@media \(max-width: 720px\) \{\s*body:has\(\.wv-search-results:not\(\[hidden\]\), \.wv-bell-menu:not\(\[hidden\]\)\) #pm-world-auth:not\(\.wa-slotted\),\s*body:has\(\.wv-search-results:not\(\[hidden\]\), \.wv-bell-menu:not\(\[hidden\]\)\) \.pm-tt \{\s*visibility: hidden;/);
  assert.match(PAGE, /const fromTop = !!bar && \(bar as HTMLElement\)\.style\.bottom === "auto";/, "on a phone the card opens below the button, where the controls hang from the top");
});
