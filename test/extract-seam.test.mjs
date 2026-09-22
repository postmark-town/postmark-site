// extract-seam.test.mjs — the emission's falsifiers.
//
// THE THING THIS PROVES: what tools/extract-seam.mjs writes is what
// src/lib/funding.mjs reads. The two files are a contract with no schema
// between them — funding.mjs documents the field names it expects and the
// emitter copies them out of the town — so the only way that contract can be
// checked is to run the emitter's fold and hand its output to the reader.
//
// Every assertion below runs the REAL fold (seamFromTown) against a REAL
// stamp-mint.mjs when a town checkout is at hand, and against a hand-built
// ledger in the town's own grammar when it is not.

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { seamFromTown, nextMonth, firstOpenEpoch, monthOf } from "../tools/extract-seam.mjs";
import { livePots, loadEconomy, readEconomy, toPot, toDeed, deedReads, TREASURY_POT } from "../src/lib/funding.mjs";

// The town checkout, if this machine has one. Everything that needs the real
// stamp-mint.mjs skips without it rather than pretending to have run.
const SITE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TOWN = [process.env.POSTMARK_TOWN, ...[
  ".postmark-checkout",              // the CI checkout (sync-atlas.yml)
  "../postmark",                     // the sibling clone extract-town.mjs defaults to
  "../../seam-overnight/town-main",  // the read-only reference clone
  "../../postmark",
].map((p) => resolve(SITE_ROOT, p))]
  .filter(Boolean)
  .find((p) => existsSync(join(p, "tools", "stamp-mint.mjs")));

const haveTown = Boolean(TOWN);
const loadMint = async () => import(pathToFileURL(join(TOWN, "tools", "stamp-mint.mjs")).href);

// The dial the town actually declares, so these tests never restate ρ or σ
// (R10: "every other surface reads it rather than restating it").
const DIAL = { sigma: 0.5, rho: 0.5, rhoCeiling: 0.5, treasury: "the-town" };

// ── epochs ───────────────────────────────────────────────────────────────────

test("an epoch is a month, and the next one rolls the year", () => {
  assert.equal(nextMonth("2026-08"), "2026-09");
  assert.equal(nextMonth("2026-12"), "2027-01");
  assert.equal(monthOf("2026-08-21"), "2026-08");
});

test("the open epoch is the first month the pot has not already closed", () => {
  // One epoch, one close (stamp-mint.mjs: `pot "<x>" already closed epoch <e> —
  // one epoch, one close`). So a month that closed cannot be the open one, and
  // the pot's next ask is the month after it.
  assert.equal(firstOpenEpoch("2026-08", new Set()), "2026-08");
  assert.equal(firstOpenEpoch("2026-08", new Set(["2026-08"])), "2026-09");
  assert.equal(firstOpenEpoch("2026-11", new Set(["2026-11", "2026-12"])), "2027-01");
});

// ── the contract: what is emitted is what funding.mjs reads ──────────────────

test("every emitted pot row parses under funding.mjs's own reader", { skip: !haveTown }, async () => {
  const mint = await loadMint();
  const entries = mint.parseStampLedger(readFileSync(join(TOWN, "WHITE_PAGES", "stamp-ledger.md"), "utf8"));
  const potFiles = ["keeping-ec2", "darko-fund"]
    .map((p) => mint.potFile(TOWN, p)).filter(Boolean);
  assert.ok(potFiles.length >= 2, "the town posts both pilot pots");

  const seam = seamFromTown({ mint, entries, potFiles, dial: DIAL, asOf: "2026-08-21" });
  const { pots, drafts, malformed } = livePots(seam.pots);

  // THE WHOLE POINT. A malformed row means the emitter wrote a field the reader
  // will not take — the failure mode this file exists to catch, and the one that
  // would otherwise show up as a pot silently missing from the board.
  assert.deepEqual(malformed, [], "the emitter must write only rows the reader accepts");
  assert.ok(pots.length + drafts.length === seam.pots.length);
});

test("a pot file's fields arrive verbatim, and a renamed field is caught", { skip: !haveTown }, async () => {
  // THE CAN-FAIL FLIP. funding.mjs's header: "Every field name below is copied
  // from the town's own files, not invented ... the pot file WHITE_PAGES/
  // pot-<id>.json". If the town renames a field, this goes red instead of the
  // board quietly rendering a pot with no title and no target.
  const mint = await loadMint();
  const entries = mint.parseStampLedger(readFileSync(join(TOWN, "WHITE_PAGES", "stamp-ledger.md"), "utf8"));
  const file = mint.potFile(TOWN, "keeping-ec2");

  const whole = seamFromTown({ mint, entries, potFiles: [file], dial: DIAL, asOf: "2026-08-21" });
  const read = toPot(whole.pots[0]);
  assert.equal(read.ok, true, read.reason);
  assert.equal(read.title, file.title, "the title is the pot file's own");
  assert.equal(read.target, file.target_usd_per_epoch, "the target is the posted need, unaltered");
  assert.equal(read.source, file.source.trim(), "the prose is the pot file's own");

  // now break the field NAME the emitter copies from — the exact drift a schema
  // would have caught and a hand-copied field never does
  const renamed = { ...file, target_usd_per_epoch: undefined, target_usd: file.target_usd_per_epoch };
  const broken = seamFromTown({ mint, entries, potFiles: [renamed], dial: DIAL, asOf: "2026-08-21" });
  assert.equal(toPot(broken.pots[0]).ok, false,
    "a renamed pot-file field must fail the reader, not pass with a hole in it");
});

