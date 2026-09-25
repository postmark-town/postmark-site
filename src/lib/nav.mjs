// nav.mjs — THE RAIL'S SINGLE SOURCE.
//
//   THE LAW: a page per read, a read per page; this structure is the rail's
//   single source.
//
// The header used to be nav-by-accretion: a hand-kept array in the layout that
// nobody had to keep honest. That is how /votes/ came to exist as a complete
// 172-line ballot page reachable only by typing the URL — built, shipped, and
// in no nav array at all for its whole life (found by the 2026-08-25 IA
// inventory). The gap was never a missing page. It was that nothing bound the
// header to the reads.
//
// So the membership lives HERE, in one exported structure, and `test/nav.test.mjs`
// asserts against it: every entry resolves to a route that exists (a rail
// pointing at a 404 fails the suite), and every entry that owns a page is
// marked `active` by that page (a section member that can never light up is the
// ballot's failure again, one step quieter). An entry that genuinely cannot
// satisfy the second rule declares WHY, in the data, next to itself — an
// undeclared miss still fails.
//
// This is the derived-nav law implemented lightly. Full derivation from the
// MCP's own serving tables — so a new read APPEARS in the rail rather than
// waiting to be remembered — is a later wave. This is the step that makes the
// remembering checkable.
//
// ── THE SHAPE: CHIPS, NOT A STRIP (founder's ruling, 2026-08-25 evening) ─────
//
// The site already solved its own IA once, in miniature, and nobody noticed:
// `/households/<slug>/` wears a row of chips where the FIRST chip is the
// AGGREGATE — "Household", the house's own bare read — and each member is a
// chip that swaps the view. No scroller, no menu; a row you take in at a
// glance. The founder walked dev on the trinity rail, saw the household page,
// and ruled that pattern to be the whole site's shape.
//
// So: every section is a chip-shaped surface, and the section's first chip is
// the read the seat itself leads to. The World's first chip is the living map.
// The Town's first chip is Ferry's Daily. A section whose seat and whose first
// chip disagree is a section with no aggregate, and the first-chip law in the
// test says so out loud.
//
// THE ROW IS ONE ROW DEEP AND IT IS THE SECTION'S — founder, 2026-08-25: "no
// subpage removes the town level subrail and replaces with its own." The chip
// wave briefly let a member carry a `chips:` row of its own, so a reader inside
// /residents/ or /mail/compose/ saw three chips where The Town's row had been
// and lost every neighbouring room at once. `subChipsFor` still exists and
// still obeys the first-is-the-aggregate law, but nothing in The Town declares
// a second row any more; a sub-page tells the layout its ROOM's key instead, so
// it draws the section's row with its own room lit.
//
// ── WHAT THE TOP RAIL IS FOR (founder's ruling, 2026-08-25 night) ───────────
//
// The chip wave pulled Residents, The Mail and Stamps down into The Town on a
// structural argument: they are rooms of the town, so they belong in the town's
// row. The founder overruled it on a reader's argument, and the reader's
// argument wins:
//
//   "I actually think Residents and the Mail and Stamps deserve to be lifted
//    back to the top rail. because the site is for humans, and for humans, the
//    residents and the mail are important to get across what postmark is all
//    about, and Stamps are... well, important to keeping Postmark going. the
//    Town can keep ferry's daily, the bulletin, the ballot, and the works. and
//    we can put the meeps back in town too"
//
// So the top rail is NOT a taxonomy of the site. It is the answer to "what is
// this place", given to a human in eight words or fewer — which is why the
// residents and the mail sit at the top even though the town contains them, and
// why the ballot and the works do not even though they are no less real. A
// structural sort produces the first rail; this is the second, and the
// difference between them is the whole point.
//
// ── AND THE ORDER IS THE OLD ORDER (founder, same sitting, ruled separately) ──
//
//   "note that the top rail order should just be what it was before, with
//    Ferry's Daily replaced with The Town."
//
// The rail that stood before the trinity re-org, verbatim from the hand-kept
// array it replaced (`PostmarkLayout.astro` at 1e215c3a4~1):
//
//   Postmark · Ferry's Daily · The World · The Mail · Harbor · Residents ·
//   The Works · Stamps · Join
//
// Apply his substitution and the ruling resolves itself, with one seat falling
// out for a reason he had already given in the same sitting: The Works lives in
// The Town's row now ("the Town can keep ferry's daily, the bulletin, the
// ballot, and the works"), so it is not a top-rail seat to re-order. That
// leaves:
//
//   Postmark · The Town · The World · The Mail · Harbor · Residents · Stamps ·
//   Join
//
// Note what this ruling is NOT. It is not "put the world back ahead of the
// town" — the substitution puts The Town exactly where Ferry's Daily stood,
// which is still ahead of The World, so his earlier "the town comes before the
// world" survives untouched and is still asserted on its own.
//
// The lane that lifted the three seats had ordered them by an argument of its
// own — the three lifted seats grouped together after The Town — and that was
// an ASSUMPTION, flagged as one, and he answered it. Worth keeping in view:
// the old order was not arbitrary, and going back to it recovered the
// Harbor-beside-the-Mail adjacency whose reason was written down in the rail
// this file replaced. An order picked on purpose carries reasons that a re-sort
// silently spends.
//
// THE THREE LIFTED SEATS CARRY NO CHIP ROW, and that is what exists rather than
// a choice to keep rows short. Their families were emptied by the founder's own
// earlier rulings, in the same week: the windows and the meeps came off
// Residents, returned-to-sender and write-a-letter came off The Mail, and
// /fund/<pot> is quiet-launch by design and says so in its own file ("reachable,
// and NOT in the nav"). What is left in each is the one read the seat already
// leads to, and a row of one chip is the site explaining its own seat back to
// itself — the exact chrome the founder has now cut three times. A row appears
// here the moment a second read joins one of these families; nothing needs
// changing but the `members` array.
//
// EVERY CHIP IS A REAL ROUTE. Not a tab widget: the row is shared chrome drawn
// over real Astro pages, so deep links in letters keep working, the page-per-
// read law stays checkable, and the static build stays static. Where a chip
// needed a page that had been folded into a scroller, the page came BACK to its
// own canonical URL (/bulletin/, /window/, /meeps/) and its redirect stub was
// deleted rather than a new URL invented.

