// quest-standings.test.mjs — the Quest Guild's standings rows, one component
// drawn twice: the Town page's eight-row preview and /town/quests/, the full
// board (#3514). And the phone row that places all five of its children (#3515).
//
//   node --test test/quest-standings.test.mjs
//
// #3515 (Lyra, wayward-archivist, diagnosed 10-15): under 720px the row dropped
// to three tracks and auto-placed five children, so the fourth ("be reached
// 2/5", `white-space: nowrap`) landed in the ~24px rank column and ran into the
// ✦ beside it. The fix is a modifier on the standings row only, with a named
// grid area for every child and the two quest fields free to wrap. These are
// source reads, because `npm test` runs without a build; the rendered proof
// at 375 and 1280 is qa-shots/quest-standings-shots.mjs.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const component = read("src/components/QuestStandings.astro");
const hub = read("town/pages/town/index.astro");
const full = read("town/pages/town/quests/index.astro");

const style = component.slice(component.indexOf("<style>"), component.indexOf("</style>"));
const markup = component.slice(component.indexOf("---", 3) + 3, component.indexOf("<style>"));
const mobileAt = style.indexOf("@media (max-width: 720px)");
const desktop = style.slice(0, mobileAt);
const mobile = style.slice(mobileAt);

// the declarations of one rule inside the mobile block, by its exact selector
const rule = (selector) => {
  const at = mobile.indexOf(`${selector} {`);
  return at < 0 ? null : mobile.slice(at, mobile.indexOf("}", at));
};

const CHILDREN = [
  ["q-rank", "rank"],
  ["q-who", "who"],
  ["q-out", "out"],
  ["q-in", "in"],
  ["q-all", "all"],
];

test("every standings row wears the modifier, and the row has the five children it places", () => {
  assert.match(markup, /<li class="q-row q-row--standing">/,
    "the standings row lost `q-row--standing`, so the phone placement no longer applies to it");
  for (const [cls] of CHILDREN) {
    assert.match(markup, new RegExp(`class="[^"]*\\b${cls}\\b`), `the row lost its ${cls} child`);
  }
  assert.equal((markup.match(/<li\b/g) ?? []).length, 1, "one row template");
});

