// world-engine-island — the ONE wiring that lets postmark.town serve the told-world
// viewer as a standalone island, from the SAME files a clone runs.
//
// The viewer (spectator/viewer.mjs) and the engine (tools/*.mjs) live in the
// postmark-world package — one source of truth. This integration makes them serve
// at `/world-engine/**` on the town, WITHOUT copying any engine source into this
// repo's tracked tree (no drift): it copies from node_modules into the BUILD OUTPUT
// (dist-town/world-engine/) at build, and serves them from node_modules via a dev
// middleware in `astro dev`. So world.astro can emit spectator/index.html verbatim
// and its `import "/world-engine/spectator/viewer.mjs"` resolves in both.
//
// A PIN THAT CANNOT SERVE THIS BUILD FAILS IT. Until 2026-08-26 a package with
// no spectator/viewer.mjs warned and skipped — the page built green and rendered
// nothing — and a record file the package did not carry warned too, which is how
// WORLD/walk-ledger.md 404'd in production for weeks while every build passed.
// Both are hard failures now; `tools/lib/world-staging.mjs` carries the reasons.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, extname, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { plateName } from "../../src/lib/houses.mjs";
import { REPLAY_DIR, replayFiles } from "./replay-record.mjs";
import { recordsToStage, stagingComplaints, stagingFailure } from "../../tools/lib/world-staging.mjs";
import {
  importClosure, moduleEntryPaths, noEntryFailure, preloadTags,
  sameOriginDemands, unstagedModuleFailure,
} from "../../tools/lib/world-preload.mjs";

const META_PATH = "/world-engine/residents-meta.json";

// ── THE DISPLAY PIN (founder, 2026-09-10 21:0x EDT: "revert the DISPLAY to
// include the old atlas html again while keeping the DATA at the most recent
// settlement") ────────────────────────────────────────────────────────────
//
// The world package carries two things: the RECORD (WORLD/*.json — the data)
// and the VIEWER (spectator/viewer.mjs — the display). The pin resolver moves
// the whole package to the keeper's newest settlement tag, so a viewer change
// that lands in the world repo reaches prod with the next settlement whether or
// not anyone meant it to — which is how S64 (2026-09-10) put a viewer on prod
// that draws the town's ground from the record instead of the atlas drawing.
//
// This directory splits the two: a file under town/world-engine-display/
// REPLACES the package's file of the same name at staging time, so the display
// is the vendored copy while the record stays whatever the resolver pinned.
// Today it holds ONE file, spectator/viewer.mjs as it was at settlement S63
// (world 256db2fe) — the last viewer that reads /atlas/town.html as the ground.
// Its engine imports (../tools/*.mjs) are served from the pinned package and
// were checked to exist there.
//
// TO LIFT THE PIN: delete the directory. Nothing else reads it.
const DISPLAY_PIN_DIR = ["town", "world-engine-display"];
function displayPinned(projectRoot, ...rel) {
  const p = join(projectRoot, ...DISPLAY_PIN_DIR, ...rel);
  return existsSync(p) ? p : null;
}

const MIME = { ".mjs": "text/javascript; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8" };

// ── which record files get staged, and why it is no longer a list ───────────
//
// It WAS a list — five paths typed by hand, kept in step with the world package
// by nothing. `WORLD/walk-ledger.md` was not on it, `postmark.town/WORLD/walk-ledger.md`
// answered 404, and the viewer answers a 404 for a record by reading the world
// repo's raw MAIN TIP. So the town's departures were told from an unblessed
// branch while the release lane's guardrail said "tags only, never main tip"
// (founder-ruled 2026-08-25; WORLD-PIN.md § The three guardrails).
//
// The engine modules a dozen lines below had already been through this exact
// failure and were fixed by walking the package instead of naming its files.
// The records now have a channel too, and it is the honest one: a record is
// staged because some reader ASKS THIS ORIGIN FOR IT. The demand is read off the
// package's own viewer and off this repo's own pages, so a reader that starts
// fetching a new record causes it to be staged, with nobody to remember.
//
// Reading the sources is a few dozen small files once per build, next to a build
// that emits three thousand pages.
const SOURCE_DIRS = ["town", "src"];
const SOURCE_EXT = new Set([".mjs", ".js", ".astro", ".ts"]);