// The Harbor is neutral ground BETWEEN towns and stands on its own flag:
// 1f4ee.town, the codepoint of 📮 U+1F4EE POSTBOX. Absolute from every page,
// including the harbor's own, because there is no root-relative spelling that
// is right from both domains.
export const HARBOR = "https://1f4ee.town/";

/**
 * The rail, top level down. `href` is joined to the layout's `origin` prefix at
 * render time unless `external` — a page served from another domain keeps its
 * chrome pointing back at the town.
 *
 * Per entry:
 *   key       the `active` value a page passes to PostmarkLayout
 *   label     what the rail says
 *   href      root-relative (or absolute, with `external`)
 *   beta      wears the hollow "beta" chip — still cooking, and the rail says so
 *   members   the section's chip row, in reading order; the FIRST is the section's
 *             own aggregate read and must be the seat's own landing
 *   alsoKey   a SECOND key this seat answers to, for a page in its family that
 *             names itself something else (see Residents / the household page)
 *
 * Per member, additionally:
 *   held      built, routable, deliberately NOT surfaced yet — with the reason
 *   noActive  this member cannot set `active` on a page of its own; the string
 *             is the reason, and the test reads it rather than a bare exemption
 *   chips     the member's OWN chip row — a page that would otherwise scroll,
 *             split into real routes. Same first-is-the-aggregate law.
 *   icon      a small glyph before the label — decoration, never the name. The
 *             label alone still says what the chip is; `aria-hidden` in the row.
 *   flag      the chip hangs only when this NAV FLAG is on (see `navFlags`
 *             below) — for a chip whose page is built on another branch and
 *             has not landed here. A chip to a 404 is worse than no chip.
 *   waits     with `flag`: what the chip is waiting for, in a sentence. The
 *             suite lets a flagged chip's page be missing only while its flag
 *             is off by default and this reason is on file.
 */

/**
 * THE NAV FLAGS, read from the build's environment and nowhere else.
 *
 * `whatsOn` — the Town's "what's on" chip and the bulletin's "What's on → the
 * calendar" line. The calendar page is built on `feature/calendar` (site #131 +
 * #132) and has not landed on this branch; until it does, both stay off. Turn
 * them on with PUBLIC_NAV_WHATS_ON=1 at build, or delete the flag the day the
 * calendar merges (the site, reprojected — part 2).
 *
 * Default OFF, and the default is asserted: an unset environment is the dev and
 * prod build today.
 */
export function navFlags(env = {}) {
  return { whatsOn: env?.PUBLIC_NAV_WHATS_ON === "1" };
}

