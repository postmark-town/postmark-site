// bulletin-board.test.mjs — the Bulletin is a board (the Site Lift, POS-251).
//
//   node --test test/bulletin-board.test.mjs
//
// The board holds five pieces (POS-273, 2026-09-27): the calendar, Ferry's
// Daily, a cluster of post-its, the meeps and the civic quarter's postcard.
// On the Town page (POS-278, the same day) a click slides the board left and
// the piece fills the page, at its own hash; the notices are a sub-board of
// sticky notes, and /bulletin/#<slug> pops that one notice up over it. No
// element carries an address as its id, so nothing on the page auto-scrolls.
// The rules live in src/lib/bulletin-board.mjs; the built-page tests below are
// skipped until the page is built, as POS-177 rules.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  BOARD_PIECES, BOARD_PINS, FRAMED, NOSCRIPT_NOTICES, POSTIT_PAPERS, TILTS, boardIds, dailyFront, pinLink, pinnedMonth, postitLook, tendedText, viewOf,
} from "../src/lib/bulletin-board.mjs";
import { bulletinCards, bulletinPostings } from "../src/lib/bulletin-cards.mjs";
import { LANES } from "../src/lib/civic.mjs";
import { MEEPS } from "../src/lib/meeps-quarter.mjs";
import { SOCIALS } from "../src/lib/door-line.mjs";
import { ACCENTS, BOARD_ART, BOARD_INK, INK, SPRITES, checkSprite, paintArt } from "../src/lib/civic-art.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BULLETIN = JSON.parse(readFileSync(join(ROOT, "src", "data", "postmark", "bulletin.json"), "utf8"));
const DIST = join(ROOT, "dist-town");
const builtPage = (...segs) => join(DIST, ...segs, "index.html");

// ── the post-its ────────────────────────────────────────────────────────────

test("no two neighbouring notes share a paper or a lean, and none hangs square", () => {
  for (let i = 0; i < 60; i++) {
    const a = postitLook(i);
    const b = postitLook(i + 1);
    assert.notEqual(a.bg, b.bg, `notes ${i} and ${i + 1} share a paper`);
    assert.notEqual(a.tilt, b.tilt, `notes ${i} and ${i + 1} lean the same way`);
    assert.notEqual(a.tilt, 0, `note ${i} hangs square`);
  }
});

