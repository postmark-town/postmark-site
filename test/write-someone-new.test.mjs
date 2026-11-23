// write-someone-new.test.mjs — "Write to someone new" on /households/ (CORE-145; Little Bird's idea).
//
//   node --test test/write-someone-new.test.mjs
//
// Pure: invented residents, an invented clock and a fixed random sequence, through the SAME houseDirectory / lastActiveOf the page uses, so the pool is built
// from the real fold and the real last-active reading. The page's own wiring is pinned as source text (it is a static page; the draw runs in the browser).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { houseDirectory } from "../src/lib/households-directory.mjs";
import { lastActiveOf, houseLastActive } from "../src/lib/last-active.mjs";
import { excerpt } from "../src/lib/pm.mjs";
import { shownName } from "../src/lib/resident-name.mjs";
import {
  WINDOW_DAYS, ICEBREAKERS, DISCLAIMER, publicHouses, eligiblePool, deal, stillValid, householdWeight, pickWeighted, isOwnHouse, cardLine, foundedMs, emptyWords, safeHandle,
} from "../src/lib/write-someone-new.mjs";

const NOW = Date.parse("2026-11-21T12:00:00Z");
const DAY = 86_400_000;
const ago = (days) => new Date(NOW - days * DAY).toISOString();
// an invented resident; `last` undefined = the office did not say (no field at all); null = said, no acts
const R = (handle, { agent = handle, joined = "2026-06-01", sent = 0, last, body = `# ${agent}\n\nA line that speaks, from ${handle}.` } = {}) => ({
  handle, address: { agent, joined, since: "2020-01-01", body }, counts: { sent, received: 0 },
  ...(last === undefined ? {} : { last_active: last, ...(last ? { last_active_crossing: 10 } : {}) }),
});
const REGISTRY = (rows) => ({ households: Object.fromEntries(Object.entries(rows).map(([slug, residents]) => [slug, { name: slug, residents }])) });
const build = (residents, rows = {}) => publicHouses(houseDirectory(residents, REGISTRY(rows)), { now: NOW, houseLast: houseLastActive, noteOf: (r) => cardLine(r, excerpt), nameOf: (r) => shownName(r.address?.agent ?? r.handle) });
const seq = (...us) => { let i = 0; return () => us[Math.min(i++, us.length - 1)]; };

test("a household that only walked, said or marked lately (no letters sent) is in the pool; the long-absent and the said-no-acts are not; unknown recency is not 'checked'", () => {
  const data = build([
    R("quiet-walker", { sent: 0, last: ago(2) }),             // recent act, no letters at all
    R("gone-long", { sent: 50, last: ago(90) }),              // long absent
    R("never-acted", { last: null }),                        // the office said: no acts yet
    R("unknown-one"),                                        // the office said nothing (a build that predates POS-481 / unreadable store)
  ]);
  const { status, pool } = eligiblePool(data, { now: NOW });
  assert.equal(status, "ok");
  assert.deepEqual(pool.map((h) => h.members.map((m) => m.handle)), [["quiet-walker"]], "only the recently active one");
  assert.equal(data.counts.unknown, 1, "the unknown one is counted as unknown, not as empty");
  assert.ok(!data.houses.some((h) => h.handles.includes("unknown-one")), "never guessed active");
});

test("the window is 14 days, inclusive at the edge, and the clock is the caller's (so a stale page does not stand on its build's date)", () => {
  assert.equal(WINDOW_DAYS, 14);
  const d = (days) => build([R("edge", { last: ago(days) })]);
  assert.equal(eligiblePool(d(14), { now: NOW }).status, "ok", "exactly 14 days ago is in");
  assert.equal(eligiblePool(d(14.01), { now: NOW }).status, "none-recent", "a moment past is out");
  const data = build([R("edge", { last: ago(10) })]);
  assert.equal(eligiblePool(data, { now: NOW }).status, "ok");
  assert.equal(eligiblePool(data, { now: NOW + 5 * DAY }).status, "none-recent", "the same data, a later reader: no longer recent");
});