test("a draft pot is emitted and marked draft — never dropped", { skip: !haveTown }, async () => {
  // The town's own record refuses to hide it: pot-darko-fund.json says "DRAFT —
  // the rendering may show on the dev channel, but opening a pot is the
  // founder's word". So the row must exist AND must carry status draft; the
  // surfaces then decide what a draft may say, which is not the emitter's call.
  const mint = await loadMint();
  const entries = mint.parseStampLedger(readFileSync(join(TOWN, "WHITE_PAGES", "stamp-ledger.md"), "utf8"));
  // The status is set HERE rather than borrowed from the town's live file. It
  // used to read `assert.equal(file.status, "draft")`, which quietly tied this
  // test to a value the founder moves at will — and he moved it: darko-fund
  // opened 2026-08-23. What is under test is the emitter's treatment of a draft
  // row, which is a shape, not a fact about today's town.
  const file = { ...mint.potFile(TOWN, "darko-fund"), status: "draft" };

  const seam = seamFromTown({ mint, entries, potFiles: [file], dial: DIAL, asOf: "2026-08-21" });
  assert.equal(seam.pots.length, 1, "a draft pot is emitted");
  assert.equal(seam.pots[0].status, "draft");

  const { pots, drafts } = livePots(seam.pots);
  assert.equal(pots.length, 0, "and the board's live list still holds it back");
  assert.equal(drafts.length, 1, "but it is counted, not lost");
});

test("the donation box's targetless shape reads — and only because it is uncapped", { skip: !haveTown }, async () => {
  // D5's exception, quoted from ECONOMY-DIALS.json law_side.keeping._intake_cap:
  // "intake refuses dollars past a pot's posted target, mechanically (recording
  // tool / door bounce), except pots explicitly marked uncapped."
  const mint = await loadMint();
  const entries = mint.parseStampLedger(readFileSync(join(TOWN, "WHITE_PAGES", "stamp-ledger.md"), "utf8"));
  const file = mint.potFile(TOWN, "darko-fund");
  assert.equal(file.target_usd_per_epoch, null, "the box posts no target");
  assert.equal(file.uncapped, true, "and says so with the field the law names");

  const seam = seamFromTown({ mint, entries, potFiles: [file], dial: DIAL, asOf: "2026-08-21" });
  const read = toPot(seam.pots[0]);
  assert.equal(read.ok, true, read.reason);
  assert.equal(read.target, null, "null is the box's true target, not a missing one");
  assert.equal(read.uncapped, true, "and the flag reaches the page that branches on it");
  assert.equal(read.progress, null, "a box with no need is short of nothing");

  // THE CAN-FAIL FLIP: drop the uncapped flag and the very same row must be
  // refused. Without this, "null target reads fine" would be a hole in the
  // reader rather than an exception the law grants.
  const notExempt = toPot({ ...seam.pots[0], uncapped: false });
  assert.equal(notExempt.ok, false, "a CAPPED pot with no posted target is broken, not elastic");
  assert.match(notExempt.reason, /target_usd_per_epoch/);
});

// ── zero receipts is zero, never blank ───────────────────────────────────────

test("a pot nobody has fed shows zero, and an empty roll — not an absence", { skip: !haveTown }, async () => {
  // A HAND-BUILT LEDGER, on purpose. This test used to read the live town's ledger
  // and assert zero — true on 2026-08-21, false from 2026-08-30 when keith's
  // $5 Stripe receipt landed in keeping-ec2, and red on the keeper's box for nine
  // days while CI (which had no Town checkout) stayed green. A test that reads a
  // live file may only assert what that file's own numbers say (below); the
  // "nobody fed" case is a fixture.
  const mint = await loadMint();
  const entries = mint.parseStampLedger("");
  const file = mint.potFile(TOWN, "keeping-ec2");
  const seam = seamFromTown({ mint, entries, potFiles: [file], dial: DIAL, asOf: "2026-08-21" });
  const row = seam.pots[0];

  assert.equal(row.received_usd, 0, "the ledger carries no receipt for this pot");
  assert.equal(typeof row.received_usd, "number", "and 0 is a number, not an empty string or null");
  assert.deepEqual(row.patrons, [], "an empty roll is an array, so the page can count it");
  assert.equal(row.staked, 0);

  const read = toPot(row);
  assert.equal(read.received, 0);
  assert.equal(read.progress, 0, "0 of a posted need is 0 progress, not NaN");
  assert.ok(Number.isFinite(read.progress));
});

