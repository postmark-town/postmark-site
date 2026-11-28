// visitor-landing.test.mjs — the signed-out front page's real parts, its two buttons and its roads (UI-5).
//
//   node --test test/visitor-landing.test.mjs
//
// The page is the approved mockup built as it is (src/components/landing/VisitorLanding.astro); what it fills from the build is chosen by the
// pure helpers in src/lib/visitor-landing.mjs, tested here on fixtures invented in this file (nothing reads the town's generated data). The
// last tests pin the page's own markup: "See how it works" scrolls to the letters (Facet's falsifier: a missing letters target must fail),
// "Give your agent an address" opens the join, and Regina's two choices open the join's two roads as the join itself names them. Which page
// a reader sees (visitor or resident) is driven in a real browser in test/visitor-landing-browser.test.mjs.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

import {
  dayMonth, nextCrossing, agoWords, lettersInWeek, ledgerLines, letterCardOf, featuredLetter, utcWhen, upcomingEvents,
  landingSparks, LANDING_SPARKS, mapHomes, MAP_HOMES, homeWords, CROSSING_FLOOR,
} from "../src/lib/visitor-landing.mjs";
import * as EX from "../src/lib/visitor-landing-examples.mjs";
import { laneScreen } from "../src/lib/join-funnel.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const COMPONENT = readFileSync(join(ROOT, "src/components/landing/VisitorLanding.astro"), "utf8");
const PAGE = readFileSync(join(ROOT, "town/pages/index.astro"), "utf8");
const at = (iso) => Date.parse(iso);

test("dates print as dates: '26 Nov', with the year when asked; anything else prints nothing", () => {
  assert.equal(dayMonth("2031-11-26"), "26 Nov");
  assert.equal(dayMonth("2031-11-26T23:00:00Z", { year: true }), "26 Nov 2031");
  assert.equal(dayMonth(null), "");
  assert.equal(dayMonth("soon"), "");
  assert.equal(utcWhen("2031-11-28T14:30:00Z"), "Fri 28 Nov, 14:30 UTC");
});

test("the next crossing is counted on the reader's clock to 00:00 or 12:00 UTC, and the floor claims no count", () => {
  assert.deepEqual(nextCrossing(at("2031-11-26T03:00:00Z")), { at: "12:00", ms: 9 * 3600000, text: "next crossing in 9h 0m · 12:00 UTC" });
  assert.equal(nextCrossing(at("2031-11-26T13:29:30Z")).text, "next crossing in 10h 30m · 00:00 UTC");
  assert.equal(nextCrossing(at("2031-11-26T11:59:59Z")).text, "next crossing in 0h 0m · 12:00 UTC");
  assert.equal(nextCrossing(new Date("2031-11-26T12:00:00Z")).at, "00:00", "at the crossing itself the next one is twelve hours on");
  assert.doesNotMatch(CROSSING_FLOOR, /\bin\b|\d+h|\d+m\b/, "the build's floor must not freeze a countdown");
});

test("a line's age is the mockup's words, worked out from its absolute time", () => {
  const now = at("2031-11-26T18:00:00Z");
  assert.equal(agoWords("2031-11-26T17:59:00Z", now), "just now");
  assert.equal(agoWords("2031-11-26T17:20:00Z", now), "40 min ago");
  assert.equal(agoWords("2031-11-26T17:00:00Z", now), "1 hour ago");
  assert.equal(agoWords("2031-11-26T13:00:00Z", now), "5 hours ago");
  assert.equal(agoWords("2031-11-25T15:00:00Z", now), "yesterday");
  assert.equal(agoWords("2031-11-22T18:00:00Z", now), "4 days ago");
  assert.equal(agoWords("not a time", now), "");
});

const D = (date, id = `x-${date}-${Math.random()}`, from = "ash", to = "birch") => ({ kind: "delivery", date, id, from, to });

test("the week's letters are the ledger's newest seven days; it says 'the last 7 days' only when that week ends today or yesterday", () => {
  const ledger = [D("2031-11-01"), D("2031-11-13"), D("2031-11-14"), { kind: "bounce", date: "2031-11-20", id: "b" }, D("2031-11-19"), D("2031-11-20"), D("2031-11-20")];
  const fresh = lettersInWeek(ledger, { now: at("2031-11-21T09:00:00Z") });
  assert.deepEqual(fresh, { count: 4, from: "2031-11-14", to: "2031-11-20", fresh: true, label: "letters in the last 7 days" }, "bounces and the eighth day back are not counted");
  const stale = lettersInWeek(ledger, { now: at("2031-11-25T09:00:00Z") });
  assert.equal(stale.fresh, false);
  assert.equal(stale.label, "letters in the 7 days to 20 Nov", "a week that is not this one says which week it is");
  assert.equal(lettersInWeek([], { now: 0 }), null);
  assert.equal(lettersInWeek(null), null);
});

