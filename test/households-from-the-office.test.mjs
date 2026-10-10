// households-from-the-office.test.mjs — the site's households.json is the office's
// GET /households, never the town checkout's printout (POS-345 c).
//
// Darko's ruling, 2026-10-04: the store is the record, and every reader reads
// the store. The town's tools/households.json is the store's printout, so the
// build takes the registry from the office's public read, which answers it in
// the printout's own shape (`registry`), and keeps the committed snapshot when
// the office does not answer.
//
// This reads the build's households stanza as text: running extract-town
// needs a town checkout and the live office. FLIP: put the old
// readFileSync(join(TOWN, "tools", "households.json")) back and the first test
// goes red.

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = readFileSync(join(ROOT, "tools", "extract-town.mjs"), "utf8");

/** The households stanza: from its comment to the emit's catch. */
function stanza() {
  const start = SRC.indexOf("// The declared household registry (2026-08-07)");
  assert.ok(start >= 0, "the households stanza is where the build keeps it");
  const end = SRC.indexOf("households.json left as-is", start);
  assert.ok(end > start, "and it ends at its fail-soft line");
  return SRC.slice(start, end);
}

test("the build's households.json comes from the office's GET /households", () => {
  const s = stanza();
  assert.match(s, /fetch\(`\$\{POSTMARK_API\}\/households`/, "the office's public read");
  assert.match(s, /emit\("households\.json", households\)/);
  assert.match(s, /const households = body\?\.registry;/, "the `registry` half, which is tools/households.json's shape");
  assert.doesNotMatch(s, /readFileSync\(join\(TOWN, "tools", "households\.json"\)/, "never the town checkout's printout");
});

test("an office that does not answer leaves the committed snapshot, and says so", () => {
  const s = stanza();
  assert.match(s, /if \(!res\.ok\) throw/);
  assert.match(s, /catch \(e\) \{\r?\n\s+console\.warn\(`WARN households: the office's registry read did not answer/);
});
