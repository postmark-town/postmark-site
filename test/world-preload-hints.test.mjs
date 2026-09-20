// world-preload-hints.test.mjs — what the world page tells the browser to fetch
// before anyone asks for it (2026-09-12; re-pinned 2026-09-16 for POS-85).
//
//   node --test test/world-preload-hints.test.mjs
//
// ── THE LAW ────────────────────────────────────────────────────────────────
//
// A preload pays only when the browser goes on to ask for THAT URL, early.
// Until 2026-09-16 the head of /world/ hinted the STAGING WALK instead: every
// staged .mjs, every staged .json, and /atlas/town.html appended by hand.
// Measured on prod 2026-09-15 and on the pin this change was built against:
// 54 modulepreloads against an import closure of 13; the 0.93 MB fold, which
// the viewer reads from the office; a 0.45 MB atlas drawing it stopped reading
// in favour of /atlas/ground.html; a 0.07 MB publications file no reader in
// either repo fetches. About 2.2 MB per load, downloaded and never read, with
// the browser saying so out loud — four "preloaded using link preload but not
// used" warnings deep — on every single load.
//
// Two halves, both DERIVED (`tools/lib/world-preload.mjs`), because the older
// half of this file's own history is what a hand list costs: `mark-class.mjs`
// 404'd in prod on 2026-07-28 and `WORLD/walk-ledger.md` 404'd for weeks, both
// because a list nobody was keeping fell behind the code.
//
//   MODULES — hinted iff in the viewer's static import closure, walked from the
//   entry modules the town's pages and the served shell name.
//   RECORDS  — hinted iff the readers ask THIS ORIGIN for them first. A record
//   read office-first is never hinted: the same-origin leg is the fallback, and
//   the fallback is the leg that does not run.
//
// The replay-frame exclusion stays, and it is now the one rule the derivation
// cannot reach — `/world-engine/replay/index.json` IS named as a literal by the
// page, so a demand-derived rule would hint it. The founder's words the night
// he caught it: "let's not preload replays."
//
// Tests are written in BOTH directions. A rule that only says "no" reds on
// nothing; every removal below has a matching test that the thing worth
// hinting is still hinted, by name.
//
// The open path keeps its SOURCE PIN, the repo's standing discipline for
// closure code (see test/world-cockpit-dock.test.mjs): the replay opener lives
// inside an `is:inline` IIFE in world.astro with no seam to inject, and a full
// DOM boot would test the harness rather than the fetch.

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { worldPreloadHints } from "../town/scripts/world-engine-island.mjs";
import { importClosure, moduleEntryPaths, sameOriginDemands } from "../tools/lib/world-preload.mjs";

/** The world page's own source, read as itself. */
const worldPage = readFileSync(new URL("../town/pages/world.astro", import.meta.url), "utf8");

// ── the fixture world ──────────────────────────────────────────────────────
//
// A viewer that imports three engine modules (one of them transitively), reads
// two records from this origin and two from an office, and a shell that names
// the entry. Written as real source text, because the derivation reads source
// text and a fixture of bare paths would test nothing.

const SHELL = `<script type="module">
  import { mountViewer } from "/world-engine/spectator/viewer.mjs";
  mountViewer(document.querySelector("#world"));
</script>`;

const VIEWER = `
// A header line that says \`/WORLD/*\` off disk — the exact shape that opened a
// fake block comment and swallowed every import below it.
import { assembleWorld } from "../tools/world-build.mjs";
import { rect } from "../tools/geometry.mjs";
import { createHomeColumn } from "./home-column.mjs";
import { recordSources } from "../tools/record-sources.mjs";

async function loadGround() {
  const sk = await fetchJson(recordSources("/WORLD/skeleton.json", { office: officeUrl("/world/skeleton") }).map((s) => s.url));
}
async function loadFold() {
  await fetchWorldState(recordSources("/WORLD/world-state.json", { office: officeUrl("/world/state") }).map((s) => s.url));
}
async function loadTownHouses() {
  await fetchWorldState(recordSources("/WORLD/world-state.json").map((s) => s.url), { credentials: "same-origin" });
}
async function loadWalkLedger() {
  for (const { url } of recordSources("/WORLD/walk-ledger.md")) await fetch(url);
}
async function loadEnterExit() {
  for (const { url } of recordSources("/WORLD/enter-exit-ledger.md", { office: officeUrl("/world/enter-exit-ledger") })) await fetch(url);
}
async function loadResidentsMeta() {
  await fetch("/world-engine/residents-meta.json", { credentials: "same-origin" });
}
async function openScrubber() {
  await fetch("/world-engine/replay/index.json");
}
`;

