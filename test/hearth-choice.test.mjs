// hearth-choice.test.mjs — the household's saved Hearth: the resolver, the read, the write, and the picker (POS-962).
//
// Ruled (Darko 10-22, POS-684/c): the office keeps the choice; read on every load; changed any time. Wright 11-09: the saved choice decides what the
// house draws for everyone, unset keeps the default, a PREVIEW NEVER SAVES, another household cannot change it. Fixtures only; the office is a
// fake here and the real one is tested in the office repo (test/household-hearth.test.mjs).
//
//   § 1  whichDesign (the ONE selector): saved, default, preview, unregistered, unavailable
//   § 2  the read (signed out) and the write (signed in)
//   § 3  the picker: a preview never saves; the green check is the save, the red x puts it back; refusals; the default; the design's credit
//   § 4  the wiring: the only write is the green check; the picker says no sentence but the credit
//
// POS-999 round 3 (Darko, 2026-11-12 08:56 EST: "please reduce it to just the dropdown -> if you select a different one, green checkbox vs red x. we don't
// need words explaining obvious things"; 08:57: "listing Designed by {author}"). Until then § 3 held a second yes (ask() then confirm()) and the picker's lines.
//
//   node --test test/hearth-choice.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { designNote, readSavedHearth, saveHearth, savedHearthFrom, UNCONFIRMED_SAVE } from "../src/lib/hearth/choice.mjs";
import { whichDesign } from "../src/lib/hearth/which-design.mjs";
import { createPicker } from "../src/lib/hearth/picker.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENTRIES = [{ id: "default", title: "Postmark" }, { id: "ledger", title: "The Ledger" }, { id: "orchard", title: "Orchard" }];

// ── § 1 whichDesign: the ONE selector (POS-984's seam), with the saved choice inside it ──────────────

test("§ 1 unset keeps the default; a saved registered entry is what everyone draws", () => {
  assert.equal(whichDesign(ENTRIES, { saved: null }).id, "default");
  assert.equal(whichDesign(ENTRIES, {}).id, "default", "no input at all: the default, as before POS-962");
  assert.equal(whichDesign(ENTRIES, { entry: null, saved: "ledger" }).id, "ledger");
  assert.equal(whichDesign(ENTRIES, { saved: "default" }).id, "default");
  assert.equal(whichDesign([], { saved: "ledger" }), null, "no entries at all: nothing to draw");
});

test("§ 1 a preview draws another entry and decides nothing saved; the preview wins only for the one who asked", () => {
  assert.equal(whichDesign(ENTRIES, { entry: "orchard", saved: "ledger" }).id, "orchard");
  assert.equal(whichDesign(ENTRIES, { entry: "default", saved: "ledger" }).id, "default", "previewing the default on a house that chose another");
  assert.equal(whichDesign(ENTRIES, { entry: "ledger", saved: "ledger" }).id, "ledger");
  assert.equal(whichDesign(ENTRIES, { entry: null, saved: "ledger" }).id, "ledger", "the next visitor, with no preview, draws the saved choice");
  const before = JSON.stringify(ENTRIES);
  whichDesign(ENTRIES, { entry: "orchard", saved: "ledger" });
  assert.equal(JSON.stringify(ENTRIES), before, "the selector only reads");
});

test("§ 1 an unregistered saved id or preview draws the saved/default; designNote says why; an unavailable read says so, never 'nothing chosen'", () => {
  assert.equal(whichDesign(ENTRIES, { saved: "newer-than-this-build" }).id, "default");
  assert.match(designNote(ENTRIES, { saved: "newer-than-this-build" }), /not in this version of the site yet/);
  assert.equal(whichDesign(ENTRIES, { entry: "<script>", saved: "ledger" }).id, "ledger");
  assert.match(designNote(ENTRIES, { entry: "<script>", saved: "ledger" }), /No Hearth entry is registered as “<script>”; showing The Ledger/);
  assert.equal(whichDesign(ENTRIES, { saved: undefined }).id, "default");
  assert.match(designNote(ENTRIES, { saved: undefined }), /could not be read/);
  for (const quiet of [{ saved: null }, { saved: "ledger" }, { entry: "orchard", saved: "ledger" }]) assert.equal(designNote(ENTRIES, quiet), "", JSON.stringify(quiet));
});

