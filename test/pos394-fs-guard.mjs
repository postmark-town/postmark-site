// pos394-fs-guard.mjs — a fail-closed filesystem guard for the POS-394 render proof (stage 1: pure).
//
// The household render proof must never read the generated resident trees
// (src/data/postmark, public/atelier/postmark) or the installed world package.
// This module builds a GUARDED view of an fs-like object handed in: every path
// an API is given is normalised and checked against the denied roots BEFORE the
// original is called; a denied call never reaches the original, is recorded in
// `denials`, and throws (or rejects) a GuardError. An API the guard does not
// list is refused rather than passed through.
//
// PURE: nothing here touches the real filesystem or patches a global. The
// original fs, readlink and the cwd are all injected; the unit test hands in a
// TRAP and invented paths. Installing it over node:fs is a later stage.
//
// Checking a path:
//   1. normalise: string as given; Buffer via toString; a file: URL (object or
//      string) via fileURLToPath; any other URL, a NUL byte or any other type
//      is refused.
//   2. lexical: path.resolve(cwd, p) is refused if it is a denied root or under
//      one (separator-bounded).
//   3. physical: the path is walked one component at a time the way the kernel
//      does — each component readlink'd, a link followed (dangling ones too),
//      `..` taken from the PHYSICAL directory reached so far — and refused as
//      soon as any step lands on or under a denied root. The walk stops BEFORE
//      probing a denied path, so a check never readlinks inside a root. Any
//      readlink error but EINVAL (not a link) or ENOENT (missing) refuses.
// The denied set is each root, its parent's physical path + basename, and the
// root's own link target (a root that is a symlink denies its target too).
// Building that set is the ONE place a root itself is readlink'd (metadata).
//
// A numeric fd is allowed only if this guard opened it (open/openSync on a
// permitted path) or it is listed in `allowFds`; close forgets it. The same
// holds for createReadStream's `fd` option, and any non-number fd option
// (a FileHandle) is refused. A root whose aliases cannot be resolved (any
// readlink error but ENOENT/EINVAL) stops the guard from being built.

import fsModule from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

export class GuardError extends Error {
  constructor(api, what) {
    super(`POS-394 fs guard refused ${api}(${what})`);
    this.name = "GuardError";
    this.code = "EPOS394GUARD";
  }
}

// Which argument positions of each API are paths (or fds).
const SYNC = {
  readFileSync: [0], openSync: [0], readdirSync: [0], opendirSync: [0], statSync: [0], lstatSync: [0],
  accessSync: [0], realpathSync: [0], readlinkSync: [0], createReadStream: [0], watch: [0], watchFile: [0],
  unwatchFile: [0], copyFileSync: [0, 1], cpSync: [0, 1], writeFileSync: [0], mkdirSync: [0], rmSync: [0],
  fstatSync: [0], readSync: [0], closeSync: [0],
  // writes a render's own caches need (Vite/Astro write atomically by rename); each path still checked
  renameSync: [0, 1], unlinkSync: [0], rmdirSync: [0], mkdtempSync: [0], appendFileSync: [0], utimesSync: [0],
  truncateSync: [0], createWriteStream: [0], writeSync: [0], fsyncSync: [0],
};
const CALLBACK = {
  readFile: [0], open: [0], readdir: [0], opendir: [0], stat: [0], lstat: [0], access: [0], realpath: [0],
  readlink: [0], copyFile: [0, 1], cp: [0, 1], writeFile: [0], mkdir: [0], rm: [0], fstat: [0], read: [0], close: [0],
  rename: [0, 1], unlink: [0], rmdir: [0], mkdtemp: [0], appendFile: [0], utimes: [0], write: [0], fsync: [0],
};
const PROMISES = {
  readFile: [0], open: [0], readdir: [0], opendir: [0], stat: [0], lstat: [0], access: [0], realpath: [0],
  readlink: [0], copyFile: [0, 1], cp: [0, 1], writeFile: [0], mkdir: [0], rm: [0],
  rename: [0, 1], unlink: [0], rmdir: [0], mkdtemp: [0], appendFile: [0], utimes: [0], truncate: [0],
};
const OPENERS = new Set(["openSync", "open"]);
const FD_OPTION = new Set(["createReadStream", "createWriteStream", "ReadStream", "WriteStream"]);
const CLOSERS = new Set(["closeSync", "close"]);

export const GUARDED_APIS = Object.freeze({ sync: Object.keys(SYNC), callback: Object.keys(CALLBACK), promises: Object.keys(PROMISES) });

const under = (p, root) => p === root || p.startsWith(root.endsWith("/") ? root : root + "/");
const DENIED = Symbol("denied");

