// pos394-fs-guard.test.mjs — the POS-394 fs guard, proven against a TRAP in an invented world.
//
//   node --test --test-concurrency=1 test/pos394-fs-guard.test.mjs
//
// PURE: no real filesystem call and no global patch. The "original fs" is a trap
// that records every call it receives; readlink answers from the
// invented /virt tree below. Every refused form must leave the trap untouched
// (0 calls); every allowed call must reach it exactly once.

import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { makeFsGuard, GuardError, GUARDED_APIS } from "./pos394-fs-guard.mjs";

// Native Windows: SKIPPED by name (POS-394 Rivet choice (b)). The guard models POSIX
// link aliasing; this is not Windows guard support. The privacy proof is Linux CI.
const WIN32_SKIP = process.platform === "win32" && "the fs-guard models POSIX link aliasing; the privacy proof runs in Linux CI";

const REPO = "/virt/pos394-repo";
const ROOTS = [`${REPO}/src/data/postmark`, `${REPO}/public/atelier/postmark`, `${REPO}/node_modules/postmark-world`];
const CWD = `${REPO}/town`;
const ALLOWED = `${REPO}/town/components/Household.astro`;
// APIs taking two paths, and APIs taking only an fd.
const TWO = new Set(["copyFileSync", "cpSync", "renameSync", "copyFile", "cp", "rename"]);
const FD_ONLY = new Set(["fstatSync", "readSync", "closeSync", "writeSync", "fsyncSync", "fstat", "read", "close", "write", "fsync"]);
const ALLOWED_WALK = new Set(ALLOWED.split("/").slice(1).map((_, i, a) => "/" + a.slice(0, i + 1).join("/")));

// The invented tree (path -> "dir" | "file" | { link }). The protected roots do not exist in it; two are reached through links.
const WORLD = {
  "/virt": "dir", [REPO]: "dir", [`${REPO}/town`]: "dir", [`${REPO}/town/components`]: "dir", [ALLOWED]: "file",
  [`${REPO}/src`]: "dir", [`${REPO}/src/data`]: "dir", [`${REPO}/src/data/postmark-other`]: "dir",
  [`${REPO}/node_modules`]: "dir",
  [`${REPO}/node_modules/postmark-world`]: { link: "/virt/store/pw-real" }, // the root itself is a symlink
  "/virt/store": "dir", "/virt/store/pw-real": "dir", "/virt/store/pw-real/WORLD": "dir",
  [`${REPO}/public`]: { link: "/virt/elsewhere/public" }, // the root's PARENT is a symlink
  "/virt/elsewhere": "dir", "/virt/elsewhere/public": "dir", "/virt/elsewhere/public/atelier": "dir",
  [`${REPO}/link-out`]: { link: `${REPO}/src/data/postmark` }, // dangling: points into a root that does not exist
  [`${REPO}/link-deep`]: { link: "/virt/store" }, // points above a root's canonical target
  [`${REPO}/to-world`]: { link: "/virt/store/pw-real/WORLD" }, // `to-world/..` is the root's target, physically
  [`${REPO}/locked`]: "dir", // readlink under it fails with EACCES
  "/virt/loop-a": { link: "/virt/loop-b" }, "/virt/loop-b": { link: "/virt/loop-a" }, // a link loop (ELOOP)
};
const err = (code) => Object.assign(new Error(code), { code });

function fakeWorld(failAt = {}) {
  // readlink as the kernel answers it; the guard only ever hands it physical paths.
  // `failAt` injects an error code for one exact path.
  const calls = [];
  const readlink = (p) => {
    calls.push(p);
    if (failAt[p]) throw err(failAt[p]);
    if (p === `${REPO}/locked` || p.startsWith(`${REPO}/locked/`)) throw err("EACCES");
    const e = WORLD[p];
    if (!e) throw err("ENOENT");
    if (typeof e !== "object") throw err("EINVAL");
    return e.link;
  };
  return { calls, readlink };
}

function makeTrap() {
  const hits = [];
  const hit = (name, args, out) => { hits.push([name, args]); return out; };
  const trap = { promises: {} };
  for (const name of [...GUARDED_APIS.sync, ...GUARDED_APIS.callback]) trap[name] = (...a) => hit(name, a, "TRAPPED");
  trap.openSync = (...a) => hit("openSync", a, 41);
  trap.open = (...a) => { hit("open", a); a.at(-1)(null, 42); };
  trap.existsSync = (...a) => hit("existsSync", a, true);
  trap.exists = (...a) => { hit("exists", a); a.at(-1)(true); };
  trap.realpathSync.native = (...a) => hit("realpathSync.native", a, "TRAPPED");
  for (const name of GUARDED_APIS.promises) trap.promises[name] = (...a) => hit(`promises.${name}`, a, Promise.resolve("TRAPPED"));
  return { trap, hits };
}

