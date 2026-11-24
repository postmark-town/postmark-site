// world-cockpit-door.test.mjs — the seam that failed, and the class it belongs to.
//
//   node --test test/world-cockpit-door.test.mjs
//
// The cockpit's arithmetic has been under test since it was written, and all 34 of
// those assertions were green on 2026-08-26 while the bar they describe never once
// appeared on a page. Every one of them was handed a fixture answer. Nothing asked
// what happened between the door and the fixture, because that part lived in an
// IIFE inside a .astro <script> where there was no seam to hand a stub to.
//
// So this file tests the part that was untestable: the composition that fetches
// the apex, the gate that decides whether anything mounts, and the markup that
// comes out the far end. It is fed a STUBBED DOOR that behaves the way the live
// office behaved when this was measured on 2026-08-27 — 422 for a read that names
// no resident, the real answer for one that does.
//
// Every assertion carries the sentence of law or the measurement it is asserting,
// because a brief is lossy and a test that paraphrases its reason drifts from it
// in silence.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { apexUrl, bounceLine, bounceWords, orientingHandle, readDoor } from "../src/lib/world-cockpit-door.mjs";
import { HUMAN_ACTOR, actorsFor, cockpitShows, humanWords, portalOf, rosterOf } from "../src/lib/world-cockpit.mjs";
import { mountCockpit } from "../src/lib/world-cockpit-mount.mjs";

// ── the door, as it actually answered ───────────────────────────────────────

/**
 * The founder's key: MANY residents. Curl-verified against the live office
 * 2026-08-27 — this is the town's DEFAULT key shape, not an edge case, which is
 * why a handle-less call site is a defect rather than a rough edge.
 */
const MULTI_RESIDENT_ME = {
  household: "starforge",
  handles: ["wright-of-postmark", "jetto-of-starforge"],
  verified_github: { login: "keeminlee", id: 1 },
  key_kind: "oauth",
  principal: true,
};

/** The orient-stage refusal, in the shape the office bounces it — the wrapper is
 *  the point: `readBounce` reads flat `{defect, hint}` and would have gone quiet
 *  on this one. Curl-verified 2026-08-27. */
const WHICH_RESIDENT = {
  bounce: {
    defect: "which resident are you standing as?",
    choices: ["wright-of-postmark", "jetto-of-starforge"],
  },
};

/** The `actors` roster in the OFFICE's own field names — office `human-actor.mjs`
 *  `actorRoster` at commit 7f0b56e, 2026-08-27. `says` and `stance`; no `because`.
 *  The Human row is ALWAYS present, allowed or not, and carries `reason` when it
 *  is not: "An absent option teaches nothing" (that function's own comment). */
const ACTORS = [
  { kind: "resident", handle: "wright-of-postmark", label: "wright-of-postmark", allowed: true, reason: null, selected: true, says: "your resident, acting from their own standing" },
  { kind: "resident", handle: "jetto-of-starforge", label: "jetto-of-starforge", allowed: true, reason: null, selected: false, says: "your resident, acting from their own standing" },
  {
    kind: "human", id: "keeminlee", handle: "keeminlee", label: "keeminlee",
    allowed: true, reason: null, stance: "embodied-human",
    token_url: "/birthday/darko-token.png",
    grants: ["say", "walk", "strike"],
    says: "your household's human, on ground that grants them feet — they act here, and only here",
  },
];

const entry = (action, extra = {}) => ({
  action,
  blurb: `the ${action} class's own sentence`,
  blurb_from: `the-hall/${action}`,
  from: "the-hall/combatant",
  class: "combatant",
  fields: {},
  via: "ambient",
  grant: "here",
  ...extra,
});

/** Portal ground, signed in, with the roster the door now answers. */
const IN_PORTAL = {
  standpoint: {
    x: 120, y: -40, from: "where your walk arrived", stance: "embodied-human",
    portal: { id: "the-town/the-lanternstep-door", value: "the-town/the-lanternstep-hall", by: "the-town", space: "antechamber" },
  },
  within: [{ id: "the-town/the-lanternstep-hall", by: "the-town", tier: "constitution" }],
  actions: [entry("say"), entry("walk")],
  actors: ACTORS,
};

