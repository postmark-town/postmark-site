// last-active.test.mjs — the site prints when a resident last did something in town (POS-481).
//
//   node --test test/last-active.test.mjs
//
// The office says it on each resident card (`last_active`, a UTC ISO string,
// the resident's newest act of their own, and `last_active_crossing`). The
// build carries the two into residents.json only when the office said them
// (fetch-town-data.mjs § lastActiveFields), and the pages print plain words:
// "active Oct 6 · crossing 236", "no acts yet", or nothing when the
// office did not say.
//
// Falsifier (POS-481): point lastActiveFields at the wrong field (the card's
// `joined`, say) and "a card the office said carries both fields" goes red.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { lastActiveFields, mapResident } from "../tools/lib/fetch-town-data.mjs";
import { activeWords, dayWords, houseLastActive, lastActiveOf, residentActiveWords } from "../src/lib/last-active.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const NOW = Date.parse("2026-10-09T13:00:00Z");

// a card as GET /residents/{h} answers it since POS-481 (only the fields this reads)
const card = (handle, extra = {}) => ({ handle, address: { data: { joined: "2026-07-01" } }, outbox: [], ...extra });

test("a card the office said carries both fields into residents.json", () => {
  const said = card("limen", { last_active: "2026-10-06T08:00:00.000Z", last_active_crossing: 236 });
  assert.deepEqual(lastActiveFields(said), { last_active: "2026-10-06T08:00:00.000Z", last_active_crossing: 236 });
  const row = mapResident(said, [], null, {});
  assert.equal(row.last_active, "2026-10-06T08:00:00.000Z");
  assert.equal(row.last_active_crossing, 236);
});

test("a resident with no act is said as null; an office that did not say carries nothing", () => {
  assert.deepEqual(lastActiveFields(card("quiet", { last_active: null, last_active_crossing: null })), { last_active: null, last_active_crossing: null });
  // before POS-481 `last_active` meant the newest commit; with no crossing key it is not carried
  assert.deepEqual(lastActiveFields(card("old", { last_active: "2026-07-12T09:00:00.000Z" })), {});
  // the office's store could not be read: not said, never "no acts yet"
  assert.deepEqual(lastActiveFields(card("cut", { last_active: null, last_active_crossing: null, last_active_unavailable: "could not be read" })), {});
  const row = mapResident(card("old", { last_active: "2026-07-12T09:00:00.000Z" }), [], null, {});
  assert.equal("last_active" in row, false);
});

test("the words: active on a day with its crossing, no acts yet, or nothing", () => {
  assert.equal(residentActiveWords({ last_active: "2026-10-06T08:00:00.000Z", last_active_crossing: 236 }, NOW), "active Oct 6 · crossing 236");
  // 01:00Z on Oct 9 is 21:00 EDT on Oct 8: the town's own day
  assert.equal(residentActiveWords({ last_active: "2026-10-09T01:00:00.000Z", last_active_crossing: 238 }, NOW), "active Oct 8 · crossing 238");
  assert.equal(residentActiveWords({ last_active: null, last_active_crossing: null }, NOW), "no acts yet");
  assert.equal(residentActiveWords({ handle: "old" }, NOW), null);
  assert.equal(lastActiveOf({ handle: "old" }), undefined);
});

test("the day: Eastern, never relative, the year only when it is not the build's", () => {
  assert.equal(dayWords("2026-10-09T03:59:00Z", NOW), "Oct 8", "23:59 EDT is still the 8th");
  assert.equal(dayWords("2026-10-09T04:00:00Z", NOW), "Oct 9");
  assert.equal(dayWords("2026-12-01T05:30:00Z", NOW), "Dec 1", "EST after Nov 1: 00:30 EST");
  assert.equal(dayWords("2025-10-01T12:00:00Z", NOW), "Oct 1, 2025");
  // the same act reads the same words however long the page stands
  assert.equal(dayWords("2026-10-06T08:00:00Z", NOW), dayWords("2026-10-06T08:00:00Z", NOW + 30 * 24 * 3600 * 1000));
});

test("a house reads the latest across its residents", () => {
  const a = { last_active: "2026-09-01T00:00:00.000Z", last_active_crossing: 162 };
  const b = { last_active: "2026-10-06T08:00:00.000Z", last_active_crossing: 236 };
  const none = { last_active: null, last_active_crossing: null };
  assert.deepEqual(houseLastActive([a, none, b]), { at: "2026-10-06T08:00:00.000Z", crossing: 236 });
  assert.equal(activeWords(houseLastActive([a, b]), NOW), "active Oct 6 · crossing 236");
  assert.equal(houseLastActive([none, none]), null, "every resident said, none acted");
  assert.equal(houseLastActive([none, { handle: "old" }]), undefined, "one not said: the house is not said either");
  assert.deepEqual(houseLastActive([{ handle: "old" }, a]), { at: a.last_active, crossing: 162 }, "an act anywhere in the house is said");
});

test("the card, the directory's house line and the resident's tab print the words", () => {
  const src = (p) => readFileSync(join(ROOT, p), "utf8");
  const cardSrc = src("src/components/ResidentCard.astro");
  assert.match(cardSrc, /residentActiveWords\(r\)/);
  assert.match(cardSrc, /data-res-active/);
  const dir = src("town/pages/households/index.astro");
  assert.match(dir, /activeWords\(houseLastActive\(h\.members\)\)/);
  assert.match(dir, /data-house-active/);
  const tab = src("town/components/Household.astro");
  assert.match(tab, /residentActiveWords\(t\.r\)/);
  assert.match(tab, /data-profile-active/);
});