// ── § 2 the read and the write ──────────────────────────────────────────────

const answer = (slug, hearth) => ({ registry: { households: { [slug]: { name: "N", ...(hearth ? { hearth } : {}) } } } });

test("§ 2 the read is public and keyless, narrowed to the house; a failed read is undefined, not null", async () => {
  const calls = [];
  const ok = (body, status = 200) => async (url, init) => { calls.push([url, init]); return { ok: status < 400, status, json: async () => body }; };
  assert.equal(await readSavedHearth({ handles: ["ash"], slug: "ember-lane", api: "/api", fetchImpl: ok(answer("ember-lane", "ledger")) }), "ledger");
  assert.equal(await readSavedHearth({ handles: ["ash"], slug: "ember-lane", api: "/api", fetchImpl: ok(answer("ember-lane")) }), null, "chose nothing");
  assert.equal(await readSavedHearth({ handles: ["ash"], slug: "ember-lane", api: "/api", fetchImpl: ok(answer("other-house", "ledger")) }), null, "another house's choice is not this one's");
  assert.equal(await readSavedHearth({ handles: ["ash"], slug: "ember-lane", api: "/api", fetchImpl: ok({}, 503) }), undefined);
  assert.equal(await readSavedHearth({ handles: ["ash"], slug: "ember-lane", api: "/api", fetchImpl: async () => { throw new Error("offline"); } }), undefined);
  assert.equal(await readSavedHearth({ handles: [], slug: "x", api: "/api", fetchImpl: ok({}) }), undefined);
  assert.equal(calls[0][0], "/api/households?h=ash");
  assert.equal(calls[0][1].method, undefined, "a GET");
  assert.equal(Object.keys(calls[0][1].headers).some((h) => /authorization/i.test(h)), false, "no bearer on the public read");
  assert.equal(savedHearthFrom(answer("a", "Bad Id!"), "a"), null, "an id spelled wrong reads as nothing");
});

test("§ 2 the save is a PATCH with the human's bearer; the default goes as null; the office's refusal is passed on in its words", async () => {
  const seen = [];
  const office = (status, body) => async (url, init) => { seen.push({ url, init }); return { ok: status < 400, status, json: async () => body }; };
  const saved = await saveHearth({ slug: "ember-lane", id: "ledger", token: "tok", api: "/api", fetchImpl: office(200, { hearth: "ledger" }) });
  assert.deepEqual(saved, { ok: true, status: 200, hearth: "ledger" });
  assert.equal(seen[0].url, "/api/households/ember-lane/hearth"); assert.equal(seen[0].init.method, "PATCH");
  assert.equal(seen[0].init.headers.authorization, "Bearer tok");
  assert.deepEqual(JSON.parse(seen[0].init.body), { hearth: "ledger" });
  await saveHearth({ slug: "ember-lane", id: "default", token: "tok", api: "/api", fetchImpl: office(200, { hearth: null }) });
  assert.deepEqual(JSON.parse(seen[1].init.body), { hearth: null });
  const refused = await saveHearth({ slug: "ember-lane", id: "ledger", token: "tok", api: "/api", fetchImpl: office(403, { defect: "no", hint: "only an account the town's record binds can choose" }) });
  assert.deepEqual([refused.ok, refused.status], [false, 403]); assert.match(refused.message, /binds/);
  const anon = await saveHearth({ slug: "ember-lane", id: "ledger", token: null, api: "/api", fetchImpl: office(200, {}) });
  assert.deepEqual([anon.ok, anon.status], [false, 401]); assert.equal(seen.length, 3, "no token, no request: only the three earlier calls were sent");
  assert.equal((await saveHearth({ slug: "x", id: "ledger", token: "t", api: "/api", fetchImpl: async () => { throw new Error("offline"); } })).status, 0);
});

