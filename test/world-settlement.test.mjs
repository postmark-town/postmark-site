// world-settlement.test.mjs — THE SITE BAKES THE OFFICE'S SETTLEMENT, AND KEEPS
// THE LAST GOOD WORLD WHEN THE OFFICE DOES NOT ANSWER (POS-360; R3).
//
//   node --test test/world-settlement.test.mjs
//
// The office's answer is a fixture in GET /world/state's shape (office POS-359:
// `meta.source: "settlement"`, `meta.as_of.settlement` and `.digest`). The four
// readers are run for real over a temp site root: the bake (fetch-town.mjs's
// step), the board's loadWorldState, the staged /WORLD/world-state.json export,
// and /build.json's stamp.

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  settlementOfAnswer, bakeDecision, fetchWorldSettlement, bakeWorld, keptSettlement, stampOfBaked, worldFilePath,
} from "../tools/lib/world-settlement.mjs";
import { loadWorldState, notices, BOARD_PLACE } from "../src/lib/board.mjs";
import { stage } from "../town/scripts/world-engine-island.mjs";
import { composeStamp, readSettlement } from "../tools/build-stamp.mjs";

const DIGEST_95 = "9".repeat(64);
const DIGEST_96 = "6".repeat(64);
const answer = (n, digest, marks = [{ id: BOARD_PLACE }, { id: "ann/plot" }]) => ({
  tick: 0, marks, parcels: [], returned: [],
  meta: { source: "settlement", as_of: { settlement: `S${n}`, digest, tag_sha: "c".repeat(40), published_at: "2026-10-07T05:46:00.000Z" } },
});
const respond = (body, status = 200) => async () => ({ ok: status === 200, status, json: async () => body });

function siteRoot() {
  const root = mkdtempSync(join(tmpdir(), "site-world-"));
  mkdirSync(join(root, "src", "data", "postmark"), { recursive: true });
  return root;
}
const writer = (root) => (body) => writeFileSync(worldFilePath(root), JSON.stringify(body, null, 1) + "\n");

