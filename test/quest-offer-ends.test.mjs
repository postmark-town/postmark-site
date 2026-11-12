// quest-offer-ends.test.mjs — the /town/ offer cards stop drawing a quest past its `ends` (POS-857).
//
//   node --test test/quest-offer-ends.test.mjs     (wholly synthetic: invented posts, no snapshot, no data file read)
//
// LAW (Wright for Darko, 2026-11-01): "An optional registry `ends`, holding the existing inclusive
// cutoff ... Every active offer surface ... honors it ... The post's own state and act history stay
// as they are ... `/town/quests/` stays untouched, as the historical standings ... offered on
// 09-30, not on 10-01, with identical registry bytes." The day is the town's: the calendar day in
// TOWN_TZ, default America/New_York (the town's mint rule), not UTC's.
//
// Every title and value below is invented for this file.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { questBoardFrom, questCards, townDay } from "../src/lib/civic.mjs";

const post = (title, terms = {}, over = {}) => ({
  class: "quest", state: "open", id: `pen/${title}`,
  terms: { title, source: `how to ${title}`, reward: "r", cadence: "milestone", target: 1, ...terms }, ...over,
});
const SNAPSHOT = {
  posts: [
    post("ending", { ends: "2026-03-15" }),
    post("lasting"),
    post("daily one", { cadence: "daily", target: 5 }),
    post("ending but shut", { ends: "2026-03-15" }, { state: "closed" }),
  ],
};
const titles = (b) => [...b.daily, ...b.milestone].map((c) => c.title);

test("the same posts are offered through the ends day and not after it", () => {
  const before = JSON.stringify(SNAPSHOT);
  assert.deepEqual(titles(questBoardFrom(SNAPSHOT, { today: "2026-03-14" })), ["daily one", "ending", "lasting"]);
  assert.deepEqual(titles(questBoardFrom(SNAPSHOT, { today: "2026-03-15" })), ["daily one", "ending", "lasting"], "the ends day itself is offered");
  assert.deepEqual(titles(questBoardFrom(SNAPSHOT, { today: "2026-03-16" })), ["daily one", "lasting"], "the next town day is not");
  assert.equal(JSON.stringify(SNAPSHOT), before, "the snapshot bytes are the same on both days");
});

test("CONTROLS: no ends keeps the card on any day, a closed post stays out, and no day given changes nothing", () => {
  for (const today of ["2020-01-01", "2099-12-31"]) assert.ok(titles(questBoardFrom(SNAPSHOT, { today })).includes("lasting"));
  assert.equal(titles(questBoardFrom(SNAPSHOT, { today: "2026-03-14" })).includes("ending but shut"), false, "a closed post is never offered");
  assert.deepEqual(titles(questBoardFrom(SNAPSHOT)), ["daily one", "ending", "lasting"], "the old one-argument call draws what it drew");
});

test("the cards that remain are unchanged and the standings join is unchanged", () => {
  const board = questBoardFrom(SNAPSHOT, { today: "2026-03-14" });
  const ended = questBoardFrom(SNAPSHOT, { today: "2026-03-16" });
  assert.deepEqual(ended.daily, board.daily);
  assert.deepEqual(ended.milestone.map((c) => c.title), ["lasting"]);
  const standings = { completedBy: { lasting: 4, ending: 9 }, total: 12 };
  const rows = questCards(standings, ended);
  assert.deepEqual(rows.map((r) => [r.title, r.done, r.of]), [["daily one", null, 12], ["lasting", 4, 12]]);
  // the standings object itself is not read by the offer filter
  assert.deepEqual(standings, { completedBy: { lasting: 4, ending: 9 }, total: 12 });
});

test("the town's day is the TOWN_TZ calendar day, not UTC's: near midnight the two differ", () => {
  // 02:00Z on Oct 1 is still Sep 30 at 22:00 in New York; 05:00Z is Oct 1 01:00 there.
  assert.equal(townDay(new Date("2026-10-01T02:00:00Z"), "America/New_York"), "2026-09-30");
  assert.equal(townDay(new Date("2026-10-01T05:00:00Z"), "America/New_York"), "2026-10-01");
  assert.equal(townDay(new Date("2026-10-01T02:00:00Z"), "UTC"), "2026-10-01", "the UTC day is the other answer");
  const ends = { posts: [post("window", { ends: "2026-09-30" })] };
  assert.deepEqual(titles(questBoardFrom(ends, { today: townDay(new Date("2026-10-01T02:00:00Z"), "America/New_York") })), ["window"], "offered at 22:00 on the last day, UTC already past it");
  assert.deepEqual(titles(questBoardFrom(ends, { today: townDay(new Date("2026-10-01T05:00:00Z"), "America/New_York") })), [], "gone at 01:00 the next town day");
});

test("TEXT PIN (the weakest instrument): the /town/ page hands questBoardFrom the town's day", () => {
  const HERE = dirname(fileURLToPath(import.meta.url));
  const page = readFileSync(join(HERE, "..", "town", "pages", "town", "index.astro"), "utf8");
  const calls = page.split("\n").filter((l) => l.includes("questBoardFrom(") && !l.trim().startsWith("//") && !l.includes("import"));
  assert.equal(calls.length, 1, "one call to questBoardFrom in the page");
  assert.match(calls[0], /questBoardFrom\(questPosts, \{ today: townDay\(\), registry: questRegistry \}\)/, "the town's day, and (POS-954) the registry the monthly quests are defined by");
});
