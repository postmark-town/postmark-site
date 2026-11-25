// room-drawing.mjs — READING A ROOM: the Site's one drawing of a room's talk (CORE-156 "B"), shared (CORE-177).
//
// Darko 2026-11-22 (CORE-156): "Let's keep the circles and replies in, but try to keep the individual messages displayed similarly", then, of the three
// versions he flipped through, "Let's go with B". Wright 2026-11-25 03:54 (CORE-177): an event's rooms use "the site's existing CORE-156 B room drawing";
// 04:14: build what doesn't need the new read (POS-1232). So the drawing the Conversations page made in its own inline script now lives HERE, once, and
// that page draws every room through it. It is the same code, moved: nothing about what it draws or how it behaves changed.
//
// WHAT IT DRAWS, from a thread's `voices` exactly as the office serves them on `GET /api/world/conversations` (who, the whole words, when, and each line's
// own `id` and `reply_to`): every opening message WHOLE (face and name, the words, the time), in the order they were said; under a message that has
// replies, ONE button counting its whole circle (every level), which opens the whole circle in place, every level at once, each reply whole and set in
// under the message it answers, and folds it again; a reply that lands in a folded circle is offered on it as "N new". A line sits under another ONLY
// because the office served that `reply_to` on it; a reply whose parent the read does not hold is drawn as itself and says so. Nothing here asks the
// office anything: the read the host already holds is all it draws from.
//
// WHAT THE HOST KEEPS: the network, the sign-in, the page. A host hands `createRoomDrawing` its few callbacks (how to make a node, a face, a name link, a
// human's house, a date; whether the reader may reply; whether the faces have landed; whether the reader just spoke; what a Reply press means) and calls
// `drawRoom(card, thread, press)` with a card holding an `ol.c-voices` pane, and `roomPress(card, event)` from that pane's click. What the reader has done
// in a room (the circles opened, the lines seen, the new marks, what the pane was drawn from) is kept on the card (`card.__room`), so a poll never undoes
// it. The styles are src/styles/conversation-host.css (READING A ROOM).

// ── WHO ANSWERS WHOM, EXACTLY AS SERVED ──────────────────────────────────
// `roomShape` takes the lines a room's read carries, in the order it carries them (the order they were said), and puts each line under the line its own
// `reply_to` names, when that line is EARLIER IN THIS READ. Nothing else places a line: never a name in the words, never the clock. A line that names no
// parent is an opening message. A line whose parent this read does not hold is `loose`: it is drawn as itself, in its own place in time, and says so; it
// is never given another parent. Every line served is placed exactly once. `total` is every reply under a line, at every level: the number on its button.
export function sayKey(raw) {
  if (raw === null || raw === undefined || raw === "") return null;
  var s = String(raw).trim();
  return /^\d{1,18}$/.test(s) ? s : null;
}
export function roomShape(voices) {
  var lines = Array.isArray(voices) ? voices : [];
  var byId = {}, nodes = [], tops = [];
  lines.forEach(function (v) {
    v = v && typeof v === "object" ? v : {};
    var id = sayKey(v.id);
    var asks = sayKey(v.reply_to);
    var node = {
      v: v, id: id,
      // what a redraw finds this line again by: the office's id, or, for old talk that carries none, when it was said and by whom
      key: id !== null ? "s" + id : "p" + String(v.at_ms != null ? v.at_ms : v.at) + "-" + String(v.handle),
      parent: null, kids: [], total: 0, loose: false,
    };
    var parent = asks !== null && asks !== id && Object.prototype.hasOwnProperty.call(byId, asks) ? byId[asks] : null;
    if (parent) { node.parent = parent; parent.kids.push(node); }
    else { node.loose = asks !== null; tops.push(node); }
    if (id !== null && !Object.prototype.hasOwnProperty.call(byId, id)) byId[id] = node;
    nodes.push(node);
  });
  // a reply always comes after the line it answers, so walking backwards finishes each reply's own count before it is added to its parent's
  for (var i = nodes.length - 1; i >= 0; i--) if (nodes[i].parent) nodes[i].parent.total += 1 + nodes[i].total;
  return { tops: tops, nodes: nodes, byId: byId };
}
export function topOf(node) { while (node.parent) node = node.parent; return node; }
export function eachUnder(node, fn) { node.kids.forEach(function (c) { fn(c); eachUnder(c, fn); }); }
export function repliesWords(n) { return n + (n === 1 ? " reply" : " replies"); }

