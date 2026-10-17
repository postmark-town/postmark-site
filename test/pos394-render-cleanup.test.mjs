// pos394-render-cleanup.test.mjs — the render proof removes its own temp tree and nothing else (POS-394).
//
//   node --test --test-concurrency=1 test/pos394-render-cleanup.test.mjs
//
// Node builtins only. removeOwnedTree() is called ONLY on fresh synthetic roots
// this file creates in os.tmpdir(); every fixture is a fixed literal. Anything
// the remover is expected to refuse is cleaned up here afterwards, one exact
// path at a time. No repository, toolchain or protected path is touched or read.
// This proves cooperative single-process cleanup, not TOCTOU or mount safety.
//
// PORTABLE (POS-394 win32 correction). Directory links are made as junctions
// (no elevation on Windows; the type is ignored on POSIX). Every fixture's
// teardown is registered BEFORE the fixture is built and does not depend on the
// remover under test: it walks this file's own fixture list, tolerating whatever
// the run left (removed, refused, half-removed, or a throw). The two "no getuid"
// cases SIMULATE their platform in a child process (process.getuid removed,
// process.platform overridden before the module loads); they are not a native
// Windows run.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { removeOwnedTree } from "../tools/pos394-render-proof.mjs";

const TMP = fs.realpathSync(os.tmpdir());
const MODULE = pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "tools", "pos394-render-proof.mjs")).href;
const mk = (prefix) => fs.mkdtempSync(path.join(TMP, prefix));
const put = (file, body = "fixed literal\n") => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, body, { flag: "wx" }); };
const exists = (p) => { try { fs.lstatSync(p); return true; } catch { return false; } };
const count = (dir) => { let n = 0; for (const e of fs.readdirSync(dir, { withFileTypes: true })) { n++; if (e.isDirectory()) n += count(path.join(dir, e.name)); } return n; };
const dirLink = (target, at) => fs.symlinkSync(target, at, "junction");

// The populated root's fixed fixture list, deepest last within each kind.
const FILES = ["package.json", "src/lib/houses.mjs", ".vite-cache/deps/_metadata.json", ".vite-cache/deps/chunk-a.js",
  ".astro-cache/content/a/b/c.txt", ".astro/types.d.ts"];
const DIRS = ["src/lib", "src", ".vite-cache/deps", ".vite-cache", ".astro-cache/content/a/b", ".astro-cache/content/a",
  ".astro-cache/content", ".astro-cache", ".astro", "public-empty", "tmp/empty", "tmp"];

/**
 * Exact, tolerant teardown of a root THIS file built: the link (unlinked, never
 * followed), then the listed files and directories that still exist, then the
 * root. Never the remover under test, never a recursive or glob delete. An entry
 * this file did not create makes rmdir throw, loudly, rather than be removed.
 */
function teardownOwned(P) {
  if (!exists(P)) return;
  const link = path.join(P, "node_modules");
  if (exists(link)) fs.unlinkSync(link);
  for (const f of FILES) if (exists(path.join(P, f))) fs.unlinkSync(path.join(P, f));
  for (const d of DIRS) if (exists(path.join(P, d))) fs.rmdirSync(path.join(P, d));
  fs.rmdirSync(P);
}

// A sentinel OUTSIDE the root, reached through a link inside it. Torn down by the test, after the root.
function external(t) {
  const E = mk("pos394-ext-");
  t.after(() => {
    if (exists(path.join(E, "sentinel.txt"))) fs.unlinkSync(path.join(E, "sentinel.txt"));
    if (exists(E)) fs.rmdirSync(E);
  });
  put(path.join(E, "sentinel.txt"), "must survive\n");
  return { E };
}
/** A fresh pos394-proj- root whose teardown is registered before anything is built in it. */
function ownedRoot(t, prefix = "pos394-proj-") {
  const P = mk(prefix);
  t.after(() => teardownOwned(P));
  return P;
}
// A root shaped like a finished run: sources, nested Vite/Astro caches, a link out.
function populated(P, linkTo) {
  put(path.join(P, "package.json"), "{}\n");
  put(path.join(P, "src/lib/houses.mjs"));
  put(path.join(P, ".vite-cache/deps/_metadata.json"), "{}\n");
  put(path.join(P, ".vite-cache/deps/chunk-a.js"));
  put(path.join(P, ".astro-cache/content/a/b/c.txt"));
  put(path.join(P, ".astro/types.d.ts"));
  fs.mkdirSync(path.join(P, "public-empty"));
  fs.mkdirSync(path.join(P, "tmp/empty"), { recursive: true });
  if (linkTo) dirLink(linkTo, path.join(P, "node_modules"));
}

test("an owned root is removed whole, nested caches included, and a link out is unlinked, not followed", (t) => {
  const ext = external(t);
  const P = ownedRoot(t);
  populated(P, ext.E);
  const entries = count(P);
  const r = removeOwnedTree(P, { keepApart: [] });
  assert.deepEqual(r, { ok: true, removed: entries });
  assert.equal(exists(P), false, "the root is gone");
  assert.equal(fs.readFileSync(path.join(ext.E, "sentinel.txt"), "utf8"), "must survive\n", "the link's target is untouched");
  assert.deepEqual(fs.readdirSync(ext.E), ["sentinel.txt"]);
});

