#!/usr/bin/env node
// pos394-render-proof.mjs — the render proof that the household and resident surfaces never print the private human (POS-394).
//
// A LIBRARY: test/public-household-render.test.mjs drives it inside the site's
// own `npm test` (Wright 2026-10-13 05:56, CI renders it; nothing new is
// installed: it binds to the checkout's own node_modules, which CI's `npm ci`
// already made). Importing it does nothing. A direct CLI run stays opt-in:
//   POS394_RENDER_PROOF=1 node tools/pos394-render-proof.mjs [--mutant <name>]
//
// WHAT IT RENDERS: the REAL templates, from invented literals, two ways —
//   BUILT (Wright 2026-10-13 06:29, CI-dist): Astro's own public build() of the
//   projection (site https://postmark.town, so the layout's og/canonical URLs
//   resolve) emits exactly three pages into the projection's own dist-proof,
//   from getStaticPaths() over an invented registry whose house HAS a private
//   human; the child reads only those three files —
//     householdPage    /households/brass-hollow/ (town/pages/households/[slug].astro,
//                      layout <title>/description, Household seat + HouseDashboard)
//     residentPage     /residents/wren-pos394/ and /residents/moss-pos394/
//                      (town/pages/residents/[handle].astro, Household wrapper)
//   CONTAINER (experimental_AstroContainer; it cannot carry Astro.site, so it
//   renders no whole page — astro 6.4.0 dist/container/index.js:17-70) —
//     householdSeat    town/components/Household.astro, route "household", handed
//                      a house that STILL CARRIES the private human (the prop
//                      boundary), with HouseDashboard's hd-sub line; FRAGMENT
//     residentWrapper  the same, route "resident" (shared chrome); FRAGMENT
//     residentCard     src/components/ResidentCard.astro (the directory card)
//
// HOW IT STAYS AWAY FROM DATA:
//   - a CODE-ONLY projection: a fresh owned temp dir holding byte-for-byte
//     copies of an EXPLICIT source list, from git objects at one captured head
//     (never the working tree), each verified against its blob id. No records,
//     printouts, assets or generated trees are copied; public/ is an empty dir.
//   - the five generated JSON imports, src/lib/funding.mjs (Rivet 02:03Z, (a))
//     and src/lib/mists-season.mjs (Rivet 05:21Z, harness only) are VIRTUAL
//     modules with invented literals; any other import of a protected id, or
//     of postmark-world, throws in the resolver before anything is read.
//   - the framework comes from the checkout's node_modules through a link; in
//     the child, the pos394 fs guard covers every fs binding, with the
//     projection's protected roots, node_modules/postmark-world and EVERY other
//     top-level entry of the checkout denied (no traversal of the original
//     tree); fetch/http/https/net/tls/dns refused; child processes refused but
//     the exact esbuild binary; workers refused. Every refusal is recorded and
//     any refusal FAILS the run.
//   - configFile false, no integrations, empty publicDir, caches and dist-proof
//     inside the projection, no dep discovery, no watcher, no HMR, controlled
//     env; the build and the container run in separate children.
//
// MUTANTS: each re-inserts an old private-human clause into the PROJECTION's
// copy (exact anchors, each found exactly once); production files are never
// edited, and no base commit is needed (CI checks out one commit).
//
// CLEANUP: the run owns its temp dir, Vite/Astro caches included, and removes
// it on success and on failure (removeOwnedTree: canonical, owned, links never
// followed, the checkout never a target). If it cannot, the run FAILS.
//
// LIMITS: funding chrome and the Halloween/mists chrome render from invented
// stubs and are NOT exercised; client <script> code is emitted, not run; the
// resident card has no historical private-human emitter, so it has no
// falsifier; zero refusals shows the run stayed inside what the guard sees,
// not containment of native/internal reads (esbuild's binary, internal module
// loaders, FileHandle methods, recursive subtrees walked natively).

import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire, syncBuiltinESMExports } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ESBUILD_BIN = "node_modules/@esbuild/linux-x64/bin/esbuild";
const PINS = { astro: "6.4.0", vite: "7.3.3", esbuild: "0.27.7", marked: "18.0.5" };

