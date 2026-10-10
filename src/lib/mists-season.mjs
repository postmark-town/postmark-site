// mists-season.mjs — the Mists as a baked page reads them.
//
// TWO NUMBERS, BOTH READ, NONE COMPUTED HERE. The crossing is the one this build
// reflects: BUILD_CROSSING, the office's own number (GET /api/), which the box
// already asks for at every rebuild (deploy/site-refresh.sh § crossing_now).
// The schedule is the world's: `mists` in the pinned package's skeleton, read
// through the engine's own `mistsAt`, so the page and every telling agree on
// when the Mists stand and how deep the veil is. The site keeps no copy of
// either (page-freshness.mjs § WHY IT NEVER COMPUTES A CROSSING).
//
// NULL BEFORE THEY ARRIVE. No crossing named (a local build, CI, an office that
// did not answer), no skeleton, or a crossing before the schedule's first: the
// answer is null, and every caller then emits exactly what it did before, byte
// for byte.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { mistsAt } from "postmark-world/world-engine";

/** The crossing this build reflects, or null. A blank is not zero. */
export function buildCrossing(env = process.env) {
  const raw = String(env?.BUILD_CROSSING ?? "").trim();
  return /^\d+$/.test(raw) ? Number(raw) : null;
}

/** The pinned world's skeleton, or null. */
export function pinnedSkeleton(root = process.cwd()) {
  try { return JSON.parse(readFileSync(join(root, "node_modules", "postmark-world", "WORLD", "skeleton.json"), "utf8")); }
  catch { return null; }
}

/** The crossing the season is full from: its ramp runs from the Mists' first
 *  crossing (the skeleton's) to this one. */
export const SEASON_FULL = 284;
/** How far into the season a crossing stands, 0 at the first crossing, 1 from
 *  SEASON_FULL on. */
export function seasonRamp(crossing, first) {
  if (!Number.isFinite(first) || SEASON_FULL <= first) return 1;
  return Math.max(0, Math.min(1, (crossing - first) / (SEASON_FULL - first)));
}

/** The Mists for this build: the engine's block (veil, density), the crossing
 *  and the season's ramp `t`, or null before they arrive. */
export function siteMists({ crossing = buildCrossing(), skeleton = pinnedSkeleton() } = {}) {
  if (crossing === null || !skeleton?.mists) return null;
  const m = mistsAt(crossing, skeleton.mists);
  return m ? { crossing, veil: m.veil, density: m.density, t: seasonRamp(crossing, skeleton.mists.schedule?.[0]?.crossing) } : null;
}
