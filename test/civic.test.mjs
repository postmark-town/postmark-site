// civic.mjs and civic-art.mjs — the civic quarter's reader and its pixel art.
//
// TWO THINGS ARE BEING PROTECTED HERE, and they fail in opposite ways.
//
// THE READER fails LOUDLY if you let it: a shape change in somebody else's
// markdown, a world store that will not load, an idea mark with no claim in its body.
// Every one of those must come back as a named nothing — `read: false`, an
// empty list, a malformed row with its reason — because the page's whole
// discipline is that it never invents a town. So the tests below feed it
// garbage on purpose and assert it says so rather than guessing.
//
// THE ART fails SILENTLY, which is worse. A sprite row one character short
// skews every pixel after it and renders as a building with a notch in it;
// nothing throws, nothing goes red, and it ships. The maps are therefore
// checked as data, and `paint` is held to refusing ink it does not know.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  LANES, DEFAULT_LANE, standing, ideas, isIdea, toIdea, questStandings, questCards, marketplace,
  loadPlaceMarks, readPen, markFields, plaque, predicatesOf, placeName,
  markStakes, stakeOf, ideaDashboard, boardDashboard, worldPin,
  markBody, QUEST_REGISTRY, loadWorldState,
  THINK_TANK_PLACE, IDEA_CLASS, TITLE_MAX, BLUEPRINTS_REPO,
} from "../src/lib/civic.mjs";
import { TUTORIALS, MAX_SLIDES, tutorialFor } from "../src/lib/civic-tutorial.mjs";
import {
  SPRITES, SPRITE_W, SPRITE_H, INK, ACCENTS, paint, tint, channels,
  checkSprite, checkAllSprites,
} from "../src/lib/civic-art.mjs";
import { BOARD_PLACE } from "../src/lib/board.mjs";

// An `rgba(r, g, b, a)` string, taken apart — so a panel's colour can be
// compared to the sprite ink it is supposed to have come from. Reading the
// string rather than trusting it is the point: the whole claim under test is
// that these two numbers are the same number.
const rgbOf = (s) => {
  const m = /^rgba\((\d+), (\d+), (\d+), ([\d.]+)\)$/.exec(String(s));
  if (!m) throw new Error(`not an rgba() string: ${s}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
};
const alphaOf = (s) => {
  const m = /^rgba\(\d+, \d+, \d+, ([\d.]+)\)$/.exec(String(s));
  if (!m) throw new Error(`not an rgba() string: ${s}`);
  return Number(m[1]);
};

// ── the ontology ─────────────────────────────────────────────────────────────

test("the five lanes are the world's three asks plus the market and the ballot", () => {
  // THE LAW, quoted from the-town/the-three-asks: "Quests are the town's asks
  // for its residents; bounties are residents' asks for other residents;
  // blueprints are residents' asks for the town." The site does not get to
  // invent a sixth lane or drop one of the three.
  assert.deepEqual(LANES.map((l) => l.key), ["quests", "ideas", "bounties", "listings", "votes"]);
  for (const lane of LANES) {
    assert.ok(lane.name && lane.name.length > 3, `${lane.key} has no name`);
    assert.ok(lane.place && lane.place.startsWith("the-town/"), `${lane.key} names no world place`);
    assert.ok(lane.id && /^[a-z-]+$/.test(lane.id), `${lane.key} has no anchor id`);
    assert.ok(lane.who, `${lane.key} does not say what it is`);
    assert.equal(typeof lane.live, "boolean", `${lane.key} does not say whether it is live`);
  }
});

test("THE LAW: no lane keeps a copy of its own plaque", () => {
  // THE FOUNDER'S WORDS, 2026-09-01: the panel's title "*should* [be] the words
  // from the mark pulled verbatim." A `law:` constant beside a lane is a second
  // sentence that could stand in for those words — and every one of the five
  // this table used to carry was, that night, a stale copy of a body the
  // founder had rewritten hours earlier. This is the general form of the
  // 2026-08-31 finding: the fix for a stale copy is not a fresher copy, it is
  // no copy.
  //
  // Asked as "no lane carries a sentence-shaped field" rather than "no lane
  // carries `law`", because a rename is exactly how the constant comes back.
  for (const lane of LANES) {
    for (const [field, value] of Object.entries(lane)) {
      if (typeof value !== "string") continue;
      // the lane's own chrome: a name, a key, an anchor, a place id, a who-line
      if (["key", "id", "name", "lane", "place", "who"].includes(field)) continue;
      assert.fail(`the ${lane.key} lane carries a prose field \`${field}\`: ${JSON.stringify(value)} — a sentence beside a lane is a copy of the world nothing keeps honest`);
    }
  }
  // and the `who` line that IS kept is a LABEL, not a sentence — no full stop,
  // short enough to sit beside a name. If it ever grows into prose it has
  // become the thing this test forbids under a permitted name.
  for (const lane of LANES) {
    assert.ok(lane.who.length <= 60 && !/\.\s|\.$/.test(lane.who),
      `the ${lane.key} lane's who-line has become prose: ${lane.who}`);
  }
});

test("the default lane is a lane, and it is the Quest Guild", () => {
  // Founder-ruled 2026-09-01 (the Think Tank), re-ruled 2026-09-27. Held as "it is one of the five" plus the name,
  // so a typo in the constant costs a red rather than a page that silently
  // opens with nothing showing.
  assert.ok(LANES.some((l) => l.key === DEFAULT_LANE), `DEFAULT_LANE "${DEFAULT_LANE}" is not a lane`);
  assert.equal(DEFAULT_LANE, "quests", "the panel must open on the Quest Guild (founder, 2026-09-27)");
});

test("the bounty lane reuses board.mjs's own place, rather than retyping it", () => {
  // One derivation, imported — never forked. A second spelling of the board's
  // id is a second answer to where the board is.
  const bounties = LANES.find((l) => l.key === "bounties");
  assert.equal(bounties.place, BOARD_PLACE);
  assert.equal(bounties.id, "board",
    "the board's anchor must stay `board` — every deep link ever written points at that word");
});

// ── which buildings stand ────────────────────────────────────────────────────

test("standing() reads the world, and tells an unreadable store from an empty one", () => {
  // These two render the same emptiness and do not mean the same thing — the
  // distinction board.mjs drew for the notices, kept for the buildings.
  const none = standing(null, {});
  assert.equal(none.storeRead, false, "a null store must be reported as unread");
  assert.deepEqual(Object.values(none.built), [false, false, false, false, false]);

  const empty = standing({ marks: [] }, {});
  assert.equal(empty.storeRead, true, "a store that loaded and holds nothing HAS been read");
  assert.deepEqual(Object.values(empty.built), [false, false, false, false, false]);
});

test("a building stands exactly when its mark is in the world", () => {
  const world = { marks: [{ id: BOARD_PLACE }, { id: "the-town/the-ballot-house" }] };
  const s = standing(world, {});
  assert.equal(s.built.bounties, true, "the board is in the world and must read as standing");
  assert.equal(s.built.votes, true, "so is the ballot house");
  assert.equal(s.built.quests, false, "the quest guild is not, and must not be claimed");
  assert.equal(s.built.ideas, false);
  assert.equal(s.built.listings, false);

  // AND IT CLEARS ITSELF. The whole reason this is read rather than written
  // down: the day the world builds the Think Tank, the page lights it with no
  // edit. If this ever needs a code change to go true, the mechanism is broken.
  const later = standing({ marks: [...world.marks, { id: THINK_TANK_PLACE }] }, {});
  assert.equal(later.built.ideas, true,
    "adding the mark to the world must be enough to stand the building up");
});

// ── the pen and the fold ─────────────────────────────────────────────────────

test("a mark the pen has and the fold does not still stands", () => {
  // THE LIVE DEFECT THIS CAUGHT, on the pin the hub was built against. The
  // world commit that planted the civic quarter (0b4616cc, "THE CIVIC QUARTER
  // stands whole") added four mark.md files and did NOT re-run the fold, so
  // world-state.json at that exact pin carries none of them. Reading the fold
  // alone drew four buildings the world had genuinely planted as "not standing
  // yet" — a page contradicting the world it renders.
  const fold = { marks: [{ id: BOARD_PLACE }] };
  const pen = { "the-town/the-quest-guild": "The Quest Guild — the town's asks." };
  const s = standing(fold, pen);
  assert.equal(s.built.bounties, true, "the fold's own mark still counts");
  assert.equal(s.source.bounties, "fold");
  assert.equal(s.built.quests, true, "a penned mark the fold has not caught up to still stands");
  assert.equal(s.source.quests, "pen", "and the page can tell which record answered");
  assert.equal(s.built.ideas, false, "a mark in NEITHER record does not stand");
  assert.equal(s.source.ideas, null);
});

