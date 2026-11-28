// join-move-in.mjs — the law behind /join/move-in/, the site's join act.
//
// THE SHAPE OF THE PAGE. The page holds no form. It asks the household apex
// what this reader's key may do, and renders the act the door names, from the
// FIELDS THE DOOR DECLARES, through the office's own schema-to-form generator
// (ops/mcp-prototype/mcp-proto.js, copied into
// public/atelier/postmark/join/move-in/ — see its provenance header). When the
// office grows a field, this page grows it the same day, because it never
// learned the field in the first place.
//
// This module is everything about that which is decidable without a DOM, so it
// can be held to it by `test/join-move-in.test.mjs`. The .astro page is the DOM
// wiring and nothing else.
//
// TWO READS, NOT ONE — measured on dev 2026-09-11, and the reason is in the
// door's own words. The bare apex answer (`household {}`) calls itself
// `abridged`: "one line per act with the NAMES of the fields it takes … Each
// act's FULL card (its quoted law, its dials, THE TYPE OF EVERY FIELD and what
// it means) is one read away, by the act's own name". The abridged entries
// carry `{ required: true }` and no `type`, and the generator renders an
// untyped property as a raw-JSON textarea — correct for an ops console, wrong
// for a human. So the page reads the act's own card (`household { read: <act> }`)
// and builds the form from THAT, where every field is `type: "string"` with the
// door's own description. The abridged entry stays the fallback: if the card
// read fails, the form still generates, just plainer.

// THE OFFICE'S OWN WORDS FOR A REFUSAL (POS-188). The three join refusals are
// copied into src/lib/ceremony-refusals.mjs with the office sha they came
// from, and that module's header is where the copy's papers live. Nothing
// below writes a refusal sentence of its own.
import { missingSentence } from "./ceremony-refusals.mjs";
import { houseName } from "./houses.mjs";

// ── which act belongs to this reader ────────────────────────────────────────
//
// THE PAGE'S ONE PIECE OF DOOR KNOWLEDGE, and it is deliberately this small:
// which of the three arrival acts each TIER walks through. Both halves are the
// office's own vocabulary — the tiers are what `householdStanding` answers
// (office src/household-apex.mjs), the act names are what the apex dispatches
// (its ACTS table) — and NOT ONE FIELD is named here or anywhere on the page.
//
// It cannot be derived from the answer instead. The abridged index lists all
// thirteen acts to every key: a declared house is shown `begin` and `declare`
// beside its own `add-resident` (measured on dev, a three-resident house).
// The index says what the DOOR does, not what this key should do next; `tier`
// is the field that says the second thing, so `tier` is what is read.
//
// The tiers deliberately absent each have a reason, and the page shows the
// door's own `next` lines for all of them rather than inventing a sentence:
//   anonymous       no key at the door — the page is behind a sign-in already
//   berth-declared  the declaration is parked; a human's click executes it
//   berth-cosigned  the co-sign landed; the door asks to be called again
export const ACT_FOR_TIER = Object.freeze({
  visitor: "declare",        // GitHub-verified, no house — founds one, nobody in the loop
  berth: "begin",            // aboard the ship — declares a residency their human co-signs
  harbor: "add-resident",    // a house whose residents all live at the harbor
  resident: "add-resident",  // a settled house — adds a resident to the house it keeps
});

/** The act this tier's reader is here to perform, or null when the door has none for them. */
export function actForTier(tier) {
  const key = typeof tier === "string" ? tier : "";
  return Object.prototype.hasOwnProperty.call(ACT_FOR_TIER, key) ? ACT_FOR_TIER[key] : null;
}

// ── the house a keeper already keeps (Keemin, 2026-09-27) ───────────────────
//
// "it seems to allow starforge 2? confused as to why I even get a field for
// household if I'm already registered." The add-resident form carries an
// OPTIONAL household box in the door's "household" group. The office finds the
// house BY ACCOUNT first (office src/residency.mjs § planRegistryJoin), so for
// a settled house a name typed there is silently dropped and the resident joins
// the account's own house: the box asks a question whose answer is thrown away.
// So a reader who keeps a house is not asked it. Their house is named on the
// review, fixed, and the send carries no household box at all.
//
// THE ONE HOUSE FOR WHICH THE ANSWER COUNTS: a PROVISIONAL house, whose key
// was borrowed from its first resident's handle. There, the first naming
// chooses the house's name, once (the same planRegistryJoin, THE HOUSE CHOOSES
// ITS KEY, POS-197). For that house alone the box stays, marked as choosing
// the name once. Whether a house is provisional is the town registry's word
// (`provisional: true` on its row), which the site syncs at build.
//
// Keyed on the GROUP the door declares (`x-group`), never on a field's name:
// whatever the office puts in its household group tomorrow, a keeper is not
// asked it. The founding acts (declare, begin) are untouched, because there
// the reader is naming the house they are about to found.