test("the pot file's own received_usd never overrides the ledger's", { skip: !haveTown }, async () => {
  // The pot file says so itself: "display only, refreshed by tools/
  // epoch-close.mjs --receipt — the ledger's pot-receipt rows are
  // authoritative". A stale display number reaching a page would be the site
  // reporting money that the sealed record does not have.
  const mint = await loadMint();
  const entries = mint.parseStampLedger("");
  const lying = { ...mint.potFile(TOWN, "keeping-ec2"), received_usd: 999 };
  const seam = seamFromTown({ mint, entries, potFiles: [lying], dial: DIAL, asOf: "2026-08-21" });
  assert.equal(seam.pots[0].received_usd, 0, "the fold wins over the pot file's display copy");
});

test("the LIVE ledger's receipts show in the open row — exactly the ledger's own sum, never a number written on the day the test was", { skip: !haveTown }, async () => {
  const mint = await loadMint();
  const entries = mint.parseStampLedger(readFileSync(join(TOWN, "WHITE_PAGES", "stamp-ledger.md"), "utf8"));
  const file = mint.potFile(TOWN, "keeping-ec2");
  const { receipts, settled } = mint.foldPotReceipts(entries);
  const open = receipts.filter((r) => r.pot === "keeping-ec2" && !settled.has(r.ref) && r.from !== DIAL.treasury);
  const expected = open.reduce((a, r) => a + r.usd, 0);
  const seam = seamFromTown({ mint, entries, potFiles: [file], dial: DIAL, asOf: new Date().toISOString().slice(0, 10) });
  const row = seam.pots.find((p) => p.status !== "closed");
  assert.equal(row.received_usd, expected, "the open row is the ledger's own open receipts, summed");
  assert.equal(row.patrons.reduce((a, p) => a + p.usd, 0), expected, "and the roll adds up to the same dollars");
  for (const r of open) assert.ok(row.patrons.some((p) => p.patron === r.from), `${r.from} is on the roll`);
});

// ── the close's own rows and the town's numbers ─────────────────────────────
//
// THE LAW (the founder, 2026-08-26, town commit 4485be975 "the deed purge"):
// "pot-receipt remains the only money row, the close's payer lines say holo, and
// the record-of-dollars concept lives as plain prose" — and "the zero row is
// what settles a receipt". `patronDeedLine` was deleted outright that day; the
// two tests here used to build deed rows with it and stayed red on every box
// that had a Town checkout from 08-26 to 09-04.

test("a closed epoch's roll is the receipts the close answered for, with the holo the close minted — a zero-holo receipt counts whole", { skip: !haveTown }, async () => {
  const mint = await loadMint();
  const raw = [
    mint.potReceiptLine({ date: "2026-08-30", pot: "keeping-ec2", rail: "usdc", usd: 60, from: "wright", ref: "usdc:0xAA" }),
    mint.potReceiptLine({ date: "2026-08-12", pot: TREASURY_POT, rail: "usdc", usd: 25, from: "wright", ref: "usdc:0xBB" }),
    mint.keepingBurnLine({ date: "2026-08-31", pot: "keeping-ec2", n: 40, epoch: "2026-08", handle: "alden" }),
    mint.holoMintLine({ date: "2026-08-31", handle: "wright", n: 8, pot: "keeping-ec2", epoch: "2026-08", ref: "usdc:0xAA" }),
    mint.holoMintLine({ date: "2026-08-31", handle: "wright", n: 0, pot: TREASURY_POT, epoch: "2026-08", ref: "usdc:0xBB" }),
  ];
  const entries = mint.parseStampLedger(raw.join("\n"));
  const file = mint.potFile(TOWN, "keeping-ec2");
  const seam = seamFromTown({ mint, entries, potFiles: [file], dial: DIAL, asOf: "2026-08-31" });

  assert.deepEqual(seam.deeds, [], "no deed row exists any more — the purge, by law");
  const closed = seam.pots.find((p) => p.pot === "keeping-ec2" && p.status === "closed");
  assert.ok(closed, "the closed epoch gets its own row");
  assert.equal(closed.received_usd, 60, "the receipt the close answered for");
  assert.deepEqual(closed.patrons, [{ patron: "wright", usd: 60, holo: 8 }], "the patron, the dollars, the holo the close minted");
  // the treasury receipt was settled by a ZERO holo row: consumed, minting nothing, and
  // never a pot's bar — the treasury pot has no row in this seam at all
  assert.equal(seam.pots.some((p) => p.pot === TREASURY_POT), false);
  const { settled } = mint.foldPotReceipts(entries);
  assert.ok(settled.has("usdc:0xBB"), "the zero row is what settles a receipt");
});