test("the Think Tank's own lane agrees with the vignette about the Think Tank", () => {
  // A SECOND LIVE DEFECT, and the reason `ideas()` takes the pen too. With the
  // vignette reading the union and this reading the fold, the quarter drew the
  // tank standing while the lane beneath it said "The Think Tank is not
  // standing yet" — one page, one building, two answers.
  const fold = { marks: [] };
  const pen = { [THINK_TANK_PLACE]: "Where ideas enter the town." };
  assert.equal(standing(fold, pen).built.ideas, true);
  assert.equal(ideas(fold, { places: pen }).placeExists, true,
    "the lane must use the same union the buildings use");
  assert.equal(ideas(fold).placeExists, false,
    "and with no pen offered it still reads the fold alone");
});

test("markBody takes the plaque and leaves the frontmatter", () => {
  const md = [
    "---", "kind: sited", "by: the-town", "at: { x: 250, y: -176 }", "---", "",
    "Where the town asks and is asked: the Quest Guild, the Think Tank.", "",
    "A second paragraph that is elaboration, not the plaque.",
  ].join("\n");
  assert.equal(markBody(md), "Where the town asks and is asked: the Quest Guild, the Think Tank.");
  assert.equal(markBody("no frontmatter at all"), "no frontmatter at all");
  assert.equal(markBody(""), null);
  assert.equal(markBody("---\nunterminated: true\n"), null, "a broken fence yields nothing, never half a file");
});

// RETIRED 2026-08-30 with the thing it protected: "the quarter's plaque is
// quoted, and absent rather than invented". It held quarterPlaque() to reading
// the world and never inventing a fallback sentence. The founder then ruled the
// vignette carries no description AT ALL — the heading and the five named
// buildings are the description — so the function lost its only caller and was
// removed, and a test for a function that does not exist is worse than none.
//
// The law it protected did not vanish, it moved up a level and got stricter:
// the vignette must render NO description, asserted on the rendered page in
// qa-shots/hub-shots.mjs where the old prose could actually come back.

// MOVED, not dropped: "the pen is read from the world package, not from a path
// typed here" now sits beside the walk's own laws below, where the reader it
// asserts about lives. It also grew a half: `loadPlaceMarks` and `readPen` must
// name exactly the same marks, because they are one traversal and a projection
// of it rather than two walks that could disagree.

// ── the Think Tank's ideas ───────────────────────────────────────────────────

test("THE LAW: class says what a mark is; the Think Tank is where ideas are READ", () => {
  // THE LAW, verbatim from the founder's 2026-09-01 ruling as the brief carries
  // it: "class says what a mark is; the Think Tank is where ideas are read, not
  // a container that makes them ideas."
  //
  // REVERSED FROM WHAT THIS FILE SAID YESTERDAY, and the reversal is the whole
  // point rather than a loosening. The old law was "an idea is the idea class
  // STANDING ON the think tank, and both halves matter", and its own comment
  // said class alone "would sweep in an idea-shaped mark placed anywhere in the
  // world" — which the founder has now ruled is not a sweep, it is the answer.
  // Geometry was constitutive and is not; an idea left from a resident's own
  // ground is still an ask of the town.
  const at = (o) => ({ class: IDEA_CLASS, placementParent: THINK_TANK_PLACE, ...o });
  assert.equal(isIdea(at({ id: "a" })), true, "an idea in the Tank is an idea");
  assert.equal(isIdea({ id: "b", class: IDEA_CLASS, placementParent: "the-town/the-garrison" }), true,
    "AND SO IS ONE STANDING ANYWHERE ELSE — this is the assertion the ruling reversed");
  assert.equal(isIdea({ id: "p", class: IDEA_CLASS, kind: "predicated", parent: "wright/a-newcomers-first-hour" }), true,
    "and a PREDICATED idea, which has no `at` at all — class alone decides (founder, 2026-09-01)");

  // WHAT DID NOT CHANGE, and it is the half that stops the reversal from being
  // a hole: the class still has to say idea. Standing on the tank does not make
  // a bench an idea.
  assert.equal(isIdea({ id: "c", class: "thing", placementParent: THINK_TANK_PLACE }), false);
  assert.equal(isIdea({ id: "d", class: "bounty", placementParent: THINK_TANK_PLACE }), false);
  assert.equal(isIdea(null), false);
  assert.equal(isIdea({ id: "e" }), false, "and a mark with no class at all is not an idea");

  // ── AND THE CLASS DEFINITION IS NOT AN INSTANCE OF ITSELF ──────────────────
  // FOUND ON THE BUILT PAGE, not in the ruling: with the placement test gone,
  // `the-town/idea` walked into the lane — `kind: "class"`, filed under
  // `the-town/mark`, body "One thought by a resident, of the town: …". It
  // carries `class: idea` because it IS the class. The Think Tank rendered the
  // town's dictionary entry as a resident's proposal.
  //
  // The exclusion asks the mark's OWN DECLARATION (`kind`), which is the field
  // the ruling's sentence points at, not where the mark stands.
  assert.equal(isIdea({ id: "the-town/idea", class: IDEA_CLASS, kind: "class", parent: "the-town/mark" }), false,
    "the class DEFINITION is not an idea — rendering it would put a proposal on the board that no resident made");
  assert.equal(isIdea({ id: "wright/x", class: IDEA_CLASS, kind: "sited", placementParent: THINK_TANK_PLACE }), true,
    "and a sited instance still is");
});

test("THE LAW: the Think Tank shows every idea in the world and no definition of one", () => {
  // ASSERTED AGAINST THE SHIPPED PIN, not a fixture, because the whole class of
  // bug this catches is a real mark nobody thought of. A fixture agrees only
  // with the hand that wrote it.
  const state = loadWorldState();
  if (!state) return; // no world installed — the module's own tests cover the shape
  const all = (state.marks ?? []).filter((m) => m?.class === IDEA_CLASS);
  const shown = ideas(state).ideas;
  const definitions = all.filter((m) => m.kind === "class");

  assert.ok(all.length > 0, "the pinned world carries no idea marks at all — this law is reading nothing");
  assert.equal(shown.length, all.length - definitions.length,
    "the lane shows every idea-class mark in the world except the class definitions");
  for (const d of definitions) {
    assert.equal(shown.some((i) => i.id === d.id), false,
      `the lane renders ${d.id}, which is the DEFINITION of the idea class and not an idea`);
  }
  assert.ok(shown.length > 0, "the lane shows nothing at all");

  // ── WHAT THIS LAW CANNOT PROVE ON THIS PIN, SAID PLAINLY ───────────────────
  // Every real idea in `569670a6` stands ON the Tank, so the by-class widening
  // adds exactly ZERO cards here — the only mark it swept in was the class
  // definition, which the exclusion above then removes. Under the OLD reader
  // this file would show the same seven-minus-one rows.
  //
  // That means the widening's live effect is UNPROVEN BY THE PIN and is proven
  // only by the fixture law above ("an idea says where it stands…"), which is
  // where the off-Tank and predicated cases are actually exercised. Printing
  // the count is how a later reader sees that for themselves rather than
  // reading this test's title and assuming it demonstrated something.
  const offTank = shown.filter((i) => i.standingAt !== null);
  console.log(`    (pin: ${all.length} idea-class marks, ${definitions.length} definition(s) excluded, ${offTank.length} standing off the Tank — the widening's live effect is 0 on this pin and is proven by fixture, not here)`);
});

