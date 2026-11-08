// sync-hearths.mjs — pull the registered Hearth entries from a town checkout into the site (POS-959).
// The town repo is the source of truth and the approval gate (an entry exists on main = it was reviewed
// and merged); this only copies, as sync-renditions.mjs does for the resident-page renditions. Contract:
// PROJECTS/household-hearths/README.md in the town repo.
//
//   node tools/sync-hearths.mjs --town <path-to-postmark-checkout>
//
// Writes src/data/postmark/hearths.json: [{ id, title, author, line, html, css }] RAW. Nothing is made safe
// here: src/lib/hearth/entries.mjs sanitizes at build (sanitize-html.mjs, sanitize-css.mjs), so the one
// place a template becomes page is the one place that is tested.
//
// An entry is a folder PROJECTS/household-hearths/<id>/ with hearth.html, and optionally hearth.css and
// hearth.md (front matter: title, author; then one public line). A folder named in capitals (STARTER) is
// infrastructure, not an entry. A folder with no hearth.html is said out loud and skipped, never silently.

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i !== -1 ? process.argv[i + 1] : fallback; };
const TOWN = resolve(arg("--town", "G:/postmark/repo"));
const outFile = join(ROOT, "src", "data", "postmark", "hearths.json");

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
  if (existsSync(dir)) {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      const id = e.name;
      if (id === id.toUpperCase()) continue;                    // STARTER: infrastructure, not a submission
      const html = join(dir, id, "hearth.html");
      if (!existsSync(html)) {
        console.warn(`hearths: WARN ${id}/ has no hearth.html: skipped, so it will NOT appear on the site`);
        skipped.push(id);
        continue;
      }
      const css = join(dir, id, "hearth.css");
      const meta = join(dir, id, "hearth.md");
      rows.push({
        id,
        ...readMeta(existsSync(meta) ? readFileSync(meta, "utf8") : "", id),
        html: readFileSync(html, "utf8").replace(/\r\n/g, "\n"),
        css: existsSync(css) ? readFileSync(css, "utf8").replace(/\r\n/g, "\n") : "",
      });
    }
  }
  rows.sort((a, b) => a.id.localeCompare(b.id));
  return { rows, skipped };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { rows, skipped } = syncHearths();
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, JSON.stringify(rows, null, 2) + "\n");
  console.log(`hearths: synced ${rows.length}: ${rows.map((r) => r.id).join(", ") || "(none)"}` + (skipped.length ? `  ·  SKIPPED ${skipped.length}: ${skipped.join(", ")}` : ""));
}
