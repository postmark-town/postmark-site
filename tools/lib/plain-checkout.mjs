// plain-checkout.mjs — the town refuses symbolic links (mode 120000): intake is
// plain files only (POS-969). The extractors read a town checkout with plain fs
// reads, which follow a link wherever it points, so they ask this first and
// read nothing from a checkout that holds one.

import { readdirSync } from "node:fs";
import { join } from "node:path";

/** Every symbolic link under `dir` (the top-level .git aside), as slash paths relative to it. Throws when a folder cannot be read. */
export function linksIn(dir, at = "") {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (!at && e.name === ".git") continue;
    const rel = at ? `${at}/${e.name}` : e.name;
    if (e.isSymbolicLink()) out.push(rel);
    else if (e.isDirectory()) out.push(...linksIn(join(dir, e.name), rel));
  }
  return out.sort();
}

/** Exit 1, naming them, when the checkout at `town` holds any symbolic link. */
export function refuseLinkedCheckout(town) {
  const links = linksIn(town);
  if (!links.length) return;
  console.error(`FATAL: the town checkout holds symbolic links, and intake is plain files only: ${links.join(", ")}`);
  process.exit(1);
}
