// pot-cards-on-stamps.test.mjs — the pot cards render on /stamps/ and in the
// Guild from ONE component (postmark#2810, founder-ruled 2026-09-14).
//
//   node --test test/pot-cards-on-stamps.test.mjs
//
// WHY A SOURCE READER. The founder's word was "as a copy so people who saw it
// there before still see it there". The property worth guarding is not that
// two pages carry pot-shaped markup — that is how the two pages came to differ
// the last time (the Hal finding, 2026-08-25: /stamps/ saying one thing about
// a close and the door another). It is that there is exactly ONE copy of the
// card, and both pages render it. Reading the source is the only place that
// fact is visible; a built page cannot say where its markup came from.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");
const TOWN = read("town/pages/town/index.astro");
const STAMPS = read("town/pages/docs/stamps/index.astro");
const CARDS = read("src/components/PotCards.astro");

const count = (text, needle) => text.split(needle).length - 1;

test("the pot card markup lives in ONE file, and it is the component", () => {
  assert.equal(count(CARDS, 'class:list={["m-card", "is-pot"'), 1, "the component renders the pot card");
  assert.equal(count(TOWN, '"is-pot"'), 0, "the Guild no longer carries an inline copy of the card");
  assert.equal(count(STAMPS, '"is-pot"'), 0, "/stamps/ never grew its own copy either");
  assert.match(CARDS, /potBoard\.pots\.map\(/, "it maps the live pot board");
  assert.match(CARDS, /href=\{`\/fund\/\$\{p\.pot\}\/`\}/, "every open pot links its own fund page");
  assert.match(CARDS, /potBoard\.malformed\.length > 0/, "and the unreadable-pot warning rides with the cards");
  // ⚑ THE FLIP: paste the card markup back into either page and the zero above reads one.
});

test("both pages render the component exactly once, from the same live read", () => {
  for (const [name, src] of [["/town/", TOWN], ["/stamps/", STAMPS]]) {
    assert.equal(count(src, 'import PotCards from "@/components/PotCards.astro"'), 1, `${name} imports the component`);
    assert.equal(count(src, "<PotCards potBoard={potBoard} />"), 1, `${name} renders it once`);
    assert.match(src, /const potBoard = livePots\(wantFixture \? POT_FIXTURE : loadPots\(\)\);/,
      `${name} reads the pots the way the Guild always has — live rows, the fixture only in dev`);
  }
  // ⚑ THE FLIP: drop the <PotCards> line from /stamps/ and "renders it once" reads zero.
});

test("/stamps/#pots is a place again, not a forwarder", () => {
  assert.match(STAMPS, /<div id="pots" class="m-block">/, "the block carries the id every old deep link was written to");
  const lane = STAMPS.match(/const LANE_FRAGMENTS = \{([^}]*)\}/);
  assert.ok(lane, "the forwarder's map is still declared");
  assert.doesNotMatch(lane[1], /\bpots\b/, "…and no longer sends #pots away to the hub, because the cards are here");
  assert.match(lane[1], /market: "board"/, "the one renamed fragment still forwards");
  assert.match(TOWN, /<div id="pots" class="m-block">/, "the Guild keeps its own #pots block and deep link");
});

test("the component carries its own card styles, so the copy looks the same where the page defines no civic scale", () => {
  assert.match(CARDS, /<style>[\s\S]*\.m-card \{[\s\S]*<\/style>/, "the card rules ride with the markup");
  assert.match(CARDS, /var\(--civic-body, \.9rem\)/, "the civic scale inherits where /town/ sets it and falls back to the same number on /stamps/");
  assert.match(CARDS, /var\(--civic-label, \.7rem\)/);
});
