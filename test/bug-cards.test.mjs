// bug-cards.test.mjs — the Bug Catcher's page as one card per bug (POS-547).
//
//   node --test test/bug-cards.test.mjs
//
// Darko, 2026-10-09: "one expandable card per bug. Clicking a bug shows what
// stage it's at, who contributed each earlier stage, and where the links lead."
// The read is the office's GET /posts?class=bug with each row's `history`
// (postmark-office#462); the fixture is hand-written in that shape
// (test/fixtures/office-bug-history.json).

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  cardsOf, paintCards, paintPager, hallOf, paintHall, pagePath, PAGE_SIZE, CARD_GROUPS, CARDS_FAILED, CARDS_EMPTY, JAR_ART, NOT_YET_PAID, NO_HISTORY,
  LEGACY_LINE, LEGACY_CONTINUED, isLegacyPost, TOWN_HANDS, TOWN_NAMES, HALL_NO_HISTORY, HALL_NO_STAMPS,
} from "../src/lib/bug-strip.mjs";
import { mailPagerItems } from "../src/lib/mail.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const READ = JSON.parse(readFileSync(join(ROOT, "test", "fixtures", "office-bug-history.json"), "utf8"));
const SRC = readFileSync(join(ROOT, "src", "lib", "bug-strip.mjs"), "utf8");
const card = (board, id) => board.groups.flatMap((g) => g.cards).find((c) => c.id === id);

// A document just big enough for the painter, whose innerHTML refuses.
function stubDoc() {
  const make = (tag) => {
    const el = {
      tagName: tag.toUpperCase(), className: "", dataset: {}, children: [], textContent: "", href: "", rel: "", target: "",
      attrs: {}, listeners: {},
      setAttribute(k, v) { el.attrs[k] = v; },
      addEventListener(type, fn) { el.listeners[type] = fn; },
      append(...c) { el.children.push(...c); },
      replaceChildren(...c) { el.children = [...c]; },
    };
    Object.defineProperty(el, "innerHTML", { set() { throw new Error("innerHTML used"); }, get() { return ""; } });
    return el;
  };
  return { createElement: make, root: make("div") };
}
const textOf = (el) => [el.textContent, ...el.children.map(textOf)].filter(Boolean).join(" ");
const find = (el, pred) => (pred(el) ? [el] : []).concat(...el.children.map((c) => find(c, pred)));
const cls = (name) => (e) => e.className.split(" ").includes(name);

test("cardsOf: one card per post, grouped in the office's order: open bugs furthest stage first, the shipped, the legacy shelf, the set aside last", () => {
  const b = cardsOf(READ);
  assert.equal(b.ok, true);
  assert.equal(b.total, READ.posts.length);
  assert.deepEqual(b.groups.map((g) => [g.key, g.cards.map((c) => c.id)]), [
    ["fixed", ["sage/old-crack"]],
    ["reproduced", ["kinofire/stamps-overlap"]],
    ["confirmed", ["vermillion/spotted"]],
    ["reported", ["mari/letters-vanish"]],
    ["shipped", ["wildcat/preview-disagrees"]],
    ["set-aside", ["sage/dupe", "odd/not-one"]],
  ]);
  assert.deepEqual(CARD_GROUPS.map((g) => g.key), ["fixed", "briefed", "diagnosed", "reproduced", "confirmed", "reported", "shipped", "legacy", "set-aside"],
    "the page's groups are not the office's order (office bugs.mjs § THE JAR'S ORDER)");
  assert.deepEqual(b.groups.map((g) => g.label), ["Fixed, shipping soon", "Reproduced", "Spotted", "Reported", "Shipped", "Set aside"]);
});