const MODULES = {
  "/world-engine/spectator/viewer.mjs": VIEWER,
  "/world-engine/spectator/home-column.mjs": `export const createHomeColumn = () => {};`,
  "/world-engine/tools/world-build.mjs": `import { DIALS } from "./world-engine.mjs";\nexport const assembleWorld = () => {};`,
  "/world-engine/tools/world-engine.mjs": `export const DIALS = {};`,
  "/world-engine/tools/geometry.mjs": `export const rect = () => {};`,
  "/world-engine/tools/record-sources.mjs": `export function recordSources(record, { office = null } = {}) { return []; }`,
  // staged and never imported — the 41
  "/world-engine/spectator/server.mjs": `import { createServer } from "node:http";`,
  "/world-engine/tools/settlement-sweep.mjs": `export const sweep = () => {};`,
  "/world-engine/tools/migrate-coords.mjs": `export const migrate = () => {};`,
};

const sources = () => [
  { name: "postmark-world/spectator/index.html", text: SHELL },
  { name: "postmark-world/spectator/viewer.mjs", text: VIEWER },
];

/** A staging walk in the shape `stage()` returns, in the order it returns it. */
const files = () => [
  ...Object.keys(MODULES).map((publicPath) => ({ publicPath })),
  { publicPath: "/WORLD/settlement-publications.json" },
  { publicPath: "/WORLD/skeleton.json" },
  { publicPath: "/WORLD/world-state.json" },
  { publicPath: "/WORLD/walk-ledger.md" },
  { publicPath: "/WORLD/enter-exit-ledger.md" },
  { publicPath: "/world-engine/residents-meta.json" },
  { publicPath: "/world-engine/replay/index.json" },
  { publicPath: "/world-engine/replay/118.json" },
  { publicPath: "/world-engine/replay/119.json" },
  { publicPath: "/world-engine/replay/185.json" },
];

const hintsFor = (overrides = {}) => worldPreloadHints(overrides.files ?? files(), {
  sources: overrides.sources ?? sources(),
  readModule: overrides.readModule ?? ((p) => (overrides.modules ?? MODULES)[p] ?? null),
});

const hrefsOf = (hints) => hints.map((tag) => tag.match(/href="([^"]+)"/)[1]);

// ── the whole chain, verbatim ───────────────────────────────────────────────

test("the hint chain is the closure and the boot records, and nothing else", () => {
  // Written out rather than derived, so a rule that grows too wide or too
  // narrow reds here with the line named. Order is the staged order: modules
  // first, then records.
  assert.deepEqual(hintsFor(), [
    '<link rel="modulepreload" href="/world-engine/spectator/viewer.mjs">',
    '<link rel="modulepreload" href="/world-engine/spectator/home-column.mjs">',
    '<link rel="modulepreload" href="/world-engine/tools/world-build.mjs">',
    '<link rel="modulepreload" href="/world-engine/tools/world-engine.mjs">',
    '<link rel="modulepreload" href="/world-engine/tools/geometry.mjs">',
    '<link rel="modulepreload" href="/world-engine/tools/record-sources.mjs">',
    '<link rel="preload" as="fetch" href="/WORLD/walk-ledger.md" crossorigin>',
    '<link rel="preload" as="fetch" href="/world-engine/residents-meta.json" crossorigin>',
  ]);
});

// ── modules: every modulepreload is in the closure ─────────────────────────

test("a staged module the browser never imports is not hinted", () => {
  // The 41. They are staged — a clone's own tooling is served from the same
  // public tree — and staging is not a reason to download them into a browser.
  const hrefs = hrefsOf(hintsFor());
  for (const never of [
    "/world-engine/spectator/server.mjs",
    "/world-engine/tools/settlement-sweep.mjs",
    "/world-engine/tools/migrate-coords.mjs",
  ]) assert.ok(!hrefs.includes(never), `${never} is staged, never imported, and must not be hinted`);
});

test("the closure is walked and not listed — a new import reaches the head with nobody remembering", () => {
  // This is the whole difference between the fix and a hand list. mark-class.mjs
  // 404'd in prod because a list did not know the viewer had grown an import.
  const grown = {
    ...MODULES,
    "/world-engine/spectator/viewer.mjs": `${VIEWER}\nimport { markClass } from "../tools/mark-class.mjs";`,
    "/world-engine/tools/mark-class.mjs": `export const markClass = () => {};`,
  };
  const withNew = [...files(), { publicPath: "/world-engine/tools/mark-class.mjs" }];
  assert.ok(hrefsOf(hintsFor({ modules: grown, files: withNew, sources: [
    { name: "shell", text: SHELL },
    { name: "viewer", text: grown["/world-engine/spectator/viewer.mjs"] },
  ] })).includes("/world-engine/tools/mark-class.mjs"),
    "a module the viewer newly imports is hinted, with no list to update");
});

