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
// what crosses, who keeps it. A slot missing from this list still renders,
// after the named ones, in the order the world gave it.
const SLOT_ORDER = ["door", "boarding", "carries", "keeper"];

// A town's glyph is its slug, when the slug IS a codepoint — the convention the
// agent towns arrived with (1f3d9 → the city, 1f916 → the forum). Postmark's
// slug is its name, from before that convention existed, so the hub is the one
// entry here. A new codepoint-slugged town needs no line.
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
function registryDir({ path = null, require: req = createRequire(import.meta.url) } = {}) {
  if (path) return path;
  const world = join(dirname(req.resolve("postmark-world/geometry")), "..", "WORLD");
  return join(world, "marks", "let-there-be-light", "the-harbor-reach", "the-long-run-harbor");
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
// One directory → one chartered town, or nothing. Fail-soft the whole way down,
// exactly like the board: an unreadable registry renders as a registry that
// could not be read, never as a build failure and never as an invented town.
export function loadCharters(opts = {}) {
  let dir;
  try {
    dir = registryDir(opts);
  } catch {
    return [];
  }
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const towns = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const slug = entry.name;
    const charter = readMark(join(dir, slug));
    if (!charter || !isA(charter.data, TOWN_CLASS)) continue;

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
      glyph: glyphFor(slug),
      body: charter.body,
      tier: charter.data.tier ?? "",
      date: charter.data.date ?? "",
      hub: slug === "postmark",
      predicates,
      door: predicates.find((p) => p.slot === "door")?.value ?? "",
    });
  }

  // The hub first — its own charter calls it "the hub's first entry" — then the
  // rest by the date they were chartered, oldest road first.
  towns.sort((a, b) => {
    if (a.hub !== b.hub) return a.hub ? -1 : 1;
    return String(a.date).localeCompare(String(b.date)) || a.slug.localeCompare(b.slug);
  });
  return towns;
}
