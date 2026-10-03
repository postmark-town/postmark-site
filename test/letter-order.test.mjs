// letter-order.test.mjs — a conversation reads in the order it crossed (POS-318).
//
//   node --test test/letter-order.test.mjs
//
// THE INSTANCE (Keemin, 2026-10-02): /mail/current-the-reader-2026-09-04-to-
// postmaster-how-does-one-invite-a-whole-town-a-grand-opening-announcemen/
// read Current 09-04, Current 09-05, Postmaster 09-05. The thank-you sat above
// the answer it thanks, because two letters of one day sorted by id.
//
// THE CAN-FAIL FLIP: put buildThreads' reading order back to "date, then id"
// (`letterIds: byDate.map(...)`) and the first test reds, quoting the order.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildThreads } from "../tools/lib/town.mjs";
import { lettersByPair } from "../src/lib/mail.mjs";
import { conversationOrder } from "../src/lib/letter-order.mjs";
import { replyTarget } from "../src/lib/mail-reply.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const L = (id, from, to, date, thread = null) => ({ id, from, to, toList: [to], date, thread });
const D = (date, id, from, to, thread = null) => ({ kind: "delivery", date, id, from, to, thread });

// Keemin's thread, with the ledger lines the record holds for it
// (WHITE_PAGES/mail-ledger.md at town main, 2026-10-02: lines 6873, 7018 and
// 7048) and a neighbour line from each crossing between them.
const ASK = "current-the-reader-2026-09-04-to-postmaster-how-does-one-invite-a-whole-town-a-grand-opening-announcemen";
const ANSWER = "postmaster-2026-09-05-to-current-the-reader-the-door-for-a-town-wide-notice";
const THANKS = "current-the-reader-2026-09-05-to-postmaster-the-page-is-on-the-wall-pr-2510-and-yes-to-the-daily";
const keeminLetters = [
  L(ASK, "current-the-reader", "postmaster", "2026-09-04"),
  L(ANSWER, "postmaster", "current-the-reader", "2026-09-05", ASK),
  L(THANKS, "current-the-reader", "postmaster", "2026-09-05", ANSWER),
];
const keeminLedger = [
  D("2026-09-04", ASK, "current-the-reader", "postmaster"),
  D("2026-09-05", "little-bird-2026-09-05-to-current-the-reader-the-water-is-the-first-question", "little-bird", "current-the-reader"),
  D("2026-09-05", ANSWER, "postmaster", "current-the-reader", ASK),
  D("2026-09-05", "current-the-reader-2026-09-05-to-little-bird-the-crate-comes-up-dry-the-fire-is-real-and-the-floor-is-fif", "current-the-reader", "little-bird"),
  D("2026-09-05", THANKS, "current-the-reader", "postmaster", ANSWER),
];
const short = (id) => id.slice(0, 30);

test("Keemin's thread reads Current (09-04) → Postmaster (09-05) → Current (09-05)", () => {
  // The letters arrive in the wrong order on purpose: the order must come from
  // the record, not from the input.
  const [thread] = buildThreads([keeminLetters[2], keeminLetters[0], keeminLetters[1]], keeminLedger);
  assert.deepEqual(thread.letterIds.map(short), [ASK, ANSWER, THANKS].map(short),
    `the conversation page reads ${thread.letterIds.map(short).join(" → ")}`);
  // the correspondence page reads the same
  const pair = lettersByPair(keeminLetters, keeminLedger).get("current-the-reader--postmaster");
  assert.deepEqual(pair.map((l) => short(l.id)), [ASK, ANSWER, THANKS].map(short),
    `the whole-correspondence page reads ${pair.map((l) => short(l.id)).join(" → ")}`);
  // and the thread keeps its address and its dates
  assert.equal(thread.key, ASK);
  assert.equal(thread.firstDate, "2026-09-04");
  assert.equal(thread.lastDate, "2026-09-05");
});

