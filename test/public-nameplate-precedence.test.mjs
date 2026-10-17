// public-nameplate-precedence.test.mjs — the nameplate is the house's own name, then its key, never its human (POS-394).
//
//   node --test test/public-nameplate-precedence.test.mjs
//
// Wright 2026-10-13: own name, then slug, NEVER the human, whether or not the
// house handed in says it is declared. PURE: imports src/lib/houses.mjs only;
// every name, key and marker is INVENTED.

import test from "node:test";
import assert from "node:assert/strict";
import { nameplate } from "../src/lib/houses.mjs";

const MARKER = "PRIVATE_SENTINEL_q8wd_human";
const clean = (s) => !s.includes(MARKER) && !s.includes("’s household");

test("a house carrying a human, no name and a key plates by its key, declared absent, false or true", () => {
  for (const declared of [undefined, false, true]) {
    const house = { slug: "brass-hollow", human: MARKER, residents: ["wren"] };
    if (declared !== undefined) house.declared = declared;
    const plate = nameplate(house);
    assert.equal(plate, "Brass Hollow", `declared ${declared}`);
    assert.ok(clean(plate), `declared ${declared}: no human, no possessive`);
  }
  assert.equal(nameplate({ slug: "end-of-the-lane", human: MARKER, residents: ["wren", "moss"] }), "End of the Lane", "the key's formatting is kept");
});

test("the house's own name comes before its key, formatted as before, and the human never", () => {
  for (const declared of [undefined, false, true]) {
    assert.equal(nameplate({ declared, name: "Kettle Yard", slug: "brass-hollow", human: MARKER, residents: ["wren"] }), "Kettle Yard");
    assert.equal(nameplate({ declared, name: "kettle yard", slug: "brass-hollow", human: MARKER, residents: ["wren"] }), "Kettle Yard", "a lowercase name is title-cased");
    assert.equal(nameplate({ declared, name: "   ", slug: "brass-hollow", human: MARKER, residents: ["wren"] }), "Brass Hollow", "a blank name falls to the key");
  }
});

test("with neither name nor key: the shared generic or nothing, never the human", () => {
  const shared = nameplate({ declared: false, human: MARKER, residents: ["wren", "moss"] });
  const solo = nameplate({ human: MARKER, residents: ["wren"] });
  assert.equal(shared, "a shared household");
  assert.equal(solo, "");
  assert.ok(clean(shared) && clean(solo));
});
