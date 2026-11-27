// conversations-room-permalink.test.mjs — an event's "whole conversation" link opens its room, a historical one too (CORE-177).
//
//   node --test test/conversations-room-permalink.test.mjs
//
// The event page links a room's whole talk as `/conversations/?room=<id>` (calendar.mjs § roomPermalink): a QUERY, so it never shares the fragment
// namespace of the lists' card anchors (`/conversations/#<id>`, any id, `room-abc` included). The conversations page's ONE-CONVERSATION view opens it the
// way it opens `#circle-<id>`: it asks the office's NAMED room read (`?room=<id>`, the keyless read that resolves the id it is given, a historical room or
// another spelling of it, and answers with the room's own canonical header), and mounts the same shared reader on that header's id. So the room needs no
// list page to hold it first (the ordinary list is memory-first and paginated: POS-1218's list contract). WHAT THIS HOLDS:
//   (1) a room ABSENT from every list, asked under an invented spelling the office resolves to a different canonical header, opens: one named read, the
//       requested id as written, the header and the mount on the office's canonical id, and no list read or crawl;
//   (2) a refused or unreachable room is said, with a way to try again, never an empty or unrelated room;
//   (3) unchanged: #circle- links, every bare #<id> card anchor (`#room-abc` too), no address at all, and the reader's own move to a circle;
//   (4) Back and Forward: the view follows the address (a circle opened inside a room's view, back to the room, out to the lists and forward again);
//   (5) the page's door: a room view's first read is the named answer already held, spent once; a circle's priming is unchanged;
//   (6) the production binding: the event page's link is the address this page parses, for any opaque id.
// The page's own inline block (SELECTED-VIEW) and its door run here over a small DOM, a fake office and a fake reader hook: no browser. EVERY
// IDENTITY IS INVENTED.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { roomPermalink, roomHref } from "../src/lib/calendar.mjs";

const page = readFileSync(new URL("../town/pages/conversations/index.astro", import.meta.url), "utf8");
const EVENT = readFileSync(new URL("../town/pages/events/[host]/[slug].astro", import.meta.url), "utf8");
const a = page.indexOf("// SELECTED-VIEW:BEGIN"), b = page.indexOf("// SELECTED-VIEW:END");
assert.ok(a > -1 && b > a, "the page still carries its SELECTED-VIEW block");
const BLOCK = page.slice(a, b);
const elStart = page.indexOf("function el(tag, cls, text) {");
const EL = page.slice(elStart, page.indexOf("\n      }\n", elStart) + "\n      }\n".length);
const API = "/api/world/conversations";
const SITE = "https://postmark.town";

// ── a small DOM ──
function node(tag) {
  const n = {
    tag, className: "", textContent: "", hidden: false, attrs: {}, children: [], parentNode: null, listeners: {}, href: "", type: "", scrolled: false,
    classList: { set: new Set(), add(c) { this.set.add(c); }, remove(c) { this.set.delete(c); }, toggle(c, on) { if (on) this.set.add(c); else this.set.delete(c); }, contains(c) { return this.set.has(c); } },
    setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null },
    appendChild(c) { c.parentNode?.children && (c.parentNode.children = c.parentNode.children.filter((x) => x !== c)); c.parentNode = this; this.children.push(c); return c; },
    insertBefore(c, ref) { c.parentNode = this; const i = this.children.indexOf(ref); this.children.splice(i < 0 ? this.children.length : i, 0, c); return c; },
    after(c) { const p = this.parentNode; c.parentNode = p; p.children.splice(p.children.indexOf(this) + 1, 0, c); },
    remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter((x) => x !== this); this.parentNode = null; },
    addEventListener(ev, fn) { this.listeners[ev] = fn; },
    scrollIntoView() { this.scrolled = true; },
    querySelector(sel) { return find(this, sel); },
    querySelectorAll() { return []; },
  };
  Object.defineProperty(n, "className", { get() { return [...n.classList.set].join(" "); }, set(v) { n.classList.set = new Set(String(v).split(/\s+/).filter(Boolean)); } });
  return n;
}
function matches(n, sel) {
  const attr = /^\[([\w-]+)\]$/.exec(sel); if (attr) return attr[1] in n.attrs;
  const cls = /^\.([\w-]+)$/.exec(sel); if (cls) return n.classList?.contains(cls[1]);
  return false;
}
function find(root, sel) { for (const c of root.children ?? []) { if (matches(c, sel)) return c; const f = find(c, sel); if (f) return f; } return null; }

