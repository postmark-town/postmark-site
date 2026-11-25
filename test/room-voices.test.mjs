// room-voices.test.mjs — an event's room read through POS-1232's opt-in one-room voices, drawn by the site's ONE room drawing (CORE-177).
//
//   node --test test/room-voices.test.mjs
//
// The producer is a PINNED CANDIDATE (Office #1229 d6a802e21cbb6aeaca8e9669bc766b697d6033c0: src/circles.mjs roomVoicesPage / findConversation), not a
// merged or live read. Every answer below is INVENTED in that pin's shape (`find.voices`, `find.voices_page`); no recorded speech. WHAT THIS HOLDS, running
// the IMPORTED modules over a small DOM:
//   (1) the read: ONE opt-in read of the named room on first draw; the continuation only ever the served `before_ms`;
//   (2) the binding: the lines are drawn by room-drawing.mjs into the Conversations pane (`ol.c-voices`) in the room's card, whole, B's circles and all,
//       nothing to reply with; a line's Open goes to the circle the PRODUCER names, on the Conversations page;
//   (3) an old room's pre-circles speech (ids, no `circle`) reads as one flowing conversation: every line its own, in order, nothing to open or fold;
//   (4) a partial page says what it is and offers the lines before it: one read per press, its whole page in front (ties never cut), nothing marked new,
//       a reply whose parent was behind the cursor placed once that parent arrives; a failed continuation says so and can be asked again;
//   (5) an office that answers without lines keeps the World's reader, handed the answer already held (no second read);
//   (6) a failed read says so with a retry, never an empty room; an answer that does not say what its page is, says so;
//   (7) the Conversations page is unchanged: without `circleHref` the drawing's Open is the page's own `#circle-<id>`, and that page hands none.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { drawRoomVoices, roomVoicesUrl, sayRoomFailed, voicesOf, ROOM_VOICES_WORDS } from "../src/lib/room-voices.mjs";
import { createRoomDrawing } from "../src/lib/room-drawing.mjs";

const CONVO = readFileSync(new URL("../town/pages/conversations/index.astro", import.meta.url), "utf8");
const EVENT = readFileSync(new URL("../town/pages/events/[host]/[slug].astro", import.meta.url), "utf8");

// ── a small DOM ──
function makeDoc() {
  const doc = { activeElement: null };
  const matches = (n, sel) => sel.split(",").some((s) => {
    s = s.trim();
    const a = /^\[([\w-]+)\]$/.exec(s); if (a) return n.hasAttribute(a[1]);
    const c = /^\.([\w-]+)$/.exec(s); if (c) return n.className.split(/\s+/).includes(c[1]);
    const tc = /^(\w+)\.([\w-]+)$/.exec(s); if (tc) return n.tagName === tc[1].toUpperCase() && n.className.split(/\s+/).includes(tc[2]);
    return n.tagName === s.toUpperCase();
  });
  const walk = (n, fn) => { for (const c of n.children) { fn(c); walk(c, fn); } };
  doc.createElement = (tag) => {
    const n = {
      tagName: String(tag).toUpperCase(), children: [], parentNode: null, attrs: {}, className: "", id: "", title: "", type: "", tabIndex: 0, href: "", _text: "",
      hidden: false, disabled: false, style: {}, listeners: {}, scrollTop: 0, src: "", alt: "", loading: "", width: 0, height: 0,
      get childNodes() { return this.children; },
      get textContent() { return this._text + this.children.map((c) => c.textContent).join(""); },
      set textContent(v) { this.children.forEach((c) => { c.parentNode = null; }); this.children = []; this._text = String(v); },
      appendChild(c) { if (c.parentNode) c.remove(); c.parentNode = this; this.children.push(c); return c; },
      append(...cs) { cs.forEach((c) => this.appendChild(c)); },
      remove() { const p = this.parentNode; if (p) { p.children = p.children.filter((c) => c !== this); this.parentNode = null; } },
      replaceWith(...cs) { const p = this.parentNode; if (!p) return; const i = p.children.indexOf(this); cs.forEach((c) => { if (c.parentNode) c.remove(); c.parentNode = p; }); p.children.splice(i, 1, ...cs); this.parentNode = null; },
      setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }, hasAttribute(k) { return k in this.attrs; },
      addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); },
      querySelector(sel) { let hit = null; walk(this, (c) => { if (!hit && matches(c, sel)) hit = c; }); return hit; },
      querySelectorAll(sel) { const out = []; walk(this, (c) => { if (matches(c, sel)) out.push(c); }); return out; },
      closest(sel) { let x = this; while (x) { if (x.attrs && matches(x, sel)) return x; x = x.parentNode; } return null; },
      contains(o) { let x = o; while (x) { if (x === this) return true; x = x.parentNode; } return false; },
      focus() { doc.activeElement = this; },
      getBoundingClientRect() { return { top: 0, bottom: 0, height: 0 }; },
      scrollIntoView() {},
    };
    return n;
  };
  return doc;
}
// a press: the event reaches every listener from the target up (the pane's one listener serves B's buttons)
async function press(target) {
  for (let x = target; x; x = x.parentNode) for (const fn of x.listeners.click ?? []) await fn({ target, preventDefault() {} });
}
const tick = () => new Promise((r) => setTimeout(r, 0));

