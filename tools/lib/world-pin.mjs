// world-pin.mjs — the world pin as rebuild-time DATA, not release-time config.
//
// THE GAP (keeper's daily, 2026-08-25): prod builds only founder-approved
// `release/*` tags. `release/2026-w35` froze the world pin at 272ed4bb — cut
// hours before settlement/S45 (016813ad) existed — and the keeper's pin-bump
// lane runs on site main, which prod's release build never looks at. The live
// site rendered a pre-S45 world and no amount of blessing moved it.
//
// THE SPLIT: data at crossing pace, code at release pace — the same split the
// town-data overlay already makes (deploy.yml, 9133da117). The world pin stops
// being a number frozen into the release and becomes something the scheduled
// rebuild RESOLVES, every 30 minutes, from the world repo's own tags.
//
// Three guardrails, and this file is where they live:
//
//   1. TAGS ONLY, NEVER MAIN TIP. The candidate set is exactly the refs
//      matching `refs/tags/settlement/S<n>`. `git ls-remote` is called WITHOUT
//      `--tags` on purpose: the listing genuinely contains refs/heads/main, and
//      the filter that throws it away is the code below, not a flag. A
//      guardrail enforced by an argument you could quietly drop is not a
//      guardrail.
//
//   2. MONOTONIC BY SETTLEMENT NUMBER — THE PIN NEVER ROLLS BACKWARDS. The
//      settlement number is parsed as an INTEGER and compared numerically. The
//      known bronze class this belongs to is "release tags can roll the world
//      pin backwards"; the same bug wearing a different hat is a string sort,
//      where "S9" outranks "S45" and the town loses thirty-six settlements. A
//      resolved settlement must be STRICTLY newer than the floor's; equal is a
//      hold, because a floor pinned to a commit downstream of S44 would move
//      BACKWARDS if we replaced it with the S44 tag itself.
//
//   3. ON ANY TAG-RESOLUTION FAILURE, FALL BACK TO THE RELEASE'S FROZEN PIN
//      FILE (THE FLOOR). Every path that cannot prove it is advancing returns
//      the floor. The floor is kept fresh by the keeper's ceremony, which does
//      not change: bump `package.json` on site main at each blessing.
//
// This module is pure. Both seams that touch the world (`lsRemote`,
// `floorSettlementOf`) are injected, so every guardrail is falsifiable in both
// directions from a fixture with no network and no clone.

/** A settlement ref, exactly. `settlement/S45-rc` and `settlement/Sfoo` are not settlements. */
const SETTLEMENT_REF = /^refs\/tags\/settlement\/S(\d+)(\^\{\})?$/;