// The explicit projection: the render closure of the four entry points, from
// git objects at the captured head. funding.mjs and mists-season.mjs are
// deliberately absent (virtual). Anything the templates import that is not
// here fails the run.
export const SOURCES = Object.freeze([
  "src/components/ChipRow.astro", "src/components/DoorLine.astro", "src/components/HalloweenBat.astro",
  "src/components/HalloweenMotif.astro", "src/components/HalloweenSkin.astro", "src/components/PageFreshness.astro",
  "src/components/ResidentCard.astro",
  "src/components/household-dashboard/HouseDashboard.astro", "src/components/household-dashboard/ResidentCard.astro",
  "src/layouts/BaseLayout.astro", "src/layouts/PostmarkLayout.astro",
  "src/lib/appearance.mjs", "src/lib/auth.mjs", "src/lib/civic-art.mjs", "src/lib/correspondents.mjs", "src/lib/door-line.mjs",
  "src/lib/freshness.mjs", "src/lib/halloween-motifs.mjs", "src/lib/halloween-navy.mjs",
  "src/lib/halloween-skin.mjs", "src/lib/halloween-sprinkle.mjs", "src/lib/home-face.mjs", "src/lib/home-pick.mjs",
  "src/lib/home-picture.mjs", "src/lib/household-dashboard/faces.mjs", "src/lib/household-dashboard/fold.mjs",
  "src/lib/household-dashboard/paint.mjs", "src/lib/household-dashboard/reads.mjs", "src/lib/household.mjs",
  "src/lib/households-directory.mjs",
  "src/lib/houses.mjs", "src/lib/last-active.mjs", "src/lib/mark-class.mjs", "src/lib/media-door.mjs", "src/lib/meeps-quarter.mjs",
  "src/lib/nav.mjs", "src/lib/og-image.mjs", "src/lib/page-freshness.mjs", "src/lib/pixel-icons.mjs", "src/lib/pm.mjs",
  "src/lib/profile-picture.mjs",
  "src/lib/sentinel-alert.mjs", "src/lib/tutorial-registry.mjs", "src/lib/tutorial.mjs", "src/lib/world-cockpit.mjs",
  "src/lib/world-feed.mjs", "src/styles/global.css", "src/styles/postmark.css",
  "tools/lib/ids.mjs",
  "town/components/Household.astro", "town/pages/households/[slug].astro", "town/pages/residents/[handle].astro",
]);

// ── the checks, by name ─────────────────────────────────────────────────────
const C = Object.freeze({
  PROP: "the input carries the private human (control)",
  REG: "the registry input carries the private human (control)",
  NEVER: "the HTML never carries the private human",
  MEMBERS: "invented members rendered (the fixture reached the template)",
  PLATE: "the plate is the key, title-cased",
  HDSUB: "hd-sub present",
  HDCOUNT: "hd-sub keeps the public count",
  HDHUMAN: "hd-sub carries no human",
  TITLE_H: "title is the plate",
  DESC: "description is plate, public count and agents",
  TITLE_R: "title is the resident's name",
  CARD: "the card shows the resident",
});
export const CHECKS = C;
export const CASES = Object.freeze({
  householdSeat: [C.PROP, C.NEVER, C.MEMBERS, C.HDSUB, C.HDCOUNT, C.HDHUMAN, C.PLATE],
  residentWrapper: [C.PROP, C.NEVER, C.MEMBERS, C.PLATE],
  residentCard: [C.REG, C.NEVER, C.CARD],
  householdPage: [C.REG, C.NEVER, C.MEMBERS, C.TITLE_H, C.DESC, C.HDSUB, C.HDCOUNT, C.HDHUMAN, C.PLATE],
  residentPage: [C.REG, C.NEVER, C.MEMBERS, C.TITLE_R, C.PLATE],
});
// The only checks a mutant may turn red: the privacy ones.
export const PRIVACY = Object.freeze([C.NEVER, C.HDHUMAN, C.DESC]);
export const REFUSAL_CHANNELS = Object.freeze(["fs", "net", "proc"]);
// The pages the build must emit, exactly (format "directory").
export const BUILT_PAGES = Object.freeze(["households/brass-hollow/index.html", "residents/moss-pos394/index.html", "residents/wren-pos394/index.html"]);

// ── mutants: old private-human clauses, re-inserted into the projection only ─
const OLD = Object.freeze({
  chrome: "        {house.declared && house.human && <span>{house.human}’s household</span>}\n",
  hdsub: "        {house.human && <><b>{house.human}’s</b> household · </>}\n",
  desc: "  description={`${plate}${house.human ? `, ${house.human}’s household` : \"\"} — ${members.length} ${members.length === 1 ? \"resident\" : \"residents\"} of Postmark: ${who}.`}\n",
  fold: "      human: dec.human ?? null,\n",
});
const EDIT = Object.freeze({
  chrome: { path: "town/components/Household.astro", from: "      <p class=\"house-meta\">\n", to: "      <p class=\"house-meta\">\n" + OLD.chrome },
  hdsub: { path: "src/components/household-dashboard/HouseDashboard.astro", from: "      <p class=\"hd-sub\">\n", to: "      <p class=\"hd-sub\">\n" + OLD.hdsub },
  desc: { path: "town/pages/households/[slug].astro",
    from: "  description={`${plate} — ${members.length} ${members.length === 1 ? \"resident\" : \"residents\"} of Postmark: ${who}.`}\n", to: OLD.desc },
  fold: { path: "src/lib/houses.mjs", from: "      // no `human` (POS-394): the fold is public, and the private name never enters it\n", to: OLD.fold },
});
// Each mutant: its edits and EXACTLY the (case, check) pairs it turns red. A
// pair that stays green, any extra red (privacy or not), or any crash/refusal/
// missing page is not the falsifier working. A built page only sees a human if
// the fold carries one, so the page emitters are measured with the old fold
// line restored alongside. The house is shared (two members), so Household
// mounts HouseDashboard on every route (Household.astro:65,79,328-330): the
// hd-sub emitter reaches the resident wrapper and resident pages too. A fold+
// mutant also re-inserts its template clause, so the prop-path fragments (handed
// a house with a human) redden with it (CI 38358098533).
export const MUTANTS = Object.freeze({
  "household-299": { emitter: "Household.astro:299 (chrome), prop path", edits: [EDIT.chrome],
    mustRed: { householdSeat: [C.NEVER], residentWrapper: [C.NEVER] } },
  "dashboard-68": { emitter: "HouseDashboard.astro:68 (hd-sub), prop path", edits: [EDIT.hdsub],
    mustRed: { householdSeat: [C.NEVER, C.HDHUMAN], residentWrapper: [C.NEVER] } },
  "fold+48": { emitter: "houses.mjs fold + households/[slug].astro:48 (description), built page", edits: [EDIT.fold, EDIT.desc],
    mustRed: { householdPage: [C.NEVER, C.DESC] } },
  "fold+68": { emitter: "houses.mjs fold + HouseDashboard.astro:68 (hd-sub), built page", edits: [EDIT.fold, EDIT.hdsub],
    mustRed: { householdPage: [C.NEVER, C.HDHUMAN], residentPage: [C.NEVER],
      householdSeat: [C.NEVER, C.HDHUMAN], residentWrapper: [C.NEVER] } },
  "fold+299": { emitter: "houses.mjs fold + Household.astro:299 (chrome), built pages", edits: [EDIT.fold, EDIT.chrome],
    mustRed: { householdPage: [C.NEVER], residentPage: [C.NEVER], householdSeat: [C.NEVER], residentWrapper: [C.NEVER] } },
});

