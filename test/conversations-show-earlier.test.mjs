// conversations-show-earlier.test.mjs — the conversations page's SHOW EARLIER (POS-779).
//
// The page holds ONE page of finished conversations (40, the count the World map reads and links to). The poll's answer is the office's
// MEMORY (which may hold a page of finished threads, fewer, or none); "Show earlier" asks the office for the page behind the cursor the
// poll handed back, which a store-engaged office reads from the RECORD; the answer REPLACES the page held. When the record's reach ends
// at the oldest settlement the office has read, the page says so plainly.
//
// The rules are in the page's own inline script, so this suite reads that block out of the page (the way conversations-face.test.mjs
// reads the avatar guard) and runs THAT text: the state machine AND `redraw`, the function that draws the buttons and the notes, over
// the page's own `el` and a small DOM that keeps what was drawn, against a fake office with BOTH sources the way a store-engaged office
// has them. Nothing here claims to be the page in a real browser; that is the separate evidence in the PR.
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
const elStart = page.indexOf("function el(tag, cls, text) {");
const elEnd = page.indexOf("\n      }\n", elStart) + "\n      }\n".length;
assert.ok(elStart > -1 && elEnd > elStart, "the page still carries its `el`");
const elSrc = page.slice(elStart, elEnd);

const API = "/api/world/conversations";
const PAGE = 40;
const EVER = "9999-12-31T23:59:59.999Z";
// the office's own words for voices older than the settlements it has read (world2-serve.mjs conversationsFromRecord)
const LIMIT = "1 of the 2400 voices come before the oldest settlement this office has read (2026-10-07T06:00:00.000Z), so their settlement is unknown and they are not grouped";

/** A node that keeps what the page drew into it. */
function node(tag) {
  const n = { tag, className: "", textContent: "", children: [], disabled: false, type: "", listeners: {} };
  n.appendChild = (c) => { n.children.push(c); return c; };
  n.addEventListener = (ev, fn) => { n.listeners[ev] = fn; };
  Object.defineProperty(n, "childNodes", { get: () => n.children });
  return n;
}
const texts = (box) => box.children.flatMap((c) => (c.children?.length ? texts(c) : [c.textContent])).filter(Boolean);
const buttons = (box) => box.children.flatMap((nav) => (nav.children ?? []).filter((c) => c.tag === "button"));

/**
 * An office with a RECORD of `record` finished threads (newest first) and a MEMORY of the newest `memory` of them. The poll (no `before`)
 * is memory's; a `before` page is the record's when `store`, else memory's. `asked` records every request as the page made it.
 */
function office({ record = 45, memory = record, store = true } = {}) {
  const all = Array.from({ length: record }, (_, i) => ({ id: `t${record - i}`, latest: new Date(Date.UTC(2026, 10, 1) + (record - i) * 3600_000).toISOString(), voice_count: 3 }));
  const mem = all.slice(0, memory);
  const asked = [];
  const o = { all, asked, since: "2026-11-01T06:00:00.000Z" };
  // history that arrives later: a thread newer than every other, in the record and in memory; and a settlement
  o.addThread = (id) => { const t = { id, latest: new Date(Date.UTC(2026, 10, 2) + all.length * 3600_000).toISOString(), voice_count: 3 }; all.unshift(t); mem.unshift(t); };
  o.settle = (iso) => { o.since = iso; };
  o.answer = (url) => {
    asked.push(url);
    const u = new URL("http://x" + url);
    const before = u.searchParams.get("before");
    const n = Number(u.searchParams.get("closed"));
    const from = before && store ? all : mem;
    const older = before ? from.filter((t) => Date.parse(t.latest) < Date.parse(before)) : from;
    const closed = older.slice(0, n);
    const source = before && store ? "record" : "memory";
    return { closed, live: [], settlement_since: o.since, earlier: { source, remaining: older.length - closed.length, before: closed.length ? closed[closed.length - 1].latest : null },
      ...(source === "record" ? { disclosed: ["two eras answer this read", LIMIT] } : {}) };
  };
  return o;
}

