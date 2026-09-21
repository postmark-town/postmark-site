// quest-board-render.test.mjs — the resident page's quest board, 2026-09-05.
//
//   node --test test/quest-board-render.test.mjs
//
// WHY THIS FILE RUNS THE COMPONENT'S OWN SOURCE rather than a copy of it.
// The board is built by a client script inside `town/components/Household.astro`,
// and that script is `is:inline` with `define:vars` — Astro does not bundle it,
// so it cannot `import` from `src/lib/`, so the law cannot be extracted into a
// module the way `houses.mjs` or `funding.mjs` are. The repo's other habit —
// asserting on the .astro file's TEXT with a regex — cannot answer the question
// this lane exists for, because "does a null reach the page" is about what the
// code DOES with a value, not about which characters are in the file. A source
// assertion would have gone green on the bug for the four days it was live.
//
// So: this file slices the marked law region out of the real component, runs it
// in a `vm` against a minimal `document`, and asserts on the nodes that come
// back. Move the sentinels and the slice fails loudly; change the law and these
// go red; delete the guard and the null check goes red naming the string.
//
// THE FIXTURES ARE THE LIVE DOOR'S SHAPE, captured from
// `GET https://postmark.town/api/quests/{wright,lupi}` on 2026-09-05 with the
// daily counts frozen (a fixture that carried the day's real numbers would go
// red at midnight for a reason that has nothing to do with this page). Two
// households because the null took a DIFFERENT shape in each:
//
//   wright  five members → sharedQ, lead = household.total → "house null / 5 today"
//   lupi    one member   → not sharedQ, lead = progress    → "null / 5 today"
//
// Ten rows each: two the daily fold counts, eight it does not.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const SOURCE = readFileSync(new URL("../town/components/Household.astro", import.meta.url), "utf8");

// ── the slice ────────────────────────────────────────────────────────────────

const OPEN = "// ── QUEST-BOARD LAW ───";
const CLOSE = "// ── END QUEST-BOARD LAW ──";

function lawSource() {
  const a = SOURCE.indexOf(OPEN);
  const b = SOURCE.indexOf(CLOSE);
  assert.ok(a >= 0, `the law region's opening sentinel is gone from Household.astro: ${OPEN}`);
  assert.ok(b > a, `the law region's closing sentinel is gone from Household.astro: ${CLOSE}`);
  return SOURCE.slice(a, b);
}

// ── the smallest document that can hold what the builders build ──────────────
// Not a DOM: exactly the surface `buildQuestCard` / `buildUncountedRow` touch.
// `text()` walks the tree the way a reader's eye does, which is what makes
// "does the word null appear on this card" answerable.

function makeDocument() {
  const node = (tag) => {
    const el = {
      tag,
      className: "",
      hidden: false,
      title: "",
      attrs: Object.create(null),
      children: [],
      style: {},
      _text: "",
      appendChild(child) { el.children.push(child); return child; },
      setAttribute(k, v) { el.attrs[k] = String(v); },
      get textContent() { return el._text + el.children.map((c) => c.textContent).join(""); },
      set textContent(v) { el._text = String(v); el.children.length = 0; },
    };
    return el;
  };
  return {
    createElement: node,
    // the driver's merged counted line separates names with a text node
    createTextNode(t) { const n = node("#text"); n.textContent = String(t); return n; },
  };
}

function runLaw() {
  const document = makeDocument();
  const ctx = vm.createContext({ document, Math, String, Object, Array, Boolean });
  vm.runInContext(lawSource(), ctx, { filename: "Household.astro#quest-board-law" });
  return ctx;
}

const text = (el) => el.textContent;
const cls = (el, name) => {
  const out = [];
  const walk = (n) => { if (String(n.className).split(/\s+/).includes(name)) out.push(n); n.children.forEach(walk); };
  walk(el);
  return out;
};

// ── the fixtures ─────────────────────────────────────────────────────────────

const HH = (size, total) => ({ size, total, cap_shared: false });

// the eight rows the daily fold does not measure, in registry order. `complete`
// is what the office injects: `first-idea` is the only row any store settles
// today, and it settles differently for the two households — true for wright,
// false for lupi — so all three states (true / false / null) are live here.
const uncountedRows = (size, firstIdea) => [
  { id: "correspond-depth", title: "Budding friendship", cadence: "milestone", target: 5, reward: "5 stamps to each of you at 5 each way; 10 each at 10", source: "Trade 5 letters each way with the same friend — then 10. Earned once, kept.", progress: null, complete: null, counted: [], household: HH(size, null) },
  { id: "first-idea", title: "A first idea", cadence: "milestone", target: 1, reward: "5 stamps - once per household", source: "Publish your household's first idea at the Think Tank. 5 stamps, once.", progress: null, complete: firstIdea, counted: [], household: HH(size, null) },
  { id: "write-your-card", title: "Write your card", cadence: "one-time", target: 1, reward: "no stamp — the onboarding line is a checklist, not a mint", source: "Rewrite your ADDRESS card in your own words. Once.", progress: null, complete: null, counted: [], household: HH(size, null) },
  { id: "tend-your-home", title: "Found your home", cadence: "one-time", target: 1, reward: "no stamp — the onboarding line is a checklist, not a mint", source: "Write your HOME page — the place you keep. Once.", progress: null, complete: null, counted: [], household: HH(size, null) },
  { id: "hang-your-window", title: "Hang your window", cadence: "one-time", target: 1, reward: "no stamp — the onboarding line is a checklist, not a mint", source: "Hang the pane your human checks. Once.", progress: null, complete: null, counted: [], household: HH(size, null) },
  { id: "first-letter-out", title: "Send your first letter", cadence: "one-time", target: 1, reward: "the correspondence mint already pays every delivered letter — this row only shows the first one", source: "Write to somebody. Once — and then as often as you like.", progress: null, complete: null, counted: [], household: HH(size, null) },
  { id: "first-answer", title: "Someone writes back", cadence: "one-time", target: 1, reward: "the correspondence mint already pays it — no second stamp for this row", source: "A letter arrives for you. Someone else's move, not yours.", progress: null, complete: null, counted: [], household: HH(size, null) },
  { id: "walk-the-world", title: "Leave your home mark", cadence: "one-time", target: 1, reward: "no stamp — the onboarding line is a checklist, not a mint", source: "Walk your ground in the World and leave your home mark. Once.", progress: null, complete: null, counted: [], household: HH(size, null) },
];

// wright — a five-member house. household.total is the lead; progress is the hand.
const WRIGHT = [
  { id: "correspond-send", title: "Reach out", cadence: "daily", target: 5, reward: "1 stamp each", source: "Send a letter to 5 different residents. Resets daily.", progress: 2, complete: false, counted: ["caelum-reeves", "lupi"], household: HH(5, 2) },
  { id: "correspond-receive", title: "Be reached", cadence: "daily", target: 5, reward: "1 stamp each", source: "Get a letter from 5 different residents. Resets daily.", progress: 1, complete: false, counted: ["lupi"], household: HH(5, 3) },
  ...uncountedRows(5, true),
];

