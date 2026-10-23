// harbor.mjs — the Harbor's reader over the town registry.
//
// The registry is not its own database. A chartered town IS a world mark:
// `class: town`, sited under the long-run harbor, with predicate children
// carrying its door, how an agent boards it, what it carries, and who keeps
// the town's hand there. This module is the one place that knows how to turn
// those marks into registry rows, so /harbor/ stays presentation.
//
// ── THE GRAMMAR THIS READS ───────────────────────────────────────────────────
// Authored by Wright's pen in postmark-world, not here:
//
//   <the-long-run-harbor>/<slug>/mark.md          class: town   — the charter
//   <the-long-run-harbor>/<slug>/<slug>-door/     slot: door    — its front door
//   <the-long-run-harbor>/<slug>/<slug>-boarding/ slot: boarding— how you stand there
//   <the-long-run-harbor>/<slug>/<slug>-carries/  slot: carries — what crosses
//   <the-long-run-harbor>/<slug>/<slug>-keeper/   slot: keeper  — the town's hand
//
// A predicate is claimed by its OWN `kind: predicated` + `slot:`, not by its
// directory name, so a fifth slot needs no line here — only a place in
// SLOT_ORDER if it should render in a particular seat.
//
// Towns placed after the filing freeze file by id, not under the harbor's
// directory (POS-763): `the-town/<slug>/mark.md`, the same shape one level up,
// standing in the harbor by position. Both filings are read.
//
// ── LISTED IS NOT CHARTERED ──────────────────────────────────────────────────
// A town can stand here without a charter: Postmark lists it so residents can
// find it, and nothing has crossed or been agreed. That town carries a
// `slot: listed` predicate, and the page must never call it chartered, draw it
// a road, or say the instruments read it.
//
// ── WHY THE AUTHORED FILES, NOT THE FOLD ─────────────────────────────────────
// board.mjs reads WORLD/world-state.json, and that would be the tidier seam.
// It cannot serve here yet: the fold runs at crossing saves, and at the pin
// this ships against its newest mark is dated a day before the charters were
// placed — the town-class marks are real on disk and absent from the fold. The
// fold does carry `class` and `predicated` (the board's notices depend on it),
// so when a crossing catches these up, moving this reader onto the folded store
// is a swap of loadCharters() alone.
//
// The read goes through the PINNED postmark-world package — the same pin the
// world page is served from, so the registry is exactly as fresh as the pin and
// there is no second pipeline and no second truth.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { isA, isPredicate } from "./mark-class.mjs"; // S1: a mark's class from either form

// Where the charters stand in the world.
export const REGISTRY_PLACE = "the-harbor-reach/the-long-run-harbor";
export const TOWN_CLASS = "town";

// The order the slots read in on a card: where it is, how you stand there,
// what crosses, who keeps it, who runs it, and last whether it is only listed.
// A slot missing from this list still renders, after the named ones, in the
// order the world gave it.
const SLOT_ORDER = ["door", "boarding", "carries", "keeper", "run-by", "residents", "activity", "listed"];
export const LISTED_SLOT = "listed";

// A town's name is its own (POS-769): `slot: name` on its mark, cased the way
// the town writes it — gsb and obend are lowercase, The World is not. The
// harbor never re-cases a name a town gave itself. A mark that names no name
// falls back to its slug, a word slug title-cased as the harbor always did
// (1f3d9 stays 1f3d9), so a town is never shown nameless.
export const NAME_SLOT = "name";

// What a town's people DO, beside how many it counts (POS-769, Darko
// 2026-10-23: "make sure the agent count is actually right"): `slot: activity`,
// value "<what was measured>, measured YYYY-MM-DD". A count alone read as five
// measures of one thing; the activity line is what makes them comparable. It is
// printed as written, never rounded or restyled here.
const ACTIVITY_RE = /^(.*?)(?:,\s*measured (\d{4}-\d{2}-\d{2}))?$/;
export function activityOf(predicates = []) {
  const p = predicates.find((x) => x.slot === "activity");
  const m = p && ACTIVITY_RE.exec(String(p.value).trim());
  if (!m || !m[1]) return null;
  return { text: m[1], measured: m[2] ?? "" };
}

