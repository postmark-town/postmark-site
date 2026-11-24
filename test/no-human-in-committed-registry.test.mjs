// no-human-in-committed-registry.test.mjs — the registry this public repo commits never carries a household's private `human` (CORE-125).
//
//   node --test test/no-human-in-committed-registry.test.mjs
//
// The office names `human` the one private key of a household row (office src/registry-public.mjs,
// PRIVATE_HOUSE_KEYS, POS-394) and leaves it out of every public read. The site's committed copies of the
// registry (`src/data/postmark/households.json`, `public/atelier/postmark/data/households.json`) once held it on
// six rows, in a public repo. Three layers: the pure drop, the two writers that put a registry on disk, and a scan of
// every committed JSON file. Every house, handle and name here is INVENTED; no real value is read out or printed.

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { PRIVATE_HOUSE_KEYS, publicRegistry } from "../tools/lib/public-registry.mjs";
import { buildOfficeData, jsonText } from "../tools/lib/fetch-town-data.mjs";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..");
const SENTINEL_A = "PRIVATE_SENTINEL_core125_a";
const SENTINEL_B = "PRIVATE_SENTINEL_core125_b";
const leaks = (x) => { const s = JSON.stringify(x); return s.includes(SENTINEL_A) || s.includes(SENTINEL_B); };

const REGISTRY = { schema_version: 1, note: "invented", households: {
  "lantern-row": { human: SENTINEL_A, accounts: ["ash"], residents: ["ash", "birch"], since: "2026-08-01", declared_by: "ash", name: "Lantern Row", member_of: "the-row" },
  "no-name-hall": { human: SENTINEL_B, accounts: ["cedar"], residents: ["cedar"], since: "2026-08-02", declared_by: "cedar" },
  "quiet-house": { accounts: ["elm"], residents: ["elm"], since: "2026-08-03", declared_by: "elm", name: "Quiet House" },
} };

// Every household row, in any JSON file, that carries a `human` key: a row is a value of an object held under a `households` key.
export function rowsWithHuman(value, path = "$") {
  const found = [];
  if (Array.isArray(value)) { value.forEach((v, i) => found.push(...rowsWithHuman(v, `${path}[${i}]`))); return found; }
  if (!value || typeof value !== "object") return found;
  for (const [key, child] of Object.entries(value)) {
    if (key === "households" && child && typeof child === "object" && !Array.isArray(child)) {
      for (const [slug, row] of Object.entries(child)) if (row && typeof row === "object" && "human" in row) found.push(`${path}.households[${slug}]`);
    }
    found.push(...rowsWithHuman(child, `${path}.${key}`));
  }
  return found;
}

function jsonFilesUnder(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...jsonFilesUnder(p));
    else if (name.endsWith(".json")) out.push(p);
  }
  return out;
}

test("publicRegistry drops `human` from every row and changes nothing else", () => {
  const before = JSON.stringify(REGISTRY);
  const out = publicRegistry(REGISTRY);
  assert.deepEqual(PRIVATE_HOUSE_KEYS, ["human"]);
  for (const [slug, row] of Object.entries(out.households)) assert.equal("human" in row, false, `${slug}: no human key, not even null`);
  assert.equal(leaks(out), false, "no private value anywhere in the output");
  assert.equal(JSON.stringify(REGISTRY), before, "the registry handed in is unchanged");
  assert.equal(leaks(REGISTRY), true, "CONTROL: the private input still holds the values");
  const expected = structuredClone(REGISTRY);
  for (const row of Object.values(expected.households)) delete row.human;
  assert.equal(JSON.stringify(out), JSON.stringify(expected), "every other key, on the top and on each row, in its own order");
  assert.deepEqual(publicRegistry({ schema_version: 1 }), { schema_version: 1 }, "a value that is not a registry passes through");
  assert.equal(publicRegistry(null), null);
});

test("publicRegistry strips a shape it does not know, and never throws", () => {
  const arrayShaped = publicRegistry({ households: [{ slug: "a", human: SENTINEL_A }, "x", null, { slug: "b" }] });
  assert.deepEqual(arrayShaped, { households: [{ slug: "a" }, "x", null, { slug: "b" }] }, "an array of rows: each row loses the key, a non-object row has none to lose");
  assert.equal(leaks(publicRegistry({ human: SENTINEL_A, schema_version: 1, households: {} })), false, "the registry's own top-level key");
  assert.deepEqual(publicRegistry({ households: { a: "not a row", b: 3, c: null, d: ["x"] } }), { households: { a: "not a row", b: 3, c: null, d: ["x"] } }, "rows that are not objects pass as they are");
  assert.deepEqual(publicRegistry({ households: "nope" }), { households: "nope" });
  assert.equal(leaks(publicRegistry({ households: { a: { human: SENTINEL_A }, b: { human: SENTINEL_B } } })), false);
});

