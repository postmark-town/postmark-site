// world-lenses.mjs — the readings the /ops/graph/ lenses paint with.
//
// Every function here takes the office's `GET /world/graph` node data and
// returns a reading of it. Nothing fetches, nothing draws, nothing caches: the
// page owns the canvas and the office owns the world, and what lives here is
// only the arithmetic between them — which is the part worth testing without a
// browser.
//
// PORTED, NOT INVENTED. These are the graph-views hub's own derivations
// (jetto/graph-views, tools/graph-views.mjs; its tip is pinned durably at world
// wright/hub-pin @ 013c0c7e), carried over when the founder ruled that the hub's
// CONTENT pours into this page and its six-tab chrome retires. The hub computed
// them in Node against a world clone on disk; here they run in the browser
// against the payload, which is the whole difference the ruling asked for — the
// hub's numbers were a snapshot of whatever clone the operator had, and these
// are a reading of the store the office is serving right now.
//
// V2 (2026-08-13 cutover). The V1 tier-gap reading is GONE from this file, not
// disabled: the founder ordered the gap FIXED world-side rather than watched, so
// a viewer for it would be a window onto a thing that no longer happens. What
// replaces it is the rest of the hub's V2 material — the law's own measures, the
// class registry's reach, the per-node serialization verdict, and the named
// boundary of what this window can honestly count at all.
//
// THE ONE THING THAT MADE THE PORT POSSIBLE. The hub could re-read every
// mark.md through the world's own parser, so it could ask "what did the AUTHOR
// write". The payload could not be asked that at all: `loadMarks` defaults
// `tier` to "market" and synthesizes half the identity, so by the time a record
// reaches a reader "the author wrote market" and "the loader supplied it" are
// the same string. The office now ships the author's own key list on each mark
// node (`keys`), which is what these readings stand on — and every one of them
// degrades to a stated "the office has not sent this yet" rather than a wrong
// number when it is absent.
//
// NO NUMBER FROM ANY PARTICULAR DAY IS WRITTEN DOWN HERE. Every count is
// computed from the payload in hand. The world is mid-cutover and the whole
// point of these readings is to watch figures move; a literal baked in as a
// comparison would be a claim about a store nobody is looking at.

import { isClassNode, isPredicate, recordKind } from "./mark-class.mjs"; // S1: a mark's class from either form