test("cardsOf: the shipped bug's ladder names who did each stage, when, what it paid and where it points; a stage it jumped is skipped", () => {
  const c = card(cardsOf(READ), "wildcat/preview-disagrees");
  assert.deepEqual([c.critter, c.namedBy, c.caught, c.picture], ["the Two-Minded Moth", "lupi", true, "https://media.postmark.town/media/iris/moth-2.png"]);
  assert.deepEqual([c.issue, c.pr, c.release], [
    "https://github.com/postmark-town/postmark/issues/3555",
    "https://github.com/postmark-town/postmark-office/pull/461",
    "https://github.com/postmark-town/postmark-office/releases/tag/release/2026-w42"]);
  assert.deepEqual(c.ladder.map((r) => [r.stage, r.who, r.paid, r.reached, r.skipped, r.day]), [
    ["reported", "wildcat", null, true, false, "Oct 6"],
    ["confirmed", "wildcat", 2, true, false, "Oct 6"],
    ["reproduced", "kogane", 3, true, false, "Oct 6"],
    ["diagnosed", "kogane", 5, true, false, "Oct 7"],
    ["briefed", null, null, true, true, ""],
    ["fixed", "lupi", 25, true, false, "Oct 9"],        // 23:30Z is 19:30 in the town's time
    ["shipped", "Darko", null, true, false, "Oct 11"],   // credits no one: the hand that shipped it, keemin, who is Darko in town
  ]);
  assert.equal(c.ladder[3].link, "https://github.com/postmark-town/postmark/issues/3555#issuecomment-1");
});

test("cardsOf: an open bug's later stages are not reached; a credited stage with no ledger line is unpaid; the reporter's hand is named", () => {
  const b = cardsOf(READ);
  const k = card(b, "kinofire/stamps-overlap");
  assert.deepEqual(k.ladder.map((r) => [r.stage, r.reached, r.who, r.paid]), [
    ["reported", true, "kinofire", null], ["confirmed", true, "kinofire", null], ["reproduced", true, "seven", 3],
    ["diagnosed", false, null, null], ["briefed", false, null, null], ["fixed", false, null, null], ["shipped", false, null, null],
  ]);
  assert.equal(k.caught, false);
  assert.equal(k.critter, null, "an open bug has no name yet");
  const m = card(b, "mari/letters-vanish");
  assert.deepEqual([m.ladder[0].who, m.ladder[0].hand], ["mari", "bugcatcher"]);
});

test("cardsOf: a side exit's ladder ends at its exit, from where it left", () => {
  const b = cardsOf(READ);
  assert.deepEqual(card(b, "sage/dupe").ladder.map((r) => [r.stage, r.who, r.paid]), [["reported", "sage", null], ["confirmed", "sage", 2], ["duplicate", "bugcatcher", null]]);
  assert.deepEqual(card(b, "odd/not-one").ladder.map((r) => r.stage), ["reported", "not-a-bug"]);
  assert.equal(card(b, "odd/not-one").aside, true);
});

test("cardsOf: only the town's own GitHub becomes a link, and only the town's media a picture; markup is text", () => {
  const b = cardsOf(READ);
  const m = card(b, "mari/letters-vanish");
  assert.equal(m.issue, null, "a javascript: issue became a link");
  assert.equal(m.title, "<img src=x onerror=alert(1)> letters vanish");
  const v = card(b, "vermillion/spotted");
  assert.deepEqual(v.ladder.slice(0, 2).map((r) => r.link), [null, null], "a link off the town's org survived");
  const s = card(b, "sage/old-crack");
  assert.deepEqual([s.critter, s.picture], ["<b>Crackle</b>", null]);
});

test("cardsOf: a failed read is a failed read, never an empty one; a read before #462 (no history) says skipped about nothing", () => {
  for (const bad of [null, undefined, {}, { posts: "no" }, "<html>"]) assert.equal(cardsOf(bad).ok, false, `${JSON.stringify(bad)} read as cards`);
  assert.deepEqual(cardsOf({ ...READ, total: 0, posts: [] }), { ok: true, groups: [], total: 0, page: { current: 1, pages: 1, limit: null } });
  const old = cardsOf({ ...READ, posts: READ.posts.map(({ history, ...p }) => p) });
  assert.equal(old.total, READ.posts.length);
  const w = card(old, "wildcat/preview-disagrees");
  assert.deepEqual(w.ladder.map((r) => [r.reached, r.skipped, r.who]), Array(7).fill([true, false, null]));
});

