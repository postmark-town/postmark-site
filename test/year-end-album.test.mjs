// year-end-album.test.mjs — the year's-end album book on the Town's corkboard (CORE-173).
//
//   node --test test/year-end-album.test.mjs
//
// Darko, 2026-11-23 19:21 EST (CORE-163/b): "during the duration of the event, we can just have a nice like end of year album book on
// our corkboard on the site that takes you straight to the event and the gallery." The season (CORE-163/c): December 1 to January 6.
// THE FIT: a book, only for the event the build read (never a guessed one) and only inside that event's own posted window, with its
// two ways in (the event's page and its gallery); outside the window, or with no readable event, nothing on the board and no gap.
//
// Every event here is INVENTED (`fixture-host/invented-album`): it exercises the rule, and it is never the production target, Rei's
// confirmed `rei/a-little-light-at-years-end`, which only the production-config test names. The built-page check reads dist-town
// when it is there.

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { YEAR_END_ALBUM, albumGuardScript, eventWindow, yearEndAlbum } from "../src/lib/year-end-album.mjs";
import { BOARD_ART, BOARD_INK, INK, SPRITES, checkSprite, paintArt } from "../src/lib/civic-art.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (...p) => readFileSync(join(ROOT, ...p), "utf8");

const ID = "fixture-host/invented-album";
const CFG = { ...YEAR_END_ALBUM, id: ID };
const EVENT = { id: ID, title: "An Invented Album", starts: "2026-12-01T17:00:00.000Z", ends: "2027-01-06T23:00:00.000Z", cancelled: false };
const cal = (...events) => ({ as_of: null, now: [], coming: events, ended: [] });
const NONE = { past: { events: [] }, evidence: {} };
const IN = Date.parse("2026-12-15T12:00:00Z");
const ms = (s) => Date.parse(s);

// ── the event's own window ────────────────────────────────────────────────

test("the book keeps to its event's own posted start and end, exactly", () => {
  const at = (t, e = EVENT) => yearEndAlbum(cal(e), NONE, t, CFG);
  assert.equal(at(ms(EVENT.starts) - 1), null, "a moment before the event starts: no book");
  assert.ok(at(ms(EVENT.starts)), "as it starts: the book");
  assert.ok(at(ms(EVENT.ends) - 1), "its last moment: still the book");
  assert.equal(at(ms(EVENT.ends)), null, "as it ends: gone");
  assert.ok(at(new Date("2026-12-24T00:00:00Z")), "a Date reads as its instant");
  assert.equal(at(Number.NaN), null);
});

test("a posted window that differs from the ruled season wins: no book outside it, whatever the season says", () => {
  const short = { ...EVENT, starts: "2026-12-03T17:00:00.000Z", ends: "2026-12-20T17:00:00.000Z" };
  const at = (t) => yearEndAlbum(cal(short), NONE, ms(t), CFG);
  assert.equal(at("2026-12-02T12:00:00Z"), null, "December 2, in the season but before the event: no book");
  assert.ok(at("2026-12-10T12:00:00Z"));
  assert.equal(at("2026-12-21T12:00:00Z"), null, "December 21, in the season but after the event: no book");
  const late = { ...EVENT, starts: "2027-01-02T17:00:00.000Z", ends: "2027-01-20T17:00:00.000Z" };
  assert.ok(yearEndAlbum(cal(late), NONE, ms("2027-01-15T12:00:00Z"), CFG), "past January 6 while the event runs: the event decides");
  assert.equal(yearEndAlbum(cal(late), NONE, ms("2027-01-20T17:00:00Z"), CFG), null, "and gone as it ends");
  assert.equal(yearEndAlbum(cal(short), NONE, ms("2026-12-10T12:00:00Z"), CFG).until, ms(short.ends), "the guard expires at the event's end");
});

test("a missing or invalid start or end authorizes no book", () => {
  const bad = [
    { starts: undefined }, { ends: undefined }, { starts: null }, { ends: "" }, { starts: "soon" }, { ends: "not a time" },
    { starts: 1765000000000 }, { ends: "2026-12-01T17:00:00.000Z" }, { starts: EVENT.ends, ends: EVENT.starts },
  ];
  for (const over of bad) {
    const e = { ...EVENT, ...over };
    assert.equal(eventWindow(e), null, `window from ${JSON.stringify(over)}`);
    assert.equal(yearEndAlbum(cal(e), NONE, IN, CFG), null, `book with ${JSON.stringify(over)}`);
  }
  assert.deepEqual(eventWindow(EVENT), { from: ms(EVENT.starts), until: ms(EVENT.ends) });
});

// ── the target ────────────────────────────────────────────────────────────

test("inside its event's window the book goes straight to its event's page and that page's gallery, under the event's own title", () => {
  const book = yearEndAlbum(cal(EVENT), NONE, IN, CFG);
  assert.deepEqual(book, {
    id: ID, title: "An Invented Album",
    href: "/events/fixture-host/invented-album/", gallery: "/events/fixture-host/invented-album/#gallery",
    until: ms(EVENT.ends), art: CFG.art,
  });
  const lasting = yearEndAlbum(cal(), { past: { events: [EVENT] }, evidence: {} }, IN, CFG);
  assert.equal(lasting?.href, book.href, "an event the calendar has let go of is still read from the lasting list");
});

