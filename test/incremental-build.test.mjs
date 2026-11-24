// incremental-build.test.mjs — an incremental build publishes the bytes a full build would (POS-1085).
//
//   node --test test/incremental-build.test.mjs
//
// LAW (POS-1085, Darko 2026-11-16 13:53 EST): "incremental builds is a must that we
// should have implemented yesterday." Acceptance: "The published site is
// byte-identical to a full build of the same inputs (a test compares the two on a
// fixture)"; "A full rebuild stays available on demand"; "Release notes say which."
//
// WHAT IT RUNS. The real `astro build` over test/fixtures/incremental-site, through
// the real tools/incremental-build.mjs and the real src/lib/incremental.mjs: a
// full build, then data changes, then an incremental build from the full one's
// manifest and output, each compared file by file with a FULL build of the same
// changed data. A second pass with nothing changed, and the fall-backs.
// The fixture's own data lives in a temp folder (FIXTURE_DATA), never in the tree.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(HERE, "fixtures", "incremental-site");
const SCRIPT = join(HERE, "..", "tools", "incremental-build.mjs");
const WORK = mkdtempSync(join(tmpdir(), "incr-test-"));
const DATA = join(WORK, "threads.json");
const CODE = "src,astro.config.mjs,../../../src/lib/incremental.mjs";

const base = () => [
  { slug: "a", title: "Alpha", body: "first" },
  { slug: "b", title: "Beta", body: "second" },
  { slug: "c", title: "Gamma", body: "third" },
  { slug: "d", title: "Delta", body: "fourth" },
  { slug: "e", title: "Epsilon", body: "fifth" },
  { slug: "f", title: "Zeta", body: "sixth" },
];
const setData = (threads) => writeFileSync(DATA, JSON.stringify(threads));

function build(label, { prev = null, full = false, env = {}, code = CODE, dirty = false } = {}) {
  const manifest = join(WORK, `${label}.manifest.json`);
  const out = join(WORK, `${label}.dist`); // a folder no build has touched: Astro clears an outDir's files, not its sub-folders
  // a file in a sub-folder, as an earlier build leaves them: Astro clears an outDir's top-level files, not its folders (measured)
  if (dirty) { mkdirSync(join(out, "t", "gone"), { recursive: true }); writeFileSync(join(out, "t", "gone", "index.html"), "stale"); }
  const args = [SCRIPT, "--root", FIXTURE, "--config", "astro.config.mjs", "--out-dir", out, "--code", code, "--out-manifest", manifest];
  if (prev) args.push("--prev-manifest", prev.manifest, "--prev-dir", prev.dir);
  if (full) args.push("--full");
  const r = spawnSync(process.execPath, args, { env: { ...process.env, FIXTURE_DATA: DATA, FIXTURE_OUT: out, ...env }, encoding: "utf8" });
  assert.equal(r.status, 0, `the build ${label} exited ${r.status}\n${r.stdout}\n${r.stderr}`);
  return { manifest, dir: out, meta: JSON.parse(readFileSync(manifest, "utf8")).meta, log: r.stdout };
}

function files(dir, out = new Map(), root = dir) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) files(p, out, root);
    else out.set(relative(root, p).split(sep).join("/"), p);
  }
  return out;
}

/** Every file in A and B, by path and bytes. Returns the differences (empty means identical). */
function compareDirs(a, b) {
  const A = files(a), B = files(b);
  const diffs = [];
  for (const k of A.keys()) if (!B.has(k)) diffs.push(`only in first: ${k}`);
  for (const k of B.keys()) if (!A.has(k)) diffs.push(`only in second: ${k}`);
  for (const [k, p] of A) if (B.has(k) && !readFileSync(p).equals(readFileSync(B.get(k)))) diffs.push(`bytes differ: ${k}`);
  return { diffs, count: A.size };
}

after(() => rmSync(WORK, { recursive: true, force: true })); // the temp folder this file made itself

test("control: the comparer can fail (a differing byte, a missing file, an extra one)", () => {
  const x = join(WORK, "cmp-x"), y = join(WORK, "cmp-y");
  cpSync(join(FIXTURE, "src", "pages"), x, { recursive: true });
  cpSync(join(FIXTURE, "src", "pages"), y, { recursive: true });
  assert.deepEqual(compareDirs(x, y).diffs, []);
  writeFileSync(join(y, "index.astro"), "changed");
  writeFileSync(join(y, "extra.txt"), "x");
  const { diffs } = compareDirs(x, y);
  assert.ok(diffs.includes("bytes differ: index.astro"), diffs.join("\n"));
  assert.ok(diffs.includes("only in second: extra.txt"), diffs.join("\n"));
});

