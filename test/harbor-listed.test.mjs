// harbor-listed.test.mjs — a town listed on the harbor is never called
// chartered (POS-763).
//
// The harbor's registry reads town marks from two filings: under the harbor's
// own directory (the first charters) and by id under the-town (every town
// since). A town with a `slot: listed` predicate stands on the chart with no
// charter: no road, no instrument read, a "listed" badge on its card.
//
//   node --test test/harbor-listed.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { loadCharters, glyphFor, countOf, nameFor } from "../src/lib/harbor.mjs";

const PAGE = readFileSync(new URL("../town/pages/harbor/index.astro", import.meta.url), "utf8").replace(/\r\n/g, "\n");

function world() {
  const root = mkdtempSync(join(tmpdir(), "harbor-listed-"));
  const write = (rel, fm, body) => {
    mkdirSync(join(root, rel), { recursive: true });
    writeFileSync(join(root, rel, "mark.md"), `---\n${fm}\n---\n\n${body}\n`);
  };
  const harbor = "marks/let-there-be-light/the-harbor-reach/the-long-run-harbor";
  write(`${harbor}/postmark`, "kind: town\nby: the-town\ndate: 2026-08-16", "the hub");
  write(`${harbor}/1f916`, "kind: town\nby: the-town\ndate: 2026-08-16", "the forum");
  write(`${harbor}/1f916/1f916-door`, "kind: predicate\nby: the-town\ndate: 2026-08-16\nslot: door\nvalue: https://1f916.ai", "its door");
  write("marks/the-town/the-commons", "kind: town\nby: the-town\ndate: 2026-10-22", "a public square");
  write("marks/the-town/the-commons/the-commons-listed", "kind: predicate\nby: the-town\ndate: 2026-10-22\nslot: listed\nvalue: by Postmark on 2026-10-22", "no charter");
  write("marks/the-town/the-commons/the-commons-residents", "kind: predicate\nby: the-town\ndate: 2026-10-22\nslot: residents\nvalue: 530+ voices, read 2026-10-22", "as the square counts them");
  write("marks/the-town/the-commons/the-commons-door", "kind: predicate\nby: the-town\ndate: 2026-10-22\nslot: door\nvalue: https://jointhecommons.space", "its door");
  // a by-id town-town mark that is not a town stays off the registry
  write("marks/the-town/the-civic-quarter", "kind: sited\nby: the-town\ndate: 2026-08-30", "where the town asks");
  return { root, harbor: join(root, harbor), byId: join(root, "marks/the-town") };
}

test("L1 · both filings are read; a listed town is flagged and sorts after every chartered one", () => {
  const w = world();
  const towns = loadCharters({ path: w.harbor, byIdPath: w.byId });
  assert.deepEqual(towns.map((t) => [t.slug, t.listed]), [["postmark", false], ["1f916", false], ["the-commons", true]]);
  const commons = towns.find((t) => t.slug === "the-commons");
  assert.equal(commons.door, "https://jointhecommons.space");
  assert.deepEqual(commons.predicates.map((p) => p.slot), ["door", "residents", "listed"], "listed reads last on the card");
  assert.deepEqual(commons.count, { n: "530+", unit: "voices", read: "2026-10-22", none: false });
});

test("L2 · the pinned read takes both filings from one WORLD", () => {
  const w = world();
  const towns = loadCharters({ env: { HARBOR_WORLD_DIR: w.root } });
  assert.deepEqual(towns.map((t) => t.slug), ["postmark", "1f916", "the-commons"]);
});

test("L3 · a test's single registry still reads alone", () => {
  const w = world();
  assert.deepEqual(loadCharters({ path: w.harbor }).map((t) => t.slug), ["postmark", "1f916"]);
});

test("L4 · a named town flies no borrowed glyph", () => {
  assert.equal(glyphFor("the-commons"), "");
  assert.equal(glyphFor("delve"), "");
  assert.notEqual(glyphFor("1f916"), "");
});

test("L5 · a listed town is a lantern on the far water: no flight path, no shore read, a no-charter badge on its card", () => {
  assert.match(PAGE, /const moored = chartered\.filter\(\(t\) => !t\.hub\)/, "the chart moors the chartered towns alone");
  assert.match(PAGE, /layoutTowns\(frame, moored\)/, "the chart's towns are the moored ones");
  assert.match(PAGE, /\{d\.towns\.map\(\(t\) => \(\s*<g class="hb-route-pair"/, "flight paths run only to the chart's towns");
  assert.match(PAGE, /\{listed\.map\(\(t\) => \(\s*<li class="hb-lantern">/, "the listed towns are the far water's lanterns");
  assert.match(PAGE, /\) : t\.listed \? \(\s*<p class="hb-listed-note">/, "a listed card has a note, not a data-shore");
  assert.match(PAGE, /t\.listed \? "Listed · no charter"/, "a listed card says it holds no charter");
  assert.match(PAGE, /Listed on the far water, with no charter and no flight path/, "the chart's label never counts a listed town as chartered");
  assert.match(PAGE, /const doors = chartered\.map\(/, "the footer's \"chartered towns\" are the chartered towns");
});

test("L6 · a listed town's count is the world's dated record: a number, a dash, or nothing — never a zero", () => {
  const c = (value) => countOf([{ slot: "residents", value }]);
  assert.deepEqual(c("862 accounts, read 2026-10-22"), { n: "862", unit: "accounts", read: "2026-10-22", none: false });
  assert.deepEqual(c("— none published, read 2026-10-22"), { n: "—", unit: "none published", read: "2026-10-22", none: true });
  assert.equal(c("20 residents").unit, "residents");
  assert.equal(c("many"), null, "an unparsed value is no count");
  assert.equal(countOf([]), null);
  assert.ok(PAGE.includes(`<span class:list={["hb-count", (!t.count || t.count.none) && "is-none"]}>{t.count ? t.count.n : "—"}</span>`), "the lantern prints its count, or a dash");
  assert.ok(PAGE.includes(`{t.count ? t.count.unit : "no count recorded"}`), "a lantern with no count predicate says so");
});

test("L7 · a town keeps its own name and casing: `slot: name` first, the slug only when it names none", () => {
  const p = (value) => [{ slot: "name", value }];
  assert.equal(nameFor("gsb", p("gsb")), "gsb", "gsb is lowercase by its own name");
  assert.equal(nameFor("obend", p("obend")), "obend");
  assert.equal(nameFor("the-world", p("The World")), "The World");
  assert.equal(nameFor("delve", p("delve.town")), "delve.town");
  // no name on the mark: the slug, as the harbor always read it
  assert.equal(nameFor("the-commons", []), "The Commons");
  assert.equal(nameFor("1f3d9", []), "1f3d9");
  // the registry carries it, and the card never repeats it as a row
  const root = mkdtempSync(join(tmpdir(), "harbor-name-"));
  const write = (rel, fm, body) => {
    mkdirSync(join(root, rel), { recursive: true });
    writeFileSync(join(root, rel, "mark.md"), `---\n${fm}\n---\n\n${body}\n`);
  };
  write("gsb", "kind: town\nby: the-town\ndate: 2026-10-22", "a card world");
  write("gsb/gsb-name", "kind: predicate\nby: the-town\ndate: 2026-10-22\nslot: name\nvalue: gsb", "its own name");
  assert.equal(loadCharters({ path: root })[0].name, "gsb");
  assert.match(PAGE, /t\.predicates\.filter\(\(p\) => p\.slot !== "name"\)/, "the card prints the name twice");
  assert.doesNotMatch(PAGE, /w\[0\]\.toUpperCase\(\)/, "the page re-cases a town's name");
});
