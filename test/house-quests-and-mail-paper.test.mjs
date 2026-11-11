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

// POS-984 (Darko, 2026-11-09 14:34 EST): a declared house has ONE page, /households/<slug>/. Until 2026-11-09 these two
// asserted a resident page of a shared house carried the seat's board (hidden, behind the Household tab) and that the
// seat put the quests between "Since you last looked" and the residents. The seat is the Hearth now; a resident's page of
// a declared house carries no seat at all. Until 2026-11-10 the quests sat in the site's band above the Hearth, for the
// signed-in human; the band is gone and the day's quests are off the household page (Darko, 17:14 EST: stale since the
// quest log grew), so they remain only on an UNDECLARED shared house's seat (HouseDashboard), on its resident pages.
// Until 2026-11-11 the rail here was the resident page's own tab rail, over a nameplate. POS-999 (Darko, 2026-11-11 10:48 EST: "We need to unify the subrail of
// the household and each resident page") made it the household's sub-rail, the household page's own, and took the nameplate (the sub-rail says it).
test("a resident page of a shared house opens on the household's sub-rail, whose first chip is a link to the household page, and carries no quest board",
  { skip: !built("residents", "wright", "index.html") }, () => {
    const html = page("residents", "wright", "index.html");
    const house = html.slice(at(html, "data-house "));
    const rail = at(house, "data-house-rail");
    assert.equal(house.includes("data-house-plate"), false, "no nameplate under it");
    assert.ok(rail < at(house, "data-profile-bubble"), "the rail stands above the profile");
    assert.match(house.slice(rail, rail + 400), /<a class="pm-chip is-first" data-house-link href="\/households\/starforge\/"/, "the rail's first chip goes to the household's page");
    assert.equal(house.includes("data-house-tab=\"__house\""), false, "no second copy of the seat on a resident's page");
    assert.equal(house.indexOf("data-quests "), -1, "the board is on the household page only");
  });

test("the household page carries no day's quests and no band: the design draws the house",
  { skip: !built("households", "starforge", "index.html") }, () => {
    const html = page("households", "starforge", "index.html");
    at(html, "data-hearth-stage ");
    assert.equal(html.includes("data-quests "), false, "no quest board on the household page");
    assert.equal(html.includes("data-hband"), false, "and no band to host one");
    assert.equal(html.includes("data-hd-quests"), false, "the dashboard's old small quest panel is gone");
    assert.equal(html.includes('id="hd-feed-h"'), false, "the old dashboard's feed is not on the one page: the design draws the house");
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
// Until 2026-11-11 this held "no rail" on a house of one's page. POS-999 put the household's sub-rail in every household page's strip, a house of one's too.
test("a declared house of one has its household page: the strip with its sub-rail, then the design, with no band and no board",
  { skip: !built("households", "casa-nera", "index.html") }, () => {
    const html = page("households", "casa-nera", "index.html");
    const house = html.slice(at(html, "data-house "));
    assert.ok(at(house, "data-hearth-bar") < at(house, "data-hearth-stage "), "the strip tops the design");
    assert.ok(at(house, "data-hearth-bar") < at(house, "data-house-rail") && at(house, "data-house-rail") < at(house, "data-hearth-stage "), "the sub-rail is in the strip");
    assert.equal(house.includes("data-house-tabs"), false, "no old tab rail");
    assert.equal(house.includes("data-hband"), false, "no band");
    assert.equal(house.includes("data-quests "), false, "no board");
    assert.equal(/data-shared/.test(house.slice(0, 200)), false, "a house of one is not marked shared");
  });

// Until 2026-11-11 a solo resident's page stayed folded, with no rail. POS-999 put the household's sub-rail on every resident page: on a house of one it is
// the way to the household's page (the nameplate's "the household →" link is gone with the nameplate). It still has no dashboard.
test("a solo resident's own page carries the household's sub-rail (its household chip, its own chip) and no dashboard",
  { skip: !built("residents", "vellix", "index.html") }, () => {
    const html = page("residents", "vellix", "index.html");
    assert.equal(html.includes("data-house-tabs"), false);
    assert.match(html, /<a class="pm-chip is-first" data-house-link href="\/households\/[^"]+\/"/, "its household chip links to its household page");
    assert.match(html, /data-rail-chip="vellix" href="\/residents\/vellix\/" aria-current="page"/, "its own chip is lit");
    assert.equal(html.includes("data-hd "), false);
  });