// an event room's card as the page bakes it: details.c-thread > summary, meta, div[data-ev-reader] > p[data-ev-floor]
function cardOf(doc) {
  const card = doc.createElement("details"); card.className = "c-thread ev-room"; card.setAttribute("data-ev-room", "t1795000000000-wren");
  const head = doc.createElement("summary"); head.className = "c-thread-head ev-room-h";
  const reader = doc.createElement("div"); reader.className = "c-circles ev-reader"; reader.setAttribute("data-ev-reader", "");
  const floor = doc.createElement("p"); floor.className = "c-fine ev-note"; floor.setAttribute("data-ev-floor", ""); floor.textContent = "The circles load with JavaScript.";
  reader.append(floor); card.append(head, reader);
  return { card, reader, floor };
}

// ── invented answers in the pin's shape ──
const ROOM = "t1795000000000-wren";
const BASE = "https://office.test/api";
const PRE = Date.parse("2026-11-20T18:00:00.000Z");     // before circles went live (2026-11-22T10:19:06.729Z)
const NEW = Date.parse("2026-11-24T20:00:00.000Z");
const line = (id, handle, said, atMs, extra = {}) => ({ handle, standing: "resident", said, at: new Date(atMs).toISOString(), at_ms: atMs, x: 1, y: 2, ...(id ? { id } : {}), ...extra });
// a modern room: two circles, one with a reply to a reply
const MODERN = [
  line("201", "wren", "Lanterns are up by the dock.\nCome see.", NEW),
  line("202", "ash", "On my way.", NEW + 60e3, { reply_to: "201", circle: "201" }),
  line("203", "wren", "Bring the long matches.", NEW + 120e3, { reply_to: "202", circle: "201" }),
  line("204", "human-of-fox-hearth", "Is the bridge open?", NEW + 180e3),
].map((v) => (v.id && !v.reply_to ? { ...v, circle: v.id } : v));
// an old room: identified pre-circles speech (no reply_to, no circle) and one old line with no id at all
const OLD = [
  line(null, "moss", "Evening, all.", PRE - 60e3),
  line("101", "wren", "The tide is out early.", PRE),
  line("102", "ash", "Good for the crabs.", PRE + 30e3),
  line("103", "moss", "Not for the boats.", PRE + 60e3),
];
const page = (voices, extra = {}) => ({ source: "record", order: "oldest first", total: voices.length, served: voices.length, cap: 400, complete: true, ...extra });
const answer = (voices, voicesPage, room = { id: ROOM, latest: (voices ?? []).at(-1)?.at ?? null }) => ({ now: "2026-11-25T00:00:00Z", find: { room: String(ROOM), history: "complete", source: "record", room, circles: { timeline: [] }, ...(voices ? { voices } : {}), ...(voicesPage ? { voices_page: voicesPage } : {}) } });
function office(answers) {
  const asked = [];
  const fetchImpl = async (url) => {
    asked.push(url);
    const a = answers.shift();
    if (!a) throw new Error("no answer left: a read the test did not expect");
    if (a instanceof Error) throw a;
    return { status: a.status ?? 200, json: async () => a.body ?? a };
  };
  return { asked, fetchImpl };
}
const rowsOf = (card) => card.querySelectorAll(".c-voice");

