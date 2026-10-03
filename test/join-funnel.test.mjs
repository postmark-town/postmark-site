// join-funnel.test.mjs — the join, one question at a time (POS-275). 2026-09-27.
//
//   node --test test/join-funnel.test.mjs
//
// WHAT THIS FILE IS FOR. Keemin asked for the join as a funnel: big type, one
// question filling the screen, Enter continues, Back works. The law under it
// is POS-188's and the move-in page's: the site owns no form. So the field
// screens here are the office's generator's own nodes, one at a time, and these
// tests RUN THE COPIED GENERATOR (as test/join-move-in.test.mjs does) and ask
// the funnel's decisions of the form it really builds. A regex over the page
// could not say "the steps are the generator's order".
//
// Every assertion here can fail; the ones that guard a law say which.

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import vm from "node:vm";

import { fieldsFor, missingRequired, controlOf, actForTier, keepsHouse, fieldsForReader, houseOfMe, houseGroupNames, HOUSE_GROUP } from "../src/lib/join-move-in.mjs";
import {
  LANE_SCREENS, laneScreen, laneProgress, laneParent, dots,
  fieldSteps, fieldOfStep, hashForStep, stepFromHash, stepOfField,
  continueLabel, isRequired, isPresent, missingHere,
  enterContinues, enterHint, labelOf, reviewRows, editKey,
} from "../src/lib/join-funnel.mjs";
import { ART, artRects, artSvg } from "../src/lib/pixel-icons.mjs";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const PROTO = read("../public/atelier/postmark/join/move-in/mcp-proto.js");
const JOIN = read("../town/pages/join/index.astro");
const MOVEIN = read("../town/pages/join/move-in.astro");
const FUNNEL = read("../src/components/JoinFunnel.astro");
const KEYS_CARD = read("../src/components/KeysCard.astro");
const DASH = read("../src/components/household-dashboard/HouseDashboard.astro");
const AGENT_MD = read("../public/atelier/postmark/join/agent.md");
const CSS = read("../src/styles/join-funnel.css");

// the door's `declare` card after office PR #172 — the same shape
// test/join-move-in.test.mjs pins, trimmed to what the funnel reads
const DECLARE = {
  read: "declare",
  card: {
    act: "declare",
    teaches: "Found your household at the door.",
    fields: {
      household: { type: "string", title: "Household name", "x-group": "household", "x-group-title": "The household", "x-multiline": false, examples: ["Starforge"], description: "The name your house goes by in town.", required: true },
      handle: { type: "string", title: "Handle", "x-group": "resident", "x-group-title": "The resident", "x-multiline": false, examples: ["wright"], description: "The address letters go to.", required: true },
      card: { type: "string", title: "Address Card", "x-group": "resident", "x-multiline": true, description: "The body of their ADDRESS.md.", required: true },
      agent: { type: "string", title: "Agent's name", "x-group": "resident", "x-multiline": false, description: "Their name, as they are called at home." },
      since: { type: "string", title: "Since", "x-group": "resident", "x-multiline": false, description: "YYYY-MM-DD." },
    },
  },
};

// the smallest document the generator can build into (as in join-move-in.test.mjs)
function makeDocument() {
  const node = (tag) => {
    const el = {
      tag, tagName: String(tag).toUpperCase(),
      className: "", hidden: false, value: "", placeholder: "",
      attrs: Object.create(null), listeners: Object.create(null), children: [], style: {}, _text: "",
      appendChild(c) { el.children.push(c); return c; },
      removeChild(c) { const i = el.children.indexOf(c); if (i >= 0) el.children.splice(i, 1); return c; },
      replaceChild(n, o) { const i = el.children.indexOf(o); if (i >= 0) el.children[i] = n; return o; },
      insertBefore(n, r) { const i = el.children.indexOf(r); if (i >= 0) el.children.splice(i, 0, n); else el.children.push(n); return n; },
      addEventListener(n, fn) { (el.listeners[n] || (el.listeners[n] = [])).push(fn); },
      setAttribute(k, v) { el.attrs[k] = String(v); },
      getAttribute(k) { return k in el.attrs ? el.attrs[k] : null; },
      focus() {},
      get firstChild() { return el.children[0] ?? null; },
      get textContent() { return el._text + el.children.map((c) => c.textContent).join(""); },
      set textContent(v) { el._text = String(v); el.children.length = 0; },
    };
    return el;
  };
  return { createElement: node, readyState: "complete", addEventListener() {} };
}
function buildDeclare() {
  const window = { MCP_PROTO_MANUAL: true };
  vm.runInContext(PROTO, vm.createContext({ window, document: makeDocument() }), { filename: "mcp-proto.js" });
  const P = window.MCPProto;
  const picked = fieldsFor(DECLARE, null);
  return { form: P._internals.buildForm(P._internals.fieldsSchema(picked.fields)), fields: picked.fields };
}
const put = (form, name, v) => { controlOf(form.fields[name].node).value = v; };
const plain = (v) => JSON.parse(JSON.stringify(v));

