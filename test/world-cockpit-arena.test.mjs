// world-cockpit-arena.test.mjs — the falsifiers for the 2026-08-29 interaction
// rulings, made after a night of the founder actually playing the dungeon.
//
// FIVE RULINGS, IN HIS OWN WORDS WHERE THEY ARE SHORT ENOUGH TO QUOTE:
//
//   (1) targeting  — press the act, then the thing it can be aimed at lights up
//       and is clickable. The order it replaces — click the thing, get a menu of
//       every act — he called nonsensical.
//   (2) trims      — the claiming and note-taking seats are hidden in the
//       dungeon; the seat whose whole precondition is a phase appears only in
//       that phase.
//   (3) the fold   — "too many buttons".
//   (4) game-speak — "the 'terms' in the hover and click for the actions is NOT
//       helpful to a human … bare fields … re-write to be concise, and just give
//       info like it would in a game, not a debug panel."
//   (5) the sheet  — the crossing sheet dumps every field, vague and verbose.
//
// Plus (6), the walk grid, which is lane bday-law's dial read from this side.
//
// THE FIXTURES ARE THE LIVE DOOR'S SHAPES, not invented ones, and that is what
// makes these evidence. Every field name below was read off the office on
// 2026-08-29: the dial names out of `encounter.mjs` FLOOR (to_hit_die,
// damage_die, beats_ac, restores_to, halves_next_hit), the phases out of its
// PHASES (afoot, spent, wiped), `channel: "ground"` out of the ground builder in
// `world-apex.mjs`, and the arena field's own description verbatim out of the
// cards the apex answers.
//
// ⚠ THE ACT NAMES LIVE HERE, NOT IN THE MODULE UNDER TEST. world-cockpit.mjs is
// held to naming none of them (world-cockpit.test.mjs greps its source), and
// these tests are the other side of that: they hand the names IN, the way the
// mount does, and check the arithmetic did the right thing without knowing them.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  HUMAN_ACTOR, aimField, aimTargets, aimable, barFold, barSlots, blockedReason,
  aimKind, cardOf, combatantBars, consentSplit, dialSpeak, encounterOf, fighterState, leavingName, looseThings, pointFields,
  prefillFor, snapPoint, termsRows, walkStep, weaponFor,
} from "../src/lib/world-cockpit.mjs";

const MOUNT = readFileSync(fileURLToPath(new URL("../src/lib/world-cockpit-mount.mjs", import.meta.url)), "utf8");

// ── the door's own shapes ───────────────────────────────────────────────────

/** The arena's shared field, verbatim from the apex's cards. Both halves of the
 *  sentence matter: it says the value is what the act is AIMED AT, which is what
 *  tells an aim field from a place field. */
const AIMED = {
  type: "string",
  description: "who or what this act is aimed at — a handle for one, a mark id for another. Some of these acts find the adversary standing on this ground themselves.",
};
/** The attaching acts' field, verbatim. */
const THING = { type: "string", description: "the thing's mark id, <by>/<slug>", required: true };
/** A place field — the sentence GROUND_SHAPED reads. */
const OUT_OF = { type: "string", description: "which mark to step out of — omit for the innermost one you are within" };
/** A minted name, not a pointer at something that exists. */
const SLUG = { type: "string", description: "the mark's leaf name — kebab-case, unique among your own marks", required: true };

const entry = (action, o = {}) => ({
  action, blurb: o.blurb ?? null, blurb_from: `the-town/${action}`,
  from: o.from ?? "the-town/resident", class: o.class ?? "resident",
  fields: o.fields ?? {}, via: o.via ?? "ambient", channel: o.channel ?? "ambient",
  grant: o.grant ?? "yours", ...(o.dials ? { dials: o.dials } : {}),
});

/** A ground act — the channel the office opens the room's own verbs on. */
const ground = (action, o = {}) => entry(action, { ...o, channel: "ground", via: "within", grant: "here", from: "the-town/portal-ground" });

const VAULT = {
  standpoint: { x: 1083, y: -792, stance: "embodied-human", portal: { id: "the-town/the-candle-vault", value: "the-town/the-candle-vault", space: "arena" } },
  within: [{ id: "the-town/the-candle-vault", by: "the-town" }],
  nearby: [
    { id: "the-town/the-unlit-cake", at: { x: 1097, y: -783.5 }, kind: "sited" },
    { id: "vermillion/the-long-knife", at: { x: 1092, y: -786 }, kind: "sited", loose: true, dropped_by: "vermillion" },
  ],
  actions: [
    entry("say", { fields: { text: { type: "string", description: "what you say, at most 500 characters" } } }),
    entry("walk", { fields: { mark_id: { type: "string", description: "walk to this mark's ground" } } }),
    entry("exit", { fields: { mark: OUT_OF } }),
    entry("take", { fields: { thing: THING } }),
    entry("leave-mark", { fields: { slug: SLUG, body: { type: "string", description: "one present-tense observation; maximum 150 characters" } } }),
    entry("note-to-self", { fields: { body: { type: "string", description: "the complete replacement note, maximum 2000 characters", required: true } } }),
    ground("swing", { fields: { object: AIMED }, dials: { to_hit_die: 20, damage_die: 8, beats_ac: 12 } }),
    // A SECOND ACT THAT DEALS DAMAGE, and it is in the fixture for one reason:
    // only one of the room's damaging acts is helped by what you are holding, so
    // a weapon clause attached to both would be a claim about this one that the
    // record does not make. Without a second, that could not be falsified.
    ground("hurl", { fields: { object: AIMED }, dials: { to_hit_die: 20, damage_die: 10, beats_ac: 11 } }),
    ground("brace", { fields: { object: AIMED }, dials: { halves_next_hit: true } }),
    ground("raise", { fields: { object: AIMED }, dials: { restores_to: 8 } }),
    ground("gather", { fields: { object: AIMED } }),
  ],
  encounter: {
    id: "the-town/the-candle-vault", round: 3, turn: "keeminlee",
    order: [
      { id: "the-town/the-unlit-cake", kind: "creature", label: "the unlit cake", initiative: 19 },
      { id: "keeminlee", kind: "human", label: "DARKO", initiative: 12, hp: { now: 16, max: 20 }, you: true },
      { id: "vermillion", kind: "resident", label: "vermillion", initiative: 11, down: true, hp: { now: 0, max: 20 } },
    ],
  },
  encounter_detail: {
    phase: "afoot", live: true, space: "arena",
    adversary: { id: "the-town/the-unlit-cake", hp: 41, of: 60, body: "Nine tiers, four hundred candles, not one ever lit." },
  },
};

const slotFor = (answer, action) => {
  const bar = barSlots(answer, { acting: "keeminlee" });
  return [...bar.fixed, ...bar.tray].find((s) => s.action === action);
};
const cardFor = (answer, action) => slotFor(answer, action)?.card ?? null;

// ══ (1) VERB-FIRST TARGETING ════════════════════════════════════════════════

test("an act is aimable because of the sentence the door wrote under its field", () => {
  // THE LAW, quoted: the arena's field says the value is "who or what this act
  // is aimed at". That sentence — and not the act's name — is what arms.
  const aimed = aimField(cardFor(VAULT, "swing"));
  assert.equal(aimed?.name, "object", "an act aimed at something has an aim field");
  assert.equal(aimField(cardFor(VAULT, "take"))?.name, "thing",
    "and so does one that names a thing's mark id — that is how a floor item is picked up");

  // A PLACE IS NOT A TARGET, which is the distinction prefillFor already draws
  // and this one inherits. Stepping out of somewhere aims at nothing.
  assert.equal(aimField(cardFor(VAULT, "exit")), null, "a place field arms nothing");
  assert.equal(aimField(cardFor(VAULT, "walk")), null, "and neither does walking to somewhere");
  // A NAME BEING MINTED IS NOT A POINTER AT SOMETHING THAT EXISTS.
  assert.equal(aimField(cardFor(VAULT, "leave-mark")), null, "a slug is a name you are inventing, not a thing you are aiming at");
  // and an act whose only field is prose is a sentence, not a shot
  assert.equal(aimField(cardFor(VAULT, "say")), null, "speech aims at nothing");
});

// ══ THE INJECTED FLOOR ENTRY (office bday-law2 1227b429, 2026-08-29) ═════════
//
// THE BUG UNDER THIS, and it is the reason the shape exists. `nearby` is a
// salience ranking under a context budget, and salience ranks by how much of a
// thing there is to see — so a 0.2 m lighter loses to every house, ground and
// cake in the district. Measured by the office: a spectator standing EXACTLY ON
// the good lighter got thirteen nearby entries and the lighter was not one of
// them. The `loose:` marking shipped the night before was correct and reached
// NOTHING, because there was no row in the list to mark.
//
// So floor things are now INJECTED into `nearby` rather than only marked, and
// an injected entry is a THINNER SHAPE than a ranked one: no `label`, and no
// `bearing` (a convention that belongs to the engine's field of view — the
// office declined to invent a parallel one, and this side must not derive one
// either). `via: "floor"` is what tells the two apart.
//
// ⚑ THIS FIXTURE IS THE THIN SHAPE ON PURPOSE. Every other fixture in this file
// builds a comfortable row with a label on it, which is exactly the habit that
// let the original bug live: a falsifier must not supply the input whose
// absence is the defect. What is pinned here is that the cockpit reads only
// fields an injected entry actually carries.
const INJECTED = {
  id: "the-town/the-good-lighter", by: "the-town",
  at: { x: 1095.5, y: -784 }, extent: { w: 0.2, h: 0.2 },
  kind: "sited", tier: "market",
  body: "A lighter that has never once gone out on the way over.",
  loose: true, distance_m: 1.4, via: "floor",
};

