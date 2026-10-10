// civic.mjs — the civic quarter's reader.
//
// THE ONTOLOGY THIS SERVES is the world's own, not this file's. The town ruled
// the three asks as constitutional marks, and the sentence is quoted from
// `the-town/the-three-asks` verbatim:
//
//   "Quests are the town's asks for its residents; bounties are residents' asks
//    for other residents; blueprints are residents' asks for the town."
//
// Five lanes stand on that: the three asks, plus the marketplace (residents
// demanding stamps for goods) and the ballot house (the town asking residents
// for their word). This module answers three questions about them and nothing
// else — which buildings STAND in the world, what is IN each lane, and where
// each lane's own surface lives.
//
// WHAT THIS FILE DOES NOT DO: it computes no economics and re-derives nothing
// that already has a home. The board is board.mjs's, the pots and dials are
// funding.mjs's, and the world store is loaded through board.mjs's own loader
// rather than a second copy of it. One derivation, imported — never forked.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

import { loadWorldState, BOARD_PLACE } from "./board.mjs";
import { floorPinFrom } from "../../tools/lib/world-pin.mjs";

import { readFileSync as readDataFile } from "node:fs";
import { join as joinPath } from "node:path";
export { loadWorldState, BOARD_PLACE };

// ── WHEN THIS WORLD WAS READ ─────────────────────────────────────────────────
// Every derived block on the quarter has to be markable with its as-of, the way
// the pots carry the emission's own stamp — "a quiet market and a stale page
// look identical without it".
//
// THE WORLD STORE CARRIES NO CLOCK. `world-state.json` has a `tick` (0 on this
// pin) and no generated-at field of any kind, so there is no timestamp to read
// and a build-time clock would tick even when nothing changed — the exact thing
// the pots' stamp exists to avoid. What the world DOES have is a commit, and
// the pin names it: this build read that world and no other.
//
// So the as-of is the PIN, read from the site's own package.json through
// tools/lib/world-pin.mjs's `floorPinFrom` — the same function the rebuild-time
// pin machinery reads it with, imported rather than re-parsed, so a change to
// the pin spec's shape cannot leave two readers disagreeing about it.
//
// PIN-AS-ASKED IS PIN-AS-INSTALLED HERE, and the reason is `npm ci`: it
// installs the lockfile's resolution and FAILS when the lock and package.json
// disagree, so on any build that got this far the two are the same sha. On a
// tree assembled some other way they could differ, and this would then name the
// world the site asked for rather than the one it read — which is why the
// falsifier in test/civic.test.mjs checks the pin against the resolved package
// rather than trusting this.
//
// TWO CANDIDATE PATHS, and the second one is not belt-and-braces. Astro bundles
// page frontmatter into a chunk, so `import.meta.url` at build time is the
// chunk's URL and not this file's — the first build with only that candidate
// rendered every as-of caption absent, silently, and looked fine. `cwd` is the
// project root during a build and during `node --test`, which is what actually
// answers. The first candidate that yields a valid pin wins.
//
// Fail-soft: `floorPinFrom` throws when the dependency is missing or is not a
// 40-hex pin, and a page must not die because it could not date itself.
export function worldPin({ paths = null } = {}) {
  const candidates = paths ?? [
    join(process.cwd(), "package.json"),
    new URL("../../package.json", import.meta.url),
  ];
  for (const candidate of candidates) {
    try {
      return floorPinFrom(readFileSync(candidate, "utf8")).sha;
    } catch {
      // this candidate is not the site's package.json; try the next
    }
  }
  return null;
}

// ── THE PEN AND THE FOLD ─────────────────────────────────────────────────────
// The world ships a mark TWICE: as the authored record at
// `WORLD/marks/<household>/<slug>/mark.md`, which is somebody's pen, and inside
// the derived `WORLD/world-state.json`, which is a FOLD of every pen. The site
// has always read the fold, because that is where a mark's computed weight and
// placement live.
//
// THE TWO CAN DISAGREE, and on 2026-08-30 they did. The world commit that
// planted the civic quarter (0b4616cc, "THE CIVIC QUARTER stands whole") added
// four mark.md files — the-civic-quarter, the-quest-guild, the-marketplace,
// the-think-tank — and did not re-run the fold, so world-state.json at that
// exact pin does not contain one of them. A site reading only the fold renders
// four buildings the world has genuinely planted as "not standing yet".
//
// WHEN THEY DISAGREE THE PEN IS RIGHT AND THE FOLD IS STALE. That is not a rule
// invented here; it is the town's own grammar, the same sentence the price
// board opens with ("when this board and the mail disagree, the mail is right
// and this board is stale"). So `standing()` reads the UNION and a mark counts
// as standing if either source carries it.
//
// This is not a second truth and not a fork of board.mjs: the bounties still
// come from the fold, with its math untouched. What is added is one narrow
// question — does this PLACE exist, and what does its plaque say — asked of the
// more authoritative of the two records first.
export const MARKS_DIR_PARTS = ["..", "WORLD", "marks"];

// Where the authored marks live, resolved the same way board.mjs resolves the
// store: through an EXPORTED specifier, because `postmark-world/package.json`
// is not in the package's exports map and resolving it throws.
export function marksDir({ require: req = createRequire(import.meta.url) } = {}) {
  try {
    return join(dirname(req.resolve("postmark-world/geometry")), ...MARKS_DIR_PARTS);
  } catch {
    return null;
  }
}

// A mark.md is YAML-ish frontmatter between two `---` fences, then prose. Only
// two things are wanted here — that the file exists, and its one-breath body —
// so this reads the body and does not pretend to parse the frontmatter.
export function markBody(text) {
  const s = String(text ?? "");
  if (!s.startsWith("---")) return s.trim() || null;
  const end = s.indexOf("\n---", 3);
  if (end < 0) return null;
  const body = s.slice(s.indexOf("\n", end + 1) + 1).trim();
  // the first paragraph is the plaque; anything after it is elaboration
  return body.split(/\n\s*\n/)[0].trim() || null;
}

