// non-residents.test.mjs — CORE-187: the Pen is not a resident, and the real meeps are.
//
//   node --test test/non-residents.test.mjs
//
// Darko, 2026-11-25: "postmark-pen shouldn't appear under residents (as it isn't one)", and of /residents/bugcatcher/appearance/ returning 404: "why doesn't this page exist".
// PURE, with INVENTED rows (the Pen served with either office flag, a real meep flagged is_office, the Registrar, an ordinary resident). The build's own consumer
// (buildOfficeData) is exercised in test/fetch-town-data.test.mjs; here the shared eligibility, the house fold, the published registry, every writer and every resident route.
//
// FALSIFIERS: the Pen in any roll, house (member or arriving), registry member list, route or data file; a real meep (is_office) still 404ing its appearance page; the Registrar or an
// ordinary resident lost; the office-role flag used as the rule, or a list of today's meeps; the existing human-field guard or any unrelated registry field changed.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { NON_RESIDENT_HANDLES, isResidentHandle, residentHandlesOnly, residentsOnly } from "../src/lib/non-residents.mjs";
import { buildHouses } from "../src/lib/houses.mjs";
import { publicRegistry } from "../tools/lib/public-registry.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

// the invented population: the Pen with EITHER flag (the office has served both), a real meep flagged is_office, the Registrar (not flagged), an ordinary resident
const PEN_OFFICE = { handle: "postmark-pen", is_office: true, address: { agent: "Postmark Pen" } };
const PEN_PLAIN = { handle: "postmark-pen", is_office: false };
const BUGCATCHER = { handle: "bugcatcher", is_office: true, address: { agent: "Bugcatcher" } };
const ARCHITECT = { handle: "architect", is_office: true };
const REGISTRAR = { handle: "registrar", is_office: false };
const REI = { handle: "rei", is_office: false };

test("the Pen is no resident whatever its office flag says; every other row, the real meeps and the Registrar included, is passed through as it is, in order", () => {
  assert.deepEqual([...NON_RESIDENT_HANDLES], ["postmark-pen"], "one handle: the rule is not the office-role flag and not a list of meeps");
  for (const pen of [PEN_OFFICE, PEN_PLAIN]) {
    const rows = [REI, pen, BUGCATCHER, ARCHITECT, REGISTRAR];
    const out = residentsOnly(rows);
    assert.deepEqual(out.map((r) => r.handle), ["rei", "bugcatcher", "architect", "registrar"]);
    assert.equal(out[1], BUGCATCHER, "the same row object, untouched");
    assert.equal(out.find((r) => r.handle === "bugcatcher").is_office, true, "a real meep keeps its office flag");
  }
  assert.equal(isResidentHandle("postmark-pen"), false);
  assert.equal(isResidentHandle("bugcatcher"), true);
  assert.equal(isResidentHandle("postmark-pen-fan"), true, "an exact handle, not a prefix");
  assert.deepEqual(residentHandlesOnly(["rei", "postmark-pen", "architect"]), ["rei", "architect"]);
  assert.equal(residentsOnly(null), null);
  assert.deepEqual(residentsOnly([null, undefined, REI]), [null, undefined, REI], "a row that is no row is not this rule's business (it has no handle to be the Pen's): it never throws and is passed as it is");
});

test("HOUSES: a registry that names the Pen in the-town makes it neither a member, nor arriving, nor a house of its own; the real meep stays a member", () => {
  const registry = { households: { "the-town": { residents: ["postmark-pen", "bugcatcher"], since: "2026-08-01" }, rookery: { residents: ["rei", "registrar"] } } };
  for (const residents of [[REI, BUGCATCHER, REGISTRAR], [REI, BUGCATCHER, REGISTRAR, PEN_OFFICE], [REI, BUGCATCHER, REGISTRAR, PEN_PLAIN]]) {
    const { houseOf, bySlug } = buildHouses(residents, registry);
    const town = [...bySlug.values()].find((h) => h.slug === "the-town");
    assert.deepEqual(town.residents, ["bugcatcher"], "the Pen is no member");
    assert.deepEqual(town.arriving, [], "and is not 'arriving' either");
    assert.equal(houseOf.has("postmark-pen"), false, "and has no house of one");
    assert.equal(houseOf.get("bugcatcher").slug, "the-town");
    assert.deepEqual([...bySlug.values()].find((h) => h.slug === "rookery").residents, ["rei", "registrar"], "an ordinary house is as it was");
  }
  // a house whose only declared member is the Pen has nobody ashore: no page, as for any house with nobody ashore
  const lonely = buildHouses([REI], { households: { penhouse: { residents: ["postmark-pen"] } } });
  assert.equal(lonely.bySlug.size, 0);
});

