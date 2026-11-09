// which-design.mjs — which Hearth design the household page draws (POS-984).
//
// THE SEAM between the one household page and the choice of a design. The page asks this ONE function, on the
// server for the design it opens on and in the browser for a preview, and draws what it answers. It never looks
// at a household's choice itself.
//
// TODAY it answers: the design `?entry=<id>` asks for, when one is registered (a preview: nothing is saved, the
// address is the whole state), and otherwise Postmark's default, the design every household has. POS-962 (the
// saved choice and its picker) owns what it answers from here: a household's own pick goes inside this function,
// and no page changes.
//
// `entries` is the prepared list (entries.mjs); `entry` is the id a preview asks for, or null. Returns the
// prepared entry to draw, or null only when none is registered at all.

import { pickEntry } from "./entries.mjs";

export function whichDesign(entries, { entry = null } = {}) {
  return pickEntry(entries, entry);
}
