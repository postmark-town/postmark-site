// funding.mjs — the funding seam's reader: pots, deeds, and the town's numbers.
//
// Real dollars keep the town's lights on, and what they buy is bounded by an
// amount rather than by a verb: since 2026-09-17 the stamps a gift mints do
// everything a stamp does — they stake, they vote, they pay — and rho caps
// money's share of a household. The
// ledger lane (branch seam/ledger-legs) owns the law; this file owns the
// READING of it, once, so the pages stay presentation.
//
// ── WHERE THE SHAPES COME FROM ───────────────────────────────────────────────
// Every field name below is copied from the town's own files, not invented:
//
//   the pot file      WHITE_PAGES/pot-<id>.json      (potFile() in stamp-mint.mjs)
//   the board row     quest-registry.json § <id>
//   the ledger rows   stamp-mint.mjs § THE FUNDING SEAM
//   the dials         ECONOMY-DIALS.json law_side.keeping (keepingDial())
//
// The site never reads those files directly — tools/extract-town.mjs emits
// src/data/postmark/*.json from the town checkout, exactly as it does for
// households and the ledger. Three emissions carry the seam:
//
//   pots.json      one row per (pot, epoch): the pot file's fields VERBATIM
//                  plus the per-epoch folds the ledger alone can compute.
//   deeds.json     the patron-deed rows, verbatim.
//   economy.json   the keeping dials plus the two town-wide totals the
//                  gauges need.
//
// None of the three exists yet. That is not a bug and must not become a build
// failure: every loader below fails soft to empty, and every surface renders
// its own absence honestly. The board's law holds — a number invented to look
// alive is a lie about the economy.
//
// ── HOLO IS A BALANCE (soulbound repealed, 2026-09-17) ──────────────────────
// THE FOUNDER'S RULING, verbatim: "non-spendable is repealed; the stamps are
// like any other, but are holo to signify the special source." And: "I'm good
// to let funding minted stamps contribute to the max stamps you can get from
// another fund. it compounds by design." (postmark-town/postmark#2811 § RULED.)
//
// This block said holo was soulbound — ruled 2026-08-20, enforced by row shape,
// no verbs, never a balance. That is REPEALED. In one line, wherever a surface
// needs the rule: HOLO IS FRESH MINT TO A GIVER, LIQUID LIKE ANY STAMP; THE
// WORD NAMES ITS SOURCE AND ITS INK. A holo row of n is n stamps in the payer's
// balance and in minted-cumulative; it stakes, votes, pays and transfers; and it
// counts toward their cap at the next close.
//
// The arrow-free ROW SHAPE stays, and its reason is the surviving half of the
// old one: a holo row is a MINT, not a movement, so the folds credit it by KIND.
// That is the town's own job (tools/stamp-mint.mjs § foldBalances /
// foldMintCount) and the office's numbers derive from it; nothing on this side
// of the wire computes a balance at all.
//
// SO WHAT CHANGES HERE IS THE TEACHING, NOT THE NUMBERS. The site's numbers come
// from the office's doors through tools/extract-town.mjs; they move on their own
// when the town's folds land and the office redeploys. No fixture below is
// re-pointed to fake that. HOLO_LINE ("a record of contribution, not a promise
// of profit") is untouched: it was always about money, never about spending, and
// it remains exact. The holo INK stays everywhere it is drawn — it is now the
// whole of what the word means.

import { readFileSync } from "node:fs";
import { join } from "node:path";

// ── READING THE EMISSIONS ────────────────────────────────────────────────────
// Every loader below goes through here, and it stays readFileSync rather than
// becoming a static `import x from "@/data/postmark/x.json"` like the rest of
// the site's data for one reason: a static import of a file that is not there
// is a BUILD FAILURE, and the whole posture of this module is that a missing
// emission renders as an honest absence instead of taking the site down.
//
// The cost of that choice is that `import.meta.url` cannot be trusted to locate
// the file: under `astro build` this module is bundled, and its module URL no
// longer sits beside src/data/. So both places are tried — the module's own
// neighbourhood (which is where `node --test` finds it) and the project root
// the build actually runs from. Whichever answers first wins; neither answering
// is the empty case the callers already handle.
function readEmission(name, override) {
  const candidates = override
    ? [override]
    : [new URL(`../data/postmark/${name}`, import.meta.url),
       join(process.cwd(), "src", "data", "postmark", name)];
  for (const c of candidates) {
    try { return JSON.parse(readFileSync(c, "utf8")); } catch { /* try the next */ }
  }
  return null;
}

export const HOLO_LINE = "a record of contribution, not a promise of profit";

// WHAT THE WORD IS SHORT FOR, in the founder's own sentence (2026-08-26): holo
// is short for HOLOGRAPHIC STAMPS, and the pages should teach it rather than
// leaving a reader to meet a coined syllable cold.
//
// THE PLACEMENT RULE, which is prose-budget discipline and not decoration: the
// FIRST holo mention on a page carries this expansion, worked into the sentence
// it joins; every later mention on that page stays bare "✧ holo". One page, one
// teaching. It lives here beside HOLO_LINE for the same reason HOLO_LINE does —
// one home, so a second surface cannot drift a word of it — and the falsifiers
// in funding.test.mjs assert both halves: that no page retypes the sentence,
// and that each built page carries it exactly once.
// AMENDED 2026-09-17 at the founder's ruling ("non-spendable is repealed"). The
// etymology is his 2026-08-26 sentence and stands; its closing clause — "never
// spent as postage" — was the repealed law wearing the metaphor's clothes, so
// exactly that clause moved and nothing else did.
//
// ⚠ THE OFFICE SHIPS THE TWIN OF THIS SENTENCE (postmark-office src/funding.mjs
// § HOLO_EXPANSION) and moves with it in the same sweep. NOTHING CROSS-CHECKS
// THE TWO REPOS: if one of the two PRs lands alone the town teaches two
// sentences and no suite in either repo goes red. One sentence, two repos,
// never two spellings.
export const HOLO_NAME_LINE =
  "short for holographic stamp — the collector's shiny kind, kept in the album and shown; unlike the collector's, this one still spends.";

// The one-breath answer to "what is this pot?" — the FIRST SENTENCE of the pot
// file's own prose, never invented copy. Born of the founder's 2026-08-26
// ruling on the market's cards: "THE MAIN PAGE CARDS EXPLAIN WHAT THE THING
// IS" — and the cards were leading with close mechanics instead. The full
// paragraph stays on the pot's own fund page; a card owes a reader only this.
export function potGist(source) {
  const s = String(source ?? "").trim();
  if (!s) return "";
  const m = /^.*?\.(?=\s|$)/.exec(s);
  return m ? m[0] : s;
}