test("§ 2 a save whose outcome is not known says so: no answer, or a success that cannot be read, is UNCONFIRMED, never 'nothing was saved' and never a saved default (POS-962 lead FIX)", async () => {
  const ok200 = (json) => async () => ({ ok: true, status: 200, json });
  const save = (fetchImpl) => saveHearth({ slug: "ember-lane", id: "ledger", token: "tok", api: "/api", fetchImpl });
  // no answer: the request may still have landed
  const offline = await save(async () => { throw new TypeError("network"); });
  assert.deepEqual([offline.ok, offline.unconfirmed, offline.status, offline.message], [false, true, 0, UNCONFIRMED_SAVE.noAnswer]);
  // a success whose body cannot be read, has no `hearth`, or names no entry: not a confirmation of anything
  for (const [label, json] of [
    ["unparseable", async () => { throw new SyntaxError("cut off"); }],
    ["no body", async () => null],
    ["no hearth field", async () => ({ household: "ember-lane" })],
    ["hearth is not an id", async () => ({ hearth: 7 })],
  ]) {
    const r = await save(ok200(json));
    assert.deepEqual([r.ok, r.unconfirmed, r.status, r.message], [false, true, 200, UNCONFIRMED_SAVE.unreadable], label);
    assert.equal(r.hearth, undefined, `${label}: no default is synthesized`);
  }
  for (const words of Object.values(UNCONFIRMED_SAVE)) {
    assert.doesNotMatch(words, /nothing was saved|not saved/i);
    assert.match(words, /could not be confirmed\. Reload the page to see the Hearth this house has saved\./);
  }
  // an explicit null IS the confirmed default
  assert.deepEqual(await save(ok200(async () => ({ hearth: null }))), { ok: true, status: 200, hearth: null });
});

test("§ 3 an unconfirmed save is said as one by the picker: the office's state is not claimed either way, and the shown choice is not moved", async () => {
  const { picker, log } = harness({ result: { ok: false, unconfirmed: true, status: 0, message: UNCONFIRMED_SAVE.noAnswer }, opts: { saved: "ledger" } });
  picker.preview("orchard");
  const after = await picker.keep();
  assert.equal(log.saves.length, 1, "one save was sent, and nothing resent it");
  assert.equal(after.failed.message, UNCONFIRMED_SAVE.noAnswer, "its own words (for the status a screen reader reads), never 'Not saved'");
  assert.equal(after.failed.say, "", "and no line on the page: the dropdown is marked instead");
  assert.equal(after.savedId, "ledger", "the picker claims no new saved choice");
  assert.deepEqual([after.shown, after.pending], ["orchard", true], "the check and the x stay, on the design that was not confirmed");
});

// ── § 3 the picker ──────────────────────────────────────────────────────────

const harness = (over = {}) => {
  const log = { saves: [], draws: [] };
  const save = async (a) => { log.saves.push(a); return over.result ?? { ok: true, status: 200, hearth: a.id }; };
  const picker = createPicker({ entries: ENTRIES, slug: "ember-lane", saved: null, signedIn: true, save, onDraw: (id) => log.draws.push(id), ...over.opts });
  return { picker, log };
};

test("§ 3 a preview NEVER saves: previewing any number of entries sends nothing and leaves the saved choice as it was", async () => {
  const { picker, log } = harness({ opts: { saved: "ledger" } });
  for (const id of ["orchard", "default", "ledger", "orchard"]) picker.preview(id);
  assert.deepEqual(log.saves, [], "no write was made");
  assert.equal(picker.view().savedId, "ledger");
  assert.deepEqual(log.draws, ["orchard", "default", "ledger", "orchard"]);
  assert.deepEqual([picker.view().changed, picker.view().pending], [true, true], "another design than the kept one: the check and the x show, and nothing was sent");
  picker.preview("not-registered"); assert.equal(picker.view().shown, "orchard", "an unregistered id is no preview");
});

test("§ 3 the green check is the one write; the red x writes nothing and puts the kept design back; on the kept design neither shows", async () => {
  const { picker, log } = harness();
  assert.deepEqual([picker.view().pending, picker.view().canKeep], [false, false], "on the kept design: no check, no x");
  picker.preview("ledger");
  assert.deepEqual([picker.view().pending, picker.view().canKeep], [true, true]);
  assert.deepEqual(log.saves, [], "choosing is not a save");
  const back = picker.back();
  assert.deepEqual(log.saves, [], "the x sends nothing");
  assert.deepEqual([back.shown, back.pending], ["default", false], "and the dropdown and the drawing are back on the kept design");
  assert.deepEqual(log.draws, ["ledger", "default"]);
  picker.preview("ledger");
  const done = await picker.keep();
  assert.deepEqual(log.saves, [{ slug: "ember-lane", id: "ledger" }]);
  assert.deepEqual([done.savedId, done.shown, done.pending, done.failed], ["ledger", "ledger", false, null], "saved: the check and the x go, nothing is marked");
  await picker.keep();
  assert.equal(log.saves.length, 1, "on the kept design the check does nothing");
});