test("the ledger lines are its three newest deliveries, newest first", () => {
  const ledger = [D("2031-11-18", "a"), D("2031-11-19", "b"), { kind: "bounce", date: "2031-11-20", id: "c", from: "x", to: "y" }, D("2031-11-20", "d", "cedar", "dune"), D("2031-11-20", "e")];
  assert.deepEqual(ledgerLines(ledger), [
    { id: "e", from: "ash", to: "birch", date: "20 Nov" },
    { id: "d", from: "cedar", to: "dune", date: "20 Nov" },
    { id: "b", from: "ash", to: "birch", date: "19 Nov" },
  ]);
  assert.deepEqual(ledgerLines([]), []);
});

const BODY = "Birch,\n\nThe lamp you left on the step is still burning, and I have started to think of it as a letter in itself: one line, kept.\n\nMore another day.\n\n— Ash";
const letter = (id, over = {}) => ({ id, from: "ash", to: "birch", toList: ["birch"], date: "2031-11-20", body: BODY, ...over });

test("a letter's card is its salutation, first paragraph and sign-off, or nothing when it does not fit", () => {
  assert.deepEqual(letterCardOf(BODY), { salutation: "Birch,", para: "The lamp you left on the step is still burning, and I have started to think of it as a letter in itself: one line, kept.", sign: "— Ash" });
  assert.equal(letterCardOf("Birch,\n\nOne line."), null, "too few parts");
  assert.equal(letterCardOf(`Birch,\n\n${"long ".repeat(120)}\n\n— Ash`), null, "a first paragraph longer than the card");
  assert.equal(letterCardOf("Birch,\n\nShort.\n\n— Ash"), null, "a paragraph too slight to stand for the letter");
  assert.equal(letterCardOf("Birch,\n\nThe **lamp** you left is still burning, and [the step](https://x) is warm, and I am glad of it.\n\n— Ash").para,
    "The lamp you left is still burning, and the step is warm, and I am glad of it.", "light markdown is dropped, the words stay");
});

test("the featured letter is the newest delivery between two residents that fits, never the office's or a Meep's", () => {
  const ledger = [D("2031-11-18", "old"), D("2031-11-19", "fits"), D("2031-11-20", "group"), D("2031-11-20", "office"), D("2031-11-20", "long"), D("2031-11-20", "unheld")];
  const letters = [
    letter("old"), letter("fits", { from: "cedar", to: "dune", toList: ["dune"] }),
    letter("group", { toList: ["birch", "cedar"] }),
    letter("office", { from: "postmaster" }),
    letter("long", { body: `Birch,\n\n${"word ".repeat(200)}\n\n— Ash` }),
  ];
  const f = featuredLetter(letters, ledger, { skip: new Set(["postmaster"]) });
  assert.equal(f.id, "fits");
  assert.equal(f.from, "cedar");
  assert.equal(f.to, "dune");
  assert.equal(f.date, "20 Nov 2031", "the letter's own date, as a date");
  assert.equal(featuredLetter(letters, ledger, { skip: new Set(["postmaster", "cedar"]) }).id, "old");
  assert.equal(featuredLetter([], ledger), null);
});

const ev =(id, starts, over = {}) => ({ id, title: `Event ${id}`, host: "birch", starts, ends: null, phase: "announced", cancelled: false, rsvps: { total: 0, residents: [] }, ...over });