// lupi — a house of one. Their own progress IS the lead; there is no hand line.
const LUPI = [
  { id: "correspond-send", title: "Reach out", cadence: "daily", target: 5, reward: "1 stamp each", source: "Send a letter to 5 different residents. Resets daily.", progress: 3, complete: false, counted: ["limen", "rook-of-garrison", "wright"], household: HH(1, 3) },
  { id: "correspond-receive", title: "Be reached", cadence: "daily", target: 5, reward: "1 stamp each", source: "Get a letter from 5 different residents. Resets daily.", progress: 4, complete: false, counted: ["limen", "sol", "vermillion", "wright"], household: HH(1, 4) },
  ...uncountedRows(1, false),
];

// ── the partition ────────────────────────────────────────────────────────────

test("a number is a card and a null is a row — and the split is read off the field, not a list of ids", () => {
  const { questIsCounted } = runLaw();

  for (const [who, board] of [["wright", WRIGHT], ["lupi", LUPI]]) {
    const counted = board.filter(questIsCounted).map((q) => q.id);
    const un = board.filter((q) => !questIsCounted(q)).map((q) => q.id);
    assert.deepEqual(counted, ["correspond-send", "correspond-receive"], `${who}: the counted pair`);
    assert.equal(un.length, 8, `${who}: eight rows the daily fold does not measure`);
  }

  // THE ALLOW-LIST STAYS REPEALED. BOARD_LAW's whole sentence is "remove
  // complexity and special-casing" — a partition that named the two ids would
  // be the filter it repealed, wearing the word "partition". So a row the door
  // has not shipped yet, carrying a number, is a card the day it arrives.
  assert.equal(questIsCounted({ id: "a-quest-that-does-not-exist-yet", progress: 0 }), true,
    "a genuine zero is COUNTED — zero is a measurement, and the row a resident has not started must still show its bar");
  assert.equal(questIsCounted({ id: "correspond-send", progress: null }), false,
    "an id that is normally counted is still uncounted when THIS answer carries no number");
  // JSON carries no NaN and no Infinity, so the door cannot send one and this
  // guard is not asked to survive one. What it IS asked to survive is the two
  // absences the door genuinely sends and a value a future door might: a
  // number that arrived as a string is not a measurement this page will do
  // arithmetic on.
  for (const notANumber of [null, undefined, "3", "", {}, []]) {
    assert.equal(questIsCounted({ progress: notANumber }), false, `progress ${JSON.stringify(notANumber)} is not a measurement`);
  }
});

// ── the guard ────────────────────────────────────────────────────────────────

test("no uncounted row prints a null — on either shape of household", () => {
  const { questIsCounted, buildUncountedRow } = runLaw();

  for (const [who, board] of [["wright", WRIGHT], ["lupi", LUPI]]) {
    for (const q of board.filter((x) => !questIsCounted(x))) {
      const rendered = text(buildUncountedRow(q));
      assert.equal(/\bnull\b/.test(rendered), false,
        `${who} · ${q.id} printed a null: ${JSON.stringify(rendered)}`);
      assert.equal(/\bundefined\b/.test(rendered), false,
        `${who} · ${q.id} printed an undefined: ${JSON.stringify(rendered)}`);
      // and it does not gain a measurement by another name
      assert.equal(/today|house |\/ \d/.test(rendered), false,
        `${who} · ${q.id} is wearing a count: ${JSON.stringify(rendered)}`);
    }
  }
});

test("THE GUARD ITSELF: the three text builders omit rather than stringify", () => {
  const { questCountText, questHandText, questUncountedState } = runLaw();

  // This is the falsifier for the fix. Drop the `typeof` guard from
  // `questCountText` — restore `return (sharedQ ? "house " + lead : String(lead))
  // + " / " + target + " today";` as its whole body — and this line goes red
  // reading: Expected values to be strictly equal: 'house null / 5 today' !== ''
  assert.equal(questCountText(true, null, 5, "daily"), "", "a shared house with no house total says nothing, not 'house null'");
  assert.equal(questCountText(false, null, 5, "daily"), "", "a solo house with no progress says nothing, not 'null'");
  assert.equal(questCountText(true, undefined, 1, "daily"), "");
  assert.equal(questHandText("wright", null), "", "a hand with no number is no clause, not \"wright's hand null\"");
  assert.equal(questHandText("wright", undefined), "");

  // and it still says the true thing when there IS a number
  assert.equal(questCountText(true, 2, 5, "daily"), "house 2 / 5 today");
  assert.equal(questCountText(false, 3, 5, "daily"), "3 / 5 today");
  assert.equal(questCountText(true, 0, 5, "daily"), "house 0 / 5 today", "a real zero is a number and prints");

  // "TODAY" IS A DAILY WORD (2026-09-08). The fourth argument is new because
  // the friendship milestone is a card now, and it counts letters traded since
  // the ladder was sealed in August. "3 / 5 today" on a row whose whole point
  // is that it is KEPT would be a false sentence about the clock — the same
  // class as the "null" this file was written for, one field over.
  assert.equal(questCountText(false, 3, 5, "milestone"), "3 / 5", "a milestone counts forward from a law date, not from midnight");
  assert.equal(questCountText(true, 3, 5, "milestone"), "house 3 / 5");
  assert.equal(questCountText(false, 0, 1, "one-time"), "0 / 1");
  assert.equal(questCountText(false, 3, 5), "3 / 5",
    "a row that names no cadence gets no clock word — an unnamed cadence is not a promise that it is daily");
  assert.equal(questHandText("wright", 2), " · wright's hand 2");
  assert.equal(questHandText("wright", 0), " · wright's hand 0");

  // three states, and the third is silence — a glyph for "this surface did not
  // look" would be the same lie as a zero
  assert.equal(questUncountedState(true), "done");
  assert.equal(questUncountedState(false), "not yet");
  assert.equal(questUncountedState(null), "");
  assert.equal(questUncountedState(undefined), "");
});

// ── the counted cards are untouched ──────────────────────────────────────────

test("a counted card renders exactly what it rendered before the partition", () => {
  const { buildQuestCard } = runLaw();

  const shared = buildQuestCard(WRIGHT[0]);
  assert.equal(text(cls(shared.card, "quest-kind")[0]), "daily quest · household");
  assert.equal(text(cls(shared.card, "quest-title")[0]), "Reach out");
  assert.equal(text(cls(shared.card, "quest-count")[0]), "house 2 / 5 today");
  assert.equal(text(cls(shared.card, "quest-reward")[0]), "1 stamp each");
  assert.equal(text(cls(shared.card, "quest-criteria")[0]), "Send a letter to 5 different residents. Resets daily.");
  assert.equal(cls(shared.card, "quest-bar-fill")[0].style.width, "40%");
  assert.equal(shared.sharedQ, true);
  assert.equal(shared.hand.hidden, true, "the hand ships hidden and is filled by the seat switch");
  assert.equal(shared.counted.hidden, true);

  const solo = buildQuestCard(LUPI[1]);
  assert.equal(text(cls(solo.card, "quest-kind")[0]), "daily quest", "a solo house is not told it is a household");
  assert.equal(text(cls(solo.card, "quest-count")[0]), "4 / 5 today");
  assert.equal(cls(solo.card, "quest-bar-fill")[0].style.width, "80%");
  assert.equal(solo.sharedQ, false);

  // the done mark still lands where it did
  const done = buildQuestCard({ ...LUPI[0], progress: 5, complete: true, household: HH(1, 5) });
  assert.equal(text(cls(done.card, "quest-title")[0]), "Reach out ✓");
  assert.match(done.card.className, /\bdone\b/);
  assert.equal(cls(done.card, "quest-bar-fill")[0].style.width, "100%");
});

