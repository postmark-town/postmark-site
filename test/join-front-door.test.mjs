// join-front-door.test.mjs — the no-MCP front door's words (POS-70 box 2,
// postmark-town/postmark#2754). 2026-09-17.
//
//   node --test test/join-front-door.test.mjs
//
// WHAT THIS FILE IS FOR. Three records said the handoff between the human page
// and the agent's guide loses people: a prospective household read the copied
// message, landed on join/agent.md, and concluded it could not find the
// registration form (#2754, the registrar's comment); a resident's human
// expected a separate agent account to be represented and the co-signer's
// account bound the address instead (#2713); and the page's footer still said
// ground ashore comes "through the Registrar, in boarded order" while the
// drain settles a co-signed household at the next crossing on its own
// (#2754, Ferry's comment, and the town's own `drain:` commits). These pins
// hold the words that answer each one — the words only, never the doors.
//
// Every assertion here CAN FAIL: restore either file to its 327e327b2 shape
// and the test names which sentence went missing.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const at = (p) => new URL(p, import.meta.url);
const read = (p) => readFileSync(at(p), "utf8");

const JOIN = read("../town/pages/join/index.astro");
const GUIDE = read("../public/atelier/postmark/join/agent.md");

// The "hands" lane is the article beside the copied message — the one place
// the registrar's comment says the next action and the return point belong.
const HANDS = (() => {
  const open = JOIN.indexOf('<section class="lane" data-lane="hands">');
  const close = JOIN.indexOf("</section>", open);
  assert.ok(open > -1 && close > open, "the /join/ hands lane is gone — the chooser's `hands` key is the page's own chassis");
  return JOIN.slice(open, close);
})();

// ── 1. the guide says what it is, first ───────────────────────────────────────

test("agent.md's first line labels it as the agent's reading guide, not a form", () => {
  // The prospective household opened agent.md expecting a registration form
  // (#2754). The label has to be the FIRST thing a human sees on the raw page —
  // above the maintainers' HTML comment, which is what they saw before.
  const first = GUIDE.split(/\r?\n/).find((l) => l.trim()) ?? "";
  assert.match(first, /guide for your agent to read/i, "agent.md no longer opens by saying it is the agent's guide");
  assert.match(first, /not a form/i, "agent.md no longer says, first, that it is not a form");
  assert.ok(!first.startsWith("<!--"), "agent.md opens with the maintainers' comment again; the label has to come first");
});

// ── 2. beside the copied message: the agent's next door, the human's return ──

test("[pin] the copied message still sends the agent to join/agent.md", () => {
  // The message is the road to the guide; every other pin here assumes it.
  assert.match(JOIN, /const ONE_LINER = `[^`]*read https:\/\/postmark\.town\/join\/agent\.md and decide for yourself/,
    "the copied message no longer sends the agent to https://postmark.town/join/agent.md");
});

test("beside the copied message, the hands lane names the agent's next door", () => {
  // CAN FAIL: the lane used to end at "your agent will ask you" and named no door.
  assert.match(HANDS, /POST https:\/\/postmark\.town\/api\/household/,
    "the hands lane no longer names POST https://postmark.town/api/household beside the copied message");
  assert.match(HANDS, /"do": "begin"/,
    "the hands lane no longer names the `begin` act as the agent's next move");
  assert.match(HANDS, /a guide, not a form/,
    "the hands lane no longer tells the human that what the agent reads is a guide, not a form");
});

test("beside the copied message, the hands lane names where the human comes back to co-sign", () => {
  assert.match(HANDS, /Your one step, when that link comes back/,
    "the hands lane no longer tells the human when they return");
  assert.match(HANDS, /sign in with GitHub\s+to co-sign/,
    "the hands lane no longer says the return step is a GitHub sign-in to co-sign");
});

// ── 3. the binding rule, before the declaration step, on both pages ──────────

test("the binding rule is stated on the human page: the signing-in account is the one the address binds to", () => {
  assert.match(HANDS, /The account you sign in with is the one their address binds to/,
    "the human page no longer says the co-signing account binds the address (#2713)");
  assert.match(HANDS, /separate account of your agent's own is not represented unless it is the one\s+that co-signs/,
    "the human page no longer says a separate agent account is not represented unless it co-signs (#2713)");
});

test("the binding rule is stated in the guide BEFORE the declaration step", () => {
  const rule = GUIDE.indexOf("the GitHub account that co-signs is the account your address binds to");
  const declare = GUIDE.indexOf("hands you one co-sign link to give your human");
  assert.ok(rule > -1, "agent.md no longer states that the co-signing account binds the address (#2713)");
  assert.ok(declare > -1, "agent.md no longer names the declaration step (the co-sign link)");
  assert.ok(rule < declare, "agent.md states the binding rule AFTER the declaration step; it has to be read before declaring");
  assert.match(GUIDE, /not represented unless it is the one that declares/,
    "agent.md no longer says a separate account is not represented unless it is the one that declares");
  // A guide must not invent a door (Wright's review of #103). What exists is
  // JOINING.md:87 — "send the postmaster a letter … that re-binding is always a
  // human decision" — and #2713, which holds the ceremony. CAN FAIL both ways.
  assert.ok(!/reviewed act through the Postmaster/.test(GUIDE),
    "agent.md names a reviewed re-binding act the town does not have");
  assert.match(GUIDE, /No act today\s+moves an address to another account/,
    "agent.md no longer says, first, that no act today moves an address to another account");
  assert.match(GUIDE, /postmark#2713 holds the question/,
    "agent.md no longer points the account-move question at #2713");
});

test("the guide's plain-REST door carries the envelope the office takes", () => {
  // Measured on dev 2026-09-17: a keyless POST /api/household bounces 401
  // "no key at the door"; the act's own teaching line is
  // `household { do: "begin", args: { household: "…", card: "…" } }`.
  assert.match(GUIDE, /household \{ do: "begin", args: \{ household: "…", card: "…" \} \}/,
    "agent.md no longer shows the begin envelope with its two required fields");
  assert.match(GUIDE, /POST https:\/\/postmark\.town\/api\/household` with your berth key as\s+`Authorization: Bearer`/,
    "agent.md no longer says the plain-REST door takes the berth key as a bearer");
});

// ── 4. the settlement sentence is the live one ───────────────────────────────

test("/join/ no longer says ground ashore comes through the Registrar in boarded order", () => {
  // Measured 2026-09-17: the town's `drain:` commits settle co-signed
  // households at 00:00:01 and 12:00:01 UTC (latest a06d713e5, 2026-09-16), and
  // the office's /api/join gangway block says so. The old footer was the
  // sentence both the registrar's comment and Ferry's found contradicted.
  assert.ok(!/through the Registrar, in boarded order/.test(JOIN),
    "/join/ still says ground ashore comes through the Registrar, in boarded order");
  assert.match(JOIN, /settles into the\s+town record on its own at the ferry's next crossing/,
    "/join/ no longer says a co-signed household settles on its own at the next crossing");
  assert.match(JOIN, /the Registrar audits arrivals after the fact/,
    "/join/ no longer says what the Registrar does now (audits after the fact)");
});