test("THE LAW: an idea says where it stands, unless where it stands is the Tank", () => {
  // The founder's ruling's second half: each card gains one small line naming
  // the mark's placement parent, and says NOTHING when that parent is the Tank
  // — "no need to say what's redundant" (rule 4, say each thing once).
  //
  // THE FIXTURE CARRIES A PREDICATED IDEA ON PURPOSE, and its shape is the
  // measured one: in `world-state.json` a predicated mark has **no `at` key at
  // all** — absent, not null (Wright, 2026-09-01, from the store itself). So
  // the row below omits `at` entirely rather than setting it to null, which is
  // the difference between testing the real shape and testing a plausible one.
  //
  // NO GUARD WAS NEEDED, and that is worth asserting rather than assuming: this
  // reader never reads `at` in any branch. `isIdea` asks the class, `toIdea`
  // asks the body, and the standing-at line asks `placementParent ?? parent`.
  // A reader with an `=== null` guard would have dropped every predicated idea
  // silently; a reader with no guard at all cannot. The falsifier for that is
  // this fixture: it has no `at`, and it must come back as an idea.
  const state = {
    marks: [
      { id: THINK_TANK_PLACE },
      { id: "wright/in-the-tank", class: IDEA_CLASS, placementParent: THINK_TANK_PLACE, body: "In the tank." },
      { id: "wright/off-the-tank", class: IDEA_CLASS, placementParent: "the-town/the-garrison", body: "Off the tank." },
      { id: "wright/predicated", class: IDEA_CLASS, kind: "predicated", parent: "wright/a-newcomers-first-hour", body: "A predicate." },
    ],
  };
  const rows = ideas(state).ideas;
  assert.equal(rows.length, 3, "all three are ideas — geometry does not gate the lane any more");

  const by = Object.fromEntries(rows.map((r) => [r.id, r]));
  assert.equal(by["wright/in-the-tank"].standingAt, null,
    "an idea in the Tank must say nothing — the panel it is in already said it");
  assert.equal(by["wright/off-the-tank"].standingAt, "the garrison",
    "an idea elsewhere names where it stands, from the parent's own slug");
  assert.equal(by["wright/predicated"].standingAt, "a newcomers first hour",
    "and a predicated idea names the mark it is an idea OF — same line, same wording");

  // AND THE NAME IS DERIVED, NEVER TYPED. `placeName` reads the slug; the
  // household half of the id is who wrote the place down, which is not what
  // "where does this stand" asks.
  assert.equal(placeName("the-town/the-quest-guild"), "the quest guild");
  assert.equal(placeName(null), null);
});

test("THE LAW: an idea's body IS the claim — a body-only mark renders, as the door writes it", () => {
  // LOGOS/classes.md § idea: "one call, no git, the body is the claim." The
  // town door's do:"post" writes exactly { class, slug, body } — no title field
  // exists in the grammar. The first idea ever published (wright/a-newcomers-
  // first-hour, 2026-08-31) was dropped on the live page as "no title" because
  // this reader invented a field the law never defined.
  const first = toIdea({
    id: "wright/a-newcomers-first-hour", class: IDEA_CLASS, by: "wright",
    body: "A guided first hour for a new resident: one page walking arrival, first letter, first mark, first idea — each step a real act at a real door.",
  });
  assert.equal(first.ok, true, first.reason);
  assert.match(first.title, /^A guided first hour/);
  assert.equal(first.by, "wright");
});

test("a malformed idea is dropped and NAMED, never rendered half-built", () => {
  const bad = toIdea({ id: "x", class: IDEA_CLASS });
  assert.equal(bad.ok, false);
  assert.match(bad.reason, /no claim/);

  const long = toIdea({ id: "y", body: "z".repeat(TITLE_MAX + 1) });
  assert.equal(long.ok, false);
  assert.match(long.reason, new RegExp(String(TITLE_MAX)));
});

test("an idea without a blueprint is a real state, not a broken row", () => {
  // "climbing the Idea Lifecycle from its FIRST BREATH" — an idea may stand in
  // the world before anyone has drawn it. A row that demanded a blueprint slug
  // would drop exactly the ideas the lane exists to catch.
  const bare = toIdea({ id: "i", title: "A ferry timetable in the window" });
  assert.equal(bare.ok, true);
  assert.equal(bare.slug, null);
  assert.equal(bare.href, null, "and it must not fabricate a link into the chest");

  const drawn = toIdea({ id: "j", title: "A second bench", blueprint: "a-second-bench.md" });
  assert.equal(drawn.href, `${BLUEPRINTS_REPO}/blob/main/BLUEPRINTS/a-second-bench.md`);
});

test("ideas() separates the four kinds of nothing", () => {
  const unread = ideas(null);
  assert.equal(unread.storeRead, false);
  assert.equal(unread.placeExists, false);

  const noPlace = ideas({ marks: [{ id: "the-town/the-town-centre" }] });
  assert.equal(noPlace.storeRead, true);
  assert.equal(noPlace.placeExists, false, "the tank is not set down, and that is its own state");
  // AND `placeExists` STILL MEANS THE TANK, after the by-class ruling. The Tank
  // stopped being what makes a mark an idea; it did not stop being the place
  // this lane is about, and "the building is not standing yet" is still a real
  // and different state from "nobody has asked for anything".
  assert.equal(ideas({ marks: [{ id: "x", class: IDEA_CLASS, placementParent: "the-town/the-garrison", body: "An ask." }] }).placeExists,
    false, "an idea standing elsewhere does not conjure the Tank into the world");

  const upAndEmpty = ideas({ marks: [{ id: THINK_TANK_PLACE }] });
  assert.equal(upAndEmpty.placeExists, true);
  assert.equal(upAndEmpty.ideas.length, 0, "up and empty is a real state of the town");

  const withRows = ideas({
    marks: [
      { id: THINK_TANK_PLACE },
      { id: "a", class: IDEA_CLASS, placementParent: THINK_TANK_PLACE, title: "Older", date: "2026-08-01" },
      { id: "b", class: IDEA_CLASS, placementParent: THINK_TANK_PLACE, title: "Newer", date: "2026-08-20" },
      { id: "c", class: IDEA_CLASS, placementParent: THINK_TANK_PLACE },
    ],
  });
  assert.deepEqual(withRows.ideas.map((i) => i.title), ["Newer", "Older"], "newest first");
  assert.equal(withRows.malformed.length, 1, "the titleless one is dropped");
  assert.equal(withRows.malformed[0].id, "c", "and named, so the page can say how many");
});

// ── the stake, and the one source of it ──────────────────────────────────────

test("THE LAW: the escrow ledger and the fold's own totals agree, mark for mark", () => {
  // THE CROSS-CHECK THAT MAKES THE HOUSEHOLD COUNT TRUSTWORTHY, and the reason
  // the stake source is `world-state.json § portfolios` rather than
  // `mark.stamps`. The founder, 2026-08-31: "right now you can't even see how
  // many stamps are staked on an idea mark via the site."
  //
  // `mark.stamps` gives the TOTAL and nothing else; `portfolios` gives the rows
  // the total is made of, which is the only record that can answer "how many
  // households are behind this". Reading the rows instead of the total is only
  // safe if the two agree — so this asserts they do, for every mark in the
  // shipped pin, in both directions.
  const state = loadWorldState();
  assert.ok(state, "the world store did not load — the premise is gone, not the law");
  const stakes = markStakes(state);
  assert.equal(stakes.read, true, "the portfolios are not in the store this build read");

  const disagree = [];
  for (const mark of state.marks) {
    const rows = stakes.byMark[mark.id];
    const fromRows = rows?.stamps ?? 0;
    const fromFold = Number(mark.stamps) || 0;
    if (fromRows !== fromFold) disagree.push(`${mark.id}: rows ${fromRows} vs fold ${fromFold}`);
  }
  assert.deepEqual(disagree, [],
    `the ledger and the fold disagree about escrow: ${disagree.slice(0, 5).join("; ")}`);

  // and no ledger row names a mark the world does not have
  const ids = new Set(state.marks.map((m) => m.id));
  const orphans = Object.keys(stakes.byMark).filter((id) => !ids.has(id));
  assert.deepEqual(orphans, [], `escrow rows name marks the world does not carry: ${orphans.slice(0, 5).join(", ")}`);
});

test("THE LAW: uncounted is not zero", () => {
  // The founder's rule for the quest mirror, kept for the stakes: "A quest the
  // mirror has no column for is not at zero — it is uncounted, and saying zero
  // would be inventing a fact about the town."
  //
  // A store with no portfolios and a mark nobody has staked are both "no
  // number" and they do not mean the same thing. The first is a build that
  // could not read the ledger; the second is a real state of the town.
  assert.equal(markStakes(null).read, false);
  assert.equal(markStakes({ marks: [] }).read, false, "a store with no portfolios has no ledger to read");
  assert.equal(markStakes({ portfolios: [] }).read, false, "an ARRAY is not the ledger's shape");
  assert.deepEqual(stakeOf("x", markStakes(null)), { staked: null, households: null },
    "an unreadable ledger must come back null, never 0");

  const read = markStakes({ portfolios: { wright: [{ mark: "a", stamps: 3 }] } });
  assert.equal(read.read, true);
  assert.deepEqual(stakeOf("a", read), { staked: 3, households: 1 });
  assert.deepEqual(stakeOf("b", read), { staked: 0, households: 0 },
    "a mark nobody staked, on a ledger that DID read, is genuinely zero");

  // two households on one mark are two households, and a house with two rows
  // on the same mark is still one house
  const shared = markStakes({
    portfolios: { wright: [{ mark: "a", stamps: 3 }, { mark: "a", stamps: 2 }], rei: [{ mark: "a", stamps: 1 }] },
  });
  assert.deepEqual(stakeOf("a", shared), { staked: 6, households: 2 });
});