// ── 1. the steps are the generator's ─────────────────────────────────────────

test("the move-in road is the act's opening, one step per field IN THE GENERATOR'S ORDER, then review", () => {
  // CAN FAIL: hand-list the fields in the lib, or sort them, and the order
  // stops being the door's. The names come off form.names and nowhere else.
  const { form } = buildDeclare();
  const steps = fieldSteps(form);
  assert.deepEqual(plain(steps), ["intro", ...plain(form.names).map((n) => "field:" + n), "review"]);
  assert.deepEqual(plain(form.names), Object.keys(DECLARE.card.fields), "the generator kept the door's order");
  assert.equal(fieldOfStep("field:card"), "card");
  assert.equal(fieldOfStep("intro"), null);
  assert.equal(fieldOfStep("review"), null);
  assert.equal(stepOfField("handle", steps), 2);
  assert.equal(stepOfField("nope", steps), null);
});

test("a field the office grows tomorrow is a screen tomorrow, with no change here", () => {
  // CAN FAIL: any hand-kept list of screens. The door adds a field; the road grows.
  const window = { MCP_PROTO_MANUAL: true };
  vm.runInContext(PROTO, vm.createContext({ window, document: makeDocument() }), { filename: "mcp-proto.js" });
  const P = window.MCPProto;
  const grown = { ...DECLARE.card.fields, window_line: { type: "string", title: "Window" } };
  const form = P._internals.buildForm(P._internals.fieldsSchema(grown));
  assert.ok(fieldSteps(form).includes("field:window_line"));
  assert.equal(fieldSteps(form).length, Object.keys(grown).length + 2);
});

test("the step lives in the hash, and a hash from nowhere lands on the first screen", () => {
  const { form } = buildDeclare();
  const steps = fieldSteps(form);
  for (let i = 0; i < steps.length; i++) assert.equal(stepFromHash(hashForStep(i, steps), steps), i, `step ${i} does not round-trip`);
  assert.equal(hashForStep(steps.length - 1, steps), "#review");
  assert.equal(stepFromHash("", steps), 0);
  assert.equal(stepFromHash("#step-99", steps), 0, "a stale hash past the road must not strand the reader");
  assert.equal(stepFromHash("#hands", steps), 0);
});

// ── 2. one box at a time, the door's rules per box ───────────────────────────

test("Continue on an empty REQUIRED box is refused in the office's own sentence — the send's check, asked of one box", () => {
  // CAN FAIL: let the funnel walk past an empty required box, or word the
  // refusal itself. The sentence is missingRequired's, which is the office's.
  const { form, fields } = buildDeclare();
  const here = missingHere(form, fields, "household");
  assert.equal(here.length, 1);
  assert.deepEqual(plain(here[0]), plain(missingRequired(form, fields).find((m) => m.name === "household")));
  assert.deepEqual(plain(missingHere(form, fields, "agent")), [], "an optional box is never refused");
  put(form, "household", "Starforge");
  assert.deepEqual(plain(missingHere(form, fields, "household")), [], "a filled box may go on");
});

test("the forward button reads Skip on an empty optional box and Continue everywhere else (approved 2026-09-27)", () => {
  const { form, fields } = buildDeclare();
  const label = (n) => continueLabel({ required: isRequired(n, fields), present: isPresent(form, n) });
  assert.equal(label("household"), "Continue", "a required box never offers to be skipped");
  assert.equal(label("agent"), "Skip");
  put(form, "agent", "Dearest");
  assert.equal(label("agent"), "Continue");
});