/** The `x-group` the door draws the house's own boxes in. */
export const HOUSE_GROUP = "household";

/** Does this act add to a house the reader already keeps? */
export function keepsHouse(act) {
  return act === ACT_FOR_TIER.resident;
}

const groupOf = (spec) => (spec && typeof spec["x-group"] === "string" ? spec["x-group"].trim() : "");

/** The names of the fields the door draws in its house group, in its order. */
export function houseGroupNames(fields) {
  if (!fields || typeof fields !== "object") return [];
  return Object.keys(fields).filter((n) => groupOf(fields[n]) === HOUSE_GROUP);
}

/**
 * The door's fields as this reader is asked them: the whole block for a
 * founder, and for a keeper the block without its house group, unless the
 * house they keep is provisional and still has its name to choose. The
 * generator is fed THIS, so a dropped box has no screen, no review row and no
 * place in the send; there is no second list to keep in step.
 * @param {object|null} fields  the door's `fields` block
 * @param {string|null} act
 * @param {{provisional?: boolean}|null} [house]  houseOfMe's answer
 */
export function fieldsForReader(fields, act, house = null) {
  if (!fields || typeof fields !== "object" || !keepsHouse(act)) return fields;
  if (house && house.provisional === true) return fields;
  const out = {};
  for (const [name, spec] of Object.entries(fields)) {
    if (groupOf(spec) !== HOUSE_GROUP) out[name] = spec;
  }
  return out;
}

/**
 * The house a signed-in reader keeps, from what GET /me already answers: the
 * per-handle block `households[handle]`, whose `slug` is the town's key for the
 * house. `houses` is the site's synced registry, slug → { name, provisional }:
 * it spells the house the way the site does and says whether its name is still
 * borrowed. A slug the site has not synced yet still prints, title-cased, and
 * is not treated as provisional. Null when /me names no house, and the page
 * then says "your house" rather than guessing one.
 * @param {object|null} me  GET /me
 * @param {Record<string, {name?: string, provisional?: boolean}>} [houses]
 * @returns {{slug: string, name: string, provisional: boolean}|null}
 */
export function houseOfMe(me, houses = {}) {
  if (!me || typeof me !== "object") return null;
  const handles = Array.isArray(me.handles) ? me.handles : Array.isArray(me.residents) ? me.residents : [];
  for (const h of handles) {
    const slug = me.households && me.households[h] && me.households[h].slug;
    if (typeof slug === "string" && slug) {
      const row = houses && houses[slug] && typeof houses[slug] === "object" ? houses[slug] : null;
      const named = row && typeof row.name === "string" && row.name.trim();
      return { slug, name: named || houseName(slug), provisional: !!(row && row.provisional === true) };
    }
  }
  return null;
}

// ── reading the door ─────────────────────────────────────────────────────────

/**
 * The door's own JSON out of an MCP call entry (the shape `MCPProto.callTool`
 * resolves). MCP carries a tool's answer as text content items; the office
 * sends JSON in the first one. Anything that is not JSON comes back as
 * `{ text }` so the page can still show the door's words.
 * @param {object|null} entry
 * @returns {object|null}
 */
export function doorPayload(entry) {
  const env = entry && entry.envelope;
  if (!env) return null;
  const result = env.result;
  if (result && Array.isArray(result.content)) {
    for (const item of result.content) {
      if (item && item.type === "text" && typeof item.text === "string") {
        try { return JSON.parse(item.text); } catch { return { text: item.text }; }
      }
    }
  }
  if (result && result.structuredContent && typeof result.structuredContent === "object") {
    return result.structuredContent;
  }
  if (env.error) return { error: true, defect: env.error.message ?? "the door refused", hint: "" };
  return null;
}

/**
 * The fields a form is generated from, and which read they came from. The
 * unabridged card wins; the abridged index entry is the fallback, and the page
 * says which it got.
 * @param {object|null} cardPayload  the answer to `household { read: <act> }`
 * @param {object|null} indexEntry   the act's entry in the bare answer (via collectActions)
 */
