// source-file.mjs — read ONE file of a town entry, only if it is really that entry's own file (POS-959).
//
// The intake tools (sync-hearths.mjs, sync-renditions.mjs) copy what a town entry's folder holds into this repo. An entry
// file is therefore read only when
//
//   1. lstat says it is a regular file (not a link, not a directory, not a device or a pipe), AND
//   2. its canonical path stays inside the entry's own folder, AND
//   3. it is opened with O_NOFOLLOW and the OPEN handle is still a regular file, AND
//   4. it is small (an entry is markup, not a payload).
//
// Anything else is REFUSED BY NAME (RefusedFile: which file, why), never read, never copied. A file that simply is not
// there is `null`, as before. The caller skips the whole entry and says so. Narrow on purpose: this is the one guard, used
// by both intake tools; it is not an intake framework.

import { lstatSync, openSync, fstatSync, readSync, closeSync, realpathSync, constants } from "node:fs";
import { basename, join, sep } from "node:path";

export const MAX_ENTRY_FILE_BYTES = 1_000_000;

export class RefusedFile extends Error {
  constructor(file, reason) {
    super(`${file} ${reason}`);
    this.name = "RefusedFile";
    this.file = file;
    this.reason = reason;
  }
}

/** True when `child` is a real directory path inside `parent` (canonical paths; a link in the way fails it). */
export function dirInside(child, parent) {
  try {
    const c = realpathSync(child), p = realpathSync(parent);
    return c.startsWith(p + sep);
  } catch { return false; }
}

/**
 * @param {string} dir   the entry's folder
 * @param {string} name  a plain file name inside it (no separators)
 * @param {{ buffer?: boolean, label?: string }} [opts]  `label` is how a refusal names the file (default: name)
 * @returns {string | Buffer | null}  the contents; null when the file is absent
 * @throws {RefusedFile}
 */
export function readEntryFile(dir, name, { buffer = false, label = name } = {}) {
  if (basename(name) !== name || name === "." || name === "..") throw new RefusedFile(label, "is not a plain file name");
  const full = join(dir, name);
  let st;
  try { st = lstatSync(full); } catch (e) { if (e?.code === "ENOENT") return null; throw e; }
  if (st.isSymbolicLink()) throw new RefusedFile(label, "is a symbolic link: refused, not read");
  if (!st.isFile()) throw new RefusedFile(label, "is not a regular file: refused, not read");
  let real;
  try { real = realpathSync(full); } catch { throw new RefusedFile(label, "could not be resolved: refused, not read"); }
  const root = realpathSync(dir);
  if (!real.startsWith(root + sep)) throw new RefusedFile(label, "resolves outside its entry folder: refused, not read");
  let fd;
  try { fd = openSync(full, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0)); }
  catch (e) {
    if (e?.code === "ELOOP") throw new RefusedFile(label, "is a symbolic link: refused, not read");
    throw e;
  }
  try {
    const open = fstatSync(fd);
    if (!open.isFile()) throw new RefusedFile(label, "is not a regular file: refused, not read");
    if (open.size > MAX_ENTRY_FILE_BYTES) throw new RefusedFile(label, `is ${open.size} bytes, over the ${MAX_ENTRY_FILE_BYTES} an entry file may be: refused, not read`);
    const bytes = Buffer.alloc(open.size);
    let off = 0;
    while (off < bytes.length) {
      const n = readSync(fd, bytes, off, bytes.length - off, off);
      if (n <= 0) break;
      off += n;
    }
    const got = off < bytes.length ? bytes.subarray(0, off) : bytes;
    return buffer ? got : got.toString("utf8");
  } finally { closeSync(fd); }
}