/** The page's block, with its own `redraw`, over a fetch the test drives. `painted` is each call of `paint`: the ids held. */
function rig(off, { fail = false } = {}) {
  const box = node("div");
  const painted = [];
  const fetchStub = (url) => new Promise((ok, no) => {
    if (fail) return no(new Error("down"));
    const body = off.answer(url);
    ok({ ok: true, json: () => Promise.resolve(body) });
  });
  const paint = (b, threads) => { b.children.length = 0; painted.push((threads ?? []).map((t) => t.id)); };
  const make = new Function("API", "fetch", "paint", "closedBox", "document", `${elSrc}\n${block}
    return { get closedList() { return closedList; }, get earlierInfo() { return earlierInfo; }, get cursor() { return cursor; }, get trail() { return trail; },
             get pageNote() { return pageNote; }, get olderLine() { return olderLine; }, isExhausted,
             pageUrl, holdNewest, showEarlier, showNewer, redraw, canShowEarlier, CLOSED_PAGE, EVER };`);
  const state = make(API, fetchStub, paint, box, { createElement: node });
  const poll = () => { state.holdNewest(off.answer(state.pageUrl(null))); state.redraw(); };
  return { state, box, painted, poll, off };
}
const flush = () => new Promise((r) => setTimeout(r, 0));
const ids = (list) => list.map((t) => t.id);
const labels = (box) => buttons(box).map((x) => x.textContent);

test("the page asks for one page of 40, the count the World map reads; a thread at rank 30 is on the held page (its map link finds its card)", () => {
  const { state, painted, poll } = rig(office({ record: 45 }));
  assert.equal(state.CLOSED_PAGE, PAGE);
  assert.equal(state.pageUrl(null), `${API}?closed=40`);
  poll();
  const held = painted.at(-1);
  assert.equal(held.length, PAGE);
  assert.ok(held.includes("t16"), "rank 30 of 45 (t16) is mounted: a /conversations/#t16 link lands on a card");
  assert.ok(held.includes("t6"), "and rank 40");
});

test("empty memory: the page still offers Show earlier, and it reaches the record's newest page (the entry is not memory's count)", async () => {
  const off = office({ record: 14, memory: 0 });
  const { state, box, poll, painted } = rig(off);
  poll();
  assert.deepEqual(painted.at(-1), [], "memory holds no finished thread");
  assert.deepEqual(labels(box), ["Show earlier"], "the button is there with nothing to count back from");
  state.showEarlier();
  await flush();
  assert.equal(new URL("http://x" + off.asked.at(-1)).searchParams.get("before"), EVER, "asked from the end of time");
  assert.equal(state.closedList.length, 14, "the record's finished threads");
  assert.equal(state.earlierInfo.source, "record");
  assert.deepEqual(labels(box), ["Newer conversations"], "and the way back");
});

test("partial memory (6 of 14): the 8 older threads are reached from memory's own cursor, and the walk comes back to the poll's page", async () => {
  const off = office({ record: 14, memory: 6 });
  const { state, box, poll, painted } = rig(off);
  poll();
  assert.equal(painted.at(-1).length, 6);
  assert.deepEqual(labels(box), ["Show earlier"], "memory says it has no more, and the record may");
  const first = new Set(ids(state.closedList));
  state.showEarlier();
  await flush();
  assert.equal(state.closedList.length, 8, "exactly the 8 the poll could not show");
  assert.ok(ids(state.closedList).every((id) => !first.has(id)));
  assert.equal(state.earlierInfo.remaining, 0);
  state.showNewer();
  await flush();
  assert.equal(state.cursor, null, "back on the newest page");
  assert.deepEqual(labels(box), ["Show earlier"]);
  assert.equal(state.closedList.length, 6);
});

const MEMORY_END = "This is only the office's short memory, so older history may not be available.";

test("an office with no record: Show earlier comes back empty, the page stands, and the end is said to be only memory (not 'nothing earlier')", async () => {
  const off = office({ record: 6, store: false });
  const { state, box, poll, painted } = rig(off);
  poll();
  const held = ids(state.closedList);
  state.showEarlier();
  await flush();
  assert.deepEqual(ids(state.closedList), held, "the page stands");
  assert.equal(state.isExhausted(), true);
  assert.deepEqual(labels(box), [], "no button to press again");
  const said = texts(box);
  assert.ok(said.includes(MEMORY_END), "it says plainly this is only the office's memory: " + JSON.stringify(said));
  assert.ok(!said.some((t) => /nothing earlier/i.test(t)), "and does not claim there is nothing earlier");
  assert.ok(painted.at(-1).length === held.length);
});

test("a record with nothing earlier says so plainly, and that is a different sentence from the memory one", async () => {
  const off = office({ record: 6, memory: 6, store: true });
  const clean = off.answer;
  off.answer = (url) => { const b = clean(url); if (b.earlier.source === "record") b.closed = []; return b; }; // the record holds nothing behind the memory page
  const { state, box, poll } = rig(off);
  poll(); state.showEarlier(); await flush();
  assert.equal(state.isExhausted(), true);
  assert.ok(texts(box).includes("There is nothing earlier than this."), JSON.stringify(texts(box)));
  assert.ok(!texts(box).includes(MEMORY_END));
});

