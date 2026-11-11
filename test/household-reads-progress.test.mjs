// household-reads-progress.test.mjs — the household page paints as each resident's reads arrive (POS-984).
//
// Why (Wright and Jetto, 2026-11-10 09:2x EST, Darko's dev walk): /households/starforge/ sat on "reading the house's record…" for
// 20 to 42 s on dev, because readHouse() awaited one Promise.all over every resident's /doorstep, /mail?box=outbox and /quests (nine
// residents, 27 reads, each doorstep seconds long on a busy box) before anything painted. The total work is unchanged: the same
// endpoints, the same calls. What changed is that the answer is handed out as it grows, and the page paints each part as it lands.
//
//   § 1  readHouse(…, { onProgress }): a late doorstep does not hold the others back; a failed one is read, not pending; order is the house's
//   § 2  readHouse without onProgress: the finished answer, as before; a painter that throws does not take the reads down
//   § 3  readingOf: still coming is not "did not answer"
//   § 4  the painters (run against the smallest document, the habit of household-needs-you.test.mjs): "still reading", never "nothing"
//   § 5  the stage wiring (a text pin, the weakest instrument: the walk, qa-shots/hearth-walk.mjs, is the behavioural reader beside it)
//
//   node --test test/household-reads-progress.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// ── the smallest document (as household-needs-you.test.mjs) ─────────────────

function node(tag, attrs = {}) {
  const el = {
    tag,
    className: "",
    hidden: "hidden" in attrs,
    attrs: { ...attrs },
    children: [],
    dataset: {},
    style: { setProperty() {} },
    classList: { add(c) { el.className = (el.className + " " + c).trim(); }, toggle() {} },
    _text: "",
    appendChild(child) { el.children.push(child); return child; },
    append(...xs) { for (const x of xs) el.children.push(typeof x === "string" ? text(x) : x); },
    setAttribute(k, v) { el.attrs[k] = String(v); if (k === "hidden") el.hidden = true; },
    removeAttribute(k) { delete el.attrs[k]; if (k === "hidden") el.hidden = false; },
    remove() {},
    get textContent() { return el._text + el.children.map((c) => c.textContent).join(""); },
    set textContent(v) { el._text = String(v); el.children.length = 0; },
    querySelector(sel) { return find(el, sel); },
    querySelectorAll() { return []; },
  };
  return el;
}
const text = (t) => { const n = node("#text"); n.textContent = t; return n; };

// `[data-x]` or `[data-x="v"]`, the only selectors the painters ask for
function find(root, sel) {
  const m = /^\[([\w-]+)(?:="([^"]*)")?\]$/.exec(sel);
  if (!m) return null;
  const walk = (n) => {
    for (const c of n.children) {
      if (m[1] in c.attrs && (m[2] == null || c.attrs[m[1]] === m[2])) return c;
      const hit = walk(c);
      if (hit) return hit;
    }
    return null;
  };
  return walk(root);
}

globalThis.document = { createElement: (t) => node(t), createTextNode: text };
globalThis.CSS = { escape: (s) => s };

const { readHouse } = await import("../src/lib/household-dashboard/reads.mjs");
const { readingOf, NOT_READING } = await import("../src/lib/household-dashboard/fold.mjs");
const { paintHouse, paintNeeds } = await import("../src/lib/household-dashboard/paint.mjs");
const { paintMarks, paintMail, paintTown, paintMap, paintChart, paintPosts } = await import("../src/lib/hearth/paint.mjs");

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// ── a fake office: answers by path, can hold a door shut until released, can fail one ───────────────

const HANDLES = ["a", "b", "c", "d"];
const gate = () => { let go; const p = new Promise((r) => { go = r; }); return { p, go }; };
const until = async (cond, what) => {
  for (let i = 0; i < 2000; i++) { if (cond()) return; await new Promise((r) => setImmediate(r)); }
  throw new Error("never happened: " + what);
};

