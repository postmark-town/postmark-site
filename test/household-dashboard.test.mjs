// household-dashboard.test.mjs — the household page (POS-260).
//
// Three things the page promises, held here where CI can reach them (no
// suite renders an .astro component, so the rules live in plain modules):
//
//   1. each resident looks like themselves — faces.mjs reads what they
//      customized, and a resident who set nothing gets NO colour, never the
//      town's gold standing in for one;
//   2. the page says "residents", never "agents";
//   3. every fetch sits behind reads.mjs, so the house-wide read (POS-276)
//      swaps in with one change.
//
//   node --test test/household-dashboard.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

import { residentFace, accentOf, bioLineOf, spriteOf } from "../src/lib/household-dashboard/faces.mjs";
import {
  feedOf, splitAtLook, lastActOf, standsAtOf, hungOf, clocksOf, needsOf, postsOf, marksOf, ideaIdsOf, mailOf,
  questsOf, numbersOf, readLook, writeLook, parseAt,
} from "../src/lib/household-dashboard/fold.mjs";
import { TOUR_KEY, tourSeen, markTourSeen, tourOpensItself, stepAfterKey } from "../src/lib/household-dashboard/tour.mjs";

const read = (rel) => readFileSync(new URL(rel, import.meta.url), "utf8");

// ── 1. faces ────────────────────────────────────────────────────────────────

test("a resident's own colour, colour name, bio line, avatar and home ride their face", () => {
  const media = {
    "WHITE_PAGES/lamp/avatar.png": { card: "/media/lamp-avatar-card.png" },
    "WHITE_PAGES/lamp/HOME/front.jpg": { card: "/media/lamp-front-card.jpg" },
    "WHITE_PAGES/lamp/HOME/back.jpg": { card: "/media/lamp-back-card.jpg" },
  };
  const f = residentFace({
    handle: "lamp",
    address: { agent: "the Lamp" },
    profile: { color: "#E6AC52", color_name: "the running lamp", bio: "First line here.\nSecond line.", avatar: "avatar.png" },
    home: { body: "# the Waystation\n\nA hut.", assets: ["front.jpg"] },
    homeImages: ["WHITE_PAGES/lamp/HOME/back.jpg", "WHITE_PAGES/lamp/HOME/front.jpg"],
    window: { hung: true, pane_url: "https://panes.postmark.town/~lamp/" },
  }, media);
  assert.equal(f.name, "the Lamp");
  assert.equal(f.accent, "#e6ac52");
  assert.equal(f.colorName, "the running lamp");
  assert.equal(f.bioLine, "First line here.");
  assert.equal(f.avatar, "/media/lamp-avatar-card.png");
  assert.equal(f.homeName, "the Waystation");
  assert.equal(f.homeFace, "/media/lamp-front-card.jpg", "the face is the first image HOME.md declares");
  assert.deepEqual(f.homeImages, ["/media/lamp-back-card.jpg"]);
  assert.equal(f.windowHung, true);
  assert.equal(f.monogram, "L", "the monogram skips a leading 'the'");
});

test("a resident who set nothing gets a quiet face: no colour, no bio, a monogram", () => {
  const f = residentFace({ handle: "registrar", address: { agent: "Registrar" }, profile: {}, homeImages: [] }, {});
  assert.equal(f.accent, null, "never an invented colour");
  assert.equal(f.colorName, null);
  assert.equal(f.bioLine, null);
  assert.equal(f.avatar, null);
  assert.equal(f.monogram, "R");
});

test("a colour is only a colour when it is a plain hex — it lands in a style attribute", () => {
  assert.equal(accentOf({ color: "#abc" }), "#abc");
  assert.equal(accentOf({ color: "red; background: url(x)" }), null);
  assert.equal(accentOf({ color: "#12345" }), null);
  assert.equal(accentOf({}), null);
});

test("the pane only ever loads from its own isolated origin", () => {
  const f = residentFace({ handle: "x", profile: {}, homeImages: [], window: { hung: true, pane_url: "https://evil.example/~x/" } }, {});
  assert.equal(f.paneUrl, "https://panes.postmark.town/~x/");
});

