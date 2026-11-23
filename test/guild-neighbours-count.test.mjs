// guild-neighbours-count.test.mjs — the Quest Guild's Bring a neighbour card shows the town's total this month (POS-885).
//
//   POSTMARK_TOWN=<a town checkout> node --test test/guild-neighbours-count.test.mjs
//
// LAW (Wright's call on POS-885, 2026-11-16 18:2x EST, logged on the issue): "the Guild page is town-wide, so the card shows the
// town's total of neighbours brought this month, not one household's 'N of 10'." The count is the inviter-side payouts of the town
// month, the same ledger rows the office board's per-household count reads (town quest-progress.mjs invitesPaidByHouse), taken across
// every household. A month the record does not hold is "unavailable", never a zero (the board's own law: uncounted is not zero).
//
// THE LEDGER IS INVENTED and every invite line is written by the town's own builders (stamp-mint.mjs inviteInviterLine,
// inviteInvitedLine), so a fixture cannot drift from the grammar the fold reads. A test that needs the town's code skips without a
// checkout, saying so in its title (TEST-DESIGN).

import test, { before } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { hallFromLedger, readHall, hallView } from "../src/lib/hall-of-fame.mjs";
import { questCards, questBoardFrom, monthTallies } from "../src/lib/civic.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TOWN = [process.env.POSTMARK_TOWN, ...[".postmark-checkout", "../postmark", "../../postmark"].map((p) => resolve(ROOT, p))]
  .filter(Boolean)
  .find((p) => existsSync(join(p, "tools", "stamp-mint.mjs")));
const SKIP = !TOWN && "needs the town's tools/stamp-mint.mjs: set POSTMARK_TOWN to a town checkout";

let mint = null;
before(async () => { if (TOWN) mint = await import(pathToFileURL(join(TOWN, "tools", "stamp-mint.mjs")).href); });

const NOW = "2026-11-20";
const parse = (lines) => mint.parseStampLedger(lines.join("\n"));
const inviter = (date, handle, invited, by, activated = "2026-11-01") => mint.inviteInviterLine({ date, handle, invited, inviter: by, activated });
const invited = (date, handle, key, by) => mint.inviteInvitedLine({ date, handle, invited: key, inviter: by });

// November: three inviter payouts across two houses, each with its invited-side line beside it; an October payout; and one dated
// after the as-of day. Only the three November inviter lines are neighbours brought this month.
const LEDGER = () => [
  inviter("2026-11-03", "alice", "hh:n1", "hh:alice"),
  invited("2026-11-03", "nova", "hh:n1", "hh:alice"),
  inviter("2026-11-05", "alice", "hh:n2", "hh:alice"),
  invited("2026-11-05", "orin", "hh:n2", "hh:alice"),
  inviter("2026-11-09", "bea", "hh:n3", "hh:bea"),
  invited("2026-11-09", "pia", "hh:n3", "hh:bea"),
  inviter("2026-10-30", "alice", "hh:n0", "hh:alice"),
  invited("2026-10-30", "quin", "hh:n0", "hh:alice"),
  inviter("2026-11-25", "alice", "hh:n9", "hh:alice"),
];

test("the month's figure is the inviter-side payouts of the town month: the invited side, last month and a future day are not neighbours brought", { skip: SKIP }, () => {
  const hall = hallFromLedger({ mint, entries: parse(LEDGER()), asOf: NOW });
  assert.equal(hall.months["2026-11"].invitesPaid, 3, "three inviter-side lines in November, across two houses");
  assert.equal(hall.months["2026-10"].invitesPaid, 1, "October's own line is October's");
});

test("CONTROL: the same ledger with no inviter lines counts a real zero, and a ledger with only the invited sides too", { skip: SKIP }, () => {
  const none = parse([invited("2026-11-03", "nova", "hh:n1", "hh:alice"), mint.giftLine({ date: "2026-11-04", handle: "alice", n: 5, slug: "a-gift", by: "keemin" })]);
  assert.equal(hallFromLedger({ mint, entries: none, asOf: NOW }).months["2026-11"].invitesPaid, 0, "the invited side pays but is not a neighbour brought");
});