export function makeFsGuard({ roots, original, readlink, cwd, allowFds = [] }) {
  if (!Array.isArray(roots) || roots.length === 0) throw new Error("makeFsGuard: roots required");
  if (typeof readlink !== "function" || typeof cwd !== "string" || !path.isAbsolute(cwd)) {
    throw new Error("makeFsGuard: readlink and an absolute cwd required");
  }
  const denials = [];
  const fds = new Set(allowFds);
  const deniedRoots = [];
  const inDenied = (p) => deniedRoots.some((r) => under(p, r));

  // The kernel's walk, by readlink alone. With `stop`, returns DENIED the moment
  // a step lands on a denied path, before probing it.
  const physical = (abs, stop, hops = { n: 0 }) => {
    const parts = abs.split("/").filter((c) => c && c !== ".");
    let cur = "/";
    for (let i = 0; i < parts.length; i++) {
      if (parts[i] === "..") { cur = path.dirname(cur); continue; }
      const next = cur === "/" ? `/${parts[i]}` : `${cur}/${parts[i]}`;
      if (stop && stop(next)) return DENIED;
      let target;
      try { target = readlink(next); }
      catch (e) {
        if (e?.code === "EINVAL") { cur = next; continue; }
        if (e?.code === "ENOENT") return path.resolve(next, ...parts.slice(i + 1)); // nothing below a missing component exists
        throw e;
      }
      if (++hops.n > 40) throw Object.assign(new Error("too many links"), { code: "ELOOP" });
      const via = physical(String(target).startsWith("/") ? String(target) : `${cur}/${target}`, stop, hops);
      if (via === DENIED) return DENIED;
      cur = via;
      if (stop && stop(cur)) return DENIED;
    }
    return cur;
  };

  for (const r of roots) {
    const root = path.resolve(r);
    const aliases = [root];
    // Incomplete alias discovery fails closed: a guard that could not learn
    // where a root really lives is not built at all. (physical() already
    // answers ENOENT/EINVAL as "missing"/"not a link"; anything else lands here.)
    try {
      aliases.push(path.join(physical(path.dirname(root)), path.basename(root)));
      aliases.push(physical(root));
    } catch (e) {
      throw new Error(`makeFsGuard: cannot resolve the denied root ${root} (${e?.code ?? e}); refusing to build`);
    }
    for (const a of aliases) if (!deniedRoots.includes(a)) deniedRoots.push(a);
  }

  const refuse = (api, what) => { denials.push({ api, what: String(what) }); return new GuardError(api, what); };

  /** null when allowed; a GuardError (already recorded) when refused. */
  const check = (api, arg) => {
    if (typeof arg === "number") return fds.has(arg) ? null : refuse(api, `fd ${arg}`);
    let p;
    try {
      if (Buffer.isBuffer(arg)) p = arg.toString("utf8");
      else if (arg instanceof URL) { if (arg.protocol !== "file:") return refuse(api, arg.href); p = fileURLToPath(arg); }
      else if (typeof arg === "string") {
        if (/^[a-z][a-z0-9+.-]*:/i.test(arg)) {
          if (!arg.startsWith("file:")) return refuse(api, arg);
          p = fileURLToPath(arg);
        } else p = arg;
      } else return refuse(api, `a ${arg === null ? "null" : typeof arg}`);
    } catch { return refuse(api, "an unparseable path"); }
    if (p.includes("\0")) return refuse(api, "a path with a NUL byte");
    if (inDenied(path.resolve(cwd, p))) return refuse(api, path.resolve(cwd, p));
    const abs = p.startsWith("/") ? p : `${cwd}/${p}`; // NOT collapsed: `..` is the walk's to take
    let real;
    try { real = physical(abs, inDenied); } catch { return refuse(api, `${abs} (unresolvable)`); }
    if (real === DENIED || inDenied(real)) return refuse(api, `${abs} (resolves into a denied root)`);
    return null;
  };
  const firstRefusal = (api, positions, args) => {
    for (const i of positions) { const e = check(api, args[i]); if (e) return e; }
    // createReadStream(path, { fd }) reads the fd and ignores the path: the
    // option is held to the same rule as a bare fd (tracked or listed only).
    if (FD_OPTION.has(api)) {
      const opts = args[1];
      if (opts && typeof opts === "object" && opts.fd !== undefined && opts.fd !== null) {
        if (typeof opts.fd !== "number") return refuse(api, "an fd option that is not a plain fd");
        const e = check(api, opts.fd);
        if (e) return e;
      }
    }
    return null;
  };

  const lookup = (obj, name) => {
    const fn = obj?.[name];
    if (typeof fn !== "function") throw new GuardError(name, "not provided by the original");
    return fn;
  };

  const wrapped = {};
  for (const [name, pos] of Object.entries(SYNC)) {
    wrapped[name] = (...args) => {
      const e = firstRefusal(name, pos, args);
      if (e) throw e;
      const out = lookup(original, name).apply(original, args);
      if (OPENERS.has(name) && typeof out === "number") fds.add(out);
      if (CLOSERS.has(name)) fds.delete(args[0]);
      return out;
    };
  }
  wrapped.realpathSync.native = (...args) => {
    const e = check("realpathSync.native", args[0]);
    if (e) throw e;
    return lookup(original.realpathSync, "native").apply(original.realpathSync, args);
  };
  wrapped.existsSync = (p) => (check("existsSync", p) ? false : lookup(original, "existsSync").call(original, p));
  wrapped.exists = (p, cb) => (check("exists", p) ? cb(false) : lookup(original, "exists").call(original, p, cb));

  for (const [name, pos] of Object.entries(CALLBACK)) {
    wrapped[name] = (...args) => {
      const e = firstRefusal(name, pos, args);
      if (e) throw e;
      if (OPENERS.has(name)) {
        const cb = args.at(-1);
        if (typeof cb === "function") args[args.length - 1] = (err, fd) => { if (!err && typeof fd === "number") fds.add(fd); cb(err, fd); };
      }
      if (CLOSERS.has(name)) fds.delete(args[0]);
      return lookup(original, name).apply(original, args);
    };
  }

  const promises = {};
  const origPromises = original.promises;
  for (const [name, pos] of Object.entries(PROMISES)) {
    promises[name] = (...args) => {
      const e = firstRefusal(`promises.${name}`, pos, args);
      if (e) return Promise.reject(e);
      return lookup(origPromises, name).apply(origPromises, args);
    };
  }

  // Anything not listed is refused, not passed through.
  const closed = (target, label) => new Proxy(target, {
    get(t, k) {
      if (typeof k === "symbol" || Object.hasOwn(t, k)) return t[k];
      throw refuse(`${label}${String(k)}`, "an API the guard does not cover");
    },
  });
  const guardedPromises = closed(promises, "promises.");
  wrapped.promises = guardedPromises;
  return {
    fs: closed(wrapped, ""), promises: guardedPromises, denials, deniedRoots,
    check: (p) => check("check", p) === null,
    covers: { fs: new Set(Object.keys(wrapped).filter((k) => k !== "promises")), promises: new Set(Object.keys(promises)) },
    /** Throws (recorded) unless arg 0 is an allowed path or fd and any `fd` option is too. */
    assertStream: (api, args) => { const e = firstRefusal(api, [0], args); if (e) throw e; },
  };
}