test("Enter continues; in a paragraph box Enter is a new line and Ctrl/⌘+Enter continues; buttons keep their own Enter", () => {
  const k = (tagName, mods = {}) => ({ key: "Enter", target: { tagName }, ...mods });
  assert.equal(enterContinues(k("INPUT")), true);
  assert.equal(enterContinues(k("SELECT")), true);
  assert.equal(enterContinues(k("SECTION")), true);
  assert.equal(enterContinues(k("TEXTAREA")), false, "Enter in the Address Card must make a paragraph, not leave the screen");
  assert.equal(enterContinues(k("TEXTAREA", { ctrlKey: true })), true);
  assert.equal(enterContinues(k("TEXTAREA", { metaKey: true })), true);
  assert.equal(enterContinues(k("BUTTON")), false);
  assert.equal(enterContinues(k("A")), false);
  assert.equal(enterContinues(k("INPUT", { isComposing: true })), false, "an IME composition's Enter is not an answer");
  assert.equal(enterContinues({ key: "a", target: { tagName: "INPUT" } }), false);
  const { form } = buildDeclare();
  assert.equal(enterHint(form, "card"), "Ctrl + Enter ↵", "the hint must match what the paragraph box does");
  assert.equal(enterHint(form, "handle"), "Enter ↵");
});

// ── 3. review ────────────────────────────────────────────────────────────────

test("review shows every field under the label the generator DREW, the whole value, and blanks as blanks", () => {
  // CAN FAIL: label a row from a list of the page's own, or trim a long card.
  const { form } = buildDeclare();
  const card = "First paragraph.\n\nSecond paragraph, which is long enough that a clipped review would lose its end. ".repeat(4);
  put(form, "household", "Starforge");
  put(form, "handle", "dearest-ai");
  put(form, "card", card);
  const rows = plain(reviewRows(form));
  assert.deepEqual(rows.map((r) => r.label), ["Household name", "Handle", "Address Card", "Agent's name", "Since"]);
  assert.deepEqual(rows.map((r) => r.label), plain(form.names).map((n) => labelOf(form.fields[n].node)));
  assert.equal(rows.find((r) => r.name === "card").value, card, "the Address Card is shown whole (Wright's review note 4)");
  assert.deepEqual(rows.filter((r) => r.empty).map((r) => r.name), ["agent", "since"]);
});

// ── 4. /join/: the lane road ─────────────────────────────────────────────────

test("the lane hashes: the old #hands / #chat deep links still open their lane, and anything else is the first question", () => {
  assert.equal(laneScreen(""), "lane");
  assert.equal(laneScreen("#hands"), "hands");
  assert.equal(laneScreen("#chat"), "chat");
  assert.equal(laneScreen("#chat/yes"), "chat/yes");
  assert.equal(laneScreen("#nonsense"), "lane");
  for (const s of LANE_SCREENS) assert.ok(laneProgress(s).at < laneProgress(s).of);
  assert.deepEqual(plain(dots(1, 3)), ["done", "now", ""]);
  assert.equal(laneParent("chat/wait"), "chat/yes");
  assert.equal(laneParent("hands/link"), "hands");
  assert.equal(laneParent("chat"), "lane");
});

test("/join/ mounts the funnel with the page's OWN two texts, and the classic chooser stays whole for a reader without JavaScript", () => {
  // CAN FAIL: restate ONE_LINER or CHAT_LETTER inside the component (they
  // would drift), or drop the classic lanes (the no-JS page).
  assert.match(JOIN, /<JoinFunnel oneLiner=\{ONE_LINER\} chatLetter=\{CHAT_LETTER\} \/>/);
  assert.ok(!FUNNEL.includes("join/agent.md") && !FUNNEL.includes("Trueing House"),
    "the funnel carries its own copy of a text the page already owns");
  assert.match(JOIN, /<section class="lane" data-lane="hands">/);
  assert.match(JOIN, /<section class="lane" data-lane="chat">/);
  // the funnel shows only under the mark its inline script sets
  assert.match(FUNNEL, /<script is:inline>document\.documentElement\.classList\.add\("has-join-funnel"\);<\/script>/);
  assert.match(CSS, /\.join-funnel \{ display: none; \}/);
  assert.match(CSS, /html\.has-join-funnel \.join-funnel \{ display: block; \}/);
});

