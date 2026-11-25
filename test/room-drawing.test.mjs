// room-drawing.test.mjs — the site's ONE room drawing (CORE-156's B), shared by CORE-177: src/lib/room-drawing.mjs.
//
//   node --test test/room-drawing.test.mjs
//
// Wright 2026-11-25 03:54 (CORE-177): an event's rooms use "the site's existing CORE-156 B room drawing"; 04:14: build what doesn't need the new read
// (POS-1232). So the Conversations page's drawing was moved, unchanged, into one module the page draws every room through. WHAT THIS HOLDS, running the
// IMPORTED MODULE over a small DOM and the thread `voices` the office serves today (test/fixtures/circles.sample.json, invented speech):
//   (1) B: every opening message whole; under one with replies, ONE button counting its whole circle; it opens the whole circle in place, every level,
//       and folds it; ancestry only from a served `reply_to`, a reply whose parent the read lacks drawn as itself and saying so;
//   (2) a reply landing in a folded circle is offered as "N new", and pressing it shows it marked; an open circle takes it at once;
//   (3) a poll that moved nothing redraws nothing; focus and open circles survive a redraw; the faces and the sign-in are read live, each time;
//   (4) Reply names the say the office served (the host decides what that means); keys and controlled ids are unique, across hosts too;
//   (5) the production binding: the page's own ROOM-DRAW glue draws through this module once the module script hands it over, and not before;
//   (6) a SECOND host (an ordinary fixture, not the event page: event rooms wait on POS-1232) draws the same input the same way.
// What the page draws in a real browser stays test/conversations-circles.test.mjs ("B ·").

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRoomDrawing, roomShape } from "../src/lib/room-drawing.mjs";

const FX = JSON.parse(readFileSync(new URL("./fixtures/circles.sample.json", import.meta.url), "utf8"));
const LINES = FX.views.flat_lines.map((l) => ({ handle: l.handle, standing: l.standing, said: l.said, at: l.at, at_ms: l.at_ms, ...(l.id ? { id: l.id } : {}), ...(l.reply_to ? { reply_to: l.reply_to } : {}) }));
const page = readFileSync(new URL("../town/pages/conversations/index.astro", import.meta.url), "utf8");

// ── a small DOM ──
function makeDoc() {
  const doc = { activeElement: null };
  const matches = (n, sel) => sel.split(",").some((s) => {
    s = s.trim();
    const a = /^\[([\w-]+)\]$/.exec(s); if (a) return n.hasAttribute(a[1]);
    const c = /^\.([\w-]+)$/.exec(s); if (c) return n.className.split(/\s+/).includes(c[1]);
    return n.tagName === s.toUpperCase();
  });
  const walk = (n, fn) => { for (const c of n.children) { fn(c); walk(c, fn); } };
  doc.createElement = (tag) => {
    const n = {
      tagName: String(tag).toUpperCase(), children: [], parentNode: null, attrs: {}, className: "", id: "", title: "", type: "", tabIndex: 0, href: "", _text: "",
      scrollTop: 0,
      get childNodes() { return this.children; },
      get textContent() { return this._text + this.children.map((c) => c.textContent).join(""); },
      set textContent(v) { this.children.forEach((c) => { c.parentNode = null; }); this.children = []; this._text = String(v); },
      appendChild(c) { c.parentNode = this; this.children.push(c); return c; },
      setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }, hasAttribute(k) { return k in this.attrs; },
      querySelector(sel) { let hit = null; walk(this, (c) => { if (!hit && matches(c, sel)) hit = c; }); return hit; },
      querySelectorAll(sel) { const out = []; walk(this, (c) => { if (matches(c, sel)) out.push(c); }); return out; },
      closest(sel) { let n = this; while (n) { if (n.attrs && matches(n, sel)) return n; n = n.parentNode; } return null; },
      contains(o) { let n = o; while (n) { if (n === this) return true; n = n.parentNode; } return false; },
      focus() { doc.activeElement = this; },
      getBoundingClientRect() { return { top: 0, bottom: 0, height: 0 }; },
      scrollIntoView() { this.scrolled = true; },
    };
    return n;
  };
  return doc;
}
// a host: its own node maker, faces, name links, and its live getters
function hostOf(doc, over = {}) {
  const state = { reply: false, faces: null, pin: false, replies: [] };
  const el = (tag, cls, text) => { const n = doc.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = String(text); return n; };
  const host = {
    doc, el,
    faceNode: (h) => el("span", "c-face", String(h).slice(0, 1).toUpperCase()),
    personLink: (h) => { const a = el("a", "c-who", h); a.href = `/residents/${h}/`; return a; },
    humanOf: () => null, dateTimeOf: (iso) => iso,
    canReply: () => state.reply, facesKey: () => state.faces, pinNext: () => state.pin,
    onReply: (d) => state.replies.push(d),
    ...over,
  };
  return { host, state, drawing: createRoomDrawing(host) };
}
function card(doc) { const c = doc.createElement("article"); const list = doc.createElement("ol"); list.className = "c-voices"; c.appendChild(list); return { c, list }; }
const thread = (voices, extra = {}) => ({ id: "t-room-test", voices, voice_count: voices.length, latest: voices.at(-1)?.at ?? null, ...extra });
const tops = (list) => list.children.filter((n) => n.className.split(" ").includes("c-voice"));
const press = (d, c, n) => d.roomPress(c, { target: n });

