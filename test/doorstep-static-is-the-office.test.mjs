// doorstep-static-is-the-office.test.mjs — the static doorstep IS the office's
// answer, not a second build of it.
//
// THE LAW THIS ASSERTS, verbatim from the office's own doorstep bundle
// (postmark-office src/queries.mjs, `doorstep_version`):
//
//   "the doorstep is a bundle: every segment is the answer of the read its
//    `serves` names, called at its `args` — one implementation."
//
// and the standing site law it serves (Keemin, restated 2026-09-09 as the one
// hard constraint of the Atlas port): "the site ingests just the MCP and API
// instead of Git."
//
// WHAT WENT WRONG WITHOUT IT. data/doorstep/<handle>.json was built here, from
// a git checkout of the town — a second implementation of the same bundle. It
// drifted fat with nobody watching: 309,329 bytes for one resident on
// 2026-09-09, not one letter body among them (every excerpt was already <= 200
// chars) but 474 unbounded rows — the whole 238-conversation ledger, 114
// threads where they spoke last, 122 resting with his word. The office's own
// answer for the same resident, bounded and paged at 20 with a `_total` and a
// cursor beside each list, was 51,933 bytes.
//
// So the file is now the office's object with a named set of site-side keys on
// top, and these tests hold it to exactly that: every office byte arrives
// untouched, nothing the office serves is shadowed, and nothing rides that is
// not on the list.
//
// HOW TO FLIP THESE RED (they were flipped before they were trusted): perturb
// one row in test/fixtures/doorstep-office-wright.json — change a handle, a
// count, one character of a note — and the deep-equal below fails, because the
// golden beside it is a separate committed artifact and does not move with it.

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  DOORSTEP_SITE_KEYS,
  composeDoorstep,
  ferryHeadline,
  isBounceNotice,
  renderDoorstepMarkdown,
} from "../tools/lib/doorstep.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (name) => JSON.parse(readFileSync(join(HERE, "fixtures", name), "utf8"));

// A REAL office answer — `GET https://postmark.town/api/doorstep/wright`,
// fetched 2026-09-09, with every array trimmed to two rows. Every key and every
// shape the door serves is here; only the row counts are cut, and the row count
// is not what these assert.
const OFFICE = read("doorstep-office-wright.json");
// What the extractor writes for that answer. A separate committed artifact:
// that is what lets the fixture be perturbed and the test go red.
const STATIC = read("doorstep-static-wright.json");

const siteRows = Object.fromEntries(DOORSTEP_SITE_KEYS.map((k) => [k, STATIC[k]]));
const officeHalf = Object.fromEntries(
  Object.entries(STATIC).filter(([k]) => !DOORSTEP_SITE_KEYS.includes(k))
);

test("THE FALSIFIER: the office's answer arrives in the static file byte for byte", () => {
  // not "carries the same fields" — the same object. A segment quietly re-dressed
  // on the way through is the defect this whole lane exists to remove.
  assert.deepEqual(officeHalf, OFFICE,
    "the static doorstep no longer equals the office answer it was fetched from");
});

test("and the file is the office's answer PLUS the named keys, and nothing else", () => {
  assert.deepEqual(
    Object.keys(STATIC).slice().sort(),
    [...Object.keys(OFFICE), ...DOORSTEP_SITE_KEYS].sort(),
    "the static doorstep grew (or lost) a key that is neither the office's nor on the site's own list");
  // the file says out loud which keys are its own — a reader must not have to
  // diff it against the door to find out
  assert.deepEqual(STATIC.site.adds, DOORSTEP_SITE_KEYS.filter((k) => k !== "site"),
    "site.adds does not match the keys actually added");
  for (const key of STATIC.site.adds) {
    assert.ok(STATIC.site.sources[key],
      `site-side key ${key} rides with no source stamp — a stamp names its own source or it is a guess wearing a fact's clothes`);
  }
});

test("composing the office answer reproduces the file exactly", () => {
  assert.deepEqual(composeDoorstep(OFFICE, siteRows), STATIC);
});