test("the funnel's two answers carry the chooser's lane key, so join:lane-chosen still fires from the join page", () => {
  // CAN FAIL: give the answers a key of their own and the tutorial bus goes
  // quiet on the funnel (tutorial.test.mjs holds that the emit lives in index.astro).
  assert.match(FUNNEL, /data-lane-tab="chat" data-jf-go="chat"/);
  assert.match(FUNNEL, /data-lane-tab="hands" data-jf-go="hands"/);
  assert.ok(!/pmTutorialEmit\(/.test(FUNNEL), "the funnel emits on its own; the emit belongs to the page");
});

test("the walkthrough invitation is Julian's portrait and Keemin's line, word for word, on the funnel AND the no-JS chat card", () => {
  // Keemin, 2026-09-27: "a little icon of Julian and it should say 'Click me for
  // a full walkthrough, written by a resident and his human!'". CAN FAIL:
  // reword the line, drop the portrait, or leave the old framing on either card.
  const LINE = "Click me for a full walkthrough, written by a resident and his human!";
  for (const [where, src] of [["the funnel", FUNNEL], ["the no-JS page", JOIN]]) {
    const m = src.match(/<a class="join-julian" href="\/walkthroughs\/chat-only\/">([\s\S]*?)<\/a>/);
    assert.ok(m, `${where} lost the walkthrough invitation`);
    assert.match(m[1], /artSvg\("julian"\)/, `${where}'s invitation lost Julian's portrait`);
    assert.ok(m[1].includes(`<span class="join-julian-t">${LINE}</span>`), `${where}'s invitation is not Keemin's line word for word`);
    assert.ok(!/Rather have every step written out/.test(src), `${where} still carries the old framing`);
  }
});

test("each step wears its little picture, and every picture is a clean 16x16 map in the town's inks", () => {
  // CAN FAIL: a short row, an ink with no colour, or a step left bare.
  for (const n of Object.keys(ART)) assert.ok(artRects(n).length > 0, n);
  for (const n of ["chat", "tools", "paste", "signin", "letter", "julian"]) assert.ok(FUNNEL.includes(`artSvg("${n}"`), `the funnel lost the ${n} picture`);
  for (const n of ["signin", "field", "review", "sent"]) assert.ok(MOVEIN.includes(`artSvg("${n}")`), `move-in lost the ${n} picture`);
  assert.throws(() => { ART.__bad = Array(16).fill("q".repeat(16)); try { artRects("__bad"); } finally { delete ART.__bad; } }, /has no colour/);
  assert.match(artSvg("chat"), /width="48" height="48"[^>]*shape-rendering="crispEdges" aria-hidden="true"/);
});

// ── 5. /join/move-in/ is still a form it does not own ────────────────────────

test("move-in's road is fieldSteps(form), and it walks the generator's nodes rather than drawing its own", () => {
  // CAN FAIL: build screens from a list, or clone a field into a screen.
  assert.match(MOVEIN, /steps = fieldSteps\(form\)/);
  assert.match(MOVEIN, /for \(const n of form\.names\)/);
  assert.match(MOVEIN, /<div class="jf-fields" data-form-host><\/div>/);
  assert.ok(!/cloneNode/.test(MOVEIN), "a cloned field is a second copy of a box, and its value would never be sent");
  assert.match(MOVEIN, /const missing = missingHere\(form, declared, name\);\s*if \(missing\.length\) return showMissing\(missing\);/);
});

test("the column is centred, 720 wide, with a 16px gutter of its own (Wright's review note 1)", () => {
  assert.match(CSS, /\.jf \{[^}]*max-width: 720px;[^}]*margin: 0 auto;[^}]*padding: 0 16px;/);
  assert.match(MOVEIN, /\.movein \{ max-width: 720px; margin: 0 auto; padding: 0 16px 2em;/);
});

// ── 6. a keeper is not asked for a house; the review edits in place ──────────
//
// Keemin, 2026-09-27, signed in as the keeper of Starforge: "it seems to allow
// starforge 2? confused as to why I even get a field for household if I'm
// already registered. also, the look it over should just let you edit in-pane
// instead of sending you back".

// add-resident's card (office src/mcp.mjs § request_residency): the same
// groups as declare, household OPTIONAL
const ADD_RESIDENT_FIELDS = (() => {
  const f = JSON.parse(JSON.stringify(DECLARE.card.fields));
  delete f.household.required;
  return f;
})();
function buildFor(fields, act) {
  const window = { MCP_PROTO_MANUAL: true };
  vm.runInContext(PROTO, vm.createContext({ window, document: makeDocument() }), { filename: "mcp-proto.js" });
  const P = window.MCPProto;
  const asked = fieldsForReader(fields, act);
  return { form: P._internals.buildForm(P._internals.fieldsSchema(asked)), fields: asked };
}

