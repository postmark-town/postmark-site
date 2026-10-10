// think-tank-stages.test.mjs — THE CHEST CITES THE IDEA, and the lane splits
// by the rung each idea stands on (Linear POS-97, 2026-09-15).
//
// THE INSTANCE. postmark.town/town/ showed all twenty-two ideas as "not drawn
// yet" while the drawing chest held four works, each `status: drawn up`, each
// citing its idea by mark id. Keemin: "which I believe is FALSE". The reader
// asked the IDEA mark for a `blueprint:` slug — the link read backwards from
// the chest's own law ("a directory citing its idea (`idea: <by>/<slug>`)",
// postmark-blueprints INDEX.md) — and nothing writes that field.
//
// THE LAWS QUOTED. The chest: "Drawn up — its blueprint exists in BLUEPRINTS/
// … citing the idea it grew from (frontmatter `idea: <by>/<slug>`)". The
// index: "the work's own proposal.md is the truth" for the stage word. The
// founder, 2026-09-15: "split the ideas into lifecycle stage visually on the
// site, if ideas in that stage exist."
//
// CAN FAIL: (a) in toIdea, drop the chest lookup → the first test reds;
// (b) in byStage, stop filtering empty stages or lose the road's order → the
// second reds; (c) restore "not drawn yet" to the page → the last reds.
//
//   node --test test/think-tank-stages.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  toIdea, ideas, ideaDashboard, markStakes, byStage, blueprintIndex, stageOf, loadBlueprints,
  STAGES, IDEA_CLASS, THINK_TANK_PLACE, BLUEPRINTS_REPO,
} from "../src/lib/civic.mjs";
import { fetchBlueprints, BLUEPRINTS_REPO_SLUG } from "../tools/lib/fetch-town-data.mjs";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");

// the chest as the fetch lands it, shaped on the four works of 2026-09-15
const CHEST = {
  fetched_at: "2026-09-15T15:30:00.000Z", repo: BLUEPRINTS_REPO_SLUG, branch: "main",
  works: [
    { dir: "events-as-first-class-town-objects", title: "Events as first-class town objects", idea: "rei/events-as-first-class-town-objects", status: "drawn up", posted: "2026-08-31", proposed_by: "rei", href: `${BLUEPRINTS_REPO}/blob/main/BLUEPRINTS/events-as-first-class-town-objects/proposal.md` },
    { dir: "panes-presence-write", title: "panes need write access", idea: "stella-letta/household-presence-write", status: "Ground broken", posted: "2026-09-09", proposed_by: "stella-letta", href: `${BLUEPRINTS_REPO}/blob/main/BLUEPRINTS/panes-presence-write/proposal.md` },
  ],
};

test("the chest cites the idea: an idea a blueprint names is drawn, with the chest's own stage and link", () => {
  const chest = blueprintIndex(CHEST);
  const drawn = toIdea({ id: "rei/events-as-first-class-town-objects", body: "Events" }, { chest });
  assert.equal(drawn.ok, true);
  assert.equal(drawn.slug, "events-as-first-class-town-objects", "the slug is the work's directory");
  assert.equal(drawn.href, CHEST.works[0].href, "the link is the work's proposal.md — the chest's truth");
  assert.equal(drawn.stage, "drawn up");
  // the chest's word is normalised, not trusted letter for letter
  const further = toIdea({ id: "stella-letta/household-presence-write", body: "panes" }, { chest });
  assert.equal(further.stage, "ground broken");
  // an idea no work cites is proposed, and fabricates no link
  const bare = toIdea({ id: "k/a-bench", body: "A bench" }, { chest });
  assert.equal(bare.stage, "proposed");
  assert.equal(bare.slug, null);
  assert.equal(bare.href, null);
  // a `blueprint:` field on the mark itself still counts — the old path stays open
  const own = toIdea({ id: "j/second", body: "A second bench", blueprint: "a-second-bench.md" });
  assert.equal(own.stage, "drawn up");
  assert.equal(own.href, `${BLUEPRINTS_REPO}/blob/main/BLUEPRINTS/a-second-bench.md`);
  // and no chest at all leaves every idea proposed — the fail-soft the page relies on
  assert.equal(toIdea({ id: "rei/events-as-first-class-town-objects", body: "Events" }).stage, "proposed");
  assert.equal(loadBlueprints({ path: "/nowhere/blueprints.json" }), null);
});

