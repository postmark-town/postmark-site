// reads.mjs — EVERY fetch the household page makes, behind one call (POS-260).
//
// The page asks `readHouse(handles, { token })` and nothing else. Today that
// composes the reads that exist, per resident:
//
//   GET /doorstep/{h}             mail (inbox), awaiting (bounces), stamps,
//                                 counts, window.pane, stances, rulings, stakes,
//                                 posts (the house's, POS-293), next_crossing —
//                                 public; with the house's own bearer it adds
//                                 your_pending_letters and unread (POS-286)
//   GET /mail/{h}?box=outbox      what they wrote (the doorstep carries the inbox only)
//   GET /quests/{h}               the day's board, and whom the mint counted
//   GET /world/walkers            where each one stands (one read for the town)
//   GET /world/conversations      what each one said (one read for the town)
//
// The calendar is not read here since POS-293: events are posts, and the
// doorstep's `posts` segment carries the house's.
//
// THE SWITCH IS ONE CHANGE. POS-276 is building the house-wide read,
// `household { read: "house" }`; when it lands, readHouse() asks it once and
// hands back the same shape, and nothing outside this file moves. That is why
// no other module on the page may call fetch.
//
// Every read fails soft: a door that does not answer is null, and the page
// leaves out what that door would have filled rather than guessing at it.

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

/**
 * @param {string[]} handles   the house's residents
 * @param {{ token?: string|null, mine?: string[] }} opts
 *        token: the reader's bearer, sent only on the doorsteps of residents
 *        the reader's own sign-in holds (`mine`) — never on anyone else's
 * @returns {Promise<{ doorsteps, outboxes, quests, walkers, conversations }>}
 */
export async function readHouse(handles, { token = null, mine = [] } = {}) {
  const api = officeOrigin();
  const own = new Set(mine);
  const each = (fn) => Promise.all(handles.map(fn)).then((rows) =>
    Object.fromEntries(handles.map((h, i) => [h, rows[i]])));
  const e = encodeURIComponent;
  const [doorsteps, outboxes, quests, walkers, conversations] = await Promise.all([
    each((h) => getJSON(`${api}/doorstep/${e(h)}`, token && own.has(h) ? token : null)),
    each((h) => getJSON(`${api}/mail/${e(h)}?box=outbox`)),
    each((h) => getJSON(`${api}/quests/${e(h)}`)),
    getJSON(`${api}/world/walkers`),
    getJSON(`${api}/world/conversations`),
  ]);
  return { doorsteps, outboxes, quests, walkers, conversations };
}

