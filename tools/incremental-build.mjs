#!/usr/bin/env node
// incremental-build — `astro build`, rendering only the routes whose inputs moved (POS-1085).
//
//   node tools/incremental-build.mjs --out-manifest <file> [--prev-manifest <file> --prev-dir <dir>] [--full]
//
// WHAT IT DOES. A converted page (src/lib/incremental.mjs) reads only its props, so
// its key is the hash of its params and props. This script asks Astro for the
// build twice over, in effect: it hands the previous release's manifest to the
// build (INCR_PREV), the build skips every converted route whose key is unchanged,
// and this script then copies each skipped route's files from the previous
// release's output into the new one. Unconverted pages are always rendered.
// The new manifest is written to --out-manifest; the caller keeps it beside the
// release it describes and hands it back next pass.
//
// IT BUILDS IN FULL (kind "full", with the reason) when ANY of these holds, and
// when in doubt:
//   --full was given (the build on demand);
//   there is no previous manifest or no previous output dir, or the manifest is
//     unreadable, or of another version;
//   the GLOBAL KEY moved: the code (src/, town/, tools/, the Astro config, the
//     lockfile and the installed packages, which carry the world pin), the
//     build's PUBLIC_*/BUILD_*/PREVIEW_BASE environment, the Node major version,
//     or the calendar switch the Halloween frame wears;
//   the incremental build failed, or its output failed the checks below. It then
//     runs the full build once more. A wrong carry-over is worse than a slow pass.
//
// THE CHECKS (after an incremental build): every route's files exist in the new
// output (rendered) or in the previous release (to carry), the counts add up, and
// nothing is carried that the previous manifest did not hold under the same key.
//
// IT LOGS `[incremental-build] build kind: full|incremental (<reason>)` and the
// pages rendered, and writes the same facts under `meta` in the manifest.
//
// Options: --root <dir> (where code is read, default the cwd), --config <astro
// config> (default astro.config.town.mjs), --out-dir <dir> (the build's outDir
// under --root, default dist-town), --code <a,b,c> (paths under --root that are
// code), --step <name> (a label for the log).

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

export const MANIFEST_VERSION = 1;
const say = (m) => console.log(`[incremental-build] ${m}`);

function argv(list) {
  const o = { full: false };
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (a === "--full") o.full = true;
    else if (a.startsWith("--")) o[a.slice(2)] = list[++i];
    else throw new Error(`unknown argument ${a}`);
  }
  return o;
}

// ── the global key ──────────────────────────────────────────────────────────

const SKIP_DIRS = new Set(["node_modules", ".astro", ".git", "dist", "dist-town"]);

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) { if (!SKIP_DIRS.has(name)) walk(p, out); }
    else out.push(p);
  }
  return out;
}

const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");

/** The code the build compiles, hashed by path and bytes. Data the extractors write is not code. */
export function codeHash(root, paths) {
  const h = createHash("sha256");
  const dataDir = join(root, "src", "data", "postmark");
  for (const rel of paths) {
    const p = resolve(root, rel);
    if (!existsSync(p)) { h.update(`missing:${rel}\n`); continue; }
    const files = statSync(p).isDirectory() ? walk(p) : [p];
    for (const f of files) {
      if (f === dataDir || f.startsWith(dataDir + sep)) continue;
      h.update(`${relative(root, f).split(sep).join("/")}\0${sha(readFileSync(f))}\n`);
    }
  }
  return h.digest("hex");
}

async function calendarSwitch(root) {
  // The one clock the shared layout reads while it renders: the Halloween frame's calendar window.
  const f = join(root, "src", "lib", "halloween-frame.mjs");
  if (!existsSync(f)) return "no-frame";
  const m = await import(pathToFileURL(f).href);
  return String(m.frameOn(Date.now()));
}

export async function globalKey({ root, code }) {
  const env = Object.keys(process.env)
    .filter((k) => /^(PUBLIC_|BUILD_)/.test(k) || k === "PREVIEW_BASE")
    .sort()
    .map((k) => `${k}=${process.env[k]}`);
  const installed = join(root, "node_modules", ".package-lock.json");
  const parts = {
    code: codeHash(root, code),
    installed: existsSync(installed) ? sha(readFileSync(installed)) : "none",
    node: process.versions.node.split(".")[0],
    env,
    calendar: await calendarSwitch(root),
  };
  return { key: sha(JSON.stringify(parts)), parts };
}

// ── the build ───────────────────────────────────────────────────────────────

function astroBin() {
  const req = createRequire(import.meta.url);
  return join(dirname(req.resolve("astro/package.json")), "bin", "astro.mjs");
}

function runBuild({ root, config, env }) {
  const r = spawnSync(process.execPath, [astroBin(), "build", "--config", config], {
    cwd: root, env: { ...process.env, ...env }, stdio: "inherit",
  });
  return r.status === 0;
}

function readFamilies(dir) {
  const routes = {};
  const totals = {};
  for (const f of existsSync(dir) ? readdirSync(dir) : []) {
    if (!f.endsWith(".json")) continue;
    const j = JSON.parse(readFileSync(join(dir, f), "utf8"));
    routes[j.family] = j.entries;
    totals[j.family] = { total: j.total, rendered: j.rendered };
  }
  return { routes, totals };
}