export function fieldsFor(cardPayload, indexEntry) {
  const card = cardPayload && typeof cardPayload === "object" ? cardPayload.card : null;
  if (card && card.fields && typeof card.fields === "object" && !Array.isArray(card.fields)) {
    return { fields: card.fields, source: "card" };
  }
  if (indexEntry && indexEntry.fields && typeof indexEntry.fields === "object" && !Array.isArray(indexEntry.fields)) {
    return { fields: indexEntry.fields, source: "index" };
  }
  return null;
}

/**
 * A NEW HOUSE'S FORM WITH NO SIGN-IN (CORE-188; Darko, 2026-11-26: a new house starts without signing in). The household door answers no card
 * without a key, but the office's public front door, `GET /join`, serves the declaration's schema as `join.schema`: the office's one
 * DECLARE_SCHEMA, "one schema object and a test asserts both surfaces serve it" (office src/declare.mjs), the same object declare's card is made
 * from. The card is that schema's properties with `required: true` on each name in its `required` list (office world-apex.mjs § actionFields,
 * with the human hints kept, as a card read keeps them). So the fields come from the office's own words, never a copy kept in the site.
 * @param {object|null} arrival  the answer to GET /join
 * @returns {{fields: object, source: "arrival"} | null}
 */
export function fieldsOfArrival(arrival) {
  const schema = arrival && typeof arrival === "object" && arrival.join && typeof arrival.join === "object" ? arrival.join.schema : null;
  const props = schema && typeof schema === "object" ? schema.properties : null;
  if (!props || typeof props !== "object" || Array.isArray(props) || !Object.keys(props).length) return null;
  const required = new Set(Array.isArray(schema.required) ? schema.required : []);
  const fields = {};
  for (const [name, spec] of Object.entries(props)) {
    if (!spec || typeof spec !== "object") continue;
    fields[name] = { ...spec, ...(required.has(name) ? { required: true } : {}) };
  }
  return { fields, source: "arrival" };
}

/** The door's own sentence about an act — never the page's. */
export function actSentence(cardPayload, indexEntry) {
  const card = cardPayload && typeof cardPayload === "object" ? cardPayload.card : null;
  for (const s of [card && card.blurb, card && card.teaches, indexEntry && indexEntry.teaches, indexEntry && indexEntry.blurb]) {
    if (typeof s === "string" && s.trim()) return s.trim();
  }
  return "";
}

/** The lines the door itself says come next, verbatim, or an empty list. */
export function doorNext(payload) {
  const next = payload && payload.next;
  if (Array.isArray(next)) return next.filter((l) => typeof l === "string" && l.trim());
  if (typeof next === "string" && next.trim()) return [next.trim()];
  return [];
}

/**
 * One line saying who the door answered as — read entirely out of the answer,
 * so a tier this page has never heard of still prints correctly.
 */
export function standingLine(payload) {
  if (!payload || typeof payload !== "object") return "";
  const bits = [];
  if (typeof payload.tier === "string" && payload.tier) bits.push(payload.tier);
  const house = payload.household ?? (payload.credential && payload.credential.household);
  if (typeof house === "string" && house) bits.push(`house ${house}`);
  const residents = Array.isArray(payload.residents) ? payload.residents : null;
  if (residents && residents.length) {
    bits.push(`${residents.length} ${residents.length === 1 ? "resident" : "residents"}: ${residents.join(", ")}`);
  }
  if (typeof payload.berth === "string" && payload.berth) bits.push(`berth ${payload.berth}`);
  return bits.join(" · ");
}

// ── required, as the DOOR declares it (POS-188) ─────────────────────────────
//
// WHAT KEEMIN ASKED FOR (2026-09-21/22): Resident Name and Household REQUIRED
// on the form, so an agent learns AT THE FORM what the office would otherwise
// refuse. The office's refusal is the backstop; the form's error is the
// manners.
//
// AND THE PAGE STILL NAMES NO FIELD. Requiredness is read from the door, the
// same way every other thing about these boxes is: the generator's own rule
// (mcp-proto.js § fieldsSchema) is that a field is required when its own
// spec says `required: true`, and `requiredNames` below is that one rule and
// nothing else. The SENTENCE for an empty box is matched to the box by the
// office refusal's own `field` (ceremony-refusals.mjs § WHEN_EMPTY), not by a
// name typed here.
//
// WHY THAT MATTERS AND IS NOT PEDANTRY. Measured at origin/train/2026-w40, the
// two acts this page renders do not declare the same fields required:
//
//   declare / begin  (src/declare.mjs § DECLARE_SCHEMA)
//                    required: household, handle, card
//   add-resident     (src/mcp.mjs § request_residency)
//                    required: handle, card — household is OPTIONAL, and the
//                    door says why in its own description: "If your key
//                    already belongs to a house, that house answers and this
//                    line is not needed."
//
// The join POS-158 is about — a visitor founding a house, a berth declaring
// one — is the declare/begin path, and there household IS required and the
// office DOES refuse. On add-resident it is not and the office does not. A
// form that blocked household on add-resident would be teaching a refusal that
// does not exist, which is the same defect POS-158 closed, pointed the other
// way. So the rule is the door's, and on the join it gives exactly what was
// asked for.
//
// NOTHING HERE TOUCHES THE COPIED GENERATOR. mcp-proto.js is the office's file
// and is never edited here (its PROVENANCE.md, and the sha256 test that holds
// it). The generator already MARKS a required field with its `.req` chip; what
// it does not do is carry the attribute or stop a send, because an ops console
// wants neither. Both are added from outside, on the nodes it built.

