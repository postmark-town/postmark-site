// world-stamp.test.mjs — the exported world-state says which settlement it is.
//
//   node --test test/world-stamp.test.mjs
//
// postmark#2923, the site half. The world half was STOPPED on 2026-09-18 with
// the seam named: the fold is computed before the blessing and the number is
// read from a tag the keeper pushes after the fold's own commit, so no step in
// the world repo can write this truthfully. The site is where the copy is made.
//
// Every rule below is falsified in BOTH directions, because the failure this
// whole file exists to prevent is a stamp that is CONFIDENT AND WRONG: a build
// that cannot name the settlement must write null and say why, and a build that
// can must never write a number it did not read off the town's own record. A
// test that only proves the happy path cannot tell those two apart.
//
// Nothing here touches the network or a build: the settlements record, the
// installed sha and the environment are all arguments.

import test from "node:test";
import assert from "node:assert/strict";

import {
  sameCommit,
  settlementRows,
  settlementStamp,
  stampedExportText,
  stampNote,
} from "../tools/lib/world-stamp.mjs";

// The office's own answer, trimmed — GET /world/settlements, 2026-09-20.
const RECORD = {
  current: { n: 73, sha: "54a437a72", date: "2026-09-20T05:46:04+00:00" },
  recent: [
    { n: 73, sha: "54a437a72", date: "2026-09-20T05:46:04+00:00" },
    { n: 72, sha: "b7c912dda", date: "2026-09-19T05:46:07+00:00" },
    { n: 71, sha: "1984062fa", date: "2026-09-17T05:46:08+00:00" },
  ],
};
const S73_FULL = "54a437a72c278e5d89b40475512de7958b482812";

// The export's own shape and formatting, as the world package carries it.
const EXPORT = '{\n  "tick": 0,\n  "dials": {\n    "determine_pct": 0.5\n  },\n  "marks": []\n}\n';

// ── the rows ────────────────────────────────────────────────────────────────

test("the record's settlements are newest-first and deduplicated — `current` and `recent` overlap by design", () => {
  const rows = settlementRows(RECORD);
  assert.deepEqual(rows.map((r) => r.n), [73, 72, 71]);
  assert.equal(rows[0].date, "2026-09-20T05:46:04+00:00");
});

test("a row that is not `{ n, sha, date }` is not a settlement — a half-written row must not become a stamp", () => {
  const rows = settlementRows({
    current: { n: 74, sha: "not-a-sha", date: "2026-09-21T05:46:04+00:00" },
    recent: [
      { n: 73, sha: "54a437a72", date: "" },          // no date
      { n: "seventy-two", sha: "b7c912dda", date: "x" }, // no number
      { n: 71, sha: "1984062fa", date: "2026-09-17T05:46:08+00:00" }, // the only good one
    ],
  });
  assert.deepEqual(rows.map((r) => r.n), [71]);
});

test("an abbreviated sha and a full one name the same commit; two different commits never do", () => {
  assert.equal(sameCommit(S73_FULL, "54a437a72"), true);
  assert.equal(sameCommit("54a437a72", S73_FULL), true);
  assert.equal(sameCommit(S73_FULL, "b7c912dda"), false);
  // a prefix relationship is the only thing that counts as agreement
  assert.equal(sameCommit("", S73_FULL), false);
  assert.equal(sameCommit(S73_FULL, "zzz"), false);
});

// ── the strong source: the rebuild lane resolved it ─────────────────────────

test("THE ASK: a build whose pin resolves to S73 stamps S73, with the sha and date read off the town's record", () => {
  const stamp = settlementStamp({ record: RECORD, installedSha: S73_FULL, envSettlement: "73" });
  assert.equal(stamp.settlement, "S73");
  assert.equal(stamp.from, "resolver");
  assert.deepEqual(stamp.as_of, { n: 73, sha: "54a437a72", date: "2026-09-20T05:46:04+00:00" });
  // the whole point of matching the office's field names: a reader can compare
  // the stamp against GET /world/settlements `current` without a mapping
  assert.deepEqual(stamp.as_of, RECORD.current);
  assert.deepEqual(stamp.notes, []);
});

test("the resolver's number wins over the installed commit — a hold pins a commit downstream of its own tag", () => {
  // S72 was blessed at b7c912dda; the floor is pinned two commits past it, so a
  // sha lookup would find nothing and only the ancestry walk knows the answer.
  const stamp = settlementStamp({ record: RECORD, installedSha: "deadbeef1234567", envSettlement: "72" });
  assert.equal(stamp.settlement, "S72");
  assert.equal(stamp.from, "resolver");
  assert.equal(stamp.as_of.n, 72);
  // and the disagreement is SAID rather than averaged
  assert.ok(stamp.notes.some((n) => n.includes("b7c912dda") && n.includes("deadbeef1")),
    `the two commits differ and the stamp must say so: ${JSON.stringify(stamp.notes)}`);
});

test("a resolved settlement the record does not carry keeps its NUMBER and invents no sha or date", () => {
  const stamp = settlementStamp({ record: RECORD, installedSha: S73_FULL, envSettlement: "40" });
  assert.equal(stamp.settlement, "S40");
  assert.equal(stamp.as_of, null);
  assert.ok(stamp.notes.some((n) => n.includes("S40") && n.includes("3 rows")),
    `the absence must name itself and the span it searched: ${JSON.stringify(stamp.notes)}`);
});

test("`S73` and `73` are the same answer — the lane writes the number, a human may write the label", () => {
  assert.equal(settlementStamp({ record: RECORD, envSettlement: "S73" }).settlement, "S73");
  assert.equal(settlementStamp({ record: RECORD, envSettlement: 73 }).settlement, "S73");
});

