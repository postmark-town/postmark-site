// world-staging.mjs — WHICH of the pinned world package's record files the town
// must stage beside its pages, decided rather than remembered.
//
// ── WHAT WENT WRONG ────────────────────────────────────────────────────────
//
// `town/scripts/world-engine-island.mjs` used to carry `RECORD_FILES`: five
// paths, typed by hand, kept in step with the world package by nothing at all.
// A copy without a channel. `WORLD/walk-ledger.md` was not on it, so
// `https://postmark.town/WORLD/walk-ledger.md` answered 404 in production — and
// the viewer answers a 404 for a record by reading the world repo's raw MAIN
// TIP. Every departure the town displayed came from an unblessed branch, which
// is precisely what the release lane's first world-pin guardrail exists to
// prevent. Quoted verbatim from the founder's 2026-08-25 ruling:
//
//     "tags only, never main tip."
//
// The same file had already learned this lesson one section further down, for
// the engine modules: "a NAMED list here was the drift: a new module the viewer
// imports (mark-class.mjs, 2026-07-28) 404'd in prod while dev, serving straight
// from node_modules, never noticed." That list was replaced by a walk of the
// package's `tools/` directory. The record files kept the disease.
//
// ── THE CHANNEL ────────────────────────────────────────────────────────────
//
// A record file is staged because SOMETHING ASKS FOR IT. The demand is read off
// the code that does the asking — the package's own viewer, and the town's own
// pages — so a reader that starts fetching a new record causes it to be staged,
// and a reader that stops causes it to stop being staged. Nobody has to
// remember anything, which is the only kind of list that stays true.
//
// A same-origin record URL is not staged as a guess: if the pinned package does
// not carry the file, the BUILD FAILS. Publishing a page that will 404 and then
// silently read someone else's branch is the failure this whole module exists
// to make impossible, and a warning printed into a green build is how it stayed
// invisible for weeks.
//
// Pure and I/O-free: every seam that touches a disk is injected, so the
// decisions here can be falsified without a build.

/** The record directories the world package publishes to public URLs. */
export const RECORD_ROOTS = ["WORLD", "seeding"];

/**
 * Record paths prod already serves, which this town may not silently STOP
 * serving.
 *
 * This is a compatibility floor, not a second supply list, and the difference
 * matters: the derived set above can drift SHORT (that is the bug), while this
 * one can only ever cause a file to be staged that nobody reads — the harmless
 * direction. Its precedent is the world repo's own retirement inventory, which
 * marks `WORLD/FURNISHING.md` "must stay, hard — moving breaks a URL already
 * handed to residents and baked into published pages".
 *
 * `WORLD/settlement-publications.json` is here because it answers 200 on
 * postmark.town today and no reader in either repo could be found for it
 * (searched 2026-08-26: the world repo reads it off DISK in
 * `tools/settlement-sweep.mjs`, the office reads git tags instead, and the
 * viewer never fetches it). Un-publishing a live URL on the strength of a
 * search that found nothing is a founder's call, not a lane's. Flagged for
 * review; kept until then.
 */
export const PUBLISHED_FLOOR = ["WORLD/settlement-publications.json"];

// A same-origin record URL as source code writes one: quoted, absolute, under a
// record root. Deliberately quote-anchored — a template literal like
// `${RAW}/WORLD/x.json` is a DIFFERENT host's URL and is not a demand on this
// origin, so it must not match.
const RECORD_LITERAL = new RegExp(`["'](/(?:${RECORD_ROOTS.join("|")})/[A-Za-z0-9._\\-/]+)["']`, "g");