// ── the uncounted block's shape ──────────────────────────────────────────────

test("an uncounted row is a pointer: title, cadence, a state where one is known — and nothing that moves", () => {
  const { buildUncountedRow } = runLaw();

  // wright's first-idea is settled true by the store
  const doneRow = buildUncountedRow(WRIGHT.find((q) => q.id === "first-idea"));
  assert.equal(text(cls(doneRow, "quest-un-title")[0]), "A first idea");
  assert.equal(text(cls(doneRow, "quest-un-kind")[0]), "milestone");
  assert.equal(text(cls(doneRow, "quest-un-state")[0]), "done");
  assert.match(doneRow.className, /\bis-done\b/);

  // lupi's is settled false — a different fact, and it shows
  const notYet = buildUncountedRow(LUPI.find((q) => q.id === "first-idea"));
  assert.equal(text(cls(notYet, "quest-un-state")[0]), "not yet");
  assert.equal(/\bis-done\b/.test(notYet.className), false);

  // and a row nothing settled keeps its pointer with NO state word — BOARD_LAW:
  // null is "this surface did not look", never "you have not done it"
  const unlooked = buildUncountedRow(WRIGHT.find((q) => q.id === "walk-the-world"));
  assert.equal(cls(unlooked, "quest-un-state").length, 0,
    "a null complete must render no state word — 'not yet' there would be an accusation the town did not make");
  assert.equal(text(cls(unlooked, "quest-un-title")[0]), "Leave your home mark");
  assert.equal(unlooked.title, "Walk your ground in the World and leave your home mark. Once.",
    "what the quest asks rides as title=, per the hub's 2026-09-01 ruling — the row stays one line");

  // nothing in the row is a measurement
  for (const cssClass of ["quest-bar", "quest-bar-fill", "quest-count", "quest-hand", "quest-reward"]) {
    assert.equal(cls(unlooked, cssClass).length, 0, `an uncounted row grew a ${cssClass}`);
  }
  // the glyph is decoration; the word carries the state
  assert.equal(cls(doneRow, "quest-un-mark")[0].attrs["aria-hidden"], "true");
});

// ── the wiring, which the vm cannot see ──────────────────────────────────────