function readSources(dir, base, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) { readSources(abs, base, out); continue; }
    if (!SOURCE_EXT.has(extname(entry.name))) continue;
    out.push({ name: relative(base, abs).split(sep).join("/"), text: readFileSync(abs, "utf8") });
  }
  return out;
}

/** every reader whose same-origin record demands this build must satisfy */
function recordReaders(pkg, projectRoot) {
  const readers = [];
  // the viewer that will actually be SERVED — the display pin's copy when one is
  // vendored, the package's otherwise — FIRST: it is the module both habitats
  // run, and it is its unmet demand that caused the leak
  const viewer = displayPinned(projectRoot, "spectator", "viewer.mjs") ?? join(pkg, "spectator", "viewer.mjs");
  if (existsSync(viewer)) readers.push({ name: "postmark-world/spectator/viewer.mjs", text: readFileSync(viewer, "utf8") });
  for (const dir of SOURCE_DIRS) {
    const abs = join(projectRoot, dir);
    if (existsSync(abs)) readSources(abs, projectRoot, readers);
  }
  return readers;
}

/** the readers above, plus the spectator SHELL this town serves verbatim
 *  (world.astro emits `postmark-world/spectator/index.html` raw), which is where
 *  the browser is told which module to import. Hints only: the shell names no
 *  record, so the staging demand is unchanged by its presence or absence. */
function hintReaders(pkg, projectRoot) {
  const readers = recordReaders(pkg, projectRoot);
  const shell = join(pkg, "spectator", "index.html");
  if (existsSync(shell))
    readers.unshift({ name: "postmark-world/spectator/index.html", text: readFileSync(shell, "utf8") });
  return readers;
}

// ── the faces the viewer draws (2026-08-08) ─────────────────────────────────
//
// The walker dots became circles carrying each resident's avatar, so the viewer
// needs a handle → {name, avatar, color, household} map. It is built HERE, from
// this repo's own extracted data, and not asked of the office — the office's
// database carries no profile fields at all (hydrate never reads PROFILE.md),
// while residents.json and media.json already hold every name, colour, and
// RESOLVED avatar URL. Deriving it anywhere else would mean a second copy of the
// avatar-URL convention that this repo's media pipeline owns.
//
// Emitted as one small record file beside the engine, fetched same-origin by the
// viewer exactly like world-state.json. Build-time freshness, which is the same
// freshness as the world the map is drawn from.
export function residentsMeta(projectRoot) {
  const read = (rel) => {
    try { return JSON.parse(readFileSync(join(projectRoot, "src", "data", "postmark", rel), "utf8")); }
    catch { return null; }
  };
  const residents = read("residents.json");
  if (!Array.isArray(residents)) return null;
  const media = read("media.json") ?? {};
  const registry = read("households.json") ?? {};
  // handle → the house's own name, so the card can say which house someone
  // keeps. houseName is this repo's one slug→name rule (src/lib/houses.mjs) —
  // imported rather than re-spelled, so "cadaeic.space" keeps its dot and
  // "the-rookery" reads as The Rookery here exactly as it does on every page.
  const houseOf = new Map();
  for (const [slug, dec] of Object.entries(registry.households ?? {}))
    for (const h of dec.residents ?? []) houseOf.set(h, plateName(dec.name, slug));

  const out = {};
  for (const r of residents) {
    if (!r?.handle) continue;
    const avatarKey = r.profile?.avatar ? `WHITE_PAGES/${r.handle}/${r.profile.avatar}` : null;
    // The claimed local file first (the older road, three profiles still carry
    // it), then the settled `avatar_url` the office profile road writes — already
    // admitted only at the town's media door by the town reader (postmark#2950),
    // and the viewer's own whitelist admits that one host (postmark-world #111).
    const entry = {
      name: r.address?.agent ?? r.handle,
      avatar: (avatarKey && media[avatarKey]?.card) || r.profile?.avatar_url || null,
      color: r.profile?.color ?? null,
      household: houseOf.get(r.handle) ?? null,
    };
    // a resident with nothing to add is not worth a row — the viewer's fallback
    // (monogram of the handle, town gold) is already the right answer for them
    if (entry.name !== r.handle || entry.avatar || entry.color || entry.household) out[r.handle] = entry;
  }
  return { generated: new Date().toISOString(), residents: out };
}

