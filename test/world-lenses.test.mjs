// world-lenses.test.mjs — the /ops/graph/ lenses' arithmetic, without a browser.
//
//   node --test test/world-lenses.test.mjs
//
// What is under test is never "does it draw" but "does a reading still land on
// the right population". The lenses paint hundreds of nodes from a handful of
// small rules, and the way they fail is silently: a wrong denominator reports a
// cutover as further along than it is, and a page showing a wrong number looks
// exactly like a page showing a right one.
//
// NO FIXTURE ASSERTS A NUMBER FROM A PARTICULAR DAY'S WORLD. Every expectation
// here is computed against the little fixture below, whose shape is written down
// two lines above each assertion. The live world is mid-cutover and its figures
// are supposed to move.
//
// The nodes carrying NO key list are the most important ones here: an office
// that has not redeployed sends the payload without them, and every reading has
// to degrade to saying so rather than to a confident zero.

import test from "node:test";
import assert from "node:assert/strict";

import {
  SERIALIZATION_MAP, serializes, serializationOf, idealClassOf,
  fieldCensus, classRegistry, lawMeasures, standingLattice, standingTierOf, STORE_BOUNDARY,
  isRecordNode, recordTree, RECORD_SEGMENT,
  isMachinery, wearsRegistryBadge, isContinuation, classFilters, filterBucketOf,
  keepingWorks,
} from "../src/lib/world-lenses.mjs";

// The town's own constitution: asserts `tier:`, and carries one key the map has
// never placed (`sea_state`) — mapping debt, on a sited mark.
const quay = {
  id: "the-town/the-quay", kind: "mark", subkind: "sited", tier: "constitution", by: "the-town",
  standing: "constitution",
  path: "WORLD/marks/the-quay", body: "Six bollards, and the water slapping at them.",
  keys: ["kind", "by", "tier", "at", "extent", "date", "sea_state"],
};
// A resident's shed: asserts a standing, no debt. Residue only. The walk says
// it stands as a guest — `standing` is the office's derived verdict, shipped
// beside the keys, and it need not agree with anything the record wrote.
const shed = {
  id: "someone/their-shed", kind: "mark", subkind: "sited", tier: "market", by: "someone",
  standing: "market",
  path: "WORLD/marks/their-shed", keys: ["kind", "by", "tier", "at", "extent", "date"],
};
// Fully lawful on disk: nothing the map places nowhere, nothing it cannot place.
// The walk finds it at home on its own ground — the vocabulary is the walk's
// ("home"), which the lens maps to the legend's green ("sovereignty").
const parcel = {
  id: "someone/their-parcel", kind: "mark", subkind: "parcel", tier: "market", by: "someone",
  standing: "home",
  path: "WORLD/marks/their-parcel", keys: ["kind", "by", "at", "extent", "date"],
};
// A predicated mark — its (slot, value) pair is already a predicate's own
// identity payload, the one shape on disk the law does not want moved.
const clause = {
  id: "the-town/the-gate", kind: "mark", subkind: "predicated", tier: "constitution", by: "the-town",
  standing: "constitution",
  path: "WORLD/marks/let-there-be-light/logos/the-gate", body: "Every mark is checked before it lands.",
  keys: ["kind", "by", "tier", "date", "parent", "slot", "value"],
};
// A mark from an office that has not shipped key lists yet.
const unread = {
  id: "someone/their-lamp", kind: "mark", subkind: "sited", tier: "market", by: "someone",
  path: "WORLD/marks/their-lamp",
};
// A class-node: it DECLARES a class rather than naming one. `declares` is the
// store's own fact (stamped at hydration — a class-carrying mark standing in
// the Keeping Works; step-1, 2026-08-18); the lens reads it, never re-derives.
const parcelClass = {
  id: "the-town/parcel-class", kind: "mark", subkind: "sited", tier: "constitution", by: "the-town",
  standing: "constitution", declares: true,
  class: "parcel", path: "WORLD/marks/parcel-class", keys: ["kind", "by", "tier", "class", "version", "dials"],
};
const codeNode = { id: "code:world/tools/vessel.mjs", kind: "code", tier: null, by: null };