function setup(extra = {}) {
  const world = fakeWorld();
  const { trap, hits } = makeTrap();
  const guard = makeFsGuard({ roots: ROOTS, original: trap, readlink: world.readlink, cwd: CWD, ...extra });
  world.calls.length = 0; // construction resolves the roots; per-check calls are judged from here
  return { guard, hits, calls: world.calls };
}

// [label, form, lexical?] — every one must be refused.
const DENIED = [
  ["an absolute string", `${REPO}/src/data/postmark/households.json`, true],
  ["the root itself", `${REPO}/src/data/postmark`, true],
  ["a trailing slash", `${REPO}/src/data/postmark/`, true],
  ["doubled slashes", `/${REPO}//src//data/postmark//letters.json`, true],
  ["relative from the cwd", "../src/data/postmark/residents.json", true],
  ["dot and dot-dot inside", `${REPO}/town/../src/data/./postmark/media.json`, true],
  ["a Buffer", Buffer.from(`${REPO}/src/data/postmark/renditions.json`), true],
  ["a file: URL object", new URL(`file://${REPO}/node_modules/postmark-world/WORLD/skeleton.json`), true],
  ["a percent-encoded file: URL string", `file://${REPO}/src/data/post%6Dark/households.json`, true],
  ["the second root, lexically", `${REPO}/public/atelier/postmark/a.png`, true],
  ["a dangling symlink elsewhere into a root", `${REPO}/link-out/households.json`, false],
  ["a symlink elsewhere into a root's canonical target", `${REPO}/link-deep/pw-real/WORLD/skeleton.json`, false],
  ["the symlinked root's target, directly", "/virt/store/pw-real/WORLD/skeleton.json", false],
  ["the symlinked root's target itself", "/virt/store/pw-real", false],
  ["through the root's symlinked parent", "/virt/elsewhere/public/atelier/postmark/a.png", false],
  ["a non-file URL object", new URL("https://example.invalid/households.json"), true],
  ["a non-file URL string", "data:text/plain,x", true],
  ["an encoded slash in a file: URL", `file://${REPO}/src%2Fdata/x`, true],
  ["a NUL byte", `${REPO}/town/a\0b`, true],
  ["a plain object", {}, true],
  ["null", null, true],
  ["dot-dot after a symlink, taken physically", `${REPO}/to-world/../households.json`, false],
  ["a path whose readlink fails other than ENOENT/EINVAL", `${REPO}/locked/x`, false],
  ["an fd this guard never opened", 99, true],
];

test("the denied set holds each root, its canonical target, and the alias through its parent's link", { skip: WIN32_SKIP }, () => {
  const { guard } = setup();
  for (const r of [...ROOTS, "/virt/store/pw-real", "/virt/elsewhere/public/atelier/postmark"]) {
    assert.ok(guard.deniedRoots.includes(r), r);
  }
});

