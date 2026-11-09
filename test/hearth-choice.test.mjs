// hearth-choice.test.mjs — the household's saved Hearth: the resolver, the read, the write, and the picker (POS-962).
//
// Ruled (Darko 10-22, POS-684/c): the office keeps the choice; read on every load; changed any time. Wright 11-09: the saved choice decides what the
// house draws for everyone, unset keeps the default, a PREVIEW NEVER SAVES, another household cannot change it. Fixtures only; the office is a
// fake here and the real one is tested in the office repo (test/household-hearth.test.mjs).
//
//   § 1  whichDesign (the ONE selector): saved, default, preview, unregistered, unavailable
//   § 2  the read (signed out) and the write (signed in)
//   § 3  the picker: a preview never saves; the save takes a second yes; refusals; the default
//   § 4  the wiring: the only write is the confirmed save
//
//   node --test test/hearth-choice.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { designNote, readSavedHearth, saveHearth, savedHearthFrom } from "../src/lib/hearth/choice.mjs";
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
  assert.equal(picker.view().previewing, true); assert.match(picker.view().previewLine, /not saved/);
  picker.preview("not-registered"); assert.equal(picker.view().shown, "orchard", "an unregistered id is no preview");
});

test("§ 3 saving takes two more steps: ask() raises only a question; confirm() is the one write; cancel() writes nothing", async () => {
  const { picker, log } = harness();
  picker.preview("ledger");
  assert.equal(picker.view().canSave, true);
  const q = picker.ask();
  assert.match(q.question, /Make The Ledger the Hearth everyone sees at \/households\/ember-lane\/\? You can change it any time\./);
  assert.deepEqual(log.saves, [], "the question is not a save");
  picker.cancel(); await picker.confirm(); assert.deepEqual(log.saves, [], "cancelled: nothing, and confirm() with nothing asked does nothing");
  picker.ask(); const done = await picker.confirm();
  assert.deepEqual(log.saves, [{ slug: "ember-lane", id: "ledger" }]);
  assert.equal(done.savedId, "ledger"); assert.match(done.said, /Saved\. The Ledger is now this house/);
  assert.equal(done.previewing, false);
});

test("§ 3 a refused save leaves the saved choice and says so in the office's words; the default goes back through the same confirmation", async () => {
  const refused = harness({ result: { ok: false, status: 403, message: "only an account the town's record binds to this household can choose its Hearth" } });
  refused.picker.preview("orchard"); refused.picker.ask();
  const after = await refused.picker.confirm();
  assert.equal(after.savedId, null, "nothing was saved"); assert.match(after.said, /^Not saved: only an account/);
  const { picker, log } = harness({ opts: { saved: "ledger" } });
  assert.equal(picker.view().canClear, true);
  const q = picker.clear(); assert.match(q.question, /Go back to the default Hearth/);
  assert.deepEqual(log.saves, []);
  const cleared = await picker.confirm();
  assert.deepEqual(log.saves, [{ slug: "ember-lane", id: null }]);
  assert.equal(cleared.savedId, null); assert.match(cleared.said, /default Hearth/);
});

test("§ 3 a visitor who is not the house's signed-in human has no way to save: no controls, and ask/clear/confirm do nothing", async () => {
  const { picker, log } = harness({ opts: { signedIn: false, saved: "ledger" } });
  picker.preview("orchard");
  const v = picker.view();
  assert.deepEqual([v.controls, v.canSave, v.canClear], [false, false, false]);
  picker.ask(); picker.clear(); await picker.confirm();
  assert.deepEqual(log.saves, []);
  let state = false;
  const live = createPicker({ entries: ENTRIES, slug: "x", saved: null, signedIn: () => state, save: async () => ({ ok: true, hearth: "ledger" }) });
  live.preview("ledger"); assert.equal(live.view().controls, false);
  state = true; assert.equal(live.view().controls, true, "the sign-in can change under a mounted picker");
});

// ── § 4 the wiring ──────────────────────────────────────────────────────────

test("§ 4 the only code that writes the choice is choice.mjs § saveHearth, reached only from the confirmed save", () => {
  const read = (p) => readFileSync(join(ROOT, p), "utf8");
  const writers = ["src/lib/hearth/stage.mjs", "src/lib/hearth/picker.mjs", "src/lib/hearth/choice.mjs", "src/components/hearth/Hearth.astro", "src/components/hearth/HearthPicker.astro"]
    .filter((p) => /method:\s*"PATCH"|\/hearth`/.test(read(p)));
  assert.deepEqual(writers, ["src/lib/hearth/choice.mjs"]);
  const picker = read("src/lib/hearth/picker.mjs");
  assert.equal((picker.match(/await save\(/g) ?? []).length, 1, "one call to the write, in confirm()");
  assert.match(read("src/lib/hearth/stage.mjs"), /whichDesign\(entries, \{ entry: asked, saved \}\)/, "the stage asks the one selector");
  assert.equal(/pickEntry/.test(read("src/lib/hearth/stage.mjs")), false, "and has no selection policy of its own");
  assert.match(read("src/components/hearth/Hearth.astro"), /<HearthPicker /);
});
