// ceremony-refusals.test.mjs — the copy is still the office's. 2026-09-22 (POS-188).
//
//   node --test test/ceremony-refusals.test.mjs
//
// WHAT THIS FILE IS FOR, AND IT IS ONE THING. `src/lib/ceremony-refusals.mjs`
// carries three sentences that are NOT this repo's to write: they are the
// office's join refusals, copied verbatim so a resident stopped at the move-in
// form meets the same words they would have met at the door. A copy with no
// falsifier is a copy that drifts silently, and the drift is invisible by
// construction — both halves read fine on their own, and only the office and
// the site together are wrong.
//
// So the test compares the module against a SECOND copy taken at the same time
// from the same office sha (test/fixtures/ceremony-refusals.office.json), and
// every failure names BOTH shas, because the question a red raises here is
// always "which sha is this repo actually on, and which one did the office
// move to".
//
// THIS IS NOT A LIVE CHECK AGAINST THE OFFICE, and it cannot be: the site has
// no build-time path into that repo (the same reason mcp-proto.js is a copy).
// What it catches is a hand-edit on either side of the copy — someone fixing a
// wording here instead of at the office, which is exactly the thing POS-158
// stopped and this lane must not restart. Re-copy with:
//
//   git -C <office-clone> show origin/train/2026-w40:src/ceremony.mjs
//
// and re-stamp BOTH files together.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { REFUSALS, OFFICE_SOURCE, WHEN_EMPTY, missingSentence } from "../src/lib/ceremony-refusals.mjs";

const at = (p) => new URL(p, import.meta.url);
const read = (p) => readFileSync(at(p), "utf8");

const FIXTURE = JSON.parse(read("./fixtures/ceremony-refusals.office.json"));
const MODULE_SRC = read("../src/lib/ceremony-refusals.mjs");

/** Every failure in this file says which two shas disagree. */
const shas = () =>
  "\n  module says it was copied at   " + OFFICE_SOURCE.commit +
  "\n                  blob           " + OFFICE_SOURCE.blob +
  "\n  fixture says it was copied at  " + FIXTURE._source.commit +
  "\n                  blob           " + FIXTURE._source.blob +
  "\n  (office " + OFFICE_SOURCE.repo + " " + OFFICE_SOURCE.file + ", ref " + OFFICE_SOURCE.ref + ")";

// ── 1. the strings ───────────────────────────────────────────────────────────

test("the site's three refusals are the office's, word for word", () => {
  // CAN FAIL: change one character of one hint in either file and this goes red
  // naming the field and both shas. Verified by hand at build time by flipping
  // a single character in the fixture's NO_HOUSE hint.
  const names = ["NO_HOUSE", "BAD_SLUG", "TAKEN"];

  assert.deepEqual(Object.keys(REFUSALS), names,
    "the site module no longer carries exactly the three refusals the move-in form copies." + shas());
  assert.deepEqual(Object.keys(FIXTURE.REFUSALS), names,
    "the office fixture no longer carries exactly those three." + shas());

  for (const name of names) {
    const mine = REFUSALS[name];
    const theirs = FIXTURE.REFUSALS[name];
    for (const part of ["code", "field", "defect", "hint"]) {
      assert.equal(mine[part], theirs[part],
        "REFUSALS." + name + "." + part + " has drifted from the office's copy." +
        "\n  site module: " + JSON.stringify(mine[part]) +
        "\n  office copy: " + JSON.stringify(theirs[part]) +
        "\nA refusal a resident meets at two doors in two wordings is two laws wearing one name." +
        "\nFIX IT AT THE OFFICE FIRST, then re-copy BOTH files. Never edit one to make this pass." +
        shas());
    }
    assert.ok(Object.isFrozen(mine), "REFUSALS." + name + " is no longer frozen, so a caller can rewrite the office's words in place");
  }
});

// ── 2. the papers ────────────────────────────────────────────────────────────

test("the module and the fixture were copied from the same office sha", () => {
  // CAN FAIL: re-stamp one file's sha and not the other. This is the ordinary
  // way a re-copy goes wrong, and it is the one a diff does not show you.
  for (const part of ["repo", "file", "ref", "commit", "blob"]) {
    assert.equal(OFFICE_SOURCE[part], FIXTURE._source[part],
      "the module and the fixture disagree about `" + part + "` — one of them was re-copied and the other was not." + shas());
  }
  assert.match(OFFICE_SOURCE.commit, /^[0-9a-f]{40}$/, "the module's office commit is not a sha");
  assert.match(OFFICE_SOURCE.blob, /^[0-9a-f]{40}$/, "the module's office blob is not a sha");
});

