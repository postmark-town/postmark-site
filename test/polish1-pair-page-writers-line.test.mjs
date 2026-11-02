// polish1-pair-page-writers-line.test.mjs — POS-855 polish-1, item 2.
//
// /mail/with/<pair>/ says "sign in" (WriteGateNote) under "✍ Write back", but the
// write-back controls are enabled only when the signed-in household holds one of
// the pair: a signed-in reader who is neither writer is told to sign in and finds
// grayed buttons. One short static line beside the note is true for everyone:
// only the two writers of the conversation can write back there.
//
// SOURCE ONLY: reads town/pages/mail/with/[pair].astro, never a built page or the
// town's data. WHAT IT PINS, so a revert fails it:
//   - the line is in the page markup, once, inside the same .fr-gate-note wrapper
//     as the shared note, after it, and is plain static text (no script or
//     data-c-* switch decides whether it shows);
//   - the claim is true in the code: the script grays every [data-open-composer]
//     control (wb-off) unless the signed-in household holds pair.a or pair.b;
//   - the gate and the shared note are untouched.
//
//   node --test test/polish1-pair-page-writers-line.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const page = readFileSync(join(root, "town/pages/mail/with/[pair].astro"), "utf8");
const note = readFileSync(join(root, "src/components/WriteGateNote.astro"), "utf8");

const body = page.slice(page.indexOf("\n---", 4) + 4);
const scriptAt = body.indexOf("<script>");
const markup = body.slice(0, scriptAt); // the page's markup only
const script = body.slice(scriptAt);

const LINE = "Only the two writers of this conversation can write back here.";
const strip = (s) => s.replace(/<!--[\s\S]*?-->/g, "");

test("the page says, once, that only the conversation's two writers can write back", () => {
  assert.equal(strip(markup).split(LINE).length - 1, 1, "expected the line exactly once in the page markup");
  assert.equal(strip(body).split(LINE).length - 1, 1, "the line is also in the page's script or styles");
});

test("the line sits inside the gate-note wrapper, after the shared sign-in note, as static text", () => {
  const wrapStart = markup.indexOf('<div class="fr-gate-note">');
  assert.ok(wrapStart >= 0, "the fr-gate-note wrapper is gone");
  const wrapEnd = markup.indexOf("</div>", wrapStart);
  const wrapper = strip(markup.slice(wrapStart, wrapEnd));
  assert.ok(wrapper.includes("<WriteGateNote />"), "the shared note must stay in the wrapper");
  assert.ok(wrapper.indexOf(LINE) > wrapper.indexOf("<WriteGateNote />"), "the line comes after the sign-in note");
  const tag = wrapper.match(/<p\b[^>]*>(?=\s*Only the two writers)/)?.[0] ?? "";
  assert.ok(tag, "the line is its own <p>");
  assert.doesNotMatch(tag, /\bhidden\b|data-c-|\{/, "the line is plain static copy: no hidden, no switch, no expression");
});

test("the line is true: the script grays every write-back control unless the household holds a or b", () => {
  assert.match(script, /const isPairViewer = \(hs\) => \(hs \?\? \[\]\)\.some\(\(h\) => h === pair\.a \|\| h === pair\.b\);/);
  assert.match(script, /const setWb = \(on\) => wbs\.forEach\(\(el\) => el\.classList\.toggle\("wb-off", !on\)\);/);
  assert.match(script, /if \(r\.ok\) setWb\(isPairViewer\(\(await r\.json\(\)\)\.handles\)\);/);
  assert.match(script, /if \(el\.classList\.contains\("wb-off"\)\) return;/);
});

test("the shared sign-in note is unchanged (it is the sign-in line, not the writers line)", () => {
  assert.doesNotMatch(note, /two writers/, "the writers line belongs to the conversation page, not the shared note");
  assert.match(note, /Letters go out from a household: the desk asks you to sign in with GitHub/);
});
