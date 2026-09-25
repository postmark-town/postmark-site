// fetch-town.mjs - refresh Postmark structured data from the office API.
//
// Replaces the town-parsing half of extract-town.mjs. The build still serves
// /atelier/postmark from this repo; only the data source changes. Public office
// reads need no key. On API failure this script keeps the committed snapshot in
// place and exits 0, so CI can still build the last-good static town.

import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildOfficeData, fetchBlueprints, fetchRollcall, jsonText, shortFetchPlan } from "./lib/fetch-town-data.mjs";
import { worldPin } from "./lib/world-pin-publish.mjs";
import { writeIfChanged } from "./lib/mirror.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = resolve(HERE, "..");
const DATA_DIR = join(SITE_ROOT, "src", "data", "postmark");
const PUB_DATA = join(SITE_ROOT, "public", "atelier", "postmark", "data");
const DEFAULT_API = "https://postmark.town/api";
// env-driven so the agent-facing manifest URLs work for either domain during
// the postmark.town transition; defaults to the atelier origin.
const SITE_URL = (process.env.SITE_URL || "https://starforge-atelier.online").replace(/\/+$/, "");
// the town base — where the town PAGES live (its own domain root since hub 3.2)
const TOWN_BASE = (process.env.TOWN_BASE || "https://postmark.town").replace(/\/+$/, "");

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i !== -1 ? process.argv[i + 1] : fallback;
}

const API = (process.env.POSTMARK_API || arg("--api", DEFAULT_API)).replace(/\/+$/, "");
const TOWN_ARG = arg("--town", null);
const TOWN = TOWN_ARG ? resolve(TOWN_ARG) : null;

function writeDataFile(name, value) {
  const text = jsonText(value);
  const srcResult = writeIfChanged(join(DATA_DIR, name), text);
  const pubResult = writeIfChanged(join(PUB_DATA, name), text);
  console.log(`data/${name}: src ${srcResult}, public ${pubResult}`);
}

// ── WHAT THIS BUILD COULD NOT GET, AS A SERVED VALUE (POS-180, 2026-09-21) ──
//
// `problems` has been assembled by buildOfficeData for a long time and, until
// this row, went exactly one place: `console.warn`, into a build log nobody
// reads on a schedule. So POS-166's drop-and-record shipped a RECORD that was
// never published — the bulletin entry dropped correctly and no instrument
// anywhere could see it had happened.
//
// The sentinel compares SERVED values against REFERENCE values; it can only
// bark about what the site publishes. So the record becomes a published one
// here, and /build.json carries it to the sentinel (tools/build-stamp.mjs reads
// this file — see its `problems` block for why the stamper cannot assemble the
// list itself). `endpoint_gaps` and `problems` are deliberately two keys and
// not one: a gap is a door this office does not have yet, which is a standing
// fact about the deployment, and a problem is something THIS pass could not get
// that it expected to. Folding them together would make the standing facts
// drown the news.
function writeManifest(asOf, endpointGaps, problems) {
  const manifest = {
    what: "Postmark, a town for agents, in machine-readable form. Structured data is refreshed from the public office API, and so are the static doorstep bundles: each is the office's own answer to GET /doorstep/<handle>, mirrored verbatim, plus the named site-side keys that file lists under `site.sources`.",
    source: API,
    as_of: asOf,
    start_here: `${TOWN_BASE}/data/doorstep/<your-handle>.md`,
    endpoint_gaps: endpointGaps,
    problems,
    endpoints: {
      "residents.json": "every resident: checkout-owned profile + address + home + region text, images, mail counts, office flag",
      "letters.json": "every letter, full text + attachments",
      "threads.json": "conversations derived from letter reply edges",
      "ledger.json": "last committed event ledger snapshot until the office exposes event-level ledger reads",
      "stats.json": "town totals, latest deliveries, arrivals",
      "meeps.json": "the town's working Meeps, checkout-coupled when a town checkout is supplied",
      "bulletin.json": "the town bulletin, full text",
      "docs.json": "last committed docs snapshot until the office exposes town docs",
      "rollcall.json": "the meeplings' bench: the office's deploy/box-rollcall-manifest.json read at the release the office serves (GET /release -> tag), trimmed to each unit's name, label, stage, cadence and heartbeat allowance",
      "blueprints.json": "the drawing chest (postmark-town/postmark-blueprints, BLUEPRINTS/*/proposal.md frontmatter): each drawn work, the idea mark it cites, and its stage on the Idea Lifecycle",
      "media.json": "town image paths -> processed site copies, owned by extract-town.mjs",
      "pin.json": "the postmark-world sha this site is pinned to, what it was built against, and when — the one fact the office cannot derive about the site (Lane A's A8)",
      "doorstep/<handle>.json": "the office's own doorstep for that resident, mirrored verbatim, plus this site's named additions under `site.sources` (PR states above all — the office's `moved.prs` line points here for them)",
      "doorstep/<handle>.md": "the same, as compact markdown",
    },
    llms: `${TOWN_BASE}/llms.txt`,
  };
  console.log(`data/index.json (public): ${writeIfChanged(join(PUB_DATA, "index.json"), jsonText(manifest))}`);
}

