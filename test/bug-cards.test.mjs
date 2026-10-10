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

import { cardsOf, paintCards, CARD_GROUPS, CARDS_FAILED, CARDS_EMPTY, JAR_ART, NOT_YET_PAID, NO_HISTORY } from "../src/lib/bug-strip.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const READ = JSON.parse(readFileSync(join(ROOT, "test", "fixtures", "office-bug-history.json"), "utf8"));
const SRC = readFileSync(join(ROOT, "src", "lib", "bug-strip.mjs"), "utf8");
const card = (board, id) => board.groups.flatMap((g) => g.cards).find((c) => c.id === id);

// A document just big enough for the painter, whose innerHTML refuses.
function stubDoc() {
  const make = (tag) => {
    const el = {
      tagName: tag.toUpperCase(), className: "", dataset: {}, children: [], textContent: "", href: "", rel: "", target: "",
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

test("cardsOf: one card per post; open bugs first by stage, then the ones set aside, shipped last", () => {
  const b = cardsOf(READ);
  assert.equal(b.ok, true);
  assert.equal(b.total, READ.posts.length);
  assert.deepEqual(b.groups.map((g) => [g.key, g.cards.map((c) => c.id)]), [
    ["reported", ["mari/letters-vanish"]],
    ["confirmed", ["vermillion/spotted"]],
    ["reproduced", ["kinofire/stamps-overlap"]],
    ["fixed", ["sage/old-crack"]],
    ["set-aside", ["sage/dupe", "odd/not-one"]],
    ["shipped", ["wildcat/preview-disagrees"]],
  ]);
  assert.deepEqual(CARD_GROUPS.map((g) => g.key).slice(-2), ["set-aside", "shipped"]);
  assert.deepEqual(b.groups.map((g) => g.label), ["Reported", "Spotted", "Reproduced", "Fixed, shipping soon", "Set aside", "Shipped"]);
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
  assert.deepEqual(cardsOf({ ...READ, posts: [] }), { ok: true, groups: [], total: 0, caught: 0 });
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
  assert.deepEqual(cards.map((d) => d.dataset.post), ["mari/letters-vanish", "vermillion/spotted", "kinofire/stamps-overlap", "sage/old-crack", "sage/dupe", "odd/not-one", "wildcat/preview-disagrees"]);
  for (const d of cards) assert.equal(d.children[0].tagName, "SUMMARY");
  const sum = (id) => cards.find((d) => d.dataset.post === id).children[0];
  assert.equal(find(sum("kinofire/stamps-overlap"), cls("bc-img"))[0].src, JAR_ART.open);
  assert.equal(textOf(find(sum("kinofire/stamps-overlap"), cls("bc-name"))[0]), "?");
  assert.match(textOf(sum("kinofire/stamps-overlap")), /Quest standings overlap at mobile width reported by kinofire Reproduced/);
  assert.equal(find(sum("wildcat/preview-disagrees"), cls("bc-img"))[0].src, "https://media.postmark.town/media/iris/moth-2.png");
  assert.equal(textOf(find(sum("sage/old-crack"), cls("bc-name"))[0]), "<b>Crackle</b>", "a critter's markup is not text");
  assert.match(textOf(doc.root), /Spotted · 1/);
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
  paintCards(empty.root, cardsOf({ ...READ, posts: [] }), empty);
  assert.equal(textOf(empty.root), CARDS_EMPTY);
  assert.notEqual(CARDS_FAILED, CARDS_EMPTY);
});

test("cardsOf: a bug fixed before names is lit and 'unnamed'; only a loose bug is '?' (Wright's review of the jar, 2026-09-29)", () => {
  const read = { ...READ, posts: [{ class: "bug", id: "odd/fixed-before-names", title: "Fixed before the jar", author: "odd", state: "fixed", fields: { size: "S" }, history: [] }] };
  const doc = stubDoc();
  paintCards(doc.root, cardsOf(read), doc);
  assert.equal(textOf(find(doc.root, cls("bc-name"))[0]), "unnamed");
  assert.equal(find(doc.root, cls("bc-img"))[0].src, JAR_ART.finished);
  assert.equal(find(doc.root, cls("bc-q")).length, 0);
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
