// front-ticker.test.mjs — the front page's ticker shows more of the town
// (POS-855, Site UX D6).
//
//   node --test test/front-ticker.test.mjs
//
// Fixture-only: it reads test/fixtures/front-ticker.sample.json (wholly
// invented) and the page SOURCE, never the town's data.
//
// Falsifiers: take the per-sender cap out of spreadDeliveries (the "cap",
// "order" and "size" tests fail), point the page back at slice(0, 8) (the
// "wiring" test fails), or give the ticker a title helper that adds
// punctuation (the "no invented punctuation" tests fail).

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import * as ticker from "../src/lib/front-ticker.mjs";
import { threadTitle } from "../tools/lib/ids.mjs";

const { spreadDeliveries } = ticker;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FIX = JSON.parse(readFileSync(join(ROOT, "test", "fixtures", "front-ticker.sample.json"), "utf8"));
const PAGE = readFileSync(join(ROOT, "town", "pages", "index.astro"), "utf8");

test("cap: no sender fills more than 2 of the 8 slots", () => {
  const picked = spreadDeliveries(FIX.latestDeliveries);
  const per = {};
  for (const d of picked) per[d.from] = (per[d.from] ?? 0) + 1;
  assert.ok(Math.max(...Object.values(per)) <= 2, JSON.stringify(per));
  // four senders in the fixture, so 2 + 2 + 2 + 1 = 7 is the most the cap allows
  assert.deepEqual(per, { "marrow-lark": 2, "tansy-fen": 2, ferrule: 2, "oxbow-nine": 1 });
  assert.equal(picked.length, 7);
});

test("order: newest first is kept, and a dominant sender keeps its newest two", () => {
  assert.deepEqual(spreadDeliveries(FIX.latestDeliveries).map((d) => d.id), [
    "marrow-lark-2026-10-30-kettle-and-compass-inventory",
    "marrow-lark-2026-10-30-plan-s-for-the-tin-bridge",
    "tansy-fen-2026-10-28-toll-schedule-for-the-tin-bridge",
    "ferrule-2026-10-27-kiln-d-notes",
    "ferrule-2026-10-27-a-plain-title-with-no-marks",
    "oxbow-nine-2026-10-26-pigeon-roster-for-the-week",
    "tansy-fen-2026-10-25-second-from-tansy",
  ]);
});

test("size: never more than 8, and the cap and size are parameters", () => {
  const many = Array.from({ length: 30 }, (_, i) => ({ id: `s${i}-x`, from: `s${i}`, date: "2026-10-01" }));
  assert.equal(spreadDeliveries(many).length, 8);
  assert.equal(spreadDeliveries(FIX.latestDeliveries, { perSender: 1 }).length, 4);
  assert.equal(spreadDeliveries(FIX.latestDeliveries, { size: 3 }).length, 3);
  assert.deepEqual(spreadDeliveries(null), []);
  assert.deepEqual(spreadDeliveries([]), []);
});

test("the picked deliveries are the stats rows themselves, unaltered", () => {
  const rows = FIX.latestDeliveries;
  for (const d of spreadDeliveries(rows)) assert.ok(rows.includes(d), "same object, not a rewritten copy");
});

test("titles: each fixture id's ticker label is exactly threadTitle(id), the slug with its dashes breathed out", () => {
  assert.equal(threadTitle("marrow-lark-2026-10-30-plan-s-for-the-tin-bridge"), "plan s for the tin bridge");
  assert.equal(threadTitle("ferrule-2026-10-27-kiln-d-notes"), "kiln d notes");
  assert.equal(threadTitle("ferrule-2026-10-27-a-plain-title-with-no-marks"), "a plain title with no marks");
  // the page labels with threadTitle itself, so what the ticker says is that
  assert.match(PAGE, /— “\$\{threadTitle\(d\.id\)\}”/);
});

test("no invented punctuation: a slug-derived title is only words, digits and spaces", () => {
  for (const d of FIX.latestDeliveries) {
    assert.match(threadTitle(d.id), /^[a-z0-9]+( [a-z0-9]+)*$/, d.id);
  }
});

test("no invented punctuation: the ticker module offers a selector and nothing that titles", () => {
  assert.deepEqual(Object.keys(ticker), ["spreadDeliveries"]);
  assert.doesNotMatch(PAGE, /restoreApostrophes|deliveryTitle/);
});

test("wiring: the page reads the spread, and keeps arrivals, the letter links and the all-deliveries link", () => {
  assert.match(PAGE, /spreadDeliveries\(stats\.latestDeliveries\)/);
  assert.doesNotMatch(PAGE, /latestDeliveries\.slice\(0, 8\)/);
  assert.match(PAGE, /stats\.arrivals\.slice\(0, 3\)/);
  assert.match(PAGE, /href: letterHref\(d\.id, letterBook\)/);
  assert.match(PAGE, /all \{stats\.deliveries\} deliveries →/);
});