test("a transitive import is in the closure — the walk does not stop at depth one", () => {
  // world-engine.mjs is imported by world-build.mjs, not by the viewer.
  assert.ok(hrefsOf(hintsFor()).includes("/world-engine/tools/world-engine.mjs"));
});

test("a module the viewer imports that this build did not stage fails the build", () => {
  // The loud direction. Unstaged means the browser resolves the import against
  // this origin and gets a 404, behind a green build — twice now.
  const missing = { ...MODULES };
  delete missing["/world-engine/tools/geometry.mjs"];
  const staged = files().filter((f) => f.publicPath !== "/world-engine/tools/geometry.mjs");
  assert.throws(() => hintsFor({ modules: missing, files: staged }), /did not stage/);
});

test("a page that names no entry module fails the build", () => {
  // An empty preload chain is also an empty viewer; it must not emit quietly.
  assert.throws(() => hintsFor({ sources: [{ name: "empty", text: "<p>no viewer here</p>" }] }), /names a module/);
});

test("a module is never fetch-preloaded", () => {
  // `as="fetch"` is the wrong destination for a module: the loader never reads
  // that cache entry, so the file is fetched twice.
  for (const tag of hintsFor()) {
    if (!tag.includes('as="fetch"')) continue;
    assert.ok(!tag.includes(".mjs"), `a module got a fetch preload: ${tag}`);
  }
});

// ── records: every fetch preload is a same-origin record the boot reads ────

test("a record the readers ask an office for first is never hinted", () => {
  // The fold (0.93 MB) and the skeleton are read from /api/world/*; the
  // same-origin URL is the fallback leg, and the fallback leg does not run.
  const hrefs = hrefsOf(hintsFor());
  for (const never of ["/WORLD/world-state.json", "/WORLD/skeleton.json", "/WORLD/enter-exit-ledger.md"])
    assert.ok(!hrefs.includes(never), `${never} is read office-first and must not be hinted`);
});

test("the fold stays office-first even though one reader asks this origin for it alone", () => {
  // loadTownHouses (world 2026-09-11) fetches /WORLD/world-state.json
  // same-origin with no office, on the resident path, deliberately AFTER the
  // read has painted. Hinting it would put 0.93 MB in front of the paint it was
  // moved behind. One office-first reader is enough to keep a record out.
  assert.ok(VIEWER.includes(`recordSources("/WORLD/world-state.json").map`),
    "the fixture still carries the same-origin-only reader this rule is about");
  assert.ok(!hrefsOf(hintsFor()).includes("/WORLD/world-state.json"));
});

test("a staged record no reader asks for is never hinted", () => {
  // settlement-publications.json is staged as a PUBLISHED_FLOOR — a URL prod
  // already serves — and nothing in either repo fetches it.
  assert.ok(!hrefsOf(hintsFor()).includes("/WORLD/settlement-publications.json"));
});

test("the records the boot reads from this origin ARE hinted, by name", () => {
  // The direction that makes this a removal rather than a breakage.
  const hrefs = hrefsOf(hintsFor());
  // `/seeding/manifest.json` was named here until 2026-09-20. The viewer
  // fetched the seeding manifest at boot to decide green, so it earned a
  // preload; the manifest is deleted (postmark#3025), the viewer's `loadGround`
  // above no longer asks for it, and a hint for a file nobody reads is exactly
  // what the rule below refuses.
  assert.ok(hrefs.includes("/world-engine/residents-meta.json"), "the faces keep their preload");
  assert.ok(hrefs.includes("/WORLD/walk-ledger.md"),
    "the walk ledger is read same-origin at boot on every path and is hinted — POS-85's descope line");
});

test("a record that is not JSON is hinted when it is read — the extension was never the rule", () => {
  // walk-ledger.md used to be excluded because the old filter keyed on .json.
  // What earns a hint is being asked of this origin, not a file extension.
  assert.equal(hrefsOf(hintsFor()).filter((h) => h.endsWith(".md")).length, 1);
});

test("nothing the viewer stopped reading is hinted — /atlas/town.html is gone", () => {
  // It was appended to the fetch list by hand and never removed when the viewer
  // moved to /atlas/ground.html. 0.45 MB on every load.
  assert.ok(!hintsFor().some((tag) => tag.includes("/atlas/town.html")));
});

