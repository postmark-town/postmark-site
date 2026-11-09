// hearth-fold.test.mjs — what the Hearth's own slots say from what the reads answered (POS-959).
//
// The rule under test is the one the acceptance names: "missing data stays unavailable rather than invented
// zero". A read that did not answer is null here, a partial read says it is partial, and the private mail
// summary is built only from the doorstep fields the dashboard already shows an owner.

import test from "node:test";
import assert from "node:assert/strict";
import { postsOf, marksOf, mailOf, townEventsOf, placesOf, chartOf, countdownOf, leftWords, POSTS_SHOWN } from "../src/lib/hearth/fold.mjs";

const HOUSE = ["a1", "a2"];
const post = (cls, author, id, at, extra = {}) => ({ class: cls, id: `${author}/${id}`, title: id, author, household: "hh:other", state: "posted", latest: { at }, responses: 0, ...extra });

test("postsOf: the house's own, by author or by household key, newest first; another house's are not shown", () => {
  const p = postsOf({
    idea: { total: 3, posts: [post("idea", "a1", "old", "2026-11-01T00:00:00Z"), post("idea", "zed", "theirs", "2026-11-05T00:00:00Z"), post("idea", "zed", "by-household", "2026-11-04T00:00:00Z", { household: "hh:fox" })] },
    bug: { total: 1, posts: [post("bug", "a2", "new", "2026-11-03T00:00:00Z", { state: "reported" })] },
  }, HOUSE, "fox");
  assert.deepEqual(p.rows.map((r) => [r.class, r.id]), [["idea", "zed/by-household"], ["bug", "a2/new"], ["idea", "a1/old"]]);
  assert.equal(p.count, 3);
  assert.deepEqual(p.partial, []);
  assert.deepEqual(p.missing, []);
});

test("postsOf: a class that did not answer is said missing, a cut page is said partial, and no answer at all is null, not an empty list", () => {
  const some = postsOf({ idea: { total: 150, posts: [post("idea", "a1", "x", "2026-11-01T00:00:00Z")] }, bug: null }, HOUSE, "fox");
  assert.deepEqual(some.missing, ["bug"]);
  assert.deepEqual(some.partial, [{ class: "idea", read: 1, total: 150 }]);
  assert.equal(postsOf({ idea: null, bug: null }, HOUSE, "fox"), null);
  assert.equal(postsOf({}, HOUSE, "fox"), null);
  assert.equal(postsOf({ idea: { posts: "nope" }, bug: { posts: [] } }, HOUSE, "fox").rows.length, 0, "an answered class with nothing of the house's is an honest none");
});

test("postsOf: bounded, and a row with no author or a hostile shape is skipped, not drawn", () => {
  const many = { idea: { total: 40, posts: Array.from({ length: 40 }, (_, i) => post("idea", "a1", `p${i}`, `2026-11-01T00:${String(i).padStart(2, "0")}:00Z`)) }, bug: { posts: [null, 3, {}, { author: "a1" }] } };
  const p = postsOf(many, HOUSE, null);
  assert.equal(p.rows.length, POSTS_SHOWN);
  assert.equal(p.count, 41, "the count is the house's, the rows are the newest few");
});

test("marksOf: the dashboard's mark lines only, newest first, bounded", () => {
  const items = [{ kind: "letter", id: "l" }, ...Array.from({ length: 12 }, (_, i) => ({ kind: "mark", id: "m" + i }))];
  assert.equal(marksOf(items).length, POSTS_SHOWN);
  assert.deepEqual(marksOf(items, 2).map((m) => m.id), ["m0", "m1"]);
  assert.deepEqual(marksOf(null), []);
});

test("mailOf: sums what each doorstep says (an owner's), and says when a resident's did not answer", () => {
  const d = (n, extra = {}) => ({ awaiting: { summary: { new_inbound: n }, unplaced_bounces: [] }, stances: { stances_awaiting: 1 }, ...extra });
  const m = mailOf(HOUSE, { a1: d(2, { your_pending_letters: { standing: [{}, {}] } }), a2: d(3, { awaiting: { summary: { new_inbound: 3 }, unplaced_bounces: [{ date: "x" }] } }) });
  assert.deepEqual(m, { newInbound: 5, awaitingStance: 2, waiting: 2, bounced: 1, complete: true });
  assert.equal(mailOf(HOUSE, { a1: d(1) }).complete, false);
  assert.equal(mailOf(HOUSE, {}), null, "no doorstep answered: unavailable, not nothing-new");
  assert.equal(mailOf(HOUSE, { a1: null, a2: undefined }), null);
});