// ── the writers ───────────────────────────────────────────────────────────────────────────────────────────────

/** A minimal office: every door the build reads answers, GET /households carries `registry` when `registry` is given. */
function office({ registry = null } = {}) {
  const routes = new Map([
    ["/town", { as_of: "abc123", counts: { residents: 0, letters: 0, threads: 0, ledger: 0, bulletin: 0 }, offices: [] }],
    ["/residents", []],
    ["/metrics/mail", { as_of: "2026-07-02", days: [], totals: { deliveries: 0, bounces: 0, letters: 0, threads: 0, residents: 0 }, active_threads: 0 }],
    ["/bulletin", []],
    ["/calendar", { as_of: "2026-07-02T00:00:00.000Z", now: [], coming: [], ended: [], total: 0 }],
    ["/posts", { as_of: "2026-07-02T00:00:00.000Z", class: "quest", finished: ["closed"], total: 0, posts: [] }],
    ["/posts?class=idea", { as_of: "2026-07-02T00:00:00.000Z", class: "idea", finished: ["shipped"], total: 0, posts: [] }],
    ["/letters", { total: 0, shown: 0, count: 0, limit: 200, offset: 0, complete: true, full: true, letters: [] }],
  ]);
  if (registry) routes.set("/households", { read: "households", registry, pins: {} });
  return async (url) => {
    const u = new URL(url);
    const body = routes.get(`${u.pathname}${u.search}`) ?? routes.get(u.pathname);
    const headers = { get: (name) => (name.toLowerCase() === "x-postmark-as-of" ? "abc123" : null) };
    if (!body) return { ok: false, status: 404, statusText: "Not Found", headers, json: async () => ({}) };
    return { ok: true, status: 200, statusText: "OK", headers, json: async () => JSON.parse(JSON.stringify(body)) };
  };
}

function snapshotDir(households) {
  const dir = join(mkdtempSync(join(tmpdir(), "core125-")), "data");
  mkdirSync(dir, { recursive: true });
  if (households) writeFileSync(join(dir, "households.json"), jsonText(households));
  return dir;
}

test("fetch-town's households.json drops `human`, whether the office's live registry or the kept snapshot carries it", async () => {
  const live = await buildOfficeData({ apiBase: "https://office.test", dataDir: snapshotDir(null), fetchImpl: office({ registry: REGISTRY }), retries: 1 });
  assert.equal(live.householdsLive, true, "the registry came through the live door");
  assert.deepEqual(Object.keys(live.files["households.json"].households), Object.keys(REGISTRY.households), "every house is still there");
  assert.equal(leaks(live.files["households.json"]), false, "live: no private value written");

  const kept = await buildOfficeData({ apiBase: "https://office.test", dataDir: snapshotDir(REGISTRY), fetchImpl: office(), retries: 1 });
  assert.equal(kept.householdsLive, false, "the registry is the kept snapshot");
  assert.equal(Object.keys(kept.files["households.json"].households).length, 3, "CONTROL: the snapshot's rows were read, not an empty registry");
  assert.equal(leaks(kept.files["households.json"]), false, "snapshot: no private value written");
  assert.equal(jsonText(kept.files["households.json"]), jsonText(publicRegistry(REGISTRY)), "everything else on the rows is as it was");
});

test("extract-town's emit drops `human` from households.json and leaves every other file alone", () => {
  const src = readFileSync(join(ROOT, "tools", "extract-town.mjs"), "utf8");
  const start = src.indexOf("const emit = (name, value) => {");
  const end = src.indexOf("\n};", start);
  assert.ok(start >= 0 && end > start, "the emit helper is where the build keeps it");
  const written = [];
  const emit = new Function("publicRegistry", "writeIfChanged", "join", "DATA_DIR", "PUB_DATA", "pubWanted", "console",
    `${src.slice(start, end + 3)}\nreturn emit;`)(
    publicRegistry, (path, text) => { written.push([path, text]); return "wrote"; }, (...p) => p.join("/"), "src-data", "pub-data", new Set(), { log() {} });
  emit("households.json", REGISTRY);
  emit("friendships.json", REGISTRY);
  const byFile = (dir, name) => written.find(([p]) => p === `${dir}/${name}`)?.[1];
  for (const dir of ["src-data", "pub-data"]) {
    assert.equal(byFile(dir, "households.json") !== undefined && leaks(byFile(dir, "households.json")), false, `${dir}/households.json: no private value written`);
    assert.equal(leaks(byFile(dir, "friendships.json")), true, `CONTROL: ${dir}/friendships.json is another file's value, written as given`);
  }
});