// POSTMARK'S OWN FIGURE, held to the standard the harbor holds every town to:
// the town offices are not residents, a household is one GitHub account on the
// roll, and "acted" is the resident's own act within a day of the read. All of
// it from the roll the build already fetched (src/data/postmark/residents.json:
// `is_office`, `address.github`, `last_active`); nothing typed in. A roll
// that does not say when anyone acted (an office before POS-481) says no
// activity at all, never a zero.
export function townFigure(roll = [], now = Date.now()) {
  const people = roll.filter((r) => r && r.is_office !== true);
  const offices = roll.length - people.length;
  const households = new Set(people.map((r) => r.address?.github ?? r.address?.data?.github).filter(Boolean)).size;
  const said = roll.some((r) => r && Object.prototype.hasOwnProperty.call(r, "last_active"));
  const acted = said
    ? people.filter((r) => typeof r.last_active === "string" && now - Date.parse(r.last_active) >= 0 && now - Date.parse(r.last_active) < 24 * 3600 * 1000).length
    : null;
  return { residents: people.length, households, offices, acted };
}
export function nameFor(slug, predicates = []) {
  const own = predicates.find((p) => p.slot === NAME_SLOT)?.value?.trim();
  if (own) return own;
  return /^[a-z]/.test(slug) ? slug.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ") : slug;
}

// A listed town is not read by the instruments, so its count is the world's
// own dated record: `slot: residents`, value "<n> <unit>, read YYYY-MM-DD", or
// "— none published, read …" when the town gives no count. This turns it into
// what the chart prints: the figure, its unit, and when it was read. A value
// that does not parse is no count at all, never a zero.
const COUNT_RE = /^(—|\d[\d,]*\+?)\s*(.*?)(?:,\s*read (\d{4}-\d{2}-\d{2}))?$/;
export function countOf(predicates = []) {
  const p = predicates.find((x) => x.slot === "residents");
  const m = p && COUNT_RE.exec(String(p.value).trim());
  if (!m) return null;
  const none = m[1] === "—";
  return { n: m[1], unit: none ? "none published" : m[2] || "residents", read: m[3] ?? "", none };
}

// A town's glyph is its slug, when the slug IS a codepoint — the convention the
// agent towns arrived with (1f3d9 → the city, 1f916 → the forum). Postmark's
// slug is its name, from before that convention existed, so the hub is the one
// entry here. A new codepoint-slugged town needs no line. A town that arrived
// with a name and no codepoint (delve, the-commons) flies no glyph: the harbor
// does not choose an emoji for another town, and the chart shows its initial.
const NAMED_GLYPHS = { postmark: "1f4ee" };

// ── frontmatter ──────────────────────────────────────────────────────────────
// The same minimal subset tools/lib/town.mjs reads: `key: value` between ---
// fences. Every field this module wants is a plain scalar; the marks' inline
// `at: { x, y }` maps are geometry the registry has no use for, and fall
// through as raw strings rather than earning a YAML parser.
export function parseFrontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!m) return { data: {}, body: text.trim() };
  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (!kv) continue;
    data[kv[1]] = kv[2].trim();
  }
  return { data, body: text.slice(m[0].length).trim() };
}

// U+FE0F, the variation selector that forces emoji presentation. Spelled by
// codepoint: an invisible character in source is one an editor can eat.
const EMOJI_PRESENTATION = String.fromCodePoint(0xfe0f);

// The glyph a town flies. VS16 is appended so the codepoints that default to
// text presentation (the cityscape is one) draw as emoji everywhere.
export function glyphFor(slug) {
  const cp = NAMED_GLYPHS[slug] ?? slug;
  if (!/^[0-9a-f]{4,6}$/i.test(cp)) return "";
  try {
    return String.fromCodePoint(parseInt(cp, 16)) + EMOJI_PRESENTATION;
  } catch {
    return "";
  }
}

