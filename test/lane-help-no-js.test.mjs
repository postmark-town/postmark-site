// lane-help-no-js.test.mjs — the civic quarter's "?" works with the script off,
// and every `call` on a slide says whose call it is.
//
//   node --test test/lane-help-no-js.test.mjs
//
// SOURCE ONLY. It reads the three components, the deck module and the hub page
// as text, never a built page and never the town's data.
//
// THE PATTERN UNDER GUARD (LaneHead.astro):
//   · the "?" is a LINK, `<a class="c-help" href="#help-<key>" data-tut=…>`;
//   · the same deck is also printed as a plain list inside a <noscript>, id
//     `help-<key>`, shut by CSS until `:target` (so the link reveals it);
//   · with the script on, the one click handler on the hub page stops the link
//     and calls showModal() — the same dialog as before — and a <noscript> is
//     never parsed as markup then, so the slides exist once on the page.
//
// THE LABEL: CALL_LABEL (civic-tutorial.mjs) is printed above every `call`,
// in the dialog and in the no-script list.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { CALL_LABEL, TUTORIALS, tutorialFor, MAX_SLIDES } from "../src/lib/civic-tutorial.mjs";

const read = (rel) => readFileSync(new URL(rel, import.meta.url), "utf8");
const head = read("../src/components/LaneHead.astro");
const tut = read("../src/components/LaneTutorial.astro");
const hub = read("../town/pages/town/index.astro");

// The markup of a component, without its frontmatter and style, so a word
// quoted in a comment cannot satisfy a check on the markup.
const markupOf = (src) =>
  src.replace(/^---[\s\S]*?\n---\n/, "").replace(/<style>[\s\S]*<\/style>/, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
const headMarkup = markupOf(head);
const tutMarkup = markupOf(tut);

test("the label is the one agreed wording, and it is a shared constant", () => {
  assert.equal(CALL_LABEL, "Your agent calls:");
  // not re-typed in either component: both read the constant
  for (const [name, src] of [["LaneHead", head], ["LaneTutorial", tut]]) {
    assert.match(src, /import \{[^}]*\bCALL_LABEL\b[^}]*\} from "@\/lib\/civic-tutorial\.mjs"/,
      `${name} does not import CALL_LABEL`);
    assert.equal(src.includes("Your agent calls"), false, `${name} types the label by hand`);
  }
});

test("every `call` is printed with the label directly above it, in the dialog and in the no-script list", () => {
  for (const [name, markup, labelClass, callClass] of [
    ["LaneTutorial", tutMarkup, "c-tut-call-label", "c-tut-call"],
    ["LaneHead", headMarkup, "c-help-plain-call-label", "c-help-plain-call"],
  ]) {
    const label = new RegExp(`\\{s\\.call && <p class="${labelClass}">\\{CALL_LABEL\\}</p>\\}\\s*\\n\\s*\\{s\\.call && <code class="${callClass}">\\{s\\.call\\}</code>\\}`);
    assert.match(markup, label, `${name}: the call is not preceded by the CALL_LABEL line`);
  }
});

test("the call text itself is untouched: still printed from s.call, unchanged", () => {
  const calls = Object.values(TUTORIALS).flat().filter((s) => s.call);
  assert.ok(calls.length >= 3, "the decks no longer carry any call");
  assert.equal(calls.every((s) => !s.call.includes(CALL_LABEL)), true, "the label leaked into a call string");
});

test("the '?' is a link to a plain list, so it goes somewhere with no script", () => {
  assert.match(headMarkup, /<a class="c-help" id=\{`ask-\$\{lane\.key\}`\} href=\{`#help-\$\{lane\.key\}`\} data-tut=\{lane\.key\}/,
    "the '?' is not a link to #help-<key> that still names its deck");
  assert.equal(/<button[^>]*class="c-help"/.test(headMarkup), false, "the '?' is a dead <button> again");
  assert.match(headMarkup, /aria-haspopup="dialog"/);
  assert.match(headMarkup, /aria-controls=\{`tut-\$\{lane\.key\}`\}/);
});