/**
 * A stubbed apex, answering the way the live one did.
 *
 * It refuses a read that names no resident and answers one that does — which is
 * the ONE behaviour the 08-26 code could not survive and the one nothing tested.
 * It records every URL it was asked for, so a test can assert what the site said
 * to the door rather than only what it did with the reply.
 */
function stubApex(answer = IN_PORTAL) {
  const asked = [];
  const doFetch = async (url) => {
    asked.push(String(url));
    const handle = new URL(String(url), "https://x.invalid").searchParams.get("handle");
    if (!handle) {
      return { ok: false, status: 422, json: async () => WHICH_RESIDENT };
    }
    return { ok: true, status: 200, json: async () => answer };
  };
  return { fetch: doFetch, asked };
}

// ── a document, small enough to hold in the head ────────────────────────────
//
// This repo carries no DOM library and one is not worth a dependency for this:
// what has to be proven is that the mount RUNS to completion off a live-shaped
// answer and composes a roster with the human's face in it. So this shim records
// every innerHTML it is given and hands back inert stubs for every query.
//
// WHICH MEANS THE RECEIPT IS THE MARKUP, NOT A QUERY. `querySelector` here would
// answer whatever was asked of it — this page has been caught once already
// "asking a hidden element and getting the answer it wanted" (site 0228e979b), and
// a stub that always answers yes is the same defect with fewer steps. So the
// assertions below read the string the mount actually composed.

function tinyDom() {
  const el = (tag) => {
    const attrs = new Map();
    const node = {
      tagName: String(tag ?? "").toUpperCase(),
      children: [],
      style: {},
      classList: { toggle() {}, add() {}, remove() {}, contains: () => false },
      hidden: false,
      value: "",
      textContent: "",
      _html: "",
      get innerHTML() { return node._html; },
      set innerHTML(v) { node._html = String(v); },
      set className(v) { attrs.set("class", String(v)); },
      get className() { return attrs.get("class") ?? ""; },
      setAttribute: (k, v) => attrs.set(k, String(v)),
      getAttribute: (k) => (attrs.has(k) ? attrs.get(k) : null),
      appendChild: (c) => { node.children.push(c); return c; },
      removeChild: (c) => { node.children = node.children.filter((x) => x !== c); },
      remove() {},
      contains: () => false,
      closest: () => null,
      focus() {},
      scrollIntoView() {},
      addEventListener() {}, removeEventListener() {},
      querySelector: () => el("div"),
      querySelectorAll: () => [],
      getBoundingClientRect: () => ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }),
      getClientRects: () => [],
    };
    return node;
  };
  const body = el("body");
  const doc = {
    body,
    head: el("head"),
    activeElement: null,
    createElement: el,
    createElementNS: (_ns, tag) => el(tag),
    // The viewer's bottom-edge furniture is genuinely absent here, and null is
    // what `placeBar` is written to expect from an absent one.
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {}, removeEventListener() {},
    defaultView: {
      innerWidth: 1280, innerHeight: 800,
      setTimeout: () => 0,
      addEventListener() {}, removeEventListener() {},
    },
  };
  return doc;
}

/** The markup the cockpit's own root was last painted with. */
function paintedRoster(doc) {
  const root = doc.body.children.find((c) => c.getAttribute("data-pmc") === "");
  return root ? root.innerHTML : null;
}

// ── Gate A: the read that named nobody ──────────────────────────────────────