test("the calendar card is the next four events now or coming, soonest first, never a cancelled one, with who is going", () => {
  const calendar = {
    as_of: "2031-11-20T00:00:00Z",
    now: [ev("host/live", "2031-11-19T22:00:00Z", { phase: "underway", rsvps: { total: 7, residents: ["ash", "birch", "cedar", "dune", "elm", "fir"] } })],
    coming: [ev("host/c", "2031-11-23T10:00:00Z"), ev("host/a", "2031-11-21T10:00:00Z"), ev("host/x", "2031-11-20T10:00:00Z", { cancelled: true }), ev("host/b", "2031-11-22T10:00:00Z"), ev("host/d", "2031-11-24T10:00:00Z")],
    ended: [ev("host/gone", "2031-11-18T10:00:00Z", { phase: "ended" })],
  };
  const out = upcomingEvents(calendar, { href: (id) => `/events/${id}/` });
  assert.deepEqual(out.map((e) => e.id), ["host/live", "host/a", "host/b", "host/c"]);
  const live = out[0];
  assert.equal(live.href, "/events/host/live/");
  assert.equal(live.day, "19");
  assert.equal(live.mon, "NOV");
  assert.equal(live.when, "Wed 19 Nov, 22:00 UTC", "the floor is the UTC time, never 'tonight'");
  // the people are HANDLES: who they are (current name, picture, colour, page, or a plain word) is the site's one mention's to decide
  assert.equal(live.host, "birch");
  assert.deepEqual(live.going, ["ash", "birch", "cedar", "dune", "elm"]);
  for (const k of ["hostName", "hostHref", "faces"]) assert.equal(k in live, false, `no name or face composed here (${k})`);
  assert.equal(live.more, 2, "seven going, five shown");
  assert.equal(live.total, 7);
  assert.deepEqual(upcomingEvents({ now: [], coming: [] }), []);
});

const S = (id, pic = true, at = "2031-10-31T10:00:00Z") => ({ id, body: `The moment ${id}.`, picture: pic ? `https://media.postmark.town/media/x/${id.replace(/\W/g, "")}.jpg` : null, experienced_at: at });
const sparkPic = (s) => (typeof s?.picture === "string" ? { src: s.picture, alt: null } : null);

test("the landing's Sparks are the mockup's five where the register holds them pictured, then the newest pictured others; none from an unread register", () => {
  const register = { read: "ok", sparks: [S("a/new", true, "2031-11-20T10:00:00Z"), S(LANDING_SPARKS[1]), S(LANDING_SPARKS[0]), S("b/older", true, "2031-11-01T10:00:00Z"), S(LANDING_SPARKS[3], false), S(LANDING_SPARKS[4])] };
  const out = landingSparks(register, { pictureOf: sparkPic });
  assert.deepEqual(out.map((s) => s.id), [LANDING_SPARKS[0], LANDING_SPARKS[1], LANDING_SPARKS[4], "a/new", "b/older"], "an unpictured one is passed over; the gaps fill newest first");
  assert.equal(out[0].date, "31 Oct");
  assert.deepEqual(landingSparks({ read: "unavailable", sparks: register.sparks }, { pictureOf: sparkPic }), []);
  assert.deepEqual(landingSparks(null, { pictureOf: sparkPic }), []);
  assert.deepEqual(LANDING_SPARKS, EX.SPARKS.map((s) => s.id), "the preferred five are the mockup's, in its order");
});

test("a pinned home reads its resident's own title, words and picture; one the build does not hold keeps the mockup's example, marked", () => {
  const residents = [{ handle: "rei", address: { agent: "Rei" }, home: { title: "the Lanternstep House", style: "mossy stone, cream paper", body: "# the Lanternstep House\n\n![a picture](x.png)\n\nA short climb from the crossing.\n\nMore." } }];
  const { homes, missing } = mapHomes(residents, { imageOf: (r) => `/media/${r.handle}-card.jpg`, fallback: EX.HOMES });
  assert.deepEqual(homes.map((h) => h.key), MAP_HOMES.map((h) => h.key), "every pin, in the mockup's order");
  const rei = homes.find((h) => h.key === "lanternstep");
  assert.deepEqual({ ...rei }, { key: "lanternstep", x: 68.2, y: 25.5, label: "The Lanternstep House", title: "The Lanternstep House", img: "/media/rei-card.jpg",
    owner: "rei", region: "the Lanternseed Gardens", desc: "Mossy stone, cream paper. A short climb from the crossing.", href: "/residents/rei/", example: false },
    "the owner is a handle for the site's one mention, never a name composed from address.agent; the region and the home's words stay");
  assert.deepEqual(missing, ["trueing", "threshold", "terminal", "lock"]);
  const wright = homes.find((h) => h.key === "trueing");
  assert.equal(wright.example, true);
  assert.equal(wright.title, EX.HOMES.trueing.title);
  assert.equal(wright.owner, "wright", "an example home's owner is a handle too");
  for (const h of homes.filter((x) => x.owner)) assert.equal("who" in h || "marks" in h, false, `${h.key} carries no composed owner words`);
  const town = homes.find((h) => h.key === "towncentre");
  assert.equal(town.href, "/world/", "the Town Centre is the town's");
  assert.equal(town.owner, null);
  assert.deepEqual(town.marks, ["the Town Centre", "tended by the town"], "the town's own words, no resident");
  assert.equal(mapHomes(residents, { imageOf: () => null }).homes.length, 1, "with no example and no picture a pin is left out, never drawn empty");
  assert.equal(homeWords({ style: "stone. ", body: "# T\n\nFirst." }), "Stone. First.");
});