test("B: every opening message WHOLE, one button counting its whole circle, opening every level in place and folding again", () => {
  const doc = makeDoc(); const { drawing } = hostOf(doc); const { c, list } = card(doc);
  c.__t = thread(LINES);
  assert.equal(drawing.drawRoom(c, c.__t), true);
  const shape = roomShape(LINES);
  assert.deepEqual(tops(list).map((n) => n.getAttribute("data-say")), shape.tops.map((n) => String(n.v.id)), "the opening messages, in the order said");
  for (const n of tops(list)) {
    const served = LINES.find((l) => String(l.id) === n.getAttribute("data-say"));
    assert.equal(n.querySelector(".c-said").textContent, served.said, "the whole words, never cut");
  }
  const folds = list.querySelectorAll(".c-fold");
  assert.deepEqual(folds.map((b) => b.textContent), ["9 replies", "2 replies"], "one button per message with replies, counting its WHOLE circle");
  assert.equal(list.querySelectorAll(".c-kids").length, 0, "folded at first");
  press(drawing, c, folds[0]);
  const open = list.querySelector(".c-fold");
  assert.equal(open.getAttribute("aria-expanded"), "true");
  const kids = list.querySelector(".c-kids");
  assert.equal(kids.id, open.getAttribute("aria-controls"), "the button controls the circle it opened");
  assert.equal(kids.querySelectorAll(".c-voice").length, 9, "every level at once");
  assert.ok(kids.hasAttribute("data-circle") && kids.querySelector(".c-ring-row"), "the circle on its line");
  press(drawing, c, list.querySelector(".c-fold"));
  assert.equal(list.querySelectorAll(".c-kids").length, 0, "and folded again");
});

test("ancestry is ONLY a served reply_to: a reply whose parent this read lacks is drawn as itself, says so, and is never re-parented", () => {
  const doc = makeDoc(); const { drawing } = hostOf(doc); const { c, list } = card(doc);
  c.__t = thread([LINES[0], { handle: "seth", said: "about the far table", at: "2026-11-14T20:05:00.000Z", at_ms: 1794686700000, id: 60001, reply_to: 59999 }]);
  drawing.drawRoom(c, c.__t);
  const loose = tops(list)[1];
  assert.equal(loose.getAttribute("data-say"), "60001");
  assert.equal(loose.querySelector(".c-loose").textContent, "A reply to an earlier message that isn't shown here.");
  assert.equal(list.querySelectorAll(".c-fold").length, 0, "no one is given it as a reply");
});

