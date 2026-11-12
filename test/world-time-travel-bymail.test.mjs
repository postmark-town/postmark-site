// world-time-travel-bymail.test.mjs — POS-1006: the Time travel pill rests clear of the "In town by mail" strip.
//
// Little Bird, Core Team, 2026-11-11: "I saw the time travel button on top of the list of people". POS-945 put a strip of residents the town has
// no position for along the bottom of the painting (the viewer's `.wv-bymail`). With the telling hidden, that strip starts at the rail's edge,
// exactly where place() seats the pill (rail edge + 14, bottom 14), so the pill sat on the strip's first names. Measured in a real browser on the
// built /world/ with the viewer that has the strip (S165), invented residents, 1280 / 1920 / 2556 wide, telling hidden: the pill's box overlapped
// the strip's and covered 1 to 2 names, and at 2556 the first name's topmost element was the pill.
//
// The fix is place()'s: when the strip is showing and shares the pill's columns, the pill is lifted to rest just above it. THIS FILE RUNS THE REAL
// place() (cut out of world.astro, not re-spelled) over a stand-in page whose boxes are the measured ones, and hit-tests the result: every name in
// the strip's visible row and every point of the pill. The old placement is the falsifier: the same stand-in with no strip lookup (what place() did
// before) reproduces the overlap.
//
// No browser runs in this suite; the rendered before/after shots with real hit targets are on the PR.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const PAGE = readFileSync(new URL("../town/pages/world.astro", import.meta.url), "utf8");

/** The text of `function <name>() { … }` as it stands in the page's script (brace-matched). */
function functionText(name) {
  const at = PAGE.indexOf(`function ${name}(`);
  assert.ok(at >= 0, `the page's script has function ${name}()`);
  let depth = 0, i = PAGE.indexOf("{", at);
  const start = i;
  for (; i < PAGE.length; i++) {
    if (PAGE[i] === "{") depth++;
    else if (PAGE[i] === "}" && --depth === 0) break;
  }
  return PAGE.slice(at, i + 1).replace(/^function \w+\(\)/, "function ()");
}
const PLACE = functionText("place");

const rect = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height });
const PILL = { width: 122, height: 29 };           // the built pill, measured at 1280 on the built page
const RAIL = 212;                                   // the viewer's rail (--rail), the nav's right edge
const STRIP_H = { 1280: 120, 1920: 104, 2556: 82 }; // the strip's measured heights (a long list scrolls inside its 7.5rem cap)

/** One stand-in page: the viewport, the rail, and the strip (left edge by telling state), as place() asks for them. */
function stage({ w, h, telling, strip = true, hidden = false, phone = false }) {
  const stripBox = strip ? rect(telling ? 740 : RAIL, h - STRIP_H[w], w - (telling ? 740 : RAIL), STRIP_H[w]) : null;
  const navBox = phone ? null : rect(0, 0, RAIL, h);
  const style = {};
  const panel = {
    style,
    getBoundingClientRect() {
      const left = parseFloat(style.left) || 0;
      const bottom = style.bottom === "auto" || style.bottom == null ? null : parseFloat(style.bottom);
      const top = bottom == null ? (parseFloat(style.top) || 0) : h - bottom - PILL.height;
      return rect(left, top, PILL.width, PILL.height);
    },
  };
  const els = {
    ".wv-nav": navBox && { getClientRects: () => [navBox], getBoundingClientRect: () => navBox },
    ".wv-bymail": stripBox && { hidden, getClientRects: () => (hidden ? [] : [stripBox]), getBoundingClientRect: () => stripBox },
  };
  const document = {
    documentElement: { clientHeight: h },
    querySelector: (sel) => els[sel] ?? null,
    getElementById: () => null,
  };
  return { document, panel, stripBox, h };
}
const runPlace = ({ document, panel }, text = PLACE) => new Function("document", "panel", `return (${text})();`)(document, panel);

/** The strip's visible names: the viewer's .wv-bymail-list wraps names left to right in rows (150px wide, 14px apart, 21px a row) under the heading, to the strip's bottom. */
function names(stripBox) {
  const out = [];
  for (let y = stripBox.top + 26; y + 18 <= stripBox.bottom; y += 21)
    for (let x = stripBox.left + 12; x + 150 <= stripBox.right - 12; x += 164) out.push(rect(x, y, 150, 18));
  return out;
}
const overlaps = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

