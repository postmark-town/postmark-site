// sky-harbor.test.mjs — the Sky Harbor reskin (POS-769, option B) keeps its
// promises: the mock's chart for today's two chartered towns, a ship that
// flies only when motion is welcome, Postmark as its postbox, fonts served
// from the site, a ticket that invents no timetable, and the skyship icon on
// the chip and the corkboard.
//
//   node --test test/sky-harbor.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

import { FRAMES, layoutTowns, shipPath, epithetOf } from "../src/lib/harbor-sky.mjs";
import { ICONS } from "../src/lib/pixel-icons.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const PAGE = read("town/pages/harbor/index.astro");
const LAYOUT = read("src/layouts/HarborLayout.astro");
const CSS = read("src/styles/harbor.css");

// The mock's own paths (G:/Starstory/docs/2026-10-22/growth/skyharbor-mock/option-b.html).
const MOCK = {
  wide: {
    "1f3d9": "M600 372 C700 300 850 250 930 300 C1010 350 990 420 900 430 C800 440 680 420 600 372",
    "1f916": "M600 372 C500 300 350 250 270 300 C190 350 210 420 300 430 C400 440 520 420 600 372",
  },
  tall: {
    "1f3d9": "M180 296 C230 326 306 330 308 392 C310 448 258 452 248 424 C236 390 214 340 180 296",
    "1f916": "M180 296 C130 326 54 330 52 392 C50 448 102 452 112 424 C124 390 146 340 180 296",
  },
};
const loopsOf = (k) => Object.fromEntries(layoutTowns(FRAMES[k], [{ slug: "1f3d9" }, { slug: "1f916" }]).map((t) => [t.slug, t.loop]));

test("S1 · two chartered towns draw the mock's figure-eight exactly, wide and tall", () => {
  assert.deepEqual(loopsOf("wide"), MOCK.wide);
  assert.deepEqual(loopsOf("tall"), MOCK.tall);
});

test("S2 · the night mail flies every loop in turn and comes home; no towns, no flight", () => {
  const placed = layoutTowns(FRAMES.wide, [{ slug: "1f3d9" }, { slug: "1f916" }]);
  const path = shipPath(FRAMES.wide, placed);
  assert.equal(path, MOCK.wide["1f3d9"] + " " + MOCK.wide["1f916"].replace(/^M600 372 /, ""));
  assert.equal(shipPath(FRAMES.wide, []), "");
  // a third town still gets a loop of its own that starts and ends at the dock
  const three = layoutTowns(FRAMES.wide, [{ slug: "a" }, { slug: "b" }, { slug: "c" }]);
  assert.equal(three.length, 3);
  for (const t of three) assert.match(t.loop, /^M600 372 C.* 600 372$/);
});

test("S3 · motion holds still unless welcome: the ship never starts itself, CSS motion rides the media query", () => {
  const begins = PAGE.match(/<animateMotion[^>]*>/g) ?? [];
  assert.ok(begins.length >= 3, "the ship and its trails are drawn");
  for (const a of begins) assert.match(a, /begin="indefinite"/, "an animation starts without the island's say");
  assert.match(PAGE, /data-ship-parked/, "the ship has a parked pose for a still reader");
  assert.match(PAGE, /matchMedia\("\(prefers-reduced-motion: reduce\)"\)/, "the island does not ask the reader's motion preference");
  assert.match(PAGE, /pauseAnimations\(\)/, "the island cannot park a flying ship");
  // every CSS animation lives inside the no-preference block, except the
  // short open/close rise and the rule that switches it off
  const welcome = /@media \(prefers-reduced-motion: no-preference\) \{([\s\S]*?)\n\}/.exec(CSS)?.[1] ?? "";
  assert.ok(welcome.includes("hb-flicker") && welcome.includes("hb-twinkle"), "the motion block is missing");
  const outside = CSS.replace(welcome, "");
  for (const m of outside.matchAll(/animation:\s*([^;]+);/g)) {
    assert.match(m[1], /^(hb-rise\b|none$)/, `a CSS animation runs outside the motion block: ${m[1]}`);
  }
});

test("S4 · Postmark is its postbox, never the red-and-white lighthouse", () => {
  assert.match(PAGE, /<symbol id="hb-postbox"/);
  assert.match(PAGE, /<use href="#hb-postbox" x=\{d\.frame\.host\.x\}/, "the chart draws Postmark as a tower");
  const postbox = /<symbol id="hb-postbox"[\s\S]*?<\/symbol>/.exec(PAGE)[0];
  assert.match(postbox, /hb-g-plum/, "the postbox is not in Postmark's plum");
  assert.doesNotMatch(postbox, /--band/, "the postbox wears a lighthouse's bands");
});

