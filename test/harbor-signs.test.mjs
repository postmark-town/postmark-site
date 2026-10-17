// harbor-signs.test.mjs — the harbor tells the truth to a reader with no
// JavaScript, and says who berthed in Postmark from each town (POS-574).
//
// No suite renders an .astro page, so this holds the page's source and the one
// pure piece the island imports:
//
//   1. a far town's chart label, as built, never says "not read yet" (the watch
//      reads every shore each 15 minutes, so a no-JS reader was told a false
//      thing), and a <noscript> line points a curl reader at the snapshot;
//   2. src/lib/harbor-berths.mjs § berthsLine, the pane's sentence from the
//      snapshot's `berths_from_here`, and the island calls it.
//
//   node --test test/harbor-signs.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { berthsLine } from "../src/lib/harbor-berths.mjs";

const PAGE = readFileSync(new URL("../town/pages/harbor/index.astro", import.meta.url), "utf8").replace(/\r\n/g, "\n");

test("H1 · the chart's far-town label, as built, says how the figure is read — never 'not read yet'", () => {
  const label = /<text class="hb-node-figl"[^>]*>\s*\{n\.hub \? hubFigure\.label : "([^"]+)"\}/.exec(PAGE);
  assert.ok(label, "the label expression is where the chart prints it");
  assert.equal(label[1], "read live");
  assert.doesNotMatch(PAGE, /"not read yet"/, "the false label is gone from the build");
});

test("H2 · without JavaScript, the chart says where the reading is: the snapshot's own address", () => {
  const ns = /<noscript>\s*<p class="hb-quiet" data-nojs-figures>([\s\S]*?)<\/p>\s*<\/noscript>/.exec(PAGE);
  assert.ok(ns, "a noscript line sits with the chart");
  assert.match(ns[1], /<a href=\{SNAPSHOT\}>/, "it links the same address the island fetches, never a second spelling");
  assert.match(ns[1], /curl/);
  assert.match(PAGE, /const SNAPSHOT = import\.meta\.env\.DEV\s*\? "https:\/\/postmark\.town\/harbor\/data\/harbor-snapshot\.json"\s*: "\/harbor\/data\/harbor-snapshot\.json";/,
    "the two-clocks rule stands: the build reads no snapshot, it only names it");
});

test("H3 · berthsLine: the pane's one sentence, counts as the office keeps them", () => {
  assert.equal(berthsLine({ ever: 4, live: 1, cosigned: 0 }), "4 travellers have berthed in Postmark from here; 1 aboard now.");
  assert.equal(berthsLine({ ever: 1, live: 0, cosigned: 0 }), "1 traveller has berthed in Postmark from here; 0 aboard now.");
  assert.equal(berthsLine({ ever: 3, live: 1, cosigned: 2 }), "3 travellers have berthed in Postmark from here; 1 aboard now; 2 co-signed into a house.");
  assert.equal(berthsLine({ ever: 0, live: 0, cosigned: 0 }), "No traveller has berthed in Postmark from here yet.", "an honest zero is said");
});

test("H4 · no count is said as nothing, never as a zero", () => {
  for (const missing of [undefined, null, {}, { ever: "many" }, { ever: -1 }, "4"])
    assert.equal(berthsLine(missing), null, JSON.stringify(missing));
});

test("H5 · the island imports the sentence and paints it from each town's berths_from_here", () => {
  assert.match(PAGE, /import \{ berthsLine \} from "@\/lib\/harbor-berths\.mjs";/);
  assert.match(PAGE, /var berths = berthsLine\(t\.berths_from_here\);\s*if \(berths\) \{/);
});