// ═══════════════════════════════════════════════════════════════════════════
// THE SERIALIZATION MAP — the machine-readable form of the trichotomy that
// LOGOS/lifetimes.md § the node holds as prose.
//
// PORTED from tools/graph-views.mjs (world repo, commit 013c0c7e on
// wright/hub-pin; the jetto/graph-views branch it was written on is gone), where
// it landed as a tracked artifact under founder ruling 2026-08-12, and RE-HOMED
// HERE on 2026-08-13 when the tier-gap viewer retired: WRITE-REGISTRY.md row
// "the serialization mapping (field → predicate star)" names this lens as the
// map's live home, so this copy is the table and the world file its history.
// Changed here since: `cites:` names LOGOS/lifetimes.md (the doc's rename), and
// the `property` scope was added 2026-10-17 for LOGOS v2 part 2 (W1), whose
// class-side properties are `kind: property` nodes.
//
// IT IS A TABLE, NOT A READING, which is why it may live in the site's tree at
// all: this page bakes no world data, and a founder-authored table of what a
// field MEANS is not world data. The counts against it are computed live from
// the payload every time the page opens.
//
// It is a WAY STATION. The destination is `payload schemas on class-nodes`
// (LOGOS/classes.md names payload schema as a class param), at which point this
// literal is deleted and the map is read from the graph like everything else.
//
// Read it per class: for each node class, what its frontmatter keys serialize.
//   identity   — an identity atom (lifetimes.md: "identity is two atoms, a slug and
//                a class"); the slug is the directory name, so on disk identity
//                is one key.
//   relational — NOT a property. Each entry names THE EDGE IT SERIALIZES, as
//                `[edge-type, what the edge relates]` (lifetimes.md: "`by:` is the
//                create-edge, not a field").
//   derived    — belongs NOWHERE (the-north-star.md § the placement discipline).
//                A key here on disk is TRUE RESIDUE: the map deliberately maps
//                it to nothing, which is a violation, not a gap in this table.
//   log        — belongs to the citing action's record, not to the node.
//   property   — a genuine authored property, given as `[predicate-slot, gloss]`.
//
// `*` applies to every class; a class block adds to it. A key on disk that this
// table does not place is MAPPING DEBT — rendered loudly as this table's own
// unfinished business, never silently bucketed, because an unrecognised field is
// exactly the shape a shadow grammar arrives in.
// ═══════════════════════════════════════════════════════════════════════════
export const SERIALIZATION_MAP = {
  version: "0.1.0",
  authored: "2026-08-12",
  cites: "LOGOS/lifetimes.md § the node · LOGOS/the-north-star.md § the placement discipline",
  destination: "payload schemas on class-nodes (LOGOS/classes.md § params)",

  // EVERY CLASS
  "*": {
    identity: { kind: "the class atom, in the four-word vocabulary the tree speaks today" },
    relational: {
      by: ["create", "author → node — the create-edge, stored as a field"],
      derived_from: ["provenance", "node → the source it was seeded from"],
    },
    derived: {
      tier: "standing — decided by the one walk over the ground; not the author's to assert",
      household: "the grain — resolvable from `by` through households.json",
    },
    log: { date: "the create-action's stamp; a fact about the action, not the node" },
    property: {
      pre: ["pre", "seeded before the world opened, rather than authored in play"],
      source: ["source", "the document this record renders"],
    },
  },

  // A SITED MARK — a thing standing somewhere in the world.
  sited: {
    identity: { class: "the registered class name, on a class-node" },
    relational: {
      at: ["containment", "an offset from the container's centre — meaningless without the edge"],
      extent: ["containment", "the footprint that offset governs"],
      points: ["containment", "a ring of positions; rides the same frame as `at`"],
      coords: ["containment", "which frame the numbers are written in"],
      anchor: ["containment", "where the offset is measured from"],
      implements: ["implements", "class → the machinery that honours it"],
      extends: ["extends", "class → the class it specialises"],
    },
    property: {
      mechanic: ["mechanic", "the machinery that keeps this mark true"],
      feature: ["feature", "the two-precision survey link"],
      version: ["version", "the class's revision"],
      dials: ["dials", "the class's response boundaries — destined to BE class params"],
      affordances: ["affordances", "what the class offers a resident"],
      mobility: ["mobility", "whether the mark moves, and how"],
      far: ["far", "visible from outside its own reach"],
      propagation: ["propagation", "what becomes of what is attached when this moves"],
      exempt: ["exempt", "held out of a rule, by name"],
      ambient: ["ambient", "present without being stood upon"],
      timetable: ["timetable", "the schedule a `mechanic: timetable` mark carries"],
      top_m: ["top_m", "vertical prominence"],
      ask: ["ask", "a bounty's one request"],
      reward: ["reward", "a bounty's stamps"],
      status: ["status", "a bounty's open/done"],
      threshold: ["threshold", "the bar a bounty is met at"],
      consent: ["consent", "the ground-holder's welcome word about what stands on them"],
    },
  },

  // A PARCEL — the ground a household holds.
  parcel: {
    relational: {
      at: ["containment", "an offset from the container's centre"],
      extent: ["containment", "the footprint that offset governs"],
    },
    property: { consent: ["consent", "the ground-holder's welcome word"] },
  },

  // A PREDICATED MARK — already a predicate. Its (slot, value) pair IS its
  // identity payload: "predicates are the atoms of authorship" (lifetimes.md). The
  // only two keys on disk already in lawful shape.
  predicated: {
    predicate: { slot: "the predicate's slot", value: "the predicate's value" },
    relational: { parent: ["containment", "the node this predicates — its parent continued"] },
    property: {
      mechanic: ["mechanic", "the machinery that keeps this true"],
      mechanic_draft: ["mechanic_draft", "a mechanic proposed but not registered"],
    },
  },

  // A NAMING — a predicate whose slot is implied by the act of naming.
  naming: {
    predicate: { value: "the name given" },
    relational: { parent: ["containment", "the node this names"] },
  },
  // A PROPERTY NODE — the class side (LOGOS/classes.md § Property and predicate,
  // 2026-10-16): "the four fields of a property are fixed … a name, a tier, a
  // default and a body", the body riding as every node's does. Keyed on what W1
  // (world #235 at 6c301955) actually writes on its 194 property records: every
  // one carries name and tier, 188 a default, 9 child properties an `of:` (the
  // property they belong to), 5 a values-tier, 4 a version, 12 a source (`*`).
  // Here `tier` is the property's own fixed field, whose word decides its value,
  // never the standing `*` calls residue.
  property: {
    predicate: {
      name: "the property's name, a fixed field",
      tier: "whose word decides the value (constitution or sovereign), a fixed field",
      default: "the property's default (its locked value at constitution tier), a fixed field",
      "values-tier": "the tier the values under this property take, where it differs from the property's own",
    },
    relational: { of: ["of", "child property → the property it belongs to"] },
    property: { version: ["version", "the property's revision"] },
  },
};

const ROWS = ["identity", "relational", "derived", "log", "predicate", "property"];