/**
 * The field names the door marks required — the generator's own rule, restated
 * rather than imported because the generator is a classic script the site
 * cannot import, and asserted equal to the generator's in test so the two
 * cannot drift.
 * @param {object|null} fields  the door's `fields` block
 * @returns {string[]}
 */
export function requiredNames(fields) {
  if (!fields || typeof fields !== "object") return [];
  return Object.keys(fields).filter((n) => fields[n] && fields[n].required === true);
}

// The walk below is deliberately the smallest thing that works in BOTH a real
// browser and the minimal document test/join-move-in.test.mjs builds for the
// generator — tagName, children, setAttribute, addEventListener, and nothing
// else. A querySelector here would pass in Chrome and be untestable.
const CONTROL_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);
const kidsOf = (n) => (n && n.children ? Array.from(n.children) : []);
function walkNodes(n, out = []) {
  if (!n) return out;
  out.push(n);
  for (const c of kidsOf(n)) walkNodes(c, out);
  return out;
}
const tagOf = (n) => String((n && n.tagName) || "").toUpperCase();
const hasCls = (n, c) => String((n && n.className) || "").split(/\s+/).includes(c);

/**
 * The control inside one generated field, whatever the generator made it — a
 * text input, a textarea after the `multiline` swap, or a select for an enum.
 * @param {object|null} fieldNode  a buildField handle's `node`
 * @returns {object|null}
 */
export function controlOf(fieldNode) {
  for (const n of walkNodes(fieldNode)) if (CONTROL_TAGS.has(tagOf(n))) return n;
  return null;
}

/** The generator's own `multiline` button on a field, or null. */
function growButtonOf(fieldNode) {
  for (const n of walkNodes(fieldNode)) if (tagOf(n) === "BUTTON" && hasCls(n, "grow")) return n;
  return null;
}

function armControl(fieldNode) {
  const c = controlOf(fieldNode);
  if (!c) return null;
  if (typeof c.setAttribute === "function") {
    c.setAttribute("required", "");
    c.setAttribute("aria-required", "true");
  }
  // A custom validity set at submit must not outlive the typing that fixes it,
  // or the box stays red while holding a good answer.
  if (typeof c.addEventListener === "function" && typeof c.setCustomValidity === "function") {
    c.addEventListener("input", () => { try { c.setCustomValidity(""); } catch { /* not every control has one */ } });
  }
  return c;
}

/**
 * Carry `required` and `aria-required` on every control the door declared
 * required, and KEEP carrying them: the generator's `multiline` button
 * REPLACES the control with a fresh node, which would silently drop both
 * attributes. Its own listener is registered first and so runs first; this one
 * re-arms whatever it swapped in.
 *
 * @param {{fields: object}} form  a buildForm handle
 * @param {string[]} required  from requiredNames(the door's fields)
 * @returns {string[]}  the names actually marked
 */
export function markRequired(form, required) {
  const marked = [];
  for (const name of Array.isArray(required) ? required : []) {
    const f = form && form.fields ? form.fields[name] : null;
    if (!f || !f.node) continue;
    if (!armControl(f.node)) continue;
    const grow = growButtonOf(f.node);
    if (grow && typeof grow.addEventListener === "function") grow.addEventListener("click", () => armControl(f.node));
    marked.push(name);
  }
  return marked;
}

/**
 * The required boxes that are EMPTY right now, each with the sentence a reader
 * gets — the office's own where the office has one.
 *
 * Emptiness is the generator's own answer (`read().present`), never a second
 * reading of the control's value: a field left untouched is exactly the field
 * the submit would not send, and those two must be the same question.
 *
 * A field the generator cannot PARSE is not missing — it is unreadable, and
 * submitAct already refuses on that with the generator's own words.
 *
 * @param {{fields: object}} form
 * @param {object|null} fields  the door's `fields` block
 * @returns {{name: string, defect: string, hint: string, refusal: object|null}[]}
 */