/** Place the pill, then say which of the strip's names it covers (hit-testing by geometry), and whether the pill is whole inside the window. */
function measure(opts, text) {
  const s = stage(opts);
  runPlace(s, text);
  const pill = s.panel.getBoundingClientRect();
  const covered = s.stripBox ? names(s.stripBox).filter((n) => overlaps(pill, n)) : [];
  return { pill, covered, boxOverlap: s.stripBox ? overlaps(pill, s.stripBox) : false, inView: pill.left >= 0 && pill.top >= 0 && pill.right <= opts.w && pill.bottom <= opts.h, s };
}

// the old placement, for the falsifier: the same place() with the strip lookup taken out
const OLD_PLACE = PLACE.replace(/var strip = document\.querySelector\("\.wv-bymail"\);[\s\S]*?\n        \}\n/, "");

for (const [w, h] of [[1280, 800], [1920, 1080], [2556, 1200]]) {
  test(`${w} wide, telling hidden (the strip starts at the rail): the pill rests clear of every name and is whole`, () => {
    const now = measure({ w, h, telling: false }, PLACE);
    assert.deepEqual(now.covered, [], "no name in the strip is covered");
    assert.equal(now.boxOverlap, false, "the pill's box does not touch the strip's");
    assert.equal(now.inView, true, "and the pill is fully inside the window");
    assert.ok(now.pill.bottom <= now.s.stripBox.top, `rests above the strip (pill bottom ${now.pill.bottom}, strip top ${now.s.stripBox.top})`);
    assert.ok(now.s.stripBox.top - now.pill.bottom <= 24, "close to it, not stranded across the map");
  });

  test(`${w} wide: THE FALSIFIER, the old placement (no strip lookup) covers the names, so the check can fail`, () => {
    assert.ok(OLD_PLACE.length < PLACE.length && !/wv-bymail/.test(OLD_PLACE), "the old placement is place() without the strip lookup");
    const old = measure({ w, h, telling: false }, OLD_PLACE);
    assert.equal(old.boxOverlap, true, "the pill's box lay on the strip's");
    assert.ok(old.covered.length >= 1, `the old placement covered ${old.covered.length} name(s)`);
  });

  test(`${w} wide, telling shown (the strip starts at the telling's edge): the pill keeps its old seat, nothing moves`, () => {
    const now = measure({ w, h, telling: true }, PLACE);
    assert.equal(now.s.panel.style.bottom, "14px", "no shared columns, no lift");
    assert.deepEqual(now.covered, []); assert.equal(now.boxOverlap, false);
  });
}

test("no strip, a hidden strip, or a strip that is gone: the pill sits where it always sat (bottom 14px)", () => {
  for (const o of [{ strip: false }, { strip: true, hidden: true }]) {
    const s = stage({ w: 1280, h: 800, telling: false, ...o });
    runPlace(s);
    assert.equal(s.panel.style.bottom, "14px", JSON.stringify(o));
  }
  // and it comes back down when the strip goes: place() is run again by the strip's ResizeObserver
  const s = stage({ w: 1280, h: 800, telling: false });
  runPlace(s); assert.notEqual(s.panel.style.bottom, "14px");
  s.document.querySelector(".wv-bymail").hidden = true; s.document.querySelector(".wv-bymail").getClientRects = () => [];
  runPlace(s); assert.equal(s.panel.style.bottom, "14px", "back at its seat");
});

test("a phone is untouched: with no rail the pill hangs from the top as before, strip or no strip", () => {
  const a = stage({ w: 1280, h: 800, telling: false, phone: true }); runPlace(a);
  const b = stage({ w: 1280, h: 800, telling: false, phone: true, strip: false }); runPlace(b);
  assert.deepEqual(a.panel.style, b.panel.style, "the phone branch never looks at the strip");
  assert.equal(a.panel.style.bottom, "auto");
  assert.match(PAGE, /@media \(max-width: 720px\) \{\s*body:has\(\.wv-search-results:not\(\[hidden\]\), \.wv-bell-menu:not\(\[hidden\]\)\) #pm-world-auth:not\(\.wa-slotted\),\s*body:has\(\.wv-search-results:not\(\[hidden\]\), \.wv-bell-menu:not\(\[hidden\]\)\) \.pm-tt \{\s*visibility: hidden;/, "the phone list-open hide rule is as it was");
});

test("the strip is watched, not assumed: a ResizeObserver on the viewer's strip re-places the pill, and the page looks for the strip until it arrives", () => {
  const watch = functionText("watchStrip");
  assert.match(watch, /new ResizeObserver\(place\)\.observe\(strip\)/);
  assert.match(PAGE, /setInterval\(function \(\) \{ watchStrip\(\); if \(stripWatched \|\| \+\+looks > 80\) clearInterval\(lookTimer\); \}, 250\)/, "the viewer builds its shell after this runs");
});
