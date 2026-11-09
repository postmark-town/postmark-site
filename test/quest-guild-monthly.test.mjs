// quest-guild-monthly.test.mjs — the civic quarter's Quest Guild shows the month's quests (POS-954).
//
//   node --test test/quest-guild-monthly.test.mjs     (wholly synthetic: invented quests, a temp town checkout, no network)
//
// LAW (Wright for Darko, 2026-11-09, on Darko's 11-08 20:03 EST "good with your queue picks"): the civic quarter "shows the
// month's quests, Bring a neighbour included, read from the same source as the office board. Keep it small: no redesign."
// The office's board reads the town's registry (`quest-registry.json`); the Guild read the office's quest POSTS, and a
// registry quest with no post has no card there. So a monthly quest is drawn from the registry (civic.mjs § questBoardFrom),
// and the daily and milestone cards stay the posts' exactly as before.
//
// Every title and value below is invented for this file, except the one snapshot test at the end, which reads the committed
// src/data/postmark/quest-registry.json.

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { questBoardFrom, questCards, QUEST_KIND } from "../src/lib/civic.mjs";
import { projectQuestRegistry, readQuestRegistryFromCheckout, QUEST_REGISTRY_FILE } from "../tools/lib/town-quest-registry.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

const row = (id, cadence, over = {}) => ({
  id, title: `Title of ${id}`, cadence, validation: "automatic", source: `how to ${id}`, reward: `reward of ${id}`, target: 3, ...over,
});
const post = (id, cadence, over = {}) => ({
  class: "quest", state: "open", id: `pen/${id}`, fields: { quest: id },
  terms: { title: `Title of ${id}`, source: `how to ${id}`, reward: `reward of ${id}`, cadence, target: 3 }, ...over,
});
const REGISTRY = { quests: [row("water-the-commons", "monthly", { target: 10 }), row("sweep-the-steps", "monthly"), row("a-daily", "daily"), row("a-milestone", "milestone")] };
const POSTS = { posts: [post("a-daily", "daily"), post("a-milestone", "milestone")] };
const titles = (list) => list.map((c) => c.title);

test("a monthly quest the registry defines and no post names reaches the Guild's cards, with the registry's own terms", () => {
  const board = questBoardFrom(POSTS, { registry: REGISTRY });
  assert.deepEqual(board.monthly, [
    { title: "Title of water-the-commons", source: "how to water-the-commons", reward: "reward of water-the-commons", target: 10 },
    { title: "Title of sweep-the-steps", source: "how to sweep-the-steps", reward: "reward of sweep-the-steps", target: 3 },
  ], "no post exists for either, and both are drawn, in the registry's order");
  const cards = questCards({ completedBy: {}, total: 4 }, board);
  const monthly = cards.filter((c) => c.title.includes("water") || c.title.includes("sweep"));
  assert.deepEqual(monthly.map((c) => c.cadence), [QUEST_KIND.monthly, QUEST_KIND.monthly], "labelled monthly on the card");
  assert.equal(QUEST_KIND.monthly, "monthly");
});

test("ANOTHER monthly definition follows the same path: no special case for any one quest", () => {
  const more = { quests: [...REGISTRY.quests, row("mend-the-fence", "monthly", { title: "Mend the fence" })] };
  assert.deepEqual(titles(questBoardFrom(POSTS, { registry: more }).monthly), ["Title of water-the-commons", "Title of sweep-the-steps", "Mend the fence"]);
  assert.deepEqual(titles(questBoardFrom(POSTS, { registry: { quests: [row("only-one", "monthly")] } }).monthly), ["Title of only-one"]);
});

test("CONTROLS: no registry draws what the posts drew; daily and milestone cards are the posts' with or without one", () => {
  const without = questBoardFrom(POSTS);
  assert.deepEqual(without.monthly, [], "no registry: no monthly card is invented");
  const withReg = questBoardFrom(POSTS, { registry: REGISTRY });
  assert.deepEqual(withReg.daily, without.daily);
  assert.deepEqual(withReg.milestone, without.milestone);
  assert.deepEqual(titles(without.daily), ["Title of a-daily"]);
  assert.deepEqual(questBoardFrom(POSTS, { registry: { quests: [] } }).monthly, [], "an empty registry adds nothing");
  assert.deepEqual(questBoardFrom(POSTS, { registry: {} }).monthly, [], "a registry with no rows adds nothing");
  assert.deepEqual(questBoardFrom(null, { registry: null }), { daily: [], monthly: [], milestone: [] }, "no posts, no registry: an empty board, no throw");
});

test("the registry adds the monthly cadence and no other: a daily or milestone row with no post is not drawn; pots and one-time rows never are", () => {
  const reg = { quests: [row("unposted-daily", "daily"), row("unposted-milestone", "milestone"), row("an-arrival", "one-time"),
    row("a-pot", "ongoing", { subtype: "bounty" }), row("a-bounty-claiming-monthly", "monthly", { subtype: "bounty" })] };
  assert.deepEqual(questBoardFrom({ posts: [] }, { registry: reg }), { daily: [], monthly: [], milestone: [] });
});