// The reserved direct-to-town pot (TREASURY_POT in stamp-mint.mjs): deeds only,
// never a file, never stakes, never a close. The founding family grant is its
// first deed — dollars with no household, so holo 0.
export const TREASURY_POT = "treasury";

// ── WHOSE NAME STANDS ON A POT ───────────────────────────────────────────────
// The founder's own account. Both live pots route their dollars to it, because
// the founder pays the town's bills out of his own hand.
export const FOUNDER_ACCOUNT = "keeminlee";
export const TOWN_DISPLAY_NAME = "Postmark";

// ── WHERE A POT'S DOLLARS ACTUALLY LAND ──────────────────────────────────────
//
// The single highest-stakes strings on the site: a patron sends real,
// irreversible USDC to one of these. A drifted character is money gone.
//
// WHY THEY ARE WRITTEN OUT HERE rather than read from an emission. The office
// owns the map (postmark-office deploy/intake-addresses.json) and the office is
// a different repo — tools/extract-town.mjs reads the TOWN checkout, which does
// not carry it, and a build-time fetch of the door would make a page that asks
// for money fail to render when the box hiccups. So this is the build-time
// TWIN, and test/fund-page.test.mjs asserts every value here against a
// hand-copied second copy of the office's own file: a constant that agrees with
// itself proves nothing, and if either side moves the two stop matching.
//
// They live in this module rather than on the page because the page is
// presentation and this is the seam's reading of the town's law — the same
// reason HOLO_LINE and TREASURY_POT are here. One home, so a second surface
// that needs an address cannot grow a third copy of one.

// The standing shared intake (postmark-office src/usdc-witness.mjs INTAKE).
// Every pot's published address until 2026-08-25, and still the address for
// every pot the map does not name.
export const INTAKE = "0x2a273b0e5D0648DfF9B9ED7a4A5041E6762b8C78";

// ONE ROW PER POT, and only for a pot whose address the founder has actually
// minted. The office's map says why this exists at all, verbatim: "An ERC-20
// transfer carries no memo, so the ONLY way the chain can name a pot is for the
// pot to have its own intake address."
//
// FIRST MINTED 2026-08-25 (the founder's hand, Phantom account 2): keeping-ec2.
// Spelled in EIP-55 checksum case here because this is what a human reads off
// the page and scans out of the QR; the office compares lowercased, so the two
// are the same address and the falsifier compares them case-insensitively.
export const INTAKE_BY_POT = {
  "keeping-ec2": "0x182085453b5bC2C8Cf4cD6f712102cC3DC485fCA",
};

/**
 * The address THIS pot publishes.
 *
 * A pot with its own minted address shows it, so the chain itself names the
 * need and the patron's claim has a witness that does not depend on their word.
 * A pot without one shows the standing shared intake — which is not a fallback
 * in the apologetic sense: it is where that pot's patrons have always been
 * sent, and it stays correct until the founder mints that pot an address too.
 *
 * The office's `_never` is the reason this can never be inverted: the shared
 * address is deliberately mapped to NO pot, "because that would make the office
 * decide where a stranger's money went, which is the one judgement this whole
 * lane refuses to make."
 */
export function intakeFor(pot) {
  return INTAKE_BY_POT[String(pot)] ?? INTAKE;
}


// Ruled by the founder, 2026-08-23: a pot beneficiary that is his own account
// renders as the TOWN'S name, not his GitHub handle. The founder IS the town's
// infrastructure — the box, the plans, the hours all run through him — so the
// town's own name is the honest thing to put on the card; a personal handle
// beside a "Fund →" reads like paying a person rather than keeping a town.
//
// THIS IS A DISPLAY MAPPING AND NOTHING MORE. The pot files' `beneficiary`
// field is the routing truth and is untouched by it, here and in the town:
// deriveEpochClose still refuses a pot with no beneficiary, and the dollars
// still go where that field says. Only the label changes.
//
// Every other handle renders as itself — this maps exactly one account, so a
// second beneficiary can never be quietly relabelled as the town.
// ── WHAT A POT WOULD MINT PER DOLLAR, IF IT CLOSED THIS MOMENT ───────────────
// An estimate of stamps per dollar, for a giver deciding right now. The law it
// runs on, ECONOMY-DIALS.json § law_side.keeping (amended 2026-09-14):
//
//   "EVERY OPEN STAKE RETURNS WHOLE … the funding mint M = floor(fraction × the
//    open staked mass) is minted fresh to the payers by dollar share of the
//    roll … Nothing burns."
//
// so at a close the givers share the staked mass the dollars funded. Spread
// across the dollars that will share it, that is:
//
//   an epoch pot     stamps per dollar ≈ staked ÷ the posted target
//                    (each dollar funds one target's-worth of the mass; intake
//                    refuses dollars past the target, so the roll never exceeds it)
//   an elastic pot   stamps per dollar ≈ staked ÷ max(roll, floor)
//                    (the roll is fully funded once it holds its floor)
//
// The floor is in the denominator because a close cannot run below it: until
// the roll reaches it, the dollars that would share the mass are the floor's
// worth, not today's smaller roll. Using the bare roll would quote a giver a
// number that shrinks the moment anyone else gives, which is the opposite of
// what the estimate is for.
//
// BEFORE THE CAP and before the household exclusion: the estimate is the mass
// shared by dollar, and a giver's own stakes, or a cap of ρ × a thin earned
// base, can only lower it. EVERY INPUT IS READ — staked and the roll from the
// pot row, the target and the floor from the pot file. No dial is in this path
// since the σ leg retired: there is no burn to split.
//
// It returns null rather than a zero whenever the estimate would be a fiction:
// nothing staked, or a pot that has no close to run.
export function mintPerDollar(pot) {
  if (!pot || !pot.closes) return null;
  const staked = Number(pot.staked ?? 0);
  if (!Number.isFinite(staked) || staked <= 0) return null;
  const target = pot.target != null ? Number(pot.target) : null;
  const floor = pot.minCloseUsd != null ? Number(pot.minCloseUsd) : null;
  const denom = target != null && target > 0
    ? target
    : Math.max(Number(pot.received ?? 0), floor ?? 0, 1);
  return Math.round((staked / denom) * 10) / 10;
}

export function beneficiaryLabel(beneficiary) {
  if (typeof beneficiary !== "string" || !beneficiary.trim()) return null;
  const who = beneficiary.trim();
  return who === FOUNDER_ACCOUNT ? TOWN_DISPLAY_NAME : who;
}