test("THE LAW: the ideas render in stamp-backed order", () => {
  // THE FOUNDER'S WORDS, 2026-09-01: "the actual state (as in the items on the
  // board), in stamp-backed order (cards are fine)."
  const state = {
    marks: [
      { id: THINK_TANK_PLACE },
      { id: "a/one", class: IDEA_CLASS, placementParent: THINK_TANK_PLACE, body: "One", date: "2026-08-01" },
      { id: "b/two", class: IDEA_CLASS, placementParent: THINK_TANK_PLACE, body: "Two", date: "2026-08-20" },
      { id: "c/three", class: IDEA_CLASS, placementParent: THINK_TANK_PLACE, body: "Three", date: "2026-08-30" },
    ],
    portfolios: { x: [{ mark: "a/one", stamps: 9 }], y: [{ mark: "b/two", stamps: 4 }] },
  };
  const stakes = markStakes(state);
  assert.deepEqual(ideas(state, { stakes }).ideas.map((i) => i.title), ["One", "Two", "Three"],
    "most-backed first, then newest — the newest idea with no stake sorts last");

  // AND AN UNREADABLE LEDGER DOES NOT REORDER THE LANE. A silent re-ranking on
  // a build that could not read the escrow would be a claim about backing made
  // out of nothing, so with no stakes the order falls back to newest-first —
  // the order this lane had before the ruling.
  assert.deepEqual(ideas(state).ideas.map((i) => i.title), ["Three", "Two", "One"]);
  assert.equal(ideas(state).ideas[0].staked, null, "and every card says it is uncounted");
  assert.equal(ideas(state, { stakes }).ideas[0].households, 1);
});

test("THE LAW: no number the page shows is one it could not derive", () => {
  // The dashboards' whole discipline in one sentence, and the two halves are
  // asserted separately because they fail in opposite directions: a figure that
  // cannot be derived must be null (so the page can say "uncounted"), and a
  // figure that CAN be derived must equal the derivation.
  const state = {
    marks: [
      { id: THINK_TANK_PLACE },
      { id: "a/one", class: IDEA_CLASS, placementParent: THINK_TANK_PLACE, body: "One", blueprint: "one.md" },
      { id: "b/two", class: IDEA_CLASS, placementParent: THINK_TANK_PLACE, body: "Two" },
    ],
    portfolios: { x: [{ mark: "a/one", stamps: 5 }], y: [{ mark: "a/one", stamps: 2 }, { mark: "b/two", stamps: 1 }] },
  };
  const stakes = markStakes(state);
  const tank = ideaDashboard(ideas(state, { stakes }), stakes);
  assert.equal(tank.counted, true);
  assert.equal(tank.ideas, 2);
  assert.equal(tank.staked, 8, "5 + 2 + 1 — the sum of the ledger's own rows");
  assert.equal(tank.households, 2, "x and y, counted once each");
  assert.equal(tank.drawn, 1, "only the idea with a blueprint slug is drawn");
  // the standing is by ✦ ON IDEAS, not by a whole portfolio
  assert.deepEqual(tank.backers.map((b) => [b.household, b.stamps]), [["x", 5], ["y", 3]]);

  // A HOUSE'S OTHER MARKS DO NOT COUNT. Ranking somebody's home mark against a
  // proposal would make the tank's leaderboard a wealth table.
  const noisy = markStakes({
    portfolios: { x: [{ mark: "a/one", stamps: 5 }, { mark: "x/their-home", stamps: 900 }] },
  });
  assert.deepEqual(ideaDashboard(ideas(state, { stakes: noisy }), noisy).backers.map((b) => b.stamps), [5]);

  // and with no ledger every ✦ figure is null rather than nought
  const blind = ideaDashboard(ideas(state), markStakes(null));
  assert.equal(blind.counted, false);
  assert.equal(blind.staked, null);
  assert.equal(blind.households, null);
  assert.equal(blind.ideas, 2, "what does not need the ledger is still counted");
});

test("THE LAW: a bounty's stake is visibility, so its posters are ranked by asks", () => {
  // THE FOUNDER'S RULING, 2026-08-30, which this dashboard had to be built
  // around rather than despite: stakes on a bounty mark are "visibility, not
  // funding, and no transfer obligation" — so the numbers are shown and the
  // word "backed by" is not, and a poster leaderboard denominated in money
  // would say the opposite of the law two blocks up the same panel.
  const rows = [
    { id: "w/a", status: "open", poster: "wright", ask: "A" },
    { id: "w/b", status: "open", poster: "wright", ask: "B" },
    { id: "r/c", status: "done", poster: "rei", ask: "C" },
  ];
  const stakes = markStakes({ portfolios: { h: [{ mark: "w/a", stamps: 6 }, { mark: "r/c", stamps: 2 }] } });
  const board = boardDashboard(rows, stakes);
  assert.equal(board.open, 2);
  assert.equal(board.done, 1);
  assert.equal(board.staked, 8, "every notice's escrow, open and done");
  assert.deepEqual(board.mostStaked.map((n) => n.id), ["w/a"], "only OPEN notices with a stake rank");
  assert.deepEqual(board.posters, [{ poster: "wright", notices: 2 }, { poster: "rei", notices: 1 }],
    "posters rank by how many asks they put up, never by stamps");

  const blind = boardDashboard(rows, markStakes(null));
  assert.equal(blind.staked, null, "uncounted, not zero");
  assert.deepEqual(blind.mostStaked, [], "and no ranking is invented from a ledger that did not read");
  assert.equal(blind.open, 2, "what does not need the ledger is still counted");
});

// ── the "?" bubble's decks ───────────────────────────────────────────────────

test("THE LAW: a deck is at most four slides, and only a live lane has one", () => {
  // THE FOUNDER'S WORDS, 2026-09-01: "a SUPER simple and clear, visual,
  // informative tutorial with just a couple of slides (no more than 4)" — and
  // "Each panel for the live ones (Quests, Ideas, Bounties)".
  assert.equal(MAX_SLIDES, 4);
  for (const lane of LANES) {
    const deck = tutorialFor(lane.key);
    if (!lane.live) {
      assert.deepEqual(deck, [], `${lane.key} is not live and must have no deck`);
      continue;
    }
    assert.ok(deck.length > 0, `${lane.key} is live and has no deck`);
    assert.ok(deck.length <= MAX_SLIDES, `${lane.key}'s deck is ${deck.length} slides`);
    for (const slide of deck) {
      assert.ok(slide.step && slide.say, "every slide needs a step and a sentence");
      // ONE SENTENCE. A paragraph in a "?" bubble is the wall the whole page
      // was restructured to remove.
      const sentences = slide.say.split(/(?<=[.!?])\s+/).filter((s) => s.trim());
      assert.equal(sentences.length, 1, `a slide of ${lane.key} says ${sentences.length} sentences: ${slide.say}`);
    }
  }
  // and no deck exists for a lane that does not
  for (const key of Object.keys(TUTORIALS)) {
    assert.ok(LANES.some((l) => l.key === key), `there is a deck for "${key}", which is not a lane`);
  }
});

