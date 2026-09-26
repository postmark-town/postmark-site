// nav.test.mjs — the rail is held to its own law, and to its shape.
//
//   node --test test/nav.test.mjs
//
// THE LAW, verbatim from `src/lib/nav.mjs`:
//
//   "a page per read, a read per page; this structure is the rail's single source"
//
// THE SHAPE, from Keemin's two passes over the revamp (2026-09-26, recorded on
// POS-244; the Site Lift, POS-249):
//
//   Postmark · The Town · The World · The Mail · The Households · Docs · Join
//
// REWRITTEN 2026-09-26 to assert THIS rail. The rails before it, and the
// rulings that shaped them, are in this file's history. What carries over is
// every LAW those rulings produced, each still asserted below:
//
//   1. A READ PER PAGE — every entry resolves to a route that exists.
//   2. A PAGE PER READ — every entry that owns a page is claimed `active` by
//      that page, or says why not in the structure (`noActive`).
//   3. THE FIRST CHIP IS THE AGGREGATE — every row leads with the seat's own
//      landing. Not escapable.
//   and: one chip row per page; no member declares a second row; no two-faced
//   seat; no key used twice; every chip wears a pixel-art icon, as decoration;
//   a flagged chip may wait for a page only while its flag is off; every moved
//   URL forwards, from ONE table, to a page that exists.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

import { RAIL, MOVED, allEntries, sectionOf, chipsFor, subChipsFor, rowFor, HARBOR, navFlags } from "../src/lib/nav.mjs";
import { ICONS, GRID, iconSvg } from "../src/lib/pixel-icons.mjs";

/** A flagged chip whose page has not landed on this branch, and says so: its
 *  flag is OFF by default and its `waits` reason is on file. The only chip the
 *  route laws let point at a page that is not here yet (the chip cannot render
 *  while it waits — asserted below). */
const waitsForItsPage = (e) =>
  Boolean(e.flag) && navFlags({})[e.flag] === false && (e.waits ?? "").trim().length >= 20;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PAGES = join(ROOT, "town", "pages");

// A route resolves the way Astro resolves it: /daily/ is served by either
// daily.astro or daily/index.astro, and either one is a real page.
function pageFileFor(href) {
  const path = href.split("#")[0].split("?")[0];
  const segs = path.split("/").filter(Boolean);
  const base = segs.length ? join(PAGES, ...segs) : join(PAGES, "index");
  for (const cand of segs.length ? [`${base}.astro`, join(base, "index.astro")] : [`${base}.astro`]) {
    if (existsSync(cand)) return cand;
  }
  return null;
}

function everyPageFile(dir = PAGES) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...everyPageFile(full));
    else if (name.endsWith(".astro")) out.push(full);
  }
  return out;
}

// The `active` key a page claims is the one it passes to POSTMARKLAYOUT, read
// from the opening layout tag and nothing else — a second component in the body
// that also takes `active` must not count (it once made a can-fail flip on this
// suite pass green with the defect installed).
const CLAIMED = new Map();   // key -> Set of page files claiming it

/** The opening <PostmarkLayout …> tag of a page file, or null if it renders its
 *  own document (the forwarding page, the World's spectator shell). */
function layoutTagOf(file) {
  return /<PostmarkLayout\b[^>]*>/s.exec(readFileSync(file, "utf8"))?.[0] ?? null;
}

/** The `active` key THIS page hands the layout. "" when it claims none. */
function activeKeyOf(file) {
  const open = layoutTagOf(file);
  if (!open) return "";
  const m = /\bactive=(?:"([^"]*)"|\{`?([^}`]*)`?\})/.exec(open);
  return (m?.[1] ?? m?.[2] ?? "").trim();
}

for (const f of everyPageFile()) {
  const k = activeKeyOf(f);
  if (!k) continue;
  if (!CLAIMED.has(k)) CLAIMED.set(k, new Set());
  CLAIMED.get(k).add(f);
}

const SEATS = ["Postmark", "The Town", "The World", "The Mail", "The Households", "Docs", "Join"];

// ── THE SHAPE ────────────────────────────────────────────────────────────────