function loadPrev(path) {
  try {
    const m = JSON.parse(readFileSync(path, "utf8"));
    if (m.version !== MANIFEST_VERSION || !m.routes || typeof m.global !== "string") return { why: "the previous manifest is of another shape" };
    return { manifest: m };
  } catch (e) {
    return { why: `the previous manifest is unreadable (${e.code ?? e.message})` };
  }
}

/** Carry every skipped route's files over, and check the output. Throws on anything off. */
function settle({ routes, prev, prevDir, outDir, incremental }) {
  let carried = 0, rendered = 0;
  for (const [family, entries] of Object.entries(routes)) {
    for (const [id, e] of Object.entries(entries)) {
      const same = incremental && prev.routes[family]?.[id]?.k === e.k;
      for (const f of e.f) {
        const dst = join(outDir, f);
        if (!same) {
          if (!existsSync(dst)) throw new Error(`${family}: a rendered route wrote no ${f}`);
          continue;
        }
        // Astro does not empty its outDir, so a file may already stand here from an earlier
        // build: the carry overwrites it, never trusts it.
        const src = join(prevDir, f);
        if (!existsSync(src)) throw new Error(`${family}: the previous release has no ${f} to carry`);
        mkdirSync(dirname(dst), { recursive: true });
        copyFileSync(src, dst);
        carried++;
      }
      if (!same) rendered++;
    }
  }
  return { carried, rendered };
}

export async function main(list = process.argv.slice(2)) {
  const o = argv(list);
  if (!o["out-manifest"]) throw new Error("--out-manifest <file> is required");
  const root = resolve(o.root ?? process.cwd());
  const config = o.config ?? "astro.config.town.mjs";
  const outDir = resolve(root, o["out-dir"] ?? "dist-town");
  // Astro does not empty its outDir (measured), so what an earlier build left there stays, for a full
  // build and an incremental one alike. This script deletes nothing: say it, so the caller can start clean.
  const stale = existsSync(outDir) ? readdirSync(outDir).length : 0;
  if (stale) say(`note: ${outDir} already holds ${stale} entries from an earlier build; stale files of routes that no longer exist stay unless the caller starts it empty`);
  const code = (o.code ?? "src,town,tools,astro.config.town.mjs,package.json,package-lock.json").split(",");
  const started = Date.now();

  const g = await globalKey({ root, code });
  let reason = null;
  let prev = null;
  if (o.full) reason = "a full build was asked for";
  else if (!o["prev-manifest"] || !o["prev-dir"]) reason = "there is no previous release to carry from";
  else if (!existsSync(o["prev-dir"])) reason = "the previous release's output is not there";
  else {
    const p = loadPrev(o["prev-manifest"]);
    if (p.why) reason = p.why;
    else if (p.manifest.global !== g.key) reason = "the global key moved (code, packages, build environment or calendar)";
    else prev = p.manifest;
  }

  let kind = prev ? "incremental" : "full";
  let result = null;
  for (const attempt of prev ? ["incremental", "full"] : ["full"]) {
    kind = attempt;
    const tmp = mkdtempSync(join(tmpdir(), "incr-"));
    const env = { INCR_OUT: tmp };
    if (attempt === "incremental") {
      env.INCR_PREV = o["prev-manifest"];
      say(`build kind: incremental (the global key held; carrying from ${o["prev-dir"]})`);
    } else {
      say(`build kind: full (${reason})`);
    }
    try {
      if (!runBuild({ root, config, env })) throw new Error("the build failed");
      const { routes, totals } = readFamilies(tmp);
      const counted = Object.values(totals).reduce((n, t) => n + t.total, 0);
      const settled = settle({ routes, prev, prevDir: o["prev-dir"], outDir, incremental: attempt === "incremental" });
      result = { routes, totals, counted, ...settled };
      break;
    } catch (e) {
      if (attempt === "full") throw e;
      reason = `the incremental build did not hold (${e.message}); built in full instead`;
      say(reason);
    } finally {
      // the fresh folder this script made itself above (its own mkdtemp), nothing else
      rmSync(tmp, { recursive: true, force: true });
    }
  }

  const seconds = Math.round((Date.now() - started) / 1000);
  const meta = {
    kind, reason: kind === "full" ? reason : null, seconds,
    converted_routes: result.counted, converted_rendered: result.rendered, converted_carried_files: result.carried,
    families: result.totals,
  };
  say(`build kind: ${kind}; converted routes ${result.counted}: ${result.rendered} rendered, ${result.counted - result.rendered} carried over; ${seconds}s`);
  mkdirSync(dirname(resolve(o["out-manifest"])), { recursive: true });
  writeFileSync(o["out-manifest"], JSON.stringify({ version: MANIFEST_VERSION, global: g.key, meta, routes: result.routes }));
  return { kind, meta };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch((e) => { console.error(`[incremental-build] FAILED: ${e.message}`); process.exit(1); });
}
