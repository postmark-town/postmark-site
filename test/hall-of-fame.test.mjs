// hall-of-fame.test.mjs — Ferry's Hall of Fame's falsifiers (POS-967).
//
//   POSTMARK_TOWN=<a town checkout> node --test test/hall-of-fame.test.mjs
//
// WHAT THIS PROVES, against the acceptance's own sentences (Rivet's brief, quoted):
//   - "a fixture containing monthly mint/pay credits and distinct holo produces
//      matching preview/full ranks, exact per-person breakdown sums and valid
//      record links"
//   - "Out-of-month rows and held balances don't become earnings; canonical holo
//      isn't counted twice as plain mint."
//   - "Roll over with the town's month, not the runner's timezone."
//   - "Missing data is unavailable, not a fabricated zero/current balance."
//   - "Stale completion standings, missing credited sources, combined holo/plain
//      totals ... overflow or preview/full disagreement fail."
//
// THE LEDGER IS INVENTED AND THE LINES ARE THE TOWN'S OWN. Every row is written
// by the town's own line builder (stamp-mint.mjs mintLine, questPayLine,
// stageMintLine, stageRecreditLines ...), so a fixture cannot drift from the
// grammar the fold reads, and the fold reads it through the town's own
// parseStampLedger and classifyEntry. A test that needs the town's code skips
// without a checkout, saying so in its title (TEST-DESIGN), and CI has one
// (.postmark-checkout).

import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import {
  hallFromLedger, readHall, hallView, monthOfDay, prevMonth, monthLabel,
  HALL_TOP, HALL_HOLO_TOP, HALL_RECORDS_PER_SOURCE,
} from "../src/lib/hall-of-fame.mjs";
import { townDay } from "../src/lib/civic.mjs";
import { letterAddresses } from "../src/lib/mail.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TOWN = [process.env.POSTMARK_TOWN, ...[".postmark-checkout", "../postmark", "../../postmark"].map((p) => resolve(ROOT, p))]
  .filter(Boolean)
  .find((p) => existsSync(join(p, "tools", "stamp-mint.mjs")));
const SKIP = !TOWN && "needs the town's tools/stamp-mint.mjs: set POSTMARK_TOWN to a town checkout";

let mint = null;
before(async () => { if (TOWN) mint = await import(pathToFileURL(join(TOWN, "tools", "stamp-mint.mjs")).href); });

// ── the invented ledger ──────────────────────────────────────────────────────
// `rows` is the declarative list: the expected totals below are computed from
// it, never hand-copied. A row is { line, who, n, month?, earned } where
// `earned` says whether the town's own word ("earned": foldPrimaryMint's
// arrow-bearing MINT rows) covers it.
const SIG = (c) => c.repeat(86);
const HH = "hh:fixture";
const NOW = "2026-11-20";