test("byStage: one group per rung that has ideas, in the road's order, empty rungs absent, an untaught word last", () => {
  assert.deepEqual(STAGES, ["proposed", "drawn up", "subscribed", "declared", "ground broken", "topped out", "passed inspection", "open"]);
  const rows = [
    { id: "a", stage: "drawn up", staked: 9 },
    { id: "b", stage: "proposed", staked: 8 },
    { id: "c", stage: "open", staked: 7 },
    { id: "d", stage: "proposed", staked: 6 },
    { id: "e", stage: "on the moon", staked: 5 },
    { id: "f", stage: null, staked: 4 },
  ];
  const groups = byStage(rows);
  assert.deepEqual(groups.map((g) => g.stage), ["proposed", "drawn up", "open", "on the moon"],
    "the road's order; subscribed/declared/ground broken/topped out/passed inspection have nobody and do not render; the untaught word closes the list");
  assert.deepEqual(groups[0].ideas.map((i) => i.id), ["b", "d", "f"], "inside a group the arrival order (stamp-backed) is kept; a null stage is proposed");
  assert.deepEqual(byStage([]), [], "no ideas, no groups");
  assert.equal(stageOf("  Drawn_Up "), "drawn up");
});

test("the dashboard's drawn figure counts the join, not a field nobody writes", () => {
  const state = {
    marks: [
      { id: THINK_TANK_PLACE },
      { id: "rei/events-as-first-class-town-objects", class: IDEA_CLASS, placementParent: THINK_TANK_PLACE, body: "Events" },
      { id: "k/a-bench", class: IDEA_CLASS, placementParent: THINK_TANK_PLACE, body: "A bench" },
    ],
    portfolios: { x: [{ mark: "k/a-bench", stamps: 3 }] },
  };
  const stakes = markStakes(state);
  const tank = ideas(state, { stakes, chest: blueprintIndex(CHEST) });
  assert.equal(ideaDashboard(tank, stakes).drawn, 1, "the events idea is drawn by the chest's citation; the bench is not");
  assert.equal(ideas(state, { stakes }).ideas.filter((i) => i.slug).length, 0, "and with no chest handed in, nothing is drawn — the reader invents no link");
});

test("fetchBlueprints reads the tree, then each proposal's frontmatter; a failed fetch throws so the caller keeps its snapshot", async () => {
  const tree = { tree: [
    { path: "BLUEPRINTS/INDEX.md" },
    { path: "BLUEPRINTS/one-work/proposal.md" },
    { path: "BLUEPRINTS/one-work/blueprint.md" },
    { path: "BLUEPRINTS/two-work/proposal.md" },
    { path: "_archived/old/proposal.md" },
  ] };
  const raw = {
    "BLUEPRINTS/one-work/proposal.md": "---\ntitle: One work\nproposed_by: rei\nposted: 2026-09-01\nstatus: drawn up\nidea: rei/one\n---\n\n# One work\n",
    "BLUEPRINTS/two-work/proposal.md": "---\ntitle: Two work\nstatus: open\nidea: k/two\n---\n",
  };
  const asked = [];
  const fetchImpl = async (url) => {
    asked.push(url);
    if (url.includes("/git/trees/")) return { ok: true, status: 200, json: async () => tree, text: async () => "" };
    const path = url.split("/main/")[1];
    return raw[path] ? { ok: true, status: 200, text: async () => raw[path], json: async () => ({}) } : { ok: false, status: 404 };
  };
  const chest = await fetchBlueprints({ fetchImpl });
  assert.equal(chest.repo, BLUEPRINTS_REPO_SLUG);
  assert.deepEqual(chest.works.map((w) => [w.dir, w.idea, w.status]), [["one-work", "rei/one", "drawn up"], ["two-work", "k/two", "open"]],
    "only BLUEPRINTS/<work>/proposal.md is a work — not the index, not blueprint.md, not the archive");
  assert.equal(chest.works[0].href, `https://github.com/${BLUEPRINTS_REPO_SLUG}/blob/main/BLUEPRINTS/one-work/proposal.md`);
  assert.equal(asked.length, 3, "one trees call and one raw read per work");
  await assert.rejects(() => fetchBlueprints({ fetchImpl: async () => ({ ok: false, status: 500 }) }), /answered 500/);
});

test("the page renders one label per stage present and has no 'not drawn yet' left to say", () => {
  const src = read("../town/pages/town/index.astro");
  assert.match(src, /const tankStages = byStage\(thinkTank\.ideas\)/, "the split is civic.mjs's, imported");
  assert.match(src, /\{tankStages\.map\(\(g\) => \(/, "the lane is one group per stage");
  assert.match(src, /<p class="m-lab" title=\{[^}]*g\.ideas\.length[^>]*>\{g\.stage\}<\/p>/,
    "each group's label is its stage word alone; the count rides the tooltip (RULE 3: labels name, qualifiers become title=)");
  for (const s of STAGES) {
    assert.ok(s.split(/\s+/).length <= 3 && !/[—·:]/.test(s), `the stage word "${s}" would break RULE 3 as a label`);
  }
  assert.equal(/not drawn yet/.test(src), false, "the card no longer repeats what the group's label says");
  // (and, since POS-290, the idea posts beside the marks; test/think-tank-posts.test.mjs)
  assert.match(src, /ideas\(worldState, \{ places: placeMarks, stakes, chest, posts: ideaPosts \}\)/, "and the reader is handed the chest");
});