test("THE PUBLISHED REGISTRY: the Pen leaves each row's member list; every other member and key, the human guard included, is as the office served it", () => {
  const registry = { schema_version: 1, note: "n", households: {
    "the-town": { residents: ["postmark-pen", "bugcatcher"], since: "2026-08-01", human: "PRIVATE_SENTINEL_town", name: "The Town", hearth: "h1" },
    rookery: { residents: ["rei", "registrar"], human: "PRIVATE_SENTINEL_rookery" },
  } };
  const before = JSON.stringify(registry);
  const out = publicRegistry(registry);
  assert.deepEqual(out.households["the-town"].residents, ["bugcatcher"]);
  assert.deepEqual(out.households.rookery.residents, ["rei", "registrar"]);
  assert.equal(JSON.stringify(registry), before, "the input is not changed");
  for (const row of Object.values(out.households)) assert.equal("human" in row, false, "the private key is still dropped");
  assert.equal(out.households["the-town"].name, "The Town");
  assert.equal(out.households["the-town"].hearth, "h1");
  assert.equal(out.households["the-town"].since, "2026-08-01");
  assert.deepEqual(Object.keys(out.households["the-town"]), ["residents", "since", "name", "hearth"], "every other key, in its own order");
  // an array of rows, and a row with no member list
  assert.deepEqual(publicRegistry({ households: [{ residents: ["postmark-pen", "x"] }, { name: "no members" }] }).households, [{ residents: ["x"] }, { name: "no members" }]);
  assert.equal(publicRegistry("not a registry"), "not a registry");
});

test("EVERY WRITER: the roll the build walks, the snapshot it lends from, both extract-town emitters, and the published registry all go through the one eligibility", () => {
  const data = read("tools/lib/fetch-town-data.mjs");
  assert.match(data, /import \{ residentsOnly \} from "\.\.\/\.\.\/src\/lib\/non-residents\.mjs";/);
  assert.match(data, /const residentHandles = residentsOnly\(rollRes\.roll\)\.map\(\(r\) => r\.handle\)\.sort\(\);/, "the Pen is never in the roll the build walks: no card read, no row, no count");
  assert.match(data, /const snapshotResidents = residentsOnly\(ensureArray\(readSnapshot\("residents\.json", \[\]\), "snapshot residents\.json"\)\);/, "an older snapshot never lends the Pen's row back");
  const extract = read("tools/extract-town.mjs");
  assert.match(extract, /import \{ residentsOnly \} from "\.\.\/src\/lib\/non-residents\.mjs";/);
  assert.match(extract, /const snapshot = residentsOnly\(JSON\.parse\(readFileSync\(residentsPath, "utf8"\)\)\);/, "the non-legacy overlay emit");
  assert.match(extract, /const residentsOut = residentsOnly\(town\.residents\)\.map\(/, "the legacy normal emit");
  assert.match(read("tools/lib/public-registry.mjs"), /row\.residents = residentHandlesOnly\(row\.residents\)/);
  assert.match(read("src/lib/houses.mjs"), /const residents = residentsOnly\(allResidents\);/);
  assert.match(read("src/lib/houses.mjs"), /const declared = residentHandlesOnly\(dec\.residents \?\? \[\]\);/);
});

test("EVERY RESIDENT ROUTE: the appearance page is built for every resident, real meeps included, and not for the Pen; the resident, window and rendition paths are residents only; the flag is not the rule", () => {
  const appearance = read("town/pages/residents/[handle]/appearance.astro");
  assert.match(appearance, /return residentsOnly\(residents\)\.map\(\(r\) => \(\{ params: \{ handle: r\.handle \}, props: \{ resident: r \} \}\)\);/);
  assert.equal(/is_office/.test(appearance), false, "no office-flag rule left in the appearance page's paths");
  assert.match(appearance, /import \{ residentsOnly \} from "@\/lib\/non-residents\.mjs";/);
  // the template itself is untouched: the same likeness words, the same held-sheet words, the same owner controls
  for (const kept of ["likenessWords(house, house?.residents?.length ?? 1)", "data-ap-glance", "Reference sheet", "residentFace(r, media, homePictureOf(r.handle))"]) assert.ok(appearance.includes(kept), kept);
  assert.match(read("town/pages/residents/[handle].astro"), /return residentsOnly\(residents\)\.map\(\(r\) => \(\{ params: \{ handle: r\.handle \}, props: \{ resident: r \} \}\)\);/);
  assert.match(read("town/pages/window/[handle].astro"), /return residentsOnly\(residents\)\.map\(\(r\) => \(\{ params: \{ handle: r\.handle \} \}\)\);/);
  const rendition = read("town/pages/residents/[handle]/view/[rendition].astro");
  assert.match(rendition, /for \(const r of residentsOnly\(residents\)\) \{/);
  assert.match(rendition, /if \(r\.is_office\) continue;/, "the rendition page's own office skip is unchanged");
  // the Appearance button on every resident's page already pointed at the path; it is not conditional on the flag
  assert.match(read("town/components/Household.astro"), /<a class="pm-btn ghost" href=\{`\/residents\/\$\{t\.handle\}\/appearance\/`\}>◐ Appearance<\/a>/);
});

test("THE COMMITTED DATA: no resident data, public copy or registry the site ships names the Pen as a resident", () => {
  for (const file of ["src/data/postmark/residents.json", "public/atelier/postmark/data/residents.json"]) {
    const rows = JSON.parse(read(file));
    assert.equal(rows.some((r) => r.handle === "postmark-pen"), false, `${file}: the Pen is not in the roll`);
  }
  for (const file of ["src/data/postmark/households.json", "public/atelier/postmark/data/households.json"]) {
    const registry = JSON.parse(read(file));
    for (const [slug, row] of Object.entries(registry.households ?? {})) assert.equal((row.residents ?? []).includes("postmark-pen"), false, `${file}: ${slug} does not list the Pen`);
  }
});
