// circle-reader-mount.mjs — the site's ADAPTER to the World's one circle reader (CORE-82). Adapter only: it is not a second reader.
//
// The reader (postmark-world spectator/circle-reader.mjs) is ONE module, owned by the World, drawn in two habitats: the World's shared
// column and the pages of this site. The site's world-engine island stages every spectator module at /world-engine/spectator/<file>
// from the pinned world package, so a page imports it from there and hands it what it must not fetch for itself:
//
//   source.room(roomId)            the keyless `GET /api/world/conversations?room=<thread id>`
//   source.circle(circleId, after) the keyless `GET /api/world/conversations?circle=<id>[&after=<id>]`
//
// both resolving to the office's whole answer body (`{ now, earshot_m, settlement_since, find }`) and REJECTING on anything that is
// not a 200 with that body (a 422 refusal, a 5xx, a network failure, a non-JSON answer): the reader shows a rejection as "couldn't
// read it" with a retry, never as an empty room. This file never works out a parent, a reply link, a name link, an acceptance or a
// room's members; it follows the continuations the office served (the reader does, by `next` and a stub's `read.circle`).
//
// IF THE READER IS NOT THERE (a pinned world package that predates it, a failed import) the adapter says so and the page keeps what
// it drew without it: today's flat transcript on the conversations page, a link to the room's anchor on the event page. That is the
// honest floor, and it is a different outcome from an empty room.

/** Where the staged module is served (town/scripts/world-engine-island.mjs stages every non-test spectator module here). */
export const READER_MODULE = "/world-engine/spectator/circle-reader.mjs";

const CONVERSATIONS = "/world/conversations";

/** The keyless URL of a room's circles, or null for an id the office could not have issued. */
export function roomUrl(base, roomId) {
  const id = String(roomId ?? "");
  if (!id || id.length > 200) return null;
  return `${String(base ?? "/api").replace(/\/+$/, "")}${CONVERSATIONS}?room=${encodeURIComponent(id)}`;
}

/** The keyless URL of a circle's page: `after` is only ever a continuation the office served. */
export function circleUrl(base, circleId, after) {
  const id = String(circleId ?? "");
  if (!/^\d{1,18}$/.test(id)) return null;
  const a = after === undefined || after === null || after === "" ? null : String(after);
  if (a !== null && !/^\d{1,18}$/.test(a)) return null;
  return `${String(base ?? "/api").replace(/\/+$/, "")}${CONVERSATIONS}?circle=${id}${a !== null ? `&after=${a}` : ""}`;
}

/** One keyless read: the office's whole answer body, or a rejection for anything that is not a 200 conversations read (the reader's rule, above). */
export async function readBody(fetchImpl, url) {
  if (!url) throw new Error("not an address the office issues");
  const res = await fetchImpl(url, { headers: { accept: "application/json" }, cache: "no-store" });
  let body = null;
  try { body = await res.json(); } catch { /* not JSON */ }
  if (res.status !== 200) {
    const err = new Error(body?.defect ? String(body.defect) : `the office answered ${res.status}`);
    err.status = res.status; err.body = body;
    throw err;
  }
  if (!body || typeof body !== "object" || !body.find || typeof body.find !== "object") {
    throw new Error("the office's answer was not a conversations read");
  }
  return body;
}

/** The reader's injected I/O. `fetchImpl` is the page's own fetch (a test hands in one that answers like the office). */
export function officeSource({ base = "/api", fetchImpl = globalThis.fetch } = {}) {
  return {
    room: (roomId) => readBody(fetchImpl, roomUrl(base, roomId)),
    circle: (circleId, after) => readBody(fetchImpl, circleUrl(base, circleId, after)),
  };
}

/**
 * Load the staged reader. Resolves the module, or null when it cannot be had (never throws): the caller then keeps its floor.
 * `importImpl` is injected so a test can hand in the module (or a refusal) without a server.
 */
export async function loadReader({ url = READER_MODULE, importImpl = (u) => import(/* @vite-ignore */ u) } = {}) {
  try {
    const mod = await importImpl(url);
    if (mod && typeof mod.createCircleReader === "function") return mod;
    return null;
  } catch {
    return null;
  }
}

/**
 * Mount the reader for one room into `host`.
 *
 * @returns {Promise<{ ok: true, reader: object, module: object } | { ok: false, why: string }>}
 *   ok:false means the reader is not here: the host keeps its floor (the caller says which, it is never an empty room).
 */
export async function mountRoom({ doc, host, roomId, base = "/api", fetchImpl, importImpl, canReply = false, onReply = null, onNavigate = null, hrefForCircle = null, faceForSpeaker = null, hostOwnsHeader = false, identityForSpeaker = null, onState = null, circle = null, source: given = null } = {}) {
  if (!host || !roomId) return { ok: false, why: "no room to draw" };
  const module = await loadReader({ importImpl });
  if (!module) return { ok: false, why: "the circle reader is not on this site's pinned World yet" };
  if (typeof module.READER_CSS === "string" && module.READER_CSS && doc && !doc.querySelector("style[data-circle-reader-css]")) {
    const style = doc.createElement("style");
    style.setAttribute("data-circle-reader-css", "");
    style.textContent = module.READER_CSS;
    (doc.head ?? doc.documentElement).append(style);
  }
  // the reader's reads: the keyless office reads, unless the caller hands its own (the Conversations page's door, CORE-156: one answer the page already
  // holds is spent on the reader's first read, and the page is told each circle read), which must answer both reads
  const source = given && typeof given.room === "function" && typeof given.circle === "function" ? given : officeSource({ base, fetchImpl });
  // CORE-128: the optional speaker-face provider (`faceForSpeaker(handle) -> a fresh decorative DOM node | null`) is handed on ONLY when the caller gave one,
  // so every caller without it (the event page, the gallery) builds the reader with exactly the options it built it with before
  // `hostOwnsHeader` (WLD-215, strictly `true`): the host already shows this room's title/live/counts/began/latest itself, so the reader leaves its own `.cr-head` out; same rule, only when given
  // `onState` (the reader's room/circle/unavailable signal) is handed on only when given, as the face provider is (CORE-177: the conversations page's door
  // mounts through here now, and it is the one caller that listens)
  // CORE-178 / WLD-248: the optional speaker identity (`identityForSpeaker(handle) -> a fresh accessible Element | null`, the site's one resident mention,
  // resident-identity.mjs) replaces a byline's face and name; same rule, handed on only when the caller gave one
  const reader = module.createCircleReader({ doc, host, source, roomId, canReply, onReply, onNavigate, hrefForCircle, ...(typeof onState === "function" ? { onState } : {}), ...(typeof faceForSpeaker === "function" ? { faceForSpeaker } : {}), ...(typeof identityForSpeaker === "function" ? { identityForSpeaker } : {}), ...(hostOwnsHeader === true ? { hostOwnsHeader: true } : {}) });
  // a selected conversation (CORE-117) opens on its circle, with its room one named step back; otherwise the reader opens on its room
  if (circle !== null && circle !== undefined) await reader.showCircle(circle);
  else await reader.showRoom(roomId);
  return { ok: true, reader, module };
}

/** Mount a reader for each room, in the order the office listed them (never ranked, never chosen); one failing room does not stop the rest. */
export async function mountRooms({ doc, hosts, ...rest } = {}) {
  const out = [];
  for (const { host, roomId } of hosts ?? []) out.push({ roomId, ...(await mountRoom({ doc, host, roomId, ...rest })) });
  return out;
}