// a page at `url` (path, query and fragment, as a browser holds them); `go(url)` is a history move (Back, Forward) followed by what the page's
// popstate/hashchange listeners do: sync the view to the address
function world({ url = "/conversations/", cards = [], office }) {
  const body = node("body");
  const selBox = body.appendChild(node("section")); selBox.attrs["data-selected"] = ""; selBox.hidden = true;
  const sayEl = body.appendChild(node("form")); sayEl.attrs["data-say"] = "";
  const h1El = body.appendChild(node("h1")); h1El.textContent = "Conversations";
  const byId = new Map(cards.map((id) => { const c = body.appendChild(node("article")); c.id = id; return [id, c]; }));
  const events = [], asked = [], mounts = [], pushed = [];
  const location = {};
  const at = (u) => { const x = new URL(u, location.href || SITE); location.href = x.href; location.search = x.search; location.hash = x.hash; };
  at(url);
  const document = {
    querySelector: (s) => (s === "[data-selected]" ? selBox : s === "[data-say]" ? sayEl : s === ".c-head h1" ? h1El : null),
    createElement: node, createComment: (t) => ({ comment: t, parentNode: null }), createTextNode: (t) => { const n = node("#text"); n.textContent = String(t); return n; },
    documentElement: { classList: node("html").classList },
    dispatchEvent: (e) => events.push(e.type), getElementById: (id) => byId.get(id) ?? null,
  };
  const history = { pushState: (_s, _t, u) => { pushed.push(u); at(u); } };
  const fetch = (u) => { asked.push(u); return office(u); };
  const hook = () => ({ mount: (host, roomId, opts) => { mounts.push({ roomId, opts }); return Promise.resolve({ ok: true, reader: { refresh() {}, destroy() { this.destroyed = true; } } }); } });
  const run = new Function("document", "location", "history", "fetch", "API", "hook", "faceForSpeaker", "wireReaders", "liveBox", "closedBox", "tick", "CustomEvent", "anchored", "poller",
    `${EL}\n${BLOCK}\nreturn { syncSelected, anchorFromHash, selectedHash, get selected() { return selected; } };`);
  class CE { constructor(type) { this.type = type; } }
  const api = run(document, location, history, fetch, API, hook, () => null, () => {}, node("div"), node("div"), () => {}, CE, false, { state: () => ({ fails: 0 }) });
  const go = (u) => { at(u); api.syncSelected(); };
  return { api, location, selBox, h1El, byId, asked, mounts, pushed, events, go };
}
const flush = async () => { for (let i = 0; i < 8; i++) await new Promise((r) => setImmediate(r)); };
const json = (status, body) => Promise.resolve({ ok: status === 200, status, json: async () => body });

// the office's NAMED room read over an invented record: a historical room recorded as `t1790000000123-wren-test`, reachable by that canonical id and
// by an invented other spelling of it (same handle, same second); it is on NO list page. Plus one circle, and one room literally called `abc`.
const CANON = "t1790000000123-wren-test", ALIAS = "t1790000000000-wren-test";
function office(url) {
  const u = new URL(url, SITE);
  if (u.pathname !== API) return json(404, null);
  const room = u.searchParams.get("room"), circle = u.searchParams.get("circle");
  if (room === CANON || room === ALIAS) return json(200, { what: "invented", find: { room: { id: CANON, place: "The Old Quay (invented)", live: false }, circles: { timeline: [] } } });
  if (room === "abc") return json(200, { find: { room: { id: "abc", place: "A room called abc (invented)" } } });
  if (room === "t-refused-test") return json(404, { defect: "no such room in the record (invented)" });
  if (room === "t-offline-test") return Promise.reject(new Error("offline"));
  if (circle === "42" || circle === "7") return json(200, { find: { room: { id: "t-circle-room-test", place: "The Lamp (invented)", live: true } } });
  return json(404, { defect: "not invented here" });
}

