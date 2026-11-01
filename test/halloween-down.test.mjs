// WLD-142 (Darko 2026-10-31 23:01 EDT: "keep the mist as is, but we should probably remove all like
// the Halloween creatures and the decorations"): after HALLOWEEN_FRAME.until every Halloween
// decoration renders nothing while the Mists' own pieces (HeroFog, SeasonLine, the map) still
// render. One clock: the frame's. These read the real lib the real components call, and the
// components' source for WHICH gate each calls (a source pin, labelled; the gate is behaviour).
import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import * as season from "../src/lib/mists-season.mjs";
import { HALLOWEEN_FRAME } from "../src/lib/halloween-frame.mjs";
import { homeCrowsHTML, navBatHTML, motifHTML, SPOTS } from "../src/lib/halloween-sprinkle.mjs";
import { skinStrength } from "../src/lib/halloween-skin.mjs";

const SKELETON = season.pinnedSkeleton();
const at = (s) => Date.parse(s);
const DURING = at("2026-10-31T12:00:00Z"), AFTER = at("2026-11-01T07:00:00Z"), LATER = at("2026-12-25T00:00:00Z");
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/<!--[\s\S]*?-->/g, "");

test("the pinned world has the Mists at crossing 300 (the control the rest stands on)", () => {
  assert.ok(SKELETON?.mists, "a skeleton with a Mists schedule");
  assert.ok(season.siteMists({ crossing: 300, skeleton: SKELETON }), "the Mists stand at 300");
});

test("the gate: decoration while the window is open, none from `until`; the Mists stand either way", () => {
  assert.equal(typeof season.halloweenMists, "function", "the gate exists");
  const o = { crossing: 300, skeleton: SKELETON };
  assert.ok(season.halloweenMists({ ...o, now: DURING }), "during Halloween the decoration is on");
  assert.equal(season.halloweenMists({ ...o, now: at("2026-11-01T06:59:59Z") }) !== null, true);
  for (const now of [AFTER, LATER]) {
    assert.equal(season.halloweenMists({ ...o, now }), null, `decoration off at ${new Date(now).toISOString()}`);
    assert.ok(season.siteMists(o), "and the Mists still stand");
  }
  assert.equal(season.halloweenMists({ crossing: 243, skeleton: SKELETON, now: DURING }), null, "no Mists, no decoration (the old switch kept)");
});

test("after `until`, the creatures and motifs render nothing; during, they do", () => {
  const o = { crossing: 300, skeleton: SKELETON };
  const render = (now) => {
    const m = season.halloweenMists({ ...o, now });
    return { crows: homeCrowsHTML(m), bat: navBatHTML(m), ...Object.fromEntries(Object.keys(SPOTS).map((k) => [k, motifHTML(k, m)])) };
  };
  assert.equal(Object.keys(render(DURING)).length, 2 + Object.keys(SPOTS).length);
  for (const [k, h] of Object.entries(render(DURING))) assert.ok(h.length > 0, `${k} during`);
  for (const [k, h] of Object.entries(render(AFTER))) assert.equal(h, "", `${k} after`);
  assert.equal(skinStrength(season.halloweenMists({ ...o, now: AFTER })), 0, "the skin has no strength after");
  assert.equal(skinStrength(season.siteMists(o)), 1, "the Mists' own strength is unchanged");
});

test("the browser guard (a page baked before `until`): marks the decoration, removes it once the clock passes", () => {
  assert.equal(season.hwGuard(""), "");
  const html = season.hwGuard(`<style>.a{}</style><div class="x"><span>y</span></div>`);
  assert.equal((html.match(/data-pm-hwf/g) ?? []).length >= 3 + 1, true, "style, div and span marked, and the script names the attribute");
  assert.ok(html.includes(String(Date.parse(HALLOWEEN_FRAME.until))), "the guard carries the frame's own end");
  const run = (nowMs) => {
    const els = [{ removed: false, remove() { this.removed = true; } }, { removed: false, remove() { this.removed = true; } }];
    const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
    const D = { now: () => nowMs };
    vm.runInNewContext(script, { Date: D, document: { querySelectorAll: (q) => (q === "[data-pm-hwf]" ? els : []) } });
    return els.map((e) => e.removed);
  };
  assert.deepEqual(run(DURING), [false, false], "kept while Halloween");
  assert.deepEqual(run(AFTER), [true, true], "removed after");
});

test("wiring (source pin): every decoration reads the gate; the Mists' own pieces read siteMists", () => {
  for (const c of ["HalloweenBat", "HalloweenHome", "HalloweenMotif", "HalloweenSkin", "HalloweenWorldFrame"]) {
    const s = strip(read(`src/components/${c}.astro`));
    assert.match(s, /halloweenMists\(\)/, `${c} reads the gate`);
    assert.doesNotMatch(s, /\bsiteMists\(/, `${c} no longer reads the bare Mists`);
    assert.match(s, /hwGuard\(/, `${c} carries the browser guard`);
  }
  for (const c of ["HeroFog", "SeasonLine"]) {
    const s = strip(read(`src/components/${c}.astro`));
    assert.match(s, /\bsiteMists\(\)/, `${c} (the Mists) still reads siteMists`);
    assert.doesNotMatch(s, /halloweenMists/, `${c} is not behind the decoration's end`);
  }
  assert.match(strip(read("src/components/HalloweenFrame.astro")), /frameHTML\(part, Date\.now\(\), undefined, siteMists\(\)\)/, "the frame keeps its own gate");
});

test("one clock: no second date in the components or the gate", () => {
  for (const p of ["src/lib/mists-season.mjs", ...["Bat", "Home", "Motif", "Skin", "WorldFrame"].map((c) => `src/components/Halloween${c}.astro`)]) {
    assert.doesNotMatch(strip(read(p)), /2026-1[01]-\d\d/, `${p} holds no date of its own`);
  }
});
