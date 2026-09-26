// replay-settlements.test.mjs — the Record's settlements, living in the replay
// (the Site Lift, POS-255, 2026-09-26): "each settlement is a marked moment on
// the replay's timeline, and choosing one shows what it changed in the world
// (marks locked, refused, retired, by whom)".
//
//   node --test test/replay-settlements.test.mjs
//
// What it changed is the world's own record: WORLD/settlement-publications.json
// diffed from one settlement tag to the next. Refusals are not in that record;
// they are in the Worldkeeper's receipt, which the card prints as text.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { crossingRows, settlementsOnReplay, placerOf } from "../src/lib/record.mjs";
import { fetchCrossings, publicationChanges } from "../tools/lib/fetch-town-data.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = (f) => JSON.parse(readFileSync(join(ROOT, "src", "data", "postmark", f), "utf8"));
const DIST = join(ROOT, "dist-town");

// ── WHAT A SETTLEMENT CHANGED ───────────────────────────────────────────────

test("publicationChanges: in this tag and not the last is locked; in the last and not this is retired", () => {
  const before = { "mari/first-night-garland": { household: "keeminlee" }, "vireo/understory": { household: "mcd" } };
  const now = { "vireo/understory": { household: "mcd" }, "neth/warm-stone": { household: "xf3s" }, "kogane/the-waiting-room-washstand": { household: "noprotocol-keith" } };
  assert.deepEqual(publicationChanges(before, now), {
    locked: [
      { id: "kogane/the-waiting-room-washstand", household: "noprotocol-keith" },
      { id: "neth/warm-stone", household: "xf3s" },
    ],
    retired: [{ id: "mari/first-night-garland", household: "keeminlee" }],
  });
  assert.deepEqual(publicationChanges(now, now), { locked: [], retired: [] });
});

test("fetchCrossings diffs each new tag against the one before it, and reuses a kept tag's lists", async () => {
  const US = "\u001f", RS = "\u001e";
  const out = [
    ["settlement/S3", "ccc", "2026-09-25T18:00:00Z", "", "S3"].join(US) + RS,
    ["settlement/S2", "bbb", "2026-09-25T06:00:00Z", "", "S2"].join(US) + RS,
    ["settlement/S1", "aaa", "2026-09-24T18:00:00Z", "", "S1"].join(US) + RS,
  ].join("\n");
  const files = {
    "settlement/S2": { a: { household: "h1" }, b: { household: "h2" } },
    "settlement/S3": { b: { household: "h2" }, c: { household: "h3" } },
  };
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    const tag = /postmark-world\/(settlement\/S\d+)\//.exec(url)[1];
    return files[tag] ? { ok: true, json: async () => ({ published: files[tag] }) } : { ok: false };
  };
  const git = (args) => (args[0] === "for-each-ref" ? out : "");
  const previous = { crossings: [{ n: 2, sha: "bbb", published_total: 2, locked: [{ id: "kept" }], retired: [] }] };
  const r = await fetchCrossings({ fetchImpl, git, previous });
  const by = new Map(r.crossings.map((c) => [c.n, c]));
  assert.deepEqual(by.get(3).locked, [{ id: "c", household: "h3" }]);
  assert.deepEqual(by.get(3).retired, [{ id: "a", household: "h1" }]);
  assert.deepEqual(by.get(2).locked, [{ id: "kept" }], "a kept tag's lists were not reused");
  assert.equal(by.get(1).locked, null, "the first tag has nothing before it to diff against");
  assert.equal(by.get(1).retired, null);
  assert.equal(by.get(1).published_total, null, "S1's file is missing, so its count is not recorded");
  assert.equal(calls.filter((u) => u.includes("settlement/S2/")).length, 1, "a tag's file is read once, for itself and its successor");
});

test("crossingRows carries the lists with who placed each mark, and keeps 'not recorded' as null", () => {
  const rows = crossingRows({ crossings: [
    { n: 2, blessed_at: "2026-09-25T06:00:00Z", receipt: "", published_total: 2,
      locked: [{ id: "neth/warm-stone", household: "xf3s" }, { id: "kogane/the-washstand", household: "k" }], retired: [] },
    { n: 1, blessed_at: "2026-09-24T18:00:00Z", receipt: "", published_total: null },
  ] });
  assert.deepEqual(rows[0].locked, [{ id: "kogane/the-washstand", who: "kogane" }, { id: "neth/warm-stone", who: "neth" }]);
  assert.deepEqual(rows[0].retired, []);
  assert.equal(rows[1].locked, null);
  assert.equal(rows[1].retired, null);
  assert.equal(placerOf("stella-letta/the-lamp"), "stella-letta");
});

// ── ON THE REPLAY'S CLOCK ───────────────────────────────────────────────────