test("SEVEN SEATS: Postmark · The Town · The World · The Mail · The Households · Docs · Join", () => {
  assert.deepEqual(RAIL.map((s) => s.label), SEATS, `the rail reads: ${RAIL.map((s) => s.label).join(" · ")}`);
  assert.deepEqual(RAIL.map((s) => s.href), ["/", "/bulletin/", "/world/", "/mail/", "/households/", "/docs/", "/join/"]);
  // Join keeps its lantern (Keemin, 2026-07-31: a newcomer must find Join
  // without hunting), and no seat is external — the harbor is a chip.
  assert.equal(RAIL.find((s) => s.key === "join").lantern, true, "Join lost its lantern");
  assert.equal(RAIL.some((s) => s.external), false, "a top-rail seat leaves the site");
  // what left the rail, by name
  for (const gone of ["record", "daily", "residents"]) {
    assert.equal(RAIL.some((s) => s.key === gone), false, `"${gone}" is still a seat`);
  }
});

test("each seat's row, in Keemin's words and order", () => {
  const row = (k) => chipsFor(k)?.chips.map((c) => c.label) ?? null;
  assert.deepEqual(row("town"), ["the bulletin", "the civic quarter", "the meeps"],
    "The Town = the Bulletin, the Civic Quarter, the Meeps, in that order");
  assert.deepEqual(row("world"), ["the living map", "conversations", "replay", "the atlas", "the harbor · beyond the water"]);
  assert.deepEqual(row("docs"), ["the docs", "stamps", "the numbers", "the repos"]);
  // a seat whose family is one read wears no row
  for (const k of ["postmark", "mail", "households", "join"]) assert.equal(chipsFor(k), null, `${k} grew a row`);
});

// ── rule 1: a read per page ──────────────────────────────────────────────────