// ── (1) the read ──

test("the opt-in read: the named room with room_voices=1, the continuation only ever a served before_ms, nothing for an id the office never issued", () => {
  assert.equal(roomVoicesUrl(BASE, ROOM), `${BASE}/world/conversations?room=${ROOM}&room_voices=1`);
  assert.equal(roomVoicesUrl(BASE + "/", "t1#x y"), `${BASE}/world/conversations?room=t1%23x%20y&room_voices=1`, "the id kept by the existing URL handling");
  assert.equal(roomVoicesUrl(BASE, ROOM, 1795000120000), `${BASE}/world/conversations?room=${ROOM}&room_voices=1&voices_before=1795000120000`);
  assert.equal(roomVoicesUrl(BASE, ROOM, "12&room=x"), null, "a cursor the office did not serve is never sent");
  assert.equal(roomVoicesUrl(BASE, ""), null);
  assert.equal(roomVoicesUrl(BASE, "x".repeat(201)), null);
  assert.equal(voicesOf({ find: { room: {} } }), null, "an answer without lines is not a voices answer");
  assert.equal(voicesOf({ find: { voices: [] } }).page, null, "lines without a page: the page is unknown, never assumed whole");
});

// ── (2) the binding ──

test("BINDING: one read on first draw; the room's lines drawn by the ONE room drawing in the Conversations pane, whole, B's circles, nothing to reply with", async () => {
  const doc = makeDoc(), { card, reader } = cardOf(doc);
  const o = office([answer(MODERN, page(MODERN))]);
  const m = await drawRoomVoices({ doc, card, reader, roomId: ROOM, base: BASE, fetchImpl: o.fetchImpl });
  assert.deepEqual(m, { ok: true, drawn: "voices" });
  assert.deepEqual(o.asked, [`${BASE}/world/conversations?room=${ROOM}&room_voices=1`], "exactly one read: the opt-in one");
  assert.equal(card.querySelector("[data-ev-reader]"), null, "the reader host (and its floor) gave way to the pane");
  const list = card.querySelector("ol.c-voices");
  assert.ok(list && list.parentNode === card, "the pane sits in the room's card, as on the Conversations page");
  assert.deepEqual(card.__t, { id: ROOM, voices: MODERN, voice_count: 4, latest: MODERN[3].at }, "the thread the drawing redraws from");
  // B: the openers whole, in order; one button counting the whole circle
  assert.deepEqual(rowsOf(card).map((r) => r.getAttribute("data-say")), ["201", "204"]);
  assert.equal(rowsOf(card)[0].querySelector(".c-said").textContent, "Lanterns are up by the dock.\nCome see.", "the whole words, line break kept");
  const fold = card.querySelector("[data-fold]");
  assert.equal(fold.textContent, "2 replies");
  await press(fold);
  assert.deepEqual(rowsOf(card).map((r) => r.getAttribute("data-say")), ["201", "202", "203", "204"], "the whole circle, every level, in place");
  assert.equal(card.querySelectorAll("[data-new]").length + card.querySelectorAll(".is-new").length, 0, "what the reader arrived to is not new");
  assert.equal(card.querySelectorAll("[data-reply]").length, 0, "an event page offers nothing to reply with");
  // Open: the circle the producer names, on the Conversations page; a house's human's name is not a link
  assert.deepEqual(card.querySelectorAll("[data-circle-open]").map((a) => a.href), ["/conversations/#circle-201", "/conversations/#circle-204"]);
  assert.equal(rowsOf(card)[3].querySelector(".c-who").tagName, "SPAN");
  assert.equal(rowsOf(card)[0].querySelector(".c-who").href, "/residents/wren/");
  assert.ok(rowsOf(card)[0].querySelector(".c-face"), "each line wears the host's small face");
  assert.equal(card.querySelector("[data-room-voices-page]").hidden, true, "a whole page says nothing more about itself");
});