test("the boot read names a resident, and a multi-resident key mounts the bar", async () => {
  // THE SEAM THAT FAILED, end to end. On 2026-08-26 the island read the apex with
  // no handle, the door refused with 422 `which resident are you standing as?`,
  // the island turned that into null, and null read as "not in a portal" — so the
  // cockpit built that day never mounted and never said why.
  //
  // Run the site's own composition against a door that behaves that way.
  const { fetch: doFetch, asked } = stubApex();
  const handle = orientingHandle(MULTI_RESIDENT_ME);
  assert.equal(handle, "wright-of-postmark", "the key's first resident is the one the bar is drawn for");

  const answer = await readDoor({ fetch: doFetch, office: "https://postmark.town/api", handle, headers: {}, warn: () => {} });
  assert.ok(answer, "the door answers a read that names a resident");
  assert.match(asked[0], /\?handle=wright-of-postmark$/, "…because the read named one, in the query");

  // ⚑ SUPERSEDED IN PLACE (founder, 2026-08-30, the post-party debrief): this
  // asserted "portal ground with a roster: the bar shows". The cockpit is
  // COMBAT CHROME now — it mounts only where the door's encounter block says a
  // fight is live, and everywhere else the viewer's own rail serves. The old
  // assertion's ground (a portal, a roster, no fight) is exactly where the
  // takeover lived, so it now asserts the stand-down.
  assert.equal(cockpitShows(answer), false,
    "portal ground with a roster but NO live fight: the cockpit stands down and the viewer's rail serves");

  const fighting = { ...answer, encounter: { id: "x/arena", round: 1, turn: null, order: [{ id: "the-cake", kind: "creature", label: "the cake" }] } };
  assert.equal(cockpitShows(fighting), true, "…and a live encounter is the one signal that mounts it");

  const doc = tinyDom();
  const mounted = mountCockpit({
    document: doc, host: doc.body, svg: null, answer: fighting, me: MULTI_RESIDENT_ME, grid: null,
    dispatch: async () => ({ ok: true, status: 200, body: {} }),
    readTerms: async () => null,
    refresh: null,
  });
  assert.ok(mounted, "mountCockpit returns a handle — the bar is on the page");

  const html = paintedRoster(doc);
  assert.ok(html, "the cockpit's root was painted");
  // The human's own face, by the sentinel the bar carries for it.
  assert.ok(html.includes(`data-actor="${HUMAN_ACTOR}"`), "the roster carries the human's face");
  assert.ok(html.includes('data-actor="wright-of-postmark"'), "…beside the key's residents");
  mounted.destroy();
});

test("a read that names no resident is refused, and says so out loud", async () => {
  // The other half of the same fix, and the half that made it cost a night: a 422
  // and an honest "you are not in a portal" were the same value by the time the
  // island saw them. Nothing was thrown and nothing was logged.
  const { fetch: doFetch } = stubApex();
  const said = [];
  const answer = await readDoor({
    fetch: doFetch, office: "https://postmark.town/api", handle: null, headers: {},
    warn: (line) => said.push(line),
  });
  assert.equal(answer, null, "a bounce is not an answer");
  assert.equal(said.length, 1, "and it is not swallowed");
  assert.match(said[0], /422/);
  assert.match(said[0], /which resident are you standing as\?/, "the door's own defect, verbatim");
  assert.match(said[0], /wright-of-postmark/, "…and the choices it named, which are the fix");
});

test("the wrapped bounce is read, because the flat reader goes quiet on it", () => {
  // `readBounce` in world-cockpit.mjs reads `{defect, hint}` — the act-stage shape.
  // The orient-stage refusal wraps itself in `bounce`, so the flat reader sees no
  // defect at all and reports "the door did not say what went wrong" about a door
  // that said exactly what went wrong.
  assert.equal(bounceWords(WHICH_RESIDENT).defect, "which resident are you standing as?");
  assert.deepEqual(bounceWords(WHICH_RESIDENT).choices, ["wright-of-postmark", "jetto-of-starforge"]);
  // and the flat shape still reads, because the act half bounces that way
  assert.equal(bounceWords({ defect: "no", hint: "try this" }).defect, "no");
  assert.equal(bounceWords({ defect: "no", hint: "try this" }).hint, "try this");
  assert.match(bounceLine("the standpoint read", 422, WHICH_RESIDENT), /bounced 422 — which resident/);
});