/**
 * Resolve one (class, key) pair through the map. Returns the row it serializes
 * into, the note explaining why, and — for a relation — the edge it becomes.
 * `unmapped` is the honest answer for a key the table does not place, and the
 * lens renders it as this table's own debt rather than as a property.
 */
/**
 * The map's scope for one node (S1, review-600 on site #275). The map is keyed
 * on the old standings, and after the kind migration a mark's kind names its
 * class (`kind: thing`, `kind: predicate`), so the scope is resolved through the
 * class helper: a kind the map names is its own scope; a predicate the map does
 * not name reads as `predicated`; any other mark subclass is sited (sited and
 * predicate are mark's two subclasses, classes.md § Property and predicate). A
 * declaration (a class or property node) has no standing scope, so only `*`
 * applies, as before.
 */
export function mapScopeOf(d) {
  const r = recordKind(d);
  if (r != null && Object.hasOwn(SERIALIZATION_MAP, r)) return r;
  if (r == null || isClassNode(d)) return r;
  return isPredicate(d) ? "predicated" : "sited";
}

export function serializes(kind, key) {
  for (const scope of [SERIALIZATION_MAP[kind], SERIALIZATION_MAP["*"]]) {
    if (!scope) continue;
    for (const row of ROWS) {
      const hit = scope[row]?.[key];
      if (hit === undefined) continue;
      if (row === "relational") return { row: "edge", edge: hit[0], note: hit[1] };
      if (row === "property") return { row: "property", slot: hit[0], note: hit[1] };
      return { row, note: hit };
    }
  }
  return { row: "unmapped", note: "this table does not place this key — mapping debt" };
}

// ── one node, through the law's glasses ──────────────────────────────────────
//
// The hub's ideal view, per node. It re-read each record and sorted every key on
// disk into what the law says it IS: an edge, a predicate, residue, or the map's
// own debt. That sorting is the whole ideal view — the hub drew it as a second
// tree beside the first, and here it paints onto the one graph and opens in the
// inspector, which is the same reading in this page's grammar.
//
// VALUES ARE NOT AVAILABLE AND ARE NOT MISSED. The payload carries each mark's
// KEY LIST, not its frontmatter values, so this says where every datum belongs
// without saying what it says. That is the load-bearing half: the law's claim is
// about placement, and a reader who wants the value has the record's path in the
// inspector two rows down.

export const IDEAL_CLASSES = ["lawful", "residue", "debt", "unread"];

/**
 * One node's keys, sorted by where the law puts them.
 *
 * `debt` is listed before `residue` in severity nowhere — they are different
 * failures, not degrees of one, and every surface that shows them keeps them
 * apart. Residue is a violation of the law by the record; debt is this table's
 * own unfinished business.
 */
export function serializationOf(d) {
  const out = { edges: [], predicates: [], residue: [], debt: [], identity: [], log: [], read: false };
  if (!d || d.kind !== "mark" || !Array.isArray(d.keys)) return out;
  out.read = true;
  // A predicated mark's (slot, value) pair is already lawful on disk — it IS a
  // predicate's identity payload (lifetimes.md), so it is named as a predicate the
  // record already keeps rather than one it owes.
  for (const k of d.keys) {
    const s = serializes(mapScopeOf(d), k);
    if (s.row === "edge") out.edges.push({ key: k, edge: s.edge, note: s.note });
    else if (s.row === "property") out.predicates.push({ key: k, slot: s.slot, note: s.note, lawful: false });
    else if (s.row === "predicate") out.predicates.push({ key: k, slot: k, note: s.note, lawful: true });
    else if (s.row === "derived") out.residue.push({ key: k, note: s.note });
    else if (s.row === "unmapped") out.debt.push({ key: k, note: s.note });
    else if (s.row === "identity") out.identity.push({ key: k, note: s.note });
    else if (s.row === "log") out.log.push({ key: k, note: s.note });
  }
  return out;
}

/**
 * Which population the ideal-view paint puts a node in.
 *
 * A node carrying BOTH residue and debt reads as `debt`, because debt is the one
 * of the two this instrument can actually fix: residue waits on a world-side
 * cutover, and an unplaced key waits only on somebody extending the map.
 */
export function idealClassOf(d) {
  const s = serializationOf(d);
  if (!s.read) return "unread";
  if (s.debt.length) return "debt";
  if (s.residue.length) return "residue";
  return "lawful";
}

// ── the field census ─────────────────────────────────────────────────────────
//
// Every (class, key) pair on disk, run through the serialization map. Three
// outcomes are deliberately kept apart, because they are three different kinds
// of problem and collapsing them would hide the one that is nobody's fault but
// ours:
//   derived   → TRUE RESIDUE. The map places it nowhere on purpose; the field on
//               disk is a violation of the law.
//   unmapped  → MAPPING DEBT. The map has not placed it yet; that is a gap in
//               SERIALIZATION_MAP, this table's own unfinished business.
//   the rest  → placed, lawfully or awaiting the cutover that moves them.