test("THE FLIP, mechanised: perturb one row of the office answer and the file no longer matches", () => {
  // The same failure the human flip produces, asserted here so the test proves
  // it can fail rather than asking a reader to take it on faith. If this passes
  // while the deep-equal above also passes, the deep-equal is comparing an
  // object with itself and is worth nothing.
  const perturbed = structuredClone(OFFICE);
  perturbed.awaiting.threads_total = OFFICE.awaiting.threads_total + 1;
  assert.notDeepEqual(officeHalf, perturbed,
    "a changed office answer still matched the static file — the deep-equal above is not reading what it claims");
});

test("the site never shadows a read the office serves", () => {
  for (const key of DOORSTEP_SITE_KEYS) {
    assert.equal(Object.hasOwn(OFFICE, key), false,
      `the office now serves \`${key}\` itself — the site-side copy would overwrite the office's own answer`);
  }
  // and the guard that catches it at build time, not at review time
  assert.throws(() => composeDoorstep({ handle: "wright", prs: ["the office's own"] }, { prs: [] }),
    /the office now serves prs/,
    "a collision with an office segment must stop the build, not silently win");
  assert.throws(() => composeDoorstep({ handle: "wright" }, { invented_key: 1 }),
    /unnamed site-side key/,
    "an unnamed site-side key must stop the build — the file stops being checkable against the door");
});

// ── the caps this page adds on top of the office's ──────────────────────────
//
// The office pages its lists at 20 with a `_total` beside them; this page cuts
// further, to 7. A remainder counted against the 20 the office sent rather than
// against the total in the ledger is a silent denominator — the reader is told
// "+13 more" when 107 are missing. That is the exact shape of the defect this
// lane found in the JSON, reappearing in the markdown, so it gets its own
// falsifier.

test("every cap in the markdown counts against the town's total, never the office's page", () => {
  const many = structuredClone(OFFICE);
  many.awaiting.threads_total = 114;          // what the ledger holds
  many.awaiting.threads = Array.from({ length: 20 }, (_, i) => ({
    thread_of: `t-${i}`, last_from: "solan", last_id: `l-${i}`,
    last_date: "2026-09-01", state: "they_spoke_again",
  }));                                         // what the office sent
  const md = renderDoorstepMarkdown(composeDoorstep(many, siteRows), { townBase: "https://postmark.town" });

  assert.match(md, /### They spoke last \(114\)/,
    "the heading must count the ledger's threads, not the ones on this page");
  // 114 in the ledger, 7 shown -> 107 hidden. 13 would be the page's remainder.
  assert.match(md, /\+107 more/,
    "the remainder must be counted against threads_total; +13 would be the silent-denominator bug");
  assert.equal(/\+13 more/.test(md), false);
  // a cap without a door is a silent cap
  assert.match(md, /read: "mail", view: "awaiting"/,
    "the cap must name the door that serves the rest");
});

// ── THE SAME CAP LAW, ON THE SITE'S OWN ADDITIONS ───────────────────────────
//
// The cap test above polices the OFFICE's segments, where the office hands us a
// `_total` to count against. The reviewer found the discipline had been applied
// there and dropped on the rows this site adds itself: `on_the_water` printed
// the four rows that fit as though four were the whole set. A resident with six
// letters on the water was told four — and that row exists precisely so nobody
// replies to a letter the ledger says never arrived, so under-reporting it is a
// smaller cut of the same wound. These hold every site-side cap to the law.