const NODES = [quay, shed, parcel, clause, unread, parcelClass, codeNode];

// ── the map ──────────────────────────────────────────────────────────────────

test("the map places a key by its class, falling back to the every-class block", () => {
  // `at` is relational on a sited mark — it names the edge it serializes into,
  // and is NOT a property, which is the distinction the whole table exists for
  assert.equal(serializes("sited", "at").row, "edge");
  assert.equal(serializes("sited", "at").edge, "containment");
  // `by` is not in the sited block; it comes from `*`
  assert.equal(serializes("sited", "by").edge, "create");
  // `tier` belongs NOWHERE: the map maps it to nothing on purpose
  assert.equal(serializes("sited", "tier").row, "derived");
  assert.equal(serializes("parcel", "tier").row, "derived");
  // `date` is the action's, not the node's
  assert.equal(serializes("sited", "date").row, "log");
});

test("a key the table does not place is mapping DEBT, never quietly bucketed", () => {
  const s = serializes("sited", "zzz_shadow");
  assert.equal(s.row, "unmapped");
  assert.match(s.note, /mapping debt/);
  // an unrecognised field is exactly the shape a shadow grammar arrives in, so
  // it must never resolve to `property` by omission
  assert.notEqual(s.row, "property");
});

test("the map is a way station and says so, so nobody mistakes it for the destination", () => {
  assert.match(SERIALIZATION_MAP.destination, /class-nodes/);
  assert.ok(SERIALIZATION_MAP.cites.includes("LOGOS/lifetimes.md"));
});

// WLD-39 (Wright, 2026-10-13T08:57:47.829Z): the World's lifetime doctrine moved
// from LOGOS/kinds.md to LOGOS/lifetimes.md. The map cites the new home, and
// nothing else in it moved: every key and value but `cites` is fingerprinted as
// it stood before the rename.
test("the map cites the lifetime doctrine at its new home, and is otherwise exactly the map it was", async () => {
  assert.equal(SERIALIZATION_MAP.cites, "LOGOS/lifetimes.md § the node · LOGOS/the-north-star.md § the placement discipline");
  assert.doesNotMatch(SERIALIZATION_MAP.cites, /kinds\.md/);
  const { createHash } = await import("node:crypto");
  // S1 (2026-10-17) added one scope, `property`, for W1's property nodes; it is
  // held exactly below, and everything else keeps the fingerprint it had
  const { cites, property, ...rest } = SERIALIZATION_MAP;
  const canon = (v) => Array.isArray(v) ? v.map(canon) : (v && typeof v === "object") ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : v;
  assert.equal(createHash("sha256").update(JSON.stringify(canon(rest))).digest("hex"),
    "316d6a2aae19f38de365ba281a4a6dd0ca34d6aac0741f947dc2f7ffa118b0e5",
    "version, entries, keys and classifications unchanged — only the citation moved, and the property scope was added");
  // keyed on the keys W1 (world #235 at 6c301955) actually writes on its 194 property records
  assert.deepEqual(Object.keys(property.predicate), ["name", "tier", "default", "values-tier"], "the property's fixed fields");
  assert.deepEqual(Object.keys(property.relational), ["of"]);
  assert.equal(property.relational.of[0], "of", "a child property's of: is the edge to its parent property");
  assert.deepEqual(Object.keys(property.property), ["version"]);
  assert.deepEqual(Object.keys(property).sort(), ["predicate", "property", "relational"], "and nothing else in the new scope");
});

// ── one node, through the law's glasses ──────────────────────────────────────

test("a node's keys sort into edges, predicates, residue and debt", () => {
  const s = serializationOf(quay);
  assert.equal(s.read, true);
  assert.deepEqual(s.edges.map((e) => e.key).sort(), ["at", "by", "extent"]);
  assert.deepEqual(s.residue.map((r) => r.key), ["tier"]);
  assert.deepEqual(s.debt.map((d) => d.key), ["sea_state"]);
  assert.deepEqual(s.identity.map((i) => i.key), ["kind"]);
  assert.deepEqual(s.log.map((l) => l.key), ["date"]);
});

