// public-household-render.test.mjs — the household and resident surfaces never print the private human, rendered (POS-394).
//
//   node --test --test-concurrency=1 test/public-household-render.test.mjs
//
// Wright 2026-10-13 05:56 / 06:29: the render proof runs in the site's own
// suite. Each run BUILDS the household and resident pages with Astro's own
// build() and renders the Household fragments and resident card in Astro's
// container (the checkout's own node_modules, as `npm ci` made them), from a
// code-only projection with invented data, in guarded children — see
// tools/pos394-render-proof.mjs for what is rendered, how it stays away from
// data, and its limits.
//
// Order: the fixed source GREEN; then each falsifier, which re-inserts one old
// private-human clause into the projection only, must turn exactly its own
// privacy assertions RED (the sentinel in the rendered HTML) — not a crash, a
// refusal or a missing dependency; then the fixed source GREEN again. A
// pipeline that cannot start FAILS (never skips). Nothing rendered is printed.

import test from "node:test";
import assert from "node:assert/strict";
import { runProof, falsified, MUTANTS, CASES } from "../tools/pos394-render-proof.mjs";

const CHECK_TOTAL = Object.values(CASES).reduce((n, c) => n + c.length, 0);

function assertGreen(r) {
  assert.deepEqual(r.problems, [], "the fixed source renders every surface without the private human");
  assert.equal(r.pass, true);
  assert.equal(Object.keys(r.cases ?? {}).length, Object.keys(CASES).length, "every surface rendered");
  assert.equal(Object.keys(CASES).length, 5);
  const ran = Object.values(r.cases).reduce((n, c) => n + Object.keys(c.checks).length, 0);
  assert.equal(ran, CHECK_TOTAL, `every check ran (${ran})`);
  assert.equal(CHECK_TOTAL, 28, "7 + 4 + 3 + 9 + 5 checks");
  for (const [name, c] of Object.entries(r.cases)) assert.ok(c.bytes > 0, `${name} rendered HTML`);
  assert.equal(r.cleanup?.ok, true, "the run removed its own temp tree");
  assert.match(r.head ?? "", /^[0-9a-f]{40}$/);
}

test("the fixed source: the built pages, fragments and card carry no private human", () => {
  assertGreen(runProof());
});

for (const [name, m] of Object.entries(MUTANTS)) {
  test(`falsifier ${name} (${m.emitter}): exactly its privacy assertions go red`, () => {
    const r = runProof({ mutant: name });
    assert.deepEqual(falsified(r, name), [], "red for the right reason: the sentinel rendered, no crash, refusal or setup failure");
    assert.equal(r.pass, false);
    assert.equal(r.cleanup?.ok, true, "the run removed its own temp tree");
  });
}

test("the fixed source again, after every falsifier: green", () => {
  assertGreen(runProof());
});