test("faces: drawn through the same getter the page's bounded faces give, read at each drawing", async () => {
  const doc = makeDoc(), { card, reader } = cardOf(doc);
  let faces = null;
  await drawRoomVoices({ doc, card, reader, roomId: ROOM, base: BASE, fetchImpl: office([answer(MODERN, page(MODERN))]).fetchImpl, getFaces: () => faces });
  assert.equal(rowsOf(card)[0].querySelector(".c-face").tagName, "SPAN", "letters while the faces are out");
  faces = { wren: { name: "Wren", avatar: "/media/wren.png" } };
  await press(card.querySelector("[data-fold]"));
  assert.equal(rowsOf(card)[0].querySelector(".c-face").tagName, "IMG", "the picture on the next drawing");
});

// ── (3) the old room ──

test("AN OLD ROOM'S PRE-CIRCLES SPEECH FLOWS: every line its own, whole, in the order said; no circle to open, nothing folded", async () => {
  const doc = makeDoc(), { card, reader } = cardOf(doc);
  await drawRoomVoices({ doc, card, reader, roomId: ROOM, base: BASE, fetchImpl: office([answer(OLD, page(OLD))]).fetchImpl });
  assert.deepEqual(rowsOf(card).map((r) => r.querySelector(".c-said").textContent), OLD.map((v) => v.said));
  assert.deepEqual(rowsOf(card).map((r) => r.getAttribute("data-say")), [null, "101", "102", "103"], "every id the office served is kept");
  assert.equal(card.querySelectorAll("[data-circle-open]").length, 0, "the producer puts this speech in no circle, so there is none to open");
  assert.equal(card.querySelectorAll("[data-fold]").length, 0);
  assert.equal(card.querySelectorAll(".c-loose").length, 0, "and nothing says a parent is missing");
});

// ── (4) a partial page ──

test("PARTIAL: says what the page is and offers the lines before it; one read of the served cursor; its WHOLE page in front; nothing marked new", async () => {
  const doc = makeDoc(), { card, reader } = cardOf(doc);
  const before = MODERN[2].at_ms;
  // the first page: the newest two; behind it three (a tie-safe page may serve more than asked: here three where two were left)
  const first = [MODERN[2], MODERN[3]];
  const tie = line("205", "moss", "Same second as ash.", MODERN[1].at_ms, { circle: "205" });
  const second = [MODERN[0], MODERN[1], tie];
  const o = office([
    answer(first, page(first, { total: 5, served: 2, complete: false, earlier: { remaining: 3, before_ms: before, before: MODERN[2].at, next: "repeat this read with voices_before=…" } })),
    answer(second, page(second, { total: 5, served: 3, complete: false, later_not_served: 2, note: "voices_before cut this page off" })),
  ]);
  await drawRoomVoices({ doc, card, reader, roomId: ROOM, base: BASE, fetchImpl: o.fetchImpl });
  const words = card.querySelector("[data-room-voices-words]");
  assert.equal(words.textContent, `${ROOM_VOICES_WORDS.holds("record", 5)} ${ROOM_VOICES_WORDS.earlier(2, 3)}`);
  assert.equal(words.textContent, "This room holds 5 statements. The newest 2 are shown below in full; the 3 said before them are not shown yet.");
  assert.equal(rowsOf(card)[0].querySelector(".c-loose").textContent, "A reply to an earlier message that isn't shown here.", "a reply whose parent is behind the cursor says so");
  assert.equal(rowsOf(card)[0].querySelector("[data-circle-open]").href, "/conversations/#circle-201", "and opens the circle the WHOLE room puts it in");
  const more = card.querySelector("[data-room-voices-more]");
  assert.equal(more.textContent, "Show earlier statements");
  await press(more);
  assert.deepEqual(o.asked.slice(1), [`${BASE}/world/conversations?room=${ROOM}&room_voices=1&voices_before=${before}`], "one read, the served cursor");
  assert.equal(card.__t.voices.length, 5, "every line the page served, the tie included: nothing trimmed");
  assert.deepEqual(card.__t.voices.map((v) => v.id), ["201", "202", "205", "203", "204"], "the earlier page in front, in its own order");
  assert.deepEqual(rowsOf(card).map((r) => r.getAttribute("data-say")), ["201", "205", "204"], "the reply now sits in its circle");
  assert.equal(card.querySelector("[data-fold]").textContent, "2 replies");
  assert.equal(card.querySelectorAll("[data-new]").length, 0, "lines that were only off the screen are not new replies");
  assert.equal(card.querySelector("[data-room-voices-more]"), null, "nothing left behind the cursor: no button");
  assert.equal(card.querySelector("[data-room-voices-page]").hidden, true);
  assert.equal(o.asked.length, 2);
});

