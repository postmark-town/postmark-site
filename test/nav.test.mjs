// nav.test.mjs — the rail is held to its own law, and to its shape.
//
//   node --test test/nav.test.mjs
//
// THE LAW, verbatim from `src/lib/nav.mjs`:
//
//   "a page per read, a read per page; this structure is the rail's single source"
//
// THE SHAPE, from the design (G:/Starstory/docs/2026-09-25/design-notes/
// the-site-reprojected.md, "Six seats, the door's nouns"):
//
//   Postmark · The Town · The World · The Households · The Record · Join
//
// REWRITTEN 2026-09-25 (the site, reprojected — part 6) to assert THIS rail.
// The rail it replaces — eight seats, and the founder's 2026-08-25 rulings
// that shaped it — is in this file's history. What carries over is every LAW
// those rulings produced, each still asserted below:
//
//   1. A READ PER PAGE — every entry resolves to a route that exists.
//   2. A PAGE PER READ — every entry that owns a page is claimed `active` by
//      that page, or says why not in the structure (`noActive`).
//   3. THE FIRST CHIP IS THE AGGREGATE — every row leads with the section's
//      own landing. Not escapable.
//   and: one chip row per page; no member declares a second row; no two-faced
//   seat; no key used twice; the Town's chips wear icons as decoration; a
//   flagged chip may wait for a page only while its flag is off; every old
//   URL still answers.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { RAIL, allEntries, sectionOf, chipsFor, subChipsFor, rowFor, HARBOR, navFlags } from "../src/lib/nav.mjs";

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
 *  own document (a redirect stub, the World's spectator shell). */
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

// ── THE SHAPE ────────────────────────────────────────────────────────────────

test("SIX SEATS, the door's nouns, in the design's order", () => {
  assert.deepEqual(RAIL.map((s) => s.label),
    ["Postmark", "The Town", "Ferry’s Daily", "The World", "The Households", "The Record", "Join"],
    `the rail reads: ${RAIL.map((s) => s.label).join(" · ")}`);
  assert.deepEqual(RAIL.map((s) => s.href), ["/", "/town/", "/daily/", "/world/", "/households/", "/records/", "/join/"]);
  // Join keeps its lantern (Keemin, 2026-07-31: a newcomer must find Join
  // without hunting), and no seat is external — the harbor is a chip now.
  assert.equal(RAIL.find((s) => s.key === "join").lantern, true, "Join lost its lantern");
  assert.equal(RAIL.some((s) => s.external), false, "a top-rail seat leaves the site");
});

test("each seat's row, in the design's words and order", () => {
  const row = (k) => chipsFor(k).chips.map((c) => c.label);
  assert.deepEqual(row("town"), ["the civic quarter", "the meeps", "the bulletin"],
    "The Town's row (what's on waits behind its flag)");
  assert.deepEqual(row("world"), ["the living map", "conversations", "replay", "the atlas", "the harbor · beyond the water"]);
  assert.deepEqual(row("households"), ["the houses", "every resident"]);
  assert.deepEqual(row("record"), ["the record", "the mail", "the crossings", "the works", "stamps", "the numbers", "the repos"]);
  assert.equal(chipsFor("postmark"), null, "the front door grew a row");
  assert.equal(chipsFor("join"), null, "the Join door grew a row");
  // with the flag on, what's on stands between the meeps and the bulletin
  assert.deepEqual(chipsFor("town", { flags: navFlags({ PUBLIC_NAV_WHATS_ON: "1" }) }).chips.map((c) => c.key),
    ["town", "meeps", "calendar", "bulletin"]);
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

test("every chip row leads with its own aggregate — the seat's own landing", () => {
  for (const s of RAIL) {
    if (!s.members) continue;
    assert.equal(s.members[0].href, s.href, `${s.key}'s seat and its first chip disagree about where the section starts`);
    assert.equal(s.members[0].key, s.key, `${s.key}'s row leads with "${s.members[0].key}", not the section itself`);
  }
});

// ── the laws that carried over ───────────────────────────────────────────────

test("no key is used twice — a duplicate silently steals the other's highlight", () => {
  const seen = new Map();
  for (const e of allEntries()) {
    // a section's first chip shares the seat's key by rule 3; that is one entry, not two
    if (e.depth === 1 && e.key === e.section) continue;
    const where = `${e.section}/${e.key}`;
    assert.equal(seen.has(e.key), false, `"${e.key}" is used by ${seen.get(e.key)} and ${where}`);
    seen.set(e.key, where);
  }
});

test("NO MEMBER DECLARES A SECOND ROW — one chip row per page, never the section's AND the room's", () => {
  const withRows = [];
  for (const s of RAIL) for (const m of s.members ?? []) if (m.chips) withRows.push(`${s.key}/${m.key}`);
  assert.deepEqual(withRows, [], `these rooms declare a row of their own:\n  ${withRows.join("\n  ")}`);
  for (const key of ["town", "meeps", "bulletin", "atlas", "residents", "households", "mail", "stamps", "crossings", ""]) {
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

test("LITTLE ICONS FOR THE TOWN'S CHIPS — decoration, never the name", () => {
  //   "I'd like little icons for the town's chips"  — the founder, 2026-08-25
  const town = RAIL.find((s) => s.key === "town").members;
  assert.deepEqual(town.filter((c) => !c.icon).map((c) => c.label), [], "a Town chip has no icon");
  assert.equal(new Set(town.map((c) => c.icon)).size, town.length, "two Town chips share a glyph");
  const chipRow = readFileSync(join(ROOT, "src", "components", "ChipRow.astro"), "utf8");
  assert.match(chipRow, /class="pm-chip-icon" aria-hidden="true"/, "the icon would be read aloud beside its label");
  for (const s of RAIL) assert.equal(s.icon, undefined, `the ${s.label} seat grew an icon; only chips wear them`);
});

// ── every page finds its seat ────────────────────────────────────────────────

test("a page anywhere in a family finds its section, so the seat lights up", () => {
  const cases = {
    postmark: "postmark",
    town: "town", meeps: "town", bulletin: "town", votes: "town", calendar: "town",
    daily: "daily",
    world: "world", conversations: "world", replay: "world", atlas: "world", harbor: "world", birthday: "world",
    households: "households", household: "households", residents: "households",
    record: "record", mail: "record", crossings: "record", works: "record", stamps: "record", numbers: "record", repos: "record",
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

// ── the moves this rail made, each with its old URL still answering ──────────

test("FERRY’S DAILY IS A SEAT OF ITS OWN (Keemin 2026-09-25: a staple; \"return Ferry's daily to the top rail\")", () => {
  const seat = RAIL.find((e) => e.key === "daily");
  assert.ok(seat, "the Daily has no seat on the top rail");
  assert.equal(seat.href, "/daily/");
  assert.equal(seat.members, undefined, "the Daily's seat grew a row — the page is the whole seat");
  assert.equal(chipsFor("town").chips.some((c) => c.key === "daily"), false, "the Daily is still a chip on the Town's row as well");
  const file = pageFileFor("/daily/");
  assert.ok(file, "/daily/ was deleted");
  assert.equal(activeKeyOf(file), "daily", "the Daily lights its own seat");
  assert.equal(sectionOf("daily")?.key, "daily");
  const meeps = readFileSync(pageFileFor("/meeps/"), "utf8");
  assert.match(meeps, /href="\/daily\/"/, "the Post Office card still opens the Daily — the redundancy is the point");
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

test("THE HOUSEHOLDS — the houses first, every resident second, and a house's own page lights the seat", () => {
  const seat = RAIL.find((s) => s.key === "households");
  assert.equal(seat.alsoKey, "household");
  assert.equal(activeKeyOf(pageFileFor("/households/")), "households");
  assert.equal(activeKeyOf(join(PAGES, "households", "[slug].astro")), "household");
  assert.equal(activeKeyOf(pageFileFor("/residents/")), "residents");
  assert.equal(activeKeyOf(join(PAGES, "residents", "[handle].astro")), "residents");
  // /window/ answers to its room, `residents`, and so lights The Households
  assert.equal(activeKeyOf(pageFileFor("/window/")), "residents");
  assert.equal(RAIL.some((s) => s.key === "residents"), false, "Residents is still a seat");
  // a house of one draws the seat's row; a shared house draws its own and none from the nav
  assert.equal(rowFor("household").of.key, "households");
  assert.equal(rowFor("household", { ownChips: true }), null);
});

test("THE RECORD gathers what lasts; its pages answer to their own chips", () => {
  const record = RAIL.find((s) => s.key === "record");
  assert.deepEqual(record.members.map((m) => m.key), ["record", "mail", "crossings", "works", "stamps", "numbers", "repos"]);
  assert.equal(record.members.find((m) => m.key === "stamps").beta, true, "Stamps lost its beta mark");
  for (const [href, key] of [["/records/", "record"], ["/mail/", "mail"], ["/records/crossings/", "crossings"], ["/works/", "works"], ["/stamps/", "stamps"], ["/numbers/", "numbers"], ["/records/repos/", "repos"]]) {
    assert.equal(activeKeyOf(pageFileFor(href)), key, `${href} does not claim "${key}"`);
  }
  // the mail's rooms answer to `mail` and draw The Record's row
  for (const href of ["/mail/returned/", "/mail/compose/"]) {
    assert.equal(activeKeyOf(pageFileFor(href)), "mail");
  }
  assert.equal(rowFor("mail").of.key, "record");
});

test("EVERY OLD URL STILL ANSWERS — nothing was deleted by the reprojection", () => {
  // the eight-seat rail's every destination, and the rooms under it
  for (const href of [
    "/", "/town/", "/daily/", "/bulletin/", "/works/", "/meeps/", "/numbers/", "/votes/",
    "/world/", "/replay/", "/conversations/", "/atlas/",
    "/mail/", "/mail/returned/", "/mail/compose/", "/residents/", "/window/", "/stamps/", "/join/",
  ]) {
    if (href === "/world/") { assert.ok(existsSync(join(PAGES, "world.astro")), "/world/ lost its shell"); continue; }
    assert.ok(pageFileFor(href), `${href} no longer answers`);
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

test("/town/ IS NOT A DASHBOARD — the quarter first, no cards restating the chips", () => {
  const src = readFileSync(join(PAGES, "town", "index.astro"), "utf8");
  assert.equal(/\bfrom "@\/lib\/nav\.mjs"/.test(src), false, "/town/ reads the rail to restate its own row as cards");
  assert.ok(src.includes('<section class="cq"'), "the civic quarter is gone from /town/");
  assert.equal(rowFor("town").chips[0].key, "town");
});

// ── the nav flags (part 2) ───────────────────────────────────────────────────

test("WHAT'S ON WAITS FOR ITS PAGE — flagged, off by default, and cannot render while off", () => {
  // "a chip to a 404 is worse than no chip: build the chip behind a flag the
  //  layout reads, default off, and say so."          — the brief, part 2
  assert.deepEqual(navFlags({}), { whatsOn: false });
  assert.deepEqual(navFlags(undefined), { whatsOn: false });
  assert.equal(navFlags({ PUBLIC_NAV_WHATS_ON: "0" }).whatsOn, false);
  assert.equal(navFlags({ PUBLIC_NAV_WHATS_ON: "1" }).whatsOn, true);
  const chip = RAIL.find((s) => s.key === "town").members.find((m) => m.key === "calendar");
  assert.equal(chip.label, "what’s on");
  assert.equal(chip.href, "/calendar/");
  assert.equal(chip.flag, "whatsOn");
  for (const active of ["town", "bulletin", "meeps", "votes"]) {
    assert.equal(rowFor(active).chips.some((c) => c.key === "calendar"), false, `what's on renders on ${active} with its flag off`);
  }
  const shell = readFileSync(join(ROOT, "src", "layouts", "PostmarkLayout.astro"), "utf8");
  assert.match(shell, /rowFor\(active, \{ ownChips, flags: navFlags\(import\.meta\.env\) \}\)/);
});

test("a flag is an escape for a page NOT HERE YET, never for one that is", () => {
  for (const e of allEntries().filter((x) => x.flag)) {
    assert.ok((e.waits ?? "").trim().length >= 20, `${e.key} is flagged with no reason on file`);
    assert.equal(navFlags({})[e.flag], false, `${e.key}'s flag is on by default`);
  }
});

// ── THE BUILT SITE (skipped until built, as POS-177 rules) ───────────────────

const DIST = join(ROOT, "dist-town");
const builtPage = (href) => join(DIST, ...href.split("/").filter(Boolean), "index.html");

test("the built rail is the six seats, on every page that wears the layout", { skip: !existsSync(builtPage("/")) }, () => {
  const seats = (href) => {
    const s = readFileSync(builtPage(href), "utf8");
    const i = s.indexOf('class="pm-townnav-links"');
    const nav = s.slice(i, s.indexOf("</nav>", i));
    return [...nav.matchAll(/<a\b[^>]*>([^<]*)/g)].map((m) => m[1].trim());
  };
  for (const href of ["/", "/town/", "/meeps/", "/households/", "/residents/", "/records/", "/mail/", "/daily/"]) {
    assert.deepEqual(seats(href), ["Postmark", "The Town", "Ferry’s Daily", "The World", "The Households", "The Record", "Join"], `${href}'s built rail`);
  }
});

test("every old path still builds", { skip: !existsSync(builtPage("/")) }, () => {
  for (const href of [
    "/town/", "/daily/", "/bulletin/", "/works/", "/meeps/", "/numbers/", "/votes/",
    "/replay/", "/conversations/", "/atlas/",
    "/mail/", "/mail/returned/", "/mail/compose/", "/residents/", "/window/", "/stamps/", "/join/",
    "/households/", "/records/", "/records/crossings/", "/records/repos/",
  ]) {
    assert.ok(existsSync(builtPage(href)), `${href} did not build`);
  }
});

test("the routes that came back from a fold are real pages, not stubs", () => {
  // /bulletin/, /window/ and /meeps/ were all redirect stubs pointing INTO a
  // scroller before the 2026-08-25 chip wave gave them their content back. A
  // stub still passes rule 1 (the file exists); this names them, because a
  // silent re-fold is exactly what took a year to find last time. /daily/
  // joins them now that it has left the rail (part 6).
  for (const [key, href] of [["bulletin", "/bulletin/"], ["residents", "/window/"], ["meeps", "/meeps/"], ["daily", "/daily/"]]) {
    const file = pageFileFor(href);
    assert.ok(file, `${href} has no page`);
    assert.equal(activeKeyOf(file), key, `${href} does not claim "${key}" — it has folded into a stub`);
    assert.equal(/http-equiv="refresh"/.test(readFileSync(file, "utf8")), false, `${href} is a redirect again`);
  }
});

test("A SHARED HOUSE'S PAGE TAKES NO ROW FROM THE NAV — its own member rail is the row", () => {
  // The Households has a row now, so /households/<slug>/ (which lights it by
  // `alsoKey`) must hand the layout the same `ownChips` predicate the resident
  // pages do — or a shared house shows the nav's row stacked over its own.
  for (const file of [join(PAGES, "households", "[slug].astro"), join(PAGES, "residents", "[handle].astro")]) {
    assert.match(layoutTagOf(file), /\bownChips=\{isShared\(house, members\)\}/, `${file.slice(PAGES.length + 1)} does not pass ownChips`);
  }
});

test("the built page of a shared house carries one chip row, its own", { skip: !existsSync(builtPage("/households/starforge/")) }, () => {
  const page = readFileSync(builtPage("/households/starforge/"), "utf8");
  assert.equal((page.match(/class="pm-chiprow pm-chiprow--nav/g) ?? []).length, 0, "the nav's row stacks over Starforge's own member rail");
});
