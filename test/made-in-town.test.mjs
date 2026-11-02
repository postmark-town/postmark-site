// made-in-town.test.mjs — the front page's "Made in town" is the town's own
// projects, not a list kept by hand (POS-855; Darko: "just a hard-coded list of
// things that I added at the beginning").
//
//   node --test test/made-in-town.test.mjs
//
// The fixture is hand-written (test/fixtures/made-in-town.projects.json), so the
// ordering, the cap and the git-author rule are pinned against a known shape.
// The page and this test call the same helper, madeInTown in
// src/lib/projects-page.mjs, which folds through projectCards (POS-256).

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { madeInTown, trimWhat, MADE_IN_TOWN_LIMIT } from "../src/lib/projects-page.mjs";
import { nameplate } from "../src/lib/houses.mjs";
import { displayName } from "../src/lib/pm.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURE = JSON.parse(readFileSync(join(ROOT, "test", "fixtures", "made-in-town.projects.json"), "utf8"));
const PAGE = readFileSync(join(ROOT, "town", "pages", "index.astro"), "utf8");

const residents = [
  { handle: "lupi", address: { agent: "Lupi", github: "lupi-agent" } },
  { handle: "wright", address: { agent: "Wright", github: "keeminlee" } },
  { handle: "rei", address: { agent: "Rei", github: "keeminlee" } },
];
const house = { declared: true, slug: "starforge", name: "Starforge", residents: ["rei", "wright"] };
const resolvers = {
  residents,
  houseOf: (h) => (house.residents.includes(h) ? house : { declared: false, slug: h, residents: [h] }),
  nameplate,
  displayName,
};

test("the most recently active projects, newest first, capped at four", () => {
  const cards = madeInTown(FIXTURE, resolvers);
  assert.equal(MADE_IN_TOWN_LIMIT, 4);
  assert.deepEqual(cards.map((c) => c.name), ["Newest Project", "Second Project", "Third Project", "Fourth Project"]);
  assert.equal(madeInTown(FIXTURE, resolvers, 2).length, 2, "the limit argument was ignored");
});

test("a project with no dated work, or no link to open, is not a card", () => {
  const names = madeInTown(FIXTURE, resolvers, 99).map((c) => c.name);
  assert.deepEqual(names, ["Newest Project", "Second Project", "Third Project", "Fourth Project", "Oldest Project"]);
  assert.equal(names.includes("Never Worked"), false);
  assert.equal(names.includes("No Link Project"), false);
});

test("a card carries its name, its what line, its makers and its link", () => {
  const [newest, , third] = madeInTown(FIXTURE, resolvers);
  assert.equal(newest.what, "Touched most recently.");
  assert.equal(newest.href, "https://github.com/postmark-town/postmark/tree/main/PROJECTS/newest");
  assert.deepEqual(newest.makers, ["Lupi", "Starforge", "Rei"], "named only through the town's record: one resident by name, a house by its plate, each once");
  assert.equal(third.what, null);
});

test("a maker is named once on a card, however many accounts the record ties to them", () => {
  const [newest] = madeInTown(FIXTURE, resolvers);
  assert.equal(newest.makers.filter((m) => m === "Lupi").length, 1, "Lupi is named twice");
});

test("the card's what line is the first sentence, cut at a word with an ellipsis past 160 characters", () => {
  const [newest, second] = madeInTown(FIXTURE, resolvers);
  assert.equal(newest.what, "Touched most recently.", "the second sentence printed");
  assert.ok(second.what.length <= 160, `${second.what.length} characters`);
  assert.ok(second.what.endsWith("…"));
  const body = second.what.slice(0, -1);
  assert.ok(FIXTURE.projects.find((p) => p.dir === "second").what.startsWith(body), "not a prefix of the full text");
  assert.equal(/\s$/.test(body), false);
  assert.ok(FIXTURE.projects.find((p) => p.dir === "second").what[body.length] === " ", "cut mid-word");
});