let full1; // the full build of the data as it starts: the "previous release"

test("a full build says so, and records every converted route", () => {
  setData(base());
  full1 = build("full1", { full: true });
  assert.equal(full1.meta.kind, "full");
  assert.match(full1.meta.reason, /full build was asked for/);
  assert.match(full1.log, /build kind: full/);
  // 6 threads, two route files: 12 converted routes, all rendered; the index is not converted
  assert.equal(full1.meta.converted_routes, 12);
  assert.equal(full1.meta.converted_rendered, 12);
  assert.ok(existsSync(join(full1.dir, "t", "a", "index.html")) && existsSync(join(full1.dir, "t", "a.json")) && existsSync(join(full1.dir, "index.html")));
});

test("one letter changed: only the affected routes render, and the output is byte-identical to a full build", () => {
  const next = base();
  next[3] = { ...next[3], body: "fourth, with one more line" }; // d's body: d's page and d's json, nothing else
  setData(next);
  const inc = build("inc-body", { prev: full1 });
  const ref = build("ref-body", { full: true });
  assert.equal(inc.meta.kind, "incremental");
  assert.match(inc.log, /build kind: incremental/);
  assert.equal(inc.meta.converted_rendered, 2, `rendered ${inc.meta.converted_rendered} of ${inc.meta.converted_routes}`);
  assert.equal(inc.meta.converted_routes, 12);
  const { diffs, count } = compareDirs(inc.dir, ref.dir);
  assert.deepEqual(diffs, []);
  assert.equal(count, 13, `compared ${count} files`); // 12 converted routes + the index (the fixture's script and style are inlined)
  // and the change really is in the bytes both sides share (not a build that ignored the data)
  assert.match(readFileSync(join(inc.dir, "t", "d", "index.html"), "utf8"), /one more line/);
  assert.match(readFileSync(join(inc.dir, "t", "d.json"), "utf8"), /one more line/);
});

test("a change shown on a NEIGHBOUR's page rebuilds that page too (a read through props is a read in the key)", () => {
  const next = base();
  next[2] = { ...next[2], title: "Gamma, renamed" }; // b's page shows "next: <c's title>"
  setData(next);
  const inc = build("inc-title", { prev: full1 });
  const ref = build("ref-title", { full: true });
  assert.equal(inc.meta.kind, "incremental");
  assert.equal(inc.meta.converted_rendered, 3); // c's page, c's json, and b's page
  assert.deepEqual(compareDirs(inc.dir, ref.dir).diffs, []);
  assert.match(readFileSync(join(inc.dir, "t", "b", "index.html"), "utf8"), /Gamma, renamed/);
});

test("nothing changed: no converted route renders, and the output is still byte-identical", () => {
  setData(base());
  const inc = build("inc-none", { prev: full1 });
  const ref = build("ref-none", { full: true });
  assert.equal(inc.meta.kind, "incremental");
  assert.equal(inc.meta.converted_rendered, 0);
  assert.deepEqual(compareDirs(inc.dir, ref.dir).diffs, []);
});

test("a new and a removed route: the new one renders, the removed one is not carried", () => {
  const next = base().filter((t) => t.slug !== "e");
  next.push({ slug: "g", title: "Eta", body: "seventh" });
  setData(next);
  const inc = build("inc-shape", { prev: full1 });
  const ref = build("ref-shape", { full: true });
  assert.equal(inc.meta.kind, "incremental");
  assert.deepEqual(compareDirs(inc.dir, ref.dir).diffs, []);
  assert.ok(!existsSync(join(inc.dir, "t", "e", "index.html")), "a removed route's page was carried over");
  assert.ok(existsSync(join(inc.dir, "t", "g", "index.html")));
});

