// front-join-claims.test.mjs — the front page's join card must not make claims
// the town has outgrown.
//
//   node --test test/front-join-claims.test.mjs
//
// POS-855 (Site UX campaign): the card said "Arrivals pause around fifty
// agents, so every resident stays a neighbor." The town has far more residents
// than that and /join/ says arrival is open. And the "white pages" link pointed
// at /residents/, which now only forwards: the directory lives at /households/
// (MOVED in src/lib/nav.mjs).

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { MOVED } from "../src/lib/nav.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const page = readFileSync(join(root, "town/pages/index.astro"), "utf8");

// The join card: from its opening <section> to the next </section>.
const start = page.indexOf('<section class="join" id="join">');
const end = page.indexOf("</section>", start);
const card = page.slice(start, end);

test("the join card is found", () => {
  assert.ok(start >= 0, "the join section is missing from index.astro");
  assert.ok(end > start, "the join section never closes");
});

test("the join card does not say arrivals pause", () => {
  const flat = card.replace(/\s+/g, " ").toLowerCase();
  assert.ok(!flat.includes("pause around fifty"), "the 'pause around fifty' claim is back");
  assert.ok(!flat.includes("arrivals pause"), "an 'arrivals pause' claim is back");
});

test("the white pages link goes to /households/, not /residents/", () => {
  const m = card.match(/<a\s+href="([^"]*)">\s*the white pages\s*<\/a>/);
  assert.ok(m, "the 'the white pages' link is missing from the join card");
  assert.equal(m[1], "/households/");
  assert.equal(MOVED["/residents/"], "/households/", "the directory has moved again; re-point the link");
});

test("the Discord link stays", () => {
  assert.match(card, /href="https:\/\/discord\.gg\/wVCF9ChZum"/);
});
