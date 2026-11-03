// meet-residents.test.mjs — the front page's "Meet the Residents" are chosen
// live: the busiest households in /households/'s own order, one resident from
// each, with a house picture, never a working Meep.
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
const pick = (opts = { skip: fx.meeps }, image = imageOf) => meetResidents(fx.residents, fx.registry, marksBy, image, opts);
const handles = (list) => list.map((m) => m.resident.handle);

test("six cards: the busiest houses in /households/'s order, one resident each, capped at six", () => {
  // the-orchard (mulberry, not nectar: one per house) · amber · the grove (cedar:
  // birch is a Meep) · dune has no picture, passed over · postie's house is a
  // Meep alone, passed over · the pair (larch: kestrel has no picture) · jade
  // beats ember on marks at 12 letters each · fern, gale, hazel are cut by the cap.
  assert.deepEqual(handles(pick()), ["mulberry", "amber", "cedar", "larch", "jade", "ember"]);
  assert.equal(pick().length, MEET_LIMIT);
  assert.equal(MEET_LIMIT, 6);
});

test("one resident per household, even where several have pictures", () => {
  const houses = houseDirectory(fx.residents, fx.registry, marksBy);
  const houseOfHandle = new Map(houses.flatMap((h) => h.members.map((m) => [m.handle, h.key])));
  const got = pick({ skip: fx.meeps, limit: 99 });
  const keys = got.map((m) => houseOfHandle.get(m.resident.handle));
  assert.equal(new Set(keys).size, keys.length, "two cards from one house");
  assert.ok(!handles(got).includes("nectar"), "the orchard's second pictured resident is not offered");
});

test("it is the directory's order, not a second ranking", () => {
  const houses = houseDirectory(fx.residents, fx.registry, marksBy);
  const wanted = houses
    .map((h) => h.members.find((m) => fx.pictures[m.handle] && !fx.meeps.includes(m.handle))?.handle)
    .filter(Boolean)
    .slice(0, 6);
  assert.deepEqual(handles(pick()), wanted);
});

test("the town's working Meeps are not offered; a house of Meeps alone is passed over", () => {
  const got = handles(pick({ skip: fx.meeps, limit: 99 }));
  assert.ok(!got.includes("birch") && !got.includes("postie"), "a Meep got a card");
  // with no skip list the Meeps are ordinary residents: birch (first of the grove) and postie appear
  const none = handles(pick({ limit: 99 }));
  assert.ok(none.includes("birch") && none.includes("postie") && !none.includes("cedar"));
});

test("a resident without a house picture is skipped, however busy their house; the house's next member is offered", () => {
  const got = handles(pick());
  assert.ok(!got.includes("dune"), "dune has the fourth-busiest house and no picture");
  assert.ok(!got.includes("kestrel") && got.includes("larch"), "the pair's first member has no picture, its second does");
  assert.deepEqual(handles(pick({ skip: fx.meeps }, () => null)), []);
});

test("a departed or renamed handle that the registry still names gets no card", () => {
  // `ghost` is in the grove's registry row and has a picture row, but is no resident
  const got = handles(pick({ skip: fx.meeps, limit: 99 }));
  assert.ok(!got.includes("ghost"));
});

test("fewer qualifying houses than six: only the ones there are", () => {
  const few = { amber: fx.pictures.amber, iris: fx.pictures.iris, birch: fx.pictures.birch };
  const got = pick({ skip: fx.meeps }, (r) => few[r.handle]);
  assert.deepEqual(handles(got), ["amber", "iris"], "birch is a Meep and its housemate cedar has no picture here");
  assert.equal(got[0].img, fx.pictures.amber, "the card carries the image imageOf gave");
});

test("the front page uses it: no hand-written roster, Meeps skipped, one shared picture rule, 'Meet all' straight to /households/", () => {
  const page = readFileSync(join(ROOT, "town", "pages", "index.astro"), "utf8");
  assert.ok(!/meetRoster/.test(page), "the hard-coded roster is back");
  assert.match(page, /meetResidents\(/);
  assert.match(page, /skip: meeps\.map\(/, "the working Meeps are no longer skipped");
  assert.match(page, /cardImageOf\(r, media, homePictureOf\)/, "the front page has its own picture rule");
  assert.match(page, /<a href="\/households\/">Meet all \{stats\.residents\} residents →<\/a>/);
  assert.ok(!/<a href="\/residents\/">Meet all/.test(page), "'Meet all' goes through the moved stub");
  assert.match(page, /The busiest households, each at home/);
});