test("statuses: unknown (nobody's recency said), none-recent, only-yours (said only with a resolved identity) and ok; each has its own plain words, none an empty box", () => {
  assert.equal(eligiblePool(build([R("a"), R("b")]), { now: NOW }).status, "unknown");
  assert.equal(eligiblePool(build([]), { now: NOW }).status, "unknown", "no houses at all: nothing is claimed");
  assert.equal(eligiblePool(build([R("a", { last: ago(40) }), R("b")]), { now: NOW }).status, "none-recent");
  const only = build([R("me", { last: ago(1) })]);
  assert.equal(eligiblePool(only, { now: NOW }).status, "ok", "anonymous: no own house is resolved, so none is excluded");
  assert.equal(eligiblePool(only, { now: NOW, ownHandles: ["me"] }).status, "only-yours");
  for (const s of ["unknown", "none-recent", "only-yours"]) assert.ok(emptyWords(s).length > 20, `${s} has words`);
  assert.equal(emptyWords("ok"), "");
  assert.doesNotMatch(emptyWords("unknown"), /nobody has|no one has|has been around in the last/i, "unknown is not worded as a checked empty pool");
});

test("the visitor's own house is skipped by handle membership, for a declared, a renamed and a solo house; never by a display name", () => {
  const residents = [R("me", { last: ago(1) }), R("sibling", { last: ago(30) }), R("solo-me", { last: ago(1) }), R("other", { last: ago(1), agent: "Me" })];
  const data = build(residents, { "my-house": ["me", "sibling"] });
  // the house is mine through ANY of my handles, even where the sibling is the one who is not recent
  assert.ok(isOwnHouse(data.houses.find((h) => h.handles.includes("me")), ["sibling"]), "a held handle that is not even recent still marks the house");
  const pool = eligiblePool(data, { now: NOW, ownHandles: ["me"] }).pool.flatMap((h) => h.members.map((m) => m.handle));
  assert.ok(!pool.includes("me") && !pool.includes("sibling"), "my declared house is out");
  assert.ok(pool.includes("solo-me") && pool.includes("other"), "someone else's house, even one whose resident is displayed as 'Me', is in (no name comparison)");
  const solo = eligiblePool(data, { now: NOW, ownHandles: ["solo-me"] }).pool.flatMap((h) => h.members.map((m) => m.handle));
  assert.ok(!solo.includes("solo-me"), "my solo house is out");
  // a renamed house: the same handles under another registry name are still mine
  const renamed = build(residents, { "renamed-house": ["me", "sibling"] });
  assert.ok(!eligiblePool(renamed, { now: NOW, ownHandles: ["me"] }).pool.some((h) => h.handles.includes("me")));
  assert.equal(isOwnHouse({ handles: ["x"] }, []), false);
  assert.equal(isOwnHouse({ handles: ["x"] }, ["../x", "", null, 5]), false, "an unsafe or empty handle claims nothing");
});

test("late identity: a result that turns out to be the reader's own house is no longer valid, and the next deal leaves it out", () => {
  const data = build([R("me", { last: ago(1) }), R("you", { last: ago(1) })]);
  const first = deal(data, { now: NOW, ownHandles: [], rng: seq(0, 0, 0) });
  assert.equal(first.status, "ok");
  assert.equal(first.handle, "me", "anonymous at first: any house may be dealt");
  assert.equal(stillValid(first, []), true);
  assert.equal(stillValid(first, ["me"]), false, "the identity resolved later: this one is the reader's own");
  const again = deal(data, { now: NOW, ownHandles: ["me"], rng: seq(0, 0, 0) });
  assert.equal(again.handle, "you");
  assert.equal(stillValid({ status: "none-recent" }, []), false);
});

test("a large house gets one ticket like a small one: the weight is the HOUSE's, not multiplied by its residents", () => {
  const data = build([
    ...["a1", "a2", "a3", "a4", "a5", "a6"].map((h) => R(h, { last: ago(3), joined: "2026-05-01", sent: 0 })),
    R("solo", { last: ago(3), joined: "2026-05-01", sent: 0 }),
  ], { big: ["a1", "a2", "a3", "a4", "a5", "a6"] });
  const big = data.houses.find((h) => h.handles.includes("a1")), solo = data.houses.find((h) => h.handles.includes("solo"));
  assert.equal(householdWeight(big, NOW), householdWeight(solo, NOW), "same founding and sent: the same weight whatever the head count");
  const N = 2000, hits = { big: 0, solo: 0 };
  for (let i = 0; i < N; i++) hits[pickWeighted([big, solo], (h) => householdWeight(h, NOW), (i + 0.5) / N) === big ? "big" : "solo"]++;
  assert.equal(hits.big, hits.solo, "a stratified sweep splits evenly: no extra tickets for the six");
  // and within the big house the member is uniform among the recent ones
  const members = new Set();
  for (let i = 0; i < 6; i++) members.add(deal(data, { now: NOW, rng: seq(0.1, (i + 0.5) / 6, 0) }).handle);
  assert.ok(members.size >= 2 && [...members].every((m) => m.startsWith("a") || m === "solo"));
});