function office({ held = {}, down = [] } = {}) {
  const calls = [];
  const fetchImpl = async (url) => {
    const u = new URL(url);
    const path = u.pathname.replace(/^\/api(?=\/)/, "") + u.search;
    calls.push(path);
    if (held[path]) await held[path].p;
    if (down.includes(path)) return { ok: false, status: 500, json: async () => ({ error: "down" }) };
    let m, body;
    if ((m = /^\/doorstep\/(\w+)$/.exec(path))) body = { handle: m[1], stamps: { assets: 3 } };
    else if (/^\/mail\/\w+\?box=outbox$/.test(path)) body = [];
    else if (/^\/quests\/\w+$/.test(path)) body = { quests: [] };
    else if (path === "/world/walkers") body = { walkers: [] };
    else if (path === "/world/conversations") body = { live: [], closed: [] };
    else if (path === "/calendar") body = { now: [], coming: [] };
    else return { ok: false, status: 404, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => body };
  };
  return { fetchImpl, calls };
}

async function withFetch(fetchImpl, fn) {
  const real = globalThis.fetch;
  globalThis.fetch = fetchImpl;
  try { return await fn(); } finally { globalThis.fetch = real; }
}

// ── § 1 ─────────────────────────────────────────────────────────────────────

test("§ 1 a resident whose doorstep is late does not hold the others back, and a failed one does not block either", async () => {
  // LAW (POS-984, Wright 2026-11-10): "paints what it has as each resident's reads arrive ... a failed read for one resident shows that
  // resident as not read and never blocks the rest."
  const slow = gate();
  const { fetchImpl } = office({ held: { "/doorstep/b": slow }, down: ["/doorstep/c"] });
  await withFetch(fetchImpl, async () => {
    const order = [];
    const snaps = [];
    let finished = false;
    const whole = readHouse(HANDLES, { onProgress: (s) => { snaps.push(s); order.push("painted without " + s.pending.join(",")); } }).then((r) => { finished = true; return r; });

    // every read but b's doorstep lands; b's doorstep is held shut
    await until(() => snaps.length && snaps.at(-1).waiting.length === 0 && snaps.at(-1).pending.join() === "b", "everything but b answered");
    const mid = snaps.at(-1);
    assert.equal(finished, false, "the whole answer waits for b's doorstep, and nothing is painted from it");
    assert.deepEqual(mid.pending, ["b"], "only b is still out");
    assert.deepEqual(mid.doorsteps.a, { handle: "a", stamps: { assets: 3 } }, "a was painted from its own answer");
    assert.deepEqual(mid.doorsteps.d, { handle: "d", stamps: { assets: 3 } });
    assert.equal(mid.doorsteps.c, null, "c's doorstep failed: read, and read as nothing");
    assert.ok(!mid.pending.includes("c"), "a failed read is not still coming");
    assert.ok(!("b" in mid.doorsteps), "b has no entry yet: still coming, not 'did not answer'");
    assert.deepEqual(mid.waiting, [], "the house-wide reads landed without b");
    assert.deepEqual(mid.outboxes.c, [], "c's other reads (outbox) still answered");

    order.push("released b");
    slow.go();
    const done = await whole;
    assert.ok(order.indexOf("painted without b") < order.indexOf("released b"), "the others were painted before the slow one resolved");
    assert.deepEqual(done.pending, []);
    assert.deepEqual(done.waiting, []);
    assert.deepEqual(done.doorsteps.b, { handle: "b", stamps: { assets: 3 } });
    assert.equal(done.doorsteps.c, null);
  });
});

test("§ 1 a snapshot holds the house's own order, whoever answered first", async () => {
  const gA = gate(), gB = gate();
  const { fetchImpl } = office({ held: { "/doorstep/a": gA, "/doorstep/b": gB } });
  await withFetch(fetchImpl, async () => {
    const snaps = [];
    const whole = readHouse(HANDLES, { onProgress: (s) => snaps.push(s) });
    await until(() => snaps.length && snaps.at(-1).pending.join() === "a,b" && snaps.at(-1).waiting.length === 0, "c and d answered");
    assert.deepEqual(Object.keys(snaps.at(-1).doorsteps), ["c", "d"]);
    gB.go();
    await until(() => snaps.at(-1).pending.join() === "a", "b answered");
    assert.deepEqual(Object.keys(snaps.at(-1).doorsteps), ["b", "c", "d"], "b answered after c and d and stands before them, as the house lists it");
    assert.deepEqual(snaps.at(-1).pending, ["a"]);
    gA.go();
    const done = await whole;
    for (const key of ["doorsteps", "outboxes", "quests"]) assert.deepEqual(Object.keys(done[key]), HANDLES, key + " in the house's order");
  });
});