test("the handle goes in the query, escaped, and a null one is a decision made out loud", () => {
  assert.equal(apexUrl("https://postmark.town/api", "wright-of-postmark"),
    "https://postmark.town/api/world/apex?handle=wright-of-postmark");
  assert.equal(apexUrl("https://postmark.town/api", null), "https://postmark.town/api/world/apex");
  assert.equal(apexUrl("/api", "a b"), "/api/world/apex?handle=a%20b");
});

// ── Gate B: the scope ruling of 2026-08-27 ──────────────────────────────────

/** A parcel. No portal anywhere in the answer — the door sent a roster instead,
 *  which under the superseded ruling was not enough to put a bar on the page. */
const ON_A_PARCEL = {
  standpoint: { x: -95120, y: -95120, from: "where your walk arrived", stance: "embodied" },
  within: [
    { id: "the-town/let-there-be-light", by: "the-town", tier: "constitution" },
    { id: "wright-of-postmark/the-pando-peak-parcel", by: "wright-of-postmark", kind: "parcel" },
  ],
  actions: [entry("say"), entry("leave-mark")],
  actors: ACTORS,
};

test("a parcel with a roster and no portal mounts the bar", async () => {
  // FOUNDER-RULED 2026-08-27: the bar mounts wherever the actors roster is
  // present, parcels included. It SUPERSEDES the ruling of 2026-08-26 — "the
  // cockpit ships inside portal ground; the world page outside portals keeps
  // today's chrome untouched" — under which this exact answer put nothing on the
  // page at all.
  // ⚑ SUPERSEDED A SECOND TIME (founder, 2026-08-30, post-party): the cockpit
  // is combat chrome — it mounts only where a fight is live, whatever ground or
  // roster stands. The ruling chain, all three states: 08-26 portal-only →
  // 08-27 roster-wide (the takeover) → 08-30 encounter-only (the stand-down).
  assert.equal(portalOf(ON_A_PARCEL), null, "no portal, as before");
  assert.ok(rosterOf(ON_A_PARCEL), "…and a roster, which the superseded gate asked for");
  assert.equal(cockpitShows(ON_A_PARCEL), false,
    "a parcel with a roster and NO fight: the viewer's rail serves, not the dock");
  assert.equal(cockpitShows({ ...ON_A_PARCEL, encounter: { order: [{ id: "x", kind: "creature" }] } }), true,
    "…and the same parcel mid-fight mounts it");

  const doc = tinyDom();
  const mounted = mountCockpit({
    document: doc, host: doc.body, svg: null,
    answer: { ...ON_A_PARCEL, encounter: { order: [{ id: "x", kind: "creature" }] } },
    me: MULTI_RESIDENT_ME, grid: null,
    dispatch: async () => ({ ok: true, status: 200, body: {} }),
    readTerms: async () => null, refresh: null,
  });
  assert.ok(mounted, "the bar is on the page on a parcel");
  const html = paintedRoster(doc);
  assert.ok(html.includes(`data-actor="${HUMAN_ACTOR}"`), "with the human's face in the roster");
  mounted.destroy();
});

test("an empty roster is the door saying nobody can act here, and is not a bar", () => {
  // The office's Human row is ALWAYS present where there is a roster at all, so an
  // empty array is not "a roster with nothing in it yet" — it is the absence of
  // one, and widening the gate to `Array.isArray` would have put an empty bar on
  // ground the door said held nobody.
  assert.equal(rosterOf({ actors: [] }), null);
  assert.equal(cockpitShows({ actors: [] }), false);
  assert.equal(cockpitShows({}), false, "and with neither, the island still appends nothing");
});

test("the bridge's parcel arm reads a parcel — and is not reachable from the bar", () => {
  // TWO CLAIMS, and the second is the one worth writing down. `actorsFor`'s parcel
  // arm computes correctly, so a door that has not grown `actors` still seats a
  // human on their household's own ground:
  const noRoster = { ...ON_A_PARCEL, actors: undefined };
  const faces = actorsFor(noRoster, MULTI_RESIDENT_ME);
  const human = faces.find((f) => f.kind === "human");
  assert.equal(human.allowed, true);
  assert.match(human.because, /the-pando-peak-parcel/, "and it names the ground that allowed it");

  // …but nothing in a running page walks it. Reaching it needs the bar mounted
  // with BOTH the roster and the portal absent, and the gate mounts on exactly
  // those two being present. Asserted so the green above is not read as proof of
  // a live path — this arm was dead code under the 08-26 ruling and it is dead
  // code under the 08-27 one, for a different reason: the door answers `actors`
  // now (office 7f0b56e).
  assert.equal(cockpitShows(noRoster), false, "the gate cannot mount the answer the bridge needs");
});

