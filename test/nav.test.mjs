// nav.test.mjs — the rail is held to its own law.
//
//   node --test test/nav.test.mjs
//
// THE LAW, verbatim from `src/lib/nav.mjs`:
//
//   "a page per read, a read per page; this structure is the rail's single source"
//
// /votes/ was a complete ballot page that lived its whole life in no nav array.
// Nothing caught it because nothing was watching: the header was a hand-kept
// list and a hand-kept list has no failure mode. These are the watchers.
//
//   1. A READ PER PAGE — every entry resolves to a route that exists. A rail
//      pointing at a 404 fails here.
//   2. A PAGE PER READ — every entry that owns a page is marked `active` by
//      that page, so the seat can actually light up. An entry that renders but
//      can never highlight is the ballot's silence again, one step quieter.
//   3. THE FIRST CHIP IS THE AGGREGATE — new with the chip wave. Every row's
//      first chip is the thing the row is OF: the section's own bare read, the
//      member's own page. A row whose first chip is one of its peers is a row
//      with no whole, which is the defect the founder actually named when he
//      walked the site on 2026-08-25 — The Town landed on Ferry's Daily, so the
//      town had no page of its own and nobody had noticed for a year.
//
// Rules 1 and 2 are escapable, and escaping costs a sentence: an entry declares
// `noActive: "<why>"` or `held: "<why>"` in the structure itself, next to
// itself, where the next reader meets it. An UNDECLARED miss still fails —
// which is the whole difference between this and the array it replaces. Rule 3
// is NOT escapable: a row without an aggregate is the thing this wave exists to
// remove, so there is no reason string that buys it.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { RAIL, allEntries, sectionOf, chipsFor, subChipsFor, rowFor, HARBOR, navFlags } from "../src/lib/nav.mjs";

/** A flagged chip whose page has not landed on this branch, and says so: its
 *  flag is OFF by default and its `waits` reason is on file. The only chip the
 *  route laws let point at a page that is not here yet — see the flags' own
 *  test below for why that is safe (the chip cannot render while it waits). */
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

// The `active` key a page claims is the one it passes to POSTMARKLAYOUT, and
// only that one.
//
// This used to scan the whole file for any `active=`, which was true enough
// until a page could contain a second component that also takes an `active`
// prop. Then `<PageChips active="compose" />` sitting in the body was enough to
// make the file "claim" compose while the layout was told `mail` — and the
// can-fail flip on this suite passed green with the defect installed. A probe
// that cannot fail on the thing it names is not a probe, so it reads the
// opening layout tag now and nothing else.
//
// A key legitimately has SEVERAL claimants — /residents/, a resident's own
// page, a rendition and a household all tell the layout `residents`, because
// they are all that room — so this is a key → set, and the sharp question below
// is whether a chip's own target is among them. A page that renders its own
// document instead of the layout (a redirect stub, the World's shell) claims
// nothing, which is exactly right: it is not a chip's page.
const CLAIMED = new Map();   // key -> Set of page files claiming it

/** The opening <PostmarkLayout …> tag of a page file, or null if it renders its
 *  own document (a redirect stub, the World's spectator shell). */
function layoutTagOf(file) {
  return /<PostmarkLayout\b[^>]*>/s.exec(readFileSync(file, "utf8"))?.[0] ?? null;
}

/** The `active` key THIS page hands the layout — read from the opening tag and
 *  nowhere else, for the reason in the comment above. "" when it claims none. */
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

// ── rule 1: a read per page ──────────────────────────────────────────────────

