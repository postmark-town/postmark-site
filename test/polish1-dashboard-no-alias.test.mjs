// polish1-dashboard-no-alias.test.mjs — POS-855 polish-1, item 1.
//
// HouseDashboard.astro once carried `const say = numberWord;`: two names for
// one function. The resident count in the header calls `numberWord` directly,
// and the alias must not come back. Source-level pin (no suite renders an
// .astro component); it reads only the component file.
//
//   node --test test/polish1-dashboard-no-alias.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(
  new URL("../src/components/household-dashboard/HouseDashboard.astro", import.meta.url),
  "utf8",
);

test("the dashboard has no second name for numberWord", () => {
  assert.doesNotMatch(src, /\bconst\s+say\s*=/, "no `const say = ...` alias");
  assert.doesNotMatch(src, /=\s*numberWord\s*;/, "numberWord is not re-bound to another name");
  assert.doesNotMatch(src, /\{say\(/, "the markup does not call a `say(...)` alias");
});

test("the resident count in the header calls numberWord directly", () => {
  assert.match(src, /\{numberWord\(faces\.length\)\} \{faces\.length === 1 \? "resident" : "residents"\}/);
});