/** The pin spec the site's package.json carries: `github:owner/repo#<40-hex>`. */
const PIN_SPEC = /^github:([^/#]+)\/([^#]+)#([0-9a-f]{40})$/;

const SHA = /^[0-9a-f]{40}$/;

export const WORLD_PACKAGE = "postmark-world";
export const WORLD_REMOTE = "https://github.com/postmark-town/postmark-world.git";

/**
 * Read the release's frozen world pin — the floor — out of a package.json.
 * The pin file is unchanged by this mechanism; it is only ever READ here.
 *
 * @param {string} packageJsonText
 * @returns {{ sha: string, spec: string, owner: string, repo: string }}
 * @throws if the dependency is missing or is not a 40-hex github pin
 */
export function floorPinFrom(packageJsonText) {
  const pkg = JSON.parse(packageJsonText);
  const spec = pkg?.dependencies?.[WORLD_PACKAGE];
  if (typeof spec !== "string" || !spec) {
    throw new Error(`package.json has no ${WORLD_PACKAGE} dependency to read a floor from`);
  }
  const m = PIN_SPEC.exec(spec);
  if (!m) {
    throw new Error(`${WORLD_PACKAGE} is not pinned to a 40-hex commit: ${spec}`);
  }
  return { sha: m[3], spec, owner: m[1], repo: m[2].replace(/\.git$/, "") };
}

/**
 * GUARDRAIL 1 — tags only, never main tip.
 *
 * Reduce a raw `git ls-remote` listing to the settlement tags it advertises.
 * Anything that is not `refs/tags/settlement/S<n>` is dropped: branches
 * (including refs/heads/main), release tags, HEAD, and near-miss settlement
 * names. Annotated tags advertise two lines — the tag object and the peeled
 * `^{}` commit — and the COMMIT is what a pin means, so the peeled sha always
 * wins.
 *
 * @param {string} lsRemoteText
 * @returns {Map<number, string>} settlement number -> commit sha
 */
export function settlementTagsFrom(lsRemoteText) {
  const direct = new Map();
  const peeled = new Map();
  for (const line of String(lsRemoteText).split("\n")) {
    const [sha, ref] = line.trim().split(/\s+/);
    if (!SHA.test(sha ?? "") || !ref) continue;
    const m = SETTLEMENT_REF.exec(ref);
    if (!m) continue;
    (m[2] ? peeled : direct).set(Number(m[1]), sha);
  }
  const tags = new Map(direct);
  for (const [n, sha] of peeled) tags.set(n, sha);
  return tags;
}

/**
 * GUARDRAIL 2 — monotonic by settlement number.
 *
 * The newest settlement is the NUMERIC maximum, never the lexical one and never
 * the most recently created: a re-cut S44 must not outrank a standing S45.
 *
 * @param {Map<number, string>} tags
 * @returns {{ settlement: number, sha: string } | null}
 */
export function newestSettlement(tags) {
  let best = null;
  for (const [settlement, sha] of tags) {
    if (best === null || settlement > best.settlement) best = { settlement, sha };
  }
  return best;
}

/**
 * Decide what the scheduled rebuild should install as the world.
 *
 * @param {object} opts
 * @param {string} opts.floorSha            the release's frozen pin
 * @param {() => string} opts.lsRemote      raw `git ls-remote <remote>` text; may throw
 * @param {(floorSha: string, tags: Map<number,string>) => number} opts.floorSettlementOf
 *        the newest settlement that is an ancestor of the floor (0 if none); may throw
 * @returns {{ decision: "advance"|"hold", sha: string, settlement: number|null,
 *             floorSha: string, floorSettlement: number|null, reason: string }}
 */
export function decideWorldPin({ floorSha, lsRemote, floorSettlementOf }) {
  const hold = (reason, floorSettlement = null) => ({
    decision: "hold",
    sha: floorSha,
    settlement: floorSettlement,
    floorSha,
    floorSettlement,
    reason,
  });

  if (!SHA.test(String(floorSha ?? ""))) return { ...hold("no-floor-sha"), sha: String(floorSha ?? "") };

  // GUARDRAIL 3 — every failure below returns the floor, never a guess.
  let tags;
  try {
    tags = settlementTagsFrom(lsRemote());
  } catch (error) {
    return hold(`ls-remote-failed: ${error.message}`);
  }
  if (tags.size === 0) return hold("no-settlement-tags");

  const newest = newestSettlement(tags);
  if (!newest || !SHA.test(newest.sha)) return hold("newest-settlement-unusable");

  let floorSettlement;
  try {
    floorSettlement = floorSettlementOf(floorSha, tags);
  } catch (error) {
    return hold(`floor-settlement-unresolved: ${error.message}`);
  }
  if (!Number.isInteger(floorSettlement) || floorSettlement < 0) {
    return hold("floor-settlement-unresolved: not a settlement number");
  }

  // GUARDRAIL 2 — strictly newer, or the floor stands. Equal settlement is a
  // hold on purpose: the floor may be a commit downstream of its own tag, and
  // replacing it with the tag would be a rollback wearing an equals sign.
  if (newest.settlement < floorSettlement) {
    return hold(`would-roll-backwards: newest S${newest.settlement} is older than floor S${floorSettlement}`, floorSettlement);
  }
  if (newest.settlement === floorSettlement) {
    return hold(`already-at-newest: S${floorSettlement}`, floorSettlement);
  }

  return {
    decision: "advance",
    sha: newest.sha,
    settlement: newest.settlement,
    floorSha,
    floorSettlement,
    reason: `newest-settlement: S${floorSettlement} -> S${newest.settlement}`,
  };
}