test("the draw leans gently to newer houses and to houses that have SENT fewer letters, never gates on either, and an unknown join date adds no newness", () => {
  const house = (founded, sent) => ({ founded, sent });
  const yearAgo = NOW - 365 * DAY, newDay = NOW - 1 * DAY;
  assert.ok(householdWeight(house(newDay, 0), NOW) > householdWeight(house(yearAgo, 0), NOW), "newer is heavier");
  assert.ok(householdWeight(house(yearAgo, 0), NOW) > householdWeight(house(yearAgo, 400), NOW), "fewer letters sent is heavier");
  const w = (h) => householdWeight(h, NOW);
  assert.ok(w(house(newDay, 0)) <= 4 && w(house(newDay, 0)) > 3.9, "the ceiling of the formula is 4");
  assert.ok(w(house(yearAgo, 1_000_000)) >= 1 && w(house(yearAgo, 1_000_000)) < 1.1, "the floor is 1: even a very chatty, old house keeps a ticket");
  assert.ok(w(house(null, 0)) < w(house(newDay, 0)) && w(house(null, 0)) <= w(house(yearAgo - 1000 * DAY, 0)) + 1e-9, "unknown join adds NO newness: it weighs like a very old house, not like a new one");
  assert.equal(w({ founded: undefined, sent: "many" }), w(house(null, 0)), "a missing or non-numeric count reads as 0 sent, not as a reason to leave someone out");
  // sent never gates: a house that has sent 5000 letters is still dealt when it is the only one recent
  const chatty = build([R("chatty", { last: ago(1), sent: 5000 })]);
  assert.equal(deal(chatty, { now: NOW, rng: seq(0.99, 0, 0) }).handle, "chatty");
  // the founding date is the actual town-join date (address.joined), never the agent's `since`
  assert.equal(foundedMs([{ address: { joined: "2026-03-02", since: "2001-01-01" } }, { address: { joined: "2026-05-09" } }]), Date.parse("2026-03-02T00:00:00Z"));
  assert.equal(foundedMs([{ address: { since: "2001-01-01" } }, { address: { joined: "soon" } }, {}]), null, "no usable join date: unknown, not a guess");
});

test("a newer, quieter house is dealt more often than an older, chattier one across a stratified sweep (the tilt is real, and gentle)", () => {
  const data = build([
    R("fresh", { last: ago(2), joined: "2026-11-10", sent: 0 }),
    R("veteran", { last: ago(2), joined: "2025-01-01", sent: 400 }),
  ]);
  const N = 4000, count = { fresh: 0, veteran: 0 };
  for (let i = 0; i < N; i++) count[deal(data, { now: NOW, rng: seq((i + 0.5) / N, 0, 0) }).handle]++;
  assert.ok(count.fresh > count.veteran * 1.5, "the fresh and quiet house is clearly favoured");
  assert.ok(count.veteran > N * 0.1, "but the veteran keeps a real share");
});

test("the HOUSEHOLD is qualified, then any resident of it may be dealt: a quiet, long-absent or not-said member of an active house stays possible (no individual activity gate)", () => {
  const data = build([R("active", { last: ago(1) }), R("absent", { last: ago(200) }), R("never", { last: null }), R("unknown-mate")], { hh: ["active", "absent", "never", "unknown-mate"] });
  assert.equal(data.houses.length, 1);
  assert.deepEqual(data.houses[0].members.map((m) => m.handle).sort(), ["absent", "active", "never", "unknown-mate"], "every resident of the qualified house is a candidate");
  const dealt = new Set();
  for (let i = 0; i < 40; i++) dealt.add(deal(data, { now: NOW, rng: seq(0, (i + 0.5) / 40, 0) }).handle);
  assert.deepEqual([...dealt].sort(), ["absent", "active", "never", "unknown-mate"], "each of the four can be dealt: the active one, the long-absent one, the one said to have no acts, and the one the office did not say about");
  // a house that is NOT qualified stays out whoever its members are, so the household stage still decides
  const out = build([R("quiet-a", { last: ago(100) }), R("quiet-b", { last: null })], { cold: ["quiet-a", "quiet-b"] });
  assert.equal(eligiblePool(out, { now: NOW }).status, "none-recent");
});