// ── the human row's own sentence ────────────────────────────────────────────

test("the door's sentence for the human is the one on the face", () => {
  // FIELD DRIFT. The site's contract named `because`; the office's roster emits
  // `says` and `stance` and no `because` (office human-actor.mjs `actorRoster`,
  // 7f0b56e, 2026-08-27). So the sentence disappeared at the moment the contract
  // was FULFILLED — the bridge that wrote `because` stopped being walked, and the
  // face fell through to the site's own stand-in.
  const doc = tinyDom();
  const mounted = mountCockpit({
    // encounter added 2026-08-30: the cockpit mounts only mid-fight now; this
    // test's subject is the FACE SENTENCE, which is unchanged.
    document: doc, host: doc.body, svg: null,
    answer: { ...IN_PORTAL, encounter: { order: [{ id: "x", kind: "creature" }] } },
    me: MULTI_RESIDENT_ME, grid: null,
    dispatch: async () => ({ ok: true, status: 200, body: {} }),
    readTerms: async () => null, refresh: null,
  });
  const html = paintedRoster(doc);
  assert.ok(html.includes("on ground that grants them feet"),
    "the office's own words for an embodied human are on the face");
  assert.ok(!html.includes("where ground allows"),
    "…and the site's stand-in is nowhere near it");
  mounted.destroy();
});

test("humanWords reads both spellings, and quotes a stance rather than dressing it up", () => {
  // Read in BOTH directions on purpose: the office half may be trued toward this
  // site's spelling separately, and whichever name it settles on must win.
  assert.equal(humanWords({ says: "the office's sentence" }), "the office's sentence");
  assert.equal(humanWords({ because: "the site's sentence" }), "the site's sentence");
  assert.equal(humanWords({ because: "the site's sentence", says: "the office's" }), "the site's sentence",
    "`because` first, so the bridge still reads while it exists");
  // A word is not a sentence. Quoted, never paraphrased into prose the door did
  // not write — this surface must never put its own words where law goes.
  assert.equal(humanWords({ stance: "embodied-human" }), 'the door calls this standing "embodied-human"');
  assert.equal(humanWords({}), "where ground allows", "and with nothing at all, the honest stand-in");
  assert.equal(humanWords({ says: "   " }), "where ground allows", "whitespace is not a sentence");
});

test("a key with no residents resolves to no handle rather than to a guess", () => {
  // A machine key holds residents and no human; a bad read of /me holds nothing.
  // Both deserve the door's own bounce over a name the site invented.
  assert.equal(orientingHandle(null), null);
  assert.equal(orientingHandle({ handles: [] }), null);
  assert.equal(orientingHandle({ handles: [null, "x"] }), "x");
});

// ═══════════════════════════════════════════════════════════════════════════
// THE CLASS
//
// Three defects were found in the cockpit on 2026-08-27 and they were one defect
// wearing three coats: a call to the apex that named no resident. The boot read
// (the bar never mounted), the act envelope (every human act refused at orient),
// and — the near miss — the tooltip's shadow-read, which happened to name one
// because it was written second and by somebody who had already hit the bounce.
//
// A KEY IN THIS TOWN HOLDS MANY RESIDENTS. The founder's does. That is the DEFAULT
// shape, so a call site that names nobody is a defect rather than a rough edge,
// and no amount of care per-site prevents the next one. This is the guard for the
// class: it enumerates the call sites out of the SOURCE and asks each the same
// question. It is deliberately crude — regex over text, no parser — because
// catching the class is the point and a crude guard that fires is worth more than
// a precise one nobody writes.
//
// It would have caught all three on 08-26.
// ═══════════════════════════════════════════════════════════════════════════