export function fieldCensus(nodes) {
  const rows = { identity: 0, edge: 0, derived: 0, log: 0, predicate: 0, property: 0, unmapped: 0 };
  const unmappedKeys = new Map();
  const residueKeys = new Map();
  const propertyKeys = new Map();
  let total = 0, read = 0;
  for (const d of nodes) {
    if (d.kind !== "mark" || !Array.isArray(d.keys)) continue;
    read++;
    for (const k of d.keys) {
      const { row } = serializes(mapScopeOf(d), k);
      rows[row]++; total++;
      if (row === "unmapped") bump(unmappedKeys, `${d.subkind}.${k}`);
      if (row === "derived") bump(residueKeys, k);
      if (row === "property") bump(propertyKeys, k);
    }
  }
  return {
    rows, total, read,
    placed: total - rows.unmapped,
    unmappedKeys: sortedPairs(unmappedKeys),
    residueKeys: sortedPairs(residueKeys),
    propertyKeys: sortedPairs(propertyKeys),
  };
}

const bump = (m, k) => m.set(k, (m.get(k) ?? 0) + 1);
const sortedPairs = (m) => [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

// ── the class registry's reach ───────────────────────────────────────────────
//
// The hub's convergence question, and the sharpest number it produced: closure
// is a property of ADDRESSING, so a class not in the graph cannot be addressed,
// and a node naming no class-node is not addressable at all.
//
// A class-node DECLARES a class — it carries `class:`, and with it the version,
// dials and implements that make a class a class. A property node (W1) declares
// too: it is the class side's property, filed under its class. Every other node,
// every instance, NAMES a class, today through `kind:`, whose four words are the older vocabulary and only one
// of which (`parcel`) has a class-node behind it. The two are counted APART:
// conflating them would report the registry as its own membership and make the
// closure look far healthier than it is.
//
// DECLARATIONS ARE NOT MARKS TO COUNT (S1, 2026-10-17). LOGOS v2 part 2 (W1)
// writes the class side's properties as `kind: property` nodes under their
// classes: no `class:`, a kind no class-node registers, and roughly a hundred
// of them. Counted as marks they would land in the older vocabulary and the
// meter would read the cutover as going backwards the day it lands. So the
// meter counts instances only. A declaration (a class-node or a property node,
// mark-class.mjs § isClassNode) is skipped; class-nodes are already the
// registry, the meter's own denominator, and property nodes are reported on
// their own line ("property nodes: N").

export function classRegistry(nodes) {
  // Declarations only (the store's own fact): an instance carrying `class:`
  // is a CITATION of the registry, never a member of it.
  const classNodes = nodes.filter(isDeclaringClassMark);
  const registered = [...new Set(classNodes.map((d) => String(d.class)))].sort();
  const reg = new Set(registered);
  const marks = nodes.filter((d) => d.kind === "mark" && !isClassNode(d));
  const propertyNodes = nodes.filter((d) => d.kind === "mark" && recordKind(d) === "property").length;
  const names = (d) => d.class != null || reg.has(String(d.subkind ?? ""));
  const citing = marks.filter(names);
  const unreg = new Map();
  for (const d of marks) if (!names(d)) bump(unreg, d.subkind ?? "(none)");
  return {
    classNodes: classNodes.length,
    propertyNodes,
    registered,
    marks: marks.length,
    citing: citing.length,
    unaddressable: marks.length - citing.length,
    unregisteredKinds: sortedPairs(unreg),
    citing_ids: citing.map((d) => d.id),
    // the drill's own set: the marks the meter counts that name no class
    // (never "every node not citing", which would light the declarations too)
    unaddressable_ids: marks.filter((d) => !names(d)).map((d) => d.id),
  };
}

/**
 * The registry paint for one node: `spine` or `off` for the machinery the
 * convergence spine runs over (or not), `declares` for a declaration (the same
 * rule the meter counts by, mark-class § isClassNode: a class-node or a
 * property node), and for an instance `names` or `unaddressable`, as the meter
 * counts it. One function, so the page's colours and the meter cannot disagree.
 */
export function registryPaintOf(d, registeredSet, convergenceKinds = []) {
  if (!d) return null;
  if (d.kind !== "mark") return convergenceKinds.includes(d.kind) ? "spine" : "off";
  if (isClassNode(d)) return "declares";
  return d.class != null || registeredSet.has(String(d.subkind ?? "")) ? "names" : "unaddressable";
}

/** Does this node name a class-node — i.e. can the law address it at all? */
export function namesRegisteredClass(d, registeredSet) {
  if (!d || d.kind !== "mark") return null;
  return d.class != null || registeredSet.has(String(d.subkind ?? ""));
}

// ── the keeping works · the town's asks (2026-08-17, the TDD-board sitting) ──
//
// The reading behind ?paint=works: the law's class marks and the OPEN ASKS —
// every action a constitutional class mark advertises with no room built
// behind it. Red here is not a failure by design: a red action is the town
// asking (the ask's representation IS the gap), and closing asks is what the
// economy is for.
//
// TWO SOURCES, NEITHER RESTATED. The class marks are found by the GATE's own
// predicate (world-store.mjs CLASS_MARK_GATE_SQL: by the-town, tier
// constitution, carrying `class:`) — deliberately NOT `class != null` alone,
// which post-binding-rule (08-17) also matches resident-authored INSTANCES: a
// resident's bounty carries `class: bounty` without declaring the class. The
// action table is L6's own rows, computed store-side where the props live —
// this reading never recomputes exposure or handledness, so it can never
// disagree with the lint it renders.

/** A class-DECLARING mark — read from the store's own `declares` fact
 *  (stamped at hydration: a class-carrying mark standing in the Keeping
 *  Works; step-1 promotion 2026-08-18). This lens used to re-derive the gate
 *  from by/tier/class and counted the three harbor charters as declarations
 *  of `town` — the exact IS-vs-INSTANCE conflation Keemin ruled away. One
 *  owner: the office derives, this reads. A payload from an older office has
 *  no `declares` field and honestly shows zero declarations rather than a
 *  re-derived guess. */
export const isDeclaringClassMark = (d) => !!d && d.declares === true;

/** The keeping-works reading: class marks, the action table, and the asks.
 *  `lints` is the payload's own findings list; absent L6 degrades to a stated
 *  absence (`available: false`), never a green guess. */
export function keepingWorks(nodes, lints = []) {
  const classMarks = nodes.filter(isDeclaringClassMark).map((d) => ({ id: d.id, class: String(d.class) }));
  const l6 = (lints ?? []).find((l) => l && l.lint === "L6");
  const actions = Array.isArray(l6?.rows)
    ? l6.rows.map((r) => ({ action: r.action, for: r.for ?? "resident", from: r.from ?? [], handled: r.handled === true }))
    : [];
  const asks = actions.filter((a) => !a.handled);
  return {
    available: Boolean(l6),
    classMarks,
    actions,
    asks,
    rooms: actions.length - asks.length,
    ask_mark_ids: [...new Set(asks.flatMap((a) => a.from))],
  };
}

// ── one species of dot (v2, stage 1) ─────────────────────────────────────────
//
// THERE IS ONE NODE TYPE. The page used to draw four — a circle for a mark, a
// diamond for a class, a rounded box for code, a hexagon for doctrine — which
// said, in the only language a graph has, that the world holds four kinds of
// thing. It holds one. What differs between nodes is what they WEAR, and every
// difference below is a derived fact about a node rather than a species it
// belongs to.
//
// Three wearings, and one eviction:
//   the standing lattice   — colour, unchanged; the default paint
//   the registry badge     — a node that DECLARES a class carries a small mark
//                            saying the registry lives here
//   continuation           — a predicate is its parent continued, so it is drawn
//                            small and tight against the parent it predicates
//   the machinery shelf    — code and doctrine are not nodes of the world at
//                            all; they are the far ends of binding channels,
//                            and they stand off the world's edge
//
// Lifetime rings are stage 2 and are deliberately absent: the payload carries no
// entities and no emissions, and a ring drawn for a lifetime nobody sent would
// be the one thing this page must never do.

export const MACHINERY_KINDS = ["code", "doctrine"];

/**
 * Is this the far end of a binding channel rather than a node of the world?
 *
 * AN UNRESOLVED END IS NOT MACHINERY, and the order of these two checks is the
 * whole reason this is a function. A dangling `reads` edge into a module the
 * office never loads is THE founding image of this page — "the stale wheelhouse
 * as a dangling red edge you see, hanging off the vessel" — and sweeping it onto
 * a shelf at the world's edge would tidy the finding out of the picture.
 */
export const isMachinery = (d) => !!d && d.unresolved !== true && MACHINERY_KINDS.includes(d.kind);

/** Does this node declare a class — is this where the registry lives?
 *  The badge is the DECLARATION's wearing: an instance carrying `class:`
 *  names the registry, it does not house it (step-1, 2026-08-18). */
export const wearsRegistryBadge = (d) => isDeclaringClassMark(d);

/**
 * Is this node a predicate of its parent?
 *
 * `naming` rides with `predicated` because a naming IS a predicate whose slot is
 * implied by the act of naming (SERIALIZATION_MAP § naming) — both inherit their
 * parent's extent whole rather than sitting inside it, which is the continuation
 * law this drawing is made of.
 */
// S1: through the class helper, so `kind: predicate` (v2) continues as `predicated` did.
export const isContinuation = (d) => !!d && d.kind === "mark" && isPredicate(d);

// ── the filter row, derived from the registry ────────────────────────────────
//
// The row used to name four hardcoded kinds. It now names the REGISTRY: one chip
// per class the world has actually declared, so the row is a reading of the
// cutover rather than a constant. As classes land the chips gain members; as
// nodes migrate onto them the older vocabulary's chip shrinks. Nothing here is
// written down in advance — a class-node added tomorrow appears in this row with
// no code change, and a page that had to be edited to notice would be a page
// that stops noticing.

export const OLDER_VOCABULARY = "older-vocabulary";
export const REGISTRY_OWN = "registry-own";
export const UNRESOLVED = "unresolved";
export const MACHINERY = "machinery";

/**
 * Which chip a node belongs to. EVERY node belongs to exactly one, and the tests
 * hold that: a filter row that did not cover the graph would leave nodes no chip
 * could reach, which is worse than no filter at all.
 */
export function filterBucketOf(d, registeredSet) {
  if (!d) return null;
  if (d.unresolved === true || d.kind === "unknown") return UNRESOLVED;   // before machinery; see isMachinery
  if (MACHINERY_KINDS.includes(d.kind)) return MACHINERY;
  if (d.kind !== "mark") return REGISTRY_OWN;    // the synthesized class-nodes the law addresses through
  if (recordKind(d) === "property") return REGISTRY_OWN;   // S1: a property node is the registry's own, a declaration
  if (d.class != null && registeredSet.has(String(d.class))) return String(d.class);
  if (registeredSet.has(String(d.subkind ?? ""))) return String(d.subkind);
  return OLDER_VOCABULARY;
}

/**
 * The chips, in the order the row draws them: the registry's own classes first
 * by weight, then the buckets that catch what the registry cannot yet name.
 *
 * A registered class with no members keeps its chip and reports `0`. That is the
 * teaching: eleven classes are declared and most of them are addressed by
 * nothing, which a row that showed only the populated ones would hide.
 */
export function classFilters(nodes) {
  const reg = classRegistry(nodes);
  const set = new Set(reg.registered);
  const counts = new Map();
  for (const d of nodes) bump(counts, filterBucketOf(d, set));
  const classes = reg.registered
    .map((c) => ({ key: c, label: c, group: "class", count: counts.get(c) ?? 0 }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
  const buckets = [
    { key: OLDER_VOCABULARY, label: "the older vocabulary", group: "bucket", count: counts.get(OLDER_VOCABULARY) ?? 0 },
    { key: REGISTRY_OWN, label: "the registry's own", group: "bucket", count: counts.get(REGISTRY_OWN) ?? 0 },
    { key: UNRESOLVED, label: "unresolved", group: "bucket", count: counts.get(UNRESOLVED) ?? 0 },
    { key: MACHINERY, label: "the machinery shelf", group: "shelf", count: counts.get(MACHINERY) ?? 0 },
  ];
  return { classes, buckets, chips: [...classes, ...buckets], registered: reg.registered, total: nodes.length };
}

// ── the law's own measures ───────────────────────────────────────────────────
//
// The hub's `lawMeasures`: the rows that answer to the law rather than to any
// single WRITE-REGISTRY row, which is why the hub gave them their own block
// instead of forcing them into one. Every one of the seven is derivable from the
// payload, which is why the ideal view could come across whole.

export function lawMeasures(nodes) {
  const reg = classRegistry(nodes);
  const fields = fieldCensus(nodes);
  // S1: properties expressed as NODES, of either shape: a predicate node (either
  // spelling of its record kind, never a naming: the slot-and-value records) or a
  // property node (W1's class side, which took 98 of them over). Properties are
  // nodes by the ruled law, so a row W1 converts stays counted rather than
  // reading the measure backwards.
  const predicateNodes = nodes.filter((d) => d.kind === "mark" && ["predicated", "predicate"].includes(recordKind(d))).length;
  const asNodes = predicateNodes + reg.propertyNodes;
  const denom = fields.rows.property + asNodes;
  const top = fields.propertyKeys.slice(0, 5).map(([k, n]) => `${k} (${n})`).join(", ");
  return [
    {
      key: "class-nodes", label: "class-nodes in the registry", now: reg.classNodes, of: null, target: null,
      note: reg.registered.length ? `${reg.registered.join(", ")} — these ARE the registry, not citations of it` : "none in this store",
    },
    {
      key: "property-nodes", label: "property nodes", now: reg.propertyNodes, of: null, target: null,
      note: reg.propertyNodes
        ? "the class side's properties (kind: property), declarations like the class-nodes, never counted as marks"
        : "none in this store: the class side's properties are still dials and predicate children",
    },
    {
      key: "citing", label: "nodes naming a registered class", now: reg.citing, of: reg.marks, target: reg.marks,
      note: reg.unregisteredKinds.length
        ? `the rest speak the older vocabulary — ${reg.unregisteredKinds.map(([k, n]) => `kind: ${k} (${n})`).join(", ")} — and a class not in the graph cannot be addressed`
        : "every node names a class-node",
    },
    {
      key: "predicates", label: "properties expressed as nodes", now: asNodes, of: denom, target: denom,
      note: `${fields.rows.property} genuine properties are still frontmatter fields${top ? ` — commonest: ${top}` : ""}`,
    },
    {
      // NOT a hardcoded zero. The store's `contains`/`describes` edges are
      // DERIVED by the hydrator from directory nesting; on disk the relation is
      // a field (`by:`, `at:`, `parent:`, `derived_from:`) and no record
      // serializes one as an edge of its own. So the numerator is the count of
      // relational keys that are written as edges rather than fields, which is
      // every relational key the map places minus all of them.
      key: "relations", label: "relations expressed as edges", now: 0, of: fields.rows.edge, target: fields.rows.edge,
      note: "every relational datum on disk is a field — the store's own edges are derived from directory nesting, not written by any record",
    },
    {
      key: "residue", label: "TRUE RESIDUE — derivables stored on records", now: fields.rows.derived, of: null, target: 0,
      note: fields.residueKeys.length
        ? `${fields.residueKeys.map(([k, n]) => `${k} (${n})`).join(", ")} — the map places them nowhere, and they are written down anyway`
        : "none — no record stores a derivable",
    },
    {
      key: "debt", label: "MAPPING DEBT — keys the map does not place", now: fields.rows.unmapped, of: null, target: 0,
      note: fields.unmappedKeys.length
        ? fields.unmappedKeys.map(([k, n]) => `${k} (${n})`).join(", ")
        : "none — every key on disk has a stated destination",
    },
  ];
}

// ── the standing lattice, derived ────────────────────────────────────────────
//
// REPLACES tierLattice (retired 2026-08-14, the founder's question "is the tier
// lattice still important for anything?" answered: its counting is not). That
// reading counted the `tier` FIELD — and tier-B made the field unlawful: the
// residue was stripped, the door bounces the word, and the loader default
// ("market" for every silent record) was all the field had left to say. The
// page's sovereign greens went dark the day the residue died, because green was
// being read off a field nobody lawfully writes.
//
// The office now derives standing AT HYDRATION through the world's own
// mark-standing.mjs — the one walk, the same verdict the gate and the fold use
// — and ships it per mark as `standing`. This lens only counts it. The walk's
// vocabulary maps to the legend's colours here and nowhere else:
//
//   constitution → constitution (blue) · home → sovereignty (green) ·
//   market → market (yellow) · not sent → the gray row, stated as such
//
// An office that has not redeployed sends no `standing`, and every mark lands
// in the gray row rather than in a guessed one — same degradation discipline as
// the key lists.

export const STANDING_TO_TIER = { constitution: "constitution", home: "sovereignty", market: "market" };

/** The legend colour a mark's derived standing maps to; null = not sent. */
export const standingTierOf = (d) =>
  d && d.kind === "mark" ? (STANDING_TO_TIER[d.standing] ?? null) : null;

export function standingLattice(nodes) {
  const marks = nodes.filter((d) => d.kind === "mark");
  const sent = marks.some((d) => d.standing != null);
  const count = (t) => marks.filter((d) => standingTierOf(d) === t).length;
  const rows = [
    { tier: "constitution", total: count("constitution") },
    { tier: "sovereignty", total: count("sovereignty") },
    { tier: "market", total: count("market") },
    // The gray row: standing the office did not send. Draft branches never
    // reach this store (it hydrates main), so on a current office this row is
    // honestly zero rather than a population nobody can name.
    { tier: "draft", total: marks.filter((d) => d.standing == null).length },
  ];
  return { rows, marks: marks.length, sent };
}

// ── what this window cannot count, and why ───────────────────────────────────
//
// The hub read a whole world clone: WORLD/marks, STATE/log/*.jsonl,
// WORLD/world-state.json, WORLD/walk-ledger.md, WORLD/households.json and
// WRITE-REGISTRY.md. This page reads ONE payload, the office's `GET
// /world/graph`, and that payload is a picture of the store — nodes and edges —
// and nothing else.
//
// So a run of the hub's readings cannot be computed here, and the honest port of
// those is not silence and not an approximation: it is the hub's own holes
// idiom, which named each absence and tied it to the registry row it belongs to
// rather than filling it with invented data. Each entry below says WHAT is
// unmeasurable, WHERE the substrate lives, and — this is the part that makes it
// a finding rather than an apology — that the reason it is not in this window is
// that it is not in the graph, which is the very thing the cutover is about.
//
// These are STATIC descriptions of a boundary, not counts, so nothing here goes
// stale as the world moves.

export const STORE_BOUNDARY = [
  {
    title: "the unified action log",
    row: "WRITE-REGISTRY: amend / withdraw / respond · crossing-save",
    text: "Every edge on this graph wants to name the action that declared it, and none can. The records live in STATE/log/*.jsonl, "
      + "which the store does not index; mark births are git commits in a separate address space again, so no containment edge could cite a seq even "
      + "if the log were here. The hole is the point: an edge that cannot cite its action is the cutover's central unfinished business.",
  },
  {
    title: "the consent words",
    row: "WRITE-REGISTRY: identity",
    text: "The one conferral the walk honours is a `consent:` map on the ground-holder's own record. Whether any exist is a question about "
      + "frontmatter VALUES, and this window carries key lists rather than values — so it can see that a record has a `consent` key and not what the key says.",
  },
  {
    title: "the shadow grammars",
    row: "WRITE-REGISTRY: movement storage · identity",
    text: "Movement lives in WORLD/walk-ledger.md as bespoke lines, identity in WORLD/households.json, money in the town's sealed ledger. "
      + "None of the three is in the graph, so none of the three can be drawn here — which is exactly what makes them shadow grammars rather than surfaces.",
  },
  {
    title: "the registry's own rows",
    row: "WRITE-REGISTRY.md",
    text: "The hub keyed every measurement to a row of WRITE-REGISTRY.md and reported drift in both directions. That file is in the world repo, "
      + "not in the store, and a copy kept here would be a second registry drifting quietly against the first. The law's own measures above are the "
      + "subset this window can compute without one.",
  },
  {
    title: "the second crystallization — the law as a graph",
    row: "LOGOS/graph/metamodel.json",
    text: "The law's own anatomy, authored by the founder pen and rescued to world wright/metamodel-rescue @ 26547f5d. It is a graph of concepts, "
      + "not of marks, so the store does not hold it and this window does not draw it. Rendering it here would mean keeping a copy of the law's anatomy "
      + "in the site tree, which is the duplication the law itself warns about.",
  },
];

// ── the record's law ─────────────────────────────────────────────────────────
//
// The piecewise LOGOS: the constitution written as real predicated marks under
// `let-there-be-light/logos` (the-record, renamed by the seed act 2026-08-13), each one a clause whose body IS the law's
// sentence. The hub counted them ("nodes under the-record", WRITE-REGISTRY row
// "the-record renderings"); this reads the same subtree out of the payload so
// the lens can light it on the graph and list it beside.
//
// NO LAW IS INVENTED HERE. The subtree is found by the path the store already
// carries, and a store whose marks have no `path` — or a world where the record
// has not been written — yields an empty tree, which the panel says plainly.
// A lens that drew law nodes the store does not hold would be the one failure
// this page cannot survive.

export const RECORD_SEGMENT = "/logos";

/** Is this node datum a clause of the written record? */
export const isRecordNode = (d) =>
  d?.kind === "mark" && typeof d.path === "string" && (d.path.includes(RECORD_SEGMENT + "/") || d.path.endsWith(RECORD_SEGMENT));

/**
 * The record subtree, as a list in reading order with each clause's depth.
 *
 * Depth is counted from the record's own root, so the root itself is 0 and its
 * clauses are 1. Sorted by path, which is the order the tree is written in and
 * therefore the order the law reads in — the store hands them back in whatever
 * order it walked.
 */
export function recordTree(nodes) {
  const clauses = nodes.filter(isRecordNode).map((d) => {
    const p = d.path.replace(/\\/g, "/");
    const after = p.slice(p.indexOf(RECORD_SEGMENT) + RECORD_SEGMENT.length);
    const depth = after.split("/").filter(Boolean).length;
    return { id: d.id, path: p, depth, tier: d.tier ?? null, body: d.body ?? null, sort: p };
  });
  clauses.sort((a, b) => a.sort.localeCompare(b.sort));
  return {
    clauses,
    total: clauses.length,
    with_body: clauses.filter((c) => c.body).length,
    // The two standings a clause lands in. A clause that asserted no tier reads
    // as the loader's default, so this is a count of what the RECORD SAYS about
    // itself, not a verdict on what the walk would derive.
    by_tier: clauses.reduce((acc, c) => { acc[c.tier ?? "—"] = (acc[c.tier ?? "—"] ?? 0) + 1; return acc; }, {}),
  };
}
