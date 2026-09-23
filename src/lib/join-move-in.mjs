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