// A RESIDENT HANDLE'S SHAPE, from postmark-office src/residency.mjs: lowercase
// letters, digits and single hyphens. Written out here rather than imported —
// the office is a different repo, and a constant that agrees with itself proves
// nothing (the same reasoning the intake addresses are held to in
// test/fund-page.test.mjs).
const HANDLE_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * WHO PAID, as the roll should say it — and whether the town could attach the
 * dollars to a hand at all.
 *
 * Told BY SHAPE, with no list to consult, because the office chose the spelling
 * precisely so it could be. postmark-office tools/stripe-watch.mjs, verbatim:
 * "`outside:stripe` is chosen because a handle can never look like it:
 * `isResidentHandle` admits only `[a-z0-9-]`, so a colon makes the string
 * unmintable as a name. A future reader can therefore tell an unattached gift
 * from an attached one by shape alone, with no list to consult."
 *
 * WHY IT GETS A LINE RATHER THAN A TOTAL. An unattached gift is real money that
 * reached the town and was witnessed on the public ledger. Showing only the
 * named patrons and folding the rest into the sum would hide a gift behind the
 * arithmetic: the pot's number would stop adding up in public, and the one
 * patron the town could not thank by name would be the one it did not show. So
 * the roll carries every receipt, and an unattached one says what it is —
 * including that it minted no holo, which is the honest half of the same fact.
 */
export function patronLabel(patron) {
  const who = String(patron ?? "").trim();
  const attached = HANDLE_RE.test(who);
  return {
    patron: who,
    attached,
    // the resident's own name when the town has one, and otherwise a phrase
    // that describes what happened rather than a handle nobody holds
    label: attached ? who : "an outside gift",
    href: attached ? `/residents/${who}/` : null,
  };
}

// POT_ID_CLASS / EPOCH_CLASS, from the seam's own regexes.
const POT_ID_RE = /^[a-z0-9][a-z0-9-]*$/;
const EPOCH_RE = /^\d{4}-\d{2}$/;
const FIRST_CLOSE_RE = /^\d{4}-\d{2}-\d{2}$/;

const MONTHS = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

// The first close, as a sentence rather than a date stamp — "end of September".
//
// ONE formatter, because the epoch label, the fund page and the board all name
// this same moment, and a date formatted three times is three chances to
// disagree about when a patron's money converts.
//
// "end of <Month>" is said only when the date IS the month's last day, which is
// what the founder's ruling describes ("the first month closes at the END of
// September"). Any other day gets the plain date instead of being rounded into
// a phrase that would be false — a close on the 12th is not the end of anything.
// "2026-09" → "September 2026". The epoch a surface NAMES, for the places that
// are speaking to a reader rather than stamping a row; the raw YYYY-MM stays the
// identity everywhere it is one.
export function epochLabel(epoch) {
  const s = String(epoch ?? "").trim();
  if (!EPOCH_RE.test(s)) return null;
  const [y, m] = s.split("-").map(Number);
  return m >= 1 && m <= 12 ? `${MONTHS[m - 1]} ${y}` : null;
}

export function firstCloseLabel(firstClose) {
  const s = String(firstClose ?? "").trim();
  if (!FIRST_CLOSE_RE.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (m < 1 || m > 12) return null;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return d === lastDay ? `end of ${MONTHS[m - 1]}` : `${d} ${MONTHS[m - 1]}`;
}

// The pot file's `status`. A pot is not live until the founder opens it — see
// livePots() for why `draft` never reaches the board.
export const POT_STATUSES = ["draft", "open", "closed"];

const isNum = (v) => Number.isFinite(Number(v)) && String(v).trim() !== "";
const int = (v) => Number(v);

// ── deeds ────────────────────────────────────────────────────────────────────
// The durable patron record, one row per witnessed payment. From the grammar:
//
//   - <date> · patron-deed · pot:<pot> · patron: <payer> · usd: <n> ·
//     epoch:<epoch> · ref: <ref> · holo: <h>
//
// so a deed carries exactly: date, pot, patron, usd, epoch, ref, holo. `holo`
// may be 0 and often is — grant, treasury, and outside dollars land as deed
// alone. A zero-holo deed is a full deed, never a lesser one: the dollars were
// witnessed either way, and that is what a deed is for.
//
// `title` is the ONE joined-in field: the pot file's own title, carried across
// by the emitter so the shelf can say what was funded without the site holding
// a second copy of the pot list. Absent, the pot id stands in — a deed that
// cannot name its pot's title is still a true deed.
export function loadDeeds({ path = null } = {}) {
  // no emission yet — an empty shelf is honest; a build failure is not
  const raw = readEmission("deeds.json", path);
  return Array.isArray(raw) ? raw.filter(deedReads).map(toDeed) : [];
}

// A deed that cannot say who paid, into what, how much, and when is not
// rendered half-said. Dropped quietly: deeds are receipts, and a torn receipt
// proves nothing.
export function deedReads(d) {
  return Boolean(d &&
    typeof d.patron === "string" && d.patron.trim() &&
    typeof d.pot === "string" && (d.pot === TREASURY_POT || POT_ID_RE.test(d.pot)) &&
    /^\d{4}-\d{2}-\d{2}$/.test(String(d.date ?? "")) &&
    EPOCH_RE.test(String(d.epoch ?? "")) &&
    isNum(d.usd) && int(d.usd) > 0 &&
    isNum(d.holo) && int(d.holo) >= 0);
}

export function toDeed(d) {
  return {
    date: String(d.date).slice(0, 10),
    pot: String(d.pot),
    patron: String(d.patron),
    usd: int(d.usd),
    epoch: String(d.epoch),
    ref: String(d.ref ?? ""),
    holo: int(d.holo),
    // what was funded, in words — the pot's title, or the pot's name itself
    what: String(d.title ?? "").trim() ||
      (d.pot === TREASURY_POT ? "the town, direct" : String(d.pot)),
  };
}

// One patron's shelf, newest first. Keyed on `patron` — the ledger's word for
// the hand that paid.
export function deedsFor(patron, deeds) {
  return (Array.isArray(deeds) ? deeds : [])
    .filter((d) => d.patron === patron)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) ||
      String(a.pot).localeCompare(String(b.pot)));
}

// What a shelf adds up to. Dollars sum; holo sums as a RECORD, never as a
// balance — the shelf shows a total the way a stack of receipts has a total,
// and the line under it says so.
export function shelfTotals(shelf) {
  return (Array.isArray(shelf) ? shelf : []).reduce(
    (t, d) => ({ usd: t.usd + d.usd, holo: t.holo + d.holo }), { usd: 0, holo: 0 });
}

