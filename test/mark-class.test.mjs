// mark-class.test.mjs — the site's one class helper reads both forms (S1, LOGOS v2).
//
//   M1  classOf over the table in the module's header: every old form and its
//       new form name the same class, on a world-state mark and on a graph node
//   M2  isA climbs only when given a tree; a naming is a predicate either way;
//       a loop stops
//   M3  a class node is never an instance of the class it declares (the
//       DEFINITION_KIND ruling in civic.mjs, now one rule for every reader)
//   M4  the readers routed through it answer the same for the new form as for
//       the old: predicatesOf, isIdea, isNotice, isContinuation; and a mark of
//       the old form carrying BOTH fields (`kind: predicated` + `class: idea`,
//       three on world main) is a predicate by its kind and an idea by its class
//   M5  the serialization map's scope goes through the helper: a `kind: thing`
//       mark reads as sited and a `kind: predicate` one as predicated, so the
//       census owes no false debt after W2; a property node is a declaration
//   M6  the readers whose flips stay green today, held on the new form: harbor's
//       charters and their predicates, the cockpit's parcel, lawMeasures' count
//
// Run: node --test test/mark-class.test.mjs

import test from "node:test";
import assert from "node:assert/strict";

import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { classOf, isA, isClassNode, isInstanceOf, isPredicate, recordKind } from "../src/lib/mark-class.mjs";
import { loadCharters } from "../src/lib/harbor.mjs";
import { ownParcelIn } from "../src/lib/world-cockpit.mjs";
import { predicatesOf, isIdea } from "../src/lib/civic.mjs";
import { isNotice } from "../src/lib/board.mjs";
import { REGISTRY_OWN, classRegistry, fieldCensus, filterBucketOf, isContinuation, lawMeasures, mapScopeOf, registryPaintOf, serializationOf } from "../src/lib/world-lenses.mjs";

// [old form, new form, the class both name]
const PAIRS = [
  [{ kind: "sited", class: "thing" }, { kind: "thing" }, "thing"],
  [{ kind: "sited" }, { kind: "sited" }, "sited"],
  [{ kind: "parcel" }, { kind: "parcel" }, "parcel"],
  [{ kind: "predicated", slot: "s", value: "v" }, { kind: "predicate", slot: "s", value: "v" }, "predicate"],
  [{ kind: "naming", value: "N" }, { kind: "naming", value: "N" }, "naming"],
  [{ kind: "sited", class: "idea" }, { kind: "idea" }, "idea"],
];
const asNode = (m) => { const { kind, ...rest } = m; return { kind: "mark", subkind: kind, ...rest }; };

test("M1: an old form and its new form name the same class, as a world-state mark and as a graph node", () => {
  for (const [old, neu, cls] of PAIRS) {
    assert.equal(classOf(old), cls, `old ${JSON.stringify(old)}`);
    assert.equal(classOf(neu), cls, `new ${JSON.stringify(neu)}`);
    assert.equal(classOf(asNode(old)), cls, `old as a node ${JSON.stringify(old)}`);
    assert.equal(classOf(asNode(neu)), cls, `new as a node ${JSON.stringify(neu)}`);
  }
  assert.equal(recordKind({ kind: "mark", subkind: "parcel" }), "parcel", "a graph node's record kind is its subkind");
  assert.equal(recordKind({ kind: "mark" }), "mark", "a row with no subkind key is read as it is");
  assert.equal(classOf(null), null);
  assert.equal(classOf({}), null);
  assert.equal(classOf({ kind: "sited", class: "  " }), "sited", "a blank class: names nothing");
});

test("M2: isA climbs only with a tree; a naming is a predicate either way; a loop stops", () => {
  const tree = { candy: "consumable", consumable: "thing", thing: "mark", mark: "postmark-node", a: "b", b: "a" };
  const extendsOf = (c) => tree[c] ?? null;
  assert.ok(isA({ kind: "candy" }, "candy"));
  assert.ok(!isA({ kind: "candy" }, "thing"), "no tree, exact only");
  assert.ok(isA({ kind: "candy" }, "thing", { extendsOf }));
  assert.ok(isA({ kind: "sited", class: "candy" }, "thing", { extendsOf }), "the old form climbs the same");
  assert.ok(!isA({ kind: "a" }, "zzz", { extendsOf }), "a loop ends");
  for (const m of [{ kind: "predicated" }, { kind: "predicate" }, { kind: "naming" }, { kind: "mark", subkind: "naming" }]) assert.ok(isPredicate(m), JSON.stringify(m));
  for (const m of [{ kind: "sited" }, { kind: "parcel" }, { kind: "thing" }]) assert.ok(!isPredicate(m), JSON.stringify(m));
});

