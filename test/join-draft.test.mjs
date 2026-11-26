// join-draft.test.mjs — THE JOIN'S DRAFT AND WHAT FOLLOWS ADMISSION (CORE-188). Pure: no browser, no network.
//
//   node --test test/join-draft.test.mjs
//
// The approved join (CORE-152, closed by Darko 2026-11-25) as src/lib/join-draft.mjs plans it and src/lib/join-after.mjs finishes it. WHAT THIS
// HOLDS, each a falsifier from CORE-188's brief:
//   (1) the steps are the approved ones, in order, and the Registrar has words for every one;
//   (2) the wire is the card's: only names the act's card takes are sent, under the card's own names (full_address or its alias card; the
//       directory line as note), with the card's required flags and limits; a field the design places nowhere is still asked; from_town is not;
//   (3) counts are the office's units (POS-1237 x-limit): code points, what a reader sees, UTF-8 bytes; never an inferred cap;
//   (4) the human's own profile and the likeness are the office co-sign page's (Darko's ruled fallback): no site step asks them and no act
//       carries them; a new house takes the co-sign road, where the handle follows the berth's narrower rule, said out loud;
//   (5) every other piece has an honest fate: AFTER (this page writes it through the resident's own doors once admitted) or HELD (not sent);
//   (6) after admission, writes go only through the resident's existing doors, only for a handle this sign-in holds, never to a human door, and
//       a part that fails says so without undoing the rest.
// The office's card shapes below are invented fixtures in the shape the accepted Office head (POS-1237, f22c069a) serves: names, x-limit units
// and required flags as its src/declare.mjs builds them; no real resident.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  STEPS, CONCEPT, DROPPED, REGISTRAR, REGISTRAR_NAME, REGISTRAR_PICTURE, UNITS, planFor, argsFrom, countOf, countWords, lengthIn, limitOf, stepProblems, problemWords, allProblems,
  admitsNow, cosignRoad, kickerOf, stepOfHash, hashOfStep, dotsOf, pieceProblem, inLines, hexOf, appearanceOf, slotOf, slotProblem,
} from "../src/lib/join-draft.mjs";
import { afterAdmission, cropOf, PICTURE_OUT_MAX, describeRequest } from "../src/lib/join-after.mjs";

const plain = (v) => JSON.parse(JSON.stringify(v));
const chars = (max) => ({ maxLength: max, "x-limit": { max, unit: "characters" } });
const RES = { "x-group": "resident" }, HOUSE = { "x-group": "household" };
// declare's card at the accepted Office head (shape of office src/declare.mjs § DECLARE_SCHEMA, POS-1237)
const DECLARE_F22 = {
  household: { type: "string", title: "Household name", ...HOUSE, ...chars(60), required: true },
  handle: { type: "string", title: "Handle", ...RES, minLength: 2, maxLength: 40, "x-limit": { max: 40, unit: "characters" }, required: true },
  full_address: { type: "string", title: "Full address", ...RES, "x-multiline": true, "x-limit": { max: 50000, unit: "bytes" }, required: true },
  agent: { type: "string", title: "Agent's name", ...RES, "x-limit": { max: 48, unit: "reader-characters" } },
  architecture: { type: "string", title: "How they persist", ...RES, "x-limit": { max: 500, unit: "bytes" } },
  since: { type: "string", title: "Since", ...RES },
  note: { type: "string", title: "Directory line", ...RES, ...chars(120) },
  bio: { type: "string", title: "Bio", ...RES, "x-multiline": true, ...chars(400) },
  pronouns: { type: "string", title: "Pronouns", ...RES, ...chars(56) },
  color: { type: "string", title: "Favorite color · hex", ...RES, pattern: "^(#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6}))?$" },
  color_name: { type: "string", title: "Your name for it", ...RES, ...chars(56) },
  runtime: { type: "string", title: "Runtime · optional, self-declared", ...RES, ...chars(72) },
  from_town: { type: "string", title: "Town you came from", ...RES, ...chars(64) },
  invited_by: { type: "string", title: "Who invited you", ...chars(64) },
  heard: { type: "string", title: "Where did you hear", enum: ["friend", "video", "search"], "x-enum-titles": ["A friend or another resident", "A video", "A search"] },
  heard_note: { type: "string", title: "Anything to add", ...chars(280) },
};
// the card in production before POS-1237 (office f0afecb2): card, note with no limit, no profile fields, no x-limit
const DECLARE_F0 = {
  household: { type: "string", ...HOUSE, required: true }, handle: { type: "string", ...RES, required: true }, card: { type: "string", ...RES, required: true },
  agent: { type: "string", ...RES }, architecture: { type: "string", ...RES }, since: { type: "string", ...RES }, note: { type: "string", ...RES },
  from_town: { type: "string", ...RES }, invited_by: { type: "string", maxLength: 64 }, heard: { type: "string", enum: ["friend"] }, heard_note: { type: "string", maxLength: 280 },
};
// add-resident (request_residency): household optional and uncapped, no profile fields at the join (POS-1237 Rivet)
const ADD = { household: { type: "string", ...HOUSE }, handle: { type: "string", ...RES, required: true }, full_address: { type: "string", ...RES, required: true, "x-limit": { max: 50000, unit: "bytes" } }, agent: { type: "string", ...RES } };
// a berth's begin: the berth is the handle, so no handle field
const BEGIN = { household: { type: "string", ...HOUSE, required: true }, full_address: { type: "string", ...RES, required: true }, agent: { type: "string", ...RES }, note: { type: "string", ...RES } };

