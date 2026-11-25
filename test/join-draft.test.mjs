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
  STEPS, CONCEPT, DROPPED, REGISTRAR, UNITS, planFor, argsFrom, countOf, countWords, lengthIn, limitOf, stepProblems, problemWords, allProblems,
  admitsNow, cosignRoad, kickerOf, stepOfHash, hashOfStep, inLines, hexOf,
} from "../src/lib/join-draft.mjs";
import { afterAdmission, cropOf, PICTURE_OUT_MAX } from "../src/lib/join-after.mjs";

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
  assert.deepEqual(REGISTRAR.gate.find((p) => Array.isArray(p)), ["the Registrar", "/residents/registrar/"]);
  // she says where the human's own part went, on step 1, before Send and when the link is handed over: the handoff is legible
  for (const k of ["household", "reviewCosign", "cosign"]) assert.match(REGISTRAR[k].join(" "), /co-sign page/, `${k} doesn't say the office's co-sign page asks the human's part`);
  assert.match(REGISTRAR.household.join(" "), /profile.*short videos|short videos.*profile/);
  const plan = planFor(DECLARE_F22, { act: "declare" });
  assert.equal(kickerOf(plan, "describe"), "Step 3 of 5 · Describe yourself");
  assert.equal(stepOfHash(hashOfStep("found"), plan), "found");
  assert.equal(stepOfHash("#review", plan), "review");
  assert.equal(stepOfHash("#step-99", plan), null);
});

test("(1) the join's blank page IS the resident page's own pieces, inside .rpage hosts, with no copy of their markup or rules", () => {
  // Darko, 2026-11-25: "changing it in the future means the join flow version gets changed too". CAN FAIL: paste the bubble's markup or
  // its rules into the join, or draw the page from a replica (the mockup's rp-* classes).
  const page = readFileSync(new URL("../town/pages/join/move-in.astro", import.meta.url), "utf8");
  for (const c of ["ResidentFace", "AddressCardFace", "ResidentField", "ProfileEditorFields"])
    assert.match(page, new RegExp(`^import ${c} from "@/components/resident/${c}\\.astro";$`, "m"), `the join no longer draws ${c}`);
  assert.match(page, /^import "@\/styles\/resident-page\.css";$/m);
  assert.match(page, /<div class="rpage jd-page" data-blank-page hidden>\s*<ResidentFace face=\{BLANK_FACE\} draft=\{GHOST\}>/);
  assert.match(page, /<AddressCardFace name="" draft=\{/);
  assert.match(page, /<ProfileEditorFields handle="join" piece fields=\{\["color", "color_name", "pronouns"\]\} \/>/);
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

test("(5) on an act that admits, profile fields the card lacks, the picture and the one sheet are AFTER; the appearance is HELD", () => {
  const { kept, writes } = argsFrom(planFor(DECLARE_F0, { act: "declare" }), EVERYTHING, { picture: true, references: 1 });
  const fate = Object.fromEntries(kept.map((k) => [k.id, k.fate]));
  for (const id of ["runtime", "bio", "color", "color_name", "pronouns", "picture", "references"]) assert.equal(fate[id], "after", id);
  for (const id of ["glance", "sign"]) assert.equal(fate[id], "held", id);
  assert.deepEqual(plain(writes), { profile: { runtime: "a slow-reading Claude", bio: "Tomatoes and letters.", color: "#7ea1ff", color_name: "harbour blue", pronouns: "he/him" }, picture: true, sheet: true });
  // the accepted card carries the profile itself, so nothing is left for the profile door
  assert.equal(argsFrom(planFor(DECLARE_F22, { act: "declare" }), EVERYTHING, {}).writes.profile, null);
  assert.ok(admitsNow("declare") && admitsNow("add-resident") && !admitsNow("begin"));
});

test("(5) a berth's begin writes nothing after: its human co-signs first, so every such piece is HELD and says so", () => {
  const { kept, writes } = argsFrom(planFor(BEGIN, { act: "begin" }), EVERYTHING, { picture: true, references: 1 });
  assert.deepEqual(plain(writes), { profile: null, picture: false, sheet: false });
  for (const k of kept.filter((x) => ["runtime", "picture", "references"].includes(x.id))) {
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
  assert.match(script, /if \(!admittedBy\(me, cosign\.slug\)\) \{[\s\S]*?return watchCosign\(\);\s*\}\s*cosign\.finished = true;[\s\S]*?sentWrites = await finishAfter\(cosign\.slug, berthToken\(berth\), cosign\.writes\);/,
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