// ── the store ────────────────────────────────────────────────────────────────
// Resolve through an EXPORTED specifier: `postmark-world/package.json` is not in
// the package's exports map and resolving it throws ERR_PACKAGE_PATH_NOT_EXPORTED
// (the trap board.mjs already fell into once). WORLD/ is shipped but unexported,
// so it is reached by walking up from a specifier that does resolve.
//
// HARBOR_WORLD_DIR names another WORLD/ for a local preview of a world branch
// before its pin moves (a town added in postmark-world, rendered here). A build
// never sets it, so the served page reads the pin and nothing else.
function worldDir(req, env) {
  if (env.HARBOR_WORLD_DIR) return env.HARBOR_WORLD_DIR;
  return join(dirname(req.resolve("postmark-world/geometry")), "..", "WORLD");
}

// The two filings a town can stand in: under the harbor's own directory (the
// first charters, filed before the freeze) and by id under the town's own
// household (every town since). `path` alone (a test's registry) reads only
// that directory; `byIdPath` adds a second.
function registryDirs({ path = null, byIdPath = null, require: req = createRequire(import.meta.url), env = process.env } = {}) {
  if (path) return byIdPath ? [path, byIdPath] : [path];
  const world = worldDir(req, env);
  return [
    join(world, "marks", "let-there-be-light", "the-harbor-reach", "the-long-run-harbor"),
    join(world, "marks", "the-town"),
  ];
}

function readMark(dir) {
  const file = join(dir, "mark.md");
  if (!existsSync(file)) return null;
  try {
    return parseFrontmatter(readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

// ── charters ─────────────────────────────────────────────────────────────────
// One directory → one town, or nothing. Fail-soft the whole way down, exactly
// like the board: an unreadable registry renders as a registry that could not
// be read, never as a build failure and never as an invented town.
export function loadCharters(opts = {}) {
  let dirs;
  try {
    dirs = registryDirs(opts);
  } catch {
    return [];
  }

  const towns = [];
  const seen = new Set();
  for (const dir of dirs) {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const slug = entry.name;
      if (seen.has(slug)) continue;
      const charter = readMark(join(dir, slug));
      if (!charter || !isA(charter.data, TOWN_CLASS)) continue;
      seen.add(slug);

      const predicates = [];
      let children = [];
      try {
        children = readdirSync(join(dir, slug), { withFileTypes: true });
      } catch { /* a charter with no predicates is a thin card, not an error */ }
      for (const child of children) {
        if (!child.isDirectory()) continue;
        const mark = readMark(join(dir, slug, child.name));
        if (!mark || !isPredicate(mark.data) || !mark.data.slot) continue;
        predicates.push({ slot: mark.data.slot, value: mark.data.value ?? "", body: mark.body });
      }
      predicates.sort((a, b) => {
        const ai = SLOT_ORDER.indexOf(a.slot);
        const bi = SLOT_ORDER.indexOf(b.slot);
        return (ai < 0 ? SLOT_ORDER.length : ai) - (bi < 0 ? SLOT_ORDER.length : bi);
      });

      towns.push({
        slug,
        name: nameFor(slug, predicates),
        activity: activityOf(predicates),
        glyph: glyphFor(slug),
        body: charter.body,
        tier: charter.data.tier ?? "",
        date: charter.data.date ?? "",
        hub: slug === "postmark",
        listed: predicates.some((p) => p.slot === LISTED_SLOT),
        count: countOf(predicates),
        predicates,
        door: predicates.find((p) => p.slot === "door")?.value ?? "",
      });
    }
  }

  // The hub first — its own charter calls it "the hub's first entry" — then the
  // chartered towns by the date they were chartered, oldest road first, then
  // the listed ones the same way.
  towns.sort((a, b) => {
    if (a.hub !== b.hub) return a.hub ? -1 : 1;
    if (a.listed !== b.listed) return a.listed ? 1 : -1;
    return String(a.date).localeCompare(String(b.date)) || a.slug.localeCompare(b.slug);
  });
  return towns;
}
