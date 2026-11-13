// reads.mjs — EVERY fetch the household page makes, behind one call (POS-260).
//
// The page asks `readHouse(handles, { token })` and nothing else. Today that
// composes the reads that exist, per resident:
//
//   GET /doorstep/{h}             mail (inbox), awaiting (bounces, new inbound),
//                                 stamps, window.pane, stances, rulings, stakes,
//                                 next_crossing — public; with the house's own
//                                 bearer it adds your_pending_letters
//   GET /mail/{h}?box=outbox      what they wrote (the doorstep carries the inbox only)
//   GET /quests/{h}               the day's board, and whom the mint counted
//   GET /world/walkers            where each one stands (one read for the town)
//   GET /world/conversations      what each one said (one read for the town)
//   GET /calendar                 the coming-up section — the office serves /calendar (POS-207)
//
// THE SWITCH IS ONE CHANGE. POS-276 is building the house-wide read,
// `household { read: "house" }`; when it lands, readHouse() asks it once and
// hands back the same shape, and nothing outside this file moves. That is why
// no other module on the page may call fetch.
//
// Every read fails soft: a door that does not answer is null, and the page
// leaves out what that door would have filled rather than guessing at it.

import { bundleUrl, bundleFrom } from "../hearth/bundle.mjs";

// The cockpit's resolution (WorldCockpit.astro): a postmark.town host talks to
// its own /api; any other host (a local build, a preview) reads the live office.
export function officeOrigin(loc = typeof location !== "undefined" ? location : null) {
  const host = loc?.hostname ?? "";
  return host === "postmark.town" || host.endsWith(".postmark.town")
    ? loc.origin + "/api"
    : "https://postmark.town/api";
}

async function getJSON(url, token) {
  try {
    const headers = { accept: "application/json" };
    if (token) headers.authorization = "Bearer " + token;
    const r = await fetch(url, { headers });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

// WHAT HAS ANSWERED SO FAR (POS-984). Every read starts at once and none waits on another, but the page need not wait for the
// slowest: a house of nine asks for 27 resident reads, and on a busy box each doorstep alone takes seconds. So the answer is
// handed out as it grows. A snapshot is the same shape as the finished answer plus two lists that say what is still out:
//   pending   the residents whose reads (doorstep, outbox, quests) have not all settled, in the house's own order
//   waiting   the house-wide reads not landed yet ("walkers", "conversations", "calendar")
// A resident whose reads settled and failed is NOT pending: their doorstep is null, the same "did not answer" as ever, and
// they never hold the others back. A pending resident has no entry yet; both read as "nothing from them" to a consumer
// that indexes `reads.doorsteps?.[h]`, and `pending` is how a painter tells "still coming" from "did not answer".

/**
 * @param {string[]} handles   the house's residents
 * @param {{ token?: string|null, mine?: string[], onProgress?: ((snapshot: object) => void)|null }} opts
 *        token: the reader's bearer, sent only on the doorsteps of residents
 *        the reader's own sign-in holds (`mine`) — never on anyone else's
 *        onProgress: told with a fresh snapshot each time a resident's reads settle or a house-wide read lands
 * @returns {Promise<{ doorsteps, outboxes, quests, walkers, conversations, calendar, pending, waiting }>}
 *          the finished answer: `pending` and `waiting` are empty
 */
export async function readHouse(handles, { token = null, mine = [], onProgress = null } = {}) {
  const api = officeOrigin();
  const own = new Set(mine);
  const e = encodeURIComponent;
  const state = { doorsteps: {}, outboxes: {}, quests: {}, walkers: null, conversations: null, calendar: null };
  const pending = new Set(handles);
  const waiting = new Set(["walkers", "conversations", "calendar"]);
  // the maps are rebuilt in the house's own order, so what a snapshot holds never depends on who answered first
  const snapshot = () => {
    const done = handles.filter((h) => !pending.has(h));
    const of = (map) => Object.fromEntries(done.map((h) => [h, map[h]]));
    return {
      ...state,
      doorsteps: of(state.doorsteps), outboxes: of(state.outboxes), quests: of(state.quests),
      pending: handles.filter((h) => pending.has(h)),
      waiting: [...waiting],
    };
  };
  // a painter that throws on a partial answer must not take the rest of the reads down with it
  const tell = () => {
    if (!onProgress) return;
    try { onProgress(snapshot()); } catch (err) { console.error("readHouse: onProgress threw", err); }
  };
  const resident = async (h) => {
    const [doorstep, outbox, board] = await Promise.all([
      getJSON(`${api}/doorstep/${e(h)}`, token && own.has(h) ? token : null),
      getJSON(`${api}/mail/${e(h)}?box=outbox`),
      getJSON(`${api}/quests/${e(h)}`),
    ]);
    state.doorsteps[h] = doorstep; state.outboxes[h] = outbox; state.quests[h] = board;
    pending.delete(h);
    tell();
  };
  const wide = async (name, url) => {
    state[name] = await getJSON(url);
    waiting.delete(name);
    tell();
  };
  await Promise.all([
    ...handles.map(resident),
    wide("walkers", `${api}/world/walkers`),
    wide("conversations", `${api}/world/conversations`),
    wide("calendar", `${api}/calendar`),
  ]);
  return snapshot();
}


/**
 * The office's public Hearth bundle for a named house (POS-1027; lib/hearth/bundle.mjs holds its shape). PUBLIC AND KEYLESS: no bearer is
 * ever sent, whoever is signed in, so what comes back is exactly what a signed-out visitor may read, and it is what a house's own script is
 * handed. null when the office did not answer, refused (the read is not shipped yet), or answered with something that is not a bundle.
 */
export async function readHearthBundle(key) {
  if (!key) return null;
  return bundleFrom(await getJSON(bundleUrl(officeOrigin(), key)));
}

/** The panes origin's live list of hung windows (the same answer the resident page reads): the handles with a window, or null when it did not answer. */
export const PANES_ORIGIN = "https://panes.postmark.town";
export async function readHungWindows(handles) {
  const m = await getJSON(`${PANES_ORIGIN}/windows.json`);
  if (!m || typeof m !== "object") return null;
  const have = m.windows && typeof m.windows === "object" ? m.windows : {};
  return handles.filter((h) => !!have[h]);
}

/**
 * What the Hearth reads beyond the dashboard's reads (POS-959): the town's
 * public posts by class, which the `posts` slot filters to the house's own.
 * Public and keyless, like every read above; a door that does not answer is
 * null, and the slot says it could not read, never that there is nothing.
 */
export async function readHearthExtras() {
  const api = officeOrigin();
  const [idea, bug] = await Promise.all(["idea", "bug"].map((c) => getJSON(`${api}/posts?class=${c}&limit=100`)));
  return { posts: { idea, bug } };
}
