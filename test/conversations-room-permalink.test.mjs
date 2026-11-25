// conversations-room-permalink.test.mjs — an event's "whole conversation" link opens its room, a historical one too (CORE-177).
//
//   node --test test/conversations-room-permalink.test.mjs
//
// The event page links a room's whole talk as `/conversations/#room-<id>` (calendar.mjs § roomPermalink). The conversations page's ONE-CONVERSATION
// view opens it the way it opens `#circle-<id>`: it asks the office's NAMED room read (`?room=<id>`, the keyless read that resolves the id it is given,
// a historical room or another spelling of it, and answers with the room's own canonical header), and mounts the same shared reader on that header's id.
// So the room needs no list page to hold it first (the ordinary list is memory-first and paginated: POS-1218's list contract). WHAT THIS HOLDS:
//   (1) a room ABSENT from every list, asked under an invented spelling the office resolves to a different canonical header, opens: one named read, the
//       requested id as written, the header and the mount on the office's canonical id, and no list read or crawl;
//   (2) a refused or unreachable room is said, with a way to try again, never an empty or unrelated room;
//   (3) unchanged: #circle- links, a bare #<id> card anchor, no hash at all, and the reader's own navigation;
//   (4) the production binding: the event page's link is the address this page parses, for any opaque id.
// The page's own inline block (SELECTED-VIEW) runs here over a small DOM, a fake office and a fake reader hook: no browser. EVERY IDENTITY IS INVENTED.

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
const textOf = (n) => (n.children?.length ? n.children.map(textOf).join(" ") : n.textContent || "");

function world({ hash = "", cards = [], office }) {
  const body = node("body");
  const selBox = body.appendChild(node("section")); selBox.attrs["data-selected"] = ""; selBox.hidden = true;
  const sayEl = body.appendChild(node("form")); sayEl.attrs["data-say"] = "";
  const h1El = body.appendChild(node("h1")); h1El.textContent = "Conversations";
  const byId = new Map(cards.map((id) => { const c = body.appendChild(node("article")); c.id = id; return [id, c]; }));
  const events = [], asked = [], mounts = [], pushed = [];
  const location = { hash };
  const document = {
    querySelector: (s) => (s === "[data-selected]" ? selBox : s === "[data-say]" ? sayEl : s === ".c-head h1" ? h1El : null),
    createElement: node, createComment: (t) => ({ comment: t, parentNode: null }),
    documentElement: { classList: node("html").classList },
    dispatchEvent: (e) => events.push(e.type), getElementById: (id) => byId.get(id) ?? null,
  };
  const history = { pushState: (_s, _t, url) => { pushed.push(url); location.hash = url.startsWith("#") ? url : ""; } };
  const fetch = (url) => { asked.push(url); return office(url); };
  const readers = [];
  const hook = () => ({ mount: (host, roomId, opts) => { mounts.push({ roomId, opts }); const reader = { refreshed: 0, refresh() { this.refreshed++; }, destroy() { this.destroyed = true; } }; readers.push(reader); return Promise.resolve({ ok: true, reader }); } });
  const faceForSpeaker = () => null;
  let anchored = false, ticks = 0;
  const run = new Function("document", "location", "history", "fetch", "API", "hook", "faceForSpeaker", "wireReaders", "liveBox", "closedBox", "tick", "CustomEvent", "anchored",
    `${EL}\n${BLOCK}\nreturn { syncSelected, anchorFromHash, selectedHash, refreshSelected, get selected() { return selected; }, followSelected };`);
  class CE { constructor(type) { this.type = type; } }
  const api = run(document, location, history, fetch, API, hook, faceForSpeaker, () => {}, node("div"), node("div"), () => { ticks++; }, CE, anchored);
  return { api, location, selBox, h1El, byId, asked, mounts, pushed, events, readers };
}
const flush = async () => { for (let i = 0; i < 8; i++) await new Promise((r) => setImmediate(r)); };
const json = (status, body) => Promise.resolve({ ok: status === 200, status, json: async () => body });

// the office's NAMED room read over an invented record: a historical room recorded as `t1790000000123-wren-test`, reachable by that canonical id and
// by an invented other spelling of it (same handle, same second); it is on NO list page. Plus one circle.
const CANON = "t1790000000123-wren-test", ALIAS = "t1790000000000-wren-test";
function office(url) {
  const u = new URL("http://x" + url);
  if (u.pathname !== API) return json(404, null);
  const room = u.searchParams.get("room"), circle = u.searchParams.get("circle");
  if (room === CANON || room === ALIAS) return json(200, { what: "invented", find: { room: { id: CANON, place: "The Old Quay (invented)", live: false }, circles: { timeline: [] } } });
  if (room === "t-refused-test") return json(404, { defect: "no such room in the record (invented)" });
  if (room === "t-offline-test") return Promise.reject(new Error("offline"));
  if (circle === "42") return json(200, { find: { room: { id: "t-circle-room-test", place: "The Lamp (invented)", live: true } } });
  return json(404, { defect: "not invented here" });
}

test("FALSIFIER: a historical room on NO list page, asked under a spelling the office resolves to a different canonical header, opens in the one-conversation view", async () => {
  const w = world({ hash: "#" + roomPermalink(ALIAS).split("#")[1], cards: ["t-newest-test"], office });
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
  assert.equal(typeof w.mounts[0].opts.faceForSpeaker, "function"); assert.equal(typeof w.mounts[0].opts.onNavigate, "function");
  assert.equal("hostOwnsHeader" in w.mounts[0].opts, false, "the reader keeps its own room header (the canonical one), as for a circle");
  assert.equal(w.selBox.hidden, false); assert.equal(w.h1El.textContent, "One conversation");
  assert.equal(w.byId.get("t-newest-test").scrolled, false, "the lists are not consulted or scrolled");
  // the same address again (the poll, a hash event) neither re-asks nor remounts
  w.api.syncSelected(); w.api.anchorFromHash(); await flush();
  assert.equal(w.asked.length, 1); assert.equal(w.mounts.length, 1);
  // the canonical id itself opens the same room
  const c = world({ hash: `#room-${CANON}`, office }); c.api.syncSelected(); await flush();
  assert.equal(c.mounts[0].roomId, CANON); assert.deepEqual(c.asked, [`${API}?room=${CANON}`]);
});