test("§ 1 the total work is unchanged: the same endpoints, each asked once, and no new door", async () => {
  const { fetchImpl, calls } = office();
  await withFetch(fetchImpl, () => readHouse(HANDLES, { onProgress: () => {} }));
  const expected = [
    ...HANDLES.flatMap((h) => [`/doorstep/${h}`, `/mail/${h}?box=outbox`, `/quests/${h}`]),
    "/world/walkers", "/world/conversations", "/calendar",
  ];
  assert.deepEqual([...calls].sort(), [...expected].sort());
});

test("§ 1 each snapshot is its own: a later answer does not change one already handed out", async () => {
  const { fetchImpl } = office();
  await withFetch(fetchImpl, async () => {
    // hold each snapshot's own object, and its bytes as it was handed out; every one must still read the same after the last read lands
    const held = [];
    await readHouse(HANDLES, { onProgress: (s) => held.push([s, JSON.stringify(s)]) });
    assert.ok(held.length > 1 && (held[0][0].pending.length > 0 || held[0][0].waiting.length > 0), "the first snapshot is part-read");
    for (const [s, was] of held) assert.equal(JSON.stringify(s), was, "a snapshot is never mutated after it is handed out");
  });
});

// ── § 2 ─────────────────────────────────────────────────────────────────────

test("§ 2 without onProgress it is the finished answer, in the same shape as before, with a failed read null", async () => {
  const { fetchImpl } = office({ down: ["/doorstep/c", "/calendar"] });
  const r = await withFetch(fetchImpl, () => readHouse(HANDLES));
  assert.deepEqual(Object.keys(r.doorsteps), HANDLES);
  assert.equal(r.doorsteps.c, null);
  assert.deepEqual(r.doorsteps.a, { handle: "a", stamps: { assets: 3 } });
  assert.equal(r.calendar, null, "a house-wide read that failed is null, not pending");
  assert.deepEqual(r.walkers, { walkers: [] });
  assert.deepEqual([r.pending, r.waiting], [[], []]);
});

test("§ 2 a painter that throws on a partial answer does not take the reads down", async () => {
  const { fetchImpl } = office();
  const errors = [];
  const realError = console.error;
  console.error = (...a) => errors.push(a.join(" "));
  try {
    const r = await withFetch(fetchImpl, () => readHouse(HANDLES, { onProgress: () => { throw new Error("paint blew up"); } }));
    assert.deepEqual(Object.keys(r.doorsteps), HANDLES, "every resident still came in");
    assert.ok(errors.length > 0, "and the throw was reported, not swallowed silently");
  } finally { console.error = realError; }
});

// ── § 3 ─────────────────────────────────────────────────────────────────────

test("§ 3 readingOf: the residents and the house-wide reads still out; nothing once whole; a failed one is not out", () => {
  assert.deepEqual(readingOf({ pending: ["b"], waiting: ["calendar"] }), { residents: ["b"], house: ["calendar"] });
  assert.equal(readingOf({ pending: [], waiting: [] }), NOT_READING);
  assert.equal(readingOf({ doorsteps: {} }), NOT_READING, "a read awaited whole (the dashboard's) carries neither list: nothing is out");
  assert.equal(readingOf(null), NOT_READING);
  assert.ok(Object.isFrozen(NOT_READING) && Object.isFrozen(NOT_READING.residents));
});

// ── § 4 the painters ────────────────────────────────────────────────────────

const faces = { a: { name: "Ayla" }, b: { name: "Bram" } };
const seatHref = (h) => "/households/h/?resident=" + h;
const base = { faces, seatHref, handles: ["a", "b"], slug: "h", owner: true, now: Date.parse("2026-11-10T12:00:00Z") };

