// paused-wording.test.mjs — the Bounty Board and the Marketplace read "works today · likely to change soon" where this site says their
// status (POS-1065). THE FILE NAME IS HISTORICAL: it was written for Wright's 04:32 "paused" note, which he retracted at 05:21:47Z.
//
//   node --test test/paused-wording.test.mjs
//
// Darko, 2026-11-15 18:36 EST: "let's treat bounties as paused, just as the marketplace. need to make sure it's reflected everywhere
// including on the site Civic Quarter." Darko, 18:52 EST, the ruling: "it's okay if they are still working, more important that the town
// knows that they are subject to change soon. these are kind of dead pathways anyway so it's not worth a big build." Wright, 2026-11-16
// 05:21:47Z (correcting his 04:32 note): "everywhere it now says 'paused': bounties and the Marketplace work today and are likely to change
// soon. Not paused, not retired, not coming soon. Same places, same no-build scope; the presentation flag's name can follow the words."
//
// WHAT THIS HOLDS, as the MEANING of the inventory and not as a ban on any word elsewhere: every surface this PR names says BOTH clauses
// (it works today; it is likely to change soon) and, in the words it says them, does not present either pathway as paused, retired or not
// yet working; nothing is disabled; the calls, links, doors and the funding pots are as they were. Other copy, now or later, is not judged
// here. The rendered cards and headings (and that neither clause is clipped) are test/ballot-panel-browser.test.mjs.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LANES, CHANGE_SOON_LABEL } from "../src/lib/civic.mjs";
import { tutorialFor, MAX_SLIDES } from "../src/lib/civic-tutorial.mjs";

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
/** Source without its comments: what the page SAYS, not what its authors explained. */
const said = (src) => src
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/<!--[\s\S]*?-->/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const flat = (s) => s.replace(/<[^>]+>/g, " ").replace(/\{[^}]*\}/g, " ").replace(/\s+/g, " ").trim();
const lane = (key) => LANES.find((l) => l.key === key);
const PAGE = "town/pages/town/index.astro";

/** The two clauses, wherever a surface says them. */
const WORKS = /works? today/i;
const CHANGES = /likely to change soon/i;
/** What none of the named surfaces may say about either pathway, in the words they say it with. */
const NOT_THIS = /paused|retired|coming soon|not (yet )?working|not live/i;
const bothClauses = (text, what) => {
  assert.match(text, WORKS, `${what}: says it works today`);
  assert.match(text, CHANGES, `${what}: says it is likely to change soon`);
  assert.doesNotMatch(text, NOT_THIS, `${what}: does not present it as paused, retired, coming soon or not working`);
};

test("the two lanes carry the one label, its two clauses are the ruling's words, and live/place/anchors read as they did", () => {
  assert.equal(CHANGE_SOON_LABEL, "works today · likely to change soon");
  bothClauses(CHANGE_SOON_LABEL, "the label");
  assert.deepEqual(LANES.filter((l) => l.changeSoon).map((l) => l.key), ["bounties", "listings"]);
  assert.equal(lane("bounties").live, true, "the Bounty Board's machinery still stands");
  assert.equal(lane("listings").live, false, "the Marketplace's availability flag is not touched by a wording order");
  assert.equal(lane("bounties").id, "board");
  assert.equal(lane("listings").id, "marketplace");
  assert.ok(!lane("quests").changeSoon && !lane("ideas").changeSoon && !lane("votes").changeSoon, "no other lane carries it");
  assert.deepEqual(Object.keys(lane("listings")).sort(), ["changeSoon", "id", "key", "lane", "live", "name", "place", "who"], "the Marketplace row gained only the label flag");
  assert.deepEqual(Object.keys(lane("bounties")).sort(), ["changeSoon", "id", "key", "lane", "live", "name", "place", "who"], "and so did the Bounty Board's");
});

test("each building and each opened panel says it: the chip and the heading read the label from the flag, and a not-live lane without the label would still say coming soon", () => {
  const page = said(read(PAGE));
  assert.match(page, /\{lane\.changeSoon && <span class="cq-change">\{CHANGE_SOON_LABEL\}<\/span>\}/, "the building's chip");
  assert.match(page, /\{!lane\.live && !lane\.changeSoon && <span class="cq-coming">coming soon<\/span>\}/, "coming soon only for a not-live lane that does not carry the label");
  const head = said(read("src/components/LaneHead.astro"));
  assert.match(head, /\{lane\.changeSoon\s*\?\s*<p class="c-coming-head is-change">\{CHANGE_SOON_LABEL\}<\/p>\s*:\s*!lane\.live && <p class="c-coming-head">Coming soon<\/p>\}/, "the opened heading");
  // the chip wraps and does not dim, block or clip (neither clause may be lost to a one-line pill)
  const css = read(PAGE).slice(read(PAGE).indexOf(".cq-change {"), read(PAGE).indexOf(".cq-change {") + 500);
  assert.match(css, /white-space:\s*normal/, "the chip wraps");
  assert.doesNotMatch(css, /nowrap|overflow:\s*hidden|text-overflow|pointer-events|opacity|filter|display:\s*none/);
  assert.match(read("src/components/LaneHead.astro"), /\.c-coming-head\.is-change\s*\{[^}]*border-radius/, "and the heading pill is a rounded box, not a capsule, when it wraps");
  assert.deepEqual(LANES.filter((l) => !l.live && !l.changeSoon).map((l) => l.key), [], "no lane reads coming soon today");
});