// ── invented fixtures (no real record, row, name or value) ──────────────────
const SENTINEL = "PRIVATE_SENTINEL_h7rn_human";
const row = (handle, agent) => ({
  handle, profile: {}, address: { agent, joined: "2026-07-01", body: `# ${agent}\n\nAn invented row for the POS-394 render proof.` },
  home: null, region: null, homeImages: [], counts: { received: 0, sent: 0 }, is_office: false, window: null, marks: null,
});
const MEMBERS = [row("wren-pos394", "Wren Fixture"), row("moss-pos394", "Moss Fixture")];
const HOUSE = { slug: "brass-hollow", path: "brass-hollow", declared: true, name: null, since: "2026-08-01",
  human: SENTINEL, residents: MEMBERS.map((m) => m.handle), arriving: [] };
const DATA = {
  "households.json": { schema_version: 1, households: { "brass-hollow": { human: SENTINEL, since: "2026-08-01", residents: HOUSE.residents } } },
  "residents.json": MEMBERS,
  "media.json": {},
  "renditions.json": [],
  "letters.json": [],
};
// Rivet 02:03Z (a): the exports the closure's consumers import, invented values only.
const FUNDING_STUB = `
export const HOLO_LINE = "pos394 stub holo line";
export const HOLO_NAME_LINE = "pos394 stub holo name line";
export const DEEDS_FIXTURE = [];
export const STAMPS_FIXTURE = [];
export const loadDeeds = () => [];
export const deedsFor = () => [];
export const shelfTotals = () => ({ usd: 0, holo: 0 });
export const toDeed = (x) => x;
`;
// APPROVED, harness only (Rivet 05:21Z): siteMists() reads
// node_modules/postmark-world/WORLD/skeleton.json whenever it is called bare
// (HalloweenMotif/Bat/Skin do, at render). null is the real function's own
// "no season" answer.
const MISTS_STUB = `export const siteMists = () => null;\n`;

// path.sep, not "/": Windows joins entries with a backslash (POS-394 win32 correction); identical on POSIX.
const under = (p, root) => p === root || p.startsWith(root.endsWith(path.sep) ? root : root + path.sep);
const git = (...a) => execFileSync("git", ["-C", REPO, ...a], { maxBuffer: 64 * 1024 * 1024 });

/** Apply a mutant's edits to file contents, each anchor exactly once. */
export function applyEdits(contents, edits) {
  const out = { ...contents };
  for (const { path: rel, from, to } of edits) {
    const text = out[rel];
    if (typeof text !== "string") throw new Error(`mutant edit on ${rel}, which is not projected`);
    const n = text.split(from).length - 1;
    if (n !== 1) throw new Error(`mutant anchor on ${rel} found ${n} times, expected once`);
    // an insertion adds exactly one line after its anchor; a replacement swaps one line for one
    const oneLine = (s) => s.endsWith("\n") && s.indexOf("\n") === s.length - 1;
    const insertion = to.startsWith(from);
    const added = insertion ? to.slice(from.length) : to;
    if (!oneLine(added) || (!insertion && !oneLine(from))) throw new Error(`mutant edit on ${rel} is not exactly one line`);
    if (!/(house|dec)\.human/.test(added) || /(house|dec)\.human/.test(from)) throw new Error(`mutant edit on ${rel} is not an old private-human clause`);
    out[rel] = text.replace(from, to);
  }
  return out;
}