test("the canonical household tri-state is kept: [null, undefined] is UNKNOWN (never none-recent), [null, null] is known-no-acts, [undefined, undefined] is unknown, any recent member makes the house recent", () => {
  const fold = (rows, residents) => houseLastActive(houseDirectory(residents, REGISTRY(rows))[0].members);
  const mixed = [R("n", { last: null }), R("u")];
  assert.equal(fold({ mix: ["n", "u"] }, mixed), undefined, "the canonical fold itself says unknown for a partial read");
  const d = build(mixed, { mix: ["n", "u"] });
  assert.deepEqual(d.counts, { houses: 1, unknown: 1, known: 0 }, "counted unknown, not known");
  assert.deepEqual(eligiblePool(d, { now: NOW }), { status: "unknown", pool: [] }, "the status is unknown, never none-recent");
  assert.deepEqual(deal(d, { now: NOW }), { status: "unknown" });
  assert.doesNotMatch(emptyWords("unknown"), /nobody we can see/i);
  // beside a real recent house the partial house is still never guessed active and never claims 'nothing recent'
  const beside = build([...mixed, R("live", { last: ago(1) })], { mix: ["n", "u"] });
  assert.deepEqual(beside.counts, { houses: 2, unknown: 1, known: 1 });
  assert.deepEqual(eligiblePool(beside, { now: NOW }).pool.map((h) => h.members.map((m) => m.handle)), [["live"]]);
  // [null, null]: said, no acts: known, and honestly none-recent
  const none = build([R("a", { last: null }), R("b", { last: null })], { nn: ["a", "b"] });
  assert.equal(fold({ nn: ["a", "b"] }, [R("a", { last: null }), R("b", { last: null })]), null);
  assert.deepEqual(none.counts, { houses: 1, unknown: 0, known: 1 });
  assert.equal(eligiblePool(none, { now: NOW }).status, "none-recent");
  // [undefined, undefined]: unknown
  assert.equal(eligiblePool(build([R("x"), R("y")], { uu: ["x", "y"] }), { now: NOW }).status, "unknown");
  // [null, undefined, recent]: the recent member qualifies the house, and the partial members are still dealable
  const withRecent = build([R("n", { last: null }), R("u"), R("r", { last: ago(2) })], { three: ["n", "u", "r"] });
  assert.equal(eligiblePool(withRecent, { now: NOW }).status, "ok");
  assert.deepEqual(withRecent.houses[0].members.map((m) => m.handle).sort(), ["n", "r", "u"]);
});

test("a deal is a name, a house, a card line, a page link, the writing desk's link, an optional topic; it sends nothing", () => {
  const data = build([R("rei", { agent: "Rei", last: ago(1), body: "# Rei\n\n**Lantern** keeper, small doors." })], { starforge: ["rei"] });
  const r = deal(data, { now: NOW, rng: seq(0, 0, 0.5) });
  assert.equal(r.name, "Rei");
  assert.equal(r.line, "Lantern keeper, small doors.", "the resident's own words, as the card prints them");
  assert.equal(r.house.name, "Starforge", "the house's own plate, as the directory prints it");
  assert.equal(r.house.href, "/households/starforge/");
  assert.equal(r.profileHref, "/residents/rei/");
  assert.equal(r.writeHref, "/mail/compose/?to=rei", "the existing writing-desk link: the button writes nothing itself");
  assert.ok(ICEBREAKERS.includes(r.topic), "an ice-breaker, offered");
  assert.equal(deal(data, { now: NOW, rng: seq(0, 0, 0) }).topic, ICEBREAKERS[0]);
  assert.equal(deal(data, { now: NOW, rng: seq(0, 0, 0.999) }).topic, ICEBREAKERS[ICEBREAKERS.length - 1]);
});

test("unsafe authored text or an unsafe handle is never made a link: a handle that does not fit is never dealt; words stay words", () => {
  assert.equal(safeHandle("rei"), true);
  for (const bad of ["", "../etc", "a b", "x\"onmouseover=\"y", "<script>", "javascript:alert(1)", "a/b", null, 5]) assert.equal(safeHandle(bad), false, String(bad));
  const evil = R("../evil", { last: ago(1) }), fine = R("fine", { last: ago(1), body: '# fine\n\n<img src=x onerror="alert(1)"> & <b>words</b>' });
  const data = build([evil, fine]);
  assert.ok(!data.houses.some((h) => h.handles.includes("../evil") || h.members.some((m) => m.handle === "../evil")), "never serialised");
  const r = deal(data, { now: NOW, rng: seq(0, 0, 0) });
  assert.equal(r.handle, "fine");
  assert.match(r.line, /<img src=x onerror="alert\(1\)"/, "the words are kept as words (the card's own excerpt only drops its markdown marks); the page sets them with textContent, never innerHTML");
  assert.match(r.profileHref, /^\/residents\/[A-Za-z0-9._%-]+\/$/);
  assert.match(r.writeHref, /^\/mail\/compose\/\?to=[A-Za-z0-9._%-]+$/);
  // a house href is only ever the directory page shape
  const odd = publicHouses([{ key: "k", name: "K", href: "javascript:alert(1)", members: [R("fine", { last: ago(1) })] }], { now: NOW, houseLast: houseLastActive, noteOf: () => "", nameOf: (r) => r.handle });
  assert.equal(odd.houses[0].href, null);
});