// ── THE PANE ─────────────────────────────────────────────────────────────
// from this level down a reply is not set in any further (a long back-and-forth must not squeeze its words off a phone); it still sits under what it answers
export var DEEP_AT = 6;
// each card's own number, for the ids an open circle's button controls: counted across EVERY drawing on the page, so two hosts never mint the same id
var roomUid = 0;
export function clockOf(iso) { var m = /T(\d{2}:\d{2})/.exec(String(iso == null ? "" : iso)); return m ? m[1] + "Z" : ""; }
export function isoOf(v) {
  if (v.at) return String(v.at);
  try { return v.at_ms != null && isFinite(v.at_ms) ? new Date(Number(v.at_ms)).toISOString() : ""; } catch (e) { return ""; }
}
export function keyed(list, key) {
  var all = list.querySelectorAll("[data-key]");
  for (var i = 0; i < all.length; i++) if (all[i].getAttribute("data-key") === key) return all[i];
  return null;
}
export function focusKeyed(list, key) {
  var n = keyed(list, key);
  if (n && n.focus) { try { n.focus({ preventScroll: true }); } catch (e) { /* the page stands */ } }
}
// the line the reader is on: the first message with more than a sliver (a line and a half) still inside the pane, and how far its top sits from the
// pane's. A message that has all but scrolled away is not it: a reply landing just under that one would push down what the reader is really reading.
export function anchorOf(list) {
  if (!list.scrollTop) return null;        // at the top: nothing above the reader can move them
  var top = list.getBoundingClientRect().top, rows = list.querySelectorAll(".c-voice");
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i].getBoundingClientRect();
    if (r.bottom > top + 24) return { key: rows[i].getAttribute("data-key"), off: r.top - top };
  }
  return null;
}
// bring a message into the pane without moving the page: its top when it is above (or taller than the pane), else just far enough to show all of it
export function showInPane(list, row) {
  var lr = list.getBoundingClientRect(), r = row.getBoundingClientRect();
  if (r.top < lr.top || r.height >= lr.height) list.scrollTop += r.top - lr.top - 4;
  else if (r.bottom > lr.bottom) list.scrollTop += r.bottom - lr.bottom + 8;
}

/**
 * One host's drawing. The host keeps the network, the sign-in and the page, and hands only these:
 * @param {object} host
 * @param {Document} host.doc
 * @param {(tag: string, cls?: string|null, text?: any) => Element} host.el   the host's node maker (text always as textContent)
 * @param {(handle: string) => Element} host.faceNode                       a speaker's small face (a fresh node per call)
 * @param {(handle: string) => Element} host.personLink                     a speaker's name, linked as the host links residents
 * @param {(handle: string) => string|null} host.humanOf                    a house's human's house words, for an accessible label
 * @param {(iso: string) => string} host.dateTimeOf                         the host's date form, for a time's title
 * @param {() => boolean} host.canReply                                     whether this reader may reply now (read at each drawing)
 * @param {() => any} host.facesKey                                         changes when the faces land (a redraw then shows them)
 * @param {() => boolean} host.pinNext                                      true while the reader's own say is landing
 * @param {(detail: {id: any, handle: string, said: string}) => void} host.onReply   a Reply press: the say the office served on that line
 * @param {(line: object, id: string) => string|null} [host.circleHref]     optional: where a line's "Open" goes (null: no Open); default `#circle-<id>`
 */