function ledger() {
  const L = [];
  const add = (canonical, { sig = null, who = null, n = 0, earned = false, month = null } = {}) => L.push({ canonical, sig, who, n, earned, month });
  const day = (m, d) => `2026-${m}-${d}`;

  // alice: letters sent ×2, received ×1, a gift, a quest pay — all November
  add(mint.mintLine({ date: day("11", "02"), handle: "alice", cause: "alice-2026-11-02-to-bob-hello", side: "sent" }), { who: "alice", n: 1, earned: true });
  add(mint.mintLine({ date: day("11", "03"), handle: "alice", cause: "alice-2026-11-03-to-bob-again", side: "sent" }), { who: "alice", n: 1, earned: true });
  add(mint.mintLine({ date: day("11", "04"), handle: "alice", cause: "bob-2026-11-04-to-alice-reply", side: "received" }), { who: "alice", n: 1, earned: true });
  add(mint.giftLine({ date: day("11", "05"), handle: "alice", n: 20, slug: "sidequest-prize", by: "keemin" }), { who: "alice", n: 20, earned: true });
  add(mint.questPayLine({ date: day("11", "06"), handle: "alice", quest: Object.keys(mint.QUEST_PAY)[0], household: HH }), { who: "alice", n: mint.QUEST_PAY[Object.keys(mint.QUEST_PAY)[0]].amount, earned: true });

  // bob: a bug-ladder rung, and a transfer FROM alice (moves stamps, earns none)
  add(mint.stageMintLine({ date: day("11", "07"), handle: "bob", n: 5, post: "bob/the-bug", stage: "diagnosed" }), { who: "bob", n: 5, earned: true });
  add(mint.transferLine({ date: day("11", "08"), from: "alice", to: "bob", n: 7, id: "alice-2026-11-08-to-bob-thanks" }));

  // carol: October only — out of November, and the whole of October's board
  add(mint.giftLine({ date: day("10", "31"), handle: "carol", n: 50, slug: "october-prize", by: "keemin" }), { who: "carol", n: 50, month: "2026-10", earned: true });

  // dave: 3 plain in November AND 30 holo (apart). erin: 15 holo, no plain.
  add(mint.mintLine({ date: day("11", "09"), handle: "dave", cause: "dave-2026-11-09-to-alice-note", side: "sent" }), { who: "dave", n: 1, earned: true });
  add(mint.mintLine({ date: day("11", "09"), handle: "dave", cause: "alice-2026-11-09-to-dave-note", side: "received" }), { who: "dave", n: 1, earned: true });
  add(mint.mintLine({ date: day("11", "10"), handle: "dave", cause: "dave-2026-11-10-to-alice-more", side: "sent" }), { who: "dave", n: 1, earned: true });
  add(`- ${day("11", "12")} · holo · dave · 30 · pot:keeping-ec2 · epoch:2026-10 · ref: pi_dave0001`, { sig: SIG("h") });
  add(`- ${day("11", "12")} · holo · erin · 15 · pot:keeping-ec2 · epoch:2026-10 · ref: pi_erin0001`, { sig: SIG("i") });
  // a holo row that minted nothing is a whole row in the ledger and nothing here
  add(`- ${day("11", "12")} · holo · frank · 0 · pot:keeping-ec2 · epoch:2026-10 · ref: pi_frank001`, { sig: SIG("j") });

  // a stage paid to the WRONG resident, burned, and paid again to the right one:
  // frank's credit was taken back; gina's is counted once, by the recredit
  const wrong = { handle: "frank", n: 10, post: "gina/fix-it", stage: "briefed", sig: SIG("w") };
  add(mint.stageMintLine({ date: day("11", "11"), handle: "frank", n: 10, post: "gina/fix-it", stage: "briefed" }), { sig: SIG("w") });
  const [recredit, burn] = mint.stageRecreditLines({ date: day("11", "13"), handle: "gina", wrong, by: "wright" });
  add(recredit, { who: "gina", n: 10, earned: true });
  add(burn);

  // a mint of a kind the town's classifier does not name still counts, as "Other"
  add(`- ${day("11", "14")} · MINT → hank · 2 · for: mystery:thing`, { who: "hank", n: 2, earned: true });

  // a row dated after the as-of day has not happened yet
  add(mint.giftLine({ date: "2026-11-25", handle: "alice", n: 99, slug: "tomorrow", by: "keemin" }));

  return L;
}

const entriesOf = (rows) => mint.parseStampLedger(rows.map((r) => (r.sig ? `${r.canonical} · sig: ${r.sig}` : r.canonical)).join("\n"));

const expectEarned = (rows, month) => {
  const m = new Map();
  for (const r of rows) {
    if (!r.earned) continue;
    const rowMonth = r.month ?? "2026-11";
    if (rowMonth !== month) continue;
    m.set(r.who, (m.get(r.who) ?? 0) + r.n);
  }
  return m;
};

const fold = (rows = ledger()) => hallFromLedger({ mint, entries: entriesOf(rows), asOf: NOW });
const novBoard = (hall) => hall.months["2026-11"];

// ── the fold ─────────────────────────────────────────────────────────────────

test("LAW foldPrimaryMint: each person's earned is the sum of their MINT rows this month, and the breakdown adds up to it", { skip: SKIP }, () => {
  const rows = ledger();
  const nov = novBoard(fold(rows));
  const want = expectEarned(rows, "2026-11");
  assert.deepEqual(Object.fromEntries(nov.people.map((p) => [p.handle, p.earned])), Object.fromEntries(want),
    "the board is exactly the people who earned, at exactly what they earned");
  for (const p of nov.people) {
    assert.equal(p.sources.reduce((a, s) => a + s.n, 0), p.earned, `${p.handle}: the sources must add up to the total`);
    assert.equal(p.sources.every((s) => s.count >= 1 && s.n >= s.count), true);
  }
});