test("a closed epoch's row is folded from the close, and the roll is its receipts", { skip: !haveTown }, async () => {
  const mint = await loadMint();
  const raw = [
    mint.potReceiptLine({ date: "2026-08-30", pot: "keeping-ec2", rail: "usdc", usd: 90, from: "wright", ref: "usdc:0xAA" }),
    mint.potReceiptLine({ date: "2026-08-30", pot: "keeping-ec2", rail: "stripe", usd: 60, from: "rei", ref: "stripe:pi_X" }),
    mint.keepingBurnLine({ date: "2026-08-31", pot: "keeping-ec2", n: 40, epoch: "2026-08", handle: "alden" }),
    mint.keepingMintLine({ date: "2026-08-31", handle: "alden", n: 20, pot: "keeping-ec2", epoch: "2026-08" }),
    mint.holoMintLine({ date: "2026-08-31", handle: "wright", n: 12, pot: "keeping-ec2", epoch: "2026-08", ref: "usdc:0xAA" }),
    mint.holoMintLine({ date: "2026-08-31", handle: "rei", n: 8, pot: "keeping-ec2", epoch: "2026-08", ref: "stripe:pi_X" }),
  ];
  const entries = mint.parseStampLedger(raw.join("\n"));
  const seam = seamFromTown({ mint, entries, potFiles: [mint.potFile(TOWN, "keeping-ec2")], dial: DIAL, asOf: "2026-08-31" });

  const closed = seam.pots.find((p) => p.epoch === "2026-08");
  assert.ok(closed, "the closed epoch gets its own row");
  assert.equal(closed.status, "closed", "a closed epoch reads closed however the pot file reads");
  assert.equal(closed.received_usd, 150, "the receipts' dollars, summed");
  assert.equal(closed.staked, 0, "a close leaves no escrow behind");
  assert.deepEqual(closed.patrons.map((p) => [p.patron, p.usd, p.holo]),
    [["wright", 90, 12], ["rei", 60, 8]], "the roll, richest first, with the holo the close minted");

  // and the pot keeps asking: the open row is the month AFTER the one it closed
  const open = seam.pots.find((p) => p.epoch !== "2026-08");
  assert.equal(open.epoch, "2026-09", "one epoch, one close — the next ask is the next month");
  assert.equal(open.received_usd, 0, "the closed month's receipts were consumed by its holo rows");
});

test("treasury dollars fund nothing, so they never fill a pot's bar", { skip: !haveTown }, async () => {
  // ECONOMY-DIALS.json law_side.keeping._exclusions, quoted: "treasury dollars
  // covering a shortfall fund nothing and mint nothing ('Treasury may cover any
  // shortfall — minting nothing')". stamp-mint.mjs's intakeCheck excludes them
  // from the headroom it quotes at the door; a bar that counted them would show
  // the pot fuller than the door believes it is.
  const mint = await loadMint();
  const raw = [
    mint.potReceiptLine({ date: "2026-08-30", pot: "keeping-ec2", rail: "usdc", usd: 40, from: "wright", ref: "usdc:0xAA" }),
    mint.potReceiptLine({ date: "2026-08-30", pot: "keeping-ec2", rail: "grant", usd: 110, from: "the-town", ref: "grant:shortfall" }),
  ];
  const entries = mint.parseStampLedger(raw.join("\n"));
  const seam = seamFromTown({ mint, entries, potFiles: [mint.potFile(TOWN, "keeping-ec2")], dial: DIAL, asOf: "2026-08-30" });
  const row = seam.pots[0];

  assert.equal(row.received_usd, 40, "only the funding dollars price the need");
  assert.deepEqual(row.patrons.map((p) => p.patron), ["wright"], "the treasury is not a patron");
  // but the town still HOLDS them — the backing gauge counts every witnessed dollar
  assert.equal(seam.economy.treasury_usd, 150);
});

test("the economy emission is a whole set readEconomy will take", { skip: !haveTown }, async () => {
  const mint = await loadMint();
  const entries = mint.parseStampLedger(readFileSync(join(TOWN, "WHITE_PAGES", "stamp-ledger.md"), "utf8"));
  const dial = mint.keepingDial(TOWN);
  assert.ok(dial, "the town declares a keeping dial");

  const seam = seamFromTown({ mint, entries, potFiles: [], dial, asOf: "2026-08-21" });
  const econ = readEconomy(seam.economy);
  assert.ok(econ, "half a set would render as 'not published yet' — this must be whole");

  // the dials are the town's own, never restated here
  assert.equal(econ.sigma, dial.sigma);
  assert.equal(econ.rho, dial.rho);
  assert.equal(econ.rhoCeiling, dial.rhoCeiling);
  // and the totals are folds of the sealed ledger, not constants
  // AMENDED 2026-09-17: this asserted against `foldMintCount` by name. After
  // postmark-town/postmark#2886 that fold counts holo, so the emitter calls
  // `foldPrimaryMint` where the checkout has it — and this assertion follows the
  // emitter's own guard rather than pinning a fold that changed meaning.
  const primaryFold = mint.foldPrimaryMint ?? mint.foldMintCount;
  assert.equal(seam.economy.primary_mint_earned,
    [...primaryFold(entries).values()].reduce((a, n) => a + n, 0));
  assert.equal(seam.economy.primary_mint_fold,
    mint.foldPrimaryMint ? "foldPrimaryMint" : "foldMintCount",
    "the emission names which fold answered, so no reader has to guess whether holo is inside");
  assert.equal(seam.economy.holo_issued,
    [...mint.foldHolo(entries).values()].reduce((a, n) => a + n, 0));
  assert.ok(seam.economy.primary_mint_earned > 0, "the town has minted; a 0 here would mean the fold missed the ledger");
});