test("every chip, at every depth, resolves to a route that exists", () => {
  for (const e of allEntries()) {
    if (e.external) {
      assert.match(e.href, /^https:\/\//, `${e.key}: an external seat needs an absolute URL`);
      continue;
    }
    if (waitsForItsPage(e) && !pageFileFor(e.href)) continue;
    assert.ok(pageFileFor(e.href), `${e.section}/${e.key} points at ${e.href}, which no page serves`);
  }
});

// (The "a held entry is still a real route" test stood here while The Numbers
// was the last held seat; it asked to be deleted with the last one, and the
// numbers chip hung 2026-09-03 when the S4 hold's own condition was met. If a
// seat is ever held again, bring it back: held ⇒ page exists ∧ reason ≥ 20 chars.)

// ── rule 2: a page per read ──────────────────────────────────────────────────

test("every chip that owns a page is marked active by that page, or says why not", () => {
  const orphans = [];
  for (const e of allEntries()) {
    if (e.external) continue;
    if (e.noActive) {
      assert.ok((e.noActive ?? "").trim().length >= 20, `${e.key} escapes the law with no reason on file`);
      continue;
    }
    if (waitsForItsPage(e) && !pageFileFor(e.href)) continue;
    if (!CLAIMED.has(e.key)) orphans.push(`${e.section}/${e.key} (${e.href})`);
  }
  assert.deepEqual(orphans, [], `these chips can never light up — no page passes their key as \`active\`:\n  ${orphans.join("\n  ")}`);
});

test("THE OTHER DIRECTION — every chip's route claims that chip's own key", () => {
  // Rule 2 asks "does SOME page claim this key". This asks the sharper
  // question: does the page the chip POINTS AT claim it. Both were true by
  // accident before the chip wave, and then /mail/compose/ arrived in a row
  // while still claiming `mail` — a chip pointing at a page that answers to a
  // sibling's name, which lights the wrong chip on arrival and is invisible to
  // every other check here.
  const wrong = [];
  for (const e of allEntries()) {
    if (e.external || e.noActive) continue;
    // A SECTION SEAT IS EXEMPT WHEN IT HAS A ROW, because its landing belongs
    // to its first chip, not to itself: The Town's seat points at /daily/,
    // whose page rightly answers to `daily` (founder, 2026-08-25 — "the town
    // goes to ferry's daily"). Nothing is lost by the exemption — rule 3 above
    // pins the seat's href to its first chip's, and that chip is checked here
    // by its own key one line down. The defect this test exists for is a CHIP
    // pointing at a page that answers to a sibling's name, and every chip is
    // still checked.
    if (e.depth === 0 && e.members) continue;
    const file = pageFileFor(e.href);
    if (!file) continue;                       // rule 1 owns that failure
    if (!CLAIMED.get(e.key)?.has(file)) {
      wrong.push(`${e.section}/${e.key} → ${e.href}, whose page answers to some other name`);
    }
  }
  assert.deepEqual(wrong, [], `a chip and its page disagree about the chip's name:\n  ${wrong.join("\n  ")}`);
});

test("THE BALLOT, by name — the page this law exists because of", () => {
  // Not a redundant case. This is the one the old array got wrong, and a
  // refactor that quietly drops the votes entry should cost a named failure,
  // not a silently shorter list.
  // RE-AIMED 2026-08-30 evening, and this test's own warning is why it is
  // re-aimed rather than deleted: "a refactor that quietly drops the votes
  // entry should cost a named failure, not a silently shorter list." It cost
  // exactly that, and here is the named change.
  //
  // The founder made the Ballot House a building of the civic quarter and
  // struck the ballot chip from The Town's row, because a row that lists the
  // whole and two of its five parts offers three doors into one page. What
  // this test has always protected is NOT the chip — it is that /votes/ is
  // reachable and that the page is never left lighting nothing. Both still bind.
  assert.ok(pageFileFor("/votes/"), "the ballot page left the site");
  assert.ok(CLAIMED.has("votes"), "/votes/ does not mark itself active — the page is there and dark");
  assert.ok(sectionOf("votes"), "/votes/ lights no seat — the exact condition this file exists for");
  assert.equal(sectionOf("votes").key, "town",
    "the Ballot House is a room of the town, reached through the quarter, so the town's seat answers for it");

  // AND THE DOOR IS STILL DRAWN, one level in: the quarter's Ballot House lane
  // opens /votes/, so removing the chip removed a repetition and not a route.
  const hub = readFileSync(join(PAGES, "town", "index.astro"), "utf8");
  assert.ok(hub.includes('href="/votes/"'),
    "nothing on the hub opens the Ballot Box — the chip went and took the only door with it");
});

// ── rule 3: the first chip is the aggregate ──────────────────────────────────

test("every chip row leads with its own aggregate, at both depths", () => {
  // The founder's ruling in one assertion. A row's first chip must BE the thing
  // the row belongs to — same key, same href — so a reader who clicks the row's
  // owner and a reader who clicks its first chip land in the same place.
  //
  // THE ASSERTION IS THE HREF, and that changed on 2026-08-25 when the founder
  // moved The Town's seat to Ferry's Daily. It used to also demand that the
  // first chip's KEY equal the section's — true while every section's aggregate
  // happened to be named after the section, and a proxy for the real rule
  // rather than the rule. What the reader is owed is that the two doors lead to
  // the same room; whether the room carries the section's name is a different
  // claim, and one the founder is free to answer either way. A row leading with
  // a peer still fails here, which is what this test is for.
  for (const s of RAIL) {
    if (!s.members) continue;
    const first = s.members[0];
    assert.equal(first.href, s.href,
      `${s.key}'s seat and its first chip disagree about where the section starts`);
    for (const m of s.members) {
      if (!m.chips) continue;
      const sub = m.chips[0];
      assert.equal(sub.key, m.key,
        `${s.key}/${m.key}'s page row leads with "${sub.key}" — a room's own row must lead with the room`);
      assert.equal(sub.href, m.href,
        `${s.key}/${m.key}'s page row starts somewhere other than the page it belongs to`);
    }
  }
});

test("THE TOWN COMES BACK TO ITS OWN PAGE — the 2026-08-25 hold, released", () => {
  //   "the town goes to ferry's daily, hide 'the town' (it's empty now, maybe
  //    comes back later if we have town info to put there)"
  //                                              — the founder, 2026-08-25
  //
  // This REPLACES the assertion that the seat lands on /town/. That rule was
  // written the same day, from the same founder, and it was right about the
  // law and wrong about which read satisfies it: a section needs an aggregate,
  // but /town/ had its card grid and its dials deleted as restatement and what
  // was left was an empty room. He moved the seat rather than fill it. Both
  // states are recorded here on purpose — the earlier ruling is not a mistake
  // to be scrubbed, it is the rung this one stands on.
  // THE CONDITION WAS IN HIS OWN SENTENCE, and it has now fired. He hid the
  // page because "it's EMPTY NOW, maybe comes back later IF WE HAVE TOWN INFO
  // TO PUT THERE." On 2026-08-30 the civic quarter landed on it: five
  // buildings, the town's asks and its residents', the whole of what the town
  // wants from anyone. It is not an empty room any more, so the hold released
  // and the seat came home.
  //
  // BOTH STATES STAY RECORDED. The 2026-08-25 ruling is not a mistake being
  // scrubbed — it was right about the law (a section needs a real aggregate)
  // and it is the rung this one stands on.
  const town = RAIL.find((s) => s.key === "town");
  assert.ok(town, "The Town left the rail");
  assert.equal(town.href, "/town/", "The Town's seat no longer lands on its own page");
  assert.equal(town.members[0].key, "town", "the row does not lead with the read the seat leads to");
  assert.equal(town.members[0].href, "/town/");

  // AND IT IS VISIBLE AGAIN, which is the half that inverted: the page that
  // had to be out of every rendered row at every depth is now the row's first
  // chip. What must NOT come back is the emptiness — so this asserts the page
  // has the quarter on it, not merely that it is linked.
  assert.ok(chipsFor("town").chips.some((c) => c.href === "/town/"),
    "'the town' is missing from The Town's own row");
  const hubSrc = readFileSync(join(PAGES, "town", "index.astro"), "utf8");
  assert.ok(hubSrc.includes('<section class="cq"'),
    "the seat came back to a page with no civic quarter on it — that is the empty room again");

  // and the page KEEPS ITS URL — "maybe comes back later" is a page waiting,
  // not a page deleted, so a lane that tidies it away should go red here.
  assert.ok(pageFileFor("/town/"), "/town/ was deleted; the founder said hide it, not remove it");
  assert.ok(CLAIMED.has("town"), "/town/ stopped claiming its own key");
});

test("THE TOWN COMES BEFORE THE WORLD", () => {
  //   "the town comes before the world"          — the founder, 2026-08-25
  //
  // Order is the whole assertion. The seats' membership is checked elsewhere;
  // this is only about which of the two a reader's eye reaches first.
  const keys = RAIL.map((s) => s.key);
  assert.ok(keys.indexOf("town") < keys.indexOf("world"),
    `the world came back before the town: ${RAIL.map((s) => s.label).join(" · ")}`);
});

// ── the shape ────────────────────────────────────────────────────────────────

test("THE TOP RAIL IS FOR HUMANS — Residents, the Mail and Stamps are lifted back onto it", () => {
  //   "I actually think Residents and the Mail and Stamps deserve to be lifted
  //    back to the top rail. because the site is for humans, and for humans, the
  //    residents and the mail are important to get across what postmark is all
  //    about, and Stamps are... well, important to keeping Postmark going."
  //                                              — the founder, 2026-08-25
  //
  // BOTH STATES, on purpose. The chip wave had pulled these three DOWN into The
  // Town — Postmark · The Town · The World · Harbor · Join, five seats, and a
  // test right here asserting five as "the founder's ruling". That ruling was
  // real and is superseded by this one from the same founder eight hours later,
  // so the earlier shape is recorded rather than scrubbed: the argument for
  // pulling them down was structural (they are rooms of the town) and the
  // argument for lifting them back is a reader's (they are what the town IS).
  // The reader's argument wins, and that is the transferable part.
  // MEMBERSHIP is this test's claim; ORDER is ruled separately and asserted in
  // its own test below, so a re-order cannot pass by agreeing with only half of
  // either ruling.
  // AMENDED 2026-09-25 (the site, reprojected — part 5): The Mail and Stamps went into The Record,
  // the seat that gathers what lasts; Residents keeps its seat. The founder's
  // reader's-argument survives the move: both are one click from the top rail,
  // under a seat whose name says what they are.
  assert.deepEqual([...RAIL.map((s) => s.key)].sort(),
    ["harbor", "join", "postmark", "record", "residents", "town", "world"],
    `the rail reads: ${RAIL.map((s) => s.label).join(" · ")}`);

  // the three by name, each a SEAT and no longer a chip of The Town.
  //
  // STAMPS' DESTINATION MOVED 2026-08-30 and its seat did not: the founder
  // ruled The Town absorbs Stamps, so the seat opens the hub's rules lane
  // instead of a page that is now a forwarder. What this test claims — that the
  // three are SEATS, with these names, each lighting its own key — is untouched.
  const town = RAIL.find((s) => s.key === "town");
  const residents = RAIL.find((s) => s.key === "residents");
  assert.ok(residents, "Residents is not on the top rail");
  assert.equal(residents.href, "/residents/");
  assert.equal(sectionOf("residents").key, "residents");
  // the mail and stamps: chips of The Record, never of The Town, at their URLs
  const record = RAIL.find((s) => s.key === "record");
  for (const [key, href] of [["mail", "/mail/"], ["stamps", "/stamps/"]]) {
    assert.equal(RAIL.some((s) => s.key === key), false, `${key} is still a top-rail seat`);
    assert.equal(record.members.find((m) => m.key === key)?.href, href, `${key} is not a chip of The Record`);
    assert.equal(town.members.some((m) => m.key === key), false, `${key} is a chip of The Town`);
    assert.equal(sectionOf(key).key, "record", `a page in ${key} lights another seat`);
  }
  // THE BETA MARKER IS A DECIDED LOSS, not a dropped one: a chip row carries
  // no beta mark, and the stamps page's own head says what is still cooking.
  assert.equal(record.members.find((m) => m.key === "stamps").beta, undefined);

  // and the rest genuinely IS carried below — seats naming nothing else would
  // pass the list and fail the reader
  assert.ok(allEntries().length > RAIL.length + 4, "the sections carry almost nothing; the chip rows are empty");
});

test("THE ORDER IS THE OLD ORDER, with Ferry's Daily replaced by The Town", () => {
  //   "note that the top rail order should just be what it was before, with
  //    Ferry's Daily replaced with The Town."
  //                                              — the founder, 2026-08-25
  //
  // The rail before the trinity re-org, read off the hand-kept array this file's
  // subject replaced (`PostmarkLayout.astro` at 1e215c3a4~1) rather than off
  // anyone's memory of it:
  //
  //   Postmark · Ferry's Daily · The World · The Mail · Harbor · Residents ·
  //   The Works · Stamps · Join
  //
  // Substitute, and drop The Works because he had already put it inside The
  // Town's row in the same sitting. That is the whole derivation, and it is
  // written here because the ORDER of a rail is the one property with no
  // internal logic to re-derive it from — get it wrong and everything still
  // resolves, every seat still lights, and only the founder can tell.
  // AMENDED 2026-09-25 (the site, reprojected — part 5): The Record stands where The Mail
  // stood; Stamps left the rail into it. The full six-seat order is part 6's.
  assert.deepEqual(RAIL.map((s) => s.key),
    ["postmark", "town", "world", "record", "harbor", "residents", "join"],
    `the rail reads: ${RAIL.map((s) => s.label).join(" · ")}`);

  // THE SUBSTITUTION, stated as itself: whatever stands second is The Town.
  //
  // AMENDED 2026-08-30: it used to lead to Ferry's Daily, because /town/ was an
  // empty room and the Daily was the town's real aggregate. The civic quarter
  // filled the room, so the seat leads to /town/ again — the SEAT's position in
  // the order, which is what this test is actually about, never moved.
  assert.equal(RAIL[1].key, "town", "the second seat is no longer The Town");
  assert.equal(RAIL[1].href, "/town/",
    "The Town's seat no longer lands on the civic quarter");

  // and The Works is not a seat, because it is a chip (his own earlier ruling,
  // and the reason the old rail's ninth entry has no successor here)
  assert.equal(RAIL.some((s) => s.key === "works"), false,
    "The Works came back to the top rail; it lives in a chip row");

  // THE HARBOR IS BESIDE THE MAIL AGAIN. The old rail put them adjacent with the
  // reason written next to them — "the Harbor sits next to the Mail because it
  // IS the mail's outward half" — and the re-org separated them without ever
  // deciding to. Asserted so a future re-sort has to break it on purpose.
  // (AMENDED 2026-09-25 (the site, reprojected — part 5): the Harbor stays beside the seat that
  // now holds the mail.)
  const keys = RAIL.map((s) => s.key);
  assert.equal(keys.indexOf("harbor") - keys.indexOf("record"), 1,
    "the Harbor left the mail's side; the old rail had them adjacent for a stated reason");
});

test("THE TOWN KEEPS THE FOUNDER'S OWN LIST, and the meeps is back in it", () => {
  //   "the Town can keep ferry's daily, the bulletin, the ballot, and the works.
  //    and we can put the meeps back in town too"
  //                                              — the founder, 2026-08-25
  //
  // His list, in his order, and the meeps appended where he appended it. The
  // Numbers is the one entry not in that sentence: it was HELD (empty until the
  // S4 emission, 2026-08-21) and joined the row 2026-09-03 when the page read
  // live dials — the assertion below is over what a reader actually SEES.
  const town = RAIL.find((s) => s.key === "town");
  // THE BOUNTY BOARD joined the row 2026-08-26 at the founder's word ("we need
  // the Bounty Board in The Town -- still no direct link there") -- a deep link
  // into the stamps portal's board block, seated between the ballot and the
  // works: asks, then builds.
  // AMENDED 2026-08-30 evening, twice over and both by the founder's word:
  //   · the civic quarter LEADS the row ("the town's default face"), which is
  //     also what the aggregate-first law has always demanded of every section;
  //   · the ballot and the bounty board LEAVE it — both are buildings of the
  //     quarter now, and listing the whole beside two of its parts is the
  //     card-grid mistake in miniature.
  // His 2026-08-25 list is still underneath: ferry's daily, the bulletin, the
  // works, and the meeps he appended. What changed is what wraps it.
  // AMENDED 2026-09-25 (the site, reprojected — part 5): the works and the numbers moved to The
  // Record — the record's instruments, not places in the town.
  assert.deepEqual(chipsFor("town").chips.map((c) => c.key),
    ["town", "daily", "bulletin", "meeps"],
    `The Town's row reads: ${chipsFor("town").chips.map((c) => c.label).join(" · ")}`);
  const record = RAIL.find((s) => s.key === "record");
  assert.equal(record.members.some((m) => m.key === "numbers" && !m.held), true,
    "the numbers chip does not hang in The Record");

  // THE MEEPS RETURNED, and its page answers to its own name again. It had been
  // struck from the residents row hours earlier and borrowed `residents` while
  // it was a room of a section; that section is a seat now, so the borrowing
  // would light the wrong thing.
  const meeps = town.members.find((m) => m.key === "meeps");
  assert.ok(meeps, "the meeps did not come back to The Town");
  assert.equal(meeps.href, "/meeps/");
  assert.equal(activeKeyOf(pageFileFor("/meeps/")), "meeps",
    "/meeps/ still borrows another room's key — it lights that room instead of itself");
  assert.equal(sectionOf("meeps").key, "town");
});

test("The Works is a chip, not a seat — in The Record since part 5", () => {
  // Demoted 2026-08-25: "weird having that old surface be first-class". The
  // page is untouched; only its seat moved. AMENDED 2026-09-25 (the site, reprojected — part 5): 
  // from The Town's row to The Record's.
  assert.equal(RAIL.some((s) => s.key === "works"), false, "The Works climbed back onto the top rail");
  assert.equal(sectionOf("works")?.key, "record");
  assert.ok(pageFileFor("/works/"), "The Works was demoted into a 404");
});

test("YOUR HOUSE IS GONE — one seat, one face, and the way home is the reader's own name", () => {
  //   "Your House is actually not necessary; the resident names when signed in
  //    more than suffice"                        — the founder, 2026-08-25
  //
  // BOTH STATES, again. The seat was two faces on one seat: the Join door the
  // static build ships, and a signed-in "Your House" pointing at the reader's
  // household, swapped in CSS off `data-lens` and re-pointed by a script from
  // the declared-household registry. Two waves of work, one of them fixing a
  // defect this seat caused. It is retired because the thing it led to already
  // had a better-labelled door — the auth pill's resident names.
  const joinSeat = RAIL.find((s) => s.key === "join");
  assert.ok(joinSeat, "the Join door left the rail");
  assert.equal(joinSeat.href, "/join/");
  assert.equal(joinSeat.label, "Join");
  assert.equal(joinSeat.members, undefined, "the Join door grew a chip row");
  assert.equal(chipsFor("join"), null);

  // NO SEAT ANYWHERE is sign-in-aware any more. Asserted over the whole rail
  // rather than over this one seat, so re-growing the mechanism somewhere else
  // costs a failure too.
  for (const s of RAIL) {
    for (const gone of ["signedInLabel", "signedOutLabel", "houseHref", "houseKey"]) {
      assert.equal(s[gone], undefined, `${s.key} still carries \`${gone}\` — the two-faced seat is back`);
    }
  }

  // and the LAYOUT has no second face to paint. A structure with the fields
  // removed and markup that still renders them is the half-done version of this
  // change, and it is invisible to every assertion above.
  const shell = readFileSync(join(ROOT, "src", "layouts", "PostmarkLayout.astro"), "utf8");
  for (const gone of ["data-rail-in", "data-rail-out", "data-house-seat", "pm-nav-seat", "houseSlugOf", "signedInLabel"]) {
    assert.equal(shell.includes(gone), false, `PostmarkLayout still renders \`${gone}\``);
  }

  // THE THING HE SAID SUFFICES MUST STILL BE THERE. This is the half a
  // deletion-shaped change forgets: he did not say "remove the way home", he
  // said the resident names already are it. So the auth pill still prints each
  // handle as a link into that resident's own page.
  assert.ok(/data-auth-handles/.test(shell), "the signed-in resident names left the header");
  assert.ok(/"\/residents\/" \+ encodeURIComponent\(h\)/.test(shell),
    "the resident names no longer link to the reader's own page — nothing carries Your House's job");

  // THE LANTERN STAYS. A different ruling from a different sitting (Keemin,
  // 2026-07-31 — a newcomer's eye must find Join without hunting), and it would
  // be easy to lose while dismantling the seat around it.
  assert.equal(joinSeat.lantern, true, "the Join door lost its lantern");
  assert.ok(/n\.lantern \? "pm-nav-join"/.test(shell), "the lantern class stopped being rendered");
});

test("no key is used twice — a duplicate silently steals the other's highlight", () => {
  const seen = new Map();
  for (const s of RAIL) {
    for (const m of s.members ?? []) {
      const prior = seen.get(m.key);
      // a section's own key repeating as its FIRST member is the aggregate
      // (rule 3 above) and is deliberate; anything else is a collision
      assert.ok(!prior || prior === s.key, `key "${m.key}" is claimed by both ${prior} and ${s.key}`);
      seen.set(m.key, s.key);
      for (const c of m.chips ?? []) {
        if (c.key === m.key) continue;   // the room's own aggregate, again
        const p2 = seen.get(c.key);
        assert.ok(!p2, `key "${c.key}" is claimed by both ${p2} and ${m.key}`);
        seen.set(c.key, m.key);
      }
    }
  }
});

// ── the lookups the layout renders from ──────────────────────────────────────

test("a page anywhere in a family finds its section, so the seat lights up", () => {
  assert.equal(sectionOf("mail").key, "record");       // a chip of The Record (part 5)
  assert.equal(sectionOf("residents").key, "residents");
  assert.equal(sectionOf("stamps").key, "record");
  assert.equal(sectionOf("crossings").key, "record");
  assert.equal(sectionOf("repos").key, "record");
  assert.equal(sectionOf("numbers").key, "record");
  assert.equal(sectionOf("town").key, "town");         // /town/, hidden from the row but still in the family
  assert.equal(sectionOf("meeps").key, "town");        // back in The Town this wave
  assert.equal(sectionOf("bulletin").key, "town");
  assert.equal(sectionOf("atlas").key, "world");       // a lens on The World
  assert.equal(sectionOf("votes").key, "town");
  assert.equal(sectionOf("works").key, "record");
  assert.equal(sectionOf("postmark").key, "postmark"); // the front door, its own seat
  assert.equal(sectionOf("harbor").key, "harbor");
  // an orphan page (the darkroom, the ops desk) is deliberately in no section
  assert.equal(sectionOf(""), null);
  assert.equal(sectionOf("darkroom"), null);
});

test("A HOUSEHOLD IS A HOUSEHOLD OF RESIDENTS — the key the retired seat used to carry", () => {
  // /households/<slug>/ answers to `household`, which is nobody's seat key. It
  // used to be rescued by the Your House seat's `houseKey`; that seat is gone,
  // and without somewhere to put the key the page would light NOTHING — a
  // reader standing deep inside a house with the whole rail dark, which is the
  // /votes/ silence in miniature and the exact defect the founder himself
  // reported one wave ago ("'Your House' click -> selects 'The Town'").
  //
  // FLAGGED AS AN INTERPRETATION: he retired the seat and said nothing about
  // where the household page belongs. This is the smallest home for it that is
  // also true — a household is a household of residents.
  assert.equal(sectionOf("household").key, "residents",
    "the household page lights no seat, or the wrong one");
  assert.equal(RAIL.find((s) => s.key === "residents").alsoKey, "household");
  assert.equal(activeKeyOf(join(PAGES, "households", "[slug].astro")), "household",
    "the household page renamed itself — the seat's second key now points at nothing");

  // and it still takes NO row from the nav, which was the founder's own ruling
  // about this page and survives the seat that used to carry it: the household
  // page is a chip world already.
  assert.equal(rowFor("household"), null, "a section row appeared over the household's own");
});

test("the section row a page draws never shows a held chip, and never appears where there is no family", () => {
  const town = chipsFor("town");
  assert.equal(town.of.label, "The Town");
  // the ballot left this row for the quarter on 2026-08-30 — asserted where
  // that ruling is recorded, not here; what this test is about is that a row
  // renders its family and hides what is held
  assert.ok(town.chips.some((m) => m.key === "town"), "the quarter is missing from its own row");
  // AMENDED 2026-09-25 (the site, reprojected — part 5): the works and the numbers are The Record's.
  const record = chipsFor("record");
  assert.ok(record.chips.some((m) => m.key === "works"), "The Works is missing from The Record's row");
  assert.equal(record.chips.some((m) => m.key === "numbers"), true, "the numbers chip fell off The Record's row");
  // a page that WAS held still draws its section's row when a reader lands on it
  assert.equal(chipsFor("numbers").of.key, "record");
  // and so does the hidden one — /town/ is out of the row, not out of the town
  assert.equal(chipsFor("town").of.key, "town");
  // and a seat with no members draws nothing at all — Harbor never had one, and
  // the three lifted seats have none because their families were emptied by the
  // founder's own earlier strikes, not because a row was withheld from them
  assert.equal(chipsFor("harbor"), null);
  assert.equal(chipsFor("residents"), null);
  // the mail and stamps are chips of a section with a row now (part 5)
  assert.equal(chipsFor("mail").of.key, "record");
  assert.equal(chipsFor("stamps").of.key, "record");
  assert.equal(chipsFor(""), null);
});

test("NO SUBPAGE REPLACES THE TOWN-LEVEL SUBRAIL WITH ITS OWN", () => {
  //   "same for the mail -- no subpage removes the town level subrail and
  //    replaces with its own."                    — the founder, 2026-08-25
  //
  // Stated of the mail, ruled as the general shape ("same for"), so it is
  // asserted over the whole rail rather than over the two rooms that had one.
  // `subChipsFor` survives as machinery; what must not survive is a member
  // declaring a row.
  const withRows = [];
  for (const s of RAIL) {
    for (const m of s.members ?? []) if (m.chips) withRows.push(`${s.key}/${m.key}`);
  }
  assert.deepEqual(withRows, [], `these rooms declare a row of their own:\n  ${withRows.join("\n  ")}`);

  // and therefore no page anywhere draws one
  for (const key of ["residents", "mail", "daily", "votes", "atlas", "town", "meeps", "bulletin", "stamps", ""]) {
    assert.equal(subChipsFor(key), null, `"${key}" still draws a second row`);
  }
});

test("THE THREE STILL-STRUCK CHIPS — the pages stay, at the URLs they had", () => {
  //   "remove 'the windows' and 'the meeps' from residents/; restore the town
  //    subrail" · "remove 'returned to sender' and 'write a letter'"
  //                                              — the founder, 2026-08-25
  //
  // It was FOUR. The meeps came back the same night, one level up — "we can put
  // the meeps back in town too" — so it is asserted by the returned-chip test
  // above and struck from this list here. Both rulings are his, hours apart,
  // and the second is not a correction of the first: the meeps left the
  // RESIDENTS row and joined THE TOWN's, which only became possible once
  // residents left the town for the top rail.
  //
  // The other three are struck from the ROW, not from the site. Each keeps its
  // URL and answers to its room's key, so the room's seat lights above it. Read
  // off the REAL page files: a lane that repoints one of these keys, or lets a
  // page fall out of its section, goes red here.
  const struck = [
    ["/window/", "residents", "the windows"],
    ["/mail/returned/", "mail", "returned to sender"],
    ["/mail/compose/", "mail", "write a letter"],
  ];
  // AMENDED 2026-09-25 (the site, reprojected — part 5): the mail's rooms answer to `mail`, which is a
  // chip of The Record now — so the seat above them is The Record and the row
  // under it is The Record's, with the mail chip lit. /window/ is unchanged.
  const litSeat = { residents: "residents", mail: "record" };
  for (const [href, room, label] of struck) {
    assert.equal(allEntries().some((e) => e.href === href), false,
      `"${label}" is back in a chip row`);

    const file = pageFileFor(href);
    assert.ok(file, `${href} lost its page — "${label}" was struck from the row, not the site`);
    const key = activeKeyOf(file);
    assert.equal(key, room, `${href} claims "${key}" — it should answer to its room, ${room}`);

    // AND THE SEAT ABOVE IT LIGHTS. Before the lift this asserted a chip inside
    // The Town's row; the rooms are top-rail seats now, so what a reader
    // standing here sees is their own seat lit in the rail itself. The claim is
    // the same one — the chrome must say where you are — and it moved with the
    // rail rather than being dropped when its old shape stopped applying.
    const lit = sectionOf(key);
    assert.ok(lit, `${href} lights no seat at all — the rail goes dark where the reader is deepest`);
    assert.equal(lit.key, litSeat[room], `${href} lights "${lit.label}" instead of its own room's seat`);
    if (room === "mail") assert.equal(rowFor(key).of.key, "record", `${href} draws the wrong row`);
    else assert.equal(rowFor(key), null, `${href} draws a chip row; the residents' room has none`);
  }
});

test("the routes that came back from a fold are real pages, not stubs", () => {
  // /bulletin/, /window/ and /meeps/ were all redirect stubs pointing INTO a
  // scroller. The chip wave gave them their content back at the same URLs. A
  // stub would still pass rule 1 (the file exists) and rule 2 is what catches
  // it — a redirect page renders its own document and claims no `active` key —
  // so this names them, because a silent re-fold is exactly the kind of thing
  // that took a year to find last time.
  // The keys have moved twice since. The founder struck the windows and the
  // meeps chips, so both borrowed their room's key (`residents`); then he put
  // the meeps back in The Town, so /meeps/ answers to `meeps` again. /window/
  // still borrows. What has not changed across either move is the thing this
  // test is for — all three render the layout with real content behind their
  // own URL, and none has quietly become a redirect again.
  for (const [key, href] of [["bulletin", "/bulletin/"], ["residents", "/window/"], ["meeps", "/meeps/"]]) {
    const file = pageFileFor(href);
    assert.ok(file, `${href} has no page`);
    const src = readFileSync(file, "utf8");
    assert.equal(activeKeyOf(file), key, `${href} does not claim "${key}" — it has folded back into a stub`);
    assert.equal(/http-equiv="refresh"/.test(src), false, `${href} is a redirect again`);
  }
});

// ── the founder's three, walked on dev 2026-08-25 ────────────────────────────
//
// Three defects he named verbatim, and one test each. They are separate from
// the laws above on purpose: those describe the shape the rail should have,
// these describe damage he actually met, and a regression on any of them should
// fail under his own words rather than under a paraphrase of them.

test("THE HOUSEHOLD PAGE STILL DOES NOT LIGHT THE TOWN — the defect outlived the seat it broke", () => {
  //   "'Your House' click -> selects 'The Town'."   — the founder, 2026-08-25
  //
  // The original: /households/<slug>/ handed the layout `active="residents"`,
  // a key in The Town's family, so the rail lit the section the reader had just
  // deliberately left. It was fixed by giving the Your House seat a second key.
  //
  // THAT SEAT IS NOW RETIRED, and this test survives it deliberately — the
  // defect was never about the seat, it was about a page lighting a section it
  // is not in. So the assertion is kept and re-aimed: the household page must
  // light the seat it actually belongs to, and must not light The Town. It goes
  // red both if `alsoKey` is dropped (nothing lights) and if the page reverts to
  // claiming `residents`-as-a-town-room (The Town lights).
  const page = join(PAGES, "households", "[slug].astro");
  assert.ok(existsSync(page), "the household page is gone");

  const key = activeKeyOf(page);
  const lit = sectionOf(key);
  assert.ok(lit, `nothing in the rail answers to "${key}" — the page lights no seat at all`);
  assert.notEqual(lit.key, "town", "THE FOUNDER'S DEFECT, restored: the household page lights The Town");
  assert.equal(lit.key, "residents", `standing on a household page lights "${lit.label}"`);

  // and it must not claim the Join door's key either — the Join door is /join/,
  // and a household is not the door you came in by.
  assert.notEqual(key, "join", "the household page claims the Join door's own key");
});

test("ONE CHIP ROW PER PAGE — never the section's AND the room's", () => {
  //   "we somehow managed to INCREASE the complexity of the site … we just gave
  //    chips to the sub-header rail IN ADDITION to the household rail."
  //
  // Both rows rendered at once, so /residents/ carried the top rail, The Town's
  // eight chips and its own three. The rows compete now: most specific wins.
  // The founder's later ruling collapsed the second row entirely rather than
  // making the two compete ("no subpage removes the town level subrail and
  // replaces with its own", 2026-08-25) — so a room drew its SECTION's row,
  // which is the stronger form of the same fix. `rowFor` keeps the
  // most-specific-wins branch; nothing declares a row for it to prefer.
  //
  // /residents/ was the example here until the lift made it a seat with no row
  // of its own. The Town's rooms carry the claim now — the meeps is one of
  // them, and it is the chip that made the round trip.
  assert.equal(rowFor("meeps").place, "section", "a room drew a row of its own again");
  assert.equal(rowFor("meeps").of.key, "town");
  // a page in a section but in no room of its own still gets the section's row —
  // collapsing to one row must not mean collapsing to none
  assert.equal(rowFor("daily").place, "section");
  assert.equal(rowFor("daily").of.key, "town");
  assert.equal(rowFor("atlas").place, "section");
  // and a lifted seat draws none at all, because its family is one read
  assert.equal(rowFor("residents"), null);
  // AMENDED 2026-09-25 (the site, reprojected — part 5): the mail and stamps draw The Record's row
  assert.equal(rowFor("mail").of.key, "record");
  assert.equal(rowFor("stamps").of.key, "record");
  // the household page takes none, by the founder's word, and that survived the
  // retirement of the seat that used to carry the rule; nor does an orphan page
  assert.equal(rowFor("household"), null, "a section row appeared over the household's own");
  assert.equal(rowFor("join"), null);
  assert.equal(rowFor("darkroom"), null);
  assert.equal(rowFor(""), null);
  // and a page that says it draws its own row gets nothing from the nav
  assert.equal(rowFor("meeps", { ownChips: true }), null);

  // THE LAYOUT DRAWS THE ROW ONCE. `rowFor` returning one answer is worthless
  // if the shell renders two components — which is exactly the shape the
  // founder met — so the count is part of the claim.
  // Comment lines are dropped before counting, and that is not tidiness: the
  // first run of this assertion went red on the layout's own sentence saying
  // there is one row. A probe that counts prose fails on documentation and
  // passes on a second render tucked inside a conditional.
  const shell = readFileSync(join(ROOT, "src", "layouts", "PostmarkLayout.astro"), "utf8")
    .split("\n").filter((l) => !/^\s*(\/\/|\*|\{?\/\*)/.test(l)).join("\n");
  assert.equal((shell.match(/<ChipRow\b/g) ?? []).length, 1,
    "PostmarkLayout renders more than one chip row — the stack is back");

  // and no page smuggles a second row in past the shell: the only component
  // that draws its own is the household wrapper, and a page rendering it must
  // either declare `ownChips` or claim a key the nav draws nothing for.
  const doubled = [];
  for (const f of everyPageFile()) {
    if (!/<Household\b/.test(readFileSync(f, "utf8"))) continue;
    const declares = /\bownChips=/.test(layoutTagOf(f) ?? "");
    if (!declares && rowFor(activeKeyOf(f)) !== null) doubled.push(f.replace(ROOT, ""));
  }
  assert.deepEqual(doubled, [], `these pages draw their own chip row AND take one from the nav:\n  ${doubled.join("\n  ")}`);
});

test("/town/ IS NOT A DASHBOARD — no cards restating the chips, no wall of counts", () => {
  //   "https://dev.postmark.town/town/ where we have the same chips AND cards
  //    on the same page, which itself is just filled with… a generic dashboard
  //    of aggregate numbers."
  //
  // The page listed the section's own rooms a second time as a card grid, over
  // four aggregate counts. Both are gone; this is what keeps them gone.
  const src = readFileSync(join(PAGES, "town", "index.astro"), "utf8");

  // THE CARDS. The grid was built by mapping the rail's own members, so the
  // tell is the page reaching for the rail at all — it has a chip row drawn
  // from that same structure directly above it.
  assert.equal(/\bfrom "@\/lib\/nav\.mjs"/.test(src), false,
    "/town/ reads the rail again to restate its own chip row as cards");
  assert.equal(/t-rooms|t-room\b|ROOM_NOTE/.test(src), false, "the card grid is back on /town/");

  // THE DIALS. Four counts assembled from whatever the extracts happened to
  // carry, sitting where the page's body should be. The town's own numbers live
  // at /numbers/ (held until the S4 emission; on the rail since 2026-09-03).
  assert.equal(/t-stats|t-dials|t-stat-note/.test(src), false,
    "the aggregate-numbers dashboard is back on /town/");
  assert.equal(/from "@\/data\/postmark\/stats\.json"|from "@\/data\/postmark\/economy\.json"/.test(src), false,
    "/town/ imports the counts again");

  // ── RE-AIMED 2026-08-30, and this is the interesting half ──────────────────
  // The probe used to forbid the WORD `dials` anywhere in the file. That was a
  // fine proxy while /town/ was one breath of prose, and it went red the day
  // the founder ruled that The Town absorbs Stamps — because the stamps
  // machinery legitimately brings the economy's dials onto this page.
  //
  // So the word is no longer the test; the PLACEMENT is, which is what the
  // ruling was always about. His complaint was a page "just filled with… a
  // generic dashboard of aggregate numbers" — numbers as the body, assembled
  // because they were available. The dials on the hub are the opposite: they
  // are the stamp machinery's own numbers, each carrying the sentence that
  // says what it governs, folded shut inside the rules lane at the very bottom
  // of the page. A reader meets the civic quarter, not a wall of counts.
  //
  // What must stay true, therefore: the dials are BELOW the quarter and INSIDE
  // a lane, never in the page's opening.
  const quarter = src.indexOf('<section class="cq"');
  const rulesLane = src.indexOf('id="rules"');
  const numbers = src.indexOf('id="numbers"');
  if (numbers > 0) {
    assert.ok(quarter > 0 && quarter < numbers,
      "/town/ opens with numbers again — the civic quarter must come first");
    assert.ok(rulesLane > 0 && rulesLane < numbers,
      "the dials must live inside the rules lane, not loose on the page");
  }

  // and the page IS the section's landing again — the 2026-08-25 hold released
  // when the civic quarter filled the room its emptiness had emptied.
  assert.ok(CLAIMED.get("town")?.has(join(PAGES, "town", "index.astro")));
  assert.equal(rowFor("town").place, "section");
  assert.equal(rowFor("town").chips[0].key, "town");
});

test("the Harbor keeps its own flag — a root-relative spelling would be wrong from one of the two domains", () => {
  assert.equal(HARBOR, "https://1f4ee.town/");
  const h = RAIL.find((s) => s.key === "harbor");
  assert.equal(h.external, true);
  assert.equal(h.href, HARBOR);
});

// ── the founder's four, walked on dev 2026-08-25 night ───────────────────────

test("THE NOTICE BOARD IS THE BULLETIN, so it matches up", () => {
  //   "we should rename the notice board to the bulletin so it matches up"
  //                                              — the founder, 2026-08-25
  //
  // "matches up" is the operative half and it names a target: the read is
  // `bulletin` in the URL, in the `active` key, in the frontmatter, in every
  // doorstep deep link and at the MCP door (`town read:"bulletin"`). Only the
  // words a human saw said "notice board". So the assertion is that ONE name
  // survives, and that it is the machine's — moving the other way would have
  // meant renaming a URL that letters already point at.
  const chip = allEntries().find((e) => e.key === "bulletin");
  assert.ok(chip, "the bulletin left the rail");
  assert.equal(chip.label, "the bulletin", `the chip still reads "${chip.label}"`);
  assert.equal(chip.href, "/bulletin/", "the URL moved; the rename was supposed to make the name match it");

  // NOTHING THE RAIL SAYS carries the old name any more, at any depth
  for (const e of allEntries()) {
    assert.equal(/notice board/i.test(e.label ?? ""), false,
      `"${e.label}" still says notice board`);
  }

  // and the PAGE agrees — its <title> and its own heading. A chip renamed over
  // a page that still calls itself something else is the mismatch he asked to
  // remove, one layer down.
  const page = readFileSync(pageFileFor("/bulletin/"), "utf8");
  const tag = layoutTagOf(pageFileFor("/bulletin/"));
  assert.match(tag, /title="The bulletin — Postmark"/, "the page title still says notice board");
  assert.match(page, /<h1>The bulletin<\/h1>/, "the page's own heading still says notice board");
  assert.equal(/>[^<]*notice board/i.test(page), false,
    "the bulletin page still calls itself the notice board somewhere a reader can see");

  // THE POSTINGS THEMSELVES ARE NOT TOUCHED. Residents wrote those words, and a
  // rename of the site's chrome does not reach into what a resident said. The
  // town's letters mention "the notice board" in prose and must keep doing so.
  assert.ok(existsSync(join(ROOT, "src", "data", "postmark", "letters.json")),
    "the letters are gone; this guard has nothing to guard");
});

test("LITTLE ICONS FOR THE TOWN'S CHIPS — decoration, never the name", () => {
  //   "I'd like little icons for the town's chips"  — the founder, 2026-08-25
  //
  // THE TOWN'S chips, by his words, so that is the scope: The World's row is
  // deliberately still bare and extending it is an open option, not something
  // done quietly here. Every rendered chip in The Town's row wears one; a chip
  // that arrives later without one is a gap a reader sees as a ragged row.
  const row = chipsFor("town").chips;
  const bare = row.filter((c) => !c.icon).map((c) => c.label);
  assert.deepEqual(bare, [], `these Town chips have no icon: ${bare.join(", ")}`);

  // and they are DISTINCT — the whole value of an icon is telling one chip from
  // another at a glance, and two chips wearing the same glyph is worse than
  // none wearing any.
  const icons = row.map((c) => c.icon);
  assert.equal(new Set(icons).size, icons.length, `two Town chips share a glyph: ${icons.join(" ")}`);

  // THE LABEL IS UNCHANGED. An icon that replaced a word would be a different
  // request; his was for icons on the chips, not instead of them.
  // AMENDED 2026-08-30 evening with the row itself: the civic quarter leads,
  // and the ballot and the bounty board left for the quarter that now draws
  // them. The claim is unchanged — every chip keeps its WORDS, and the icon is
  // decoration beside the label rather than a replacement for it.
  // AMENDED 2026-09-25 (the site, reprojected — part 5): the works and the
  // numbers moved to The Record's row, with their icons.
  assert.deepEqual(row.map((c) => c.label),
    ["the civic quarter", "ferry’s daily", "the bulletin", "the meeps"]);

  // AND THEY ARE HIDDEN FROM A SCREEN READER, because a decorative glyph read
  // aloud beside its own label says the chip twice in two vocabularies.
  const chipRow = readFileSync(join(ROOT, "src", "components", "ChipRow.astro"), "utf8");
  assert.match(chipRow, /class="pm-chip-icon" aria-hidden="true"/,
    "the icon is rendered without aria-hidden — it will be read aloud beside the label");

  // and no seat in the TOP rail grew one: the seats are words, and the layout
  // renders `n.label` with nothing before it.
  for (const s of RAIL) {
    assert.equal(s.icon, undefined, `the ${s.label} seat grew an icon; only the chips were asked for`);
  }
});

// ── THE NAV FLAGS (the site, reprojected — part 2) ─────────────────────────

test("WHAT'S ON WAITS FOR ITS PAGE — the chip is flagged, off by default, and cannot render while off", () => {
  // The brief, verbatim: "a chip to a 404 is worse than no chip: build the chip
  // behind a flag the layout reads, default off, and say so."
  assert.deepEqual(navFlags({}), { whatsOn: false }, "an unset build turns a nav flag on");
  assert.deepEqual(navFlags(undefined), { whatsOn: false });
  assert.equal(navFlags({ PUBLIC_NAV_WHATS_ON: "0" }).whatsOn, false);
  assert.equal(navFlags({ PUBLIC_NAV_WHATS_ON: "1" }).whatsOn, true);

  const town = RAIL.find((s) => s.key === "town");
  const chip = town.members.find((m) => m.key === "calendar");
  assert.ok(chip, "the Town has no what's-on chip");
  assert.equal(chip.label, "what’s on");
  assert.equal(chip.href, "/calendar/");
  assert.equal(chip.flag, "whatsOn");

  // OFF: the row is exactly the founder's list, every page, every depth.
  for (const active of ["town", "bulletin", "daily", "meeps"]) {
    assert.equal(chipsFor(active).chips.some((c) => c.key === "calendar"), false, `what's on renders on ${active} with its flag off`);
    assert.equal(rowFor(active).chips.some((c) => c.key === "calendar"), false);
  }

  // ON: it hangs beside the bulletin, where feature/calendar seats its own chip.
  const on = navFlags({ PUBLIC_NAV_WHATS_ON: "1" });
  assert.deepEqual(rowFor("bulletin", { flags: on }).chips.map((c) => c.key),
    ["town", "daily", "bulletin", "calendar", "meeps"]);

  // and the layout reads the flag from the build — the one place it may come from.
  const shell = readFileSync(join(ROOT, "src", "layouts", "PostmarkLayout.astro"), "utf8");
  assert.match(shell, /rowFor\(active, \{ ownChips, flags: navFlags\(import\.meta\.env\) \}\)/);
});

test("a flag is an escape for a page NOT HERE YET, never for one that is", () => {
  // The day /calendar/ lands, the chip is held to both route laws like any
  // other — the exemption above only fires while the page file is missing.
  for (const e of allEntries().filter((x) => x.flag)) {
    assert.ok((e.waits ?? "").trim().length >= 20, `${e.key} is flagged with no reason on file`);
    assert.equal(navFlags({})[e.flag], false, `${e.key}'s flag is on by default`);
  }
});

// ── THE RECORD (the site, reprojected — part 5) ─────────────────────────────

test("THE RECORD gathers what lasts: its own landing first, then the mail, the crossings, the works, stamps, the numbers, the repos", () => {
  //   "One seat that makes 'the record is public' a place to point at."
  //                              — the design note, the-site-reprojected.md
  const record = RAIL.find((s) => s.key === "record");
  assert.ok(record, "there is no Record seat");
  assert.equal(record.label, "The Record");
  assert.equal(record.href, "/records/");
  assert.deepEqual(record.members.map((m) => m.key), ["record", "mail", "crossings", "works", "stamps", "numbers", "repos"]);
  // every old URL still answers, and each page claims its own chip's key
  for (const [href, key] of [["/records/", "record"], ["/mail/", "mail"], ["/records/crossings/", "crossings"], ["/works/", "works"], ["/stamps/", "stamps"], ["/numbers/", "numbers"], ["/records/repos/", "repos"]]) {
    const file = pageFileFor(href);
    assert.ok(file, `${href} has no page`);
    assert.equal(activeKeyOf(file), key, `${href} does not claim "${key}"`);
  }
  // the chips wear icons, one each, all different — the Town's rule, kept
  const icons = record.members.map((m) => m.icon);
  assert.equal(icons.every(Boolean), true, "a Record chip has no icon");
  assert.equal(new Set(icons).size, icons.length, "two Record chips share a glyph");
});