// ── pots ─────────────────────────────────────────────────────────────────────
// One row per (pot, epoch). The pot FILE is per-pot and ongoing — cadence
// monthly, a target per epoch — so the epoch is what makes a row: the open
// month renders as open, and months already closed render as closed beside it.
//
// From the pot file, verbatim:
//   pot                   the id (also the file's name: pot-<id>.json)
//   subtype               "bounty"
//   status                draft | open | closed
//   title                 the board's headline for it
//   source                the prose: what the money is for
//   target_usd_per_epoch  whole dollars asked, per epoch — or null, but ONLY on
//                         an uncapped pot (see `uncapped` below)
//   uncapped              D5's exception (ECONOMY-DIALS.json law_side.keeping
//                         ._intake_cap, quoted): "intake refuses dollars past a
//                         pot's posted target, mechanically (recording tool /
//                         door bounce), except pots explicitly marked uncapped."
//                         The Darko donation box is the standing case: a box
//                         with no target, where whatever arrives is welcome.
//   epoch_cadence         "monthly"
//   beneficiary           who the dollars serve (never stamps — §8 reserves
//                         "keeper" for the keeping-stakers), or null until
//                         the founder names one
//   received_usd          dollars witnessed (display only — the ledger's
//                         pot-receipt rows are authoritative)
//   board                 where its row lives in quest-registry.json
//
// Folded from the ledger by the emitter, because only the ledger can know them:
//   epoch                 the epoch this row is about (YYYY-MM)
//   staked                open `stake:pot/<pot>` positions, in ✦ — the escrow
//   patrons               the roll, from this epoch's patron-deed rows:
//                         [{ patron, usd, holo }]
export function toPot(raw) {
  const bad = (reason) => ({ ok: false, id: String(raw?.pot ?? "(unnamed)"), reason });

  const pot = String(raw?.pot ?? "").trim();
  if (!pot) return bad("no pot id");
  if (!POT_ID_RE.test(pot)) return bad(`pot id ${JSON.stringify(pot)} is not a slug`);
  if (pot === TREASURY_POT) return bad(`"${TREASURY_POT}" is the reserved direct-to-town pot — deeds only, never a board row`);

  const title = String(raw.title ?? "").trim();
  if (!title) return bad("no title");

  const status = String(raw.status ?? "").trim();
  if (!POT_STATUSES.includes(status)) return bad(`status must be ${POT_STATUSES.join(", ")} (got ${JSON.stringify(raw.status)})`);

  const epoch = String(raw.epoch ?? "").trim();
  if (!EPOCH_RE.test(epoch)) return bad(`epoch must be YYYY-MM (got ${JSON.stringify(raw.epoch)})`);

  // THE POSTED NEED, and its ONE lawful absence. A capped pot without a whole
  // dollar target is broken — stamp-mint.mjs's deriveEpochClose refuses it in
  // the town for the reason the site refuses it here: "the funded fraction is
  // priced against the posted need, never against the staked mass". An UNCAPPED
  // pot has no need to post, by D5's own exception, so null is its true value
  // and not a missing one.
  const uncapped = raw.uncapped === true;
  const target = raw.target_usd_per_epoch;
  const targetless = target === null || target === undefined;
  if (uncapped && !targetless && (!isNum(target) || !Number.isInteger(int(target)) || int(target) < 1))
    return bad(`target_usd_per_epoch must be a whole number ≥ 1 or null (got ${JSON.stringify(target)})`);
  if (!uncapped && (!isNum(target) || !Number.isInteger(int(target)) || int(target) < 1))
    return bad(`target_usd_per_epoch must be a whole number ≥ 1 (got ${JSON.stringify(target)})`);

  const received = isNum(raw.received_usd) ? int(raw.received_usd) : 0;
  if (received < 0) return bad("received_usd is negative");

  const close = typeof raw.close === "string" && raw.close.trim() ? raw.close.trim() : null;

  // null is a REAL state, not a missing field: deriveEpochClose refuses to
  // close a pot with no beneficiary, so an unnamed beneficiary is a thing the
  // board should say out loud rather than a reason to drop the row.
  const beneficiary = typeof raw.beneficiary === "string" && raw.beneficiary.trim()
    ? raw.beneficiary.trim() : null;

  // The roll. An entry that cannot name its hand and its dollars is dropped —
  // the pot still reads; a torn line on the roll does not tear the pot. holo
  // defaults to 0 because 0 is a real answer here, not a missing one.
  const patrons = (Array.isArray(raw.patrons) ? raw.patrons : [])
    .filter((p) => p && typeof p.patron === "string" && p.patron.trim() && isNum(p.usd) && int(p.usd) > 0)
    .map((p) => ({ patron: String(p.patron), usd: int(p.usd), holo: isNum(p.holo) ? int(p.holo) : 0 }))
    .sort((a, b) => b.usd - a.usd || a.patron.localeCompare(b.patron));

  return {
    ok: true,
    id: `${pot}@${epoch}`,
    pot,
    epoch,
    title,
    // the pot file's prose. Not required — a pot with a title and no source is
    // thin, not broken.
    source: String(raw.source ?? "").trim(),
    subtype: String(raw.subtype ?? "bounty"),
    status,
    // null is a REAL state, not a missing field: deriveEpochClose refuses to
    // close a pot with no beneficiary, so an unnamed beneficiary is a thing
    // the board should say out loud rather than a reason to drop the row.
    beneficiary,
    // WHAT A READER SEES instead of the routing handle. `beneficiary` above is
    // the routing truth and is never rewritten — this is the label beside it.
    beneficiaryLabel: beneficiaryLabel(beneficiary),
    cadence: String(raw.epoch_cadence ?? "").trim() || null,
    uncapped,
    // ── WHAT A CLOSE DOES HERE ───────────────────────────────────────────
    // The pot file's own word, and the thing every money surface branches on.
    // Three are spelled by the law so far:
    //
    //   "none"     the standing box. "a standing box, not an epoch pot — gifts
    //              are witnessed, never converted; nothing here ever burns or
    //              mints" (pot-darko-fund.json § _close, as it read on the
    //              morning of 2026-08-23).
    //   "elastic"  the roll that carries forward. Ruled the same day, the later
    //              sitting: "a month's close runs only if the accumulated roll
    //              — carried dollars plus this month's — totals at least
    //              min_close_usd; otherwise dollars and stakes both stand and
    //              ride to the next month … Nothing is ever refused at intake."
    //   "epoch"    the monthly pot. pot-keeping-ec2.json § source (amended
    //              2026-09-14): "At each month's close every stake comes home
    //              whole, and the stakes size the reward: the share of the
    //              staked mass that the month's dollars funded is minted fresh
    //              to the givers by dollar share, per the keeping law
    //              (ECONOMY-DIALS.json law_side.keeping)". The prose always
    //              ruled it; the WORD was made explicit 2026-08-25, after this
    //              page and the MCP's fund read derived the same silent pot in
    //              opposite directions.
    //   absent     the emission has not said. NOT the same as "none", and the
    //              surfaces must not treat it as one — see `closes`.
    close,
    // The ceremony's floor, in whole dollars — how much the accumulated roll
    // must reach before an elastic close RUNS. § _min_close: "the ceremony's
    // floor, never the door's: intake refuses nothing — the floor gates only
    // whether a month's close RUNS. Owner of the number: this file; every
    // surface reads it." So it is read, never written down: null when the
    // emission has not carried it, and a surface that cannot name the floor
    // says the roll carries forward without naming one.
    //
    // A torn floor does not tear the pot, for the same reason a torn line on
    // the roll does not: the pot is still true, and dropping it would hide a
    // live need over a display number.
    minCloseUsd: isNum(raw.min_close_usd) && int(raw.min_close_usd) >= 1
      ? int(raw.min_close_usd) : null,
    // WHEN THE FIRST MONTH CLOSES, in the pot file's own words — the field the
    // epoch above is derived from when a pot was posted early. § _first_close:
    // "the first epoch ROUNDS FORWARD — the first month closes at the END of
    // September; dollars arriving before then all belong to the 2026-09 epoch.
    // Surfaces render the epoch from this field, not from the posting date."
    //
    // Carried as the raw date AND as the sentence a reader gets, because every
    // surface that says it would otherwise format it again, and a date
    // formatted three ways is three chances to disagree about when a patron's
    // money converts.
    firstClose: FIRST_CLOSE_RE.test(String(raw.first_close ?? "").trim())
      ? String(raw.first_close).trim() : null,
    firstCloseLabel: firstCloseLabel(raw.first_close),
    epochLabel: epochLabel(epoch),
    // DERIVED, and deliberately not stored: whether a close can ever run on
    // this pot. THE EXPLICIT WORD IS PRIMARY, both ways — "elastic" and
    // "epoch" close, and "none" does not close even if a target were posted.
    // Only when the emission is silent does the pot's own target answer,
    // because the law ties those two together: "A pot with no target cannot
    // close" (pot-keeping-ec2.json § _target). The silent fallback is for the
    // pots that have not said yet, and for nothing else.
    //
    // Note what this boolean CANNOT carry: the difference between "the town
    // said this never closes" and "the town has not said". Both read false,
    // and a surface that renders the first sentence for the second case is
    // making a confident claim the record does not support. The surfaces
    // branch on `close` for their words and use this only for the shape.
    closes: close === "none" ? false
      : close === "elastic" || close === "epoch" ? true
      : !targetless,
    // When the emission that produced this row was made. The pots block renders
    // an "as of" from it, because a quiet market and a stale page look the same
    // without one. Null on an emission that predates the field.
    generatedAt: typeof raw.generated_at === "string" && raw.generated_at.trim()
      ? raw.generated_at.trim() : null,
    // null on an uncapped pot is a REAL state the surfaces must say out loud —
    // the fund page's standing-box branch reads exactly this.
    target: targetless ? null : int(target),
    received,
    patrons,
    staked: isNum(raw.staked) ? int(raw.staked) : 0,
    // WHO holds that escrow — and NULL is not the empty list here.
    //
    // An emission that predates this field (every pots.json in the tree until
    // the next extract runs) cannot say who staked, and a page that answered
    // "nobody has staked on this pot" from a field that was never emitted would
    // be stating as fact something it never looked at — over a pot that has
    // seven stakers on the ledger this minute. So absent reads `null` ("this
    // emission did not say") and an emitted empty list reads `[]` ("it looked,
    // and nobody has"). The fund page renders a sentence for the second and
    // nothing at all for the first, which is what keeps the deploy order safe.
    //
    // Same drop rule as the roll: a torn entry goes, the pot still reads. Same
    // sort as the emitter's, restated here because a hand-written fixture or an
    // older emission is under no obligation to have sorted anything.
    stakers: Array.isArray(raw.stakers)
      ? raw.stakers
        .filter((s) => s && typeof s.handle === "string" && s.handle.trim() && isNum(s.staked) && int(s.staked) > 0)
        .map((s) => ({ handle: String(s.handle), staked: int(s.staked) }))
        .sort((a, b) => b.staked - a.staked || a.handle.localeCompare(b.handle))
      : null,
    // Clamped for the bar's width only; `received` stays raw so an over-fed pot
    // reads as over-fed rather than as merely full. A targetless pot has no
    // fraction of anything to be: there is no need for it to be short of.
    progress: targetless ? null : Math.min(1, received / int(target)),
  };
}

