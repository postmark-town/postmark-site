// mists-season.test.mjs — the season as a baked page reads it (POS-553): the
// crossing the build reflects, the world's own schedule, and nothing before it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCrossing, siteMists, seasonRamp, SEASON_FULL } from "../src/lib/mists-season.mjs";
import { contrast, VARIANTS, pairsOf } from "../src/lib/halloween-skin.mjs";

const SKELETON = { mists: { border_m: { minX: -4600, minY: -4600, maxX: 5850, maxY: 9700 }, fringe_m: 400,
  density: { from: 0.55, to: 0.95, power: 2 },
  schedule: [{ crossing: 244, front_m: 0, veil: 0.1 }, { crossing: 272, front_m: 390, veil: 0.3 }, { crossing: 282, front_m: 780, veil: 0.5 }] } };

test("the build's crossing: a number, or null for blank, absent or junk (a blank is not zero)", () => {
  assert.equal(buildCrossing({ BUILD_CROSSING: "244" }), 244);
  assert.equal(buildCrossing({ BUILD_CROSSING: " 272 " }), 272);
  for (const raw of [undefined, "", "  ", "x", "-1", "2.5"]) assert.equal(buildCrossing({ BUILD_CROSSING: raw }), null, String(raw));
});

test("nothing before the Mists: no crossing, no skeleton, or a crossing before the schedule all answer null", () => {
  assert.equal(siteMists({ crossing: null, skeleton: SKELETON }), null);
  assert.equal(siteMists({ crossing: 300, skeleton: null }), null);
  assert.equal(siteMists({ crossing: 243, skeleton: SKELETON }), null);
  const m = siteMists({ crossing: 244, skeleton: SKELETON });
  assert.equal(m.crossing, 244); assert.equal(m.veil, 0.1); assert.equal(m.t, 0);
});

test("the season's ramp: 0 at the schedule's first crossing, 1 from 284, and between in step", () => {
  assert.equal(seasonRamp(244, 244), 0);
  assert.equal(seasonRamp(SEASON_FULL, 244), 1);
  assert.equal(seasonRamp(300, 244), 1);
  assert.equal(seasonRamp(264, 244), 0.5);
  assert.equal(siteMists({ crossing: 272, skeleton: SKELETON }).t, (272 - 244) / (SEASON_FULL - 244));
});

test("the skin's variant 2 (Darko 10:56) keeps every text pair at WCAG AA", () => {
  for (const p of pairsOf(VARIANTS[2])) assert.ok(p.ratio >= 4.5, `${p.fg} on ${p.bg}: ${p.ratio.toFixed(2)}`);
  assert.ok(contrast("#000000", "#ffffff") > 20);
});

test("the pinned world tells the season the site shows: seasonLine from its SEASON_LADDER, nothing before the Mists", async () => {
  const verbs = await import("postmark-world/world-verbs");
  assert.equal(typeof verbs.seasonLine, "function", "the pinned world exports seasonLine (no silent fallback)");
  assert.ok(Array.isArray(verbs.SEASON_LADDER) && verbs.SEASON_LADDER[0].from === 244, "its ladder starts at the Mists' first crossing");
  const { mistsAt } = await import("postmark-world/world-engine");
  assert.equal(verbs.seasonLine(mistsAt(243, SKELETON.mists), 243), null);
  const at284 = verbs.seasonLine(mistsAt(284, SKELETON.mists), 284);
  assert.ok(verbs.SEASON_LADDER.at(-1).lines.includes(at284), "from 284, a line of the last rung");
  const src = (await import("node:fs")).readFileSync(new URL("../src/components/SeasonLine.astro", import.meta.url), "utf8");
  assert.ok(src.includes('import * as verbs from "postmark-world/world-verbs"'), "the page reads the world's own export");
  assert.ok(src.includes("homeSeasonLine(") && !/"[A-Z][^"]*\bbell\b/.test(src), "through homeSeasonLine, with no line of its own");
});

// THE BELL UNDER THE FERRY CLOCK (Darko 2026-10-10 11:47): the ruled line from
// 244 until 282, the world's rung-282 bell from 282, the ladder as told from 284
test("the home page's line: the bell rings once from 244, twice from 282, and the ladder's own line from 284", async () => {
  const verbs = await import("postmark-world/world-verbs");
  const { mistsAt } = await import("postmark-world/world-engine");
  const { homeSeasonLine } = await import("../src/lib/mists-season.mjs");
  const at = (n) => homeSeasonLine(mistsAt(n, SKELETON.mists), n, verbs);
  const ONCE = "Somewhere past the north edge, a bell you have never heard rings once.";
  assert.equal(at(243), null, "nothing before the Mists");
  for (let n = 244; n < 282; n++) assert.equal(at(n), ONCE, `at ${n}`);
  assert.ok(verbs.SEASON_LADDER.find((r) => r.from === 272).lines.includes(ONCE), "the ruled line is the world's own, at its rung 272");
  const twice = verbs.SEASON_LADDER.find((r) => r.from === 282).lines.find((l) => /bell/.test(l));
  assert.match(twice, /^The bell past the north edge rings twice now/);
  assert.equal(at(282), twice); assert.equal(at(283), twice);
  for (let n = 284; n < 300; n++) assert.equal(at(n), verbs.seasonLine(mistsAt(n, SKELETON.mists), n), `at ${n}, the ladder as told`);
});