function page() {
  const root = node("section", { "data-hd": "" });
  const reading = root.appendChild(node("p", { "data-hd-reading": "", hidden: "" }));
  const box = root.appendChild(node("aside", { "data-hd-needs-box": "", hidden: "" }));
  const needs = box.appendChild(node("ul", { "data-hd-needs": "" }));
  const feed = root.appendChild(node("ol", { "data-hd-feed": "" }));
  feed.appendChild(node("li", { "data-hd-loading": "" })).textContent = "reading the house’s record…";
  const cards = Object.fromEntries(["a", "b"].map((h) => {
    const card = root.appendChild(node("article", { "data-hd-card": h }));
    const live = card.appendChild(node("dl", { "data-hd-live": "", hidden: "" }));
    return [h, { card, live, last: card.appendChild(node("dd", { "data-hd-last": "" })) }];
  }));
  return { root, reading, box, needs, feed, cards };
}

test("§ 4 part-read: the page says (in the strip) how many residents are still out, the feed is not 'nothing', Needs you is not the calm line", () => {
  const p = page();
  const reads = { doorsteps: { a: { stamps: { assets: 1 } } }, outboxes: { a: [] }, quests: {}, pending: ["b"], waiting: [] };
  paintHouse(p.root, reads, { ...base, reading: readingOf(reads) });
  assert.equal(p.reading.hidden, false);
  assert.equal(p.reading.textContent, "still reading 1 resident…");
  assert.equal(p.feed.textContent, "reading the house’s record…", "b is still out, so an empty feed is not 'nothing on the record'");
  assert.match(p.needs.textContent, /Still reading the house’s record…/);
  assert.doesNotMatch(p.needs.textContent, /Nothing needs you/, "never the calm line while a resident is still out");
  assert.equal(p.cards.b.last.textContent, "still reading…", "the pending resident's card says so, not 'nothing on the record lately'");
  assert.equal(p.cards.a.last.textContent, "nothing on the record lately", "a resident who is read, with nothing on the record, says so");
});

test("§ 4 an empty feed while residents are out says it is reading; once every one has answered it says nothing, as before", () => {
  const p = page();
  const part = { doorsteps: {}, outboxes: {}, quests: {}, pending: ["a", "b"], waiting: ["conversations"] };
  paintHouse(p.root, part, { ...base, reading: readingOf(part) });
  assert.equal(p.feed.textContent, "reading the house’s record…");
  assert.equal(p.reading.textContent, "still reading 2 residents…");
  const whole = { doorsteps: { a: null, b: null }, outboxes: { a: null, b: null }, quests: {}, pending: [], waiting: [] };
  paintHouse(p.root, whole, { ...base, reading: readingOf(whole) });
  assert.equal(p.feed.textContent, "Nothing on the house’s record in the last day.");
  assert.equal(p.reading.hidden, true, "the line goes once all have answered");
  assert.equal(p.reading.textContent, "");
  assert.match(p.needs.textContent, /Nothing needs you right now\./);
  assert.equal(p.cards.b.last.textContent, "nothing on the record lately", "a resident whose reads FAILED is read, and shows nothing: not 'still reading'");
});

test("§ 4 house-wide reads only still out: the line names the town's record, and no resident is called pending", () => {
  const p = page();
  const reads = { doorsteps: { a: null, b: null }, outboxes: { a: [], b: [] }, quests: {}, pending: [], waiting: ["walkers"] };
  paintHouse(p.root, reads, { ...base, reading: readingOf(reads) });
  assert.equal(p.reading.textContent, "still reading the town’s record…");
});

test("§ 4 a page awaited whole (the dashboard) paints exactly as before: no reading line, the calm line", () => {
  const p = page();
  const reads = { doorsteps: { a: {}, b: {} }, outboxes: { a: [], b: [] }, quests: {} };
  paintHouse(p.root, reads, { ...base });
  assert.equal(p.reading.hidden, true);
  assert.match(p.needs.textContent, /Nothing needs you right now\./);
});