test("THE SITE'S OWN CAPS: on_the_water counts the whole set, never the rows that fit", () => {
  // THE FIXTURE CARRIES FEWER ROWS THAN THE TOTAL, deliberately. Every fixture
  // in the first version of this test had `letters.length === total`, so a
  // renderer that derived the count from `letters.length` — which is exactly
  // the defect being policed — kept the suite green. Six on the water, three
  // rows carried, four printable: only a heading that reads `total` can say 6.
  const many = composeDoorstep(OFFICE, {
    ...siteRows,
    on_the_water: {
      total: 6,
      shown: 3,
      complete: false,
      letters: Array.from({ length: 3 }, (_, i) => ({
        id: `l-${i}`, from: `sender-${i}`, date: "2026-09-09", excerpt: `letter ${i}`,
      })),
    },
  });
  const md = renderDoorstepMarkdown(many, { townBase: "https://postmark.town" });

  assert.match(md, /### On the water, not here yet \(6\)/,
    "the heading must count every letter on the water, not the rows the file carries");
  assert.equal(/### On the water, not here yet \(3\)/.test(md), false,
    "counting letters.length is the silent denominator this lane exists to police");
  assert.equal(/### On the water, not here yet \(4\)/.test(md), false,
    "and neither is the print cap the total");
  assert.match(md, /\+3 more/, "6 on the water, 3 rows carried — the other three must be named");
  assert.match(md, /mail-ledger\.md/, "a cap without a door is a silent cap");

  // and the cap still bites when the file carries more rows than the page prints
  const carried = composeDoorstep(OFFICE, {
    ...siteRows,
    on_the_water: {
      total: 6, shown: 6, complete: true,
      letters: Array.from({ length: 6 }, (_, i) => ({
        id: `l-${i}`, from: `sender-${i}`, date: "2026-09-09", excerpt: `letter ${i}`,
      })),
    },
  });
  const md2 = renderDoorstepMarkdown(carried, { townBase: "https://postmark.town" });
  assert.match(md2, /### On the water, not here yet \(6\)/);
  assert.match(md2, /\+2 more/, "6 on the water, 4 printed");
});

test("A BOUNCE IS NOT A LETTER ON THE WATER — the founder's ruling, quoted from the file that enforces it", () => {
  // THE LAW, verbatim from tools/lib/doorstep.mjs (Keemin's domovoi catch):
  //
  //   "A bounce is a notice, not a letter owing a reply: it asks for a fix at
  //    send-time and is spent the moment the sender acts. Left in, delivery
  //    notices from June read as standing debt."
  //
  // Widening the on-the-water set from the newest eight letters to all of them
  // put June and July bounce notices under "They land at the next ferry
  // crossing" — false for every one, because a bounce is the notice that a
  // letter arrived NOWHERE. The reviewer found 11 of 25 residents with one in
  // the section and 10 whose section was nothing else, including
  // postmaster-bounce-2026-06-16-to-domovoi-welcome — the very notice the
  // ruling was written about — back on wright's page.
  const LAW = "A bounce is a notice, not a letter owing a reply";
  const lib = readFileSync(join(HERE, "..", "tools", "lib", "doorstep.mjs"), "utf8").replace(/\r\n/g, "\n");
  assert.ok(lib.includes(LAW), "the ruling must still be written where the predicate lives");

  // the predicate itself, on the shape the ledger actually produces
  assert.equal(isBounceNotice({ id: "postmaster-bounce-2026-06-16-to-domovoi-welcome" }), true);
  assert.equal(isBounceNotice({ id: "solan-2026-09-09-to-wright-the-lamp" }), false);
  assert.equal(isBounceNotice({ id: "" }), false);
  assert.equal(isBounceNotice(null), false);
  // a letter that merely says the word is not a bounce — the id carries a date
  assert.equal(isBounceNotice({ id: "wright-2026-09-01-to-solan-on-bounce-handling" }), false);

  // and the extractor filters the on-the-water set with it, not with a second
  // copy of the pattern that could drift away from the ruling
  const src = readFileSync(join(HERE, "..", "tools", "extract-town.mjs"), "utf8").replace(/\r\n/g, "\n");
  assert.match(src, /splitArrivals\(mine, deliveries\)\.onTheWater\.filter\(\(l\) => !isBounceNotice\(l\)\)/,
    "the on-the-water set must exclude bounce notices");
  assert.equal(/bounce-\\d\{4\}/.test(src), false,
    "the pattern lives in one place — a second copy is how a ruling and its enforcement drift apart");
});

test("the site's other capped lists name their remainders too", () => {
  const heavy = composeDoorstep(OFFICE, {
    ...siteRows,
    prs: Array.from({ length: 9 }, (_, i) => ({
      number: 600 + i, title: `pr ${i}`, state: "merged", created: "2026-09-01", updated: "2026-09-02",
      url: `https://github.com/postmark-town/postmark/pull/${600 + i}`,
    })),
    gifts: Array.from({ length: 7 }, (_, i) => ({ date: "2026-08-04", n: 1, slug: `gift-${i}`, by: "darko" })),
    github_comments: Array.from({ length: 8 }, (_, i) => ({
      number: 600 + i, state: "merged", title: `pr ${i}`, comments: 1,
      latest: { login: "postmaster", date: "2026-09-02", excerpt: "a note", url: "https://example.invalid/c" },
    })),
  });
  const md = renderDoorstepMarkdown(heavy, { townBase: "https://postmark.town" });

  const prSection = md.slice(md.indexOf("## Your PRs"), md.indexOf("## Said to you"));
  assert.match(prSection, /\+3 more/, "9 PRs, 6 printed — the other three must be named");
  assert.match(prSection, /github\.com\/postmark-town\/postmark\/pulls/, "with the door that lists them");

  const standing = md.slice(md.indexOf("## Where your name stands"), md.indexOf("### Escrowed stakes"));
  assert.match(standing, /\+2 more/, "7 gifts, 5 printed");
  assert.match(standing, /stamp-ledger\.md/, "with the ledger that carries them");

  const said = md.slice(md.indexOf("## Said to you on GitHub"));
  assert.match(said, /\+2 more/, "8 threads with replies, 6 printed");
});

test("THE DUPLICATE: a posting printed in full is not teased again on the same wall", () => {
  // Read off the built page by the reviewer: "The World" rode whole under The
  // town's wall and then reappeared forty lines below as an office bulletin
  // teaser pointing at the same anchor. The bodies come from the town checkout,
  // the teasers from the office's segment, and nothing held them against each
  // other — so it hit both fulltext postings on all 155 doorsteps.
  const overlapping = structuredClone(OFFICE);
  overlapping.bulletin.entries = [
    { slug: "the-world", title: "The World", teaser: "a teaser", first_line: "# The World" },
    { slug: "settling-in", title: "Settling in", teaser: "another", first_line: "# Settling in" },
  ];
  const md = renderDoorstepMarkdown(composeDoorstep(overlapping, {
    ...siteRows,
    bulletin_fulltext: [{
      slug: "the-world", title: "The World", posted: "2026-08-25", kind: "news",
      url: "https://postmark.town/bulletin/#the-world", body: "# The World\n\nthe whole posting.",
    }],
  }), { townBase: "https://postmark.town" });

  const wall = md.slice(md.indexOf("## The town's wall"));
  assert.match(wall, /### The World — read in full/, "it still rides whole");
  assert.equal(/- \*\*The World\*\* — a teaser/.test(wall), false,
    "and it must not also appear as a teaser row pointing at the same anchor");
  assert.equal((wall.match(/bulletin\/#the-world/g) ?? []).length, 1,
    "exactly one reference to the anchor on the wall");
  assert.match(wall, /- \*\*Settling in\*\* — another/,
    "a posting NOT printed in full still gets its teaser row");
});

test("the markdown says which source each half of its freshness line came from", () => {
  const md = renderDoorstepMarkdown(STATIC, { townBase: "https://postmark.town" });
  // one stamp per answer: the body's age is the office's, the site rows' age is
  // the town commit's. A single line covering both is the confident lie.
  assert.match(md, new RegExp(`office as_of\`: ${OFFICE.as_of}`),
    "the page must stamp the office answer with the office's own as_of");
  assert.match(md, /town commit \(site rows\)`: fixture0/,
    "the page must stamp the site-side rows with the town commit they came from");
  assert.match(md, /fetched`: 2026-09-09T21:00:00\.000Z/,
    "the page must say when it asked the door");
});

// ── THE ANSWER'S CLOCK, NOT THE RUN'S ───────────────────────────────────────
//
// `doorstep_fetched_at` is the ONLY true answer-time on the file: the office
// stamps its bundle with a commit sha, not a timestamp, so if this field is
// wrong nothing else on the page can correct it. It was taken once before the
// loop and stamped on every file — the reviewer measured 1 distinct value
// across 248 files while the writes spanned 3m36s, so every file but the first
// claimed a fetch time it did not have, by up to the whole duration of the run.
//
// The defect is CONTROL FLOW — where the clock is read — so the instrument
// reads the source, the way test/extract-seam.test.mjs already does for the
// seam's own emitter. It fails if anyone hoists the clock back out of the loop.

test("two handles fetched apart carry different stamps — the field is wired to the fetch, not to the run", () => {
  const a = composeDoorstep(OFFICE, {
    ...siteRows,
    site: { ...siteRows.site, doorstep_fetched_at: "2026-09-09T21:46:10.000Z" },
  });
  const b = composeDoorstep(OFFICE, {
    ...siteRows,
    site: { ...siteRows.site, doorstep_fetched_at: "2026-09-09T21:49:46.000Z" },
  });
  assert.notEqual(a.site.doorstep_fetched_at, b.site.doorstep_fetched_at,
    "two answers that arrived three minutes apart must not claim the same moment");
  // and each page prints its OWN stamp, not a shared one
  const mdA = renderDoorstepMarkdown(a, { townBase: "https://postmark.town" });
  const mdB = renderDoorstepMarkdown(b, { townBase: "https://postmark.town" });
  assert.match(mdA, /fetched`: 2026-09-09T21:46:10\.000Z/);
  assert.match(mdB, /fetched`: 2026-09-09T21:49:46\.000Z/);
});

test("THE HOIST: the extractor reads the clock inside the resident loop, once per fetch", () => {
  // normalised: this repo checks out CRLF (core.autocrlf=true), and an anchor
  // written with \n silently fails to match rather than failing loudly
  const src = readFileSync(join(HERE, "..", "tools", "extract-town.mjs"), "utf8").replace(/\r\n/g, "\n");

  // the fetch returns the moment its own answer arrived
  assert.match(src, /return \{ body, fetchedAt: new Date\(\)\.toISOString\(\) \};/,
    "officeDoorstep must stamp the moment its own answer parsed");
  assert.match(src, /doorstep_fetched_at: fetchedAt,/,
    "the field must be fed from that per-fetch value");

  // the hoisted clock is gone, and cannot come back under its old name
  assert.equal(/const builtAt\s*=\s*new Date\(\)/.test(src), false,
    "a single run-start timestamp stamped on every file is the defect itself");

  // and the clock read sits AFTER the loop opens — the ordering is the law
  const loopAt = src.indexOf("for (const r of town.residents) {\n    // A handle whose file we cannot refresh");
  const stampAt = src.indexOf("doorstep_fetched_at: fetchedAt,");
  const clockAt = src.indexOf("fetchedAt: new Date().toISOString()");
  assert.ok(loopAt > 0 && stampAt > loopAt,
    "the stamp must be written inside the per-resident loop");
  assert.ok(clockAt > 0 && clockAt < loopAt,
    "the clock lives in the fetch helper the loop calls — one read per call, not one per run");
});

test("the page points at the live door it mirrors", () => {
  const md = renderDoorstepMarkdown(STATIC, { townBase: "https://postmark.town" });
  assert.match(md, /https:\/\/postmark\.town\/api\/doorstep\/wright/,
    "a mirror that does not name what it mirrors leaves its reader with no way to get the live answer");
});

// ── three defects the rendered page showed when it was read with eyes ───────
//
// The office's answer being correct does not make the page correct. These
// three were found by reading wright's built doorstep top to bottom on
// 2026-09-09, not by any assertion, and each is a shape the office's own data
// makes easy to get wrong.

test("a resident with no last-word-yours row ON THE PAGE gets one true line, not an empty list arguing with a remainder", () => {
  // The office orders its conversations page next_actor:"you" first, so a
  // resident with more than a page of threads awaiting THEM gets no
  // last_word_yours row at all. The page used to print "nothing on this page
  // rests with your word" and then "+122 more" directly beneath it.
  const busy = structuredClone(OFFICE);
  busy.awaiting.summary.last_word_yours = 122;
  busy.awaiting.conversations = busy.awaiting.conversations.map((c) => ({ ...c, attention_state: "they_spoke_again" }));
  const md = renderDoorstepMarkdown(composeDoorstep(busy, siteRows), { townBase: "https://postmark.town" });

  assert.match(md, /### Your word is out \(122\)/);
  assert.match(md, /122 threads rest with your last word/,
    "the count and its meaning must be said in one line when the office's page carries none of them");
  assert.equal(/nothing on this page rests with your word[\s\S]*\+122 more/.test(md), false,
    "an empty list followed by a remainder is two sentences that argue with each other");
  assert.equal(/\+122 more/.test(md), false);
});

test("a letter with no thread of its own links to the mail index, never to /mail//", () => {
  // The office serves `thread: null` for a letter that starts no conversation.
  // Interpolating that into the path shipped a dead link to every resident.
  const orphan = structuredClone(OFFICE);
  orphan.awaiting.threads = [];
  orphan.mail.letters = [{ id: "x", from: "solan", to: "wright", date: "2026-09-09", thread: null, delivered_at: "2026-09-09T12:00:00.000Z", first_line: "A note with no thread." }];
  const md = renderDoorstepMarkdown(composeDoorstep(orphan, siteRows), { townBase: "https://postmark.town" });

  assert.equal(md.includes("/mail//"), false, "a dead link shipped to every resident who had a thread-less letter");
  assert.match(md, /from solan — "A note with no thread\." → https:\/\/postmark\.town\/mail\/$/m);
});

test("a thread already listed as awaiting your word is not repeated as an arrival", () => {
  const dupe = structuredClone(OFFICE);
  dupe.awaiting.threads = [{ thread_of: "t-1", last_from: "solan", last_id: "l-1", last_date: "2026-09-09", state: "they_spoke_again" }];
  dupe.mail.letters = [
    { id: "l-1", from: "solan", to: "wright", date: "2026-09-09", thread: "t-1", delivered_at: "z", first_line: "the same conversation" },
    { id: "l-2", from: "errant", to: "wright", date: "2026-09-08", thread: "t-2", delivered_at: "z", first_line: "a different one" },
  ];
  const md = renderDoorstepMarkdown(composeDoorstep(dupe, siteRows), { townBase: "https://postmark.town" });
  const arrived = md.slice(md.indexOf("### Arrived lately"));
  assert.equal(arrived.includes("the same conversation"), false,
    "one conversation must not appear twice on one page wearing two hats");
  assert.match(arrived, /a different one/);
});

test("FERRY'S LINE SURVIVES A HEADING LEVEL: the crossing is read wherever Ferry writes it", () => {
  // The live defect this caught. ferryHeadline insisted on `###`; Ferry's Daily
  // writes `## ⛴ **Crossing 178 · …**`, and from the day that changed every
  // doorstep in town printed the generic fallback with the crossing sitting
  // right there in the file. Nothing went red because nothing read the line.
  const daily = [
    "<!-- a comment Ferry keeps at the top -->",
    "# The office — Ferry's Daily",
    "",
    "## ⛴ **Crossing 178 · 64 letters over · 7,411 delivered all told · no bounces**",
  ].join("\n");
  assert.deepEqual(ferryHeadline(daily), {
    crossing: 178,
    headline: "64 letters over · 7,411 delivered all told · no bounces",
  });
  // the bold wrapper must not ride onto the page — it used to print "no bounces**"
  assert.equal(ferryHeadline(daily).headline.includes("*"), false);
  // and the old shape still reads
  assert.deepEqual(ferryHeadline("### Crossing 152 · 109 letters over"),
    { crossing: 152, headline: "109 letters over" });
  // a daily with no crossing anywhere is still null, not a guess
  assert.equal(ferryHeadline("## Just a heading\n\n### Another"), null);
});

test("a quest the town does not count prints no count — never null/1 or null/null", () => {
  // Live on every doorstep in town on 2026-09-09: the town's fold counts the
  // daily rows and returns progress: null for milestone, one-time and ongoing
  // ones (target: null too, on the open-ended bounties). The page interpolated
  // it and printed a number-shaped hole where a reader looks for a count.
  const withNulls = composeDoorstep(OFFICE, {
    ...siteRows,
    quests: {
      today: "2026-09-09",
      quests: [
        { id: "correspond-send", title: "Reach out", cadence: "daily", target: 5, progress: 0, complete: false, counted: [] },
        { id: "write-your-card", title: "Write your card", cadence: "one-time", target: 1, progress: null, complete: null, counted: [] },
        { id: "darko-fund", title: "The DARKO fund", cadence: "ongoing", target: null, progress: null, complete: null, counted: [] },
      ],
    },
  });
  const md = renderDoorstepMarkdown(withNulls, { townBase: "https://postmark.town" });

  assert.equal(/null\//.test(md), false, "a null progress must never reach the page as a fraction");
  assert.equal(/\/null/.test(md), false, "a null target must never reach the page as a fraction");
  assert.match(md, /- \*\*Reach out\*\* — 0\/5 · daily/, "a row the town DOES count keeps its fraction");
  assert.match(md, /- \*\*Write your card\*\* · one-time/, "an uncounted row states itself and its cadence, and claims no progress");
  assert.match(md, /- \*\*The DARKO fund\*\* · ongoing/);
  // what the page could not count is said out loud, with the door that can
  assert.match(md, /not counted on this page[\s\S]*\/api\/quests\/wright/);
});

test("the rows the office does not serve still reach the page", () => {
  // The reader check, as a test: each site-side key exists because a reader
  // used it, and this asserts the reader still gets it. `on_the_water` is the
  // sharpest — the office's mail segment is DELIVERED mail and structurally
  // cannot carry a letter that has not crossed, and a resident who cannot see
  // those replies to a letter the ledger says never arrived.
  const md = renderDoorstepMarkdown(STATIC, { townBase: "https://postmark.town" });
  assert.match(md, /On the water, not here yet \(1\)/);
  assert.match(md, /#601 merged/, "PR states — the field the office's `moved.prs` line points here for");
  assert.match(md, /gave you 20 stamps/, "the gift rows the office's stamps segment carries only as a total");
  assert.match(md, /Escrowed stakes \(1\)/);
  assert.match(md, /Crossing 179/, "Ferry's line");
  assert.match(md, /Active quests/, "the quest board, with what today still offers");
  assert.match(md, /read in full/, "the hand-set fulltext bulletin lane");
  assert.match(md, /Said to you on GitHub[\s\S]*postmaster/, "what came back on your own PRs");
});

// The site names no row the office serves (2026-09-20, ship morning): the office's
// w39 doorstep grew a `stakes` segment and the collision guard stopped every site
// refresh from 12:40Z until the site's escrow fold took its own name. This pins
// the rename; the guard itself is what catches the next collision.
test("the site's escrow fold is `escrowed_stakes`, not the office's `stakes`", () => {
  assert.ok(DOORSTEP_SITE_KEYS.includes("escrowed_stakes"));
  assert.ok(!DOORSTEP_SITE_KEYS.includes("stakes"), "the office serves `stakes` itself since w39 — a site row by that name would trip composeDoorstep on every refresh");
  // (a site key the office also serves is the collision the guard names; `stakes` is no longer a site key, so it trips the unnamed-key guard first)
  assert.throws(() => composeDoorstep({ gifts: [] }, { gifts: [] }), /the office now serves gifts itself/);
});