test("a note's paper is one the site already wears, and never the stamps' violet", () => {
  const violets = ["#aa8fd8", "#d8c7ef", "#65517f"];
  for (const p of POSTIT_PAPERS) {
    assert.match(p.bg, /^#[0-9a-f]{6}$/);
    assert.equal(violets.includes(p.bg), false, `${p.name} is a stamp violet`);
  }
  assert.ok(TILTS.every((t) => Math.abs(t) > 0 && Math.abs(t) <= 3), "a tilt is slight: askew, not fallen");
});

// ── the newspaper ───────────────────────────────────────────────────────────

const DAILY = [
  "# The office — Ferry's Daily",
  "",
  "*A curated look, kept by Ferry. Tended each round; last on **2026-09-25** (Friday night).*",
  "",
  "### ⛴ **Crossing 210 · 88 letters over · the roll is 140 · no bounces**",
  "",
  "## The Snug opens its doors",
  "",
  "**The pub on the Doubled Coast opened tonight.** Two sets, and every room was full.",
  "",
  "## A second story",
  "",
  "Not the lead.",
].join("\n");

test("the newspaper reads Ferry's crossing line, his date and his lead story", () => {
  const front = dailyFront([{ slug: "settling-in", body: "# x" }, { slug: "ferrys-daily", body: DAILY }]);
  assert.deepEqual(front, {
    tended: "2026-09-25",
    crossing: 210,
    figures: "88 letters over · the roll is 140 · no bounces",
    lead: "The Snug opens its doors",
    standfirst: "The pub on the Doubled Coast opened tonight. Two sets, and every room was full.",
  });
});

// THE SEPTEMBER SHAPE, as the office served it on 2026-09-26 (crossing 213):
// "Tended on" where the date used to be "last on", and "--" where the
// figures used to be middots. The committed snapshot still carries the August
// shape, so only a fixture can hold this one.
test("the Daily's September shape: \"Tended on\" and \"--\" separators read the same", () => {
  const body = [
    "# The office -- Ferry's Daily",
    "",
    "*A curated look over the town's letters, kept by Ferry -- the mailman. Tended on **2026-09-26** (Saturday morning).*",
    "",
    "## Crossing 213 -- 50 letters over -- 10,128 delivered all told -- 191 resident doors -- no bounces",
    "",
    "## Four doors ashore",
    "",
    "Four harbor declarations became settled addresses on this crossing.",
  ].join("\n");
  assert.deepEqual(dailyFront([{ slug: "ferrys-daily", body }]), {
    tended: "2026-09-26",
    crossing: 213,
    figures: "50 letters over · 10,128 delivered all told · 191 resident doors · no bounces",
    lead: "Four doors ashore",
    standfirst: "Four harbor declarations became settled addresses on this crossing.",
  });
});

test("a Daily that changes its shape still pins a newspaper, with nothing made up", () => {
  const empty = { tended: null, crossing: null, figures: null, lead: null, standfirst: null };
  assert.deepEqual(dailyFront([]), empty);
  assert.deepEqual(dailyFront(undefined), empty);
  assert.deepEqual(dailyFront([{ slug: "ferrys-daily", body: "Just prose, no headings." }]), empty);
});

test("on the town's own bulletin the newspaper has a lead story and a crossing", () => {
  const front = dailyFront(BULLETIN);
  assert.ok(front.lead, "the town's Daily reads with no lead story");
  assert.equal(Number.isInteger(front.crossing), true);
});

test("the dateline's date is written out, and anything that is not a date is dropped", () => {
  assert.equal(tendedText("2026-08-26"), "26 August 2026");
  assert.equal(tendedText("yesterday"), null);
  assert.equal(tendedText(null), null);
});

// ── the calendar ────────────────────────────────────────────────────────────

const ev = (id, starts, extra = {}) => ({ id, title: id, starts, ends: starts, place: { x: 1, y: 1 }, ...extra });

test("the pinned month is the office's month, with its day marked as today", () => {
  const m = pinnedMonth({ as_of: "2026-10-03T12:00:00Z", now: [], coming: [ev("a/b", "2026-10-09T19:00:00Z")], ended: [] });
  assert.equal(m.key, "2026-10");
  const today = m.weeks.flat().filter((d) => d.today).map((d) => d.date);
  assert.deepEqual(today, ["2026-10-03"]);
  assert.equal(m.weeks.flat().find((d) => d.date === "2026-10-09").events.length, 1, "the event is on its day");
});

test("the note names what is on now before what is coming, and never a cancelled event", () => {
  const now = ev("h/now", "2026-10-03T11:00:00Z");
  const soon = ev("h/soon", "2026-10-05T11:00:00Z");
  const off = ev("h/off", "2026-10-04T11:00:00Z", { cancelled: true });
  const as_of = "2026-10-03T12:00:00Z";
  assert.deepEqual(pinnedMonth({ as_of, now: [now], coming: [soon], ended: [] }).next, { event: now, now: true });
  assert.deepEqual(pinnedMonth({ as_of, now: [], coming: [off, soon], ended: [] }).next, { event: soon, now: false });
  assert.equal(pinnedMonth({ as_of, now: [], coming: [off], ended: [] }).next, null);
});

test("with no as_of the month is the build's own", () => {
  const m = pinnedMonth({}, new Date("2026-09-26T15:00:00Z"));
  assert.equal(m.key, "2026-09");
  assert.equal(m.next, null);
});

// ── the pieces and their panels ────────────────────────────────────────────

test("the board holds Keemin's five, in his order: calendar, Daily, post-its, meeps, quarter", () => {
  assert.deepEqual(BOARD_PIECES.map((p) => p.key), ["calendar", "daily", "notices", "meeps", "quarter"]);
  // with JavaScript off a piece is a link to its page, and every page still stands
  assert.deepEqual(BOARD_PIECES.filter((p) => p.page).map((p) => p.page), ["/calendar/", "/daily/", "/meeps/", "/town/"]);
  // the framed panels load only on open, and reach inside by a prefix
  assert.deepEqual(Object.keys(FRAMED).sort(), ["daily", "meeps", "quarter"]);
  assert.equal(FRAMED.quarter.deep, "quarter-");
  assert.equal(FRAMED.meeps.deep, "meeps-");
});

test("NO NOTICE SLUG IS ONE OF THE BOARD'S OWN IDS — /bulletin/#quests stays the notice", () => {
  const own = new Set(boardIds({ quarter: LANES.map((l) => l.id), meeps: MEEPS.map((m) => m.key) }));
  const clash = bulletinPostings(BULLETIN).map((p) => p.slug).filter((s) => own.has(s));
  assert.deepEqual(clash, [], `these notices would open a piece instead: ${clash.join(", ")}`);
  // two of the quarter's lane anchors are notice slugs and one is the board
  // itself; the prefix is what keeps them apart
  const lanes = LANES.map((l) => l.id);
  assert.ok(lanes.includes("quests") && lanes.includes("board"));
  assert.equal(own.has("quests"), false);
  assert.equal(own.has("quarter-quests"), true);
});

// ── WHAT AN ADDRESS OPENS (viewOf: the page's script reads this same function) ──

test("every address opens what it names; an unknown one opens the board, never a blank page", () => {
  const slugs = bulletinPostings(BULLETIN).map((p) => p.slug);
  const board = { view: null, inner: null, note: null };
  for (const h of ["", "#", "#board", "#no-such-thing", "#%E0%A4%A"]) assert.deepEqual(viewOf(h, slugs), board, h);
  for (const p of BOARD_PIECES) assert.deepEqual(viewOf(`#${p.hash}`, slugs), { ...board, view: p.key });
  assert.deepEqual(viewOf("#quarter-quests", slugs), { ...board, view: "quarter", inner: "quests" });
  assert.deepEqual(viewOf("#meeps-postmaster", slugs), { ...board, view: "meeps", inner: "postmaster" });
  assert.deepEqual(viewOf(`#${NOSCRIPT_NOTICES}`, slugs), { ...board, view: "notices" });
  for (const s of slugs) assert.deepEqual(viewOf(`#${s}`, slugs), { ...board, view: "notices", note: s }, s);
  // the bare prefix is no room of its own
  assert.deepEqual(viewOf("#quarter-", slugs), board);
});

// ── THE BUILT PAGES ─────────────────────────────────────────────────────────

const bulletinHtml = builtPage("bulletin");

test("the built board pins every piece as a link to its page, each opening its view on this page",
  { skip: !existsSync(bulletinHtml) }, () => {
  const page = readFileSync(bulletinHtml, "utf8");
  for (const p of BOARD_PIECES) {
    const href = p.page ?? `#${NOSCRIPT_NOTICES}`;
    assert.match(page, new RegExp(`<a[^>]*class="piece[^"]*"[^>]*href="${href}"[^>]*data-pinned="${p.key}"[^>]*data-open="${p.hash}"`),
      `${p.key} is not pinned as a link to ${href}`);
    assert.match(page, new RegExp(`class="view-body[^"]*"[^>]*data-view="${p.key}"`), `${p.key} has no view`);
  }
  assert.match(page, /<a class="back"[^>]*href="\/bulletin\/"[^>]*data-back[^>]*>← back to the board<\/a>/, "the view has no clear way back");
  assert.match(page, /<h1[^>]*>The Town<\/h1>/);
  assert.match(page, /data-board-month="\d{4}-\d{2}"/);
  assert.match(page, /<td[^>]*class="[^"]*\btoday\b[^"]*"/, "the pinned month marks no today");
  // the calendar's view is /calendar/'s own body (CalendarPanel), not a copy
  const at = page.indexOf('data-view="calendar"');
  const cal = page.slice(at, page.indexOf('data-view="notices"', at));
  assert.match(cal, /data-cal-month=/, "the calendar view has no month");
  for (const g of ["now", "coming", "ended"]) assert.match(cal, new RegExp(`data-group="${g}"`), `the calendar view has no ${g} group`);
});

// Keemin: "remove #board auto-scroll". A fragment that names an element's id
// is one the browser scrolls to, so no element may carry an address the page
// answers. Read with the <template>s and the <noscript> set aside: neither is
// in a scripted page's document.
test("NOTHING AUTO-SCROLLS: no element on the built page carries an address the page answers as its id",
  { skip: !existsSync(bulletinHtml) }, () => {
  const page = readFileSync(bulletinHtml, "utf8")
    .replace(/<template\b[\s\S]*?<\/template>/g, "")
    .replace(/<noscript>[\s\S]*?<\/noscript>/g, "");
  const ids = new Set([...page.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  const addresses = [
    ...boardIds({ quarter: LANES.map((l) => l.id), meeps: MEEPS.map((m) => m.key) }),
    ...bulletinPostings(BULLETIN).map((p) => p.slug),
  ];
  const clash = addresses.filter((a) => ids.has(a));
  assert.deepEqual(clash, [], `these addresses would scroll the page: ${clash.join(", ")}`);
  // and the board's script never scrolls it or sets a fragment the browser jumps to
  const src = readFileSync(join(ROOT, "town", "pages", "bulletin", "index.astro"), "utf8").split("<script>")[1] ?? "";
  assert.ok(src.includes("pushState"), "the board's script is not the one this reads");
  assert.equal(/scrollIntoView|location\.hash\s*=/.test(src), false, "the board's script moves the page");
});

test("every notice pops up from its own template, and the sticky notes are links to their addresses",
  { skip: !existsSync(bulletinHtml) }, () => {
  const page = readFileSync(bulletinHtml, "utf8");
  for (const p of bulletinCards(BULLETIN)) {
    assert.match(page, new RegExp(`<a[^>]*href="#${p.slug}"[^>]*data-note-open="${p.slug}"`), `${p.slug} is not a sticky note linking #${p.slug}`);
  }
  for (const p of bulletinPostings(BULLETIN)) {
    assert.match(page, new RegExp(`<template[^>]*data-note="${p.slug}"`), `/bulletin/#${p.slug} pops up nothing`);
  }
  assert.match(page, /<dialog class="note-pop[^"]*"[^>]*data-note-pop/, "there is no small window for one notice");
  // without a script the notices are a list, each a link to its file in the town repo
  const nojs = [...page.matchAll(/<noscript>([\s\S]*?)<\/noscript>/g)].map((m) => m[1]).find((x) => x.includes(`id="${NOSCRIPT_NOTICES}"`)) ?? "";
  for (const p of bulletinCards(BULLETIN)) {
    assert.ok(nojs.includes(`TOWN_BULLETIN/${p.slug}.md`), `${p.slug} is not listed for a reader without a script`);
  }
});

test("Ferry's Daily wears Ferry's own pixel sprite as a sticker, and the postcard's buildings stand in a cluster",
  { skip: !existsSync(bulletinHtml) }, () => {
  const page = readFileSync(bulletinHtml, "utf8");
  const news = page.slice(page.indexOf('data-pinned="daily"'), page.indexOf('data-pinned="notices"'));
  assert.match(news, /data-ferry-sticker[\s\S]*?<svg class="px"[^>]*viewBox="0 0 24 24"[\s\S]*?<rect/, "the Daily has no Ferry sticker");
  const card = page.slice(page.indexOf('data-pinned="quarter"'));
  const rows = [...card.matchAll(/<svg class="px b-(back|front)"[^>]*data-lane="([a-z]+)"/g)].map((m) => `${m[1]}:${m[2]}`);
  assert.deepEqual(rows, ["back:bounties", "back:listings", "back:votes", "front:quests", "front:ideas"]);
});

test("THE PAGE WEIGHT: the framed panels carry no src until they open, and the quarter's and the meeps' markup is not on the board",
  { skip: !existsSync(bulletinHtml) }, () => {
  const page = readFileSync(bulletinHtml, "utf8").replace(/<noscript>[\s\S]*?<\/noscript>/g, "");
  const frames = [...page.matchAll(/<iframe\b[^>]*>/g)].map((m) => m[0]);
  assert.equal(frames.length, 3, `${frames.length} frames`);
  for (const f of frames) assert.equal(/\ssrc=/.test(f), false, `a frame loads with the board: ${f}`);
  assert.equal(page.includes('class="c-lane"'), false, "the quarter's lanes are inlined on the board");
  assert.equal(page.includes('class="meep-card"'), false, "the meeps' cards are inlined on the board");
});

// ── ?embed (Wright's ruling on POS-273) ─────────────────────────────────────
// /town/?embed and /meeps/?embed are the same static files as /town/ and
// /meeps/. The embed state is one class, put on the framed page by the board,
// and CSS that only that class wears; so the bare page cannot change with it.

test("?EMBED IS ONE CLASS AND ITS CSS — the bare /town/ and /meeps/ carry no embed hook, and point canonical at themselves",
  { skip: !existsSync(builtPage("town")) || !existsSync(builtPage("meeps")) || !existsSync(bulletinHtml) }, () => {
  for (const [key, bare] of [["quarter", "/town/"], ["meeps", "/meeps/"]]) {
    assert.equal(FRAMED[key].src, `${bare}?embed`);
    const html = readFileSync(builtPage(bare.replaceAll("/", "")), "utf8");
    assert.equal(html.includes("pm-embed"), false, `${bare} carries an embed hook of its own`);
    assert.match(html, new RegExp(`<link rel="canonical" href="https://postmark\\.town${bare}">`), `${bare} has no canonical to its bare URL`);
  }
  // the board's dress: every rule it adds is scoped under the one class. Read
  // from the page's source: its script is bundled into a file of its own.
  const page = readFileSync(join(ROOT, "town", "pages", "bulletin", "index.astro"), "utf8");
  const dress = /data-board-dress[\s\S]*?\.textContent\s*=\s*"([^"]*)"/.exec(page)?.[1] ?? "";
  assert.ok(dress.length > 0, "the board no longer dresses its frames");
  for (const rule of dress.split("}").filter(Boolean)) {
    for (const sel of rule.split("{")[0].split(",")) {
      assert.match(sel.trim(), /^\.pm-embed\b/, `the dress styles "${sel}" outside the embed class`);
    }
  }
  assert.match(page, /classList\.add\("pm-embed"\)/);
});

// ── the stickers (Keemin: "the social media links on the corkboard as little stickers") ──

test("THE STICKERS: every social from the door line's list, a plain external link with a name; one not open yet is no link",
  { skip: !existsSync(bulletinHtml) }, () => {
  const page = readFileSync(bulletinHtml, "utf8");
  const board = page.slice(page.indexOf('aria-label="The board"'), page.indexOf('class="sill"'));
  for (const s of SOCIALS) {
    if (s.href) {
      const a = new RegExp(`<a class="sticker[^"]*" href="${s.href.replace(/[.?/]/g, "\\$&")}" target="_blank" rel="noopener" data-social="${s.key}" aria-label="Postmark on ${s.name}[^"]*"`);
      assert.match(board, a, `${s.name}'s sticker is not a plain, named, external link`);
    } else {
      assert.match(board, new RegExp(`<span class="sticker[^"]*is-soon[^"]*" data-social="${s.key}"`), `${s.name} is not a greyed sticker`);
      assert.equal(new RegExp(`<a[^>]*data-social="${s.key}"`).test(board), false, `${s.name} is a link before it is open`);
    }
  }
  // the URLs live in door-line.mjs and nowhere else in the board's source
  const src = readFileSync(join(ROOT, "town", "pages", "bulletin", "index.astro"), "utf8");
  for (const s of SOCIALS.filter((x) => x.href)) {
    assert.equal(src.includes(new URL(s.href).host), false, `the board's source copies ${s.name}'s URL`);
  }
});

test("the board keeps no 'more' behind an expand (POS-250's rule)", { skip: !existsSync(bulletinHtml) }, () => {
  const page = readFileSync(bulletinHtml, "utf8");
  const main = page.slice(page.indexOf("<main"), page.indexOf("</main>"));
  assert.equal(/<details\b/.test(main), false, "the bulletin hides text behind an expand");
  assert.equal(/class="pm-more"/.test(main), false);
});

// ── THE PINNED ITEMS (Darko, 2026-10-10 18:58, POS-566) ─────────────────────
// "Dom Pidgey's chapbook as a corkboard item on the main corkboard, outside of
// the town bulletin. And we should also have the Halloween event candy
// declaration on the main corkboard." The words are the town's own.

const CHAPBOOK_TEASER = "The pigeon's compendium of postmark.town: a preface on how it came to be, poems in call-and-response, the Notice Wall's thirteen posters, a gazetteer of notable doors with storybook plates, and a traveler's guide. For old residents and new arrivals alike.";

test("THE PINS: the chapbook credits Dom Pidgey in its bulletin teaser's words; Halloween is its page's title", () => {
  const by = Object.fromEntries(BOARD_PINS.map((p) => [p.key, p]));
  assert.deepEqual(BOARD_PINS.map((p) => p.key), ["chapbook", "halloween"]);
  // the teaser of TOWN_BULLETIN/lamp-flower-chapbook.md (town main, posted
  // 2026-10-05), cut to its first and last clauses for the card (Darko, 19:21:
  // a picture "instead of just having the raw text")
  const [first, last] = by.chapbook.words.replace(/\.$/, "").split(", for ");
  assert.ok(CHAPBOOK_TEASER.startsWith(`${first}:`), "the chapbook's line does not open with its teaser's");
  assert.ok(CHAPBOOK_TEASER.endsWith(`For ${last}.`), "the chapbook's line does not close with its teaser's");
  assert.match(by.chapbook.by, /\bDom Pidgey$/);
  assert.equal(by.chapbook.href, "https://foundoutanyway.github.io/pidgey/lamp-flower-chapbook/");
  assert.equal(by.chapbook.note, undefined);
  // TOWN_BULLETIN/halloween.md's own title, and its three steps in order
  assert.equal(by.halloween.title, "Halloween: what's on the doorsteps");
  assert.equal(by.halloween.note, "halloween");
  assert.deepEqual(by.halloween.steps.map((s) => /^\*\*(.+?)\*\*/.exec(s)?.[1]),
    ["Choose your candy.", "Write to postmaster", "RSVP to the event"]);
  assert.match(by.halloween.steps[2], /"Halloween in Postmark"/);
  // ONE CANDY PER RESIDENT (Darko's 18:58 amendment): "one each", never a household's one
  assert.match(by.halloween.steps[0], /One each: every resident can have their own\./);
  assert.match(by.halloween.after, /so you have some to give\.$/);
  assert.equal(/household/i.test(JSON.stringify(by.halloween)), false, "the Halloween note speaks of a household's candy");
  // each card is illustrated: two of the board's own pictures, on a sky
  assert.deepEqual(by.chapbook.art, ["lampflower"]);
  // DOM PIDGEY'S OWN SPRITE (Darko 19:48), vendored byte for byte and credited
  assert.equal(by.chapbook.sprite.credit, "sprite by Dom Pidgey");
  assert.equal(by.chapbook.sprite.source, "https://foundoutanyway.github.io/pidgey/pidgeys-pigeonholes.html");
  const png = readFileSync(join(ROOT, "public", "atelier", "postmark", ...by.chapbook.sprite.src.split("/").filter(Boolean)));
  assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", "the vendored sprite is not a PNG");
  assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [by.chapbook.sprite.w, by.chapbook.sprite.h]);
  assert.deepEqual(by.halloween.art, ["door", "pumpkin"]);
  assert.deepEqual(BOARD_PINS.map((p) => p.form), ["book", "hanger"]);
  // neither is a piece: no view, no address of the board's own
  for (const p of BOARD_PINS) assert.equal(BOARD_PIECES.some((x) => x.key === p.key), false, `${p.key} is a piece`);
  assert.equal(boardIds().includes("halloween"), false);
});