// The pots, read and sorted: open first (the ones you can still feed), then
// closed, newest epoch first within each.
export function pots(rows) {
  const rank = { open: 0, closed: 1, draft: 2 };
  const good = [], malformed = [];
  for (const raw of Array.isArray(rows) ? rows : []) {
    const p = toPot(raw);
    if (p.ok) good.push(p); else malformed.push(p);
  }
  good.sort((a, b) =>
    (rank[a.status] - rank[b.status]) ||
    String(b.epoch).localeCompare(String(a.epoch)) ||
    a.pot.localeCompare(b.pot));
  return { pots: good, malformed };
}

// What the BOARD may show. A draft pot is not a pot the town has asked you for
// — the live pot file says so in its own words ("DRAFT / DEV FIXTURE — NOT
// LIVE"), and epoch-close refuses any pot whose status is not `open`. Opening
// one is the founder's word, never a merge. So drafts are held back and
// counted, exactly as the board holds back a notice it cannot read: rendering
// one would be the site asking for money the town has not asked for.
export function livePots(rows) {
  const { pots: all, malformed } = pots(rows);
  return {
    pots: all.filter((p) => p.status !== "draft"),
    drafts: all.filter((p) => p.status === "draft"),
    malformed,
  };
}

export function loadPots({ path = null } = {}) {
  const raw = readEmission("pots.json", path);
  return Array.isArray(raw) ? raw : [];
}