test("FALSIFIER: a historical room on NO list page, asked under a spelling the office resolves to a different canonical header, opens in the one-conversation view", async () => {
  const w = world({ url: roomPermalink(ALIAS), cards: ["t-newest-test"], office });
  w.api.syncSelected();
  await flush();
  assert.deepEqual(w.asked, [`${API}?room=${ALIAS}`], "ONE read: the office's named room read, the requested id as written; no list page, no crawl, no guess");
  const sel = w.api.selected;
  assert.equal(sel.rid, ALIAS); assert.equal(sel.cid, null);
  assert.equal(sel.card.getAttribute("data-selected-room"), ALIAS, "the view keeps the address it was asked for");
  assert.equal(sel.room, CANON, "the room is the office's canonical header, not the requested spelling");
  assert.equal(find(sel.card, "[data-selected-place]").textContent, "The Old Quay (invented)", "the place line is the office's header");
  assert.equal(w.mounts.length, 1);
  assert.equal(w.mounts[0].roomId, CANON, "the shared reader is mounted on the canonical room");
  assert.equal(w.mounts[0].opts.circle, null, "on its room, not a circle");
  assert.equal(w.mounts[0].opts.primed?.find?.room?.id, CANON, "the reader is handed the named answer the page already holds (CORE-156's one ask on arrival)");
  assert.equal(typeof w.mounts[0].opts.faceForSpeaker, "function"); assert.equal(typeof w.mounts[0].opts.onNavigate, "function");
  assert.equal("hostOwnsHeader" in w.mounts[0].opts, false, "the reader keeps its own room header (the canonical one), as for a circle");
  assert.equal(w.selBox.hidden, false); assert.equal(w.h1El.textContent, "One conversation");
  assert.equal(w.byId.get("t-newest-test").scrolled, false, "the lists are not consulted or scrolled");
  // the same address again (the poll, a hash event) neither re-asks nor remounts
  w.api.syncSelected(); w.api.anchorFromHash(); await flush();
  assert.equal(w.asked.length, 1); assert.equal(w.mounts.length, 1);
  // the canonical id itself opens the same room
  const c = world({ url: roomPermalink(CANON), office }); c.api.syncSelected(); await flush();
  assert.equal(c.mounts[0].roomId, CANON); assert.deepEqual(c.asked, [`${API}?room=${CANON}`]);
});