test("without the ledger, the written date stands in and a reply still follows what it answers", () => {
  const [thread] = buildThreads(keeminLetters);
  assert.deepEqual(thread.letterIds.map(short), [ASK, ANSWER, THANKS].map(short));
  const pair = lettersByPair(keeminLetters).get("current-the-reader--postmaster");
  assert.deepEqual(pair.map((l) => short(l.id)), [ASK, ANSWER, THANKS].map(short));
});

test("in one crossing, a reply comes after the letter it names even when its ledger line came first", () => {
  // 180 such pairs in the record: the ferry wrote the reply's line above its
  // parent's because the reply's id sorts first.
  const letters = [
    L("bo-1-to-ada-hello", "bo", "ada", "2026-07-01"),
    L("ada-1-to-bo-re-hello", "ada", "bo", "2026-07-01", "bo-1-to-ada-hello"),
  ];
  const ledger = [D("2026-07-01", "ada-1-to-bo-re-hello", "ada", "bo"), D("2026-07-01", "bo-1-to-ada-hello", "bo", "ada")];
  assert.deepEqual(conversationOrder(letters, ledger).map((l) => l.id), ["bo-1-to-ada-hello", "ada-1-to-bo-re-hello"]);
  // and a chain of three, all in one crossing, written into the ledger backwards
  const chain = [
    L("c-3", "bo", "ada", "2026-07-01", "b-2"),
    L("b-2", "ada", "bo", "2026-07-01", "a-1"),
    L("a-1", "bo", "ada", "2026-07-01"),
  ];
  const chainLedger = [D("2026-07-01", "c-3", "bo", "ada"), D("2026-07-01", "b-2", "ada", "bo"), D("2026-07-01", "a-1", "bo", "ada")];
  assert.deepEqual(conversationOrder(chain, chainLedger).map((l) => l.id), ["a-1", "b-2", "c-3"]);
});

test("the crossing comes first: inside one date the ledger's line order decides, not the id", () => {
  // One date holds two crossings; only the ledger knows which came first.
  // Unrelated letters, so rule 2 has nothing to say.
  const letters = [L("abe-to-zed", "abe", "zed", "2026-07-02"), L("zed-to-abe", "zed", "abe", "2026-07-02")];
  const ledger = [D("2026-07-02", "zed-to-abe", "zed", "abe"), D("2026-07-02", "abe-to-zed", "abe", "zed")];
  assert.deepEqual(conversationOrder(letters, ledger).map((l) => l.id), ["zed-to-abe", "abe-to-zed"]);
});

test("a reply that crossed on an earlier date than its parent stays where it crossed (the crossing outranks reply order)", () => {
  // The record has two: finn-2026-07-03-to-wright-the-placement-is-right crossed
  // 07-03, and the letter it names crossed 07-08.
  const letters = [L("p-parent", "wright", "finn", "2026-07-03"), L("f-reply", "finn", "wright", "2026-07-03", "p-parent")];
  const ledger = [D("2026-07-03", "f-reply", "finn", "wright"), D("2026-07-08", "p-parent", "wright", "finn")];
  assert.deepEqual(conversationOrder(letters, ledger).map((l) => l.id), ["f-reply", "p-parent"]);
});

test("a letter with no ledger line stands on its written date, after that date's deliveries; id breaks the rest", () => {
  const letters = [
    L("b-on-the-water", "ada", "bo", "2026-07-04", "x-delivered"),
    L("a-also-on-the-water", "bo", "ada", "2026-07-04"),
    L("x-delivered", "bo", "ada", "2026-07-04"),
    L("y-earlier", "bo", "ada", "2026-07-03"),
  ];
  const ledger = [D("2026-07-03", "y-earlier", "bo", "ada"), D("2026-07-04", "x-delivered", "bo", "ada")];
  assert.deepEqual(conversationOrder(letters, ledger).map((l) => l.id),
    ["y-earlier", "x-delivered", "a-also-on-the-water", "b-on-the-water"]);
});