// ── the replay exclusion, which the derivation cannot reach ────────────────

test("no crossing's replay frame is hinted, and neither is the replay index", () => {
  const replay = hintsFor().filter((tag) => tag.includes("/world-engine/replay/"));
  assert.deepEqual(replay, [],
    "the built /world/ head must carry ZERO preloads under /world-engine/replay/");
});

test("the replay index is named as a literal and still is not hinted", () => {
  // The exclusion has to be a rule of its own now: the page DOES name
  // /world-engine/replay/index.json in source, so demand-derivation alone would
  // hint it. This test is the reason the exclusion survived the rewrite.
  assert.ok(sameOriginDemands(sources()).some((d) => d.path === "/world-engine/replay/index.json"),
    "the fixture still names the replay index, or this test proves nothing");
  assert.ok(!hrefsOf(hintsFor()).includes("/world-engine/replay/index.json"));
});

test("the record's growth cannot put the hint count back on a curve", () => {
  // Four more crossings land. The hint chain must not notice — that is the
  // difference between "one tag removed" and "the generation removed".
  const grown = [...files(),
    { publicPath: "/world-engine/replay/186.json" },
    { publicPath: "/world-engine/replay/187.json" },
    { publicPath: "/world-engine/replay/188.json" },
    { publicPath: "/world-engine/replay/189.json" },
  ];
  assert.equal(hintsFor({ files: grown }).length, hintsFor().length,
    "the hint count is flat in the number of crossings");
});

// ── against the viewer this build will actually serve ───────────────────────

test("the closure of the INSTALLED viewer is the real one, not a truncated read", () => {
  // The fixture cannot catch a reader that silently reads half a file. The real
  // viewer opens with `/WORLD/*` inside a line comment, and a stripper that
  // removes block comments first pairs that `/*` with a `*/` 66 lines down —
  // eating every import and yielding a closure of ONE. That is not hypothetical;
  // it is what the first draft of this change did.
  const pkg = fileURLToPath(new URL("../node_modules/postmark-world/", import.meta.url));
  const viewer = `${pkg}spectator/viewer.mjs`;
  if (!existsSync(viewer)) {
    console.warn("[world-preload-hints] postmark-world is not installed — the installed-viewer closure was not checked.");
    return;
  }
  const entries = moduleEntryPaths([
    { name: "shell", text: readFileSync(`${pkg}spectator/index.html`, "utf8") },
  ]).map((entry) => entry.path);
  assert.deepEqual(entries, ["/world-engine/spectator/viewer.mjs"],
    "the served shell names the viewer as the browser's entry");
  const { closure } = importClosure({
    entries,
    readModule: (publicPath) => {
      const file = `${pkg}${publicPath.replace("/world-engine/", "")}`;
      return existsSync(file) ? readFileSync(file, "utf8") : null;
    },
  });
  assert.ok(closure.length > 5,
    `the installed viewer's closure came back as ${closure.length} module(s) — the source is being read truncated`);
  assert.ok(closure.includes("/world-engine/tools/geometry.mjs"),
    "geometry.mjs is imported by the viewer and must be in its closure");
});

// ── the open path, source-pinned ────────────────────────────────────────────

test("choosing a crossing FETCHES its frame — nothing reads a warmed cache", () => {
  // `real` is the page's captured window.fetch, taken before the replay lens
  // installs its own. Both call sites go through it, so both are real requests.
  assert.match(worldPage, /var real = window\.fetch\.bind\(window\);/,
    "the page captures the live fetch");
  // the armed arrival, at parse time
  assert.match(worldPage, /real\("\/world-engine\/replay\/" \+ at \+ "\.json"\)[\s\S]{0,200}r\.json\(\)/,
    "an armed /world/?crossing=N fetches that frame itself");
  // and stepping between crossings, inside step()
  const step = worldPage.slice(worldPage.indexOf("function step(by)"));
  assert.match(step, /real\("\/world-engine\/replay\/" \+ at \+ "\.json"\)/,
    "step() fetches the crossing it moved to");
  assert.match(worldPage, /real\("\/world-engine\/replay\/index\.json"\)/,
    "the scrubber index is fetched when the panel opens");
});

test("no code path reads a preload entry or a readiness signal", () => {
  // This is what would have made the removal a behaviour change rather than a
  // timing one. It was true before the removal and must stay true.
  assert.doesNotMatch(worldPage, /getEntriesByType|link\[rel=["']?preload/,
    "the world page never inspects the preload cache");
});