test("a keeper (add-resident) gets NO screen, NO review row and NO sent box for the door's household group", () => {
  // CAN FAIL: feed the generator the whole block on add-resident, and
  // "starforge 2" is one typed box away again.
  const { form } = buildFor(ADD_RESIDENT_FIELDS, "add-resident");
  assert.ok(!form.names.includes("household"), "the household group drew a box for a keeper");
  assert.ok(!fieldSteps(form).includes("field:household"));
  assert.ok(!reviewRows(form).some((r) => r.name === "household"));
  for (const n of form.names) put(form, n, "x");
  assert.ok(!("household" in form.read().args), "the send carried a household box");
  assert.deepEqual(plain(form.names), ["handle", "card", "agent", "since"], "the resident's boxes are all still asked");
  assert.equal(keepsHouse("add-resident"), true);
  assert.equal(actForTier("resident"), "add-resident");
  assert.equal(actForTier("harbor"), "add-resident");
});

test("the house is dropped by the GROUP the door declares, never by a field's name", () => {
  // CAN FAIL: key the drop on the word "household" as a field name.
  const renamed = { ...ADD_RESIDENT_FIELDS, house_line: { type: "string", title: "House line", "x-group": " household " } };
  const aResidentNamedHousehold = { handle: ADD_RESIDENT_FIELDS.handle, household: { type: "string", "x-group": "resident" } };
  assert.ok(!Object.keys(fieldsForReader(renamed, "add-resident")).includes("house_line"), "a new box in the house group was still asked");
  assert.ok(Object.keys(fieldsForReader(aResidentNamedHousehold, "add-resident")).includes("household"), "a resident box was dropped for its name");
  assert.equal(HOUSE_GROUP, "household");
});

test("the founding acts are unchanged: a visitor (declare) and a berth (begin) still name their house", () => {
  // CAN FAIL: drop the group for every act.
  for (const act of ["declare", "begin"]) {
    assert.equal(keepsHouse(act), false, act);
    const { form } = buildFor(DECLARE.card.fields, act);
    assert.deepEqual(plain(form.names), Object.keys(DECLARE.card.fields), `${act} lost a box`);
    assert.equal(fieldSteps(form)[1], "field:household", `${act}'s first question is no longer the house`);
  }
  assert.equal(actForTier("visitor"), "declare");
  assert.equal(fieldsForReader(DECLARE.card.fields, "declare"), DECLARE.card.fields, "a founder's block is the door's own, untouched");
});

test("the keeper's house is named from /me's households[handle], in the site's nameplate", () => {
  // CAN FAIL: guess the house from the login, or from a typed box.
  const me = { household: "keeminlee", handles: ["wright", "rei"], households: { wright: { slug: "starforge", residents: ["rei", "wright"] } } };
  assert.deepEqual(plain(houseOfMe(me, { starforge: { name: "Starforge" } })), { slug: "starforge", name: "Starforge", provisional: false });
  assert.equal(houseOfMe({ ...me, households: { wright: { slug: "deva-s-commons" } } }, { "deva-s-commons": { name: "Deva's Commons" } }).name, "Deva's Commons");
  assert.equal(houseOfMe({ ...me, households: { wright: { slug: "the-rookery" } } }).name, "The Rookery", "an unsynced slug still prints");
  assert.equal(houseOfMe({ household: "keeminlee", handles: ["wright"] }), null, "no block: the page says 'your house', never the login");
  assert.equal(houseOfMe(null), null);
});