// ── one run: projection, child, verdict, cleanup ────────────────────────────
/**
 * Render every case once, from the source at the captured head (optionally
 * with one mutant), and return the report. Never throws for a failed run: the
 * report says why. `toolchain` is a dir holding node_modules (the checkout).
 */
export function runProof({ mutant = null, toolchain = REPO, timeoutMs = 240_000 } = {}) {
  if (mutant && !MUTANTS[mutant]) return { pass: false, problems: [`unknown mutant ${mutant}`] };
  const T = path.resolve(toolchain);
  const pre = [];
  const pkgVersion = (name) => { try { return JSON.parse(fs.readFileSync(path.join(T, "node_modules", name, "package.json"), "utf8")).version; } catch { return null; } };
  for (const [name, v] of Object.entries(PINS)) if (pkgVersion(name) !== v) pre.push(`node_modules ${name} is ${pkgVersion(name)}, pinned ${v} (run npm ci)`);
  if (!fs.existsSync(path.join(T, ESBUILD_BIN))) pre.push(`no ${ESBUILD_BIN}`);
  let HEAD = null;
  try { HEAD = git("rev-parse", "--verify", "HEAD^{commit}").toString().trim(); } catch (e) { pre.push(`cannot read the head: ${e.message}`); }
  if (HEAD && !/^[0-9a-f]{40}$/.test(HEAD)) pre.push("the head is not a full sha");
  if (pre.length) return { pass: false, mutant, head: HEAD, problems: pre.map((p) => `setup: ${p}`) };

  // Every top-level entry of the checkout but node_modules is denied in the
  // child (names only; nothing below is listed or read).
  const denyTop = fs.readdirSync(REPO).filter((n) => n !== "node_modules").map((n) => path.join(REPO, n));

  const P = fs.mkdtempSync(path.join(os.tmpdir(), "pos394-proj-"));
  const manifest = [];
  let verdict;
  try {
    let contents = {};
    for (const rel of SOURCES) {
      const blob = git("rev-parse", `${HEAD}:${rel}`).toString().trim();
      contents[rel] = git("cat-file", "blob", blob).toString("utf8");
      manifest.push({ path: rel, blob });
    }
    const edited = mutant ? applyEdits(contents, MUTANTS[mutant].edits) : contents;
    for (const { path: rel, blob } of manifest) {
      const dest = path.join(P, rel);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, edited[rel], { flag: "wx" });
      const written = execFileSync("git", ["hash-object", "--no-filters", dest]).toString().trim();
      const mutated = edited[rel] !== contents[rel];
      if (!mutated && written !== blob) throw new Error(`byte correspondence failed for ${rel}`);
      if (mutated && written === blob) throw new Error(`the mutant did not change ${rel}`);
    }
    for (const d of ["public-empty", "tmp"]) fs.mkdirSync(path.join(P, d));
    fs.writeFileSync(path.join(P, "package.json"), JSON.stringify({ name: "pos394-projection", private: true, type: "module" }), { flag: "wx" });
    fs.symlinkSync(path.join(T, "node_modules"), path.join(P, "node_modules"));

    const env = {
      PATH: "/usr/bin:/bin", HOME: P, TMPDIR: path.join(P, "tmp"),
      POS394_RENDER_PROOF: "1", ESBUILD_BINARY_PATH: path.join(T, ESBUILD_BIN), ASTRO_TELEMETRY_DISABLED: "1",
    };
    // Two children: the build (production) and the container (development).
    const runs = ["build", "container"].map((kind) => {
      const res = spawnSync(process.execPath, [fileURLToPath(import.meta.url), `--child-${kind}`, P, T, JSON.stringify(denyTop)],
        { cwd: P, env: { ...env, NODE_ENV: kind === "build" ? "production" : "development" }, encoding: "utf8", timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024 });
      let out = null;
      try { out = JSON.parse(res.stdout.trim().split("\n").at(-1)); } catch { /* judged below */ }
      return { kind, res, out };
    });
    const { out, res } = merge(runs);
    verdict = { ...judge(out, res), structural: structural(out, res), failed: failedChecks(out) };
  } catch (e) {
    verdict = { pass: false, problems: [`setup: ${e.message}`], structural: [`setup: ${e.message}`], failed: [] };
  }
  // The run owns P, caches and all, and removes it whatever happened. A
  // cleanup that cannot finish FAILS the run; nobody else cleans up after it.
  const cleanup = removeOwnedTree(P, { keepApart: [T, REPO] });
  if (!cleanup.ok) {
    verdict.pass = false;
    verdict.problems = [...(verdict.problems ?? []), `cleanup: ${cleanup.problem}`];
    verdict.structural = [...(verdict.structural ?? []), `cleanup: ${cleanup.problem}`];
  }
  return { mutant, head: HEAD, projection: manifest.length, cleanup, ...verdict };
}