/**
 * Source text with its comments removed, so prose about a path is not mistaken
 * for a demand for it.
 *
 * ── ONE PASS, IN SOURCE ORDER, AND THAT IS THE WHOLE POINT ─────────────────
 *
 * This used to be two passes: every block comment removed first, then every
 * line comment. Two passes cannot express "whichever opener comes first wins",
 * and a comment stripper that reads out of source order is not conservative,
 * it is wrong in the QUIET direction — it deletes code.
 *
 * The instance, measured on the pinned viewer (postmark-town/postmark#2867).
 * The world viewer's header draws the habitat table in line comments:
 *
 *     //   • LOCAL (spectator/server.mjs)  — /WORLD/* off disk, /api/walks live,
 *
 * The `/*` inside `/WORLD/*` is dead text to any real parser — it sits in a
 * line comment. To a block-comments-first pass it is an OPENER, and the fake
 * comment it opens runs to the next real `* /` fifty-five lines below, taking
 * every one of the viewer's 11 `import` lines with it. Four such windows in
 * that file, five more readers in this repo with the same header habit; the
 * demand scan saw 0 of the viewer's 11 imports and 6,430 bytes of its text
 * were gone before `recordDemands` ever looked.
 *
 * No record demand actually lived inside those windows on the pin this was
 * measured against, so nothing was mis-staged — which is exactly the shape of
 * a bug worth fixing before it costs something. A record read that moved into
 * one of those windows would have vanished silently, the page would have
 * 404'd in prod, and the viewer answers a 404 by reading the world's main tip.
 * That is the failure this whole module exists to make impossible, arriving
 * through the stripper instead of through a hand-kept list.
 *
 * SWAPPING THE TWO PASSES IS NOT THE FIX, and it is the repair a reader will
 * reach for first. Line-comments-first is wrong in the mirror direction: given
 * `/* a note // with an opener * / fetch("/WORLD/real.json")`, the line pass
 * runs to end of line, eats the block's own close AND the demand behind it, and
 * the record vanishes exactly as before — same silent 404, opposite cause.
 * Neither order is right at every position, which is the point.
 *
 * So: one alternation, applied together, left to right. At each position a
 * line comment or a block comment, whichever starts there — and whichever one
 * matches consumes its text, so an opener inside the other's body is never
 * seen. `//` and `/*` are peers, not stages.
 *
 * Conservative on purpose, otherwise unchanged. A `//` that follows `:` is a
 * URL scheme, not a comment — that one case is worth handling because half the
 * comments in this codebase discuss URLs. Everything else a real parser would
 * catch and this does not (a `//` inside a string literal) fails in the LOUD
 * direction: the demand survives, the build asks for a file, and if the package
 * has it nothing happens at all.
 */
export function stripComments(source) {
  return String(source ?? "").replace(
    /(^|[^:])\/\/[^\n]*|\/\*[\s\S]*?\*\//g,
    (_match, beforeLineComment) => (beforeLineComment === undefined ? " " : beforeLineComment),
  );
}

/**
 * Every same-origin record path the given sources ask this origin for.
 *
 * `sources` is `[{ name, text }]` — the name travels so a failure can say which
 * file made the demand rather than leaving someone to grep for it.
 *
 * Returns `[{ record, askedBy }]`, sorted, one entry per distinct record.
 */
export function recordDemands(sources) {
  const found = new Map();
  for (const { name, text } of sources ?? []) {
    const stripped = stripComments(text);
    for (const match of stripped.matchAll(RECORD_LITERAL)) {
      const record = match[1].slice(1);            // "/WORLD/x.md" → "WORLD/x.md"
      if (!found.has(record)) found.set(record, new Set());
      found.get(record).add(name);
    }
  }
  return [...found.entries()]
    .map(([record, names]) => ({ record, askedBy: [...names].sort() }))
    .sort((a, b) => a.record.localeCompare(b.record));
}

/**
 * The full set of record files this build must stage: what the readers ask for,
 * plus the floor of URLs prod already publishes.
 */
export function recordsToStage(sources) {
  const demands = recordDemands(sources);
  const floor = PUBLISHED_FLOOR
    .filter((record) => !demands.some((demand) => demand.record === record))
    .map((record) => ({ record, askedBy: ["PUBLISHED_FLOOR"] }));
  return [...demands, ...floor].sort((a, b) => a.record.localeCompare(b.record));
}

/**
 * What is wrong with this build, in sentences, or an empty array.
 *
 * `exists(relativePath)` is the one seam that touches the pinned package's
 * directory. Every message names the file, names who asked for it, and names
 * what to do — a build failure that only says "missing" costs the next person
 * the whole investigation again.
 */
export function stagingComplaints({ sources, exists, viewerPath = "spectator/viewer.mjs" }) {
  const complaints = [];
  if (!exists(viewerPath)) {
    complaints.push(
      `the pinned postmark-world package has no ${viewerPath} — the world page would build green and render nothing. `
      + `Bump the postmark-world pin in package.json to a commit that carries the viewer, then rebuild.`);
  }
  for (const { record, askedBy } of recordsToStage(sources)) {
    if (exists(record)) continue;
    complaints.push(
      `the pinned postmark-world package has no ${record}, which ${askedBy.join(" and ")} reads from this origin as /${record}. `
      + `Serving that page would 404 and the viewer would fall back to a source this build did not bless. `
      + `Bump the postmark-world pin to a commit that carries ${record}, or stop reading /${record}.`);
  }
  return complaints;
}

/** The one sentence a failing build throws, complaints and all. */
export function stagingFailure(complaints) {
  return new Error(
    `[world-engine-island] the pinned world package cannot serve this build:\n`
    + complaints.map((line) => `  • ${line}`).join("\n")
    + `\n  This is a hard failure on purpose. A world page that builds green and reads `
    + `an unblessed record is the bug this check exists to prevent ("tags only, never main tip").`);
}