export function createRoomDrawing(host) {
  var doc = host.doc, el = host.el, faceNode = host.faceNode, personLink = host.personLink, humanOf = host.humanOf, dateTimeOf = host.dateTimeOf;
  var canReply = host.canReply;
  // What the reader has done in this room, kept on its card so a poll never undoes it: the circles they opened, the lines they have been shown, the
  // replies marked new, and what the pane was last drawn from.
  function roomOf(card) { return card.__room || (card.__room = { open: {}, seen: null, lit: {}, sig: null, shape: null, land: null, uid: ++roomUid }); }
  // everything a room's drawing depends on: its lines (how many, the last one, the office's own count and latest), the pictures, and whether the reader may reply
  function roomSig(t) {
    var v = t.voices || [], last = v.length ? v[v.length - 1] : null;
    return [v.length, last ? (last.id != null ? last.id : last.at_ms) : "", t.voice_count, t.latest, host.facesKey() ? 1 : 0, canReply() ? 1 : 0].join("|");
  }

  // ONE MESSAGE, drawn the way the Conversations page always drew a line: face and name, the WHOLE of what they said, the time. Under it, what a reader
  // can do with it.
  function voiceRow(node, st, reply) {
    var v = node.v, handle = String(v.handle == null ? "" : v.handle);
    var li = el("li", "c-voice" + (st.lit[node.key] ? " is-new" : ""));
    li.setAttribute("data-key", node.key);
    if (node.id !== null) li.setAttribute("data-say", node.id);
    // face and name travel together in one cell, so the row stays the
    // three columns it already was: who · what they said · when
    var who = el("span", "c-voice-who");
    who.appendChild(faceNode(handle));
    who.appendChild(personLink(handle));
    li.appendChild(who);
    li.appendChild(el("span", "c-said", v.said));       // textContent, always; and never cut
    var iso = isoOf(v);
    var when = el("time", "c-ago", clockOf(iso));
    if (iso) { when.setAttribute("datetime", iso); when.title = dateTimeOf(iso); }
    li.appendChild(when);
    var acts = el("span", "c-acts");
    if (reply && node.id !== null) {
      var r = el("button", "c-act", "Reply");
      r.type = "button";
      r.setAttribute("data-reply", node.id);
      r.setAttribute("data-key", "reply-" + node.key);
      r.setAttribute("aria-label", "Reply to " + (humanOf(handle) || handle));
      acts.appendChild(r);
    }
    // "Open" is the way to link to or share ONE circle (its own view, with its own address); nothing needs it to be read. It sits on an opening
    // message, and on a reply that stands alone here because the message it answers is not in this read. A host that lives on another page names
    // where a circle opens (`host.circleHref(line, id)`, null for a line that opens none); without it, the circle's own anchor on this page.
    var href = node.id === null || node.parent ? null : typeof host.circleHref === "function" ? host.circleHref(v, node.id) : "#circle-" + encodeURIComponent(node.id);
    if (href) {
      var o = el("a", "c-act", "Open");
      o.href = href;
      o.setAttribute("data-circle-open", node.id);
      o.setAttribute("data-key", "open-" + node.key);
      o.setAttribute("aria-label", "Open " + (humanOf(handle) || handle) + "'s conversation on its own");
      o.title = "this conversation on its own: a link you can share";
      acts.appendChild(o);
    }
    if (acts.childNodes.length) li.appendChild(acts);
    if (node.loose) li.appendChild(el("span", "c-fine c-loose", "A reply to an earlier message that isn't shown here."));
    return li;
  }
  // a message's replies, each whole, each followed by its own replies set in under it: every level at once
  function kidsList(node, st, reply, depth, id) {
    var ol = el("ol", "c-kids");
    if (id) ol.id = id;
    if (depth >= DEEP_AT) ol.setAttribute("data-deep", "");
    node.kids.forEach(function (k) {
      ol.appendChild(voiceRow(k, st, reply));
      if (k.kids.length) {
        var w = el("li", "c-kids-wrap");
        w.appendChild(kidsList(k, st, reply, depth + 1, null));
        ol.appendChild(w);
      }
    });
    return ol;
  }
  // THE ONE BUTTON under a message that has replies: its count is the whole circle, and it opens (or folds) the whole circle in place
  function foldRow(node, st, reply) {
    var wrap = el("li", "c-fold-wrap");
    var open = !!st.open[node.key];
    var b = el("button", "c-fold", repliesWords(node.total));
    b.type = "button";
    b.setAttribute("data-fold", node.key);
    b.setAttribute("data-key", "fold-" + node.key);
    b.setAttribute("aria-expanded", open ? "true" : "false");
    wrap.appendChild(b);
    if (open) {
      var id = "c-kids-" + st.uid + "-" + node.key;
      b.setAttribute("aria-controls", id);
      var list = kidsList(node, st, reply, 1, id);
      // THE CIRCLE ON THE LINE (Darko, 2026-11-22 19:02 EST: "have the circle design of the expandable replies reincorporated in. It's a very small but
      // just like nice UI type touch"). An open circle is drawn the way the World's reader draws one (WLD-178): a thin line down its side and a small
      // circle ON the line at its midpoint; pressing either folds the whole circle, exactly as the button above does. They are a pointer's
      // convenience and say nothing new, so they are kept out of the keyboard's and a screen reader's way: the button is the control.
      list.setAttribute("data-circle", "");
      var ctl = el("li", "c-ring-row");
      ctl.setAttribute("aria-hidden", "true");
      ["c-ring-line", "c-ring"].forEach(function (cls) {
        var x = el("button", cls);
        x.type = "button";
        x.tabIndex = -1;
        x.setAttribute("data-fold", node.key);
        x.title = "Fold " + repliesWords(node.total);
        ctl.appendChild(x);
      });
      list.appendChild(ctl);
      wrap.appendChild(list);
      return wrap;
    }
    // folded, with replies the reader has not been shown: "N new" opens the circle with them on screen
    var fresh = 0;
    eachUnder(node, function (c) { if (!st.seen[c.key]) fresh++; });
    if (fresh) {
      var nb = el("button", "c-fold c-fold-new", fresh + " new");
      nb.type = "button";
      nb.setAttribute("data-new", node.key);
      nb.setAttribute("data-key", "new-" + node.key);
      nb.setAttribute("aria-label", fresh + (fresh === 1 ? " new reply: show it" : " new replies: show them"));
      wrap.appendChild(nb);
    }
    return wrap;
  }

  // Draw (or redraw) a room's pane from the lines its thread carries. A poll that moved nothing redraws nothing, so scroll, focus and a text selection
  // all stand. `press` is the reader's own act in this room (fold, open, "N new"): always redrawn. Answers whether it drew.
  function drawRoom(card, t, press) {
    var list = card.querySelector(".c-voices");
    if (!list) return false;
    var st = roomOf(card);
    var sig = roomSig(t);
    if (!press && st.sig === sig) return false;
    st.sig = sig;
    var shape = st.shape = roomShape(t.voices);
    var first = !st.seen;
    if (first) st.seen = {};
    var landed = null;
    var pinNext = host.pinNext();
    shape.nodes.forEach(function (n) {
      if (st.seen[n.key]) return;
      // what the reader arrived to is not "new"; and a new OPENING message is simply shown, in its place at the end, as this page always showed new talk
      if (first || !n.parent) { st.seen[n.key] = true; return; }
      var top = topOf(n);
      if (pinNext) st.open[top.key] = true;                  // the reader just spoke: a reply that lands now is shown wherever it sits
      // an OPEN circle takes its new reply at once, marked; a folded one keeps it behind "N new" (foldRow)
      if (st.open[top.key]) { st.seen[n.key] = true; st.lit[n.key] = true; landed = n.key; }
    });
    var anchor = !press && !first ? anchorOf(list) : null;
    var focus = doc.activeElement && list.contains(doc.activeElement) ? doc.activeElement.getAttribute("data-key") : null;
    var reply = canReply();
    list.textContent = "";
    shape.tops.forEach(function (n) {
      list.appendChild(voiceRow(n, st, reply));
      if (n.kids.length) list.appendChild(foldRow(n, st, reply));
    });
    if (focus) focusKeyed(list, focus);
    // for the paint that called: where the reader's line was, and their own reply if one just landed (the host places the pane)
    st.land = { anchor: anchor, own: pinNext ? landed : null };
    return true;
  }

  // THE READER PRESSED SOMETHING IN A ROOM (one listener per pane). Reply names the say for the host's speaking box; the replies button opens or folds its
  // whole circle; "N new" opens the circle with the new replies on screen. None of them asks the office anything: the room's read already holds it all.
  function roomPress(card, ev) {
    var hit = ev.target && ev.target.closest ? ev.target.closest("[data-fold],[data-new],[data-reply]") : null;
    var st = card.__room, list = card.querySelector(".c-voices");
    if (!hit || !st || !st.shape || !list || !card.__t) return;
    if (hit.hasAttribute("data-reply")) {
      var say = st.shape.byId[hit.getAttribute("data-reply")];
      // the id is the one the OFFICE served on that line; the words are theirs (text, never markup)
      if (say) host.onReply({ id: say.v.id, handle: String(say.v.handle), said: String(say.v.said == null ? "" : say.v.said) });
      return;
    }
    var showNew = hit.hasAttribute("data-new");
    var key = hit.getAttribute(showNew ? "data-new" : "data-fold");
    var node = null;
    st.shape.tops.forEach(function (n) { if (n.key === key) node = n; });
    if (!node) return;
    var firstNew = null;
    if (st.open[key] && !showNew) {
      delete st.open[key];
      eachUnder(node, function (c) { delete st.lit[c.key]; });         // folded: its "new" marks are spent
    } else {
      st.open[key] = true;
      eachUnder(node, function (c) {
        if (st.seen[c.key]) return;
        st.seen[c.key] = true; st.lit[c.key] = true;
        if (firstNew === null) firstNew = c.key;
      });
    }
    var top = list.scrollTop;
    drawRoom(card, card.__t, true);
    st.land = null;
    list.scrollTop = top;                       // everything above the button is as it was, so the button stays under the reader's finger
    focusKeyed(list, "fold-" + key);
    // "N new" (and a circle opened while it held new replies): the first new reply is ON SCREEN after the press, not merely in the page
    var row = firstNew !== null ? keyed(list, firstNew) : null;
    if (row && row.scrollIntoView) row.scrollIntoView({ block: "nearest" });
  }

  return { roomOf: roomOf, roomSig: roomSig, drawRoom: drawRoom, roomPress: roomPress, keyed: keyed, showInPane: showInPane, sayKey: sayKey };
}
