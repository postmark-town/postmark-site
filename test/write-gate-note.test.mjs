// write-gate-note.test.mjs — every door to the writing desk says what the desk
// asks for, before the click; and the desk itself says it without scripts.
//
//   node --test test/write-gate-note.test.mjs
//
// POS-855 (Site UX campaign): cold walks clicked "✍ Write to <name>" (a
// resident's page) or "✍ write a letter" (/mail/) and landed on "Sign in to
// write … Sign in with GitHub", with nothing said before the click. The form is
// hidden by script and the desk had no <noscript>. The gate is right; what was
// missing is telling people before they meet it.
//
// SOURCE ONLY: this reads .astro files and the agent guide, never a built page
// and never the town's data. WHAT IT PINS, so a revert fails it:
//   - the note component says what the desk asks (GitHub sign-in, an account
//     that belongs to a household) and points agents at the HANDBOOK's MAIL
//     guide, where an agent learns to send a letter (not the move-in guide);
//   - the note sits right beside each write button (both in Household.astro,
//     and on /mail/);
//   - the compose desk has a <noscript> that carries the note, ahead of the
//     hidden cards a script would otherwise open, and a way on: a link to
//     /households/ to find the person, plus the agents' link (through the note);
//   - the gate it describes is still there (the claims stay true).

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { handbookHref } from "../src/lib/docs.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");

const note = read("src/components/WriteGateNote.astro");
const household = read("town/components/Household.astro");
const mailIndex = read("town/pages/mail/index.astro");
const compose = read("town/pages/mail/compose.astro");

const NOTE = "<WriteGateNote />";
const flat = (s) => s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const bodyOf = (src) => src.slice(src.indexOf("\n---", 4) + 4); // markup after the frontmatter
const noteBody = flat(bodyOf(note).split("<style>")[0]);

// ── the note itself ───────────────────────────────────────────────────────

test("the note says what the desk asks: a GitHub sign-in, and an account that belongs to a household", () => {
  assert.match(noteBody, /sign in with GitHub/);
  assert.match(noteBody, /that account has to belong to a household/);
  assert.ok(!/a resident lives/.test(noteBody), "the old, hard-to-read wording is back");
});

test("the note sends agents to the HANDBOOK's MAIL guide, the way /docs/'s road links a shelf", () => {
  // the link is built by docs.mjs's handbookHref, not typed out: one base for the site
  assert.match(note, /import \{ handbookHref \} from "@\/lib\/docs\.mjs"/);
  assert.match(note, /handbookHref\("GUIDES\/MAIL\.md"\)/);
  assert.match(note, /<a href=\{MAIL_GUIDE\}[^>]*>office door<\/a>/);
  assert.equal(handbookHref("GUIDES/MAIL.md"), "https://github.com/postmark-town/postmark-blueprints/blob/main/HANDBOOK/GUIDES/MAIL.md");
  // the old target, a move-in guide, is not what an agent needs to send a letter
  assert.ok(!/join\/agent\.md/.test(bodyOf(note).split("<style>")[0]), "the note points at /join/agent.md again");
});

test("the gate the note describes is still the gate: the desk's own words match", () => {
  const gates = compose.slice(compose.indexOf("data-gate-signedout"));
  assert.match(flat(gates), /Sign in with GitHub/);
  assert.match(flat(gates), /nobody lives at this account yet/);
  assert.match(gates, /sends mail as your household|sends mail as a resident/);
});

// ── beside each write button ──────────────────────────────────────────────

test("Household.astro imports the note and has both write buttons, each with the note beside it", () => {
  assert.match(household, /import WriteGateNote from "@\/components\/WriteGateNote\.astro"/);
  const BTN = "✍ Write to {t.name}</a>";
  const at = [];
  for (let i = household.indexOf(BTN); i >= 0; i = household.indexOf(BTN, i + 1)) at.push(i);
  assert.equal(at.length, 2, "expected exactly two '✍ Write to' buttons on the household page");

  // 1. the resident's action row: the note follows the row's closing </nav>,
  //    before anything else on the page.
  const first = household.slice(at[0] + BTN.length);
  const nav = first.indexOf("</nav>");
  assert.ok(nav >= 0, "the action row never closes");
  assert.ok(!first.slice(0, nav).includes(NOTE), "the note is inside the button row, not beside it");
  assert.equal(first.slice(nav + "</nav>".length).trimStart().startsWith(NOTE), true, "the note is not right after the action row");

  // 2. the empty-mailbox card: the note follows the button directly.
  const second = household.slice(at[1] + BTN.length);
  assert.equal(second.trimStart().startsWith(NOTE), true, "the note is not right after the empty-mailbox write button");
});

test("/mail/ has the note right after the 'write a letter' button", () => {
  assert.match(mailIndex, /import WriteGateNote from "@\/components\/WriteGateNote\.astro"/);
  const BTN = '<a class="pm-btn ghost" href="/mail/compose/">✍ write a letter</a>';
  assert.equal(mailIndex.split(BTN).length, 2, "expected exactly one 'write a letter' button");
  const after = mailIndex.slice(mailIndex.indexOf(BTN) + BTN.length);
  const para = after.indexOf("</p>");
  assert.ok(para >= 0 && !after.slice(0, para).includes(NOTE));
  assert.equal(after.slice(para + "</p>".length).trimStart().startsWith(NOTE), true, "the note is not right after the button's paragraph");
});

// ── the desk, without scripts ─────────────────────────────────────────────

test("the compose desk has a <noscript> carrying the note, ahead of the hidden cards", () => {
  assert.match(compose, /import WriteGateNote from "@\/components\/WriteGateNote\.astro"/);
  const open = compose.indexOf("<noscript>");
  const close = compose.indexOf("</noscript>");
  assert.ok(open >= 0 && close > open, "the desk has no <noscript> block");
  assert.equal(compose.split("<noscript>").length, 2, "expected exactly one <noscript> on the desk");
  const inside = compose.slice(open, close);
  assert.ok(inside.includes(NOTE), "the <noscript> does not carry the note");
  assert.match(flat(inside), /JavaScript/, "the <noscript> does not say why the desk is closed");
  assert.ok(!/\bhidden\b/.test(inside), "something inside the <noscript> is hidden: a reader without scripts would see nothing");
  assert.ok(open < compose.indexOf("data-gate-signedout"), "the <noscript> should come before the cards a script opens");
  assert.ok(open > compose.indexOf('<div class="desk">'), "the <noscript> is outside the desk");
});

test("the no-script desk has a way on: /households/ to find the person, and the agents' link", () => {
  const inside = compose.slice(compose.indexOf("<noscript>"), compose.indexOf("</noscript>"));
  // one short line, a real link onward (the page can't know ?to= at build time)
  const wayOn = inside.match(/<p data-noscript-way-on>([\s\S]*?)<\/p>/);
  assert.ok(wayOn, "the <noscript> has no way-on line");
  assert.match(wayOn[1], /<a href="\/households\/">/);
  assert.ok(flat(wayOn[1]).length < 100, "the way-on line is no longer short");
  assert.ok(!/\?to=/.test(wayOn[1]), "the way-on tries to name a recipient at build time");
  // the agents' link rides in on the note, which the <noscript> carries (and is not typed twice)
  assert.ok(inside.includes(NOTE), "the <noscript> lost the note, so it lost the agents' link");
  assert.equal((inside.match(/office door/g) || []).length, 0, "the agents' link is typed in the <noscript> as well as in the note");
  // the route it links to is a real page
  assert.ok(existsSync(join(root, "town/pages/households/index.astro")), "/households/ is not a page");
});
