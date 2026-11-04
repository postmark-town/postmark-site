// front-law-road.test.mjs — the front page points at the Docs road to the
// town's rules and how-tos (POS-855, Site UX campaign).
//
//   node --test test/front-law-road.test.mjs
//
// Cold walks found the front page never says where the rules or how-tos are.
// /docs/ opens with a "Find your way" road; its <section> carries the stable id
// "find-your-way", and step 02 ("The doors") of "How the town works" links to
// /docs/#find-your-way. Source only: nothing is built and no town data is read.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const front = readFileSync(join(root, "town/pages/index.astro"), "utf8");
const docs = readFileSync(join(root, "town/pages/docs/index.astro"), "utf8");

test("the docs road section has the stable id find-your-way", () => {
  const m = docs.match(/<section\b[^>]*class="dx-road"[^>]*>/);
  assert.ok(m, "the dx-road section is missing from docs/index.astro");
  assert.match(m[0], /\bid="find-your-way"/, "the road <section> lost id=\"find-your-way\"");
});

test("the road's heading id stays, so existing links hold", () => {
  assert.match(docs, /<h2 id="dx-road-h">Find your way<\/h2>/);
});

test("step 02 (The doors) links to /docs/#find-your-way", () => {
  const start = front.indexOf("<h3>The doors</h3>");
  assert.ok(start >= 0, "step 'The doors' is missing from index.astro");
  const end = front.indexOf("</div>", start);
  const step = front.slice(start, end);
  assert.match(step, /<a href="\/docs\/#find-your-way">/, "The doors no longer links /docs/#find-your-way");
});

test("the front page link target exists on the docs page", () => {
  const hrefs = [...front.matchAll(/href="\/docs\/#([^"]+)"/g)].map((m) => m[1]);
  assert.ok(hrefs.includes("find-your-way"), "no /docs/#find-your-way link on the front page");
  for (const id of hrefs) {
    assert.ok(docs.includes(`id="${id}"`), `docs/index.astro has no id="${id}"`);
  }
});
