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
  // The root stops squatting the town-apex's name (Keemin, 2026-08-25). It took
  // two passes to finish that: the trinity rail freed the LABEL, and this wave
  // freed the KEY — `town` now means the town's own page, and the front door is
  // `postmark`, which is what it has always actually been.
  { key: "postmark", label: "Postmark", href: "/" },

  // THE TOWN — the town apex and its reads. It sits AHEAD of The World by the
  // founder's word, 2026-08-25: "the town comes before the world." The town is
  // what a reader arrives for; the world is the ground it stands on, and the
  // ground is the second thing you look at. Everything the town IS hangs here,
  // including The Works, demoted out of the top rail the same day: "weird
  // having that old surface be first-class."
  //
  // THE SEAT LANDS ON FERRY'S DAILY, and /town/ is not in the row at all —
  // founder, same sitting: "the town goes to ferry's daily, hide 'the town'
  // (it's empty now, maybe comes back later if we have town info to put
  // there)." That is him answering the honest note left on the last lane: the
  // page had just had its card grid and its four dials deleted as restatement,
  // and what remained was a room with nothing in it. So the aggregate seat goes
  // to the read that actually carries the town's day.
  //
  // The first-chip law is NOT bent by this — it is satisfied one rung down. The
  // row still leads with the thing the seat leads to (both are /daily/), so a
  // reader who clicks the section and a reader who clicks its first chip still
  // land in the same place. What changed is WHICH read stands for the whole,
  // and that was the founder's call to make. `/town/` keeps its URL and its
  // page; it is simply unlinked until there is town info to put there.
  // THE ROW IS THE FOUNDER'S OWN LIST, in the order he said it: "the Town can
  // keep ferry's daily, the bulletin, the ballot, and the works. and we can put
  // the meeps back in town too." Residents, the mail and stamps left for the
  // top rail in the same sentence. The meeps came BACK — struck from the
  // residents row earlier the same day, and restored here, which is why the
  // struck-chips test now holds three and names the fourth's return.
  //
  // AND THE CHIPS WEAR LITTLE ICONS — "I'd like little icons for the town's
  // chips." Text-presentation glyphs, not colour emoji, because the town
  // already has an icon vocabulary and it is monochrome: ✉ in the townmark, ✦
  // on the Join door, ✉ and ❖ on the Meeps' own cards. Extending that costs
  // nothing and holds the parchment; a row of colour emoji would be a second
  // vocabulary arriving in the chrome. They are decoration only — the label
  // still carries the name, and `ChipRow` hides them from the accessibility
  // tree.
  {
    key: "town",
    label: "The Town",
    // THE SEAT COMES BACK TO /town/, and the earlier ruling is the rung this
    // one stands on rather than a mistake being scrubbed. On 2026-08-25 the
    // founder moved this seat to Ferry's Daily and hid 'the town' — with the
    // condition written into his own sentence: "it's empty now, MAYBE COMES
    // BACK LATER IF WE HAVE TOWN INFO TO PUT THERE."
    //
    // That condition has fired. /town/ is the civic quarter now: five buildings,
    // the town's asks and its residents', the whole of what the town wants from
    // anyone. It is no longer an empty room, so the seat lands on it again and
    // the row leads with it — which is also what the aggregate-first law has
    // always demanded of every other section.
    href: "/town/",
    // /votes/ lost its chip to the quarter (below) but still marks itself
    // `active="votes"`, and a page that lights no seat is the exact condition
    // this whole file was written because of. The Ballot House is a room of the
    // town reached through the quarter, so the town's seat answers for it.
    alsoKey: "votes",
    members: [
      // CHIP ONE IS THE QUARTER — founder-ruled 2026-08-30 evening: the civic
      // quarter is the town's default face. It carries the section's own key,
      // the same shape The World's row uses for its map, so standing on /town/
      // lights both the seat and this chip.
      { key: "town", label: "the civic quarter", href: "/town/", icon: "⌂" },
      // ▤ U+25A4 — a page of ruled type, which is what a daily is. It is NOT
      // the first glyph tried: ☼ U+263C reads "white sun with rays" in a code
      // editor and renders as a SETTINGS COG in the browser, which the suite
      // could never have caught (it was green on "has an icon" and on "the
      // icons are distinct" while the chip said settings). Photographed at
      // 40px before choosing — see `G:/Wright-HQ/rail3-glyph-probe.mjs`, which
      // also disqualified ⚓ and ✍: both render as COLOUR emoji here, which is
      // the whole thing this row is built to avoid.
      { key: "daily", label: "ferry’s daily", href: "/daily/", icon: "▤" },
      // THE BULLETIN. It came back to /bulletin/ in the chip wave — it had been
      // folded into the Daily as an anchor, which made it a chip that could
      // never light up, and `town.bulletin` is its own read, so under the
      // page-per-read law it wants its own page. Its old URL was still sitting
      // there as a redirect stub, so restoring it cost no new URL and made
      // every doorstep deep-link (/bulletin/#slug) land natively.
      //
      // It was called "the notice board" everywhere the site spoke and
      // `bulletin` everywhere the machine did. Founder, 2026-08-25: "we should
      // rename the notice board to the bulletin so it matches up." So the read
      // has ONE name now, and it is the name the MCP door already answered to
      // (`town read:"bulletin"`) — the site moved to the machine's word rather
      // than the other way, because that word is the one in the URL, the key,
      // the frontmatter and every letter's deep link.
      { key: "bulletin", label: "the bulletin", href: "/bulletin/", icon: "⚑" },
      // WHAT'S ON (the site, reprojected — part 2): the calendar, beside the
      // bulletin, which no longer carries the town's happenings. Same key, href,
      // icon and seat as feature/calendar's own chip (POS-211), so the day that
      // branch merges the two lines meet in one place; the label is the design's.
      { key: "calendar", label: "what’s on", href: "/calendar/", icon: "◷",
        flag: "whatsOn",
        waits: "the calendar page is built on feature/calendar (site #131 + #132) and has not landed on this branch" },
      // THE BALLOT AND THE BOUNTY BOARD LEFT THIS ROW, founder-ruled
      // 2026-08-30 evening: both are buildings of the civic quarter now, and
      // the quarter's chip is directly above. A chip row that lists the whole
      // and two of its five parts is the card-grid mistake in miniature — the
      // reader is offered three doors into one page and cannot tell that two of
      // them are inside the first.
      //
      // THE PAGES BOTH STAY at the URLs they have. /votes/ is still the live
      // Ballot Box and the Ballot House lane opens its door; the board is still
      // /town/#board and /board/ still redirects there. Nothing is unreachable;
      // what is gone is a chip repeating a room the quarter already draws.
      //
      // `votes` had a key in this row and now has none, so /votes/ needs a seat
      // to light: it claims `town` below, which is true — it is a room of the
      // town, reached through the quarter.
      // The Works — the collaboration layer's front door, deliberately
      // backburnered on its own prerequisites (founder correction, 2026-08-25:
      // this is PROJECTS, the resident collaborative builds, NOT the Keeping
      // Works). Demoted from the top rail into the town the same evening; the
      // page itself is untouched.
      // THE WORKS AND THE NUMBERS LEFT THIS ROW for The Record (the site,
      // reprojected — part 5): both are the record's instruments, not places
      // in the town. Their pages did not move.
      // THE MEEPS, RETURNED. Struck from the residents row hours earlier the
      // same evening ("remove 'the windows' and 'the meeps' from residents/"),
      // and put back by the founder's own hand once residents left the town:
      // "we can put the meeps back in town too." The page never moved; what
      // changed is that /meeps/ answers to its own name again instead of
      // borrowing `residents`, which it had to do only while it was a room of
      // a section that has now gone up a level.
      { key: "meeps", label: "the meeps", href: "/meeps/", icon: "⁂" },
    ],
  },

  // NO SECOND ROW ANYWHERE IN THE TOWN — founder, 2026-08-25: "no subpage
  // removes the town level subrail and replaces with its own." Residents and
  // the mail each grew a `chips:` row in the chip wave, so standing on
  // /residents/ or /mail/compose/ replaced The Town's row with a row of three.
  // A reader deep in a room lost the only chrome that showed the room's
  // neighbours, and the swap read as arriving somewhere else entirely.
  //
  // Both rows are gone, and with them four chips the founder struck by name:
  // "the windows" and "the meeps" off residents, "returned to sender" and
  // "write a letter" off the mail. THE PAGES ALL STAY at the URLs they have —
  // /window/, /meeps/, /mail/returned/, /mail/compose/.
  //
  // THREE OF THE FOUR ARE STILL STRUCK; the meeps came back the same night, one
  // level up ("we can put the meeps back in town too"), and is a chip of The
  // Town above with its own key. The other three go on answering to their
  // ROOM's key — /window/ to `residents`, the two mail rooms to `mail` — which
  // now lights a TOP-RAIL SEAT rather than a chip, because those two rooms went
  // up with the founder's lift. The ruling is unchanged and its visible effect
  // moved with the rail: a reader deep inside the mail sees The Mail lit above
  // them, and no row that pretends to be somewhere else.
  //
  // /mail/returned/ and /mail/compose/ keep a door on the mail's own page,
  // which is where the write-a-letter button always lived. /window/ has NO
  // inbound link left anywhere on the site. That is the /votes/ condition this
  // whole file exists because of, and it is recorded here rather than quietly
  // fixed, because re-siting the window street is a shape call and nobody has
  // made it — raised with the founder a second time on 2026-08-25 and still
  // unanswered. (`test/nav.test.mjs` holds these pages to the seat they must
  // light; it cannot hold a page to a link nobody wrote.)

  // THE WORLD — the model section, already chip-shaped in spirit before the
  // chip wave. Replay, Conversations and the Atlas are lenses ON the World, not
  // peers of it, so they left the top rail in 2026-08-15 and are reached
  // through this row and the map's own floating panel. /world/ keeps its own
  // side rail until the cockpit wave.
  {
    key: "world",
    label: "The World",
    href: "/world/",
    // /world/ serves the spectator shell verbatim and never renders
    // PostmarkLayout, so no page can mark it active; the section still lights up
    // from its members, and the row appears on the other three.
    noActive: "the spectator shell renders its own document, not PostmarkLayout",
    // /world/birthday/ — the guests' programme for the dungeon, a page in this
    // family that is NOT a chip. It takes `alsoKey` rather than a fifth member
    // for one reason: a chip would ANNOUNCE it, and the dungeon is deliberately
    // unannounced (the office's own spec: "Branch-only. Nothing here is merged,
    // deployed, or announced"). This way a reader who arrives by link sees The
    // World lit and the section's row under it, and nobody who did not arrive by
    // link is told the room exists. Promoting it to a member is one line, the
    // day the founder wants it public.
    //
    // It also stops the page lighting the wrong chip: with `active="world"` the
    // row lit "the living map" while the reader stood on a different page —
    // and that chip is `noActive`, so this page would have been the only thing
    // ever lighting it. A key of its own lights the seat and no chip, which is
    // the truth.
    alsoKey: "birthday",
    members: [
      { key: "world", label: "the living map", href: "/world/", noActive: "the spectator shell renders its own document, not PostmarkLayout" },
      { key: "replay", label: "replay", href: "/replay/" },
      { key: "conversations", label: "conversations", href: "/conversations/" },
      { key: "atlas", label: "the atlas", href: "/atlas/" },
    ],
  },

  // THE MAIL — lifted with Residents, same sentence, same reason. Its family is
  // /mail/<thread>/, /mail/with/<pair>/ and the two rooms the founder struck
  // from its row by name (returned to sender, write a letter). All four claim
  // `mail`, so they light this seat; none is a chip, by his ruling.
  //
  // THE RECORD (the site, reprojected — part 5) takes the Mail's seat and gathers
  // what lasts into one place: "We refuse to hide. The record is public." The
  // mail, the crossings (every settlement, new), the works, stamps, the numbers
  // and the repos. Its own landing, /records/, is the aggregate every row leads
  // with; the mail's family (/mail/<thread>/, /mail/with/<pair>/, the two rooms)
  // still claims `mail`, which is a chip here now, so a reader deep in the mail
  // sees The Record lit and the mail chip lit under it. The Mail and Stamps
  // seats are gone from the top rail; every page keeps its URL.
  {
    key: "record",
    label: "The Record",
    href: "/records/",
    members: [
      { key: "record", label: "the record", href: "/records/", icon: "❡" },
      { key: "mail", label: "the mail", href: "/mail/", icon: "✉" },
      { key: "crossings", label: "the crossings", href: "/records/crossings/", icon: "⛴" },
      { key: "works", label: "the works", href: "/works/", icon: "⚒" },
      // Stamps wore a "beta" chip as a seat; a chip row carries no beta mark, so
      // the page's own head says what is still cooking.
      { key: "stamps", label: "stamps", href: "/stamps/", icon: "✦" },
      { key: "numbers", label: "the numbers", href: "/numbers/", icon: "▦" },
      { key: "repos", label: "the repos", href: "/records/repos/", icon: "⌥" },
    ],
  },

  // The Harbor is the mail's outward half — the towns Postmark connects, and
  // what crosses between them. It stays top-level as a future apex of its own.
  //
  // AND IT SITS BESIDE THE MAIL AGAIN, which is the quiet dividend of restoring
  // the old order. The rail this replaced had these two adjacent for a reason
  // written down at the time — "the Harbor sits next to the Mail because it IS
  // the mail's outward half" — and the trinity re-org separated them without
  // ever deciding to. Going back to the order that was picked on purpose
  // recovered a rationale nobody had noticed was lost.
  { key: "harbor", label: "Harbor", href: HARBOR, external: true, beta: true },

  // RESIDENTS — lifted back to the top rail, "because the site is for humans,
  // and for humans, the residents and the mail are important to get across what
  // postmark is all about" (founder, 2026-08-25).
  //
  // No chip row: the windows and the meeps were struck from it earlier the same
  // day and the meeps has now gone to The Town, so the family is the directory
  // itself plus every resident's own page — and those are content, not chrome.
  //
  // `alsoKey` is what is left of the retired Your House seat, and it is the half
  // worth keeping. /households/<slug>/ answers to `household`, which is no
  // seat's key; before this it was rescued by the Your House seat's second key,
  // and with that seat gone the page would light nothing at all — a reader deep
  // in a house, with the whole rail dark. A household is a household OF
  // residents, so this is where it belongs now that there is a Residents seat
  // to belong to.
  { key: "residents", label: "Residents", href: "/residents/", alsoKey: "household" },

  // STAMPS — "and Stamps are... well, important to keeping Postmark going."
  // Keeps the beta chip it wore as a member: the honesty marker survives the
  // promotion, which is exactly what it nearly failed to do when it was demoted.
  // /fund/<pot> is NOT in this seat's family by design — it is quiet-launch and
  // says so in its own header ("reachable, and NOT in the nav"), so a chip row
  // here would publish the money surface the town deliberately has not
  // published. Flagged rather than built.
  // RE-AIMED 2026-08-30, and only the DESTINATION moved. The founder's ruling
  // was about the page, not the rail: The Town absorbed Stamps, so everything
  // stamps now lives in the hub's rules lane. The seat keeps its name, its
  // capital S, its beta chip and its place in the order — what changed is that
  // it opens the lane rather than a page that is now a forwarder. Pointing a
  // top-rail seat at a forwarder would spend a visible redirect flash on every
  // reader who clicks it, and the redirect exists for links the repo CANNOT
  // reach; this one it can.
  //
  // RESOLVED 2026-08-30 evening: the seat STAYS, and it points at /stamps/
  // again. The tee was whether a Stamps seat still made sense once Stamps was a
  // fold of The Town; the founder answered it by making /stamps/ a real page
  // again — the teaching, leading with the questions — so the seat has its own
  // room to open and lights normally. The `noActive` escape it wore for one
  // afternoon is gone with the reason for it.
  // (THE STAMPS SEAT moved into The Record as its `stamps` chip — the site,
  // reprojected, part 5. /stamps/ is the same page at the same URL.)

  // JOIN — the lantern-lit door, and ONE face now.
  //
  // This seat spent two waves as Your House: one seat with two faces, the
  // signed-out Join door and a signed-in link to the reader's own household,
  // resolved in the layout from the declared-household registry. The founder
  // retired the signed-in half:
  //
  //   "Your House is actually not necessary; the resident names when signed in
  //    more than suffice"
  //
  // He is describing something already on the page. The header's auth pill
  // prints every handle the reader holds, each one a link to that resident's
  // own window — the same house the seat led to, reached by the reader's own
  // name rather than by a generic word. The seat was a second door to a place
  // there was already a better-labelled door to, and it cost the rail's most
  // valuable property: a seat whose destination changes under you is a seat
  // that cannot be read at a glance. So: `signedInLabel`, `signedOutLabel`,
  // `houseHref` and `houseKey` are gone, with the layout's registry import, its
  // paint script and the two-faced markup. What remains is the door a newcomer
  // needs, in the state the static build has always shipped.
  //
  // THE LANTERN STAYS. It is a separate standing ruling from a different
  // sitting (Keemin, 2026-07-31 — the newcomer's eye must find Join without
  // hunting), and nothing tonight touched it; a rename that quietly took the
  // glow with it would be answering a question nobody asked.
  //
  // The household page's key did NOT go with the seat — see `alsoKey` on
  // Residents above for where it went and why it could not simply be dropped.
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