test("every denied form is refused by every guarded API, and the trap is never reached", { skip: WIN32_SKIP }, async (t) => {
  const { guard, hits, calls } = setup();
  const cb = () => assert.fail("a refused callback API must not call back");
  let refusals = 0;
  for (const [label, form, lexical] of DENIED) {
    const before = calls.length;
    for (const name of GUARDED_APIS.sync) {
      const args = TWO.has(name) ? [form, ALLOWED] : [form];
      assert.throws(() => guard.fs[name](...args), GuardError, `${name}: ${label}`); refusals++;
      if (TWO.has(name)) { assert.throws(() => guard.fs[name](ALLOWED, form), GuardError, `${name} dest: ${label}`); refusals++; }
    }
    for (const name of GUARDED_APIS.callback) {
      const two = TWO.has(name);
      for (const args of two ? [[form, ALLOWED, cb], [ALLOWED, form, cb]] : [[form, cb]]) {
        assert.throws(() => guard.fs[name](...args), GuardError, `${name}: ${label}`); refusals++;
      }
    }
    for (const name of GUARDED_APIS.promises) {
      const two = TWO.has(name);
      for (const args of two ? [[form, ALLOWED], [ALLOWED, form]] : [[form]]) {
        await assert.rejects(guard.promises[name](...args), GuardError, `promises.${name}: ${label}`); refusals++;
        await assert.rejects(guard.fs.promises[name](...args), GuardError, `fs.promises.${name}: ${label}`); refusals++;
      }
    }
    assert.throws(() => guard.fs.realpathSync.native(form), GuardError, `realpathSync.native: ${label}`); refusals++;
    assert.equal(guard.fs.existsSync(form), false, `existsSync answers false: ${label}`); refusals++;
    let said; guard.fs.exists(form, (v) => { said = v; }); assert.equal(said, false, `exists: ${label}`); refusals++;
    const probed = calls.slice(before);
    for (const root of guard.deniedRoots) assert.ok(!probed.some((p) => p === root || p.startsWith(root + "/")), `${label}: no check readlinks a denied path`);
    // copyFile/cp also check their ALLOWED partner path, whose walk is expected
    const ownProbes = probed.filter((p) => !ALLOWED_WALK.has(p));
    if (lexical) assert.deepEqual(ownProbes, [], `${label}: refused before any probe`);
  }
  assert.deepEqual(hits, [], "the trap was never reached");
  assert.equal(guard.denials.length, refusals, "every refusal is recorded, even ones a caller would swallow");
  // sync + its two-path dests, callback + dests, promises + dests in both views, native, existsSync, exists
  const twoIn = (list) => list.filter((n) => TWO.has(n)).length;
  const per = GUARDED_APIS.sync.length + twoIn(GUARDED_APIS.sync) + GUARDED_APIS.callback.length + twoIn(GUARDED_APIS.callback)
    + 2 * (GUARDED_APIS.promises.length + twoIn(GUARDED_APIS.promises)) + 3;
  assert.equal(per, 113, "the matrix is 113 entry points per form");
  assert.equal(refusals, DENIED.length * per);
  t.diagnostic(`refusals ${refusals} = ${DENIED.length} forms x ${per} entry points`);
});

test("allowed paths reach the trap exactly once per call, with the caller's own arguments", { skip: WIN32_SKIP }, async () => {
  const { guard, hits } = setup();
  const near = [ALLOWED, "components/Household.astro", `${REPO}/town/../town/components/Household.astro`, `${REPO}/src/data/postmark-other/x.json`, `${REPO}/src/data/postmarks`, `file://${ALLOWED}`, Buffer.from(ALLOWED)];
  const cb = () => {};
  for (const form of near) {
    const start = hits.length;
    let n = 0;
    for (const name of GUARDED_APIS.sync) {
      if (FD_ONLY.has(name)) continue; // fd-only: below
      const args = TWO.has(name) ? [form, ALLOWED] : [form];
      guard.fs[name](...args); n++;
      assert.equal(hits.length, start + n, `${name} reached the trap once`);
      assert.deepEqual(hits.at(-1), [name, args]);
    }
    for (const name of GUARDED_APIS.callback) {
      if (FD_ONLY.has(name)) continue;
      guard.fs[name](...(TWO.has(name) ? [form, ALLOWED, cb] : [form, cb])); n++;
      assert.equal(hits.length, start + n, `${name} reached the trap once`);
    }
    for (const name of GUARDED_APIS.promises) {
      assert.equal(await guard.promises[name](...(TWO.has(name) ? [form, ALLOWED] : [form])), "TRAPPED"); n++;
      assert.equal(hits.length, start + n, `promises.${name} reached the trap once`);
    }
    assert.equal(guard.fs.realpathSync.native(form), "TRAPPED"); n++;
    assert.equal(guard.fs.existsSync(form), true); n++;
    assert.equal(hits.length, start + n);
  }
  assert.deepEqual(guard.denials, [], "nothing refused");
});

test("an fd is allowed only when this guard opened it (or it is listed), and not after close", { skip: WIN32_SKIP }, () => {
  const { guard, hits } = setup({ allowFds: [2] });
  assert.throws(() => guard.fs.readSync(99, Buffer.alloc(1)), GuardError, "an unknown fd fails closed");
  assert.throws(() => guard.fs.openSync(`${REPO}/src/data/postmark/x`), GuardError);
  assert.throws(() => guard.fs.readSync(41, Buffer.alloc(1)), GuardError, "a refused open tracks nothing");
  assert.equal(hits.length, 0);

  const fd = guard.fs.openSync(ALLOWED);
  assert.equal(fd, 41);
  guard.fs.readSync(fd, Buffer.alloc(1));
  guard.fs.fstatSync(fd);
  guard.fs.closeSync(fd);
  assert.deepEqual(hits.map(([n]) => n), ["openSync", "readSync", "fstatSync", "closeSync"]);
  assert.throws(() => guard.fs.readSync(fd, Buffer.alloc(1)), GuardError, "a closed fd is forgotten");

  let got; guard.fs.open(ALLOWED, (e, f) => { got = f; });
  assert.equal(got, 42);
  guard.fs.read(42, Buffer.alloc(1), 0, 1, 0, () => {});
  guard.fs.fstatSync(2); // listed in allowFds
  assert.deepEqual(hits.slice(4).map(([n]) => n), ["open", "read", "fstatSync"]);
});