test("§ 3 a refused save keeps the kept choice, the check and the x; only a refusal the owner must read (401, 403) is a line, in the office's words; the default is saved by the same check", async () => {
  const refused = harness({ result: { ok: false, status: 403, message: "only an account the town's record binds to this household can choose its Hearth" } });
  refused.picker.preview("orchard");
  const after = await refused.picker.keep();
  assert.equal(after.savedId, null, "nothing was saved");
  assert.equal(after.failed.say, "only an account the town's record binds to this household can choose its Hearth", "the office's words, as they are, with no 'Not saved:' before them");
  assert.deepEqual([after.shown, after.pending], ["orchard", true], "the check and the x stay");
  assert.equal(refused.picker.preview("ledger").failed, null, "choosing again clears the mark");
  const down = harness({ result: { ok: false, status: 503, message: "The office could not keep that." } });
  down.picker.preview("orchard");
  const d = await down.picker.keep();
  assert.deepEqual([d.failed.say, d.failed.message], ["", "The office could not keep that."], "a 503: no line on the page, its reason in the status");
  const { picker, log } = harness({ opts: { saved: "ledger" } });
  picker.preview("default");
  assert.equal(picker.view().pending, true, "the default, chosen in the dropdown over a kept design, is another design too");
  const cleared = await picker.keep();
  assert.deepEqual(log.saves, [{ slug: "ember-lane", id: null }], "sent as null");
  assert.deepEqual([cleared.savedId, cleared.shown, cleared.pending], [null, "default", false]);
});

test("§ 3 the design's credit: the view carries the shown design's recorded author as it changes, and none for a design that records none", () => {
  const AUTHORED = [{ id: "default", title: "Postmark", author: "postmark" }, { id: "ledger", title: "The Ledger", author: "wick" }, { id: "orchard", title: "Orchard" }];
  const p = createPicker({ entries: AUTHORED, slug: "ember-lane", saved: null, save: async () => ({ ok: true, hearth: null }) });
  assert.equal(p.view().author, "postmark", "the kept design's");
  assert.equal(p.preview("ledger").author, "wick", "it follows the dropdown before any save");
  assert.equal(p.preview("orchard").author, null, "a design with no recorded author: none (no line is drawn)");
});

test("§ 3 a visitor who is not the house's signed-in human has no way to save: no check, no x, and keep() does nothing", async () => {
  const { picker, log } = harness({ opts: { signedIn: false, saved: "ledger" } });
  picker.preview("orchard");
  const v = picker.view();
  assert.deepEqual([v.controls, v.pending, v.canKeep], [false, false, false]);
  await picker.keep();
  assert.deepEqual(log.saves, []);
  let state = false;
  const live = createPicker({ entries: ENTRIES, slug: "x", saved: null, signedIn: () => state, save: async () => ({ ok: true, hearth: "ledger" }) });
  live.preview("ledger"); assert.equal(live.view().controls, false);
  state = true; assert.equal(live.view().controls, true, "the sign-in can change under a mounted picker");
});

// ── § 4 the wiring ──────────────────────────────────────────────────────────