function pkgRoot(projectRoot) {
  const p = join(projectRoot, "node_modules", "postmark-world");
  return existsSync(p) ? p : null;
}

/** does the pinned package carry this file? the one seam the checks touch */
const packageHas = (pkg) => (rel) => existsSync(join(pkg, ...rel.split("/")));

// THE GATE. Called from the build hook, where a throw stops the release rather
// than scrolling past in a log. Everything it can complain about used to be a
// console.warn beside a green build.
function assertPackageCanServe(pkg, projectRoot) {
  const complaints = stagingComplaints({
    sources: recordReaders(pkg, projectRoot),
    exists: packageHas(pkg),
  });
  if (complaints.length) throw stagingFailure(complaints);
}

// One walk defines both surfaces: what the build copies and what dev may serve.
// Public paths deliberately match the viewer's own same-origin fetches, because
// they are now DERIVED from them.
function stagingWalk(pkg, projectRoot) {
  const viewer = join(pkg, "spectator", "viewer.mjs");
  // In a build this is unreachable — assertPackageCanServe has already thrown.
  // In `astro dev` it is the honest answer to a request for a file that is not
  // there: nothing to serve, and the browser's own 404 says so where a developer
  // is already looking.
  if (!existsSync(viewer)) return [];
  const files = [];
  // Every non-test spectator module — the SAME drift the tools/ walk below fixed
  // on 2026-07-28 bit spectator/ on 2026-08-29: act-as.mjs (the viewer's second
  // spectator module ever) 404'd in the built site and the boot hung at module
  // resolution with a green build behind it. One rule for both dirs now.
  // The display pin (see DISPLAY_PIN_DIR): a vendored spectator file replaces the
  // package's at the same public path. The engine and the record are untouched.
  for (const f of readdirSync(join(pkg, "spectator")).filter((f) => f.endsWith(".mjs") && !f.endsWith(".test.mjs")))
    files.push({ source: displayPinned(projectRoot, "spectator", f) ?? join(pkg, "spectator", f), publicPath: `/world-engine/spectator/${f}` });
  // Every non-test engine module — a NAMED list here was the drift: a new module
  // the viewer imports (mark-class.mjs, 2026-07-28) 404'd in prod while dev,
  // serving straight from node_modules, never noticed. The browser only imports
  // what the viewer references; staging the rest is inert public source.
  for (const f of readdirSync(join(pkg, "tools")).filter((f) => f.endsWith(".mjs") && !f.endsWith(".test.mjs")))
    files.push({ source: join(pkg, "tools", f), publicPath: `/world-engine/tools/${f}` });
  // and every record some reader asks this origin for — derived, not listed
  for (const { record } of recordsToStage(recordReaders(pkg, projectRoot))) {
    const source = join(pkg, ...record.split("/"));
    if (existsSync(source)) files.push({ source, publicPath: `/${record}` });
  }
  return files;
}