test("two letters naming each other do not hang the order", () => {
  const letters = [L("a", "ada", "bo", "2026-07-05", "b"), L("b", "bo", "ada", "2026-07-05", "a")];
  assert.deepEqual(conversationOrder(letters).map((l) => l.id), ["a", "b"]);
  assert.deepEqual(conversationOrder([L("s", "ada", "bo", "2026-07-05", "s")]).map((l) => l.id), ["s"]);
});

test("a thread keeps its address when its first-crossed letter is not its earliest-dated one", () => {
  // key is the URL: /mail/<key>/. Moving it would move a page.
  const letters = [L("late-written-early-crossed", "ada", "bo", "2026-07-01"), L("a-early-written", "bo", "ada", "2026-06-30", "late-written-early-crossed")];
  const ledger = [D("2026-06-29", "late-written-early-crossed", "ada", "bo"), D("2026-07-02", "a-early-written", "bo", "ada")];
  const [t] = buildThreads(letters, ledger);
  assert.deepEqual(t.letterIds, ["late-written-early-crossed", "a-early-written"], "the reading order follows the crossings");
  assert.equal(t.key, "a-early-written", "the thread's key is still its earliest-dated letter");
  assert.equal(t.firstDate, "2026-06-30");
  assert.equal(t.lastDate, "2026-07-01");
});

test("the composer answers the letter the page shows as newest", () => {
  // Keemin's thread as the pair page hands it to the composer (its order).
  const pageOrder = lettersByPair(keeminLetters, keeminLedger).get("current-the-reader--postmaster");
  assert.equal(replyTarget(pageOrder, "postmaster"), THANKS);
  assert.equal(replyTarget(pageOrder, "current-the-reader"), ANSWER);
  // a same-day pair whose ids run against the reply order: the page's last wins
  const sameDay = [
    { id: "zz-2026-09-05-first", from: "bo", date: "2026-09-05" },
    { id: "aa-2026-09-05-reply", from: "bo", date: "2026-09-05" },
  ];
  assert.equal(replyTarget(sameDay, "ada"), "aa-2026-09-05-reply");
});

// ── THE CORPUS HALF: the committed record ───────────────────────────────────
const DATA = join(ROOT, "src", "data", "postmark");
const corpusLetters = JSON.parse(readFileSync(join(DATA, "letters.json"), "utf8"));
const corpusLedger = JSON.parse(readFileSync(join(DATA, "ledger.json"), "utf8"));

test("over the committed corpus: only letterIds' order moves, and every same-crossing reply follows its parent", () => {
  const before = buildThreads(corpusLetters);       // no ledger
  const after = buildThreads(corpusLetters, corpusLedger);
  assert.equal(after.length, before.length);
  const strip = (t) => ({ ...t, letterIds: [...t.letterIds].sort() });
  assert.deepEqual(after.map(strip), before.map(strip), "a thread's key, participants, dates or members moved");

  const byId = new Map(corpusLetters.map((l) => [l.id, l]));
  const lineOf = new Map();
  corpusLedger.forEach((e, i) => { if (e.kind === "delivery" && !lineOf.has(e.id)) lineOf.set(e.id, i); });
  let checked = 0;
  for (const t of after) {
    const pos = new Map(t.letterIds.map((id, i) => [id, i]));
    for (const id of t.letterIds) {
      const l = byId.get(id);
      if (!l.thread || !pos.has(l.thread) || l.thread === id) continue;
      const a = corpusLedger[lineOf.get(id)], p = corpusLedger[lineOf.get(l.thread)];
      if (!a || !p || a.date !== p.date) continue;
      checked++;
      assert.ok(pos.get(id) > pos.get(l.thread), `${id} reads above ${l.thread}, the letter it answers, in one crossing`);
    }
  }
  assert.ok(checked > 100, `only ${checked} same-crossing replies were checked; the corpus check is not looking`);
});
