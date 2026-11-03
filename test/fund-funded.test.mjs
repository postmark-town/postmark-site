// fund-funded.test.mjs — a filled one-time pot keeps its page, as funded (POS-664).
//
//   node --test test/fund-funded.test.mjs
//
// The receipt that fills a closes_at_fill pot closes its file in the same act
// (town #3896), so its row reads `closed`, and /fund/<pot> used to 404 from that
// moment: a giver following a shared link got nothing where "this pot has what
// it asked for" belonged. The page now stays, says funded, thanks the givers,
// shows the roll, and offers no way to pay.
//
// THE FLIPS: make isFunded ignore `received >= target` and § 1 goes red; drop
// the funded map from fundPages and § 2 goes red; drop filled_line from
// thankYouOf and § 3 goes red; lift a rail out of the page's open gate and § 4
// (built) and fund-page.test.mjs § ONLY AN OPEN POT go red.

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { toPot, livePots, loadPots, isFunded, fundPages, thankYouOf, INTAKE, INTAKE_BY_POT } from "../src/lib/funding.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// a pot row as extract-seam.mjs emits it
const ROW = (over = {}) => ({
  pot: "meeps-home", subtype: "bounty", status: "open", title: "Give the meeps a home",
  source: "A one-time need.", target_usd_per_epoch: 859, epoch_cadence: "once", beneficiary: "keeminlee",
  uncapped: false, close: "epoch", epoch: "2026-10", received_usd: 0, staked: 0, stakers: [], patrons: [],
  closes_at_fill: true, ...over,
});
const FILLED = ROW({ status: "closed", received_usd: 859, staked: 30, stakers: [{ handle: "alden", staked: 30 }],
  patrons: [{ patron: "wright", usd: 800, holo: 0 }, { patron: "rei", usd: 59, holo: 0 }] });
const MONTHLY = (over = {}) => ROW({ pot: "keeping-ec2", title: "Keep the town on EC2", target_usd_per_epoch: 150,
  epoch_cadence: "monthly", closes_at_fill: undefined, ...over });

test("1 · funded means a one-time pot, closed, whose dollars reached its need — never less", () => {
  assert.equal(isFunded(toPot(FILLED)), true);
  assert.equal(isFunded(toPot(ROW({ status: "closed", received_usd: 500 }))), false,
    "a one-time pot closed by hand short of its need was not funded");
  assert.equal(isFunded(toPot(ROW({ received_usd: 859 }))), false, "an open pot is not funded, whatever it holds");
  assert.equal(isFunded(toPot(MONTHLY({ status: "closed", received_usd: 150 }))), false,
    "a closed MONTH of a monthly pot is a past month, not a funded pot");
  assert.equal(isFunded(null), false);
});

test("2 · a filled one-time pot keeps its page; a closed monthly pot and a short once pot get none", () => {
  const board = livePots([FILLED, MONTHLY({ epoch: "2026-10", received_usd: 40 }), MONTHLY({ status: "closed", epoch: "2026-09", received_usd: 150 })]);
  const pages = fundPages(board);
  const slugs = pages.map((p) => p.pot.pot).sort();
  assert.deepEqual(slugs, ["keeping-ec2", "meeps-home"], "one page per slug, the filled pot's included");

  const funded = pages.find((p) => p.pot.pot === "meeps-home");
  assert.equal(funded.pot.status, "closed", "the page is the closed row, never one dressed as open");
  assert.equal(isFunded(funded.pot), true);
  assert.deepEqual(funded.past, [], "its row IS the page, so it lists no past month of itself");
  assert.deepEqual(funded.tabs.map((t) => t.pot), ["keeping-ec2"], "the tabs are the open pots only");

  const monthly = pages.find((p) => p.pot.pot === "keeping-ec2");
  assert.equal(monthly.pot.status, "open", "a pot with an open row is paged from it, as before");
  assert.deepEqual(monthly.past.map((p) => p.epoch), ["2026-09"], "its sealed month is still read on its page");

  // the pots with no open or draft row and no fill: no page, as before POS-664
  assert.deepEqual(fundPages(livePots([ROW({ status: "closed", received_usd: 500 })])), [],
    "a once pot closed short of its need gets no page that could say funded");
  assert.deepEqual(fundPages(livePots([MONTHLY({ status: "closed", epoch: "2026-09", received_usd: 150 })])), [],
    "a monthly pot that stopped asking gets no page");
});

test("3 · the funded thank-you is the town's own filled_line, or nothing", () => {
  const base = { pot: "meeps-home", min_usd: 10, card: "Fill this pot.", line: "if this pot fills, a sticker." };
  assert.equal(thankYouOf(base).filled_line, null, "no filled_line in the record: the funded page says no sticker sentence");
  assert.equal(thankYouOf({ ...base, filled_line: "It filled: a sticker." }).filled_line, "It filled: a sticker.");
  assert.equal(thankYouOf({ ...base, filled_line: "   " }).filled_line, null, "a blank one is none");
  const PAGE = readFileSync(join(ROOT, "town", "pages", "fund", "[pot].astro"), "utf8");
  assert.match(PAGE, /\{thanks\?\.filled_line && /, "the page says filled_line only when the record has it");
  assert.doesNotMatch(PAGE.slice(PAGE.indexOf("data-funded")), /^\s*\{thanks\.line\}/m,
    "the funded section never says the if-it-fills line");
});

// ── 4 · the built pages: no rail on any page whose pot is not open ─────────
const DIST = join(ROOT, "dist-town");
const built = existsSync(join(DIST, "fund", "index.html"));
const visible = (page) => page.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "");
const ADDRESSES = [INTAKE, ...Object.values(INTAKE_BY_POT)].map((a) => a.toLowerCase());
const RAILS = [
  ["the card link", (h) => h.includes("buy.stripe.com")],
  ["an intake address", (h) => ADDRESSES.some((a) => h.toLowerCase().includes(a))],
  ["the PayPal panel", (h) => h.includes("data-pp-client")],
  ["the USDC panel", (h) => /id="usdc"/.test(h)],
  ["the witness form", (h) => h.includes('id="pm-fund-form"')],
  ["the stake form", (h) => h.includes("data-stake-form")],
];

test("4 · every built fund page whose pot is not open carries no rail; a funded one says funded and shows its roll", { skip: !built }, () => {
  const pages = fundPages(livePots(loadPots()));
  let closed = 0;
  for (const { pot } of pages) {
    const f = join(DIST, "fund", pot.pot, "index.html");
    if (!existsSync(f)) continue;
    const page = visible(readFileSync(f, "utf8"));
    if (pot.status === "open") continue;
    closed++;
    for (const [rail, carries] of RAILS) assert.equal(carries(page), false, `/fund/${pot.pot}/ (${pot.status}) carries no ${rail}`);
    if (isFunded(pot)) {
      assert.ok(page.includes("data-funded"), `/fund/${pot.pot}/ says it is funded`);
      assert.ok(page.includes("Thank you to every household that gave."), `/fund/${pot.pot}/ thanks its givers`);
      assert.ok(page.includes('id="roll"'), `/fund/${pot.pot}/ shows the roll`);
      assert.ok(!page.includes("DRAFT · NOT OPEN"), `/fund/${pot.pot}/ is not called a draft`);
    }
  }
  // the live data may hold no closed or draft pot today; the check is standing, and says so
  if (closed === 0) assert.ok(true, "no non-open pot in this build's data: nothing to check yet");
});