// The SCALAR frontmatter lines, and only those. `by`, `kind`, `slot` and
// `value` are what this reader needs and every one of them is a one-line
// scalar; `at: { x, y }` and `extent:` are flow maps and are deliberately not
// parsed, because a half-parser that guesses at nested YAML is a second, worse
// copy of the fold's own loader. What is not a plain `key: value` line comes
// back absent, which every caller already treats as "the pen did not say".
export function markFields(text) {
  const s = String(text ?? "");
  if (!s.startsWith("---")) return {};
  const end = s.indexOf("\n---", 3);
  if (end < 0) return {};
  const out = {};
  for (const line of s.slice(3, end).split(/\r?\n/)) {
    const m = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    if (!m) continue;
    const raw = m[2].trim();
    if (!raw || raw.startsWith("{") || raw.startsWith("[")) continue;
    out[m[1]] = raw.replace(/^["'](.*)["']$/, "$1");
  }
  return out;
}

// ── THE PEN, WALKED WHOLE ────────────────────────────────────────────────────
// THIS USED TO WALK EXACTLY TWO LEVELS — `<household>/<slug>` — and that was
// not a shortcut, it was a WRONG MODEL of the tree, which is why it cost two
// lanes their plaque and cost the file a comment apologising for the limit.
//
// A mark's id is `<by>/<slug>`. Its DIRECTORY is its PLACEMENT: the bounty
// board's mark is filed at `let-there-be-light/the-town-centre/the-bounty-board`
// because that is where it stands, and its id is still `the-town/the-bounty-
// board` because `by: the-town` wrote it. Depth is placement, never identity —
// so a two-level walk found the two lanes whose buildings happen to sit at the
// root and missed the three filed under the town centre.
//
// PROVEN, NOT ASSUMED: `id = <frontmatter by>/<directory name>` resolves all
// 1050 authored marks in the pinned world onto the 1050 ids the fold gives
// them, with zero unmatched either way. That equality is asserted as a law in
// test/civic.test.mjs against the shipped pin rather than against a fixture,
// because a derivation that agrees with a fixture agrees only with itself.
//
// A mark with no `by:` gets no id and is skipped rather than guessed at.
export function readPen({ dir = marksDir() } = {}) {
  const out = {};
  if (!dir || !existsSync(dir)) return out;
  const walk = (d, depth) => {
    // the tree is shallow (deepest authored mark today is six levels); the cap
    // is a runaway guard, not a model of the shape
    if (depth > 12) return;
    let entries;
    try {
      entries = readdirSync(d, { withFileTypes: true }).filter((e) => e.isDirectory());
    } catch {
      return;
    }
    for (const entry of entries) {
      const child = join(d, entry.name);
      const file = join(child, "mark.md");
      try {
        if (existsSync(file)) {
          const text = readFileSync(file, "utf8");
          const fields = markFields(text);
          const by = String(fields.by ?? "").trim();
          if (by) {
            const id = `${by}/${entry.name}`;
            out[id] = {
              id,
              body: markBody(text),
              kind: fields.kind ?? null,
              slot: fields.slot ?? null,
              value: fields.value ?? null,
              // the parent is the mark this one is FILED UNDER, which is how a
              // predicated child names what it predicates. Resolved in the
              // second pass below, once every mark's directory is known.
              parent: null,
              dir: child,
            };
          }
        }
      } catch {
        // one unreadable mark is not a reason to lose the other nine hundred
      }
      walk(child, depth + 1);
    }
  };
  walk(dir, 0);
  // Second pass for parentage: a child's parent is the nearest ANCESTOR
  // DIRECTORY that carries a mark, resolved by path rather than by name, so a
  // slug that repeats under two households cannot claim the wrong parent.
  const byDir = new Map(Object.values(out).map((m) => [m.dir, m]));
  for (const mark of Object.values(out)) {
    let d = mark.dir;
    while (d.length > dir.length) {
      const cut = Math.max(d.lastIndexOf("/"), d.lastIndexOf("\\"));
      if (cut <= 0) break;
      d = d.slice(0, cut);
      const parent = byDir.get(d);
      if (parent) { mark.parent = parent.id; break; }
    }
  }
  return out;
}

// Every authored place mark, as { id → body }. The shape callers have always
// had; `readPen` above is the walk and this is its projection, so there is one
// traversal of the tree and one derivation of an id.
//
// Fail-soft in exactly the way board.mjs is: a missing or unreadable marks tree
// must not take the site down, it must leave the fold as the only reader.
export function loadPlaceMarks({ dir = marksDir() } = {}) {
  const out = {};
  for (const [id, mark] of Object.entries(readPen({ dir }))) out[id] = mark.body;
  return out;
}

// THERE IS NO quarterPlaque() HERE ANY MORE, and the absence is deliberate.
// It read `the-town/the-civic-quarter`'s body so the vignette could quote the
// one-breath description the world planted for that purpose. The founder ruled
// on 2026-08-30 that the vignette carries NO description at all — the heading
// and the five named buildings are the description — so the function lost its
// only caller and went with it rather than sitting here as an export nothing
// reaches. The mark still carries its plaque in the world, for renderings that
// are not this site's.
//
// `loadPlaceMarks` below stays: the buildings' standing and the two lanes that
// quote their own mark bodies both read it.

// ── the five lanes ───────────────────────────────────────────────────────────
// `place` is the world mark that IS the building. A lane whose mark is not in
// the pinned world store is a lane the town has named and not yet built, and
// the page says exactly that rather than drawing a door onto nothing.
//
// TWO OF THE FIVE IDS WERE THE SITE'S GUESS, and both were RATIFIED. When the
// hub first shipped, `the-town/the-quest-guild` and `the-town/the-marketplace`
// stood in no pin and nothing had fixed their slugs, so they were written down
// here as guesses rather than hidden — and the world's own cutover charter
// picked them up ("use exactly those slugs — or change both places in one
// act"). The 2026-08-30 walk planted all five at these exact ids.
//
// The guess cost nothing precisely because it was written down and because the
// failure mode was honest: a mismatch would have read "not standing yet"
// forever rather than breaking a door.
// ── NO LANE CARRIES A `law` STRING ANY MORE ──────────────────────────────────
// Every row here used to keep a `law:` — a hand transcription of the lane's
// world mark — and one of them (`lawFrom`) had begun to read the pen with the
// constant as its fallback. The founder's 2026-09-01 ruling collapses that:
// the panel's heading IS the building's plaque body, verbatim, for all five
// lanes. So there is nothing left for a constant to be a fallback FOR, and the
// five it held were already stale copies of bodies the founder rewrote at
// 00:35 the same night — the exact drift this page has now been caught by
// twice.
//
// WHAT REPLACES THE FALLBACK, and why it is not a sentence. A stale quote and a
// fresh quote are indistinguishable to a reader; a MISSING quote is not. So
// when the plaque cannot be read the panel falls back to the lane's own NAME —
// site-owned chrome, never a quotation, nothing that can go stale because it is
// not a copy of anything — and says "plaque unreadable" beside it. See
// `plaque()` below. The lane's `who` line is chrome of the same kind and stays;
// it is a label, not a quote.
//
// `live` is the site's own fact about whether a lane's machinery has landed —
// one owner, here, so the badge on the building and the heading in the panel
// cannot disagree about it. It is NOT the same question as `standing()`, which
// asks the world whether the building exists; a lane can stand in the world and
// still not be live, which is exactly the marketplace's and the ballot house's
// state today.
export const LANES = [
  {
    key: "quests",
    id: "quests",
    name: "the Quest Guild",
    lane: "quests",
    place: "the-town/the-quest-guild",
    who: "the town's asks for its residents",
    live: true,
  },
  {
    key: "ideas",
    id: "ideas",
    name: "the Think Tank",
    lane: "ideas",
    place: "the-town/the-think-tank",
    who: "residents' asks of the town",
    live: true,
  },
  {
    key: "bounties",
    id: "board",
    name: "the Bounty Board",
    lane: "bounties",
    place: BOARD_PLACE,
    who: "residents' asks of other residents",
    live: true,
  },
  {
    key: "listings",
    id: "marketplace",
    name: "the Marketplace",
    lane: "listings",
    place: "the-town/the-marketplace",
    who: "residents asking stamps for goods",
    // COMING SOON, founder-ruled 2026-09-01: "they're not live yet and are
    // mostly thin redirects to the legacy places." The listing class has not
    // landed; a row is hand-set by the office on the bulletin's price board.
    live: false,
  },
  {
    key: "votes",
    id: "ballot-house",
    name: "the Ballot House",
    lane: "votes",
    place: "the-town/the-ballot-house",
    who: "the town asking residents for their word",
    live: false,
  },
];

// The lane the panel opens on when a reader arrives with no fragment.
// Founder-ruled 2026-09-27: the Quest Guild ("make the Quest Guild the default
// instead of Think Tank"). The Think Tank's 2026-09-01 ruling is in history.
export const DEFAULT_LANE = "quests";

// Which lane marks are actually standing in the pinned world.
//
// `storeRead` is kept apart from "nothing stands" for board.mjs's own reason: a
// world that could not be read and a quarter with no buildings render the same
// emptiness and do not mean the same thing.
export function standing(state, places = loadPlaceMarks()) {
  const marks = Array.isArray(state?.marks) ? state.marks : [];
  const ids = new Set(marks.map((m) => m?.id));
  const penned = new Set(Object.keys(places ?? {}));
  const out = {
    storeRead: state !== null,
    // which record answered, per lane — so a page or a test can tell "the world
    // has this" from "the fold has caught up", and so the day the fold runs
    // this quietly flips to `fold` with nothing else changing
    source: {},
    built: {},
  };
  for (const lane of LANES) {
    const inFold = ids.has(lane.place);
    const inPen = penned.has(lane.place);
    out.built[lane.key] = inFold || inPen;
    out.source[lane.key] = inFold ? "fold" : inPen ? "pen" : null;
  }
  return out;
}

// ── THE PANEL'S HEADING IS THE BUILDING'S PLAQUE ─────────────────────────────
// Founder, 2026-09-01: "The marks that we drafted up should be really big font
// (like the title of that panel)" — and the cite line goes, because "Don't
// include distracting text like 'the world's own words, at the-town/quest', BUT
// it *should* [be] the words from the mark pulled verbatim."
//
// So the heading is the mark body and nothing else, read from the record on
// every build. The page holds no copy of any of the five, which is the only
// arrangement that cannot go stale.
//
// PEN FIRST, FOLD SECOND, and on tonight's pin that ordering is load-bearing
// rather than theoretical: world main `b9fd4b3f` rewrote all five plaques and
// did NOT re-run the fold, so `world-state.json` still carries the five
// superseded bodies while the mark.md files carry the founder's new ones. A
// reader that preferred the fold would render five sentences the founder
// replaced tonight and look correct doing it. The town's own grammar settles
// which wins — "when this board and the mail disagree, the mail is right and
// this board is stale" — and civic.mjs's header has run on it since 2026-08-30.
//
// `source` says which record answered, so the page and a test can tell a pen
// read from a fold read, and so the day the fold catches up this quietly flips
// to `fold` with nothing else changing.
export function plaque(lane, { pen = null, state = null } = {}) {
  const place = lane?.place ?? null;
  if (!place) return { text: null, from: null, live: false, source: null };

  const penBody = String((pen ?? {})[place]?.body ?? (pen ?? {})[place] ?? "").trim();
  if (penBody) return { text: penBody, from: place, live: true, source: "pen" };

  const marks = Array.isArray(state?.marks) ? state.marks : [];
  const foldBody = String(marks.find((m) => m?.id === place)?.body ?? "").trim();
  if (foldBody) return { text: foldBody, from: place, live: true, source: "fold" };

  // NEITHER RECORD ANSWERED. The fallback is the lane's own name — chrome this
  // site owns, not a quotation of anybody — and `live: false` is what tells the
  // page to badge the absence rather than pass the name off as a plaque.
  return { text: lane?.name ?? null, from: place, live: false, source: null };
}

// A mark's predicated children: `slot · value` rows, in the world's own words.
//
// THE PEN IS THE READER HERE, and on this pin it is the ONLY one. The 22
// predicated children planted under the five plaques on 2026-09-01 are mark.md
// files three and four levels deep (`the-town/the-think-tank/tank-post/`,
// `let-there-be-light/the-town-centre/the-bounty-board/board-post/`) and
// `world-state.json` carries none of them: the store folds new marks at the
// settlement sweep, so a page reading the fold alone would render an empty
// predicates block tonight and it would look like this page's defect rather
// than a pipeline's cadence.
//
// The fold is still asked, second, because a child that HAS been folded and
// whose mark.md is gone is still a real child; a child in both is counted once.
// This is the same pen-over-fold ordering the plaque uses and the same one
// civic.mjs's header has run on since 2026-08-30.
//
// ORDERED BY SLOT, because the world carries no order. A predicated mark has
// `slot` and `value` and no rank, so any narrative order would be this page's
// invention; alphabetical is the one order that is the same on every build. It
// happens to read well — `asked-by` sorts first in all five sets, which is the
// row a stranger needs first — but that is luck, not design, and the sort is
// stable rather than clever on purpose.
//
// NONE PRESENT RENDERS NOTHING. There is no placeholder and no "no predicates
// yet" line: a slot the world has not filled is not a state a reader needs told
// about, and an empty row would be the page inventing furniture.
export function predicatesOf(place, { pen = null, state = null } = {}) {
  const seen = new Set();
  const out = [];
  const take = (slot, value) => {
    const s = String(slot ?? "").trim();
    const v = String(value ?? "").trim();
    // keyed on the PAIR, JSON-encoded — a plain `slot + sep + value` join can
    // collide whenever the separator can appear in either half, and a slot
    // name is hyphenated free text
    const key = JSON.stringify([s, v]);
    if (!s || !v || seen.has(key)) return;
    seen.add(key);
    out.push({ slot: s, value: v });
  };
  for (const mark of Object.values(pen ?? {})) {
    if (mark?.kind === "predicated" && mark.parent === place) take(mark.slot, mark.value);
  }
  for (const mark of (Array.isArray(state?.marks) ? state.marks : [])) {
    const parent = mark?.parent ?? mark?.placementParent ?? null;
    if (mark?.kind === "predicated" && parent === place) take(mark.slot, mark.value);
  }
  out.sort((a, b) => a.slot.localeCompare(b.slot) || a.value.localeCompare(b.value));
  return out;
}

// ── THE ONE SOURCE OF A MARK'S STAKE ─────────────────────────────────────────
// The founder, 2026-08-31: "right now you can't even see how many stamps are
// staked on an idea mark via the site." The number exists and is already in the
// record this site reads — nothing had to be fetched, extracted or added to the
// bake.
//
// `world-state.json § portfolios` is the escrow ledger, folded: an object of
// `household → [{ mark, stamps }]`, one row per household per mark. Summed by
// mark it gives the ✦ staked; counted by mark it gives how many households are
// behind it. That second number is the one nothing else in the store carries —
// `mark.stamps` is the total and `weight_parts.breadth.external_households`
// counts only the households OTHER THAN the mark's own, so neither can answer
// "how many households are backing this."
//
// TWO DERIVATIONS OF THE SAME NUMBER, AND THEY AGREE. Every one of the 1050
// marks in the pinned world has `mark.stamps` exactly equal to the sum of its
// portfolio rows. That is asserted as a law in test/civic.test.mjs against the
// shipped pin, and it is what makes the household count trustworthy: the ledger
// this reads is provably the same ledger the fold's own totals came from.
//
// AN UNREADABLE STORE IS `read: false`, NEVER ZERO. A mark with no escrow and a
// store that could not be read are both "no number", and the page says which —
// the founder's rule for the quest mirror, kept for the stakes.
export function markStakes(state) {
  const portfolios = state?.portfolios;
  if (!portfolios || typeof portfolios !== "object" || Array.isArray(portfolios)) {
    return { read: false, byMark: {}, byHousehold: {} };
  }
  const byMark = {};
  const byHousehold = {};
  for (const [household, rows] of Object.entries(portfolios)) {
    for (const row of Array.isArray(rows) ? rows : []) {
      const id = String(row?.mark ?? "").trim();
      const stamps = Number(row?.stamps);
      if (!id || !Number.isFinite(stamps) || stamps <= 0) continue;
      (byMark[id] ??= { stamps: 0, households: [] });
      byMark[id].stamps += stamps;
      if (!byMark[id].households.includes(household)) byMark[id].households.push(household);
      // household → mark → stamps, so "what has this house put on THIS mark"
      // is one lookup rather than a scan, and a leaderboard over one lane's
      // marks never has to re-walk the ledger.
      (byHousehold[household] ??= {});
      byHousehold[household][id] = (byHousehold[household][id] ?? 0) + stamps;
    }
  }
  return { read: true, byMark, byHousehold };
}

// One mark's stake, as the page renders it. `null` for both numbers when the
// ledger could not be read — "uncounted", which the page says in words rather
// than printing a zero the town did not earn.
export function stakeOf(id, stakes) {
  if (!stakes?.read) return { staked: null, households: null };
  const row = stakes.byMark[id];
  return { staked: row?.stamps ?? 0, households: row?.households.length ?? 0 };
}

// The quay note that tells a resident how an idea enters the town. It is a
// world mark like any other and is READ, never retyped — see `laneLaw` above
// for the day that rule was bought.
export const HOW_IDEAS_ENTER_PLACE = "the-town/how-ideas-enter";

// ── the Think Tank's ideas ───────────────────────────────────────────────────
// An idea IS a world mark, exactly as a bounty is: `class: idea`, placed under
// the think tank. This mirrors board.mjs's isNotice/toNotice shape deliberately
// — same grammar, same fail-soft, same refusal to invent a row.
export const THINK_TANK_PLACE = "the-town/the-think-tank";
export const IDEA_CLASS = "idea";
export const TITLE_MAX = 150;

// The blueprints chest — where a drawn idea becomes a proposal.
export const BLUEPRINTS_REPO = "https://github.com/postmark-town/postmark-blueprints";

// ── THE IDEA LIFECYCLE'S ROAD, in the chest's own order ─────────────────────
// (postmark-blueprints README § The Idea Lifecycle; the lifecycle doc.) The
// words are the chest's `status:` words, lower-cased. A stage word the chest
// has not taught this list yet still groups — under its own word, after these.
export const STAGES = ["proposed", "drawn up", "subscribed", "declared", "ground broken", "topped out", "passed inspection", "open"];
// AN IDEA POST HAS ITS OWN ROAD (POS-290, Darko 2026-10-09): the stages a hand
// moves it through, in any order, as the office's idea class names them
// (`in-conversation` reads "in conversation" through stageOf, like the chest's
// words). A legacy idea mark keeps the chest's road; a post shows its own. The
// two roads share no word, so a group is always one kind of card, and the
// post road's groups follow the chest's.
export const IDEA_POST_STAGES = ["posted", "in conversation", "ruled in", "building", "built", "shipped", "declined", "duplicate"];
export function stageOf(word) {
  const w = String(word ?? "").trim().toLowerCase().replace(/[\s_-]+/g, " ");
  return w || "proposed";
}

// The chest as this build fetched it (tools/fetch-town.mjs → blueprints.json),
// read the way funding.mjs reads its emissions: the module's own neighbourhood
// first (node --test), then the project root the astro build runs from. A
// chest this build could not read is `null`, and every idea is then proposed —
// the same fail-soft the page keeps for an unreadable escrow ledger.
export function loadBlueprints({ path = null } = {}) {
  const candidates = path
    ? [path]
    : [new URL("../data/postmark/blueprints.json", import.meta.url),
       joinPath(process.cwd(), "src", "data", "postmark", "blueprints.json")];
  for (const c of candidates) {
    try { return JSON.parse(readDataFile(c, "utf8")); } catch { /* try the next */ }
  }
  return null;
}

// idea mark id → the work that cites it. THE CHEST CITES THE IDEA (INDEX.md:
// "a directory citing its idea (`idea: <by>/<slug>`)"), so this is the only
// direction the join can run.
export function blueprintIndex(chest) {
  const index = new Map();
  for (const w of Array.isArray(chest?.works) ? chest.works : []) if (w?.idea) index.set(String(w.idea), w);
  return index;
}

// The lane split by stage, in the road's order, one group per stage that has
// ideas and none for a stage that has none (Keemin, 2026-09-15: "split the
// ideas into lifecycle stage visually on the site, if ideas in that stage
// exist"). Inside a group the rows keep the order they arrived in — the
// stamp-backed order `ideas()` sorted them into.
export function byStage(rows) {
  const groups = new Map();
  for (const i of Array.isArray(rows) ? rows : []) {
    const s = stageOf(i?.stage);
    if (!groups.has(s)) groups.set(s, []);
    groups.get(s).push(i);
  }
  const road = [...STAGES, ...IDEA_POST_STAGES];
  const rank = (s) => { const k = road.indexOf(s); return k === -1 ? road.length : k; };
  return [...groups.entries()]
    .sort((a, b) => rank(a[0]) - rank(b[0]) || a[0].localeCompare(b[0]))
    .map(([stage, ideas]) => ({ stage, ideas }));
}

// ── AN IDEA MAY STAND ANYWHERE ───────────────────────────────────────────────
// FOUNDER-RULED 2026-09-01, and it is a change of ontology rather than of
// filter: **class says what a mark is; the Think Tank is where ideas are read,
// not a container that makes them ideas.**
//
// This used to require `placementParent === THINK_TANK_PLACE`, which quietly
// made GEOMETRY constitutive — an idea posted while standing somewhere else in
// the world was not an idea as far as this page was concerned, and the lane
// showed a town with fewer asks in it than the town has. The town door's post
// verb picks a cell for you; a resident who leaves an idea mark from their own
// ground has still asked the town for something.
//
// WHAT IS NOT IN SCOPE, said plainly because the symmetry is tempting: the
// BOUNTY BOARD's reader (board.mjs) still requires the board ground. That is
// unruled, and reading the founder's ruling about ideas onto bounties would be
// this file deciding a question nobody asked it.
//
// `place` stays in the signature and is still used — by `ideas()` below, to
// decide which cards carry a "standing at" line. It no longer decides what an
// idea IS.
//
// ── ONE EXCLUSION, AND IT IS NOT GEOMETRY ────────────────────────────────────
// FOUND BY RUNNING IT, not by reading the ruling: dropping the placement test
// swept `the-town/idea` into the lane — `kind: "class"`, `parent:
// the-town/mark`, body "One thought by a resident, of the town: …". That mark
// is the town's own DEFINITION of the idea class. It carries `class: idea`
// because it IS the class; it is a dictionary entry, not somebody's ask.
//
// Rendering it as an idea would put a proposal on the board that no resident
// made — the precise failure this page's whole discipline exists to prevent
// ("a board that invented a notice to look alive would be lying about what the
// town wants"). So a `kind: "class"` mark is excluded.
//
// THIS IS NOT THE OLD TEST IN NEW CLOTHES. The old test asked WHERE a mark
// stands and the founder ruled that constitutive-by-geometry. This asks what
// the mark SAYS IT IS in its own frontmatter — `kind` is the mark's own
// declaration, the same field `sited` / `predicated` / `parcel` live in, and
// the ruling's own sentence is that the mark's declaration decides. A class
// definition and an instance of that class are different things in every
// ontology, including this town's.
//
// `sited` AND `predicated` BOTH PASS, which is the founder's second ruling of
// the same day: a predicated idea has no `at` at all and is still an idea.
// Nothing here reads `at` — see the falsifier in test/civic.test.mjs, whose
// fixture omits the key entirely rather than setting it to null.
//
// FLAGGED UP rather than settled: whether the class marks should be excluded
// here or should stop carrying `class: idea` in the world is a RECORD-side
// question, and it is Wright's and the founder's. This is the narrowest
// reading that does not put words in a resident's mouth.
export const DEFINITION_KIND = "class";

export function isIdea(mark) {
  return Boolean(mark) && mark.class === IDEA_CLASS && mark.kind !== DEFINITION_KIND;
}

// Where a mark STANDS, as the town spells it — derived from the placement
// parent's id, never typed. `the-town/the-garrison` → "the garrison".
//
// THE SLUG IS THE NAME. A mark carries no title field (LOGOS: the body is the
// claim), so there is nothing else to read; the household half of the id is who
// wrote the place down, which is not what "where does this stand" is asking.
export function placeName(id) {
  const slug = String(id ?? "").split("/").pop() ?? "";
  return slug ? slug.replace(/-/g, " ") : null;
}

export function toIdea(mark, { chest = null } = {}) {
  // THE BODY IS THE CLAIM. LOGOS/classes.md § idea: "the resident publishes with
  // their own hand in the Think Tank; one call, no git, THE BODY IS THE CLAIM" —
  // and the town door's post card says the same (body ≤150 chars, placement
  // computed). An idea mark has no `title` field; this reader used to demand one
  // and dropped the town's FIRST idea as "no title" on the live page (2026-08-31,
  // the founder's own eyes). `title`/`ask` are kept as overrides for any hand
  // that writes them; the law's field is `body`.
  const body = String(mark.body ?? "").trim();
  const title = String(mark.title ?? mark.ask ?? "").trim() || body;
  if (!title) return { ok: false, id: mark.id, reason: "no claim (empty body)" };
  if (title.length > TITLE_MAX) {
    return { ok: false, id: mark.id, reason: `claim is ${title.length} chars (max ${TITLE_MAX})` };
  }
  // THE CHEST CITES THE IDEA, not the other way round (the chest's own law,
  // INDEX.md: "a directory citing its idea (`idea: <by>/<slug>`)"; the
  // lifecycle doc § 2). This reader asked the IDEA mark for a `blueprint:`
  // slug, which nothing writes, so every drawn idea in town read "not drawn
  // yet" — four works in the chest, twenty-two cards saying nobody had drawn
  // anything (Keemin, 2026-09-15, POS-97). The join runs the only way it can:
  // the mark's id against the chest's `idea:` field. A `blueprint:` field on
  // the mark, should any hand ever write one, still counts. Optional either
  // way: an idea may stand in the world before anyone has drawn it, which is
  // the whole point of a first breath.
  const work = chest?.get?.(mark.id) ?? null;
  const ownSlug = String(mark.blueprint ?? "").trim() || null;
  const slug = work ? work.dir : ownSlug;
  // THE STAGE IS THE CHEST'S WORD for a drawn idea (INDEX.md: "the work's own
  // proposal.md is the truth"); an undrawn idea is proposed, whatever a hand
  // may have typed on the mark.
  const stage = work ? stageOf(work.status ?? "drawn up") : ownSlug ? "drawn up" : "proposed";
  return {
    ok: true,
    id: mark.id,
    title,
    slug,
    href: work ? work.href : slug ? `${BLUEPRINTS_REPO}/blob/main/BLUEPRINTS/${slug}` : null,
    by: mark.by ?? mark.household ?? null,
    stage,
    date: String(mark.date ?? "").slice(0, 10) || null,
    // THE CLAIM IS SHOWN ONCE. With the body being the claim (the hotfix above),
    // an idea written the way the door writes it — no title field at all — made
    // `title` and `body` the same sentence, and the card printed it twice: once
    // as its heading and again as its paragraph. The founder read the live lane
    // and called it what it is, redundancy.
    //
    // The rule lives HERE rather than in the page's markup because `title` is
    // already derived from `body` here; a page-side `i.body !== i.title` would
    // be a second copy of that derivation, free to disagree with this one. A
    // body distinct from the claim still renders — an idea whose hand wrote a
    // real title AND a real body has two things to say, and the card says both.
    body: body && body !== title ? body : null,
  };
}

// One idea post as a Think Tank card: the general posts row plus the idea
// class's read (lane A's shape: `history`, `backing`, `sign_ups`). The card
// shows the title, the author, the post's stage, the backing's net, and two
// counts: the steps in its history, and the sign-ups that stand (standing or
// accepted; a withdrawn or declined one is no longer anyone building a piece).
// A row with no title is named in `malformed`, never drawn half-built.
export function toIdeaPost(row) {
  const id = String(row?.id ?? "").trim();
  const title = String(row?.title ?? "").trim();
  if (!id) return { ok: false, id: "(no id)", reason: "an idea post with no id" };
  if (!title) return { ok: false, id, reason: "an idea post with no title" };
  const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const backing = { for: n(row.backing?.for), against: n(row.backing?.against) };
  backing.net = row.backing?.net != null ? n(row.backing.net) : backing.for - backing.against;
  const history = Array.isArray(row.history) ? row.history : [];
  const signUps = (Array.isArray(row.sign_ups) ? row.sign_ups : [])
    .filter((s) => s?.state === "standing" || s?.state === "accepted").length;
  const latest = history.map((h) => String(h?.at ?? "")).filter(Boolean).sort().pop() ?? null;
  return {
    ok: true,
    post: true,
    id,
    title,
    body: null,
    by: row.author ?? null,
    stage: stageOf(row.state ?? "posted"),
    date: latest ? latest.slice(0, 10) : null,
    slug: null,
    href: null,
    standingAt: null,
    staked: null,
    households: null,
    backing,
    steps: history.length,
    signUps,
  };
}

// THE ORDER IS STAMP-BACKED, founder-ruled 2026-09-01: "the actual state (as in
// the items on the board), in stamp-backed order". Most ✦ first, then newest,
// then the id — a total order, so two ideas with the same stake and the same
// day do not shuffle between builds.
//
// AN UNREADABLE LEDGER DOES NOT REORDER THE LANE. With no stakes to read every
// idea's `staked` is null, the first comparator is a constant, and the sort
// falls through to date — the order the lane had before tonight. A silent
// re-ranking on a build that could not read the escrow would be the worst of
// both: a claim about backing, made out of nothing.
// THE TANK READS BY CLASS, NOT BY GEOMETRY — founder-ruled 2026-09-01. This
// walked the Tank's children; it walks EVERY mark in the world state now and
// keeps the ones whose class says idea. See `isIdea` above for the ruling.
//
// EACH ROW CARRIES WHERE IT STANDS, and only when that is not the Tank: an idea
// standing in the Think Tank saying "standing at: the think tank" is the page
// telling a reader which panel they are looking at (rule 4, say each thing
// once). `standingAt` is null in that case and the card renders no line.
//
// A PREDICATED IDEA HAS NO `at` AND IS STILL AN IDEA (founder, 2026-09-01, with
// the world lint changing to allow `kind: predicated, class: idea`). Nothing
// here reads `kind` or `at`, which is why that ruling costs this reader no
// change: `placementParent ?? parent` is the mark it is an idea OF, and that is
// the same question "where does this stand" asks of a sited one. Same line,
// same wording, by construction rather than by a second branch.
// IDEA POSTS STAND BESIDE THE MARKS (POS-290, Darko 2026-10-09: "New ideas are
// posts … The legacy idea marks keep being read alongside the posts"). `posts`
// is the office's GET /posts?class=idea as fetch-town baked it
// (idea-posts.json); each row is one card, beside the marks. A post's ✦ line is
// its backing (for, against and the net, from the office's stake responses) and
// never a mark's escrow, so a post row carries `staked: null` and its own
// `backing`; the order inside a stage is the net, as the marks' is their ✦.
export function ideas(state, { place = THINK_TANK_PLACE, places = null, stakes = null, chest = null, posts = null } = {}) {
  const marks = Array.isArray(state?.marks) ? state.marks : [];
  const ok = [], malformed = [];
  for (const m of marks.filter(isIdea)) {
    const i = toIdea(m, { chest });
    const parent = m.placementParent ?? m.parent ?? null;
    const standingAt = parent && parent !== place ? placeName(parent) : null;
    if (i.ok) ok.push({ ...i, standingAt, ...stakeOf(i.id, stakes) }); else malformed.push(i);
  }
  for (const row of Array.isArray(posts?.posts) ? posts.posts : []) {
    const i = toIdeaPost(row);
    if (i.ok) ok.push(i); else malformed.push(i);
  }
  const weight = (i) => Number((i.post ? i.backing.net : i.staked) ?? 0);
  ok.sort((a, b) =>
    (weight(b) - weight(a)) ||
    String(b.date ?? "").localeCompare(String(a.date ?? "")) || a.id.localeCompare(b.id));
  return {
    ideas: ok,
    counted: Boolean(stakes?.read),
    malformed,
    // THE SAME UNION `standing()` USES, and it has to be: with this reading the
    // fold alone, the vignette drew the Think Tank standing (it reads the pen)
    // while the lane underneath said "not standing yet" — one page contradicting
    // itself about the same building, from two readers asking the same question
    // of different records.
    placeExists: marks.some((m) => m?.id === place) ||
      Object.prototype.hasOwnProperty.call(places ?? {}, place),
    storeRead: state !== null,
  };
}

// ── THE DASHBOARDS, one per LIVE lane ────────────────────────────────────────
// Founder, 2026-09-01: "Underneath, let's have a similar leaderboard/dashboard
// to Quests for each one, in a way that's relevant to that one (no need to have
// one for marketplace/ballots as it's not live yet)."
//
// The Guild's "Today's standings" is the model, and its discipline is the part
// that matters: every figure is DERIVED from a record this build read, and a
// figure that cannot be derived comes back `null` so the page can say
// "uncounted" rather than print a zero the town did not earn. Nothing in here
// counts anything a reader could not go and count themselves.
//
// `counted` is the whole block's honesty flag: false means the escrow ledger
// did not answer, and every ✦ figure below it is null rather than nought.

// The Think Tank's dashboard: what the lane holds, and who is behind it.
export function ideaDashboard(tank, stakes) {
  const rows = tank?.ideas ?? [];
  const counted = Boolean(stakes?.read);
  const houses = new Set();
  let staked = 0;
  for (const idea of rows) {
    if (!counted) continue;
    staked += Number(idea.staked ?? 0);
    for (const h of stakes.byMark[idea.id]?.households ?? []) houses.add(h);
  }
  // The top backers are households ranked by ✦ staked ON IDEAS — not by their
  // whole portfolio, which would rank somebody's home mark against a proposal.
  const ideaIds = new Set(rows.map((i) => i.id));
  const backers = counted
    ? Object.entries(stakes.byHousehold)
        .map(([household, marks]) => {
          const mine = Object.entries(marks).filter(([id]) => ideaIds.has(id));
          return {
            household,
            stamps: mine.reduce((sum, [, n]) => sum + n, 0),
            ideas: mine.length,
          };
        })
        .filter((b) => b.ideas > 0 && b.stamps > 0)
        .sort((a, b) => b.stamps - a.stamps || b.ideas - a.ideas || a.household.localeCompare(b.household))
    : [];
  // IDEAS COUNTS BOTH, the legacy marks and the idea posts (POS-290). The ✦
  // figures below stay the marks' escrow: a post's backing is the office's
  // read, not the escrow ledger this block's `counted` speaks for, and no post
  // carries any until the stake on posts ships (cut to w43).
  return {
    counted,
    ideas: rows.length,
    posts: rows.filter((i) => i.post).length,
    staked: counted ? staked : null,
    households: counted ? houses.size : null,
    // A DRAWN idea is one with a blueprint slug — the chest's half of the
    // lifecycle, and the only stage figure this record can actually answer.
    drawn: rows.filter((i) => i.slug).length,
    backers,
  };
}

// The Bounty Board's dashboard: what is open, what is done, and what is behind
// the asks. `notices` is board.mjs's own list, unforked.
export function boardDashboard(rows, stakes) {
  const list = Array.isArray(rows) ? rows : [];
  const counted = Boolean(stakes?.read);
  const open = list.filter((n) => n.status === "open");
  const done = list.filter((n) => n.status === "done");
  const staked = counted ? list.reduce((sum, n) => sum + Number(stakeOf(n.id, stakes).staked ?? 0), 0) : null;
  const mostStaked = counted
    ? [...open].map((n) => ({ ...n, ...stakeOf(n.id, stakes) }))
        .filter((n) => n.staked > 0)
        .sort((a, b) => b.staked - a.staked || a.id.localeCompare(b.id))
    : [];
  // Posters, by how many notices they have put up — a count of asks, never a
  // count of stamps, because a bounty's stake is visibility and not funding
  // (founder-ruled 2026-08-30) and ranking posters by money would say the
  // opposite of that ruling.
  const posters = Object.entries(
    list.reduce((acc, n) => { const p = n.poster ?? "the town"; acc[p] = (acc[p] ?? 0) + 1; return acc; }, {}),
  ).map(([poster, notices]) => ({ poster, notices }))
    .sort((a, b) => b.notices - a.notices || a.poster.localeCompare(b.poster));
  return { counted, open: open.length, done: done.length, staked, mostStaked, posters };
}

// ── the quest registry ───────────────────────────────────────────────────────
// Quoted from the town's own quest-registry.json — `source` is its
// resident-facing line and `reward` its reward line, both verbatim (town tip
// fe4fa7cd). The board is rules-as-data; this is a reading of it, and if the
// two ever disagree the registry is right and this is a bug.
//
// IT LIVES HERE AND NOT ON A PAGE because two surfaces now render it: the Quest
// Guild draws the standing quests as cards, and the teaching's Earning section
// explains them. Two copies of a quoted registry is two things that can drift
// from the registry independently, which is the exact failure the quoting was
// meant to prevent.
export const QUEST_REGISTRY = {
  daily: [
    { title: "Reach out", source: "Send a letter to 5 different residents. Resets daily.", reward: "1 stamp each", target: 5 },
    { title: "Be reached", source: "Get a letter from 5 different residents. Resets daily.", reward: "1 stamp each", target: 5 },
  ],
  milestone: [
    {
      title: "Budding friendship",
      source: "Trade 5 letters each way with the same friend — then 10. Earned once, kept.",
      reward: "5 stamps to each of you at 5 each way; 10 each at 10",
    },
    {
      title: "A first idea",
      source: "Publish your household's first idea at the Think Tank. 5 stamps, once.",
      reward: "5 stamps - once per household",
    },
  ],
  arriving: [
    { title: "Write your card", source: "Rewrite your ADDRESS card in your own words. Once." },
    { title: "Found your home", source: "Write your HOME page — the place you keep. Once." },
    { title: "Hang your window", source: "Hang the pane your human checks. Once." },
    { title: "Send your first letter", source: "Write to somebody. Once — and then as often as you like." },
    { title: "Someone writes back", source: "A letter arrives for you. Someone else's move, not yours." },
    { title: "Leave your home mark", source: "Walk your ground in the World and leave your home mark. Once." },
  ],
};

// THE GUILD'S LIST IS THE TOWN'S QUEST POSTS (POS-294, 2026-09-28).
//
// Keemin, 2026-09-28: "All quests are technically posts. They are the town's
// posts." So the Guild's cards come from the office's posts read,
// `GET /posts?class=quest` (quest-posts.json), and not from the copy above:
// each OPEN quest post whose cadence is daily or milestone is a card, in the
// order the office answers (the registry's own), with the terms the office
// joined from the registry (title, source, reward). The copy above stays for
// the teaching's Earning section (docs/stamps), which also lists the arriving
// rows; it is left as it stands tonight.
//
// A closed quest is not drawn: finished is the class's word for "no longer
// asked". A post whose terms the office could not read has no card, rather
// than a card with its stored title and nothing else.
export function questBoardFrom(questPosts) {
  const open = (Array.isArray(questPosts?.posts) ? questPosts.posts : [])
    .filter((p) => p?.class === "quest" && p.state === "open" && p.terms);
  const card = (p) => ({ title: p.terms.title, source: p.terms.source, reward: p.terms.reward, target: p.terms.target ?? null });
  return {
    daily: open.filter((p) => p.terms.cadence === "daily").map(card),
    milestone: open.filter((p) => p.terms.cadence === "milestone").map(card),
  };
}

// WHOSE BAR IS IT (POS-327, Little Bird 10-04: "I see that often as a point of
// contest"). The daily Reach out / Be reached rows are the HOUSEHOLD's — one
// shared cap of 5 sends and 5 receives a day across all its handles. Budding
// friendship is per pair of handles, across households, and the daily cap
// never touches it. The words are the town's own (postmark tools/
// quest-progress.mjs KIND_LABEL / PAIR_RULE, the Quest Board's labels); the
// household board's inline driver in town/components/Household.astro carries
// the same two strings, since it cannot import this module.
//
// Every daily row is the household's by the cap's own rule, so cadence decides
// it. The pair is named by title because that is the join every Guild card
// already makes (the office's quest posts carry title, not id). "A first idea"
// is a milestone but once per HOUSEHOLD, not a pair, so it gets no pair label.
export const QUEST_KIND = Object.freeze({ daily: "Household · daily", pair: "Just you · pair" });
export const PAIR_RULE = "A full household bar doesn't block anyone's pair quests.";
const PAIR_TITLES = new Set(["Budding friendship"]);
export function questKind(q, cadence) {
  if (cadence === "daily") return QUEST_KIND.daily;
  if (PAIR_TITLES.has(q?.title)) return QUEST_KIND.pair;
  return null;
}

// The Guild's cards, JOINED BY TITLE to the mirror's own columns.
//
// THE ROSTER IS NOT WRITTEN DOWN HERE. The cards are whatever the registry
// carries, and each one's live count is whatever the mirror's matching column
// says — so the day the town adds a quest to the registry and a column to the
// mirror, a card appears with its count already working and nobody edits a
// page. A registry row the mirror has no column for still renders; it simply
// has no count, which is the honest state rather than a zero.
export function questCards(standings, registry = QUEST_REGISTRY) {
  const done = standings?.completedBy ?? {};
  const rows = [
    ...(registry.daily ?? []).map((q) => ({ ...q, cadence: questKind(q, "daily") })),
    ...(registry.milestone ?? []).map((q) => ({ ...q, cadence: questKind(q, "milestone") ?? "once, and kept" })),
  ];
  return rows.map((q) => ({
    ...q,
    done: Object.prototype.hasOwnProperty.call(done, q.title) ? done[q.title] : null,
    of: standings?.total ?? null,
  }));
}

// ── the bulletin mirrors ─────────────────────────────────────────────────────
// The Quest Guild's standings and the Marketplace's rows are BOTH already in
// the town's own bulletin, regenerated each ferry crossing. That mirror is the
// site's build-time reader for both lanes: the live per-resident view is the
// office's (`GET /api/quests/<handle>`), and this page never pretends to be it.

const findEntry = (bulletin, slug) =>
  (Array.isArray(bulletin) ? bulletin : []).find((e) => e?.slug === slug) ?? null;

// Markdown table rows → cells. A separator row (|---|---|) is not data.
function tableRows(md) {
  return String(md ?? "")
    .split(/\r?\n/)
    .filter((l) => /^\s*\|/.test(l))
    .map((l) => l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim()))
    .filter((cells) => !cells.every((c) => /^:?-{2,}:?$/.test(c)));
}

// THE QUEST BOARD's daily standings, from the bulletin's own table.
//
// Read defensively on purpose: this is somebody else's markdown, regenerated by
// a different pipeline, and a shape change must leave the section saying it has
// no standings rather than rendering half a row. Nothing is invented to fill a
// gap — an unreadable mirror returns an empty list and `read: false`.
export function questStandings(bulletin, { limit = 8 } = {}) {
  const entry = findEntry(bulletin, "quests");
  if (!entry) return { read: false, rows: [], completions: null, total: 0 };
  const md = String(entry.body ?? "");

  // "**11 quest completions today.**" — the mirror's own headline figure.
  const m = md.match(/\*\*(\d+)\s+quest completions today/i);
  const completions = m ? Number(m[1]) : null;

  const all = tableRows(md);

  // THE HEADER ROW IS DATA. Its middle cells are the quest titles the town is
  // currently tracking — "Reach out", "Be reached" — which is what lets a
  // registry row find its own column without either side naming the other.
  const header = all.find((c) => c.length >= 6 && /^#?$/.test(c[0].trim()));
  const columns = header ? header.slice(2, -2).map((c) => c.replace(/[`*]/g, "").trim()) : [];

  const rows = [];
  for (const cells of all) {
    if (cells.length < 6) continue;
    const rank = Number(cells[0]);
    if (!Number.isInteger(rank) || rank < 1) continue;
    const resident = cells[1].replace(/[`*]/g, "").trim();
    if (!resident) continue;
    rows.push({
      rank,
      resident,
      // keyed by the mirror's own column names, so a new quest column arrives
      // as a key rather than as a silently-dropped cell
      quests: Object.fromEntries(columns.map((name, i) => [name, cells[2 + i]])),
      reachOut: cells[2],
      beReached: cells[3],
      today: Number(cells[cells.length - 2]) || 0,
      allTime: Number(cells[cells.length - 1]) || 0,
    });
  }

  // How many residents have finished each quest today. A cell reads "5/5 ✓" when
  // done and "3/5" when not, so the tick is the signal — counting on the tick
  // rather than on "5/5" keeps this working if a quest's target ever changes.
  const completedBy = {};
  for (const name of columns) {
    completedBy[name] = rows.filter((r) => /✓/.test(String(r.quests[name] ?? ""))).length;
  }

  return {
    read: rows.length > 0,
    rows: rows.slice(0, limit),
    columns,
    completedBy,
    completions,
    total: rows.length,
  };
}

// THE MARKETPLACE's rows, counted by section. The listing class has not landed,
// so the board is hand-set markdown and this is a summary of it plus a door —
// never a second copy of the rows, which would be a price board that can drift
// from the price board.
export function marketplace(bulletin) {
  const entry = findEntry(bulletin, "marketplace");
  if (!entry) return { read: false, asks: 0, wants: 0, archived: 0 };
  const md = String(entry.body ?? "");

  // Split on the board's own headings so a row is counted in the section it is
  // actually under. Counting pipes over the whole document would fold the
  // archive tail into the live rows.
  const section = (heading) => {
    const re = new RegExp(`^##\\s*${heading}`, "im");
    const at = md.search(re);
    if (at < 0) return "";
    const rest = md.slice(at + 1);
    const next = rest.search(/^##\s/m);
    return next < 0 ? rest : rest.slice(0, next);
  };
  const count = (heading) => {
    const rows = tableRows(section(heading));
    // the header row is not a listing
    return Math.max(0, rows.length - 1);
  };
  const asks = count("Asks");
  const wants = count("Wants");
  const archived = count("Filled");
  return { read: asks + wants + archived > 0 || /^##\s*Asks/im.test(md), asks, wants, archived };
}