test("createReadStream's fd option is held to the fd rule: tracked or listed only, never a handle object", { skip: WIN32_SKIP }, () => {
  const { guard, hits } = setup({ allowFds: [2] });
  assert.throws(() => guard.fs.createReadStream(ALLOWED, { fd: 99 }), GuardError, "an unknown fd behind an allowed path");
  assert.throws(() => guard.fs.createReadStream(ALLOWED, { fd: { fd: 41, close() {} } }), GuardError, "a FileHandle-like object");
  assert.throws(() => guard.fs.createReadStream(ALLOWED, { fd: "41" }), GuardError, "a string fd");
  assert.throws(() => guard.fs.createReadStream(`${REPO}/src/data/postmark/x`, { fd: 2 }), GuardError, "a listed fd does not excuse a denied path");
  assert.equal(hits.length, 0, "none reached the trap");
  assert.equal(guard.denials.length, 4);

  const fd = guard.fs.openSync(ALLOWED);
  guard.fs.createReadStream(ALLOWED, { fd });
  guard.fs.createReadStream(ALLOWED, { fd: 2 });
  guard.fs.createReadStream(ALLOWED, { fd: undefined });
  guard.fs.createReadStream(ALLOWED, "utf8");
  guard.fs.closeSync(fd);
  assert.throws(() => guard.fs.createReadStream(ALLOWED, { fd }), GuardError, "a closed fd is forgotten here too");
  assert.deepEqual(hits.map(([n]) => n), ["openSync", "createReadStream", "createReadStream", "createReadStream", "createReadStream", "closeSync"]);
});

test("a root whose aliases cannot be resolved stops the guard from being built (fails closed)", { skip: WIN32_SKIP }, () => {
  const { trap } = makeTrap();
  for (const [what, failAt, roots] of [
    ["EACCES on the root's parent", { [`${REPO}/src/data`]: "EACCES" }, ROOTS],
    ["EIO on the root itself", { [`${REPO}/node_modules/postmark-world`]: "EIO" }, ROOTS],
    ["EACCES on a root's grandparent", { [`${REPO}/public`]: "EACCES" }, ROOTS],
  ]) {
    const { readlink } = fakeWorld(failAt);
    assert.throws(() => makeFsGuard({ roots, original: trap, readlink, cwd: CWD }), /refusing to build/, what);
  }
  const { readlink } = fakeWorld();
  assert.throws(() => makeFsGuard({ roots: ["/virt/loop-a/postmark"], original: trap, readlink, cwd: CWD }), /ELOOP.*refusing to build|refusing to build/, "a link loop above a root");
  assert.doesNotThrow(() => makeFsGuard({ roots: ROOTS, original: trap, readlink, cwd: CWD }), "CONTROL: the clean world builds");
});

test("an API the guard does not list is refused, not passed through", { skip: WIN32_SKIP }, () => {
  const { guard, hits } = setup();
  for (const get of [() => guard.fs.globSync, () => guard.fs.symlinkSync, () => guard.fs.chmodSync, () => guard.fs.promises.glob, () => guard.promises.watch, () => guard.fs.openAsBlob]) {
    assert.throws(get, GuardError);
  }
  assert.equal(guard.denials.length, 6);
  assert.deepEqual(hits, []);
});

test("the guard will not build without roots, readlink and an absolute cwd", { skip: WIN32_SKIP }, () => {
  const { trap } = makeTrap();
  const { readlink } = fakeWorld();
  assert.throws(() => makeFsGuard({ roots: [], original: trap, readlink, cwd: CWD }));
  assert.throws(() => makeFsGuard({ roots: ROOTS, original: trap, cwd: CWD }));
  assert.throws(() => makeFsGuard({ roots: ROOTS, original: trap, readlink, cwd: "town" }));
});
