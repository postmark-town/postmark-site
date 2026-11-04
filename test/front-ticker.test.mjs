// front-ticker.test.mjs — the front page's ticker shows more of the town
// (POS-855, Site UX D6).
//
//   node --test test/front-ticker.test.mjs
//
// Synthetic only: it reads test/fixtures/front-ticker.sample.json (wholly
// invented) and the page SOURCE, never the town's data. The page builds its
// delivery items by calling tickerDeliveries with its own fmtDate, threadTitle,
// letterHref and letter book; this test calls the same function with the same
// real ones, so the page and the test run the same code.
//
// Falsifiers: take the per-sender cap out of spreadDeliveries (the "cap",
// "order" and "size" tests fail); change one character of the item text
// template, or its title, date, arrow or sender (the "exact" test fails); point
// the page back at an inline slice(0, 8) (the "wiring" test fails).

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import * as ticker from "../src/lib/front-ticker.mjs";
import { fmtDate, threadTitle } from "../src/lib/pm.mjs";
import { letterAddresses, letterHref } from "../src/lib/mail.mjs";

const { spreadDeliveries, tickerDeliveries } = ticker;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FIX = JSON.parse(readFileSync(join(ROOT, "test", "fixtures", "front-ticker.sample.json"), "utf8"));
const PAGE = readFileSync(join(ROOT, "town", "pages", "index.astro"), "utf8");
const book = letterAddresses(FIX.threads, null);
const deps = { letterHref, fmtDate, threadTitle, book };

test("cap: no sender fills more than 2 of the 8 slots", () => {
  const picked = spreadDeliveries(FIX.latestDeliveries);
  const per = {};
  for (const d of picked) per[d.from] = (per[d.from] ?? 0) + 1;
  assert.ok(Math.max(...Object.values(per)) <= 2, JSON.stringify(per));
  // four senders in the fixture, so 2 + 2 + 2 + 1 = 7 is the most the cap allows
  assert.deepEqual(per, { "marrow-lark": 2, "tansy-fen": 2, ferrule: 2, "oxbow-nine": 1 });
  assert.equal(picked.length, 7);
});

test("order: newest first is kept, and a dominant sender keeps its newest two", () => {
  assert.deepEqual(spreadDeliveries(FIX.latestDeliveries).map((d) => d.id), [
    "marrow-lark-2026-10-30-kettle-and-compass-inventory",
    "marrow-lark-2026-10-30-plan-s-for-the-tin-bridge",
    "tansy-fen-2026-10-28-toll-schedule-for-the-tin-bridge",
    "ferrule-2026-10-27-kiln-d-notes",
    "ferrule-2026-10-27-a-plain-title-with-no-marks",
    "oxbow-nine-2026-10-26-pigeon-roster-for-the-week",
    "tansy-fen-2026-10-25-second-from-tansy",
  ]);
});

test("size: never more than 8, and the cap and size are parameters", () => {
  const many = Array.from({ length: 30 }, (_, i) => ({ id: `s${i}-x`, from: `s${i}`, date: "2026-10-01" }));
  assert.equal(spreadDeliveries(many).length, 8);
  assert.equal(spreadDeliveries(FIX.latestDeliveries, { perSender: 1 }).length, 4);
  assert.equal(spreadDeliveries(FIX.latestDeliveries, { size: 3 }).length, 3);
  assert.deepEqual(spreadDeliveries(null), []);
  assert.deepEqual(spreadDeliveries([]), []);
});

test("exact: each item's text is the base page's formula, character for character, and its href is the letter's address", () => {
  const items = tickerDeliveries(FIX.latestDeliveries, deps);
  const picked = spreadDeliveries(FIX.latestDeliveries);
  assert.equal(items.length, picked.length);
  items.forEach((it, i) => {
    const d = picked[i];
    // the base page's own template, with the real fmtDate and threadTitle
    assert.equal(it.text, `${fmtDate(d.date)} · ${d.from} → ${d.to} — “${threadTitle(d.id)}”`, d.id);
    assert.equal(it.href, letterHref(d.id, book), d.id);
    assert.deepEqual(Object.keys(it).sort(), ["href", "text"]);
  });
});

test("exact: spelled out for the lone-letter slugs, and for a letter inside a conversation and one outside", () => {
  const items = tickerDeliveries(FIX.latestDeliveries, deps);
  const byText = new Map(items.map((it) => [it.text, it.href]));
  assert.equal(
    byText.get("October 30, 2026 · marrow-lark → oxbow-nine — “plan s for the tin bridge”"),
    "/mail/tansy-fen-2026-10-25-third-from-tansy/#marrow-lark-2026-10-30-plan-s-for-the-tin-bridge",
  );
  assert.equal(byText.get("October 27, 2026 · ferrule → marrow-lark — “kiln d notes”"), "/mail/ferrule-2026-10-26-third-from-ferrule/#ferrule-2026-10-27-kiln-d-notes");
  assert.equal(byText.get("October 30, 2026 · marrow-lark → tansy-fen — “kettle and compass inventory”"), "/mail/", "a letter in no conversation: the index, never a 404");
});

test("exact: the items use the functions they are handed, not copies", () => {
  const items = tickerDeliveries(FIX.latestDeliveries.slice(0, 1), {
    letterHref: () => "HREF",
    fmtDate: () => "DATE",
    threadTitle: () => "TITLE",
    book,
  });
  assert.deepEqual(items, [{ href: "HREF", text: "DATE · marrow-lark → tansy-fen — “TITLE”" }]);
});

test("the ticker module offers the selector and the item builder, and no title helper", () => {
  assert.deepEqual(Object.keys(ticker).sort(), ["spreadDeliveries", "tickerDeliveries"]);
  assert.doesNotMatch(PAGE, /restoreApostrophes|deliveryTitle/);
});

test("wiring: the page calls tickerDeliveries with its real helpers, and keeps arrivals and the all-deliveries link", () => {
  assert.match(PAGE, /\.\.\.tickerDeliveries\(stats\.latestDeliveries, \{ letterHref, fmtDate, threadTitle, book: letterBook \}\)/);
  assert.match(PAGE, /import \{ fmtDate, threadTitle, [^}]*\} from "@\/lib\/pm\.mjs"/);
  assert.match(PAGE, /import \{ letterAddresses, letterHref \} from "@\/lib\/mail\.mjs"/);
  assert.doesNotMatch(PAGE, /latestDeliveries\.slice\(0, 8\)/);
  assert.match(PAGE, /stats\.arrivals\.slice\(0, 3\)/);
  assert.match(PAGE, /all \{stats\.deliveries\} deliveries →/);
});
