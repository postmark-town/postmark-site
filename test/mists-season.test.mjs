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