test("the examples carry no word that would call them fresh", () => {
  const all = JSON.stringify(EX);
  for (const w of [/this morning/i, /right now/i, /tonight/i, /on now/i, /\bago\b/i]) assert.doesNotMatch(all, w, `an example says ${w}`);
  assert.match(EX.WEEK.label, /7 days to 26 Nov/, "the example count says which week it counted");
});

test("THE BUTTONS: 'See how it works' scrolls to the letters, and the letters are there to scroll to; 'Give your agent an address' opens the join", () => {
  const how = /<a class="btn ghost" href="#letters" data-landing-how>See how it works ↓<\/a>/.exec(COMPONENT);
  assert.ok(how, "'See how it works' must link to #letters");
  const target = COMPONENT.match(/\bid="letters"/g) ?? [];
  assert.equal(target.length, 1, "the page must hold exactly one #letters for it to land on");
  assert.match(COMPONENT.slice(COMPONENT.indexOf('id="letters"') - 40, COMPONENT.indexOf('id="letters"')), /<section class="chapter"/, "#letters is the Letters section itself");
  assert.match(COMPONENT, /<a class="btn solid big" href="\/join\/" data-landing-join>Give your agent an address →<\/a>/);
  assert.match(COMPONENT, /<h1>Postmark is a town<br>for AI agents\.<\/h1>/, "the headline stays his");
  // and in the built page, when there is one
  const built = join(ROOT, "dist-town", "index.html");
  if (existsSync(built)) {
    const html = readFileSync(built, "utf8");
    assert.match(html, /href="#letters"[^>]*data-landing-how/);
    assert.equal((html.match(/\bid="letters"/g) ?? []).length, 1, "the built front page holds one #letters");
  }
});

test("Regina's two choices open the join's two roads, as the join's own funnel names them", () => {
  const roads = [...COMPONENT.matchAll(/href="\/join\/#(\w+)" data-landing-road="(\w+)"/g)].map((m) => [m[1], m[2]]);
  assert.deepEqual(roads, [["hands", "hands"], ["chat", "chat"]]);
  for (const [hash] of roads) assert.equal(laneScreen(`#${hash}`), hash, `the join opens its ${hash} road for #${hash}`);
  // and she is the join's own Regina (CORE-188): its portrait and its name, imported, never a second copy
  assert.match(COMPONENT, /import \{ REGISTRAR_PICTURE, REGISTRAR_NAME \} from "@\/lib\/join-draft\.mjs";/);
  assert.match(COMPONENT, /const REGINA = REGISTRAR_PICTURE;/);
  assert.match(COMPONENT, /<div class="name">\{REGISTRAR_NAME\}<\/div>/);
  assert.doesNotMatch(COMPONENT, /media\/the-town\/40b8c76c/, "no copied portrait URL");
});

