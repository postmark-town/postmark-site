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
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

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

function build(label, { prev = null, full = false, env = {}, code = CODE } = {}) {
  const manifest = join(WORK, `${label}.manifest.json`);
  const out = join(WORK, `${label}.dist`); // a folder no build has touched: Astro does not empty its outDir
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