/** One verdict input from the two children: any child's failure is the run's. */
export function merge(runs) {
  const res = { status: 0, signal: null, error: undefined };
  const out = { cases: {}, refusals: Object.fromEntries(REFUSAL_CHANNELS.map((k) => [k, []])), esbuildSpawns: 0 };
  const crashes = [];
  for (const { kind, res: r, out: o } of runs) {
    if (r?.error && !res.error) res.error = r.error;
    if (r?.signal && !res.signal) res.signal = r.signal;
    if (r?.status !== 0 && res.status === 0) res.status = r?.status ?? null;
    if (!o || typeof o !== "object") { crashes.push(`${kind} child printed no result`); continue; }
    if (o.crash) crashes.push(`${kind}: ${o.crash}`);
    Object.assign(out.cases, o.cases ?? {});
    for (const k of REFUSAL_CHANNELS) {
      if (!Array.isArray(o.refusals?.[k])) out.refusals[k] = null; // a missing channel stays missing
      else if (Array.isArray(out.refusals[k])) out.refusals[k].push(...o.refusals[k]);
    }
    out.esbuildSpawns += o.esbuildSpawns ?? 0;
  }
  if (crashes.length) out.crash = crashes.join(" || ");
  return { out, res };
}

/** For a mutant run: is the red (case, check) SET exactly the mutant's? Returns problems ([] = it is). */
export function falsified(report, name) {
  const m = MUTANTS[name];
  const problems = [...(report.structural ?? [])];
  const key = (c, k) => `${c}\u0000${k}`;
  const expected = new Set(Object.entries(m.mustRed).flatMap(([c, ks]) => ks.map((k) => key(c, k))));
  const red = new Set((report.failed ?? []).map(([c, k]) => key(c, k)));
  for (const [c, ks] of Object.entries(m.mustRed)) for (const k of ks) if (!red.has(key(c, k))) problems.push(`${c}: "${k}" stayed green`);
  for (const [c, k] of report.failed ?? []) {
    if (expected.has(key(c, k))) continue;
    problems.push(PRIVACY.includes(k) ? `${c}: unexpected privacy red "${k}"` : `${c}: non-privacy check "${k}" went red`);
  }
  if (!red.size) problems.push("nothing went red");
  return problems;
}

/**
 * Remove the run's own temp tree, and only it. P must be a real directory (not
 * a link) directly inside the canonical os.tmpdir(), named pos394-proj-*,
 * owned by this user, and neither inside nor containing anything in
 * `keepApart` (the toolchain, the checkout). The tree is listed first with
 * lstat — links are entries to unlink, never followed — and if any entry is
 * foreign-owned or escapes P nothing is deleted. Then files and links are
 * unlinked and directories removed deepest first, one by one.
 *
 * OWNERSHIP, PER PLATFORM (POS-394 win32 correction). POSIX: every entry must
 * be owned by this process's uid, as before. Windows has no getuid and lstat's
 * uid is always 0 there, so on win32 ownership rests on the other gates (a
 * plain pos394-proj- directory directly in the canonical temp dir, keepApart,
 * links never followed, nothing escaping the root). Any OTHER platform without
 * getuid refuses: a missing ownership primitive never becomes a pass.
 */
function ownershipCheck() {
  if (typeof process.getuid === "function") { const uid = process.getuid(); return (st) => st.uid === uid; }
  if (process.platform === "win32") return () => true;
  return null;
}

export function removeOwnedTree(P, { keepApart = [] } = {}) {
  try {
    const owns = ownershipCheck();
    if (!owns) return { ok: false, problem: `cannot check ownership on ${process.platform} (no getuid); nothing deleted` };
    const tmp = fs.realpathSync(os.tmpdir());
    const st = fs.lstatSync(P);
    if (!st.isDirectory() || st.isSymbolicLink()) return { ok: false, problem: `${P} is not a plain directory` };
    if (fs.realpathSync(P) !== P && fs.realpathSync(P) !== path.join(tmp, path.basename(P))) return { ok: false, problem: `${P} does not resolve inside the temp dir` };
    const root = fs.realpathSync(P);
    if (path.dirname(root) !== tmp || !path.basename(root).startsWith("pos394-proj-")) return { ok: false, problem: `${root} is not an owned pos394-proj- dir in ${tmp}` };
    if (!owns(st)) return { ok: false, problem: `${root} is not owned by this user` };
    for (const k of keepApart) {
      let kc; try { kc = fs.realpathSync(k); } catch { kc = path.resolve(k); }
      if (under(kc, root) || under(root, kc)) return { ok: false, problem: `${root} overlaps a protected location` };
    }
    const entries = []; // [path, isDir], parents before children
    const walk = (dir) => {
      for (const name of fs.readdirSync(dir)) {
        const p = path.join(dir, name);
        if (!under(p, root) || p === root) throw new Error(`${p} escapes ${root}`);
        const e = fs.lstatSync(p);
        if (!owns(e)) throw new Error(`${p} is not owned by this user`);
        entries.push([p, e.isDirectory()]);
        if (e.isDirectory()) walk(p);
      }
    };
    walk(root);
    for (const [p, isDir] of [...entries].reverse()) (isDir ? fs.rmdirSync : fs.unlinkSync)(p);
    fs.rmdirSync(root);
    return { ok: true, removed: entries.length };
  } catch (e) {
    return { ok: false, problem: `${e.code ?? ""} ${e.message}`.trim() };
  }
}

