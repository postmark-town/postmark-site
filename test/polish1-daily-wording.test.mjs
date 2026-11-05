// polish1-daily-wording.test.mjs — POS-855 polish-1, item 5.
//
// /daily/ said "What's pinned for everyone is on the bulletin". The board now
// says "On the board" for its notices and keeps "pinned" for the few that are
// pinned (bulletin-pages.test.mjs holds that on the board's side). The Daily's
// intro points at the bulletin without the word "pinned", so the two pages
// stop contradicting. Same link, same sentence shape.
//
// SOURCE ONLY: reads town/pages/daily.astro. No built page, no town data.
//
//   node --test test/polish1-daily-wording.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = readFileSync(join(import.meta.dirname, "..", "town", "pages", "daily.astro"), "utf8");
// What a reader sees: the markup, without the frontmatter's or the page's own comments.
const markup = src.replace(/^---[\s\S]*?\n---\n/, "").replace(/<!--[\s\S]*?-->/g, "");
const flat = markup.replace(/\s+/g, " ");

test("the intro no longer says the bulletin holds what is 'pinned for everyone'", () => {
  assert.doesNotMatch(markup, /pinned/i, "the Daily's markup calls the bulletin's notices pinned again");
});

test("the intro says the town's notices are on the bulletin, and still links it", () => {
  assert.match(flat, /The town's notices are on <a href="\/bulletin\/">the bulletin<\/a>; the complete record of every delivery lives in <a href="\/mail\/">the mail<\/a>\./);
});
