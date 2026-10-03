// letter-addresses.test.mjs — every letter's own address resolves (POS-320).
//
//   node --test test/letter-addresses.test.mjs
//
// A conversation is one page, at its FIRST letter's id; every later letter is an
// anchor on it (or on older/<k>/). So /mail/<letter-id>/ was a 404 for every
// letter but the first: Keemin found it on 2026-10-02 at
// /mail/seven-verity-2026-09-13-the-side-door/. Two halves, both pinned here:
//   1. every letter id answers: a forwarding page per later letter, to the page
//      that holds it at its anchor (the [...moved] forwarder, the same page the
//      Site Lift's moved URLs use);
//   2. every letter link the site writes comes from one helper, letterHref, so
//      no link depends on the forwarder.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import * as mail from "../src/lib/mail.mjs";
import { threadViews } from "../src/lib/mail-letter.mjs";
import { renderDoorstepMarkdown } from "../tools/lib/doorstep.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = (f) => JSON.parse(readFileSync(join(ROOT, "src", "data", "postmark", f), "utf8"));
const SRC = (...p) => readFileSync(join(ROOT, ...p), "utf8");
const DIST = process.env.SITE_DIST || join(ROOT, "dist-town");
const { letterAddresses, letterHref } = mail;

// ── THE HELPER ──────────────────────────────────────────────────────────────

test("a letter's address is its conversation's page at its anchor; an older letter names its part", () => {
  assert.equal(typeof letterAddresses, "function", "src/lib/mail.mjs has no letterAddresses: the site has no one place a letter link comes from");
  const ids = Array.from({ length: 45 }, (_, i) => `t-${String(i).padStart(2, "0")}`);
  const threads = [{ key: "t-00", letterIds: ids }, { key: "solo", letterIds: ["solo"] }];
  const book = letterAddresses(threads, null, 20);
  // newest 20 (25..44) on the page, 5..24 in part 2, 0..4 in part 3
  assert.equal(letterHref("t-44", book), "/mail/t-00/#t-44");
  assert.equal(letterHref("t-25", book), "/mail/t-00/#t-25");
  assert.equal(letterHref("t-24", book), "/mail/t-00/older/2/#t-24");
  assert.equal(letterHref("t-05", book), "/mail/t-00/older/2/#t-05");
  assert.equal(letterHref("t-04", book), "/mail/t-00/older/3/#t-04");
  assert.equal(letterHref("t-00", book), "/mail/t-00/older/3/#t-00", "the first letter of a long conversation is in its oldest part");
  assert.equal(letterHref("solo", book), "/mail/solo/#solo");
  assert.equal(letterHref("nowhere", book), "/mail/", "a letter in no conversation the site built has no page: the index, never a 404");
});

test("a letter the letters file lacks is dropped before the parts are counted, as threadViews drops it", () => {
  const threads = [{ key: "a", letterIds: ["a", "gone", ...Array.from({ length: 20 }, (_, i) => `b${i}`)] }];
  const letters = threads[0].letterIds.filter((id) => id !== "gone").map((id) => ({ id }));
  const book = letterAddresses(threads, letters, 20);
  assert.equal(book.has("gone"), false);
  assert.equal(letterHref("a", book), "/mail/a/older/2/#a");
  assert.equal(letterHref("b0", book), "/mail/a/#b0");
});

test("on the committed data, every letter's address names the part the page builds it in", () => {
  const threads = DATA("threads.json");
  const letters = DATA("letters.json");
  const book = letterAddresses(threads, letters);
  let checked = 0;
  for (const { thread, parts } of threadViews(threads, letters)) {
    parts.forEach((ls, k) => {
      for (const l of ls) {
        assert.equal(letterHref(l.id, book), `${mail.letterPartHref(k + 1, `/mail/${thread.key}/`)}#${l.id}`, l.id);
        checked++;
      }
    });
  }
  assert.equal(checked, letters.length, "a letter in no conversation");
});

// ── HALF 2: EVERY LINK THE SITE WRITES TO A LETTER COMES FROM THE HELPER ────

