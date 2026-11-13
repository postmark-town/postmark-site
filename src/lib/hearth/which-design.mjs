// which-design.mjs — which Hearth design the household page draws (POS-984 seam; POS-962 saved choice).
//
// THE SEAM between the one household page and the choice of a design. The page asks this ONE function, on the
// server for the design it opens on and in the browser for a preview or a saved choice, and draws what it answers.
// It never looks at a household's choice itself.
//
// IT ANSWERS, in order:
//   1. the design `entry` asks for, when one is registered: a PREVIEW (`?entry=<id>`, the picker). Nothing is saved;
//      the address is the whole state.
//   2. the household's own SAVED choice, when `saved` names a registered entry (POS-962: the office keeps it; the
//      caller reads it signed out, choice.mjs § readSavedHearth).
//   3. Postmark's default, the design every household has.
//
// `entries` is the prepared list (entries.mjs). `entry` is the id a preview asks for, or null. `saved` is what the
// office answered: an id, null (the house chose nothing) or undefined (the read failed): the last two draw the
// default, and an id this build does not know draws the default too (choice.mjs § designNote says so aloud).
// Returns the prepared entry to draw, or null only when none is registered at all.

import { pickEntry } from "./entries.mjs";

export function whichDesign(entries, { entry = null, saved = null } = {}) {
  const asked = entry ? entries.find((e) => e.id === entry) : null;
  if (asked) return asked;
  const own = saved ? entries.find((e) => e.id === saved) : null;
  return own ?? pickEntry(entries, null);
}