test("move-in feeds the generator the reader's fields and names the keeper's house on the review", () => {
  // CAN FAIL: build from picked.fields, check requiredness against the whole
  // block, or leave the review silent about whose house this is.
  assert.match(MOVEIN, /const house = keepsHouse\(act\) \? await readHouse\(tok\) : null;\s*const asked = fieldsForReader\(picked\.fields, act, house\);\s*const schema = window\.MCPProto\._internals\.fieldsSchema\(asked\);/);
  assert.match(MOVEIN, /declared = asked;/);
  assert.match(MOVEIN, /if \(keepsHouse\(act\)\) showHouse\(house, asked\);/);
  assert.match(MOVEIN, /<p class="jf-house" data-jf-house hidden>Adding to <b data-jf-house-name><\/b>/);
  assert.match(MOVEIN, /fetch\(officeBase\(\) \+ "\/me"/);
  assert.match(MOVEIN, /houseOfMe\(await r\.json\(\), houses\)/);
});

test("look it over edits IN PLACE: the row's edit moves the generator's own node in, and never walks back to its screen", () => {
  // CAN FAIL: route the edit through go()/stepOfField (the old "sending you
  // back"), or draw a second box in the row that the send would never read.
  const review = MOVEIN.match(/function paintReview\(\) \{[\s\S]*?\n    \}\n/)[0];
  assert.match(review, /edit\.addEventListener\("click", \(\) => openEdit\(row\.name, wrap\)\);/);
  assert.ok(!/go\(|stepOfField/.test(review), "the review's edit still sends the reader back to a screen");
  const open = MOVEIN.match(/function openEdit\(name, wrap\) \{[\s\S]*?\n    \}\n/)[0];
  assert.match(open, /const node = form\.fields\[name\]\.node;/);
  assert.match(open, /slot\.appendChild\(node\);/, "the row must hold the generator's own node");
  assert.ok(!/go\(|history\.|createElement\("(input|textarea|select)"\)/.test(open), "an in-place edit navigated, or drew its own box");
  assert.match(open, /textContent = "Save"/);
  assert.match(open, /textContent = "cancel"/);
  const close = MOVEIN.match(/function closeEdit\(saving\) \{[\s\S]*?\n    \}\n/)[0];
  assert.match(close, /home\.insertBefore\(node, next\);/, "the node must go home to its screen");
  assert.match(close, /missingHere\(form, declared, name\)/, "a save must keep the office's required rule");
  assert.match(close, /c\.value = before;/, "cancel must restore what the box held");
  assert.match(MOVEIN, /if \(!steps \|\| editing \|\| !enterContinues\(e\)\) return;/, "Enter while editing would send the whole request");
});

test("in the row being edited, Enter saves a one-line box, Escape cancels, and a paragraph box keeps its Enter", () => {
  // CAN FAIL: let Enter in the Address Card save mid-paragraph, or leave Escape dead.
  const k = (key, tagName, mods = {}) => ({ key, target: { tagName }, ...mods });
  assert.equal(editKey(k("Enter", "INPUT")), "save");
  assert.equal(editKey(k("Enter", "SELECT")), "save");
  assert.equal(editKey(k("Escape", "INPUT")), "cancel");
  assert.equal(editKey(k("Escape", "TEXTAREA")), "cancel");
  assert.equal(editKey(k("Enter", "TEXTAREA")), null, "Enter in a paragraph box is a new line");
  assert.equal(editKey(k("Enter", "TEXTAREA", { ctrlKey: true })), "save");
  assert.equal(editKey(k("Enter", "BUTTON")), null, "Save and cancel keep their own Enter");
  assert.equal(editKey(k("Enter", "INPUT", { isComposing: true })), null);
  assert.equal(editKey(k("a", "INPUT")), null);
});

test("a PROVISIONAL house is the one keeper still asked its name, and the box says it names the house once", () => {
  // CAN FAIL: drop the house group for a provisional house too (its name,
  // borrowed from its first resident, could then never be chosen here), or
  // keep it without saying the answer names the house once. The office's
  // planRegistryJoin renames a provisional house on its first naming; for a
  // settled house it drops the typed name (Wright's correction, 2026-09-27).
  const kept = fieldsForReader(ADD_RESIDENT_FIELDS, "add-resident", { provisional: true });
  assert.ok("household" in kept, "a provisional house lost the box that chooses its name");
  assert.ok(!("household" in fieldsForReader(ADD_RESIDENT_FIELDS, "add-resident", { provisional: false })));
  assert.ok(!("household" in fieldsForReader(ADD_RESIDENT_FIELDS, "add-resident", null)), "an unknown house is treated as settled");
  assert.deepEqual(houseGroupNames(ADD_RESIDENT_FIELDS), ["household"]);
  const me = { handles: ["dearest-ai"], households: { "dearest-ai": { slug: "dearest-ai" } } };
  assert.equal(houseOfMe(me, { "dearest-ai": { name: "dearest-ai", provisional: true } }).provisional, true);
  assert.equal(houseOfMe(me, {}).provisional, false, "a house the site has not synced is not guessed provisional");
  const show = MOVEIN.match(/function showHouse\(house, asked\) \{[\s\S]*?\n    \}\n/)[0];
  assert.match(show, /if \(!house \|\| !house\.provisional\) return;/);
  assert.match(show, /for \(const n of houseGroupNames\(asked\)\)/);
  assert.match(show, /names it, once\./);
  assert.match(MOVEIN, /provisional: row\?\.provisional === true/, "the page must read provisional off the synced registry row");
});

test("every 'sign in with GitHub' in the join flow offers a new GitHub account, in a new tab (Keemin, 2026-09-27)", () => {
  // CAN FAIL: drop the aside from any of the three places, or link it anywhere else.
  const ASIDE = /\(<a href="https:\/\/github\.com\/signup" target="_blank" rel="noopener">make a new GitHub account<\/a> if you don't have one\)/;
  const hands = FUNNEL.match(/data-jf-screen="hands\/link"[\s\S]*?<\/section>/)[0];
  assert.match(hands, ASIDE, "the tools route's last screen");
  const card = JOIN.match(/<section class="lane" data-lane="hands">[\s\S]*?<\/section>/)[0];
  assert.match(card, ASIDE, "the no-JS /join/ tools card");
  const gate = MOVEIN.match(/data-gate-signedout[\s\S]*?<\/section>/)[0];
  assert.match(gate, ASIDE, "the move-in sign-in screen");
});

test("/join/ no longer carries the outdated arrival note", () => {
  // CAN FAIL: leave the block or its CSS behind.
  assert.ok(!/Arrival is open\./.test(JOIN), "the ⚓ arrival line is back");
  assert.ok(!/household-note|hn-anchor/.test(JOIN), "the note's block or CSS is left behind");
});

test("the key mint stands on /join/ for a signed-in household, as the one card, and the household page no longer carries it (POS-323)", () => {
  // CAN FAIL: copy the mint into the page instead of the one card, show it
  // before /me names a resident, rewrite the machinery, or leave it on the
  // household dashboard. Supersedes the 2026-09-27 placement (125afe863).
  assert.match(JOIN, /import KeysCard from "@\/components\/KeysCard\.astro";/);
  assert.match(JOIN, /<KeysCard \/>\s*<JoinFunnel /, "the mint stands at the top of /join/, above the funnel");
  assert.ok(!/data-keygen|\/keys"|handoffPrompt|mint-mini/.test(JOIN), "/join/ carries a copy of the mint instead of the one card");
  for (const hook of ["data-keygen-btn", "data-keygen-status", "data-keygen-out", "data-keygen-key", "data-keygen-copy", "data-handoff", "data-handoff-text", "data-handoff-note"]) {
    assert.ok(KEYS_CARD.includes(hook), `the card lost the ${hook} hook`);
  }
  assert.match(KEYS_CARD, /fetch\(BASE \+ "\/keys", \{\s*method: "POST"/, "the mint is still POST /keys with the sign-in");
  assert.match(KEYS_CARD, /function handoffPrompt\(key, handle\)/);
  assert.match(KEYS_CARD, /<h2 id="keys-card-h" class="keys-card-h">Keys for your residents<\/h2>/);
  assert.match(KEYS_CARD, /<section class="keys-card" data-keys-card hidden /, "the card must start hidden: signed out, the page is unchanged");
  assert.match(KEYS_CARD, /revealMintFor\(card, /, "the card no longer asks /me before it stands");
  assert.match(KEYS_CARD, /addEventListener\("pm:lens"/, "the card no longer follows sign-out");
  const markup = KEYS_CARD.replace(/^---[\s\S]*?\n---/, "").replace(/<script>[\s\S]*<\/script>/, "");
  assert.ok(!/\bagent\b/i.test(markup), "the card's words say resident, never agent");
  assert.ok(!/KeysCard|data-keygen|Keys for your residents/.test(DASH), "the household page still carries the mint");
  assert.ok(!existsSync(new URL("../src/components/household-dashboard/KeysCard.astro", import.meta.url)), "a second copy of the card stands");
  assert.match(AGENT_MD, /mints a household key on the join page, https:\/\/postmark\.town\/join\/, signed in/);
  assert.ok(!/households\/<your house>\/, signed in/.test(AGENT_MD), "agent.md still sends the human to the household page for a key");
});

test("the humans' Discord rides the funnel's last screens, and /join/ keeps one plain line of it without JavaScript", () => {
  // CAN FAIL: leave the band at the foot of /join/, or miss a last screen.
  const LINE = /While you wait: <a href="https:\/\/discord\.gg\/wVCF9ChZum" target="_blank" rel="noopener">the Humans of Postmark Discord<\/a>, for the humans\. Ask questions, compare setups, and hear what's next\./;
  for (const screen of ["hands/link", "chat/wait"]) {
    const m = FUNNEL.match(new RegExp(`data-jf-screen="${screen.replace("/", "\\/")}"[\\s\\S]*?<\\/section>`))[0];
    assert.match(m, LINE, `the ${screen} screen lost the Discord`);
  }
  const receipt = MOVEIN.match(/data-gate-reply[\s\S]*?<\/section>/)[0];
  assert.match(receipt, LINE, "the move-in receipt (the chat route's sent screen) lost the Discord");
  assert.match(MOVEIN, /\.jf-act\[hidden\] \{ display: none; \}/, "the act's display:flex would stand over the receipt");
  assert.ok(!/class="most"|most-blurb|Getting the most/.test(JOIN), "the Discord band is still at the foot of /join/");
  assert.match(JOIN, /<p class="join-discord">[^<]*<a href=\{DISCORD\}/);
  assert.match(JOIN, /:global\(html\.has-join-funnel\) \.join-discord \{ display: none; \}/, "with JavaScript the plain line must step aside for the funnel's");
});

// ── 8. where did you hear (POS-292) ──────────────────────────────────────────
//
// The office asks it (declare only), last, optional, in its own "human" group:
// an enum of the ruled list and a capped note. The site owns no screen for it,
// so these tests hand the generator the card the office serves and ask what
// the funnel does with it. The labels are the office's (src/arrival-heard.mjs).
const HEARD_LABELS = ["YouTube", "Discord", "X / Twitter", "Reddit", "A friend or another resident", "My AI told me", "A search", "The Commons / another agent community", "Other"];
const HUMAN = { "x-group": "human", "x-group-title": "One question for you", "x-group-hint": "For the human joining, and skippable." };
const DECLARE_292 = {
  ...DECLARE,
  card: { ...DECLARE.card, fields: { ...DECLARE.card.fields,
    heard: { type: "string", title: "Where did you hear about Postmark?", ...HUMAN, enum: HEARD_LABELS, description: "Optional. One choice." },
    heard_note: { type: "string", title: "Anything to add?", ...HUMAN, "x-multiline": false, maxLength: 280, description: "Optional, up to 280 characters." },
  } },
};
function buildDeclare292() {
  const window = { MCP_PROTO_MANUAL: true };
  vm.runInContext(PROTO, vm.createContext({ window, document: makeDocument() }), { filename: "mcp-proto.js" });
  const P = window.MCPProto;
  const picked = fieldsFor(DECLARE_292, null);
  return { form: P._internals.buildForm(P._internals.fieldsSchema(picked.fields)), fields: picked.fields };
}

test("POS-292: the question is two screens at the end of the road, before the review, with no change to the page", () => {
  const { form } = buildDeclare292();
  const steps = plain(fieldSteps(form));
  assert.deepEqual(steps.slice(-3), ["field:heard", "field:heard_note", "review"]);
});

test("POS-292: the choice is the generator's own select — unset first, then the ruled list in the office's words", () => {
  const { form } = buildDeclare292();
  const select = controlOf(form.fields.heard.node);
  assert.equal(select.tagName, "SELECT");
  assert.deepEqual(select.children.map((o) => o.textContent), ["— unset —", ...HEARD_LABELS]);
  assert.equal(labelOf(form.fields.heard.node), "Where did you hear about Postmark?");
});

test("POS-292: it is skippable — both boxes read Skip empty, and a skipped question sends nothing", () => {
  const { form, fields } = buildDeclare292();
  const label = (n) => continueLabel({ required: isRequired(n, fields), present: isPresent(form, n) });
  assert.equal(label("heard"), "Skip");
  assert.equal(label("heard_note"), "Skip");
  assert.deepEqual(plain(missingHere(form, fields, "heard")), [], "never refused");
  put(form, "household", "Starforge"); put(form, "handle", "dearest-ai"); put(form, "card", "Hello.");
  const skipped = plain(form.read().args);
  assert.equal("heard" in skipped, false);
  assert.equal("heard_note" in skipped, false);
  put(form, "heard", "Reddit"); put(form, "heard_note", "a friend's post");
  assert.deepEqual(plain(form.read().args), { ...skipped, heard: "Reddit", heard_note: "a friend's post" }, "an answer rides the same send");
});