test("a settlement that is not a number is refused and NAMED — it must not fall through silently", () => {
  const stamp = settlementStamp({ record: RECORD, installedSha: "0000000", envSettlement: "latest" });
  assert.equal(stamp.settlement, null);
  assert.ok(stamp.notes.some((n) => n.includes("latest")),
    `a junk settlement must be quoted back: ${JSON.stringify(stamp.notes)}`);
});

// ── the fallback: is the installed commit itself a blessed one? ─────────────

test("with no resolver, an installed commit that IS a blessed one is named, and says which source answered", () => {
  const stamp = settlementStamp({ record: RECORD, installedSha: S73_FULL, envSettlement: null });
  assert.equal(stamp.settlement, "S73");
  assert.equal(stamp.from, "installed-sha");
  assert.deepEqual(stamp.as_of, RECORD.current);
});

test("with no resolver, an UNBLESSED installed commit stamps null and says so — never the nearest number", () => {
  const stamp = settlementStamp({ record: RECORD, installedSha: "abc1234def5678", envSettlement: null });
  assert.equal(stamp.settlement, null);
  assert.equal(stamp.as_of, null);
  assert.equal(stamp.from, null);
  assert.ok(stamp.notes.some((n) => n.includes("abc1234de")),
    `the unblessed commit must be named: ${JSON.stringify(stamp.notes)}`);
  // THE FAILURE THIS PINS: "close to S73" is not S73. The claim lives in the
  // three fields above and they are null; the note may state the SPAN it
  // searched, which is a search range and not an answer, so this asserts the
  // note's verdict rather than the absence of any digit in it.
  assert.ok(stamp.notes.some((n) => n.includes("is not one of the settlements")),
    `the note must give a verdict, not just a range: ${JSON.stringify(stamp.notes)}`);
});

test("no record at all is an absence with a reason, and the reason names the tool that fills it", () => {
  const stamp = settlementStamp({ record: null, installedSha: S73_FULL, envSettlement: null });
  assert.equal(stamp.settlement, null);
  assert.ok(stamp.notes.some((n) => n.includes("fetch-town.mjs")),
    `an empty record must say how it gets filled: ${JSON.stringify(stamp.notes)}`);
  assert.ok(stampNote(stamp).length > 0);
});

test("no input at all still answers — a stamp is never allowed to throw the build", () => {
  const stamp = settlementStamp();
  assert.equal(stamp.settlement, null);
  assert.equal(stamp.as_of, null);
  assert.ok(stamp.notes.length >= 2, "both absences are named, not just the first");
});

// ── the splice ──────────────────────────────────────────────────────────────

test("THE ASK: the stamp lands FIRST, and the export is still the same JSON it was", () => {
  const stamp = settlementStamp({ record: RECORD, installedSha: S73_FULL, envSettlement: "73" });
  const text = stampedExportText(EXPORT, stamp);
  const after = JSON.parse(text);
  const before = JSON.parse(EXPORT);
  assert.deepEqual(Object.keys(after).slice(0, 2), ["settlement", "as_of"]);
  assert.equal(after.settlement, "S73");
  assert.deepEqual(after.as_of, RECORD.current);
  // every original key survives, with its original value
  for (const key of Object.keys(before)) assert.deepEqual(after[key], before[key]);
  assert.deepEqual(Object.keys(after), ["settlement", "as_of", ...Object.keys(before)]);
});

test("A SPLICE, NOT A RE-SERIALISE — every byte of the original record after the opening brace is untouched", () => {
  const stamp = settlementStamp({ record: RECORD, installedSha: S73_FULL, envSettlement: "73" });
  const text = stampedExportText(EXPORT, stamp);
  // the published export is byte-for-byte the world repo's own file and readers
  // diff it against that; a whitespace-only rewrite of 0.93 MB is a false
  // positive somebody has to chase
  assert.ok(text.endsWith(EXPORT.slice(EXPORT.indexOf("{") + 1)),
    "the record's own text must survive the splice unchanged, to the last byte");
  assert.ok(text.includes('\n  "tick": 0,\n'), "the original formatting is preserved");
});

test("an unstamped build leaves a REASON in the file, not a bare null", () => {
  const stamp = settlementStamp({ record: null, installedSha: null, envSettlement: null });
  const after = JSON.parse(stampedExportText(EXPORT, stamp));
  assert.equal(after.settlement, null);
  assert.equal(after.as_of, null);
  assert.ok(typeof after.settlement_note === "string" && after.settlement_note.length > 0);
  assert.equal(after.tick, 0);
});

test("a NAMED settlement carries no note — the note exists to explain an absence, not to decorate an answer", () => {
  const stamp = settlementStamp({ record: RECORD, installedSha: S73_FULL, envSettlement: "73" });
  const after = JSON.parse(stampedExportText(EXPORT, stamp));
  assert.equal("settlement_note" in after, false);
});

test("CRLF and an object with nothing else in it both splice to valid JSON", () => {
  const stamp = settlementStamp({ record: RECORD, installedSha: S73_FULL, envSettlement: "73" });
  const crlf = stampedExportText('{\r\n  "tick": 0\r\n}\r\n', stamp);
  assert.equal(JSON.parse(crlf).tick, 0);
  assert.equal(JSON.parse(crlf).settlement, "S73");
  assert.ok(crlf.includes("\r\n"), "the record's own line endings are kept");
  const bare = stampedExportText("{}", stamp);
  assert.deepEqual(Object.keys(JSON.parse(bare)), ["settlement", "as_of"]);
});

test("something that is not a JSON object is REFUSED rather than stamped into nonsense", () => {
  const stamp = settlementStamp({ record: RECORD, installedSha: S73_FULL, envSettlement: "73" });
  assert.throws(() => stampedExportText("not json at all", stamp), /refusing to stamp/);
});
