// build-stamp — the deployed site says, out loud, what it was built from.
//
// Written 2026-08-25 for the office's site-sentinel, which cannot answer "is the
// site fresh?" without something on the live site to compare against. Before
// this file the answer was unreachable: PUBLIC_BUILD_SHA existed but rendered
// only inside the SNAPSHOT badge in PostmarkLayout.astro, which is gated on
// `PUBLIC_CHANNEL === "snapshot"`, so PROD carried no stamp at all. Verified
// against the live site the same day: /build.json was 404 and no build metadata
// appeared anywhere in the served HTML.
//
// ── WHY THE STAMP CARRIES TWO SHAS AND NOT ONE ──────────────────────────────
//
// Because the site has two tenses, and one number cannot hold both.
//
// deploy.yml's release lane does NOT build prod from main. It checks out the
// newest `release/*` tag and builds the CODE from there, then copies the town
// DATA back in from main:
//
//     git checkout origin/main -- public/atelier/postmark src/data/postmark
//
// So prod's code lagging main is the DESIGN, and a one-sha stamp compared
// against main would report a permanent, meaningless staleness — the kind of
// alarm a reader learns to ignore, which is worse than no alarm.
//
// And the split is not theoretical. That overlay step exists because of a real
// freeze, recorded in deploy.yml's own comment: "prod served Crossing 144 while
// main carried 146" — the code correctly pinned, the content silently frozen
// behind it, for a day. A single sha cannot even express that failure. Two shas
// make it the first thing a reader sees.
//
// ── WHY `git rev-parse HEAD` AND NOT `github.sha` ───────────────────────────
//
// `github.sha` names the commit that TRIGGERED the workflow. On the release
// lane the job then does `git checkout "$TAG"`, and github.sha does not follow
// it — so the built code is the tag's while github.sha still says main's. A
// stamp built from github.sha would be confidently wrong on exactly the lane
// where being right matters. HEAD is read after every checkout has happened, so
// it is the sha that was actually compiled.
//
// ── WHAT IT DOES WHEN IT CANNOT TELL ────────────────────────────────────────
//
// It emits the stamp with the unknown field `null` and says why in `notes`. It
// does NOT guess, and it does NOT fail the deploy: a site that ships is worth
// more than a stamp, and the sentinel treats a null half as UNKNOWN — never as
// green — so an honest gap costs visibility and never buys a false all-clear.
//
// Usage: node tools/build-stamp.mjs --out dist-town/build.json
//   env: PUBLIC_CHANNEL         release | snapshot   (deploy.yml sets it)
//        BUILD_CODE_REF         the tag or branch the code came from
//        BUILD_TOWN_DATA_SHA    the origin/main sha the town-data overlay used
//                               (release lane only; on snapshot the data rode
//                               the checkout, so the code sha IS the data sha)
//        BUILD_TOWN_SHA         the postmark-town/postmark commit the extractors
//                               actually read — the town record this page shows
//        BUILD_CROSSING         that moment in ferry crossings, asked of the
//                               office (GET /api/ -> crossing.number). Never
//                               derived here: one clock, and it is the office's.
//        BUILD_WORLD_REF        the settlement tag the world was advanced to,
//                               when the lane knows it (settlement/S63); empty
//                               or unset otherwise. NEVER the sha — see below.
//
// ── THE FOURTH FIELD: WHICH WORLD (2026-09-08) ──────────────────────────────
//
// The /world/ page is a passthrough of the pinned postmark-world package: its
// viewer and record are STAGED from node_modules at /world-engine/** and
// /WORLD/**, not bundled. So "which site is live" (code_sha) does not answer
// "which world is live", and on 2026-09-08 that question took a night to
// answer by hand: prod's ground flipped from the atlas painting to the
// record-drawn townGround() (w37.5, world 91536f76) and back (w37.6, S63
// 256db2fe), while /build.json said only "release/2026-w37.6" both before and
// after, and /data/pin.json — written by the EXTRACT tree from site main's
// lockfile — named a floor the build tree had already advanced past on the
// afternoon's w37.4 builds ("world: advancing to settlement S63"). Neither
// stamp could say what /world-engine/spectator/viewer.mjs actually was; the
// answer had to be md5'd off the wire and matched against the world repo.
//
// `world_sha` is read from THIS tree's package-lock.json — the tree the
// stamper runs in, which on both lanes is the build tree after the world-pin
// resolver has installed (and, on advance, re-locked) the world — so it is the
// sha the page was compiled against, never the floor another tree carries. Not
// from the environment: a sha handed in by a shell is a claim, the lockfile is
// the receipt. `world_ref` IS taken from the environment because only the lane
// knows whether the sha is a blessed tag's commit; it is a name, not a claim
// about bytes, and it is null whenever the lane did not say.
//
// Reader: a human or the site-sentinel at https://postmark.town/build.json,
// comparing `world_sha` against the world repo's settlement tags — the check
// that was done by hand that night.