// ── the town's numbers ───────────────────────────────────────────────────────
// economy.json — the keeping dials, copied from ECONOMY-DIALS.json law_side
// .keeping under their own names, plus the two town-wide totals the gauges
// need and only the ledger can fold:
//
//   {
//     "as_of":                     "YYYY-MM-DD",
//     "sigma":                     0.5,    — the epoch-close split
//     "rho":                       0.25,   — the holo cap ratio
//     "rho_constitutional_ceiling": 0.5,   — ρ may never exceed this
//     "treasury_usd":              175,    — dollars the town holds
//     "primary_mint_earned":       2400,   — earned primary mint, ✦, town-wide
//     "primary_mint_fold":  "foldPrimaryMint",  — which town fold answered it
//     "holo_issued":               19      — holo ever minted (never burned)
//   }
//
// WHAT THE TWO DIALS ACTUALLY MEAN (as amended 2026-09-14/15 — nothing burns
// anywhere in the town; the pre-amendment text stands in this file's history):
//
//   σ is the DELIVERER'S FRACTION at a bounty's conversion. ECONOMY-DIALS.json
//   law_side.conversion._deliverer_paid, quoted: "the deliverer is minted fresh
//   floor(sigma x M), liquid — a wage" where M is the standing stakes, every
//   one of which returns whole. σ has NO LEG IN A POT'S CLOSE since 2026-09-14
//   (law_side.keeping._sigma: "there is no burn to split").
//
//   A POT'S CLOSE, law_side.keeping._what, quoted: "EVERY OPEN STAKE RETURNS
//   WHOLE (pot-return rows); the funding mint M = floor(fraction × the open
//   staked mass) is minted fresh to the payers by dollar share of the roll, a
//   payer's own household's stakes excluded from the mass sized for that payer,
//   floors per payer, the remainder un-minted; and a household's funding mint
//   from one close is capped at rho × its earned base. Nothing burns." The
//   givers' reward is ordinary liquid mint, source-tagged `for: funding:<pot>`
//   (_holo: "RETIRED for the funding seam 2026-09-14"); the keeping mint and
//   the σ leg are retired with the burn (_keeping_mint).
//
//   The emission's `keeping_mint` and `holo_issued` fields stay: they are the
//   RECORD's shape (no close ever ran under the old rule, so both read 0), and
//   readEconomy keeps folding them so a ledger that carries the rows renders
//   them honestly. The close's own emission shape under the amended rule is
//   POS-33's lane (tools/epoch-close.mjs rebuilt against the amended close);
//   the fixture below still tells the pre-amendment story for exactly that
//   reason — it is coherent with the emitter as it stands, not with the law.
//
//   There is no dollar↔stamp rate anywhere in the seam (law_side.keeping
//   ._no_rate): a pot's dollars are priced against its OWN posted need,
//   funded_fraction = min(1, non-treasury dollars ÷ target_usd_per_epoch), and
//   the funded fraction of the staked mass is what the givers share. A fully
//   funded pot lends its whole staked mass, however large the pile — the town
//   prices money by how much it stakes.
//
//   ρ is the FUNDING-MINT CAP (law_side.keeping._rho_owner, re-aimed
//   2026-09-14: "rho caps the FUNDING MINT — a household's fresh mint from one
//   close ≤ rho × its earned base (the rho base = earned primary mint)"). The
//   holoCap this module folds is the same multiplication over the record's
//   base and is what the holo gauges read. ρ may never exceed the
//   constitutional ceiling of 0.5 — keepingDial() refuses a dial that tries.
//   It is NOT the treasury's take.
//
//   ⚠ THE BASE MOVED 2026-09-17, on the founder's word: "I'm good to let
//   funding minted stamps contribute to the max stamps you can get from another
//   fund. it compounds by design." The ρ base is now the mint from EVERY source,
//   holo included — so holo counts toward its own cap and the ceiling rises as
//   the town gives. `readEconomy` folds that base and returns it as `capBase`,
//   beside the cap it produced, because a cap nobody can check is not a cap.
//
//   ρ's VALUE is not written anywhere on this site, and that is deliberate.
//   R10: "Owner of the number: `ECONOMY-DIALS.json § law_side.keeping.rho`;
//   every other surface reads it rather than restating it." The pages render
//   whatever the emitted economy.json carries, and every sentence about ρ is
//   written to stay true when the dial moves — so a ballot that lowers ρ needs
//   no copy edit anywhere.
//
// So the town-wide holo cap is DERIVED here rather than stored: it is the law's
// own formula, ρ × earned primary mint, and a stored copy could only ever drift
// away from it.
export function loadEconomy({ path = null } = {}) {
  // the ledger has not published yet — the page says so rather than inventing
  return readEmission("economy.json", path);
}

// Normalize into the page's dials, or null when any of them is missing. Half a
// set of numbers rendered as the town's would be a quieter lie than the honest
// "not published yet".
export function readEconomy(raw) {
  if (!raw) return null;
  const dial = (v) => (isNum(v) ? Number(v) : null);
  const sigma = dial(raw.sigma);
  const rho = dial(raw.rho);
  const ceiling = dial(raw.rho_constitutional_ceiling);
  const treasuryUsd = dial(raw.treasury_usd);
  const primaryMint = dial(raw.primary_mint_earned);
  // keeping mint counts in the cap base (R12, Keemin 2026-08-21: keeping-mint
  // is "treated like anything else" — the holo cap base = earned primary mint
  // + keeping mint). Absent field reads 0: emissions older than S4's
  // keeping_mint fold still render, at the narrower base they were built on.
  const keepingMint = dial(raw.keeping_mint) ?? 0;
  const holoIssued = dial(raw.holo_issued);
  // ⚠ WHICH FOLD ANSWERED `primary_mint_earned`, and why this read needs to know
  // (2026-09-17). After postmark-town/postmark#2886 the town's `foldMintCount`
  // counts holo, so the extractor calls `foldPrimaryMint` when the checkout has
  // it and says so here. Absent — every emission written before this field —
  // means `foldMintCount` answered, and before the merge that fold cannot see an
  // arrow-free holo row, so the number is primary alone either way.
  //
  // The one case the flag exists for: a checkout PAST the merge that lacks the
  // new export. There `primary_mint_earned` already carries holo, and adding
  // `holo_issued` to the cap base below would count it TWICE.
  const primaryCarriesHolo = raw.primary_mint_fold === "foldMintCount" && holoIssued > 0;
  if ([sigma, rho, ceiling, treasuryUsd, primaryMint, holoIssued].some((v) => v == null)) return null;

  // keepingDial's own refusal, mirrored: a dial that breaks the constitutional
  // ceiling is not a dial to render, it is a dial to report as unreadable. The
  // page then says the numbers have not published — which is true, because a
  // ρ past the ceiling would never have closed an epoch in the first place.
  if (!(sigma > 0 && sigma < 1) || rho < 0 || rho > ceiling) return null;

  // ⚠ RE-AIMED 2026-09-17 at the founder's word, verbatim: "I'm good to let
  // funding minted stamps contribute to the max stamps you can get from another
  // fund. it compounds by design." The ρ base was earned primary mint (+ keeping
  // mint, R12); it is now the mint from EVERY source, holo included — so holo
  // enters its own cap's base and the cap rises as the town gives. Under the old
  // base a town that had only ever minted holo could mint no more of it; that is
  // the sentence the founder repealed.
  //
  // `holoIssued` is added only when `primary_mint_earned` does not already
  // carry it (see `primaryCarriesHolo` above). Both spellings of the base are
  // the same number until the first close, because the ledger holds 0 holo rows.
  const capBase = primaryMint + keepingMint + (primaryCarriesHolo ? 0 : holoIssued);
  const holoCap = Math.floor(rho * capBase);
  return {
    asOf: String(raw.as_of ?? "").slice(0, 10) || null,
    sigma, rho, rhoCeiling: ceiling,
    treasuryUsd, primaryMint, holoIssued, holoCap, capBase,
    // the backing gauge: dollars the town holds per ✧ ever minted. Holo is
    // never burned, so issued IS the cumulative mint. A fact about the
    // treasury, never a redemption promise.
    backing: holoIssued > 0 ? treasuryUsd / holoIssued : null,
    // headroom against the cap, for the gauge's width
    capUsed: holoCap > 0 ? Math.min(1, holoIssued / holoCap) : null,
    overCap: holoCap > 0 && holoIssued > holoCap,
  };
}