function stage(pkg, dest, projectRoot) {
  const files = stagingWalk(pkg, projectRoot);
  for (const file of files) {
    const output = join(dest, ...file.publicPath.slice(1).split("/"));
    mkdirSync(dirname(output), { recursive: true });
    cpSync(file.source, output);
  }
  // the faces: derived, not copied, so it is written rather than staged. Absent
  // data means no file, and the viewer's own fallback (monograms) is already the
  // right answer — never a half-written map.
  const meta = residentsMeta(projectRoot);
  if (meta) {
    const output = join(dest, ...META_PATH.slice(1).split("/"));
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, JSON.stringify(meta));
    files.push({ source: null, publicPath: META_PATH });
  } else {
    console.warn("[world-engine-island] no residents.json — the map draws monograms rather than faces.");
  }
  // the replay's frames: derived from the package's own STATE record, same as the
  // faces above — written, not copied, because the jsonl is an engine-internal
  // format and staging it verbatim would freeze it into a public contract
  for (const file of replayFiles(pkg)) {
    const output = join(dest, ...file.publicPath.slice(1).split("/"));
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, file.body);
    files.push({ source: null, publicPath: file.publicPath });
  }
  return files;
}

// THE REPLAY FRAMES ARE NOT HINTED, and it is the one exclusion the derived
// rules cannot reach. Every crossing's frame is a staged .json and the replay
// INDEX is named as a literal by the page, so a rule that reads demand off the
// source would hint it. Measured on prod 2026-09-12: 68 links, 810 KB gzipped
// pulled down on EVERY /world/ load, more than the fold itself, for a surface
// almost no reader opens; the largest single frame was 109 KB.
//
// Nothing was ever waiting on that warm cache. The page fetches
// /world-engine/replay/<n>.json when a crossing is actually chosen and
// /world-engine/replay/index.json when the time-travel panel is actually
// opened — both live, through its own captured `real` fetch, and neither reads
// a preload entry or a readiness signal (town/pages/world.astro). So the hints
// only ever paid on a `?crossing=` arrival, and were pure cost on every other
// load. Removed on Keemin's ruling, 2026-09-12: "let's not preload replays."
const isReplayFrame = (publicPath) => publicPath.startsWith(`${REPLAY_DIR}/`);

/**
 * THE WORLD PAGE'S HINT CHAIN, as tags, in emitted order.
 *
 * Until 2026-09-16 this hinted the STAGING WALK: every staged .mjs and every
 * staged .json, plus /atlas/town.html by hand. Staging answers "what must this
 * origin be able to serve"; a hint answers "what will the browser ask for in a
 * moment". Answering the second with the first cost every reader about 2.2 MB
 * per load that nothing read — 41 engine modules the viewer never imports, the
 * 0.93 MB fold it reads from the office instead, a 0.45 MB atlas drawing it
 * stopped reading, a 0.07 MB publications file nothing reads at all. The
 * browser said so on every load, four "preloaded but not used" warnings deep.
 *
 * Both halves are DERIVED now, and `tools/lib/world-preload.mjs` carries the
 * reasoning. Pure: `sources` (the readers' text) and `readModule` (a staged
 * module's text) are the only seams that touch a disk, so the chain can be
 * falsified without standing up a build.
 */
export function worldPreloadHints(files, { sources, readModule }) {
  const entries = moduleEntryPaths(sources).map((entry) => entry.path);
  if (!entries.length) throw noEntryFailure();
  const staged = new Set(files.map((file) => file.publicPath));
  const { closure, unstaged } = importClosure({
    entries,
    readModule: (publicPath) => (staged.has(publicPath) ? readModule(publicPath) : null),
  });
  // a module the browser WILL import that this build did not stage is a 404 at
  // import time behind a green build — the failure this file has now had twice
  if (unstaged.length) throw unstagedModuleFailure(unstaged);
  const records = sameOriginDemands(sources)
    .map((demand) => demand.path)
    .filter((path) => !isReplayFrame(path));
  return preloadTags({ files, modules: closure, records });
}