test("exhaustion belongs to the page, the ask and the settlement: unchanged polls keep it; a new settlement, new history or another page restores the entry", async () => {
  // unchanged exhausted cursor stays exhausted through repeated identical polls, and asks nothing more
  const off = office({ record: 6, store: false });
  const { state, box, poll } = rig(off);
  poll(); state.showEarlier(); await flush();
  const asks = off.asked.length;
  for (let i = 0; i < 4; i++) poll();
  assert.equal(state.isExhausted(), true, "identical polls do not undo a truthful exhausted result");
  assert.deepEqual(labels(box), []);
  assert.equal(off.asked.length - asks, 4, "each poll is one ask (the poll itself), and none is a press");
  // a settlement: the same page, a new settlement, entry restored
  off.settle("2026-11-01T18:00:00.000Z");
  poll();
  assert.equal(state.isExhausted(), false, "after a settlement the earlier answer is no longer the last word");
  assert.deepEqual(labels(box), ["Show earlier"]);
  assert.ok(!texts(box).includes(MEMORY_END), "and the stale sentence is gone");
  // pressed again on the same settlement: exhausted again, for that settlement
  state.showEarlier(); await flush();
  assert.equal(state.isExhausted(), true);
});

test("new history changes the ask: an empty memory that later holds a finished thread offers Show earlier again", async () => {
  const off = office({ record: 3, memory: 0, store: false });
  const { state, box, poll } = rig(off);
  poll(); state.showEarlier(); await flush();
  assert.equal(state.isExhausted(), true, "exhausted on the end-of-time ask");
  assert.deepEqual(labels(box), []);
  off.addThread("t-new");
  poll();
  assert.equal(state.closedList.length, 1);
  assert.equal(state.isExhausted(), false, "a finished thread now gives the poll a cursor of its own: a new ask");
  assert.deepEqual(labels(box), ["Show earlier"]);
});

test("exhaustion is for the page it was found on: another cursor never inherits it, and the same page finds it again", async () => {
  const off = office({ record: 95, memory: 95 });
  // the record's first page behind the poll says one more thread stands behind it, and then the ask for it comes back empty
  const real = off.answer;
  let behindC1 = null; // the cursor behind the record's first page, learned from its first answer
  off.answer = (url) => {
    const b = real(url);
    if (b.earlier.source !== "record") return b;
    if (behindC1 !== null && new URL("http://x" + url).searchParams.get("before") === behindC1) return { ...b, closed: [] };
    if (behindC1 === null) behindC1 = b.earlier.before;
    return { ...b, earlier: { ...b.earlier, remaining: 1 } };
  };
  const { state, box, poll } = rig(off);
  poll();
  state.showEarlier(); await flush();            // page 1 of the record (cursor c1), claiming one thread more behind it
  const c1 = state.cursor;
  assert.ok(c1 !== null);
  state.showEarlier(); await flush();            // the ask behind c1 is empty: exhausted for c1
  assert.equal(state.isExhausted(), true);
  assert.deepEqual(labels(box), ["Newer conversations"], "no way further behind this page");
  assert.ok(texts(box).includes("There is nothing earlier than this."));
  state.showNewer(); await flush();              // the newest page is a different cursor
  assert.equal(state.cursor, null);
  assert.equal(state.isExhausted(), false, "the answer found behind c1 does not hide entry from the newest page");
  assert.deepEqual(labels(box), ["Show earlier"]);
  state.showEarlier(); await flush();            // back to c1 (the same ask, the same settlement)
  assert.equal(state.cursor, c1);
  state.showEarlier();                           // c1's ask is the same one that was empty: it stands exhausted, and asks nothing new
  await flush();
  assert.equal(state.isExhausted(), true);
});