test("under 720px the modifier names an area for all five children (#3515)", () => {
  assert.ok(mobileAt > 0, "the component has no 720px block");
  const row = rule(".q-row--standing");
  assert.ok(row, "the 720px block has no `.q-row--standing` rule: the five children are auto-placed again");
  const areas = /grid-template-areas:\s*((?:"[^"]*"\s*)+);/.exec(row);
  assert.ok(areas, "the modifier declares no grid-template-areas");
  const named = new Set(areas[1].match(/"[^"]*"/g).join(" ").replace(/"/g, "").split(/\s+/).filter((a) => a && a !== "."));
  for (const [cls, area] of CHILDREN) {
    assert.ok(named.has(area), `the template has no "${area}" area`);
    const placed = rule(`.q-row--standing .${cls}`);
    assert.ok(placed && new RegExp(`grid-area:\\s*${area};`).test(placed),
      `.${cls} is not placed in "${area}": it falls back to auto-placement, which is the overlap`);
  }
  // each row of the template has as many cells as the columns it declares
  const cols = /grid-template-columns:\s*([^;]+);/.exec(row)[1].trim().split(/\s+(?![^(]*\))/).length;
  for (const line of areas[1].match(/"[^"]*"/g)) {
    assert.equal(line.replace(/"/g, "").trim().split(/\s+/).length, cols, `area row ${line} does not span ${cols} columns`);
  }
});

test("under 720px the two quest fields wrap inside their own areas, and only under the modifier", () => {
  const pair = rule(".q-row--standing .q-pair");
  assert.ok(pair && /white-space:\s*normal;/.test(pair),
    "`.q-pair` keeps `nowrap` on the phone row, so a narrow cell still runs into its neighbour");
  // the track the quests sit in can shrink below their text, so the text wraps rather than widening it
  assert.match(rule(".q-row--standing"), /grid-template-columns:[^;]*minmax\(0, 1fr\)/);
});

test("desktop places nothing: the five-column row is the one it was", () => {
  assert.match(desktop, /grid-template-columns: 2em minmax\(8em, 1fr\) auto auto 4em;/,
    "the desktop row's columns changed");
  assert.equal(/grid-area|grid-template-areas|q-row--standing/.test(desktop), false,
    "a placement leaked out of the 720px block into the desktop row");
  assert.match(desktop, /\.q-pair \{[^}]*white-space: nowrap;/, "desktop pairs stay on one line");
});

test("the dashboards keep their own rows: the modifier is the standings' only", () => {
  // The Town page's two dashboards reuse `.q-stand`/`.q-row` with other
  // children (`.d-row`). The phone placement names the standings' five, so it
  // must not reach them.
  assert.equal(hub.includes("q-row--standing"), false, "the Town page put the standings modifier on a dashboard row");
  assert.ok(/<li class="q-row d-row">/.test(hub), "the dashboards' rows moved; re-check what this test protects");
});

test("one component, two renders: the preview gets the head, the full board gets every row (#3514)", () => {
  assert.match(hub, /<QuestStandings rows=\{quests\.rows\} \/>/, "the Town page's preview is not the component's capped rows");
  assert.match(full, /<QuestStandings rows=\{quests\.allRows\} \/>/, "/town/quests/ does not render every row");
  assert.match(full, /questStandings\(bulletin\)/, "the full board reads the same mirror as the preview");
  assert.match(full, /door=\{\{ mcp: 'town \{ read: "bulletin" \}', get: "\/api\/bulletin" \}\}/,
    "/town/quests/ names the bulletin read it draws from");
  assert.match(full, /quests\.read \?/, "an unreadable mirror must say so on the full board too");
});

// ── POS-855: what the numbers say (Rivet's trace of the board, 11-02) ─────────
// Cold walks could not read the quest pages' numbers. Three fixes, copy and
// markup only: the standings' last column is COMPLETIONS (not stamps); a card
// with no board count says so in words; a card's count is "of the rows on this
// board", not "of residents today". Source reads, like the rest of this file.
// ⚑ THE FLIP: put the ✦ back after `{r.allTime}`, or the old card strings back,
// and the matching test below goes red.

// the card branch of the hub, with JSX comments out (the comment above it quotes the words it replaced)
const stripJsxComments = (s) => s.replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, " ");
const cardAt = hub.indexOf("questRows.map");
const cardEnd = hub.indexOf("{PAIR_RULE}", cardAt);
const card = stripJsxComments(hub.slice(cardAt, cardEnd));

test("the standings' last column is completions, not stamps: no ✦, a legend, and the unit in words", () => {
  const cell = /<span class="q-all">([\s\S]*?)<\/span>\s*<\/li>/.exec(markup);
  assert.ok(cell, "the row lost its `q-all` cell");
  assert.equal(cell[1].includes("✦"), false, "the all-time number wears a ✦ again: it reads as a stamp balance, and it is a completions count");
  assert.equal(markup.includes("✦"), false, "a ✦ is back in the standings markup");
  assert.match(cell[1], /\{r\.allTime\}/, "the all-time number is no longer drawn");
  assert.match(cell[1], /<span class="q-sr">all-time completions <\/span>/, "the number lost its unit for a screen reader");
  assert.match(markup, /<p class="q-legend">All-time completions of Reach out and Be reached\.<\/p>/, "the legend is gone or reworded");
  // the legend sits under the list, so both renders (the preview and the full board) carry it
  assert.ok(markup.indexOf("</ol>") < markup.indexOf('class="q-legend"'), "the legend moved off the list");
  // the visually-hidden text must stay out of the visual row
  assert.match(style, /\.q-sr \{[^}]*clip: rect\(0, 0, 0, 0\);/, "the screen-reader text is no longer visually hidden");
});

test("a quest card with no board count says 'Board count unavailable', and the branch is the one it was", () => {
  assert.match(card, /\{q\.done != null && q\.of \? \(/, "the card's count-or-nothing branch changed: null must stay distinct from a known zero");
  assert.match(card, /<p class="m-barlab m-dim">Board count unavailable<\/p>/, "the unavailable card lost its words");
  assert.equal(/>\s*uncounted\s*</.test(card), false, "`uncounted` is back on the quest card");
});

test("a quest card's count reads against the board's rows, and its aria-label says the same", () => {
  assert.match(card, /<b>\{q\.done\}<\/b> of \{q\.of\} on this board completed this <span class="m-dim">· board snapshot<\/span>/,
    "the card's count line lost 'on this board', 'completed this' or the snapshot qualifier");
  assert.match(card, /aria-label=\{`\$\{q\.done\} of \$\{q\.of\} on this board completed this \(board snapshot\)`\}/,
    "the bar's aria-label no longer matches the visible line");
  assert.equal(/residents today|finished this today/.test(card), false,
    "the card says 'residents today' again: the denominator is the board's rows, and 'today' implies a live count");
  // the numbers themselves are untouched
  assert.match(card, /Math\.max\(2, pct\(q\.done \/ q\.of\)\)/, "the bar's width changed");
});
