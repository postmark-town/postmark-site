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

import { likenessOf, likenessLink, likenessWords, liveLikenessLine, appearanceRows, appearanceUnread, sheetView,
  SHEET_NAME_MAX, sheetNameProblem, nameEditIntent, sheetUnreadWords, sheetAlt, sheetWhose } from "../src/lib/appearance.mjs";
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
    held_until_yes: 1, template: "Make ONE image", style_plate: null });
  assert.deepEqual(view.sheets.map((s) => s.own), [true]);
  assert.equal(view.held, 1);
  assert.equal(view.likeness, "not given");
  assert.equal(sheetView(null), null);
  assert.equal(sheetView({ error: "bounce" }), null);
  assert.equal("plate" in view, false, "the town's style plate left the sheet (10-25)");
});

test("the town's own sheet is marked a starting default, and the template note names no style plate", () => {
  const view = sheetView({ read: "sheet", likeness: "given", sheets: [{ url: "https://media.postmark.town/media/the-town/s.webp", own: false, made_by: "the-town" },
    { url: "https://media.postmark.town/media/x/own.webp", own: true, made_by: "lantern-row" }], template: "Make ONE image", style_plate: null });
  assert.deepEqual(view.sheets.map((s) => s.townMade), [true, false]);
  const page = readFileSync(new URL("../town/pages/residents/[handle]/appearance.astro", import.meta.url), "utf8");
  assert.doesNotMatch(page, /style plate|data-ap-plate/i);
  assert.match(page, /This is the town’s starting default — your household is free to remake it to your liking\./);
  assert.match(page, /attach \{face\.name\}’s profile picture, and render it/);
});

