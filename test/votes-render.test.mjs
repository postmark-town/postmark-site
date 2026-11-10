// The Ballot Box draws each choice in its own words (POS-983).
//
// Darko, POS-684 call 4 and call 5b (2026-11-09): every reader carries the
// ballot as a full post, the site's /votes/ page among them — each choice's
// credit, link and note, its raw stamps and its backing households, the most
// stamps leading and more households breaking a tie. The page fetches the
// office's GET /votes in the browser and draws it with src/lib/votes-render.mjs;
// this draws the same answers here: today's bare-name ballot as it was, a
// credited ballot in full, and the text an office could send that must never
// become markup or a link.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { votesHtml, topicHtml, lineHtml, safeHref, esc } from "../src/lib/votes-render.mjs";

const PAGE = readFileSync(new URL("../town/pages/votes/index.astro", import.meta.url), "utf8");

// GET /votes as the office answers it before POS-983 (and for a bare-name ballot): no words, no households
const LEGACY = { topics: [{ topic: "illuminator-name", status: "closed", cap_per_household_per_candidate: 20,
  window: "one week", candidates: [{ candidate: "Iris", staked: 77 }, { candidate: "Alba", staked: 50 }] }] };

// GET /votes as the office answers it since POS-983: the count's order, the words, the households
const HEARTH = { topics: [{ topic: "hearth", status: "staking", cap_per_household_per_candidate: 20,
  window: "four weeks from the announcement; entries stop a week before the close",
  title: "Choose the town's Hearth", post: "postmark-pen/ballot-hearth",
  body: "Which household design becomes the Hearth.\nThe entries: https://postmark.town/hearth/entries/. Stake on as many as you like.",
  candidates: [
    { candidate: "ember-house", credit: "ada", link: "https://github.com/postmark-town/postmark/pull/1", note: "a hearth with a reading nook", added: "2026-11-10", staked: 12, backing_households: 2 },
    { candidate: "lantern-row", credit: "dot", link: null, note: null, added: "2026-11-12", staked: 12, backing_households: 1 },
    { candidate: "quiet-yard", credit: null, link: null, note: null, added: null, staked: 0, backing_households: 0 },
  ] }] };

test("the page draws the tally with the one renderer, from the office it signed in to", () => {
  assert.match(PAGE, /import \{ votesHtml \} from "@\/lib\/votes-render\.mjs"/);
  assert.match(PAGE, /officeBase\(\) \+ "\/votes"/);
  assert.match(PAGE, /box\.innerHTML = votesHtml\(data\)/);
});

test("a bare-name ballot draws as it always has: its names, its stamps, its record, and no words", () => {
  const html = votesHtml(LEGACY);
  assert.match(html, /<h2>Illuminator Name<\/h2>/, "no title: the topic, prettied, as before");
  assert.match(html, /<span class="v-cand-name">Iris<\/span>[\s\S]*<span class="v-cand-n">77<\/span>/);
  assert.match(html, /<span class="v-cand-name">Alba<\/span>[\s\S]*<span class="v-cand-n">50<\/span>/);
  assert.match(html, /href="\/bulletin\/#name-the-illuminator"/);
  assert.doesNotMatch(html, /v-cand-words|backing|v-body/, "nothing invented for a ballot that carries no words");
});

test("a credited ballot draws its title, its body with its links, and each choice's credit, note, link and households, in the office's order", () => {
  const html = votesHtml(HEARTH);
  assert.match(html, /<h2>Choose the town&#39;s Hearth<\/h2>/);
  assert.match(html, /<p class="v-window">four weeks from the announcement; entries stop a week before the close<\/p>/);
  assert.match(html, /<p class="v-body">Which household design becomes the Hearth\.<\/p>/);
  assert.match(html, /<a href="https:\/\/postmark\.town\/hearth\/entries\/" rel="nofollow noopener">https:\/\/postmark\.town\/hearth\/entries\/<\/a>\. Stake on/,
    "a body's https address is a link, its trailing full stop left as text");
  // the order is the office's (stamps, then households): ember-house's two households lead lantern-row's one at 12 each
  const order = [...html.matchAll(/<span class="v-cand-name">([^<]+)<\/span>/g)].map((m) => m[1]);
  assert.deepEqual(order, ["ember-house", "lantern-row", "quiet-yard"]);
  const row = (name) => new RegExp(`<span class="v-cand-name">${name}</span>[\\s\\S]*?</li>`).exec(html)[0];
  assert.match(row("ember-house"), /<span class="v-cand-credit">by ada<\/span>/);
  assert.match(row("ember-house"), /<span class="v-cand-note">a hearth with a reading nook<\/span>/);
  assert.match(row("ember-house"), /<a class="v-cand-link" href="https:\/\/github\.com\/postmark-town\/postmark\/pull\/1" rel="nofollow noopener">/);
  assert.match(row("ember-house"), /<span class="v-cand-houses">2 households backing<\/span>/);
  assert.match(row("lantern-row"), /by dot[\s\S]*1 household backing/);
  assert.doesNotMatch(row("lantern-row"), /v-cand-link|v-cand-note/);
  assert.match(row("quiet-yard"), /0 households backing/);
  assert.match(html, /cap 20 per household per choice · stakes are escrow, returned at close · the most stamps leads; more backing households breaks a tie/);
});

test("whatever text the office sends stays text: escaped everywhere, and only an https address is ever a link", () => {
  const evil = { topics: [{ topic: "x", status: "staking", cap_per_household_per_candidate: 20,
    title: `<img src=x onerror=alert(1)>`, body: `"><script>alert(1)</script> javascript:alert(1)`,
    candidates: [{ candidate: `<b>n</b>`, credit: `' onmouseover='x`, note: `</li><li>`, link: "javascript:alert(1)", staked: 1, backing_households: 1 },
      { candidate: "d", link: "http://plain.example/", staked: 0, backing_households: 0 },
      { candidate: "q", link: `https://a.example/"onmouseover="x`, staked: 0, backing_households: 0 }] }] };
  const html = votesHtml(evil);
  assert.doesNotMatch(html, /<img|<script|<b>|<\/li><li>/);
  assert.doesNotMatch(html, /href="javascript|href="http:/);
  assert.doesNotMatch(html, /' onmouseover='|"onmouseover="/);
  assert.match(html, /&lt;b&gt;n&lt;\/b&gt;/);
  assert.match(html, /href="https:\/\/a\.example\/&quot;onmouseover=&quot;x"/, "an https link's quote is escaped inside its attribute");
  assert.equal(esc(`&<>"'`), "&amp;&lt;&gt;&quot;&#39;");
  assert.equal(safeHref("javascript:alert(1)"), null);
  assert.equal(safeHref("https://postmark.town/"), "https://postmark.town/");
  assert.equal(lineHtml("see http://x.example/ and https://y.example/a."), 'see http://x.example/ and <a href="https://y.example/a" rel="nofollow noopener">https://y.example/a</a>.');
});

test("an office that cannot be read, and an empty box, each say so in one sentence", () => {
  assert.match(votesHtml(null), /could not be reached/);
  assert.match(votesHtml({}), /could not be reached/);
  assert.match(votesHtml({ topics: [] }), /No open ballots/);
  assert.equal(topicHtml(HEARTH.topics[0]), votesHtml(HEARTH));
});