test("a refused or unreachable room is SAID, with a way to try again; it is never an empty view or another room", async () => {
  const r = world({ url: roomPermalink("t-refused-test"), office });
  r.api.syncSelected(); await flush();
  const note = find(r.api.selected.card, "[data-selected-note]");
  assert.match(note.textContent, /^The office couldn't open this conversation \(no such room in the record \(invented\)\)\. That is not the same as it being empty\.$/);
  assert.equal(r.mounts.length, 0, "nothing mounted"); assert.equal(find(r.api.selected.card, "[data-selected-place]"), null, "no place is guessed");
  const retry = find(r.api.selected.card, "[data-selected-retry]");
  assert.ok(retry, "Try again"); retry.listeners.click(); await flush();
  assert.deepEqual(r.asked, [`${API}?room=t-refused-test`, `${API}?room=t-refused-test`], "it asks the same named read again");
  const o = world({ url: roomPermalink("t-offline-test"), office });
  o.api.syncSelected(); await flush();
  assert.match(find(o.api.selected.card, "[data-selected-note]").textContent, /couldn't be read just now, so it can't be shown\. That is not the same as it being empty\./);
  assert.equal(o.mounts.length, 0);
});

test("REGRESSION: every bare #<id> stays the lists' card anchor, `#room-abc` included: scrolled to when held, the page stands when not, and nothing is read", async () => {
  for (const id of ["room-abc", "t-held-test", "circle-x", "room-"]) {
    const held = world({ url: `/conversations/#${id}`, cards: [id], office });
    held.api.syncSelected(); held.api.anchorFromHash(); await flush();
    assert.equal(held.api.selected, null, `#${id}: no one-conversation view`);
    assert.equal(held.byId.get(id).scrolled, true, `#${id}: its card is the anchor`);
    assert.deepEqual(held.asked, [], `#${id}: the office is not asked`);
    const gone = world({ url: `/conversations/#${id}`, office });
    gone.api.syncSelected(); gone.api.anchorFromHash(); await flush();
    assert.equal(gone.api.selected, null); assert.deepEqual(gone.asked, [], `#${id} not held: the page stands, as it did`);
  }
  // the card anchor and the permalink of the same opaque id are different addresses, and each does its own thing
  assert.notEqual(new URL(roomHref("room-abc"), SITE).hash, ""); assert.equal(new URL(roomPermalink("room-abc"), SITE).hash, "");
  const p = world({ url: roomPermalink("abc"), cards: ["room-abc", "abc"], office }); p.api.syncSelected(); p.api.anchorFromHash(); await flush();
  assert.deepEqual(p.asked, [`${API}?room=abc`]); assert.equal(p.byId.get("room-abc").scrolled, false); assert.equal(p.byId.get("abc").scrolled, false);
});

test("UNCHANGED: a #circle- link, no address at all, an empty or overlong ?room=, and a circle fragment over a room query (the circle wins)", async () => {
  const c = world({ url: "/conversations/#circle-42", office });
  c.api.syncSelected(); await flush();
  assert.deepEqual(c.asked, [`${API}?circle=42`]); assert.equal(c.mounts[0].roomId, "t-circle-room-test"); assert.equal(c.mounts[0].opts.circle, "42");
  assert.equal(c.api.selected.card.getAttribute("data-selected-card"), "42");
  const none = world({ url: "/conversations/", office });
  none.api.syncSelected(); none.api.anchorFromHash(); await flush();
  assert.equal(none.api.selected, null); assert.deepEqual(none.asked, []);
  for (const u of ["/conversations/?room=", "/conversations/?room=" + "x".repeat(201), "/conversations/?rooms=abc"]) {
    const bad = world({ url: u, office }); bad.api.syncSelected(); await flush();
    assert.equal(bad.api.selected, null, `${u.slice(0, 30)}: not a room address`); assert.deepEqual(bad.asked, []);
  }
  const both = world({ url: `/conversations/?room=${ALIAS}#circle-42`, office }); both.api.syncSelected(); await flush();
  assert.deepEqual(both.asked, [`${API}?circle=42`], "a circle the reader opened inside a room's view is the address's circle");
});

test("BACK AND FORWARD: a circle opened inside a room's view, Back to the room, out to the lists, and Forward again; the page listens for both moves", async () => {
  const w = world({ url: roomPermalink(ALIAS), office });
  w.api.syncSelected(); await flush();
  // the reader opens one of the room's circles: the view follows (a fragment over the room's query) with no remount
  w.mounts[0].opts.onNavigate({ view: "circle", circleId: 7 }); await flush();
  assert.deepEqual(w.pushed, ["#circle-7"]);
  assert.equal(w.location.search, `?room=${ALIAS}`, "the room's query stays under the circle's fragment");
  assert.equal(w.api.selected.cid, "7");
  w.api.syncSelected(); await flush();
  assert.equal(w.mounts.length, 1, "no remount: the view on screen is the address");
  // Back: the room again, from its own named read
  w.go(roomPermalink(ALIAS)); await flush();
  assert.equal(w.api.selected.rid, ALIAS); assert.equal(w.api.selected.cid, null); assert.equal(w.mounts.at(-1).roomId, CANON);
  // the view's own "All conversations" press: the lists, in place
  const backLink = w.api.selected.card.children.find((n) => n.classList.contains("c-selected-back"));
  backLink.listeners.click({ defaultPrevented: false, button: 0, preventDefault() {} });
  assert.equal(w.api.selected, null); assert.equal(w.location.search, ""); assert.equal(w.selBox.hidden, true);
  // Forward: the room view comes back from the query alone (no fragment changed, so it is popstate that carries it)
  w.go(roomPermalink(ALIAS)); await flush();
  assert.equal(w.api.selected.rid, ALIAS);
  assert.match(page, /window\.addEventListener\("popstate", function \(\) \{ syncSelected\(\); \}\);/, "the page follows a history move that changes only the query");
  assert.match(page, /window\.addEventListener\("hashchange", function \(\) \{ syncSelected\(\); anchored = false; tick\(\); \}\);/, "and still every fragment move");
});

// ── the page's door (module script), run over fakes: what the reader is given to read with ──
const d0 = page.indexOf("    window.__pmCircleReaders = {"), d1 = page.indexOf("\n    };\n", d0);
assert.ok(d0 > -1 && d1 > d0, "the page still carries its circle-reader door");
const DOOR = page.slice(d0, d1 + "\n    };\n".length);
function door() {
  const officeAsked = [], mounted = [];
  const office = { room: async (id) => { officeAsked.push(["room", id]); return { find: { room: { id } } }; }, circle: async (id, after) => { officeAsked.push(["circle", id, after]); return { find: { circle_read: { says: 1 } } }; } };
  const win = {};
  new Function("window", "officeSource", "mountRoom", "tokenIsFresh", "__getTok", "OFFICE_BASE", "document", "CustomEvent", DOOR)(
    win, () => office, async (o) => { mounted.push(o); return { ok: true, reader: {} }; }, () => false, () => null, "/api", { dispatchEvent() {} }, class {});
  return { mount: win.__pmCircleReaders.mount, officeAsked, mounted };
}

test("THE DOOR: a room view's reader reads its room first from the named answer the page holds (spent once), through the ONE setup; a circle's priming is unchanged", async () => {
  const answer = { find: { room: { id: CANON, place: "The Old Quay (invented)" } } };
  const d = door();
  await d.mount({}, CANON, { primed: answer, faceForSpeaker: () => null });
  const src = d.mounted[0].source;
  assert.equal(d.mounted[0].roomId, CANON); assert.equal(d.mounted[0].circle, null);
  assert.equal(await src.room(CANON), answer, "the first read of exactly that room is the answer already held");
  assert.deepEqual(d.officeAsked, [], "so the office is not asked again on arrival");
  await src.room(CANON);
  assert.deepEqual(d.officeAsked, [["room", CANON]], "spent once: a later read (a refresh) asks the office");
  // an answer under another room's header is never handed to this room
  const other = door(); await other.mount({}, CANON, { primed: { find: { room: { id: "t-someone-else-test" } } } });
  await other.mounted[0].source.room(CANON); assert.deepEqual(other.officeAsked, [["room", CANON]]);
  // a circle view: its room is read from the office as before, and its circle from the primed answer, the page told of each circle read (CORE-156, unchanged)
  const told = [];
  const c = door(); const circleAnswer = { find: { room: { id: "t-circle-room-test" }, circle_read: { says: 3 } } };
  await c.mount({}, "t-circle-room-test", { circle: "42", primed: circleAnswer, onCircleRead: (id, first) => told.push([id, first]) });
  assert.equal(await c.mounted[0].source.circle("42"), circleAnswer); assert.deepEqual(c.officeAsked, []);
  await c.mounted[0].source.room("t-circle-room-test"); assert.deepEqual(c.officeAsked, [["room", "t-circle-room-test"]], "a circle's priming is not a room's");
  assert.deepEqual(told, [["42", true]]);
  // no priming at all: the plain office reads
  const bare = door(); await bare.mount({}, "t-x-test", {}); await bare.mounted[0].source.room("t-x-test"); assert.deepEqual(bare.officeAsked, [["room", "t-x-test"]]);
});

test("PRODUCTION BINDING: the event page's whole-talk link is the address this page opens, for any opaque id, and the lists' anchors are untouched", () => {
  for (const id of [ALIAS, CANON, 0, 42, "t1-a b", "room-abc", "abc", "t-é/ü?#&=x-test"]) {
    const w = world({ url: roomPermalink(id), office: () => json(404, null) });
    assert.equal(w.location.hash, "", `${String(id)}: the permalink has no fragment`);
    assert.deepEqual(w.api.selectedHash(), { cid: null, rid: String(id) }, `${String(id)}: parsed back exactly, never rewritten`);
  }
  assert.equal(roomHref(ALIAS), `/conversations/#${ALIAS}`, "the lists' card anchor (spark cards, the World map) is unchanged");
  for (const at of ['<a class="c-perma" href={roomPermalink(id)}>', "<a href={roomPermalink(id)}>{id}</a>", "a.href = roomPermalink(id);"]) assert.ok(EVENT.includes(at), `the event page links its whole talk by roomPermalink: ${at}`);
  assert.equal(/roomHref\(/.test(EVENT), false, "and no longer by the card anchor");
  // the selected view mounts through the page's one door with the options it always had
  assert.match(BLOCK, /h\.mount\(sel\.host, String\(sel\.room\), \{\s*circle: sel\.cid, faceForSpeaker: faceForSpeaker,/);
});