import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const SCHEMA = 1;

/**
 * The stamp, as a pure function of what the build knows about itself.
 *
 * Every unknown becomes an explicit null plus a note. The one thing this must
 * never do is fill a gap with a plausible value — a stamp that is confidently
 * wrong is worse than one that admits it cannot say, because the watcher
 * downstream believes it.
 */
export function composeStamp({ channel, codeSha, codeRef, townDataSha, townSha, crossing, builtAt, world = null, worldRef = null, problems = null }) {
  const notes = [];
  const lane = channel === "release" || channel === "snapshot" ? channel : null;
  if (!lane) notes.push("PUBLIC_CHANNEL was not release or snapshot, so the lane is unknown");
  if (!codeSha) notes.push("could not read the built commit (git rev-parse HEAD) — code freshness is unreadable for this build");

  // On the snapshot lane there is no tag pin and no overlay: the town data rode
  // the same checkout as the code, so the code sha IS the data sha. Saying that
  // explicitly is not padding — a reader who sees the two fields equal needs to
  // know whether that means "in sync" or "same source", and only the lane knows.
  let dataSha = townDataSha || null;
  let dataFrom;
  if (lane === "release") {
    dataFrom = "overlaid from site main (deploy.yml: git checkout origin/main -- public/atelier/postmark src/data/postmark)";
    if (!dataSha) notes.push("the release lane did not report the overlay's origin/main sha — town-data freshness is unreadable for this build");
  } else {
    dataSha = dataSha || codeSha || null;
    dataFrom = "the checkout itself — the snapshot lane has no tag pin and no overlay, so code and town data share one commit";
  }

  // ── THE THIRD TENSE, AND THE ONE A READER ACTUALLY FEELS ──────────────────
  //
  // `town_data_sha` above names where the data was COPIED FROM (site main, or
  // the checkout). It does not name the town record the page is showing, and
  // that is the thing a resident cares about: not "which commit of the site
  // carried my letters" but "is my mail on this page yet".
  //
  // Two fields answer it. `town_sha` is the postmark-town/postmark commit the
  // extractors read. `crossing` is that moment in the town's OWN units — mail
  // does not move on a wall clock, it moves at ferry crossings, so "how old is
  // this page" is only answerable in crossings.
  //
  // THE CROSSING IS READ FROM THE OFFICE, NEVER DERIVED HERE. The office's
  // src/crossings.mjs exists precisely because "the two honest options were a
  // second copy of the arithmetic — which is how two clocks are born — or this
  // file". So the builder asks GET /api/ for the number and passes it in; a
  // site that computed its own would be the second clock, and the page's whole
  // claim is that it is comparable to the office's.
  //
  // Both are absent-not-guessed. An older builder, or one that could not reach
  // the office, leaves them null with a note, and every reader downstream —
  // site-sentinel's crossing probe, the page's own disclosure line — treats
  // null as "cannot tell", never as "current".
  //
  // The notes are RELEASE-LANE ONLY. On the snapshot lane there is no town
  // checkout to name and no box refresh asking the office — the data rode the
  // commit, as `town_data_from` already says — so a note there would be a
  // standing complaint about a thing that is working as designed, and a stamp
  // whose notes are always populated is a stamp nobody reads the notes of.
  const town = /^[0-9a-f]{7,40}$/i.test(String(townSha ?? "")) ? String(townSha) : null;
  const cross = Number.isInteger(crossing) && crossing >= 0 ? crossing : null;
  if (lane === "release") {
    if (!town) notes.push("this build did not report the town commit it read — the page can say when it was made, but not which town record it reflects");
    if (cross === null) notes.push("no crossing number for this build — the office was not reachable when it was made, so the page cannot say which ferry crossing it reflects");
  }

  // ── THE WORLD, ON BOTH LANES ──────────────────────────────────────────────
  //
  // Unlike the town fields this is noted on the snapshot lane too: dev serves
  // a world from its lockfile exactly as prod does, so a snapshot stamp that
  // cannot name it is degraded, not working-as-designed.
  const worldSha = /^[0-9a-f]{7,40}$/i.test(String(world?.sha ?? "")) ? String(world.sha).toLowerCase() : null;
  const worldFrom = worldSha ? (world?.from ?? null) : null;
  if (!worldSha) notes.push(`this build did not report which postmark-world it compiled${world?.note ? ` (${world.note})` : ""} — the world served at /world/ cannot be told from another world's by this stamp`);
  const ref = String(worldRef ?? "").trim();
  if (!Array.isArray(problems)) notes.push("this build could not read the town manifest's `problems` list (public/atelier/postmark/data/index.json), so the stamp cannot say what the fetch failed to get — a reader must treat that as unread, never as clean");

  return {
    schema: SCHEMA,
    channel: lane,
    built_at: builtAt,
    code_sha: codeSha || null,
    code_ref: codeRef || null,
    town_data_sha: dataSha,
    town_data_from: dataFrom,
    town_sha: town,
    crossing: cross,
    // The postmark-world this build compiled the /world/ page from, read from
    // the build tree's own lockfile; and the settlement tag's name for it when
    // the lane advanced to one (null is "the lane did not say", never a guess).
    world_sha: worldSha,
    world_from: worldFrom,
    world_ref: ref || null,
    // Said on every stamp, not only when the two differ. The whole reason this
    // file exists is that one number could not hold both tenses, and a reader
    // meeting the stamp for the first time should meet that fact here.
    why_two: "prod builds CODE from the newest release/* tag and overlays town DATA from main, so the two move on different clocks and each must be compared against its own source.",
    // ── WHAT THIS BUILD COULD NOT GET (POS-180, 2026-09-21) ─────────────────
    //
    // The one field on this stamp the stamper does not know first-hand. Every
    // other value here is read from the build's own receipts — git, the
    // lockfile, the environment — but this one is the FETCH's knowledge, and
    // the fetch ran in a different process and, on the box, a different tree.
    // So it travels the way the town data travels: fetch-town.mjs writes it
    // onto the served manifest, site-refresh.sh's overlay rsyncs
    // public/atelier/postmark into the build tree, and it is read back here.
    //
    // Three states, and they are three different sentences:
    //   []      this build got everything it asked the office for.
    //   [...]   it published anyway, and these are the things it could not get.
    //   null    the manifest could not be read, so this build cannot say.
    // `null` is NOT `[]`, for the same reason every other unknown on this stamp
    // is a null with a note: a stamp that says "no problems" because it failed
    // to look is the false all-clear this whole file exists to refuse.
    problems: Array.isArray(problems) ? problems : null,
    notes,
  };
}