function emitWorldPreloads(dest, files, pkg, projectRoot) {
  const page = join(dest, "world", "index.html");
  if (!existsSync(page)) {
    console.warn("[world-engine-island] built world page missing — preload chain was not emitted.");
    return 0;
  }
  // the staged module's own text, by public path — the closure walk's one seam
  const sourceOf = new Map(files.filter((file) => file.source).map((file) => [file.publicPath, file.source]));
  const hints = worldPreloadHints(files, {
    sources: hintReaders(pkg, projectRoot),
    readModule: (publicPath) => {
      const source = sourceOf.get(publicPath);
      return source ? readFileSync(source, "utf8") : null;
    },
  });
  const html = readFileSync(page, "utf8");
  if (!/<\/head>/i.test(html)) {
    console.warn("[world-engine-island] built world page has no </head> — preload chain was not emitted.");
    return 0;
  }
  writeFileSync(page, html.replace(/<\/head>/i, `${hints.join("\n")}\n</head>`));
  return hints.length;
}

export default function worldEngineIsland() {
  let projectRoot;
  return {
    name: "world-engine-island",
    hooks: {
      "astro:config:setup": ({ config, command, updateConfig }) => {
        projectRoot = fileURLToPath(config.root);
        // Windows cannot emit sibling /world and /WORLD directories. Astro's
        // static preview also matches URL case strictly, so proxy the public
        // uppercase record URL once to its on-disk page-directory neighbor.
        // Linux builds keep their genuinely distinct /WORLD directory.
        if (command === "preview" && process.platform === "win32") {
          updateConfig({
            vite: {
              preview: {
                proxy: {
                  "/WORLD": {
                    target: `http://127.0.0.1:${config.server.port}`,
                    rewrite: (path) => path.replace(/^\/WORLD/, "/world"),
                  },
                },
              },
            },
          });
        }
      },
      // dev: serve the staged public surface straight from node_modules (no copy)
      "astro:server:setup": ({ server }) => {
        server.middlewares.use((req, res, next) => {
          if (!req.url) return next();
          const pkg = pkgRoot(projectRoot);
          if (!pkg) return next();
          const pathname = req.url.split("?")[0];
          // the derived one has no source file to read — it is computed per
          // request in dev so an edit to residents.json shows up on reload
          if (pathname === META_PATH) {
            const meta = residentsMeta(projectRoot);
            if (!meta) return next();
            res.setHeader("content-type", MIME[".json"]);
            return res.end(JSON.stringify(meta));
          }
          // the replay frames are derived too, so dev computes them per request —
          // a newly-saved crossing shows up on reload without a rebuild
          if (pathname.startsWith(`${REPLAY_DIR}/`)) {
            const file = replayFiles(pkg).find((entry) => entry.publicPath === pathname);
            if (!file) return next();
            res.setHeader("content-type", MIME[".json"]);
            return res.end(file.body);
          }
          const file = stagingWalk(pkg, projectRoot).find((entry) => entry.publicPath === pathname);
          if (!file) return next();
          res.setHeader("content-type", MIME[extname(file.source)] ?? "application/octet-stream");
          res.end(readFileSync(file.source));
        });
      },
      // build: copy into the emitted output so the same paths are served statically
      "astro:build:done": ({ dir }) => {
        const pkg = pkgRoot(projectRoot);
        // NOT A SKIP. A build with no world package emits a world page whose
        // every module and record 404s — the widest version of the same hole the
        // gate below closes, and it used to print one line and exit 0.
        if (!pkg) throw stagingFailure(["postmark-world is not installed — run `npm ci` (the world page would emit with no engine and no record at all)."]);
        assertPackageCanServe(pkg, projectRoot);
        const dest = fileURLToPath(dir);
        const files = stage(pkg, dest, projectRoot);
        if (files.length) {
          const hintCount = emitWorldPreloads(dest, files, pkg, projectRoot);
          console.log(`[world-engine-island] staged ${files.length} files and emitted ${hintCount} world preloads → dist/`);
        }
      },
    },
  };
}
