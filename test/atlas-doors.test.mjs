// atlas-doors.test.mjs — the atlas page opens without scripts, promises only the
// doors the atlas gives, and points at the World for the walkable town.
//
//   node --test test/atlas-doors.test.mjs
//
// POS-855 (Site UX campaign): a cold walk found three things on /atlas/.
//   1. "Open the atlas" was a <button> that set an iframe from data-src, with no
//      anchor and no noscript, so a reader without scripts could not open it.
//   2. The page promised doors "into their page, their mail, and the rest of the
//      town"; the atlas's own panels give less, and not the same for every place
//      (the extractor appends them in tools/extract-town.mjs; the map is the town's).
//   3. It called the atlas "the blueprint for the walkable town coming next",
//      but the walkable World is live at /world/.
//
// Source-level only: reads the component and the page, nothing built or resident.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const invite = readFileSync(join(root, "src/components/AtlasInvite.astro"), "utf8");
const page = readFileSync(join(root, "town/pages/atlas.astro"), "utf8");

// Markup only: drop the frontmatter fence and the component's script/style.
const markup = (src) =>
  src.replace(/^---[\s\S]*?\n---\n/, "").replace(/<script>[\s\S]*?<\/script>/g, "").replace(/<style>[\s\S]*?<\/style>/g, "");
const flat = (s) => s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

// The opener the in-place (non-cta) branch renders.
const opener = invite.match(/<(a|button)\b[^>]*\bdata-atlas-open\b[^>]*>/);

test("the in-place opener is found", () => {
  assert.ok(opener, "no element carries data-atlas-open");
});

test("Open the atlas is a real link to /atlas/town.html, not a script-only button", () => {
  assert.equal(opener[1], "a", "the opener is a <button>: a reader without scripts cannot open the atlas");
  assert.match(opener[0], /\bhref="\/atlas\/town\.html"/, "the opener does not link to /atlas/town.html");
  assert.ok(!/<button\b[^>]*data-atlas-open/.test(invite), "a script-only button carries data-atlas-open again");
});

test("with scripts, a plain click still opens the in-page frame", () => {
  const script = invite.match(/<script>([\s\S]*?)<\/script>/)[1];
  assert.match(script, /openBtn\.addEventListener\("click"/, "the opener is no longer wired");
  assert.match(script, /e\.preventDefault\(\)/, "the click no longer stops the link from navigating away");
  assert.match(script, /\bopen\(\)/, "the click no longer opens the overlay");
  assert.match(invite, /data-src="\/atlas\/town\.html"/, "the frame lost its lazy data-src");
  assert.ok(!/<iframe\b[^>]*\ssrc=/.test(invite), "the frame loads the atlas up front instead of on open");
});

test("a modified or middle click still follows the link", () => {
  const script = invite.match(/<script>([\s\S]*?)<\/script>/)[1];
  assert.match(script, /e\.button !== 0 \|\| e\.metaKey \|\| e\.ctrlKey \|\| e\.shiftKey \|\| e\.altKey\) return;/,
    "the click handler no longer lets a modified or middle click through to the link");
});

test("with scripts on, the link keeps Space as well as Enter, and says it is a button", () => {
  const script = invite.match(/<script>([\s\S]*?)<\/script>/)[1];
  // Set by the script, never in the markup: a reader with no script keeps an honest link.
  assert.ok(!/role="button"/.test(markup(invite)), "role=button is in the markup, so a no-script reader gets a 'button' that is a link");
  assert.match(script, /openBtn\.setAttribute\("role", "button"\)/, "the script does not mark the link as a button");
  // Space acts on KEYUP, the way a native button does: open() moves focus to the
  // close button, and a keyup landing there would press it and shut the frame as
  // it opens (Firefox). Both listeners are on the opener only.
  const handler = (type) => {
    const at = script.indexOf(`openBtn.addEventListener("${type}"`);
    assert.ok(at > 0, `no ${type} listener bound to the opener (openBtn)`);
    return script.slice(at, script.indexOf("});", at));
  };
  const down = handler("keydown");
  const up = handler("keyup");
  assert.match(down, /e\.key !== " "/, "keydown does not look for Space");
  assert.match(down, /e\.preventDefault\(\)/, "Space keydown must be stopped (no page scroll)");
  assert.ok(!/\.click\(\)/.test(down), "Space opens on keydown again: the keyup would land on the close button");
  assert.ok(!/\bopen\(\)/.test(down), "Space keydown opens the frame directly");
  assert.match(up, /e\.key !== " "/, "keyup does not look for Space");
  assert.match(up, /openBtn\.click\(\)/, "Space keyup must open the way a click does");
});

test("the front door's cta branch is untouched: a link where the opener stands", () => {
  assert.match(invite, /cta\s*\?\s*<a class="pm-btn ai-open" href=\{cta\.href\}>\{cta\.label\}<\/a>/);
});

test("the atlas page promises each place's own words and no doors", () => {
  // The extractor's doors depend on the place: a resident on the list gets their
  // page, the postmaster's place gets the Daily and the Meeps, the centre adds
  // the Mail, and a place with no resident gets none. So the line says only the
  // words, which every place gives.
  const text = flat(markup(page));
  const line = text.match(/Click anything[^.]*\./);
  assert.ok(line, "the 'Click anything' line is missing from the atlas page");
  assert.match(line[0], /own words/);
  assert.ok(!/\bdoors?\b/i.test(line[0]), "the 'Click anything' line promises doors again");
  assert.ok(!/their page/i.test(line[0]), "the 'Click anything' line promises a page door again");
  assert.ok(!/their mail/i.test(text), "the page promises a door into their mail again");
  assert.ok(!/rest of the town/i.test(text), "the page promises doors into the rest of the town again");
});

test("the atlas page sends the walkable town to the World, not to something coming next", () => {
  const text = flat(markup(page));
  assert.ok(!/blueprint for the walkable/i.test(text), "the 'blueprint for the walkable town' claim is back");
  assert.ok(!/coming next/i.test(text), "the 'coming next' claim is back");
  const how = markup(page).match(/<p class="how">([\s\S]*?)<\/p>/);
  assert.ok(how, "the atlas intro paragraph is missing");
  assert.match(how[1], /<a href="\/world\/">the World<\/a>/, "the intro does not link to /world/");
  assert.match(flat(how[1]), /walk the town/);
});