const SRC = fileURLToPath(new URL("../src", import.meta.url));

function sourceFiles(dir = SRC, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) sourceFiles(p, out);
    else if (/\.(mjs|js|ts|astro)$/.test(e.name)) out.push(p);
  }
  return out;
}

/** Prose out, code left. Crude on purpose: block comments, and any line whose
 *  first non-space is `//` or `*`. This repo keeps its reasoning in exactly those
 *  two shapes. A trailing comment that slipped through would make the guard FIRE
 *  rather than go quiet, which is the safe direction for it to be wrong in. */
function codeOnly(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((l) => (/^\s*(\/\/|\*)/.test(l) ? "" : l))
    .join("\n");
}

/** The text of a call, from its `(` to the paren that closes it. */
function callFrom(src, open) {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "(") depth++;
    else if (src[i] === ")" && !--depth) return src.slice(open, i + 1);
  }
  return src.slice(open);
}

const lineOf = (src, idx) => src.slice(0, idx).split("\n").length;

/**
 * Every call to something fetch-shaped that reaches the apex, with the fifteen
 * lines above it — because the resident may be named on the envelope a line
 * earlier rather than inside the call's own parentheses, which is how the act
 * site legitimately names one.
 *
 * DECLARATIONS ARE STRIPPED OUT OF THAT WINDOW, and finding out why is the reason
 * this note exists. The first draft of this guard passed the flip: the boot read
 * was put back to its 08-26 shape and the guard stayed green, because fifteen
 * lines above the fetch sat `function readDoor({ fetch, office, handle, … })` and
 * the word `handle` was right there in the parameter list. The guard was reading
 * a NAME, not a value handed to the door — green for the wrong reason on the exact
 * site it was written for. A line that declares rather than passes is blanked now.
 */
