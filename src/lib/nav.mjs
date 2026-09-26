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
 *   alsoKeys  more keys this seat answers to, for pages in its family that name
 *             themselves something else (a house, a resident's page, the ballot)
 *
 * Per member, additionally:
 *   held      built, routable, deliberately NOT surfaced yet — with the reason
 *   noActive  this member cannot set `active` on a page of its own; the string
 *             is the reason, and the test reads it rather than a bare exemption
 *   chips     the member's OWN chip row — a page that would otherwise scroll,
 *             split into real routes. Same first-is-the-aggregate law.
 *   icon      the name of the chip's pixel-art picture in src/lib/pixel-icons.mjs
 *             — decoration, never the name. The label alone still says what the
 *             chip is; `aria-hidden` in the row.
 *   alsoKeys  more keys that light THIS chip: pages that live inside the room
 *             without being its landing (the calendar and the Daily, on the
 *             Bulletin's board)
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
 * `whatsOn` — the bulletin's "What's on → the calendar" line. It was also the
 * Town's "what's on" chip until the Site Lift (POS-249) took the calendar off
 * the chip row onto the Bulletin's board; the chip is gone, and the flag now
 * governs only the bulletin page's sentence, which is the Bulletin issue's to
 * retire. Turn it on with PUBLIC_NAV_WHATS_ON=1 at build.
 *
 * Default OFF, and the default is asserted: an unset environment is the dev and
 * prod build today.
 */
export function navFlags(env = {}) {
  return { whatsOn: env?.PUBLIC_NAV_WHATS_ON === "1" };
}

export const RAIL = [
  // ── THE RAIL, LIFTED (the Site Lift, POS-249, 2026-09-26) ──────────────────
  //
  // Seven seats, Keemin's two passes over the revamp (recorded on POS-244):
  //
  //   Postmark · The Town · The World · The Mail · The Households · Docs · Join
  //
  // "Fewer rails." What moved, and where every old URL now lands (MOVED, below):
  //
  //   The Record     dissolves: the settlements go into the replay (POS-255),
  //                  the Works becomes The Projects (reached from the civic
  //                  quarter, and lighting it), stamps, the numbers and the
  //                  repos start the Docs, and the Mail is a seat again
  //   Residents      gives its page to The Households (/residents/ forwards)
  //   Ferry's Daily  and the calendar leave the chips; they live on the
  //                  Bulletin's board, so their pages light the Bulletin
  //
  // The laws the earlier rails produced — a page per read, the aggregate first,
  // one row per page, no two-faced seat, icons as decoration — are unchanged
  // and still asserted in test/nav.test.mjs. The rulings behind the rails
  // before this one are in this file's history.
  { key: "postmark", label: "Postmark", href: "/" },

  // THE TOWN — "the Bulletin, the Civic Quarter, the Meeps", in that order
  // (Keemin, 2026-09-26: the bulletin first, "the most important"). The first
  // chip is the aggregate, so the seat opens the Bulletin. Its board carries
  // the calendar and Ferry's Daily, so those pages light the Bulletin chip
  // (`alsoKeys`). THE PROJECTS light the civic quarter's chip and have none of
  // their own (Wright's ruling on POS-249, 2026-09-26): Keemin named the blurred
  // boundary between the Works and the quarter, a project is where a drawn idea
  // or an answered bounty gets built, and the quarter's page links it beside
  // them. `votes` answers here because the Ballot House is a building of the
  // quarter.
  {
    key: "town",
    label: "The Town",
    href: "/bulletin/",
    alsoKeys: ["votes"],
    members: [
      { key: "bulletin", label: "the bulletin", href: "/bulletin/", icon: "bulletin",
        alsoKeys: ["calendar", "daily"] },
      { key: "town", label: "the civic quarter", href: "/town/", icon: "quarter",
        alsoKeys: ["projects"] },
      { key: "meeps", label: "the meeps", href: "/meeps/", icon: "meeps" },
    ],
  },

  // THE WORLD — the living map, conversations, replay (where the settlements
  // live now, POS-255), the atlas, and the harbor: the town's far shore,
  // "beyond the water". The harbor is served at its own domain (1f4ee.town) by
  // its own layout, so its chip keeps the absolute URL and can never be lit by
  // a page of this site.
  {
    key: "world",
    label: "The World",
    href: "/world/",
    noActive: "the spectator shell renders its own document, not PostmarkLayout",
    // /world/birthday/ — the guests' programme, deliberately unannounced: it
    // lights the seat and no chip (see the birthday page's own header).
    alsoKeys: ["birthday"],
    members: [
      { key: "world", label: "the living map", href: "/world/", icon: "map",
        noActive: "the spectator shell renders its own document, not PostmarkLayout" },
      { key: "conversations", label: "conversations", href: "/conversations/", icon: "talk" },
      { key: "replay", label: "replay", href: "/replay/", icon: "replay" },
      { key: "atlas", label: "the atlas", href: "/atlas/", icon: "atlas" },
      { key: "harbor", label: "the harbor · beyond the water", href: HARBOR, external: true, beta: true, icon: "anchor",
        noActive: "the harbor is served from its own domain by HarborLayout, not PostmarkLayout" },
    ],
  },

  // THE MAIL — back on the top rail (Keemin, 2026-09-26: "The Mail goes back
  // on the top rail"). No row: its rooms (a thread, returned, compose) answer
  // to `mail` and light the seat.
  { key: "mail", label: "The Mail", href: "/mail/" },

  // THE HOUSEHOLDS — the unit, in Residents' place ("the best version retires
  // the Residents page"). No row: with /residents/ forwarding here, the one
  // read left is the seat's own, and a row of one chip is the site explaining
  // its own seat back to itself. `household` is the key /households/<slug>/
  // answers to; `residents` is what a resident's page and /window/ answer to.
  { key: "households", label: "The Households", href: "/households/", alsoKeys: ["household", "residents"] },

  // DOCS — what explains the town ("Docs" is the working name until Keemin
  // names it). The stamps, the numbers and the repos start it (Keemin: "the
  // start of the Docs or Guides"). Docs are guides; what residents build is
  // The Projects, which lives with the civic quarter (above).
  {
    key: "docs",
    label: "Docs",
    href: "/docs/",
    members: [
      { key: "docs", label: "the docs", href: "/docs/", icon: "docs" },
      // Stamps keeps the beta mark it has worn as a seat and as a chip — ONE
      // door, wearing the beta chip, is the law test/civic-hub.test.mjs holds.
      { key: "stamps", label: "stamps", href: "/docs/stamps/", icon: "stamp", beta: true },
      { key: "numbers", label: "the numbers", href: "/docs/numbers/", icon: "numbers" },
      { key: "repos", label: "the repos", href: "/docs/repos/", icon: "repos" },
    ],
  },

  // JOIN — the lantern-lit door, one face for every reader (the signed-in
  // "Your House" face was retired 2026-08-25: "the resident names when signed
  // in more than suffice").
  { key: "join", label: "Join", href: "/join/", lantern: true },
];

/**
 * EVERY MOVED URL, in ONE table: old path → where it lives now.
 *
 * A path is an API for readers the repo cannot reach — letters, the Daily, the
 * office's own replies link these — so a move never deletes an address; it
 * forwards it. `town/pages/[...moved].astro` builds one forwarding page per
 * row, and the forward CARRIES THE FRAGMENT: letters link /stamps/#board and
 * /stamps/#earning, and a meta-refresh redirect (what Astro's `redirects`
 * config writes) drops everything after the `#`. A target with a fragment of
 * its own keeps its own.
 *
 * Exact paths only: /residents/<handle>/ is a resident's page and stays; only
 * the directory at /residents/ moved. /board/ and /works/ are also public asset
 * prefixes, and a page at the bare path leaves the files beneath it serving.
 */
export const MOVED = {
  // the Site Lift (POS-249)
  "/residents/": "/households/",
  "/works/": "/projects/",
  "/records/": "/replay/",
  "/records/crossings/": "/replay/",
  "/records/repos/": "/docs/repos/",
  "/stamps/": "/docs/stamps/",
  "/numbers/": "/docs/numbers/",
  // older moves, re-aimed at where their content lives now rather than chained
  // through a second hop
  "/archive/": "/projects/",          // v1's Town Archive, folded into the Works
  "/board/": "/town/#board",          // the Bounty Board, folded into the quarter
  "/stamps/guide/": "/docs/stamps/",  // the Guide, the teaching's own page
};

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

/** Does this entry answer to the key — its own, or one of its `alsoKeys`? */
export function answersTo(entry, active) {
  return entry.key === active || (entry.alsoKeys ?? []).includes(active);
}

/** The section a page belongs to, by its `active` key — or null for an orphan. */
export function sectionOf(active) {
  if (!active) return null;
  return RAIL.find((s) =>
    answersTo(s, active) ||
    (s.members ?? []).some((m) => answersTo(m, active) || (m.chips ?? []).some((c) => c.key === active))
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