// ── FIXTURES — dev (SEAM_FIXTURE=1 / `?fixture`) and tests ONLY ──────────────
// Everything below is invented, but invented COHERENTLY: the deeds, the roll,
// the balances and the dials are the same story told four ways, so the fixture
// is a live check that the surfaces can agree with each other and with the law.
// test/funding.test.mjs asserts that agreement — if a fixture drifts, the tests
// go red rather than the pages going quietly wrong.
//
// None of it is reachable on postmark.town: every page gates on
// import.meta.env.DEV. A fixture that can appear on the live site is a lie
// about what was actually funded.
//
// THE STORY — told in the PRE-AMENDMENT emission shape. The fixture's closed
// pot was cut under the law as it stood before 2026-09-14 (the funded share
// burned and split); that is still the shape the emitter cuts until POS-33
// rebuilds the close, so the fixture stays coherent with the emitter and with
// itself, not with the amended law. No live pot has ever closed under either.
// keeping-ec2 (the town's box, $150/mo) closed 2026-08 at target.
// $150 witnessed from three patrons; 40✦ of staked escrow burned; σ=0.5 split
// it 20 minted back to the stakers, source-tagged for keeping / 20 into the
// payers' holo pool, shared by dollar:
//   wright  $60 → floor(20 × 60/150) = 8✧
//   alden   $50 → floor(20 × 50/150) = 6✧
//   rei     $40 → floor(20 × 40/150) = 5✧
// 8+6+5 = 19, so 1✧ of the pool burned un-minted — the seam keeps the change,
// visible in the fixture rather than merely asserted in a comment.

export const POT_FIXTURE = [
  // the open month: fed, but not yet at target
  {
    pot: "keeping-ec2", subtype: "bounty", status: "open",
    title: "Keep the lights on — the town box",
    source: "The town runs on a real machine with a real monthly bill (~$150/mo). Stake stamps to say the box matters to you; witnessed dollars close the month.",
    target_usd_per_epoch: 150, epoch_cadence: "monthly",
    beneficiary: "the-town/the-box", received_usd: 90,
    close: "epoch", first_close: "2026-09-30",
    board: "quest-registry.json § keeping-ec2",
    epoch: "2026-09", staked: 12,
    patrons: [
      { patron: "wright", usd: 40, holo: 0 },
      { patron: "alden", usd: 30, holo: 0 },
      { patron: "rei", usd: 20, holo: 0 },
    ],
  },
  // the month after: open and untouched — the zero-received state
  {
    pot: "keeping-ec2", subtype: "bounty", status: "open",
    title: "Keep the lights on — the town box",
    source: "October's month of the box — same machine, next epoch.",
    target_usd_per_epoch: 150, epoch_cadence: "monthly",
    beneficiary: "the-town/the-box", received_usd: 0,
    close: "epoch", first_close: "2026-09-30",
    board: "quest-registry.json § keeping-ec2",
    epoch: "2026-10", staked: 0, patrons: [],
  },
  // the month already closed: the roll carries the holo the close minted
  {
    pot: "keeping-ec2", subtype: "bounty", status: "closed",
    title: "Keep the lights on — the town box",
    source: "August's month of the box, closed at target.",
    target_usd_per_epoch: 150, epoch_cadence: "monthly",
    beneficiary: "the-town/the-box", received_usd: 150,
    close: "epoch", first_close: "2026-09-30",
    board: "quest-registry.json § keeping-ec2",
    epoch: "2026-08", staked: 0,
    patrons: [
      { patron: "wright", usd: 60, holo: 8 },
      { patron: "alden", usd: 50, holo: 6 },
      { patron: "rei", usd: 40, holo: 5 },
    ],
  },
  // THE ELASTIC POT — the roll that carries forward. No target and no cap, so
  // no bar; but unlike the standing box below it DOES close, once the
  // accumulated roll reaches its own floor. The live case is the DARKO fund,
  // re-ruled 2026-08-23 (town main 796d775d). Fed under its floor on purpose:
  // $2 against a $5 floor is the state the card most needs to render honestly,
  // because it is the one where a giver has paid and nothing has happened yet.
  {
    pot: "darko-fund", subtype: "bounty", status: "open",
    title: "The DARKO fund — the donation box",
    source: "The founder is the town's infrastructure. Stake stamps to say the keeping of the founder matters; dollars given here are witnessed as receipts. No target, no cap.",
    target_usd_per_epoch: null, epoch_cadence: "monthly", uncapped: true,
    beneficiary: "keeminlee", received_usd: 2,
    close: "elastic", min_close_usd: 5,
    board: "quest-registry.json § darko-fund",
    epoch: "2026-09", staked: 4,
    patrons: [{ patron: "iris", usd: 2, holo: 0 }],
  },
  // THE SAME ROLL, PAST ITS FLOOR. The elastic pot has two visibly different
  // states and only one of them was renderable: under the floor the bar fills
  // toward a close, and over it the bar is full while the roll keeps climbing,
  // because the floor gates the ceremony and never the door. A fixture that
  // could only show the first would leave the second drawn by nobody.
  {
    pot: "darko-fund", subtype: "bounty", status: "open",
    title: "The DARKO fund — the donation box",
    source: "A later month of the same box, past its close floor and still taking.",
    target_usd_per_epoch: null, epoch_cadence: "monthly", uncapped: true,
    beneficiary: "keeminlee", received_usd: 7,
    close: "elastic", min_close_usd: 5,
    board: "quest-registry.json § darko-fund",
    epoch: "2026-10", staked: 4,
    patrons: [{ patron: "iris", usd: 2, holo: 0 }, { patron: "orvet", usd: 5, holo: 0 }],
  },
  // THE STANDING BOX — the shape that never closes at all. Nothing live wears
  // it since the DARKO box learned the elastic close, and it stays in the
  // fixture for exactly that reason: a rendering that is dropped the moment
  // nothing wears the shape is a rendering that breaks the next time something
  // does. "a standing box, not an epoch pot — gifts are witnessed, never
  // converted; nothing here ever burns or mints".
  {
    pot: "keeping-tin", subtype: "bounty", status: "open",
    title: "The tin by the door — whatever you like",
    source: "A box with no target and no close. Gifts are witnessed on the ledger and left at that.",
    target_usd_per_epoch: null, epoch_cadence: "monthly", uncapped: true,
    beneficiary: "the-town/the-tin", received_usd: 12, close: "none",
    board: "quest-registry.json § keeping-tin",
    epoch: "2026-09", staked: 0,
    patrons: [{ patron: "orvet", usd: 12, holo: 0 }],
  },
  // THE EMISSION THAT HAS NOT SAID. Targetless with no `close` word at all —
  // the shape the live emission wears right now, because sync-atlas.yml runs
  // MAIN's emitter and main has not taken the passthrough yet. It must not
  // render as the standing box: "nothing ever mints back" is a confident claim
  // the record does not support here.
  {
    pot: "keeping-unsaid", subtype: "bounty", status: "open",
    title: "A pot whose close the record has not stated",
    source: "Targetless, and the emission carries no close word for it.",
    target_usd_per_epoch: null, epoch_cadence: "monthly", uncapped: true,
    beneficiary: "the-town/the-unsaid", received_usd: 0,
    board: "quest-registry.json § keeping-unsaid",
    epoch: "2026-09", staked: 0, patrons: [],
  },
  // a pot the founder has NOT opened. The board must never render this one —
  // livePots() holds it back, and the tests prove it.
  {
    pot: "keeping-domains", subtype: "bounty", status: "draft",
    title: "The town's names — domains and certificates",
    source: "DRAFT — not opened. Opening a pot is the founder's word, not a merge.",
    target_usd_per_epoch: 60, epoch_cadence: "yearly",
    beneficiary: null, received_usd: 0,
    board: "quest-registry.json § keeping-domains",
    epoch: "2026-09", staked: 0, patrons: [],
  },
];