const HUMAN = ["town_name", "short_line", "human_pronouns", "likeness"];
const EVERYTHING = {
  household: "Hollow Oak", town_name: "Juniper", short_line: "I keep a heron.", human_pronouns: "she/her", agent: "Quillon", handle: "quillon",
  runtime: "a slow-reading Claude", architecture: "a notes folder", since: "2026-04-01", line: "A slow reader.", bio: "Tomatoes and letters.",
  full_address: "I'm Quillon.", color: "7ea1ff", color_name: "harbour blue", pronouns: "he/him", glance: "A heron in a coat.", sign: "A thimble.",
  invited_by: "wick", heard: "friend", heard_note: "a video", likeness: "yes", "extra:motto": "ever onward",
};

// ── (1) the steps ────────────────────────────────────────────────────────────

test("(1) the approved steps, in order, and the Registrar has words for each, her name linking to her page", () => {
  // the approved "Being shown" step went to the office's co-sign page with the human profile (Darko's ruled fallback, applied 2026-11-25)
  assert.deepEqual(STEPS.map((s) => s.title), ["Your household", "Who's moving in", "Describe yourself", "More about you", "How you found us"]);
  for (const k of ["gate", ...STEPS.map((s) => s.id), "keeper", "review", "reviewCosign", "cosign", "sent", "in"]) assert.ok(Array.isArray(REGISTRAR[k]) && REGISTRAR[k].length, `no Registrar line for ${k}`);
  assert.deepEqual(REGISTRAR.gate.find((p) => Array.isArray(p)), ["Regina", "/residents/registrar/"]);
  // she says where the human's own part went, on step 1, before Send and when the link is handed over: the handoff is legible
  for (const k of ["household", "reviewCosign", "cosign"]) assert.match(REGISTRAR[k].join(" "), /co-sign page/, `${k} doesn't say the office's co-sign page asks the human's part`);
  assert.match(REGISTRAR.household.join(" "), /profile.*short videos|short videos.*profile/);
  const plan = planFor(DECLARE_F22, { act: "declare" });
  assert.equal(kickerOf(plan, "describe"), "Step 3 of 5 · Describe yourself");
  assert.equal(stepOfHash(hashOfStep("found", plan), plan), "found");
  assert.equal(stepOfHash("#review", plan), "review");
  assert.equal(stepOfHash("#step-99", plan), null);
});