test("a refused or unreachable room is SAID, with a way to try again; it is never an empty view or another room", async () => {
  const r = world({ hash: "#room-t-refused-test", office });
  r.api.syncSelected(); await flush();
  const note = find(r.api.selected.card, "[data-selected-note]");
  assert.match(note.textContent, /^The office couldn't open this conversation \(no such room in the record \(invented\)\)\. That is not the same as it being empty\.$/);
  assert.equal(r.mounts.length, 0, "nothing mounted"); assert.equal(find(r.api.selected.card, "[data-selected-place]"), null, "no place is guessed");
  const retry = find(r.api.selected.card, "[data-selected-retry]");
  assert.ok(retry, "Try again"); retry.listeners.click(); await flush();
  assert.deepEqual(r.asked, [`${API}?room=t-refused-test`, `${API}?room=t-refused-test`], "it asks the same named read again");
  const o = world({ hash: "#room-t-offline-test", office });
  o.api.syncSelected(); await flush();
  assert.match(find(o.api.selected.card, "[data-selected-note]").textContent, /couldn't be read just now, so it can't be shown\. That is not the same as it being empty\./);
  assert.equal(o.mounts.length, 0);
});

test("UNCHANGED: a #circle- link, a bare #<id> card anchor, an id the lists don't hold, no hash, and the reader's own move to a circle", async () => {
  const c = world({ hash: "#circle-42", office });
  c.api.syncSelected(); await flush();
  assert.deepEqual(c.asked, [`${API}?circle=42`]); assert.equal(c.mounts[0].roomId, "t-circle-room-test"); assert.equal(c.mounts[0].opts.circle, "42");
  assert.equal(c.api.selected.card.getAttribute("data-selected-card"), "42");
  // a bare #<id> is the lists' card anchor, as it was: scrolled to when held, the page stands when not; neither opens the one view or asks the office
  const bare = world({ hash: "#t-held-test", cards: ["t-held-test"], office });
  bare.api.syncSelected(); bare.api.anchorFromHash(); await flush();
  assert.equal(bare.api.selected, null); assert.equal(bare.byId.get("t-held-test").scrolled, true); assert.deepEqual(bare.asked, []);
  const gone = world({ hash: `#${ALIAS}`, office });
  gone.api.syncSelected(); gone.api.anchorFromHash(); await flush();
  assert.equal(gone.api.selected, null); assert.deepEqual(gone.asked, [], "a bare id the lists don't hold is not turned into a read");
  const none = world({ hash: "", office });
  none.api.syncSelected(); none.api.anchorFromHash(); await flush();
  assert.equal(none.api.selected, null); assert.deepEqual(none.asked, []);
  for (const h of ["#room-", "#room-" + "x".repeat(201)]) { const bad = world({ hash: h, office }); bad.api.syncSelected(); await flush(); assert.equal(bad.api.selected, null, `${h.slice(0, 12)}: not a room address`); assert.deepEqual(bad.asked, []); }
  // a #room- address is the one view's, never a card to scroll to
  const r = world({ hash: `#room-${CANON}`, cards: [`room-${CANON}`], office }); r.api.anchorFromHash();
  assert.equal(r.byId.get(`room-${CANON}`).scrolled, false);
  // inside a room's view the reader opens one of its circles: the view follows it (its address, a circle), and the next sync keeps it mounted
  const m = world({ hash: `#room-${ALIAS}`, office }); m.api.syncSelected(); await flush();
  m.mounts[0].opts.onNavigate({ view: "circle", circleId: 7 }); await flush();
  assert.deepEqual(m.pushed, ["#circle-7"]); assert.equal(m.api.selected.cid, "7");
  m.api.syncSelected(); await flush();
  assert.equal(m.mounts.length, 1, "no remount: the view on screen is the address");
});

test("PRODUCTION BINDING: the event page's whole-talk link is the address this page opens, for any opaque id, and the lists' anchors are untouched", () => {
  for (const id of [ALIAS, CANON, 0, 42, "t1-a b", "t-é/ü?#x-test"]) {
    const hash = new URL(roomPermalink(id), "https://postmark.town").hash;
    const w = world({ hash, office: () => json(404, null) });
    assert.deepEqual(w.api.selectedHash(), { cid: null, rid: String(id) }, `${String(id)}: parsed back exactly, never rewritten`);
  }
  assert.equal(roomHref(ALIAS), `/conversations/#${ALIAS}`, "the lists' card anchor (spark cards, the World map) is unchanged");
  for (const at of ['<a class="c-perma" href={roomPermalink(id)}>', "<a href={roomPermalink(id)}>{id}</a>", "a.href = roomPermalink(id);"]) assert.ok(EVENT.includes(at), `the event page links its whole talk by roomPermalink: ${at}`);
  assert.equal(/roomHref\(/.test(EVENT), false, "and no longer by the card anchor");
  // the selected view mounts through the page's one door with the options it always had
  assert.match(BLOCK, /h\.mount\(sel\.host, String\(sel\.room\), \{\s*circle: sel\.cid, faceForSpeaker: faceForSpeaker,/);
});