test("the book never guesses: no id, a malformed id, an event the build didn't read, a cancelled or untitled one: no book", () => {
  assert.equal(yearEndAlbum(cal(EVENT), NONE, IN, { ...CFG, id: null }), null, "no id");
  for (const id of ["invented-album", "a/b/c", "", "/x"]) assert.equal(yearEndAlbum(cal({ ...EVENT, id }), NONE, IN, { ...CFG, id }), null, `id ${JSON.stringify(id)}`);
  assert.equal(yearEndAlbum(cal(), NONE, IN, CFG), null, "the build read no such event");
  assert.equal(yearEndAlbum(cal({ ...EVENT, id: "fixture-host/another" }), NONE, IN, CFG), null, "another event is not this one");
  assert.equal(yearEndAlbum({}, {}, IN, CFG), null, "an unread calendar");
  assert.equal(yearEndAlbum(cal({ ...EVENT, cancelled: true }), NONE, IN, CFG), null, "cancelled");
  for (const title of [undefined, null, "", "   ", 7]) assert.equal(yearEndAlbum(cal({ ...EVENT, title }), NONE, IN, CFG), null, `title ${JSON.stringify(title)}`);
});

test("THE PRODUCTION BOOK names Rei's confirmed event, and only that event the build reads opens it", () => {
  assert.equal(YEAR_END_ALBUM.id, "rei/a-little-light-at-years-end", "the id Rei confirmed (CORE-173, Wright 2026-11-24 01:36Z), never another");
  assert.ok(Object.isFrozen(YEAR_END_ALBUM));
  assert.equal(yearEndAlbum(cal(EVENT), NONE, IN), null, "an invented event is not the production one");
  assert.equal(yearEndAlbum(cal(), NONE, IN), null, "until the Office carries Rei's event, no book");
  const reis = { ...EVENT, id: YEAR_END_ALBUM.id };
  assert.equal(yearEndAlbum(cal(reis), NONE, IN)?.href, "/events/rei/a-little-light-at-years-end/", "read, inside its window: its page");
});

test("a page built inside the window and read after the event's end drops the book itself", () => {
  const s = albumGuardScript(ms(EVENT.ends));
  assert.match(s, new RegExp(`Date\\.now\\(\\)>=${ms(EVENT.ends)}\\)`));
  assert.match(s, /querySelectorAll\("\[data-year-end-album\]"\)/);
  assert.match(s, /\.remove\(\)/);
  for (const v of [undefined, null, Number.NaN, "2026-12-01"]) assert.throws(() => albumGuardScript(v), /needs the event's end/, `guard from ${v}`);
});

// ── the picture ───────────────────────────────────────────────────────────

test("the book's picture is its own: the album table, a well-formed map in the board's inks, nobody's sprite", () => {
  assert.deepEqual(YEAR_END_ALBUM.art, ["albumtable"]);
  for (const name of YEAR_END_ALBUM.art) {
    assert.deepEqual(checkSprite(name, BOARD_ART[name]), [], `${name} is not a 24×24 map`);
    const inks = new Set(Object.values({ ...INK, ...BOARD_INK }));
    const rects = paintArt(name);
    assert.ok(rects.length > 40, `${name} is nearly empty`);
    for (const r of rects) assert.ok(inks.has(r.fill), `${name} paints ${r.fill}, an ink the board doesn't keep`);
    assert.equal(Object.hasOwn(SPRITES, name), false);
    for (const [other, rows] of Object.entries(BOARD_ART)) if (other !== name) assert.notDeepEqual(rows, BOARD_ART[name], `${name} repeats ${other}`);
  }
});

// ── the board ─────────────────────────────────────────────────────────────

test("PIN the board draws the book from yearEndAlbum alone, as a photo album with its two plain links, and its guard with it", () => {
  const page = read("town", "pages", "bulletin", "index.astro");
  assert.match(page, /const album = yearEndAlbum\(calendar, eventsData\);/, "the build's own calendar and lasting list, the build's clock");
  const li = /\{album && \(\s*<li class="pin-album" data-year-end-album>([\s\S]*?)<\/li>\s*\)\}/.exec(page)?.[1] ?? "";
  assert.ok(li, "the album is not drawn as its own item, only when there is a book");
  assert.match(li, /<a class="album-title" href=\{album\.href\}>\{album\.title\}<\/a>/, "the title, as text, to the event's page");
  assert.match(li, /<a class="album-foot" href=\{album\.gallery\}>/, "the foot to the event's gallery");
  assert.equal((li.match(/<a\b/g) ?? []).length, 2, "two ways in, and no other link");
  assert.doesNotMatch(li, /set:html|data-pin=|data-open=|data-note-open=|target=/, "no markup from a resident's words; not a BOARD_PINS pin, a view, or a new tab");
  assert.doesNotMatch(li, /class="(washi|book-[a-z]+|hanger-[a-z]+|tack|quay|beyond)\b/, "it wears no other card's parts");
  assert.match(li, /class="album-snap"[\s\S]*corner tl[\s\S]*<svg class="px"/, "the album table, mounted in photo corners");
  assert.match(page, /\{album && <Fragment set:html=\{albumGuardScript\(album\.until\)\} \/>\}/, "the guard goes with the book, expiring at its event's end");
  assert.doesNotMatch(li, /December|January/, "no season dates typed on the book: the event's window is the Office's");
  assert.match(page, /\.pin-album \{ width: min\(100%, 21em\);/, "it fits a phone's column");
});

const built = join(ROOT, "dist-town", "bulletin", "index.html");
test("BUILT: the board carries the book exactly when the build's own data and clock say so",
  { skip: existsSync(built) ? false : "no built pages (dist-town/)" }, () => {
  const page = readFileSync(built, "utf8");
  const calendar = JSON.parse(read("src", "data", "postmark", "calendar.json"));
  const events = JSON.parse(read("src", "data", "postmark", "events.json"));
  const book = yearEndAlbum(calendar, events, Date.now());
  assert.equal(page.includes("data-year-end-album"), !!book, book ? "the book is missing in its season" : "a book, or its place, outside its season or without its event");
  assert.equal(/class="pin-album/.test(page), !!book);
});