test("the ranks are highest-first, ties by handle, and two runs agree byte for byte", { skip: SKIP }, () => {
  const a = fold();
  assert.deepEqual(novBoard(a).people.map((p) => p.handle), ["alice", "gina", "bob", "dave", "hank"]);
  const earned = novBoard(a).people.map((p) => p.earned);
  assert.deepEqual(earned, [...earned].sort((x, y) => y - x), "highest first");
  // a tie at the same total is broken by handle: erin-style twins
  const twins = [
    mint.giftLine({ date: "2026-11-02", handle: "zed", n: 7, slug: "twin", by: "keemin" }),
    mint.giftLine({ date: "2026-11-02", handle: "abe", n: 7, slug: "twin", by: "keemin" }),
  ].map((canonical) => ({ canonical, sig: null, who: null, n: 0, earned: false }));
  const t = hallFromLedger({ mint, entries: entriesOf(twins), asOf: NOW }).months["2026-11"].people.map((p) => p.handle);
  assert.deepEqual(t, ["abe", "zed"], "equal totals rank by handle, so the order never depends on the ledger's");
  assert.equal(JSON.stringify(fold()), JSON.stringify(fold()), "the fold is deterministic for one ledger");
});

test("an October mint is October's, a row after the as-of day is nobody's, and a transfer earns nothing", { skip: SKIP }, () => {
  const hall = fold();
  assert.equal(novBoard(hall).people.some((p) => p.handle === "carol"), false, "carol's 10-31 gift is not November's");
  assert.equal(hall.months["2026-10"].people.find((p) => p.handle === "carol")?.earned, 50, "and it is October's, whole");
  assert.equal(novBoard(hall).people.find((p) => p.handle === "alice").earned, expectEarned(ledger(), "2026-11").get("alice"),
    "alice's 11-25 gift of 99 has not happened as of 11-20");
  // bob received 7 by transfer: his earned is the stage rung alone
  assert.equal(novBoard(hall).people.find((p) => p.handle === "bob").earned, 5, "a transfer moves stamps, it does not earn them");
});

test("holo is apart: carried in its own field, never added into earned, never counted as a plain source", { skip: SKIP }, () => {
  const nov = novBoard(fold());
  const dave = nov.people.find((p) => p.handle === "dave");
  assert.equal(dave.earned, 3, "dave's plain is the three letters, not 3 + 30");
  assert.equal(dave.holo, 30);
  assert.deepEqual(dave.holoPots, [{ pot: "keeping-ec2", n: 30, count: 1 }], "holo breaks down by the pot that minted it, and sums to the holo");
  assert.equal(dave.sources.some((s) => /holo/i.test(s.label)), false, "no plain source is holo");
  // CONTROL: the same 30 as an arrow-bearing MINT row IS plain earned. Without
  // this the assertion above could be green because nothing reads holo at all.
  const plain = hallFromLedger({ mint, entries: entriesOf([{ canonical: mint.giftLine({ date: "2026-11-12", handle: "dave", n: 30, slug: "ctl", by: "keemin" }) }]), asOf: NOW });
  assert.equal(plain.months["2026-11"].people[0].earned, 30, "control: a MINT row of the same size is plain");
  assert.equal(plain.months["2026-11"].people[0].holo, 0);
  // erin has holo and no plain: on the holo board, off the rank
  assert.equal(nov.people.some((p) => p.handle === "erin"), false);
  assert.deepEqual(nov.holoBoard.map((p) => [p.handle, p.holo]), [["dave", 30], ["erin", 15]], "holo board: highest first, a 0-holo row is nobody");
  assert.equal(nov.holoRecipients, 2);
});

test("a stage the town burned and re-credited is earned once, by the right resident", { skip: SKIP }, () => {
  const nov = novBoard(fold());
  assert.equal(nov.people.some((p) => p.handle === "frank"), false, "frank's wrong credit was burned");
  const gina = nov.people.find((p) => p.handle === "gina");
  assert.equal(gina.earned, 10);
  assert.equal(gina.sources[0].label, "Bug-ladder rungs");
  // CONTROL: the same stage line with no burn after it stays frank's
  const rows = ledger().filter((r) => !r.canonical.includes("→ BURN"));
  assert.equal(novBoard(fold(rows)).people.find((p) => p.handle === "frank")?.earned, 10, "control: unburned, the line is earned");
});

test("a MINT row the town's classifier does not name lands in Other mints, so nothing credited goes missing", { skip: SKIP }, () => {
  const hank = novBoard(fold()).people.find((p) => p.handle === "hank");
  assert.equal(hank.earned, 2);
  assert.deepEqual(hank.sources.map((s) => [s.label, s.n]), [["Other mints", 2]]);
  assert.equal(hank.sources[0].records[0].label, "mystery:thing", "labelled by its own for: tag");
});