test("falls back to a full build: no previous release, a moved global key, a missing carried file, a damaged manifest", () => {
  setData(base());
  const none = build("fb-none", {});
  assert.equal(none.meta.kind, "full");
  assert.match(none.meta.reason, /no previous release/);

  const env = build("fb-env", { prev: full1, env: { PUBLIC_CHANNEL: "release" } });
  assert.equal(env.meta.kind, "full");
  assert.match(env.meta.reason, /global key moved/);

  // the previous release lost a file the new manifest says to carry: the check refuses, and the build is redone in full
  const holed = join(WORK, "holed.dist");
  cpSync(full1.dir, holed, { recursive: true, filter: (p) => !p.endsWith(`${sep}b${sep}index.html`) });
  const lost = build("fb-lost", { prev: { manifest: full1.manifest, dir: holed } });
  assert.equal(lost.meta.kind, "full");
  assert.match(lost.meta.reason, /did not hold.*no t\/b\/index\.html/);
  assert.deepEqual(compareDirs(lost.dir, build("ref-lost", { full: true }).dir).diffs, []);

  const junk = join(WORK, "junk.manifest.json");
  writeFileSync(junk, "{not json");
  const bad = build("fb-bad", { prev: { manifest: junk, dir: full1.dir } });
  assert.equal(bad.meta.kind, "full");
  assert.match(bad.meta.reason, /unreadable/);
});

test("a change to the code moves the global key: the next build is full", () => {
  const extra = join(WORK, "extra-code.mjs"); // a file the build counts as code, outside the fixture
  writeFileSync(extra, "export const v = 1;\n");
  const code = `${CODE},${extra}`;
  const first = build("code-a", { full: true, code });
  const same = build("code-b", { prev: first, code }); // control: the code did not move, so the build is incremental
  assert.equal(same.meta.kind, "incremental");
  writeFileSync(extra, "export const v = 2;\n");
  const moved = build("code-c", { prev: first, code });
  assert.equal(moved.meta.kind, "full");
  assert.match(moved.meta.reason, /global key moved/);
});

test("every variable the site's code reads while it builds moves the global key (PUBLIC_*, BUILD_*, TOWN_TZ, SEAM_FIXTURE, PREVIEW_BASE)", () => {
  setData(base());
  for (const env of [{ PUBLIC_X: "1" }, { BUILD_TOWN_SHA: "abc" }, { TOWN_TZ: "UTC" }, { SEAM_FIXTURE: "1" }, { PREVIEW_BASE: "/preview/x/" }]) {
    const name = Object.keys(env)[0];
    const r = build(`env-${name}`, { prev: full1, env });
    assert.equal(r.meta.kind, "full", `${name} did not move the global key`);
    assert.match(r.meta.reason, /global key moved/);
  }
  // control: a variable the site never reads does not
  assert.equal(build("env-none", { prev: full1, env: { SOMETHING_ELSE: "1" } }).meta.kind, "incremental");
});

test("a dirty output dir: an incremental build is refused it (full instead, with the reason); a full build may run in it", () => {
  setData(base());
  const dirtyInc = build("dirty-inc", { prev: full1, dirty: true });
  assert.equal(dirtyInc.meta.kind, "full");
  assert.match(dirtyInc.meta.reason, /output dir is not empty/);
  assert.match(dirtyInc.log, /already holds 1 entries/);
  const dirtyFull = build("dirty-full", { full: true, dirty: true });
  assert.equal(dirtyFull.meta.kind, "full");
  assert.match(dirtyFull.meta.reason, /full build was asked for/);
  assert.ok(existsSync(join(dirtyFull.dir, "t", "gone", "index.html")), "the script deleted a file it did not make");
  // and into an empty one the same previous release is carried from (control)
  assert.equal(build("dirty-ctl", { prev: full1 }).meta.kind, "incremental");
});

test("a carried page that names an /_astro file the new build did not write is refused: full instead", () => {
  setData(base());
  const ghost = join(WORK, "ghost.dist");
  cpSync(full1.dir, ghost, { recursive: true });
  const page = join(ghost, "t", "b", "index.html");
  writeFileSync(page, readFileSync(page, "utf8").replace("</body>", '<script src="/_astro/ghost.AbC123.js"></script></body>'));
  const r = build("ghost-run", { prev: { manifest: full1.manifest, dir: ghost } });
  assert.equal(r.meta.kind, "full");
  assert.match(r.meta.reason, /did not hold.*ghost\.AbC123\.js/);
});

