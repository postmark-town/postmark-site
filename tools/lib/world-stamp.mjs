// world-stamp.mjs — WHICH SETTLEMENT THE EXPORTED FOLD REFLECTS.
//
// ── WHY THE EXPORT COULD NOT SAY THIS BEFORE (postmark#2923) ────────────────
//
// `https://postmark.town/WORLD/world-state.json` is the pinned world package's
// committed fold, copied verbatim into the build output by
// `town/scripts/world-engine-island.mjs`. A reader who downloads it cannot tell
// which settlement it reflects, because THE FOLD CANNOT STAMP ITSELF: it is
// computed before the blessing, and the number counts blessings, not beats —
//
//     "the number counts blessings, not beats — a refused gate does not
//      increment it, so it is read from the world's settlement/S<n> tags and
//      derived from no clock"   (world LOGOS/classes.md § crossing ②)
//
// — and the keeper pushes that tag about twenty minutes AFTER the fold's own
// commit. So no step in the world repo can write it truthfully, which is why
// the world half of #2923 was stopped on 2026-09-18 and re-homed here. The site
// is where the copy is made, and the site is the one place that knows both the
// commit it installed and the settlement that commit was blessed as.
//
// ── TWO SOURCES, EACH NAMING ITSELF, NEVER AVERAGED ────────────────────────
//
// The same discipline `tools/lib/world-pin-publish.mjs` already uses for its
// two shas: name where the answer came from, and when two sources disagree say
// so rather than picking one quietly.
//
//   "resolver"      the release rebuild lane resolved it. This is the STRONG
//                   source and is correct by construction in both of the
//                   resolver's branches: on an advance the settlement is the
//                   tag it installed, and on a hold it is `floorSettlement` —
//                   an ANCESTRY walk, which is the only thing that answers
//                   correctly when the floor is pinned to a commit downstream
//                   of its own tag (tools/lib/world-pin.mjs § guardrail 2).
//
//   "installed-sha" nobody resolved one, so the installed commit is looked up
//                   in the town's own settlements record. This answers whenever
//                   the pin sits exactly ON a settlement tag's commit, which is
//                   what the keeper's daily pin-bump ceremony produces, and it
//                   is how a snapshot or a local build can still be stamped.
//
// Neither is guessed at. A build that cannot name the settlement writes null
// and says why — an absent stamp is a real state ("this build could not tell
// you"), and it must never be dressed up as a number. That is the whole reason
// the field is worth having: a reader comparing a downloaded copy against the
// office's own /world/settlements can see a lag as a FACT rather than a bug.
//
// Pure and I/O-free: every seam that touches a disk is the caller's, so each
// rule below is falsifiable from a fixture with no build and no network.

/**
 * The ONE staged record that carries the stamp, as its public path's tail.
 *
 * Named here rather than in the staging walk because the rule is about this
 * stamp, not about staging: every other record is copied byte for byte, and the
 * next reader who wonders which file grew two keys should find the answer in
 * the file that grew them.
 */
export const STAMPED_RECORD = "WORLD/world-state.json";

/** A settlement row as the office publishes it: `{ n, sha, date }`, exactly. */
function rowOf(value) {
  const n = Number(value?.n);
  const sha = typeof value?.sha === "string" ? value.sha.trim().toLowerCase() : "";
  const date = typeof value?.date === "string" ? value.date.trim() : "";
  if (!Number.isInteger(n) || n < 0 || !/^[0-9a-f]{7,40}$/.test(sha) || !date) return null;
  return { n, sha, date };
}

/**
 * Every settlement the town's record names, newest first, de-duplicated by
 * number. `current` and `recent` overlap by design, and `current` wins.
 *
 * @param {unknown} record the office's `/world/settlements` answer
 * @returns {{ n: number, sha: string, date: string }[]}
 */
export function settlementRows(record) {
  const out = new Map();
  const recent = Array.isArray(record?.recent) ? record.recent : [];
  for (const value of [...recent, record?.current]) {
    const row = rowOf(value);
    if (row) out.set(row.n, row);
  }
  return [...out.values()].sort((a, b) => b.n - a.n);
}

/** Do these two name the same commit? One may be abbreviated; both are git's. */
export function sameCommit(a, b) {
  const x = String(a ?? "").trim().toLowerCase();
  const y = String(b ?? "").trim().toLowerCase();
  if (!/^[0-9a-f]{7,40}$/.test(x) || !/^[0-9a-f]{7,40}$/.test(y)) return false;
  return x.startsWith(y) || y.startsWith(x);
}