test("a floor entry the door injected carries no label and no bearing, and still draws", () => {
  const dropped = {
    ...INJECTED, id: "vermillion/the-long-knife", by: "vermillion",
    at: { x: 1092, y: -786 }, dropped_by: "vermillion", dropped_at_seq: 41,
  };
  const answer = { ...VAULT, nearby: [INJECTED, dropped] };

  const things = looseThings(answer);
  assert.deepEqual(things.map((t) => t.id),
    ["the-town/the-good-lighter", "vermillion/the-long-knife"], "both are on the floor");
  // THE NAME IS DESLUGGED FROM THE ID, because an injected entry has no `label`
  // — the same one-writer every id in this world is read by.
  assert.deepEqual(things.map((t) => t.label), ["the good lighter", "the long knife"]);
  assert.equal(things[0].dropped_by, null, "a thing that was simply lying there fell from nobody");
  assert.equal(things[1].dropped_by, "vermillion", "and one that fell in the fight says whose it was");
  // placed off `at`, which is the field the office named as the placement one
  assert.deepEqual(things[0].at, { x: 1095.5, y: -784 });

  // ⚑ NOTHING HERE READS `bearing`, which is the risk the office flagged: a
  // reader that sorted or grouped on it would drop every injected entry
  // silently. Asserted over the SOURCE rather than over behaviour, because a
  // behavioural test cannot see a field nobody happens to have used yet.
  const src = readFileSync(fileURLToPath(new URL("../src/lib/world-cockpit.mjs", import.meta.url)), "utf8")
    + readFileSync(fileURLToPath(new URL("../src/lib/world-cockpit-mount.mjs", import.meta.url)), "utf8");
  assert.doesNotMatch(src, /\.bearing\b/, "the cockpit reads no bearing off a nearby entry");
  assert.doesNotMatch(src, /nearby[^;\n]*\.sort\(/, "and never orders the list it was handed");
});

test("an injected floor thing is aimable, and the shroud's absence is simply absence", () => {
  const answer = { ...VAULT, nearby: [INJECTED] };
  assert.ok(aimTargets(answer).some((t) => t.value === INJECTED.id && t.at),
    "a thing the door put on the floor can be aimed at where it lies");
  // AND THE HELD-BACK CASE IS NOT A FLAG TO READ. The office filters shrouded
  // loot before injecting, so a prize that is not yet the party's is simply not
  // in the list — there is nothing here to hide, which is why this side needs no
  // code for it and gets none.
  const afoot = { ...VAULT, nearby: [] };
  assert.deepEqual(looseThings(afoot), [], "nothing on the floor is nothing drawn");
  assert.ok(!aimTargets(afoot).some((t) => t.value === INJECTED.id));
});

test("the targets are the answer's own, and an unplaced one is still a target", () => {
  const targets = aimTargets(VAULT);
  assert.deepEqual(targets.map((t) => t.value),
    ["the-town/the-unlit-cake", "vermillion", "vermillion/the-long-knife"],
    "what stands against you, who is down beside you, what is on the floor — the door's three lists, in reading order");

  // the adversary and the loose thing are placed off `nearby`
  assert.deepEqual(targets[0].at, { x: 1097, y: -783.5 }, "the adversary is placed where nearby put it");
  assert.deepEqual(targets[2].at, { x: 1092, y: -786 }, "and so is the thing on the floor");

  // ⚑ THE DOWNED ALLY IS THE CASE THAT MATTERS. `nearby` is a budgeted field of
  // view, so someone genuinely down can carry no coordinate on a given read —
  // and dropping them would make the act that lifts them unreachable at exactly
  // the moment it is needed. They keep their row with a null position, and the
  // strip offers them by name.
  assert.equal(targets[1].at, null, "a target the answer cannot place is kept, unplaced");
  assert.match(targets[1].why, /down/, "and says why it is a target at all");
});

test("nothing arms where the answer names nothing to aim at", () => {
  // The flip: same card, no encounter, no loose thing. The seat goes back to
  // being a panel with no edit anywhere — which is the whole point of deciding
  // this off the answer rather than off a list of fight verbs.
  const quiet = { ...VAULT, nearby: [], encounter: undefined, encounter_detail: undefined };
  assert.equal(aimTargets(quiet).length, 0, "no candidates");
  assert.equal(aimable(slotFor(quiet, "swing"), quiet), false, "so an aimable-shaped act does not arm");
  assert.equal(aimable(slotFor(VAULT, "swing"), VAULT), true, "and does arm where there is something to aim at");
});

// ══ (2) THE TRIMS ═══════════════════════════════════════════════════════════

test("the claiming and note seats are hidden in the dungeon, and nothing else is", () => {
  // UI HIDING ONLY — the acts are untouched and the door still affords them.
  const bare = barFold(barSlots(VAULT, { acting: "keeminlee" }), { keep: ["walk", "say", "exit"] });
  assert.ok([...bare.shown, ...bare.folded].some((s) => s.action === "leave-mark"),
    "with no hide list the seat is there");

  const trimmed = barFold(barSlots(VAULT, { acting: "keeminlee" }), {
    keep: ["walk", "say", "exit"], hide: ["leave-mark", "note-to-self"],
  });
  const names = [...trimmed.shown, ...trimmed.folded].map((s) => s.action);
  assert.ok(!names.includes("leave-mark"), "hidden where the ruling hides it");
  assert.ok(!names.includes("note-to-self"), "both of them");
  assert.ok(names.includes("give") && names.includes("take"),
    "and give/take are explicitly kept — the ruling names only two");
});

test("the phase-gated seat appears in its phase and not before", () => {
  // THE DOOR'S OWN WORDS for why, read off the office 2026-08-29: "Take what is
  // left when the encounter is spent. Refused while anything is still standing —
  // the … verb's own precondition is the phase."
  const gate = { gather: "spent" };
  const keep = ["walk", "say", "exit"];

  const afoot = barFold(barSlots(VAULT, { acting: "keeminlee" }), { keep, gate, phase: "afoot" });
  assert.ok(![...afoot.shown, ...afoot.folded].some((s) => s.action === "gather"),
    "while anything is still standing the seat is not rendered");

  const spent = barFold(barSlots(VAULT, { acting: "keeminlee" }), { keep, gate, phase: "spent" });
  assert.ok(spent.shown.some((s) => s.action === "gather"),
    "and it arrives with the phase that is its whole precondition");

  // the flip that proves the gate is about THIS act and not about phases in
  // general: an ungated ground act is present in both phases
  for (const p of ["afoot", "spent", "wiped", null]) {
    const b = barFold(barSlots(VAULT, { acting: "keeminlee" }), { keep, gate, phase: p });
    assert.ok(b.shown.some((s) => s.action === "swing"), `an ungated act is unaffected at phase ${p}`);
  }
});

// ══ (3) THE FOLD ════════════════════════════════════════════════════════════

test("the room's acts hold the row and what you carry everywhere folds", () => {
  const fold = barFold(barSlots(VAULT, { acting: "keeminlee" }), {
    keep: ["walk", "say", "exit"], hide: ["leave-mark", "note-to-self"],
    gate: { gather: "spent" }, phase: "afoot",
  });
  assert.deepEqual(fold.shown.map((s) => s.action),
    ["walk", "say", "exit", "swing", "hurl", "brace", "raise"],
    "the ambient ones the caller kept, then everything the ground itself granted");
  assert.deepEqual(fold.folded.map((s) => s.action), ["give", "take"],
    "and what travels with you is one press away");

  // WHAT DECIDES IT IS THE DOOR'S CHANNEL, not a list of fight verbs. The flip:
  // move an act onto the ground's channel and it moves onto the row, with no
  // edit to any list anywhere.
  const promoted = {
    ...VAULT,
    actions: VAULT.actions.map((e) => (e.action === "take" ? { ...e, channel: "ground" } : e)),
  };
  const after = barFold(barSlots(promoted, { acting: "keeminlee" }), { keep: ["walk", "say", "exit"] });
  assert.ok(after.shown.some((s) => s.action === "take"),
    "an act the ground grants holds a seat, whatever it is called");
  assert.ok(fold.folded.some((s) => s.action === "take"),
    "and the same act folds on the read where the door did not open it on that channel");
});

test("a bar with no ground acts and no keep list folds everything, which is the honest default", () => {
  const town = { standpoint: { x: 0, y: 0 }, actions: [entry("say", {}), entry("walk", {})], actors: [{ kind: "resident", handle: "wright", allowed: true }] };
  const fold = barFold(barSlots(town), {});
  assert.equal(fold.shown.length, 0, "nothing is on the row when nothing is the ground's and nothing was kept");
  assert.equal(fold.folded.length, barSlots(town).fixed.length + barSlots(town).tray.length,
    "and every seat is accounted for — the fold drops nothing it was not told to hide");
});

// ══ THE ONE ACT FLOW (founder's governing ruling, 2026-08-29) ═══════════════
//
//   "Every button that NEEDS a target selection lets you click button → click
//    target. Every button that DOESN'T (guard, exit) just needs you click
//    button. In both cases, the next step IS the right side panel popup that
//    has the WHO, the FROM, and the TO (FROM only if appropriate, so for walk),
//    and the CONFIRM button to actually do the action."

test("how an act is aimed is read off the card, in three shapes", () => {
  // A THING: the door's field says the value is who or what it is aimed at.
  assert.equal(aimKind(cardFor(VAULT, "swing")), "thing");
  // A POINT: two numbers the door describes as grid metres. That is walking,
  // recognised without this file holding the word.
  const walk = cardOf(entry("walk", { fields: {
    mark_id: { type: "string", description: "walk to this mark's ground" },
    to_x: { type: "number", description: "grid meters east of Ferry's crossing" },
    to_y: { type: "number", description: "grid meters south of Ferry's crossing" },
  } }));
  assert.equal(aimKind(walk), "point");
  assert.deepEqual(pointFields(walk), { x: "to_x", y: "to_y" });
  // NOTHING: a crossing out aims at no one, so it goes straight to the panel.
  assert.equal(aimKind(cardFor(VAULT, "exit")), "none");
  // and one number is not a point — an act that takes a single quantity is a
  // form, not a place on the ground
  assert.equal(pointFields(cardOf(entry("stake", { fields: {
    stamps: { type: "number", description: "how many stamps, east of nothing" },
  } }))), null);
});

test("the room an exit leaves is the ENTERED one, and it is shown and never sent", () => {
  // ⚑ THE RECEIPT THIS PROTECTS. The founder: exit "still requires you to select
  // a slug that you're exiting... which is very strange considering you have ONE
  // option." The obvious fix — fill the field in — was tried live on 2026-08-29
  // and the door REFUSED it: "rei is not within 'the-town/the-candle-vault' —
  // there is nothing to step out of", from a standpoint whose own portal IS that
  // vault. The door's `within` for stepping back out is the entry it holds, not
  // the extent you are standing inside.
  //
  // ⚑ AND THE SOURCE MOVED, WHICH IS THE BUG BENEATH ALL OF THAT. This read the
  // containment chain's innermost entry and the founder's live card said FROM
  // "the unlit cake" — a CREATURE he happened to be standing inside the
  // footprint of. `standpoint.portal` is the door's own word for what you have
  // ENTERED; `within` is geometry. Same disease the mark chip had, same cure,
  // and `within` is left alone because the exit-prefill work reads it AS the
  // containment chain and the two must not be conflated.
  const leaving = leavingName(VAULT);
  assert.equal(leaving.id, "the-town/the-candle-vault");
  assert.equal(leaving.label, "the candle vault", "deslugged the one way every id here is read");
  assert.equal(leavingName({ standpoint: {} }), null, "a standpoint that entered nothing names nothing");
  // ⚑ THE CAN-FAIL CONTROL, and it is the founder's own screenshot as a fixture:
  // a standpoint whose innermost CONTAINING mark is not the room it entered.
  const inTheCake = {
    ...VAULT,
    within: [...(VAULT.within ?? []), { id: "the-town/the-unlit-cake" }],
  };
  assert.equal(inTheCake.within[inTheCake.within.length - 1].id, "the-town/the-unlit-cake",
    "containment's innermost really is the creature here — without this the line below proves nothing");
  assert.equal(leavingName(inTheCake).id, "the-town/the-candle-vault",
    "…and the card still offers to leave the room, not the cake standing in it");
  // the panel prints it; `prefillFor` still refuses to fill a place field
  assert.deepEqual(prefillFor(cardFor(VAULT, "exit"), VAULT), {},
    "the field itself stays empty — that is the receipt, not an oversight");
  // ⚑ AND IT IS A SENTENCE NOW, NOT A FROM/TO PAIR. The pair read "from the
  // unlit cake, to back out" — the founder: "random text that makes no sense".
  // "back out" was never a place; it was the same single fact as FROM, printed
  // twice, once as a direction.
  assert.match(MOUNT, /const line = leaving \? `step out of <b>\$\{esc\(leaving\.label\)\}<\/b>` : "";/,
    "one plain line saying what the act does");
  assert.doesNotMatch(MOUNT, /"back out"/, "and no direction masquerading as a destination");
});

test("a target is taken into the panel, not sent at the door", () => {
  assert.match(MOUNT, /function takeAim\(args, label\) \{/);
  assert.match(MOUNT, /state\.act = \{ action, args, label \};/, "held for the confirm");
  assert.match(MOUNT, /state\.open = action;/, "and the panel is what opens");
  assert.doesNotMatch(MOUNT, /function sendAim\(/, "the dispatch-on-click path is gone");
  // and the confirm carries what the target contributed, with typed fields
  // winning where a reader edited the box in front of them
  // (CORE-82: the same merge, now handed through withReplyTarget, which adds reply_to only for a chosen target on a card that declares it)
  assert.match(MOUNT, /const whole = withReplyTarget\(\{ \.\.\.\(aimed \?\? \{\}\), \.\.\.args \}, slotFor\(action\)\?\.card, state\.replyTo\);/,
    "the target's fields ride along with whatever was typed");
});

test("a self-directed act never opens a crosshair, and the site says so out loud", () => {
  // ⚑ THE CARD CANNOT TELL US. The office hands all five arena verbs the SAME
  // field object, so guarding and striking are identical on the wire — the
  // field's description even names which acts find their own target, in prose,
  // inside a field shared by the ones that do not. So this is a NAME, in the
  // drawer where the other name-keyed rulings live, and it carries the same
  // debt: a field of its own on the office side deletes this list.
  // ⚑ `exit` JOINED THE LIST (founder, 2026-08-29). Its one field is the room to
  // step out of, its own description says to omit it, and there is exactly one
  // room you can be leaving — so the panel was asking a question with a single
  // answer that it was then forbidden to send. Being flow-shaped is what stops
  // the optional field being drawn, which is the whole of "exit takes no input".
  assert.match(MOUNT, /const SELF_DIRECTED = \["guard", "loot", "pass", "exit"\];/);
  assert.match(MOUNT, /const kind = SELF_DIRECTED\.includes\(action\) \? "none" : aimKind\(s\.card\);/,
    "the name overrides the card's shape, and only in that direction");
  // the card really does look aimable, which is why the override is needed —
  // if this ever fails, the office has given it its own field and the list goes
  assert.equal(aimKind(cardFor(VAULT, "brace")), "thing",
    "the shared arena field still reads as thing-aimed, which is the whole reason for the list");
});

test("the panel does not ask again for what the flow already answered", () => {
  // Seen in the shot the moment the flow worked: a clean WHO/FROM/TO and then
  // three empty boxes asking the question the reader had just answered on the
  // map — the form language the founder has objected to twice.
  assert.match(MOUNT, /const answered = state\.act\?\.action === action \? Object\.keys\(state\.act\.args \?\? \{\}\) : \[\];/);
  // (CORE-82: the same two arms, read through formFieldsOf, which only drops the raw reply_to a person never types)
  assert.match(MOUNT, /const asked = flowShaped\r?\n\s*\? formFieldsOf\(c\)\.filter\(\(f\) => f\.required && !answered\.includes\(f\.name\) && filled\[f\.name\] == null\)\r?\n\s*: formFieldsOf\(c\);/,
    "a flow-shaped act asks only for what the door requires and the flow did not fill");
  // AN ORDINARY FORM ACT IS UNTOUCHED — outside the fight there are acts whose
  // whole substance is typed, and for those the form IS the act.
  assert.match(MOUNT, /: formFieldsOf\(c\);/, "a non-flow act still gets every field (CORE-82: bar the raw reply_to, which the chosen target drives)");
});

// ══ (2b) WHAT THE WHEEL ACTUALLY GATES (addendum, 2026-08-29) ═══════════════
//
// THE FINDING IS THE OFFICE'S, and it is worth stating because it reverses who
// was at fault. The `do:` gate NEVER held walk or say: the office refuses
// anything that is not one of the ground's arena verbs before the wheel is
// consulted at all, so a walk mid-fight has always gone through. What froze the
// founder during the party was THIS SURFACE — it saw `acting_blocked`, read it
// as "you may not act", and cooled every seat including the ones the door would
// have honoured. `gates` is the door naming the acts it means.

/** The door's own narrowing, in the office's shape (world-apex.mjs actingBlocked,
 *  branch bday-law 883e77d): a reason, the acts it is about, and a hint. */
const GATED = (gates) => ({
  ...VAULT,
  standpoint: {
    ...VAULT.standpoint,
    acting_blocked: {
      reason: "it is the unlit cake's turn",
      ...(gates ? { gates } : {}),
      hint: "the wheel gates this ground's ARENA verbs while an encounter is live — yours comes round.",
    },
  },
});

test("a narrowed refusal cools exactly the acts the door named", () => {
  const answer = GATED(["swing", "brace", "raise", "gather"]);
  const bar = barSlots(answer, { acting: "keeminlee" });
  const seat = (a) => [...bar.fixed, ...bar.tray].find((s) => s.action === a);

  // the ones the door named are cold, and each says the door's own reason
  for (const a of ["swing", "brace", "raise", "gather"]) {
    assert.equal(seat(a).enabled, false, `${a} waits for the wheel`);
    assert.equal(seat(a).blocked, "it is the unlit cake's turn", `${a} says why, in the door's words`);
  }
  // ⚑ AND EVERYTHING ELSE STAYS LIVE. This is the whole addendum: the founder
  // could not walk out of a room whose door would have let him walk the entire
  // time, because the page had greyed the seat.
  for (const a of ["walk", "say", "exit", "take"]) {
    assert.equal(seat(a).enabled, true, `${a} is not the wheel's business`);
    assert.equal(seat(a).blocked, null, `${a} is not told it is refused`);
  }
});

test("a refusal with no list narrows nothing, exactly as before the field existed", () => {
  // THE FLIP, and it is the one that matters: the change must be invisible
  // against a door that has not grown the field, and must never quietly un-gate
  // a fight. Same reason, no `gates`.
  const bar = barSlots(GATED(null), { acting: "keeminlee" });
  const afforded = [...bar.fixed, ...bar.tray].filter((s) => s.afforded);
  assert.ok(afforded.length > 0);
  assert.ok(afforded.every((s) => s.enabled === false), "every afforded seat cools");
  assert.equal(blockedReason(GATED(null)).gates, null, "because the door narrowed nothing");
  // an empty list is not a narrowing either — it is a door saying nothing
  assert.equal(blockedReason(GATED([])).gates, null);
  assert.ok(barSlots(GATED([]), { acting: "keeminlee" }).fixed
    .filter((s) => s.afforded).every((s) => s.enabled === false));
});

test("the derived block narrows nothing, and says so by omission", () => {
  // Which acts a wheel gates is the ground's own law, and this file has no verb
  // list to name them with. So a derivation says only what it can honestly say.
  const derived = blockedReason({
    ...VAULT,
    encounter: { ...VAULT.encounter, turn: "the-town/the-unlit-cake" },
  }, { acting: "keeminlee" });
  if (derived) {
    assert.equal(derived.from, "derived");
    assert.equal(derived.gates, null, "a derivation does not invent a list it cannot read");
  }
});

test("the gate line names what is waiting, in the seats' own words", () => {
  assert.match(MOUNT, /function gateWords\(blocked, shown, folded\) \{/,
    "the line above the bar is built rather than printed raw");
  assert.match(MOUNT, /if \(!blocked\?\.gates\?\.length\) return blocked\.reason;/,
    "and where the door narrowed nothing it is exactly the sentence it always was");
  assert.match(MOUNT, /\$\{blocked\.reason\} — \$\{cold\.join\(", "\)\} wait for it/,
    "where it did, the cold seats are named — so the line cannot read as a flat refusal over a live row");
});

// ══ (3b) WHAT YOU ARE HOLDING (addendum, 2026-08-29) ════════════════════════

/** The office's own weapon shape, carried out to a caller. `weaponInHand`
 *  already answers {thing, bonus, says}; `hands[who].weapon` is that answer
 *  reaching the door (office lane bday-law, in flight at the time of writing). */
const HOLDING = (weapon, who = "keeminlee") => ({
  ...VAULT,
  encounter_detail: {
    ...VAULT.encounter_detail,
    hands: { [who]: { hp: 16, of: 20, downed: false, guarding: false, gone: false, ...(weapon ? { weapon } : {}) } },
  },
});

test("the weapon completes the founder's own sentence, on the act it helps", () => {
  // HIS EXAMPLE, verbatim in shape: "Strike — d20 vs 12 to hit · d8 damage ·
  // +3 with the good-lighter". The first two thirds are the class's dials; the
  // third is what THIS hand happens to be carrying today.
  const answer = HOLDING({ thing: "the-town/the-good-lighter", bonus: 3, augments: "swing" });
  assert.equal(dialSpeak(cardFor(answer, "swing"), { weapon: weaponFor(answer, "keeminlee") }),
    "d20 vs 12 to hit · d8 damage · +3 with the good lighter",
    "deslugged by the same one-writer every id in this world is read by");

  // ⚑ AND ONLY ON THE ACT IT HELPS. Two of the room's acts state damage and only
  // one is helped by what you are holding; attaching it to both would be a claim
  // about the second that the record does not make.
  assert.equal(dialSpeak(cardFor(answer, "hurl"), { weapon: weaponFor(answer, "keeminlee") }),
    "d20 vs 11 to hit · d10 damage", "the other damage act claims no help it was not given");
  assert.equal(dialSpeak(cardFor(answer, "brace"), { weapon: weaponFor(answer, "keeminlee") }),
    "halves the next hit");
});

test("no weapon, no clause — and a hand that is not yours is not read", () => {
  // absent field → today's sentence, unchanged
  assert.equal(weaponFor(VAULT, "keeminlee"), null, "a door that sends no hands says nothing");
  assert.equal(weaponFor(HOLDING(null), "keeminlee"), null, "nor one whose hand carries no weapon");
  assert.equal(dialSpeak(cardFor(VAULT, "swing"), { weapon: weaponFor(VAULT, "keeminlee") }),
    "d20 vs 12 to hit · d8 damage", "so the sentence is the two thirds the class states");

  // a bonus of zero is not a fact worth a word
  assert.equal(weaponFor(HOLDING({ thing: "the-town/a-stick", bonus: 0, augments: "swing" }), "keeminlee"), null);
  // somebody else's hand is somebody else's
  assert.equal(weaponFor(HOLDING({ thing: "x/y", bonus: 2 }, "vermillion"), "keeminlee"), null);
  // acting as the household's human reads the HUMAN's row, found by kind
  const asHuman = HOLDING({ thing: "the-town/the-good-lighter", bonus: 3, augments: "swing" }, "keeminlee");
  assert.equal(weaponFor(asHuman, HUMAN_ACTOR)?.bonus, 3,
    "the human's hand is the one on the wheel under their own kind");
});

test("the weapon's own words are rendered, and they are the record's", () => {
  // `says` is the half of the hover with a voice in it: the dials are
  // arithmetic and the blurb is a class speaking about acts in general, while
  // this is the thing in your hand speaking about itself. The lighter's, from
  // the record: "a flame that has never once gone out on the way over".
  const w = weaponFor(HOLDING({
    thing: "the-town/the-good-lighter", bonus: 3, augments: "swing",
    says: "a flame that has never once gone out on the way over",
  }), "keeminlee");
  assert.equal(w.says, "a flame that has never once gone out on the way over", "quoted, never paraphrased");
  // absent where the record kept none — this surface writes no flavour of its own
  assert.equal(weaponFor(HOLDING({ thing: "x/y", bonus: 1, augments: "swing" }), "keeminlee").says, null);
  // it rides the card, under the blurb, and only for the act it belongs to
  assert.match(MOUNT, /const voice = w\?\.says && w\.for === card\.action/,
    "a weapon's words appear on the act it helps and nowhere else");
});

test("which act a weapon helps is the door's word, and the site's stopgap is gone", () => {
  // ⚑ THE STOPGAP IS DELETED, NOT DEMOTED TO A FALLBACK, and that is the
  // assertion worth having. The act-word is the record's, read off the held
  // grant's own entry rather than hardcoded. A weapon whose grant names NO act
  // must show no clause at all: "the record did not say" and "the site guessed"
  // must not look the same on this surface.
  const noFor = HOLDING({ thing: "the-town/the-good-lighter", bonus: 3 });
  assert.equal(weaponFor(noFor, "keeminlee").for, null,
    "the arithmetic does not guess which act — it reports that the door did not say");
  assert.equal(dialSpeak(cardFor(noFor, "swing"), { weapon: weaponFor(noFor, "keeminlee") }),
    "d20 vs 12 to hit · d8 damage", "and with no act named, no act claims it");
  assert.doesNotMatch(MOUNT, /WEAPON_HELPS = "/, "no name of ours answers that question any more");
  assert.match(MOUNT, /return weaponFor\(state\.answer, state\.acting\);/,
    "the mount passes the door's answer through untouched");

  // ── THE RULED NAME IS `augments` (Wright with bday-law, 2026-08-29) ──
  // `for` was a homonym: in the grants vocabulary it means the ACTOR KIND, and
  // the office reads this very value off an entry carrying that other sense.
  const ruled = HOLDING({ thing: "the-town/the-good-lighter", bonus: 3, augments: "swing" });
  assert.equal(weaponFor(ruled, "keeminlee").for, "swing", "the ruled name is what the site reads");
  assert.equal(dialSpeak(cardFor(ruled, "swing"), { weapon: weaponFor(ruled, "keeminlee") }),
    "d20 vs 12 to hit · d8 damage · +3 with the good lighter");

  // ⚑ AND THE SUPERSEDED SPELLING IS NO LONGER READ. `for` was the name for one
  // office commit; the site read both for one commit of its own so the rename
  // needed no choreography, and then dropped the second reading once the office
  // pushed (cf50015 emits `augments` and no `for` at all, checked rather than
  // assumed). This is the assertion that keeps the old name from growing back:
  // a compatibility branch kept past the thing it was compatible with is how a
  // codebase forgets which spelling is real.
  const oldName = HOLDING({ thing: "the-town/the-good-lighter", bonus: 3, for: "swing" });
  assert.equal(weaponFor(oldName, "keeminlee").for, null, "the homonym is not a spelling this site knows");
  assert.equal(dialSpeak(cardFor(oldName, "swing"), { weapon: weaponFor(oldName, "keeminlee") }),
    "d20 vs 12 to hit · d8 damage", "so it attaches no bonus to any act");
  // even beside the ruled name, the old one contributes nothing
  const both = HOLDING({ thing: "x/y", bonus: 1, for: "hurl", augments: "swing" });
  assert.equal(weaponFor(both, "keeminlee").for, "swing", "the ruled name is the only one read");
  assert.match(
    readFileSync(fileURLToPath(new URL("../src/lib/world-cockpit.mjs", import.meta.url)), "utf8"),
    /for: typeof w\.augments === "string" && w\.augments \? w\.augments : null,/,
    "and the reader takes one name, not a precedence chain");
  // ONE READING, so the seat, the card and the panel cannot disagree on a
  // number. Asserted as "no call site omits it" rather than as a COUNT of call
  // sites: a count is a test that fails the day somebody legitimately adds a
  // fourth surface, which trains the next reader to edit the number instead of
  // thinking about it. What actually matters is that none of them is reading a
  // different hand — or no hand at all.
  assert.match(MOUNT, /function heldWeapon\(\) \{/);
  const speaks = MOUNT.match(/dialSpeak\([^)]*\)/g) ?? [];
  assert.ok(speaks.length >= 3, "the seat, the card and the panel all say what an act costs");
  for (const call of speaks) {
    assert.match(call, /weapon: heldWeapon\(\)/, `every surface reads the same hand — ${call}`);
  }
});

// ══ (4) GAME-SPEAK ══════════════════════════════════════════════════════════

test("the dials read as a game says them, out of the door's own dial names", () => {
  // THE RULING, quoted: "just give info like it would in a game, not a debug
  // panel." What he was reading was the raw struct: `to_hit_die 20 ·
  // damage_die 8 · beats_ac 12`.
  assert.equal(dialSpeak(cardFor(VAULT, "swing")), "d20 vs 12 to hit · d8 damage",
    "the throw and the number it must beat are one sentence, not two facts to join");
  assert.equal(dialSpeak(cardFor(VAULT, "brace")), "halves the next hit");
  assert.equal(dialSpeak(cardFor(VAULT, "raise")), "lifts to 8");
});

test("a dial that is not there is not mentioned", () => {
  // THE OTHER HALF, quoted: "if a dial is missing, say nothing rather than
  // showing a bare field name."
  assert.equal(dialSpeak(cardFor(VAULT, "gather")), "", "an act whose class states no dials says nothing");
  assert.equal(dialSpeak(cardFor(VAULT, "say")), "", "and so does an ordinary one");
  assert.equal(dialSpeak(null), "", "and a missing card is not an error");
  // a dial the record turned OFF is not a fact worth a word either
  assert.equal(dialSpeak(cardOf(entry("x", { dials: { halves_next_hit: false } }))), "");
});

test("a dial this phrasebook has never heard of still appears", () => {
  // THE DEFAULT IS WHAT KEEPS IT FROM BEING A SCHEMA — the same shape as the
  // bar's own default for a verb it has never seen. A door that grows a dial
  // tomorrow gets a line, not a silence.
  const odd = cardOf(entry("x", { dials: { burns_crossings: 2, reach_m: 3, ward_die: 6, turn_timeout_s: 600, quiet: true } }));
  const said = dialSpeak(odd);
  assert.match(said, /reach 3 m/, "metres read as metres");
  assert.match(said, /d6 ward/, "a die reads as a die");
  assert.match(said, /600s turn timeout/, "seconds read as seconds");
  assert.match(said, /\bquiet\b/, "a dial that is simply on says its own name");
  assert.match(said, /burns_crossings 2/, "and one with no shape at all is still shown, in the door's own words");
});

// ══ (5) THE CONSENT SHEET ═══════════════════════════════════════════════════

test("the sheet shows what fits on a line and folds the documents, dropping nothing", () => {
  const terms = {
    binds: "the-town/portal-ground",
    means: "the-town/enter — crossing a portal changes what you read, never where you stand",
    hp: "20 at the door",
    downed: "downed is not dead — an ally can lift you",
    articles: "A".repeat(400),
    quoted: "Nine tiers, four hundred candles, not one ever lit.\nAnd the ninth is the one that matters.",
  };
  const { brief, fine } = consentSplit(terms);
  assert.deepEqual(brief.map((r) => r.key), ["binds", "means", "hp", "downed"],
    "the few terms a player needs, in the door's own keys and its own order");
  assert.deepEqual(fine.map((r) => r.key), ["articles", "quoted"],
    "and the whole mark bodies — the forty lines he was reading past — fold");

  // NOTHING IS DROPPED. This is the assertion that must never be traded away:
  // "you cannot be bound by law you were not shown at the door."
  assert.equal(brief.length + fine.length, Object.keys(terms).length,
    "every key the door sent is rendered somewhere");

  // SPLIT ON LENGTH, NOT ON A LIST OF KEY NAMES — the flip: a fifth key the
  // door has never sent before lands on the right side by its own shape.
  const grown = consentSplit({ ...terms, curfew: "the vault closes at the ninth tier" });
  assert.ok(grown.brief.some((r) => r.key === "curfew"),
    "a key nobody wrote a template for still reads at the door");
});

test("a term the door sent as a STRUCTURE is fine print, however short it is", () => {
  // ⚑ FOUNDER, 2026-08-29, from the live confirm card: a raw JSON budget line
  // was printing as prose on a party surface. Length alone let it through, and
  // that is exactly why — a compact object is SHORT and has no newlines, so it
  // sailed past a clip built to catch forty-line mark bodies and sat down beside
  // the sentences. Shape is asked first now.
  const budget = { cap_chars: 4000, per_mark_chars: 700 };
  const { brief, fine } = consentSplit({ binds: "the-town/portal-ground", budget });
  assert.deepEqual(brief.map((r) => r.key), ["binds"], "only the sentence reads as one");
  assert.deepEqual(fine.map((r) => r.key), ["budget"], "and the structure goes to the expander");
  // THE CAN-FAIL CONTROL. Under the old rule this object was brief: it is well
  // inside the clip and single-line, so a length-only split would still put it
  // on the card and this test would pass for the wrong reason without it.
  const asText = JSON.stringify(budget);
  assert.ok(asText.length <= 96 && !/[\r\n]/.test(asText),
    "…and it is short and single-line, which is what a length-only rule was reading");
  // NOTHING IS DROPPED, which is the assertion the whole sheet stands on.
  assert.equal(brief.length + fine.length, 2, "every key the door sent is rendered somewhere");
  assert.equal(fine[0].value, asText, "the structure is still there, whole, in its own words");
  // and the row itself carries which kind it is, so no caller has to re-derive it
  assert.equal(termsRows({ budget })[0].prose, false);
  assert.equal(termsRows({ binds: "x" })[0].prose, true);
});

// ══ (6) THE WALK GRID ═══════════════════════════════════════════════════════

/** The dial where the office actually puts it: FLAT on the portal block, beside
 *  id/value/by/space/keeps_wheel/body. Read off arena.mjs 2026-08-29. */
const withStride = (answer, v) => ({
  ...answer,
  standpoint: { ...answer.standpoint, portal: { ...answer.standpoint.portal, walk_min_step: v } },
});

test("a ground that declares no stride is not snapped — a floor of one metre was a bug", () => {
  // ⚑ THE DEFECT THIS PINS, and it was mine. The first version read four
  // GUESSED paths (none of them the real one) and answered ONE METRE when they
  // all missed — which was every ground in the town. Its own comment claimed
  // that left walking "byte-identical" while the line under it quietly snapped
  // every click-to-walk in the world onto whole metres.
  //
  // The office refused the same temptation and wrote down why: "a floor of 1
  // here would make every ground in the town start snapping walks to whole
  // metres — which is not what the town does today, so 'the default is 1' would
  // have been a town-wide re-cut of the walk wearing a per-ground dial's
  // clothes." Same mistake, other side of the wire.
  assert.equal(walkStep(VAULT), null, "a ground that has said nothing says nothing");
  assert.equal(walkStep({}), null);
  assert.equal(walkStep(null), null);

  // and an unsnapped point survives whole, to the digit
  const clicked = { x: 1083.417, y: -791.62 };
  assert.deepEqual(snapPoint(clicked, walkStep(VAULT)), clicked,
    "so the click the reader made is the point that is sent");
});

test("a ground that declares one snaps to it, on the office's own lattice", () => {
  // THE VAULT'S REAL VALUE is 0.25 — fine enough to stand beside a cake in a
  // three-metre room, and a lattice that still contains every whole metre.
  assert.equal(walkStep(withStride(VAULT, 0.25)), 0.25, "the declared stride is read, flat, off the portal block");
  assert.deepEqual(snapPoint({ x: 1083.417, y: -791.62 }, 0.25), { x: 1083.5, y: -791.5 });
  // round(v/step)*step anchored at the world origin — the same arithmetic the
  // office's own snapTo does, so a page that snaps before sending and one that
  // does not land on the same square.
  assert.deepEqual(snapPoint({ x: 1083.4, y: -791.6 }, 0.5), { x: 1083.5, y: -791.5 });
  assert.deepEqual(snapPoint({ x: 1083.4, y: -791.6 }, 5), { x: 1085, y: -790 });
  assert.deepEqual(snapPoint({ x: -0.4, y: -0.6 }, 1), { x: -0, y: -1 }, "and it works either side of the origin");

  // ⚑ THE OLD GUESSED PATHS ARE DEAD and must stay dead — a reader who finds
  // one of them in a fixture should get null, not a stride.
  for (const wrong of [
    { ...VAULT, standpoint: { ...VAULT.standpoint, walk: { min_step: 0.5 } } },
    { ...VAULT, standpoint: { ...VAULT.standpoint, portal: { ...VAULT.standpoint.portal, walk: { min_step: 0.5 } } } },
    { ...VAULT, walk: { min_step: 0.5 } },
    { ...VAULT, encounter_detail: { ...VAULT.encounter_detail, walk: { min_step: 0.5 } } },
  ]) {
    assert.equal(walkStep(wrong), null, "a nested walk.min_step is not the field and is not read");
  }
});

test("an unusable stride leaves the point alone rather than inventing one", () => {
  const p = { x: 1083.4, y: -791.6 };
  for (const bad of [0, -1, NaN, null, undefined, {}]) {
    assert.deepEqual(snapPoint(p, bad), p, `a stride of ${JSON.stringify(bad)} snaps nothing`);
  }
  // A NUMBER-SHAPED STRING IS READ AS THE NUMBER IT SPELLS, deliberately and
  // both sides alike. The office sends a number, so this is not a case anyone
  // is relying on — but the two functions must not disagree about it, because a
  // page that snapped to a stride the reader could not see would be worse than
  // one that snapped to none.
  assert.deepEqual(snapPoint(p, "0.5"), { x: 1083.5, y: -791.5 });
  assert.equal(walkStep(withStride(VAULT, "0.5")), 0.5);
  // absent-means-absent all the way down: a portal that spells it as null or
  // zero has still said nothing usable
  for (const v of [null, 0, -1, undefined, "", "later", {}]) {
    assert.equal(walkStep(withStride(VAULT, v)), null, `walk_min_step ${JSON.stringify(v)} is not a stride`);
  }
  assert.equal(snapPoint(null, 1), null, "and a point that is not a point is not snapped into one");
});

// ══ THE PIXELS — source pins, the repo's discipline for closure code ═════════
//
// The mount only exists inside mountCockpit, so these read the source the way
// world-cockpit-dock.test.mjs does. Each fails against the pre-ruling file.

test("the row is folded once and read from one place", () => {
  assert.match(MOUNT, /function foldedBar\(\) \{/, "one reading of the folded row");
  // ⚑ AND THE NUMBER KEYS READ IT. barSlots keys every act the answer carried,
  // folded or not — so with the fold in place the number printed on the fourth
  // seat and the act the fourth key opened were two different acts.
  assert.match(MOUNT, /const slot = foldedBar\(\)\.shown\[n - 1\];/,
    "a digit means the nth seat on the row, which is what a reader is counting");
  assert.doesNotMatch(MOUNT, /const \{ fixed, tray \} = barSlots\(state\.answer, \{ acting: state\.acting \}\);\r?\n\s*const slot = \[\.\.\.fixed, \.\.\.tray\]\.find\(\(s\) => s\.key === n\);/,
    "the pre-fold keyboard lookup is gone, not merely shadowed");
});

// ⚑ THE TWO BELOW WERE WRITTEN AFTER LOOKING AT A SHOT, not before. Both are
// defects a green suite had already passed over, and they are the reason the
// shot runner exists beside it — a partition can be provably correct and still
// render wrong.

test("the row's numbers are the row's, renumbered by the fold", () => {
  // SEEN IN THE SHOT: six seats wearing 1, 2, 7, 8, 9 — the digits those acts
  // held in the door's full list, before four of them folded away. A reader
  // counting along the row and a reader reading the corner of a seat would have
  // pressed different acts.
  const fold = barFold(barSlots(VAULT, { acting: "keeminlee" }), {
    keep: ["walk", "say", "exit"], hide: ["leave-mark", "note-to-self"],
    gate: { gather: "spent" }, phase: "afoot",
  });
  assert.deepEqual(fold.shown.map((s) => s.key), [1, 2, 3, 4, 5, 6, 7],
    "the nth seat on the row wears n");
  assert.deepEqual(fold.folded.map((s) => s.key), [null, null],
    "and what folded wears no number — the tray is reached by name");
  // the flip: barSlots on its own still numbers the door's whole list, so the
  // renumbering is the fold's doing and not a change to the reading beneath it
  const raw = barSlots(VAULT, { acting: "keeminlee" });
  assert.notDeepEqual([...raw.fixed, ...raw.tray].filter((s) => fold.shown.some((x) => x.action === s.action)).map((s) => s.key),
    fold.shown.map((s) => s.key), "which is a different numbering from the one it starts with");
});

test("a seat gets the headline and the card gets the whole line", () => {
  // SEEN IN THE SHOT: the seat read "d20 vs 8 to hit · d…". Widening the cap
  // until the sentence fit put 93px of the row off the edge at 1280 — measured,
  // in the shot runner — which is the scroll the fold exists to remove.
  const card = cardFor(VAULT, "swing");
  assert.equal(dialSpeak(card, { brief: true }), "d20 vs 12 to hit", "the seat gets one whole short phrase");
  assert.equal(dialSpeak(card), "d20 vs 12 to hit · d8 damage", "the card gets all of it");
  assert.ok(!dialSpeak(card, { brief: true }).includes("…"), "and neither of them is cut");
  // brief on an act with one thing to say is that thing, not a fragment of it
  assert.equal(dialSpeak(cardFor(VAULT, "brace"), { brief: true }), "halves the next hit");
  assert.equal(dialSpeak(cardFor(VAULT, "gather"), { brief: true }), "", "and on one with nothing to say, nothing");
  // the seat asks for the brief one; the ellipsis it used to need is gone
  assert.match(MOUNT, /leadsTo\(s\) \?\? dialSpeak\(s\.card, \{ brief: true, weapon: heldWeapon\(\) \}\)/, "the seat asks for the headline");
  assert.doesNotMatch(MOUNT, /\.pmc-dial \{[^}]*text-overflow: ellipsis/, "so the seat's line no longer needs clipping");
});

test("an armed act's card stands down, like an open panel's", () => {
  // SEEN IN THE SHOT: pressing a seat leaves the pointer on it, so the hover
  // card stayed up and the aim strip opened across it — two panels, one of them
  // explaining an act the reader had already chosen.
  assert.match(MOUNT, /if \(state\.open \|\| state\.aiming\) return;/,
    "showCard stands down for an armed act as well as an open one");
});

test("the three name-keyed rulings live beside the icons, not in the arithmetic", () => {
  // ⚑ FOUR — AND IT WAS SIX FOR ONE ROUND. His original three, the crossing act
  // on the conductor's ruling, and then GIVE/TAKE added on his word ("give and
  // take need to be main bar action buttons due to the item you can pick up to
  // help with the fight") and removed again on his word a few hours later
  // ("let's also just remove the give and take buttons as it's confusing; we can
  // just rely on the agents to pick up the weapon/upgrade"). Both states are
  // named here so a reader of the diff sees a reversal rather than drift — see
  // the give/take test below for what removal did and did not touch.
  assert.match(MOUNT, /const BAR_KEEP = \["walk", "say", "enter", "exit"\];/,
    "the ambient seats that hold a row, by ruling rather than by channel");
  assert.match(MOUNT, /const DUNGEON_HIDE = \["leave-mark", "note-to-self"\];/, "the two seats hidden in the dungeon");
  assert.match(MOUNT, /const PHASE_GATE = \{ loot: "spent" \};/, "and the one act whose precondition is a phase");
  // hidden ONLY inside portal ground — the door's own word for being in the
  // dungeon at all. Step back out and the seats come back.
  assert.match(MOUNT, /hide: portalOf\(state\.answer\) \? DUNGEON_HIDE : \[\],/,
    "the trim is scoped to the dungeon and is UI-only");
  assert.match(MOUNT, /phase: state\.answer\?\.encounter_detail\?\.phase \?\? null,/,
    "and the phase is the door's, read where the office publishes it");
});

test("the hover is a glance and the fine print is somewhere a hand can reach", () => {
  // ⚑ THE CARD TAKES NO POINTER, so a disclosure ON it would be law behind a
  // control nobody can press — worse than the dump it replaced. The split is by
  // gesture: hover gets the glance, the panel gets the detail.
  assert.match(MOUNT, /\.pmc-card \{[\s\S]{0,400}?pointer-events: none;/,
    "the card still takes no pointer");
  // ⚑ AND THE POINTER TO THE REST IS GONE (founder, 2026-08-29). This pinned
  // `press for the fine print` as the card's last line; it was an instruction to
  // do the thing the reader was already doing, under every seat on every hover.
  // Deleting it costs nothing, because the terms never depended on the tooltip
  // announcing them — they arrive at the press either way, and the
  // consent-at-the-door law is the press's.
  //
  // PINNED ON THE TEMPLATE, not on prose about it: this line can only match the
  // rendering itself, so a card that started saying it again would fail here.
  assert.match(MOUNT, /return `\$\{cold\}\$\{line\}\$\{blurb\}\$\{voice\}\$\{why \? `<p class="pmc-from">the seat lights when it can be taken<\/p>` : ""\}`;/,
    "so the card is why it is cold, the throw, the sentence, and the weapon's own words — and nothing else");
  assert.doesNotMatch(MOUNT, /press for the fine print/,
    "the sentence is not anywhere in this file, comment or code");
  // …and the fine print itself did NOT move or shrink. The line went; the terms
  // are exactly where they were, on the surface a hand has committed to.
  assert.match(MOUNT, /function fineHtml\(card\) \{/, "and the rest is rendered on the panel");
  assert.match(MOUNT, /\$\{trigger && !sheet \? "" : fineHtml\(c\)\}/,
    "which is where formHtml puts it — on every panel except the tight fight plate, and on that one too once it is delivering terms");
  // the seat's own line is game-speak now too, in its headline form — see
  // "a seat gets the headline and the card gets the whole line" below
  assert.match(MOUNT, /leadsTo\(s\) \?\? dialSpeak\(s\.card, \{ brief: true, weapon: heldWeapon\(\) \}\)/,
    "and the seat says it the same way, in the room a seat has");
});

test("a panel that delivers terms is a consent sheet, whichever act it belongs to", () => {
  // ⚑ AND WHATEVER SHAPE ITS CARD IS. This read `shown && !trigger` on the first
  // pass, which excluded the one act the ruling was actually about: the crossing
  // act's two fields are both optional, so it IS a trigger by the card's shape,
  // and keying the sheet on "not a trigger" left it a bare form. Caught by the
  // shot runner going looking for a flavor line and finding none.
  assert.match(MOUNT, /const sheet = shown \? " pmc-sheet" : "";/,
    "terms alone decide it — the door decides it, by sending them");
  assert.doesNotMatch(MOUNT, /const sheet = shown && !trigger/,
    "the shape of the card does not get a vote");
  // a sheet keeps its field captions even dressed as a trigger — the field
  // descriptions are where the door says what agreeing to this does
  assert.match(MOUNT, /const captioned = !trigger \|\| Boolean\(sheet\);/,
    "and a sheet's fields keep the door's own captions rather than hiding them behind a hover");
  // the terms are asked for by OPENING the act, not only by hovering its seat
  assert.match(MOUNT, /if \(state\.open\) askTerms\(state\.open\);/,
    "so an act reached through the tray or by its number arrives with its terms");
  assert.match(MOUNT, /function flavorHtml\(card\) \{/, "the act's own sentence leads");
  // ⚑ AND THE ROOM'S SENTENCE IS THE ENTER ACT'S ALONE NOW (founder, 2026-08-29,
  // from the live surface). A portal's `body` is the room saying what it is like
  // to come IN, and this line handed it to every act whose door sent terms — so
  // the cellar door's welcome, "Past the inner door the candles go up in
  // tiers…", was recited on an EXIT confirm and again on a LIFT. Correct prose,
  // wrong act, twice, from one composer gluing it onto all of them. Every other
  // act falls through to its own blurb, which is the sentence saying what THAT
  // act does.
  assert.match(MOUNT, /const entering = ENTER_ACTS\.has\(card\?\.action\);\r?\n\s*const said = \(entering \? portalOf\(state\.answer\)\?\.body : null\) \|\| card\?\.blurb \|\| null;/,
    "the threshold's welcome on entering, the act's own words otherwise — and both quoted, never written here");
  assert.doesNotMatch(MOUNT, /const said = portalOf\(state\.answer\)\?\.body \|\| card\?\.blurb/,
    "the unconditional reading is gone, not merely shadowed");
  // ⚑ THE SUMMARY READS TWO WAYS NOW and the non-negotiable half is its tail. On
  // a no-choice act every row folds (see the bare-card test below), so the
  // disclosure opens by naming what it holds rather than with "read them whole"
  // — but the sentence that makes folding legitimate at all is the same either
  // way, and it is what this pins.
  assert.match(MOUNT, /— you cannot be bound by law you were not shown at the door<\/summary>/,
    "the sentence that makes the fold non-negotiable is written on the disclosure itself");
});

// ══ THE FIGHT, SIZED FOR THE ROOM (founder-ruled 2026-08-29, at the board) ═══
//
//   "the cake adversary token on the map ~3x larger, INCLUDING its hp bar"
//   "hp bars on ALL combatant tokens in an encounter, the cake's style, small,
//    only while a wheel is live for that ground"

test("every fighter with hit points gets a rail, placed where the answer places them", () => {
  // this fixture's wheel holds the cake, the human, and one resident. Placing
  // the first two and NOT the third is what makes the last assertion mean
  // something.
  const answer = {
    ...VAULT,
    present: [{ handle: "keeminlee", x: 1083, y: -789.2 }],
  };
  const bars = combatantBars(answer);
  assert.ok(bars.some((b) => b.id === "keeminlee"), "the human is a fighter like any other");
  // …and a RESIDENT is too, once the answer places them
  const withResident = combatantBars({ ...VAULT,
    present: [{ handle: "keeminlee", x: 1083, y: -789.2 }, { handle: "vermillion", x: 1085, y: -789.6 }] });
  assert.ok(withResident.some((b) => b.id === "vermillion"), "a resident on the wheel gets one too");
  // a name in `present` that is NOT on the wheel is not a fighter and gets nothing
  const bystander = combatantBars({ ...VAULT, present: [{ handle: "wright", x: 1082, y: -790 }] });
  assert.ok(!bystander.some((b) => b.id === "wright"), "somebody standing nearby is not in the fight");

  // ⚑ THE ADVERSARY IS EXCLUDED. It carries its own bar at its own scale with
  // its own name plate; a second rail over the same figure is one number twice.
  assert.ok(!bars.some((b) => b.id === "the-town/the-unlit-cake"), "the boss keeps its own bar and gets no rail");

  // ⚑ AND AN UNPLACED FIGHTER GETS NOTHING RATHER THAN A GUESS. `nearby` is a
  // budgeted field of view and `present` is banded, so a real combatant can be
  // unplaceable on a given read — the same rule the token, the ring and the
  // floor things already follow.
  assert.ok(!bars.some((b) => b.id === "vermillion"), "a fighter the answer does not place is not drawn somewhere plausible");
});

test("the rails appear only while a wheel is actually turning", () => {
  const placed = { present: [{ handle: "keeminlee", x: 1083, y: -789 }] };
  // no encounter at all
  assert.deepEqual(combatantBars({ ...VAULT, ...placed, encounter: undefined }), []);
  // an encounter the door says is NOT live — representable, but nothing owed
  assert.deepEqual(
    combatantBars({ ...VAULT, ...placed, encounter_detail: { ...VAULT.encounter_detail, live: false } }), [],
    "bars over a quiet room would say a fight was on");
  // and a fighter with no hit points on the wheel has nothing to draw
  const noHp = { ...VAULT, ...placed, encounter: { ...VAULT.encounter,
    order: VAULT.encounter.order.map((a) => (a.id === "keeminlee" ? { id: a.id, kind: a.kind, label: a.label } : a)) } };
  assert.ok(!combatantBars(noHp).some((b) => b.id === "keeminlee"));
});

test("a downed fighter's rail is drawn empty and still drawn", () => {
  const answer = { ...VAULT, present: [{ handle: "vermillion", x: 1085, y: -789.6 }] };
  const v = combatantBars(answer).find((b) => b.id === "vermillion");
  assert.ok(v, "being at zero is a state to watch — a rail that vanished would read as having left");
  assert.equal(v.hp.now, 0);
  assert.equal(v.down, true);
});

test("the adversary's size is one constant, and three readers share it", () => {
  // ⚑ THE POINT OF NAMING IT. The drawing, the hit-test that decides whether a
  // click landed on the figure, and the reticle that frames it while an act is
  // armed all measured it separately — so tripling the picture alone would have
  // left clicks landing on empty floor and a crosshair inside the thing it
  // frames.
  assert.match(MOUNT, /const ADVERSARY_R = 60;/, "tripled from 20 on the founder's word");
  assert.match(MOUNT, /const r = ADVERSARY_R \* u;/, "the drawing reads it");
  assert.match(MOUNT, /near\(placed\.at, ADVERSARY_R \* u \* 1\.34\)/, "the hit-test reads it");
  assert.match(MOUNT, /t\.value === advId \? ADVERSARY_R \* 1\.25 : 26/, "and the reticle sizes itself to what it frames");
  // the hp bar is a multiple of r, so "including its hp bar" needed no second edit
  assert.match(MOUNT, /const bw = r \* 2\.6;/, "the bar grows with the figure because it always was a multiple of it");
});

test("a person's rail is not the boss's colour, and rides above every figure", () => {
  // Found by looking at a magnified crop, twice: drawn in the adversary's ember
  // over the adversary's ember ring, three rails were in the DOM and invisible;
  // drawn under the token and the speech layer, they were behind the very
  // figures they belong to.
  assert.match(MOUNT, /const gold = "#f0d5a8";/, "the cake owns ember on this map; a fighter does not");
  assert.match(MOUNT, /function rails\(\) \{/, "the rails are their own pass");
  assert.match(MOUNT, /tokenLayer\.appendChild\(g\);\r?\n\s*rails\(\);\r?\n\s*speech\(\);/,
    "appended after the figures");
  assert.match(MOUNT, /if \(!place\) \{ rails\(\); speech\(\); return; \}/,
    "and drawn even where the human's own token is not — they are everyone's, not the human's");
  assert.match(MOUNT, /const rails = tokenLayer\.querySelector\("\.pmc-combatant-layer"\);\r?\n\s*if \(rails\) tokenLayer\.insertBefore\(g, rails\); else tokenLayer\.appendChild\(g\);/,
    "speech goes under them — a line fades on the door's clock, hit points do not");
});

// ══ THE LAST THREE OF THE FIVE (founder, live at the board 2026-08-29) ═══════

test("give and take are off the row, and the reversal is visible", () => {
  // ⚑ THIS REVERSES HIS OWN EARLIER RULING. Earlier: "give and take need to be
  // main bar action buttons due to the item you can pick up to help with the
  // fight." Now: "let's also just remove the give and take buttons as it's
  // confusing; we can just rely on the agents to pick up the weapon/upgrade."
  // What changed is whose HANDS the mechanic belongs in, not the mechanic.
  assert.match(MOUNT, /const BAR_KEEP = \["walk", "say", "enter", "exit"\];/);
  assert.doesNotMatch(MOUNT, /const BAR_KEEP = \[[^\]]*"give"/, "the seats are gone");

  // ⚑ AND NOTHING IS ORPHANED. The keep list decides which AMBIENT acts hold a
  // seat and nothing else — the door still affords them, the tray still reaches
  // them, and an agent acting through its own door never consulted this file.
  const fold = barFold(barSlots(VAULT, { acting: "keeminlee" }), {
    keep: ["walk", "say", "enter", "exit"], hide: ["leave-mark", "note-to-self"],
  });
  assert.ok(!fold.shown.some((s) => s.action === "take"), "no seat on the row");
  assert.ok(fold.folded.some((s) => s.action === "take"), "still reachable in the tray");
  // the act itself is untouched — its card, its aim field, its whole grammar
  assert.equal(aimField(cardFor(VAULT, "take"))?.name, "thing",
    "removing a button removed a button, not an act");
});

test("a spoken line closes on Enter without waiting for the door", () => {
  // FOUNDER: there is "a small lag between hitting Enter and the panel going
  // away" that reads as "did that send?". The close IS the confirmation, and it
  // is honest about what it confirms — that the line LEFT, not that the door
  // took it, which is a fact from the future.
  assert.match(MOUNT, /if \(form\.hasAttribute\("data-chat"\)\) \{/, "speaking takes its own exit");
  assert.match(MOUNT, /state\.open = null; state\.act = null; state\.said = null; formValues = null;\r?\n\s*paint\(\);\r?\n\s*sendAct\(action, whole\)\.then\(/,
    "the panel is closed and painted BEFORE the dispatch is awaited");
  // ⚑ AND ONLY SPEAKING. Every other act still waits, because a swing's answer
  // is the throw and a crossing's is the terms; a spoken line has no answer
  // worth a pause.
  assert.match(MOUNT, /await sendAct\(action, whole, form\);/, "the ordinary path is unchanged");
});

test("a spoken line that did not land comes back with its words", () => {
  // The other half of the trade, and the reason close-on-enter is safe: nothing
  // is silently eaten and no typed text is lost.
  assert.match(MOUNT, /const said = whole\[form\.getAttribute\("data-chat"\)\] \?\? "";/,
    "the text is held before the panel goes");
  assert.match(MOUNT, /if \(state\.said && state\.said\.ok === false\) reopenChat\(action, said\);/,
    "and a failure re-opens the line");
  assert.match(MOUNT, /function reopenChat\(action, text\) \{/);
  assert.match(MOUNT, /box\.value = text; box\.focus\(\);/, "with the words in it and the cursor waiting");
  // the door's own defect rides under it — `state.said` is set by sendAct and
  // chatHtml renders it with the failure class
  assert.match(MOUNT, /<p class="pmc-said\$\{state\.said\.ok \? "" : " bad"\}">/, "in the door's own words");
});

test("the confirm card is compact and sits on the right", () => {
  // FOUNDER: the old walk confirmation "was MUCH more concise; the current is
  // still so verbose", and it must sit on the RIGHT SIDE. So it takes the walk
  // desk's own register — the thing he was comparing it to.
  assert.match(MOUNT, /\.pmc-form \{\r?\n\s*position: fixed; right: 14px; left: auto; transform: none;/,
    "pinned to the right rather than centred over the painting");
  assert.match(MOUNT, /width: min\(19rem, 42vw\);/, "and near the desk's own width");
  assert.doesNotMatch(MOUNT, /\.pmc-form \{ position: fixed; left: 50%;/, "the centred 26em panel is gone");
  // WHAT WAS CUT: the act's blurb (the hover card carries it whole) and the
  // keys line, which a card with a confirm button under the cursor does not
  // need. WHO/FROM/TO and the confirm are what remain.
  // ⚑ AND NOT ON A NO-CHOICE ACT EITHER (founder, 2026-08-29). His exit confirm
  // led with four italic lines defining what an entry IS, above an act whose
  // whole content is "leave" — the verbosity he objected to, in a different
  // paragraph from the one fixed first. Flavour is for a card a reader has
  // something to decide on.
  assert.match(MOUNT, /\$\{sheet && !bare \? flavorHtml\(c\) : ""\}\r?\n\s*\$\{flowRowsHtml\(c\)\}/,
    "flavour where consent is asked AND there is something to fill in; otherwise straight to the rows");
  assert.match(MOUNT, /\$\{sheet \? ready : ""\}/, "the keys line is a consent-sheet thing now");
  // the vertical is still MEASURED against the bar, which dodges the viewer's
  // own furniture — a fixed bottom would collide with whatever it dodged
  assert.match(MOUNT, /if \(form\) placeAbove\(form, root\.querySelector\("\.pmc-bar"\)\);/,
    "only the horizontal is pinned");
});

// ══ (7) AN ACT THAT MAY ONLY BE AIMED AT SOME OF WHAT IS HERE ═══════════════
//
// FOUNDER, live at the board 2026-08-29: "you can only select the unlit cake
// using the LIFT action." The act whose whole law is spending your entire turn
// getting a downed ALLY back on their feet was offering the creature — because
// every aimed act was offered every candidate the answer named.
//
// THE FIXTURE'S NAME FOR IT IS `raise`, and the arithmetic never learns either
// spelling: the narrowing is asked for in ROLES, which is what a candidate is
// standing as. The mount holds the name, the way it holds every other one.

test("a candidate carries the role it came in as", () => {
  // The can-fail control for everything below: if the fixture stopped holding
  // one of each, the filters would pass by having nothing to exclude.
  const roles = aimTargets(VAULT).map((t) => t.role);
  assert.deepEqual(roles, ["adversary", "downed", "loose"],
    "the vault holds a creature, someone down, and a thing on the floor — one of each");
});

test("an act narrowed to the downed is offered exactly them", () => {
  const targets = aimTargets(VAULT, { only: ["downed"] });
  assert.deepEqual(targets.map((t) => t.value), ["vermillion"],
    "the one ally who is down, and nobody else");
  assert.ok(!targets.some((t) => t.value === "the-town/the-unlit-cake"),
    "the creature is not in the set — which is the founder's bug, stated");
  // …and the unplaced target survives the narrowing, which is the whole reason
  // an unplaced target is kept at all: someone down is the likeliest figure the
  // answer cannot place, and dropping them empties this set exactly when it
  // matters most.
  assert.equal(targets[0].at, null, "offered by name, with no coordinate invented for them");
});

test("the wide set is untouched, so the acts that fight still find the creature", () => {
  // The other half, and the one a regression here would break silently: an act
  // nobody has ruled on is offered everything, exactly as before.
  const wide = aimTargets(VAULT).map((t) => t.value);
  assert.deepEqual(wide, ["the-town/the-unlit-cake", "vermillion", "vermillion/the-long-knife"]);
  assert.deepEqual(aimTargets(VAULT, { only: null }).map((t) => t.value), wide, "no narrowing is no narrowing");
  assert.deepEqual(aimTargets(VAULT, { only: [] }).map((t) => t.value), wide, "and an empty list is not 'narrow to nothing'");
  assert.ok(aimable(slotFor(VAULT, "swing"), VAULT), "the swinging act still has something to aim at");
});

test("with nobody down there is nothing for a narrowed act to be aimed at", () => {
  const noneDown = {
    ...VAULT,
    encounter: {
      ...VAULT.encounter,
      order: VAULT.encounter.order.map((a) => (a.down ? { ...a, down: false, hp: { now: 14, max: 20 } } : a)),
    },
  };
  assert.deepEqual(aimTargets(noneDown, { only: ["downed"] }), [], "the set is empty");
  assert.equal(aimable(slotFor(noneDown, "raise"), noneDown, { only: ["downed"] }), false,
    "so the seat cannot be armed — no crosshair over an empty room");
  // ⚑ AND THE CREATURE IS STILL ABSENT FROM IT, which is the assertion that
  // fails against the old file in BOTH states: unnarrowed, this set was the
  // whole candidate list and the cake led it.
  assert.ok(!aimTargets(noneDown, { only: ["downed"] }).some((t) => t.value === "the-town/the-unlit-cake"));
  // the can-fail control: the cake is genuinely there to be wrongly offered
  assert.ok(aimTargets(noneDown).some((t) => t.value === "the-town/the-unlit-cake"),
    "…and it is present in the wide set, so its absence above is a filter and not an empty fixture");
  assert.equal(aimable(slotFor(noneDown, "swing"), noneDown), true, "while an unnarrowed act is unaffected");
});

test("a narrowed act is never prefilled with a target its crosshair would refuse", () => {
  // The typed half of the same question. With one ally down the box fills with
  // THEM; in a room holding only the creature the unnarrowed prefill filled
  // with the creature, which is the founder's bug in the box rather than on
  // the map.
  const card = cardFor(VAULT, "raise");
  assert.deepEqual(prefillFor(card, VAULT, { only: ["downed"] }), { object: "vermillion" },
    "one lawful value, so there is no choice being made");
  const alone = {
    ...VAULT,
    nearby: VAULT.nearby.filter((n) => !n.loose),
    encounter: { ...VAULT.encounter, order: VAULT.encounter.order.filter((a) => !a.down) },
  };
  assert.deepEqual(prefillFor(card, alone), { object: "the-town/the-unlit-cake" },
    "unnarrowed, the creature is the one candidate and would be typed in for you");
  assert.deepEqual(prefillFor(card, alone, { only: ["downed"] }), {},
    "narrowed, nothing is filled in");
});

test("the seat that can be aimed at nobody is greyed with its reason, not armed", () => {
  // FOUNDER'S OWN SHAPE: "when nobody is down, the button sits disabled with
  // its reason (like the turn gating does), not armed with a wrong target."
  //
  // The ruling is name-keyed and lives in the mount with its siblings, so these
  // are source pins — the same discipline SELF_DIRECTED's are held to.
  assert.match(MOUNT, /const AIM_ROLES = \{\r?\n\s*lift: \{ roles: \["downed"\], idle: "nobody is down" \},\r?\n\s*\};/,
    "one table, the act's name and the roles it may be aimed at");
  assert.match(MOUNT, /return \{ \.\.\.s, enabled: false, blocked: AIM_ROLES\[s\.action\]\.idle \};/,
    "and an empty aim set dresses the seat exactly as a turn-gate does");
  assert.match(MOUNT, /if \(aimTargets\(state\.answer, \{ only: roles \}\)\.length\) return s;/,
    "keyed on the live answer, so it warms again the moment someone goes down");
  // ⚑ THE DOOR'S OWN REFUSAL OUTRANKS IT. A seat the clock has already blocked
  // keeps the clock's sentence — the more urgent fact, and the one the gate
  // line above the bar is explaining.
  assert.match(MOUNT, /if \(!roles \|\| !s\.afforded \|\| !s\.enabled \|\| !s\.card\) return s;/);
  assert.match(MOUNT, /shown: fold\.shown\.map\(narrowAim\),\r?\n\s*folded: fold\.folded\.map\(narrowAim\),/,
    "every seat the row draws goes through it, on the row and in the tray");
  // and the reason is READABLE: the hover card leads with it, which is the one
  // surface a greyed seat could not speak from before
  assert.match(MOUNT, /host\.innerHTML = cardHtml\(s\.card, \{ why: s\.blocked \}\);/);
  assert.match(MOUNT, /const cold = why \? `<p class="pmc-row pmc-why">\$\{esc\(why\)\}<\/p>` : "";/);
});

test("one aim set, read by every surface that asks what an act is for", () => {
  // The map's rings, the strip's chips, the click that resolves a target, the
  // datalist and the prefill. They disagreed once — the founder found it from
  // the map's side — and one reader is how they cannot again.
  assert.match(MOUNT, /const targetsFor = \(action\) => aimTargets\(state\.answer, \{ only: aimRoles\(action\) \}\);/,
    "one reader");
  assert.match(MOUNT, /return targetsFor\(state\.aiming\.action\)\.map\(\(t\) => \{/, "the rings on the painting");
  assert.match(MOUNT, /const targets = targetsFor\(action\);/, "the strip's chips");
  assert.match(MOUNT, /const target = thing \? targetsFor\(state\.aiming\.action\)\.find\(\(t\) => t\.value === thing\.id\) : null;/,
    "and the click that resolves one");
  assert.match(MOUNT, /const filled = prefillFor\(c, state\.answer, \{ only: aimRoles\(action\) \}\);\r?\n\s*const candidates = targetsFor\(action\);/,
    "with the typed half reading the same set");
  assert.doesNotMatch(MOUNT, /aimTargets\(state\.answer\)\./, "and no surface reads the wide set behind its back");
});

// ══ (8) THE CREATURE'S TOKEN: THE RING AND THE RAIL, THEN THE WORDS ═════════
//
// FOUNDER, 2026-08-29: take the name text off the entity token, and move the hp
// numbers INTO the bar, revealed on HOVER only — "to keep the map clean". At
// rest: the ring and the bar. On hover: the bar shows its numbers.

test("the creature's numbers live in its own rail, and only when asked for", () => {
  assert.match(MOUNT, /const hot = state\.hover === a\.id;/, "one flag, the pointer's answer");
  assert.match(MOUNT, /const numbers = hasBar && hot/, "the numbers are drawn only while it is hovered");
  assert.match(MOUNT, /fill="#fdf1ea">\$\{a\.hp\}\/\$\{a\.of\}<\/text>/, "and they are the door's two numbers, over the rail");
  // INSIDE the rail's own group, which is what "into the hp bar" means — a
  // number beside the bar would be the name plate again wearing digits.
  assert.match(MOUNT, /<g class="pmc-adv-hp">[\s\S]{0,900}?\$\{numbers\}\r?\n\s*<\/g>/,
    "inside the rail's group, not beside it");
  // ⚑ AND THE RAIL IS UNCONDITIONAL. The ruling moved the numbers, not the bar:
  // at rest the figure is still a ring and a rail.
  assert.match(MOUNT, /\$\{hasBar \? `<g class="pmc-adv-hp">/, "the rail itself is drawn whenever the door gives numbers");
});

test("the creature's hover is the numbers and nothing else — no name plate at all", () => {
  // ⚑ THIS SUPERSEDES "the name comes back on hover rather than standing on the
  // map", which stood here and asserted the opposite. That test was right about
  // its own reasoning and wrong about the world: it kept the plate hidden-but-
  // returning because "deleting the plate outright would leave an orange ring a
  // reader cannot identify at all". FOUNDER, 2026-08-29, with the fact that
  // reasoning missed: "the unlit cake is BOTH A MARK AND AN ENTITY, which makes
  // things very redundant." The ring is not anonymous — the MARK under it has
  // its own hover card carrying the name, and the wheel's seat carries it too.
  // A third plate on the same pointer was a second answer to a question already
  // answered twice.
  assert.doesNotMatch(MOUNT, /<g class="pmc-adv-name">/, "the plate is not drawn");
  assert.doesNotMatch(MOUNT, /fill="#f0c9b8" font-family="Georgia, serif">\$\{esc\(nm\)\}<\/text>/,
    "and no name text is emitted onto the token at any state");
  // what hover DOES give is the one thing neither the mark card nor the wheel
  // states in the moment: how much of the creature is left, in its own rail.
  assert.match(MOUNT, /const numbers = hasBar && hot/, "the numbers are still the hover reveal");
  assert.match(MOUNT, /fill="#fdf1ea">\$\{a\.hp\}\/\$\{a\.of\}<\/text>/, "and they are the door's own two numbers");
});

test("…and nothing is orphaned: the mark and the wheel still name the creature", () => {
  // THE NO-ORPHAN CONTROL. The deletion above is only honest while these two
  // hold; if either stopped naming the cake, the map really would carry an
  // orange ring nobody can identify — the exact failure the hidden plate was
  // compromising to avoid. So they are asserted here, beside the deletion.
  //
  // The wheel: every combatant row carries its label, the creature included.
  assert.match(MOUNT, /<span class="nm">\$\{esc\(a\.label\)\}<\/span>/,
    "the wheel's own seat prints every combatant's label, the creature included");
  // The mark: the cake stands on the floor as a mark like any other, and the
  // viewer's own hover card names it. This surface must not suppress it — the
  // token layer takes no pointer events at all, so a pointer over the ring
  // reaches the painting underneath and the mark answers.
  assert.match(MOUNT, /tokenLayer\.setAttribute\("pointer-events", "none"\);/,
    "the token layer never swallows the pointer, so the mark beneath still answers it");
});

test("what lights under the cursor is what a press would land on", () => {
  // The hover is resolved by the CLICK's own reader, against a coordinate —
  // the only reader available on a layer that takes no pointer events, and the
  // reason the highlight and the gesture cannot drift apart.
  assert.match(MOUNT, /const thing = thingAt\(pointAt\(ev\)\);\r?\n\s*const id = thing\?\.adversary \? thing\.id : null;/,
    "the pointer's position through the same hit-test the click uses");
  assert.match(MOUNT, /if \(id === state\.hover\) return;/, "and nothing repaints while the answer is unchanged");
  assert.match(MOUNT, /doc\.addEventListener\("pointermove", onMapHover, \{ passive: true \}\);/,
    "on the document, like every other listener that reads the living painting");
  assert.match(MOUNT, /doc\.removeEventListener\("pointermove", onMapHover\);/, "and given back at destroy");
  // ONE LAYER REPAINTS, not the whole map: a pointer move that rebuilt every
  // figure would be a redraw of the room on every pixel of travel.
  assert.match(MOUNT, /function advRing\(\) \{/, "the ring is a layer of its own");
  assert.match(MOUNT, /const above = tokenLayer\.querySelector\("\.pmc-loose-layer, \.pmc-token, \.pmc-combatant-layer, \.pmc-voice-layer"\);/,
    "which keeps its place under the figures by name, not by when it was appended");
  // and the cockpit's own furniture is not the map — the bar hangs across the
  // bottom of the painting, and a pointer on a seat is not on what is behind it
  assert.match(MOUNT, /ev\.target\?\.closest\?\.\("\[data-pmc\]"\)\) \{ cool\(\); return; \}/);
});

// ══ (9) THE DOCK'S PLATE IS THE FIGHTER YOU ARE POINTING AT ═════════════════
//
// FOUNDER, 2026-08-29: the ACT AS bar's hover should show "the orange-rimmed
// LARGER card, not the small nameplate" — and the larger card's content, which
// he called "useless for the human to see", is replaced with "their inventory
// (aka whether they are carrying the weapon, with an icon!) as well as their HP
// bar with numbers and whatever other stats".
//
// The state itself is a JOIN and is falsifiable directly; the plate that renders
// it lives inside the mount's closure and is pinned at the source, as every
// other rendering ruling on this surface is.

test("a fighter's state is the wheel and the holdings, joined on one person", () => {
  const s = fighterState(VAULT, "vermillion");
  assert.equal(s.onWheel, true);
  assert.equal(s.label, "vermillion");
  assert.deepEqual(s.hp, { now: 0, max: 20 }, "the hit points are the wheel's own numbers");
  assert.equal(s.down, true, "and being down is the wheel's own word");
  assert.equal(s.initiative, 11);
  assert.equal(s.current, false, "it is not her turn");
  assert.equal(s.turnOf, "DARKO", "so the plate can say whose it is, by LABEL rather than by id");
  assert.equal(s.round, 3);
});

test("acting as your household's human, the plate reads the HUMAN's row", () => {
  // ⚑ THE BUG CLASS THIS FUNCTION EXISTS FOR. The wheel is keyed by the
  // fighter's own id and the holdings by the door's `who`; acting as the human,
  // the id on the wheel is NOT the handle that was selected. Every surface that
  // has forgotten it showed one person's numbers under another person's face —
  // `yourTurnRow` and `weaponFor` both carry the scar, and this resolves it the
  // same way they do rather than a third way.
  const s = fighterState(VAULT, HUMAN_ACTOR);
  assert.equal(s.id, "keeminlee", "the human's row is found by KIND, not by the handle");
  assert.equal(s.label, "DARKO");
  assert.deepEqual(s.hp, { now: 16, max: 20 });
  assert.equal(s.current, true, "and the wheel says it is his turn");
  // the can-fail control: the resident's row is genuinely different, so a
  // reader of the wrong row would show 0/20 and "down"
  assert.deepEqual(fighterState(VAULT, "vermillion").hp, { now: 0, max: 20 },
    "…and the resident beside him reads differently, so this is not one row twice");
});

test("what is in the hand rides on the same state, resolved for the same person", () => {
  const armed = {
    ...VAULT,
    encounter_detail: {
      ...VAULT.encounter_detail,
      hands: { keeminlee: { weapon: { thing: "the-town/the-good-lighter", bonus: 3, augments: "swing" } } },
    },
  };
  const s = fighterState(armed, HUMAN_ACTOR);
  assert.equal(s.weapon.label, "the good lighter", "named the way every id here is named — the leaf, deslugged");
  assert.equal(s.weapon.bonus, 3);
  assert.equal(s.weapon.for, "swing", "and the act it augments is the record's word, never derived");
  assert.equal(fighterState(armed, "vermillion").weapon, null,
    "a hand the door says nothing about is empty, and empty is an answer");
});

test("a resident who is not on the wheel is said to be off it, never filled in", () => {
  // Standing in the room and not being in the fight is a real state. A plate
  // that drew an empty bar for it would say they were at zero, which is the
  // opposite of the truth.
  const s = fighterState(VAULT, "wright");
  assert.equal(s.onWheel, false);
  assert.equal(s.hp, null);
  assert.equal(s.initiative, null);
  assert.equal(s.down, false);
  // …and with no encounter at all, nothing is invented either
  const quiet = { ...VAULT, encounter: undefined, encounter_detail: undefined };
  assert.equal(fighterState(quiet, "vermillion").onWheel, false);
  assert.equal(fighterState(quiet, HUMAN_ACTOR).id, null, "with no wheel there is no human row to find");
});

test("the plate carries state, and the small nameplate that doubled it is gone", () => {
  // THE RULING: the hover shows the larger card, not the small nameplate.
  assert.doesNotMatch(MOUNT, /<span class="pmc-nm/, "no face draws a name box any more");
  assert.doesNotMatch(MOUNT, /^\.pmc-nm[ .:[]/m, "and the stylesheet no longer dresses one");
  // WHAT REPLACED THE RECITATION. The plate printed the acting seat, the portal
  // it rooted in and the whole `within` chain; it now prints one fighter.
  assert.doesNotMatch(MOUNT, /the read roots at/, "the standpoint recitation is gone");
  assert.match(MOUNT, /const s = fighterState\(state\.answer, who\);/, "the plate reads one fighter's state");
  assert.match(MOUNT, /\$\{hpRowHtml\(s\)\}\r?\n\s*\$\{statRowHtml\(s\)\}\r?\n\s*\$\{kitHtml\(s\)\}/,
    "hit points, then the other stats, then what is in the hand");
  // ⚑ AND THE STAT ROW TAKES ONLY THE FIGHTER, which is a correction the SHOT
  // made rather than an assertion. The first draft passed the roster face in so
  // the row could print the door's sentence about why a human may stand on this
  // ground — reasoning that a line the deleted name box carried should not be
  // orphaned. Rendered, it was "inside the-town/the-candle-vault — a portal's
  // ground seats a human", wrapped over two lines: a fact about the GROUND, on
  // the card that exists because ground-facts were called useless here. It is
  // still on the face's own accessible name.
  assert.match(MOUNT, /function statRowHtml\(s\) \{/, "the stat row is about the fighter and takes nothing else");
  assert.doesNotMatch(MOUNT, /bits\.push\(humanWords\(f\)\)/, "the standpoint sentence is not on the plate");
  assert.match(MOUNT, /f\.kind === "human" \? `\$\{f\.label\} · yourself — \$\{humanWords\(f\)\}`/,
    "…and it is not orphaned either — the face's own label still carries it");
});

test("the hit points are a bar WITH the numbers on it", () => {
  assert.match(MOUNT, /<span class="fill" style="width:\$\{\(frac \* 100\)\.toFixed\(1\)\}%"><\/span>\r?\n\s*<span class="num">\$\{s\.hp\.now\}\/\$\{s\.hp\.max\}<\/span>/,
    "the fill is the fraction and the numbers ride over it");
  assert.match(MOUNT, /\.pmc-hp \.num \{[\s\S]{0,220}?text-shadow:/,
    "with a halo, because the numbers cross both of the rail's grounds");
  // AND A FIGHTER OFF THE WHEEL GETS NO BAR — an empty rail would read as zero.
  assert.match(MOUNT, /if \(!s\.onWheel\) return `<div class="spine">not in this fight<\/div>`;/);
  assert.match(MOUNT, /if \(!s\.hp\) return `<div class="spine">on the wheel — the door states no hit points<\/div>`;/,
    "and a row the door gave no numbers for says that instead of drawing an empty one");
});

test("the inventory row answers carrying and not-carrying, both with the icon", () => {
  // "their inventory (aka whether they are carrying the weapon, with an icon!)"
  assert.match(MOUNT, /const ICON_HAND =/, "one glyph, and it is not in the act table — a held thing is not an act");
  assert.match(MOUNT, /if \(!w\) return `<div class="kit none">\$\{ICON_HAND\}<span>empty-handed<\/span><\/div>`;/,
    "an empty hand is stated rather than left as a missing row");
  assert.match(MOUNT, /return `<div class="kit">\$\{ICON_HAND\}<span>\$\{esc\(w\.label\)\}<\/span><b>\$\{clause\}<\/b><\/div>`;/,
    "and a full one names the thing and what it adds");
  // THE CLAUSE IS THE RECORD'S: where the grant names no act, no act is claimed.
  assert.match(MOUNT, /const clause = w\.for \? `\+\$\{w\.bonus\} to \$\{esc\(w\.for\)\}` : `\+\$\{w\.bonus\}`;/);
});

test("the plate follows the pointer without rebuilding the dock under it", () => {
  assert.match(MOUNT, /const who = state\.peek \?\? state\.acting;/,
    "whichever face is being looked at, falling back to whoever is acting");
  assert.match(MOUNT, /function peekAt\(target\) \{/);
  assert.match(MOUNT, /if \(who === state\.peek\) return;/, "nothing happens while the answer is unchanged");
  // ⚑ AND IT REPAINTS THE PLATE ALONE. paint() replaces the whole overlay, so a
  // full repaint on a face hover would destroy the button under the pointer.
  assert.match(MOUNT, /host\.innerHTML = fresh\.innerHTML; host\.className = fresh\.className;/,
    "only the plate's insides are swapped");
  assert.doesNotMatch(MOUNT, /function peekAt\(target\) \{[\s\S]{0,700}?paint\(\);/,
    "and no full repaint hides inside it");
  // it follows the KEYBOARD too, through the handler the hover card already uses
  assert.match(MOUNT, /if \(slot && root\.contains\(slot\) && !slot\.disabled\) showCard\(slot\); else hideCard\(\);\r?\n\s*peekAt\(ev\.target\);/);
});

test("a refused face can still say why, which is what aria-disabled buys", () => {
  // The small name box carried the refusal, and a truly `disabled` button fires
  // no pointer events — so deleting the box while keeping `disabled` would have
  // left a grey circle that cannot explain the law it is enforcing. Same trade
  // the gated seats made.
  assert.match(MOUNT, /aria-pressed="\$\{on\}" aria-disabled="\$\{!f\.allowed\}"/, "refused is aria-disabled");
  assert.doesNotMatch(MOUNT, /\$\{f\.allowed \? "" : " disabled"\}/, "and not the real attribute any more");
  assert.match(MOUNT, /if \(faceBtn\.getAttribute\("aria-disabled"\) === "true"\) return;/,
    "so the press is refused here instead — and swallowed, not fallen through");
  assert.match(MOUNT, /<div class="who">\$\{esc\(name\)\} <span class="tag cold">cannot act here<\/span><\/div>\r?\n\s*<div class="spine">\$\{esc\(f\.reason \?\? "not here"\)\}<\/div>/,
    "and the plate carries the door's own reason");
  assert.match(MOUNT, /\.pmc-face\[aria-disabled="true"\] \{ opacity: \.4; cursor: not-allowed; \}/,
    "greyed by the same attribute that keeps it hoverable");
});

test("the journalling disclosure is on the plate, and only over your own seat", () => {
  // ⚑ IT WAS ORPHANED BY A REWRITE, not by a ruling. The line began as the
  // dock's native `title`, moved onto the plate when that tooltip became a third
  // card on one hover, and went out with the standpoint recitation when the
  // plate was emptied — leaving nothing on this surface saying what the hand
  // records. A disclosure about what the surface RECORDS is not a sentence to
  // lose by accident, so it is back.
  assert.match(MOUNT, /the hand journals on every act — recorded, never gated/,
    "the law is on the surface, in its own words");
  assert.match(MOUNT, /\$\{kitHtml\(s\)\}\r?\n\s*\$\{journalLine\(who\)\}/, "under the fighter's own rows");
  // AND NARROWED, which is the honest half of putting it back. The plate's rule
  // is that it is about the fighter you are pointing at — the ground's sentence
  // was taken off it for exactly that reason — and this line is about the
  // SURFACE. Over an ally's hit points it would be a claim about that ally.
  assert.match(MOUNT, /function journalLine\(who\) \{\r?\n\s*if \(who !== state\.acting\) return "";/,
    "silent over anyone but the seat being acted as");
  // the can-fail control: the plate really does draw for someone who is NOT the
  // acting seat, so "only over your own seat" is a live branch and not a
  // condition that never comes up.
  assert.match(MOUNT, /const who = state\.peek \?\? state\.acting;/,
    "the plate follows the pointer, so a non-acting `who` is the ordinary case");
});

test("the import list carries nothing it no longer calls", () => {
  // `briefWords` shortened the door's sentence to fit the small name box. The
  // box was deleted; the import outlived its only caller by a few hours. The
  // function itself had no other caller and no test, so it has been deleted
  // from world-cockpit.mjs too. These pins stay so the name does not come back
  // into the import list, since a mount that imports what it never calls is a
  // reader's false lead about where a function is used.
  assert.doesNotMatch(MOUNT, /^\s*pxToWorld, recentVoices, faceImageFor, briefWords,$/m,
    "not on the import line");
  assert.doesNotMatch(MOUNT, /briefWords\(/, "and not called anywhere in the file");
});

test("an exit tells the pane behind it, from the act's own answer", () => {
  // ⚑ FOUNDER, 2026-08-29: he exited as rei, the door took it, and he was still
  // looking at the inside of the vault. The viewer mounts the interior off
  // occupancy, which it folds out of the enter-exit ledger on a clock — so
  // between the act landing and the next read the page drew a room its reader
  // had left. An act is the one moment we know the record changed and know which
  // way, so the pane is told rather than left to find out.
  assert.match(MOUNT, /function announceStoodOut\(left\) \{/);
  assert.match(MOUNT, /w\.dispatchEvent\(new w\.CustomEvent\("pm:stood-out", \{ detail: \{ left \} \}\)\);/,
    "the same guarded window-event shape as the dock and feed seams beside it");
  assert.match(MOUNT, /if \(leftRoom && !stillInside\) announceStoodOut\(leftRoom\);/,
    "and only where a room was actually left — see the refusal test below for why the second half is there");
  // ⚑ READ BEFORE THE ACT, which is the whole of "drive from the answer": after
  // it the standpoint is the new one and the room left is not in it any more.
  assert.match(MOUNT, /const leftRoom = action === "exit" \? leavingName\(state\.answer\)\?\.id \?\? null : null;/,
    "captured up front, by the same reader the panel printed to the reader");
  // ⚑ AND BEING INSIDE THE OK BRANCH WAS NEVER ENOUGH, which is what this
  // assertion used to claim and what the founder disproved live: a refused act
  // came back 200 and reached that branch. The real guard is the receipt, and it
  // is asserted in "a refusal wearing a 200" below.
  assert.match(MOUNT, /if \(res\.ok && !defect\) \{[\s\S]{0,4400}?if \(leftRoom && !stillInside\) announceStoodOut\(leftRoom\);/,
    "inside the accepted branch, and past the receipt");
});

test("an act with nothing to fill in gets a bare card: who, one line, confirm", () => {
  // ⚑ FOUNDER, 2026-08-29, on the live exit confirm: a threshold's prose, a
  // from/to pair, an input whose own help text admitted it was optional, and
  // four term rows — in front of a single unavoidable press. His shape: "exit
  // takes NO input — WHO + one plain line + confirm. Terms stay reachable via
  // the fine-print expander."
  assert.match(MOUNT, /const bare = c\.fields\.every\(\(f\) => !f\.required && filled\[f\.name\] == null\);/,
    "one reading of whether this panel has anything in it to fill");
  assert.match(MOUNT, /const nothingToType = bare;/,
    "and the keys line reads the same one, so the two cannot disagree");
  assert.match(MOUNT, /const terms = shown \? consentHtml\(shown, c, \{ fold: bare \}\) : "";/,
    "on a bare card the term rows fold");
  // WHAT SURVIVES THE FOLD is the register he called GOOD — the dial facts. A
  // fix that cost him "lifts to 8 · ends turn" would be a worse card than the
  // one he complained about.
  assert.match(MOUNT, /const shownRows = fold \? \[\] : brief;/);
  assert.match(MOUNT, /\$\{speak \? `<span class="pmc-term"><b>this act<\/b> \$\{esc\(speak\)\}<\/span>` : ""\}/,
    "the dial line is outside the fold, on every card");
  // ⚑ AND NOTHING IS DROPPED — folding is showing, refusing to render is not.
  // The whole of what the door sent goes into the expander, not just the half
  // that did not fit.
  assert.match(MOUNT, /const hidden = fold \? termsRows\(terms\) : fine;/,
    "a folded card hides every row, and hides ALL of them — not brief-minus-fine");
  assert.match(MOUNT, /\$\{hidden\.length \? `<details>/, "and the expander is rendered whenever there is anything in it");
  // the orphan chrome goes too: a datalist belongs to an input
  assert.match(MOUNT, /\$\{inputs \? datalist : ""\}/,
    "no candidate list on a card with no field to attach it to");
});

test("the bare-card rule is a SHAPE, not a list of verbs the founder complained about", () => {
  // ⚑ THREE NAMED INSTANCES — exit, then lift, then guard, on three separate
  // reports. Their only shared thing is the composer that builds their confirm,
  // which is why this is fixed once and asserted once rather than per verb.
  //
  // THE CAN-FAIL CONTROL IS THE ABSENCE OF A LIST. If any of these rules were
  // keyed on an act's NAME, a fourth no-input act would arrive with the same
  // faults and every other assertion here would still pass.
  const flavour = /const entering = ENTER_ACTS\.has\(card\?\.action\);/.exec(MOUNT);
  assert.ok(flavour, "the flavour rule reads a SET of entering acts");
  assert.doesNotMatch(MOUNT, /const bare = [^\n]*(exit|guard|lift)/,
    "the bare-card test names no verb");
  assert.doesNotMatch(MOUNT, /consentHtml\(shown, c, \{ fold: [^)]*(exit|guard|lift)/,
    "nor does the folding");
  assert.match(MOUNT, /const bare = c\.fields\.every\(\(f\) => !f\.required && filled\[f\.name\] == null\);/,
    "it is the card's own shape: nothing required, nothing prefilled");

  // AND THE ONE PLACE A NAME IS UNAVOIDABLE says why, and is the narrowest kind.
  // `SELF_DIRECTED` is a name-keyed list because the office hands all the arena
  // acts ONE shared field object — the card genuinely cannot tell us — and that
  // debt is written down where the list is.
  assert.match(MOUNT, /const SELF_DIRECTED = \["guard", "loot", "pass", "exit"\];/);
  assert.match(MOUNT, /THE CARD CANNOT TELL ME, which is the whole reason this list exists/,
    "the reason the list exists is written beside it");

  // ⚑ AND ENTRY PROSE IS THE ENTER ACT'S, WHICHEVER ACT ASKS. A no-input act is
  // not the test for it — a fifth act with a field would have carried the room's
  // welcome just as wrongly.
  assert.match(MOUNT, /const ENTER_ACTS = new Set\(\["enter"\]\);/);
  assert.match(MOUNT, /const said = \(entering \? portalOf\(state\.answer\)\?\.body : null\) \|\| card\?\.blurb \|\| null;/,
    "gated on the ACT, not on whether the card happens to be bare");
});

test("a refusal wearing a 200 is a refusal, and it never moves the camera", () => {
  // ⚑ FOUNDER, live, party night: he exited the vault, the camera stepped
  // outside, and the RECORD still had him inside it — portal the-candle-vault,
  // xy unchanged. Every later exit card then honestly offered the vault again,
  // which reads as stuck. The office had refused the act (an arena gates movement
  // to whoever the wheel is on) and answered 200 with a defect in the body.
  //
  // TWO FAULTS, ONE CAUSE. `res.ok` is the HTTP layer's word; the DOOR's word is
  // in the body. This branch took the transport's yes for the door's, so it said
  // "done — the door took it", swallowed the sentence naming whose turn it was,
  // and fired the camera event.
  assert.match(MOUNT, /const defect = typeof res\.body\?\.defect === "string" && res\.body\.defect \? res\.body\.defect : null;/,
    "the body is read for a refusal");
  assert.match(MOUNT, /if \(res\.ok && !defect\) \{/, "and a defect takes the refusal path, whatever the status was");
  // …which already knew how to render the door's own words; all that was missing
  // was arriving at it
  assert.match(MOUNT, /const b = readBounce\(res\.body, res\.status\);\r?\n\s*state\.said = \{ ok: false, text: b\.defect, hint: b\.hint, terms: b\.terms \};/,
    "the defect and its hint are shown, never swallowed");

  // ⚑ AND THE CAMERA MOVES ONLY ON A RECEIPT. Not on the ok branch — a
  // refused-with-200 reached that — but on a fact that could not exist unless
  // the act landed: the refreshed standpoint's portal is no longer the room.
  assert.match(MOUNT, /const stillInside = portalOf\(state\.answer\)\?\.id === leftRoom;\r?\n\s*if \(leftRoom && !stillInside\) announceStoodOut\(leftRoom\);/,
    "the event fires on the answer's own evidence of having left");
  assert.doesNotMatch(MOUNT, /^\s*if \(leftRoom\) announceStoodOut\(leftRoom\);$/m,
    "the fire-on-asking version is gone, not merely guarded");
  // WHERE THERE IS NO REFRESH THERE IS NO MOVE: state.answer is unchanged, so
  // stillInside stays true and the pane waits for the ledger's own clock — the
  // behaviour this replaced, and the safe direction to fail in.
  assert.match(MOUNT, /Silence is the right failure here; a camera that guesses is not\./);
});

test("the combat rail follows the WHEEL, not the mount", () => {
  // ⚑ FOUNDER, on prod, live: "the combat rail is only supposed to be there WHEN
  // you're in the combat." The reshape was fired once at mount — and the cockpit
  // mounts on any portal ground at all, so a resident standing in the POST OFFICE
  // turned the viewer's Lately section into a combat feed: flipped, capped to a
  // scrollport, holding fourteen town says and not one beat. The chip said the
  // world root and the rail said a fight was happening.
  assert.doesNotMatch(MOUNT, /dockSignal\(true\);\r?\n\s*feedSignal\(true\);/,
    "the unconditional reshape at mount is gone");
  assert.match(MOUNT, /const inCombat = \(\) => Boolean\(encounterOf\(state\.answer\)\);/,
    "a fight is a live wheel — the same reader every other combat surface asks");
  assert.match(MOUNT, /function syncFeedPresence\(\) \{[\s\S]{0,400}?feedSignal\(live\);/,
    "and the reshape is hung on it");
  // ASKED AGAIN ON EVERY PAINT, because a wheel can arrive or end between two of
  // them — the founder's own case is the ending one, where the rail must go back
  // to being a rail.
  assert.match(MOUNT, /resolveActing\(\);\r?\n\s*\/\/ the wheel can arrive or end between two paints[\s\S]{0,140}?syncFeedPresence\(\);/,
    "re-asked on every repaint, not decided once");
  // THE COCKPIT'S OWN LIST GOES WITH IT. An empty <ol> left in the viewer's
  // section is a fight's furniture standing in a rail that is not a feed.
  assert.match(MOUNT, /if \(!live\) \{\r?\n\s*feedList\?\.remove\(\); feedList = null;\r?\n\s*feedNew\?\.remove\(\); feedNew = null;/,
    "the list is taken down with the reshape");
  // ⚑ AND THE GUARD THAT MAKES IT HOLD RATHER THAN MERELY START OUT TRUE: a beat
  // arriving from an act answer calls ensureFeed directly, so without this one
  // line ingested outside a fight would build the list straight back.
  assert.match(MOUNT, /function ensureFeed\(\) \{[\s\S]{0,420}?if \(!inCombat\(\)\) return null;/,
    "no wheel, no feed, at the one door that builds it");
});

test("…and the reshape really does arrive with a wheel — the can-fail control", () => {
  // Without this the test above passes just as well on a cockpit that NEVER
  // reshapes anything, which would be a different bug wearing the same green.
  const withWheel = encounterOf(VAULT);
  assert.ok(withWheel && withWheel.order.length > 0, "the vault fixture carries a live wheel");
  const quiet = { ...VAULT, encounter: undefined };
  assert.equal(encounterOf(quiet), null, "and a standpoint with no encounter carries none");
  // an encounter whose order is empty is not a fight either — the reader already
  // says so, and the rail inherits that for free
  assert.equal(encounterOf({ ...VAULT, encounter: { ...VAULT.encounter, order: [] } }), null,
    "nor is a wheel with nobody on it");
});
