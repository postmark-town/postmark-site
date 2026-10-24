// world-cockpit.test.mjs — the portal cockpit's arithmetic, without a browser.
//
//   node --test test/world-cockpit.test.mjs
//
// Every assertion below carries the sentence of law it is asserting, quoted where
// that law is written down, because a brief is lossy and a test that paraphrases
// its own reason drifts away from it silently. Where a claim is the SITE's own
// contract rather than the world's, it says so in those words.
//
// The fixtures are shaped from real answers read off the live door on 2026-08-26
// (`GET https://postmark.town/api/world/apex`), signed in and signed out, plus one
// invented ground carrying verbs that do not exist yet — which is the case the bar
// is actually for.

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** The module's own source, for the assertion that it does not name the dungeon's
 *  verbs. Read from disk rather than imported, because that check is about text. */
const COCKPIT_SOURCE = readFileSync(fileURLToPath(new URL("../src/lib/world-cockpit.mjs", import.meta.url)), "utf8");

import {
  FIXED_SLOTS, HUMAN_ACTOR, HUMAN_TOKENS, MAX_KEYED,
  actorsFor, barSlots, cardOf, cockpitShows, dialLine, dispatchEnvelope,
  gridFrom, ownParcelIn, portalOf, readBounce, statedLimit, tokenFor, tokenPlacement,
  termsFromRead, termsRows, wantsTextarea, worldToPx,
  blockedReason, encounterOf, fighterState, looseThings, rollsFrom, spaceOf, yourTurnRow,
  actCandidates, adversaryOf, adversaryPlacement, chatField, chatShaped, prefillFor,
  pxToWorld, recentVoices,
} from "../src/lib/world-cockpit.mjs";
import { COCKPIT_CSS } from "../src/lib/world-cockpit-mount.mjs";

// ── fixtures ────────────────────────────────────────────────────────────────

/** An entry in the door's own shape, as `world-apex.mjs` emits it. */
const entry = (action, extra = {}) => ({
  action,
  blurb: `the ${action} class's own sentence`,
  blurb_from: `the-town/${action}`,
  from: "the-town/resident",
  class: "resident",
  fields: { text: { type: "string", description: `what you ${action}` } },
  dispatches_to: `world_${action}`,
  via: "ambient",
  grant: "yours",
  ...extra,
});

/** Signed in, standing on ordinary town ground. Twelve verbs, all `grant: "yours"`,
 *  `granted.here` empty — measured off the live door 2026-08-26. */
const SIGNED_IN = {
  standpoint: { x: -95120, y: -95120, from: "where your walk arrived", stance: "embodied" },
  within: [{ id: "the-town/let-there-be-light", by: "the-town", tier: "constitution" }],
  actions: ["say", "walk", "enter", "exit", "leave-mark", "withdraw", "stake", "unstake", "give", "drop", "take", "note-to-self"].map((a) => entry(a)),
  granted: { yours: ["say", "walk", "enter", "exit", "leave-mark", "withdraw", "stake", "unstake", "give", "drop", "take", "note-to-self"], here: [] },
};

/** Signed OUT, same ground. The SAME twelve verbs, every one stamped `grant: "here"`
 *  — also measured off the live door 2026-08-26. This asymmetry is the whole reason
 *  the tray is not keyed on `grant`. */
const ANONYMOUS = {
  standpoint: { x: 0, y: 0, from: "coords", stance: "spectator" },
  within: [{ id: "the-town/let-there-be-light", by: "the-town", tier: "constitution" }],
  actions: SIGNED_IN.actions.map((e) => ({ ...e, grant: "here" })),
  granted: { yours: [], here: SIGNED_IN.granted.yours.slice() },
};

/** Inside a portal, with verbs no line of site code has ever named. */
const INSIDE_PORTAL = {
  standpoint: {
    x: 120, y: -40, from: "where your walk arrived", stance: "embodied",
    portal: { id: "the-town/the-lanternstep-door", value: "the-town/the-lanternstep-hall", by: "the-town", body: "A door stands here." },
  },
  within: [
    { id: "the-town/let-there-be-light", by: "the-town", tier: "constitution" },
    { id: "the-town/the-lanternstep-hall", by: "the-town", tier: "constitution" },
  ],
  actions: [
    entry("say"),
    entry("walk"),
    { ...entry("strike"), class: "combatant", from: "the-hall/combatant", grant: "here", blurb: "A strike is one blow written where you stand — it lands or it does not, and the record keeps both.", blurb_from: "the-hall/strike", dials: { reach_m: 2, cooldown_crossings: 0 }, fields: { at: { type: "string", description: "who or what you strike", required: true } } },
    { ...entry("loot"), class: "combatant", from: "the-hall/combatant", grant: "here", blurb: "", blurb_from: "the-hall/loot", fields: {} },
  ],
  granted: { yours: ["say", "walk"], here: ["strike", "loot"] },
};

const ME = { household: "starforge", handles: ["jetto-of-starforge"], verified_github: { login: "keeminlee", id: 1 }, key_kind: "oauth", principal: true };
const MACHINE_KEY = { household: "starforge", handles: ["jetto-of-starforge"], verified_github: null, key_kind: "static" };

// ── the bar renders the door, and only the door ─────────────────────────────

test("a verb the site has never named renders from its own card", () => {
  // LOGOS/reads-and-affordances.md § The apex: "Bare, it answers where you stand
  // and what the ground affords; the affordance list is the permission calculus
  // over the class tree at your standpoint".
  //
  // So an act the bar has no code for must still arrive whole. `strike` and `loot`
  // appear in no constant in world-cockpit.mjs — the assertion below proves that
  // by reading the module's own source, because a test that merely passed would
  // also pass the day somebody added them to a list.
  assert.ok(!/\bstrike\b/.test(COCKPIT_SOURCE), "world-cockpit.mjs must not name `strike`");
  assert.ok(!/\bloot\b/.test(COCKPIT_SOURCE), "world-cockpit.mjs must not name `loot`");

  const { fixed, tray } = barSlots(INSIDE_PORTAL);
  assert.deepEqual(tray.map((t) => t.action), ["strike", "loot"]);
  assert.equal(tray[0].label, "STRIKE");
  assert.equal(tray[0].card.blurb, "A strike is one blow written where you stand — it lands or it does not, and the record keeps both.");
  assert.equal(tray[0].card.blurbFrom, "the-hall/strike");
  assert.deepEqual(tray[0].card.fields.map((f) => f.name), ["at"]);
  assert.equal(tray[0].card.fields[0].required, true);
  // and the fixed six still hold their seats beside it
  assert.equal(fixed.length, FIXED_SLOTS.length);
  assert.equal(fixed[0].action, "walk");
});

test("the card never writes a blurb the door did not send", () => {
  // The mockup's card: "blurb quoted from the class mark that grants it". A blurb
  // is a class mark's own body — town law — so a sentence the site composed and
  // showed in that slot would be prose impersonating law.
  const looted = barSlots(INSIDE_PORTAL).tray.find((t) => t.action === "loot");
  assert.equal(looted.card.blurb, null, "an empty blurb must read as absent, never be filled");
  assert.equal(looted.card.blurbFrom, "the-hall/loot", "…while the door's pointer to the class still shows");
});

test("the dials row appears only when the class has dials", () => {
  // office src/world-apex.mjs emits it conditionally:
  //   ...(residue?.dials && Object.keys(residue.dials).length ? { dials: residue.dials } : {})
  // Today's resident-class acts carry none — the live answer on 2026-08-26 had no
  // `dials` key on any of the twelve. So an absent row is correct, not a hole.
  const bar = barSlots(INSIDE_PORTAL);
  const say = bar.fixed.find((s) => s.action === "say");
  assert.equal(say.card.dials, null);
  assert.equal(dialLine(say.card), "", "no dials: say nothing, and never invent a cost");

  const strike = bar.tray.find((t) => t.action === "strike");
  assert.deepEqual(strike.card.dials, { reach_m: 2, cooldown_crossings: 0 });
  assert.equal(dialLine(strike.card), "reach_m 2 · cooldown_crossings 0");
});