test("PARTIAL: a failed continuation says so, keeps what is shown, and can be asked again (one read per press)", async () => {
  const doc = makeDoc(), { card, reader } = cardOf(doc);
  const first = [MODERN[3]];
  const pg = page(first, { total: 4, served: 1, complete: false, earlier: { remaining: 3, before_ms: MODERN[3].at_ms, before: MODERN[3].at } });
  const o = office([answer(first, pg), Object.assign(new Error("offline")), answer(MODERN.slice(0, 3), page(MODERN.slice(0, 3), { total: 4 }))]);
  await drawRoomVoices({ doc, card, reader, roomId: ROOM, base: BASE, fetchImpl: o.fetchImpl });
  await press(card.querySelector("[data-room-voices-more]"));
  const failed = card.querySelector("[data-room-voices-failed]");
  assert.equal(failed.textContent, ROOM_VOICES_WORDS.moreFailed);
  assert.equal(failed.getAttribute("role"), "status");
  assert.equal(rowsOf(card).length, 1, "what was shown stands");
  assert.equal(card.querySelector("[data-room-voices-more]").disabled, false);
  await press(card.querySelector("[data-room-voices-more]"));
  assert.equal(card.querySelector("[data-room-voices-failed]"), null);
  assert.equal(card.__t.voices.length, 4);
  assert.equal(o.asked.length, 3);
});

// ── (5) an office without the lines ──

test("LEGACY: an office that answers without lines keeps the World's reader, through the one setup, handed the answer already held (no second read)", async () => {
  const doc = makeDoc(), { card, reader, floor } = cardOf(doc);
  const legacy = answer(null, null);
  const o = office([legacy]);
  const log = [];
  const fakeReader = { createCircleReader: (opts) => { log.push(opts); return { showRoom: async (id) => { log.push(["room", await opts.source.room(id)]); }, showCircle: async () => {} }; } };
  const m = await drawRoomVoices({ doc, card, reader, roomId: ROOM, base: BASE, fetchImpl: o.fetchImpl, readerOptions: { importImpl: async () => fakeReader, hostOwnsHeader: true, hrefForCircle: (c) => `/conversations/#circle-${c}` } });
  assert.deepEqual(m, { ok: true, drawn: "reader" });
  assert.equal(o.asked.length, 1, "the reader's first room read is the answer already held");
  assert.equal(log[1][1], legacy);
  assert.equal(log[0].host, reader, "mounted in the card's reader host");
  assert.equal(log[0].hostOwnsHeader, true);
  assert.equal(log[0].hrefForCircle("9"), "/conversations/#circle-9", "with the page's own reader options");
  assert.equal(card.querySelector("ol.c-voices"), null, "no pane of lines it was not given");
  assert.ok(floor.parentNode === reader, "the floor is the page's to clear");
  // a second room read (the reader's retry) asks the office again
  await assert.rejects(log[0].source.room(ROOM), /no answer left/);
});