/** Everything about a run but the check values: what makes a run unusable as evidence. */
export function structural(out, res) {
  const problems = [];
  if (res?.error) problems.push(`child did not run: ${res.error.code ?? res.error.message}`);
  if (res?.signal) problems.push(`child killed by ${res.signal} (time bound)`);
  if (res?.status !== 0) problems.push(`child exit status ${res?.status}`);
  if (!out || typeof out !== "object") return [...problems, "child printed no result"];
  if (out.crash) problems.push(`child crashed: ${String(out.crash).split("\n")[0]}`);
  const refusals = out.refusals && typeof out.refusals === "object" ? out.refusals : {};
  const channels = Object.keys(refusals).sort();
  if (channels.join() !== [...REFUSAL_CHANNELS].sort().join()) problems.push(`refusal channels ${channels.join(",") || "none"}, expected ${REFUSAL_CHANNELS.join(",")}`);
  for (const k of REFUSAL_CHANNELS) {
    if (!Array.isArray(refusals[k])) problems.push(`refusal channel ${k} missing`);
    else if (refusals[k].length) problems.push(`${k} refusals: ${refusals[k].length}`);
  }
  const cases = out.cases && typeof out.cases === "object" ? out.cases : {};
  const names = Object.keys(cases).sort();
  if (names.join() !== Object.keys(CASES).sort().join()) problems.push(`cases ${names.join(",") || "none"}, expected ${Object.keys(CASES).join(",")}`);
  for (const [name, expected] of Object.entries(CASES)) {
    const checks = cases[name]?.checks;
    if (!checks || typeof checks !== "object") { problems.push(`${name}: no checks`); continue; }
    const got = Object.keys(checks).sort();
    if (got.join("\u0000") !== [...expected].sort().join("\u0000")) problems.push(`${name}: checks ${got.length}, expected exactly ${expected.length} named`);
    for (const c of expected) if (typeof checks[c] !== "boolean") problems.push(`${name}: "${c}" is not a boolean`);
  }
  return problems;
}

/** [case, check] for every expected check that is not exactly true. */
export function failedChecks(out) {
  const failed = [];
  for (const [name, expected] of Object.entries(CASES)) {
    const checks = out?.cases?.[name]?.checks;
    if (!checks || typeof checks !== "object") continue;
    for (const c of expected) if (checks[c] !== true) failed.push([name, c]);
  }
  return failed;
}

/** The verdict, pure. Anything missing, extra, empty or not exactly expected FAILS. */
export function judge(out, res) {
  const problems = structural(out, res);
  if (out && typeof out === "object") for (const [name, c] of failedChecks(out)) problems.push(`${name}: ${c}`);
  return { pass: problems.length === 0, problems, cases: out?.cases, refusals: out?.refusals, esbuildSpawns: out?.esbuildSpawns };
}

// ── children: guard everything, render, report ──────────────────────────
const SITE = "https://postmark.town";

/** Network, process and fs refusals, installed BEFORE vite/astro load. */
async function guardChild(P, T, denyTopJson, out) {
  const { installFsGuard } = await import(pathToFileURL(path.join(REPO, "test", "pos394-fs-guard.mjs")).href);
  const refuse = (kind, what) => { out.refusals[kind].push(what); return Object.assign(new Error(`POS-394 render proof refused ${what}`), { code: "EPOS394GUARD" }); };
  globalThis.fetch = (u) => Promise.reject(refuse("net", `fetch ${String(u)}`));
  const req = createRequire(import.meta.url);
  for (const [mod, names] of [["http", ["request", "get"]], ["https", ["request", "get"]], ["net", ["connect", "createConnection"]], ["tls", ["connect"]], ["dns", ["lookup", "resolve"]]]) {
    const m = req(`node:${mod}`);
    for (const n of names) m[n] = () => { throw refuse("net", `${mod}.${n}`); };
  }
  const cp = req("node:child_process");
  const esbuild = path.join(T, ESBUILD_BIN);
  const realSpawn = cp.spawn;
  cp.spawn = (cmd, ...rest) => { if (cmd === esbuild) { out.esbuildSpawns++; return realSpawn(cmd, ...rest); } throw refuse("proc", `spawn ${cmd}`); };
  for (const n of ["exec", "execFile", "execSync", "execFileSync", "spawnSync", "fork"]) cp[n] = (cmd) => { throw refuse("proc", `${n} ${cmd}`); };
  req("node:worker_threads").Worker = class { constructor(f) { throw refuse("proc", `Worker ${f}`); } };
  syncBuiltinESMExports();
  const g = installFsGuard({
    roots: [path.join(P, "src/data/postmark"), path.join(P, "public/atelier/postmark"),
      path.join(T, "node_modules/postmark-world"), ...JSON.parse(denyTopJson)],
    cwd: P,
  });
  out.refusals.fs = g.denials;
  return { refuse, fromP: createRequire(path.join(P, "package.json")) };
}