test("settlementsOnReplay puts each blessing in the crossing that holds it, and says why when none does", () => {
  const replay = [
    { n: 118, from: "2026-08-10T00:00:00.000Z", to: "2026-08-10T12:00:00.000Z", complete: true },
    { n: 119, from: "2026-08-10T12:00:00.000Z", to: "2026-08-11T00:00:00.000Z", complete: true },
    { n: 121, from: "2026-08-11T12:00:00.000Z", to: "2026-08-11T14:00:00.000Z", complete: false },
  ];
  const data = { crossings: [
    { n: 1, blessed_at: "2026-08-01T06:00:00Z" },          // before the record
    { n: 2, blessed_at: "2026-08-10T06:00:00Z" },          // inside 118
    { n: 3, blessed_at: "2026-08-10T08:00:00-04:00" },     // 12:00Z: the first instant of 119
    { n: 4, blessed_at: "2026-08-11T06:00:00Z" },          // 120 was never recorded
    { n: 5, blessed_at: "2026-08-11T18:00:00Z" },          // past 121's last moment, but 121 is still open
    { n: 6, blessed_at: "nope" },
  ] };
  const by = new Map(settlementsOnReplay(data, replay).map((s) => [s.n, s]));
  assert.deepEqual([by.get(1).crossing, by.get(1).where], [null, "before"]);
  assert.deepEqual([by.get(2).crossing, by.get(2).where], [118, null]);
  assert.equal(by.get(2).at, Date.parse("2026-08-10T06:00:00Z"));
  assert.equal(by.get(3).crossing, 119, "a blessing on a boundary belongs to the crossing it opens");
  assert.deepEqual([by.get(4).crossing, by.get(4).where], [null, "between"]);
  assert.equal(by.get(5).crossing, 121, "the open crossing takes a blessing past its last written moment");
  assert.deepEqual([by.get(6).crossing, by.get(6).where], [null, "unknown"]);
  const closed = settlementsOnReplay(data, replay.map((c) => ({ ...c, complete: true })));
  assert.equal(closed.find((s) => s.n === 5).where, "after");
});

test("on the committed snapshot: S81 locked the washstand and the warm stone and retired the garland", () => {
  const s81 = crossingRows(DATA("crossings.json")).find((r) => r.n === 81);
  assert.deepEqual(s81.locked.map((m) => m.id), ["kogane/the-waiting-room-washstand", "neth/warm-stone"]);
  assert.deepEqual(s81.retired, [{ id: "mari/first-night-garland", who: "mari" }]);
});

// ── THE BUILT PAGE (skipped until built, as POS-177 rules) ───────────────────

const page = join(DIST, "replay", "index.html");
const built = existsSync(page);

test("the built replay lists every settlement once, each placed on its crossing", { skip: !built }, () => {
  const html = readFileSync(page, "utf8");
  const snapshot = DATA("crossings.json").crossings.map((c) => c.n).sort((a, b) => b - a);
  const rows = [...html.matchAll(/<li\b[^>]*\bid="S(\d+)"[^>]*\bdata-settlement="(\d+)"[^>]*\bdata-crossing(?:="(\d*)")?/g)];
  assert.deepEqual(rows.map((m) => Number(m[1])), snapshot, "every settlement, newest first, once");
  for (const m of rows) assert.equal(m[1], m[2]);
  // an empty attribute is written bare, so a settlement off the record reads undefined
  for (const m of rows) m[3] = m[3] ?? "";
  assert.ok(rows.some((m) => m[3] !== ""), "no settlement was placed on a crossing");
  assert.ok(rows.some((m) => m[3] === ""), "the settlements before the record went missing");
  assert.match(html, /data-settled-body/, "the panel beside the map is gone");
});

test("the built S81 card says what it changed, by whom, and the receipt", { skip: !built }, () => {
  const html = readFileSync(page, "utf8");
  const at = html.indexOf('id="S81"');
  const card = html.slice(at, html.indexOf('id="S80"', at));
  assert.match(card, /the waiting room washstand/);
  assert.match(card, /href="\/residents\/kogane\/"/);
  assert.match(card, /class="r-set-change is-retired"[\s\S]*first night garland/);
  assert.match(card, /Nothing held\./, "the Worldkeeper's receipt is not on the card");
});

test("the built settlements hide nothing behind a hover or a 'more' (POS-250)", { skip: !built }, () => {
  const html = readFileSync(page, "utf8");
  const section = html.slice(html.indexOf('class="r-settlements"'), html.indexOf('class="r-foot"'));
  assert.ok(section.length > 1000, "the settlements section was not found");
  assert.doesNotMatch(section, /\btitle="/);
  assert.doesNotMatch(section, /<details\b|pm-more/);
});
