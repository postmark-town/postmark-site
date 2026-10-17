// og-image.test.mjs — a shared link previews with the page's own picture
// (POS-616, Darko 2026-10-13: "each page passes its own image to the layout,
// with the banner as the fallback").
//
// No suite renders an .astro page, so the pick lives in src/lib/og-image.mjs
// and is held here, plus a read of the pages that must hand it to the layout:
//
//   1. a household page: the first resident with a portrait, then any member's
//      house picture, then the banner; a portrait asks for the small card;
//   2. a section page: its section's card, by `active`;
//   3. the fallback: a page with no picture of its own, and no section, gets
//      the banner;
//   4. the pages pass what the module picks.
//
//   node --test test/og-image.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  BANNER, LARGE, SMALL, SECTION_CARDS, sectionCard,
  portraitOf, householdPreview, residentPreview, handlesPreview, openerFirst,
} from "../src/lib/og-image.mjs";
import { RAIL } from "../src/lib/nav.mjs";

const read = (rel) => readFileSync(new URL(rel, import.meta.url), "utf8");

// Residents as residents.json carries them, and the media map the build makes.
const withFace = (handle) => ({ handle, profile: { avatar: "avatar.jpg" } });
const faceless = (handle) => ({ handle, profile: {} });
const media = {
  "WHITE_PAGES/wren/avatar.jpg": { card: "/media/wren-avatar-card.jpg" },
  "WHITE_PAGES/moss/avatar.jpg": { card: "/media/moss-avatar-card.jpg" },
};
const HOUSE_PIC = "https://media.postmark.town/media/fern-house.jpg";
const homePicture = (h) => (h === "fern" ? HOUSE_PIC : null);
const src = { media, homePicture };

// ── 1. a household page ─────────────────────────────────────────────────────

test("a household previews with its first resident's portrait, as a small card", () => {
  assert.deepEqual(householdPreview([withFace("wren"), withFace("moss")], src),
    { image: "/media/wren-avatar-card.jpg", card: SMALL });
});

test("a household whose first resident has no portrait takes the next member's", () => {
  assert.deepEqual(householdPreview([faceless("fern"), withFace("moss")], src),
    { image: "/media/moss-avatar-card.jpg", card: SMALL });
});

test("a household with no portrait at all takes a member's house picture, as a large card", () => {
  assert.deepEqual(householdPreview([faceless("ash"), faceless("fern")], src),
    { image: HOUSE_PIC, card: LARGE });
});

test("a household with no portrait and no house picture falls back to the banner", () => {
  assert.deepEqual(householdPreview([faceless("ash")], src), { image: BANNER, card: LARGE });
  assert.deepEqual(householdPreview([], src), { image: BANNER, card: LARGE });
});

test("a portrait is the household card's own face: an off-door avatar_url is not one", () => {
  assert.equal(portraitOf({ handle: "ash", profile: { avatar_url: "https://evil.example/x.jpg" } }, src), null);
  assert.equal(portraitOf({ handle: "ash", profile: { avatar_url: "https://media.postmark.town/media/ash.jpg" } }, src),
    "https://media.postmark.town/media/ash.jpg");
});

test("a resident's page takes their own portrait before the house's", () => {
  const house = [withFace("wren"), withFace("moss")];
  assert.equal(residentPreview(withFace("moss"), house, src).image, "/media/moss-avatar-card.jpg");
  assert.equal(residentPreview(faceless("ash"), house, src).image, "/media/wren-avatar-card.jpg");
});

test("a thread previews with its opener, then the other correspondent, then the Mail card", () => {
  const byHandle = new Map([withFace("wren"), faceless("ash"), withFace("moss")].map((r) => [r.handle, r]));
  // participants are sorted by name; the opener is the first letter's sender
  assert.deepEqual(openerFirst(["moss", "wren"], "wren"), ["wren", "moss"]);
  assert.deepEqual(openerFirst(["ash", "wren"], undefined), ["ash", "wren"]);
  assert.equal(handlesPreview(openerFirst(["moss", "wren"], "wren"), byHandle, sectionCard("mail"), src).image,
    "/media/wren-avatar-card.jpg");
  assert.equal(handlesPreview(["ash", "moss"], byHandle, sectionCard("mail"), src).image, "/media/moss-avatar-card.jpg");
  assert.deepEqual(handlesPreview(["ash", "gone"], byHandle, sectionCard("mail"), src),
    { image: SECTION_CARDS.mail, card: LARGE });
});