test("the tray is not keyed on `grant` — signed out, WALK is still a fixed slot", () => {
  // The field READS like the mockup's tray rule ("`here` is the ground's and the
  // reach's") but office src/world-apex.mjs computes it as
  //   for (const e of actions) e.grant = embodied && e.class === "resident" ? "yours" : "here";
  // so signed out every ordinary verb is `here`. A tray keyed on it would sweep
  // WALK, SAY and MARK out of their fixed seats for every visitor who is not
  // signed in — measured against the live door, all twelve.
  const anon = barSlots(ANONYMOUS);
  assert.deepEqual(anon.fixed.map((s) => s.action), FIXED_SLOTS.map((s) => s.action));
  assert.ok(anon.fixed.every((s) => s.afforded), "every fixed slot is afforded here");
  assert.deepEqual(anon.tray.map((t) => t.action), ["enter", "exit", "withdraw", "stake", "unstake", "drop"]);
  // and the seats are IDENTICAL signed in, where the same verbs are all `yours`
  const inn = barSlots(SIGNED_IN);
  assert.deepEqual(inn.fixed.map((s) => s.action), anon.fixed.map((s) => s.action));
  assert.deepEqual(inn.tray.map((t) => t.action), anon.tray.map((t) => t.action));
});

test("a fixed slot keeps its seat when the ground does not grant it", () => {
  // Seed call ③'s recommendation, which the mockup takes: "fixed familiar slots …
  // game-literate muscle memory". Muscle memory is worth nothing if the seat moves,
  // so an ungranted act is greyed in place rather than removed.
  const thin = { ...INSIDE_PORTAL, actions: [entry("say")] };
  const { fixed } = barSlots(thin);
  assert.equal(fixed.length, 6);
  assert.equal(fixed[3].action, "give");
  assert.equal(fixed[3].key, 4, "GIVE stays the fourth key even where nothing may be given");
  assert.equal(fixed[3].afforded, false);
  assert.equal(fixed[3].card, null);
  assert.equal(fixed[1].action, "say");
  assert.equal(fixed[1].afforded, true);
});

