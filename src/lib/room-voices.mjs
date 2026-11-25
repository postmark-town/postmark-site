// room-voices.mjs — AN EVENT'S ROOM, READ AS THE CONVERSATIONS PAGE READS ONE (CORE-177, on POS-1232).
//
// Wright 2026-11-25 03:54: an event's rooms use "the site's existing CORE-156 B room drawing". B draws from a room's own lines (who, the whole words,
// when, each line's `id` and `reply_to`), and the one-room read did not carry them until POS-1232's opt-in: `GET /api/world/conversations?room=<id>
// &room_voices=1` answers `find.voices` (the public lines, oldest first, each with the producer's `circle` worked out over the WHOLE room) and
// `find.voices_page` (what this page is: total, served, complete, and the cursor to the lines before it), beside the room and circles it always had.
//
// WHAT THIS DOES, the first time a room is opened: ONE such read. Its lines are drawn by src/lib/room-drawing.mjs, the drawing the Conversations page
// draws every room with, into that page's own pane (`ol.c-voices` in the room's card), and nothing is worked out here: who answers whom is the drawing's,
// from the served `reply_to`; which circle a line opens is the producer's `circle`. What the page IS is said, never implied:
//   · a page with earlier lines behind it says how many, and offers them: one press, one read of exactly the cursor the office served (`voices_before`),
//     and every line that page serves goes in front of what is shown (a page may hold more than it was asked for, so ties are never cut);
//   · an answer that does not say what its page is, says so;
//   · an office that answers WITHOUT the lines (one that predates POS-1232, production today) keeps the room exactly as it was: the World's circle
//     reader, mounted through the site's one setup, and handed the answer this read already holds, so its first read is not asked twice;
//   · a read that fails says so, with the way to ask again; a room is never shown as empty because its read was not had.

import { mountRoom, officeSource, readBody, roomUrl } from "./circle-reader-mount.mjs";
import { faceNode, humanOf } from "./conversation-host.mjs";
import { createRoomDrawing, roomShape, sayKey } from "./room-drawing.mjs";

/** The opt-in read of one room's lines, or of the lines before `before` (only ever the `before_ms` the office served), or null for an id it never issued. */
export function roomVoicesUrl(base, roomId, before = null) {
  const url = roomUrl(base, roomId);
  if (!url) return null;
  const b = before === null || before === undefined || before === "" ? null : String(before);
  if (b !== null && !/^\d{1,18}$/.test(b)) return null;
  return `${url}&room_voices=1${b !== null ? `&voices_before=${b}` : ""}`;
}

/** The lines and the page an answer carries, or null when it carries no lines (an office before POS-1232, or a room it does not hold). */
export function voicesOf(body) {
  const find = body && body.find;
  if (!find || !Array.isArray(find.voices)) return null;
  const p = find.voices_page && typeof find.voices_page === "object" ? find.voices_page : null;
  const earlier = p && p.earlier && typeof p.earlier === "object" && Number(p.earlier.remaining) > 0 ? p.earlier : null;
  return {
    voices: find.voices,
    room: find.room && typeof find.room === "object" ? find.room : null,
    page: p ? {
      total: Number.isFinite(Number(p.total)) ? Number(p.total) : null,
      complete: p.complete === true,
      remaining: earlier ? Number(earlier.remaining) : 0,
      before: earlier && /^\d{1,18}$/.test(String(earlier.before_ms ?? "")) ? String(earlier.before_ms) : null,
      later: Number(p.later_not_served) > 0 ? Number(p.later_not_served) : 0,
    } : null,
  };
}

export const ROOM_VOICES_WORDS = {
  statements: (n) => `${n} ${n === 1 ? "statement" : "statements"}`,
  earlier: (total, shown, remaining) =>
    `This room holds ${ROOM_VOICES_WORDS.statements(total)}. The newest ${shown} are shown below in full; the ${remaining} said before them are not shown yet.`,
  later: (n) => `${ROOM_VOICES_WORDS.statements(n)} said after these are not on this page.`,
  unsaid: "The office didn't say whether these are all of this room's statements.",
  none: "Nothing is recorded as said in this room.",
  more: "Show earlier statements",
  reading: "Reading…",
  moreFailed: "The earlier statements couldn't be read just now. That is not the same as there being none.",
  failed: "This room's statements couldn't be read just now. That is not the same as it being empty.",
  retry: "Try again",
};

// "2026-11-14T20:01:00.000Z" -> "2026-11-14 20:01Z" (the Conversations page's dateTimeOf, the circle reader's own date form)
function dateTimeOf(iso) {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(String(iso == null ? "" : iso));
  return m ? `${m[1]} ${m[2]}Z` : "";
}

/**
 * Draw one room of an event page from the opt-in read.
 *
 * @param {object} o
 * @param {Document} o.doc
 * @param {Element} o.card        the room's card (`details.c-thread` inside `.convo`): the drawing keeps its state on it, as on the Conversations page
 * @param {Element} o.reader      the card's reader host (its floor inside): replaced by the pane when the lines are drawn, the reader's home otherwise
 * @param {string} o.roomId
 * @param {string} o.base         the office (auth.mjs officeBase)
 * @param {Function} o.fetchImpl
 * @param {() => object|null} [o.getFaces]   residents-meta as it stands (conversation-host.mjs hostFaces().get)
 * @param {object} [o.readerOptions]         what the page hands mountRoom when the office answers without lines
 * @returns {Promise<{ ok: true, drawn: "voices"|"reader" } | { ok: false, why: string, failed?: true }>}
 */
