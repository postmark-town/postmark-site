// profile-pronouns.test.mjs — a resident's pronouns on the site (POS-807).
//
// Ruled by Darko, 2026-10-27: "Show if written." The profile page prints the
// pronouns beside the name and the household dashboard's resident card prints
// them too; a resident who wrote none gets nothing, never a guess.
//
// No suite renders an .astro component, so the rules live in the plain module
// (pronouns.mjs, faces.mjs) and the two components are held to them by source.
//
//   node --test test/profile-pronouns.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { pronounsOf } from "../src/lib/pronouns.mjs";
import { residentFace } from "../src/lib/household-dashboard/faces.mjs";

const read = (rel) => readFileSync(new URL(rel, import.meta.url), "utf8");

test("pronouns the resident wrote come through as written", () => {
  assert.equal(pronounsOf({ pronouns: "he/him" }), "he/him");
  assert.equal(pronounsOf({ pronouns: "  they / them  " }), "they / them");
  assert.equal(pronounsOf({ pronouns: "she/they" }), "she/they");
});

test("nothing written, nothing shown: never a guess", () => {
  assert.equal(pronounsOf({}), null);
  assert.equal(pronounsOf(undefined), null);
  assert.equal(pronounsOf(null), null);
  assert.equal(pronounsOf({ pronouns: "" }), null);
  assert.equal(pronounsOf({ pronouns: "   " }), null);
  assert.equal(pronounsOf({ pronouns: null }), null);
  // not text: not printed
  assert.equal(pronounsOf({ pronouns: 7 }), null);
  assert.equal(pronounsOf({ pronouns: ["he", "him"] }), null);
  assert.equal(pronounsOf({ pronouns: { a: 1 } }), null);
  // the name and the bio do not stand in for them
  assert.equal(pronounsOf({ bio: "He builds. His house.", color_name: "her gold" }), null);
});

test("one short plain line: control characters and runs of space fold, a long one is clipped", () => {
  assert.equal(pronounsOf({ pronouns: "he/\nhim\t(ask me)" }), "he/ him (ask me)");
  assert.equal(pronounsOf({ pronouns: "it/​its" }), "it/ its");
  assert.equal(pronounsOf({ pronouns: "\u{1F3F3}\uFE0F\u200D\u26A7\uFE0F" }), "\u{1F3F3}\uFE0F\u200D\u26A7\uFE0F", "a joined emoji stays whole");
  const long = pronounsOf({ pronouns: "x".repeat(200) });
  assert.equal(Array.from(long).length, 40);
  assert.ok(long.endsWith("…"));
});

test("markup stays text: the helper does not strip or trust it, the page escapes it", () => {
  assert.equal(pronounsOf({ pronouns: "<b>he</b>/him" }), "<b>he</b>/him");
});

test("the household card's face carries the pronouns when written, null when not", () => {
  const withP = residentFace({ handle: "lamp", address: { agent: "the Lamp" }, profile: { pronouns: "they/them" }, homeImages: [] }, {});
  assert.equal(withP.pronouns, "they/them");
  const without = residentFace({ handle: "lamp", address: { agent: "the Lamp" }, profile: {}, homeImages: [] }, {});
  assert.equal(without.pronouns, null);
  const noProfile = residentFace({ handle: "lamp", homeImages: [] }, {});
  assert.equal(noProfile.pronouns, null);
});

test("the profile page prints them beside the name, only when written, as escaped text", () => {
  const src = read("../town/components/Household.astro");
  assert.match(src, /import \{ pronounsOf \} from "@\/lib\/pronouns\.mjs"/);
  assert.match(src, /profilePronouns: pronounsOf\(profile\)/);
  // inside the title row, straight after the <h1> name, and behind the guard
  assert.match(src, /<h1>\{t\.name\}<\/h1>\s*\{t\.profilePronouns && <span class="profile-pronouns" data-profile-pronouns>\{t\.profilePronouns\}<\/span>\}/);
  assert.doesNotMatch(src, /set:html=\{t\.profilePronouns\}/);
});

test("the household card prints them behind the same guard, as escaped text", () => {
  const src = read("../src/components/household-dashboard/ResidentCard.astro");
  assert.match(src, /\{f\.pronouns && <span class="hd-card-pronouns" data-hd-pronouns>\{f\.pronouns\}<\/span>\}/);
  assert.doesNotMatch(src, /set:html=\{f\.pronouns\}/);
});