test("keys run out rather than wrapping", () => {
  const many = { ...INSIDE_PORTAL, actions: Array.from({ length: 12 }, (_, i) => entry(`verb-${i}`)) };
  const { fixed, tray } = barSlots(many);
  const keyed = [...fixed, ...tray].filter((s) => s.key != null);
  assert.equal(keyed.length, MAX_KEYED);
  assert.deepEqual(keyed.map((s) => s.key), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.ok(tray.slice(3).every((s) => s.key === null), "past the ninth a slot is mouse-only, not silently re-keyed");
});

// ── portal ground, and the founder's scope ruling ───────────────────────────

test("with no portal field the cockpit does not exist", () => {
  // The founder's scope ruling, 2026-08-26: the cockpit UX ships ONLY inside
  // portal ground; the world page outside portals keeps today's chrome untouched.
  // Today's door sends no portal field at all, so an unmodified door leaves every
  // visitor's page exactly as it is.
  assert.equal(portalOf(SIGNED_IN), null);
  assert.equal(cockpitShows(SIGNED_IN), false);
  assert.equal(cockpitShows(ANONYMOUS), false);
  assert.equal(cockpitShows({}), false);
});

test("the site does not sniff for a portal it was not told about", () => {
  // LOGOS/reads-and-affordances.md § The apex: "the affordance list IS the
  // permission calculus at your standpoint". A site-side guess at what ground it
  // is standing in is the site running its own calculus beside the door's.
  const looksPortal = {
    standpoint: { x: 0, y: 0, stance: "embodied" },
    within: [
      { id: "the-town/the-works-portal", by: "the-town", tier: "constitution" },
      { id: "logos/the-logos-portal", by: "logos", tier: "constitution" },
    ],
    actions: [],
  };
  assert.equal(portalOf(looksPortal), null, "two real portal ids in the spine, and still no");
  assert.equal(cockpitShows(looksPortal), false);
});

test("the portal contract, when the door speaks it", () => {
  // SITE-DEFINED CONTRACT, 2026-08-26 (awaiting the core lane):
  //   standpoint.portal = { id, value, by?, body? }, absent when not inside one.
  // Grounded in postmark-world LOGOS/classes.md: "portal, a child of postmark-edge,
  // is the door between the dimensions … crossing a portal changes what you read,
  // never where you stand".
  const p = portalOf(INSIDE_PORTAL);
  assert.equal(p.id, "the-town/the-lanternstep-door");
  assert.equal(p.value, "the-town/the-lanternstep-hall");
  assert.equal(p.by, "the-town");
  // ⚑ SUPERSEDED (founder, 2026-08-30, post-party): a portal alone no longer
  // mounts the cockpit — it is combat chrome, mounted only where a fight is
  // live. The portal CONTRACT above is unchanged; only the mount gate moved.
  assert.equal(cockpitShows(INSIDE_PORTAL), false,
    "a quiet portal keeps the viewer's rail — the dock is combat chrome now");
  assert.equal(cockpitShows({ ...INSIDE_PORTAL, encounter: { order: [{ id: "x", kind: "creature" }] } }), true,
    "…and the same portal mid-fight mounts it");
  // a portal object with no id is not a portal
  assert.equal(portalOf({ standpoint: { portal: { value: "x" } } }), null);
});

// ── the ACT AS roster ───────────────────────────────────────────────────────

test("when the door answers the roster, the site stops deriving", () => {
  // SITE-DEFINED CONTRACT: `answer.actors` is the door's own roster, and the whole
  // point of it is that the permission calculus lives with the door. So the site
  // must pass it through — including a `false` it would itself have computed true.
  const withActors = {
    ...INSIDE_PORTAL,
    actors: [
      { kind: "resident", handle: "jetto-of-starforge", label: "jetto-of-starforge", allowed: true },
      { kind: "human", id: "keeminlee", label: "DARKO", allowed: false, reason: "the hall is closed to hands tonight" },
    ],
  };
  const faces = actorsFor(withActors, ME);
  assert.equal(faces.length, 2);
  assert.equal(faces[1].allowed, false, "the door's no survives a ground the site would have said yes to");
  assert.equal(faces[1].reason, "the hall is closed to hands tonight");
  assert.ok(faces.every((f) => f.from === "the door"));
});

test("inside portal ground any signed-in human may act as themselves", () => {
  // The portals-are-the-playground ruling (founder, 2026-08-24), carried in the
  // sitting seed: "The dungeon extends the same bar to humans-as-themselves inside
  // portals — the designated-playground ruling doing its job."
  const faces = actorsFor(INSIDE_PORTAL, ME);
  const human = faces.find((f) => f.kind === "human");
  assert.equal(human.allowed, true);
  assert.equal(human.id, "keeminlee");
  assert.equal(human.label, "DARKO");
  assert.match(human.because, /a portal's ground seats a human/);
  assert.equal(human.reason, null);
});

test("on ordinary ground the human face is denied, and says why", () => {
  const human = actorsFor(SIGNED_IN, ME).find((f) => f.kind === "human");
  assert.equal(human.allowed, false);
  assert.match(human.reason, /this ground does not seat a human/);
  assert.equal(human.because, null, "no ruling lit it, so none is named");
});

test("on your household's own parcel your own human may act", () => {
  // The parcel-embodied-human law (being built in the world/office lane): on a
  // parcel, only the parcel's household's own human. A parcel's `by` is its
  // household's own resident, which is how every id in the world reads.
  const onMine = {
    standpoint: { x: 10, y: 10, stance: "embodied" },
    within: [
      { id: "the-town/let-there-be-light", by: "the-town", tier: "constitution" },
      { id: "jetto-of-starforge/the-waystation-parcel", by: "jetto-of-starforge", kind: "parcel", tier: "home" },
    ],
    actions: [entry("say")],
  };
  const mine = actorsFor(onMine, ME).find((f) => f.kind === "human");
  assert.equal(mine.allowed, true);
  assert.match(mine.because, /your household's own parcel/);

  // and NOT on somebody else's
  const onTheirs = { ...onMine, within: [onMine.within[0], { id: "vermillion/the-pando-peak-parcel", by: "vermillion", kind: "parcel", tier: "home" }] };
  const theirs = actorsFor(onTheirs, ME).find((f) => f.kind === "human");
  assert.equal(theirs.allowed, false, "another household's parcel seats THEIR human, not yours");
  assert.equal(ownParcelIn(onTheirs, ME.handles), null);
});

test("a key with no verified human gets no human face at all", () => {
  // `GET /api/me` answers `verified_github: { login, id }` only for an OAuth key
  // (office src/queries.mjs `identityOf`). A static machine key holds residents and
  // no person, so there is nobody for the face to be.
  const faces = actorsFor(INSIDE_PORTAL, MACHINE_KEY);
  assert.equal(faces.length, 1);
  assert.equal(faces[0].kind, "resident");
  assert.ok(!faces.some((f) => f.kind === "human"));
});

// ── dispatch ────────────────────────────────────────────────────────────────

test("a human's act names the person AND the standing it is oriented from", () => {
  // THE TWO WORDS ANSWER TWO QUESTIONS. `as: "human"` says who is acting; `handle`
  // says which of your residents' standing the key is oriented from. A key in this
  // town holds many residents, so an act naming neither is refused at ORIENT,
  // before the human seam is reached at all — and it then reads as "your act was
  // refused" when it was only unaddressed.
  //
  // THIS REVERSES THE SHAPE ASSERTED HERE ON 2026-08-26, and that reading is kept
  // because it was not wrong, only incomplete: "handle is 'which of YOUR residents
  // acts'; a human is not one of them, so putting the human there would make a
  // person's act indistinguishable from a resident's in the record." Still true.
  // It is why `as` is still the field that says a person acted, and why `handle`
  // is never asked to carry that meaning — it carries the standpoint, not the
  // actor. The old assertion was `!("handle" in asHuman)`.
  const asHuman = dispatchEnvelope({
    action: "strike", args: { at: "the-lantern" },
    acting: HUMAN_ACTOR, handle: "wright-of-postmark",
  });
  assert.deepEqual(asHuman, { do: "strike", args: { at: "the-lantern" }, as: "human", handle: "wright-of-postmark" });

  // and the human is STILL not in `handle` as the actor — drop the standing and
  // the person is named by `as` alone, exactly as before.
  const noStanding = dispatchEnvelope({ action: "strike", args: {}, acting: HUMAN_ACTOR });
  assert.deepEqual(noStanding, { do: "strike", args: {}, as: "human" });

  const asResident = dispatchEnvelope({ action: "say", args: { text: "hello" }, acting: "jetto-of-starforge" });
  assert.deepEqual(asResident, { do: "say", args: { text: "hello" }, handle: "jetto-of-starforge" });
  assert.ok(!("as" in asResident), "an ordinary act carries no `as`, so today's door is unchanged by it");
  // A resident acting is oriented by the resident who acts. The key's standing is
  // not allowed to override that: it would silently reroute the act to somebody
  // else's feet, which is worse than the bounce it is avoiding.
  const otherKey = dispatchEnvelope({ action: "say", args: {}, acting: "jetto-of-starforge", handle: "wright-of-postmark" });
  assert.equal(otherKey.handle, "jetto-of-starforge");
});

test("a bounce carrying terms is a question, not a failure", () => {
  // The `enter` card's own `accept` field: "Call once without it to READ the terms;
  // call again with it to cross." So a first call that comes back with terms has
  // performed nothing and is asking.
  const asked = readBounce({ error: "bounce", defect: "this door declares a counter-edge", hint: "call again with accept: true", terms: { binds: "the-town/enter" } }, 422);
  assert.equal(asked.needsAccept, true);
  assert.equal(asked.hint, "call again with accept: true");
  assert.deepEqual(asked.terms, { binds: "the-town/enter" });

  const plain = readBounce({ error: "bounce", defect: "not afforded where you stand", hint: "it is afforded at the-town/the-deck" }, 422);
  assert.equal(plain.needsAccept, false);
  assert.equal(plain.hint, "it is afforded at the-town/the-deck", "the hint is where the door says what to do instead — never swallowed");
});

// ── the map transform ───────────────────────────────────────────────────────

test("the grid is read from the skeleton, in the viewer's own two regexes", () => {
  // spectator/viewer.mjs mounts the atlas with exactly this pair, off
  // `data.skeleton._grid`. The string below is the live /WORLD/skeleton.json on
  // 2026-08-26, copied whole.
  const live = {
    _grid: {
      cell_m: 1,
      scale: "5 m per atlas px (RULED 2026-07-17)",
      origin: "Ferry's crossing — center of the Town Centre, atlas (485,760); x east, y south, z in meters above sea (decision 008)",
    },
  };
  const g = gridFrom(live);
  assert.deepEqual(g, { originPx: { x: 485, y: 760 }, mPerPx: 5 });
});

test("a skeleton whose _grid changed shape draws nothing rather than drawing wrong", () => {
  // The viewer throws "skeleton _grid changed shape" on the same input. Here the
  // token simply is not placed — the same failure, in the register a decoration
  // gets. A default of 1 m/px would put the token a hundred kilometres away and
  // look exactly like a working feature.
  assert.equal(gridFrom({ _grid: { scale: "5 m per atlas px", origin: "no coordinates here" } }), null);
  assert.equal(gridFrom({ _grid: { origin: "(485,760)", scale: "five metres a pixel" } }), null);
  assert.equal(gridFrom({ _grid: { origin: "(485,760)", scale: "0 m per atlas px" } }), null, "a zero scale divides by zero, so it is a changed shape");
  assert.equal(gridFrom({}), null);
  assert.equal(worldToPx(null, { x: 1, y: 1 }), null);
});

test("world metres land where the viewer would put them", () => {
  // TWO LEGS, because one is not enough. The first re-derives the viewer's own
  // formula (spectator/viewer.mjs drawWalkers):
  //   px(m) = { x: originPx.x + m.x / mPerPx, y: originPx.y + m.y / mPerPx }
  // and the second pins a concrete point, so a formula rewritten into agreement
  // with itself still has to hit the same pixel.
  const g = { originPx: { x: 485, y: 760 }, mPerPx: 5 };
  const m = { x: -95120, y: -95120 };
  assert.deepEqual(worldToPx(g, m), { x: g.originPx.x + m.x / g.mPerPx, y: g.originPx.y + m.y / g.mPerPx });
  assert.deepEqual(worldToPx(g, m), { x: -18539, y: -18264 });
  // the town centre's own origin is the origin
  assert.deepEqual(worldToPx(g, { x: 0, y: 0 }), { x: 485, y: 760 });
});

// ── the human's own token ───────────────────────────────────────────────────

test("the token is drawn only where the record says a human is embodied", () => {
  // On this map a face means "this person is here" — the viewer's own walker
  // comment: "Read the ring for state, the face for who." Drawing one because the
  // site believes a human is acting would be a claim the record does not make.
  const g = { originPx: { x: 485, y: 760 }, mPerPx: 5 };
  const human = { kind: "human", id: "keeminlee", label: "DARKO" };

  assert.equal(tokenPlacement(INSIDE_PORTAL, g, human), null, "stance embodied — a RESIDENT is acting, so no human token");
  assert.equal(tokenPlacement(ANONYMOUS, g, human), null, "stance spectator — nobody is embodied");

  // SITE-DEFINED CONTRACT: `standpoint.stance` gains "embodied-human" beside the
  // "spectator" and "embodied" world-apex.mjs computes today.
  const embodiedHuman = { ...INSIDE_PORTAL, standpoint: { ...INSIDE_PORTAL.standpoint, stance: "embodied-human" } };
  const p = tokenPlacement(embodiedHuman, g, human);
  assert.deepEqual(p.at, { x: 485 + 120 / 5, y: 760 + -40 / 5 });
  assert.equal(p.token.src, "/birthday/darko-token.png");
  assert.equal(p.token.label, "DARKO");

  // and a resident actor never gets one, whatever the stance says
  assert.equal(tokenPlacement(embodiedHuman, g, { kind: "resident", handle: "jetto-of-starforge" }), null);
});

test("the door's token wins over the site's registry", () => {
  // SITE-DEFINED CONTRACT: `actor.token_url`. The registry here is a placeholder
  // for exactly the reason the blurbs come from the door — the site should not
  // hold a table of who looks like what — so the day the door names one, the
  // table stops being consulted.
  const fromDoor = tokenFor({ kind: "human", id: "keeminlee", label: "DARKO", token_url: "https://media.postmark.town/x.png" });
  assert.equal(fromDoor.src, "https://media.postmark.town/x.png");
  assert.equal(fromDoor.from, "the door");

  const fromTable = tokenFor({ kind: "human", id: "keeminlee", label: "DARKO" });
  assert.equal(fromTable.src, HUMAN_TOKENS.keeminlee.src);
  assert.equal(fromTable.from, "the site's registry");

  // every other human gets an honest monogram, never a borrowed picture
  const stranger = tokenFor({ kind: "human", id: "somebody-else", label: "somebody-else" });
  assert.equal(stranger.src, null);
  assert.equal(stranger.monogram, "S");
  assert.equal(stranger.from, "monogram");

  assert.equal(tokenFor({ kind: "resident", handle: "jetto-of-starforge" }), null);
});

// ── the form reads the door's stated limits ─────────────────────────────────

test("a field's shape comes from the limit the door states, not the site's guess", () => {
  // All four strings below are the live door's own field descriptions, read off
  // `GET https://postmark.town/api/world/apex` on 2026-08-26 and pasted whole.
  assert.equal(statedLimit("what you say, at most 500 characters — omit to listen without speaking"), 500);
  assert.equal(statedLimit("the complete replacement note, maximum 2000 characters"), 2000);
  assert.equal(statedLimit("one present-tense observation; maximum 150 characters — the mark's face in every view"), 150);
  assert.equal(statedLimit("the mark's leaf name — kebab-case, unique among your own marks"), null, "a field with no stated limit states none");
  assert.equal(statedLimit(undefined), null);
  assert.equal(statedLimit("bounty only: the one claim — what you want done, maximum 150 characters"), 150);

  // and the shape that follows. THE CASE THAT CAUGHT IT: a one-line value with a
  // long explanation. The first rule keyed on the description's own length and
  // gave this field a four-line textarea.
  const wick = { name: "wick", type: "string", description: "what you set alight — a thing's mark id, <by>/<slug>, and it must be standing where you stand" };
  assert.equal(wick.description.length > 90, true, "the description is long…");
  assert.equal(wantsTextarea(wick), false, "…and the value is still one line, because the door stated no limit");

  assert.equal(wantsTextarea({ name: "text", description: "what you say, at most 500 characters" }), true);
  assert.equal(wantsTextarea({ name: "body", description: "one present-tense observation; maximum 150 characters" }), true, "150 is the world's own smallest prose limit, so it is the floor");
  assert.equal(wantsTextarea({ name: "slug", description: "kebab-case" }), false);
});

// ── the encounter: turn order, dice, the two spaces, the floor ──────────────

/** An encounter mid-round: a creature holds a real slot, one ally is down, and a
 *  late joiner has been appended after the wheel had already passed them. */
const IN_COMBAT = {
  ...INSIDE_PORTAL,
  standpoint: { ...INSIDE_PORTAL.standpoint, portal: { ...INSIDE_PORTAL.standpoint.portal, space: "arena" } },
  encounter: {
    id: "a-hall/the-boss-room",
    round: 3,
    turn: "the-cellar-thing",
    order: [
      { id: "the-cellar-thing", kind: "creature", label: "the cellar thing", initiative: 19, hp: { now: 40, max: 55 } },
      { id: "jetto-of-starforge", kind: "resident", label: "jetto-of-starforge", initiative: 14, hp: { now: 7, max: 12 }, you: true },
      { id: "vermillion", kind: "resident", label: "vermillion", initiative: 11, down: true, hp: { now: 0, max: 14 } },
      { id: "keeminlee", kind: "human", label: "DARKO", initiative: 6, hp: { now: 10, max: 10 }, joined_round: 3 },
    ],
  },
};

test("the wheel is rendered in the door's order, never re-sorted", () => {
  // The founder's ruling: late joiners APPEND. Initiative order is the
  // encounter's own record — ties are its business — and a client that re-sorted
  // by the `initiative` number would silently undo the append and drop the
  // newcomer into the middle of a round that had already passed them. DARKO
  // joined at round 3 with the LOWEST initiative and belongs last either way;
  // the fixture below is the one that would expose a re-sort.
  const enc = encounterOf(IN_COMBAT);
  assert.deepEqual(enc.order.map((a) => a.id), ["the-cellar-thing", "jetto-of-starforge", "vermillion", "keeminlee"]);

  // THE CASE THAT ACTUALLY EXPOSES A RE-SORT, and the first spelling of it did
  // not: it listed the high roll FIRST, which is already descending order, so a
  // sort was a no-op and the mutation testing this walked away green. The append
  // rule only bites when the newcomer's number would have put them EARLIER —
  // a 20 arriving at round 4 and taking the last seat anyway.
  const appendedHigh = {
    ...IN_COMBAT,
    encounter: { ...IN_COMBAT.encounter, order: [
      { id: "early", kind: "resident", label: "early", initiative: 3 },
      { id: "late", kind: "resident", label: "late", initiative: 20, joined_round: 4 },
    ] },
  };
  assert.deepEqual(encounterOf(appendedHigh).order.map((a) => a.id), ["early", "late"],
    "a 20 sitting AFTER a 3 is the append, and sorting would undo the founder's ruling");
});

test("the wheel carries hostiles, the downed, the late, and which is current", () => {
  const enc = encounterOf(IN_COMBAT);
  assert.equal(enc.round, 3);
  assert.equal(enc.turn, "the-cellar-thing");
  const [thing, me, verm, darko] = enc.order;
  assert.equal(thing.kind, "creature", "a hostile holds a real slot on the wheel");
  assert.equal(thing.current, true);
  assert.equal(me.you, true);
  assert.equal(me.current, false);
  assert.equal(verm.down, true, "downed-not-dead is a state on the wheel, not a removal from it");
  assert.deepEqual(verm.hp, { now: 0, max: 14 });
  assert.equal(darko.joinedRound, 3, "a late joiner says which round they came in");
  assert.equal(darko.kind, "human");
  // and no encounter at all is the free-roam case
  assert.equal(encounterOf(INSIDE_PORTAL), null);
  assert.equal(encounterOf({ encounter: { order: [] } }), null, "an empty wheel is not an encounter");
});

test("a CREATURE holding the wheel does not disable anything — the act is what resolves it", () => {
  // ⚑ THIS TEST ASSERTED THE OPPOSITE UNTIL 2026-08-28, and the reversal is
  // written out rather than swapped in, because a test that quietly flips is
  // indistinguishable from a regression.
  //
  // WHAT IT USED TO SAY: with the cellar thing on the wheel, every afforded
  // slot disabled, each carrying "it is the cellar thing's turn". That read the
  // founder's ruling — "when it is not your turn, the slots render disabled
  // with the reason … never hidden" — as covering a creature's turn too.
  //
  // WHY THAT WAS WRONG, in the door's own law: "Hostile turns are resolved by
  // the act that ends a player's turn, in the same handling, until the wheel
  // reaches a player again. There is no daemon and no ticker: the duet is the
  // event loop." The door drives every due creature turn BEFORE it judges the
  // caller. So a reader whose only obstacle is a creature was being refused for
  // the one act that would have moved the fight, and the room read as dead.
  // The founder, mid-fight, in his own browser: "I also tried striking and it's
  // just stuck now? like when does the cake take its turn?" It takes it when he
  // acts — and this surface had disabled the acting.
  //
  // The ruling itself is untouched and is asserted below, where it applies.
  const { fixed, tray, blocked } = barSlots(IN_COMBAT);
  assert.equal(blocked, null, "a creature's turn is not a blocker — the reader's act drives it");
  assert.equal(fixed.length, FIXED_SLOTS.length, "the six seats are all still there");
  assert.deepEqual(tray.map((t) => t.action), ["strike", "loot"], "so is the whole afforded tray");
  const afforded = [...fixed, ...tray].filter((s) => s.afforded);
  assert.ok(afforded.length > 0);
  assert.ok(afforded.every((s) => s.enabled === true), "and every afforded slot can actually be pressed");
  // the cards are unchanged by any of this — the law is readable either way
  assert.ok(afforded.every((s) => s.card !== null));
  assert.equal(tray[0].card.blurbFrom, "the-hall/strike");
});

test("not your turn: every slot disabled with the reason, and NONE hidden", () => {
  // The founder's ruling, verbatim: "when it is not your turn, the slots render
  // disabled with the reason … never hidden, so the grammar stays legible."
  //
  // A HAND ahead of you is what that ruling is about. A person acts on their
  // own clock and nothing the reader does drives them, so the wait is real and
  // the bar should say whose it is — which is also the leg that keeps the test
  // above from being "stop gating".
  const theirTurn = {
    ...IN_COMBAT,
    encounter: { ...IN_COMBAT.encounter, turn: "keeminlee" },
  };
  const { fixed, tray, blocked } = barSlots(theirTurn);
  assert.equal(blocked.reason, "it is DARKO's turn");
  assert.equal(fixed.length, FIXED_SLOTS.length, "the six seats are all still there");
  const afforded = [...fixed, ...tray].filter((s) => s.afforded);
  assert.ok(afforded.length > 0);
  assert.ok(afforded.every((s) => s.enabled === false), "afforded and blocked: disabled, not removed");
  assert.ok(afforded.every((s) => s.blocked === "it is DARKO's turn"), "each says why");
  // the cards survive the gate — the law is still readable while you wait
  assert.ok(afforded.every((s) => s.card !== null));
});

test("downed: your own bar says so, and the door's words win over ours", () => {
  const downed = {
    ...IN_COMBAT,
    encounter: { ...IN_COMBAT.encounter, turn: "jetto-of-starforge",
      order: IN_COMBAT.encounter.order.map((a) => (a.you ? { ...a, down: true, hp: { now: 0, max: 12 } } : a)) },
  };
  const b = blockedReason(downed);
  assert.equal(b.reason, "you are down — an ally can lift you");
  assert.equal(b.from, "derived");
  assert.ok(barSlots(downed).fixed.filter((s) => s.afforded).every((s) => s.enabled === false));

  // CONTRACT: one field for every cause, because the causes are the world's to
  // enumerate. A door that speaks its own sentence is quoted, not second-guessed.
  //
  // `gates: null` joined this shape on 2026-08-29 — the door may now narrow a
  // refusal to the acts it is about, and null is it declining to. A door that
  // sends no list blocks everything, exactly as it did before the field existed,
  // which is what the line under this one still checks.
  const spoken = { ...downed, standpoint: { ...downed.standpoint, acting_blocked: { reason: "the room holds its breath" } } };
  assert.deepEqual(blockedReason(spoken), { reason: "the room holds its breath", from: "the door", gates: null });
  assert.ok(barSlots(spoken).fixed.filter((s) => s.afforded).every((s) => s.enabled === false),
    "an unnarrowed refusal still cools every afforded seat");

  // your turn, standing: nothing blocks
  const yours = { ...IN_COMBAT, encounter: { ...IN_COMBAT.encounter, turn: "jetto-of-starforge" } };
  assert.equal(blockedReason(yours), null);
  assert.ok(barSlots(yours).fixed.filter((s) => s.afforded).every((s) => s.enabled === true));
  // and outside an encounter entirely
  assert.equal(blockedReason(INSIDE_PORTAL), null);
});

test("a crit is READ from the door, never computed from the number", () => {
  // A crit is a rule of the encounter — natural max, max-after-modifiers, or
  // whatever the class mark says. A client that decided it by comparing value to
  // faces would be inventing law, and would be wrong the first time a class ruled
  // otherwise. So `atMax` is offered as an observation about the NUMBER and
  // `crit` is only ever the door's word.
  const [natural] = rollsFrom({ roll: { die: "d20", value: 20, modifier: 3, for: "strike" } });
  assert.equal(natural.atMax, true, "20 on a d20 is at max, which is a fact about the number");
  assert.equal(natural.crit, false, "…and not a crit, because the door did not say so");
  assert.equal(natural.total, 23, "total is derived only when the door omitted it");

  const [ruled] = rollsFrom({ roll: { die: "d20", value: 18, crit: true, total: 18 } });
  assert.equal(ruled.crit, true, "an 18 IS a crit if the encounter says it is");
  assert.equal(ruled.atMax, false);

  // one throw or several, both spellings, because a strike throws once and a
  // room's initiative throws many
  assert.equal(rollsFrom({ rolls: [{ die: "d20", value: 4 }, { die: "d6", value: 6 }] }).length, 2);
  assert.deepEqual(rollsFrom({}), []);
  assert.deepEqual(rollsFrom(null), []);
  assert.deepEqual(rollsFrom({ roll: { die: "d20" } }), [], "a roll with no value is not a throw");
  // faces from the die name when the door did not spell them out
  assert.equal(rollsFrom({ roll: { die: "d6", value: 6 } })[0].faces, 6);
  assert.equal(rollsFrom({ roll: { value: 3 } })[0].faces, null, "no die, no faces, and no invented ones");
});

test("the space is the door's word, and absent means the calm one", () => {
  // The founder ruled two rooms: an antechamber (free-roam, social) and a boss
  // room. Absent falls back to the antechamber deliberately — dressing a social
  // room as a fight is the worse error of the two.
  assert.equal(spaceOf(IN_COMBAT), "arena");
  assert.equal(spaceOf(INSIDE_PORTAL), "antechamber", "no word said: the calm one");
  assert.equal(spaceOf({ standpoint: { portal: { space: "somewhere-else" } } }), "antechamber");

  // AN ENCOUNTER DOES NOT MAKE A ROOM AN ARENA. A fight happens in a room; it is
  // not the room. The wipe rule is exactly where inferring would be wrong: it
  // returns everyone to the antechamber with the boss restored, and an encounter
  // may still be settling as they arrive.
  const fightingInTheAntechamber = { ...IN_COMBAT, standpoint: { ...INSIDE_PORTAL.standpoint } };
  assert.equal(encounterOf(fightingInTheAntechamber) !== null, true);
  assert.equal(spaceOf(fightingInTheAntechamber), "antechamber");
});

test("a dropped weapon is drawn where it fell", () => {
  // Downed-not-dead drops the weapon loose, and it becomes takeable ground loot.
  // Everything needed to draw it is already in `nearby` — including `at` — so the
  // contract is one flag rather than a new block.
  const withLoot = {
    ...IN_COMBAT,
    nearby: [
      { id: "the-town/the-deck", at: { x: -9, y: 28 }, kind: "sited", tier: "market" },
      { id: "vermillion/the-long-knife", at: { x: 140, y: -30 }, kind: "sited", loose: true, dropped_by: "vermillion" },
    ],
  };
  const loose = looseThings(withLoot);
  assert.equal(loose.length, 1, "only what the door flagged loose");
  assert.deepEqual(loose[0].at, { x: 140, y: -30 });
  assert.equal(loose[0].label, "the long knife", "a slug reads as words when nothing better was sent");
  assert.equal(loose[0].dropped_by, "vermillion");
  assert.deepEqual(looseThings(INSIDE_PORTAL), [], "nothing flagged, nothing on the floor");
  // a loose mark with no position cannot be drawn where it fell, so it is not drawn
  assert.deepEqual(looseThings({ nearby: [{ id: "a/b", loose: true }] }), []);
});

// ── the token is a file the BUILD will actually serve ───────────────────────

test("every token the registry names is a file under the build's own publicDir", () => {
  // THE DEFECT THIS EXISTS FOR, caught by reading the config rather than by
  // anything failing: this project's publicDir is `public/atelier/postmark`, not
  // `public`. A token dropped in `public/birthday/` is never copied into the
  // build, so the roster face and the map token would both have been broken
  // images on the deployed site while every test here stayed green and the local
  // harness — which was serving plain `public/` — showed the picture happily.
  //
  // So the check reads the directory out of astro.config.town.mjs instead of
  // writing it down, and fails if the file the registry points at is not there.
  const config = readFileSync(fileURLToPath(new URL("../astro.config.town.mjs", import.meta.url)), "utf8");
  const m = /publicDir:\s*['"]([^'"]+)['"]/.exec(config);
  assert.ok(m, "astro.config.town.mjs must state a publicDir for this check to mean anything");
  const publicDir = m[1];
  assert.notEqual(publicDir, "public", "if this ever becomes plain `public`, re-read the note above before moving anything");

  for (const [who, token] of Object.entries(HUMAN_TOKENS)) {
    assert.ok(token.src.startsWith("/"), `${who}: a token src is a site-absolute path`);
    const onDisk = fileURLToPath(new URL(`../${publicDir}${token.src}`, import.meta.url));
    assert.ok(existsSync(onDisk), `${who}: ${token.src} must exist at ${publicDir}${token.src} or the build will not serve it`);
    assert.ok(statSync(onDisk).size > 0, `${who}: the token file is empty`);
  }
});

// ── terms, from the act's shadow ────────────────────────────────────────────

test("terms come off the act's SHADOW, which performs nothing", () => {
  // LOGOS/reads-and-affordances.md § The apex: "the terms delivered before an
  // act binds are the class-nodes' own content, because you cannot be bound by
  // law you were not shown at the door."
  //
  // The bare standpoint read carries no terms — measured against the live door
  // 2026-08-26, no entry in `actions` has a `terms` key. `read: <action>` does,
  // and it is the act's shadow: "A read never performs" (the apex's own words;
  // office world-apex.mjs answers `{ read, card: { ...entry, terms }, ...domain }`).
  // So the card asks the shadow, never the act.
  const shadow = { read: "kindle", card: { action: "kindle", blurb: "…", terms: { binds: "a-hall/guest", means: "a-hall/kindle", schedule: "settles at the crossing" } } };
  assert.deepEqual(termsFromRead(shadow), { binds: "a-hall/guest", means: "a-hall/kindle", schedule: "settles at the crossing" });

  // an act whose classes state none, and a read that failed, both answer null —
  // and null must never render as an empty terms box claiming there are none
  assert.equal(termsFromRead({ read: "loot", card: { action: "loot" } }), null);
  assert.equal(termsFromRead(null), null);
  assert.equal(termsFromRead({}), null);
  // the bare standpoint answer is NOT a shadow and must not be read as one
  assert.equal(termsFromRead(SIGNED_IN), null);
});

test("terms render in the door's own keys, however many there are", () => {
  // The apex names four — binds, means, the schedule, the charter overhead — and
  // a template naming those four goes quietly blank the day a fifth is added,
  // which is the worst way for a legal disclosure to fail.
  const rows = termsRows({ binds: "a-hall/guest", means: "a-hall/kindle", schedule: "settles at the crossing", charter: "…", a_fifth_thing: { deep: 1 } });
  assert.deepEqual(rows.map((r) => r.key), ["binds", "means", "schedule", "charter", "a_fifth_thing"]);
  assert.equal(rows[0].value, "a-hall/guest");
  assert.equal(rows[4].value, '{"deep":1}', "a structured term is shown, not dropped");
  assert.deepEqual(termsRows(null), []);
  assert.deepEqual(termsRows("binding"), [], "a non-object is not a terms block");
  assert.deepEqual(termsRows([1, 2]), []);
});

// ── the stylesheet arrives whole ────────────────────────────────────────────

test("the cockpit's stylesheet is not cut off by a backtick in its own prose", () => {
  // THE FAILURE THIS EXISTS FOR, twice in one evening: the stylesheet is a JS
  // template literal, and a backtick written inside one of its comments ENDS the
  // string. The rest parses as JavaScript and the module throws at import — so
  // the world page loads, the island never runs, and the cockpit is simply absent
  // with no error a reader would ever see. The second occurrence was inside the
  // comment written about the first, which is why this is a test and not a note.
  //
  // Two legs, because the first alone is weak: the block must reach its LAST rule
  // (a truncation anywhere earlier fails), and every section it is made of must
  // still be in it (so a rule set deleted from the middle fails too).
  assert.match(COCKPIT_CSS, /\.pmc-card \{ width: 18em; \}\s*\}\s*$/, "the stylesheet must run to its final rule");
  // ⚑ `.pmc-nm` STOOD IN THIS LIST AND IS GONE (2026-08-29, founder-ruled): the
  // dock's hover shows the larger plate "not the small nameplate", so the small
  // name box was deleted and everything it carried moved onto the plate. The
  // reversal is named here rather than the name quietly vanishing from a list.
  //
  // ⚠ AND IT IS ASSERTED GONE, not merely dropped — `includes(".pmc-nm")` was
  // still TRUE with the rules deleted, because the comment that records the
  // deletion names the class. A substring pin cannot tell a rule from prose
  // about a rule, which is the same trap that has caught source pins here from
  // the other side. `^\.pmc-nm \{` can only match a rule.
  assert.doesNotMatch(COCKPIT_CSS, /^\.pmc-nm[ .:[]/m, "the small name box's rules are gone, not just unreferenced");
  for (const section of [".pmc-roster", ".pmc-face", ".pmc-bar", ".pmc-slot", ".pmc-gap", ".pmc-card", ".pmc-form", ".pmc-terms", ".pmc-here", ".pmc-hp", ".pmc-more", "@media"]) {
    assert.ok(COCKPIT_CSS.includes(section), `the stylesheet must still dress ${section}`);
  }
  // and the rule that keeps a tooltip from swallowing the bar, by name
  assert.match(COCKPIT_CSS, /\.pmc-card \{[^}]*pointer-events: none/s);
});

test("cardOf refuses nothing quietly", () => {
  assert.equal(cardOf(null), null);
  assert.equal(cardOf("say"), null);
  const bare = cardOf({ action: "shrug" });
  assert.equal(bare.blurb, null);
  assert.deepEqual(bare.fields, []);
  assert.equal(bare.dials, null);
  assert.equal(dialLine(bare), "");
  assert.equal(dialLine(null), "");
});


// ═══════════════════════════════════════════════════════════════════════════
// WHAT THE FORM FILLS IN FOR YOU, and what it refuses to (2026-08-28)
//
// THE LAW, the founder's words at the live rehearsal: "everything I can do via
// the ui buttons, I have to type in like filling an mcp form."
//
// The two halves pinned here are the arithmetic ones: which acts are chat-shaped
// (read off the card, never off a name) and what may be prefilled (only where
// there is exactly one slot and exactly one value, so no choice is being made).
// ═══════════════════════════════════════════════════════════════════════════

/** A card the way cardOf builds one, from an entry the door would send. */
const cardFrom = (fields) => cardOf({ action: "an-act", fields });

/** The prose limit the world's own smallest stated one sits at — a field the
 *  door says may hold this much is one a reader writes a sentence into. */
const PROSE = { type: "string", description: "what you say, at most 500 characters" };
const SHORT = { type: "string", description: "a thing's mark id, <by>/<slug>" };

test("chat-shape is read off the card's fields, never off the act's name", () => {
  // one prose field, nothing else required → a chat line
  assert.equal(chatShaped(cardFrom({ text: PROSE })), true);
  assert.equal(chatField(cardFrom({ text: PROSE })).name, "text");
  // a prose field beside an OPTIONAL one is still chat — the optional one is
  // not something the reader must answer before speaking
  assert.equal(chatShaped(cardFrom({
    text: PROSE, since: { type: "number", description: "the latest stamp from your previous reply" },
  })), true);
  // a prose field beside a REQUIRED one is a form: an act that also demands a
  // recipient is not "type the sentence and send"
  assert.equal(chatShaped(cardFrom({
    words: PROSE, to: { ...SHORT, required: true },
  })), false);
  // and an act with no prose at all is never a chat line
  assert.equal(chatShaped(cardFrom({ thing: SHORT })), false);
  assert.equal(chatField(cardFrom({ thing: SHORT })), null);
  assert.equal(chatShaped(null), false);
});

test("the adversary is read from the door's own detail block, or not at all", () => {
  assert.equal(adversaryOf({}), null);
  assert.equal(adversaryOf({ encounter_detail: { adversary: null } }), null);
  // an entry with no id names nothing, whatever else it carries
  assert.equal(adversaryOf({ encounter_detail: { adversary: { hp: 60, of: 60 } } }), null);
  const a = adversaryOf({ encounter_detail: { adversary: { id: "the-town/the-unlit-cake", hp: 41, of: 60, body: "Nine tiers." } } });
  assert.equal(a.id, "the-town/the-unlit-cake");
  assert.equal(a.hp, 41);
  assert.equal(a.of, 60);
  // named the way every id in this world is read — the leaf, deslugged
  assert.equal(a.label, "the unlit cake");
});

test("the candidates are only what the answer itself named", () => {
  assert.deepEqual(actCandidates({}), []);
  const answer = {
    encounter_detail: { adversary: { id: "the-town/the-unlit-cake", hp: 41, of: 60 } },
    encounter: {
      id: "g", round: 3, turn: "wright",
      order: [
        { id: "wright", kind: "resident", label: "wright", you: true },
        { id: "vermillion", kind: "resident", label: "vermillion", down: true },
      ],
    },
    nearby: [{ id: "vermillion/the-long-knife", at: { x: 1, y: 2 }, loose: true, label: "the long knife" }],
  };
  assert.deepEqual(actCandidates(answer).map((c) => c.value),
    ["the-town/the-unlit-cake", "vermillion", "vermillion/the-long-knife"]);
  // YOURSELF IS NOT A CANDIDATE for the down: you cannot be the ally who lifts you
  const onlyYouDown = { ...answer, encounter: { ...answer.encounter, order: [{ id: "wright", label: "wright", down: true, you: true }] } };
  assert.ok(!actCandidates(onlyYouDown).some((c) => c.value === "wright"));
});

test("a prefill happens only where there is no choice to make", () => {
  const oneCandidate = { encounter_detail: { adversary: { id: "the-town/the-unlit-cake", hp: 41, of: 60 } } };

  // one open slot, one named value: nothing is being chosen, so it is filled
  assert.deepEqual(prefillFor(cardFrom({ object: SHORT }), oneCandidate),
    { object: "the-town/the-unlit-cake" });

  // TWO open slots and one value: the site would be choosing WHICH, so it fills
  // neither and the datalist offers the value to both
  assert.deepEqual(prefillFor(cardFrom({ object: SHORT, other: SHORT }), oneCandidate), {});

  // TWO values and one slot: the site would be choosing WHAT — same refusal
  const twoCandidates = {
    ...oneCandidate,
    nearby: [{ id: "vermillion/the-long-knife", at: { x: 1, y: 2 }, loose: true }],
  };
  assert.deepEqual(prefillFor(cardFrom({ object: SHORT }), twoCandidates), {});

  // A PROSE FIELD IS NEVER PREFILLED. What you say is yours to write, and a
  // sentence the site put in your mouth is the one thing this surface must not
  // do — so a card whose only open field is prose is filled with nothing.
  assert.deepEqual(prefillFor(cardFrom({ text: PROSE }), oneCandidate), {});

  // nor are the fields the door already answered for itself
  assert.deepEqual(prefillFor(cardFrom({ n: { type: "number", description: "how many" } }), oneCandidate), {});
  assert.deepEqual(prefillFor(cardFrom({ k: { type: "string", enum: ["a", "b"], description: "which" } }), oneCandidate), {});
  assert.deepEqual(prefillFor(null, oneCandidate), {});
});

test("the adversary is placed by joining the fight to the map, and not otherwise", () => {
  // THE ANSWER CARRIES THE TWO HALVES SEPARATELY: encounter_detail names the
  // adversary and states its hp and carries NO coordinates; nearby carries every
  // mark's `at` and says nothing about which is the adversary. The id is the join.
  const grid = gridFrom({
    _grid: { scale: "5 m per atlas px (RULED 2026-07-17)", origin: "Ferry's crossing — center of the Town Centre, atlas (485,760)" },
  });
  const detail = { adversary: { id: "the-town/the-unlit-cake", hp: 41, of: 60 } };

  // named but not in view: NOT DRAWN, rather than drawn at a constant. A number
  // written into the site would be the fold's `at` in a second place, still
  // painting an ember ring over empty floor the day the cake is moved.
  assert.equal(adversaryPlacement({ encounter_detail: detail, nearby: [] }, grid), null);
  // in view but unnamed by the fight: also not drawn — it is just a mark then
  assert.equal(adversaryPlacement({ nearby: [{ id: "the-town/the-unlit-cake", at: { x: 1097, y: -783.5 } }] }, grid), null);

  // THE JOIN IS THE WHOLE FUNCTION, so it is proved against a view that holds
  // OTHER marks: a placement that took the first thing in `nearby` would paint
  // the adversary's ember ring and its hp bar over a dropped lighter. Without
  // this case the two above pass against no join at all — measured.
  assert.equal(adversaryPlacement({
    encounter_detail: detail,
    nearby: [{ id: "the-town/the-good-lighter", at: { x: 1095.5, y: -784 } }],
  }, grid), null, "a view with no cake in it draws no cake, however much else is in it");
  const amongOthers = adversaryPlacement({
    encounter_detail: detail,
    nearby: [
      { id: "the-town/the-good-lighter", at: { x: 1095.5, y: -784 } },
      { id: "the-town/the-unlit-cake", at: { x: 1097, y: -783.5 } },
    ],
  }, grid);
  assert.deepEqual(amongOthers.at, worldToPx(grid, { x: 1097, y: -783.5 }),
    "and it finds the cake by id rather than by position in the list");

  const placed = adversaryPlacement({
    encounter_detail: detail,
    nearby: [{ id: "the-town/the-unlit-cake", at: { x: 1097, y: -783.5 } }],
  }, grid);
  assert.deepEqual(placed.at, worldToPx(grid, { x: 1097, y: -783.5 }));
  assert.equal(placed.adversary.hp, 41);
  assert.equal(placed.adversary.of, 60);
});

// ── what was said, and where (2026-08-28, the chat ruling's other half) ──
//
// Speech is not in the apex answer at all — not in `happened`, not in `present`,
// not in the encounter. That is not a gap to route around: speech in this world
// is a SOUND ("radiated at the speaker's standpoint, heard by earshot, gone by
// its own law", the say class's own blurb), and the record of it lives at the
// conversations door, keyless, because "speech is public the way street
// conversation is" (office server.mjs).

/** The conversations door's shape, as the office emits it (voices.mjs threadOf). */
const voicesBody = (now, voices, fade = 5) => ({
  now, earshot_m: 60, fade_minutes: fade, pinned: [], closed: [],
  live: [{ id: "t1", live: true, place: "the candle vault", at: { x: 1083, y: -792 }, voices }],
});

test("a voice is placed where it was SPOKEN, and fades on the door's own clock", () => {
  const now = 1_800_000_000_000;
  const body = voicesBody(now, [
    { handle: "wright", said: "the candles are lit", at_ms: now - 30_000, x: 1090, y: -785 },
    { handle: "vermillion", said: "mind the ninth tier", at_ms: now - 240_000, x: 1094, y: -783 },
  ]);
  const got = recentVoices(body, { now });
  assert.equal(got.length, 2);
  // newest LAST, so a later line paints over an earlier one at the same spot
  assert.deepEqual(got.map((v) => v.handle), ["vermillion", "wright"]);
  // each carries the coordinates the speaker stood at — NOT the thread's
  assert.deepEqual(got[1].at, { x: 1090, y: -785 });
  // freshness runs 1 at the moment it was said to 0 as it leaves
  assert.ok(got[1].freshness > got[0].freshness);
  assert.ok(got[1].freshness > 0.85 && got[1].freshness < 1);
});

test("the fade window is the door's number, never one written here", () => {
  const now = 1_800_000_000_000;
  const fourMinutesOld = [{ handle: "wright", said: "still here", at_ms: now - 240_000, x: 1, y: 2 }];
  // the door says five minutes: still audible
  assert.equal(recentVoices(voicesBody(now, fourMinutesOld, 5), { now }).length, 1);
  // the door says three: gone, with no edit to this file
  assert.equal(recentVoices(voicesBody(now, fourMinutesOld, 3), { now }).length, 0);
});

test("a voice with nothing to draw is dropped rather than drawn wrong", () => {
  const now = 1_800_000_000_000;
  const fresh = (extra) => ({ handle: "wright", said: "hello", at_ms: now - 1000, x: 1, y: 2, ...extra });
  assert.equal(recentVoices(voicesBody(now, [fresh()]), { now }).length, 1);
  // no coordinates: nothing on the map can be said about it
  assert.equal(recentVoices(voicesBody(now, [fresh({ x: undefined })]), { now }).length, 0);
  assert.equal(recentVoices(voicesBody(now, [fresh({ y: null })]), { now }).length, 0);
  // no words, no stamp: not a line
  assert.equal(recentVoices(voicesBody(now, [fresh({ said: "" })]), { now }).length, 0);
  assert.equal(recentVoices(voicesBody(now, [fresh({ at_ms: undefined, at: undefined })]), { now }).length, 0);
  // and a body the door never sent draws nothing rather than throwing
  assert.deepEqual(recentVoices(null), []);
  assert.deepEqual(recentVoices({}), []);
  // CLOSED threads are not live speech — only `live` is read
  assert.deepEqual(recentVoices({ live: [], closed: [{ voices: [fresh()] }], fade_minutes: 5 }, { now }), []);
});

test("pxToWorld is the algebraic inverse of worldToPx, not a second formula", () => {
  // A CLICK ARRIVES IN THE MAP'S UNITS and the door only speaks metres, so the
  // walk seam needs the line read backwards. Round-tripped rather than asserted
  // against copied numbers: the point is that the two cannot drift apart.
  const grid = gridFrom({
    _grid: { scale: "5 m per atlas px (RULED 2026-07-17)", origin: "Ferry's crossing — center of the Town Centre, atlas (485,760)" },
  });
  for (const m of [{ x: 0, y: 0 }, { x: 1097, y: -783.5 }, { x: -95120, y: -95120 }]) {
    const back = pxToWorld(grid, worldToPx(grid, m));
    assert.ok(Math.abs(back.x - m.x) < 1e-9 && Math.abs(back.y - m.y) < 1e-9,
      `${JSON.stringify(m)} must survive the round trip`);
  }
  assert.equal(pxToWorld(null, { x: 1, y: 1 }), null);
  assert.equal(pxToWorld(grid, { x: NaN, y: 1 }), null);
});

// ── a place is not a target (2026-08-29, founder-caught while playing) ───────
test("a field about somewhere you stand is never filled with the thing you are fighting", () => {
  // ⚑ THE BUG: the one candidate in a fight is the adversary, and it was handed
  // to whatever single open field an act had. The acts that take a GROUND opened
  // with the adversary's id in them — the plate for stepping out of the vault
  // read "the unlit cake", which if sent would have asked to step out of a cake.
  // It had to be retyped by hand twice in one session.
  const inTheVault = {
    encounter_detail: { adversary: { id: "the-town/the-unlit-cake", hp: 43, of: 60 } },
    standpoint: { portal: { id: "the-town/the-candle-vault" } },
    within: [
      { id: "the-town/let-there-be-light" },
      { id: "the-town/the-cellar-door" },
      { id: "the-town/the-candle-vault" },
    ],
  };
  // the door's own sentences, in the two shapes it writes them
  const AIMED = { type: "string", description: "who or what this act is aimed at" };
  const LEAVE = { type: "string", description: "which mark to step out of — omit for the innermost one you are within" };
  const ENTER = { type: "string", description: "the mark to enter — <by>/<slug>, as ids appear in the telling" };
  const GOTO = { type: "string", description: "walk to this mark's ground — <by>/<slug>, as ids appear in the telling" };

  // a target field still takes the target — the shipped behaviour, unchanged
  assert.deepEqual(prefillFor(cardFrom({ object: AIMED }), inTheVault),
    { object: "the-town/the-unlit-cake" }, "an aimed-at field is still prefilled");

  // WHERE YOU ARE STEPPING OUT OF is left to the door, and it is never the
  // adversary. An earlier pass filled this with the standpoint's own ground,
  // and the door refused it live: "rei is not within 'the-town/the-candle-vault'
  // — there is nothing to step out of", from a standpoint whose portal IS that
  // vault. The door's "within" for crossing out is the ENTRY it holds, not the
  // extent you stand inside; the site holds neither and guesses at neither. The
  // field's own words say to omit it.
  assert.deepEqual(prefillFor(cardFrom({ mark: LEAVE }), inTheVault), {},
    "the way out is the door's to resolve, and omitting it is what the door asked for");

  // and the destinations are the reader's to choose, so they stay empty
  assert.deepEqual(prefillFor(cardFrom({ mark: ENTER }), inTheVault), {},
    "where to go is a choice, and this function only fills where there is none");
  assert.deepEqual(prefillFor(cardFrom({ mark_id: GOTO }), inTheVault), {},
    "same for walking somewhere");

  // and with no portal to name it is still empty — never the adversary as a
  // fallback, which is the bug this whole test exists for
  assert.deepEqual(prefillFor(cardFrom({ mark: LEAVE }), { ...inTheVault, standpoint: {} }), {},
    "no standpoint ground, no answer — never the adversary as a fallback");
});

test("the human's token stands BESIDE the resident where the ground seats them", () => {
  // FOUNDER'S RULING 2026-08-29: "when you enter a zone where it's human-allowed
  // the human's token gets placed in with a slight offset from the resident."
  const grid = { originPx: { x: 485, y: 760 }, mPerPx: 5 };
  const actor = { kind: "human", handle: "keeminlee", label: "DARKO", allowed: true };
  const borrowed = { standpoint: { x: 1083, y: -792, stance: "embodied" } };

  // not seated: unchanged — no token at all, exactly as before the ruling
  assert.equal(tokenPlacement(borrowed, grid, actor), null,
    "a human with no seat here is not drawn, which is the shipped rule");

  // seated by the ground: drawn, and flagged as standing beside rather than on
  const seated = tokenPlacement(borrowed, grid, actor, { seated: true });
  assert.ok(seated, "the portal's welcome puts them on the map");
  assert.equal(seated.beside, true,
    "and BESIDE — they are fighting from the housemate's place, not a coordinate of their own");

  // their own feet: drawn ON the standpoint, and the offset must not apply —
  // nudging a position the record actually holds would be a small lie
  const own = tokenPlacement({ standpoint: { x: 1083, y: -792, stance: "embodied-human" } }, grid, actor);
  assert.ok(own, "an embodied human is drawn as they always were");
  assert.equal(own.beside, false, "and stands on their own standpoint, un-nudged");
  assert.deepEqual(own.at, seated.at, "the anchor is the same point either way — only the drawing differs");
});

test("acting as the human, YOUR row on the wheel is the human's — not the resident's", () => {
  // ⚑ SEEN LIVE 2026-08-29: the wheel came round to the human, the cap said so
  // ("round 7 · human-of-starforge is acting"), and the bar greyed itself out
  // with "it is human-of-starforge's turn" — refusing the reader on the grounds
  // that it was their own turn. The door answers a RESIDENT's standpoint and
  // marks that resident `you`, which is right for the read; but a reader acting
  // as their household's human holds their OWN row, and the resident's is
  // somebody else's.
  const onTheHuman = {
    ...IN_COMBAT,
    encounter: {
      ...IN_COMBAT.encounter,
      turn: "keeminlee",
      order: IN_COMBAT.encounter.order.map((a) => ({ ...a })),
    },
  };
  // as the RESIDENT: a hand ahead of you, so the gate holds and names them
  assert.equal(blockedReason(onTheHuman, { acting: "jetto-of-starforge" })?.reason,
    "it is DARKO's turn", "the resident waits for the human, by name");
  // as the HUMAN: it is your own turn, so nothing blocks
  assert.equal(blockedReason(onTheHuman, { acting: HUMAN_ACTOR }), null,
    "the human is not made to wait for themselves");
  assert.ok(barSlots(onTheHuman, { acting: HUMAN_ACTOR }).fixed
    .filter((s) => s.afforded).every((s) => s.enabled === true),
    "and every afforded seat can be pressed");

  // a lone human still resolves by kind (the pre-party fallback)…
  assert.equal(yourTurnRow(encounterOf(onTheHuman), HUMAN_ACTOR)?.kind, "human");
  assert.equal(yourTurnRow(encounterOf(onTheHuman))?.you, true,
    "and with nobody named, it is still the door's own you-row");

  // ⚑ …but THREE HUMANS ON ONE WHEEL must bind by HAND, never by first-of-kind.
  // yourHumanRow's law, quoted: "binding a reader to a stranger's row is this
  // exact bug" — the party night every guest was told they were
  // human-of-the-misfiled-annex, the first human through the door.
  const crowd = {
    ...onTheHuman,
    seat: { ground: "the-town/the-candle-vault", seat: "rei", human: "human-of-starforge" },
    encounter: {
      ...onTheHuman.encounter,
      order: [
        { id: "human-of-the-misfiled-annex", kind: "human", label: "the misfiled annex", initiative: 19 },
        { id: "human-of-fox-hearth", kind: "human", label: "fox hearth", initiative: 12 },
        { id: "human-of-starforge", kind: "human", label: "DARKO", initiative: 7 },
        ...onTheHuman.encounter.order.map((a) => ({ ...a })).filter((a) => a.kind !== "human"),
      ],
    },
  };
  assert.equal(yourTurnRow(encounterOf(crowd), HUMAN_ACTOR, crowd)?.id, "human-of-starforge",
    "the reader's row is the one the seat's hand names, not the first human who joined");
  assert.equal(fighterState(crowd, HUMAN_ACTOR).id, "human-of-starforge",
    "the fighter plate binds the same way");
  // and a reader whose hand is NOT on the wheel is honestly off it — never a stranger
  const offWheel = { ...crowd, seat: { ...crowd.seat, human: "human-of-elsewhere" } };
  assert.equal(yourTurnRow(encounterOf(offWheel), HUMAN_ACTOR, offWheel), null,
    "an absent hand answers null, not somebody else's row");
  // several humans and NO seat disclosure = refuse to guess
  const { seat: _dropped, ...noSeat } = crowd;
  assert.equal(yourTurnRow(encounterOf(noSeat), HUMAN_ACTOR, noSeat), null,
    "with no hand to tell three humans apart, no row is anyone's");
});