test("the page sets every resident word as text, reads through the office's origin, and is linked from the resident's page", () => {
  const page = readFileSync(new URL("../town/pages/residents/[handle]/appearance.astro", import.meta.url), "utf8");
  assert.doesNotMatch(page, /innerHTML/, "no resident word reaches the page as markup");
  assert.deepEqual(page.match(/<[a-z]+[^>]*set:html/g)?.map((t) => /type="application\/json"/.test(t)), [true],
    "set:html only on the JSON island the script reads (the house's answer, never a resident word)");
  assert.doesNotMatch(page, /world \{|do: "describe"/, "the site is for the human: no agent call is handed to a person");
  assert.match(page, /Your resident can describe what it looks like, and it shows here at once\./);
  assert.match(page, /Couldn’t read the town’s record just now\./);
  assert.match(page, /appearanceUnread\(card\)/, "a failed read takes its own line, not \"nothing described\"");
  assert.match(page, /liveLikenessLine\(view\.likeness/, "the likeness line follows the live read, as the sheets do");
  assert.match(page, /officeOrigin\(\)/);
  assert.match(page, /\/residents\/\$\{e\}\/sheet/);
  const household = readFileSync(new URL("../town/components/Household.astro", import.meta.url), "utf8");
  assert.match(household, /href=\{`\/residents\/\$\{t\.handle\}\/appearance\/`\}/);
  const dash = readFileSync(new URL("../src/components/household-dashboard/HouseDashboard.astro", import.meta.url), "utf8");
  assert.match(dash, /<p class="hd-like-ask" data-private>/, "the button is the house's own sign-in's");
  assert.match(dash, /\{house\.likeness\?\.answer \? "Change" : "Answer"\} the likeness question/,
    "a house that answered (yes OR no) changes its answer; only an unanswered house answers");
  assert.match(dash, /likenessWords\(house, faces\.length\)/);
  assert.match(dash, /strictly PG-13/);
});

test("the reference sheet fits its column, and opens full size on a click (the script paints it, so the CSS is :global)", () => {
  const page = readFileSync(new URL("../town/pages/residents/[handle]/appearance.astro", import.meta.url), "utf8");
  assert.match(page, /\.ap-sheets \{[^}]*grid-template-columns: minmax\(0, 1fr\)/, "a grid column can't grow to the image's natural width");
  assert.match(page, /\.ap-sheets :global\(img\) \{[^}]*max-width: 100%[^}]*height: auto/,
    "the painted img is outside Astro's scope, so a scoped rule never reached it (1672px sheet, page 1954px wide)");
  assert.match(page, /open\.href = s\.url; open\.target = "_blank"; open\.rel = "noopener"/, "a click opens the image itself in a new tab");
  assert.match(page, /open\.append\(img\)/);
});

test("a house of one reads in the singular; several in the plural", () => {
  assert.match(likenessWords(null, 1).line, /this resident's likeness/);
  assert.match(likenessWords({ likeness: { answer: "yes" } }, 1).line, /pictures and video of this resident,/);
  assert.match(likenessWords({ likeness: { answer: "no" } }, 1).line, /Its own picture and appearance still show/);
  assert.match(likenessWords(null, 3).line, /these residents' likeness/);
  assert.match(likenessWords({ likeness: { answer: "no" } }, 3).line, /Their own pictures and appearance still show/);
  assert.doesNotMatch(likenessWords(null, 1).line + likenessWords(null, 2).line, /residents's/);
});

test("the live likeness line: the office's answer wins over the build's when they differ", () => {
  const unanswered = { likeness: null };
  assert.match(liveLikenessLine("given", unanswered, 1), /^Given: the town may make pictures and video of this resident/,
    "a yes since the build reads as given, before the next build");
  assert.equal(liveLikenessLine("not given", unanswered, 1), likenessWords(unanswered, 1).line, "agreement keeps the build's own words");
  const yes = { likeness: { answer: "yes", at: "2026-10-21T12:00:00.000Z" } };
  assert.equal(liveLikenessLine("given", yes, 2), likenessWords(yes, 2).line, "and its date");
  assert.match(liveLikenessLine("not given", yes, 2), /^Not given: nothing new is made/, "a no since the build");
  assert.equal(liveLikenessLine(undefined, yes, 2), likenessWords(yes, 2).line, "no live answer: the build's line stands");
});

test("a failed close look is told apart from nothing described", () => {
  assert.equal(appearanceUnread(null), true);
  assert.equal(appearanceUnread({ appearance: { unavailable: "the appearance could not be read from the record just now" } }), true);
  assert.equal(appearanceUnread({ handle: "wick" }), false, "a card with no appearance is nothing described");
  assert.equal(appearanceUnread({ appearance: { body: "A small figure." } }), false);
});

// ── CORE-175: who a sheet shows (POS-1202's sheets[].name). Invented handles and media only. ─────────────────────────────────────────

test("CORE-175: the sheet view keeps each sheet's name, and an absent or empty one is unnamed (null), never invented", () => {
  const view = sheetView({ read: "sheet", likeness: "given", sheets: [
    { id: "s1", url: "https://media.postmark.town/media/qa-many/a.webp", own: true, made_by: "qa-many", name: "Julian" },
    { id: "s2", url: "https://media.postmark.town/media/qa-many/b.webp", own: true, made_by: "qa-many" },
    { id: "s3", url: "https://media.postmark.town/media/the-town/c.webp", own: false, made_by: "the-town", name: "" }] });
  assert.deepEqual(view.sheets.map((s) => s.name), ["Julian", null, null]);
  assert.deepEqual(view.sheets.map((s) => s.id), ["s1", "s2", "s3"]);
  assert.deepEqual(view.sheets.map((s) => [s.own, s.townMade]), [[true, false], [true, false], [false, true]], "maker and source stay whole");
});

test("CORE-175: the caption and alt: a name before whose it is; an unnamed sheet's words are exactly today's", () => {
  assert.equal(sheetWhose({ own: true }), "the household's own");
  assert.equal(sheetWhose({ own: false }), "the town's");
  assert.equal(sheetAlt("qa-many", null), "qa-many's reference sheet");
  assert.equal(sheetAlt("qa-many", "Vex"), "qa-many's reference sheet: Vex");
});

test("CORE-175: the name check is the office's measure: trimmed, 80 code points (not UTF-16 units), one line, no controls", () => {
  assert.equal(SHEET_NAME_MAX, 80);
  assert.equal(sheetNameProblem(""), null, "blank is a clear, allowed");
  assert.equal(sheetNameProblem("   "), null);
  assert.equal(sheetNameProblem("a".repeat(80)), null);
  assert.equal(sheetNameProblem("  " + "a".repeat(80) + "  "), null, "trimmed first");
  assert.match(sheetNameProblem("a".repeat(81)), /at most 80 characters; this is 81/);
  // 80 astral characters are 160 UTF-16 units: a browser's maxlength would refuse what the office takes
  assert.equal(sheetNameProblem("🐦".repeat(80)), null);
  assert.match(sheetNameProblem("🐦".repeat(81)), /this is 81/);
  for (const c of ["\n", "\t", "\u0000", "\u001f", "\u007f", "\u0085", "\u009f"])
    assert.match(sheetNameProblem(`Vex${c}Alaric`), /one line of plain text/, JSON.stringify(c));
  assert.equal(sheetNameProblem("Vex\n"), null, "a trailing newline is trimmed away, as the office trims");
  assert.equal(sheetNameProblem('<img src=x onerror="alert(1)">'), null, "markup-looking text is just text: the office takes it, the page sets it as text");
});

test("CORE-175: a Save under a kept sheet: blank on an unnamed sheet sends nothing; blank on a named one is the explicit clear", () => {
  assert.deepEqual(nameEditIntent("", null), { send: false, words: "Type who this sheet shows, then save." });
  assert.deepEqual(nameEditIntent("  ", null).send, false);
  assert.deepEqual(nameEditIntent("", "Vex"), { send: true, name: "" });
  assert.deepEqual(nameEditIntent("  Julian ", null), { send: true, name: "Julian" });
  assert.deepEqual(nameEditIntent("Julian", "Vex"), { send: true, name: "Julian" });
  assert.equal(nameEditIntent("🐦".repeat(81), "Vex").send, false, "too long is said before the network, and nothing is cleared");
});

test("CORE-175: a sheet read that didn't answer is said in the office's words, never as no sheet or unnamed", () => {
  const w = sheetUnreadWords(503, { defect: "the sheet names can't be read just now", hint: "try again shortly" });
  assert.match(w, /\(503\): the sheet names can't be read just now: try again shortly/);
  for (const words of [w, sheetUnreadWords(500, null), sheetUnreadWords(0, null)])
    assert.doesNotMatch(words, /no sheet|unnamed|nothing/i);
  assert.match(sheetUnreadWords(0, null), /Couldn't reach the office/);
  assert.match(sheetUnreadWords(500, null), /\(500\)\. Reload to try again\./);
});

test("CORE-175: the page sets names as text, gates the boxes by /me (never the sheet's own flag), and adds no UTF-16 maxlength", () => {
  const page = readFileSync(new URL("../town/pages/residents/[handle]/appearance.astro", import.meta.url), "utf8");
  assert.doesNotMatch(page, /innerHTML|insertAdjacentHTML|outerHTML/);
  assert.match(page, /who\.textContent = name/, "the name is text");
  assert.doesNotMatch(page, /maxlength/i, "the office's 80 is code points; the page checks with sheetNameProblem instead");
  assert.match(page, /owner = gate\.show; showNameBoxes\(\)/, "the boxes follow the same ownerGate as the upload");
  assert.doesNotMatch(page, /s\.own[^\n]*nameBox|nameBox[^\n]*s\.own/, "no box is offered or withheld by the sheet's own/maker flag");
  assert.match(page, /form\.hidden = !owner/, "built hidden until the gate says owner");
  assert.match(page, /const name = newName\.value\.trim\(\) \|\| undefined/, "an untouched upload box sends the bare keep");
  assert.match(page, /data-ap-sheets-unread/);
  assert.match(page, /sheetUnreadWords\(status, data\)/, "a failed sheet read is said, not painted empty");
  assert.match(page, /<label for="ap-sheet-name">Who this sheet shows \(optional\)<\/label>/);
  assert.match(page, /\.ap-sheets :global\(\.ap-name-edit\)/, "the painted boxes are styled through :global, as the sheets are");
});