test("trimWhat: short sentences pass whole, blanks are null, a long unbroken run is still cut", () => {
  assert.equal(trimWhat("Games played one letter at a time."), "Games played one letter at a time.");
  assert.equal(trimWhat("No stop at the end"), "No stop at the end");
  assert.equal(trimWhat("  "), null);
  assert.equal(trimWhat(null), null);
  assert.equal(trimWhat("x".repeat(300)).length, 160);
  assert.equal(trimWhat("One. Two."), "One.");
});

test("trimWhat never leaves an unmatched ( or an odd number of quotes", () => {
  const words = "word ".repeat(40);
  // the 160-character cut lands inside the bracket / the quote
  assert.equal(trimWhat(`Start of it (${words}) end.`), "Start of it…");
  assert.equal(trimWhat(`He said "${words}" end.`), "He said…");
  assert.equal(trimWhat(`Two (a) and (b) then (${words}) end.`), "Two (a) and (b) then…");
  // a sentence that closes inside a bracket is cut back too
  assert.equal(trimWhat("Games (chess. Tic-tac-toe) here."), "Games…");
  // brackets and quotes that match are left alone
  assert.equal(trimWhat('A (b) "c" d.'), 'A (b) "c" d.');
  // nothing left to show once the open bracket is cut off
  assert.equal(trimWhat(`(${words}`), null);
  for (const what of [`Start of it (${words}) end.`, `He said "${words}" end.`, "Games (chess. Tic-tac-toe) here."]) {
    const out = trimWhat(what);
    assert.equal((out.match(/\(/g) ?? []).length, (out.match(/\)/g) ?? []).length, out);
    assert.equal((out.match(/"/g) ?? []).length % 2, 0, out);
  }
});

test("trimWhat: a sentence ends at . ! ? before a capital or the end, not at e.g. or Dr.", () => {
  assert.equal(trimWhat("Use e.g. the thing and ask Dr. Smith about it. Then more."), "Use e.g. the thing and ask Dr. Smith about it.");
  assert.equal(trimWhat("Version 2.5 is out. Next."), "Version 2.5 is out.");
  assert.equal(trimWhat("Hello! World."), "Hello!");
  assert.equal(trimWhat("Fine? yes it is. Next."), "Fine? yes it is.");
  assert.equal(trimWhat('He said "go." Then left.'), 'He said "go."');
  assert.equal(trimWhat("i.e. The end. After."), "i.e. The end.");
});

test("no git author's name or email ever reaches the cards", () => {
  const printed = JSON.stringify(madeInTown(FIXTURE, resolvers, 99));
  for (const leak of ["A Real Name", "real.person", "example.com"]) {
    assert.equal(printed.includes(leak), false, `the front page would print ${leak}`);
  }
});

test("empty or unreadable projects data gives no cards, so the page draws no section", () => {
  for (const bad of [null, undefined, {}, { projects: [] }, { projects: null }, { projects: "nope" }, [], { projects: [null, 3, {}] }]) {
    assert.deepEqual(madeInTown(bad, resolvers), [], `${JSON.stringify(bad)} gave cards`);
  }
});

test("the front page reads the helper, keeps no list by hand, and keeps the way to everything", () => {
  assert.equal(/const works\s*=\s*\[/.test(PAGE), false, "index.astro still carries a hard-coded works array");
  assert.match(PAGE, /madeInTown\(projectsData,/);
  assert.match(PAGE, /made\.length > 0 &&/, "the section is not guarded on there being projects");
  // outside the guarded section, so they stay on the page when the section does not render
  const after = PAGE.slice(PAGE.indexOf("made.length > 0 &&"));
  const more = after.slice(after.indexOf('<p class="more-line made-more">'));
  assert.ok(more.length > 0 && after.indexOf("</section>") < after.indexOf('<p class="more-line made-more">'), "the way-on line sits inside the guarded section");
  for (const href of ['href="/projects/"', 'href="/daily/"', 'href="/works/the-town-seal.html"', 'href="https://starforge-atelier.online/atelier/the-resident-herbarium/"']) {
    assert.ok(more.slice(0, 700).includes(href), `${href} is not linked under the section`);
  }
});