test("THE GUARD: primary_mint_earned excludes holo when the checkout has foldPrimaryMint", () => {
  // THE FOUNDER, 2026-09-17: "non-spendable is repealed; the stamps are like any
  // other, but are holo to signify the special source." The town's own
  // `foldMintCount` gains a holo arm with that ruling
  // (postmark-town/postmark#2886), so this field's NAME becomes a lie unless the
  // emitter reaches for the fold that still means primary alone.
  //
  // A real ledger, one holo row on it, and a stub `mint` standing in for the two
  // shapes of checkout — because the point is which EXPORT the emitter picks,
  // and no town clone can be both shapes at once.
  const LEDGER_HOLO = 7;
  const LEDGER_PRIMARY = 100;
  const dial = { sigma: 0.5, rho: 0.5, rhoCeiling: 0.5 };
  const base = {
    TREASURY_POT: "treasury",
    keepingDial: () => dial,
    classifyEntry: () => null,
    foldPotPositions: () => new Map(),
    foldPotReceipts: () => ({ receipts: [], settled: new Set() }),
    foldClosedEpochs: () => new Map(),
    foldKeepingMint: () => new Map(),
    foldHolo: () => new Map([["keemin", LEDGER_HOLO]]),
  };

  // PAST the merge: foldMintCount counts the holo row, foldPrimaryMint does not.
  const after = seamFromTown({
    mint: { ...base,
      foldMintCount: () => new Map([["keemin", LEDGER_PRIMARY + LEDGER_HOLO]]),
      foldPrimaryMint: () => new Map([["keemin", LEDGER_PRIMARY]]) },
    entries: [], potFiles: [], dial, asOf: "2026-09-30",
  });
  assert.equal(after.economy.primary_mint_earned, LEDGER_PRIMARY,
    "the holo row must NOT be inside a field named primary_mint_earned");
  assert.notEqual(after.economy.primary_mint_earned, LEDGER_PRIMARY + LEDGER_HOLO,
    "and reaching for foldMintCount is exactly the bug this guard exists for");
  assert.equal(after.economy.primary_mint_fold, "foldPrimaryMint");

  // BEFORE the merge: no foldPrimaryMint at all, and foldMintCount cannot see an
  // arrow-free holo row, so the same number arrives by the other route.
  const before = seamFromTown({
    mint: { ...base, foldMintCount: () => new Map([["keemin", LEDGER_PRIMARY]]) },
    entries: [], potFiles: [], dial, asOf: "2026-09-30",
  });
  assert.equal(before.economy.primary_mint_earned, LEDGER_PRIMARY,
    "the guard must be a no-op on a pre-merge checkout, or this lane breaks the live site today");
  assert.equal(before.economy.primary_mint_fold, "foldMintCount");

  // AND THE CAP IS THE ALL-SOURCES BASE EITHER WAY — the founder, same word:
  // "funding minted stamps contribute to the max stamps you can get from another
  // fund. it compounds by design."
  assert.equal(readEconomy(after.economy).capBase, LEDGER_PRIMARY + LEDGER_HOLO,
    "holo counts toward its own cap now");
  assert.equal(readEconomy(after.economy).holoCap, Math.floor(0.5 * (LEDGER_PRIMARY + LEDGER_HOLO)));

  // THE DOUBLE-COUNT THE PROVENANCE FIELD RETIRES: a checkout past the merge
  // that somehow lacks the new export puts holo inside primary_mint_earned, and
  // a reader that always adds holo_issued would count it twice.
  const inconsistent = readEconomy({
    as_of: "2026-09-30", sigma: 0.5, rho: 0.5, rho_constitutional_ceiling: 0.5, treasury_usd: 0,
    primary_mint_earned: LEDGER_PRIMARY + LEDGER_HOLO, primary_mint_fold: "foldMintCount",
    holo_issued: LEDGER_HOLO,
  });
  assert.equal(inconsistent.capBase, LEDGER_PRIMARY + LEDGER_HOLO,
    "holo is already inside that number; adding it again would read 114 against a true 107");
});

