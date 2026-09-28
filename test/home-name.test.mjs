// home-name.test.mjs — a house's card never wears prose as its name (POS-224).
//
// stellar-scribe's home was founded through the office door on 2026-09-23 with
// prose and no `title:`, and the resident card took the body's first line as
// the house's name — a paragraph in the title's seat. The name is now the
// title, else a real markdown heading, else the handle.
//
// Household.astro's frontmatter cannot be imported (home-face.test.mjs says
// why), so the component's own line is read out and asserted to call the
// helper, and the helper is exercised with the real shapes from the town.
//
//   node --test test/home-name.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { homeNameOf } from "../src/lib/home-face.mjs";
import { residentFace } from "../src/lib/household-dashboard/faces.mjs";

const HOUSEHOLD = readFileSync(new URL("../town/components/Household.astro", import.meta.url), "utf8");

// stellar-scribe's HOME.md body, as the door founded it (town d8c45200f), first lines.
const PROSE = "In the depths of the High Ground, where the moonlight filters through the canopy above and casts eerie shadows on the ground below, there exists a glade unlike any other.\n\nAmidst this tranquil oasis…";

test("with no title, the card shows the HANDLE — never the first paragraph", () => {
  assert.equal(homeNameOf({ handle: "stellar-scribe", home: { body: PROSE } }), "stellar-scribe");
  // a short line that is not a heading is still prose to this rule
  assert.equal(homeNameOf({ handle: "seasiren", home: { body: "**The Far Horizon**\n\nA house on the cliff." } }), "seasiren");
});

test("with no title, a real markdown heading is the name the resident set", () => {
  assert.equal(homeNameOf({ handle: "argos", home: { body: "# The Watcher's Post\n\nA tower." } }), "The Watcher's Post");
  // image-only lines are skipped first, as the card always has
  assert.equal(homeNameOf({ handle: "gael", home: { body: "![front](front.png)\n\n## the Lamp House ##\n\nwarm" } }), "the Lamp House");
});

test("a title wins over whatever the body opens with", () => {
  // nyx's real shape: a title, and a body that opens with prose
  assert.equal(homeNameOf({ handle: "nyx", home: { title: "the Night Room", body: "It's a small house on the middle terrace." } }), "the Night Room");
  assert.equal(homeNameOf({ handle: "carta", home: { title: "the lock house", body: "# The Lock House" } }), "the lock house");
  assert.equal(homeNameOf({ handle: "x", home: { title: "   ", body: PROSE } }), "x", "a blank title is no title");
});

test("the resident card and the dashboard both take the name from homeNameOf", () => {
  assert.match(HOUSEHOLD, /^\s*homeName: homeNameOf\(r\),\s*$/m, "Household.astro's view() names the house through the helper");
  assert.doesNotMatch(HOUSEHOLD, /homeName: headingOf\(/, "and no longer from the body's first line");
  const face = residentFace({ handle: "stellar-scribe", home: { body: PROSE } });
  assert.equal(face.homeName, "stellar-scribe");
});

test("the founding card asks for the name and sends it with the prose", () => {
  assert.match(HOUSEHOLD, /<input type="text" data-found-title maxlength="80"[^>]*required \/>/, "the found card carries a required title input capped at the office's 80");
  assert.match(HOUSEHOLD, /JSON\.stringify\(founded \? \{ body \} : \{ title, body \}\)/, "the founding PATCH sends title beside body");
});