test("the opened Bounty Board and Marketplace panels are not disabled: the board's block, the price board link and the postmaster door are all still there", () => {
  const page = said(read(PAGE));
  const bounty = page.slice(page.indexOf('id="bounty-board"'), page.indexOf('id="marketplace"'));
  assert.match(bounty, /<div id="board" class="m-block">/, "the board's block, whose id every deep link points at");
  assert.match(bounty, /<LaneTutorial lane=\{LANE_BY\.bounties\}/, "and its '?' deck");
  const market = page.slice(page.indexOf('id="marketplace"'), page.indexOf('id="ballot-house"'));
  assert.match(market, /href="\/bulletin\/#marketplace">the price board/, "the price board link");
  assert.match(market, /\{!LANE_BY\.listings\.live && \(\s*<p class="m-note">\s*<a class="c-door" href="\/mail\/compose\/\?to=postmaster">Write the postmaster →<\/a>/, "the postmaster door, still gated on the same flag");
  assert.doesNotMatch(bounty + market, /\bdisabled\b|aria-disabled|pointer-events/, "nothing in either panel is disabled");
});

test("the bounty deck says both clauses on its first step and teaches nothing else differently: the same four steps, calls and one-sentence slides", () => {
  const deck = tutorialFor("bounties");
  assert.equal(deck.length, 4);
  assert.ok(deck.length <= MAX_SLIDES);
  assert.deepEqual(deck.map((s) => s.step), ["Post the ask", "Stake it", "Someone answers", "The poster pays"]);
  assert.deepEqual(deck.map((s) => s.call), [
    'world { do: "leave-mark", args: { class: "bounty", … } }',
    'town { do: "stake", args: { mark: "<by>/<slug>", stamps: 1 } }',
    'household { read: "mail" }',
    "pays: 12",
  ], "every call is the one it was");
  assert.equal(deck[0].step_note, "at the world door · the Bounty Board works today and is likely to change soon");
  bothClauses(deck[0].step_note, "the first step's note");
  for (const s of deck) assert.equal(s.say.split(/(?<=[.!?])\s+/).filter(Boolean).length, 1, `${s.step} stays one sentence`);
  assert.deepEqual(tutorialFor("listings"), [], "the Marketplace has no deck, as before");
});

test("the guide's 'Posting a notice of your own' says the board works today and is likely to change soon, that what stands stands, and that a pot is a different thing; how a notice is placed is as it was", () => {
  const guide = read("town/pages/docs/stamps/index.astro");
  const at = guide.indexOf("<h3>Posting a notice of your own</h3>");
  const section = said(guide.slice(at, guide.indexOf("</p>", at) + 4));
  const text = flat(section);
  bothClauses(text.slice(text.indexOf("The open notices hang on")), "the guide's board sentence");
  assert.match(text, /the notices already up, their stakes and the letters that settle them stand/);
  assert.match(text, /A funding pot is a different thing, and this is not about it\./);
  assert.match(section.replace(/\s+/g, " "), /<code>class: bounty<\/code>, one ask, a reward in stamps, escrow behind it so it publishes/, "how a notice is placed");
  assert.match(section.replace(/\s+/g, " "), /<a href="\/town\/#board">the board<\/a>/, "and the board link");
});

test("the bulletin's civic pointer says it for bounties and listings in one parenthesis and is otherwise the same sentence", () => {
  const bulletin = said(read("town/pages/bulletin/index.astro"));
  const m = /The town's asks and its residents': quests, ideas, (bounties and listings \(both work today and are likely to change soon\)) and votes\./.exec(bulletin);
  assert.ok(m, "the caption");
  bothClauses(m[1], "the bulletin's caption");
});

test("the funding pots and the quest lane are not touched: none of this wording is on a pot, a pot page or the quest panel", () => {
  assert.doesNotMatch(said(read("src/lib/funding.mjs")), /likely to change soon|works today/i);
  assert.doesNotMatch(said(read("town/pages/fund/[pot].astro")), /likely to change soon|works today/i);
  const page = said(read(PAGE));
  const quests = page.slice(page.indexOf('id="quests"'), page.indexOf('id="ideas"'));
  assert.ok(/pots/i.test(quests), "the quest panel still carries the funding pots");
  assert.doesNotMatch(quests, /likely to change soon|works today|CHANGE_SOON_LABEL/, "and says nothing of this label");
});