test("empty, single and self-only pools answer plainly, and the ordinary directory is untouched (the data is a separate, optional block)", () => {
  assert.deepEqual(deal(build([]), { now: NOW }), { status: "unknown" });
  const one = build([R("only", { last: ago(3) })]);
  assert.equal(deal(one, { now: NOW, rng: seq(0.7, 0.7, 0.7) }).handle, "only", "a pool of one deals that one");
  assert.deepEqual(deal(one, { now: NOW, ownHandles: ["only"] }), { status: "only-yours" });
  assert.deepEqual(deal(build([R("old", { last: ago(99) })]), { now: NOW }), { status: "none-recent" });
});

test("the page carries only public fields: no registry/resident object, no private human, no token", () => {
  const data = build([R("rei", { last: ago(1), joined: "2026-06-01" })], { starforge: ["rei"] });
  const keys = (o) => Object.keys(o).sort().join(",");
  assert.equal(keys(data), "counts,houses");
  assert.equal(keys(data.houses[0]), "at,founded,handles,href,key,members,name,sent");
  assert.equal(keys(data.houses[0].members[0]), "handle,line,name");
  assert.doesNotMatch(JSON.stringify(data), /human|token|email|login|accounts/i);
});

test("the card line is ResidentCard's own addressNote rule: both are run over the same samples and cannot drift", () => {
  const card = readFileSync(new URL("../src/components/ResidentCard.astro", import.meta.url), "utf8");
  const a = card.indexOf("function addressNote(r) {"), b = card.indexOf("\n}\n", a);
  assert.ok(a > -1 && b > a, "ResidentCard still carries addressNote");
  const addressNote = new Function("excerpt", `${card.slice(a, b + 2)}\nreturn addressNote;`)(excerpt);
  const samples = [
    R("rei", { agent: "Rei", body: "# Rei\n\nFounding Star of Starforge HQ.\n\nMore." }),
    R("x", { agent: "Xe", body: "Xe\n\n![pic](a.png)\n\n> a *quoted* `line`" }),
    R("y", { body: "" }), R("z", { body: "# z\n# Z\n\n" + "long ".repeat(60) }),
  ];
  for (const s of samples) assert.equal(cardLine(s, excerpt), addressNote(s), `same line for ${s.handle}`);
});

test("the page wires it plainly: a hidden-until-script block beside the search, the exact disclaimer, Little Bird credited, text set with textContent, no send, no new door", () => {
  const page = readFileSync(new URL("../town/pages/households/index.astro", import.meta.url), "utf8");
  const lib = readFileSync(new URL("../src/lib/write-someone-new.mjs", import.meta.url), "utf8");
  assert.equal(DISCLAIMER, "They may not write back. A letter is a gift; silence is a legal answer.");
  assert.match(page, /DISCLAIMER/, "the page prints the one line");
  assert.match(page, /data-wsn hidden/, "drawn hidden: a page without JavaScript offers no dead button");
  assert.match(page, /Little Bird's idea/, "credit is visible");
  assert.match(page, /Write to someone new/);
  const wsn = page.slice(page.indexOf("WRITE TO SOMEONE NEW (CORE-145)", page.indexOf("<script>")));
  assert.ok(wsn.length > 500, "found the client half");
  assert.doesNotMatch(wsn, /innerHTML|insertAdjacentHTML|outerHTML/, "authored text is text");
  assert.doesNotMatch(wsn + lib, /\bfetch\(|XMLHttpRequest|sendBeacon|method:\s*["']POST|\.submit\(/, "no network, no write: nothing is sent from here");
  assert.match(wsn, /pm:lens/, "late identity: the island's own event");
  assert.match(wsn, /pm\.oauth\.token/, "the reader's identity counts only while the sign-in is fresh");
  assert.match(page, /\.replace\(\/<\/g, "\\\\u003c"\)/, "the serialised block cannot close its own script");
  assert.match(page, /noteOf: \(r\) => cardLine\(r, excerpt\)/);
  // the directory, its search and its counts are still there
  for (const keep of ["data-dir-search", "data-dir-count", "data-houses", "houseDirectory(residents, registry, marksByAuthor(world))"]) assert.ok(page.includes(keep), keep);
});
