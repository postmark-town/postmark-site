// conversations-show-earlier.test.mjs — the conversations page's SHOW EARLIER (POS-779).
//
// The page holds ONE page of finished conversations at a time; "Show earlier" asks the office for the page behind it by the cursor the
// office handed back (`earlier.before`) and REPLACES the page held. The rules are in the page's own inline script, so this suite
// reads that block out of the page (the way conversations-face.test.mjs reads the avatar guard) and runs THAT text, against a fake
// office that pages the way the office's `/world/conversations?before=&closed=` does. The cards on the page are the page held, one per
// thread (`paint` builds one `threadNode` per element), so the held page's length is the mounted card count.
//
// It is a unit test of the state machine. The page in a real browser against a real office is the separate evidence in the PR.
//
//   node --test test/conversations-show-earlier.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../town/pages/conversations/index.astro", import.meta.url), "utf8");
const a = page.indexOf("// SHOW-EARLIER:BEGIN");
const b = page.indexOf("// SHOW-EARLIER:END");
assert.ok(a > -1 && b > a, "the page still carries its SHOW-EARLIER block");
const block = page.slice(a, b);

const API = "/api/world/conversations";
const PAGE = 20;

/** An office with `n` finished conversations, newest first, that answers the page's asks in the door's own shape. */
function office(n, { source = "record" } = {}) {
  const all = Array.from({ length: n }, (_, i) => ({ id: `t${n - i}`, latest: new Date(Date.UTC(2026, 10, 1) + (n - i) * 3600_000).toISOString(), voice_count: 3 }));
  const asked = [];
  const answer = (url) => {
    asked.push(url);
    const u = new URL("http://x" + url);
    const before = u.searchParams.get("before");
    const older = before ? all.filter((t) => Date.parse(t.latest) < Date.parse(before)) : all;
    const closed = older.slice(0, Number(u.searchParams.get("closed")));
    const remaining = older.length - closed.length;
    return { closed, live: [], earlier: { source, remaining, before: closed.length ? closed[closed.length - 1].latest : null } };
  };
  return { all, asked, answer };
}

/** The page's block over a fetch the test drives; `redraw` counts and records the mounted card count each time. */
function rig(off, { fail = false } = {}) {
  const log = { redraws: [], held: 0 };
  const fetchStub = (url) => new Promise((ok, no) => {
    if (fail) return no(new Error("down"));
    const body = off.answer(url); // asked is recorded when the page asks, not when it reads the answer
    ok({ ok: true, json: () => Promise.resolve(body) });
  });
  const make = new Function("API", "fetch", "redraw", `${block}
    return { get closedList() { return closedList; }, get earlierInfo() { return earlierInfo; }, get cursor() { return cursor; }, get trail() { return trail; },
             get pageNote() { return pageNote; }, get pageBusy() { return pageBusy; }, pageUrl, holdNewest, showEarlier, showNewer, CLOSED_PAGE };`);
  const state = make(API, fetchStub, () => { log.redraws.push(state.closedList.length); });
  return { state, log };
}
const flush = () => new Promise((r) => setTimeout(r, 0));
const ids = (list) => list.map((t) => t.id);

test("the poll holds the newest page; the page asks for a page of 20", () => {
  const off = office(45);
  const { state } = rig(off);
  assert.equal(state.CLOSED_PAGE, PAGE);
  assert.equal(state.pageUrl(null), `${API}?closed=20`);
  assert.equal(state.holdNewest(off.answer(state.pageUrl(null))), true);
  assert.equal(state.closedList.length, PAGE);
  assert.equal(state.closedList[0].id, "t45", "newest first");
  assert.equal(state.earlierInfo.remaining, 25);
});