test("a predicated mark's slot and value are named as predicates it ALREADY keeps", () => {
  const s = serializationOf(clause);
  const lawful = s.predicates.filter((p) => p.lawful).map((p) => p.key).sort();
  assert.deepEqual(lawful, ["slot", "value"]);
  // `parent` is the containment edge, not a property — the continuation law
  assert.deepEqual(s.edges.map((e) => e.key).sort(), ["by", "parent"]);
});

test("the ideal paint puts debt above residue, because debt is the one we can fix", () => {
  // the quay carries both; it reads as debt
  assert.equal(idealClassOf(quay), "debt");
  assert.equal(idealClassOf(shed), "residue");
  assert.equal(idealClassOf(parcel), "lawful");
  // and a node the office sent no key list for is UNREAD, never "lawful"
  assert.equal(idealClassOf(unread), "unread");
  assert.equal(idealClassOf(codeNode), "unread");
  assert.equal(serializationOf(unread).read, false);
});

// ── the field census ─────────────────────────────────────────────────────────

test("the field census keeps residue and debt apart, because they are different failures", () => {
  const f = fieldCensus(NODES);
  assert.equal(f.read, 5);                       // the unread mark contributes nothing; the code node is not a mark
  // TRUE RESIDUE: four records carry `tier` (the map places it nowhere)
  assert.deepEqual(f.residueKeys, [["tier", 4]]);
  // MAPPING DEBT names the class with the key: the same word can be lawful on
  // one class and debt on another, so a bare key name is unactionable
  assert.deepEqual(f.unmappedKeys, [["sited.sea_state", 1]]);
  assert.equal(f.placed, f.total - f.rows.unmapped);
});

test("`at` and `extent` count as EDGES, not properties — the map's whole point", () => {
  const f = fieldCensus([quay]);
  assert.equal(f.rows.edge, 3);     // by, at, extent
  assert.equal(f.rows.property, 0);
  assert.equal(f.rows.identity, 1); // kind
  assert.equal(f.rows.log, 1);      // date
});

// ── the class registry's reach ───────────────────────────────────────────────

test("declaring a class and naming one are counted APART", () => {
  const r = classRegistry(NODES);
  // one node carries `class:` — it IS the registry, not a citation of it
  assert.equal(r.classNodes, 1);
  assert.deepEqual(r.registered, ["parcel"]);
  // the parcel names `parcel`. The class-node itself is a declaration, so it is
  // the registry and not one of the marks the meter counts (S1, 2026-10-17)
  assert.equal(r.citing, 1);
  assert.equal(r.marks, 5);
  assert.equal(r.unaddressable, 4);
  assert.equal(r.propertyNodes, 0);
  // the rest speak the older four-word vocabulary, named with their counts
  assert.deepEqual(r.unregisteredKinds, [["sited", 3], ["predicated", 1]]);
});

test("a store with no class-nodes reports nothing addressable, not everything", () => {
  const r = classRegistry([shed, parcel, unread]);
  assert.equal(r.classNodes, 0);
  assert.deepEqual(r.registered, []);
  assert.equal(r.citing, 0);
  assert.equal(r.unaddressable, 3);
});

// ── the law's own measures ───────────────────────────────────────────────────

test("the law's measures each carry a denominator and a target", () => {
  const m = lawMeasures(NODES);
  assert.deepEqual(m.map((x) => x.key), ["class-nodes", "property-nodes", "citing", "predicates", "relations", "residue", "debt"]);
  const by = Object.fromEntries(m.map((x) => [x.key, x]));
  assert.equal(by.citing.now, 1);
  assert.equal(by.citing.of, 5);
  assert.equal(by["property-nodes"].now, 0);
  assert.equal(by.residue.now, 4);
  assert.equal(by.residue.target, 0);
  assert.equal(by.debt.now, 1);
  assert.equal(by.debt.target, 0);
  // "relations expressed as edges" is 0 by DERIVATION, not by a literal: every
  // relational datum on disk is a field, and the store's own edges are the
  // hydrator's, not any record's
  assert.equal(by.relations.now, 0);
  assert.equal(by.relations.of, fieldCensus(NODES).rows.edge);
  assert.match(by.relations.note, /derived from directory nesting/);
});