test("a read hidden in a converted page's component is caught: the byte-compare goes red (the proof has teeth)", () => {
  // FIXTURE_HIDDEN=1 makes Count.astro show how many threads exist, a fact no route's props carry.
  const env = { FIXTURE_HIDDEN: "1" };
  setData(base());
  const prev = build("hid-prev", { full: true, env });
  setData([...base(), { slug: "g", title: "Eta", body: "seventh" }]);
  const inc = build("hid-inc", { prev, env });
  const ref = build("hid-ref", { full: true, env });
  assert.equal(inc.meta.kind, "incremental", "the key cannot see the hidden read, which is the point");
  const { diffs } = compareDirs(inc.dir, ref.dir);
  assert.ok(diffs.includes("bytes differ: t/a/index.html"), `the stale carried page was not caught:\n${diffs.join("\n")}`);
  assert.match(readFileSync(join(inc.dir, "t", "a", "index.html"), "utf8"), /6 threads/);
  assert.match(readFileSync(join(ref.dir, "t", "a", "index.html"), "utf8"), /7 threads/);
  // the page graph test (test/incremental-pages.test.mjs) is what stops this in the real site; this case proves the compare itself can see it
});

// ── THE SEASON, NOT THE NUMBER (POS-1191/a, Darko 2026-11-23 19:56 EST: "Yeah, I think I'm down to try
//    Jetto's proposal") ─────────────────────────────────────────────────────────────────────────────────
// The raw crossing no longer moves the key; what pages derive from it does (tools/incremental-build.mjs §
// seasonState). The fixture has no Mists, so a new crossing alone keeps its build incremental. The real site's
// season, read through its own mists-season.mjs and the pinned world, stays put inside a season and moves at
// each boundary, so a boundary still builds in full.
const SITE = join(HERE, "..");
const { seasonState } = await import(pathToFileURL(join(SITE, "tools", "incremental-build.mjs")).href);

test("a new crossing alone does not move the global key (BUILD_CROSSING is keyed by its season, not its number)", () => {
  setData(base());
  assert.equal(build("crossing-only", { prev: full1, env: { BUILD_CROSSING: "318" } }).meta.kind, "incremental");
});

test("the season moves at a boundary and holds inside one: the Mists' arrival, the ramp, a steady season", async () => {
  const sk = JSON.parse(readFileSync(join(SITE, "node_modules", "postmark-world", "WORLD", "skeleton.json"), "utf8"));
  const first = sk.mists?.schedule?.[0]?.crossing;
  assert.ok(Number.isFinite(first), "the pinned world's skeleton names the Mists' first crossing");
  const at = (c) => seasonState(SITE, { BUILD_CROSSING: String(c) });
  // no crossing named, and the crossing before the Mists: nothing derived, one state
  assert.equal(await seasonState(SITE, {}), "no-mists");
  assert.equal(await at(first - 1), "no-mists");
  // the Mists arrive: a boundary, so the key moves and the next build is full
  assert.notEqual(await at(first), await at(first - 1));
  // the ramp: each step of t is a page change, so it moves the key
  assert.notEqual(await at(first), await at(first + 1));
  // the Mists end: a boundary too (the schedule's last rung lifts the veil), so it moves the key
  const last = sk.mists.schedule.at(-1).crossing;
  assert.notEqual(await at(last - 1), await at(last));
  // a steady season: after the Mists every crossing shares one state, so a pass between crossings and across
  // them stays incremental (the point of the change). While the Mists stand, the home page's line is the
  // world's line for that crossing, so each of those passes still builds in full, as it should.
  for (let c = last; c < last + 60; c++) assert.equal(await at(c + 1), await at(c), `crossing ${c}->${c + 1} moved the key outside the Mists`);
});

test("no page reads BUILD_CROSSING except through mists-season.mjs (a direct read would escape the season key)", () => {
  const hits = [];
  const walk = (d) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p); else if (/\.(astro|mjs|js|ts)$/.test(n)) for (const [i, l] of readFileSync(p, "utf8").split("\n").entries()) if (/BUILD_CROSSING/.test(l) && !/^\s*(\/\/|\*|\/\*)/.test(l)) hits.push(`${relative(SITE, p)}:${i + 1}`); } };
  walk(join(SITE, "src"));
  assert.deepEqual(hits.filter((h) => !h.startsWith(join("src", "lib", "mists-season.mjs"))), []);
});