test("a monthly quest whose post is closed is not drawn (finished is the class's word for no longer asked); an open post is one card, not two", () => {
  const closed = { posts: [post("water-the-commons", "monthly", { state: "closed" })] };
  assert.deepEqual(titles(questBoardFrom(closed, { registry: REGISTRY }).monthly), ["Title of sweep-the-steps"]);
  const open = { posts: [post("water-the-commons", "monthly")] };
  assert.deepEqual(titles(questBoardFrom(open, { registry: REGISTRY }).monthly), ["Title of water-the-commons", "Title of sweep-the-steps"], "the registry's order, once each");
});

test("a monthly POST the registry does not carry is still drawn, after the registry's", () => {
  const extra = { posts: [post("posted-only", "monthly")] };
  assert.deepEqual(titles(questBoardFrom(extra, { registry: REGISTRY }).monthly), ["Title of water-the-commons", "Title of sweep-the-steps", "Title of posted-only"]);
  assert.deepEqual(titles(questBoardFrom(extra).monthly), ["Title of posted-only"], "and with no registry at all, as the posts alone");
});

test("a registry `ends` is the inclusive cutoff, on the town's day, exactly as a post's is (POS-857)", () => {
  const reg = { quests: [row("short-lived", "monthly", { ends: "2026-03-15" }), row("lasting", "monthly")] };
  assert.deepEqual(titles(questBoardFrom(POSTS, { registry: reg, today: "2026-03-14" }).monthly), ["Title of short-lived", "Title of lasting"]);
  assert.deepEqual(titles(questBoardFrom(POSTS, { registry: reg, today: "2026-03-15" }).monthly), ["Title of short-lived", "Title of lasting"], "the ends day itself is offered");
  assert.deepEqual(titles(questBoardFrom(POSTS, { registry: reg, today: "2026-03-16" }).monthly), ["Title of lasting"], "the next town day is not");
  assert.deepEqual(titles(questBoardFrom(POSTS, { registry: reg }).monthly), ["Title of short-lived", "Title of lasting"], "no day given keeps the card, as before");
});

test("a monthly card's count is the board's if the mirror has a column for it, and an honest 'unavailable' (null, never a zero) if it has not", () => {
  const board = questBoardFrom(POSTS, { registry: REGISTRY });
  const none = questCards({ completedBy: { "Title of a-daily": 2 }, total: 9 }, board);
  const sweep = none.find((c) => c.title === "Title of sweep-the-steps");
  assert.equal(sweep.done, null, "no column for it in the mirror: uncounted, which is not zero");
  assert.equal(none.find((c) => c.title === "Title of a-daily").done, 2, "a daily's count is untouched");
  const counted = questCards({ completedBy: { "Title of sweep-the-steps": 4 }, total: 9 }, board);
  assert.equal(counted.find((c) => c.title === "Title of sweep-the-steps").done, 4);
  assert.equal(questCards(null, board).find((c) => c.title === "Title of sweep-the-steps").done, null, "no standings at all: null too");
});

test("the registry is read from a town checkout as a projection of its rows: the fields a card reads, in the file's order, nothing else", () => {
  const dir = mkdtempSync(join(tmpdir(), "quest-guild-monthly-"));
  try {
    writeFileSync(join(dir, QUEST_REGISTRY_FILE), JSON.stringify({ version: 1, note: "n", quests: [
      { ...row("water-the-commons", "monthly"), derivation: "a long builders' note that is documentation only", door: null, awaits: "x", resets: "monthly" },
      { not: "a row" }, null, row("sweep-the-steps", "monthly", { ends: "2026-12-31" }),
    ] }));
    const got = readQuestRegistryFromCheckout(dir);
    assert.deepEqual(got.quests.map((q) => q.id), ["water-the-commons", "sweep-the-steps"], "a row with no id is dropped, the order is the file's");
    assert.deepEqual(Object.keys(got.quests[0]), ["id", "title", "cadence", "validation", "source", "reward", "target"]);
    assert.equal("derivation" in got.quests[0], false, "the builders' note stays in the town");
    assert.equal(got.quests[1].ends, "2026-12-31");
    assert.match(got.source, /^postmark-town\/postmark quest-registry\.json/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("a checkout with no registry, or a file that is not one, throws (the fetch keeps the committed snapshot on it)", () => {
  const dir = mkdtempSync(join(tmpdir(), "quest-guild-monthly-"));
  try {
    assert.throws(() => readQuestRegistryFromCheckout(dir), /no quest-registry\.json in the town checkout/);
    mkdirSync(join(dir, "sub"));
    writeFileSync(join(dir, QUEST_REGISTRY_FILE), JSON.stringify({ quests: "nope" }));
    assert.throws(() => readQuestRegistryFromCheckout(dir), /not the town's quest registry/);
    assert.throws(() => projectQuestRegistry(null), /not the town's quest registry/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("SNAPSHOT: the committed registry the page imports is the projection's shape and carries the monthly Bring a neighbour", () => {
  const snap = JSON.parse(readFileSync(join(HERE, "..", "src", "data", "postmark", "quest-registry.json"), "utf8"));
  assert.ok(Array.isArray(snap.quests) && snap.quests.length > 0);
  assert.match(snap.source, /^postmark-town\/postmark quest-registry\.json/);
  for (const q of snap.quests) assert.equal("derivation" in q, false, `${q.id}: the builders' note is not copied`);
  const guild = questBoardFrom({ posts: [] }, { registry: snap });
  assert.ok(titles(guild.monthly).includes("Bring a neighbour"), "the Guild's monthly cards, with no post at all, name Bring a neighbour");
});