/**
 * The stamp the staged export carries.
 *
 * @param {object} opts
 * @param {unknown} opts.record         the town's settlements record, or null
 * @param {string|null} opts.installedSha the world commit this build compiled against
 * @param {string|number|null} opts.envSettlement the rebuild lane's resolved settlement
 * @returns {{ settlement: string|null,
 *             as_of: { n: number, sha: string, date: string }|null,
 *             from: "resolver"|"installed-sha"|null,
 *             notes: string[] }}
 */
export function settlementStamp({ record = null, installedSha = null, envSettlement = null } = {}) {
  const notes = [];
  const rows = settlementRows(record);
  const span = rows.length ? `${rows.length} rows, S${rows[rows.length - 1].n}..S${rows[0].n}` : "no rows";
  const sha = typeof installedSha === "string" && /^[0-9a-f]{7,40}$/.test(installedSha.trim().toLowerCase())
    ? installedSha.trim().toLowerCase()
    : null;
  if (!sha) notes.push("the world commit this build installed could not be read, so the settlements record could not be searched by sha");
  if (!rows.length) notes.push("the town's settlements record was absent or carried no usable row — run tools/fetch-town.mjs, which mirrors GET /world/settlements");

  // ── the strong source ─────────────────────────────────────────────────────
  const asked = String(envSettlement ?? "").trim().replace(/^S/i, "");
  const n = asked === "" ? NaN : Number(asked);
  if (Number.isInteger(n) && n >= 0) {
    const row = rows.find((r) => r.n === n) ?? null;
    if (!row) {
      notes.push(`the rebuild lane resolved S${n} and the town's settlements record does not carry that row (${span}), so its sha and date are unknown here`);
      return { settlement: `S${n}`, as_of: null, from: "resolver", notes };
    }
    // Two sources in hand: say it when they disagree. A re-cut tag is the case
    // this catches, and averaging them would hide exactly that.
    if (sha && !sameCommit(sha, row.sha))
      notes.push(`the rebuild lane resolved S${n}, whose recorded commit is ${row.sha}, but this build installed ${sha.slice(0, 9)} — the stamp names the settlement, and the two commits differ`);
    return { settlement: `S${row.n}`, as_of: row, from: "resolver", notes };
  }
  if (envSettlement != null && asked !== "")
    notes.push(`the rebuild lane's settlement was ${JSON.stringify(String(envSettlement))}, which is not a settlement number`);

  // ── the fallback: is the installed commit itself a blessed one? ───────────
  if (sha && rows.length) {
    const row = rows.find((r) => sameCommit(sha, r.sha)) ?? null;
    if (row) return { settlement: `S${row.n}`, as_of: row, from: "installed-sha", notes };
    notes.push(`the world commit this build installed (${sha.slice(0, 9)}) is not one of the settlements the town's record names (${span}) — it is either unblessed or older than the record reaches`);
  }
  return { settlement: null, as_of: null, from: null, notes };
}

/** The one sentence a null stamp leaves in the export, so an absence has a reason. */
export function stampNote(stamp) {
  return stamp?.notes?.length
    ? stamp.notes.join("; ")
    : "this build could not name the settlement this fold reflects";
}

/**
 * The export's own text with the stamp spliced in at the top.
 *
 * A SPLICE, NOT A RE-SERIALISE, and that is the load-bearing choice: the
 * published export is today byte-for-byte the world repo's own file, and
 * readers diff it against that. Re-encoding it through `JSON.parse` /
 * `JSON.stringify` would rewrite every line of a 0.93 MB file to say two, and
 * a whitespace-only difference in a record people compare is a false positive
 * they have to chase. Every byte after the opening brace is preserved exactly.
 *
 * @param {string} text the record file as the package carries it
 * @param {ReturnType<typeof settlementStamp>} stamp
 * @returns {string}
 */
export function stampedExportText(text, stamp) {
  const s = String(text);
  const open = s.indexOf("{");
  if (open === -1) throw new Error("the world-state export is not a JSON object — refusing to stamp it");
  const rest = s.slice(open + 1);
  const nl = rest.startsWith("\r\n") ? "\r\n" : "\n";
  const asOf = stamp.as_of
    ? [
      "{",
      `    "n": ${JSON.stringify(stamp.as_of.n)},`,
      `    "sha": ${JSON.stringify(stamp.as_of.sha)},`,
      `    "date": ${JSON.stringify(stamp.as_of.date)}`,
      "  }",
    ].join(nl)
    : "null";
  const lines = [
    `  "settlement": ${JSON.stringify(stamp.settlement)}`,
    `  "as_of": ${asOf}`,
  ];
  if (!stamp.settlement) lines.push(`  "settlement_note": ${JSON.stringify(stampNote(stamp))}`);
  // An object with nothing else in it takes no separating comma.
  const empty = /^\s*\}/.test(rest);
  return `${s.slice(0, open + 1)}${nl}${lines.join(`,${nl}`)}${empty ? nl : ","}${rest}`;
}