/** The resolver/loader that keeps data virtual and refuses everything protected. */
function guardPlugin(P, refuse) {
  const deny = [path.join(P, "src/data/postmark"), path.join(P, "public/atelier/postmark")];
  return {
    name: "pos394-guard", enforce: "pre",
    resolveId(source, importer) {
      if (source === "postmark-world" || source.startsWith("postmark-world/")) throw refuse("fs", `import ${source}`);
      const bare = source.split("?")[0];
      let abs = null;
      if (bare.startsWith("@/")) abs = path.join(P, "src", bare.slice(2));
      else if (bare.startsWith(".") && importer && !importer.startsWith("\0")) abs = path.resolve(path.dirname(importer.split("?")[0]), bare);
      else if (bare.startsWith(P)) abs = bare;
      if (!abs) return null;
      const dataDir = path.join(P, "src/data/postmark");
      if (under(abs, dataDir)) {
        const name = path.relative(dataDir, abs);
        if (Object.hasOwn(DATA, name)) return `\0pos394:data:${name}`;
        throw refuse("fs", `import of an unmapped protected id ${name}`);
      }
      if (deny.some((r) => under(abs, r))) throw refuse("fs", `import under a denied root: ${path.relative(P, abs)}`);
      if (abs === path.join(P, "src/lib/funding.mjs") || abs === path.join(P, "src/lib/funding")) return "\0pos394:funding";
      if (abs === path.join(P, "src/lib/mists-season.mjs") || abs === path.join(P, "src/lib/mists-season")) return "\0pos394:mists";
      return null;
    },
    load(id) {
      // the id ends in .json, so Vite's own JSON plugin turns this text into the module, as for a real import
      if (id.startsWith("\0pos394:data:")) return JSON.stringify(DATA[id.slice("\0pos394:data:".length)]);
      if (id === "\0pos394:funding") return FUNDING_STUB;
      if (id === "\0pos394:mists") return MISTS_STUB;
      const bare = id.split("?")[0];
      if (deny.some((r) => under(bare, r))) throw refuse("fs", `load under a denied root: ${path.relative(P, bare)}`);
      return null;
    },
  };
}

const viteShared = (P, T, plugin) => ({
  cacheDir: path.join(P, ".vite-cache"), envDir: path.join(P, "public-empty"), logLevel: "error", clearScreen: false,
  optimizeDeps: { noDiscovery: true, include: [] },
  ssr: { optimizeDeps: { noDiscovery: true, include: [] } },
  resolve: { alias: { "@": path.join(P, "src") } },
  plugins: [plugin],
});

// the checks a page or fragment shares
const regHasSentinel = () => JSON.stringify(DATA["households.json"]).includes(SENTINEL);
const clean = (html) => !html.includes(SENTINEL);
const both = (html) => MEMBERS.every((m) => html.includes(m.address.agent));
const titleOf = (html) => /<title>([\s\S]*?)<\/title>/.exec(html)?.[1] ?? null;
const descOf = (html) => /<meta name="description" content="([^"]*)"/.exec(html)?.[1] ?? null;
const hdsubOf = (html) => /<p class="hd-sub"[^>]*>([\s\S]*?)<\/p>/.exec(html)?.[1] ?? "";
const textOf = (s) => s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