test("THE PINS' LINKS: the chapbook leaves the town; Halloween opens its notice once the board carries it, its file until then", () => {
  const by = Object.fromEntries(BOARD_PINS.map((p) => [p.key, p]));
  assert.deepEqual(pinLink(by.chapbook, ["halloween"]), { href: by.chapbook.href, note: null, leaves: true });
  assert.deepEqual(pinLink(by.halloween, ["settling-in", "halloween"]), { href: "#halloween", note: "halloween", leaves: false });
  // and that address opens the notice over the notices, the page's own reader says so
  assert.deepEqual(viewOf("#halloween", ["halloween"]), { view: "notices", inner: null, note: "halloween" });
  assert.deepEqual(pinLink(by.halloween, ["settling-in"]),
    { href: "https://github.com/postmark-town/postmark/blob/main/TOWN_BULLETIN/halloween.md", note: null, leaves: true });
});

test("THE PINS are on the built board: the chapbook a new-tab link crediting Dom Pidgey, Halloween a link with its steps",
  { skip: !existsSync(bulletinHtml) }, () => {
  const page = readFileSync(bulletinHtml, "utf8");
  const board = page.slice(page.indexOf('aria-label="The board"'), page.indexOf('class="sill"'));
  const pin = (key) => new RegExp(`<a[^>]*data-pin="${key}"[^>]*>([\\s\\S]*?)</a>`).exec(board);
  const chap = pin("chapbook");
  assert.ok(chap, "the chapbook is not pinned on the board");
  assert.match(chap[0], /href="https:\/\/foundoutanyway\.github\.io\/pidgey\/lamp-flower-chapbook\.html"/);
  assert.match(chap[0], /target="_blank"/);
  assert.match(chap[1], /by resident pigeon Dom Pidgey/);
  assert.ok(chap[1].replace(/&#39;/g, "'").includes("The pigeon's compendium of postmark.town, for old residents and new arrivals alike."));
  // each carries its picture: two pixel maps on the quay, drawn as the postcard's buildings are,
  // in an object of its own (the book's plate, the hanger's window), neither one a card already there
  for (const [key, form, m] of [["chapbook", "book", chap], ["halloween", "hanger", pin("halloween")]]) {
    assert.match(m[0], new RegExp(`<a class="piece ${form}"`), `the ${key} pin is not a ${form}`);
    // no postcard's striped quay band, no harbor's pill, no tack: its own fixings
    assert.equal(/class="(quay|beyond|tack)\b/.test(m[1]), false, `the ${key} pin wears another card's parts`);
    const pic = new RegExp(`<span class="pic pin-pic ${form}-[a-z]+"[^>]*>([\\s\\S]*?)</span>`).exec(m[1])?.[1] ?? "";
    const pinned = BOARD_PINS.find((p) => p.key === key);
    assert.equal((pic.match(/<svg class="px"/g) ?? []).length, pinned.art.length, `the ${key} card's scene is missing a picture`);
    assert.ok((pic.match(/<rect\b/g) ?? []).length > 20, `the ${key} card's scene is empty`);
    if (pinned.sprite) {
      assert.match(pic, new RegExp(`<img class="book-sprite" src="${pinned.sprite.src}" width="169" height="184"`), "Dom Pidgey's sprite is not on the plate");
      assert.ok(m[1].includes(">sprite by Dom Pidgey<"), "the sprite is not credited on the book");
    }
  }
  const hal = pin("halloween");
  assert.ok(hal, "the Halloween notice is not pinned on the board");
  assert.ok(hal[1].replace(/&#39;/g, "'").includes("Halloween: what's on the doorsteps"));
  assert.equal((hal[1].match(/<li\b/g) ?? []).length, 3, "the Halloween note does not carry its three steps");
  assert.ok(hal[1].includes("One each: every resident can have their own."));
  assert.ok(hal[1].includes("so you have some to give."));
  const slugs = bulletinPostings(BULLETIN).map((p) => p.slug);
  assert.match(hal[0], slugs.includes("halloween")
    ? /href="#halloween"[^>]*data-note-open="halloween"/
    : /href="https:\/\/github\.com\/postmark-town\/postmark\/blob\/main\/TOWN_BULLETIN\/halloween\.md"/);
});

// Keemin, 2026-09-27: "can we add the Harbor to the corkboard?" It lives on its
// own domain, so its piece is a plain link that says it leaves the town, and
// never a view on this page.
test("THE HARBOR is pinned as a plain link beyond the town, never a view here",
  { skip: !existsSync(bulletinHtml) }, () => {
  const page = readFileSync(bulletinHtml, "utf8");
  const a = /<a class="piece chart"[^>]*>/.exec(page)?.[0] ?? "";
  assert.match(a, /href="https:\/\/1f4ee\.town\/"/, "the harbor piece does not lead to the harbor");
  assert.equal(/data-open=/.test(a), false, "the harbor opens as a view on the board");
  assert.match(a, /leaves postmark\.town/, "the harbor piece does not say it leaves the town");
  assert.match(page, /class="beyond"[^>]*>beyond the town/);
  assert.equal(BOARD_PIECES.some((p) => p.key === "harbor"), false);
});

test("the harbor's page says what it is for, at the top",
  { skip: !existsSync(builtPage("harbor")) }, () => {
  const page = readFileSync(builtPage("harbor"), "utf8");
  const main = page.slice(page.indexOf('<main class="hb-main"'));
  const first = /<p class="hb-lede"[^>]*data-harbor-purpose[^>]*>([\s\S]*?)<\/p>/.exec(main);
  assert.ok(first && main.indexOf(first[0]) < main.indexOf("<section"), "the purpose is not the first thing in the harbor's main");
  assert.match(first[1], /links together towns like ours/);
  assert.match(first[1], /map of the other AI societies/);
});

// Keemin, 2026-09-27: "We should also credit Deva's household for the inspiration!"
test("the board credits the household that inspired it, by the name the town's record gives it",
  { skip: !existsSync(bulletinHtml) }, () => {
  const page = readFileSync(bulletinHtml, "utf8");
  const HOUSES = JSON.parse(readFileSync(join(ROOT, "src", "data", "postmark", "households.json"), "utf8")).households;
  const [slug, house] = Object.entries(HOUSES).find(([, h]) => (h.accounts ?? []).some((a) => a.login === "devadavisson"));
  const credit = /<p class="credit"[^>]*data-credit[^>]*>([\s\S]*?)<\/p>/.exec(page)?.[1] ?? "";
  assert.ok(credit.includes(`href="/households/${slug}/"`), "the credit does not link the household's page");
  assert.ok(credit.replace(/&#39;/g, "'").includes(house.name), "the credit does not name the household");
  assert.ok(credit.includes('href="https://devadavisson.github.io/snug-harbour-sides/opening/"'));
  assert.equal(/class="tag"[^>]*>the town's board, at the office door/.test(page), false, "the old one-line subtitle is back");
});

for (const [name, segs] of [["the calendar", ["calendar"]], ["Ferry's Daily", ["daily"]]]) {
  test(`${name} carries a way back to the board`, { skip: !existsSync(builtPage(...segs)) }, () => {
    const page = readFileSync(builtPage(...segs), "utf8");
    assert.match(page, /data-board-back[^>]*>\s*<a href="\/bulletin\/"/, `${name} has no way back to the Town`);
  });
}

// ── THE PINS' PICTURES (civic-art.mjs § the board's pinned pictures) ────────

test("the pinned cards' pictures are well-formed maps, inked only in hexes the site wears, every ink used", () => {
  const worn = [
    ...Object.values(INK),
    ...Object.values(ACCENTS).flatMap((a) => Object.values(a)),
    ...POSTIT_PAPERS.map((p) => p.bg),
    readFileSync(join(ROOT, "src", "styles", "global.css"), "utf8"),
    readFileSync(join(ROOT, "src", "styles", "postmark.css"), "utf8"),
    readFileSync(join(ROOT, "town", "pages", "mail", "with", "[pair].astro"), "utf8"),
  ].join(" ").toLowerCase();
  for (const [ch, hex] of Object.entries(BOARD_INK)) {
    assert.ok(worn.includes(hex.toLowerCase()), `the board's ink "${ch}" (${hex}) is a hex the site does not wear`);
  }
  const used = new Set();
  for (const name of BOARD_PINS.flatMap((p) => p.art)) {
    assert.deepEqual(checkSprite(name, BOARD_ART[name]), [], `${name} is not a 24×24 map`);
    for (const r of paintArt(name)) used.add(r.fill);
  }
  for (const [ch, hex] of Object.entries(BOARD_INK)) assert.ok(used.has(hex), `the board's ink "${ch}" is declared and never painted`);
  // a pumpkin is nobody's face: the pictures stay out of SPRITES
  for (const name of Object.keys(BOARD_ART)) assert.equal(Object.hasOwn(SPRITES, name), false, `${name} is in SPRITES`);
  assert.throws(() => paintArt("no-such-picture"), /no board picture named/);
});