// The patron-deed rows behind that story, plus one treasury deed — dollars
// straight to the town, which match nothing and mint nothing, so holo is 0.
// The zero-holo deed is the case the shelf most needs to render honestly.
export const DEEDS_FIXTURE = [
  {
    date: "2026-08-31", pot: "keeping-ec2", patron: "wright", usd: 60,
    epoch: "2026-08", ref: "stripe:pi_3QkR7fEXAMPLE", holo: 8,
    title: "Keep the lights on — the town box",
  },
  {
    date: "2026-08-31", pot: "keeping-ec2", patron: "alden", usd: 50,
    epoch: "2026-08", ref: "stripe:pi_3QkR8gEXAMPLE", holo: 6,
    title: "Keep the lights on — the town box",
  },
  {
    date: "2026-08-31", pot: "keeping-ec2", patron: "rei", usd: 40,
    epoch: "2026-08", ref: "usdc:0x9c41EXAMPLE", holo: 5,
    title: "Keep the lights on — the town box",
  },
  {
    date: "2026-08-12", pot: TREASURY_POT, patron: "wright", usd: 25,
    epoch: "2026-08", ref: "usdc:0x8f21EXAMPLE", holo: 0,
    title: "",
  },
];

// The dials, coherent with the deeds above: holo_issued (19) is exactly the
// sum of the fixture's deed holo, and every household's holo sits under its
// ρ-cap (floor(0.25 × earned mint)) in STAMPS_FIXTURE below.
// ρ here is the LAUNCH value (R10: "ρ = 0.5 at launch — at the constitutional
// ceiling"). The fixture runs at the dial the town will actually open with, so
// what QA sees on `?fixture` is the shape the first visitor meets — including
// the ρ bar sitting flush against its ceiling, which is the honest picture of a
// dial with no upward headroom left.
export const ECONOMY_FIXTURE = {
  as_of: "2026-08-31",
  sigma: 0.5,
  rho: 0.5,
  rho_constitutional_ceiling: 0.5,
  treasury_usd: 175,
  primary_mint_earned: 2400,
  // The fixture runs as a post-#2886 checkout does: the extractor called the
  // town's `foldPrimaryMint`, so 2400 is primary alone and `holo_issued` enters
  // the ρ base beside it (capBase 2419, cap ⌊0.5 × 2419⌋ = 1209).
  primary_mint_fold: "foldPrimaryMint",
  holo_issued: 19,
};

// Per-handle stamps answers for the mintbar. holo agrees with the deeds; every
// mint_count is high enough that the household's holo sits under its ρ-cap at
// the launch dial (wright 8 ≤ ⌊ρ×48⌋, alden 6 ≤ ⌊ρ×32⌋, rei 5 ≤ ⌊ρ×24⌋ — the
// test does that multiplication against ECONOMY_FIXTURE.rho rather than
// restating it, so the fixture survives a dial change). The two hollow-holo
// members let QA see a bar with and without the holo segment in one house.
export const STAMPS_FIXTURE = {
  wright: { mint_count: 48, liquid: 21, staked: 6, assets: 27, holo: 8 },
  alden: { mint_count: 32, liquid: 24, staked: 0, assets: 24, holo: 6 },
  rei: { mint_count: 24, liquid: 18, staked: 3, assets: 21, holo: 5 },
  corwin: { mint_count: 12, liquid: 12, staked: 0, assets: 12, holo: 0 },
  ellery: { mint_count: 5, liquid: 3, staked: 1, assets: 4, holo: 0 },
};