export function missingRequired(form, fields) {
  const out = [];
  for (const name of requiredNames(fields)) {
    const f = form && form.fields ? form.fields[name] : null;
    if (!f || typeof f.read !== "function") continue;
    let r = null;
    try { r = f.read(); } catch { r = null; }
    if (!r || r.error || r.present) continue;
    out.push({ name, ...missingSentence(name, fields[name]) });
  }
  return out;
}
// ── sending ──────────────────────────────────────────────────────────────────

/** The envelope an act rides in. The apex's own grammar: `{ do, args }`. */
export function callEnvelope(act, args) {
  return { do: act, args: args && typeof args === "object" ? args : {} };
}

/**
 * Submit — and the one place a send is refused, so there is one seam to hold.
 *
 * THREE REFUSALS, IN THIS ORDER:
 *
 *  1. a REQUIRED box left empty, when the caller passes the door's `fields`
 *     (POS-188). Nothing is sent and the reader gets the office's own sentence
 *     at the form rather than at the door. A caller that passes no `fields`
 *     keeps the old behaviour exactly — this is additive.
 *  2. a field the generator cannot PARSE — its own words, unchanged.
 *  3. everything else is the OFFICE's to refuse, and it still is: an optional
 *     box left empty is UNSENT (never sent as ""), and the door names its own
 *     missing fields far better than this page could.
 *
 * @param {object} o
 * @param {(name: string, args: object) => Promise<object>} o.callTool  MCPProto.callTool
 * @param {string} o.act
 * @param {{read: () => {args: object, errors: string[]}, fields: object}} o.form  a buildForm handle
 * @param {object|null} [o.fields]  the door's own `fields` block, for the required check
 */
export async function submitAct({ callTool, act, form, fields = null }) {
  const missing = fields ? missingRequired(form, fields) : [];
  if (missing.length) return { sent: false, missing, errors: [], envelope: null, entry: null };
  const got = form.read();
  if (got.errors && got.errors.length) return { sent: false, missing: [], errors: got.errors, envelope: null, entry: null };
  const envelope = callEnvelope(act, got.args);
  const entry = await callTool("household", envelope);
  return { sent: true, missing: [], errors: [], envelope, entry };
}

// ── reading the door's reply ─────────────────────────────────────────────────

const PROSE_KEYS = new Set(["note", "tell_your_human", "registry", "reading_law"]);
const isScalar = (v) => typeof v === "string" || typeof v === "number" || typeof v === "boolean";

/**
 * The door's reply, sorted into the pieces a page shows — by SHAPE, not by act.
 * Nothing here knows what `add-resident` returns; it knows that prose is prose,
 * a URL is a link, and `credential` is a secret the door says is shown once.
 */
export function replyShape(entry) {
  const payload = doorPayload(entry);
  const httpOk = Boolean(entry && entry.ok);
  const bounced = !httpOk
    || Boolean(payload && (payload.error || payload.defect))
    || Boolean(entry && entry.envelope && entry.envelope.result && entry.envelope.result.isError);

  const out = {
    ok: !bounced,
    defect: "", hint: "",
    prose: [], links: [], facts: [],
    credential: null, credentialNote: "",
    whole: payload,
  };

  if (!payload || typeof payload !== "object") {
    out.defect = bounced ? "the office did not answer in a shape this page can read" : "";
    out.hint = entry && entry.raw ? String(entry.raw).slice(0, 400) : "";
    return out;
  }

  if (bounced) {
    out.defect = typeof payload.defect === "string" && payload.defect ? payload.defect
      : `the office said no${entry && entry.status ? ` (HTTP ${entry.status})` : ""}`;
    out.hint = typeof payload.hint === "string" ? payload.hint : "";
    return out;
  }

  for (const [k, v] of Object.entries(payload)) {
    if (k === "credential" && typeof v === "string") { out.credential = v; continue; }
    if (k === "credential_note" && typeof v === "string") { out.credentialNote = v; continue; }
    if (typeof v === "string" && /^https?:\/\//.test(v)) { out.links.push({ label: k, href: v }); continue; }
    if (typeof v === "string" && (PROSE_KEYS.has(k) || k.endsWith("_note"))) { out.prose.push(v); continue; }
    if (isScalar(v)) { out.facts.push([k, String(v)]); continue; }
    // objects and arrays stay in `whole`, which the page offers unopened
  }
  return out;
}