test("the view carries the figure for the town's month, and null (never a zero) when the record does not have it", { skip: SKIP }, () => {
  const hall = readHall(hallFromLedger({ mint, entries: parse(LEDGER()), asOf: NOW }));
  assert.equal(hallView(hall, { today: NOW, limit: 5 }).invitesPaid, 3);
  assert.equal(hallView(hall, { today: "2026-10-15", limit: 5 }).invitesPaid, 1);
  assert.equal(hallView(hall, { today: "2026-12-01", limit: 5 }).invitesPaid, null, "a month the record has not reached");
  assert.equal(hallView(null, { today: NOW }).invitesPaid, null, "no emission at all");
  const month = (extra) => ({ as_of: NOW, months: { "2026-11": { earners: 0, holoRecipients: 0, people: [], holoBoard: [], ...extra } } });
  assert.equal(hallView(readHall(month({})), { today: NOW }).invitesPaid, null, "an emission from before the field is no value");
  assert.equal(hallView(readHall(month({ invitesPaid: -1 })), { today: NOW }).invitesPaid, null, "a bent value is no value");
  assert.equal(hallView(readHall(month({ invitesPaid: 2.5 })), { today: NOW }).invitesPaid, null);
  assert.equal(hallView(readHall(month({ invitesPaid: 0 })), { today: NOW }).invitesPaid, 0, "a counted zero stays a zero");
});

// ── the card ─────────────────────────────────────────────────────────────────
const row = (id, cadence, over = {}) => ({ id, title: `Title of ${id}`, cadence, validation: "automatic", source: `how to ${id}`, reward: `reward of ${id}`, target: 10, ...over });
const REGISTRY = { quests: [row("bring-a-neighbour", "monthly", { title: "Bring a neighbour" }), row("sweep-the-steps", "monthly"), row("a-daily", "daily")] };

test("Bring a neighbour's card carries the town's total; every other card is untouched and carries no such key", () => {
  const board = questBoardFrom({ posts: [] }, { registry: REGISTRY });
  const tallies = monthTallies(REGISTRY, { invitesPaid: 7 });
  assert.deepEqual(tallies, { "Bring a neighbour": 7 }, "only the quest the town's month figure answers, by its registry id");
  const cards = questCards({ completedBy: {}, total: 4 }, board, tallies);
  assert.equal(cards.find((c) => c.title === "Bring a neighbour").monthTotal, 7);
  const other = cards.find((c) => c.title === "Title of sweep-the-steps");
  assert.equal("monthTotal" in other, false, "a monthly quest the figure does not answer gets no town total");
  assert.deepEqual(questCards({ completedBy: {}, total: 4 }, board), questCards({ completedBy: {}, total: 4 }, board, {}), "no tallies, no change");
});

test("an unavailable figure is null on the card, a counted zero is 0, and neither borrows the daily board's count", () => {
  const board = questBoardFrom({ posts: [] }, { registry: REGISTRY });
  const card = (view) => questCards({ completedBy: { "Bring a neighbour": 4 }, total: 9 }, board, monthTallies(REGISTRY, view)).find((c) => c.title === "Bring a neighbour");
  assert.equal(card({ invitesPaid: null }).monthTotal, null);
  assert.equal(card(null).monthTotal, null);
  assert.equal(card({ invitesPaid: 0 }).monthTotal, 0, "zero neighbours this month is a real answer");
  assert.equal(card({ invitesPaid: 0 }).done, 4, "the board snapshot field is left as the mirror gave it; the page chooses the town figure over it");
});

test("the page draws the town total for a card that has one, 'Town count unavailable' for a null, and falls back to the board count for the rest", () => {
  const hub = readFileSync(new URL("../town/pages/town/index.astro", import.meta.url), "utf8");
  assert.match(hub, /monthTallies\(questRegistry, hallPreview\)/, "the page no longer hands the card its town figure");
  assert.match(hub, /\{"monthTotal" in q \? \(/, "the card's town-total branch is gone");
  assert.match(hub, /<b>\{q\.monthTotal\}<\/b> \{q\.monthTotal === 1 \? "neighbour" : "neighbours"\} brought this month <span class="m-dim">· town total<\/span>/);
  assert.match(hub, /<p class="m-barlab m-dim">Town count unavailable<\/p>/);
  assert.match(hub, /\) : q\.done != null && q\.of \? \(/, "the board-count branch is still there for the daily cards");
  assert.ok(hub.indexOf("const hallPreview") < hub.indexOf("const questRows"), "the Hall's view must be read before the cards are drawn from it");
});