/**
 * Which postmark-world the tree at `root` compiled, from its own receipts.
 *
 * package-lock.json first: it is what `npm ci` installs from, and the
 * world-pin resolver's advance re-locks it, so its `resolved` names the sha
 * the page was built against. The installed package's own package.json is the
 * fallback for a tree with no lockfile (npm drops `_resolved`/`gitHead` on a
 * git install, so it usually cannot answer — tools/lib/world-pin-publish.mjs
 * learned that the hard way, repair 1). Every failure is a null plus a reason.
 */
export function readWorldSha({ root = process.cwd(), read = (p) => readFileSync(p, "utf8") } = {}) {
  const sha = (s) => { const m = /#([0-9a-f]{7,40})$/i.exec(String(s ?? "")); return m ? m[1].toLowerCase() : null; };
  let lockNote = null;
  try {
    const lock = JSON.parse(read(join(root, "package-lock.json")));
    const entry = lock?.packages?.["node_modules/postmark-world"];
    const got = sha(entry?.resolved);
    if (got) return { sha: got, from: "package-lock.json", note: null };
    lockNote = entry ? "package-lock.json holds postmark-world but its `resolved` names no sha" : "package-lock.json has no postmark-world entry";
  } catch { lockNote = "package-lock.json could not be read"; }
  try {
    const dep = JSON.parse(read(join(root, "node_modules", "postmark-world", "package.json")));
    const got = sha(dep?._resolved) ?? (/^[0-9a-f]{7,40}$/i.test(String(dep?.gitHead ?? "")) ? String(dep.gitHead).toLowerCase() : null);
    if (got) return { sha: got, from: "node_modules", note: null };
    return { sha: null, from: null, note: `${lockNote}, and the installed package records no commit of its own` };
  } catch { return { sha: null, from: null, note: `${lockNote}, and the installed package could not be read` }; }
}

/**
 * The `problems` list this build's fetch recorded, from the served manifest.
 *
 * Read from the build tree's own public/ — the copy that is about to be served
 * — rather than from src/data/, because the served file is the one a reader of
 * /data/index.json will see and the stamp must not be able to disagree with it.
 * Every failure is a null, never an empty list: see composeStamp's `problems`.
 */
export function readProblems({ root = process.cwd(), read = (p) => readFileSync(p, "utf8") } = {}) {
  try {
    const manifest = JSON.parse(read(join(root, "public", "atelier", "postmark", "data", "index.json")));
    return Array.isArray(manifest?.problems) ? manifest.problems : null;
  } catch { return null; }
}

/** Read what the build knows, tolerating every failure as a null-plus-note. */
export function gather({ env = process.env, exec = execFileSync, now = () => new Date(), root = process.cwd(), read } = {}) {
  let codeSha = null;
  try { codeSha = String(exec("git", ["rev-parse", "HEAD"], { encoding: "utf8" })).trim() || null; } catch { codeSha = null; }
  // BUILD_CROSSING arrives as a string from the environment and must survive
  // every shape a shell can hand it: unset, empty (the box script's
  // `$(crossing_now)` when the office did not answer), or a number. Number("")
  // is 0, which would stamp crossing ZERO — the very first ferry, in June — on
  // every build that could not reach the office. Hence the explicit blank test
  // before the parse, and its falsifier.
  const rawCrossing = String(env.BUILD_CROSSING ?? "").trim();
  return composeStamp({
    channel: env.PUBLIC_CHANNEL ?? null,
    codeSha,
    codeRef: env.BUILD_CODE_REF ?? null,
    townDataSha: env.BUILD_TOWN_DATA_SHA ?? null,
    townSha: env.BUILD_TOWN_SHA ?? null,
    crossing: /^\d+$/.test(rawCrossing) ? Number(rawCrossing) : null,
    builtAt: now().toISOString(),
    world: readWorldSha(read ? { root, read } : { root }),
    worldRef: env.BUILD_WORLD_REF ?? null,
    problems: readProblems(read ? { root, read } : { root }),
  });
}

export function main(argv = process.argv, deps = {}) {
  const i = argv.indexOf("--out");
  const out = i > -1 ? argv[i + 1] : "dist-town/build.json";
  const stamp = gather(deps);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(stamp, null, 2) + "\n");
  console.log(`build-stamp: ${out} — ${stamp.channel ?? "unknown lane"}, code ${String(stamp.code_sha).slice(0, 8)} (${stamp.code_ref ?? "?"}), town data ${String(stamp.town_data_sha).slice(0, 8)}, world ${String(stamp.world_sha).slice(0, 8)} (${stamp.world_ref ?? "no tag named"}), problems ${stamp.problems === null ? "unread" : stamp.problems.length}`);
  for (const p of stamp.problems ?? []) console.log(`  problem: ${p}`);
  for (const n of stamp.notes) console.log(`  note: ${n}`);
  return stamp;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
