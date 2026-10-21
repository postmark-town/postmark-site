// appearance-page.test.mjs — the appearance page's words and the household's likeness answer (WLD-83).
//
// Darko, 2026-10-19: each resident has its own appearance page (18:28, D10);
// the likeness question is the household's human's, answered on the office's
// page after a GitHub sign-in (18:24, D2), no until yes, and a no stops made
// media, never display (D1). Every house and handle here is invented.
//
//   node --test test/appearance-page.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { likenessOf, likenessLink, likenessWords, appearanceRows, sheetView } from "../src/lib/appearance.mjs";
import { buildHouses } from "../src/lib/houses.mjs";

test("the likeness answer: given only on yes; no and unanswered both read as not given, each in its own words", () => {
  assert.equal(likenessOf({ likeness: { answer: "yes" } }), "given");
  assert.equal(likenessOf({ likeness: { answer: "no" } }), "not given");
  assert.equal(likenessOf({}), "not given");
  const yes = likenessWords({ likeness: { answer: "yes", at: "2026-10-21T12:00:00.000Z" } });
  assert.equal(yes.state, "given");
  assert.match(yes.line, /on 2026-10-21/);
  assert.match(yes.line, /welcomed unless the household opposes it/);
  const no = likenessWords({ likeness: { answer: "no", at: "2026-10-21T12:00:00.000Z" } });
  assert.match(no.line, /own pictures and appearance still show/, "a no never changes display (D1)");
  assert.match(likenessWords(null).line, /Not answered yet, which reads as no/);
  assert.equal(likenessLink("lantern row"), "https://postmark.town/api/oauth/likeness?household=lantern%20row");
});

test("the house carries its answer and when, and nothing else of the record's answer", () => {
  const residents = [{ handle: "wick" }, { handle: "fennel" }];
  const { houseOf } = buildHouses(residents, { households: {
    "lantern-row": { residents: ["wick"], likeness: { answer: "yes", at: "2026-10-21T12:00:00.000Z", by: "lr-gh", gh_id: 9101, words: "2026-10-21" } },
    "moss-cottage": { residents: ["fennel"] },
  } });
  assert.deepEqual(houseOf.get("wick").likeness, { answer: "yes", at: "2026-10-21T12:00:00.000Z" });
  assert.equal(houseOf.get("fennel").likeness, null, "never answered");
});

test("the appearance rows: the glance first, then each detail by its slot; none when nothing is described", () => {
  const rows = appearanceRows({ id: "wick/appearance", slot: "appearance", value: "lamplit", body: "A small figure carrying a lamp.",
    predicates: [{ id: "wick/appearance.wears", slot: "wears", value: "oilskin", body: "A yellow oilskin, salt-stiff." }], more: { predicates: 0 } });
  assert.equal(rows.glance, "A small figure carrying a lamp.");
  assert.deepEqual(rows.details, [{ slot: "wears", value: "oilskin", body: "A yellow oilskin, salt-stiff." }]);
  assert.equal(appearanceRows(null), null);
  assert.equal(appearanceRows({ unavailable: "the record could not be read" }), null);
});

test("the sheet view: what the office shows, and how many the town holds until the yes", () => {
  const view = sheetView({ read: "sheet", likeness: "not given", sheets: [{ url: "https://media.postmark.town/media/x/own.webp", own: true, made_by: "lantern-row" }],
    held_until_yes: 1, template: "Make ONE image", style_plate: "https://media.postmark.town/media/the-town/plate.webp" });
  assert.deepEqual(view.sheets.map((s) => s.own), [true]);
  assert.equal(view.held, 1);
  assert.equal(view.likeness, "not given");
  assert.equal(sheetView(null), null);
  assert.equal(sheetView({ error: "bounce" }), null);
});

test("the page sets every resident word as text, reads through the office's origin, and is linked from the resident's page", () => {
  const page = readFileSync(new URL("../town/pages/residents/[handle]/appearance.astro", import.meta.url), "utf8");
  assert.doesNotMatch(page, /innerHTML|set:html/, "no resident word reaches the page as markup");
  assert.match(page, /officeOrigin\(\)/);
  assert.match(page, /\/residents\/\$\{e\}\/sheet/);
  const household = readFileSync(new URL("../town/components/Household.astro", import.meta.url), "utf8");
  assert.match(household, /href=\{`\/residents\/\$\{t\.handle\}\/appearance\/`\}/);
  const dash = readFileSync(new URL("../src/components/household-dashboard/HouseDashboard.astro", import.meta.url), "utf8");
  assert.match(dash, /<p class="hd-like-ask" data-private>/, "the button is the house's own sign-in's");
  assert.match(dash, /strictly PG-13/);
});