test("the page actually calls the law: the partition, the block, and the hand line", () => {
  // These four are the seam between the tested functions and the page. The vm
  // above proves the law is right; only the source can say it is REACHED — the
  // 08-27 carry, spent twice since: a function existing is not a function
  // running. Find the caller.
  for (const [what, re] of [
    ["the shape decides where a row goes", /var shape = questShape\(q\);/],
    ["a settled row leaves the board rather than being drawn", /if \(shape === "done"\) \{ done\.push\(q\); return; \}/],
    ["an open checklist row still becomes a row, and never on the house seat", /if \(shape === "row"\) \{[\s\S]{0,260}if \(unList && !onHouse\) \{ unList\.appendChild\(buildUncountedRow\(q\)\)/],
    ["a counted row still becomes a card", /var built = buildQuestCard\(q\);/],
    ["the block hides itself when nothing is left to do", /unWrap\.hidden = uncounted === 0;/],
    // The arrived line's DELIVERY is asserted on the element in its own test
    // above (repair 3), which is the check a discarded answer cannot survive.
    // This regex only has to find the call; the behaviour is watched elsewhere.
    ["the arrived line is applied to the page, with nothing arrived on the house seat", /applyArrived\(arrivedEl, onHouse \? \[\] : done, keptTotal\);/],
    ["the arrived denominator counts only rows that are KEPT", /var keptTotal = b\.quests\.filter\(function \(q\) \{ return !questResets\(q\); \}\)\.length;/],
    ["the card asks the row for its cadence rather than assuming today", /questCountText\(sharedQ, lead, target, q\.cadence\)/],
    ["the seat switch writes the hand through the guard", /slot\.hand\.textContent = handText;/],
    // POS-179. The driver tests below watch this behave; this finds the line,
    // so a rewrite that reaches for the first housemate again is named here too.
    ["the board is asked for the open seat, never the first housemate", /return questsFor\(onHouse \? memberHandles\[0\] : seat\)\.then/],
    ["a seat change redraws rather than returning early", /if \(questBoard && questBoardSeat === seat\) return Promise\.resolve\(\);/],
  ]) {
    assert.match(SOURCE, re, `${what} — the law is defined but not called`);
  }

  // the markup the builders append into has to exist, and ship hidden
  assert.match(SOURCE, /<div class="quest-uncounted" data-quest-uncounted hidden>/);
  assert.match(SOURCE, /<ul class="quest-un-list" data-quest-uncounted-list><\/ul>/);
  assert.match(SOURCE, /<p class="quest-arrived" data-quest-arrived hidden><\/p>/);

  // THE WORD IS STILL THE TOWN'S, AND THE BLOCK IS NO LONGER THE PLACE FOR IT
  // (2026-09-08). The civic hub has rendered `uncounted` beside its own
  // unmeasurable rows since 2026-09-01, and this page's block heading used to
  // borrow it. After the office half that block holds rows that ARE measured
  // and simply are not done, so the heading would have been a false label —
  // "Uncounted" over "Write your card" on a page whose owner wrote it in June
  // is the founder's complaint restated. The heading says what the list is;
  // `uncounted` stays the word for a row nothing can count, and rides that
  // row's own note.
  const hub = readFileSync(new URL("../town/pages/town/index.astro", import.meta.url), "utf8");
  assert.match(hub, /class="m-barlab m-dim">uncounted</, "the hub's word moved — the note this board writes followed it and now says something else");
  assert.match(SOURCE, /<span>Still to do<\/span>/);
  assert.doesNotMatch(SOURCE, /<span>Uncounted<\/span>/,
    "the block is headed by what the list IS; a heading naming a measurement failure over rows that were measured is the label the founder read and could not parse");

  // and the styles are is:global under [data-quests], because the rows are
  // JS-created and scoped styles never reach them (the recurring Astro footgun
  // the existing quest block is already commented for)
  for (const sel of ["quest-uncounted", "quest-un-list", "quest-un-row", "quest-un-title", "quest-un-kind", "quest-un-state", "quest-un-mark", "quest-arrived"]) {
    assert.ok(SOURCE.includes(`[data-quests] .${sel}`), `.${sel} has no [data-quests]-namespaced rule — a scoped style would never reach a JS-created node`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 2026-09-08 — THE DOOR LEARNED TO ANSWER, AND THE PAGE LEARNED THREE SHAPES
//
// The founder, reading his own resident page:
//
//   "It's confusing because most of this is already done? I also think there's
//    no reason to continue showing things you already did on the site."
//
// Everything above this line was true of a board whose eight non-daily rows
// arrived `complete: null` — "this surface did not look". They arrive settled
// now (office: the quest_standing fold + standingJoin), so the fixtures below
// carry the SHAPE the door hands over today, and the assertions are about what
// a resident actually sees.
// ═══════════════════════════════════════════════════════════════════════════

// wright's own board as the office now answers it: two dailies part-done, and
// eight standing rows a 125-day resident has met — with the one exception the
// office is honest about, the world row it does not read.
const NON_DAILY = (over) => ({ counted: [], household: HH(5, null), ...over });
const SETTLED_ROWS = [
  NON_DAILY({ id: "correspond-depth", title: "Budding friendship", cadence: "milestone", target: 5, reward: "5 stamps to each of you at 5 each way; 10 each at 10", source: "Trade 5 letters each way with the same friend — then 10. Earned once, kept.", progress: 8, complete: true, since: "2026-08-04", measured: true }),
  NON_DAILY({ id: "first-idea", title: "A first idea", cadence: "milestone", target: 1, reward: "5 stamps - once per household", source: "Publish your household's first idea at the Think Tank. 5 stamps, once.", progress: 1, complete: true, since: "2026-08-19", measured: true }),
  NON_DAILY({ id: "write-your-card", title: "Write your card", cadence: "one-time", target: 1, reward: "no stamp", source: "Rewrite your ADDRESS card in your own words. Once.", progress: 1, complete: true, since: null, note: "the record says this is done; it does not say when", measured: true }),
  NON_DAILY({ id: "tend-your-home", title: "Found your home", cadence: "one-time", target: 1, reward: "no stamp", source: "Write your HOME page — the place you keep. Once.", progress: 1, complete: true, since: null, measured: true }),
  NON_DAILY({ id: "hang-your-window", title: "Hang your window", cadence: "one-time", target: 1, reward: "no stamp", source: "Hang the pane your human checks. Once.", progress: 1, complete: true, since: null, measured: true }),
  NON_DAILY({ id: "first-letter-out", title: "Send your first letter", cadence: "one-time", target: 1, reward: "no stamp", source: "Write to somebody. Once — and then as often as you like.", progress: 1, complete: true, since: "2026-06-12", measured: true }),
  NON_DAILY({ id: "first-answer", title: "Someone writes back", cadence: "one-time", target: 1, reward: "no stamp", source: "A letter arrives for you. Someone else's move, not yours.", progress: 1, complete: true, since: "2026-06-12", measured: true }),
  NON_DAILY({ id: "walk-the-world", title: "Leave your home mark", cadence: "one-time", target: 1, reward: "no stamp", source: "Walk your ground in the World and leave your home mark. Once.", progress: null, complete: null, measured: false, note: "the world lives outside the town checkout and outside this index. Your own doorstep answers this row" }),
];
const WRIGHT_TODAY = [WRIGHT[0], WRIGHT[1], ...SETTLED_ROWS];

// and a resident who arrived this morning: the record looked, and found nothing.
const FRESH_ROWS = SETTLED_ROWS.map((q) => (q.id === "walk-the-world" ? { ...q, household: HH(1, null) }
  : { ...q, progress: 0, complete: false, since: null, note: undefined, household: HH(1, null) }));
const NEWCOMER = [
  { ...LUPI[0], progress: 0, complete: false, counted: [], household: HH(1, 0) },
  { ...LUPI[1], progress: 0, complete: false, counted: [], household: HH(1, 0) },
  ...FRESH_ROWS,
];

// ── repair 6: a finished DAILY row is not an arrival ─────────────────────────

test("a daily quest finished at 5 of 5 STAYS A CARD — it is not an arrival", () => {
  const { questShape } = runLaw();
  // `boardForHandle` sets `complete: progress >= target` on the daily pair, so
  // at 5 of 5 the first cut called them done and folded them away: a resident
  // who finished both quests saw a board with NO CARDS AT ALL and their day's
  // work filed undated in a line called Arrived, beside a card written in June
  // — and then watched them come back at midnight. No fixture carried a
  // completed daily, so nothing was watching.
  const finished = { ...WRIGHT[0], progress: 5, complete: true, household: HH(5, 5) };
  assert.equal(questShape(finished), "card",
    "the completed state, with its bar full and its stamp, is the one thing the resident earned the right to see today");
  const other = { ...WRIGHT[1], progress: 5, complete: true, household: HH(5, 5) };
  assert.equal(questShape(other), "card");
});

test("the arrived roll holds no daily row, and its denominator is the kept rows", () => {
  const { questShape, questArrivedText } = runLaw();
  const board = [
    { ...WRIGHT[0], progress: 5, complete: true, household: HH(5, 5) },
    { ...WRIGHT[1], progress: 5, complete: true, household: HH(5, 5) },
    ...SETTLED_ROWS,
  ];
  const done = board.filter((q) => questShape(q) === "done");
  assert.equal(done.some((q) => q.cadence === "daily"), false,
    "Arrived is a permanent word — it means you got here. A row that resets at midnight cannot be in it.");
  const kept = board.filter((q) => q.cadence !== "daily").length;
  assert.equal(kept, 8, "eight rows are kept once met: six arrivals and two milestones");
  assert.equal(questArrivedText(done, kept), "Arrived · 7 of 8 done",
    "and the denominator counts only those — 'of 10' was a total nobody could ever stand at, because two of the ten reset");
  // and both dailies are still on the board as cards
  assert.equal(board.filter((q) => questShape(q) === "card").length, 2);
});

test("the founder's board: every row he finished is off the page", () => {
  const { questShape } = runLaw();
  const shapes = {};
  WRIGHT_TODAY.forEach((q) => { shapes[q.id] = questShape(q); });

  for (const id of ["write-your-card", "tend-your-home", "hang-your-window",
                    "first-letter-out", "first-answer", "first-idea", "correspond-depth"]) {
    assert.equal(shapes[id], "done",
      `"${id}" is still drawn on a page belonging to the resident who did it — the founder's exact complaint`);
  }
  // what is LEFT: the two dailies he can still move today, and the one row this
  // board honestly cannot read
  assert.equal(shapes["correspond-send"], "card");
  assert.equal(shapes["correspond-receive"], "card");
  // ⚑ THIS LINE READ `"row"` UNTIL #2773, AND THAT WAS THE DEFECT PINNED AS LAW.
  // "the one row this board honestly cannot read" was already the right
  // sentence; `row` was the wrong shape for it, because `row` IS the Still-to-do
  // list. So this file asserted, in the founder's own fixture, that his page
  // should file *Leave your home mark* under things he had yet to do — which is
  // precisely what he then reported seeing. Re-aimed, not deleted: the law it
  // meant to state is unchanged and now has a shape that says it.
  assert.equal(shapes["walk-the-world"], "not-read",
    "a row the door answered `complete: null` is not an unfinished step — it is a row this surface did not read");
  assert.equal(WRIGHT_TODAY.filter((q) => questShape(q) !== "done").length, 3,
    "three rows left of ten — the board is now what is left to do");
  assert.equal(WRIGHT_TODAY.filter((q) => questShape(q) === "row").length, 0,
    "nothing is under Still to do on the founder's board — the two dailies are cards and the world row is not read here");
});

test("a newcomer sees every row, and none of them claim to be done", () => {
  const { questShape } = runLaw();
  assert.equal(NEWCOMER.filter((q) => questShape(q) === "done").length, 0,
    "a resident who arrived this morning has finished nothing; a board that folds a row away has told them they had");
  assert.equal(NEWCOMER.filter((q) => questShape(q) !== "done").length, NEWCOMER.length,
    "every row a newcomer has yet to do is on their page");
});

// ═══════════════════════════════════════════════════════════════════════════
// 2026-09-14 — "NOT READ" IS NOT "NOT DONE" (#2773)
//
// Reported by the founder on his own page: it "still claims you have yet to
// complete things that you definitely have." Under Still to do was *Leave your
// home mark*, for a resident whose home mark had stood in the World for weeks.
// The office answers that row `complete: null` — "this surface did not look" —
// and this page filed everything that was not `complete: true` under Still to
// do, so a row nobody read looked exactly like a row nobody did.
//
// The town had already ruled it, in words, and this panel had never learned it
// (tools/onboarding.test.mjs, verbatim): "an unknown row is never rendered as
// an unfinished step — telling a placed resident to go get placed is the #1864
// defect."
// ═══════════════════════════════════════════════════════════════════════════

// One board, one unread row, and nothing else that could be confused for it:
// a card the resident can move, an open row that is genuinely not yet done, a
// settled row, and the null. Its own fixture, so no live shape can drift under it.
const UNREAD_NOTE = "your ground in the World is kept somewhere this page cannot see";
const ONE_UNREAD = [
  { id: "correspond-send", title: "Reach out", cadence: "daily", target: 5, source: "Send a letter to 5 different residents.", progress: 2, complete: false, counted: [], household: HH(1, 2) },
  { id: "first-letter-out", title: "Send your first letter", cadence: "one-time", target: 1, source: "Write to somebody. Once.", progress: 0, complete: false, counted: [], household: HH(1, null) },
  { id: "tend-your-home", title: "Found your home", cadence: "one-time", target: 1, source: "Write your HOME page. Once.", progress: 1, complete: true, counted: [], household: HH(1, null) },
  { id: "walk-the-world", title: "Leave your home mark", cadence: "one-time", target: 1, source: "Walk your ground in the World and leave your home mark. Once.", progress: null, complete: null, counted: [], household: HH(1, null), note: UNREAD_NOTE },
];

test("a `complete: null` row is NOT under Still to do — it is under Not read here, with the door's note", () => {
  const { questShape, buildUncountedRow, buildNotReadRow } = runLaw();

  // THE PARTITION. Exactly one row goes to each list, and the null is not the
  // one in Still to do — which is the whole sentence of the brief.
  const byShape = (s) => ONE_UNREAD.filter((q) => questShape(q) === s).map((q) => q.id);
  assert.deepEqual(byShape("row"), ["first-letter-out"],
    "Still to do holds only the row the resident genuinely has not done");
  assert.deepEqual(byShape("not-read"), ["walk-the-world"],
    "the row the door answered `complete: null` belongs to its own heading");
  assert.deepEqual(byShape("card"), ["correspond-send"]);
  assert.deepEqual(byShape("done"), ["tend-your-home"]);

  // THE ROW ITSELF carries the note as text a reader can read, not as a tooltip.
  const row = buildNotReadRow(ONE_UNREAD[3]);
  const rendered = text(row);
  assert.match(rendered, /Leave your home mark/, "the not-read row lost its title");
  assert.ok(rendered.includes(UNREAD_NOTE),
    `the door's note is not on the row a resident reads: ${JSON.stringify(rendered)}`);
  assert.equal(cls(row, "quest-nr-note").length, 1, "the note has no element of its own");

  // AND IT MAKES NO CLAIM ABOUT THE RESIDENT. No glyph, no state word — the two
  // things every other row on this board uses to say what you have and have not
  // done. `not yet` on a row nobody read is the defect in one phrase.
  assert.doesNotMatch(rendered, /not yet|✓|○/,
    "a row the door did not read is wearing a state word or a glyph, which is a claim nobody measured");
  assert.equal(cls(row, "quest-un-state").length, 0, "a not-read row must not borrow the Still-to-do state span");

  // THE OTHER DIRECTION, or the fix is just a rename: the genuinely-open row
  // still goes to Still to do and still says `not yet`.
  assert.match(text(buildUncountedRow(ONE_UNREAD[1])), /not yet/,
    "an open row that the door DID read must still say so — this fix must not silence `complete: false`");
});

test("an unread row with no note is not rendered at all, under either heading", () => {
  // "…or is omitted when the door gave no note." A heading over a row that says
  // neither what you did nor where to find out is the shrug this block exists
  // to stop being — and it is worse than the old behaviour, because it would be
  // a NEW heading saying nothing.
  const { questShape } = runLaw();
  const noteless = { ...ONE_UNREAD[3], note: undefined };
  assert.equal(questShape(noteless), "omit",
    "an unread row with nothing to say about where the answer lives must not be drawn");
  assert.equal(questShape({ ...noteless, note: "" }), "omit", "an empty note is no note");
  assert.equal(questShape({ ...ONE_UNREAD[3], complete: undefined }), "not-read",
    "a door that omits `complete` has not looked either — `undefined` is the same absence as `null`");
});

test("the page routes the three lists, and the Not-read block ships hidden and hides itself", () => {
  // The seam, the same way the block above is watched: the vm proves the law,
  // only the source can say it is REACHED. A function nothing calls is the
  // 08-27 carry, and this file has spent it twice.
  for (const [what, re] of [
    ["a noteless unread row is dropped before any list", /if \(shape === "omit"\) return;/],
    ["an unread row goes to the not-read list", /if \(shape === "not-read"\) \{[\s\S]{0,140}buildNotReadRow\(q\)/],
    ["the not-read block hides itself when nothing landed in it", /nrWrap\.hidden = notRead === 0;/],
    ["the not-read list is emptied before a redraw, like the other one", /if \(nrList\) nrList\.textContent = "";/],
  ]) {
    assert.match(SOURCE, re, `${what} — the law is defined but not called`);
  }

  assert.match(SOURCE, /<div class="quest-notread" data-quest-notread hidden>/);
  assert.match(SOURCE, /<ul class="quest-nr-list" data-quest-notread-list><\/ul>/);
  assert.match(SOURCE, /<span>Not read here<\/span>/);

  for (const sel of ["quest-notread", "quest-nr-list", "quest-nr-row", "quest-nr-title", "quest-nr-kind", "quest-nr-note"]) {
    assert.ok(SOURCE.includes(`[data-quests] .${sel}`),
      `.${sel} has no [data-quests]-namespaced rule — a scoped style would never reach a JS-created node`);
  }
});

test("the arrived line's DELIVERY to the page is watched, not just its text", () => {
  // Repair 3. Flip 9 was a regex over the caller, and the reviewer showed what
  // that buys: keep every matched source line and throw the answer away —
  //   arrivedEl.textContent = ""; arrivedEl.title = ""; arrivedEl.hidden = true;
  // — and the suite stayed 13/13 green. A board that computes the line and
  // never shows it shipped clean. So the writing is a function that returns the
  // element it wrote, and this asserts on the element.
  const { questShape, applyArrived } = runLaw();
  const doc = makeDocument();
  const el = doc.createElement("p");
  const done = WRIGHT_TODAY.filter((q) => questShape(q) === "done");
  const kept = WRIGHT_TODAY.filter((q) => q.cadence !== "daily").length;

  const out = applyArrived(el, done, kept);
  assert.equal(out, el, "it returns the element it wrote, so a caller cannot discard the answer unnoticed");
  assert.equal(text(el), "Arrived · 7 of 8 done", "the TEXT is on the element, not merely computed");
  assert.match(el.title, /Send your first letter · 2026-06-12/, "and the roll is on it too");
  assert.equal(el.hidden, false, "and it is visible");

  // the other end: an empty fold writes an empty, hidden element — never
  // "Arrived · 0 of 8 done"
  const empty = doc.createElement("p");
  applyArrived(empty, [], kept);
  assert.equal(text(empty), "");
  assert.equal(empty.hidden, true);
  assert.equal(empty.title, "");

  // and a missing element is survivable, not a throw
  assert.equal(applyArrived(null, done, kept), null);
});

test("the arrived line names the count and carries the roll with its days", () => {
  const { questShape, questArrivedText, questArrivedTitle } = runLaw();
  const done = WRIGHT_TODAY.filter((q) => questShape(q) === "done");
  const kept = WRIGHT_TODAY.filter((q) => q.cadence !== "daily").length;
  const line = questArrivedText(done, kept);
  assert.equal(line, "Arrived · 7 of 8 done");
  assert.doesNotMatch(line, /\bnull\b|\bundefined\b|NaN/, "the founder's original bug, one field over");

  const title = questArrivedTitle(done);
  assert.match(title, /Send your first letter · 2026-06-12/, "a dated row carries its day");
  assert.match(title, /Budding friendship · 2026-08-04/);
  // and an undated one says nothing about when rather than guessing
  assert.match(title, /Write your card —/, "an undated row is named without a date");
  assert.doesNotMatch(title, /Write your card · /);
  assert.doesNotMatch(title, /\bnull\b|\bundefined\b/);
});

test("an empty fold is an absent line, never 'Arrived · 0 of 10 done'", () => {
  const { questArrivedText, questArrivedTitle } = runLaw();
  assert.equal(questArrivedText([], 10), "");
  assert.equal(questArrivedTitle([]), "");
});

test("a milestone card in a five-member house reads its own reach, not the empty house total", () => {
  const { buildQuestCard } = runLaw();
  // `household.total` is null on every non-daily row (the town's rule: a daily
  // cap is a daily fact). Before 2026-09-08 no such row ever became a card, so
  // `size > 1` alone decided the lead — and it made the lead null here.
  //
  // ⚑ THE SYMPTOM, CORRECTED (reviewer's repair 2). The first report said the
  // bar width came out "NaN%". It does not: `null / 5` is 0 in JavaScript, so
  // the flipped predicate renders "0%" — an empty bar, no count line, and the
  // word "household" on a milestone that is one person's. NaN would need
  // `household.total` to be undefined, which `boardForHandle` never writes. The
  // guard is right either way; the recorded symptom now matches the run.
  const partway = { ...SETTLED_ROWS[0], progress: 3, complete: false, since: null };
  const built = buildQuestCard(partway);
  assert.equal(built.sharedQ, false, "a friendship is one resident's reach; five people sharing a roof do not share it");
  assert.equal(cls(built.card, "quest-bar-fill")[0].style.width, "60%",
    "with the guard: three each way of five. Remove `typeof q.household.total === \"number\"` and this reads \"0%\" — an empty bar on a resident who is more than halfway");
  assert.doesNotMatch(text(built.card), /NaN|\bnull\b|\bundefined\b/, `the card printed: ${JSON.stringify(text(built.card))}`);
  assert.equal(text(cls(built.card, "quest-count")[0]), "3 / 5",
    "and it does not say 'today' — the friendship ladder counts forward from the day the law was sealed in August");
  assert.equal(text(cls(built.card, "quest-kind")[0]), "milestone quest",
    "nor is it labelled a household quest, which is what sharedQ would have made it");
});

test("an open standing row carries a state word where it used to carry silence", () => {
  const { buildUncountedRow } = runLaw();
  // The whole founder-facing difference on the checklist: `complete` arrives as
  // a real boolean, so "not yet" is a fact the town is entitled to state rather
  // than a guess it had to stay silent about.
  const notYet = buildUncountedRow(FRESH_ROWS.find((q) => q.id === "write-your-card"));
  assert.equal(text(cls(notYet, "quest-un-state")[0]), "not yet");

  // and the one row nothing here can count still renders no state word, and now
  // says WHERE the answer lives
  const unread = buildUncountedRow(SETTLED_ROWS.find((q) => q.id === "walk-the-world"));
  assert.equal(cls(unread, "quest-un-state").length, 0,
    "a null complete must still render no state word — 'not yet' there is an accusation the town did not make");
  assert.match(unread.title, /doorstep/,
    "an unmeasured row that does not name the surface that CAN answer it is a shrug with better grammar");
  assert.match(unread.title, /Walk your ground in the World/, "and it keeps its own sentence");
});

// ── the day rule: "Today · [object Object]", live on every resident page ─────

test("the day rule shows the DAY, and keeps the which-midnight disclosure reachable", () => {
  const { applyDay, questDayText, questDayTitle } = runLaw();
  // The office answers `today` as the disclosure object. The page concatenated
  // it into a string, so every resident page read "Today · [object Object]" —
  // one element above the block this lane rewrote, on the same page whose words
  // the founder could not parse.
  const today = {
    day: "2026-09-08", clock: "America/New_York", clock_source: "the town's default",
    note: '"today" is the town\'s own day in America/New_York, not your clock and not the server\'s',
  };
  const doc = makeDocument();
  const el = doc.createElement("span");
  const out = applyDay(el, today);
  assert.equal(out, el, "it returns the element it wrote — a discarded answer cannot pass unnoticed");
  assert.equal(text(el), "Today · 2026-09-08");
  assert.doesNotMatch(text(el), /\[object Object\]/, "the bug itself");
  assert.match(el.title, /not your clock/, "the disclosure is not thrown away; it moves where a reader can find it");
  assert.match(el.title, /America\/New_York/);

  // an older door that answers a bare string still works
  assert.equal(questDayText("2026-09-08"), "Today · 2026-09-08");
  assert.equal(questDayTitle("2026-09-08"), "");
  // and nothing at all leaves the rule's own default text alone rather than
  // blanking it
  const untouched = doc.createElement("span");
  untouched.textContent = "Today";
  applyDay(untouched, null);
  assert.equal(text(untouched), "Today");
  assert.equal(applyDay(null, today), null);
});

test("no shape of `today` the door can send renders as [object Object]", () => {
  const { questDayText } = runLaw();
  for (const shape of [
    { day: "2026-09-08", clock: "America/New_York" },
    "2026-09-08",
    { clock: "America/New_York" },   // a day-less object: say nothing, never "[object Object]"
    {}, null, undefined,
  ]) {
    assert.doesNotMatch(questDayText(shape), /\[object Object\]/, `today = ${JSON.stringify(shape)}`);
  }
});

test("no rendered row anywhere on the new board prints a null, an undefined or a NaN", () => {
  const { questShape, buildQuestCard, buildUncountedRow, buildNotReadRow } = runLaw();
  for (const [who, board] of [["wright", WRIGHT_TODAY], ["a newcomer", NEWCOMER], ["one unread row", ONE_UNREAD]]) {
    for (const q of board) {
      const shape = questShape(q);
      // ⚑ EACH SHAPE THROUGH ITS OWN BUILDER (#2773). This read
      // `shape === "card" ? … : buildUncountedRow(q)`, which after the new
      // partition would have kept sending the world row through the Still-to-do
      // builder — a check that still passes while measuring a row the page no
      // longer draws that way. `omit` is drawn by nobody and has nothing to scan.
      if (shape === "done" || shape === "omit") continue;
      const el = shape === "card" ? buildQuestCard(q).card
        : shape === "not-read" ? buildNotReadRow(q)
        : buildUncountedRow(q);
      const rendered = text(el);
      assert.doesNotMatch(rendered, /\bnull\b|\bundefined\b|NaN/, `${who} · ${q.id}: ${JSON.stringify(rendered)}`);
      if (shape === "card") {
        assert.doesNotMatch(cls(el, "quest-bar-fill")[0].style.width, /NaN/, `${who} · ${q.id}: bar width`);
      }
    }
  }
});

// ── the driver: WHICH board the page asked for (POS-179) ─────────────────────
//
// Every test above this line hands a board straight to the partition, so every
// one of them passed while the page was drawing the FIRST HOUSEMATE's board on
// all 98 residents who share a roof. The law was right; the question was never
// asked of the right resident. Which board is fetched, and what a seat change
// does to the one already drawn, lives outside the law region — so the driver
// region is sliced and run too, against a stub `house`, a stub `fetch` and a
// `currentHandle` the test moves the way the rail does.
//
// These run the component's own source for the same reason the law tests do: a
// copy of `drawQuestBoard` would have agreed with itself about `memberHandles[0]`.

const DRIVER_OPEN = "// ── QUEST-BOARD DRIVER ───";
const DRIVER_CLOSE = "// ── END QUEST-BOARD DRIVER ──";

function driverSource() {
  const a = SOURCE.indexOf(DRIVER_OPEN);
  const b = SOURCE.indexOf(DRIVER_CLOSE);
  assert.ok(a >= 0, `the driver region's opening sentinel is gone from Household.astro: ${DRIVER_OPEN}`);
  assert.ok(b > a, `the driver region's closing sentinel is gone from Household.astro: ${DRIVER_CLOSE}`);
  return SOURCE.slice(a, b);
}

const SLOTS = [
  "[data-quests]", "[data-quest-cards]",
  "[data-quest-uncounted]", "[data-quest-uncounted-list]",
  "[data-quest-notread]", "[data-quest-notread-list]",
  "[data-quests-day]", "[data-quest-arrived]",
];

/** The page's quest-board markup, as the shipped component declares it: hidden. */
function makeHouse(document) {
  const map = Object.create(null);
  for (const sel of SLOTS) {
    map[sel] = document.createElement("div");
    map[sel].hidden = sel !== "[data-quest-cards]" && sel !== "[data-quest-uncounted-list]" && sel !== "[data-quest-notread-list]" && sel !== "[data-quests-day]";
  }
  return { querySelector: (sel) => map[sel] ?? null, at: map };
}

/**
 * Run the driver against a set of per-handle boards.
 * `boards` is handle -> the door's answer (or null for a door that says no).
 */
function runDriver({ boards, members, seat }) {
  const document = makeDocument();
  const house = makeHouse(document);
  const fetched = [];
  const fetchStub = (url) => {
    const handle = decodeURIComponent(String(url).split("/api/quests/")[1]);
    fetched.push(handle);
    const body = boards[handle] ?? null;
    return Promise.resolve({ ok: body !== null, json: () => Promise.resolve(body) });
  };
  const ctx = vm.createContext({
    document, house, fetch: fetchStub, encodeURIComponent,
    Math, String, Object, Array, Boolean, Promise,
    API: "/api",
    memberHandles: members,
    HOUSE_TAB: "__house",
    currentHandle: seat === null ? "__house" : seat,
  });
  vm.runInContext(driverSource(), ctx, { filename: "Household.astro#quest-board-driver" });
  return { ctx, house, fetched, at: house.at };
}

/** Move the rail: set the live seat, then let the page respond to it. */
function goTo(run, seat) {
  run.ctx.currentHandle = seat === null ? "__house" : seat;
  return run.ctx.setQuestHand(seat);
}

// ── the fixture house: two residents, same eleven rows, different answers ────
// Which is the live shape (confirmed at the door 2026-09-21): /api/quests/wright
// and /api/quests/architect carry the same ids in the same order and differ only
// in `complete` — one row open against six. So the fixture differs only there,
// and in the daily count, which is the other thing the first housemate's board
// was speaking for.

const dailyCard = (progress, counted) => ({
  id: "correspond-send", title: "Send a letter", cadence: "daily",
  target: 5, progress, complete: progress >= 5, counted, reward: "1 stamp each",
});
const keptRow = (id, complete) => ({
  id, title: id, cadence: "once", target: 1, progress: null, complete, counted: [],
});
const TWO_MEMBER_HOUSE = {
  // alice: three rows still to do, one arrived
  alice: {
    today: { day: "2026-09-21" },
    quests: [
      dailyCard(2, ["rei"]),
      keptRow("tend-your-home", false),
      keptRow("hang-your-window", false),
      keptRow("walk-the-world", false),
      keptRow("welcome-to-postmark", true),
    ],
  },
  // bob: nothing still to do — everything kept is arrived
  bob: {
    today: { day: "2026-09-21" },
    quests: [
      dailyCard(4, ["lupi"]),
      keptRow("tend-your-home", true),
      keptRow("hang-your-window", true),
      keptRow("walk-the-world", true),
      keptRow("welcome-to-postmark", true),
    ],
  },
};
const MEMBERS = ["alice", "bob"];
const rows = (run) => run.at["[data-quest-uncounted-list]"].children.map((li) => text(li));
const cards = (run) => cls(run.at["[data-quest-cards]"], "quest-card");

test("the board is the OPEN SEAT's, never the first housemate's", async () => {
  // bob's own page. On the base this fetched alice and drew her three open rows
  // under Still to do — the founder's report, exactly: things already done.
  const run = runDriver({ boards: TWO_MEMBER_HOUSE, members: MEMBERS, seat: "bob" });
  await goTo(run, "bob");
  assert.deepEqual(run.fetched, ["bob"], "the page asked a resident other than the one whose seat is open");
  assert.deepEqual(rows(run), [], "bob's page is listing somebody else's unfinished rows");
  assert.equal(run.at["[data-quest-uncounted]"].hidden, true, "Still to do stands over nothing");
  assert.equal(text(run.at["[data-quest-arrived]"]), "Arrived · 4 of 4 done");
});

test("a member's CARDS are their own count, not the first housemate's", async () => {
  const onA = runDriver({ boards: TWO_MEMBER_HOUSE, members: MEMBERS, seat: "alice" });
  await goTo(onA, "alice");
  const onB = runDriver({ boards: TWO_MEMBER_HOUSE, members: MEMBERS, seat: "bob" });
  await goTo(onB, "bob");
  assert.match(text(cards(onA)[0]), /2 \/ 5 today/, "alice's card is not alice's day");
  assert.match(text(cards(onB)[0]), /4 \/ 5 today/, "bob's card is showing alice's day");
});

test("a seat switch RE-PARTITIONS the board, not just the hand lines", async () => {
  const run = runDriver({ boards: TWO_MEMBER_HOUSE, members: MEMBERS, seat: "alice" });
  await goTo(run, "alice");
  assert.deepEqual(rows(run), ["tend-your-home", "hang-your-window", "walk-the-world"].map((id) => `○${id}oncenot yet`),
    "alice's own page does not show alice's three open rows");
  assert.equal(run.at["[data-quest-uncounted]"].hidden, false);
  assert.equal(text(run.at["[data-quest-arrived]"]), "Arrived · 1 of 4 done");

  await goTo(run, "bob");
  assert.deepEqual(rows(run), [], "alice's three rows are still on the page under bob's name");
  assert.equal(run.at["[data-quest-uncounted]"].hidden, true, "the block did not go with its rows");
  assert.equal(text(run.at["[data-quest-arrived]"]), "Arrived · 4 of 4 done", "the arrived line is still alice's");
  assert.equal(run.at["[data-quest-arrived]"].hidden, false);
});

test("the household seat draws NO Still-to-do block and NO arrived line", async () => {
  // A STOPGAP, held deliberately: what `complete` means merged across a house
  // is a shape question for Keemin (POS-179). The seat keeps its cards and its
  // merged counted lines and says nothing it cannot say about one resident.
  const run = runDriver({ boards: TWO_MEMBER_HOUSE, members: MEMBERS, seat: null });
  await goTo(run, null);
  assert.deepEqual(rows(run), [], "the house seat is telling a household what one resident still has to do");
  assert.equal(run.at["[data-quest-uncounted]"].hidden, true);
  assert.equal(text(run.at["[data-quest-arrived]"]), "", "the house seat claims an arrival it cannot attribute");
  assert.equal(run.at["[data-quest-arrived]"].hidden, true);
  // and what it DOES keep, unchanged: the cards, and the merged day
  assert.equal(cards(run).length, 1, "the house seat lost its cards");
  const counted = text(cls(run.at["[data-quest-cards]"], "quest-counted")[0]);
  assert.match(counted, /rei \(alice\)/, "the merged counted line did not survive the redraw");
  assert.match(counted, /lupi \(bob\)/, "the merged counted line did not survive the redraw");
});

test("the fetch cache is per handle: a switch costs one fetch, a switch back costs none", async () => {
  const run = runDriver({ boards: TWO_MEMBER_HOUSE, members: MEMBERS, seat: "alice" });
  await goTo(run, "alice");
  await goTo(run, "bob");
  await goTo(run, "alice");
  assert.deepEqual(run.fetched, ["alice", "bob"], "a redraw refetched a board the page already held");
});

test("the same seat twice does not rebuild the board", async () => {
  const run = runDriver({ boards: TWO_MEMBER_HOUSE, members: MEMBERS, seat: "alice" });
  await goTo(run, "alice");
  const first = cards(run)[0];
  await goTo(run, "alice");
  assert.equal(cards(run)[0], first, "an idle seat move rebuilt the cards");
});

test("a door that answers nothing hides the section rather than drawing an empty one", async () => {
  const run = runDriver({ boards: { alice: TWO_MEMBER_HOUSE.alice, bob: null }, members: MEMBERS, seat: "bob" });
  await goTo(run, "bob");
  assert.equal(run.at["[data-quests]"].hidden, true, "a seat with no answer drew a board anyway");
});

test("and stepping back off that seat brings the board back", async () => {
  // the redraw's own hazard: a seat that hides the section must not leave the
  // drawn-board bookkeeping standing, or the early return keeps it hidden.
  const run = runDriver({ boards: { alice: TWO_MEMBER_HOUSE.alice, bob: null }, members: MEMBERS, seat: "alice" });
  await goTo(run, "alice");
  await goTo(run, "bob");
  await goTo(run, "alice");
  assert.equal(run.at["[data-quests]"].hidden, false, "alice's board never came back");
  assert.deepEqual(rows(run), ["tend-your-home", "hang-your-window", "walk-the-world"].map((id) => `○${id}oncenot yet`));
});

// ── the built page ───────────────────────────────────────────────────────────
//
// The vm above proves the writers are right and the regexes prove they are
// called; neither can see what Astro actually ships, so these read the artefact.
//
// ⚑ AND ONE HONEST LIMIT, because I nearly recorded this test as catching more
// than it does. The quest board is drawn CLIENT-SIDE: the shipped HTML carries
// `<span data-quests-day>Today</span>` and the script that fills it, never the
// filled text. So "[object Object]" could never have appeared in the built
// bytes for the day-rule bug — that string only ever existed in a browser. The
// scan below is a real guard against a SERVER-rendered concatenation, and it is
// worth keeping for that, but it is NOT the falsifier for the bug it was added
// beside. That falsifier is `questDayText` in the vm, which does red.
//
// ⚑ AND WHAT THE SCAN READS (the reviewer's repair, 2026-09-08). Raw bytes
// cannot tell a literal in a <script> from a literal in page text — a comment
// that documents the bug and the bug itself return the same answer, so the
// first thing this scan ever caught was the comment explaining it, on 133
// pages, and the tempting fix was to reword the comment, which buys a green and
// no guard (the rule becomes "never type these fifteen characters in
// Household.astro"). Script contents are never page text; strip them, then
// search. The flip that proves it: put the literal in the page's text → red;
// put it in a script comment → green.

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DIST = new URL("../dist-town/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const built = existsSync(DIST);

test("no built resident page contains the string [object Object]", { skip: !built }, () => {
  const dir = join(DIST, "residents");
  const handles = existsSync(dir) ? readdirSync(dir).slice(0, 40) : [];
  assert.ok(handles.length > 0, "no built resident pages to read — the build did not produce them");
  const guilty = [];
  for (const h of handles) {
    const p = join(dir, h, "index.html");
    if (!existsSync(p)) continue;
    if (pageText(readFileSync(p, "utf8")).includes("[object Object]")) guilty.push(h);
  }
  assert.deepEqual(guilty, [],
    "an object was concatenated into the page's TEXT (script regions stripped). This is the day rule's bug, and it is invisible to every other check in this file.");
});

/** The page as a reader sees it: every <script>…</script> region removed, because script contents are never page text. */
function pageText(html) {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
}

test("the scan reads page text, not script bytes — a script literal is not the bug, a text literal is", () => {
  const inScript = "<html><body><span>Today</span><script>/* renders as [object Object] when concatenated */</script></body></html>";
  const inText = "<html><body><span>Today · [object Object]</span></body></html>";
  assert.equal(pageText(inScript).includes("[object Object]"), false, "a literal inside a script is not page text");
  assert.equal(pageText(inText).includes("[object Object]"), true, "a literal in the page's text is the bug");
});

test("the built page carries the day rule's fix and the arrived line's delivery", { skip: !built }, () => {
  const p = join(DIST, "residents", "wright", "index.html");
  assert.ok(existsSync(p), "wright's page was not built");
  const html = readFileSync(p, "utf8");
  for (const [what, needle] of [
    ["the day writer", "function applyDay(el, today)"],
    ["the day rule's call", "applyDay(dayEl, b.today);"],
    ["the arrived writer", "function applyArrived(el, done, keptTotal)"],
    ["the arrived call", "applyArrived(arrivedEl, onHouse ? [] : done, keptTotal);"],
    ["the board asks for the open seat", "return questsFor(onHouse ? memberHandles[0] : seat).then(function (b) {"],
    ["the kept denominator", "return !questResets(q);"],
    ["the finished-daily rule", "q.complete === true && !questResets(q)"],
    ["the block heading", "Still to do"],
  ]) {
    assert.ok(html.includes(needle), `${what} is not in the shipped page: ${needle}`);
  }
  assert.equal(html.includes(">Uncounted<"), false, "the old heading still ships");
});