test("the module's own header states the sha it claims, so a reader and the test cannot disagree", () => {
  // CAN FAIL: change OFFICE_SOURCE.commit and leave the header's prose alone.
  // A header that says one thing and a constant that says another is worse than
  // no header, because the header is what a person reads.
  assert.ok(MODULE_SRC.includes(OFFICE_SOURCE.commit),
    "the module's header no longer names the commit its own OFFICE_SOURCE claims." + shas());
  assert.ok(MODULE_SRC.includes(OFFICE_SOURCE.blob),
    "the module's header no longer names the blob its own OFFICE_SOURCE claims." + shas());
  assert.ok(MODULE_SRC.includes("COPIED, NOT FORKED"),
    "the module no longer states the rule it exists to state");
  assert.ok(FIXTURE._README && FIXTURE._README.includes("Never edit one"),
    "the fixture no longer tells the next person which way to fix a red");
});

// ── 3. how an empty box finds its sentence ───────────────────────────────────

test("an empty box is matched to a refusal by the OFFICE's own field name, not a typed one", () => {
  // CAN FAIL: hard-code "household" as a key in WHEN_EMPTY and this still
  // passes — so the assertion is the stronger one: every key must BE some
  // refusal's own `field`. Retype it as "Household" or "house" and it goes red.
  const declared = new Set(Object.values(REFUSALS).map((r) => r.field));
  for (const key of Object.keys(WHEN_EMPTY)) {
    assert.ok(declared.has(key),
      "WHEN_EMPTY is keyed by `" + key + "`, which is not any refusal's own `field` — " +
      "the form has started naming fields itself, which is the thing this page does not do." + shas());
    assert.equal(WHEN_EMPTY[key].field, key,
      "WHEN_EMPTY[" + JSON.stringify(key) + "] holds a refusal about a different field");
  }
  assert.equal(WHEN_EMPTY[REFUSALS.NO_HOUSE.field], REFUSALS.NO_HOUSE,
    "an empty household no longer reaches NO_HOUSE — that IS the refusal POS-158 landed and POS-188 shows early");
});

test("a house that was never named gets NO_HOUSE, whole", () => {
  // CAN FAIL: paraphrase either half in missingSentence and this names it.
  const said = missingSentence(REFUSALS.NO_HOUSE.field, null);
  assert.equal(said.defect, FIXTURE.REFUSALS.NO_HOUSE.defect,
    "the form's own message for an empty household is not the office's defect, verbatim." + shas());
  assert.equal(said.hint, FIXTURE.REFUSALS.NO_HOUSE.hint,
    "the form's own message for an empty household is not the office's hint, verbatim." + shas());
  assert.equal(said.refusal, REFUSALS.NO_HOUSE, "the refusal object itself is not relayed, only words that look like it");
});

test("a required field the ceremony has no sentence for keeps the shape and borrows the DOOR's words", () => {
  // CAN FAIL: invent prose for the unknown case and the hint stops being the
  // door's own description. The rule is the same either way — this page never
  // writes a sentence about a field.
  const doorSaid = "REQUIRED — your first resident's address: lowercase letters, digits and single hyphens, 2–40 characters, unique in the town.";
  const said = missingSentence("handle", { type: "string", description: doorSaid });
  assert.equal(said.hint, doorSaid, "the hint is not the door's own description of its own field");
  assert.equal(said.refusal, null, "a field the ceremony does not speak to must not be dressed as a ceremony refusal");
  assert.ok(said.defect.includes("handle"), "the defect does not say which box is empty");
  assert.deepEqual(Object.keys(said).sort(), ["defect", "hint", "refusal"],
    "the two shapes have diverged — a reader must not be able to tell which kind of message they got");

  // and a field the door said nothing about still gets a sentence rather than ""
  const bare = missingSentence("card", null);
  assert.ok(bare.defect, "an empty required box with no door description got no defect at all");
});

test("BAD_SLUG and TAKEN are carried but never guessed at by the form", () => {
  // CAN FAIL: add either to WHEN_EMPTY. They are about a name that IS there and
  // does not pass — a judgement against a roll only the office can read. The
  // form showing one would be inventing the office's answer. They are copied so
  // that when the OFFICE says them, the words already match.
  for (const name of ["BAD_SLUG", "TAKEN"]) {
    assert.ok(!Object.values(WHEN_EMPTY).includes(REFUSALS[name]),
      name + " is being shown for an EMPTY box. It is the office's answer to a name that is present and does not pass, " +
      "and this form cannot know that — only the office can, against the roll." + shas());
  }
});