test("a reply landing in a FOLDED circle is offered as 'N new' and shown marked when pressed; an OPEN circle takes it at once", () => {
  const doc = makeDoc(); const { drawing } = hostOf(doc); const { c, list } = card(doc);
  c.__t = thread(LINES); drawing.drawRoom(c, c.__t);
  const later = { handle: "claran", said: "Sour enough for me.", at: "2026-11-14T21:00:00.000Z", at_ms: 1794690000000, id: 50200, reply_to: 50102 };
  c.__t = thread([...LINES, later]); assert.equal(drawing.drawRoom(c, c.__t), true);
  const fresh = list.querySelector(".c-fold-new");
  assert.equal(fresh.textContent, "1 new");
  press(drawing, c, fresh);
  const row = list.querySelectorAll(".c-voice").find((n) => n.getAttribute("data-say") === "50200");
  assert.ok(row.className.includes("is-new"), "on screen, marked new"); assert.equal(row.scrolled, true, "brought into view");
  // the circle is open now: the next reply into it lands at once, marked, with no offer
  const again = { handle: "pica", said: "Told you.", at: "2026-11-14T21:01:00.000Z", at_ms: 1794690060000, id: 50201, reply_to: 50200 };
  c.__t = thread([...LINES, later, again]); drawing.drawRoom(c, c.__t);
  assert.ok(list.querySelectorAll(".c-voice").find((n) => n.getAttribute("data-say") === "50201").className.includes("is-new"));
  assert.equal(list.querySelector(".c-fold-new"), null);
});

test("a poll that moved nothing redraws nothing; focus survives a redraw; the sign-in and the faces are read LIVE at each drawing", () => {
  const doc = makeDoc(); const { drawing, state } = hostOf(doc); const { c, list } = card(doc);
  c.__t = thread(LINES); drawing.drawRoom(c, c.__t);
  assert.equal(drawing.drawRoom(c, thread(LINES)), false, "nothing moved: no redraw");
  assert.equal(list.querySelectorAll("[data-reply]").length, 0, "signed out: no Reply");
  // focus a button, then the talk moves: the redraw puts focus back on the same control (a new node, the same key)
  const fold = list.querySelector(".c-fold"); fold.focus();
  c.__t = thread([...LINES, { handle: "noe", said: "Evening.", at: "2026-11-14T22:00:00.000Z", at_ms: 1794693600000, id: 50300 }]);
  assert.equal(drawing.drawRoom(c, c.__t), true);
  assert.notEqual(doc.activeElement, fold); assert.equal(doc.activeElement.getAttribute("data-key"), fold.getAttribute("data-key"));
  // signing in is read at the next drawing, with no talk moved
  state.reply = true; assert.equal(drawing.drawRoom(c, c.__t), true);
  assert.deepEqual(list.querySelectorAll("[data-reply]").map((b) => b.getAttribute("data-reply")), ["50101", "50107", "50114", "50300"]);
  state.faces = { pica: {} }; assert.equal(drawing.drawRoom(c, c.__t), true, "the pictures landing redraws");
});

test("Reply names exactly the say the office served on that line; the host says what it means", () => {
  const doc = makeDoc(); const { drawing, state } = hostOf(doc); const { c, list } = card(doc);
  state.reply = true; c.__t = thread(LINES); drawing.drawRoom(c, c.__t);
  press(drawing, c, list.querySelector("[data-reply]"));
  assert.deepEqual(state.replies, [{ id: 50101, handle: "pica", said: LINES[0].said }]);
});

test("keys and controlled ids are unique: across two cards and across two hosts on one page", () => {
  const doc = makeDoc();
  const a = hostOf(doc), b = hostOf(doc);
  const ca = card(doc), cb = card(doc), cc = card(doc);
  for (const [d, x] of [[a.drawing, ca], [a.drawing, cb], [b.drawing, cc]]) { x.c.__t = thread(LINES); d.drawRoom(x.c, x.c.__t); press(d, x.c, x.list.querySelector(".c-fold")); }
  const ids = [ca, cb, cc].map((x) => x.list.querySelector(".c-kids").id);
  assert.equal(new Set(ids).size, 3, `three open circles, three ids: ${ids.join(", ")}`);
  const keys = ca.list.querySelectorAll("[data-key]").map((n) => n.getAttribute("data-key"));
  assert.equal(new Set(keys).size, keys.length, "every control in a pane has its own key");
});