test("LEGACY without the reader: says the reader is not here (the page's own words), never an empty room", async () => {
  const doc = makeDoc(), { card, reader } = cardOf(doc);
  const m = await drawRoomVoices({ doc, card, reader, roomId: ROOM, base: BASE, fetchImpl: office([answer(null, null)]).fetchImpl, readerOptions: { importImpl: async () => { throw new Error("no module"); } } });
  assert.equal(m.ok, false);
  assert.equal(m.failed, undefined, "not a failed read: the page says its reader is not here");
});

// ── (6) failure and unsaid pages ──

test("FAILED: a refused or failed read says so in the room's floor, with one way to ask again; nothing is drawn as if empty", async () => {
  for (const bad of [{ status: 503, body: { defect: "busy" } }, new Error("network"), { status: 200, body: "not json" }]) {
    const doc = makeDoc(), { card, reader, floor } = cardOf(doc);
    const m = await drawRoomVoices({ doc, card, reader, roomId: ROOM, base: BASE, fetchImpl: office([bad]).fetchImpl });
    assert.equal(m.ok, false); assert.equal(m.failed, true);
    assert.equal(card.querySelector("ol.c-voices"), null);
    let retried = 0;
    sayRoomFailed(doc, floor, () => { retried++; });
    assert.equal(floor.getAttribute("role"), "status");
    assert.match(floor.textContent, /^This room's statements couldn't be read just now\. That is not the same as it being empty\. Try again$/);
    const b = floor.querySelector("button");
    await press(b); assert.equal(retried, 1); assert.equal(b.disabled, true);
  }
});

test("UNSAID: lines with no page say the office didn't say whether they are all; an empty whole page says nothing was said", async () => {
  let doc = makeDoc(), c = cardOf(doc);
  await drawRoomVoices({ doc, card: c.card, reader: c.reader, roomId: ROOM, base: BASE, fetchImpl: office([answer(OLD, null)]).fetchImpl });
  assert.equal(c.card.querySelector("[data-room-voices-words]").textContent, ROOM_VOICES_WORDS.unsaid);
  assert.equal(c.card.querySelector("[data-room-voices-page]").hidden, false);
  assert.equal(c.card.__t.voice_count, 4, "the count is what was served when the office gave no total");
  doc = makeDoc(); c = cardOf(doc);
  await drawRoomVoices({ doc, card: c.card, reader: c.reader, roomId: ROOM, base: BASE, fetchImpl: office([answer([], page([]))]).fetchImpl });
  assert.equal(c.card.querySelector("[data-room-voices-words]").textContent, ROOM_VOICES_WORDS.none.record, "the record's empty page: nothing recorded");
});

// ── (8) what the lines were read from (Facet's return review of 8148db13, Finding 1) ──
// Office #1229's MEMORY path is a valid source: it keeps only the last voices it heard, and may say `complete: true` within that memory. The page must
// never pass that memory off as the room's whole history; only the record's page reads as the room's.

const sourced = (body, { page: pageSource, find: findSource }) => {
  const f = { ...body.find };
  if (findSource === undefined) delete f.source; else f.source = findSource;
  if (f.voices_page) { f.voices_page = { ...f.voices_page }; if (pageSource === undefined) delete f.voices_page.source; else f.voices_page.source = pageSource; }
  return { ...body, find: f };
};
const drawn = async (body) => {
  const doc = makeDoc(), c = cardOf(doc);
  const o = office([body]);
  await drawRoomVoices({ doc, card: c.card, reader: c.reader, roomId: ROOM, base: BASE, fetchImpl: o.fetchImpl });
  const box = c.card.querySelector("[data-room-voices-page]");
  return { card: c.card, box, words: c.card.querySelector("[data-room-voices-words]").textContent, shown: !box.hidden };
};