function report(out, e, P) {
  if (e) {
    // the message and up to three code locations (projection-relative or package-named), never data
    const frames = String(e?.stack ?? "").split("\n").filter((l) => /^\s+at /.test(l)).slice(0, 3)
      .map((l) => l.replace(P, "<P>").replace(/.*node_modules\//, "node_modules/").trim());
    out.crash = [`${e?.name ?? "Error"}: ${e?.message ?? e}`, ...frames].join(" | ");
  }
  process.stdout.write("\n" + JSON.stringify(out) + "\n");
  process.exit(0);
}

/** BUILD child: Astro's public build() of the projection; read exactly the three emitted pages. */
async function childBuild([P, T, denyTopJson]) {
  const out = { cases: {}, refusals: { fs: [], net: [], proc: [] }, esbuildSpawns: 0 };
  let err = null;
  try {
    const { refuse, fromP } = await guardChild(P, T, denyTopJson, out);
    const { build } = await import(pathToFileURL(fromP.resolve("astro")).href);
    await build({
      root: P, configFile: false, mode: "production", logLevel: "error",
      srcDir: "./town", publicDir: "./public-empty", outDir: "./dist-proof", cacheDir: "./.astro-cache",
      site: SITE, integrations: [], output: "static",
      vite: viteShared(P, T, guardPlugin(P, refuse)),
    });
    const dist = path.join(P, "dist-proof");
    const html = fs.readdirSync(dist, { recursive: true }).map(String).filter((f) => f.endsWith(".html")).sort();
    if (html.join("\n") !== [...BUILT_PAGES].join("\n")) throw new Error(`the build emitted ${html.length} pages, not exactly the ${BUILT_PAGES.length} expected`);
    const page = (rel) => fs.readFileSync(path.join(dist, rel), "utf8");
    {
      const h = page("households/brass-hollow/index.html");
      const sub = hdsubOf(h);
      out.cases.householdPage = { bytes: h.length, checks: {
        [C.REG]: regHasSentinel(), [C.NEVER]: clean(h), [C.MEMBERS]: both(h),
        [C.TITLE_H]: titleOf(h) === "Brass Hollow — a household in Postmark",
        [C.DESC]: descOf(h) === "Brass Hollow — 2 residents of Postmark: Wren Fixture, Moss Fixture.",
        [C.HDSUB]: sub.length > 0, [C.HDCOUNT]: /\b2 residents\b/.test(textOf(sub)), [C.HDHUMAN]: !sub.includes(SENTINEL),
        [C.PLATE]: h.includes("Brass Hollow"),
      } };
    }
    {
      const w = page("residents/wren-pos394/index.html"), m = page("residents/moss-pos394/index.html");
      out.cases.residentPage = { bytes: w.length + m.length, checks: {
        [C.REG]: regHasSentinel(), [C.NEVER]: clean(w) && clean(m), [C.MEMBERS]: both(w) && both(m),
        [C.TITLE_R]: titleOf(w) === "Wren Fixture — resident of Postmark" && titleOf(m) === "Moss Fixture — resident of Postmark",
        [C.PLATE]: w.includes("Brass Hollow") && m.includes("Brass Hollow"),
      } };
    }
  } catch (e) { err = e; }
  report(out, err, P);
}

/** CONTAINER child: the Household fragments (prop boundary) and the resident card. */
async function childContainer([P, T, denyTopJson]) {
  const out = { cases: {}, refusals: { fs: [], net: [], proc: [] }, esbuildSpawns: 0 };
  let err = null;
  try {
    const { refuse, fromP } = await guardChild(P, T, denyTopJson, out);
    const { createServer } = await import(pathToFileURL(fromP.resolve("vite")).href);
    const { getViteConfig } = await import(pathToFileURL(fromP.resolve("astro/config")).href);
    const { experimental_AstroContainer } = await import(pathToFileURL(fromP.resolve("astro/container")).href);
    const cfg = await getViteConfig({
      configFile: false, root: P, appType: "custom",
      server: { middlewareMode: true, hmr: false, watch: null, fs: { strict: true, allow: [P, path.join(T, "node_modules")] } },
      ...viteShared(P, T, guardPlugin(P, refuse)),
    }, {
      root: P, configFile: false, srcDir: "./town", publicDir: "./public-empty", outDir: "./dist-proof",
      cacheDir: "./.astro-cache", integrations: [], site: SITE,
    })({ mode: "development", command: "serve" });
    const server = await createServer(cfg);
    try {
      const container = await experimental_AstroContainer.create();
      const Household = (await server.ssrLoadModule("/town/components/Household.astro")).default;
      const Card = (await server.ssrLoadModule("/src/components/ResidentCard.astro")).default;
      {
        const props = { house: HOUSE, members: MEMBERS, active: "__house", route: "household" };
        const html = await container.renderToString(Household, { props });
        const sub = hdsubOf(html);
        out.cases.householdSeat = { bytes: html.length, checks: {
          [C.PROP]: JSON.stringify(props).includes(SENTINEL), [C.NEVER]: clean(html), [C.MEMBERS]: both(html),
          [C.HDSUB]: sub.length > 0, [C.HDCOUNT]: /\b2 residents\b/.test(textOf(sub)), [C.HDHUMAN]: !sub.includes(SENTINEL),
          [C.PLATE]: html.includes("Brass Hollow"),
        } };
      }
      {
        const props = { house: HOUSE, members: MEMBERS, active: MEMBERS[0].handle, route: "resident" };
        const html = await container.renderToString(Household, { props });
        out.cases.residentWrapper = { bytes: html.length, checks: {
          [C.PROP]: JSON.stringify(props).includes(SENTINEL), [C.NEVER]: clean(html), [C.MEMBERS]: both(html), [C.PLATE]: html.includes("Brass Hollow"),
        } };
      }
      {
        const html = await container.renderToString(Card, { props: { r: MEMBERS[0] } });
        out.cases.residentCard = { bytes: html.length, checks: { [C.REG]: regHasSentinel(), [C.NEVER]: clean(html), [C.CARD]: html.includes("Wren Fixture") } };
      }
    } finally { await server.close(); }
  } catch (e) { err = e; }
  report(out, err, P);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  if (process.env.POS394_RENDER_PROOF !== "1") { console.error("pos394-render-proof: opt-in only: set POS394_RENDER_PROOF=1"); process.exit(2); }
  if (process.argv[2] === "--child-build") await childBuild(process.argv.slice(3));
  else if (process.argv[2] === "--child-container") await childContainer(process.argv.slice(3));
  else {
    const i = process.argv.indexOf("--mutant");
    const report = runProof({ mutant: i === -1 ? null : process.argv[i + 1] });
    console.log(JSON.stringify({ ...report, cases: undefined }, null, 2));
    process.exitCode = report.pass ? 0 : 1;
  }
}
