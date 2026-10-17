// pos394-fs-guard-install.test.mjs — installFsGuard reaches every fs binding (POS-394, stage 1b).
//
//   node --test --test-concurrency=1 test/pos394-fs-guard-install.test.mjs
//
// The install happens ONLY in a disposable child node process; this parent
// never patches anything and checks that it was left alone. The child works in
// a fresh, owned, EMPTY temp dir: its denied root and its allowed-but-missing
// file are invented names inside that dir and neither is ever created. Nothing
// under the repository is read. Cleanup removes that one empty dir, no more.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

// Native Windows: SKIPPED by name (POS-394 Rivet choice (b)). The guard models POSIX
// link aliasing; this is not Windows guard support. The privacy proof is Linux CI.
const WIN32_SKIP = process.platform === "win32" && "the fs-guard models POSIX link aliasing; the privacy proof runs in Linux CI";

const HELPER = new URL("./pos394-fs-guard.mjs", import.meta.url).href;

// The child. Bindings taken BEFORE the install are part of what it proves.
const CHILD = String.raw`
import { readFileSync as earlyRead } from "node:fs";
import { readFile as earlyReadP } from "node:fs/promises";
import * as fsNs from "node:fs";
import * as fspNs from "node:fs/promises";
import { createRequire } from "node:module";
const [helperUrl, tmp] = process.argv.slice(1);
const require = createRequire(tmp + "/");
const out = {};
try {
  const fsCjs = require("node:fs");
  const fnKeys = (o) => Object.keys(o).filter((k) => typeof o[k] === "function");
  const before = Object.fromEntries(fnKeys(fsCjs).map((k) => [k, fsCjs[k]]));
  const beforeP = Object.fromEntries(fnKeys(fsCjs.promises).map((k) => [k, fsCjs.promises[k]]));

  const { installFsGuard, KEPT_NATIVE } = await import(helperUrl);
  const ROOT = tmp + "/denied-root", DENIED = ROOT + "/households.json", MISSING = tmp + "/allowed-missing.json";
  const g = installFsGuard({ roots: [ROOT], cwd: tmp });
  const { readFileSync: lateRead } = await import("node:fs");
  const { readFile: lateReadP } = await import("node:fs/promises");

  const code = (fn) => { try { fn(); return "OK"; } catch (e) { return e.code ?? e.name; } };
  const acode = async (fn) => { try { await fn(); return "OK"; } catch (e) { return e.code ?? e.name; } };
  const sync = {
    "named node:fs, imported before install": earlyRead,
    "named node:fs, imported after install": lateRead,
    "node:fs namespace": fsNs.readFileSync,
    "node:fs namespace default": fsNs.default.readFileSync,
    "require('fs')": require("fs").readFileSync,
    "require('node:fs')": require("node:fs").readFileSync,
    "require('node:fs').statSync": require("node:fs").statSync,
    "require('node:fs').realpathSync.native": require("node:fs").realpathSync.native,
  };
  const prom = {
    "named node:fs/promises, imported before install": earlyReadP,
    "named node:fs/promises, imported after install": lateReadP,
    "node:fs/promises namespace": fspNs.readFile,
    "node:fs/promises namespace default": fspNs.default.readFile,
    "require('node:fs/promises')": require("node:fs/promises").readFile,
    "require('fs/promises')": require("fs/promises").readFile,
    "fs.promises (require)": require("fs").promises.readFile,
    "fs.promises (namespace)": fsNs.promises.readFile,
  };
  const probesBefore = g.probes.length;
  out.denied = {}; out.missing = {};
  for (const [k, fn] of Object.entries(sync)) out.denied[k] = code(() => fn(DENIED));
  for (const [k, fn] of Object.entries(prom)) out.denied[k] = await acode(() => fn(DENIED));
  out.deniedProbes = g.probes.slice(probesBefore);
  for (const [k, fn] of Object.entries(sync)) out.missing[k] = code(() => fn(MISSING));
  for (const [k, fn] of Object.entries(prom)) out.missing[k] = await acode(() => fn(MISSING));

  const fsNow = require("node:fs");
  out.streams = {
    "new fs.ReadStream(denied)": code(() => new fsNow.ReadStream(DENIED)),
    "new fs.FileReadStream(denied)": code(() => new fsNow.FileReadStream(DENIED)),
    "new fs.WriteStream(denied)": code(() => new fsNow.WriteStream(DENIED)),
    "fs.createReadStream(denied)": code(() => fsNow.createReadStream(DENIED)),
    "fs.createReadStream(allowed, { fd: 99 })": code(() => fsNow.createReadStream(MISSING, { fd: 99 })),
    "fs.createReadStream(missing) emits": await new Promise((res) => { const s = fsNow.createReadStream(MISSING); s.on("error", (e) => res(e.code)); s.on("open", () => res("OPENED")); }),
  };
  out.unsupported = {
    "fs.globSync": code(() => fsNow.globSync("*.none", { cwd: tmp })),
    "fs.statfsSync": code(() => fsNow.statfsSync(tmp)),
    "fs.openAsBlob": code(() => fsNow.openAsBlob(MISSING)),
    "fs.realpath.native": code(() => fsNow.realpath.native(MISSING, () => {})),
    "fs.chmodSync": code(() => fsNow.chmodSync(tmp, 0o700)),
    "fs/promises glob": code(() => { const it = fsNow.promises.glob; return it; }) === "OK" ? await acode(async () => { for await (const _ of fsNow.promises.glob("*.none", { cwd: tmp })) {} }) : "MISSING",
    "fs/promises statfs": await acode(() => fsNow.promises.statfs(tmp)),
  };
  out.realRead = code(() => { if (fsNow.readdirSync(tmp).length !== 0) throw new Error("not empty"); });

  out.unchanged = fnKeys(fsNow).filter((k) => !KEPT_NATIVE.includes(k) && fsNow[k] === before[k]);
  out.unchangedPromises = fnKeys(fsNow.promises).filter((k) => fsNow.promises[k] === beforeP[k]);
  out.keptSame = KEPT_NATIVE.every((k) => fsNow[k] === before[k]);
  out.functionExports = fnKeys(fsNow).length;
  out.promiseExports = fnKeys(fsNow.promises).length;
  out.replaced = g.replaced.length;
  out.denials = g.denials.length;
  out.leaks = Object.keys(g).sort();
} catch (e) { out.crash = String(e?.stack ?? e); }
process.stdout.write(JSON.stringify(out));
process.exit(0);
`;