test("the bio's first line: first non-empty line, first sentence when it runs long", () => {
  assert.equal(bioLineOf("\n\nShort one."), "Short one.");
  const long = "Atlas-keeper at the Trueing-House. " + "I check the drawing against the ground ".repeat(6);
  assert.equal(bioLineOf(long), "Atlas-keeper at the Trueing-House.");
  assert.equal(bioLineOf(""), null);
  assert.equal(bioLineOf(undefined), null);
});

test("a sprite belongs to a meep; a lane building in SPRITES is nobody's face", () => {
  assert.ok(spriteOf("postmaster"), "the Postmaster has a drawing (POS-252)");
  assert.equal(spriteOf("quests"), null, "the quest board's building is not a resident");
  assert.equal(spriteOf("wright"), null);
});

// ── 2. the words ────────────────────────────────────────────────────────────

test("the page says residents, never agents (Keemin, 2026-09-27)", () => {
  const dir = new URL("../src/components/household-dashboard/", import.meta.url);
  const files = readdirSync(dir).map((f) => [f, readFileSync(new URL(f, dir), "utf8")]);
  files.push(["paint.mjs", read("../src/lib/household-dashboard/paint.mjs")]);
  for (const [name, text] of files) {
    // code and comments may quote the ruling; what a reader sees may not say it
    const shown = text
      .replace(/\/\/[^\n]*/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
    assert.doesNotMatch(shown, /\bagents?\b/i, `${name} shows the word "agent" to a reader`);
  }
});

// ── 3. one door for every read ──────────────────────────────────────────────

test("only reads.mjs fetches; the page and the painter never do", () => {
  assert.match(read("../src/lib/household-dashboard/reads.mjs"), /\bfetch\(/);
  for (const rel of ["../src/lib/household-dashboard/paint.mjs", "../src/lib/household-dashboard/fold.mjs",
    "../src/components/household-dashboard/HouseDashboard.astro", "../src/components/household-dashboard/ResidentCard.astro"]) {
    assert.doesNotMatch(read(rel), /\bfetch\(/, `${rel} fetches — every read goes through reads.mjs`);
  }
});

// ── the fold ────────────────────────────────────────────────────────────────

const T = Date.parse("2026-09-26T18:00:00Z");
const HOUSE = ["wright", "mari"];
const reads = {
  outboxes: {
    wright: [{ id: "w1", to: "little-bird", delivered_at: "2026-09-26T12:00:10Z", first_line: "Dom Pidgey is ashore." },
      { id: "w2", to: "mari", delivered_at: "2026-09-26T00:00:10Z", first_line: "Inside the house." }],
    mari: [],
  },
  doorsteps: {
    wright: {
      mail: { letters: [{ id: "l1", from: "lupi", to: "wright", delivered_at: "2026-09-26T12:00:10Z", first_line: "Your key holds." }] },
      rulings: { events: [
        { kind: "claim-pending", mark: "wright/a", at: "Sat Sep 26 2026 12:09:10 GMT+0000 (Coordinated Universal Time)", yours: true, window: 212 },
        { kind: "claim-refused", mark: "wright/a", at: "Sat Sep 26 2026 12:43:18 GMT+0000 (Coordinated Universal Time)", yours: true, window: 212, cause: "contested", cause_row: "superseded" },
        { kind: "claim-refused", mark: "wright/a", at: "Sat Sep 26 2026 12:43:18 GMT+0000 (Coordinated Universal Time)", yours: true, window: 212 },
        { kind: "claim-locked", mark: "other/b", at: "Sat Sep 26 2026 12:43:18 GMT+0000 (Coordinated Universal Time)", yours: false },
      ] },
      stamps: { assets: 592, stamps: 366, mint_count: 593 },
      stances: { stances_awaiting: 20 },
      stakes: { at_risk: 0, next_settlement: { at: "2026-09-27T06:00:00.000Z" } },
      next_crossing: { crossing: 215, at: "2026-09-27T12:00:00.000Z" },
      awaiting: { unplaced_bounces: [{ date: "2026-06-16", path: "WHITE_PAGES/wright/outbox/x.md", reason: "unknown recipient", age_days: 102 }] },
      window: { pane: { hung: true } },
    },
    mari: {
      mail: { letters: [{ id: "w2", from: "wright", to: "mari", delivered_at: "2026-09-26T00:00:10Z" }] },
      stamps: { assets: 64, mint_count: 64, holo: 0 },
      stances: { stances_awaiting: 0 },
      stakes: { at_risk: 1 },
      window: { pane: { hung: false } },
    },
  },
  quests: {
    wright: { today: { day: "2026-09-26" }, quests: [{ id: "correspond-send", title: "Reach out", cadence: "daily", target: 5, progress: 2, counted: ["a", "b"], household: { size: 7, total: 3 } }] },
    mari: { today: { day: "2026-09-26" }, quests: [{ id: "correspond-send", title: "Reach out", cadence: "daily", target: 5, progress: 1, counted: [], household: { size: 7, total: 3 } }] },
  },
  conversations: { live: [{ id: "t1", place: "the Taproom", voices: [
    { handle: "mari", said: "The garland is ours.", at_ms: Date.parse("2026-09-26T17:15:00Z") },
    { handle: "someone-else", said: "Not the house.", at_ms: Date.parse("2026-09-26T17:16:00Z") },
  ] }], closed: [] },
  walkers: { walkers: [{ handle: "wright", mark_id: "current-the-reader/the-snug-harbour", moving: false }] },
};

test("the feed: the house's letters both ways, once each; its says; its own rulings; the day's mint", () => {
  const items = feedOf(HOUSE, reads, T, { dayStart: Date.parse("2026-09-26T04:00:00Z") });
  const ids = items.map((i) => i.id);
  assert.equal(ids.filter((id) => id === "letter:w2").length, 1, "a letter between housemates is one line");
  assert.ok(ids.includes("letter:l1"), "inbound mail from outside the house is on the feed");
  assert.equal(items.filter((i) => i.kind === "mark").length, 1, "pending is left out; a duplicated ruling is one line; another's mark is not ours");
  const mark = items.find((i) => i.kind === "mark");
  assert.equal(mark.verdict, "refused");
  assert.equal(mark.words, "superseded");
  assert.ok(items.some((i) => i.kind === "said" && i.who === "mari"));
  assert.ok(!items.some((i) => i.who === "someone-else"), "a voice outside the house is not the house's");
  const st = items.find((i) => i.kind === "stamps");
  assert.deepEqual([st.who, st.n, st.at], ["wright", 2, null], "the mint names no time");
  assert.equal(items[0].kind, "said", "newest first");
});

test("the Date.toString() spelling of a ruling's time still parses (the cross-door defect)", () => {
  assert.equal(parseAt("Sat Sep 26 2026 12:43:18 GMT+0000 (Coordinated Universal Time)"), Date.parse("2026-09-26T12:43:18Z"));
  assert.equal(parseAt("not a time"), null);
});

test("the watermark splits the feed; with none, everything is fresh", () => {
  const items = feedOf(HOUSE, reads, T);
  const cut = Date.parse("2026-09-26T12:30:00Z");
  const { fresh, before } = splitAtLook(items, cut);
  assert.ok(fresh.every((i) => i.sort > cut) && before.every((i) => i.sort <= cut));
  assert.equal(splitAtLook(items, null).before.length, 0);
});

test("the watermark lives in this browser and survives a storage that throws", () => {
  const box = new Map();
  const storage = { getItem: (k) => box.get(k) ?? null, setItem: (k, v) => box.set(k, v) };
  assert.equal(readLook(storage, "starforge"), null);
  assert.equal(writeLook(storage, "starforge", 1234), true);
  assert.equal(readLook(storage, "starforge"), 1234);
  const broken = { getItem() { throw new Error("private mode"); }, setItem() { throw new Error("private mode"); } };
  assert.equal(readLook(broken, "starforge"), null);
  assert.equal(writeLook(broken, "starforge", 1), false);
});

test("a card's rows: the last act, where they stand, and the live pane answer", () => {
  const items = feedOf(HOUSE, reads, T);
  assert.equal(lastActOf("mari", items).kind, "said");
  assert.equal(lastActOf("wright", items).id, "letter:w1", "an inbound letter is not something they did");
  assert.deepEqual(standsAtOf("wright", reads.walkers), { place: "the snug harbour", moving: false });
  assert.equal(standsAtOf("mari", reads.walkers), null);
  assert.equal(hungOf(reads.doorsteps.mari, true), false, "the live doorstep outranks the build");
  assert.equal(hungOf(null, true), true);
});

test("the clocks, Needs you, and the numbers", () => {
  const c = clocksOf(HOUSE, reads.doorsteps);
  assert.equal(c.crossing.n, 215);
  assert.equal(c.settlement.atRisk, 1, "the risk is the house's sum");
  const n = needsOf(HOUSE, reads.doorsteps);
  assert.equal(n.stances.total, 20);
  assert.deepEqual(n.stances.by, [{ handle: "wright", n: 20 }]);
  assert.equal(n.bounces.length, 1);
  assert.equal(n.pending.length, 0, "unsailed letters are withheld without the house's sign-in");
  assert.deepEqual(numbersOf(HOUSE, reads.doorsteps), { held: 656, minted: 657, holo: 0 });
  assert.equal(numbersOf(HOUSE, { wright: reads.doorsteps.wright }), null, "a half-counted house has no total");
});

// ── posts · marks · mail (POS-293) ──────────────────────────────────────────
//
// Keemin, 2026-09-28: "Posts are what we want. Marks are what Postmark is.
// Mail is whom we trust." The calendar's "coming up" folded into Posts the
// same day: events are posts.

const POSTS = {
  put_up: { total: 4, shown: 2, rows: [
    { class: "event", id: "wright/office-hours", title: "Office Hours", author: "wright", household: "hh:starforge", state: "announced", latest: { act: "rsvp", at: "2026-09-27T18:00:00.000Z" }, responses: 1, role: "author", stake: 0, ours: 0 },
    { class: "idea", id: "rei/events", title: "Events should be town objects.", author: "rei", household: "hh:starforge", state: "posted", latest: { act: "stake", at: "2026-09-27" }, responses: 5, role: "author", stake: 11, ours: 2 },
  ] },
  taking_part: { total: 1, shown: 1, rows: [
    { class: "idea", id: "kai/observation", title: "Make observation state first-class.", author: "kai", household: "hh:window", state: "posted", latest: { act: "stake", at: "2026-09-24" }, responses: 10, role: "participant", stake: 30, ours: 1 },
  ] },
};

test("posts: the house's, from the first doorstep that carries the segment; absent everywhere, the section is null", () => {
  assert.equal(postsOf(HOUSE, reads.doorsteps), null, "no doorstep carries posts (prod before the w41 ship): the section says so, never guesses");
  const p = postsOf(HOUSE, { wright: { ...reads.doorsteps.wright }, mari: { ...reads.doorsteps.mari, posts: POSTS } });
  assert.deepEqual(p.putUp.rows.map((r) => r.id), ["wright/office-hours", "rei/events"]);
  assert.equal(p.putUp.total, 4, "the office's true total rides beside its cut");
  assert.deepEqual(p.takingPart.rows.map((r) => r.id), ["kai/observation"]);
  assert.equal(p.behind, 11 + 1, "what stands behind the house's posts: the stake on its own, its share on others'");
  assert.deepEqual(p.unavailable, []);
  const partly = postsOf(HOUSE, { wright: { posts: { ...POSTS, unavailable: ["the events could not be read from the office's record"] } } });
  assert.deepEqual(partly.unavailable, ["the events could not be read from the office's record"], "a class the office could not read is said on the page");
});

test("a post row is drawn from the general fields, and never asks its class anything but the chip's colour", () => {
  const paint = read("../src/lib/household-dashboard/paint.mjs");
  const row = paint.slice(paint.indexOf("function postRow("), paint.indexOf("function paintPostList("));
  assert.ok(row.length > 100, "postRow is not where this test looks");
  assert.equal((row.match(/\.class\b/g) ?? []).length, 2, "r.class is read for the chip's word and its data-cls, and nowhere else");
  assert.doesNotMatch(row, /\.class\s*===|===\s*"(event|idea|quest|bug)"|switch\s*\(\s*r\.class/, "a row branches on its class");
  assert.doesNotMatch(row, /\.fields\b/, "a row reads a class's own fields");
});

test("marks: per resident, with stamps, and the most-backed few across the house", () => {
  const ds = {
    wright: { stakes: { count: 3, rows: [{ mark: "wright/a", escrow: 3 }, { mark: "wright/b", escrow: 0 }, { mark: "wright/c", escrow: 9 }] } },
    mari: { stakes: { count: 1, rows: [{ mark: "mari/garland", escrow: 5 }] } },
  };
  const m = marksOf(HOUSE, ds);
  assert.deepEqual(m.by, [{ handle: "wright", marks: 3, backed: 2 }, { handle: "mari", marks: 1, backed: 1 }]);
  assert.deepEqual([m.marks, m.backed, m.complete], [4, 3, true]);
  assert.deepEqual(m.top.map((t) => [t.mark, t.escrow]), [["wright/c", 9], ["mari/garland", 5], ["wright/a", 3]]);
  assert.equal(marksOf(HOUSE, { wright: ds.wright }).complete, false, "a resident whose segment did not answer makes the counts short, and the page says so");
  assert.equal(marksOf(HOUSE, {}), null);
});

test("mail: in and out per resident, the newest letters from outside the house, and NEW IS UNREAD, never new_inbound", () => {
  const ds = {
    wright: { counts: { received: 408, sent: 419 }, awaiting: { summary: { new_inbound: 135 } },
      mail: { letters: [
        { id: "l1", from: "lupi", delivered_at: "2026-09-26T12:00:10Z", first_line: "Your key holds." },
        { id: "w2", from: "mari", delivered_at: "2026-09-26T13:00:10Z", first_line: "Inside the house." },
      ] } },
    mari: { counts: { received: 20, sent: 18 }, awaiting: { summary: { new_inbound: 4 } }, mail: { letters: [] } },
  };
  const m = mailOf(HOUSE, ds);
  assert.deepEqual([m.received, m.sent], [428, 437]);
  assert.equal(m.unread, null, "no doorstep carries unread (a signed-out reader, or prod before the ship): there is NO new count, and 135 + 4 never stands in for one");
  assert.ok(m.by.every((x) => x.unread === null), "nor per resident");
  assert.deepEqual(m.latest.map((l) => l.id), ["l1"], "a letter between housemates is not mail from outside");
  const signedIn = mailOf(HOUSE, { wright: { ...ds.wright, unread: { count: 2 } }, mari: { ...ds.mari, unread: { count: 0 } } });
  assert.equal(signedIn.unread, 2, "with the house's own sign-in, new is the unread letters");
  assert.equal(mailOf(HOUSE, { wright: { ...ds.wright, unread: { count: 2 } }, mari: ds.mari }).unread, null, "a house total only when every resident's unread answered");
  assert.equal(mailOf(HOUSE, { wright: { ...ds.wright, unread: { count: null, unavailable: "the record could not be read" } }, mari: ds.mari }).by[0].unread, null, "an unread the office could not read is not a zero");
  // and the source of the section never reaches for the old count
  const fold = read("../src/lib/household-dashboard/fold.mjs");
  const mail = fold.slice(fold.indexOf("export function mailOf("), fold.indexOf("// ── quests and numbers"));
  assert.ok(mail.length > 100, "mailOf is not where this test looks");
  assert.doesNotMatch(mail.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, ""), /new_inbound/, "mailOf reads new_inbound");
});

test("the page's order: the house, then Posts, Marks, Mail, then since you last looked; coming up is gone and the calendar is not read", () => {
  const dash = read("../src/components/household-dashboard/HouseDashboard.astro");
  const at = (needle) => { const i = dash.indexOf(needle); assert.ok(i >= 0, `the dashboard carries ${needle}`); return i; };
  const order = ['class="hd-house"', 'id="hd-posts-h"', 'id="hd-marks-h"', 'id="hd-mail-h"', 'id="hd-feed-h"', 'id="hd-res-h"'].map(at);
  assert.deepEqual([...order].sort((a, b) => a - b), order, "the sections are not in Keemin's order");
  const posts = dash.slice(at("data-hd-posts-box"), at("data-hd-marks-box"));
  const town = posts.indexOf("From the town");
  assert.ok(town >= 0 && town < posts.indexOf('<slot name="quests" />'), "the quest board is Posts' last group, under From the town");
  assert.equal(dash.split('<slot name="quests" />').length, 2, "the board has one place");
  assert.equal(dash.includes("data-hd-coming"), false, "Coming up is still on the page");
  assert.equal(/\/calendar`/.test(read("../src/lib/household-dashboard/reads.mjs")), false, "the calendar is still read");
});

test("an idea is a post, never a mark: the Think Tank's ideas and the house's idea posts are out of Marks' lists and counts", () => {
  const ds = {
    wright: { stakes: { count: 3, rows: [{ mark: "wright/a-newcomers-first-hour", escrow: 1 }, { mark: "wright/the-trueing-terrace", escrow: 77 }, { mark: "wright/comparison-desk", escrow: 0 }] } },
    mari: { stakes: { count: 2, rows: [{ mark: "rei/events", escrow: 11 }, { mark: "mari/garland", escrow: 5 }] } },
  };
  const tank = { ideas: [{ id: "wright/a-newcomers-first-hour" }, { id: "kai/elsewhere" }] };
  const posts = postsOf(HOUSE, { wright: { posts: POSTS } }); // carries idea rei/events
  const m = marksOf(HOUSE, ds, { ideas: ideaIdsOf(tank, posts) });
  const listed = [...m.top.map((t) => t.mark)];
  for (const idea of ["wright/a-newcomers-first-hour", "rei/events"]) assert.equal(listed.includes(idea), false, `the idea ${idea} is listed in Marks`);
  assert.deepEqual(m.top.map((t) => t.mark), ["wright/the-trueing-terrace", "mari/garland"]);
  assert.deepEqual(m.by, [{ handle: "wright", marks: 2, backed: 1 }, { handle: "mari", marks: 1, backed: 1 }], "the counts leave the ideas out too");
  assert.equal(m.ideasKnown, true);
  // the Think Tank not answering: the house's own idea posts still come out, and the page is told
  const blind = marksOf(HOUSE, ds, { ideas: ideaIdsOf(null, posts) });
  assert.equal(blind.ideasKnown, false);
  assert.equal(blind.top.some((t) => t.mark === "rei/events"), false);
  // and the page feeds Marks the ideas it read
  const paint = read("../src/lib/household-dashboard/paint.mjs");
  assert.match(paint, /marksOf\(handles, reads\.doorsteps, \{ ideas: ideaIdsOf\(reads\.ideas, posts\) \}\)/, "Marks is painted without the ideas");
  assert.match(read("../src/lib/household-dashboard/reads.mjs"), /\/town\/apex\?read=ideas`/, "the Think Tank is not read");
});

// ── the tour (POS-293) ──────────────────────────────────────────────────────

test("the tour opens by itself once, on the house's own page only, and every way out sets the flag", () => {
  const box = new Map();
  const storage = { getItem: (k) => box.get(k) ?? null, setItem: (k, v) => box.set(k, v) };
  assert.equal(tourOpensItself({ owner: false, storage }), false, "a signed-out reader, or another house's page, never gets it by itself");
  assert.equal(tourOpensItself({ owner: true, storage }), true);
  assert.equal(tourOpensItself({ owner: true, storage, openedThisPage: true }), false, "once a page, even before the flag lands");
  assert.equal(markTourSeen(storage), true);
  assert.equal(box.get(TOUR_KEY), "1");
  assert.equal(tourOpensItself({ owner: true, storage }), false, "seen is seen");
  const broken = { getItem() { throw new Error("private mode"); }, setItem() { throw new Error("private mode"); } };
  assert.equal(tourSeen(broken), false);
  assert.equal(markTourSeen(broken), false, "a storage that throws is survived, not thrown through");
  assert.deepEqual([stepAfterKey("ArrowRight", 0, 5), stepAfterKey("ArrowRight", 4, 5), stepAfterKey("ArrowLeft", 0, 5), stepAfterKey("a", 2, 5)], [1, 4, 0, null]);
  const tour = read("../src/components/household-dashboard/Tour.astro");
  for (const way of ['[data-tour-skip]")?.addEventListener("click", close)', 'if (e.key === "Escape") { e.preventDefault(); close();', "if (i === steps.length - 1) close();"])
    assert.ok(tour.includes(way), `a way out of the tour does not go through close: ${way}`);
  assert.match(tour, /const close = \(\) => \{[^}]*markTourSeen\(storage\)/, "closing sets the flag");
  assert.match(tour, /role="dialog" aria-modal="true" aria-labelledby=/);
});

test("the tour's words are the ruled words, and it promises nothing that is not live", () => {
  const tour = read("../src/components/household-dashboard/Tour.astro");
  for (const line of [
    "A town that people and their AI build together",
    "Your household is you and the AI residents you keep. Everything they do here is public, and a real person answers for it.",
    "A <b>post</b> is something someone hopes the town will have or do: an <b>event</b> to gather for, or an <b>idea</b> for the town.",
    "RSVP to an event, or back an idea with stamps",
    "A <b>mark</b> is anything that's really part of Postmark right now: a home, a garden, a bench, a gift left at a neighbour's door.",
    "not everything needs a post first, some things are just made for joy",
    "<b>Letters</b> are how residents get to know each other. Mail is slow on purpose: the ferry sails twice a day.",
    "the ferry sails at 8 AM and 8 PM Eastern",
    "You can open this again any time from <b>How Postmark works</b> on your household page.",
  ]) assert.ok(tour.includes(line), `the tour lost a ruled line: ${line}`);
  const shown = tour.replace(/<script>[\s\S]*?<\/script>|<style>[\s\S]*?<\/style>/g, "").replace(/^\/\/[^\n]*$/gm, "");
  assert.doesNotMatch(shown, /whoever builds it/i, "the tour promises stakes go to builders, which is not live");
  for (const word of ["prior", "posterior", "ensemble", "latent", "initiative", "case"])
    assert.doesNotMatch(shown, new RegExp(`\\b${word}\\b`, "i"), `the tour says "${word}" to a resident`);
});

test("the day's quests at the house's grain", () => {
  const q = questsOf(HOUSE, reads.quests);
  assert.deepEqual(q.rows.map((r) => [r.id, r.done, r.target]), [["correspond-send", 3, 5]]);
  assert.equal(q.shareSize, 7);
});

test("the tour's scenes: every one paints from known inks on its 32×20 grid, and the guide is one constant the scenes never name", async () => {
  const icons = await import("../src/lib/pixel-icons.mjs");
  const { SCENES, SCENE_W, SCENE_H, GUIDE, TOUR_GUIDE, ART, ART_INK, sceneRects, sceneSvg } = icons;
  assert.deepEqual(Object.keys(SCENES), ["welcome", "posts", "marks", "mail", "dash"]);
  for (const n of Object.keys(SCENES)) {
    const rects = sceneRects(n);
    assert.ok(rects.length > 0, n);
    assert.ok(rects.every((r) => r.x >= 0 && r.x + r.w <= SCENE_W && r.y >= 0 && r.y < SCENE_H), `${n} paints off its grid`);
    assert.equal(SCENES[n].filter((l) => l === GUIDE).length, 1, `${n} places the guide once, by the sentinel`);
    assert.ok(!SCENES[n].some((l) => Array.isArray(l) && l[0] === ART.julian), `${n} names the figure instead of the guide`);
    assert.match(sceneSvg(n), /viewBox="0 0 32 20"[^>]*shape-rendering="crispEdges" aria-hidden="true"/);
  }
  assert.equal(TOUR_GUIDE, ART.julian, "the guide is Julian until Keemin says otherwise");
  assert.ok(ART_INK.a, "the water ink the mail scene's waves use");
  assert.ok(Tour().includes('import { sceneSvg } from "@/lib/pixel-icons.mjs"'), "the tour draws its scenes from pixel-icons");
  function Tour() { return read("../src/components/household-dashboard/Tour.astro"); }
});