test("no dial, no economy emission — the page says not-yet rather than half", { skip: !haveTown }, async () => {
  const mint = await loadMint();
  const seam = seamFromTown({ mint, entries: [], potFiles: [], dial: null, asOf: "2026-08-21" });
  assert.equal(seam.economy, null);
  assert.equal(readEconomy(seam.economy), null);
});

// ── what actually shipped ────────────────────────────────────────────────────

test("the committed emissions are the ones the site reads", () => {
  // Not a fold check — a wiring check. The emitter can be perfect and the build
  // still render nothing if the files land somewhere funding.mjs does not look.
  const econ = loadEconomy();
  if (!econ) return; // no emission committed on this branch yet — fail-soft, by design
  assert.ok(readEconomy(econ), "a committed economy.json must be a whole, lawful set");
  const potsJson = JSON.parse(readFileSync(new URL("../src/data/postmark/pots.json", import.meta.url), "utf8"));
  assert.deepEqual(livePots(potsJson).malformed, [],
    "every committed pot row must parse — a malformed row is a pot missing from the board");
});

test('R12: the holo cap base is primary mint PLUS keeping mint — "keeping-mint is treated like anything else" (Keemin, 2026-08-21)', () => {
  // AMENDED 2026-09-17: the base gained a third term on the founder's word
  // ("funding minted stamps contribute to the max stamps you can get from
  // another fund. it compounds by design"), so holo_issued rides in it too. Both
  // fixtures here carry holo_issued: 0, which is why their numbers did not move
  // — and that is deliberate: this test's subject is the KEEPING term, and it
  // still fails if the keeping term is dropped.
  const econ = readEconomy({ as_of: "2026-08-22", sigma: 0.5, rho: 0.5, rho_constitutional_ceiling: 0.5,
    treasury_usd: 0, primary_mint_earned: 100, keeping_mint: 40, holo_issued: 0 });
  assert.equal(econ.holoCap, 70, "0.5 x (100 + 40) — dropping keeping mint from the base fails here");
  const older = readEconomy({ as_of: "2026-08-22", sigma: 0.5, rho: 0.5, rho_constitutional_ceiling: 0.5,
    treasury_usd: 0, primary_mint_earned: 100, holo_issued: 0 });
  assert.equal(older.holoCap, 50, "an emission without the fold still renders, at the narrower base");
  // and the third term, asserted where it can actually be seen
  const withHolo = readEconomy({ as_of: "2026-09-30", sigma: 0.5, rho: 0.5, rho_constitutional_ceiling: 0.5,
    treasury_usd: 0, primary_mint_earned: 100, keeping_mint: 40, holo_issued: 20,
    primary_mint_fold: "foldPrimaryMint" });
  assert.equal(withHolo.capBase, 160, "primary 100 + keeping 40 + holo 20 — all sources");
  assert.equal(withHolo.holoCap, 80, "0.5 x 160; leaving holo out of its own base reads 70 and is the repealed law");
});

// ── the close word and its floor reach the reader ────────────────────────────

test("the emitter carries the pot file's close word and its floor", { skip: !haveTown }, async () => {
  // THE LAW THIS ASSERTS — WHITE_PAGES/pot-darko-fund.json § _min_close, quoted:
  //   "Owner of the number: this file; every surface reads it."
  // A field the emitter drops is a field no surface can read, however carefully
  // the pot file states it. Before this passthrough existed the site could not
  // tell a donation box from an epoch pot at all.
  const mint = await loadMint();
  const entries = mint.parseStampLedger(readFileSync(join(TOWN, "WHITE_PAGES", "stamp-ledger.md"), "utf8"));
  const file = mint.potFile(TOWN, "darko-fund");
  const seam = seamFromTown({ mint, entries, potFiles: [file], dial: DIAL, asOf: "2026-08-23" });

  assert.equal(seam.pots[0].close, file.close,
    "the close word is emitted exactly as the pot file states it");
  assert.equal(seam.pots[0].min_close_usd, file.min_close_usd ?? null,
    "and so is the floor");

  const read = toPot(seam.pots[0]);
  assert.equal(read.close, file.close, "and both survive the reader");
  assert.equal(read.minCloseUsd, file.min_close_usd ?? null);
});

test("the emitter's allowlist names close and min_close_usd", () => {
  // The emitter copies an ALLOWLIST of pot-file fields, so a field that is not
  // named here is silently absent downstream rather than loudly missing. That
  // failure mode is why this reads the source: it runs on a machine with no
  // town checkout, where the fold above cannot.
  const src = readFileSync(new URL("../tools/extract-seam.mjs", import.meta.url), "utf8");
  const base = src.slice(src.indexOf("const base = {"));
  const block = base.slice(0, base.indexOf("\n    };"));
  assert.ok(/close: /.test(block), "the emitter must carry `close`");
  assert.ok(/min_close_usd: /.test(block), "and `min_close_usd`");
  // AND WHEN THE EMISSION WAS MADE. This reads the source because the shipped
  // pots.json already carries the stamp: deleting the emitter line leaves the
  // committed file untouched and every data-level check green, so only the
  // emitter's own text can catch the loss. Its can-fail flip proved that.
  assert.ok(/generated_at: generatedAt,/.test(block),
    "the emitter must stamp each row with when it ran");
  assert.ok(/const generatedAt = new Date\(\)\.toISOString\(\);/.test(src),
    "stamped once per run, so every row agrees by construction");
  assert.ok(block.includes("file?.min_close_usd"),
    "read off the pot file, never computed or defaulted to a number here");
});