test("SOURCE: the page's own source is kept, else the answer's; neither is unknown, never assumed the record", () => {
  const body = answer(OLD, page(OLD));
  assert.equal(voicesOf(sourced(body, { page: "memory", find: "record" })).source, "memory", "the page's own word first");
  assert.equal(voicesOf(sourced(body, { page: undefined, find: "memory" })).source, "memory", "else the answer's");
  assert.equal(voicesOf(sourced(body, { page: undefined, find: undefined })).source, null);
  assert.equal(voicesOf(sourced(body, { page: " ", find: 7 })).source, null, "nothing that is not a word is taken for one");
  assert.equal(voicesOf(sourced(answer(OLD, null), { find: "memory" })).source, "memory", "lines with no page still say what they were read from");
});

test("FALSIFIER: a MEMORY page that says complete:true, with no earlier cursor, still says it is the office's memory and not the whole room", async () => {
  for (const s of [{ page: "memory", find: "memory" }, { page: undefined, find: "memory" }]) {
    const r = await drawn(sourced(answer(MODERN, page(MODERN, { complete: true })), s));
    assert.equal(r.shown, true, "the note is shown");
    assert.equal(r.words, ROOM_VOICES_WORDS.memory);
    assert.match(r.words, /memory .* keeps only the last things it heard, so this room may hold more than is shown here\./);
    assert.equal(r.card.querySelector("[data-room-voices-more]"), null, "no control is invented");
    assert.equal(rowsOf(r.card).length, 2, "the lines are drawn as served");
  }
});

test("MEMORY partial and empty: the count is the memory's, never 'this room holds'; empty memory never says nothing is recorded", async () => {
  const first = [MODERN[3]];
  const part = await drawn(sourced(answer(first, page(first, { total: 4, served: 1, complete: false, earlier: { remaining: 3, before_ms: MODERN[3].at_ms, before: MODERN[3].at } })), { page: "memory", find: "memory" }));
  assert.equal(part.words, "This office's memory holds 4 statements from this room. The newest 1 are shown below in full; the 3 said before them are not shown yet. " + ROOM_VOICES_WORDS.memory);
  assert.equal(/This room holds/.test(part.words), false);
  assert.ok(part.card.querySelector("[data-room-voices-more]"), "the served cursor is still offered");
  const empty = await drawn(sourced(answer([], page([])), { page: "memory", find: "memory" }));
  assert.equal(empty.words, ROOM_VOICES_WORDS.none.memory);
  assert.equal(/recorded/.test(empty.words), false);
});

test("UNKNOWN coverage: a page that names no source says so, complete, partial or empty; it is never read as the record", async () => {
  const none = { page: undefined, find: undefined };
  const whole = await drawn(sourced(answer(MODERN, page(MODERN)), none));
  assert.equal(whole.shown, true); assert.equal(whole.words, ROOM_VOICES_WORDS.unknown);
  const other = await drawn(sourced(answer(MODERN, page(MODERN)), { page: "cache", find: "cache" }));
  assert.equal(other.words, ROOM_VOICES_WORDS.unknown, "a source this site does not know is not the record");
  const first = [MODERN[3]];
  const part = await drawn(sourced(answer(first, page(first, { total: 4, served: 1, complete: false, earlier: { remaining: 3, before_ms: MODERN[3].at_ms, before: MODERN[3].at } })), none));
  assert.equal(part.words, `This answer counts 4 statements in this room. ${ROOM_VOICES_WORDS.earlier(1, 3)} ${ROOM_VOICES_WORDS.unknown}`);
  const empty = await drawn(sourced(answer([], page([])), none));
  assert.equal(empty.words, ROOM_VOICES_WORDS.none.unknown);
  const unpaged = await drawn(sourced(answer(OLD, null), { find: undefined }));
  assert.equal(unpaged.words, ROOM_VOICES_WORDS.unsaid, "no page and no source: the one honest line, not two");
});