export const RAIL = [
  // ── THE RAIL, REPROJECTED (the site, reprojected — part 6, 2026-09-25) ──────
  //
  // Six seats, the door's own nouns, in the design's order:
  //
  //   Postmark · The Town · The World · The Households · The Record · Join
  //
  // THE DESIGN, G:/Starstory/docs/2026-09-25/design-notes/the-site-reprojected.md:
  // "Six seats, the door's nouns … Nothing deleted." The rail it replaces had
  // eight seats mixing five kinds (two places, a record, a currency, a foreign
  // pier, a directory) and a reader could not tell from the rail what was a
  // place and what was a ledger. Every page it pointed at still answers at the
  // URL it had; what moved is only which seat lights above it:
  //
  //   Ferry's Daily  → inside the Meeps' Post Office card; /daily/ stays a page
  //                    and lights the meeps chip (it is the Post Office's window)
  //   the works, the numbers, the mail, stamps → The Record (part 5)
  //   Harbor         → a chip of The World, "beyond the water"
  //   Residents      → The Households, as its "every resident" chip
  //
  // The rulings behind the rail this replaces (the founder's 2026-08-25 chip
  // wave, the lift of Residents / the Mail / Stamps, the Town's own list) are
  // recorded in this file's git history and in test/nav.test.mjs's history;
  // the LAWS they produced — a page per read, the aggregate first, one row per
  // page, no two-faced seat, icons as decoration — are unchanged and still
  // asserted.
  { key: "postmark", label: "Postmark", href: "/" },

  // THE TOWN — the civic quarter, the meeps, what's on, the bulletin.
  // `votes` answers here because the Ballot House is a building of the quarter.
  {
    key: "town",
    label: "The Town",
    href: "/town/",
    alsoKey: "votes",
    members: [
      { key: "town", label: "the civic quarter", href: "/town/", icon: "⌂" },
      { key: "meeps", label: "the meeps", href: "/meeps/", icon: "⁂" },
      // FERRY’S DAILY IS BACK (Keemin, 2026-09-25: "add Ferry’s Daily back to the top
      // rail (redundant). I think it’s enough of a staple that it’s worth it") —
      // redundant with the Post Office card on /meeps/, and kept on purpose.
      { key: "daily", label: "ferry’s daily", href: "/daily/", icon: "▤" },
      // WHAT'S ON (part 2): the calendar is built on feature/calendar and has not
      // landed here, so the chip waits behind a nav flag, default off. Same key,
      // href, icon as feature/calendar's own chip, so the two lines meet.
      { key: "calendar", label: "what’s on", href: "/calendar/", icon: "◷",
        flag: "whatsOn",
        waits: "the calendar page is built on feature/calendar (site #131 + #132) and has not landed on this branch" },
      { key: "bulletin", label: "the bulletin", href: "/bulletin/", icon: "⚑" },
    ],
  },

  // THE WORLD — the living map, conversations, replay, the atlas, and the
  // harbor: the town's far shore, "beyond the water". The harbor is served at
  // its own domain (1f4ee.town) by its own layout, so its chip keeps the
  // absolute URL and can never be lit by a page of this site.
  {
    key: "world",
    label: "The World",
    href: "/world/",
    noActive: "the spectator shell renders its own document, not PostmarkLayout",
    // /world/birthday/ — the guests' programme, deliberately unannounced: it
    // lights the seat and no chip (see the birthday page's own header).
    alsoKey: "birthday",
    members: [
      { key: "world", label: "the living map", href: "/world/", noActive: "the spectator shell renders its own document, not PostmarkLayout" },
      { key: "conversations", label: "conversations", href: "/conversations/" },
      { key: "replay", label: "replay", href: "/replay/" },
      { key: "atlas", label: "the atlas", href: "/atlas/" },
      { key: "harbor", label: "the harbor · beyond the water", href: HARBOR, external: true, beta: true,
        noActive: "the harbor is served from its own domain by HarborLayout, not PostmarkLayout" },
    ],
  },

  // THE HOUSEHOLDS — the unit (part 4: the directory of houses, each holding its
  // residents' cards). Its row leads with its own landing, the houses, then
  // every resident — the grid people love, unchanged at /residents/.
  // `household` is the key /households/<slug>/ answers to, so a reader deep in
  // a house sees this seat lit; /window/ answers to `residents`.
  {
    key: "households",
    label: "The Households",
    href: "/households/",
    alsoKey: "household",
    members: [
      { key: "households", label: "the houses", href: "/households/", icon: "⌂" },
      { key: "residents", label: "every resident", href: "/residents/", icon: "✉" },
    ],
  },

  // THE RECORD — what lasts, in one place (part 5).
  {
    key: "record",
    label: "The Record",
    href: "/records/",
    members: [
      { key: "record", label: "the record", href: "/records/", icon: "❡" },
      { key: "mail", label: "the mail", href: "/mail/", icon: "✉" },
      { key: "crossings", label: "the crossings", href: "/records/crossings/", icon: "⛴" },
      { key: "works", label: "the works", href: "/works/", icon: "⚒" },
      // Stamps keeps the beta mark it wore as a seat — ONE door, wearing the
      // beta chip, is the law test/civic-hub.test.mjs holds.
      { key: "stamps", label: "stamps", href: "/stamps/", icon: "✦", beta: true },
      { key: "numbers", label: "the numbers", href: "/numbers/", icon: "▦" },
      { key: "repos", label: "the repos", href: "/records/repos/", icon: "⌥" },
    ],
  },

  // JOIN — the lantern-lit door, one face for every reader (the signed-in
  // "Your House" face was retired 2026-08-25: "the resident names when signed
  // in more than suffice").
  { key: "join", label: "Join", href: "/join/", lantern: true },
];

