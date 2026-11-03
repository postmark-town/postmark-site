// write-gate-note-conversation.test.mjs — the conversation page says what
// writing needs, once, before the reader clicks "✍ Write back".
//
//   node --test test/write-gate-note-conversation.test.mjs
//
// POS-855 (Site UX campaign), the follow-up to write-gate-note.test.mjs: the
// shared WriteGateNote sits beside "✍ Write to <name>" and "✍ write a letter",
// but the "✍ Write back" controls on /mail/with/<pair>/ lead to the same desk
// and the same sign-in wall and had no note.
//
// The page has three controls that open the one composer (all [data-open-composer]):
// the button under the facts, the rail link, and the button at the foot of the
// letters. They are grayed (wb-off) until the signed-in household holds one of the
// pair, so a reader meets the first one first. The note is said ONCE, right under
// that first control, not beside each.
//
// SOURCE ONLY: this reads town/pages/mail/with/[pair].astro and never a built
// page or the town's data. WHAT IT PINS, so a revert fails it:
//   - the page imports the shared component and renders it exactly once;
//   - that one note is right after the facts card's write-back row, inside the
//     facts card, ahead of the in-page composer, the rail link and the foot button;
//   - the controls themselves are untouched: three [data-open-composer] controls,
//     the first a button, the other two links to composeHref, each still wb-off.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const page = readFileSync(join(root, "town/pages/mail/with/[pair].astro"), "utf8");

const NOTE = "<WriteGateNote />";
const body = page.slice(page.indexOf("\n---", 4) + 4); // markup after the frontmatter, scripts and styles included
const markup = body.slice(0, body.indexOf("<script>")); // the page's markup only
const at = (needle, from = 0) => markup.indexOf(needle, from);

test("the conversation page imports the shared note and renders it exactly once", () => {
  assert.match(page, /import WriteGateNote from "@\/components\/WriteGateNote\.astro"/);
  assert.equal(markup.split(NOTE).length - 1, 1, "expected exactly one <WriteGateNote /> in the page markup, not one per button");
  assert.equal(body.split(NOTE).length - 1, 1, "the note is also used in the page's script or styles");
});

test("the note sits right after the facts card's write-back row, inside that card", () => {
  const BTN = '<button type="button" class="pm-btn send wb-off" data-open-composer>✍ Write back</button>';
  assert.equal(markup.split(BTN).length - 1, 1, "expected exactly one write-back button under the facts");
  const afterBtn = markup.slice(at(BTN) + BTN.length);
  const rowEnd = afterBtn.indexOf("</div>"); // the closing </div> of the fr-actions row
  assert.ok(rowEnd >= 0 && !afterBtn.slice(0, rowEnd).includes(NOTE), "the note is inside the button row, not beside it");
  const afterRow = afterBtn.slice(rowEnd + "</div>".length);
  const noteAt = afterRow.indexOf(NOTE);
  assert.ok(noteAt >= 0, "no note after the write-back row");
  // nothing but the note's own comment and wrapper sits between the row and the note
  assert.doesNotMatch(afterRow.slice(0, noteAt).replace(/<!--[\s\S]*?-->/g, ""), /<(button|a|section|p|nav|aside)\b/, "something else sits between the write-back row and the note");
  // the note comes before the facts card closes, so it is inside it
  assert.ok(afterRow.indexOf("</section>") > noteAt, "the note is outside the facts card");
});

test("the note comes ahead of the composer, the rail link and the foot button", () => {
  const noteAt = at(NOTE);
  assert.ok(noteAt > 0);
  for (const later of ["data-composer", 'class="rail-write', 'class="pm-btn send wb-off" href={composeHref}']) {
    assert.ok(at(later) > noteAt, `${later} should come after the note`);
  }
});

test("the write-back controls themselves are unchanged: same three, same targets, same gray-until-pair class", () => {
  const controls = markup.match(/<(?:button|a)\b[^>]*\bdata-open-composer\b[^>]*>/g) ?? [];
  assert.equal(controls.length, 3, "expected exactly three [data-open-composer] controls");
  const [top, rail, foot] = controls;
  assert.match(top, /^<button type="button" class="pm-btn send wb-off" data-open-composer>$/);
  assert.match(rail, /^<a class="rail-write wb-off" href=\{composeHref\} data-open-composer>$/);
  assert.match(foot, /^<a class="pm-btn send wb-off" href=\{composeHref\} data-open-composer>$/);
  assert.match(page, /const composeHref = `\/mail\/compose\/\?to=\$\{otherOf\(lastSender\)\}&thread=\$\{encodeURIComponent\(last\.id\)\}`;/);
});