test("§ 4 paintNeeds on its own: reading residents never claims calm; a real need still paints", () => {
  const p = page();
  const none = { stances: { total: 0, by: [] }, bounces: [], pending: [], atRisk: 0 };
  paintNeeds(p.root, none, { ...base, reading: { residents: ["b"], house: [] } });
  assert.equal(p.needs.textContent, "Still reading the house’s record…");
  paintNeeds(p.root, { ...none, atRisk: 1 }, { ...base, reading: { residents: ["b"], house: [] } });
  assert.match(p.needs.textContent, /1 mark of the house’s is at risk/);
  assert.doesNotMatch(p.needs.textContent, /Still reading/, "what is already known paints, with no filler beside it");
});

// the Hearth's own slots keep their "reading…" placeholder until their read has answered or failed
function slot(attr, placeholder, tag = "ul") {
  const root = node("div");
  const box = root.appendChild(node(tag, { [attr]: "" }));
  box.appendChild(node("li", {})).textContent = placeholder;
  return { root, box };
}

test("§ 4 the Hearth's slots: a read that is only coming keeps its placeholder; one that failed says so", () => {
  const reading = { residents: ["b"], house: ["calendar", "walkers"] };
  const items = [];
  { const s = slot("data-hx-marks", "reading the house’s record…"); paintMarks(s.root, items, { ...base, reading }); assert.equal(s.box.textContent, "reading the house’s record…", "marks: coming"); }
  { const s = slot("data-hx-marks", "reading the house’s record…"); paintMarks(s.root, items, { ...base, reading: NOT_READING }); assert.equal(s.box.textContent, "No marks of the house’s have been ruled on lately.", "marks: none, once read"); }
  { const s = slot("data-hx-town-events", "reading the calendar…"); paintTown(s.root, { calendar: null }, { ...base, reading }); assert.equal(s.box.textContent, "reading the calendar…", "calendar: coming"); }
  { const s = slot("data-hx-town-events", "reading the calendar…"); paintTown(s.root, { calendar: null }, { ...base, reading: { residents: ["b"], house: [] } }); assert.equal(s.box.textContent, "The calendar could not be read just now.", "calendar: failed"); }
  { const s = slot("data-hx-map", "reading the world…", "div"); paintMap(s.root, { walkers: null }, { ...base, reading }); assert.equal(s.box.textContent, "reading the world…", "walkers: coming"); }
  { const s = slot("data-hx-map", "reading the world…", "div"); paintMap(s.root, { walkers: null }, { ...base, reading: NOT_READING }); assert.equal(s.box.textContent, "The walkers’ roll could not be read just now.", "walkers: failed"); }
  { const s = slot("data-hx-chart", "reading the stamps…", "div"); paintChart(s.root, { doorsteps: {} }, { ...base, reading }); assert.equal(s.box.textContent, "reading the stamps…", "chart: coming"); }
  { const s = slot("data-hx-chart", "reading the stamps…", "div"); paintChart(s.root, { doorsteps: {} }, { ...base, reading: NOT_READING }); assert.equal(s.box.textContent, "The stamps could not be read just now.", "chart: failed"); }
  { const s = slot("data-hx-posts", "reading the town’s posts…"); paintPosts(s.root, null, { ...base, reading }); assert.equal(s.box.textContent, "reading the town’s posts…", "posts: coming"); }
});

test("§ 4 the stamps chart paints the residents read so far; one still out is a bar that says so, one that failed says 'not read'", () => {
  const s = slot("data-hx-chart", "reading the stamps…", "div");
  const doorsteps = { a: { stamps: { assets: 4 } } };
  paintChart(s.root, { doorsteps }, { ...base, handles: ["a", "b"], reading: { residents: ["b"], house: [] } });
  const labels = [];
  const walk = (n) => { if (n.attrs?.["aria-label"]) labels.push(n.attrs["aria-label"]); n.children.forEach(walk); };
  walk(s.box);
  assert.deepEqual(labels, ["Ayla: 4 stamps", "Bram: still reading"]);
  const f = slot("data-hx-chart", "reading the stamps…", "div");
  paintChart(f.root, { doorsteps }, { ...base, handles: ["a", "b"], reading: NOT_READING });
  const labels2 = [];
  const walk2 = (n) => { if (n.attrs?.["aria-label"]) labels2.push(n.attrs["aria-label"]); n.children.forEach(walk2); };
  walk2(f.box);
  assert.deepEqual(labels2, ["Ayla: 4 stamps", "Bram: not read"]);
});

