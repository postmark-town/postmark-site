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
  feedOf, splitAtLook, lastActOf, standsAtOf, hungOf, clocksOf, needsOf, comingUpOf,
  questsOf, numbersOf, readLook, writeLook, parseAt,
} from "../src/lib/household-dashboard/fold.mjs";

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
    home: { body: "# the Waystation\n\nA hut.", assets: ["front.jpg", "back.jpg"] },
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

test("the card's extra pictures are the ones HOME.md chose; no list, the rest of HOME/ (POS-321)", () => {
  const key = (f) => `WHITE_PAGES/wayward-archivist/HOME/${f}`;
  const files = ["House of Many Doors_ Parcel Plans.png", "Wayward-archivist.png", "lyra-desk-marge.jpg", "shared-parcel.png"];
  const media = Object.fromEntries(files.map((f) => [key(f), { card: `/media/${f}-card` }]));
  const lyra = (home) => residentFace({ handle: "wayward-archivist", profile: {}, home, homeImages: files.map(key) }, media);

  const chose = lyra({ body: "**The Starling House**", assets: ["shared-parcel.png"] });
  assert.equal(chose.homeFace, "/media/shared-parcel.png-card");
  assert.deepEqual(chose.homeImages, [], "one picture chosen: the face, and no extras");

  const two = lyra({ assets: ["shared-parcel.png", "lyra-desk-marge.jpg"] });
  assert.deepEqual(two.homeImages, ["/media/lyra-desk-marge.jpg-card"]);

  const none = lyra({ body: "x" });
  assert.equal(none.homeFace, "/media/House of Many Doors_ Parcel Plans.png-card", "no list: the first by filename, as before");
  assert.deepEqual(none.homeImages, files.slice(1, 4).map((f) => `/media/${f}-card`), "no list: up to three of the rest, as before");

  assert.deepEqual(lyra({ assets: ["missing.png"] }).homeImages, files.slice(1, 4).map((f) => `/media/${f}-card`), "a typo keeps every picture");
});

test("the house's picture from the household's record wears before the HOME/ face (POS-219)", () => {
  const kept = "https://media.postmark.town/media/lamp/0f3c.jpg";
  const media = { "WHITE_PAGES/lamp/HOME/front.jpg": { card: "/media/lamp-front-card.jpg" } };
  const r = { handle: "lamp", profile: {}, home: { assets: ["front.jpg"] }, homeImages: ["WHITE_PAGES/lamp/HOME/front.jpg"] };
  assert.equal(residentFace(r, media, kept).homeFace, kept);
  assert.equal(residentFace(r, media).homeFace, "/media/lamp-front-card.jpg", "none on the record: the HOME/ face, as before");
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
  assert.ok(spriteOf("bugcatcher"), "the Bug Catcher has a drawing (the video's frog, 2026-09-29)");
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

test("coming up is absent when the calendar does not answer, and the house's own events otherwise", () => {
  assert.equal(comingUpOf(null, HOUSE), null);
  const cal = { now: [], coming: [
    { id: "x/opening", title: "Opening", host: "x", phase: "announced", starts: "2026-09-27T21:30:00Z", rsvps: { residents: ["mari", "zed"] } },
    { id: "y/other", title: "Other", host: "y", phase: "announced", starts: "2026-09-27T21:30:00Z", rsvps: { residents: ["zed"] } },
    { id: "wright/gone", title: "Gone", host: "wright", phase: "announced", cancelled: true, starts: "2026-09-27T21:30:00Z" },
  ] };
  const ev = comingUpOf(cal, HOUSE);
  assert.deepEqual(ev.map((e) => e.id), ["x/opening"]);
  assert.deepEqual(ev[0].going, ["mari"]);
  assert.deepEqual(comingUpOf({ now: [], coming: [] }, HOUSE), [], "an answering calendar with nothing for the house is empty, not absent");
});

test("the day's quests at the house's grain", () => {
  const q = questsOf(HOUSE, reads.quests);
  assert.deepEqual(q.rows.map((r) => [r.id, r.done, r.target]), [["correspond-send", 3, 5]]);
  assert.equal(q.shareSize, 7);
});
