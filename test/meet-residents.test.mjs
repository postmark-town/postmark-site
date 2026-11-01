// meet-residents.test.mjs — the front page's "Meet the Residents" are chosen
// live, in /households/'s own busiest-first order, from residents who have a
// house picture.
//
//   node --test test/meet-residents.test.mjs
//
// The cold walk's finding: the section was a hand-written roster of six under
// the caption "The busiest correspondents", and on /households/ those six
// ranked about 6, 20, 21, 84, 97 and 115. The fixture is hand-written
// (test/fixtures/meet-residents.json): its header says the order of its houses.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { meetResidents, MEET_LIMIT } from "../src/lib/meet-residents.mjs";
import { houseDirectory, marksByAuthor } from "../src/lib/households-directory.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const fx = JSON.parse(readFileSync(join(ROOT, "test", "fixtures", "meet-residents.json"), "utf8"));
const marksBy = marksByAuthor({ marks: fx.marks });
const imageOf = (r) => fx.pictures[r.handle];
const handles = (list) => list.map((m) => m.resident.handle);

test("the cards are /households/'s order, house by house, minus anyone without a picture, capped at six", () => {
  const got = meetResidents(fx.residents, fx.registry, marksBy, imageOf);
  // amber (40) · the grove (35: birch, cedar in founding order) · dune (30) has
  // no picture and is skipped · jade beats ember on marks at 12 letters each ·
  // fern is the sixth · gale and hazel are cut by the cap.
  assert.deepEqual(handles(got), ["amber", "birch", "cedar", "jade", "ember", "fern"]);
  assert.equal(got.length, MEET_LIMIT);
  assert.equal(MEET_LIMIT, 6);
});

test("it is the directory's order, not a second ranking", () => {
  const page = houseDirectory(fx.residents, fx.registry, marksBy).flatMap((h) => h.members.map((m) => m.handle));
  const got = handles(meetResidents(fx.residents, fx.registry, marksBy, imageOf));
  const wanted = page.filter((h) => fx.pictures[h]).slice(0, 6);
  assert.deepEqual(got, wanted);
});

test("a resident without a house picture is skipped, however busy their house", () => {
  const got = handles(meetResidents(fx.residents, fx.registry, marksBy, imageOf));
  assert.ok(!got.includes("dune"), "dune has the third-busiest house and no picture");
  assert.deepEqual(handles(meetResidents(fx.residents, fx.registry, marksBy, () => null)), []);
});

test("a departed or renamed handle that the registry still names gets no card", () => {
  // `ghost` is in the grove's registry row and has a picture row, but is no resident
  const got = handles(meetResidents(fx.residents, fx.registry, marksBy, imageOf, 99));
  assert.ok(!got.includes("ghost"));
  assert.equal(got.length, 9, "every resident with a picture, and nobody else");
});

test("fewer pictured residents than six: only the ones there are", () => {
  const few = { amber: fx.pictures.amber, iris: fx.pictures.iris };
  const got = meetResidents(fx.residents, fx.registry, marksBy, (r) => few[r.handle]);
  assert.deepEqual(handles(got), ["amber", "iris"]);
  assert.equal(got[0].img, fx.pictures.amber, "the card carries the image imageOf gave");
});

test("the front page uses it: no hand-written roster, and 'Meet all' goes straight to /households/", () => {
  const page = readFileSync(join(ROOT, "town", "pages", "index.astro"), "utf8");
  assert.ok(!/meetRoster/.test(page), "the hard-coded roster is back");
  assert.match(page, /meetResidents\(/);
  assert.match(page, /<a href="\/households\/">Meet all \{stats\.residents\} residents →<\/a>/);
  assert.ok(!/<a href="\/residents\/">Meet all/.test(page), "'Meet all' goes through the moved stub");
});
