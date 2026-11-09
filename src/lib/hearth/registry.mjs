// registry.mjs — the registered Hearth entries, prepared once per build (POS-959).
//
// Reads src/data/postmark/hearths.json (tools/sync-hearths.mjs copies it from the town repo's
// PROJECTS/household-hearths/), prepares every entry (entries.mjs), and SAYS what the sanitizers
// removed: the mechanical half of a template's review is this warning. A clean template prints nothing.
// Module-level, so the build says it once, not once per household page.

import rows from "../../data/postmark/hearths.json";
import { prepareEntries, pickEntry } from "./entries.mjs";
import { DEFAULT_ENTRY } from "./slots.mjs";

export const { entries, rejected } = prepareEntries(rows);
for (const r of rejected) console.warn(`hearth: entry "${r.id}" is not drawn: ${r.error}`);
for (const e of entries) {
  if (e.problems.length) console.warn(`hearth: entry "${e.id}" had parts removed by the sanitizer: ${e.problems.join(", ")}`);
}
if (!entries.some((e) => e.id === DEFAULT_ENTRY)) console.warn(`hearth: no "${DEFAULT_ENTRY}" entry is registered; the first one stands in`);
export const defaultEntry = pickEntry(entries, DEFAULT_ENTRY);