test("townEventsOf: the town's next events from every house, soonest first, cancelled left out; null when the calendar did not answer", () => {
  const cal = { now: [{ id: "h/live", title: "Live", host: "x", phase: "live", starts: "2026-11-08T10:00:00Z" }], coming: [
    { id: "h/later", title: "Later", host: "y", starts: "2026-11-10T10:00:00Z", place: { name: "the-snug-harbour" } },
    { id: "h/cancelled", title: "No", host: "z", starts: "2026-11-09T10:00:00Z", cancelled: true },
    { id: "h/soon", title: "Soon", host: "w", starts: "2026-11-09T10:00:00Z" },
  ] };
  assert.deepEqual(townEventsOf(cal).map((e) => e.id), ["h/live", "h/soon", "h/later"]);
  assert.equal(townEventsOf(cal)[2].place, "the snug harbour");
  assert.equal(townEventsOf(cal, 1).length, 1);
  assert.equal(townEventsOf(null), null);
  assert.deepEqual(townEventsOf({ now: [], coming: [] }), [], "an answered, empty calendar is an honest none");
});

test("placesOf: residents grouped by the place they stand at; one with no place is 'not on the roll', not placed; a silent roll is null", () => {
  const w = { walkers: [
    { handle: "a1", mark_id: "current/the-snug-harbour", moving: false },
    { handle: "a2", mark_id: "current/the-snug-harbour", moving: false },
    { handle: "a3", moving: true, toward: "current/the-long-wharf" },
  ] };
  const places = placesOf(["a1", "a2", "a3", "a4"], w);
  assert.deepEqual(places.map((p) => [p.place, p.who, p.moving]), [
    ["the snug harbour", ["a1", "a2"], false], ["the long wharf", ["a3"], true], [null, ["a4"], false],
  ]);
  assert.equal(placesOf(HOUSE, null), null);
  assert.equal(placesOf(HOUSE, { walkers: "x" }), null);
});

test("chartOf: a bar per resident, scaled to the largest; a resident whose doorstep did not answer has NO number, not a zero; none answered is null", () => {
  const ds = { a1: { stamps: { assets: 50 } }, a2: { stamps: { assets: 100 } }, a3: null };
  const c = chartOf(["a1", "a2", "a3"], ds);
  assert.deepEqual(c.map((r) => [r.handle, r.held, r.share]), [["a1", 50, 0.5], ["a2", 100, 1], ["a3", null, null]]);
  assert.equal(chartOf(["a1"], {}), null);
  assert.equal(chartOf(["a1"], { a1: { stamps: { assets: 0 } } })[0].held, 0, "a counted zero is a zero");
});

test("countdownOf and leftWords: the clocks' two moments, and what is left of them", () => {
  const ds = { a1: { next_crossing: { crossing: 216, at: "2026-11-08T21:00:00Z" }, stakes: { next_settlement: { at: "2026-11-09T00:00:00Z" } } } };
  const c = countdownOf(["a1"], ds);
  assert.equal(c.crossing.n, 216);
  assert.equal(c.crossing.at, Date.parse("2026-11-08T21:00:00Z"));
  assert.equal(c.settlement.at, Date.parse("2026-11-09T00:00:00Z"));
  assert.equal(countdownOf(["a1"], {}), null);
  const t = Date.parse("2026-11-08T20:00:00Z");
  assert.equal(leftWords(t + 59_000, t), "0m 59s");
  assert.equal(leftWords(t + 3 * 60_000 + 5_000, t), "3m 05s");
  assert.equal(leftWords(t + 2 * 3600_000 + 7 * 60_000, t), "2h 07m");
  assert.equal(leftWords(t + 3 * 86400_000 + 5 * 3600_000, t), "3d 5h");
  assert.equal(leftWords(t, t), null, "once it has come there is nothing left to count");
  assert.equal(leftWords(t - 1, t), null);
});