// The acts a deck shows, as `<door> <verb>`.
function actsOnSlides() {
  const out = new Set();
  for (const key of Object.keys(TUTORIALS)) {
    for (const slide of TUTORIALS[key]) {
      if (!slide.call) continue;
      for (const m of slide.call.matchAll(/\b(town|household|world)\s*\{\s*do:\s*"([\w-]+)"/g)) {
        out.add(`${m[1]} ${m[2]}`);
      }
    }
  }
  return out;
}

// The acts the WORLD names, from the five plaques' predicated children.
function actsInTheWorld() {
  const pen = readPen();
  const state = loadWorldState();
  const out = new Set();
  for (const lane of LANES) {
    for (const row of predicatesOf(lane.place, { pen, state })) {
      for (const m of String(row.value).matchAll(/\b(town|household|world)\s+do:\s*"([\w-]+)"/g)) {
        out.add(`${m[1]} ${m[2]}`);
      }
    }
  }
  return out;
}

// The acts this module CITES to a door, by file and line, in its own header.
function actsCitedToADoor(src) {
  const out = new Set();
  for (const m of src.matchAll(/src\/(town|household|world)-apex\.mjs:[\d-]+\s+"?([\w-]+)/g)) {
    out.add(`${m[1]} ${m[2]}`);
  }
  return out;
}

test("THE LAW: every act on a slide is one a door names, or the world does", () => {
  // THE BRIEF'S RULE: "The verbs on the slides are read from the doors, not
  // invented... Cite the file:line for each verb."
  //
  // The office is not on this site's disk, so a slide's verb has two ways of
  // being answerable for, and both are checked here:
  //
  //   THE WORLD SAYS IT — the five plaques gained predicated children on
  //   2026-09-01 carrying the same grammar (`town do:"post"`, `town do:"stake"`,
  //   `world do:"leave-mark"`, `household do:"stake-vote"`). That is a second
  //   record written by another hand, and agreement between two records is
  //   worth more than either alone. Where both speak, they must agree.
  //
  //   OR THIS MODULE CITES IT — file and line, at the office train named in the
  //   header. `household do: "send"` is the live case: it is the letter-writing
  //   act at src/household-apex.mjs:85-86 and no plaque predicates it, because
  //   the plaques name what happens IN a lane and writing a letter is the
  //   household's own door.
  //
  // AN ACT IN NEITHER IS AN ACT SOMEBODY TYPED, which is the whole failure this
  // guards. (The first version of this test demanded the world name every act,
  // and went red on `household send` — a verb that is genuinely at a door and
  // genuinely not in a plaque. A check that a truthful citation fails is a check
  // that teaches people to stop citing.)
  const deckSrc = readFileSync(new URL("../src/lib/civic-tutorial.mjs", import.meta.url), "utf8");
  const world = actsInTheWorld();
  const cited = actsCitedToADoor(deckSrc);
  const shown = actsOnSlides();

  assert.ok(world.size > 0, "the pin carries no predicated verbs — half the premise is gone");
  assert.ok(cited.size > 0, "the module cites no door by file and line — the other half is gone");
  assert.ok(shown.size > 0, "no slide shows an act at all — the deck has stopped depicting acts");

  const invented = [...shown].filter((v) => !world.has(v) && !cited.has(v));
  assert.deepEqual(invented, [],
    `these acts are on a slide, in no world predicate and cited to no door: ${invented.join(", ")}`);

  // AND WHERE BOTH RECORDS SPEAK THEY AGREE. Every act the world predicates for
  // a live lane and the deck also shows is the same act; if they ever diverge
  // the WORLD is right and the deck is the bug.
  const overlap = [...shown].filter((v) => world.has(v));
  assert.ok(overlap.length >= 3,
    `only ${overlap.length} of the deck's acts are corroborated by a world predicate — the two records have stopped agreeing`);
});

test("the deck can actually fail, and does not route through the corner-note engine", () => {
  // A CAN-FAIL FLIP ON THE CHECK ABOVE, run rather than asserted: a made-up act
  // must be caught by both halves. Without this, a deck of nothing but prose
  // would pass the law vacuously.
  const deckSrc = readFileSync(new URL("../src/lib/civic-tutorial.mjs", import.meta.url), "utf8");
  const conjured = 'town { do: "conjure", args: {} }';
  const extracted = [...conjured.matchAll(/\b(town|household|world)\s*\{\s*do:\s*"([\w-]+)"/g)]
    .map((m) => `${m[1]} ${m[2]}`);
  assert.deepEqual(extracted, ["town conjure"], "the extractor must see a made-up act");
  assert.equal(actsInTheWorld().has("town conjure"), false, "and the world must not name it");
  assert.equal(actsCitedToADoor(deckSrc).has("town conjure"), false, "and no citation must cover it");

  // AND THE ENGINE IT MUST NOT USE. src/lib/tutorial.mjs is the corner-note
  // engine — show-once-per-household, signed-in only — which is the wrong
  // semantics for a "?" a human clicks on purpose and may click again tomorrow.
  assert.equal(/from\s+["'][^"']*\/tutorial\.mjs["']/.test(deckSrc), false,
    "the civic decks must not import the corner-note engine");
  const dialog = readFileSync(new URL("../src/components/LaneTutorial.astro", import.meta.url), "utf8");
  assert.equal(/from\s+["'][^"']*\/tutorial\.mjs["']/.test(dialog), false,
    "and neither must the dialog around them");
  // a native <dialog>, which is where the focus trap and Escape come from
  assert.ok(/<dialog class="c-tut"/.test(dialog), "the deck must be a native <dialog>");
});

// ── the world's as-of ────────────────────────────────────────────────────────

test("THE LAW: a derived block says which world it was derived from", () => {
  // The pots' own law, carried to the quarter: "A quiet market and a stale page
  // look identical on a money surface." The world store has no clock — `tick`
  // is 0 and there is no generated-at field — so the as-of is the PIN, which
  // names the commit this build read and cannot drift from the data it
  // describes the way a build-time clock would.
  const sha = worldPin();
  assert.match(String(sha), /^[0-9a-f]{40}$/, "the world pin did not resolve — every as-of caption is absent");

  // AND IT IS THE WORLD THAT WAS ACTUALLY INSTALLED, not merely the one asked
  // for. `npm ci` makes those the same by construction; this checks it rather
  // than trusting it, by reading the lockfile's own resolution.
  const lock = JSON.parse(readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"));
  const resolved = lock.packages?.["node_modules/postmark-world"]?.resolved ?? "";
  assert.ok(resolved.endsWith(`#${sha}`),
    `package.json pins ${sha} and the lock resolves ${resolved} — the page would name a world it did not read`);

  // fail-soft: a package.json it cannot read is a missing caption, not a dead page
  assert.equal(worldPin({ paths: ["G:/nowhere/package.json"] }), null);
});

// ── the bulletin mirrors ─────────────────────────────────────────────────────

const questMirror = [{
  slug: "quests",
  body: [
    "**11 quest completions today.** The town's daily quests, ranked.",
    "",
    "| # | resident | Reach out | Be reached | done today | all-time |",
    "|---|---|---|---|---|---|",
    "| 1 | little-bird | 5/5 ✓ | 5/5 ✓ | 2 | 35 |",
    "| 2 | wright | 0/5 | 4/5 | 0 | 15 |",
  ].join("\n"),
}];

// The registry's rows are quoted verbatim from the town's quest-registry.json.
// A first idea is the w36 release's flagship quest — a trim that quietly drops
// it from the cards should cost a named failure, not a silently shorter Guild.
test("the first-idea quest rides the cards, honest about its missing mirror column", () => {
  const cards = questCards(questStandings(questMirror));
  const firstIdea = cards.find((c) => c.title === "A first idea");
  assert.ok(firstIdea, "the registry carries the first-idea row");
  assert.equal(firstIdea.cadence, "once, and kept");
  assert.equal(firstIdea.done, null, "no mirror column yet — no count, never an invented zero");
});

test("the quest standings are read from the bulletin's own table", () => {
  const q = questStandings(questMirror);
  assert.equal(q.read, true);
  assert.equal(q.completions, 11, "the headline figure is the mirror's own, not recomputed");
  assert.equal(q.total, 2);
  assert.equal(q.rows[0].resident, "little-bird");
  assert.equal(q.rows[0].allTime, 35);
  assert.equal(q.rows[1].resident, "wright");
  // the separator row is not a resident
  assert.equal(q.rows.some((r) => /^-+$/.test(r.resident)), false);
});

test("the standings cap at the limit, so one lane cannot become the whole page", () => {
  const many = [{
    slug: "quests",
    body: ["| # | r | a | b | c | d |", "|---|---|---|---|---|---|",
      ...Array.from({ length: 40 }, (_, i) => `| ${i + 1} | r${i} | 1/5 | 1/5 | 0 | ${i} |`)].join("\n"),
  }];
  const q = questStandings(many);
  assert.equal(q.total, 40, "the total counts everybody");
  assert.equal(q.rows.length, 8, "but the page shows a head of it");
});

test("an unreadable quest mirror says so rather than showing an empty board", () => {
  // THE FAILURE THIS FORBIDS: the mirror is somebody else's markdown from
  // another pipeline. If its shape changes, "no standings" and "a town where
  // nobody quested" must not render as the same thing.
  assert.equal(questStandings([]).read, false, "a missing entry is unread, not empty");
  assert.equal(questStandings([{ slug: "quests", body: "the board is being rebuilt" }]).read, false,
    "a body with no table is unread, not a town with no questers");
  assert.equal(questStandings(null).read, false);
  assert.equal(questStandings(undefined).rows.length, 0);
});

test("the marketplace is counted by section, so the archive is not sold as live", () => {
  const md = [
    "# The marketplace",
    "## Asks — *I have X, asking N*",
    "| what | seller |", "|---|---|", "| a thing | x |", "| another | y |",
    "## Wants — *I want X, offering N*",
    "| want | by |", "|---|---|", "| a want | z |",
    "## Filled & withdrawn (the archive tail)",
    "| what | by |", "|---|---|", "| done | q |",
  ].join("\n");
  const m = marketplace([{ slug: "marketplace", body: md }]);
  assert.equal(m.read, true);
  assert.equal(m.asks, 2);
  assert.equal(m.wants, 1);
  assert.equal(m.archived, 1, "a filled row must not be counted among the open asks");
});

test("an empty marketplace with its headings intact still reads as read", () => {
  // The board exists and has nothing on it — which is a real state, and a
  // different one from a board that could not be parsed.
  const m = marketplace([{ slug: "marketplace", body: "## Asks\n\n*Nothing yet.*\n" }]);
  assert.equal(m.read, true, "headings present means the board was understood");
  assert.equal(m.asks, 0);
  assert.equal(marketplace([]).read, false, "a missing entry is a different thing");
});

// ── the pixel art ────────────────────────────────────────────────────────────

test("every sprite is a well-formed map", () => {
  // THE BUG THIS CATCHES, and it is the reason the checker exists at all: a row
  // one character short shifts every pixel after it. Nothing throws, the page
  // builds, and a building ships with a notch cut out of it. This is the only
  // thing standing between that and production other than somebody's eyes.
  assert.deepEqual(checkAllSprites(), {},
    "a sprite map has a row of the wrong length — see the report for which");
  for (const [name, rows] of Object.entries(SPRITES)) {
    assert.equal(rows.length, SPRITE_H, `${name} is not ${SPRITE_H} rows tall`);
    for (const row of rows) assert.equal(row.length, SPRITE_W, `${name} has a row that is not ${SPRITE_W} wide`);
  }
});

test("the checker can actually fail", () => {
  // A can-fail flip on the guard itself. A checker that returns [] for a map
  // that is plainly broken protects nothing, and would have been the quietest
  // possible way for all of the above to be theatre.
  assert.ok(checkSprite("bad", ["..", "...."]).length > 0, "a ragged map must be reported");
  assert.ok(checkSprite("short", ["........................"]).length > 0, "a map of one row must be reported");
});

test("a building is drawn for every lane, and each has its own palette", () => {
  for (const lane of LANES) {
    assert.ok(SPRITES[lane.key], `no sprite for the ${lane.key} lane`);
  }
  const palettes = LANES.map((l) => [...new Set(paint(l.key).map((r) => r.fill))].sort().join(","));
  assert.equal(new Set(palettes).size, LANES.length,
    "two buildings share a palette — the five must read apart in the dark");
});

test("paint refuses ink it does not know, rather than leaving a hole in a wall", () => {
  // A typo in a map is a character with no colour. Painting it as transparent
  // would put a gap in a building that looks exactly like a deliberate window.
  const rows = Array.from({ length: SPRITE_H }, () => ".".repeat(SPRITE_W));
  rows[5] = "Z".repeat(SPRITE_W);
  SPRITES.__probe = rows;
  try {
    assert.throws(() => paint("__probe"), /ink "Z"/, "unknown ink must throw and name itself");
  } finally {
    delete SPRITES.__probe;
  }
  assert.throws(() => paint("no-such-building"), /no sprite named/);
});

test("paint merges runs, and every rect it emits is inside the sprite", () => {
  const rects = paint("quests");
  assert.ok(rects.length > 0, "the quest guild painted nothing");
  // merging is what keeps five buildings from being 2880 rects of markup
  assert.ok(rects.length < SPRITE_W * SPRITE_H / 3,
    `${rects.length} rects for a ${SPRITE_W}×${SPRITE_H} map — the runs are not merging`);
  for (const r of rects) {
    assert.ok(r.x >= 0 && r.x + r.w <= SPRITE_W, `a rect runs off the sprite at x=${r.x} w=${r.w}`);
    assert.ok(r.y >= 0 && r.y < SPRITE_H, `a rect sits off the sprite at y=${r.y}`);
    assert.match(r.fill, /^#[0-9a-f]{6}$/i, `a rect carries a non-colour fill: ${r.fill}`);
  }
});

// ── the law lines, read rather than kept ─────────────────────────────────────

test("THE LAW: every panel's title is its building's plaque, read from the pin", () => {
  // THE FOUNDER'S WORDS, 2026-09-01: "The marks that we drafted up should be
  // really big font (like the title of that panel)" and — on the cite line that
  // used to sit under it — "Don't include distracting text like 'the world's
  // own words, at the-town/quest', BUT it *should* [be] the words from the mark
  // pulled verbatim."
  //
  // ASSERTED AGAINST THE WORLD, not against itself. A constant that agrees with
  // a constant proves nothing; this reads the pen the site actually ships with
  // and requires each rendered title to BE that mark's body.
  //
  // THIS IS THE TEST THE OLD TWO-LEVEL WALK COULD NOT HAVE PASSED. Only three
  // of the five plaques sit at `<household>/<slug>`; the bounty board's is
  // three directories deep and the ballot house's four, under the town centre.
  const pen = readPen();
  const state = loadWorldState();
  assert.ok(Object.keys(pen).length > 0, "no authored marks resolved — the pen is dead and the premise with it");
  for (const lane of LANES) {
    const penned = pen[lane.place];
    assert.ok(penned, `the pen has no mark at ${lane.place} — the premise is gone, not the law`);
    assert.ok(penned.body, `${lane.place} has no body to be a title`);
    const p = plaque(lane, { pen, state });
    assert.equal(p.text, penned.body, `the ${lane.key} panel does not render its own mark's body`);
    assert.equal(p.live, true, `the ${lane.key} plaque did not read`);
    assert.equal(p.source, "pen", `the ${lane.key} plaque came from the ${p.source}, not the pen`);
  }
});

test("THE LAW: when the pen and the fold disagree, the pen is right and the fold is stale", () => {
  // THE TOWN'S OWN GRAMMAR, quoted — the price board's opening sentence, which
  // civic.mjs's header has run on since 2026-08-30: "when this board and the
  // mail disagree, the mail is right and this board is stale."
  //
  // NOT HYPOTHETICAL. On the pin this branch was built against, world main
  // rewrote all five plaques and did not re-run the fold, so `world-state.json`
  // carried the five SUPERSEDED bodies while the mark.md files carried the
  // founder's new ones. A reader that preferred the fold would have rendered
  // five sentences the founder replaced that night and looked correct doing it.
  const lane = LANES.find((l) => l.key === "ideas");
  const pen = { [lane.place]: { id: lane.place, body: "The pen says this." } };
  const state = { marks: [{ id: lane.place, body: "The fold says something older." }] };

  assert.equal(plaque(lane, { pen, state }).text, "The pen says this.");
  assert.equal(plaque(lane, { pen, state }).source, "pen");

  // AND THE FOLD IS STILL A READER, second. A mark whose mark.md is gone but
  // which the fold still carries has a body, and refusing to read it would be
  // a different kind of dishonesty.
  assert.equal(plaque(lane, { pen: {}, state }).text, "The fold says something older.");
  assert.equal(plaque(lane, { pen: {}, state }).source, "fold");
});

test("THE LAW: with no plaque, the fallback is the lane's NAME and never a sentence", () => {
  // The failure this exists for, in one sentence: the page carried a HAND COPY
  // of `the-town/how-ideas-enter` made four hours before the founder rewrote
  // that mark, and recited the dead version for a day because nothing on either
  // side compared them. A copy nothing checks goes stale silently — so when
  // neither record answers, the page must fall back to something that is NOT a
  // quotation and must say that it did.
  //
  // The old fallback was the lane's `law` constant: a sentence, indistinguishable
  // from a plaque to a reader, and stale by the time it mattered. A NAME cannot
  // go stale, because it is not a copy of anything.
  for (const lane of LANES) {
    const blind = plaque(lane, { pen: {}, state: null });
    assert.equal(blind.text, lane.name, `${lane.key} falls back to something other than its name`);
    assert.equal(blind.live, false, "and the page must be told the plaque did not read");
    assert.equal(blind.source, null);
    // the shape of a name, not the shape of a sentence
    assert.equal(/\.\s|\.$/.test(blind.text), false,
      `${lane.key}'s fallback reads as prose: ${blind.text}`);
  }
  // a lane with no place at all is the same honest nothing, not a throw
  assert.deepEqual(plaque({ name: "nowhere" }, {}), { text: null, from: null, live: false, source: null });
  assert.equal(plaque(null, {}).text, null);
});

// ── the pen, walked whole ────────────────────────────────────────────────────

test("THE LAW: a mark's id is <by>/<slug>, and depth is placement rather than identity", () => {
  // THE DERIVATION THIS PROVES, asserted against the shipped pin and not
  // against a fixture: every authored mark in the world resolves, by
  // `<frontmatter by>/<directory name>`, onto the id the FOLD gives that same
  // mark — with nothing unmatched in either direction.
  //
  // WHY IT MATTERS: the old reader walked exactly two levels and keyed a mark
  // by `<top directory>/<second directory>`, which is a mark's PLACEMENT. That
  // is right for a mark filed at the root and wrong for every mark filed under
  // another — including the Bounty Board (three deep) and the Ballot House
  // (four deep), whose plaques the site could therefore never read and whose
  // absence the page papered over with typed copies.
  // ASKED IN THE DIRECTION THAT PROVES THE DERIVATION: every id the FOLD
  // carries must be one the pen resolves to. A folded mark was authored, so if
  // this walk built any id wrongly that mark's fold id would have no pen match
  // — one wrong derivation anywhere is one red here.
  //
  // NOT THE OTHER DIRECTION, and the first version of this test asserted it and
  // was wrong to. The pen may legitimately carry marks the fold does not: the
  // store folds new marks at the settlement sweep, so anything authored since
  // the last one is in the tree and not yet in the store. On this pin that is
  // the 22 predicated children planted under the five plaques hours ago —
  // exactly the marks the panels read. A test that demanded pen ⊆ fold would
  // have gone red on a correct page and called a pipeline's cadence a defect.
  const pen = readPen();
  const state = loadWorldState();
  assert.ok(state, "the world store did not load — the premise is gone, not the law");
  const foldIds = state.marks.map((m) => m.id);
  const penIds = new Set(Object.keys(pen));
  assert.ok(penIds.size > 500, `only ${penIds.size} authored marks resolved — the walk is not reaching the tree`);

  const underived = foldIds.filter((id) => !penIds.has(id));
  assert.deepEqual(underived, [],
    `the fold carries these marks and the pen walk resolves none of them: ${underived.slice(0, 5).join(", ")} — the id derivation is wrong`);

  // and the un-folded remainder is the pen's alone, named rather than tolerated
  const unswept = [...penIds].filter((id) => !foldIds.includes(id));
  assert.ok(unswept.length < foldIds.length / 10,
    `${unswept.length} authored marks are missing from the fold — that is not a sweep lagging, that is a broken fold`);

  // THE DEEP ONES BY NAME, because those are the two that were unreachable and
  // a regression to a shallow walk would otherwise only show up as a plaque
  // quietly falling back to a lane name.
  //
  // ASSERTED AS PATH ≠ IDENTITY: both ids begin `the-town/`, and neither mark
  // is filed under a `the-town` directory. That is the whole finding in one
  // assertion — a walk that read identity off the path could not produce these.
  for (const deep of ["the-town/the-bounty-board", "the-town/the-ballot-house"]) {
    assert.ok(pen[deep]?.body, `${deep} is unreachable to the pen walk again`);
    const dir = pen[deep].dir.replace(/\\/g, "/");
    assert.ok(/\/marks\/let-there-be-light\//.test(dir),
      `${deep} is no longer filed under the town centre — the premise moved: ${dir}`);
    assert.equal(/\/marks\/the-town\//.test(dir), false,
      `${deep} is being resolved from its path rather than from its own frontmatter`);
  }
});

test("the pen walk can actually fail, and a mark with no author gets no id", () => {
  // A can-fail flip on the walk itself. A reader that returns {} for every
  // input would make every assertion above vacuous, and a reader that GUESSED
  // an id from a path would be the exact bug this replaced.
  assert.deepEqual(readPen({ dir: "G:/nowhere/at/all" }), {});
  assert.deepEqual(readPen({ dir: null }), {});
  assert.deepEqual(loadPlaceMarks({ dir: "G:/nowhere/at/all" }), {});
  assert.deepEqual(loadPlaceMarks({ dir: null }), {});

  // and the frontmatter reader refuses what it cannot read as a scalar rather
  // than half-parsing it — `at: { x: 250, y: -176 }` is a flow map and this
  // reader has no business pretending to understand it
  const fields = markFields("---\nby: the-town\nkind: sited\nat: { x: 250, y: -176 }\nslot: post\n---\n\nbody");
  assert.equal(fields.by, "the-town");
  assert.equal(fields.kind, "sited");
  assert.equal(fields.slot, "post");
  assert.equal(fields.at, undefined, "a flow map must not be half-parsed into a string");
  assert.deepEqual(markFields("no frontmatter"), {});
  assert.deepEqual(markFields("---\nunterminated: true\n"), {});
});

test("the pen is read from the world package, not from a path typed here", () => {
  // Resolved through an EXPORTED specifier for board.mjs's own reason: the
  // package.json is not in the exports map, so resolving it throws and the
  // reader would silently see no marks at all.
  const places = loadPlaceMarks();
  assert.ok(Object.keys(places).length > 0,
    "no authored marks resolved — the pen half of the union is dead");
  // and `loadPlaceMarks` is a PROJECTION of `readPen`, not a second walk: the
  // two must name exactly the same marks or there are two answers to which
  // marks exist
  assert.deepEqual(Object.keys(places).sort(), Object.keys(readPen()).sort());
});

// ── the predicates ───────────────────────────────────────────────────────────

test("THE LAW: a plaque's predicated children render as slot · value, or not at all", () => {
  // THE FOUNDER'S ASK, 2026-09-01: "Predicates, small, under the title — if the
  // pin carries predicated children under a plaque, render them as a quiet
  // `slot · value` row. None present → render nothing, no placeholder."
  //
  // Read from the PEN, and on this pin that is the only reader that answers:
  // the world store folds new marks at the settlement sweep, so a page reading
  // the fold alone renders an empty block tonight and it looks like this page's
  // defect rather than a pipeline's cadence.
  const pen = readPen();
  const state = loadWorldState();
  const tank = predicatesOf(THINK_TANK_PLACE, { pen, state });
  assert.ok(tank.length > 0,
    "the Think Tank carries no predicated children on this pin — the premise is gone, not the law");
  for (const row of tank) {
    assert.ok(row.slot && row.value, "a predicate row must carry both halves or neither");
    assert.equal(typeof row.slot, "string");
  }
  // the child is found by its PARENT, which is the mark it is filed under —
  // not by a slug prefix, which is a convention nobody is bound by
  const child = Object.values(pen).find((m) => m.kind === "predicated" && m.parent === THINK_TANK_PLACE);
  assert.ok(child, "no predicated child names the tank as its parent");
  assert.equal(child.parent, THINK_TANK_PLACE);

  // NONE PRESENT IS NOTHING, not a placeholder — the can-fail half
  assert.deepEqual(predicatesOf("the-town/nowhere", { pen, state }), []);
  assert.deepEqual(predicatesOf(THINK_TANK_PLACE, { pen: {}, state: { marks: [] } }), []);
  // a child with only half a pair is dropped rather than rendered half-built
  assert.deepEqual(
    predicatesOf("p", { pen: { x: { kind: "predicated", parent: "p", slot: "post", value: "" } } }),
    []);
  // and the same child in both records is counted once
  assert.deepEqual(
    predicatesOf("p", {
      pen: { x: { kind: "predicated", parent: "p", slot: "post", value: "v" } },
      state: { marks: [{ id: "x", kind: "predicated", parent: "p", slot: "post", value: "v" }] },
    }),
    [{ slot: "post", value: "v" }]);
});

test("THE LAW: an idea's claim is shown once", () => {
  // THE FOUNDER'S WORDS, 2026-08-31: "with the body now the claim, a card
  // renders `by`, then the claim as title, then the same text again as body.
  // Render the claim once." So a mark whose body IS its claim carries no
  // separate body, and the card has nothing to print twice.
  const claim = "A guided first hour for a new resident, walking arrival to first idea.";
  const bodyOnly = toIdea({ id: "wright/a-newcomers-first-hour", class: IDEA_CLASS, body: claim });
  assert.equal(bodyOnly.title, claim, "the body is still the claim");
  assert.equal(bodyOnly.body, null, "and must not come back a second time as the card's body");

  // A DISTINCT BODY STILL RENDERS, which is the half that keeps this from being
  // a deletion: a hand that wrote both a title and a body said two things.
  const both = toIdea({ id: "x", class: IDEA_CLASS, title: "A second bench", body: "By the quay, facing the water." });
  assert.equal(both.title, "A second bench");
  assert.equal(both.body, "By the quay, facing the water.", "two real statements are both kept");
});

test("the art wears the town's own palette and invents no hex", () => {
  // The vignette is a warm accent on the site's weather, not a theme takeover.
  // Every shared ink is one the town already wears in src/styles/postmark.css.
  assert.equal(INK.k, "#070b15", "the night must be --pm-night");
  assert.equal(INK.G, "#f6dcae", "the hot window must be --pm-gold-bright");
  assert.equal(INK.g, "#e8c48b", "and the warm one --pm-gold");
  assert.equal(INK.p, "#f7efdc", "paper must be --pm-paper");
});

test("THE LAW: a panel wears its own building's palette and invents no hex", () => {
  // THE FOUNDER'S WORDS, 2026-08-31: "colour the panels similarly to their
  // pixel art buildings." The sibling of the art law above, and it asserts the
  // same thing one level up — the panel's colour is not merely *similar* to the
  // building's, it is READ FROM THE SAME TABLE, so the two cannot drift.
  for (const lane of LANES) {
    const t = tint(lane.key);
    const accent = ACCENTS[lane.key];
    // every value is that lane's own accent, channel for channel
    assert.deepEqual(channels(accent.A), rgbOf(t.edge), `${lane.key}'s border is not its lit accent`);
    assert.deepEqual(channels(accent.A), rgbOf(t.edgeOpen), `${lane.key}'s open border is not its lit accent`);
    assert.deepEqual(channels(accent.a), rgbOf(t.wash), `${lane.key}'s wash is not its accent`);
    assert.deepEqual(channels(accent.a), rgbOf(t.washHover), `${lane.key}'s hover wash is not its accent`);
    // A TINT, NOT A FLOOD. The wash rides a heading strip over the page's own
    // night; past a low alpha it stops being a tint and the lane becomes its
    // own coloured page, which is the thing "similarly to" does not mean.
    assert.ok(alphaOf(t.wash) <= 0.25, `${lane.key}'s wash is a flood at ${alphaOf(t.wash)}`);
    assert.ok(alphaOf(t.washHover) <= 0.3, `${lane.key}'s hover wash is a flood`);
    // and the border has to be visible at all, or the panel is not tinted
    assert.ok(alphaOf(t.edge) >= 0.2 && alphaOf(t.edgeOpen) > alphaOf(t.edge),
      `${lane.key}'s border does not read, or does not wake when the lane opens`);
  }

  // FIVE PANELS, FIVE COLOURS — the same distinctness the buildings are held to,
  // because a reader who can tell the buildings apart and not the panels has
  // been given a colour that means nothing.
  const edges = LANES.map((l) => tint(l.key).edge);
  assert.equal(new Set(edges).size, LANES.length, "two panels share a tint");

  // and the page must take them from here rather than typing them
  const hub = readFileSync(new URL("../town/pages/town/index.astro", import.meta.url), "utf8");
  const style = hub.slice(hub.indexOf("<style>"));
  const lanesCss = style.slice(style.indexOf(".c-lane {"), style.indexOf(".q-stand"));
  assert.equal(/#[0-9a-f]{6}/i.test(lanesCss), false,
    `the lane panels' CSS types a hex: ${(lanesCss.match(/#[0-9a-f]{6}/i) || [])[0]} — the palette is civic-art.mjs's`);
  assert.ok(/--lane-edge/.test(lanesCss) && /--lane-wash/.test(lanesCss),
    "the panels must wear the tint variables");
  for (const lane of LANES) {
    assert.ok(hub.includes(`tintVars("${lane.key}")`), `the ${lane.key} panel is not tinted`);
  }
});

test("THE LAW: the Quest Guild wears the stamps' purple, and the Ballot House the guild's orange", () => {
  // THE FOUNDER'S REASON, 2026-09-01, verbatim: "the quest guild has the most
  // to do with the stamps themselves" — and stamps are purple by
  // src/styles/postmark.css's own law ("stamps are purple (law, Keemin
  // 2026-07-29)"). So the two lanes traded accents.
  //
  // THE PURPLE IS READ FROM THE STYLESHEET, NOT TYPED HERE. A test that
  // hard-coded the hex would go green on a palette that had drifted away from
  // the town's stamp family, which is the failure the whole one-palette
  // discipline exists to prevent — and it would be a THIRD copy of a token that
  // already has one owner.
  const css = readFileSync(new URL("../src/styles/postmark.css", import.meta.url), "utf8");
  const token = (name) => {
    const m = new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, "i").exec(css);
    assert.ok(m, `postmark.css no longer declares --${name}`);
    return m[1].toLowerCase();
  };
  const stampDark = token("pm-stamp-dark");

  assert.equal(ACCENTS.quests.a.toLowerCase(), stampDark,
    "the Quest Guild's accent must BE the stamps' own dark violet — it is the lane that mints them");
  assert.equal(ACCENTS.votes.a.toLowerCase(), "#a4632a",
    "and the Ballot House takes the orange the Guild was wearing");

  // AND THEY REALLY SWAPPED rather than both drifting somewhere new: each one's
  // three inks are the other's former three, as a set.
  assert.deepEqual(Object.values(ACCENTS.votes).map((h) => h.toLowerCase()),
    ["#a4632a", "#c9823d", "#6d4220"], "the Ballot House wears the Guild's former three inks, unchanged");
  assert.deepEqual(Object.values(ACCENTS.quests).map((h) => h.toLowerCase()),
    ["#65517f", "#8a72ab", "#433554"], "and the Guild the Ballot House's, unchanged — a swap, not a repaint");

  // THE STAMP TOKEN ITSELF IS UNTOUCHED, which the brief names explicitly. A
  // swap that moved the currency's own colour would be a different change
  // wearing this one's clothes.
  assert.equal(token("pm-stamp"), "#aa8fd8");
  assert.equal(token("pm-stamp-bright"), "#d8c7ef");
});

test("channels() refuses anything that is not a colour", () => {
  // A can-fail flip on the tint's own foundation. If this parsed junk into
  // zeroes, every assertion above would compare black to black and pass.
  assert.deepEqual(channels("#a4632a"), [164, 99, 42]);
  assert.throws(() => channels("a4632a"), /not a six-digit hex/, "a bare hex must be refused");
  assert.throws(() => channels("#abc"), /not a six-digit hex/, "and a shorthand one");
  assert.throws(() => channels(null), /not a six-digit hex/);
  assert.throws(() => tint("no-such-lane"), /no palette for lane/);
});

// POS-327 (Little Bird, 10-04): the Guild's cards say whose bar each is.
test("POS-327: the Guild labels the daily pair the household's and the friendship the pair's", async () => {
  const { QUEST_KIND, PAIR_RULE, questKind } = await import("../src/lib/civic.mjs");
  const cards = questCards(questStandings(questMirror));
  const kind = (t) => cards.find((c) => c.title === t)?.cadence;
  assert.equal(kind("Reach out"), "Household · daily");
  assert.equal(kind("Be reached"), "Household · daily");
  assert.equal(kind("Budding friendship"), "Just you · pair");
  assert.equal(kind("A first idea"), "once, and kept", "a first idea is once per household, not a pair");
  assert.deepEqual({ ...QUEST_KIND }, { daily: "Household · daily", pair: "Just you · pair" });
  assert.equal(PAIR_RULE, "A full household bar doesn't block anyone's pair quests.");
  assert.equal(questKind({ title: "Budding friendship" }, "milestone"), "Just you · pair");
});