test("an office answer is a settlement only when it says so: source, S<n>, a digest, and marks", () => {
  assert.deepEqual(settlementOfAnswer(answer(95, DIGEST_95)), { n: 95, settlement: "S95", digest: DIGEST_95 });
  assert.throws(() => settlementOfAnswer({ marks: [{ id: "x" }], meta: { source: "file", not_settlement: "the store holds no settlement that names a snapshot yet" } }),
    /its file, not a settlement \(the store holds no settlement/);
  assert.throws(() => settlementOfAnswer({ marks: [{ id: "x" }] }), /an unstamped World/, "today's office answer (no meta) is not baked");
  assert.throws(() => settlementOfAnswer({ ...answer(95, DIGEST_95), meta: { source: "settlement", as_of: { settlement: "95", digest: DIGEST_95 } } }), /names no settlement/);
  assert.throws(() => settlementOfAnswer({ ...answer(95, "abc") }), /no snapshot digest/);
  assert.throws(() => settlementOfAnswer(answer(95, DIGEST_95, [])), /no marks/);
  assert.throws(() => settlementOfAnswer(null), /not a World/);
});

test("the bake never goes backwards, and re-bakes the same settlement (an opposition moves its World at once)", () => {
  const s95 = { n: 95, settlement: "S95" }, s96 = { n: 96, settlement: "S96" };
  assert.equal(bakeDecision(s95, null).write, true);
  assert.equal(bakeDecision(s96, s95).write, true);
  assert.equal(bakeDecision(s95, s95).write, true);
  const back = bakeDecision(s95, s96);
  assert.equal(back.write, false);
  assert.match(back.reason, /older than the baked S96; keeping S96/);
});

test("the fetch asks GET /world/state?settlement= of the office API", async () => {
  let asked = null;
  const r = await fetchWorldSettlement({ apiBase: "https://postmark.town/api/", fetchImpl: async (url) => { asked = url; return respond(answer(95, DIGEST_95))(); } });
  assert.equal(asked, "https://postmark.town/api/world/state?settlement=");
  assert.equal(r.settlement, "S95");
  await assert.rejects(fetchWorldSettlement({ apiBase: "x", fetchImpl: respond({}, 503) }), /503/);
});

test("THE OFFICE DOES NOT ANSWER: the build keeps the last good World (R3)", async () => {
  const root = siteRoot();
  try {
    const first = await bakeWorld({ apiBase: "x", root, write: writer(root), fetchImpl: respond(answer(95, DIGEST_95)) });
    assert.equal(first.baked, "S95");
    const bytes = readFileSync(worldFilePath(root), "utf8");
    for (const failing of [respond({}, 502), async () => { throw new Error("ECONNREFUSED"); }, respond({ marks: [{ id: "x" }], meta: { source: "file" } })]) {
      const r = await bakeWorld({ apiBase: "x", root, write: writer(root), fetchImpl: failing });
      assert.equal(r.baked, null);
      assert.equal(r.kept, "S95");
      assert.match(r.line, /keeping the baked S95/);
      assert.equal(readFileSync(worldFilePath(root), "utf8"), bytes, "the kept World is untouched");
    }
    const next = await bakeWorld({ apiBase: "x", root, write: writer(root), fetchImpl: respond(answer(96, DIGEST_96)) });
    assert.equal(next.baked, "S96");
    assert.equal(keptSettlement(root).settlement, "S96");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("the board reads the baked settlement, not an empty board, and the package only as a named floor", () => {
  const root = siteRoot();
  try {
    const baked = worldFilePath(root);
    writeFileSync(baked, JSON.stringify(answer(95, DIGEST_95)));
    const state = loadWorldState({ baked: [baked] });
    assert.equal(state.meta.as_of.settlement, "S95");
    assert.equal(notices(state).boardExists, true);
    assert.equal(notices(state).storeRead, true);
    // No bake in this tree: the package's fold, said so (here, via a require that resolves the fixture).
    const pkg = join(root, "node_modules", "postmark-world");
    mkdirSync(join(pkg, "tools"), { recursive: true });
    mkdirSync(join(pkg, "WORLD"), { recursive: true });
    writeFileSync(join(pkg, "WORLD", "world-state.json"), JSON.stringify({ marks: [{ id: BOARD_PLACE }] }));
    const floor = loadWorldState({ baked: [join(root, "absent.json")], require: { resolve: () => join(pkg, "tools", "geometry.mjs") } });
    assert.equal(floor.meta.source, "package");
    assert.equal(notices(floor).boardExists, true);
    assert.equal(loadWorldState({ baked: [], require: { resolve: () => { throw new Error("no package"); } } }), null);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("the staged /WORLD/world-state.json IS the baked settlement, stamped from its own as_of; the package fold only without one", () => {
  const root = siteRoot();
  const dest = mkdtempSync(join(tmpdir(), "site-world-dest-"));
  try {
    const pkg = join(root, "node_modules", "postmark-world");
    const put = (rel, text) => { mkdirSync(join(rel, ".."), { recursive: true }); writeFileSync(rel, text); };
    put(join(pkg, "spectator", "viewer.mjs"), 'fetch("/WORLD/world-state.json");\n');
    put(join(pkg, "tools", "engine.mjs"), "export const x = 1;\n");
    put(join(pkg, "WORLD", "world-state.json"), '{\n  "tick": 0,\n  "marks": [{ "id": "package/only" }]\n}\n');
    put(join(root, "town", "page.mjs"), 'fetch("/WORLD/world-state.json");\n');
    writeFileSync(worldFilePath(root), JSON.stringify(answer(95, DIGEST_95), null, 1) + "\n");
    stage(pkg, dest, root, {});
    const staged = JSON.parse(readFileSync(join(dest, "WORLD", "world-state.json"), "utf8"));
    assert.equal(staged.settlement, "S95");
    assert.deepEqual(staged.as_of, { n: 95, sha: "c".repeat(40), date: "2026-10-07T05:46:00.000Z" });
    assert.equal(staged.meta.as_of.digest, DIGEST_95);
    assert.deepEqual(staged.marks.map((m) => m.id), [BOARD_PLACE, "ann/plot"], "the office's World, not the package's");
    rmSync(worldFilePath(root));
    stage(pkg, dest, root, {});
    const floor = JSON.parse(readFileSync(join(dest, "WORLD", "world-state.json"), "utf8"));
    assert.deepEqual(floor.marks.map((m) => m.id), ["package/only"]);
  } finally { rmSync(root, { recursive: true, force: true }); rmSync(dest, { recursive: true, force: true }); }
});

test("stampOfBaked names what the office named, and only that", () => {
  assert.equal(stampOfBaked(answer(95, DIGEST_95)).from, "office");
  const bare = stampOfBaked({ meta: { as_of: { settlement: "S95", digest: DIGEST_95 } } });
  assert.equal(bare.settlement, "S95");
  assert.equal(bare.as_of, null);
  assert.match(bare.notes[0], /without its tag commit/);
  assert.equal(stampOfBaked({ marks: [] }).settlement, null);
});

test("build.json names the settlement and its digest, and says so when this tree baked none", () => {
  const root = siteRoot();
  try {
    writeFileSync(worldFilePath(root), JSON.stringify(answer(95, DIGEST_95)));
    assert.deepEqual(readSettlement({ root }), { settlement: "S95", digest: DIGEST_95 });
    const base = { channel: "release", codeSha: "a".repeat(40), codeRef: "release/2026-w42", townDataSha: "b".repeat(40), townSha: "d".repeat(40), crossing: 230, builtAt: "2026-10-07T00:00:00Z", world: { sha: "e".repeat(40), from: "package-lock.json" }, problems: [] };
    const stamp = composeStamp({ ...base, settlement: readSettlement({ root }) });
    assert.equal(stamp.world_settlement, "S95");
    assert.equal(stamp.world_digest, DIGEST_95);
    assert.ok(!stamp.notes.some((n) => /baked no settlement/.test(n)));
    rmSync(worldFilePath(root));
    const none = composeStamp({ ...base, settlement: readSettlement({ root }) });
    assert.equal(none.world_settlement, null);
    assert.equal(none.world_digest, null);
    assert.ok(none.notes.some((n) => /baked no settlement's World \(src\/data\/postmark\/world-state.json is absent\)/.test(n)));
    assert.ok(!existsSync(worldFilePath(root)));
  } finally { rmSync(root, { recursive: true, force: true }); }
});