function apexCallSites() {
  const sites = [];
  for (const file of sourceFiles()) {
    const code = codeOnly(readFileSync(file, "utf8"));
    for (const m of code.matchAll(/\bfetch\w*\(/g)) {
      const call = callFrom(code, m.index + m[0].length - 1);
      if (!/apexUrl|APEX_PATH|\/world\/apex/.test(call)) continue;
      const before = code.slice(0, m.index).split("\n").slice(-15)
        .map((l) => (/\bfunction\b|=>/.test(l) ? "" : l))
        .join("\n");
      sites.push({ file: relative(SRC, file), line: lineOf(code, m.index), text: before + call });
    }
  }
  return sites;
}

test("THE CLASS: every call that reaches the apex names a resident", () => {
  const sites = apexCallSites();
  // The guard must be able to find anything at all. A regex that quietly matched
  // nothing would be a green test asserting there are no defects in an empty set,
  // which is how this whole night's 34 green assertions came to describe a bar
  // that did not exist.
  assert.ok(sites.length >= 3, `expected the read, the shadow-read and the act; found ${sites.length}`);
  for (const s of sites) {
    assert.match(s.text, /\bhandle\b/,
      `${s.file}:${s.line} reaches the apex naming no resident — on a multi-resident key the door refuses it, and this town's keys are multi-resident by default`);
  }
});

test("THE CLASS: the read's URL is built with a resident, not with a null", () => {
  // The sharp end of the same question, and the one the window cannot fudge:
  // `apexUrl` takes the resident as its SECOND ARGUMENT, so a read that names
  // nobody is visible as a literal in the source. This is what actually caught the
  // 08-26 boot read when the window-based check above went green on its own
  // parameter list.
  const bad = [];
  let calls = 0;
  for (const file of sourceFiles()) {
    const code = codeOnly(readFileSync(file, "utf8"));
    for (const m of code.matchAll(/\bapexUrl\(/g)) {
      // the definition is not a call site
      if (/function\s+$/.test(code.slice(Math.max(0, m.index - 20), m.index))) continue;
      calls++;
      const args = callFrom(code, m.index + m[0].length - 1);
      const second = /,\s*([A-Za-z_$][\w$]*)\s*\)$/.exec(args)?.[1] ?? null;
      // `null` is identifier-SHAPED and slipped through the first draft of this
      // check, which is the whole defect written as a literal. Naming nothing is
      // the thing being guarded against; it does not get to look like a name.
      if (!second || second === "null" || second === "undefined") {
        bad.push(`${relative(SRC, file)}:${lineOf(code, m.index)} — ${args}`);
      }
    }
  }
  assert.ok(calls >= 1, "the guard found no apexUrl call site at all");
  assert.deepEqual(bad, [], "a read of the apex is composed with a named resident, never with a null or nothing");
});

test("THE CLASS: every act's envelope carries the standing it is oriented from", () => {
  const sites = [];
  for (const file of sourceFiles()) {
    const code = codeOnly(readFileSync(file, "utf8"));
    for (const m of code.matchAll(/\bdispatchEnvelope\(/g)) {
      // the definition is not a call site
      if (/function\s+$/.test(code.slice(Math.max(0, m.index - 20), m.index))) continue;
      sites.push({ file: relative(SRC, file), line: lineOf(code, m.index), text: callFrom(code, m.index + m[0].length - 1) });
    }
  }
  assert.ok(sites.length >= 1, "the guard found no dispatchEnvelope call site at all");
  for (const s of sites) {
    assert.match(s.text, /\bhandle\b/,
      `${s.file}:${s.line} builds an act naming no standing — a human's act then bounces at orient, before the human seam runs`);
  }
});

test("THE CLASS: one place spells the apex's path", () => {
  // A second speller is a second place the resident can go missing, which is
  // exactly how 08-26 ended with three calls to one door that disagreed about it.
  const spellers = sourceFiles()
    .filter((f) => /["'`][^"'`]*\/world\/apex/.test(codeOnly(readFileSync(f, "utf8"))))
    .map((f) => relative(SRC, f).split(sep).join("/"));
  assert.deepEqual(spellers, ["lib/world-cockpit-door.mjs"],
    "every other reader of this door must take the path from APEX_PATH");
});

test("the cockpit accepts the page's own sign-in word", () => {
  // Found at the 2026-08-28 dress rehearsal: the viewer signs a reader in as a
  // bare Bearer in localStorage['pm_key'] (WorldSignIn: "before the viewer
  // boots, so the lens is live on load"); the cockpit's bearer() read only the
  // OAuth token shape, so for every pm_key reader it degraded to nothing —
  // silently, on the very standpoints it was built for. One page must not hold
  // two opinions about whether its reader is signed in.
  const astro = readFileSync(new URL("../src/components/WorldCockpit.astro", import.meta.url), "utf8");
  assert.match(astro, /localStorage\.getItem\("pm_key"\)/,
    "bearer() falls back to the viewer's pm_key — the page's other sign-in");
});

// ── CORE-159: a hidden tab asks the conversations door nothing ──────────────
//
// LAW (CORE-159, Darko 2026-11-24 10:14 EST, ruling Wright's option 1): the page "stops asking the office for updates while its
// browser tab is hidden, and resumes (with one immediate refresh) when it's visible again. The 7-second pace while visible
// stays exactly as it is." The Conversations page has paused in a hidden tab since it shipped (site #18; CORE-158 kept it,
// test/conversations-poll.test.mjs "HIDDEN TAB"). The world page's cockpit polls the SAME door (GET /world/conversations) for
// its speech, and before CORE-159 it did so on a bare 7 s setInterval whatever the tab's visibility.
//
// This runs the REAL mount with a document whose visibility the test sets, a clock whose interval fires only when the test
// advances it, and a readVoices that counts. Each count is the number of asks of the conversations door.

/** tinyDom, plus the three things the hidden-tab pause reads: visibilityState, a visibilitychange listener, and a 7 s interval. */
function visibilityDom(state = "visible") {
  const doc = tinyDom();
  const clock = { t: 0, next: 1, intervals: [] };
  const listeners = new Map();
  doc.visibilityState = state;
  doc.addEventListener = (type, fn) => { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn); };
  doc.removeEventListener = (type, fn) => { listeners.get(type)?.delete(fn); };
  doc.defaultView.setInterval = (fn, ms) => { const id = clock.next++; clock.intervals.push({ id, fn, ms, due: clock.t + ms }); return id; };
  doc.defaultView.clearInterval = (id) => { clock.intervals = clock.intervals.filter((x) => x.id !== id); };
  const advance = (ms) => {
    const end = clock.t + ms;
    for (;;) {
      const due = clock.intervals.filter((x) => x.due <= end).sort((a, b) => a.due - b.due)[0];
      if (!due) break;
      clock.t = due.due; due.due += due.ms; due.fn();
    }
    clock.t = end;
  };
  const show = (s) => { doc.visibilityState = s; for (const fn of [...(listeners.get("visibilitychange") ?? [])]) fn(); };
  return { doc, clock, advance, show, listeners };
}

function mountCounting(doc) {
  const asks = { n: 0 };
  const mounted = mountCockpit({
    document: doc, host: doc.body, svg: null,
    answer: { ...IN_PORTAL, encounter: { order: [{ id: "x", kind: "creature" }] } },
    me: MULTI_RESIDENT_ME, grid: null,
    dispatch: async () => ({ ok: true, status: 200, body: {} }),
    readTerms: async () => null, refresh: null,
    readVoices: async () => { asks.n++; return null; },
  });
  assert.ok(mounted, "the cockpit mounted (a live fight), so its voices poll is the one under test");
  return { mounted, asks };
}

test("CORE-159: the cockpit's voices poll asks nothing while the tab is hidden, asks ONCE at once when it is shown, then every 7 s", () => {
  const v = visibilityDom("visible");
  const { mounted, asks } = mountCounting(v.doc);

  // visible: one ask at mount, then the unchanged 7 s pace
  assert.equal(asks.n, 1, "a visible tab asks at mount");
  v.advance(6999); assert.equal(asks.n, 1, "6999 ms: no second ask");
  v.advance(1); assert.equal(asks.n, 2, "7000 ms: the next ask; the pace is 7 s, unchanged");

  // hidden: nothing, however long
  v.show("hidden");
  v.advance(10 * 60_000);
  assert.equal(asks.n, 2, "ten minutes hidden: NO ask of the conversations door");
  assert.equal(v.clock.intervals.length, 0, "and no interval is left running for a hidden tab");

  // visible again: one ask at once, then the pace from there
  v.show("visible");
  assert.equal(asks.n, 3, "shown again: ONE ask at once");
  v.advance(6999); assert.equal(asks.n, 3, "then nothing until the pace is up");
  v.advance(1); assert.equal(asks.n, 4, "then every 7 s, as before");

  // a second 'visible' event while already polling is not a second poll
  v.show("visible");
  assert.equal(asks.n, 4, "a repeated visible event asks nothing extra");
  v.advance(7000); assert.equal(asks.n, 5, "and the pace is not doubled: one ask per 7 s");
  assert.equal(v.clock.intervals.length, 1, "exactly one interval while visible");

  // destroy stops the poll and lets go of the listener
  mounted.destroy();
  v.advance(60_000); v.show("hidden"); v.show("visible");
  assert.equal(asks.n, 5, "after destroy: no ask, from the clock or from the tab coming back");
  assert.equal(v.listeners.get("visibilitychange")?.size ?? 0, 0, "the visibility listener is removed");
});

test("CORE-159: a cockpit mounted in a hidden tab asks nothing until the tab is shown", () => {
  const v = visibilityDom("hidden");
  const { mounted, asks } = mountCounting(v.doc);
  v.advance(60_000);
  assert.equal(asks.n, 0, "mounted hidden: no ask at mount and none on the clock");
  v.show("visible");
  assert.equal(asks.n, 1, "shown: one ask at once");
  v.advance(7000); assert.equal(asks.n, 2, "then the 7 s pace");
  mounted.destroy();
});
