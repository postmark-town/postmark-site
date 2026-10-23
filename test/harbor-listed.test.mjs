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

import { loadCharters, glyphFor } from "../src/lib/harbor.mjs";

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
  assert.deepEqual(commons.predicates.map((p) => p.slot), ["door", "listed"], "listed reads last on the card");
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

test("L5 · the page draws no road to a listed town, reads no shore there, and badges its card", () => {
  assert.match(PAGE, /const ringNodes = chartered\.map\(/, "the ring holds the chartered towns alone");
  assert.match(PAGE, /\{ringNodes\.map\(\(n\) => \(\s*<g class="hb-route-pair"/, "roads run only to the ring");
  assert.match(PAGE, /\{!n\.listed && \(\s*<Fragment>\s*<text\s+class:list=\{\["hb-node-fig"/, "a listed town carries no figure");
  assert.match(PAGE, /\) : n\.listed \? \(\s*<p class="hb-quiet hb-listed-note">/, "a listed pane has a note, not a data-shore");
  assert.match(PAGE, /\{n\.listed && <span class="hb-pane-listed">listed, no charter<\/span>\}/);
  assert.match(PAGE, /Listed beside them, with no charter and no road/, "the chart's label never counts a listed town as chartered");
  assert.match(PAGE, /const doors = chartered\.map\(/, "the footer's \"chartered towns\" are the chartered towns");
});