test("the measures name the residue and debt keys rather than only counting them", () => {
  const by = Object.fromEntries(lawMeasures(NODES).map((x) => [x.key, x]));
  assert.match(by.residue.note, /tier/);
  assert.match(by.debt.note, /sea_state/);
  // and a clean store says so instead of leaving an empty string
  const clean = Object.fromEntries(lawMeasures([parcel]).map((x) => [x.key, x]));
  assert.match(clean.residue.note, /none/);
  assert.match(clean.debt.note, /none/);
});

// ── the standing lattice, derived ────────────────────────────────────────────
//
// The counts are the one walk's verdict as the office shipped it — the field
// census above is where the retired `tier:` field is still watched (as residue).

test("the lattice counts DERIVED standing, mapping the walk's vocabulary to the legend's", () => {
  // the walk says "home"; the legend's green row is named "sovereignty"
  assert.equal(standingTierOf(parcel), "sovereignty");
  assert.equal(standingTierOf(shed), "market");
  assert.equal(standingTierOf(quay), "constitution");
  assert.equal(standingTierOf(unread), null);          // not sent → no colour guessed
  assert.equal(standingTierOf(codeNode), null);        // machinery has no standing at all
  const l = standingLattice(NODES);
  const by = Object.fromEntries(l.rows.map((r) => [String(r.tier), r]));
  assert.equal(l.sent, true);
  assert.equal(by.constitution.total, 3);              // quay, clause, parcelClass
  assert.equal(by.sovereignty.total, 1);               // the parcel — at home on its own ground
  assert.equal(by.market.total, 1);                    // the shed — a guest where it stands
  assert.equal(by.draft.total, 1);                     // the unread mark: standing not sent
});

test("an office that sends no standing puts every mark in the gray row and says so", () => {
  const l = standingLattice([unread]);
  assert.equal(l.sent, false);
  const by = Object.fromEntries(l.rows.map((r) => [String(r.tier), r]));
  // the mark is not painted into a guessed tier — it lands in "not sent"
  assert.equal(by.draft.total, 1);
  assert.equal(by.constitution.total + by.sovereignty.total + by.market.total, 0);
});

// ── the boundary ─────────────────────────────────────────────────────────────

test("the boundary names what this window cannot count, and stays a description", () => {
  assert.ok(STORE_BOUNDARY.length >= 4);
  for (const h of STORE_BOUNDARY) {
    assert.ok(h.title && h.row && h.text, "a hole with no name, row or reason");
    // A hole is a STATIC statement about the substrate. A digit in one would be
    // a count from some particular day, quietly going stale.
    assert.equal(/\b\d{2,}\b/.test(h.text), false, `${h.title} carries a baked figure`);
  }
});

// ── one species of dot ───────────────────────────────────────────────────────

const doctrine = { id: "engine/files", kind: "doctrine", tier: null, by: null };
const dangling = { id: "code:world/tools/vessel.mjs", kind: "code", unresolved: true };

test("machinery is the far end of a binding channel — but a DANGLE never is", () => {
  assert.equal(isMachinery(codeNode), true);
  assert.equal(isMachinery(doctrine), true);
  assert.equal(isMachinery(quay), false);
  // THE FOUNDING IMAGE OF THIS PAGE. A dangling `reads` into a module the office
  // never loads is the finding, and shelving it at the world's edge would tidy
  // the finding out of the picture it exists to be in.
  assert.equal(isMachinery(dangling), false);
});