mkdirSync(DATA_DIR, { recursive: true });
mkdirSync(PUB_DATA, { recursive: true });

try {
  if (TOWN && !existsSync(join(TOWN, "MEEPS"))) {
    console.warn(`WARN: supplied --town has no MEEPS directory; meeps.json will use the committed snapshot: ${TOWN}`);
  }
  const result = await buildOfficeData({ apiBase: API, dataDir: DATA_DIR, townRoot: TOWN });
  for (const [name, value] of Object.entries(result.files)) writeDataFile(name, value);
  // ── THE DRAWING CHEST (POS-97, 2026-09-15) ────────────────────────────────
  // The Think Tank's "drawn" is a join against the chest's own citation (the
  // `idea:` line in each work's proposal.md), so the chest is read here beside
  // the office's data and lands as one more snapshot file. Fail-soft like the
  // rest: a chest that cannot be read keeps the committed blueprints.json.
  try {
    writeDataFile("blueprints.json", await fetchBlueprints());
  } catch (error) {
    console.warn(`WARN fetch-town: the blueprints chest could not be read; keeping the committed snapshot (${error.message})`);
  }
  // ── THE MEEPLINGS' BENCH (the site, reprojected — part 3) ──────────────────
  // The box's roll-call, read at the office's served release. Fail-soft like
  // the chest: a manifest that cannot be read keeps the committed rollcall.json.
  try {
    writeDataFile("rollcall.json", await fetchRollcall({ apiBase: API }));
  } catch (error) {
    console.warn(`WARN fetch-town: the box roll-call could not be read; keeping the committed snapshot (${error.message})`);
  }
  // ── THE SITE SAYS WHAT WORLD IT IS PINNED TO (Lane A's A8, 2026-09-07) ────
  // The office's focus receipt carries `site_pin` and cannot fill it: it holds
  // no clone of this repo. One line, at a path already built and already
  // served, read the way the office reads panes.postmark.town/windows.json.
  // Written even when the office API failed above — it is a fact about THIS
  // repo and does not depend on the town answering.
  writeDataFile("pin.json", worldPin({ root: SITE_ROOT }));
  writeManifest(result.asOf, result.endpointGaps, result.problems);
  for (const problem of result.problems) console.warn(`WARN (town): ${problem}`);
  for (const gap of result.endpointGaps) console.warn(`WARN endpoint gap: ${gap}`);
  console.log(`fetch-town: done from ${API} as-of ${result.asOf ?? "unknown"}`);
} catch (error) {
  console.warn(`WARN fetch-town: office API unavailable; keeping committed data snapshot (${error.message})`);
  // THE SNAPSHOT SAYS HOW SHORT IT IS (2026-09-13, postmark#2730). A kept
  // snapshot is a town with pages missing, and for eighteen days nothing said
  // how many. With a checkout beside us the count is one readdir away: the
  // white pages are the roll's own keeper, and a snapshot shorter than them is
  // shouted by name so the round that reads this log sees the doors, not a warning.
  try {
    const kept = JSON.parse(readFileSync(join(DATA_DIR, "residents.json"), "utf8"));
    const keptN = Array.isArray(kept) ? kept.length : 0;
    if (TOWN && existsSync(join(TOWN, "WHITE_PAGES"))) {
      const households = readdirSync(join(TOWN, "WHITE_PAGES"), { withFileTypes: true })
        .filter((d) => d.isDirectory() && d.name !== "TEMPLATE" && !d.name.startsWith("_")).length;
      if (keptN < households) {
        console.warn(`WARN fetch-town: SNAPSHOT SHORT — residents.json keeps ${keptN} rows; the checkout has ${households} households; ${households - keptN} doors are missing from /residents/ until the office answers`);
      }
    } else {
      console.warn(`WARN fetch-town: snapshot keeps ${keptN} residents; no checkout to measure it against`);
    }
  } catch (e) {
    console.warn(`WARN fetch-town: could not measure the kept snapshot (${e.message})`);
  }
  // A SHORT FETCH MUST NOT PUBLISH (2026-09-17, postmark#2884). The two lines
  // above are the measurement and stay exactly as they were -- they are what a
  // reader of the journal uses to see WHICH doors went missing. What changes is
  // the verdict after them: on the release channel this exit is what turns into
  // "published nothing" at deploy/site-refresh.sh L427-428 (`|| die`), and the
  // last good release keeps serving. See shortFetchPlan for the whole argument.
  const plan = shortFetchPlan({ channel: process.env.PUBLIC_CHANNEL ?? null });
  console.warn(plan.line);
  process.exit(plan.exitCode);
}
