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
  sparkStillOf, sparkPreview,
} from "../src/lib/og-image.mjs";
import { pictureOf } from "../src/lib/calendar.mjs";
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
    "events/[host]/[slug].astro": "handlesPreview(",     // CORE-82: the event page moved from calendar/[host]/[slug].astro
    "sparks/[...id].astro": "sparkPreview(",              // CORE-190: a Spark's page previews with its own picture
  };
  // until 2026-11-17 (POS-1085) the four mail pages picked in their own text; they build their
  // share card in src/lib/mail-routes.mjs now and the page only hands it on (its prop)
  const inRoutes = new Set(["mail/[thread].astro", "mail/[thread]/older/[part].astro", "mail/with/[pair].astro", "mail/with/[pair]/older/[part].astro"]);
  // Each mail page's pick is pinned on its OWN route builder, not on "somewhere in the file": the builder
  // must make the card from the right handles and put it in that page's props.
  const routes = read("../src/lib/mail-routes.mjs");
  const slice = (name) => routes.slice(routes.indexOf(`function ${name}(`)).split(/\n(?:export )?function /)[0];
  const builderOf = {
    "mail/[thread].astro": ["threadsBook", "handlesPreview(openerFirst(thread.participants, opener)", "threadPagePaths"],
    "mail/[thread]/older/[part].astro": ["threadsBook", "handlesPreview(openerFirst(thread.participants, opener)", "threadOlderPagePaths"],
    "mail/with/[pair].astro": ["pairsBook", "handlesPreview([a, b]", "pairPagePaths"],
    "mail/with/[pair]/older/[part].astro": ["pairsBook", "handlesPreview([a, b]", "pairOlderPagePaths"],
  };
  for (const [page, [book, call, paths]] of Object.entries(builderOf)) {
    assert.ok(slice(book).includes(call), `${page}: ${book}() does not pick with ${call}`);
    assert.match(slice(paths), /\bpreview\b/, `${page}: ${paths}() does not put the pick in the page's props`);
  }
  for (const [page, pick] of Object.entries(pages)) {
    const text = read(`../town/pages/${page}`);
    assert.ok((inRoutes.has(page) ? routes : text).includes(pick), `${page} picks with ${pick}`);
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

// ── 5. a Spark's own page (CORE-190) ─────────────────────────────────────────
//
// Darko, 2026-11-25: the filed Spark page carries its picture, but og:image and twitter:image were the town banner. A Spark's page passes the picture its own card draws
// (calendar.mjs pictureOf), as a large card, into the one `image` the layout writes to BOTH tags; with no usable still it keeps the Sparks section's card.

// The filed Spark's picture, the shape the office serves it (a bare https address) and the object form pictureOf also reads. INVENTED ids; the media address is the public one the filing names.
const FILED_PIC = "https://media.postmark.town/media/harpylandfall/6ebfda9f2bfb16e4416a067b1ce9aef91215502e8df03d14cb28a9eef3b9eeca.jpg";
// a Spark as the office serves it, and what the page hands the preview: the SAME pictureOf its card uses
const spark = (picture) => ({ id: "landfall/low-tide-a-bird-folds-and-the-beach-hands-it-back", body: "Low tide", picture });
const prev = (picture) => sparkPreview(pictureOf(spark(picture)));
const still = (picture) => sparkStillOf(pictureOf(spark(picture)));

test("a pictured Spark previews with its own picture, as a large card", () => {
  assert.deepEqual(prev(FILED_PIC), { image: FILED_PIC, card: LARGE });
  assert.deepEqual(prev({ url: FILED_PIC, alt: "a bird" }), { image: FILED_PIC, card: LARGE }, "the {url, alt} form");
  assert.deepEqual(prev({ src: "/media/x/y.png" }), { image: "/media/x/y.png", card: LARGE }, "a site path is kept for the layout to resolve against the site's origin");
  // CONTROL: the pictured result is not the banner
  assert.notEqual(prev(FILED_PIC).image, BANNER);
});

test("a Spark with no usable still falls back to the Sparks section's card, still a large card", () => {
  const fallback = { image: SECTION_CARDS.sparks, card: LARGE };
  assert.equal(SECTION_CARDS.sparks, BANNER, "CONTROL: the Sparks card is the banner until one is drawn");
  for (const [what, p] of [
    ["no picture", undefined], ["null", null], ["empty string", ""], ["blank", "   "],
    ["a protocol-relative address", "//evil.example/x.jpg"], ["a plain http address", "http://media.postmark.town/x.jpg"],
    ["a javascript: address", "javascript:alert(1)"], ["a data: address", "data:image/png;base64,AAAA"], ["a bare relative path", "media/x.jpg"],
    ["a number", 7], ["an empty object", {}], ["an object with no address", { alt: "only an alt" }],
  ]) assert.deepEqual(prev(p), fallback, what);
  assert.deepEqual(sparkPreview(null), fallback, "no picture handed in (pictureOf's null)");
  assert.deepEqual(sparkPreview(pictureOf({})), fallback, "a spark with no picture field");
  assert.deepEqual(sparkPreview({ src: 7 }), fallback, "a malformed pick is no still");
});

test("a video address is not a still, and an address with a login is not safe to hand a scraper", () => {
  const fallback = { image: SECTION_CARDS.sparks, card: LARGE };
  for (const v of ["https://media.postmark.town/media/h/clip.mp4", "https://media.postmark.town/media/h/clip.WEBM", "https://media.postmark.town/media/h/clip.mov?x=1", "/media/h/clip.m4v", "https://media.postmark.town/h/stream.m3u8"])
    assert.deepEqual(prev(v), fallback, v);
  assert.deepEqual(prev("https://user:pw@media.postmark.town/x.jpg"), fallback, "credentials in the address");
  assert.equal(still("https://media.postmark.town/media/h/photo.jpg?v=2"),"https://media.postmark.town/media/h/photo.jpg?v=2", "CONTROL: an image with a query is still an image");
  assert.equal(still("https://media.postmark.town/media/h/video-notes.jpg"),"https://media.postmark.town/media/h/video-notes.jpg", "CONTROL: only the file's own extension decides, not a word in its name");
});

test("a Spark's still is the picture its own card draws, not a second rule", () => {
  const card = read("../src/components/SparkCard.astro");
  assert.match(card, /import \{[^}]*\bpictureOf\b[^}]*\} from "@\/lib\/calendar\.mjs"/, "the card's picture is calendar.mjs pictureOf");
  const page = read("../town/pages/sparks/[...id].astro");
  assert.match(page, /import \{[^}]*\bpictureOf\b[^}]*\} from "@\/lib\/calendar\.mjs"/);
  assert.match(page, /const pic = pictureOf\(s\);/, "the page asks that same function once");
  assert.match(page, /const preview = sparkPreview\(pic\);/, "and hands its result to the preview (the page's picture and its share image are one pick)");
  // og-image.mjs takes the result and does not import calendar.mjs: the render proof's build harness copies a fixed list of lib files (tools/pos394-render-proof.mjs), og-image.mjs is
  // on it, calendar.mjs is not, and widening a privacy proof's list is not this change's to do
  assert.doesNotMatch(read("../src/lib/og-image.mjs"), /from "\.\/calendar\.mjs"/);
});