test("installFsGuard, in a disposable child, reaches every fs binding and leaves the parent alone", { skip: WIN32_SKIP }, () => {
  const parentRead = fs.readFileSync, parentPromisesRead = fs.promises.readFile;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pos394-bind-"));
  let res;
  try {
    assert.deepEqual(fs.readdirSync(tmp), [], "the owned temp dir starts empty");
    res = spawnSync(process.execPath, ["--input-type=module", "-e", CHILD, HELPER, tmp], { cwd: tmp, encoding: "utf8", timeout: 20_000 });
    assert.equal(res.error, undefined, "the child ran");
    assert.equal(res.signal, null, "the child was not killed (20 s bound)");
    assert.equal(res.status, 0, "the child exited cleanly");
    assert.deepEqual(fs.readdirSync(tmp), [], "the child created nothing: neither probe target exists");
  } finally {
    fs.rmdirSync(tmp); // the one owned dir; not recursive, so it fails if anything was left
  }
  const out = JSON.parse(res.stdout);
  assert.equal(out.crash, undefined, out.crash);

  for (const [k, v] of Object.entries(out.denied)) assert.equal(v, "EPOS394GUARD", `denied root via ${k}`);
  assert.deepEqual(out.deniedProbes, [], "the lexical denial never probed the filesystem");
  for (const [k, v] of Object.entries(out.missing)) assert.equal(v, "ENOENT", `allowed missing path via ${k}: the real fs answers`);
  assert.equal(Object.keys(out.denied).length, 16);

  assert.deepEqual(out.streams, {
    "new fs.ReadStream(denied)": "EPOS394GUARD", "new fs.FileReadStream(denied)": "EPOS394GUARD",
    "new fs.WriteStream(denied)": "EPOS394GUARD", "fs.createReadStream(denied)": "EPOS394GUARD",
    "fs.createReadStream(allowed, { fd: 99 })": "EPOS394GUARD", "fs.createReadStream(missing) emits": "ENOENT",
  });
  for (const [k, v] of Object.entries(out.unsupported)) assert.equal(v, "EPOS394GUARD", `an API the guard does not cover is refused: ${k}`);
  assert.equal(out.realRead, "OK", "a permitted real read still works (the empty temp dir)");

  assert.deepEqual(out.unchanged, [], "every fs function export but the kept data classes was replaced");
  assert.deepEqual(out.unchangedPromises, [], "every fs/promises function export was replaced");
  assert.equal(out.keptSame, true);
  assert.deepEqual(out.leaks, ["denials", "deniedRoots", "kept", "probes", "replaced"], "the installer hands back no original function");
  assert.ok(out.denials >= 16 + 5 + 7, `every refusal recorded (${out.denials})`);
  console.log(`# child: ${out.functionExports} fs + ${out.promiseExports} fs/promises function exports, ${out.replaced} replaced, ${out.denials} refusals recorded`);

  assert.equal(fs.readFileSync, parentRead, "the parent's fs is untouched");
  assert.equal(fs.promises.readFile, parentPromisesRead, "the parent's fs.promises is untouched");
  assert.throws(() => fs.readFileSync(path.join(tmp, "denied-root", "x")), { code: "ENOENT" }, "the parent has no guard");
});