// ── the early-posted pot: the epoch comes from first_close, not the clock ────

test("an early-posted pot's epoch rounds FORWARD to its own first close", { skip: !haveTown }, async () => {
  // LAW (WHITE_PAGES/pot-*.json § _first_close, verbatim): "EARLY-POSTED FOR
  //     SEPTEMBER (founder's ruling, 2026-08-25 beta-launch sitting): the pots
  //     opened in late August with $0 received, so the first epoch ROUNDS
  //     FORWARD — the first month closes at the END of September; dollars
  //     arriving before then all belong to the 2026-09 epoch. Surfaces render
  //     the epoch from this field, not from the posting date."
  const mint = await loadMint();
  const entries = mint.parseStampLedger(readFileSync(join(TOWN, "WHITE_PAGES", "stamp-ledger.md"), "utf8"));
  const base = mint.potFile(TOWN, "keeping-ec2");

  // The floor sits a year past anything the LIVE ledger can have closed or
  // received, so the assertion holds on any day this control runs. The first
  // shape of this test pinned the calendar ("2026-09" with asOf 2026-08-25) and
  // went red on the keeper's S58 gate the first week of September: the real
  // ledger had a September receipt and a closed August, so the clock-derived
  // fallback was already "2026-09" and the flip below could no longer tell the
  // field from the clock. A control over live data may not assume the month.
  const FLOOR = "2027-08-31";
  const early = { ...base, first_close: FLOOR };
  const seam = seamFromTown({ mint, entries, potFiles: [early], dial: DIAL, asOf: "2026-08-25" });
  const open = seam.pots.find((p) => p.status !== "closed");
  assert.equal(open.epoch, monthOf(FLOOR), "posted in August, but the first month closes at the floor");
  assert.equal(open.first_close, FLOOR, "and the field itself is carried, not just consumed");

  // THE CAN-FAIL FLIP. Drop the field and the epoch falls back to what the
  // ledger and the clock derive on their own — strictly EARLIER than the floor,
  // which proves the assertion above reads first_close and not the clock. The
  // derived month is the tool's to compute from the live ledger; this control
  // asserts the relation, never the calendar.
  const withoutIt = { ...base, first_close: undefined };
  const fallback = seamFromTown({ mint, entries, potFiles: [withoutIt], dial: DIAL, asOf: "2026-08-25" });
  const derived = fallback.pots.find((p) => p.status !== "closed").epoch;
  assert.ok(derived < monthOf(FLOOR), `with no first_close the derivation is the ledger's and the clock's (${derived}), below the floor`);
  assert.match(derived, /^\d{4}-\d{2}$/, "and it is a month");
});

test("first_close is a FLOOR, never an override — it can only round forward", { skip: !haveTown }, async () => {
  // A first close that is already behind the town's clock has been spent, and
  // must stop mattering rather than dragging a live pot back into a dead month.
  // Nothing in this rule may ever reach backwards.
  const mint = await loadMint();
  const entries = mint.parseStampLedger(readFileSync(join(TOWN, "WHITE_PAGES", "stamp-ledger.md"), "utf8"));
  const base = mint.potFile(TOWN, "keeping-ec2");

  const past = seamFromTown({
    mint, entries, potFiles: [{ ...base, first_close: "2026-09-30" }], dial: DIAL, asOf: "2026-11-04",
  });
  assert.equal(past.pots.find((p) => p.status !== "closed").epoch, "2026-11",
    "November's pot asks for November, not for a September that has gone");

  // and a month the pot has already CLOSED is still stepped over, floor or no floor
  const sameMonth = seamFromTown({
    mint, entries, potFiles: [{ ...base, first_close: "2026-09-30" }], dial: DIAL, asOf: "2026-09-02",
  });
  assert.equal(sameMonth.pots.find((p) => p.status !== "closed").epoch, "2026-09",
    "the floor's own month is reachable — it is a floor, not a skip");
});

test("the emitter's allowlist names first_close", () => {
  // Same reasoning as the close/min_close_usd check above: the emitter copies an
  // ALLOWLIST, so an un-named field goes silently absent downstream. Reads the
  // source so it runs on a machine with no town checkout.
  const src = readFileSync(new URL("../tools/extract-seam.mjs", import.meta.url), "utf8");
  const base = src.slice(src.indexOf("const base = {"));
  const block = base.slice(0, base.indexOf("\n    };"));
  assert.ok(/first_close: /.test(block), "the emitter must carry `first_close`");
  assert.ok(block.includes("file?.first_close"),
    "read off the pot file, never computed or defaulted to a date here");
});