test("paintCards: each bug is one <details>; its summary is the jar's slot, the title, the reporter and the stage", () => {
  const doc = stubDoc();
  paintCards(doc.root, cardsOf(READ), doc);
  const cards = find(doc.root, (e) => e.tagName === "DETAILS");
  assert.equal(cards.length, READ.posts.length);
  assert.deepEqual(cards.map((d) => d.dataset.post), ["sage/old-crack", "kinofire/stamps-overlap", "vermillion/spotted", "mari/letters-vanish", "wildcat/preview-disagrees", "sage/dupe", "odd/not-one"]);
  for (const d of cards) assert.equal(d.children[0].tagName, "SUMMARY");
  const sum = (id) => cards.find((d) => d.dataset.post === id).children[0];
  assert.equal(find(sum("kinofire/stamps-overlap"), cls("bc-img"))[0].src, JAR_ART.open);
  assert.equal(textOf(find(sum("kinofire/stamps-overlap"), cls("bc-name"))[0]), "?");
  assert.match(textOf(sum("kinofire/stamps-overlap")), /Quest standings overlap at mobile width reported by kinofire Reproduced/);
  assert.equal(find(sum("wildcat/preview-disagrees"), cls("bc-img"))[0].src, "https://media.postmark.town/media/iris/moth-2.png");
  assert.equal(textOf(find(sum("sage/old-crack"), cls("bc-name"))[0]), "<b>Crackle</b>", "a critter's markup is not text");
  assert.ok(find(doc.root, cls("bc-group-h")).some((h) => h.textContent === "Spotted"), "no Spotted heading");
  assert.doesNotMatch(SRC.slice(SRC.indexOf("export function paintCards")), /innerHTML|insertAdjacentHTML|outerHTML/);
});

test("paintCards: the expanded card lists every stage's credit, day, stamps and link; unreached stages say not yet", () => {
  const doc = stubDoc();
  paintCards(doc.root, cardsOf(READ), doc);
  const w = find(doc.root, (e) => e.tagName === "DETAILS" && e.dataset.post === "wildcat/preview-disagrees")[0];
  const steps = find(w, cls("bc-step"));
  assert.deepEqual(steps.map((s) => textOf(s).replace(/\s+/g, " ")), [
    "Reported wildcat Oct 6",
    "Spotted wildcat Oct 6 +2 ✦",
    "Reproduced kogane Oct 6 +3 ✦",
    "Diagnosed kogane Oct 7 +5 ✦ the cause →",
    "Briefed skipped",
    "Fixed lupi Oct 9 +25 ✦ the PR →",
    "Shipped Darko Oct 11 the release →",
  ]);
  assert.ok(steps.at(-1).className.includes("is-now"));
  assert.deepEqual(find(w, (e) => e.tagName === "A").map((a) => [a.textContent, a.href]).slice(-3), [
    ["issue #3555 →", "https://github.com/postmark-town/postmark/issues/3555"],
    ["the PR →", "https://github.com/postmark-town/postmark-office/pull/461"],
    ["the release →", "https://github.com/postmark-town/postmark-office/releases/tag/release/2026-w42"],
  ]);
  assert.match(textOf(w), /named by lupi, who fixed it/);
  const k = find(doc.root, (e) => e.tagName === "DETAILS" && e.dataset.post === "kinofire/stamps-overlap")[0];
  assert.deepEqual(find(k, cls("bc-step")).map((s) => textOf(s).replace(/\s+/g, " ")).slice(1), [
    "Spotted kinofire Oct 8 not yet paid", "Reproduced seven Oct 8 +3 ✦", "Diagnosed not yet", "Briefed not yet", "Fixed not yet", "Shipped not yet"]);
  const m = find(doc.root, (e) => e.tagName === "DETAILS" && e.dataset.post === "mari/letters-vanish")[0];
  assert.match(textOf(m), /mari\s+· put up by bugcatcher/);
  // every ✦ sits in a stamp element
  for (const star of find(doc.root, (e) => e.textContent === "✦")) assert.equal(star.className, "m-u");
});

