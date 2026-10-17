// mark-class.mjs — what class a mark is, read from either form the record
// carries during LOGOS v2's kind migration (S1, 2026-10-17).
//
// THE TWO FORMS. Until 2026-10-16 a record's `kind` said how a mark stood
// (`sited`, `parcel`, `predicated`, `naming`) and a `class:` field named the
// class (`kind: sited` + `class: thing`). LOGOS v2 folds `class:` into `kind`:
// "`kind` is a flat field naming the node's own class … `kind: candy` names
// `the-town/candy`" (classes.md § The LOGOS ladder, ruled 15:43/16:02). The
// world's kind migration (W2) rewrites every file mark, and lands only after the
// readers can read both, so every reader here answers both, and the site's
// pages never ask a mark's kind or class directly (SITTING 16:02 item 8: "The
// site adapts through a helper").
//
//   old form                          new form            classOf
//   kind: sited + class: thing        kind: thing         thing
//   kind: sited (no class)            kind: sited         sited
//   kind: parcel                      kind: parcel        parcel
//   kind: predicated (slot, value)    kind: predicate     predicate
//   kind: naming                      kind: naming        naming (a predicate)
//   kind: class (a class node)        kind: class         class
//
// TWO ROW SHAPES. A world-state mark carries the record's own `kind`. A graph
// node (the store's payload, the ops lens) is `kind: "mark"` with the record's
// kind in `subkind`. `recordKind` reads either, so no caller has to know which
// payload it was handed.
//
// "IS A" CLIMBS ONLY WHEN TOLD HOW. A subclass is a class (naming under
// predicate; candy under consumable under thing). The site does not carry the
// class tree everywhere, so `isA` answers exact names on its own and climbs
// when the caller passes `extendsOf` (a name → its parent's name). The two
// subclass facts every reader needs are fixed by law and named here: a naming
// is a predicate (16:02 item 8), and `predicated` is the old spelling of
// `predicate`.

/** The record's own `kind`, from a world-state mark or a graph node. */
export function recordKind(m) {
  if (!m || typeof m !== "object") return null;
  const k = m.kind == null ? null : String(m.kind);
  // A graph node: the node kind is "mark" and the record's kind is its subkind.
  if (k === "mark" && Object.hasOwn(m, "subkind")) return m.subkind == null ? null : String(m.subkind);
  return k;
}

// The old vocabulary's one spelling that is not its class's name.
const OLD_KIND = Object.freeze({ predicated: "predicate" });

/**
 * The class a mark names: its `class:` field (the old form's second line),
 * else its kind (the new form, and the old form's standings), spelled as the
 * class is named. Null when it names neither.
 */
export function classOf(m) {
  if (!m || typeof m !== "object") return null;
  const named = m.class == null ? "" : String(m.class).trim();
  if (named) return named;
  const k = recordKind(m);
  if (!k) return null;
  return OLD_KIND[k] ?? k;
}

// The law's own subclass facts, for a caller with no class tree in hand.
const KNOWN_PARENT = Object.freeze({ naming: "predicate" });

/** The record kind spelled as the class it names (`predicated` → `predicate`), or null. */
export function kindClassOf(m) {
  const k = recordKind(m);
  return k ? (OLD_KIND[k] ?? k) : null;
}

/**
 * Is `m` of class `cls`? Exact on its own; up the chain with `extendsOf`
 * (a class name → its parent's name, or null). Stops at a loop.
 *
 * EITHER CHAIN ANSWERS. A record of the old form may carry both fields with
 * two different answers: today's record holds three `kind: predicated` +
 * `class: idea` marks (review-600 on site #275), which are predicates by their
 * kind and ideas by their class. So the class field's chain and the record
 * kind's chain are each asked, and either one is enough.
 */
export function isA(m, cls, { extendsOf = null } = {}) {
  const want = String(cls);
  const climbs = (start) => {
    let c = start;
    const seen = new Set();
    while (c && !seen.has(c)) {
      if (c === want) return true;
      seen.add(c);
      c = (extendsOf ? extendsOf(c) : null) ?? KNOWN_PARENT[c] ?? null;
    }
    return false;
  };
  const named = m?.class == null ? "" : String(m.class).trim();
  return (named !== "" && climbs(named)) || climbs(kindClassOf(m));
}

/**
 * A predicate: `kind: predicated` (old), `kind: predicate` (new), or a naming.
 * A declaration is never an instance predicate: the class nodes the-town/predicate
 * and the-town/naming name the class without being one (the rule isInstanceOf keeps).
 */
export const isPredicate = (m, opts) => !isClassNode(m) && isA(m, "predicate", opts);

/** A declaration, not an instance: a class node or a property node (`kind: class` / `kind: property`), or the store's `declares`. */
export const isClassNode = (m) => !!m && (m.declares === true || ["class", "property"].includes(recordKind(m)));

/** An instance of `cls`, never the class node that declares it. */
export const isInstanceOf = (m, cls, opts) => !isClassNode(m) && isA(m, cls, opts);
