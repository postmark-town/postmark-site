// conversation-host.mjs — what a page that HOSTS a room's circle reader adds to the site's one reader setup, the way the Conversations page
// hosts it (CORE-177). Darko, 2026-11-24 08:48 EST: the event page's conversations "would just need to take literally the same theme as like
// how it looks in the conversations page … something like you can click to look more into, and then like also look at the circles".
//
// ONE READER, ONE SETUP. The reader is the World's (spectator/circle-reader.mjs), mounted through circle-reader-mount.mjs mountRoom on every
// page; the Conversations page's door mounts through it too. A Conversations-style host adds two things to the bare mount, and they are here,
// so every such host adds the same two:
//   · the speakers' small faces (CORE-128: `faceForSpeaker(handle) -> a fresh decorative node | null`), from the world's residents-meta.json,
//     behind the three guards that keep a resident-influenced picture and colour safe;
//   · `hostOwnsHeader: true` (WLD-215): the host draws the card's one header (its place), so the reader leaves its own out.
// The theme is src/styles/conversation-host.css, the same rules the Conversations page wears. This file draws no card and works nothing out.
//
// THE GUARDS ARE THE CONVERSATIONS PAGE'S, WORD FOR WORD. That page draws its own cards in an inline script that cannot import a module, so
// it keeps its copy of safeAvatarUrl, safeHexColor, monogramOf, inkOn and humanOf for its card chrome; test/conversation-host.test.mjs holds
// the two copies identical, so they cannot drift. Each is itself the canon in postmark-world (spectator/viewer.mjs), duplicated rather than
// importing the world engine.

/** The world's residents-meta, as the Conversations page reads it (handle -> { name, avatar, color }). */
export const RESIDENTS_META = "/world-engine/residents-meta.json";

var AVATAR_PATH = /^\/[A-Za-z0-9._~\-]+(?:\/[A-Za-z0-9._~\-]+)*$/;
var TOWN_MEDIA_DOOR = "https://media.postmark.town/media/";
var DOOR_PATH = /^[A-Za-z0-9._~\-]+(?:\/[A-Za-z0-9._~\-]+)*$/;
var HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
var DEFAULT_FACE_COLOR = "#e8c48b";

export function safeAvatarUrl(url) {
  var s = String(url == null ? "" : url).trim();
  if (!s || s.length > 300) return null;
  if (s.indexOf("..") !== -1) return null; // no climbing out of /media, on either road
  if (AVATAR_PATH.test(s)) return s;       // the rooted same-origin path, unchanged
  // Not a rooted path, so it is only admissible as the town's own media door,
  // which refuses //host, http:, javascript:, data: and every other host.
  if (s.indexOf(TOWN_MEDIA_DOOR) !== 0) return null;
  return DOOR_PATH.test(s.slice(TOWN_MEDIA_DOOR.length)) ? s : null; // ?query, #frag, %2e, backslash
}
export function safeHexColor(color) {
  var s = String(color == null ? "" : color).trim();
  return HEX.test(s) ? s : DEFAULT_FACE_COLOR;
}
export function monogramOf(name, handle) {
  var source = String(name == null ? "" : name).trim() || String(handle == null ? "" : handle).trim();
  var first = Array.from(source)[0];        // by grapheme: an emoji is one letter, not half of one
  return first ? first.toLocaleUpperCase() : "?";
}
// a disc can be any colour a resident chose, so the letter on it has to
// pick its own ink rather than assume a dark ground
export function inkOn(hex) {
  var h = hex.replace("#", "");
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  var r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) > 140 ? "#1b2233" : "#f6e6c4";
}
export function humanOf(handle) {
  var m = /^human-of-(.+)$/.exec(handle || "");
  return m ? "the human of " + m[1] : null;
}

/**
 * The small face the Conversations page draws for a speaker (its faceNode): the guarded public picture, else the resident's colour and
 * letter, else, for a house's human, the dashed chip with no picture or colour of its own. `faces` is residents-meta (or null: letters only).
 */
export function faceNode(doc, handle, faces) {
  const el = (tag, cls, text) => { const n = doc.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = String(text); return n; };
  if (humanOf(handle)) {
    const chip = el("span", "c-face is-human", monogramOf(handle.replace(/^human-of-/, ""), "?"));
    chip.setAttribute("aria-hidden", "true");
    return chip;
  }
  const meta = (faces && faces[handle]) || null;
  const name = (meta && String(meta.name || "").trim()) || handle;
  const src = safeAvatarUrl(meta && meta.avatar);
  if (src) {
    const img = el("img", "c-face");
    img.src = src; img.alt = ""; img.loading = "lazy"; img.width = 22; img.height = 22;
    return img;
  }
  const color = safeHexColor(meta && meta.color);
  const mono = el("span", "c-face is-mono", monogramOf(name, handle));
  mono.style.background = color;
  mono.style.color = inkOn(color);
  mono.setAttribute("aria-hidden", "true");
  return mono;
}

/** The reader's face provider: a FRESH node per call, and never a throw (a face is a garnish, so a failure is no face, never a blocked line). */
export function faceProvider(doc, getFaces = () => null) {
  return function faceForSpeaker(handle) {
    try {
      const h = String(handle == null ? "" : handle).trim();
      return h ? faceNode(doc, h, getFaces()) : null;
    } catch { return null; }
  };
}

/** residents-meta's residents, or null when it cannot be had (the faces are then letters only: never a blocked room). */
export async function loadFaces(fetchImpl = globalThis.fetch) {
  try {
    const r = await fetchImpl(RESIDENTS_META, { headers: { accept: "application/json" } });
    const d = r && r.ok ? await r.json() : null;
    return d && d.residents && typeof d.residents === "object" ? d.residents : null;
  } catch { return null; }
}

/** How long a room's first mount may wait for residents-meta: past it the reader mounts with letters (a face is a garnish, never the meal). */
export const FACES_WAIT_MS = 1200;

/**
 * The host's faces: ONE residents-meta read for the page, started on the first ask, and a BOUNDED wait on it. `ready()` settles when the read
 * settles (headers and body alike) or when `waitMs` has passed, whichever is first, and the timer is cleared on an early result; every later ask
 * shares the same read and the same deadline. `get()` is the provider's getter: faces that land after the deadline still reach every byline the
 * reader draws from then on. Never throws, never rejects.
 */
export function hostFaces({ fetchImpl = globalThis.fetch, waitMs = FACES_WAIT_MS, timers = globalThis } = {}) {
  let faces = null, ready = null;
  const read = () => loadFaces(fetchImpl).then((f) => { faces = f; });
  return {
    get: () => faces,
    ready: () => (ready ??= new Promise((done) => {
      const t = timers.setTimeout(done, waitMs);
      read().then(() => { timers.clearTimeout(t); done(); });
    })),
  };
}

/** What a Conversations-style host hands mountRoom beyond the bare defaults: its face provider and its own header. */
export function hostReaderOptions(doc, getFaces) {
  return { faceForSpeaker: faceProvider(doc, getFaces), hostOwnsHeader: true };
}
