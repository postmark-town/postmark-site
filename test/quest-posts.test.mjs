// quest-posts.test.mjs — the Quest Guild draws the town's quest posts (POS-294).
//
//   node --test test/quest-posts.test.mjs
//
// Keemin, 2026-09-28: "All quests are technically posts. They are the town's
// posts." The Guild's cards now come from the office's GET /posts?class=quest,
// baked as quest-posts.json, instead of the registry copy in civic.mjs, and
// Keemin kept the site as it is tonight: THE BOARD LOOKS AND COUNTS THE SAME.
//
//   1. the committed snapshot draws exactly the cards the copy drew: same
//      titles, lines, rewards and cadences, in the same order, with the same
//      counts from the mirror;
//   2. only open daily and milestone quest posts are cards: a closed one, a
//      one-time one and one whose terms the office could not read are not;
//   3. the ingest: a 404 or a door with no quest posts keeps the snapshot and
//      names the gap; a wrong shape stops the build; a real answer is written
//      verbatim.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { QUEST_REGISTRY, questBoardFrom, questCards, questStandings } from "../src/lib/civic.mjs";
import { fetchQuestPosts, QUEST_POSTS_GAP, QUEST_POSTS_UNSEEDED_GAP } from "../tools/lib/fetch-town-data.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SNAPSHOT = JSON.parse(readFileSync(join(HERE, "..", "src", "data", "postmark", "quest-posts.json"), "utf8"));
const BULLETIN = JSON.parse(readFileSync(join(HERE, "..", "src", "data", "postmark", "bulletin.json"), "utf8"));

// What a card SHOWS (town/pages/town/index.astro § THE QUEST GUILD): cadence,
// title, source, the count, the reward. `target` is not drawn.
const shown = (c) => ({ cadence: c.cadence, title: c.title, source: c.source, reward: c.reward, done: c.done, of: c.of });

test("1 · the town's quest posts draw exactly the Guild's cards the registry copy drew, counts and all", () => {
  const standings = questStandings(BULLETIN);
  const before = questCards(standings).map(shown);
  const after = questCards(standings, questBoardFrom(SNAPSHOT)).map(shown);
  assert.equal(after.length, 4);
  assert.deepEqual(after, before, "the board changed");
  assert.deepEqual(after.map((c) => c.title), ["Reach out", "Be reached", "Budding friendship", "A first idea"]);
  // and the teaching's copy is untouched
  assert.equal(QUEST_REGISTRY.arriving.length, 6);
});

test("2 · only an open daily or milestone quest post is a card", () => {
  const posts = SNAPSHOT.posts.map((p) => ({ ...p, terms: p.terms && { ...p.terms } }));
  const closed = posts.find((p) => p.fields.quest === "first-idea");
  closed.state = "closed";
  const blind = posts.find((p) => p.fields.quest === "correspond-receive");
  blind.terms = null;
  const board = questBoardFrom({ ...SNAPSHOT, posts });
  assert.deepEqual(board.daily.map((q) => q.title), ["Reach out"], "a post with no terms was drawn");
  assert.deepEqual(board.milestone.map((q) => q.title), ["Budding friendship"], "a closed quest was drawn");
  assert.equal(SNAPSHOT.posts.filter((p) => p.terms.cadence === "one-time").length, 7);
  assert.deepEqual(questBoardFrom(null), { daily: [], milestone: [] });
  assert.ok(SNAPSHOT.posts.every((p) => p.author === "postmark-pen" && p.household === "hh:the-town"), "a quest post not by the town's pen");
});

const reply = (status, body) => async () => ({
  ok: status >= 200 && status < 300, status, statusText: String(status),
  headers: { get: () => null }, json: async () => JSON.parse(JSON.stringify(body)),
});

test("3 · the ingest: 404 and an unposted town keep the snapshot with the gap named; a wrong shape throws; a real answer passes", async () => {
  const base = { apiBase: "https://example.test", retries: 1 };
  const gone = await fetchQuestPosts({ ...base, fetchImpl: reply(404, { error: "bounce" }) });
  assert.deepEqual([gone.missing, gone.gap], [true, QUEST_POSTS_GAP]);
  const empty = await fetchQuestPosts({ ...base, fetchImpl: reply(200, { class: "quest", finished: ["closed"], total: 0, posts: [] }) });
  assert.deepEqual([empty.missing, empty.gap], [true, QUEST_POSTS_UNSEEDED_GAP]);
  await assert.rejects(() => fetchQuestPosts({ ...base, fetchImpl: reply(200, { now: [], coming: [] }) }), /not the quest class's posts/);
  await assert.rejects(() => fetchQuestPosts({ ...base, fetchImpl: reply(500, {}) }));
  const live = await fetchQuestPosts({ ...base, fetchImpl: reply(200, SNAPSHOT) });
  assert.deepEqual([live.missing, live.questPosts.total], [false, 11]);
});