test("paintCards: a failed read says so, and an empty town says something else", () => {
  const failed = stubDoc();
  paintCards(failed.root, cardsOf(null), failed);
  assert.equal(textOf(failed.root), CARDS_FAILED);
  const empty = stubDoc();
  paintCards(empty.root, cardsOf({ ...READ, total: 0, posts: [] }), empty);
  assert.equal(textOf(empty.root), CARDS_EMPTY);
  assert.notEqual(CARDS_FAILED, CARDS_EMPTY);
});

// ── The legacy shelf (POS-558, Darko 2026-10-10) ─────────────────────────────
// Supersedes the 09-29 review's "unnamed": a finished bug with no name leaves
// the jar's stages for its own shelf, the pages' last group, crediting the
// resident who caught it.

const LEGACY = [
  { class: "bug", id: "kogane/refused-claim", title: "A refused claim was not legible", author: "kogane", state: "shipped",
    fields: { issue: "https://github.com/postmark-town/postmark/issues/2858" },
    history: [
      { stage: "reported", at: "2026-09-20T10:00:00.000Z", hand: null, credit: "kogane", link: null, stamps_paid: null },
      { stage: "confirmed", at: "2026-09-20T11:00:00.000Z", hand: "bugcatcher", credit: "kogane", link: null, stamps_paid: null },
      { stage: "reproduced", at: "2026-09-20T12:00:00.000Z", hand: "bugcatcher", credit: "kogane", link: null, stamps_paid: 3 },
      { stage: "shipped", at: "2026-09-21T10:00:00.000Z", hand: "keemin", credit: null, link: null, stamps_paid: null },
    ] },
  { class: "bug", id: "odd/fixed-before-names", title: "Fixed before the jar", author: "keemin", state: "fixed", fields: { size: "S" }, history: [] },
];
const WITH_LEGACY = { ...READ, total: READ.posts.length + LEGACY.length, posts: [...READ.posts, ...LEGACY] };

test("cardsOf: a finished bug with no name goes on the legacy shelf, after the shipped and before the set aside, with its line; a named one stays with its stage", () => {
  const b = cardsOf(WITH_LEGACY);
  assert.deepEqual(b.groups.map((g) => g.key).slice(-3), ["shipped", "legacy", "set-aside"]);
  const legacy = b.groups.find((g) => g.key === "legacy");
  assert.deepEqual(legacy.cards.map((c) => c.id), ["kogane/refused-claim", "odd/fixed-before-names"]);
  assert.equal(legacy.label, "Legacy bugs");
  assert.equal(legacy.note, LEGACY_LINE);
  const elsewhere = b.groups.filter((g) => g.key !== "legacy").flatMap((g) => g.cards.map((c) => c.id));
  assert.ok(!elsewhere.includes("kogane/refused-claim") && !elsewhere.includes("odd/fixed-before-names"), "a legacy bug is still among the stages");
  assert.ok(elsewhere.includes("wildcat/preview-disagrees") && elsewhere.includes("sage/old-crack"), "a named bug left its stage");
  assert.ok(!cardsOf(READ).groups.some((g) => g.key === "legacy"), "an empty shelf is drawn");
});

