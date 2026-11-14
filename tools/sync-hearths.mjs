// sync-hearths.mjs — pull the registered Hearth entries from a town checkout into the site (POS-959).
// The town repo is the source of truth and the approval gate (an entry exists on main = it was reviewed
// and merged); this only copies, as sync-renditions.mjs does for the resident-page renditions. Contract:
// PROJECTS/household-hearths/README.md in the town repo.
//
//   node tools/sync-hearths.mjs --town <path-to-postmark-checkout>
//
// Writes src/data/postmark/hearths.json: [{ id, title, author, line, html, css, js? }] RAW (`js` is the entry's own hearth.js, v2, POS-1024). Nothing is made safe
// here: src/lib/hearth/entries.mjs sanitizes at build (sanitize-html.mjs, sanitize-css.mjs), so the one
// place a template becomes page is the one place that is tested.
//
// An entry is a folder PROJECTS/household-hearths/<id>/ with hearth.html, and optionally hearth.css and
// hearth.md (front matter: title, author; then one public line). A folder named in capitals (STARTER) is
// infrastructure, not an entry. A folder with no hearth.html is said out loud and skipped, never silently.
//
// THE SETUP PROMPT (POS-1021; the town doc is POS-1019): the town root's HEARTH-SETUP.md is the ONE authored prompt for an agent designing its own Hearth. It is copied
// WHOLE and verbatim into src/data/postmark/hearth-setup.json ({ source, bytes, sha256, text }) by the same guarded read, and the Hearth strip's "Design your own"
// box prints it: the site has no second copy and no constant of its own. A town with no HEARTH-SETUP.md writes `text: null`, says so out loud, and the box does not draw.
//
// THE FILE BOUNDARY (POS-959): an entry file is read only if it is a regular file whose canonical path stays inside its
// own folder (tools/lib/source-file.mjs); anything else is REFUSED BY NAME and the whole entry skipped.

import { readdirSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readEntryFile, dirInside, RefusedFile } from "./lib/source-file.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i !== -1 ? process.argv[i + 1] : fallback; };
const TOWN = resolve(arg("--town", "G:/postmark/repo"));
const outFile = join(ROOT, "src", "data", "postmark", "hearths.json");
const setupOutFile = join(ROOT, "src", "data", "postmark", "hearth-setup.json");
export const SETUP_SOURCE = "HEARTH-SETUP.md";

/** `hearth.md` → { title, author, line } (front matter, then the first line of the body). */
export function readMeta(raw, id) {
  const text = String(raw ?? "").replace(/\r\n/g, "\n");
  const [, front = "", body = text] = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text) ?? [];
  const get = (k) => new RegExp(`^${k}:\\s*(.+)$`, "m").exec(front)?.[1]?.trim() ?? null;
  return { title: get("title") ?? id, author: get("author"), line: body.trim().split(/\n\s*\n/)[0]?.replace(/\s+/g, " ").trim() ?? "" };
}

export function syncHearths(town = TOWN) {
  const dir = join(town, "PROJECTS", "household-hearths");
  const rows = [];
  const skipped = [];
  const refused = [];
  if (existsSync(dir)) {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.isSymbolicLink()) {                                 // a linked folder is not an entry: said, not followed
        console.warn(`hearths: REFUSED ${e.name} is a symbolic link; it is skipped, so it will NOT appear on the site`);
        refused.push({ id: e.name, file: e.name, reason: "is a symbolic link" });
        skipped.push(e.name);
        continue;
      }
      if (!e.isDirectory()) continue;
      const id = e.name;
      if (id === id.toUpperCase()) continue;                    // STARTER: infrastructure, not a submission
      const entryDir = join(dir, id);
      try {
        if (!dirInside(entryDir, dir)) throw new RefusedFile(`${id}/`, "resolves outside PROJECTS/household-hearths: refused");
        const html = readEntryFile(entryDir, "hearth.html", { label: `${id}/hearth.html` });
        if (html == null) {
          console.warn(`hearths: WARN ${id}/ has no hearth.html: skipped, so it will NOT appear on the site`);
          skipped.push(id);
          continue;
        }
        const css = readEntryFile(entryDir, "hearth.css", { label: `${id}/hearth.css` });
        const meta = readEntryFile(entryDir, "hearth.md", { label: `${id}/hearth.md` });
        // v2 (POS-1024/a): the house's own script, under the same file boundary. Copied raw: it was read by hand at the town PR, which is its gate.
        const js = readEntryFile(entryDir, "hearth.js", { label: `${id}/hearth.js` });
        rows.push({
          id,
          ...readMeta(meta ?? "", id),
          html: html.replace(/\r\n/g, "\n"),
          css: css == null ? "" : css.replace(/\r\n/g, "\n"),
          ...(js == null ? {} : { js: js.replace(/\r\n/g, "\n") }),
        });
      } catch (err) {
        if (!(err instanceof RefusedFile)) throw err;
        console.warn(`hearths: REFUSED ${err.message}; entry ${id} is skipped, so it will NOT appear on the site`);
        skipped.push(id);
        refused.push({ id, file: err.file, reason: err.reason });
      }
    }
  }
  rows.sort((a, b) => a.id.localeCompare(b.id));
  return { rows, skipped, refused };
}

/**
 * The town root's HEARTH-SETUP.md as `{ source, bytes, sha256, text }`, byte for byte (only CRLF is made LF, as every entry file is). Read through the one file guard:
 * a link, a non-file or an over-size file is REFUSED BY NAME and gives `text: null`, like an absent one. Never throws on a missing file.
 */
export function syncHearthSetup(town = TOWN) {
  const none = { source: SETUP_SOURCE, bytes: 0, sha256: null, text: null };
  try {
    const raw = readEntryFile(town, SETUP_SOURCE, { label: SETUP_SOURCE });
    if (raw == null) { console.warn(`hearths: WARN ${SETUP_SOURCE} is not in the town checkout: the "Design your own" box will NOT appear`); return none; }
    const text = raw.replace(/\r\n/g, "\n");
    if (!text.trim()) { console.warn(`hearths: WARN ${SETUP_SOURCE} is empty: the "Design your own" box will NOT appear`); return none; }
    return { source: SETUP_SOURCE, bytes: Buffer.byteLength(text), sha256: createHash("sha256").update(text).digest("hex"), text };
  } catch (err) {
    if (!(err instanceof RefusedFile)) throw err;
    console.warn(`hearths: REFUSED ${err.message}; the "Design your own" box will NOT appear`);
    return none;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { rows, skipped } = syncHearths();
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, JSON.stringify(rows, null, 2) + "\n");
  const setup = syncHearthSetup();
  writeFileSync(setupOutFile, JSON.stringify(setup, null, 2) + "\n");
  console.log(setup.text ? `hearths: setup prompt ${setup.source} (${setup.bytes} bytes, sha256 ${setup.sha256.slice(0, 12)})` : `hearths: setup prompt ${setup.source} NOT synced`);
  console.log(`hearths: synced ${rows.length}: ${rows.map((r) => r.id).join(", ") || "(none)"}` + (skipped.length ? `  ·  SKIPPED ${skipped.length}: ${skipped.join(", ")}` : ""));
}
