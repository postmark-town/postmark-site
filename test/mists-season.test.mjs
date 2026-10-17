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

// THE MOTIFS SPRINKLED AROUND THE SITE (Darko 2026-10-11 11:03: "maybe the site
// hints are *too* subtle"): nothing at 243, every one at 244; decorative only,
// still under reduced motion, and motifs only (no palette, no words).
test("the sprinkled motifs: absent at 243, present at 244, decorative and still under reduced motion", async () => {
  const { homeCrowsHTML, navBatHTML, motifHTML, SPOTS, PERCHES } = await import("../src/lib/halloween-sprinkle.mjs");
  const before = siteMists({ crossing: 243, skeleton: SKELETON }), during = siteMists({ crossing: 244, skeleton: SKELETON });
  assert.equal(before, null);
  const all = (m) => ({ home: homeCrowsHTML(m), header: navBatHTML(m), ...Object.fromEntries(Object.keys(SPOTS).map((k) => [k, motifHTML(k, m)])) });
  assert.deepEqual(Object.keys(SPOTS).sort(), ["bulletin", "jar", "resident", "world"]);
  for (const [k, html] of Object.entries(all(before))) assert.equal(html, "", `${k} at 243`);
  assert.equal(motifHTML("nowhere", during), "", "an unknown spot is nothing");
  const on = all(during);
  for (const [k, html] of Object.entries(on)) {
    assert.ok(html.length > 0, `${k} at 244`);
    assert.match(html, /pointer-events: none/, `${k} takes no pointer`);
    if (/<(span|div)\b/.test(html)) assert.match(html, /<(span|div) [^>]*aria-hidden="true"/, `${k} is hidden from the reader`);
    if (/animation:/.test(html)) assert.match(html, /@media \(prefers-reduced-motion: reduce\)/, `${k} stops under reduced motion`);
    assert.doesNotMatch(html, /--pm-|siteSkinCSS/i, `${k}: motifs only`);
  }
  // the World page's lite mode (WLD-43): the viewer marks <html> with wv-lite, and the bat holds still
  assert.match(on.world, /html\.wv-lite \.wv-worldline::after \{ animation: none; \}/, "the World page's bat holds still in lite mode");
  assert.equal((on.home.match(/class="pm-hw-crow"/g) ?? []).length, 3, "three crows on the hero's rooftops");
  assert.equal(PERCHES.length, 3);
  assert.match(on.header, /Math\.random\(\)>0\.34/, "the bat crosses on about one load in three");
  assert.match(on.header, /prefers-reduced-motion: reduce\)"\)\.matches/, "and never under reduced motion");
  // the bat's strip is the header's top padding: it never reaches the nav's line (26 px and up)
  const strip = Number(on.header.match(/\.pm-hw-bats \{[^}]*height: (\d+)px/)[1]);
  assert.ok(strip <= 26 && /\.pm-hw-bats \{[^}]*overflow: hidden/.test(on.header), "the bat flies above the nav's line");
});

test("the sprinkled motifs are placed: one per page, through the season's components", async () => {
  const { readFileSync } = await import("node:fs");
  const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
  assert.match(read("src/layouts/PostmarkLayout.astro"), /<HalloweenBat \/>/);
  assert.match(read("town/pages/index.astro"), /<HalloweenHome \/>/);
  for (const [file, spot] of [["town/pages/bulletin/index.astro", "bulletin"], ["town/pages/world.astro", "world"],
    ["town/components/Household.astro", "resident"], ["town/pages/meeps/index.astro", "jar"]]) {
    assert.equal((read(file).match(/<HalloweenMotif spot="([a-z]+)" \/>/g) ?? []).join(), `<HalloweenMotif spot="${spot}" />`, file);
  }
});

// THE WHOLE SKIN FROM 244 (Darko 2026-10-11 11:04: "let's kick things off with a
// bang. On the site, let's go all out with the seasonal theme, while keeping the
// gradual mist of the world"): no skin at 243, the whole of it at 244 and after,
// with no ramp across the season.
test("the site's skin: none at 243, the whole of it from 244 (no ramp)", async () => {
  const { skinStrength, siteSkinCSS, worldFrameCSS } = await import("../src/lib/halloween-skin.mjs");
  assert.equal(skinStrength(siteMists({ crossing: 243, skeleton: SKELETON })), 0);
  for (const n of [244, 250, 272, 283, 284, 300]) assert.equal(skinStrength(siteMists({ crossing: n, skeleton: SKELETON })), 1, `at ${n}`);
  const v = VARIANTS[2];
  const css = siteSkinCSS(v, 1), frame = worldFrameCSS(v, 1);
  for (const want of [`--pm-night: ${v.base}`, `--pm-harbor: ${v.panel}`, `--pm-gold: ${v.orange}`, `--pm-paper: ${v.paper}`, `--pm-ink: ${v.paperInk}`, `--pm-wax: ${v.blood}`]) assert.ok(css.includes(want), want);
  for (const want of [`--night: ${v.base}`, `--panel: ${v.panel}`, `--paper: ${v.ink}`, `--amber: ${v.orange}`]) assert.ok(frame.includes(want), want);
  const { readFileSync } = await import("node:fs");
  for (const c of ["HalloweenSkin", "HalloweenWorldFrame", "HeroFog"]) {
    const src = readFileSync(new URL(`../src/components/${c}.astro`, import.meta.url), "utf8");
    assert.ok(src.includes("skinStrength(mists)") && !/mists\.t\b|SKIN_MAX/.test(src), `${c} wears the whole skin, unramped`);
  }
  const skin = readFileSync(new URL("../src/components/HalloweenSkin.astro", import.meta.url), "utf8");
  assert.ok(!skin.includes("pm-hw-bat"), "one bat on a page: HalloweenBat's, above the nav's line");
});