test("M3: a class node is never an instance of the class it declares", () => {
  const decl = { id: "the-town/idea", kind: "class", class: "idea" };
  assert.ok(isClassNode(decl));
  assert.ok(isClassNode({ kind: "mark", subkind: "sited", class: "idea", declares: true }), "the store's own declares fact");
  assert.ok(!isInstanceOf(decl, "idea"));
  assert.ok(isInstanceOf({ kind: "sited", class: "idea" }, "idea"));
  assert.ok(isInstanceOf({ kind: "idea" }, "idea"));
});

test("M4: the routed readers answer the new form as they answered the old", () => {
  const place = "kai/the-shop";
  const state = (kind) => ({ marks: [
    { id: "kai/sign", kind, slot: "trade", value: "bread", parent: place },
    { id: "kai/name", kind: "naming", value: "The Shop", parent: place },
  ] });
  assert.deepEqual(predicatesOf(place, { state: state("predicate") }), predicatesOf(place, { state: state("predicated") }));
  assert.deepEqual(predicatesOf(place, { state: state("predicated") }), [{ slot: "trade", value: "bread" }], "a naming carries no slot, so it adds no row");
  assert.equal(isIdea({ kind: "idea" }), isIdea({ kind: "sited", class: "idea" }));
  assert.ok(isIdea({ kind: "idea" }));
  assert.ok(!isIdea({ kind: "class", class: "idea" }), "the class node is not an idea");
  const board = "let-there-be-light/the-town-centre/the-bounty-board";
  assert.equal(isNotice({ kind: "bounty", placementParent: board }, { boardPlace: board }), true);
  assert.equal(isNotice({ kind: "sited", class: "bounty", placementParent: board }, { boardPlace: board }), true);
  assert.equal(isNotice({ kind: "class", class: "bounty", placementParent: board }, { boardPlace: board }), false, "nor is the bounty class node a notice");
  assert.ok(isContinuation({ kind: "mark", subkind: "predicate" }));
  assert.ok(isContinuation({ kind: "mark", subkind: "predicated" }));
  assert.ok(isContinuation({ kind: "mark", subkind: "naming" }));
  assert.ok(!isContinuation({ kind: "mark", subkind: "sited" }));
});

test("M4b: a dual-field record (kind: predicated + class: idea) is a predicate by its kind and an idea by its class", () => {
  const dual = { id: "let-there-be-light/the-dropped-field", kind: "predicated", class: "idea", slot: "field", value: "dropped", parent: "kai/the-shop" };
  assert.ok(isPredicate(dual));
  assert.ok(isIdea(dual), "and still an idea, as it was");
  assert.ok(isContinuation({ kind: "mark", subkind: "predicated", class: "idea" }));
  assert.deepEqual(predicatesOf("kai/the-shop", { state: { marks: [dual] } }), [{ slot: "field", value: "dropped" }], "its slot counts on the place it describes");
  const measured = lawMeasures([{ id: dual.id, kind: "mark", subkind: "predicated", class: "idea", keys: ["kind", "slot", "value"] }]);
  assert.equal(measured.find((r) => r.key === "predicates").now, 1, "and in the law's predicate count");
});

test("M5: the serialization map's scope goes through the helper, so the new form owes no false debt", () => {
  const node = (subkind, keys, extra = {}) => ({ id: `x/${subkind}`, kind: "mark", subkind, keys, ...extra });
  assert.equal(mapScopeOf(node("sited", [])), "sited");
  assert.equal(mapScopeOf(node("thing", [])), "sited", "a sited subclass the map does not name reads as sited");
  assert.equal(mapScopeOf(node("candy", [])), "sited");
  assert.equal(mapScopeOf(node("predicate", [])), "predicated");
  assert.equal(mapScopeOf(node("naming", [])), "naming", "a kind the map names is its own scope");
  assert.equal(mapScopeOf(node("class", [])), "class", "a declaration has no standing scope");
  assert.equal(mapScopeOf(node("property", [])), "property");
  const siteKeys = ["kind", "by", "tier", "at", "extent", "date", "points"];
  const predKeys = ["kind", "by", "tier", "date", "slot", "value"];
  const strip = (r) => ({ edges: r.edges.map((e) => e.key), predicates: r.predicates.map((p) => p.key), residue: r.residue.map((x) => x.key), debt: r.debt.map((x) => x.key) });
  assert.deepEqual(strip(serializationOf(node("thing", siteKeys))), strip(serializationOf(node("sited", siteKeys))), "a thing is serialized as the sited mark it was");
  assert.deepEqual(strip(serializationOf(node("predicate", predKeys))), strip(serializationOf(node("predicated", predKeys))), "a predicate as the predicated mark it was");
  const census = (subkind, keys) => fieldCensus([node(subkind, keys)]).rows;
  assert.deepEqual(census("thing", siteKeys), census("sited", siteKeys));
  assert.deepEqual(census("predicate", predKeys), census("predicated", predKeys));
  assert.ok(isClassNode({ kind: "property" }) && isClassNode({ kind: "mark", subkind: "property" }), "a property node is a declaration");
  assert.ok(!isInstanceOf({ kind: "property", class: "idea" }, "idea"));
});