test("RECORD unchanged: a whole record page says nothing more; lines with no page from memory say both things", async () => {
  const whole = await drawn(answer(MODERN, page(MODERN)));
  assert.equal(whole.shown, false); assert.equal(whole.words, "");
  const fromFind = await drawn(sourced(answer(MODERN, page(MODERN)), { page: undefined, find: "record" }));
  assert.equal(fromFind.shown, false, "the answer's own `record` when the page names none");
  const unpaged = await drawn(sourced(answer(OLD, null), { find: "memory" }));
  assert.equal(unpaged.words, `${ROOM_VOICES_WORDS.unsaid} ${ROOM_VOICES_WORDS.memory}`);
});

test("CONTINUATION: earlier lines read from memory make a record pane say so; a record continuation keeps the record's words", async () => {
  const first = [MODERN[2], MODERN[3]];
  const firstPage = page(first, { total: 4, served: 2, complete: false, earlier: { remaining: 2, before_ms: MODERN[2].at_ms, before: MODERN[2].at } });
  const second = [MODERN[0], MODERN[1]];
  for (const [src, want] of [["memory", ROOM_VOICES_WORDS.memory], ["record", ""]]) {
    const doc = makeDoc(), c = cardOf(doc);
    const o = office([answer(first, firstPage), sourced(answer(second, page(second, { total: 4, later_not_served: 2 })), { page: src, find: src })]);
    await drawRoomVoices({ doc, card: c.card, reader: c.reader, roomId: ROOM, base: BASE, fetchImpl: o.fetchImpl });
    await press(c.card.querySelector("[data-room-voices-more]"));
    assert.equal(c.card.__t.voices.length, 4);
    // the continuation's own "later" count is the lines already shown (its cursor's doing), so it is not said again
    assert.equal(c.card.querySelector("[data-room-voices-words]").textContent, want);
  }
});

// ── (7) the Conversations page and the event page's binding ──

test("CONVERSATIONS UNCHANGED: without circleHref the drawing's Open is the page's own #circle-<id>, and that page hands none", () => {
  const doc = makeDoc();
  const el = (tag, cls, text) => { const n = doc.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = String(text); return n; };
  const d = createRoomDrawing({ doc, el, faceNode: () => el("span", "c-face"), personLink: (h) => el("a", "c-who", h), humanOf: () => null, dateTimeOf: () => "", canReply: () => false, facesKey: () => null, pinNext: () => false, onReply: () => {} });
  const card = el("div", "c-thread"); card.appendChild(el("ol", "c-voices"));
  d.drawRoom(card, { voices: OLD, voice_count: 4 });
  assert.deepEqual(card.querySelectorAll("[data-circle-open]").map((a) => a.href), ["#circle-101", "#circle-102", "#circle-103"], "the default is what it always was");
  const make = CONVO.slice(CONVO.indexOf("rooms = make({"), CONVO.indexOf("return rooms;", CONVO.indexOf("rooms = make({")));
  assert.ok(make.length > 0);
  assert.equal(/circleHref/.test(make), false, "the Conversations page hands no circleHref");
});

test("PIN the event page draws a room through room-voices.mjs on its first open, and says a failed read with the retry", () => {
  assert.match(EVENT, /^\s*import \{ drawRoomVoices, sayRoomFailed \} from "@\/lib\/room-voices\.mjs";$/m);
  const draw = EVENT.slice(EVENT.indexOf("const drawRoom = async"), EVENT.indexOf("const build = (ids)"));
  assert.match(draw, /if \(m\.failed\) \{ sayRoomFailed\(document, floor, \(\) => drawRoom\(box, id\)\); return; \}/);
  assert.match(EVENT, /box\.addEventListener\("toggle", mount\);/, "still drawn the first time the room is opened");
});