test("a root that is itself a symlink is refused, and neither it nor its target is touched", (t) => {
  const D = ownedRoot(t);
  const L = path.join(TMP, `pos394-proj-link-${process.pid}-${Date.now()}`);
  t.after(() => { if (exists(L)) fs.unlinkSync(L); });
  populated(D, null);
  dirLink(D, L);
  const before = count(D);
  const r = removeOwnedTree(L, { keepApart: [] });
  assert.equal(r.ok, false);
  assert.match(r.problem, /not a plain directory/);
  assert.equal(fs.lstatSync(L).isSymbolicLink(), true, "the link stays");
  assert.equal(count(D), before, "nothing behind it was deleted");
});

test("a root overlapping a keepApart location (inside or around it) is refused with nothing deleted", (t) => {
  const ext = external(t);
  const P = ownedRoot(t);
  populated(P, ext.E);
  const before = count(P);
  for (const [what, keep] of [["keepApart inside the root", path.join(P, "src")], ["keepApart around the root", TMP], ["keepApart is the root", P]]) {
    const r = removeOwnedTree(P, { keepApart: [keep] });
    assert.equal(r.ok, false, what);
    assert.match(r.problem, /overlaps a protected location/, what);
    assert.equal(count(P), before, `${what}: nothing deleted`);
  }
  assert.equal(fs.readFileSync(path.join(ext.E, "sentinel.txt"), "utf8"), "must survive\n");
});

test("a wrong prefix, or a root not directly in the temp dir, is refused with nothing deleted", (t) => {
  const W = ownedRoot(t, "pos394-wrong-");
  const OUTER = mk("pos394-outer-");
  const N = path.join(OUTER, "pos394-proj-nested");
  t.after(() => { teardownOwned(N); if (exists(OUTER)) fs.rmdirSync(OUTER); });
  populated(W, null);
  fs.mkdirSync(N);
  populated(N, null);
  const w = removeOwnedTree(W, { keepApart: [] });
  assert.equal(w.ok, false);
  assert.match(w.problem, /not an owned pos394-proj- dir/);
  const n = removeOwnedTree(N, { keepApart: [] });
  assert.equal(n.ok, false);
  assert.match(n.problem, /not an owned pos394-proj- dir/);
  assert.ok(count(W) > 0 && count(N) > 0, "both left whole");
  const missing = removeOwnedTree(path.join(TMP, `pos394-proj-absent-${process.pid}-${Date.now()}`), { keepApart: [] });
  assert.equal(missing.ok, false, "a root that does not exist is a failure, not a pass");
});

// ── the platform without getuid, SIMULATED in a child (not a native run) ─────
/** Run removeOwnedTree(P) in a child whose process has no getuid and the given platform. */
function removeInChild(P, platform) {
  const script = [
    "process.getuid = undefined;",
    `Object.defineProperty(process, "platform", { value: ${JSON.stringify(platform)} });`,
    `const { removeOwnedTree } = await import(${JSON.stringify(MODULE)});`,
    `process.stdout.write(JSON.stringify(removeOwnedTree(${JSON.stringify(P)}, { keepApart: [] })));`,
  ].join("\n");
  // os.tmpdir() takes its Windows branch under a faked win32 and reads TEMP/TMP, so the child is handed this
  // machine's own temp dir there — a simulation detail, not something the remover is told.
  const r = spawnSync(process.execPath, ["--input-type=module", "-e", script],
    { encoding: "utf8", env: { ...process.env, TEMP: TMP, TMP: TMP } });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
}

test("SIMULATED win32, no getuid: the owned root is still removed whole, the link's target untouched", (t) => {
  const ext = external(t);
  const P = ownedRoot(t);
  populated(P, ext.E);
  const entries = count(P);
  const r = removeInChild(P, "win32");
  assert.deepEqual(r, { ok: true, removed: entries });
  assert.equal(exists(P), false);
  assert.equal(fs.readFileSync(path.join(ext.E, "sentinel.txt"), "utf8"), "must survive\n");
  // and the other gates still bind there: a wrong prefix is refused
  const W = ownedRoot(t, "pos394-wrong-");
  populated(W, null);
  assert.match(removeInChild(W, "win32").problem, /not an owned pos394-proj- dir/);
});

test("SIMULATED non-Windows platform with no getuid: refused, nothing deleted — a missing primitive is never a pass", (t) => {
  const P = ownedRoot(t);
  populated(P, null);
  const before = count(P);
  const r = removeInChild(P, "freebsd");
  assert.equal(r.ok, false);
  assert.match(r.problem, /cannot check ownership on freebsd/);
  assert.equal(count(P), before);
});

test("teardown does not depend on the remover: a refused root and a half-removed root are both cleaned exactly", (t) => {
  // refused: a wrong prefix the remover will not touch (its teardown is registered at creation, so a throw
  // anywhere below still cleans it; the explicit calls here are what this test proves, the hooks are no-ops after)
  const W = ownedRoot(t, "pos394-wrong-");
  populated(W, null);
  assert.equal(removeOwnedTree(W, { keepApart: [] }).ok, false);
  teardownOwned(W);
  assert.equal(exists(W), false);
  // half-removed: some fixture files already gone (as if a remover stopped mid-way)
  const H = ownedRoot(t);
  populated(H, null);
  fs.unlinkSync(path.join(H, "package.json"));
  fs.unlinkSync(path.join(H, ".astro/types.d.ts"));
  fs.rmdirSync(path.join(H, ".astro"));
  teardownOwned(H);
  assert.equal(exists(H), false);
});