test("M6: harbor's charters, the cockpit's parcel and lawMeasures' count read the new form as the old", () => {
  const registry = (kinds) => {
    const dir = mkdtempSync(join(tmpdir(), "s1-harbor-"));
    const write = (rel, fm, body) => { mkdirSync(join(dir, rel), { recursive: true }); writeFileSync(join(dir, rel, "mark.md"), `---\n${fm}\n---\n${body}\n`); };
    write("1f916", `by: the-town\n${kinds.charter}\ntier: constitution\ndate: 2026-10-01`, "the forum");
    write("1f916/door", `by: the-town\n${kinds.predicate}\nslot: door\nvalue: the forum's gate\ndate: 2026-10-01`, "its door");
    return dir;
  };
  const read = (kinds) => loadCharters({ path: registry(kinds) }).map((t) => ({ slug: t.slug, door: t.door, slots: t.predicates.map((p) => p.slot) }));
  const old = read({ charter: "kind: sited\nclass: town", predicate: "kind: predicated" });
  assert.deepEqual(old, [{ slug: "1f916", door: "the forum's gate", slots: ["door"] }], "the old form reads");
  assert.deepEqual(read({ charter: "kind: town", predicate: "kind: predicate" }), old, "the new form reads the same");
  const within = (w) => ({ within: [{ id: "the-town/the-town-centre", by: "the-town", kind: "sited" }, w] });
  for (const w of [{ id: "kai/the-shop-ground", by: "kai", kind: "parcel" }, { id: "kai/the-shop-ground", by: "kai", kind: "sited", class: "parcel" }])
    assert.equal(ownParcelIn(within(w), ["kai"]), "kai/the-shop-ground", JSON.stringify(w));
  assert.equal(ownParcelIn(within({ id: "kai/the-shop", by: "kai", kind: "thing" }), ["kai"]), null);
  const count = (subkind) => lawMeasures([{ id: "x", kind: "mark", subkind, keys: ["kind", "slot", "value"] }]).find((r) => r.key === "predicates").now;
  assert.equal(count("predicate"), count("predicated"));
  assert.equal(count("predicated"), 1);
  assert.equal(count("naming"), 0, "a naming is not a slot-and-value record");
});

test("M7 (WLD-73 G10/G11): every predicate read answers kind: predicated and kind: predicate the same, pen and state alike", () => {
  const place = "kai/the-shop";
  const plaque = (kind) => ({ id: "kai/sign", kind, slot: "trade", value: "bread", parent: place });
  for (const where of ["pen", "state"]) {
    const feed = (kind) => (where === "pen" ? { pen: { "kai/sign": plaque(kind) } } : { state: { marks: [plaque(kind)] } });
    const old = predicatesOf(place, feed("predicated"));
    assert.deepEqual(old, [{ slot: "trade", value: "bread" }], `${where}: the old form reads`);
    assert.deepEqual(predicatesOf(place, feed("predicate")), old, `${where}: the new form reads the same`);
  }
  // the store publishes kind: <class> with no class: (G11 A), as a graph node's subkind
  for (const subkind of ["predicated", "predicate"]) {
    const d = { id: "kai/sign", kind: "mark", subkind, keys: ["kind", "by", "date", "slot", "value", "parent"] };
    assert.ok(isContinuation(d), `${subkind}: a continuation`);
    assert.equal(mapScopeOf(d), "predicated", `${subkind}: the map's predicated scope`);
  }
  assert.deepEqual(serializationOf({ kind: "mark", subkind: "predicate", keys: ["slot", "value", "parent"] }),
    serializationOf({ kind: "mark", subkind: "predicated", keys: ["slot", "value", "parent"] }), "the slot rows read the same");
});