export async function drawRoomVoices({ doc, card, reader, roomId, base, fetchImpl, getFaces = () => null, readerOptions = {} }) {
  let body;
  try {
    body = await readBody(fetchImpl, roomVoicesUrl(base, roomId));
  } catch (e) {
    return { ok: false, failed: true, why: String((e && e.message) || e) };
  }
  const got = voicesOf(body);
  if (!got) {
    // NO LINES IN THE ANSWER: the room is read as it was before POS-1232, by the World's reader; its first room read is the answer already held
    const plain = officeSource({ base, fetchImpl });
    let held = body;
    const source = {
      room: (id) => { if (held && String(id) === String(roomId)) { const b = held; held = null; return Promise.resolve(b); } return plain.room(id); },
      circle: plain.circle,
    };
    const m = await mountRoom({ doc, host: reader, roomId, base, fetchImpl, ...readerOptions, source });
    return m.ok ? { ok: true, drawn: "reader" } : { ok: false, why: m.why };
  }

  const el = (tag, cls, text) => { const n = doc.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = String(text); return n; };
  const drawing = createRoomDrawing({
    doc, el, humanOf, dateTimeOf,
    faceNode: (handle) => { try { return faceNode(doc, handle, getFaces()); } catch { return el("span", "c-face"); } },
    // a speaker's name, linked as the Conversations page links residents; a house's human has no page, so no link
    personLink: (handle) => {
      const human = humanOf(handle);
      if (human) return el("span", "c-who is-human", human);
      const a = el("a", "c-who", handle);
      a.href = `/residents/${encodeURIComponent(handle)}/`;
      return a;
    },
    canReply: () => false, pinNext: () => false, onReply: () => {},
    facesKey: () => getFaces(),
    // a line opens the circle the PRODUCER says it is in, on the Conversations page; a line it puts in none (speech from before circles) opens nothing
    circleHref: (line) => { const c = sayKey(line && line.circle); return c === null ? null : `/conversations/#circle-${c}`; },
  });

  const t = { id: (got.room && got.room.id) || roomId, voices: got.voices.slice(), voice_count: got.page && got.page.total !== null ? got.page.total : got.voices.length, latest: got.room ? got.room.latest : null };
  let page = got.page;

  const box = el("div", "c-room-earlier");
  box.setAttribute("data-room-voices-page", "");
  const words = el("p", "c-fine");
  words.setAttribute("data-room-voices-words", "");
  box.append(words);
  const list = el("ol", "c-voices");
  list.addEventListener("click", (ev) => drawing.roomPress(card, ev));
  reader.replaceWith(box, list);
  card.__t = t;

  const say = () => {
    const parts = [];
    if (!page) parts.push(ROOM_VOICES_WORDS.unsaid);
    else {
      if (page.remaining > 0) parts.push(ROOM_VOICES_WORDS.earlier(t.voice_count, t.voices.length, page.remaining));
      if (page.later > 0) parts.push(ROOM_VOICES_WORDS.later(page.later));
    }
    if (!t.voices.length && !(page && page.remaining > 0)) parts.push(ROOM_VOICES_WORDS.none);
    words.textContent = parts.join(" ");
    words.hidden = !parts.length;
    let b = box.querySelector("[data-room-voices-more]");
    if (page && page.remaining > 0 && page.before !== null) {
      if (!b) {
        b = el("button", "c-more", ROOM_VOICES_WORDS.more);
        b.type = "button";
        b.setAttribute("data-room-voices-more", "");
        b.addEventListener("click", earlier);
        box.append(b);
      }
    } else if (b) b.remove();
    box.hidden = words.hidden && !box.querySelector("[data-room-voices-more]");
  };

  // THE LINES BEFORE THESE: one read of the served cursor per press; its whole page goes in front, in its own order, and nothing already shown is
  // touched. Lines that were simply not on the screen yet are not "new" replies.
  async function earlier() {
    const b = box.querySelector("[data-room-voices-more]");
    if (!b || b.disabled || !page || page.before === null) return;
    box.querySelector("[data-room-voices-failed]")?.remove();
    b.disabled = true; b.textContent = ROOM_VOICES_WORDS.reading;
    let more = null;
    try { more = voicesOf(await readBody(fetchImpl, roomVoicesUrl(base, roomId, page.before))); } catch { more = null; }
    b.disabled = false; b.textContent = ROOM_VOICES_WORDS.more;
    if (!more) {
      const n = el("p", "c-fine", ROOM_VOICES_WORDS.moreFailed);
      n.setAttribute("data-room-voices-failed", "");
      n.setAttribute("role", "status");
      box.append(n);
      return;
    }
    const st = drawing.roomOf(card);
    for (const n of roomShape(more.voices).nodes) st.seen[n.key] = true;
    t.voices = more.voices.concat(t.voices);
    if (more.page && more.page.total !== null) t.voice_count = more.page.total;
    page = page && more.page ? { ...page, remaining: more.page.remaining, before: more.page.before } : null;
    drawing.drawRoom(card, t);
    list.scrollTop = 0;                          // the reader asked for what came before: it starts at the top of the pane
    say();
  }

  drawing.drawRoom(card, t);
  say();
  return { ok: true, drawn: "voices" };
}

/** The failure, said in the room's own floor with one way to ask again (`retry` runs the same read once per press). Never an empty room. */
export function sayRoomFailed(doc, floor, retry) {
  if (!floor) return;
  floor.textContent = ROOM_VOICES_WORDS.failed + " ";
  floor.setAttribute("role", "status");
  const b = doc.createElement("button");
  b.type = "button"; b.className = "c-act"; b.textContent = ROOM_VOICES_WORDS.retry;
  b.addEventListener("click", () => { b.disabled = true; retry(); }, { once: true });
  floor.append(b);
}