test("the limit of the reach is ON THE PAGE: drawn from the record's own disclosed line, at the end and on the way, and kept through live polls", async () => {
  const off = office({ record: 45, memory: 45 });
  const { state, box, poll } = rig(off);
  poll();
  assert.ok(!texts(box).some((t) => /Older history/.test(t)), "nothing is said before a record answer has said it");
  state.showEarlier();
  await flush();
  const said = `Older history isn't available: ${LIMIT}.`;
  assert.ok(texts(box).includes(said), "drawn beside the held record page: " + JSON.stringify(texts(box)));
  assert.equal(state.earlierInfo.remaining, 0, "this is the end of the reach");
  assert.deepEqual(labels(box), ["Newer conversations"]);
  // a live poll does not wipe it, whether the reader is on the record's page or back on the newest
  poll();
  assert.ok(texts(box).includes(said), "kept through a poll on the held page");
  state.showNewer();
  await flush();
  poll();
  assert.ok(texts(box).includes(said), "kept on the newest page once learned");
  // the line the page matches is the office's wording, not a field the page invented
  assert.ok(/before the oldest settlement this office has read/.test(LIMIT));
});

test("a record with nothing older than its sweeps says nothing about a limit", async () => {
  const off = office({ record: 45 });
  const clean = off.answer;
  off.answer = (url) => { const b = clean(url); if (b.disclosed) b.disclosed = b.disclosed.filter((d) => !/oldest settlement/.test(d)); return b; };
  const { state, box, poll } = rig(off);
  poll(); state.showEarlier(); await flush();
  assert.ok(!texts(box).some((t) => /Older history/.test(t)));
});

test("show earlier REPLACES the page (never more than one page mounted), none twice, none missed, and a poll leaves a held page alone", async () => {
  const off = office({ record: 95 });
  const { state, poll, painted } = rig(off);
  poll();
  const seen = [...ids(state.closedList)];
  for (let hops = 0; state.canShowEarlier() && hops < 10; hops++) {
    state.showEarlier(); await flush();
    const held = ids(state.closedList);
    assert.equal(state.holdNewest(off.answer(state.pageUrl(null))), false, "the poll does not replace the page the reader is on");
    assert.deepEqual(ids(state.closedList), held);
    seen.push(...held);
  }
  assert.deepEqual([...seen].sort(), off.all.map((t) => t.id).sort(), "every thread of the record reached");
  assert.equal(new Set(seen).size, seen.length, "none twice");
  assert.ok(Math.max(...painted.map((p) => p.length)) <= PAGE, "never more than one page mounted (boundary ties aside)");
});

test("a press while one is in flight asks nothing more; an office that does not answer leaves the page standing and says so", async () => {
  const off = office({ record: 45, memory: 45 });
  const { state, poll } = rig(off);
  poll();
  const before = off.asked.length;
  state.showEarlier(); state.showEarlier(); state.showEarlier();
  assert.equal(off.asked.length - before, 1);
  await flush();
  const down = rig(office({ record: 45 }), { fail: true });
  down.poll = () => { down.state.holdNewest(down.off.answer(down.state.pageUrl(null))); down.state.redraw(); };
  down.poll();
  const held = ids(down.state.closedList);
  down.state.showEarlier();
  await flush();
  assert.deepEqual(ids(down.state.closedList), held, "the page stands");
  assert.equal(down.state.cursor, null);
  assert.deepEqual(down.state.trail, []);
  assert.ok(texts(down.box).some((t) => /couldn't be reached/.test(t)), "and says so: " + JSON.stringify(texts(down.box)));
  assert.deepEqual(labels(down.box), ["Show earlier"], "the reader can press again");
});

test("source pins (text pins, labelled): the poll asks for one page; the old lazy accumulation is gone; the page holds the map's 40", () => {
  assert.match(page, /fetch\(pageUrl\(null\)/, "the poll asks for the newest page");
  assert.doesNotMatch(page, /shown \+= CHUNK/, "no chunked growth");
  // CORE-82: an IntersectionObserver now exists, but ONLY to mount a finished room's circle reader when it nears the screen (ensureReader):
  // it never grows the list. The pin is that nothing near it touches closedList / the page held.
  const io = page.slice(page.indexOf("new IntersectionObserver"), page.indexOf("function hook()"));
  assert.match(io, /ensureReader\(e\.target, false\)/, "the observer mounts a reader");
  assert.doesNotMatch(io, /closedList|CLOSED_PAGE|showEarlier|goPage/, "and grows no page: no scroll-triggered growth");
  // CORE-82: the cards are RECONCILED (kept by thread key), still one per thread of the page held
  assert.match(page, /threads\.forEach\(function \(t\) \{\s*var key = threadKey\(t\);/, "one card per thread of the page held, kept by its key");
  assert.match(page, /if \(at !== card\) box\.insertBefore\(card, at\)/, "a card moves only when it is out of place");
  assert.match(page, /var CLOSED_PAGE = 40;/);
});