test("§ 4 the mail box: hidden until a doorstep has answered; part-read it says so, whole with a failure it keeps its old words", () => {
  const mk = () => { const root = node("div"); const box = root.appendChild(node("section", { "data-hx-mail": "", hidden: "" })); box.appendChild(node("ul", { "data-hx-mail-list": "" })); return { root, box }; };
  const noneYet = mk();
  paintMail(noneYet.root, { doorsteps: {} }, { ...base, reading: { residents: ["a", "b"], house: [] } });
  assert.equal(noneYet.box.hidden, true, "nothing has answered and more is coming: the box stays hidden");
  const part = mk();
  paintMail(part.root, { doorsteps: { a: { awaiting: { summary: { new_inbound: 2 } } } } }, { ...base, reading: { residents: ["b"], house: [] } });
  assert.equal(part.box.hidden, false);
  assert.match(part.box.textContent, /2 new inbound letters/);
  assert.match(part.box.textContent, /Still reading 1 resident, so these counts may be short\./);
  assert.doesNotMatch(part.box.textContent, /Not every resident’s doorstep answered/);
  const done = mk();
  paintMail(done.root, { doorsteps: { a: { awaiting: { summary: { new_inbound: 2 } } }, b: null } }, { ...base, reading: NOT_READING });
  assert.match(done.box.textContent, /Not every resident’s doorstep answered, so these counts may be short\./, "the honest note for a failed read stays");
  assert.doesNotMatch(done.box.textContent, /Still reading/);
});

// ── § 5 the wiring (a text pin: the walk reads the behaviour) ───────────────

test("§ 5 (text pin) the stage asks for progress on the first read and draws the snapshot it is handed, and sets what is still out before it paints", () => {
  const stage = readFileSync(resolve(ROOT, "src/lib/hearth/stage.mjs"), "utf8");
  assert.match(stage, /onProgress: progressive \? \(snapshot\) => \{ if \(seq === loadSeq\) \{ reads = snapshot; draw\(\); \} \} : null/);
  assert.match(stage, /const progressive = !reads \|\| still\.residents\.length > 0 \|\| still\.house\.length > 0;/, "the first read (and one that replaces a part-read page) is progressive");
  assert.match(stage, /ctx\.reading = readingOf\(reads\);/);
  assert.ok(stage.indexOf("ctx.reading = readingOf(reads);") < stage.indexOf("paintHouse(stage, reads, ctx)"), "the reading state is set before the stage paints");
  assert.ok(!/await Promise\.all\(\[\s*readHouse/.test(stage), "the stage no longer awaits the house's reads together with the posts");
  // until 2026-11-10 the band carried this line; until 2026-11-11 the strip carried it as words. POS-999 (Darko, 2026-11-11) made it a small mark in the
  // household's sub-rail, its words its title, still outside every design; the stage paints it from the same reading state (test/house-rail.test.mjs runs the painter)
  const page = readFileSync(resolve(ROOT, "src/components/hearth/Hearth.astro"), "utf8");
  assert.match(page, /<HouseRail house=\{house\} members=\{members\} current="__house" reading>/, "the strip's sub-rail carries the reading mark");
  assert.ok(page.indexOf("<HouseRail ") < page.indexOf("<!--hearth-entry-->"), "above, and outside, the entry's region");
  assert.match(readFileSync(resolve(ROOT, "src/components/HouseRail.astro"), "utf8"), /\{reading && <span class="pm-subrail-reading" data-hd-reading-mark role="status" hidden>/, "the mark ships hidden");
  assert.match(stage, /if \(bar\) paintReadingMark\(bar, ctx\.reading\);/, "the stage paints it, from the same reading state");
});
