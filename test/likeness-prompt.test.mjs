// likeness-prompt.test.mjs — who is offered the likeness question, and in what words (WLD-83).
//
// Darko, 2026-10-25 15:22: the form should pop up when a signed-in reader's
// household has not answered. The answer itself stays the office's own page
// (after a GitHub sign-in); this is the show/hide decision. Every house and
// handle here is invented.
//
//   node --test test/likeness-prompt.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { SNOOZE_MS, answered, houseOfMe, houseRecord, promptWords, showPrompt, snoozeKey, snoozed } from "../src/lib/likeness-prompt.mjs";
import { likenessLink, likenessWords } from "../src/lib/appearance.mjs";

const NOW = Date.parse("2026-10-25T20:00:00Z");
const me = (extra = {}) => ({
  handles: ["wick", "fennel"],
  households: { wick: { key: "house:lantern-row", slug: "lantern-row", residents: ["fennel", "wick"] }, fennel: { key: "house:lantern-row", slug: "lantern-row", residents: ["fennel", "wick"] } },
  ...extra,
});
const house = houseOfMe(me());

test("the reader's house is the slug /me's first handle stands in; nobody else gets one", () => {
  assert.deepEqual(house, { slug: "lantern-row", handle: "wick", count: 2 });
  assert.equal(houseOfMe(null), null, "signed out");
  assert.equal(houseOfMe({ handles: [] }), null, "a visitor with no handle");
  assert.equal(houseOfMe({ handles: ["solo"], households: { solo: { key: "solo:solo", slug: null, residents: ["solo"] } } }), null, "a solo resident has no record to answer on");
  assert.equal(houseOfMe({ handles: ["wick"] }), null, "/me carried no household block");
});

test("answered means yes or no; never answered and an unreadable row are not answers", () => {
  assert.equal(answered({ likeness: { answer: "yes" } }), true);
  assert.equal(answered({ likeness: { answer: "no" } }), true);
  assert.equal(answered({ likeness: null }), false);
  assert.equal(answered({}), false);
  assert.equal(answered(null), false);
});

test("the house's row comes out of the households read, or is null", () => {
  const body = { registry: { households: { "lantern-row": { residents: ["wick"], likeness: { answer: "yes" } } } } };
  assert.deepEqual(houseRecord(body, "lantern-row"), body.registry.households["lantern-row"]);
  assert.equal(houseRecord(body, "moss-cottage"), null);
  assert.equal(houseRecord(null, "lantern-row"), null);
  assert.equal(houseRecord({ error: "bounce" }, "lantern-row"), null);
});

test("shown only to a signed-in reader with a house whose record carries no answer and who has not said not-now", () => {
  const open = { residents: ["wick"], likeness: null };
  assert.equal(showPrompt({ house, rec: open, snoozedAt: null, now: NOW }), true, "unanswered");
  assert.equal(showPrompt({ house, rec: { ...open, likeness: { answer: "yes" } }, now: NOW }), false, "answered yes");
  assert.equal(showPrompt({ house, rec: { ...open, likeness: { answer: "no" } }, now: NOW }), false, "answered no is an answer: no nagging");
  assert.equal(showPrompt({ house: null, rec: open, now: NOW }), false, "signed out, a visitor, or a solo resident");
  assert.equal(showPrompt({ house, rec: null, now: NOW }), false, "an unreadable record is never guessed at");
  assert.equal(showPrompt({}), false);
});

test("not now hides it for seven days, and a bad stored value hides nothing", () => {
  const open = { likeness: null };
  assert.equal(SNOOZE_MS, 7 * 24 * 3600 * 1000);
  assert.equal(showPrompt({ house, rec: open, snoozedAt: String(NOW - 60_000), now: NOW }), false, "a minute ago");
  assert.equal(showPrompt({ house, rec: open, snoozedAt: String(NOW - SNOOZE_MS + 1), now: NOW }), false, "just inside the week");
  assert.equal(showPrompt({ house, rec: open, snoozedAt: String(NOW - SNOOZE_MS), now: NOW }), true, "the week is up");
  for (const bad of [null, undefined, "", "soon", "NaN", "-5", "0"]) assert.equal(snoozed(bad, NOW), false, `stored ${JSON.stringify(bad)}`);
  assert.equal(snoozeKey("lantern-row"), "pm.likeness.snooze.lantern-row", "kept per household, so two houses on one browser never cross");
});

test("the words are the ruled ones: the household page's unanswered line, the office's link, nothing new", () => {
  const w = promptWords(house);
  assert.equal(w.line, likenessWords(null, 2).line);
  assert.match(w.line, /Not answered yet, which reads as no/);
  assert.equal(w.href, likenessLink("lantern-row"));
  assert.equal(w.answer, "Answer the likeness question");
  assert.equal(w.later, "Not now");
  assert.match(w.question, /pictures and video of your residents\?$/);
  assert.match(promptWords({ ...house, count: 1 }).question, /your resident\?$/, "a house of one reads in the singular");
});

test("the layout wires it once: the bell island's /me is handed over, never fetched a second time, and the prompt is in the layout", () => {
  const layout = readFileSync(new URL("../src/layouts/PostmarkLayout.astro", import.meta.url), "utf8");
  assert.match(layout, /<LikenessPrompt \/>/);
  assert.match(layout, /window\.pmMe = me;/);
  assert.match(layout, /dispatchEvent\(new CustomEvent\("pm:me"/);
  const comp = readFileSync(new URL("../src/components/LikenessPrompt.astro", import.meta.url), "utf8");
  assert.doesNotMatch(comp, /AS\.me|\/me`|"\/me"/, "the prompt reads no /me of its own");
  assert.match(comp, /e\.key === "Escape"/);
  assert.match(comp, /try \{ return localStorage\.getItem/, "storage is wrapped");
  assert.match(comp, /role="dialog"/);
  assert.doesNotMatch(comp, /aria-modal/, "never a modal that hides the page");
});