test("the target of that link exists, inside a <noscript>, and lists every slide unhidden", () => {
  const ns = headMarkup.match(/<noscript>([\s\S]*?)<\/noscript>/);
  assert.ok(ns, "LaneHead has no <noscript> copy of the deck");
  const inner = ns[1];
  assert.match(inner, /id=\{`help-\$\{lane\.key\}`\}/, "the link's target id is not inside the <noscript>");
  assert.match(inner, /\{deck\.map\(/, "the no-script copy does not list the slides");
  assert.equal(/hidden/.test(inner), false, "a slide is hidden in the list that has no script to show it");
  assert.equal(/<dialog/.test(inner), false, "the no-script copy is a second dialog");
  // NOT a <section>: the lane panel is one, and test/think-tank-posts.test.mjs's
  // tankOf() cuts the panel at its first `</section>` — a nested one truncates it
  assert.equal(/<\/?section\b/.test(inner), false, "the no-script copy is a <section> and ends the lane panel early for anything that slices on </section>");
  // the way back lands on the '?', which carries that id
  assert.match(inner, /href=\{`#ask-\$\{lane\.key\}`\}/, "no way back to the '?'");
  // and the list reads the same deck module the dialog is given
  assert.match(head, /tutorialFor\(lane\.key\)/);
  // gated exactly like the '?': a lane with no deck gets neither
  assert.match(head, /const deck = helps \? tutorialFor\(lane\.key\) : \[\];/);
  assert.equal((headMarkup.match(/\{helps && \(/g) || []).length, 2, "the '?' and the list are not both behind `helps`");
});

test("the list is shut by CSS until the '?' is followed, and the reveal is :target", () => {
  const css = head.slice(head.indexOf("<style>"));
  assert.match(css, /\.c-help-plain\s*\{\s*display:\s*none;\s*\}/, "the list is not shut by default");
  assert.match(css, /\.c-help-plain:target\s*\{[^}]*display:\s*block/, "following the '?' does not reveal the list");
});

test("the full-width span is on the <noscript>, which is the grid item", () => {
  const css = head.slice(head.indexOf("<style>"));
  assert.match(css, /\.c-top\s*>\s*noscript\s*\{\s*grid-column:\s*1\s*\/\s*-1;?\s*\}/,
    "the <noscript> grid item does not span both columns");
  // a grid-column on the list inside it would do nothing (it is not the grid item)
  const target = css.match(/\.c-help-plain:target\s*\{[^}]*\}/)[0];
  assert.equal(/grid-column/.test(target), false, "grid-column is back on the list, where it does nothing");
});

test("with the script on, the '?' keeps Space as well as Enter, and says it is a button", () => {
  // set by the script, not the markup: with no script it stays an honest link
  assert.equal(/role="button"/.test(headMarkup), false, "role=button is in the markup, so a no-script reader gets a 'button' that is a link");
  assert.match(hub, /querySelectorAll\("a\[data-tut\]"\)/);
  assert.match(hub, /setAttribute\("role", "button"\)/, "the script does not mark the link as a button");
  const k = hub.indexOf('if (e.key !== " ") return;');
  assert.ok(k > 0, "no Space handler for the '?'");
  const handler = hub.slice(k, k + 300);
  assert.match(handler, /closest\("a\[data-tut\]"\)/);
  assert.ok(handler.indexOf("e.preventDefault()") > -1 && handler.indexOf("ask.click()") > handler.indexOf("e.preventDefault()"),
    "Space must be stopped (no page scroll) and then open the same way a click does");
});

test("with the script on the same dialog opens: the one handler stops the link and calls showModal()", () => {
  // the handler is unchanged in shape: find [data-tut], find the dialog by id, showModal
  assert.match(hub, /e\.target\.closest\("\[data-tut\]"\)/);
  assert.match(hub, /document\.getElementById\("tut-" \+ ask\.getAttribute\("data-tut"\)\)/);
  const from = hub.indexOf('var ask = e.target.closest && e.target.closest("[data-tut]");');
  const guard = hub.indexOf('typeof dialog.showModal !== "function") return;', from);
  const open = hub.indexOf("dialog.showModal();", guard);
  assert.ok(from > 0 && guard > from && open > guard, "the click handler moved");
  const stop = hub.indexOf("e.preventDefault();", from);
  // stopped BEFORE the showModal() guard, so a browser without showModal does not
  // navigate to a #help-<key> that is not on the page (with script on) and lose
  // the reader's lane; and still before showModal() itself
  assert.ok(stop > from && stop < guard,
    "the link is not stopped before the showModal() guard: a browser without showModal would follow the fragment");
  // the dialog is still the native one, in the same id scheme the handler reads
  assert.match(tutMarkup, /<dialog class="c-tut" id=\{`tut-\$\{lane\.key\}`\}/);
});

test("every lane that has a deck mounts both the '?' and its dialog on the hub", () => {
  const keys = Object.keys(TUTORIALS);
  assert.ok(keys.length >= 3, "fewer decks than the three live lanes");
  for (const key of keys) {
    assert.ok(tutorialFor(key).length > 0 && tutorialFor(key).length <= MAX_SLIDES);
    assert.ok(hub.includes(`<LaneHead lane={LANE_BY.${key}} plaque={PLAQUES.${key}} slides={tutorialFor("${key}").length} />`),
      `${key}: no LaneHead mount`);
    assert.ok(hub.includes(`<LaneTutorial lane={LANE_BY.${key}} slides={tutorialFor("${key}")} />`),
      `${key}: no LaneTutorial mount`);
  }
});