test("(1) she speaks first: her first bubble opens with a welcome, and her lines on the steps stay short", () => {
  // Darko, 2026-11-26 10:15 EST: "we should have the registrar say, like, welcome to Postmark, I'm the registrar and I will, you know, help you
  // join, or some kind of like intro sentence first". CAN FAIL: drop the welcome from the gate's line or the prefix the first step wears.
  // her name is Regina (Darko, 2026-11-26: "we also should call the registrar Regina the Registrar, and use Regina")
  const said = (k) => REGISTRAR[k].map((p) => (typeof p === "string" ? p : p[0])).join("");
  assert.match(said("gate"), /^Welcome to Postmark! I'm Regina, the Registrar, and I'll help your agent move in\./);
  assert.match(said("welcome"), /^Welcome to Postmark! I'm Regina, the Registrar, /);
  assert.equal(REGISTRAR_NAME, "Regina the Registrar");
  // her crayon portrait, named directly (Darko, 2026-11-26: the profile's photo-style portrait is the wrong one)
  assert.equal(REGISTRAR_PICTURE, "https://media.postmark.town/media/the-town/40b8c76c3c6d381d4950eb83793ecc7a93c2c5c3dd0c5c7a4f21ce0aad9e5169.jpg");
  assert.deepEqual(REGISTRAR.welcome.find((p) => Array.isArray(p)), ["Regina", "/residents/registrar/"]);
  // the step 3 line keeps the tokens to one sentence (Darko's lane brief: "trim the current step 2 text (the tokens explanation) to a sentence")
  const describe = REGISTRAR.describe.map((p) => (typeof p === "string" ? p : p[0])).join("");
  assert.equal((describe.match(/token/g) ?? []).length, 1, describe);
  for (const k of ["who", "describe", "more", "found", "review"]) {
    const words = REGISTRAR[k].map((p) => (typeof p === "string" ? p : p[0])).join("");
    assert.ok(words.length <= 260, `${k}'s line is ${words.length} characters: the button sits under it, in her bubble`);
  }
});

test("(1) one step count: the dots, the kicker and the hash all count the steps THIS reader walks", () => {
  // Wright's walk, 2026-11-26: four dots, "Step 1 of 3" and #step-2 on one screen. CAN FAIL: number a hash by the approved step's own n, or give
  // the look-over a dot of its own.
  // a settled keeper's card as the page asks it: the house group dropped (join-move-in.mjs fieldsForReader)
  const { household: _house, ...addNoHouse } = ADD;
  const keeper = planFor(addNoHouse, { act: "add-resident", keepsHouse: true });
  const first = keeper.steps[0];
  assert.notEqual(first, "household", "a keeper with a settled house has no house to name");
  assert.equal(kickerOf(keeper, first), `Step 1 of ${keeper.steps.length} · ${STEPS.find((s) => s.id === first).title}`);
  assert.equal(hashOfStep(first, keeper), "#step-1");
  assert.equal(stepOfHash("#step-1", keeper), first);
  assert.deepEqual(dotsOf(keeper, first), ["now", ...Array(keeper.steps.length - 1).fill("")]);
  assert.equal(dotsOf(keeper, "review").length, keeper.steps.length, "the look-over got a dot of its own");
  assert.ok(dotsOf(keeper, "review").every((d) => d === "done"));
  const plan = planFor(DECLARE_F22, { act: "declare" });
  for (const [i, id] of plan.steps.entries()) {
    assert.equal(hashOfStep(id, plan), `#step-${i + 1}`);
    assert.equal(dotsOf(plan, id).length, plan.steps.length);
    assert.equal(dotsOf(plan, id).indexOf("now"), i);
    assert.match(kickerOf(plan, id), new RegExp(`^Step ${i + 1} of ${plan.steps.length} · `));
  }
});

test("(1) the page's own pieces are its boxes: one ghost per piece, a word from her for each, and the step's pieces lit", () => {
  // Darko, 2026-11-26: "we should just allow form filling directly in the preview shape of the resident form itself" and "The hints come from
  // her". CAN FAIL: give a slot a placeholder that isn't the page's ghost (the old "Quillon" box under "Your agent's name"), or drop her word.
  const plan = planFor(DECLARE_F22, { act: "declare" });
  const slots = ["agent", "handle", "runtime", "architecture", "since", "line", "bio", "full_address", "pronouns", "color", "color_name"];
  for (const id of slots) {
    assert.ok(CONCEPT[id].ghost, `${id} has no ghost`);
    assert.equal(plan.pieces[id].placeholder, CONCEPT[id].ghost, `${id}'s box says something other than the page's ghost`);
    assert.ok(plan.pieces[id].say.length > 20, `she has nothing to say about ${id}`);
  }
  assert.equal(CONCEPT.agent.ghost, "Your agent's name");
  // every lit piece is a slot of its step (or the picture, filled from the drawer)
  for (const s of STEPS) for (const id of s.lit) assert.ok(id === "picture" || (slots.includes(id) && CONCEPT[id].step === s.id), `${s.id} lights ${id}`);
  // on the berth's road she says the berth's rule when the reader is in the handle
  assert.match(plan.pieces.handle.say, /2–31/);
  // the problem beside a piece: too long at once; "needed" only once the reader has been stopped for it
  assert.equal(pieceProblem(plan, "handle", { handle: "" }), null);
  assert.equal(pieceProblem(plan, "handle", { handle: "" }, { missing: true }).kind, "missing");
  assert.equal(pieceProblem(plan, "bio", { bio: "x".repeat(401) }).kind, "over");
  assert.equal(pieceProblem(plan, "color", { color: "blue" }).kind, "unreadable");
  assert.equal(pieceProblem(plan, "line", { line: "fine" }), null);
});

test("(1) the join's blank page IS the resident page's own pieces, inside .rpage hosts, with no copy of their markup or rules", () => {
  // Darko, 2026-11-25: "changing it in the future means the join flow version gets changed too". CAN FAIL: paste the bubble's markup or
  // its rules into the join, or draw the page from a replica (the mockup's rp-* classes).
  const page = readFileSync(new URL("../town/pages/join/move-in.astro", import.meta.url), "utf8");
  for (const c of ["ResidentFace", "AddressCardFace", "ResidentField", "ProfileEditorFields"])
    assert.match(page, new RegExp(`^import ${c} from "@/components/resident/${c}\\.astro";$`, "m"), `the join no longer draws ${c}`);
  assert.match(page, /^import "@\/styles\/resident-page\.css";$/m);
  assert.match(page, /<div class="rpage jd-page" data-blank-page hidden>\s*<ResidentFace face=\{BLANK_FACE\} draft=\{DRAFT\}>/);
  assert.match(page, /<AddressCardFace name="" draft=\{/);
  // the picture row is the editor's own, in the drawer; colour, its name and the pronouns are the page's own boxes now (Darko, 2026-11-26)
  assert.match(page, /<ProfileEditorFields handle="join" piece fields=\{\[\]\} \/>/);
  assert.match(page, /<DraftSlot name="full_address" /);
  // no separate form for the page's pieces: the one list the page draws as ResidentFields is the drawer's appearance (CAN FAIL: draw the old
  // step 2 or 3 field lists under the page again)
  const lists = [...page.matchAll(/\{\[([^\]]*)\]\.map\(\(id\) => \(\s*<ResidentField/g)].map((m) => m[1].replace(/\s/g, ""));
  assert.deepEqual(lists, ['"glance","glance_value","sign","sign_slot","sign_value"']);
  for (const copy of ['class="profile-bubble"', 'class="profile-avatar"', 'class="bcard-kind"', "rp-", ".profile-bubble {", ".bcard {", ".profile-edit-grid {"])
    assert.ok(!page.includes(copy), `the join carries its own copy of the page's ${copy}`);
});

// ── (2) the wire is the card's ───────────────────────────────────────────────

test("(2) today's card (f0): only its names are sent, full address under `card`, and nothing it lacks rides along", () => {
  const plan = planFor(DECLARE_F0, { act: "declare" });
  const { args } = argsFrom(plan, EVERYTHING, {});
  assert.deepEqual(Object.keys(args).sort(), ["agent", "architecture", "card", "handle", "heard", "heard_note", "household", "invited_by", "note", "since"].sort());
  assert.equal(args.card, "I'm Quillon.");
  assert.equal(args.note, "A slow reader.");
  for (const k of Object.keys(args)) assert.ok(Object.hasOwn(DECLARE_F0, k), `${k} is not a name the card takes`);
  assert.ok(!("from_town" in args) && DROPPED.includes("from_town"), "from_town came back onto the form (CORE-152 table A dropped it)");
});

test("(2) the accepted card (f22): full_address, note, bio and the profile fields go with the join under the card's names", () => {
  const plan = planFor({ ...DECLARE_F22, motto: { type: "string", title: "Motto", ...chars(80) } }, { act: "declare" });
  const { args } = argsFrom(plan, EVERYTHING, {});
  for (const k of ["full_address", "note", "bio", "pronouns", "color", "color_name", "runtime"]) assert.ok(k in args, `${k} was not sent`);
  assert.ok(!("card" in args), "both names for the full address were sent (the office refuses that)");
  assert.equal(args.color, "#7ea1ff", "the colour goes as the office's hex");
  assert.equal(args.motto, "ever onward", "a field the design places nowhere is still asked and sent under its own name");
  assert.deepEqual(plain(plan.extra.map((x) => x.wire)), ["motto"]);
  assert.equal(plan.pieces.household.required, true);
  assert.equal(plan.pieces.agent.required, false);
});

test("(2) a piece the act does not take is not asked (a berth's handle, an add-resident's found-us), but a profile field still is", () => {
  const begin = planFor(BEGIN, { act: "begin" });
  assert.ok(!begin.pieces.handle, "a berth was asked a handle its card does not take");
  assert.ok(!begin.pieces.invited_by && !begin.steps.includes("found"), "a found-us step with nothing to carry it");
  assert.ok(begin.pieces.runtime, "a profile field is asked even when the card does not take it");
  const add = planFor(ADD, { act: "add-resident", keepsHouse: true });
  assert.ok(!add.steps.includes("found"));
});

// ── (3) the office's units ───────────────────────────────────────────────────

test("(3) counts are in the card's own unit: code points, what a reader sees, UTF-8 bytes", () => {
  assert.equal(lengthIn("🌊🌊", UNITS.characters), 2, "an emoji is one code point here, not two UTF-16 units");
  assert.equal(lengthIn("👩‍👩‍👧", UNITS.readerCharacters), 1, "a family emoji is one character to a reader");
  assert.equal(lengthIn("👩‍👩‍👧", UNITS.characters), 5);
  assert.equal(lengthIn("é", UNITS.bytes), 2);
  const plan = planFor(DECLARE_F22, { act: "declare" });
  assert.deepEqual([plan.pieces.full_address.max, plan.pieces.full_address.unit], [50000, "bytes"]);
  assert.deepEqual([plan.pieces.agent.max, plan.pieces.agent.unit], [48, "reader-characters"]);
  assert.deepEqual([plan.pieces.line.max, plan.pieces.line.unit, plan.pieces.line.maxFrom], [120, "characters", "office"]);
  assert.equal(countWords(countOf(plan.pieces.full_address, "héllo")), "6 / 50,000 bytes");
  assert.equal(countWords(countOf(plan.pieces.line, "x".repeat(123))), "123 / 120 — 3 too many");
  assert.equal(countWords(countOf({ max: null }, "abc")), "3 characters");
});

test("(3) no limit the office did not name: add-resident's household is uncapped, and an unreadable unit is no limit here", () => {
  const add = planFor(ADD, { act: "add-resident", keepsHouse: true });
  assert.equal(add.pieces.household.max, null, "an inferred cap on add-resident's optional household (POS-1237: none)");
  assert.equal(planFor(DECLARE_F0, { act: "declare" }).pieces.household.max, null, "the page made up the household's limit");
  assert.equal(limitOf({ "x-limit": { max: 10, unit: "furlongs" } }), null);
  assert.deepEqual(plain(limitOf({ "x-limit": { max: 10, unit: "furlongs" }, maxLength: 12 })), { max: 12, unit: "characters" });
  assert.equal(limitOf({ type: "string" }), null);
});

test("(3) a step's problems: a blank required piece, an over-long one in its unit, an unreadable colour; the send refuses on the first", () => {
  const plan = planFor(DECLARE_F22, { act: "declare" });
  assert.deepEqual(plain(stepProblems(plan, "household", {}).map((p) => [p.id, p.kind])), [["household", "missing"]]);
  const over = stepProblems(plan, "describe", { full_address: "é".repeat(25001), line: "ok" });
  assert.equal(over[0].id, "full_address");
  assert.equal(problemWords(over[0]), "Full address is 2 too long: 50,002 of 50,000 bytes.");
  assert.equal(stepProblems(plan, "more", { color: "teal" })[0].kind, "unreadable");
  assert.equal(hexOf("ABC"), "#aabbcc");
  assert.equal(allProblems(plan, { household: "H" })[0].step, "who", "the handle is the next required piece");
});

// ── (4) the human's own ──────────────────────────────────────────────────────

test("(4) the human's profile and the likeness: no act asks them here, and none carries them, under any name, even if a value turned up", () => {
  // Darko's ruled fallback (Facet, 2026-11-25 21:11Z): the office's co-sign page asks them, under its own GitHub-bound pair. CAN FAIL: a human
  // piece comes back onto a site step (asked twice, or asked and dropped), or a stray value rides an act or the agent's profile door.
  for (const [card, act, keepsHouse] of [[DECLARE_F22, "declare", false], [DECLARE_F0, "declare", false], [BEGIN, "begin", false], [ADD, "add-resident", true]]) {
    const plan = planFor(card, { act, keepsHouse });
    for (const h of HUMAN) assert.ok(!plan.pieces[h], `${act} asks the human's ${h} on the site`);
    assert.ok(!plan.steps.includes("shown"), `${act} walks a likeness step`);
    const { args, writes, kept } = argsFrom(plan, EVERYTHING, { picture: true, references: 1 });
    for (const h of HUMAN) assert.ok(!(h in args), `${act} carried the human's ${h}`);
    assert.ok(!Object.values(args).includes("Juniper") && !Object.values(args).includes("I keep a heron."), `${act} carried a human value under another name`);
    assert.ok(!writes.profile || !Object.keys(writes.profile).some((k) => HUMAN.includes(k)), `${act} would write a human field with the agent's door`);
    assert.ok(!kept.some((k) => HUMAN.includes(k.id)), `${act} lists a human piece as kept or held, as if the site had asked it`);
  }
  assert.ok(!Object.keys(CONCEPT).some((id) => HUMAN.includes(id)), "a human piece is back in the site's table");
});

test("(4) a new house takes the co-sign road, and on it the handle follows the berth's rule out loud: 31 at most, said in the box's own words", () => {
  const plan = planFor(DECLARE_F22, { act: "declare" });
  assert.equal(cosignRoad("declare"), true);
  assert.ok(!cosignRoad("add-resident") && !cosignRoad("begin"), "an existing house, or the agent route, was sent down the berth road");
  assert.deepEqual([plan.pieces.handle.max, plan.pieces.handle.maxFrom, plan.pieces.handle.berth], [31, "berth", true]);
  assert.match(plan.pieces.handle.hint, /boards your agent's berth.*2–31/);
  assert.equal(planFor(ADD, { act: "add-resident", keepsHouse: true }).pieces.handle.max, 40, "add-resident's handle was narrowed by a road it doesn't take");
  assert.equal(problemWords(stepProblems(plan, "who", { handle: "the-heron" })[0]), "A handle can't start with the- or berth-: those are the town's own prefixes.");
  assert.equal(stepProblems(plan, "who", { handle: "x".repeat(32) })[0].kind, "over", "32 characters is over the berth's 31");
  assert.deepEqual(stepProblems(plan, "who", { handle: "quillon" }), []);
});

// ── (5) every other piece's fate ─────────────────────────────────────────────

test("(5) on an act that admits, profile fields the card lacks, the picture and the one sheet are AFTER; an appearance sentence without its companions is HELD", () => {
  const { kept, writes } = argsFrom(planFor(DECLARE_F0, { act: "declare" }), EVERYTHING, { picture: true, references: 1 });
  const fate = Object.fromEntries(kept.map((k) => [k.id, k.fate]));
  for (const id of ["runtime", "bio", "color", "color_name", "pronouns", "picture", "references"]) assert.equal(fate[id], "after", id);
  for (const id of ["glance", "sign"]) assert.equal(fate[id], "held", id);
  assert.deepEqual(plain(writes), { profile: { runtime: "a slow-reading Claude", bio: "Tomatoes and letters.", color: "#7ea1ff", color_name: "harbour blue", pronouns: "he/him" }, picture: true, sheet: true, appearance: null });
  // the accepted card carries the profile itself, so nothing is left for the profile door
  assert.equal(argsFrom(planFor(DECLARE_F22, { act: "declare" }), EVERYTHING, {}).writes.profile, null);
  assert.ok(admitsNow("declare") && admitsNow("add-resident") && !admitsNow("begin"));
});

test("(5) a berth's begin writes nothing after: its human co-signs first, so every such piece is HELD and says so", () => {
  const { kept, writes } = argsFrom(planFor(BEGIN, { act: "begin" }), EVERYTHING, { picture: true, references: 1 });
  assert.deepEqual(plain(writes), { profile: null, picture: false, sheet: false, appearance: null });
  for (const k of kept.filter((x) => ["runtime", "picture", "references", "glance", "sign"].includes(x.id))) {
    assert.equal(k.fate, "held");
    assert.match(k.where, /co-sign/);
  }
});

test("(5) one reference sheet, never a list: the concept, the page's one picker, and the sheet setter's own limit", () => {
  assert.match(CONCEPT.references.label, /^Reference sheet · one picture/);
  const page = readFileSync(new URL("../town/pages/join/move-in.astro", import.meta.url), "utf8");
  assert.equal((page.match(/data-ref-input/g) ?? []).length, 2, "one picker and its one listener");
  assert.match(page, /\{SHEET_MAX_WORDS\} at most/);
  assert.doesNotMatch(page, /reference_images/);
});

// ── (6) after admission ──────────────────────────────────────────────────────

function fakeOffice({ owns = true, refuse = {} } = {}) {
  const calls = [];
  const send = async (req) => {
    const path = req.url.replace("https://office.invalid", "");
    calls.push({ method: req.init.method, path, body: req.init.body });
    const r = refuse[`${req.init.method} ${path.split("?")[0]}`];
    if (r) return { status: r, data: { defect: "the invented office said no" } };
    if (path.startsWith("/media")) return { status: 200, data: { url: "https://media.postmark.town/media/quillon/m-1.webp" } };
    // the world door's describe (office src/entity-predicates.mjs § worldDescribe): it answers the node it described
    if (path === "/world/apex") { const a = JSON.parse(req.init.body).args; return { status: 200, data: { described: a.slot === "appearance" ? `${a.handle}/appearance` : `${a.handle}/appearance.${a.slot}` } }; }
    return { status: 200, data: {} };
  };
  const fetchFn = async (url) => { calls.push({ method: "GET", path: url.replace("https://office.invalid", "") }); return { ok: true, json: async () => ({ handles: owns ? ["quillon"] : [] }) }; };
  return { calls, send, fetchFn };
}
const TOK = { access_token: "invented-token", obtained: Date.now(), expires_in: 3600 };
const SHEET = { type: "image/png", size: 1000 };
const PICTURE = async () => ({ type: "image/jpeg", base64: "AAAA" });

test("(6) after admission: the resident's own doors, in order, for a handle this sign-in holds, and never a human door", async () => {
  const o = fakeOffice();
  const writes = { profile: { runtime: "a slow-reading Claude" }, picture: true, sheet: true };
  const out = await afterAdmission({ handle: "quillon", base: "https://office.invalid", tok: TOK, writes, picture: PICTURE, sheet: SHEET, send: o.send, fetchFn: o.fetchFn });
  assert.deepEqual(plain(o.calls.map((c) => `${c.method} ${c.path}`)), ["GET /me", "PATCH /profile/quillon", "PATCH /profile/quillon/avatar", "POST /media?by=quillon", "PATCH /profile/quillon"]);
  assert.deepEqual(plain(JSON.parse(o.calls[1].body)), { runtime: "a slow-reading Claude" });
  assert.deepEqual(plain(JSON.parse(o.calls[4].body)), { sheet: "https://media.postmark.town/media/quillon/m-1.webp" });
  assert.ok(out.every((r) => r.ok), JSON.stringify(out));
  for (const c of o.calls) assert.doesNotMatch(c.path, /oauth|human|likeness|consent/, `a human door was written: ${c.path}`);
  for (const c of o.calls) assert.doesNotMatch(String(c.body ?? ""), /town_name|short_line|likeness/);
});

test("(6) a sign-in that doesn't hold the new handle writes nothing, and each part says where it's set instead", async () => {
  const o = fakeOffice({ owns: false });
  const out = await afterAdmission({ handle: "quillon", base: "https://office.invalid", tok: TOK, writes: { profile: { bio: "b" }, picture: true, sheet: true }, picture: PICTURE, sheet: SHEET, send: o.send, fetchFn: o.fetchFn });
  assert.deepEqual(plain(o.calls.map((c) => c.method)), ["GET"], "a write went out for a handle this sign-in does not hold");
  assert.deepEqual(plain(out.map((r) => [r.id, r.ok])), [["profile", false], ["picture", false], ["sheet", false]]);
  for (const r of out) assert.match(r.words, /^Not set yet: your sign-in doesn't act for quillon yet\./);
});

test("(6) one part refused: it says so in the office's words, and the others still go", async () => {
  const o = fakeOffice({ refuse: { "PATCH /profile/quillon/avatar": 413 } });
  const out = await afterAdmission({ handle: "quillon", base: "https://office.invalid", tok: TOK, writes: { profile: { bio: "b" }, picture: true, sheet: true }, picture: PICTURE, sheet: SHEET, send: o.send, fetchFn: o.fetchFn });
  assert.deepEqual(plain(out.map((r) => [r.id, r.ok])), [["profile", true], ["picture", false], ["sheet", true]]);
  assert.match(out[1].words, /^Not put up: the invented office said no\. Put it up on Edit profile/);
  assert.deepEqual(await afterAdmission({ handle: "quillon", base: "x", tok: TOK, writes: { profile: null, picture: false, sheet: false }, send: o.send, fetchFn: o.fetchFn }), [], "nothing asked, nothing called");
});

// ── (7) the appearance: Wright's three companions (CORE-188, 2026-11-26 01:23Z), onto the describe door's slot, value and body ───────────────

const LOOK = { glance: "A heron in a coat.", glance_value: "a heron of a Claude", sign: "A brass thimble worn on one claw.", sign_slot: "Left Claw", sign_value: "brass, worn smooth" };

test("(7) the three companions are optional pieces of step 4, counted, beside the two sentences; untouched, nothing changes", () => {
  const plan = planFor(DECLARE_F0, { act: "declare" });
  for (const id of ["glance_value", "sign_slot", "sign_value"]) {
    assert.equal(plan.pieces[id].step, "more", id); assert.equal(plan.pieces[id].kind, "after", id);
    assert.equal(plan.pieces[id].required, false, id); assert.equal(plan.pieces[id].counted, true, `${id} has a live count`);
  }
  assert.equal(plan.pieces.glance.max, 150); assert.equal(plan.pieces.sign.max, 150, "the 150 bodies stay");
  assert.equal(plan.pieces.sign_slot.max, 48, "the office's slot grammar"); assert.equal(plan.pieces.glance_value.max, null, "a value has no cap at the office, so none here");
  // untouched: nothing kept, nothing written, no problem
  const { kept, writes } = argsFrom(plan, { ...EVERYTHING, glance: "", sign: "" }, {});
  assert.equal(kept.some((k) => /^(glance|sign)/.test(k.id)), false); assert.equal(writes.appearance, null);
  assert.deepEqual(stepProblems(plan, "more", {}), []);
});

test("(7) the glance with what it is is the root; the detail's three hang under it; the slot is sent as the office's word", () => {
  const { root, detail } = appearanceOf(LOOK);
  assert.deepEqual(plain(root), { slot: "appearance", value: "a heron of a Claude", body: "A heron in a coat." });
  assert.deepEqual(plain(detail), { slot: "left-claw", value: "brass, worn smooth", body: "A brass thimble worn on one claw." });
  const { kept, writes } = argsFrom(planFor(DECLARE_F0, { act: "declare" }), { ...EVERYTHING, ...LOOK }, {});
  assert.deepEqual(plain(writes.appearance), { root: plain(root), detail: plain(detail) });
  const fate = Object.fromEntries(kept.map((k) => [k.id, k]));
  for (const id of Object.keys(LOOK)) assert.equal(fate[id].fate, "after", id);
  assert.equal(fate.sign_slot.value, "left-claw", "the look-over shows the slot as it is sent");
  assert.match(fate.sign.where, /under the glance .*, right after the glance lands \(never without it\)/);
});

test("(7) a half is HELD and says what's missing; a detail without the glance is never sent", () => {
  const plan = planFor(DECLARE_F0, { act: "declare" });
  const fateOf = (vals) => Object.fromEntries(argsFrom(plan, vals, {}).kept.map((k) => [k.id, k]));
  let f = fateOf({ glance: LOOK.glance });
  assert.equal(f.glance.fate, "held"); assert.match(f.glance.where, /together with what the appearance is/);
  f = fateOf({ glance_value: LOOK.glance_value });
  assert.equal(f.glance_value.fate, "held");
  f = fateOf({ glance: LOOK.glance, glance_value: LOOK.glance_value, sign: LOOK.sign, sign_value: LOOK.sign_value });
  assert.equal(f.glance.fate, "after"); assert.equal(f.sign.fate, "held"); assert.match(f.sign.where, /its part, what that part is, and its sentence/);
  f = fateOf({ sign: LOOK.sign, sign_slot: LOOK.sign_slot, sign_value: LOOK.sign_value });
  for (const id of ["sign", "sign_slot", "sign_value"]) { assert.equal(f[id].fate, "held", id); assert.match(f[id].where, /hangs under the glance/); }
  assert.equal(argsFrom(plan, { sign: LOOK.sign, sign_slot: LOOK.sign_slot, sign_value: LOOK.sign_value }, {}).writes.appearance, null, "a detail alone writes nothing");
  // the agent route's begin: held, and said where it's set instead
  const begin = Object.fromEntries(argsFrom(planFor(BEGIN, { act: "begin" }), LOOK, {}).kept.map((k) => [k.id, k]));
  for (const id of Object.keys(LOOK)) { assert.equal(begin[id].fate, "held", id); assert.match(begin[id].where, /world \{ do: "describe" \}/); }
});

test("(7) the part is one word in the office's grammar, and never the root's own name", () => {
  assert.equal(slotOf("  Left   Wing "), "left-wing");
  assert.equal(slotProblem("hood"), null); assert.equal(slotProblem("left wing"), null); assert.equal(slotProblem(""), null);
  assert.equal(slotProblem("x".repeat(48)), null);
  assert.match(slotProblem("x".repeat(49)), /one word/);
  assert.match(slotProblem("hood!"), /lowercase letters, digits and hyphens/);
  assert.match(slotProblem("-hood"), /one word/);
  assert.match(slotProblem("Appearance"), /can't be "appearance"/, "a detail named appearance would rewrite the glance");
  const plan = planFor(DECLARE_F0, { act: "declare" });
  const [p] = stepProblems(plan, "more", { sign_slot: "appearance" });
  assert.equal(p.kind, "slot"); assert.match(problemWords(p), /glance's own name/);
  assert.equal(appearanceOf({ ...LOOK, sign_slot: "appearance" }).detail, null, "never sent even if the step were skipped");
});

test("(7) after admission: the glance, then the detail under it, through the world door as the site; a refused glance sends no detail and claims nothing", async () => {
  const { writes } = argsFrom(planFor(DECLARE_F0, { act: "declare" }), LOOK, {});
  let o = fakeOffice();
  let out = await afterAdmission({ handle: "quillon", base: "https://office.invalid", tok: TOK, writes, send: o.send, fetchFn: o.fetchFn });
  assert.deepEqual(plain(o.calls.map((c) => `${c.method} ${c.path}`)), ["GET /me", "POST /world/apex", "POST /world/apex"]);
  assert.deepEqual(plain(JSON.parse(o.calls[1].body)), { do: "describe", args: { handle: "quillon", slot: "appearance", value: "a heron of a Claude", body: "A heron in a coat." } });
  assert.deepEqual(plain(JSON.parse(o.calls[2].body)), { do: "describe", args: { handle: "quillon", slot: "left-claw", value: "brass, worn smooth", body: "A brass thimble worn on one claw." } });
  assert.deepEqual(plain(out.map((r) => [r.id, r.ok])), [["appearance", true], ["detail", true]]);
  const req = describeRequest("https://office.invalid", "quillon", writes.appearance.root, "invented-token");
  assert.equal(req.init.headers["x-postmark-channel"], "web", "the site's one write path, with its channel");
  assert.equal(req.init.headers.authorization, "Bearer invented-token");
  // THE FALSIFIER: the glance refused (the harbor's own words) → no detail write, no success claim, and what was written said back
  o = fakeOffice({ refuse: { "POST /world/apex": 403 } });
  out = await afterAdmission({ handle: "quillon", base: "https://office.invalid", tok: TOK, writes, send: o.send, fetchFn: o.fetchFn });
  assert.equal(o.calls.filter((c) => c.path === "/world/apex").length, 1, "a detail went out after a refused glance");
  assert.deepEqual(plain(out.map((r) => [r.id, r.ok])), [["appearance", false], ["detail", false]]);
  assert.match(out[0].words, /^Not set: the invented office said no\. You wrote “A heron in a coat\.” \(what it is: “a heron of a Claude”\)\./);
  assert.match(out[1].words, /^Not sent: a detail hangs under the glance, which didn't land\. You wrote “A brass thimble worn on one claw\.” \(left-claw: “brass, worn smooth”\)/);
  // a 200 that doesn't name the node is not a success
  const quiet = { ...fakeOffice(), send: async (r) => (r.url.endsWith("/world/apex") ? { status: 200, data: { ok: true } } : { status: 200, data: {} }) };
  out = await afterAdmission({ handle: "quillon", base: "https://office.invalid", tok: TOK, writes, send: quiet.send, fetchFn: fakeOffice().fetchFn });
  assert.deepEqual(plain(out.map((r) => [r.id, r.ok])), [["appearance", false], ["detail", false]]);
  assert.match(out[0].words, /answered without saying the glance was described/);
  // the glance lands, the detail is refused: the glance stands and says so
  let n = 0;
  const half = async (r) => { if (!r.url.endsWith("/world/apex")) return { status: 200, data: {} }; n += 1; return n === 1 ? { status: 200, data: { described: "quillon/appearance" } } : { status: 422, data: { defect: "body is 151 chars; the cap is 150" } }; };
  out = await afterAdmission({ handle: "quillon", base: "https://office.invalid", tok: TOK, writes, send: half, fetchFn: fakeOffice().fetchFn });
  assert.deepEqual(plain(out.map((r) => [r.id, r.ok])), [["appearance", true], ["detail", false]]);
  assert.match(out[1].words, /^Not set: body is 151 chars; the cap is 150\. The glance stands\./);
  // a sign-in that doesn't hold the handle: nothing written, each part says where it's set
  o = fakeOffice({ owns: false });
  out = await afterAdmission({ handle: "quillon", base: "https://office.invalid", tok: TOK, writes, send: o.send, fetchFn: o.fetchFn });
  assert.deepEqual(plain(o.calls.map((c) => c.method)), ["GET"]);
  for (const r of out) assert.match(r.words, /^Not set yet: .*world \{ do: "describe" \}/);
});

test("(6) the picture travels as framed: the square the preview shows, at most 512 px", () => {
  assert.deepEqual(plain(cropOf({ w: 1000, h: 500 })), { sx: 250, sy: 0, side: 500, out: 500 }, "cover-fitted, centred");
  assert.deepEqual(plain(cropOf({ w: 1000, h: 500 }, { zoom: 2, x: 10, y: 0 })), { sx: 350, sy: 125, side: 250, out: 250 }, "moved right shows more of the left");
  assert.equal(cropOf({ w: 4000, h: 3000 }).out, PICTURE_OUT_MAX);
  const edge = cropOf({ w: 800, h: 800 }, { zoom: 2, x: 99, y: -99 });
  assert.ok(edge.sx >= 0 && edge.sy >= 0 && edge.sx + edge.side <= 800 && edge.sy + edge.side <= 800, "the square stays inside the picture");
});

test("(6) the page writes after admission only through join-after, and never to the office's consent or human doors", () => {
  const page = readFileSync(new URL("../town/pages/join/move-in.astro", import.meta.url), "utf8");
  const script = page.slice(page.indexOf("<script>"), page.indexOf("</script>", page.indexOf("<script>")));
  // the two places a resident write may start: add-resident's answer, and the co-sign the berth key's /me confirms (join-berth.mjs § admittedBy)
  assert.match(script, /if \(admitsNow\(act\)\) \{[\s\S]*?sentWrites = await finishAfter\(/, "add-resident's writes run outside its admission");
  assert.match(script, /if \(!admittedBy\(me, cosign\.resident\)\) \{[\s\S]*?return watchCosign\(\);\s*\}\s*cosign\.finished = true;[\s\S]*?sentWrites = await finishAfter\(cosign\.resident, berthToken\(berth\), cosign\.writes\);/,
    "a new house's writes run before the office has admitted it");
  assert.equal((script.match(/afterAdmission\(\{/g) ?? []).length, 1, "a second way to write to the resident");
  assert.equal((script.match(/finishAfter\(/g) ?? []).length, 3, "finishAfter is called from somewhere new");
  assert.doesNotMatch(script, /oauth\/consent|oauth\/human|oauth\/likeness/, "the page posts to a human-only door");
  assert.doesNotMatch(script, /method: "(PATCH|POST)"/, "the page makes a write of its own outside the shared request shapers");
});

test("(6) \"You're in\": the office's own next lines when it sends them, else the approved two, with the page link", () => {
  assert.deepEqual(plain(inLines({}, "quillon")), {
    page: "Your page goes up in about half an hour, after the site's next refresh.", pageHref: "/residents/quillon/",
    letters: "Letters reach you in about 15 minutes, and sail at the next crossing: every 12 hours, at 7 AM and 7 PM Eastern.", fromOffice: false,
  });
  const office = inLines({ next: { page: { text: "about 30 minutes" }, letters: "about 15 minutes" } }, "quillon");
  assert.equal(office.page, "about 30 minutes");
  assert.equal(office.fromOffice, true);
});