// ── POS-184 · the seam names WHO staked, not only how much ───────────────────
//
// `staked` has always been one integer: the size of the room, with nobody in
// it. The town's own foldPotPositions already holds the per-staker netting
// (`${pot}|${handle}` -> open position, zeroes dropped), so the emitter takes
// the total and the list from ONE pass over that map under ONE filter. That is
// the whole warrant for showing both: they cannot disagree.

test("POS-184 — the emitted stakers are the netted positions, and they sum to `staked`", { skip: !haveTown }, async () => {
  const mint = await loadMint();
  // A fixture ledger, not the town's: two stakers, one of them drained by a
  // return, so the netting has something to do and a naive fold would be caught.
  const entries = mint.parseStampLedger([
    "# fixture",
    "",
    "- 2026-08-04 · wright → stake:pot/keeping-ec2 · 4 · via: api · sig: sigA",
    "- 2026-08-04 · limen → stake:pot/keeping-ec2 · 2 · via: api · sig: sigB",
    "- 2026-08-05 · keemin → stake:pot/keeping-ec2 · 6 · via: api · sig: sigC",
    "- 2026-08-06 · wright → stake:pot/keeping-ec2 · 3 · via: api · sig: sigD",
    "- 2026-08-31 · stake:pot/keeping-ec2 → limen · 2 · for: pot-return:2026-08 · sig: sigE",
    "",
  ].join("\n"));
  const file = { ...mint.potFile(TOWN, "keeping-ec2"), status: "open" };
  const seam = seamFromTown({ mint, entries, potFiles: [file], dial: DIAL, asOf: "2026-08-21" });
  const row = seam.pots.find((p) => p.status !== "closed");

  // 1 · THE LIST — netted per staker (wright's 4 and 3 are one position of 7),
  //     biggest first, and limen is ABSENT rather than listed at 0 because a
  //     returned stake is a closed position, not a stake of nothing.
  assert.deepEqual(row.stakers, [{ handle: "keemin", staked: 6 }, { handle: "wright", staked: 7 }]
    .sort((a, b) => b.staked - a.staked || a.handle.localeCompare(b.handle)),
    "two standing positions, netted, biggest first — the returned one is gone");
  assert.equal(row.stakers.some((s) => s.handle === "limen"), false, "a returned stake leaves no staker behind");

  // 2 · THE EQUALITY. If these two could drift, one of them would be lying
  //     about the same escrow — which is exactly what showing a list beside a
  //     number invites unless they come off one pass.
  assert.equal(row.stakers.reduce((n, s) => n + s.staked, 0), row.staked,
    "sum(stakers) IS `staked`");
  assert.equal(row.staked, 13, "and `staked` itself is the netted total, unmoved by this lane");

  // 3 · THE READER TAKES IT. An emitter writing a field the reader drops is the
  //     failure this file exists to catch.
  const read = toPot(row);
  assert.equal(read.ok, true, read.reason);
  assert.deepEqual(read.stakers, row.stakers, "through toPot unchanged");
});

test("POS-184 — a pot nobody has staked emits an EMPTY list; an older emission emits none, and the two must not read alike", { skip: !haveTown }, async () => {
  const mint = await loadMint();
  // A ledger with receipts and no stake rows at all.
  const entries = mint.parseStampLedger([
    "# fixture",
    "",
    "- 2026-08-02 · pot-receipt · pot:keeping-ec2 · rail: stripe · usd: 100 · from: keemin · ref: ch_x · sig: sigA",
    "",
  ].join("\n"));
  const file = { ...mint.potFile(TOWN, "keeping-ec2"), status: "open" };
  const seam = seamFromTown({ mint, entries, potFiles: [file], dial: DIAL, asOf: "2026-08-21" });
  const row = seam.pots.find((p) => p.status !== "closed");

  assert.deepEqual(row.stakers, [], "the emitter LOOKED and found nobody — an empty list, present");
  assert.equal(row.staked, 0, "beside the zero it sums to");
  assert.deepEqual(toPot(row).stakers, [], "and the reader keeps it empty rather than turning it null");

  // THE DEPLOY-ORDER CASE, and the whole reason the reader distinguishes them.
  // Every pots.json in the tree predates this field. A reader that folded a
  // missing field into the empty list would let the fund page state "nobody has
  // staked on this pot" over a pot with seven live stakers on the ledger — a
  // page asserting as fact something it never looked at.
  const { stakers: _gone, ...older } = row;
  assert.equal(Object.hasOwn(older, "stakers"), false, "the older emission carries no such field");
  assert.equal(toPot(older).stakers, null, "and the reader says `null` — did not look — never `[]`");
  assert.notDeepEqual(toPot(older).stakers, [], "the two states are distinguishable, which is the point");
});