test("the mail filter's cards link the letter itself, never `l.thread || l.id`", () => {
  const src = SRC("town", "pages", "mail", "index.astro");
  assert.equal(/l\.thread \|\| l\.id/.test(src), false,
    "a card built from the letter's own id (or its mid-chain `thread`) is a 404 for every letter but a conversation's first");
  assert.match(src, /href="\$\{esc\(letterHref\(l\.id, letterBook\)\)\}"/);
  assert.match(src, /fetch\("\/data\/threads\.json"/, "the cards cannot place a letter without the conversations");
});

test("the homepage ticker links each delivery to the letter, through the helper", () => {
  const src = SRC("town", "pages", "index.astro");
  assert.match(src, /href: letterHref\(d\.id, letterBook\)/);
  assert.equal(/idToThread/.test(src), false, "a second id-to-conversation map beside the helper");
});

test("the doorstep's thread rows take the site's letter address, for every row kind", () => {
  const book = letterAddresses([{ key: "root", letterIds: ["root", "mid", "mid2"] }], null);
  const bundle = {
    handle: "solan",
    site: { doorstep_fetched_at: "2026-10-02" },
    awaiting: {
      threads: [{ thread_of: "mid", last_from: "wren", last_id: "mid", last_date: "2026-10-01", state: "they_spoke_again" }],
      conversations: [{ conversation: "mid", others: ["wren"], attention_state: "last_word_yours", latest_event: { date: "2026-10-01" } }],
      summary: {},
    },
    mail: { letters: [{ id: "late", from: "wren", date: "2026-10-01", thread: "mid2", first_line: "hi" }] },
  };
  const md = renderDoorstepMarkdown(bundle, { townBase: "https://postmark.town", mailHref: (id) => letterHref(id, book) });
  assert.equal(md.includes("https://postmark.town/mail/mid/"), false, "a doorstep row still links a mid-conversation letter's bare id");
  assert.equal(md.split("[thread](https://postmark.town/mail/root/#mid)").length - 1, 2, "the they-spoke-last and your-word-is-out rows");
  assert.ok(md.includes("→ https://postmark.town/mail/root/#mid2"), "the arrived-lately row");
  const tools = SRC("tools", "extract-town.mjs");
  assert.match(tools, /mailHref: \(id\) => letterHref\(id, letterBook\)/, "extract-town renders the doorstep without the site's letter addresses");
});

// ── HALF 1: EVERY LETTER ID ANSWERS (the built site; skipped until built) ───

const built = existsSync(join(DIST, "mail", "index.html"));
const page = (path) => {
  const f = join(DIST, ...path.split("#")[0].split("/").filter(Boolean), "index.html");
  return existsSync(f) ? readFileSync(f, "utf8") : null;
};

test("the forwarder is the Site Lift's one forwarding page, fed by the helper", () => {
  const src = SRC("town", "pages", "[...moved].astro");
  assert.match(src, /import \{ letterAddresses \} from "@\/lib\/mail\.mjs"/, "the letter forwards are not written from the one letter map");
  assert.match(src, /params: \{ moved: `mail\/\$\{id\}` \}/);
  assert.match(src, /filter\(\(\[id, at\]\) => id !== at\.thread\)/, "a first letter's address is the conversation's real page; a forward there would shadow it");
});

test("every letter's own address answers: the conversation's page, or a forward to the letter's anchor", { skip: !built }, () => {
  const threads = DATA("threads.json");
  const book = letterAddresses(threads, DATA("letters.json"));
  let roots = 0, forwards = 0;
  const missing = [], unanchored = [];
  const cache = new Map();
  const target = (href) => {
    const p = href.split("#")[0];
    if (!cache.has(p)) cache.set(p, page(p) ?? "");
    return cache.get(p);
  };
  for (const [id, at] of book) {
    // where every link the site writes now points: a page that holds the letter
    if (!target(at.href).includes(`id="${id}"`)) unanchored.push(id);
    const html = page(`/mail/${id}/`);
    if (!html) { missing.push(id); continue; }
    // a first letter's address is the conversation's own page (its letter may
    // sit in an older part of a long one, which letterHref names)
    if (id === at.thread) { roots++; continue; }
    forwards++;
    assert.ok(html.includes(`<link rel="canonical" href="https://postmark.town${at.href.split("#")[0]}">`), `${id}: canonical`);
    assert.ok(html.includes(`<a href="${at.href}">`), `${id}: no link for a reader without script`);
    assert.ok(html.includes('name="robots" content="noindex"'), `${id}: a forward is not a page to index`);
  }
  assert.deepEqual(missing.slice(0, 5), [], `${missing.length} of ${book.size} letter addresses are 404s`);
  assert.deepEqual(unanchored.slice(0, 5), [], `${unanchored.length} letter links land on a page without the letter`);
  assert.ok(forwards > 0 && roots > 0);
});

test("Keemin's letter: /mail/seven-verity-2026-09-13-the-side-door/ lands on the side-door letter", { skip: !built }, () => {
  const book = letterAddresses(DATA("threads.json"), DATA("letters.json"));
  const id = "seven-verity-2026-09-13-the-side-door";
  if (!book.has(id)) return; // the committed snapshot predates the letter; the fetched data carries it
  const at = book.get(id);
  assert.equal(at.thread, "current-the-reader-2026-09-07-to-seven-verity-a-second-letter-on-the-same-tide-a-hand-from-the-record-and-");
  const fwd = page(`/mail/${id}/`);
  assert.ok(fwd, "the side-door letter's address is a 404");
  assert.equal(at.href, `/mail/${at.thread}/#${id}`);
  assert.ok(fwd.includes(`location.replace(to.includes("#") ? to : to + location.hash)`), "no script forward");
  assert.ok(fwd.includes(JSON.stringify(at.href)), "the script does not forward to the letter's anchor");
  assert.ok(fwd.includes(`<a href="${at.href}">`), "no link for a reader without script");
  assert.ok(new RegExp(`<article class="pm-letter[^"]*" id="${id}"`).test(page(at.href) ?? ""), "the target page does not hold the letter");
});