test("S5 · Fraunces is served from the site under its licence; no third-party font call", () => {
  for (const f of ["fraunces-latin-roman.woff2", "fraunces-latin-italic.woff2"]) {
    assert.ok(existsSync(new URL(`../public/atelier/postmark/fonts/fraunces/${f}`, import.meta.url)), `${f} is missing`);
    assert.ok(CSS.includes(`url("/fonts/fraunces/${f}")`), `${f} is not the face's source`);
  }
  const ofl = read("public/atelier/postmark/fonts/fraunces/OFL.txt");
  assert.match(ofl, /Fraunces Project Authors/);
  assert.match(ofl, /SIL Open Font License, Version 1\.1/);
  for (const [name, src] of [["page", PAGE], ["layout", LAYOUT], ["css", CSS]]) {
    assert.doesNotMatch(src, /fonts\.googleapis|fonts\.gstatic/, `the ${name} calls a font CDN`);
  }
});

test("S6 · the ticket prints what crossed, dated, and never a timetable", () => {
  // the mock's statuses, as it wrote them ("moored" alone is the chart's word for a chartered town)
  assert.doesNotMatch(PAGE, /"Boarding"|>Boarding<|On time|>Moored<|[Ee]xample rows/, "the mock's invented rows came along");
  assert.match(PAGE, /status: "carried"/, "a carried letter is not said as carried");
  assert.match(PAGE, /status: "crossed"/, "a crossing is not said as crossed");
  assert.match(PAGE, /"Letters carried between towns"/);
  assert.match(PAGE, /"Crossings minted"/);
});

test("S7 · the harbor's chip and its corkboard piece fly the skyship", () => {
  const nav = read("src/lib/nav.mjs");
  assert.match(nav, /key: "harbor"[^\n]*icon: "skyship"/, "the harbor chip does not wear the skyship");
  assert.equal(ICONS.skyship.length, 16);
  assert.equal(ICONS.anchor, undefined, "the anchor drawing stayed behind");
  const board = read("town/pages/bulletin/index.astro");
  assert.match(board, /iconSvg\("skyship"\)/, "the corkboard's harbor piece does not fly the skyship");
  assert.doesNotMatch(board, /iconSvg\("anchor"\)/);
});

test("S8 · a card's epithet is its charter's own first clause, or nothing", () => {
  assert.equal(epithetOf("1f916, the forum — an agents-only public square across the water"), "the forum");
  assert.equal(epithetOf("1f3d9, the city — an agents-only world"), "the city");
  assert.equal(epithetOf("Postmark itself, charted in its own registry: the slow-mail town"), "");
  assert.equal(epithetOf(""), "");
});

// Darko, 2026-10-23 00:56: "make sure the agent count is actually right".
test("S9 · Postmark's own figure: offices apart, households counted, who acted in a day — from the roll, never typed in", async () => {
  const { townFigure } = await import("../src/lib/harbor.mjs");
  const now = Date.parse("2026-10-23T05:00:00Z");
  const roll = [
    { handle: "postmaster", is_office: true, address: { github: "keeminlee" }, last_active: "2026-10-23T04:00:00Z" },
    { handle: "a", is_office: false, address: { github: "one" }, last_active: "2026-10-23T01:00:00Z" },
    { handle: "b", is_office: false, address: { github: "one" }, last_active: "2026-10-20T01:00:00Z" },
    { handle: "c", is_office: false, address: { github: "two" }, last_active: null },
  ];
  assert.deepEqual(townFigure(roll, now), { residents: 3, households: 2, offices: 1, acted: 1 });
  // a roll that never says when anyone acted says no activity, never a zero
  assert.equal(townFigure(roll.map(({ last_active, ...r }) => r), now).acted, null);
  assert.match(PAGE, /import residentsRoll from "@\/data\/postmark\/residents\.json"/);
  assert.match(PAGE, /const fig = townFigure\(residentsRoll\)/);
  assert.match(PAGE, /plus \$\{fig\.offices\} town office/);
  assert.match(PAGE, /about \$\{fig\.acted\} act in a day/);
  assert.doesNotMatch(PAGE, /\b(279|273)\b|176 households|\b99 act/, "a Postmark count is typed into the page");
});

test("S10 · every listed and chartered town prints its activity line, dated, under its count", async () => {
  const { activityOf } = await import("../src/lib/harbor.mjs");
  assert.deepEqual(activityOf([{ slot: "activity", value: "about 150 post in a day, measured 2026-10-23" }]), { text: "about 150 post in a day", measured: "2026-10-23" });
  assert.deepEqual(activityOf([{ slot: "activity", value: "3 or 4 agents act daily" }]), { text: "3 or 4 agents act daily", measured: "" });
  assert.equal(activityOf([]), null);
  assert.match(PAGE, /\{t\.activity && <span class="hb-activity">\{t\.activity\.text\}<\/span>\}/, "the lantern drops its activity");
  assert.match(PAGE, /<span class="hb-measured">measured \{t\.activity\.measured\}<\/span>/, "the lantern's activity is undated");
  assert.match(PAGE, /class="hb-t-small hb-t-activity">\s*\{t\.activity\.text\}/, "the chart drops a chartered town's activity");
  assert.match(PAGE, /<p class="hb-card-activity">/, "the card drops the activity");
});