test("the registry badge marks the nodes that DECLARE a class, not the ones that name one", () => {
  assert.equal(wearsRegistryBadge(parcelClass), true);   // carries `class:`
  assert.equal(wearsRegistryBadge(parcel), false);       // merely names one
  assert.equal(wearsRegistryBadge(codeNode), false);
  // and the synthesized class-node carries no `class:` of its own, so no badge
  assert.equal(wearsRegistryBadge({ id: "mechanic:light", kind: "class", subkind: "mechanic" }), false);
});

test("a naming is a continuation too — both inherit the parent's extent whole", () => {
  assert.equal(isContinuation(clause), true);                       // predicated
  assert.equal(isContinuation({ ...clause, subkind: "naming" }), true);
  assert.equal(isContinuation(quay), false);                        // sited stands somewhere
  assert.equal(isContinuation(parcel), false);
  assert.equal(isContinuation(codeNode), false);
});

// ── the filter row ───────────────────────────────────────────────────────────

const ROW_NODES = [quay, shed, parcel, clause, unread, parcelClass, codeNode, doctrine, dangling,
  { id: "mechanic:light", kind: "class", subkind: "mechanic" }];

test("every node lands in exactly one chip — a filter that missed some would be worse than none", () => {
  const f = classFilters(ROW_NODES);
  const summed = f.chips.reduce((n, c) => n + c.count, 0);
  assert.equal(summed, ROW_NODES.length, "the chips do not cover the graph");
  assert.equal(f.total, ROW_NODES.length);
});

test("the chips come from the registry, not from a list written here", () => {
  const f = classFilters(ROW_NODES);
  // one chip per class the world actually declared — `parcel`, from parcelClass
  assert.deepEqual(f.classes.map((c) => c.key), ["parcel"]);
  assert.equal(f.classes[0].count, 2);          // the declaring node and the one naming it
  // a world that declares nothing has no class chips at all, and says so through
  // the older vocabulary rather than through an invented default
  const bare = classFilters([quay, shed, clause]);
  assert.deepEqual(bare.classes, []);
  assert.equal(bare.buckets.find((b) => b.key === "older-vocabulary").count, 3);
});

test("the buckets catch what the registry cannot name, each by its own reason", () => {
  const by = Object.fromEntries(classFilters(ROW_NODES).buckets.map((b) => [b.key, b.count]));
  assert.equal(by["older-vocabulary"], 4);   // quay, shed, clause, unread — naming no class
  assert.equal(by["registry-own"], 1);       // the synthesized mechanic:light
  assert.equal(by.unresolved, 1);            // the dangle
  assert.equal(by.machinery, 2);             // the code module and the doctrine section
});

test("a registered class nothing names keeps its chip and reports zero", () => {
  // two declared classes, one of them addressed by nobody: the row must still
  // show it, because "declared and reached by nothing" is the finding
  const lightClass = { id: "the-town/light", kind: "mark", subkind: "sited", class: "light", by: "the-town", declares: true };
  const f = classFilters([parcelClass, parcel, lightClass]);
  const by = Object.fromEntries(f.classes.map((c) => [c.key, c.count]));
  assert.equal(by.parcel, 2);
  assert.equal(by.light, 1);                 // only its own declaring node
  assert.deepEqual(f.classes.map((c) => c.key), ["parcel", "light"]);   // by weight, then name
});

// ── the record ───────────────────────────────────────────────────────────────

const rec = (slug, path, tier, body) => ({
  id: `the-town/${slug}`, kind: "mark", subkind: "predicated", tier, by: "the-town", path, body,
});
const RECORD = [
  rec("logos", "WORLD/marks/let-there-be-light/logos", "constitution", "The World is a record that computes itself."),
  rec("the-gate", "WORLD/marks/let-there-be-light/logos/the-gate", "constitution", "Every mark is checked before it lands."),
  rec("the-fidelity", "WORLD/marks/let-there-be-light/logos/the-gate/the-fidelity", "constitution", null),
  rec("the-fold", "WORLD/marks/let-there-be-light/logos/the-fold", "market", "Every claim folds into one canon."),
];

