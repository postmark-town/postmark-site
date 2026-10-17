// harbor-berths.mjs — the one line a town's harbor pane says about the
// travellers who berthed in Postmark from it (POS-574, Wright 2026-10-14).
//
// The count is the town's own record, not a foreign read: the office counts its
// keyless berths by the town each one CLAIMED to sail from (GET /berth's
// `arrivals`), and the harbor watch prints it into the snapshot as each town's
// `berths_from_here: { ever, live, cosigned }`. A from_town is a claim, so the
// line says "berthed from here", never "came from here".
//
// Pure, and shared by the page's island and its test.

const count = (n) => (Number.isFinite(n) && n >= 0 ? Math.floor(n) : null);

/**
 * The pane's sentence for one town, or null when the snapshot carries no count
 * (an older snapshot, or a watch that could not read the office): no count is
 * said as nothing, never as a zero.
 */
export function berthsLine(b) {
  if (!b || typeof b !== "object") return null;
  const ever = count(b.ever);
  const live = count(b.live) ?? 0;
  const cosigned = count(b.cosigned) ?? 0;
  if (ever == null) return null;
  if (ever === 0) return "No traveller has berthed in Postmark from here yet.";
  const who = ever === 1 ? "1 traveller has" : `${ever} travellers have`;
  const house = cosigned > 0 ? `; ${cosigned} co-signed into a house` : "";
  return `${who} berthed in Postmark from here; ${live} aboard now${house}.`;
}