// ── 2. a section page ───────────────────────────────────────────────────────

test("a section page previews with its section's card, by its active key", () => {
  assert.equal(sectionCard("mail"), SECTION_CARDS.mail);
  assert.equal(sectionCard("calendar"), SECTION_CARDS.calendar);
  // a page with no entry of its own takes its section's: the numbers are Docs,
  // the meeps stand in The Town
  assert.equal(sectionCard("numbers"), SECTION_CARDS.docs);
  assert.equal(sectionCard("meeps"), SECTION_CARDS.town);
});

test("every seat on the rail has a card, so a new section can't preview with nothing", () => {
  for (const s of RAIL) assert.ok(Object.hasOwn(SECTION_CARDS, s.key), `no card for the "${s.key}" seat`);
  for (const k of ["bulletin", "calendar", "fund", "harbor", "docs", "mail", "world"])
    assert.ok(Object.hasOwn(SECTION_CARDS, k), `the ruling names "${k}"`);
});

test("every section card is the banner until one is drawn (G3: never generated)", () => {
  for (const [k, v] of Object.entries(SECTION_CARDS)) assert.equal(v, BANNER, k);
});

// ── 3. the fallback ─────────────────────────────────────────────────────────

test("a page with no picture of its own and no section previews with the banner", () => {
  assert.equal(sectionCard(""), BANNER);
  assert.equal(sectionCard(undefined), BANNER);
  assert.equal(sectionCard("no-such-page"), BANNER);
});

// ── 4. the pages hand it to the layout ──────────────────────────────────────

test("the layout falls back to the page's section card, and passes the card's shape", () => {
  const layout = read("../src/layouts/PostmarkLayout.astro");
  assert.match(layout, /image=\{image \?\? sectionCard\(active\)\} card=\{card\}/);
  assert.doesNotMatch(layout, /image = "\/banner\.png"/);
  assert.match(read("../src/layouts/BaseLayout.astro"), /<meta name="twitter:card" content=\{card\} \/>/);
});

test("each page with a picture of its own passes it", () => {
  const pages = {
    "households/[slug].astro": "householdPreview(",
    "residents/[handle].astro": "residentPreview(",
    "residents/[handle]/view/[rendition].astro": "residentPreview(",
    "mail/[thread].astro": "handlesPreview(",
    "mail/[thread]/older/[part].astro": "handlesPreview(",
    "mail/with/[pair].astro": "handlesPreview(",
    "mail/with/[pair]/older/[part].astro": "handlesPreview(",
    "calendar/[host]/[slug].astro": "handlesPreview(",
  };
  for (const [page, pick] of Object.entries(pages)) {
    const text = read(`../town/pages/${page}`);
    assert.ok(text.includes(pick), `${page} picks with ${pick}`);
    assert.match(text, /image=\{preview\.image\}\s+card=\{preview\.card\}/, `${page} hands the pick to the layout`);
  }
  for (const page of ["fund/index.astro", "fund/[pot].astro"])
    assert.match(read(`../town/pages/${page}`), /image=\{sectionCard\("fund"\)\}/, page);
  assert.match(read("../town/pages/harbor/index.astro"), /image=\{sectionCard\("harbor"\)\}/);
});

test("/world, which emits its own document, carries the share tags", () => {
  const world = read("../town/pages/world.astro");
  for (const tag of ['property="og:image"', 'name="twitter:image"', 'name="twitter:card"', 'property="og:title"'])
    assert.ok(world.includes(tag), tag);
  assert.match(world, /sectionCard\("world"\)/);
});