test("paintCards: the legacy cards credit their catcher by name and link their issue, under the shelf's line; 'unnamed' is printed nowhere", () => {
  const doc = stubDoc();
  paintCards(doc.root, cardsOf(WITH_LEGACY), doc);
  const shelf = find(doc.root, (e) => e.dataset.group === "legacy")[0];
  assert.equal(textOf(find(shelf, cls("bc-group-note"))[0]), LEGACY_LINE);
  const cards = find(shelf, (e) => e.tagName === "DETAILS");
  assert.deepEqual(cards.map((d) => d.dataset.post), ["kogane/refused-claim", "odd/fixed-before-names"]);
  const k = cards[0];
  assert.ok(k.className.includes("is-legacy"));
  assert.match(textOf(k.children[0]), /A refused claim was not legible caught by kogane Shipped/);
  assert.equal(find(k, cls("bc-name")).length, 0, "a legacy card shows a name slot");
  assert.equal(find(k, cls("bc-img"))[0].src, JAR_ART.finished);
  assert.deepEqual(find(k, (e) => e.tagName === "A").map((a) => a.href), ["https://github.com/postmark-town/postmark/issues/2858"]);
  assert.match(textOf(cards[1]), /caught by Darko/);
  assert.doesNotMatch(textOf(doc.root), /unnamed/i);
  assert.doesNotMatch(SRC.replace(/^\s*\/\/.*$/gm, ""), /"unnamed"|bc-unnamed/, "the code still prints unnamed");
  assert.match(LEGACY_LINE, /spotted before the Bug Catcher's jar existed/);
  assert.match(LEGACY_LINE, /credit the residents who caught them/);
});

test("a legacy card's credited stage with no ledger line says nothing about stamps, never 'not yet paid'; a jar card still says it", () => {
  const doc = stubDoc();
  paintCards(doc.root, cardsOf(WITH_LEGACY), doc);
  const k = find(doc.root, (e) => e.tagName === "DETAILS" && e.dataset.post === "kogane/refused-claim")[0];
  const stamps = (d, stage) => textOf(find(d, (e) => cls("bc-step")(e) && e.dataset.stage === stage)[0].children[3]);
  assert.equal(stamps(k, "confirmed"), "", "a legacy stage that will never pay says something");
  assert.equal(stamps(k, "reproduced"), "+3 ✦", "a legacy stage that paid lost its stamps");
  assert.doesNotMatch(textOf(k), /not yet paid/);
  const jar = find(doc.root, (e) => e.tagName === "DETAILS" && e.dataset.post === "kinofire/stamps-overlap")[0];
  assert.equal(stamps(jar, "confirmed"), NOT_YET_PAID, "a jar card stopped saying not yet paid");
});

test("the legacy heading and its line are drawn once, where the shelf begins; a later page heads it 'continued', without the line", () => {
  const page = (posts, offset) => ({ ...READ, total: 30, limit: 2, offset, posts });
  assert.equal(isLegacyPost(LEGACY[0]), true);
  assert.equal(isLegacyPost(LEGACY[1]), true, "a fixed bug with no name");
  assert.equal(isLegacyPost(READ.posts.find((p) => p.id === "wildcat/preview-disagrees")), false, "a named bug");
  assert.equal(isLegacyPost(READ.posts.find((p) => p.id === "sage/dupe")), false, "a bug set aside");
  // the page where it begins: heading and line
  const begins = cardsOf(page([READ.posts[0], LEGACY[0]], 10), { legacyBefore: false }).groups.find((g) => g.key === "legacy");
  assert.deepEqual([begins.label, begins.note], ["Legacy bugs", LEGACY_LINE]);
  // a later page: continued, no line
  const later = cardsOf(page(LEGACY, 12), { legacyBefore: true }).groups.find((g) => g.key === "legacy");
  assert.deepEqual([later.label, later.note], [LEGACY_CONTINUED, null]);
  const doc = stubDoc();
  paintCards(doc.root, cardsOf(page(LEGACY, 12), { legacyBefore: true }), doc);
  assert.equal(textOf(find(doc.root, cls("bc-group-h"))[0]), "Legacy bugs, continued");
  assert.equal(find(doc.root, cls("bc-group-note")).length, 0, "the shelf's line repeats on a later page");
  // the page asks for the bug before only when it opens on a legacy bug
  assert.equal(pagePath(11, 1), "/posts?class=bug&limit=1&offset=11");
});

// ── The pages (POS-558, addendum 1) ──────────────────────────────────────────

test("cardsOf: the office's paged answer says which page this is and how many there are; an answer before paging is one page", () => {
  assert.equal(pagePath(0), `/posts?class=bug&limit=${PAGE_SIZE}&offset=0`);
  assert.equal(pagePath(48), `/posts?class=bug&limit=${PAGE_SIZE}&offset=48`);
  assert.equal(pagePath(-3), `/posts?class=bug&limit=${PAGE_SIZE}&offset=0`);
  const paged = (offset, total) => ({ ...READ, total, shown: READ.posts.length, limit: 7, offset, complete: offset + 7 >= total });
  assert.deepEqual(cardsOf(paged(0, 52)).page, { current: 1, pages: 8, limit: 7 });
  assert.deepEqual(cardsOf(paged(21, 52)).page, { current: 4, pages: 8, limit: 7 });
  assert.equal(cardsOf(paged(21, 52)).total, 52, "the whole read's total, not the page's");
  assert.deepEqual(cardsOf(READ).page, { current: 1, pages: 1, limit: null }, "an office before POS-558 sends every bug: one page");
});

test("paintPager: the numbered pager is mailPagerItems in MailPager's words; each page is a button that asks for it; one page draws nothing", () => {
  const asked = [];
  const doc = stubDoc();
  const nav = doc.createElement("nav");
  const board = cardsOf({ ...READ, total: 240, limit: 24, offset: 120 });   // page 6 of 10
  assert.equal(paintPager(nav, board, (n) => asked.push(n), doc), true);
  const parts = find(nav, (e) => /(^| )mp-(step|page|gap)( |$)/.test(e.className)).map((e) => e.textContent);
  assert.deepEqual(parts, ["← newer", "1", "…", "4", "5", "6", "7", "8", "…", "10", "older →"]);
  assert.deepEqual(mailPagerItems(6, 10), [1, "gap", 4, 5, 6, 7, 8, "gap", 10], "the pager is not mail.mjs's");
  const now = find(nav, cls("on"))[0];
  assert.equal([now.tagName, now.textContent].join(" "), "SPAN 6", "the current page is a button");
  const buttons = find(nav, (e) => e.tagName === "BUTTON");
  assert.deepEqual(buttons.map((b) => b.dataset.page), ["5", "1", "4", "5", "7", "8", "10", "7"]);
  for (const b of buttons) b.listeners.click();
  assert.deepEqual(asked, [5, 1, 4, 5, 7, 8, 10, 7]);
  const first = doc.createElement("nav");
  paintPager(first, cardsOf({ ...READ, total: 240, limit: 24, offset: 0 }), () => {}, doc);
  assert.ok(find(first, cls("off")).some((e) => e.textContent === "← newer"), "page 1 offers a newer page");
  for (const one of [cardsOf(READ), cardsOf(null), cardsOf({ ...READ, total: 7, limit: 24, offset: 0 })]) {
    const n = doc.createElement("nav");
    assert.equal(paintPager(n, one, () => {}, doc), false);
    assert.equal(n.children.length, 0);
  }
});

// ── The Bug Catchers' Hall of Fame (POS-558, Darko 2026-10-10) ───────────────
// The office serves the totals over the whole record on every page
// (`catchers`); the page never sums pages.

const CATCHERS = [
  { handle: "wright", stamps: 90, bugs: 4 },     // a founder's hand: never ranked
  { handle: "lupi", stamps: 25, bugs: 1 },
  { handle: "sage", stamps: 12, bugs: 2 },
  { handle: "kogane", stamps: 8, bugs: 2 },
  { handle: "seven", stamps: 3, bugs: 1 },
  { handle: "vermillion", stamps: 2, bugs: 1 },
  { handle: "wildcat", stamps: 2, bugs: 1 },
  { handle: "bugcatcher", stamps: 0, bugs: 3 },  // a meep: never listed
  { handle: "mari", stamps: 0, bugs: 1 },
  { handle: "kinofire", stamps: 0, bugs: 1 },
  { handle: "ellery", stamps: 0, bugs: 3 },
];
const WITH_CATCHERS = { ...READ, total: 7, limit: 24, offset: 0, catchers: CATCHERS };

test("hallOf: the office's catchers, ranked by stamps (ties share a rank), the unpaid below by bugs; the town's hands are never listed", () => {
  const h = hallOf(WITH_CATCHERS);
  assert.deepEqual([h.ok, h.known, h.stamps], [true, true, true]);
  assert.deepEqual(h.ranked.map((r) => [r.rank, r.name, r.stamps, r.bugs]), [
    [1, "lupi", 25, 1], [2, "sage", 12, 2], [3, "kogane", 8, 2], [4, "seven", 3, 1], [5, "vermillion", 2, 1], [5, "wildcat", 2, 1],
  ]);
  assert.deepEqual(h.also.map((r) => [r.name, r.bugs]), [["ellery", 3], ["kinofire", 1], ["mari", 1]]);
  for (const hand of ["bugcatcher", "postmaster", "illuminator", "registrar", "worldkeeper", "architect", "keemin", "keeminlee", "wright"]) assert.ok(TOWN_HANDS.has(hand), hand);
  const every = [...TOWN_HANDS].map((handle) => ({ handle, stamps: 50, bugs: 1 }));
  const listed = hallOf({ ...WITH_CATCHERS, catchers: [...CATCHERS, ...every] });
  for (const hand of TOWN_HANDS) assert.ok(![...listed.ranked, ...listed.also].some((r) => r.handle === hand), `${hand} is on the Hall`);
});

test("hallOf: the Hall is the office's totals, never a sum of the page in hand", () => {
  // this page's history pays lupi 25 and kogane 8; the whole record says otherwise, and the Hall says what the record says
  const h = hallOf({ ...WITH_CATCHERS, catchers: [{ handle: "kogane", stamps: 38, bugs: 14 }, { handle: "lupi", stamps: 45, bugs: 8 }] });
  assert.deepEqual(h.ranked.map((r) => [r.name, r.stamps, r.bugs]), [["lupi", 45, 8], ["kogane", 38, 14]]);
  assert.doesNotMatch(SRC.slice(SRC.indexOf("export function hallOf"), SRC.indexOf("const bugsWord")), /history|stamps_paid/, "hallOf reads the page's history");
});

test("hallOf: a read without catchers says so (not an empty board); catchers with null stamps are listed by bugs with a line saying why; a failed read draws nothing", () => {
  for (const read of [READ, { ...READ, posts: READ.posts.map(({ history, ...p }) => p) }]) {
    const h = hallOf(read);
    assert.deepEqual([h.ok, h.known, h.ranked.length, h.also.length], [true, false, 0, 0]);
    const doc = stubDoc();
    assert.equal(paintHall(doc.root, h, doc), true);
    assert.equal(textOf(doc.root), HALL_NO_HISTORY);
    assert.equal(find(doc.root, (e) => e.tagName === "OL").length, 0);
  }
  const h = hallOf({ ...WITH_CATCHERS, catchers: [{ handle: "sage", stamps: null, bugs: 1 }, { handle: "kogane", stamps: null, bugs: 2 }] });
  assert.deepEqual([h.stamps, h.ranked.length, h.also.map((r) => r.name)], [false, 0, ["kogane", "sage"]]);
  const doc = stubDoc();
  paintHall(doc.root, h, doc);
  assert.equal(textOf(find(doc.root, cls("hof-note"))[0]), HALL_NO_STAMPS);
  assert.doesNotMatch(textOf(doc.root), /✦/);
  const failed = stubDoc();
  assert.equal(paintHall(failed.root, hallOf(null), failed), false, "a failed read draws a Hall");
});

test("paintHall: each row is the name, the stamps (purple) and the bugs credited; Darko is never 'keemin'", () => {
  const doc = stubDoc();
  assert.equal(paintHall(doc.root, hallOf(WITH_CATCHERS), doc), true);
  const rows = find(doc.root, cls("hof-row")).map((r) => textOf(r).replace(/\s+/g, " "));
  assert.deepEqual(rows, [
    "1 lupi 25 ✦ 1 bug", "2 sage 12 ✦ 2 bugs", "3 kogane 8 ✦ 2 bugs", "4 seven 3 ✦ 1 bug", "5 vermillion 2 ✦ 1 bug", "5 wildcat 2 ✦ 1 bug",
    "ellery 3 bugs", "kinofire 1 bug", "mari 1 bug",
  ]);
  assert.match(textOf(doc.root), /Also credited/);
  for (const star of find(doc.root, (e) => e.textContent === "✦")) assert.equal(star.className, "m-u");
  assert.doesNotMatch(textOf(doc.root), /keemin/i);
  assert.equal(TOWN_NAMES.keemin, "Darko");
});

// ── Wright's review of #462 (2026-10-09) ─────────────────────────────────────

test("Darko's hand reads Darko: 'keemin' is printed nowhere on the cards, as hand, credit, reporter or namer", () => {
  const read = { ...READ, posts: [
    ...READ.posts,
    { class: "bug", id: "keemin/founders-own", title: "The founder's own bug", author: "keemin", state: "fixed",
      fields: { size: "S", critter: "Ledger Louse", named_by: "keemin" },
      history: [
        { stage: "reported", at: "2026-10-09T10:00:00.000Z", hand: "keemin", credit: "keemin", link: null, stamps_paid: null },
        { stage: "fixed", at: "2026-10-09T11:00:00.000Z", hand: "keemin", credit: "keemin", link: null, stamps_paid: null },
      ] },
  ] };
  const doc = stubDoc();
  paintCards(doc.root, cardsOf(read), doc);
  const all = textOf(doc.root);
  assert.doesNotMatch(all, /keemin/i, "the page prints 'keemin'");
  const k = find(doc.root, (e) => e.tagName === "DETAILS" && e.dataset.post === "keemin/founders-own")[0];
  assert.match(textOf(k), /reported by Darko/);
  assert.match(textOf(k), /named by Darko, who fixed it/);
  assert.match(textOf(k), /Fixed Darko Oct 9 not yet paid/);
});

test("a null stamps_paid is never 0: a credited paying stage reads 'not yet paid', a stage that pays nothing reads nothing", () => {
  assert.equal(NOT_YET_PAID, "not yet paid");
  const doc = stubDoc();
  paintCards(doc.root, cardsOf(READ), doc);
  const stamps = find(doc.root, cls("bc-stamps")).map(textOf);
  assert.ok(!stamps.some((t) => /(^|\D)0(\D|$)/.test(t)), `a stamp cell reads 0: ${stamps.join(" | ")}`);
  const ship = find(doc.root, (e) => e.tagName === "DETAILS" && e.dataset.post === "wildcat/preview-disagrees")[0];
  assert.equal(textOf(find(ship, (e) => cls("bc-step")(e) && e.dataset.stage === "shipped")[0].children[3]), "", "shipped pays nothing, so it says nothing");
});

test("a card whose read carries no history (or an empty one) says so once, and claims no skips and no names", () => {
  for (const history of [undefined, []]) {
    const read = { ...READ, posts: READ.posts.map((p) => ({ ...p, history })) };
    const doc = stubDoc();
    paintCards(doc.root, cardsOf(read), doc);
    const w = find(doc.root, (e) => e.tagName === "DETAILS" && e.dataset.post === "wildcat/preview-disagrees")[0];
    assert.equal(find(w, cls("bc-note")).length, 1);
    assert.equal(textOf(find(w, cls("bc-note"))[0]), NO_HISTORY);
    assert.doesNotMatch(textOf(w), /skipped|not yet paid/);
    assert.equal(find(w, cls("bc-handle")).length, 0, "a name with no history behind it");
    assert.ok(find(w, cls("bc-step")).every((r) => r.className.includes("is-reached")), "a shipped bug's stages all read reached");
  }
  const doc = stubDoc();
  paintCards(doc.root, cardsOf(READ), doc);
  assert.equal(find(doc.root, cls("bc-note")).length, 0, "a card with history says it has none");
});