// ── the committed files ────────────────────────────────────────────────────────────────────────────────────────

test("rowsWithHuman finds a row's `human`, however deep the registry sits, and finds nothing in a clean one", () => {
  assert.deepEqual(rowsWithHuman(REGISTRY), ["$.households[lantern-row]", "$.households[no-name-hall]"]);
  assert.deepEqual(rowsWithHuman({ nested: { deeper: [{ households: { x: { human: null } } }] } }), ["$.nested.deeper[0].households[x]"], "null counts: the key itself is the leak");
  assert.deepEqual(rowsWithHuman(publicRegistry(REGISTRY)), []);
  assert.deepEqual(rowsWithHuman({ households: [{ human: "x" }] }), [], "only a households map has rows; a bare array is not one");
});

test("no committed data file under public/ or src/data/ carries a household row with a `human` key", () => {
  const files = [...jsonFilesUnder(join(ROOT, "public")), ...jsonFilesUnder(join(ROOT, "src", "data"))];
  const registries = files.filter((f) => /[\\/]households\.json$/.test(f));
  assert.equal(registries.length, 2, "CONTROL: both committed copies of the registry were reached by the scan");
  assert.ok(files.length > registries.length, "CONTROL: the scan reached files beyond the registries");
  const bad = [];
  for (const f of files) {
    let json;
    try { json = JSON.parse(readFileSync(f, "utf8")); } catch { continue; }
    for (const where of rowsWithHuman(json)) bad.push(`${relative(ROOT, f).replaceAll("\\", "/")} ${where}`);
  }
  assert.deepEqual(bad, [], "the registry is committed in a public repo: a household row's `human` is private (office PRIVATE_HOUSE_KEYS)");
});