/** Every entry in the rail, in every chip row, at every depth, flat. */
export function allEntries() {
  const out = [];
  for (const s of RAIL) {
    out.push({ ...s, section: s.key, depth: 0 });
    for (const m of s.members ?? []) {
      out.push({ ...m, section: s.key, depth: 1 });
      for (const c of m.chips ?? []) {
        // a member's first chip IS the member (the landing), so it is already
        // counted above; listing it twice would double-count the key
        if (c.key === m.key) continue;
        out.push({ ...c, section: s.key, member: m.key, depth: 2 });
      }
    }
  }
  return out;
}

/** The section a page belongs to, by its `active` key — or null for an orphan. */
export function sectionOf(active) {
  if (!active) return null;
  return RAIL.find((s) =>
    s.key === active ||
    s.alsoKey === active ||
    (s.members ?? []).some((m) => m.key === active || (m.chips ?? []).some((c) => c.key === active))
  ) ?? null;
}

/** The section's chip row for this page, or null. Held chips never render;
 *  a flagged chip renders only when its flag is on. */
export function chipsFor(active, { flags = {} } = {}) {
  const s = sectionOf(active);
  if (!s || !s.members) return null;
  return { of: s, chips: s.members.filter((m) => !m.held && (!m.flag || flags[m.flag] === true)) };
}

/**
 * The page-level chip row for this page, or null — the second row, drawn by a
 * member that split rather than scrolled. Returned with the member it belongs
 * to, because the row's kicker names the member, not the section.
 */
export function subChipsFor(active) {
  const s = sectionOf(active);
  if (!s) return null;
  for (const m of s.members ?? []) {
    if (!m.chips) continue;
    if (m.key === active || m.chips.some((c) => c.key === active)) {
      return { of: m, chips: m.chips.filter((c) => !c.held) };
    }
  }
  return null;
}

/**
 * THE ONE ROW a page draws — and it is one, or none, never two.
 *
 * The chip wave shipped `chipsFor` and `subChipsFor` as two rows stacked, and
 * the founder walked into the result: the top rail, then the section's chips,
 * then the room's chips, three bands of chrome before the first word. "We
 * somehow managed to INCREASE the complexity of the site."
 *
 * So the rows compete instead of stacking, and the MOST SPECIFIC one wins: a
 * reader inside a room sees that room's parts, and the way back up to the
 * section is the top rail's own seat. `ownChips` is the third case — a page
 * that already draws a chip row of its own (the shared household's member rail)
 * takes none from the nav at all. That was the founder's Your House rule, and
 * it outlived the seat: the household page is a chip world already, whichever
 * seat happens to light above it.
 *
 * This lives here rather than in the layout so the suite can assert the real
 * decision instead of a copy of it that agrees today.
 */
export function rowFor(active, { ownChips = false, flags = {} } = {}) {
  if (ownChips) return null;
  const room = subChipsFor(active);
  if (room) return { ...room, place: "page" };
  const section = chipsFor(active, { flags });
  if (section) return { ...section, place: "section" };
  return null;
}