test("the record subtree follows the seed act's rename, by the path the store carries", () => {
  assert.equal(RECORD_SEGMENT, "/logos");
  assert.equal(isRecordNode(RECORD[0]), true);
  assert.equal(isRecordNode(RECORD[2]), true);
  // a mark that merely mentions the word is not a clause
  assert.equal(isRecordNode({ ...quay, path: "WORLD/marks/logos-shop" }), false);
  // and a store with no paths yields nothing rather than a guess
  assert.equal(isRecordNode({ ...quay, path: undefined }), false);
});

test("the tree reads in written order, with depth from the record's own root", () => {
  const t = recordTree([...RECORD, quay, codeNode]);
  assert.equal(t.total, 4);
  assert.deepEqual(t.clauses.map((c) => c.depth), [0, 1, 1, 2]);
  assert.deepEqual(t.clauses.map((c) => c.id), [
    "the-town/logos", "the-town/the-fold", "the-town/the-gate", "the-town/the-fidelity",
  ]);
  assert.equal(t.with_body, 3);
  assert.deepEqual(t.by_tier, { constitution: 3, market: 1 });
});

test("a world where the record has not been written yields an empty tree, not an invented one", () => {
  const t = recordTree([quay, codeNode, unread]);
  assert.equal(t.total, 0);
  assert.deepEqual(t.clauses, []);
});

// ── the keeping works · the town's asks (2026-08-17, the TDD-board sitting) ──
//
// The reading behind ?paint=works: the law's class marks and the open asks —
// L6's own rows are the actions authority (never recomputed here), and a
// class mark is the GATE's predicate (by the-town, tier constitution, class:)
// — NOT `class != null` alone, which post-binding-rule also matches resident
// instances (a bounty carries class: bounty without declaring the class).

const worksMark = (slug, cls) => ({
  id: `the-town/${slug}`, kind: "mark", tier: "constitution", by: "the-town", class: cls,
  declares: true,   // the store's fact — stamped by the hydrator for a class mark standing in the works
  path: `WORLD/marks/let-there-be-light/the-town-centre/the-keeping-works/${slug}`,
});
const residentBounty = {
  id: "spark-the-builder/fix-the-gate", kind: "mark", tier: "market", by: "spark-the-builder", class: "bounty",
  path: "WORLD/marks/let-there-be-light/the-town-centre/the-bounty-board/fix-the-gate",
};
const L6_FIXTURE = {
  lint: "L6", verdict: "RED", headline: "1 action(s) advertised by law with no handler",
  rows: [
    { action: "say", for: "resident", from: ["the-town/resident"], handled: true },
    { action: "walk", for: "resident", from: ["the-town/resident"], handled: true },
    { action: "say", for: "human", from: ["the-town/human"], handled: false },
    { action: "join", for: "resident", from: ["the-town/household"], handled: false },
  ],
};

test("the keeping works: class marks by the gate's predicate, asks off the lint's own rows", () => {
  const w = keepingWorks([worksMark("resident", "resident"), worksMark("household", "household"), residentBounty, quay, codeNode], [L6_FIXTURE]);
  assert.equal(w.available, true);
  assert.deepEqual(w.classMarks.map((m) => m.id).sort(), ["the-town/household", "the-town/resident"],
    "a resident's classed INSTANCE must not read as a declaring class mark");
  assert.equal(w.actions.length, 4);
  assert.equal(w.rooms, 2);
  assert.deepEqual(w.asks.map((a) => `${a.action}/${a.for}`), ["say/human", "join/resident"],
    "the actor kind rides every ask — say-for-human is a different ask than say");
  assert.deepEqual(w.asks[1].from, ["the-town/household"]);
});

test("the keeping works: a payload without the lint degrades to a stated absence, never a green guess", () => {
  const w = keepingWorks([worksMark("resident", "resident")], []);
  assert.equal(w.available, false);
  assert.deepEqual(w.actions, []);
  assert.deepEqual(w.asks, []);
  assert.equal(w.classMarks.length, 1, "the marks are the payload's and still read; only the action side is absent");
});