test("the Spark page hands its pick to the layout, and the layout writes the one address to BOTH tags", () => {
  const page = read("../town/pages/sparks/[...id].astro");
  assert.match(page, /const preview = sparkPreview\(pic\);/);
  assert.match(page, /image=\{preview\.image\}\s+card=\{preview\.card\}/);
  const base = read("../src/layouts/BaseLayout.astro");
  assert.match(base, /<meta property="og:image" content=\{ogImage\} \/>/);
  assert.match(base, /<meta name="twitter:image" content=\{ogImage\} \/>/, "twitter:image is the SAME ogImage, so the two cannot disagree");
  assert.match(base, /const ogImage = new URL\(image, Astro\.site\)\.href;/, "a site path is made absolute; an https address stays as it is");
});

test("other pages' previews are unchanged by the Spark's (a resident's face stays a small card, a section keeps its card)", () => {
  assert.deepEqual(residentPreview(withFace("wren"), [withFace("wren")], src), { image: "/media/wren-avatar-card.jpg", card: SMALL });
  assert.deepEqual(handlesPreview(["nobody"], new Map(), sectionCard("calendar"), src), { image: SECTION_CARDS.calendar, card: LARGE });
  assert.equal(sectionCard("sparks"), SECTION_CARDS.sparks);
});