test("show earlier reaches a thread the first response does not hold, and REPLACES the page (the card count stays within one page)", async () => {
  const off = office(45);
  const { state, log } = rig(off);
  state.holdNewest(off.answer(state.pageUrl(null)));
  const first = new Set(ids(state.closedList));
  assert.ok(!first.has("t10"), "t10 is not in the first response");
  state.showEarlier();
  await flush();
  const asked = new URL("http://x" + off.asked.at(-1));
  assert.equal(asked.searchParams.get("before"), state.trail.length ? off.all[PAGE - 1].latest : null, "asked behind the first page's last thread");
  assert.equal(asked.searchParams.get("closed"), "20");
  assert.equal(state.closedList.length, PAGE, "the second page replaced the first: 20 cards, not 40");
  assert.ok(ids(state.closedList).every((id) => !first.has(id)), "none of the first page is still mounted");
  state.showEarlier();
  await flush();
  assert.ok(ids(state.closedList).includes("t1"), "the oldest thread of the record is reachable");
  assert.ok(Math.max(...log.redraws) <= PAGE, `the page never held more than one page of threads: ${Math.max(...log.redraws)}`);
});

test("walking the whole record: every thread once, none missed, never more than a page mounted; newer walks back", async () => {
  const off = office(45);
  const { state, log } = rig(off);
  state.holdNewest(off.answer(state.pageUrl(null)));
  const seen = [...ids(state.closedList)];
  for (let hops = 0; state.earlierInfo.remaining > 0 && hops < 10; hops++) { state.showEarlier(); await flush(); seen.push(...ids(state.closedList)); }
  assert.deepEqual([...seen].sort(), off.all.map((t) => t.id).sort(), "every thread of the record reached");
  assert.equal(new Set(seen).size, seen.length, "none twice");
  assert.equal(state.earlierInfo.remaining, 0, "and the end is said");
  assert.ok(Math.max(...log.redraws) <= PAGE);
  // back to the newest
  while (state.trail.length) { state.showNewer(); await flush(); assert.ok(state.closedList.length <= PAGE); }
  assert.equal(state.cursor, null, "the newest page again");
  assert.equal(state.closedList[0].id, "t45");
});

test("while an earlier page is held, the poll leaves it alone", async () => {
  const off = office(45);
  const { state } = rig(off);
  state.holdNewest(off.answer(state.pageUrl(null)));
  state.showEarlier();
  await flush();
  const held = ids(state.closedList);
  assert.equal(state.holdNewest(off.answer(state.pageUrl(null))), false, "the poll does not replace the page the reader is on");
  assert.deepEqual(ids(state.closedList), held);
});

test("a press while one is in flight asks nothing more", async () => {
  const off = office(45);
  const { state } = rig(off);
  state.holdNewest(off.answer(state.pageUrl(null)));
  const before = off.asked.length;
  state.showEarlier(); state.showEarlier(); state.showEarlier();
  assert.equal(off.asked.length - before, 1);
  await flush();
});

test("an office that does not answer leaves the page standing, says so, and does not move the reader", async () => {
  const off = office(45);
  const good = rig(off);
  good.state.holdNewest(off.answer(good.state.pageUrl(null)));
  const heldIds = ids(good.state.closedList);
  // the same state, then the office goes away
  const down = rig(off, { fail: true });
  down.state.holdNewest(off.answer(down.state.pageUrl(null)));
  down.state.showEarlier();
  await flush();
  assert.deepEqual(ids(down.state.closedList), heldIds, "the page stands");
  assert.equal(down.state.cursor, null);
  assert.deepEqual(down.state.trail, []);
  assert.match(down.state.pageNote, /couldn't be reached/);
  assert.equal(down.state.pageBusy, false, "and the reader can press again");
});

test("the office's memory is short, and the page says so rather than passing it for the record", () => {
  // the controls draw the office's own note when its answer is only memory and nothing is behind it
  assert.match(page, /earlierInfo\.source === "memory" && !\(earlierInfo\.remaining > 0\) \? earlierInfo\.note/);
});

test("source pins (text pins, labelled): the poll asks for one page; the old lazy accumulation is gone", () => {
  assert.match(page, /fetch\(pageUrl\(null\)/, "the poll asks for the newest page");
  assert.doesNotMatch(page, /shown \+= CHUNK/, "no chunked growth");
  assert.doesNotMatch(page, /new IntersectionObserver/, "no scroll-triggered growth");
  assert.match(page, /for \(var i = 0; i < threads\.length; i\+\+\) box\.appendChild\(threadNode\(threads\[i\]\)\)/, "one card per thread of the page held");
});