// ── the test fixtures ─────────────────────────────────────────────────────────────────────────────────────────
//
// A test file is committed too, and a household row copied into one from the live registry is the same leak
// (test/houses.test.mjs once held two). A TEXT scan, the weakest instrument: it sees a line, not an object. A
// `human:` with a string literal is a leak unless it is an invented PRIVATE_SENTINEL_… value, when a household-shaped
// line sits within two lines of it (`residents`, `declared`, `households`). It does not see a value built in code
// (`human: someVariable`) or a household written across more than five lines; the committed-JSON scan above and the
// writers' tests are the behavioural readers beside it.
const HUMAN_LITERAL = /\bhuman\s*:\s*(["'`])((?:(?!\1).)*)\1/;
const HOUSEHOLD_SHAPE = /\bresidents\b|\bdeclared(?:_by)?\b|\bhouseholds\b/;
const INVENTED = /^PRIVATE_SENTINEL_/;

export function householdHumanLiterals(text) {
  const lines = text.split(/\r?\n/);
  const found = [];
  lines.forEach((line, i) => {
    const m = HUMAN_LITERAL.exec(line);
    if (!m || INVENTED.test(m[2])) return;
    if (lines.slice(Math.max(0, i - 2), i + 3).some((l) => HOUSEHOLD_SHAPE.test(l))) found.push(i + 1);
  });
  return found;
}

// GENERATED OUTPUT IS NOT COMMITTED (CORE-167). test/incremental-build.test.mjs runs a real `astro build` over test/fixtures/incremental-site, and Astro keeps its working files under the
// fixture root (`.astro/`, its `.prerender` chunks) while it builds; they are git-ignored and exist only mid-run, so walking them is both outside this audit's claim (a COMMITTED file) and a race
// with that build (ENOENT on a chunk the build has just replaced). The walk skips those folders by name BEFORE it descends, so nothing in them is listed or read. A SOURCE file of a fixture
// (its pages, data and config) is still walked and scanned: only the folders a build generates are skipped, and a test below pins that both halves hold.
const GENERATED_DIRS = new Set(["node_modules", ".astro", ".prerender", "dist", "dist-town"]);

function testFilesUnder(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (GENERATED_DIRS.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...testFilesUnder(p));
    else if (/\.(mjs|js|json)$/.test(name)) out.push(p);
  }
  return out;
}

test("householdHumanLiterals flags a household row's real-looking human and nothing else", () => {
  const row = (v) => `  "a-house": { human: "${v}", residents: ["x"] },`;
  assert.deepEqual(householdHumanLiterals(row("Someone Real")), [1], "an ordinary literal in a household row");
  assert.deepEqual(householdHumanLiterals(row("PRIVATE_SENTINEL_x")), [], "an invented sentinel is allowed");
  assert.deepEqual(householdHumanLiterals(`  { human: 'Someone Real',\n    since: "2026-01-01",\n    residents: ["x"] }`), [1], "a row split over lines, single quotes");
  assert.deepEqual(householdHumanLiterals(`seat: { ground: "g", seat: "rei", human: "Someone Real" },`), [], "CONTROL: not household-shaped (a seat)");
  assert.deepEqual(householdHumanLiterals(`// a household's human: "the person"`), [], "prose in a comment with no household shape near it");
  assert.deepEqual(householdHumanLiterals(`{ human: someVariable, residents: ["x"] }`), [], "a value built in code is not a literal (named limit)");
});

test("the fixture walk skips a build's generated folders and still scans a fixture's source (CORE-167)", () => {
  // INVENTED tree in a temp folder: a half-built fixture beside its source. The forbidden-shaped literal is the same invented shape householdHumanLiterals is tested with above.
  const leak = `export const rows = { "a-house": { human: "Someone Real", residents: ["x"] } };\n`;
  const root = mkdtempSync(join(tmpdir(), "core167-"));
  const put = (rel, text) => { const p = join(root, rel); mkdirSync(join(p, ".."), { recursive: true }); writeFileSync(p, text); };
  put("fixtures/site/src/data.mjs", leak);                    // SOURCE: must be walked, and its literal found
  put("fixtures/site/src/pages/page.json", `{"households":{"a-house":{"human":"Someone Real"}}}`);
  put("fixtures/site/.astro/.prerender/chunk.mjs", leak);       // GENERATED mid-build: never walked, never read
  put("fixtures/site/dist/out.mjs", leak);
  put("fixtures/site/node_modules/pkg/index.mjs", leak);
  const seen = testFilesUnder(root).map((f) => relative(root, f).replaceAll("\\", "/")).sort();
  assert.deepEqual(seen, ["fixtures/site/src/data.mjs", "fixtures/site/src/pages/page.json"], "the source files are scanned; the generated folders are not even listed");
  const flagged = seen.filter((f) => householdHumanLiterals(readFileSync(join(root, f), "utf8")).length > 0 || rowsWithHuman(f.endsWith(".json") ? JSON.parse(readFileSync(join(root, f), "utf8")) : {}).length > 0);
  assert.deepEqual(flagged, ["fixtures/site/src/data.mjs", "fixtures/site/src/pages/page.json"], "CONTROL: a forbidden-shaped literal in a fixture's SOURCE is still detected, in code and in JSON");
  // the skip is by exact folder name: a SOURCE folder that merely looks similar is still walked
  put("fixtures/site/src/distance/near.mjs", leak);
  assert.ok(testFilesUnder(root).some((f) => f.endsWith("distance/near.mjs") || f.endsWith("distance\\near.mjs")), "a source folder whose name only begins like a generated one (distance/) is still walked");
});

test("no tracked test file or fixture holds a household row with a real-looking `human` value", () => {
  const files = testFilesUnder(join(ROOT, "test")).filter((f) => !f.endsWith("no-human-in-committed-registry.test.mjs"));
  assert.ok(files.some((f) => f.endsWith("houses.test.mjs")), "CONTROL: the scan reached the file that once held two");
  assert.ok(files.length > 100, "CONTROL: the scan reached the suite, not a handful");
  const bad = [];
  for (const f of files) {
    const text = readFileSync(f, "utf8");
    const at = relative(ROOT, f).replaceAll("\\", "/");
    for (const n of householdHumanLiterals(text)) bad.push(`${at}:${n}`);
    if (f.endsWith(".json")) {
      let json;
      try { json = JSON.parse(text); } catch { continue; }
      for (const where of rowsWithHuman(json)) bad.push(`${at} ${where}`);
    }
  }
  assert.deepEqual(bad, [], "a test's household rows use invented values (PRIVATE_SENTINEL_…), never a copy of the live registry");
});