test("A SECOND HOST (an ordinary fixture, not the event page) draws the same input the same way through the same module", () => {
  const doc = makeDoc();
  const conversations = hostOf(doc), other = hostOf(doc, { personLink: (h) => { const s = doc.createElement("span"); s.className = "c-who"; s.textContent = h; return s; } });
  const one = card(doc), two = card(doc);
  one.c.__t = thread(LINES); two.c.__t = thread(LINES);
  conversations.drawing.drawRoom(one.c, one.c.__t); other.drawing.drawRoom(two.c, two.c.__t);
  const keysOf = (l) => l.querySelectorAll("[data-key]").map((n) => n.getAttribute("data-key"));
  assert.deepEqual(keysOf(two.list), keysOf(one.list), "the same messages and controls, in the same order");
  assert.deepEqual(two.list.querySelectorAll(".c-said").map((n) => n.textContent), one.list.querySelectorAll(".c-said").map((n) => n.textContent));
  assert.equal(two.list.querySelector(".c-who").tagName, "SPAN", "only what the host hands in is the host's");
});

// ── the production binding: the page's own glue (ROOM-DRAW) over the imported module ──
const g0 = page.indexOf("// ROOM-DRAW:BEGIN"), g1 = page.indexOf("// ROOM-DRAW:END");
assert.ok(g0 > -1 && g1 > g0, "the page still carries its ROOM-DRAW glue");
const GLUE = page.slice(g0, g1);

test("PRODUCTION BINDING: the page draws every room through this module once its module script hands it over, and keeps its pane until then", () => {
  const doc = makeDoc();
  const listeners = {};
  const document = Object.assign(doc, { addEventListener: (ev, fn) => { listeners[ev] = fn; }, dispatchEvent: () => {} });
  const window = {};
  const liveBox = { querySelectorAll: () => [] }, closedBox = { querySelectorAll: () => [] };
  const el = (tag, cls, text) => { const n = doc.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = String(text); return n; };
  const api = new Function("document", "window", "hook", "el", "faceNode", "personLink", "humanOf", "dateTimeOf", "faces", "pinNext", "liveBox", "closedBox", "statementsWords", "ensureReader", "poller", "CustomEvent",
    `${GLUE}\nreturn { drawRoom, roomPress, drawEarlier, redrawRooms };`)(
    document, window, () => null, el, (h) => el("span", "c-face", h[0]), (h) => el("a", "c-who", h), () => null, (i) => i, null, false, liveBox, closedBox, () => "", () => null, { state: () => ({ fails: 0 }) }, class {});
  const { c, list } = card(doc);
  c.__t = thread(LINES);
  assert.equal(api.drawRoom(c, c.__t), false, "before the module script runs: nothing drawn, the pane stands");
  assert.equal(api.drawEarlier(c, c.__t), undefined);
  assert.equal(typeof listeners["pm:rooms-ready"], "function", "the page waits for the drawing to be handed over");
  window.__pmRoomDrawing = createRoomDrawing;          // what the module script does
  assert.equal(api.drawRoom(c, c.__t), true, "then every room is drawn by the shared module");
  assert.equal(tops(list).length, 3); assert.deepEqual(list.querySelectorAll(".c-fold").map((b) => b.textContent), ["9 replies", "2 replies"]);
  // the module script: imports the module and hands it over, then says so
  assert.match(page, /^    import \{ createRoomDrawing \} from "@\/lib\/room-drawing\.mjs";$/m);
  assert.match(page, /window\.__pmRoomDrawing = createRoomDrawing;\n    document\.dispatchEvent\(new CustomEvent\("pm:rooms-ready"\)\);/);
  // and no second copy of the drawing is left on the page
  for (const gone of ["function roomShape", "function voiceRow", "function foldRow", "function kidsList", "function anchorOf"]) assert.equal(page.includes(gone), false, `${gone} lives only in the module`);
});