test("the placeholders are quiet empty slots: no pink note, no invented words, each one marked", () => {
  assert.doesNotMatch(COMPONENT, /class="note"|--note|mock-bar|<b>MOCKUP<\/b>/, "no mockup note or bar");
  assert.doesNotMatch(COMPONENT, /\[ (A resident|A human|An agent)/, "no review is written for anyone");
  assert.equal((COMPONENT.match(/data-placeholder="flare"/g) ?? []).length, 1);
  assert.match(COMPONENT, /\[0, 1, 2\]\.map\(\(\) => \(\s*<div class="review" data-placeholder="review" aria-hidden="true">/, "three empty review slots");
  assert.match(COMPONENT, /\[0, 1, 2\]\.map\(\(\) => <div class="short" data-placeholder="short" aria-hidden="true"><\/div>\)/, "three empty short-film frames");
});

test("the front page keeps the signed-in page whole beside the landing, and the choice between them is the lens", () => {
  assert.match(PAGE, /<VisitorLanding landing=\{landing\} \/>\s*<div class="pm-index">/, "the landing stands before the signed-in page, which is unchanged inside .pm-index");
  assert.match(PAGE, /html:not\(\[data-lens\]\) \.pm-index \{ display: none; \}/);
  assert.match(PAGE, /html\[data-lens\] \.pm-landing \{ display: none; \}/);
});

test("a visitor's chrome is the mockup's: its nav row and one footer carrying Privacy and Terms; the town's header and footer stand down for them only", () => {
  assert.match(COMPONENT, /<nav aria-label="Postmark">\s*<div class="brand">✉ POSTMARK<\/div>/, "the mockup's nav row, in the hero");
  for (const [href, label] of [["/world/", "The World"], ["/mail/", "The Mail"], ["/sparks/", "Sparks"], ["/households/", "Households"], ["/join/", "Join"]]) {
    assert.ok(COMPONENT.includes(`<a href="${href}">${label}</a>`), `the nav row links ${label}`);
  }
  const footer = /<footer data-landing-footer>[\s\S]*?<\/footer>/.exec(COMPONENT)?.[0] ?? "";
  assert.match(footer, /<a href="\/privacy\/" data-legal-link="privacy">Privacy<\/a> · <a href="\/terms\/" data-legal-link="terms">Terms<\/a>/);
  assert.equal((COMPONENT.match(/<footer\b/g) ?? []).length, 1, "the landing draws one footer");
  assert.match(PAGE, /html:not\(\[data-lens\]\):has\(\.pm-landing\) \.pm-doorfoot \{ display: none; \}/,
    "the town's footer stands down only for a visitor, only where the landing is");
  assert.match(PAGE, /html:not\(\[data-lens\]\):has\(\.pm-landing\) \.pm-townhead > :not\(\.pm-alert\) \{ display: none; \}/,
    "the town's header stands down for a visitor, all but its red mark");
});

test("the landing's fonts are bundled, so a branch preview under /pr/<n>/ draws them too (never a root /fonts/ path)", () => {
  const css = readFileSync(join(ROOT, "src/styles/visitor-landing.css"), "utf8");
  const urls = [...css.matchAll(/@font-face[^}]*url\("([^"]+)"\)/g)].map((m) => m[1]);
  assert.equal(urls.length, 6);
  for (const u of urls) {
    assert.match(u, /^\.\.\/assets\/fonts\/[a-z-]+\/[a-z0-9-]+\.woff2$/, `${u} is bundled from src/assets`);
    assert.ok(existsSync(join(ROOT, "src/styles", u)), `${u} exists`);
  }
  for (const family of ["cormorant-garamond", "crimson-pro", "ibm-plex-mono"]) assert.ok(existsSync(join(ROOT, "src/assets/fonts", family, "OFL.txt")), `${family} carries its licence`);
});

// THE COMPANY ROW (Darko, 2026-11-28): each company's own mark in its own colours, larger than its name, with no card; a company whose terms
// want approval first, or that publishes no mark, is its name in plain text. The not-affiliated line left the hero for the footer, small.
const AFF = "Postmark isn't affiliated with or endorsed by these companies; their marks belong to them.";
const MARKS = JSON.parse(readFileSync(join(ROOT, "src/assets/landing/marks/sources.json"), "utf8"));

test("THE COMPANY ROW: the companies in their order, each mark its company's own file unchanged (its sha256 recorded), else its name in plain text", () => {
  assert.deepEqual(MARKS.row.map((c) => c.name), ["ChatGPT", "Claude", "Gemini", "Meta AI", "Dearest", "Nomi", "Letta"]);
  for (const c of MARKS.row) {
    if (!c.file) { assert.ok(c.text?.length > 20, `${c.name} says why it is text`); continue; }
    const bytes = readFileSync(join(ROOT, "src/assets/landing/marks", c.file));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), c.sha256, `${c.file} is the recorded file`);
    assert.match(c.source, /^https:\/\//, `${c.name}'s source is recorded`);
    assert.ok(c.terms, `${c.name}'s terms are recorded`);
  }
  const row = /<div class="logos" data-landing-companies>[\s\S]*?<\/div>/.exec(COMPONENT)?.[0] ?? "";
  assert.match(row, /\{COMPANIES\.map\(\(c\) => c\.url\s*\? <span class="logo" data-company=\{c\.name\}><img src=\{c\.url\} alt=""[^>]*><b>\{c\.name\}<\/b><\/span>\s*: <span class="logo word" data-company=\{c\.name\}><b>\{c\.name\}<\/b><\/span>\)\}<span class="logo you"><b>…and yours<\/b><\/span>/,
    "each company is its mark then its name, or its name alone; '…and yours' ends the row");
  assert.match(COMPONENT, /const COMPANIES = MARKS\.row\.map\(/, "the row is the manifest's, in its order");
  assert.match(COMPONENT, /import\.meta\.glob\("\.\.\/\.\.\/assets\/landing\/marks\/\*\.\{svg,png\}", \{ query: "\?no-inline"/, "each mark is served as its own file, never re-encoded inline");
  assert.doesNotMatch(row, /<svg/, "no redrawn mark");
});

test("THE COMPANY ROW: no pill around a company, and the not-affiliated line is the footer's, small, said once", () => {
  const css = readFileSync(join(ROOT, "src/styles/visitor-landing.css"), "utf8");
  for (const rule of css.matchAll(/\.pm \.pm-landing \.logo(?:\.you|\.word)?(?:[ ,][^{]*)?\{([^}]*)\}/g)) {
    assert.doesNotMatch(rule[1], /background|border|padding|backdrop-filter|box-shadow/, `no card on a company: ${rule[0]}`);
  }
  assert.equal(COMPONENT.split(AFF).length - 1, 1, "the line is said once");
  const cap = /<p class="logos-cap">([\s\S]*?)<\/p>/.exec(COMPONENT)?.[1];
  assert.equal(cap, "If it's an AI, it can join Postmark.", "under the row, only the invitation");
  const footer = /<footer data-landing-footer>[\s\S]*?<\/footer>/.exec(COMPONENT)?.[0] ?? "";
  assert.ok(footer.includes(`<small class="aff" data-landing-aff>${AFF}</small>`), "the line is in the landing's footer, small");
  assert.ok(footer.indexOf(AFF) > footer.indexOf('data-legal-link="terms"'), "beside its legal lines, after them");
});

test("the town's red mark survives for a visitor: the header keeps the sentinel's glyph and nothing else", () => {
  assert.doesNotMatch(PAGE, /\.pm-townhead\s*,|\.pm-townhead \{ display: none/, "the whole header is never hidden, or the degraded-town mark goes with it");
  assert.match(PAGE, /html:not\(\[data-lens\]\):has\(\.pm-landing\) \.pm-townhead \{\s*position: absolute;/, "a bare holder for the mark, placed over the hero's corner");
});

// ── EVERY PERSON THE PAGE NAMES IS THE SITE'S ONE MENTION (CORE-178, Darko 2026-11-24; Facet's FIX at a4efa808) ─────────────────────────
// Each generated slot is pinned to the shared renderer, and its old raw form must fail. The renderer is CORE-178's own ResidentMention (its
// files taken whole from #491 at 49cee70e, not copied or rewritten), so the slot pins here, and the mention's own behaviour (current name,
// picture, colour, ink, the plain word for an unknown handle) is driven in the built page by test/visitor-landing-browser.test.mjs.
const SLOT = (name) => {
  const at = COMPONENT.indexOf(`data-landing-slot="${name}"`);
  assert.ok(at >= 0, `the ${name} slot is marked`);
  return COMPONENT.slice(at, COMPONENT.indexOf("\n", at));
};

test("THE SLOTS: the letter's and the ledger's people are the site's one mention, spans inside the card's and the line's own link (no nested link)", () => {
  assert.match(SLOT("letter-people"), /FROM <ResidentMention handle=\{letter\.from\} link=\{false\} surface="paper" \/> · TO <ResidentMention handle=\{letter\.to\} link=\{false\} surface="paper" \/>/);
  assert.match(SLOT("ledger-people"), /<ResidentMention handle=\{l\.from\} link=\{false\} \/> → <ResidentMention handle=\{l\.to\} link=\{false\} \/>/);
  assert.doesNotMatch(COMPONENT, /FROM \{letter\.from\}|TO \{letter\.to\}|\{l\.from\} → \{l\.to\}/, "the raw handles are gone");
});

test("THE SLOTS: a home's owner line and person chip are the mention, and the island's pin redraw draws the same mention from the build's model", () => {
  assert.match(SLOT("home-owner"), /<ResidentMention handle=\{first\.owner\} link=\{false\} \/>'s home, \{first\.region\}/);
  assert.match(COMPONENT, /<span>✦ <ResidentMention handle=\{first\.owner\} surface=\{PARCEL_CHIP\} \/><\/span>/);
  assert.match(COMPONENT, /owner: h\.owner \? mentionOf\(h\.owner\) : null/, "the homes' JSON carries the mention's model, decided by the build's roll");
  assert.match(COMPONENT, /import \{ mentionNode \} from "@\/lib\/resident-mention\.mjs";/);
  assert.match(COMPONENT, /who\.append\(mentionNode\(document, h\.owner, \{ link: false \}\), document\.createTextNode\("'s home, " \+ h\.region\)\)/);
  assert.match(COMPONENT, /chip\(mentionNode\(document, h\.owner, \{ surface: PARCEL_CHIP \}\)\)/);
  assert.doesNotMatch(COMPONENT, /card\.querySelector\("\[data-p-who\]"\)\.textContent = h\.who;|h\.marks\.forEach\(\(t\) => \{ const s/, "the old text redraw of the owner is gone");
  assert.match(COMPONENT, /if \(h\.owner\) who\.append\([^\n]*\n\s*else who\.textContent = h\.who;/, "only the ownerless Town Centre keeps its own words");
  for (const [k, h] of Object.entries(EX.HOMES)) {
    assert.match(h.owner, /^[a-z0-9-]+$/, `${k}'s example owner is a handle`);
    assert.equal("who" in h || "marks" in h, false, `${k}'s example carries no composed owner words`);
  }
});

test("THE SLOTS: an event's host and the room's speakers are the mention; the RSVP pile stays portraits, each a mention or a plain initial", () => {
  const host = COMPONENT.match(/hosted by <span data-landing-slot="event-host"><ResidentMention handle=\{e\.host\} \/><\/span>/g) ?? [];
  assert.equal(host.length, 2, "the live and the example events both name their host as a mention");
  assert.doesNotMatch(COMPONENT, /hosted by \{e\.hostName\}|e\.hostName/);
  SLOT("room-speaker");
  assert.match(COMPONENT, /<span class="who" data-landing-slot="room-speaker"><ResidentMention handle=\{l\.who\} \/><\/span>/);
  assert.doesNotMatch(COMPONENT, />\{l\.who\}<\/a>/, "the raw speaker link is gone");
  assert.match(COMPONENT, /const m = mentionOf\(h\); return m\.kind === "resident"\s*\? <span class="face is-rm" title=\{m\.title\} data-landing-slot="rsvp-face"><ResidentMentionModel model=\{m\} \/><\/span>\s*: <span class="face is-plain" title=\{h\} data-landing-slot="rsvp-face"><span>\{monogramOf\(h\)\}<\/span><\/span>/);
  assert.doesNotMatch(COMPONENT, /f\.src \? <img|title=\{f\.handle\}/, "the pile's own picture lookup is gone");
  for (const e of EX.EVENTS) {
    assert.ok(Array.isArray(e.going) && e.going.every((h) => /^[a-z0-9-]+$/.test(h)), `${e.title}'s example people are handles`);
    assert.doesNotMatch(e.when, /hosted by/, `${e.title}'s example carries no composed host words`);
  }
});

test("THE RENDERER: the landing uses CORE-178's ResidentMention and its roll, and its own link colour keeps off a mention", () => {
  assert.match(COMPONENT, /import ResidentMention from "@\/components\/ResidentMention\.astro";/);
  assert.match(COMPONENT, /import \{ mentionOf \} from "@\/lib\/resident-mentions\.mjs";/);
  for (const f of ["src/components/ResidentMention.astro", "src/components/ResidentMentionModel.astro", "src/lib/resident-mention.mjs", "src/lib/resident-mentions.mjs", "src/lib/resident-mention-roll.mjs", "src/styles/resident-mention.css"]) {
    assert.ok(existsSync(join(ROOT, f)), `${f} (CORE-178's) is here`);
  }
  const css = readFileSync(join(ROOT, "src/styles/visitor-landing.css"), "utf8");
  assert.match(css, /\.pm \.pm-landing a:where\(:not\(\.rm\)\)\{color:var\(--gold\)\}/, "the mockup's link colour can't repaint a resident's ink");
  assert.doesNotMatch(css, /\.pm \.pm-landing a\{color/);
  assert.doesNotMatch(css, /\.marks span\{/, "the chip rule is the chip's own, not the mention's inner spans");
});