// ── stage 1b: installing the guard over the real node:fs ─────────────────────
//
// installFsGuard() is the ONLY function here with an effect, and only when
// called; importing this module changes nothing. It patches node:fs and its
// canonical promises object (the one require("fs/promises") returns) IN PLACE,
// then calls syncBuiltinESMExports() so named ESM bindings — including ones
// imported before the install — see the guarded functions.
//
// Every function export is replaced: a guarded API by its guarded wrapper, the
// stream classes by subclasses that check the path and fd option before
// constructing (node's own createReadStream builds through them), and every
// other function by a refuser that records and throws. Only the data classes
// below stay native. The real functions are kept in a private snapshot inside
// this closure and are never returned. Once per process; there is no uninstall.
export const KEPT_NATIVE = Object.freeze(["Stats", "Dirent", "Dir"]);
const STREAM_CLASSES = { ReadStream: "ReadStream", FileReadStream: "ReadStream", WriteStream: "WriteStream", FileWriteStream: "WriteStream" };
let installed = false;

export function installFsGuard({ roots, cwd, allowFds = [] }) {
  if (installed) throw new Error("installFsGuard: already installed in this process");
  const fs = fsModule;
  const fsp = fs.promises;
  const fnKeys = (o) => Object.keys(o).filter((k) => typeof o[k] === "function");

  const original = { promises: {} };
  for (const k of fnKeys(fs)) original[k] = fs[k];
  for (const k of fnKeys(fsp)) original.promises[k] = fsp[k];
  const probes = [];
  const readlink = (p) => { probes.push(p); return original.readlinkSync(p); };
  const guard = makeFsGuard({ roots, original, readlink, cwd, allowFds });

  const refuser = (k) => function refused() { return guard.fs[k]; }; // the closed proxy records and throws
  // Synchronous, so it refuses an async-iterator API (promises.glob) as surely as a promise one.
  const asyncRefuser = (k) => function refused() { return guard.promises[k]; };
  const streams = {};
  for (const [k, kind] of Object.entries(STREAM_CLASSES)) {
    const Orig = original[k];
    if (typeof Orig !== "function") continue;
    streams[k] = streams[kind] && k !== kind ? streams[kind] : class extends Orig {
      constructor(...args) { guard.assertStream(kind, args); super(...args); }
    };
  }

  const replaced = [];
  for (const k of fnKeys(fs)) {
    if (KEPT_NATIVE.includes(k)) continue;
    fs[k] = streams[k] ?? (guard.covers.fs.has(k) ? guard.fs[k] : refuser(k));
    replaced.push(k);
  }
  fs.realpath.native = refuser("realpath.native");
  for (const k of fnKeys(fsp)) {
    fsp[k] = guard.covers.promises.has(k) ? guard.promises[k] : asyncRefuser(k);
    replaced.push(`promises.${k}`);
  }
  syncBuiltinESMExports();
  installed = true;
  return { denials: guard.denials, probes, deniedRoots: guard.deniedRoots, replaced, kept: [...KEPT_NATIVE] };
}