// W1's REAL property records (world #235 at 6c301955), as the office's graph
// payload carries them: node kind "mark", the record's kind as subkind, and the
// author's own frontmatter keys. Copied from the tree, not invented: the key
// census over all 194 is name 194, tier 194, default 188, source 12, of 9,
// values-tier 5, version 4.
const W1 = "WORLD/marks/let-there-be-light/the-town-centre/the-keeping-works";
const w1Row = (id, path, tier, keys) => ({ id, kind: "mark", subkind: "property", by: "the-town", tier, path: `${W1}/${path}`, keys });
const W1_PROPERTIES = [
  // postmark-node/mark/thing/thing-portable: a sovereign property and its default
  w1Row("the-town/thing-portable", "postmark-node/mark/thing/thing-portable", "sovereign", ["kind", "by", "tier", "date", "name", "default"]),
  // postmark-node/entity/resident/resident-capacity: a child property, `of:` its parent property
  w1Row("the-town/resident-capacity", "postmark-node/entity/resident/resident-capacity", "constitution", ["kind", "by", "tier", "date", "name", "of", "default"]),
  // postmark-derived/position/exposure-slot: values-tier
  w1Row("the-town/exposure-slot", "postmark-derived/position/exposure-slot", "constitution", ["kind", "by", "tier", "date", "name", "default", "values-tier"]),
  // postmark-edge/settle/co-sign-guard: a version
  w1Row("the-town/co-sign-guard", "postmark-edge/settle/co-sign-guard", "constitution", ["kind", "by", "tier", "date", "name", "default", "version"]),
  // postmark-derived/position/the-anchor: a source
  w1Row("the-town/the-anchor", "postmark-derived/position/the-anchor", "constitution", ["kind", "by", "tier", "date", "name", "default", "source"]),
  // postmark-node/mark/mark-body: one of the six with no default
  w1Row("the-town/mark-body", "postmark-node/mark/mark-body", "sovereign", ["kind", "by", "tier", "date", "name"]),
];

test("M8: W1's property nodes are declarations: the cutover meter counts none of them as unaddressable, and says how many on their own line", () => {
  const cls = (name) => ({ id: `the-town/${name}`, kind: "mark", subkind: "class", class: name, by: "the-town", tier: "constitution", declares: true });
  const instances = [
    { id: "kai/the-good-lighter", kind: "mark", subkind: "thing", by: "kai" },
    { id: "kai/the-shop-ground", kind: "mark", subkind: "parcel", by: "kai" },
    { id: "kai/a-bench", kind: "mark", subkind: "sited", by: "kai" },
  ];
  const classes = [cls("thing"), cls("parcel"), cls("resident")];
  const nodes = [...classes, ...W1_PROPERTIES, ...instances];
  const r = classRegistry(nodes);
  assert.equal(r.marks, 3, "only instances are counted");
  assert.equal(r.citing, 2, "the thing and the parcel name registered classes");
  assert.equal(r.unaddressable, 1, "the plain sited mark, and no property node");
  assert.deepEqual(r.unregisteredKinds, [["sited", 1]], "no 'kind: property' in the older vocabulary");
  assert.equal(r.propertyNodes, W1_PROPERTIES.length);
  const m = Object.fromEntries(lawMeasures(nodes).map((x) => [x.key, x]));
  assert.equal(m["property-nodes"].now, W1_PROPERTIES.length);
  assert.equal(m.citing.of, 3);
  const set = new Set(r.registered);
  for (const p of W1_PROPERTIES) assert.equal(filterBucketOf(p, set), REGISTRY_OWN, `${p.id}: the registry's own chip, never the older vocabulary`);
  // the same world without its property nodes reads the same meter: they add a line, never a debt
  const without = classRegistry([...classes, ...instances]);
  assert.deepEqual({ ...without, propertyNodes: W1_PROPERTIES.length }, r);
});

test("M8b: the drill lights exactly the unaddressable marks: never a declaration (review-275 blocker 1)", () => {
  const cls = (name) => ({ id: `the-town/${name}`, kind: "mark", subkind: "class", class: name, by: "the-town", tier: "constitution", declares: true });
  const nodes = [cls("thing"), cls("parcel"), ...W1_PROPERTIES,
    { id: "kai/the-good-lighter", kind: "mark", subkind: "thing", by: "kai" },
    { id: "kai/a-bench", kind: "mark", subkind: "sited", by: "kai" },
    { id: "kai/a-stone", kind: "mark", subkind: "sited", by: "kai" },
    { id: "LOGOS/classes.md", kind: "doctrine" }];
  const r = classRegistry(nodes);
  assert.deepEqual(r.unaddressable_ids, ["kai/a-bench", "kai/a-stone"]);
  assert.equal(r.unaddressable_ids.length, r.unaddressable, "the drill's count is the meter's");
  for (const id of r.unaddressable_ids) assert.ok(!r.citing_ids.includes(id));
});

