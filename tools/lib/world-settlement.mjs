// world-settlement.mjs — THE WORLD THIS SITE BAKES IS THE OFFICE'S SETTLEMENT
// (POS-360; Darko's ruling R3, 2026-10-04, world-reads-the-store-rulings.md).
//
// "The box's site build fetches it the way it fetches town data and bakes it as
// today; `build.json` names the settlement and digest; if the office does not
// answer, the build keeps the last good World. The `postmark-world` package
// stays for engine code only."
//
// ── ONE FILE, THREE READERS ─────────────────────────────────────────────────
//
// `src/data/postmark/world-state.json` is the office's own answer to
// GET /world/state (the newest settlement's World minus every opposed mark,
// office POS-359), written by tools/fetch-town.mjs beside the town's other data.
// It travels the way that data travels: sync-atlas commits src/data/postmark to
// site main, the release lane overlays it from main, and the box's
// site-refresh.sh overlays its extract tree's copy into the build tree. So the
// LAST GOOD WORLD is simply the file already there: a fetch that fails writes
// nothing and the kept copy builds.
//
// Readers: src/lib/board.mjs § loadWorldState (the Bounty Board, the civic
// quarter, the households page), town/scripts/world-engine-island.mjs (the
// staged /WORLD/world-state.json export the viewer falls back to), and
// tools/build-stamp.mjs (`world_settlement`, `world_digest` on /build.json).
//
// Pure where it can be: the fetch takes its `fetch`, and the decision is a
// function of the two answers, so each rule is falsifiable from a fixture.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Where the baked World lives, relative to the site root. */
export const WORLD_FILE = ["src", "data", "postmark", "world-state.json"];
export const worldFilePath = (root) => join(root, ...WORLD_FILE);

/**
 * What settlement an office answer IS: `{ n, settlement, digest }`. Throws, with
 * the reason, for anything that is not a settlement's World: the office's file
 * fall-through (`meta.source: "file"`, its `not_settlement` reason quoted), an
 * answer with no marks, or a stamp that names no number or digest. A throw is
 * "the office did not answer a settlement", and the build keeps what it has.
 */
export function settlementOfAnswer(body) {
  if (!body || typeof body !== "object" || !Array.isArray(body.marks))
    throw new Error("the answer is not a World (no marks array)");
  const meta = body.meta ?? null;
  if (meta?.source !== "settlement")
    throw new Error(`the office answered ${meta?.source ? `its ${meta.source}` : "an unstamped World"}, not a settlement${meta?.not_settlement ? ` (${meta.not_settlement})` : ""}`);
  const m = /^S(\d+)$/.exec(String(meta.as_of?.settlement ?? ""));
  const digest = String(meta.as_of?.digest ?? "");
  if (!m) throw new Error(`the answer's as_of names no settlement (${JSON.stringify(meta.as_of?.settlement ?? null)})`);
  if (!/^[0-9a-f]{64}$/.test(digest)) throw new Error(`the answer's as_of names no snapshot digest (${JSON.stringify(meta.as_of?.digest ?? null)})`);
  if (!body.marks.length) throw new Error(`S${m[1]} came back with no marks — an empty World is an office that could not answer, not a quiet town`);
  return { n: Number(m[1]), settlement: `S${m[1]}`, digest };
}

/**
 * Bake the fresh answer over the kept one? Never backwards: a newer settlement
 * already baked is not replaced by an older one (a lagging office, a read worker
 * a settlement behind). The SAME settlement is re-baked, because an opposition
 * changes its World at once (R16) and the site takes it at its next build.
 * → `{ write, reason }`.
 */
export function bakeDecision(fresh, kept) {
  if (!kept) return { write: true, reason: `no World baked yet; baking ${fresh.settlement}` };
  if (fresh.n < kept.n) return { write: false, reason: `the office answered ${fresh.settlement}, older than the baked ${kept.settlement}; keeping ${kept.settlement}` };
  return { write: true, reason: fresh.n === kept.n ? `${fresh.settlement} again (an opposition since moves its World at once)` : `${kept.settlement} -> ${fresh.settlement}` };
}

/** The office's answer. `apiBase` is the office API root (POSTMARK_API). */
export async function fetchWorldSettlement({ apiBase, fetchImpl = fetch, settlement = "" }) {
  // `?settlement=` empty is the newest (office POS-359); a number pins one.
  const url = `${String(apiBase).replace(/\/+$/, "")}/world/state?settlement=${encodeURIComponent(settlement)}`;
  const response = await fetchImpl(url, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`GET ${url} -> ${response.status}`);
  const body = await response.json();
  return { body, ...settlementOfAnswer(body) };
}

/**
 * fetch-town.mjs's whole step: fetch, decide, write. `write(body)` is the
 * caller's build-input writer. Never throws: `{ baked, kept, line }`, where an
 * office that did not answer a settlement leaves the kept World in place and
 * says which one that is (the last good World, R3).
 */
export async function bakeWorld({ apiBase, root, write, fetchImpl = fetch, read }) {
  const kept = keptSettlement(root, read);
  try {
    const fresh = await fetchWorldSettlement({ apiBase, fetchImpl });
    const decision = bakeDecision(fresh, kept);
    if (decision.write) write(fresh.body);
    return { baked: decision.write ? fresh.settlement : null, kept: decision.write ? null : kept?.settlement ?? null, line: `${decision.reason} (digest ${fresh.digest.slice(0, 12)})` };
  } catch (error) {
    return { baked: null, kept: kept?.settlement ?? null, line: `the office answered no settlement; keeping ${kept ? `the baked ${kept.settlement}` : "no baked World (the board reads the package's until one is)"} (${error.message})` };
  }
}

/** The baked World's stamp, or null when there is none (or it is not a settlement's). */
export function keptSettlement(root, read = (p) => readFileSync(p, "utf8")) {
  try { return settlementOfAnswer(JSON.parse(read(worldFilePath(root)))); }
  catch { return null; }
}

/** The baked World, or null. Never throws: an absent World is a state its readers name. */
export function readBakedWorld(root) {
  const p = worldFilePath(root);
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, "utf8")); } catch { return null; }
}

/**
 * The stamp the staged export carries when it IS the baked settlement: the
 * office named it, so the stamp is read off the World's own `meta.as_of`, never
 * re-derived (one stamp for one answer). `as_of` keeps the export's shape:
 * `{ n, sha, date }`, the settlements row's tag commit and publish instant.
 */
export function stampOfBaked(world) {
  const a = world?.meta?.as_of ?? {};
  const m = /^S(\d+)$/.exec(String(a.settlement ?? ""));
  if (!m) return { settlement: null, as_of: null, from: null, notes: ["the baked World names no settlement"] };
  const n = Number(m[1]);
  const asOf = a.tag_sha && a.published_at ? { n, sha: String(a.tag_sha), date: String(a.published_at) } : null;
  return { settlement: `S${n}`, as_of: asOf, from: "office", notes: asOf ? [] : [`the office named S${n} without its tag commit and publish date`] };
}
