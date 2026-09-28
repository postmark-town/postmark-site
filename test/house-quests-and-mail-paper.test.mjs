// Keemin, 2026-09-27, on the resident pages and The Mail:
//
//   "The rail of residents should remain as the topmost item (as it is in the
//   household page) for each resident page. We should remove the daily quest
//   progress cards from the individual resident pages, and put them between
//   'Since you last looked' and 'your residents'. Let's use the standard stamp
//   purple colors for them as well instead of the yellow."
//
//   "The Mail's letter cards should be restyled to fit the cream light-mode of
//   letters shown everywhere else on the site."
//
// The built arms read the pages a reader gets; the source arms read the styles.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DIST = new URL("../dist-town/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const src = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const built = (...segs) => existsSync(join(DIST, ...segs));
const page = (...segs) => readFileSync(join(DIST, ...segs), "utf8");
const at = (html, needle) => { const i = html.indexOf(needle); assert.ok(i >= 0, `the page carries ${needle}`); return i; };

test("a resident page of a shared house opens on the rail and carries no quest board",
  { skip: !built("residents", "wright", "index.html") }, () => {
    const html = page("residents", "wright", "index.html");
    const house = html.slice(at(html, "data-house "));
    const rail = at(house, "data-house-tabs");
    assert.ok(rail < at(house, "data-house-plate"), "the rail stands above the nameplate");
    assert.ok(rail < at(house, "data-profile-bubble"), "the rail stands above the profile");
    // the board is on the household seat only; the page's one copy of it is
    // inside the seat's dashboard, never before the rail
    const board = house.indexOf("data-quests ");
    assert.ok(board > rail, "no quest board above the rail");
    assert.ok(board > at(house, "data-hd "), "the board is inside the household dashboard");
  });

// THE BOARD'S POSITION IS NO LONGER PINNED HERE. Keemin, 2026-09-28, moving the
// board into the household page's Posts section (POS-293): "Yeah that's fine,
// delete the guard (it's overkill)." The order assertions (feed → quests →
// residents) are gone from this test and the house-of-one test below; what
// each still holds, it holds.
test("the household seat carries the day's quests, and the dashboard's old small quest panel is gone",
  { skip: !built("households", "starforge", "index.html") }, () => {
    const html = page("households", "starforge", "index.html");
    assert.ok(at(html, "data-quests ") > at(html, "data-hd "), "the board is inside the household dashboard");
    assert.equal(html.includes("data-hd-quests"), false, "the dashboard's old small quest panel is gone");
  });

test("a solo resident's page has no board (a house of one has no seat)",
  { skip: !built("residents", "lupi", "index.html") }, () => {
    assert.equal(page("residents", "lupi", "index.html").includes("data-quests "), false);
  });

test("the quest cards wear stamp violet, never the gold", () => {
  const s = src("town/components/Household.astro");
  const cards = s.slice(s.indexOf("[data-quests] .quest-cards {"), s.indexOf("THE UNCOUNTED BLOCK"));
  assert.ok(cards.length > 0);
  for (const sel of [".quest-card {", ".quest-kind {", ".quest-title {", ".quest-bar-fill {", ".quest-count {"]) {
    const rule = cards.slice(cards.indexOf("[data-quests] " + sel)).split("}")[0];
    assert.match(rule, /--pm-stamp/, `${sel} is a stamp colour`);
    assert.doesNotMatch(rule, /--pm-gold|232, 196, 139/, `${sel} carries no gold`);
  }
});

test("the seat's board shows the house's cards only", () => {
  const s = src("town/components/Household.astro");
  for (const sel of [".quest-uncounted", ".quest-notread", ".quest-arrived", ".quest-card.is-own"]) {
    assert.ok(s.includes(`.hd [data-quests] ${sel}`), `${sel} is hidden on the seat`);
  }
  assert.match(s, /if \(isSeat\) setQuestHand\(null\);/, "only the seat draws the board");
});

test("The Mail's letter cards are on the letter paper", () => {
  const css = src("src/styles/postmark.css");
  const card = css.slice(css.indexOf(".pm .pm-thread-card {")).split("}")[0];
  assert.match(card, /var\(--pm-paper\)/, "the conversation card is cream");
  assert.match(card, /color: var\(--pm-ink\)/);
  const title = css.slice(css.indexOf(".pm .pm-thread-card .t-title {")).split("}")[0];
  assert.match(title, /var\(--pm-ink\)/, "its title is ink, not gold");
  const mail = src("town/pages/mail/index.astro");
  const lt = mail.slice(mail.indexOf(".mail .lt-card {")).split("}")[0];
  assert.match(lt, /var\(--pm-paper\)/, "a filtered letter is cream");
  assert.doesNotMatch(lt, /rgba\(13, 20, 38/, "and not the night card");
});

// Keemin, 2026-09-27: "solo residents should still have a household page now
// that households are the primary key right". A declared house of one opens on
// its seat: the rail, the dashboard, and the board in its slot.
test("a declared house of one has its household page: rail, dashboard, board",
  { skip: !built("households", "casa-nera", "index.html") }, () => {
    const html = page("households", "casa-nera", "index.html");
    const house = html.slice(at(html, "data-house "));
    assert.ok(at(house, "data-house-tabs") < at(house, "data-hd "), "the rail tops the page");
    assert.ok(at(house, "data-quests ") > at(house, "data-hd "), "the board is in the dashboard");
    assert.equal(/data-shared/.test(house.slice(0, 200)), false, "a house of one is not marked shared, so its whole board shows");
  });

test("a solo resident's own page stays folded: no rail, no dashboard",
  { skip: !built("residents", "vellix", "index.html") }, () => {
    const html = page("residents", "vellix", "index.html");
    assert.equal(html.includes("data-house-tabs"), false);
    assert.equal(html.includes("data-hd "), false);
  });