test("M8c: the registry paint agrees with the meter: a declaration paints declares, an instance names or names none", () => {
  const set = new Set(["thing", "parcel"]);
  const paint = (d) => registryPaintOf(d, set, ["doctrine", "code"]);
  assert.equal(paint({ id: "the-town/thing", kind: "mark", subkind: "class", class: "thing", declares: true }), "declares");
  for (const p of W1_PROPERTIES) assert.equal(paint(p), "declares", p.id);
  assert.equal(paint({ id: "kai/x", kind: "mark", subkind: "thing" }), "names");
  assert.equal(paint({ id: "kai/x", kind: "mark", subkind: "sited", class: "thing" }), "names");
  assert.equal(paint({ id: "kai/x", kind: "mark", subkind: "sited" }), "unaddressable");
  assert.equal(paint({ id: "LOGOS/classes.md", kind: "doctrine" }), "spine");
  assert.equal(paint({ id: "x", kind: "edge-type" }), "off");
  // the meter and the paint, node for node
  const nodes = [{ id: "the-town/thing", kind: "mark", subkind: "class", class: "thing", declares: true }, ...W1_PROPERTIES,
    { id: "kai/a", kind: "mark", subkind: "thing" }, { id: "kai/b", kind: "mark", subkind: "sited" }];
  const r = classRegistry(nodes);
  assert.deepEqual(nodes.filter((d) => paint(d) === "unaddressable").map((d) => d.id), r.unaddressable_ids);
});

test("M9: W1's real property rows carry no mapping debt: their fixed fields are lawful, and `of` is the edge", () => {
  for (const row of W1_PROPERTIES) {
    const r = serializationOf(row);
    assert.deepEqual(r.debt, [], `${row.id}: no key is the map's debt`);
    assert.deepEqual(r.residue, [], `${row.id}: its tier is its own fixed field, not residue`);
  }
  const child = serializationOf(W1_PROPERTIES[1]);
  assert.deepEqual(child.predicates.filter((p) => p.lawful).map((p) => p.key), ["tier", "name", "default"]);
  assert.ok(child.edges.some((e) => e.key === "of" && e.edge === "of"), "a child property's of: is the edge to its parent property");
  assert.equal(fieldCensus(W1_PROPERTIES).rows.unmapped, 0);
  assert.equal(lawMeasures(W1_PROPERTIES).find((x) => x.key === "debt").now, 0, "the law's debt measure stays where it was");
});

test("M9b: properties expressed as nodes counts W1's property nodes beside the predicate nodes, so W1 never reads it backwards", () => {
  const pred = { id: "kai/sign", kind: "mark", subkind: "predicated", keys: ["kind", "slot", "value"] };
  const row = (nodes) => lawMeasures(nodes).find((x) => x.key === "predicates");
  assert.equal(row([pred]).label, "properties expressed as nodes");
  assert.equal(row([pred]).now, 1);
  // a class-side predicate child converted by W1 stays counted: the measure does not move
  const before = row([pred, { id: "the-town/carry-cap", kind: "mark", subkind: "predicated", keys: ["kind", "slot", "value"] }]).now;
  const after = row([pred, W1_PROPERTIES[0]]).now;
  assert.equal(after, before);
});

test("M10: the predicate and naming class nodes are neither predicates nor continuations: a declaration is never an instance predicate", () => {
  // as world main's store payload carries them (kind: class, declares, class: predicate / naming)
  const node = (c) => ({ id: `the-town/${c}`, kind: "mark", subkind: "class", class: c, by: "the-town", tier: "constitution", declares: true });
  // and as their files spell them (kind: class + class:)
  const file = (c) => ({ id: `the-town/${c}`, kind: "class", class: c });
  for (const c of ["predicate", "naming"]) {
    for (const d of [node(c), file(c)]) assert.ok(!isPredicate(d), `${c} (${d.kind}): not a predicate`);
    assert.ok(!isContinuation(node(c)), `${c}: not painted as a continuation`);
  }
  assert.ok(isPredicate({ kind: "predicate" }) && isPredicate({ kind: "naming" }), "their instances still are");
});