test("§ 4 the only code that writes the choice is choice.mjs § saveHearth, reached only from the green check", () => {
  const read = (p) => readFileSync(join(ROOT, p), "utf8");
  const writers = ["src/lib/hearth/stage.mjs", "src/lib/hearth/picker.mjs", "src/lib/hearth/choice.mjs", "src/components/hearth/Hearth.astro", "src/components/hearth/HearthPicker.astro"]
    .filter((p) => /method:\s*"PATCH"|\/hearth`/.test(read(p)));
  assert.deepEqual(writers, ["src/lib/hearth/choice.mjs"]);
  const picker = read("src/lib/hearth/picker.mjs");
  assert.equal((picker.match(/await save\(/g) ?? []).length, 1, "one call to the write");
  assert.ok(picker.indexOf("await save(") > picker.indexOf("async keep() {") && picker.indexOf("await save(") < picker.indexOf("back() {"), "and it is in keep(), the green check");
  assert.match(read("src/lib/hearth/stage.mjs"), /whichDesign\(entries, \{ entry: asked, saved \}\)/, "the stage asks the one selector");
  assert.equal(/pickEntry/.test(read("src/lib/hearth/stage.mjs")), false, "and has no selection policy of its own");
  // POS-984 rebuild (Darko, 2026-11-10 17:28 EST): until then this asserted the picker stood in the site's band, in its private body, for the signed-in human only
  // (and before that, in Hearth.astro's header for everyone). It is the dropdown in the one strip Hearth.astro draws now, for EVERY reader: anyone may preview.
  // What stays the signed-in human's is the SAVE, which `signedIn` gates in picker.mjs, and the office decides at the write.
  assert.match(read("src/components/hearth/Hearth.astro"), /<HearthPicker entries=\{pickable\}/);
  assert.equal((read("src/components/hearth/Hearth.astro").match(/<HearthPicker /g) ?? []).length, 1, "one dropdown on the page");
  for (const f of ["town/components/Household.astro", "town/components/HouseholdPage.astro", "town/pages/households/[slug].astro"]) assert.doesNotMatch(read(f), /<HearthPicker /, `${f} draws no second one`);
});

// "we don't need words explaining obvious things" (Darko, 2026-11-12 08:56 EST). A STALE-PHRASE COUNT over the picker's two files, comments stripped: the words
// POS-999 round 3 removed, one by one, and the component's markup, whose only text is the credit's expression. The walk (qa-shots/hearth-walk.mjs ⑭) reads the page.
const unbrace = (s) => { let out = "", depth = 0; for (const ch of s) { if (ch === "{") depth += 1; else if (ch === "}") depth = Math.max(0, depth - 1); else if (!depth) out += ch; } return out; };
test("§ 4 the picker says no sentence but the credit: none of the words it used to say, and its markup's only text is \"Designed by\" its design's author", () => {
  const read = (p) => readFileSync(join(ROOT, p), "utf8");
  const code = read("src/lib/hearth/picker.mjs").split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");
  const astro = read("src/components/hearth/HearthPicker.astro");
  const markup = astro.slice(astro.indexOf("---", 3) + 3);
  const REMOVED = ["Previewing", "It is not saved", "nothing is written", "This house’s Hearth:", "No Hearth chosen", "Make this our Hearth", "Back to the default", "Yes, save it", "Not now",
    "the Hearth everyone sees", "Go back to the default Hearth", "You can change it any time", "You can choose again any time", "Saved.", "is now this house’s Hearth", "now uses the default Hearth",
    "Not saved", "A preview shows how this house would look", "a second yes", "Preview this household in another Hearth design", "Confirm the household's Hearth"];
  for (const words of REMOVED) {
    assert.ok(!code.includes(words), `picker.mjs no longer says "${words}"`);
    assert.ok(!markup.includes(words), `HearthPicker.astro no longer says "${words}"`);
  }
  assert.ok(code.includes("Designed by ${v.author}"), "a presence control: the instrument reads the one line the picker does say");
  assert.equal(unbrace(markup).replace(/<[^>]*>/g, " ").trim(), "", "the markup carries no words of its own: every text is an expression (the credit) or a name inside a tag");
  assert.ok(!/\stitle=/.test(markup), "and no tooltip prose");
  assert.match(markup, /\{by \? `Designed by \$\{by\}` : ""\}/, "the credit, drawn by the server for the design it opens on");
  assert.match(markup, /aria-label="Save this design"/); assert.match(markup, /aria-label="Put the design back"/);
  // Since 2026-11-13 the picker carries two more texts, by a newer ruling (Darko, 13:24 EST: "any hearths that have any scripting in it needs to be disclosed ...
  // via a little badge next to the hearth's name in the dropdown ... an actual site UI pane hover ... super concise"): the badge's word and its pane's one
  // sentence. Both are expressions from listbox.mjs, so the no-words check above still holds, and they are the only other text the markup draws.
  const exprs = [...markup.matchAll(/>\s*\{([A-Z_]+)\}\s*</g)].map((m) => m[1]).sort();
  assert.deepEqual(exprs, ["SCRIPT_BADGE", "SCRIPT_BADGE", "SCRIPT_NOTE"], "the badge (in the list and beside the current name) and its pane are the only added text");
});