test("the board is bounded and says how many earned: top HALL_TOP of the month's earners, records capped, totals whole", { skip: SKIP }, () => {
  const many = [];
  for (let i = 0; i < HALL_TOP + 5; i++) many.push({ canonical: mint.giftLine({ date: "2026-11-02", handle: `p${String(i).padStart(2, "0")}`, n: 1000 - i, slug: "bulk", by: "keemin" }) });
  // one person with more rows than the record cap
  for (let i = 0; i < HALL_RECORDS_PER_SOURCE + 4; i++) many.push({ canonical: mint.mintLine({ date: "2026-11-03", handle: "p00", cause: `p00-2026-11-03-to-x-${i}`, side: "sent" }) });
  for (let i = 0; i < HALL_HOLO_TOP + 3; i++) many.push({ canonical: `- 2026-11-04 · holo · h${String(i).padStart(2, "0")} · ${i + 1} · pot:keeping-ec2 · epoch:2026-10 · ref: pi_h${i}` });
  const nov = hallFromLedger({ mint, entries: entriesOf(many), asOf: NOW }).months["2026-11"];
  assert.equal(nov.people.length, HALL_TOP);
  assert.equal(nov.earners, HALL_TOP + 5, "the whole earner count rides beside the cut board");
  assert.equal(nov.holoBoard.length, HALL_HOLO_TOP);
  assert.equal(nov.holoRecipients, HALL_HOLO_TOP + 3);
  const p00 = nov.people[0];
  assert.equal(p00.handle, "p00");
  const sent = p00.sources.find((s) => s.label === "Letters sent");
  assert.equal(sent.count, HALL_RECORDS_PER_SOURCE + 4);
  assert.equal(sent.records.length, HALL_RECORDS_PER_SOURCE, "the list is capped");
  assert.equal(p00.sources.reduce((a, s) => a + s.n, 0), p00.earned, "and the total still adds up with the list capped");
});

test("keeping mint, the town's one arrow-free earned row, counts as earned in its own source", { skip: SKIP }, () => {
  const row = `- 2026-11-05 · minted · iris · 4 · for: keeping:keeping-ec2 · epoch:2026-10`;
  const iris = hallFromLedger({ mint, entries: entriesOf([{ canonical: row }]), asOf: NOW }).months["2026-11"].people[0];
  assert.deepEqual([iris.handle, iris.earned, iris.sources[0].label], ["iris", 4, "Keeping mint"]);
});

test("no as-of day, no hall: a month needs a town clock", { skip: SKIP }, () => {
  assert.equal(hallFromLedger({ mint, entries: [], asOf: null }), null);
  assert.equal(hallFromLedger({ mint, entries: [], asOf: "garbage" }), null);
});

// ── the wiring: the door that actually runs the fold ─────────────────────────