test("every chip, at every depth, resolves to a route that exists", () => {
  for (const e of allEntries()) {
    if (e.external) {
      assert.match(e.href, /^https:\/\//, `${e.key}: an external entry needs an absolute URL`);
      continue;
    }
    if (waitsForItsPage(e) && !pageFileFor(e.href)) continue;
    assert.ok(pageFileFor(e.href), `${e.section}/${e.key} points at ${e.href}, which no page serves`);
  }
});

// ── rule 2: a page per read ──────────────────────────────────────────────────

test("every chip that owns a page is marked active by that page, or says why not", () => {
  const orphans = [];
  for (const e of allEntries()) {
    if (e.noActive) {
      assert.ok(e.noActive.trim().length >= 20, `${e.key} escapes the law with no reason on file`);
      continue;
    }
    if (e.external) continue;
    if (waitsForItsPage(e) && !pageFileFor(e.href)) continue;
    if (!CLAIMED.has(e.key)) orphans.push(`${e.section}/${e.key} (${e.href})`);
  }
  assert.deepEqual(orphans, [], `these chips can never light up:\n  ${orphans.join("\n  ")}`);
});

test("THE OTHER DIRECTION — every chip's route claims that chip's own key", () => {
  const wrong = [];
  for (const e of allEntries()) {
    if (e.external || e.noActive) continue;
    if (e.depth === 0 && e.members) continue;   // a seat's landing belongs to its first chip
    const file = pageFileFor(e.href);
    if (!file) continue;                        // rule 1 owns that failure
    if (!CLAIMED.get(e.key)?.has(file)) wrong.push(`${e.section}/${e.key} → ${e.href}`);
  }
  assert.deepEqual(wrong, [], `a chip and its page disagree about the chip's name:\n  ${wrong.join("\n  ")}`);
});

// ── rule 3: the first chip is the aggregate ──────────────────────────────────

test("every chip row leads with its own aggregate — the seat opens its first chip", () => {
  for (const s of RAIL) {
    if (!s.members) continue;
    assert.equal(s.members[0].href, s.href, `${s.key}'s seat and its first chip disagree about where the section starts`);
  }
  // THE TOWN, by name: the Bulletin leads (Keemin: "the bulletin first, the
  // most important"), so the seat opens the Bulletin and not the quarter.
  assert.equal(RAIL.find((s) => s.key === "town").href, "/bulletin/");
  assert.equal(rowFor("bulletin").chips[0].key, "bulletin");
});

// ── the laws that carried over ───────────────────────────────────────────────

test("no key is used twice — a duplicate silently steals the other's highlight", () => {
  const seen = new Map();
  for (const e of allEntries()) {
    // a chip that shares its seat's key is one read seen from two heights, not two
    if (e.depth === 1 && e.key === e.section) continue;
    const where = `${e.section}/${e.key}`;
    assert.equal(seen.has(e.key), false, `"${e.key}" is used by ${seen.get(e.key)} and ${where}`);
    seen.set(e.key, where);
  }
  // and an `alsoKeys` entry is never also somebody's own key
  const own = new Set(allEntries().map((e) => e.key));
  for (const e of allEntries()) for (const k of e.alsoKeys ?? []) {
    assert.equal(own.has(k), false, `${e.section}/${e.key} answers to "${k}", which is an entry's own key`);
  }
});

test("NO MEMBER DECLARES A SECOND ROW — one chip row per page, never the section's AND the room's", () => {
  const withRows = [];
  for (const s of RAIL) for (const m of s.members ?? []) if (m.chips) withRows.push(`${s.key}/${m.key}`);
  assert.deepEqual(withRows, [], `these rooms declare a row of their own:\n  ${withRows.join("\n  ")}`);
  for (const key of ["town", "meeps", "bulletin", "atlas", "residents", "households", "mail", "stamps", "docs", ""]) {
    assert.equal(subChipsFor(key), null, `"${key}" draws a second row`);
  }
  // a page that draws its own row (a shared household's member rail) takes none from the nav
  assert.equal(rowFor("household", { ownChips: true }), null);
  assert.equal(rowFor("meeps", { ownChips: true }), null);
});

test("NO TWO-FACED SEAT — the way home is the reader's own name, not a seat that changes under you", () => {
  //   "Your House is actually not necessary; the resident names when signed in
  //    more than suffice"                        — the founder, 2026-08-25
  for (const s of RAIL) {
    for (const gone of ["signedInLabel", "signedOutLabel", "houseHref", "houseKey"]) {
      assert.equal(s[gone], undefined, `${s.key} carries \`${gone}\` — the two-faced seat is back`);
    }
  }
  const shell = readFileSync(join(ROOT, "src", "layouts", "PostmarkLayout.astro"), "utf8");
  for (const gone of ["data-rail-in", "data-rail-out", "data-house-seat", "pm-nav-seat", "houseSlugOf", "signedInLabel"]) {
    assert.equal(shell.includes(gone), false, `PostmarkLayout still renders \`${gone}\``);
  }
  assert.match(shell, /data-auth-handles/, "the reader's own names — the way home — are gone from the header");
  // markup only — the layout's own comment names the component too
  assert.equal(shell.match(/^\s*<ChipRow\b/gm)?.length, 1, "PostmarkLayout renders more than one chip row — the stack is back");
});

// ── the icons (Keemin, 2026-09-26: "little pixel-art icons for each chip") ──

test("EVERY CHIP WEARS A PIXEL-ART ICON, its own, and no seat does", () => {
  const chips = allEntries().filter((e) => e.depth === 1);
  assert.deepEqual(chips.filter((c) => !c.icon).map((c) => `${c.section}/${c.key}`), [], "a chip has no icon");
  assert.deepEqual(chips.filter((c) => !ICONS[c.icon]).map((c) => `${c.key} → ${c.icon}`), [], "a chip names an icon nobody drew");
  for (const s of RAIL) {
    if (!s.members) continue;
    assert.equal(new Set(s.members.map((c) => c.icon)).size, s.members.length, `two of ${s.label}'s chips share a picture`);
  }
  for (const s of RAIL) assert.equal(s.icon, undefined, `the ${s.label} seat grew an icon; only chips wear them`);
});

test("THE ICONS ARE DRAWN ON THE GRID — 16×16, two inks, nothing borrowed", () => {
  assert.equal(GRID, 16);
  for (const [name, rows] of Object.entries(ICONS)) {
    assert.equal(rows.length, GRID, `${name} is ${rows.length} rows tall`);
    for (const [y, row] of rows.entries()) {
      assert.equal(row.length, GRID, `${name} row ${y} is ${row.length} wide`);
      assert.match(row, /^[#+.]+$/, `${name} row ${y} uses an ink the grid does not have`);
    }
    assert.ok(rows.join("").includes("#"), `${name} has no line`);
    const svg = iconSvg(name);
    assert.match(svg, /viewBox="0 0 16 16"/);
    assert.match(svg, /shape-rendering="crispEdges"/, `${name} would blur its pixels`);
    assert.match(svg, /aria-hidden="true"/, `${name} would be read aloud beside its label`);
    // the chip's own ink: an icon mutes and brightens with its chip
    assert.equal(/fill="#/.test(svg), false, `${name} carries a colour of its own`);
    // never a glyph: no text, no emoji, only drawn rectangles
    assert.equal(/<text\b|[☀-➿]|[\u{1F300}-\u{1FAFF}]/u.test(svg), false, `${name} borrows a glyph`);
  }
});

test("the chip row draws the icon as decoration, at a whole-pixel size", () => {
  const chipRow = readFileSync(join(ROOT, "src", "components", "ChipRow.astro"), "utf8");
  assert.match(chipRow, /class="pm-chip-icon" aria-hidden="true" set:html=\{iconSvg\(c\.icon\)\}/,
    "the row does not draw the chip's pixel icon, or would read it aloud");
  const css = readFileSync(join(ROOT, "src", "styles", "postmark.css"), "utf8");
  const rule = /\.pm-chiprow--nav \.pm-chip-icon svg \{([^}]*)\}/.exec(css)?.[1] ?? "";
  // 16px is one grid pixel per CSS pixel; any size off a multiple of 16 smears the art
  assert.match(rule, /width: 16px; height: 16px;/, "the icon is not drawn at the grid's own 16px");
});

// ── every page finds its seat ────────────────────────────────────────────────

test("a page anywhere in a family finds its section, so the seat lights up", () => {
  const cases = {
    postmark: "postmark",
    town: "town", meeps: "town", bulletin: "town", votes: "town", calendar: "town", daily: "town",
    world: "world", conversations: "world", replay: "world", atlas: "world", harbor: "world", birthday: "world",
    mail: "mail",
    households: "households", household: "households", residents: "households",
    docs: "docs", stamps: "docs", numbers: "docs", repos: "docs", projects: "town",
    join: "join",
  };
  for (const [key, seat] of Object.entries(cases)) {
    assert.equal(sectionOf(key)?.key, seat, `a page claiming "${key}" lights ${sectionOf(key)?.label ?? "nothing"}, not ${seat}`);
  }
  // orphan pages (the darkroom, the ops desk) are deliberately in no section
  assert.equal(sectionOf(""), null);
  assert.equal(sectionOf("darkroom"), null);
});

test("EVERY PAGE THAT CLAIMS A KEY LIGHTS A SEAT — no page is left with the rail dark", () => {
  const dark = [];
  for (const [key, files] of CLAIMED) {
    if (sectionOf(key)) continue;
    for (const f of files) dark.push(`${f.slice(PAGES.length + 1)} claims "${key}"`);
  }
  assert.deepEqual(dark, [], `these pages light no seat:\n  ${dark.join("\n  ")}`);
});

// ── the moves this rail made ─────────────────────────────────────────────────

test("THE CALENDAR AND FERRY'S DAILY LIVE ON THE BULLETIN'S BOARD — off the chips, and they light the Bulletin", () => {
  const chips = allEntries().filter((e) => e.depth === 1).map((e) => e.key);
  assert.equal(chips.includes("calendar"), false, "the calendar is still a chip");
  assert.equal(chips.includes("daily"), false, "the Daily is still a chip");
  const bulletin = RAIL.find((s) => s.key === "town").members.find((m) => m.key === "bulletin");
  assert.deepEqual(bulletin.alsoKeys, ["calendar", "daily"]);
  // their pages stand, and claim their own keys
  assert.equal(activeKeyOf(pageFileFor("/daily/")), "daily");
  assert.equal(activeKeyOf(pageFileFor("/calendar/")), "calendar");
  // the row the Daily draws is The Town's, and the lit chip is the Bulletin
  for (const k of ["daily", "calendar"]) {
    assert.equal(rowFor(k).of.key, "town");
  }
  const chipRow = readFileSync(join(ROOT, "src", "components", "ChipRow.astro"), "utf8");
  assert.match(chipRow, /\(c\.alsoKeys \?\? \[\]\)\.includes\(active\)/, "the row does not light the Bulletin for the pages on its board");
});

test("THE HARBOR IS THE WORLD'S FAR SHORE — a chip, on its own flag at its own domain", () => {
  assert.equal(HARBOR, "https://1f4ee.town/");
  const h = chipsFor("world").chips.find((c) => c.key === "harbor");
  assert.ok(h, "the harbor is not in The World's row");
  assert.equal(h.external, true);
  assert.equal(h.href, HARBOR, "a root-relative harbor would be wrong from one of the two domains");
  assert.equal(h.beta, true, "the harbor lost its beta mark on the way into The World");
  assert.equal(RAIL.some((s) => s.key === "harbor"), false, "the harbor is still a seat");
});

test("THE HOUSEHOLDS TAKE RESIDENTS' PLACE — a house, a resident's page and /window/ all light the seat", () => {
  const seat = RAIL.find((s) => s.key === "households");
  assert.deepEqual(seat.alsoKeys, ["household", "residents"]);
  assert.equal(activeKeyOf(pageFileFor("/households/")), "households");
  assert.equal(activeKeyOf(join(PAGES, "households", "[slug].astro")), "household");
  assert.equal(activeKeyOf(join(PAGES, "residents", "[handle].astro")), "residents");
  assert.equal(activeKeyOf(pageFileFor("/window/")), "residents");
  // the grid is retired; its address forwards to the houses
  assert.equal(existsSync(join(PAGES, "residents", "index.astro")), false, "the residents grid is back");
  assert.equal(MOVED["/residents/"], "/households/");
  // a house draws no nav row now (the seat has none); a shared house draws its own
  assert.equal(rowFor("household"), null);
  assert.equal(rowFor("household", { ownChips: true }), null);
});

test("THE MAIL IS A SEAT AGAIN, and its rooms light it", () => {
  const seat = RAIL.find((s) => s.key === "mail");
  assert.equal(seat.href, "/mail/");
  for (const href of ["/mail/", "/mail/returned/", "/mail/compose/"]) {
    assert.equal(activeKeyOf(pageFileFor(href)), "mail");
  }
  assert.equal(sectionOf("mail").key, "mail");
});

test("DOCS: the stamps, the numbers and the repos start it", () => {
  const docs = RAIL.find((s) => s.key === "docs");
  assert.deepEqual(docs.members.map((m) => [m.key, m.href]), [
    ["docs", "/docs/"], ["stamps", "/docs/stamps/"], ["numbers", "/docs/numbers/"], ["repos", "/docs/repos/"],
  ]);
  assert.equal(docs.members.find((m) => m.key === "stamps").beta, true, "Stamps lost its beta mark");
  for (const [href, key] of docs.members.map((m) => [m.href, m.key])) {
    assert.equal(activeKeyOf(pageFileFor(href)), key, `${href} does not claim "${key}"`);
  }
});

test("THE PROJECTS LIGHT THE CIVIC QUARTER — no chip of their own, one line on the quarter's page", () => {
  // Wright's ruling on POS-249 (2026-09-26): Keemin named the blurred boundary
  // between the Works and the civic quarter; Docs are guides, not resident builds.
  assert.equal(allEntries().some((e) => e.key === "projects" || e.href === "/projects/"), false, "The Projects grew a chip");
  const quarter = RAIL.find((s) => s.key === "town").members.find((m) => m.href === "/town/");
  assert.deepEqual(quarter.alsoKeys, ["projects"]);
  assert.equal(activeKeyOf(pageFileFor("/projects/")), "projects");
  assert.equal(rowFor("projects").of.key, "town");
  const hub = readFileSync(join(PAGES, "town", "index.astro"), "utf8");
  assert.ok(hub.includes('<a href="/projects/">the projects</a>'), "nothing on the quarter's page reaches The Projects");
});

test("A SEAT FOR A PAGE NOT BUILT YET STANDS ON AN HONEST PLACEHOLDER — /projects/ says what is coming", () => {
  // /docs/ left this loop 2026-09-26: POS-257 built its real index.
  for (const href of ["/projects/"]) {
    const src = readFileSync(pageFileFor(href), "utf8");
    assert.match(src, /<p class="tag">coming together<\/p>/, `${href} does not say it is coming`);
    assert.match(src, /It is being built\./, `${href} does not say it is being built`);
  }
  // THE FOUNDER'S LINE came with the repos and the numbers when The Record dissolved
  const docs = readFileSync(pageFileFor("/docs/"), "utf8");
  const line = docs.indexOf("We refuse to hide: the record is public.</p>");
  assert.ok(line > 0, "the founder's line left the site with The Record");
  assert.ok(line < docs.indexOf('<ul class="dx-guides">'), "the founder's line does not open the Docs");
});

// ── THE ONE REDIRECT TABLE ───────────────────────────────────────────────────

test("EVERY MOVED URL IS ONE ROW OF ONE TABLE, and lands on a page that exists", () => {
  assert.deepEqual(MOVED, {
    "/residents/": "/households/",
    "/works/": "/projects/",
    "/records/": "/replay/",
    "/records/crossings/": "/replay/",
    "/records/repos/": "/docs/repos/",
    "/stamps/": "/docs/stamps/",
    "/numbers/": "/docs/numbers/",
    "/archive/": "/projects/",
    "/board/": "/town/#board",
    "/stamps/guide/": "/docs/stamps/",
  });
  for (const [from, to] of Object.entries(MOVED)) {
    assert.ok(pageFileFor(to), `${from} forwards to ${to}, which no page serves`);
    // no chain: a row's target is never itself a moved address
    assert.equal(MOVED[to.split("#")[0]], undefined, `${from} → ${to} forwards twice`);
    // and a moved address has no page of its own left to shadow the forward
    assert.equal(pageFileFor(from), null, `${from} is moved AND still a page`);
  }
  // the one table is the only one: the Astro config writes no redirects of its own
  const config = readFileSync(join(ROOT, "astro.config.town.mjs"), "utf8");
  assert.equal(/^\s*redirects:/m.test(config), false, "astro.config.town.mjs grew a second redirect table");
  // and no chip, anywhere, points at a moved address
  for (const e of allEntries()) assert.equal(MOVED[e.href], undefined, `${e.key} points at ${e.href}, which moved`);
});

test("THE FORWARD CARRIES THE FRAGMENT — letters link /stamps/#board, and a meta refresh drops it", () => {
  const src = readFileSync(join(PAGES, "[...moved].astro"), "utf8");
  assert.match(src, /import \{ MOVED \} from "@\/lib\/nav\.mjs"/, "the forwarder does not read the one table");
  assert.match(src, /location\.replace\(to\.includes\("#"\) \? to : to \+ location\.hash\)/, "the forward drops the fragment");
  assert.equal(/location\.assign/.test(src), false, "assign, not replace — Back would bounce through the hop");
  assert.match(src, /http-equiv="refresh"/, "no fallback for a reader without script");
  assert.match(src, /name="robots" content="noindex"/);
});

test("EVERY OLD URL STILL ANSWERS — as its page, or as a forward to it", () => {
  for (const href of [
    "/", "/town/", "/daily/", "/bulletin/", "/meeps/", "/votes/", "/calendar/",
    "/replay/", "/conversations/", "/atlas/",
    "/mail/", "/mail/returned/", "/mail/compose/", "/window/", "/join/", "/households/",
  ]) {
    assert.ok(pageFileFor(href), `${href} no longer answers`);
  }
  assert.ok(existsSync(join(PAGES, "world.astro")), "/world/ lost its shell");
  for (const href of ["/residents/", "/works/", "/stamps/", "/numbers/", "/records/", "/records/crossings/", "/records/repos/"]) {
    assert.ok(MOVED[href], `${href} neither answers nor forwards`);
  }
});

test("THE BALLOT, by name — the page the rail's law exists because of", () => {
  assert.ok(pageFileFor("/votes/"), "the ballot page left the site");
  assert.ok(CLAIMED.has("votes"), "/votes/ does not mark itself active");
  assert.equal(sectionOf("votes").key, "town");
  const hub = readFileSync(join(PAGES, "town", "index.astro"), "utf8");
  assert.ok(hub.includes('href="/votes/"'), "nothing on the hub opens the Ballot Box");
});

test("THE NOTICE BOARD IS THE BULLETIN, so it matches up", () => {
  const chip = allEntries().find((e) => e.key === "bulletin");
  assert.equal(chip.label, "the bulletin");
  assert.equal(chip.href, "/bulletin/");
  for (const e of allEntries()) assert.equal(/notice board/i.test(e.label ?? ""), false, `"${e.label}" says notice board`);
  assert.match(layoutTagOf(pageFileFor("/bulletin/")), /title="The bulletin — Postmark"/);
});

test("/town/ IS NOT A DASHBOARD — the quarter, no cards restating the chips", () => {
  const src = readFileSync(join(PAGES, "town", "index.astro"), "utf8");
  assert.equal(/\bfrom "@\/lib\/nav\.mjs"/.test(src), false, "/town/ reads the rail to restate its own row as cards");
  assert.ok(src.includes('<section class="cq"'), "the civic quarter is gone from /town/");
  assert.equal(rowFor("town").chips.find((c) => c.href === "/town/").label, "the civic quarter");
});

// ── the nav flags ────────────────────────────────────────────────────────────

test("THE NAV FLAGS default off, and a flagged chip cannot render while its flag is off", () => {
  assert.deepEqual(navFlags({}), { whatsOn: false });
  assert.deepEqual(navFlags(undefined), { whatsOn: false });
  assert.equal(navFlags({ PUBLIC_NAV_WHATS_ON: "0" }).whatsOn, false);
  assert.equal(navFlags({ PUBLIC_NAV_WHATS_ON: "1" }).whatsOn, true);
  for (const e of allEntries().filter((x) => x.flag)) {
    assert.ok((e.waits ?? "").trim().length >= 20, `${e.key} is flagged with no reason on file`);
    assert.equal(navFlags({})[e.flag], false, `${e.key}'s flag is on by default`);
  }
  const shell = readFileSync(join(ROOT, "src", "layouts", "PostmarkLayout.astro"), "utf8");
  assert.match(shell, /rowFor\(active, \{ ownChips, flags: navFlags\(import\.meta\.env\) \}\)/);
});

// ── THE BUILT SITE (skipped until built, as POS-177 rules) ───────────────────

const DIST = join(ROOT, "dist-town");
const builtPage = (href) => join(DIST, ...href.split("/").filter(Boolean), "index.html");

test("the built rail is the seven seats, on every page that wears the layout", { skip: !existsSync(builtPage("/")) }, () => {
  const seats = (href) => {
    const s = readFileSync(builtPage(href), "utf8");
    const i = s.indexOf('class="pm-townnav-links"');
    const nav = s.slice(i, s.indexOf("</nav>", i));
    return [...nav.matchAll(/<a\b[^>]*>([^<]*)/g)].map((m) => m[1].trim());
  };
  for (const href of ["/", "/town/", "/bulletin/", "/meeps/", "/households/", "/mail/", "/daily/", "/docs/", "/projects/", "/docs/stamps/"]) {
    assert.deepEqual(seats(href), SEATS, `${href}'s built rail`);
  }
});

test("the built chip rows wear their pixel icons, and the lit chip is the right one", { skip: !existsSync(builtPage("/daily/")) }, () => {
  const row = (href) => {
    const s = readFileSync(builtPage(href), "utf8");
    const i = s.indexOf('class="pm-chiprow pm-chiprow--nav');
    return i < 0 ? "" : s.slice(i, s.indexOf("</nav>", i));
  };
  const lit = (href) => [...row(href).matchAll(/<a class="pm-chip[^"]*is-on[^"]*"[^>]*>[\s\S]*?<\/a>/g)]
    .map((m) => m[0].replace(/<svg[\s\S]*?<\/svg>/g, "").replace(/<[^>]+>/g, "").trim());
  assert.deepEqual(lit("/daily/"), ["the bulletin"], "the Daily does not light the Bulletin");
  assert.deepEqual(lit("/calendar/"), ["the bulletin"], "the calendar does not light the Bulletin");
  assert.deepEqual(lit("/town/"), ["the civic quarter"]);
  assert.deepEqual(lit("/docs/stamps/"), ["stampsbeta"]);
  assert.deepEqual(lit("/projects/"), ["the civic quarter"], "The Projects do not light the civic quarter");
  for (const href of ["/bulletin/", "/replay/", "/docs/"]) {
    const r = row(href);
    const chips = (r.match(/<a class="pm-chip/g) ?? []).length;
    assert.ok(chips >= 3, `${href} drew ${chips} chips`);
    assert.equal((r.match(/<svg class="pm-pixicon"/g) ?? []).length, chips, `${href}: a chip without its picture`);
  }
});

test("every moved path builds a forward, and every forward lands", { skip: !existsSync(builtPage("/")) }, () => {
  for (const [from, to] of Object.entries(MOVED)) {
    const file = builtPage(from);
    assert.ok(existsSync(file), `${from} did not build`);
    const s = readFileSync(file, "utf8");
    assert.ok(s.includes(`content="0;url=${to}"`), `${from} does not forward to ${to}`);
    assert.ok(existsSync(builtPage(to.split("#")[0])), `${from} forwards to ${to}, which did not build`);
  }
});

test("THE BUILT FORWARD LANDS WITH ITS FRAGMENT — /stamps/#board reaches /docs/stamps/#board", { skip: !existsSync(builtPage("/stamps/")) }, () => {
  // Run the built page's own forwarding script against a location that
  // arrived with a fragment, and read where it sends the reader.
  const run = (from, hash) => {
    const page = readFileSync(builtPage(from), "utf8");
    const js = [...page.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).find((x) => x.includes("location.replace"));
    assert.ok(js, `${from} carries no forwarding script`);
    const went = [];
    runInNewContext(js, { location: { hash, replace: (u) => went.push(u), assign: (u) => went.push("ASSIGN " + u) } });
    return went;
  };
  assert.deepEqual(run("/stamps/", "#board"), ["/docs/stamps/#board"]);
  assert.deepEqual(run("/stamps/", "#earning"), ["/docs/stamps/#earning"]);
  assert.deepEqual(run("/stamps/", ""), ["/docs/stamps/"]);
  // a target with its own fragment keeps its own
  assert.deepEqual(run("/board/", "#elsewhere"), ["/town/#board"]);
});

test("the routes that came back from a fold are real pages, not stubs", () => {
  // /bulletin/, /window/ and /meeps/ were all redirect stubs pointing INTO a
  // scroller before the 2026-08-25 chip wave gave them their content back. A
  // stub still passes rule 1 (the file exists); this names them, because a
  // silent re-fold is exactly what took a year to find last time.
  for (const [key, href] of [["bulletin", "/bulletin/"], ["residents", "/window/"], ["meeps", "/meeps/"], ["daily", "/daily/"]]) {
    const file = pageFileFor(href);
    assert.ok(file, `${href} has no page`);
    assert.equal(activeKeyOf(file), key, `${href} does not claim "${key}" — it has folded into a stub`);
    assert.equal(/http-equiv="refresh"/.test(readFileSync(file, "utf8")), false, `${href} is a redirect again`);
  }
});

test("A SHARED HOUSE'S PAGE TAKES NO ROW FROM THE NAV — its own member rail is the row", () => {
  // The Households has no row now, but the predicate stays: the day a second
  // read joins the family, a shared house must not show the nav's row stacked
  // over its own.
  for (const file of [join(PAGES, "households", "[slug].astro"), join(PAGES, "residents", "[handle].astro")]) {
    assert.match(layoutTagOf(file), /\bownChips=\{isShared\(house, members\)\}/, `${file.slice(PAGES.length + 1)} does not pass ownChips`);
  }
});

test("the built page of a shared house carries no chip row from the nav", { skip: !existsSync(builtPage("/households/starforge/")) }, () => {
  const page = readFileSync(builtPage("/households/starforge/"), "utf8");
  assert.equal((page.match(/class="pm-chiprow pm-chiprow--nav/g) ?? []).length, 0, "the nav's row stacks over Starforge's own member rail");
});