test("WIRING (reads the live town ledger): the seam's own fold carries the hall, and emitSeam writes the file the reader accepts", { skip: SKIP }, async () => {
  const { seamFromTown, emitSeam } = await import("../tools/extract-seam.mjs");
  const entries = entriesOf(ledger());
  const seam = seamFromTown({ mint, entries, potFiles: [], dial: null, asOf: NOW });
  assert.deepEqual(seam.hall, hallFromLedger({ mint, entries, asOf: NOW }), "seamFromTown does not hand the hall through");
  assert.equal(seamFromTown({ mint, entries, potFiles: [], dial: null, asOf: null }).hall, null, "no as-of day, no hall");
  // the whole emitter over the real town checkout, into a folder this test made
  const { mkdtempSync, readFileSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const dir = mkdtempSync(join(tmpdir(), "hall-emit-"));
  try {
    const out = await emitSeam(TOWN, { dataDir: dir });
    const written = JSON.parse(readFileSync(join(dir, "hall-of-fame.json"), "utf8"));
    assert.deepEqual(written, JSON.parse(JSON.stringify(out.hall)), "the file is the fold");
    const read = readHall(written);
    assert.ok(read && Object.keys(read.months).length === Object.keys(written.months).length, "every emitted month reads: the live ledger's own numbers add up");
    for (const body of Object.values(read.months)) {
      assert.ok(body.people.length <= HALL_TOP && body.holoBoard.length <= HALL_HOLO_TOP);
      assert.deepEqual(body.people.map((p) => p.earned), body.people.map((p) => p.earned).sort((a, b) => b - a));
    }
  } finally {
    // the folder this test just made itself (POS-779: a script's own mkdtemp)
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── the reader ───────────────────────────────────────────────────────────────

test("readHall refuses a month whose breakdown does not add up, and keeps the lawful one", { skip: SKIP }, () => {
  const good = JSON.parse(JSON.stringify(fold()));
  assert.ok(readHall(good).months["2026-11"], "control: the lawful emission reads");
  const bad = JSON.parse(JSON.stringify(good));
  bad.months["2026-11"].people[0].earned += 1;
  const read = readHall(bad);
  assert.equal(read.months["2026-11"], undefined, "a number that does not sum is not repaired, it is withheld");
  assert.ok(read.months["2026-10"], "the other month, still lawful, stays");
  // holo that does not sum to its pots is refused the same way
  const badHolo = JSON.parse(JSON.stringify(good));
  badHolo.months["2026-11"].holoBoard[0].holo += 1;
  assert.equal(readHall(badHolo).months["2026-11"], undefined);
  for (const junk of [null, undefined, {}, { as_of: "x", months: {} }, { as_of: "2026-11-20" }, []]) assert.equal(readHall(junk), null);
});

// ── the view: the town's month, honesty, preview = head of the full board ────

test("the preview is the head of the full board, rank for rank and sum for sum", { skip: SKIP }, () => {
  const hall = readHall(fold());
  const full = hallView(hall, { today: NOW });
  const preview = hallView(hall, { today: NOW, limit: 2 });
  assert.deepEqual(preview.rows, full.rows.slice(0, 2));
  assert.deepEqual(preview.holoRows, [], "the holo board is the full page's");
  assert.equal(full.holoRows.length, 2);
  assert.equal(preview.earners, full.earners);
  assert.deepEqual(full.rows.map((r) => r.rank), full.rows.map((_, i) => i + 1));
  for (const r of full.rows) assert.equal(r.sources.reduce((a, s) => a + s.n, 0), r.earned);
});

test("the month rolls over with the TOWN's calendar, not the runner's or UTC's", () => {
  // 03:00Z on 12-01 is still 11-30 in the town (New York); 06:00Z is 12-01
  const lateNov = townDay(new Date("2026-12-01T03:00:00Z"));
  const earlyDec = townDay(new Date("2026-12-01T06:00:00Z"));
  assert.equal(monthOfDay(lateNov), "2026-11", "UTC says December, the town says November");
  assert.equal(monthOfDay(earlyDec), "2026-12");
  assert.equal(prevMonth("2026-01"), "2025-12");
  assert.equal(monthOfDay("garbage"), null);
  assert.equal(monthLabel("2026-11"), "November 2026");
});

test("a month the record has not reached is unavailable, never a zero or last month's board", { skip: SKIP }, () => {
  const hall = readHall(fold());
  const dec = hallView(hall, { today: "2026-12-01" });
  assert.equal(dec.state, "unavailable");
  assert.deepEqual(dec.rows, []);
  assert.equal(dec.asOf, "2026-11-20", "and it says what the record is as of");
  assert.equal(hallView(null, { today: NOW }).state, "unavailable", "no emission at all");
  assert.equal(hallView(hall, { today: "not-a-day" }).state, "unavailable");
  // a month the record holds and nobody earned in is EMPTY, which is a different answer
  const empty = readHall({ as_of: NOW, months: { "2026-11": { earners: 0, holoRecipients: 0, people: [], holoBoard: [] } } });
  assert.equal(hallView(empty, { today: NOW }).state, "empty");
});

test("record links: a letter links to its address, a letter with no page does not, a resident and a pot link to theirs", { skip: SKIP }, () => {
  const hall = readHall(fold());
  const threads = [{ key: "alice-2026-11-02-to-bob-hello", letterIds: ["alice-2026-11-02-to-bob-hello", "bob-2026-11-04-to-alice-reply"] }];
  const letters = threads[0].letterIds.map((id) => ({ id }));
  const book = letterAddresses(threads, letters);
  const view = hallView(hall, { today: NOW, letterBook: book });
  const alice = view.rows.find((r) => r.handle === "alice");
  const sent = alice.sources.find((s) => s.label === "Letters sent");
  const hello = sent.records.find((r) => r.label === "alice-2026-11-02-to-bob-hello");
  assert.equal(hello.href, "/mail/alice-2026-11-02-to-bob-hello/#alice-2026-11-02-to-bob-hello");
  assert.equal(sent.records.find((r) => r.label === "alice-2026-11-03-to-bob-again").href, null, "no conversation page, no link");
  assert.equal(alice.href, "/residents/alice/");
  assert.equal(view.holoRows[0].holoPots[0].href, "/fund/keeping-ec2/");
  // with no address book at all, no letter link is invented
  const bare = hallView(hall, { today: NOW });
  assert.equal(bare.rows.find((r) => r.handle === "alice").sources.every((s) => s.records.every((r) => r.href === null || !r.href.startsWith("/mail/"))), true);
});

// ── the render: the real component, both ways ────────────────────────────────

let server = null, container = null;
before(async () => {
  const { createServer } = await import("vite");
  const { getViteConfig } = await import("astro/config");
  const cfg = await getViteConfig({ root: ROOT, server: { middlewareMode: true, hmr: false }, appType: "custom", logLevel: "error" },
    { root: ROOT, configFile: "astro.config.town.mjs" })({ mode: "test", command: "serve" });
  server = await createServer(cfg);
  const { experimental_AstroContainer } = await import("astro/container");
  container = await experimental_AstroContainer.create();
});
after(async () => { if (server) await server.close(); });

const render = async (view) => {
  const { default: Hall } = await server.ssrLoadModule("/src/components/HallOfFame.astro");
  const html = await container.renderToString(Hall, { props: { view } });
  // Astro's dev render stamps every element with its scope and source location
  // (data-astro-cid-*, data-astro-source-*); the assertions read the markup
  return html.replace(/ data-astro-[a-z-]+(?:="[^"]*")?/g, "");
};

test("the component draws a row per earner with the plain total, a breakdown, and holo in its own ink apart", { skip: SKIP }, async () => {
  const hall = readHall(fold());
  const view = hallView(hall, { today: NOW });
  const aliceTotal = view.rows.find((r) => r.handle === "alice").earned;
  const html = await render(view);
  // Astro appends its scope class to every element of a scoped component
  assert.equal((html.match(/<li class="hof-row[^"]*">/g) ?? []).length, 5, "alice, gina, bob, dave, hank");
  assert.match(html, /<span class="hof-who[^"]*">alice<\/span>/);
  assert.match(html, new RegExp(`stamps earned this month </span>${aliceTotal}<span class="hof-u[^"]*">✦</span>`), "alice's plain total");
  // dave: the plain 3 and the holo 30 are two elements, the second in the holo ink
  assert.match(html, /<span class="hof-holo pm-holo-ink[^"]*"><span class="hof-sr[^"]*">holo this month <\/span>✧ 30<\/span>/);
  assert.equal(html.includes(">33<") || html.includes(">33<span"), false, "33 appears nowhere: holo is never summed into the plain count");
  assert.match(html, new RegExp(`Where ${aliceTotal} stamps came from`));
  assert.match(html, /<details class="hof-det[^"]*">/, "the breakdown is a native disclosure: no script");
  assert.match(html, /counted apart, not in the 3/);
  assert.match(html, /holo this month<\/span> <span class="hof-apart[^"]*">apart from the stamps above, never summed with them/);
  assert.match(html, /Stamps earned in November 2026, highest first\. Tap a name/);
  // the words read as words: Astro once dropped the space in "28 stamps" and "1 row"
  assert.match(html, /· 2 rows<\/span>/);
  assert.match(html, /· 1 row<\/span>/);
  assert.match(html, /<\/span> Letters sent/);
});

test("the preview render: the first rows, 'top N of M', and no holo board", { skip: SKIP }, async () => {
  const hall = readHall(fold());
  const html = await render(hallView(hall, { today: NOW, limit: 2 }));
  assert.equal((html.match(/<li class="hof-row[^"]*">/g) ?? []).length, 2);
  assert.match(html, /top 2 of 5/);
  assert.equal(html.includes("hof-holo-board"), false);
});

test("unavailable and empty say what they are and draw no row", { skip: SKIP }, async () => {
  const hall = readHall(fold());
  const dec = await render(hallView(hall, { today: "2026-12-01" }));
  assert.match(dec, /The Hall of Fame could not be read\./);
  assert.match(dec, /as of 2026-11-20, which is before this month/);
  assert.equal(dec.includes("hof-row"), false, "no fabricated zero row");
  const none = await render(hallView(null, { today: NOW }));
  assert.match(none, /did not find the town's stamp record/);
  const empty = await render(hallView(readHall({ as_of: NOW, months: { "2026-11": { earners: 0, holoRecipients: 0, people: [], holoBoard: [] } } }), { today: NOW }));
  assert.match(empty, /Nobody has earned a stamp yet this month\./);
});
