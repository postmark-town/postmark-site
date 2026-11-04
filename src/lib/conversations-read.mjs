// conversations-read.mjs — the bounded read of the town's conversations that two page consumers share (POS-779).
//
// `GET /world/conversations` with no parameters answers the FIRST PAGE of each section: the newest 40 live threads and
// 40 earlier-settlement threads, 80 newest lines each, and `next_threads` cursors for the rest. (Before POS-779 the
// in-memory read answered the newest 80 lines per thread too; that limit is inherited, not new.) A consumer that only ever
// read the first page would lose the 41st thread and read as "nobody spoke". This reads the same endpoint with the same
// parameters, follows `next_threads` while the threads it reaches are still inside the window the consumer cares about,
// stops at a page cap, and SAYS what it did: the merged body plus a status (ok / partial / legacy / unavailable).
//
// Nothing here widens the office: no new parameter, no field. A refusal (503), a transport failure or a body without a
// `live` list is `unavailable` (never an empty town); a cut list the cap stopped is `partial`; the in-memory read's
// `incomplete_legacy` is `legacy`.

export const DEFAULT_MAX_PAGES = 3;

async function getBody(fetchFn, url, init) {
  try {
    const r = await fetchFn(url, init);
    let body = null;
    try { body = await r.json(); } catch { body = null; }
    return { ok: !!r.ok, http: r.status ?? 0, body };
  } catch {
    return { ok: false, http: 0, body: null };
  }
}

/**
 * @param fetchFn   fetch-shaped
 * @param base      the office origin (".../api" on the town host), without a trailing slash
 * @param opts      { windowMs: only threads whose newest line is inside this window are followed for; sections: ["live","closed"]; maxPages; now; headers }
 * @returns { body, status: { state, http, partial, legacy, cut } }
 *   body    the first page with the followed threads appended, or null when unavailable
 *   status  state "unavailable" | "partial" | "legacy" | "ok"; `partial` true when the cap or a failed follow left threads unread
 *           (or a followed thread came lean, without its lines); `legacy` true on `incomplete_legacy`; `cut` the sections left unread
 */
export async function readConversations(fetchFn, base, { windowMs, sections = ["live", "closed"], maxPages = DEFAULT_MAX_PAGES, now = Date.now(), headers = { accept: "application/json" } } = {}) {
  const url = base.replace(/\/$/, "") + "/world/conversations";
  const first = await getBody(fetchFn, url, { headers });
  const b = first.body;
  if (!first.ok || !b || !Array.isArray(b.live)) return { body: null, status: { state: "unavailable", http: first.http, partial: false, legacy: false, cut: [] } };
  const body = { ...b, live: b.live.slice(), closed: Array.isArray(b.closed) ? b.closed.slice() : [] };
  let partial = false;
  const cut = [];
  for (const section of sections) {
    let cursor = (b.next_threads && b.next_threads[section]) || null;
    let pages = 0;
    const inWindow = () => {
      const list = body[section];
      if (!list.length) return true;
      const last = Date.parse(list[list.length - 1]?.latest);
      return !Number.isFinite(windowMs) || !Number.isFinite(last) || last >= now - windowMs;
    };
    while (cursor && pages < maxPages && inWindow()) {
      const more = await getBody(fetchFn, url + "?next_threads=" + encodeURIComponent(cursor), { headers });
      pages += 1;
      const m = more.body;
      if (!more.ok || !m || m.regenerated || !Array.isArray(m.threads)) { partial = true; cut.push(section); cursor = null; break; }
      body[section].push(...m.threads);
      if (m.threads.some((t) => t.voice_count > 0 && (!t.voices || t.voices.length === 0))) { partial = true; if (!cut.includes(section)) cut.push(section); }
      cursor = m.next_threads || null;
    }
    // the cursor is left standing only when the window still wanted more: the cap stopped it
    if (cursor && inWindow()) { partial = true; if (!cut.includes(section)) cut.push(section); }
  }
  const legacy = !!b.incomplete_legacy;
  return { body, status: { state: partial ? "partial" : legacy ? "legacy" : "ok", http: first.http, partial, legacy, cut } };
}

/** The sentence a consumer shows beside what it drew, or null when there is nothing to say. `what` names the thing read. */
export function readNoteOf(status, what = "what the town said") {
  if (!status) return null;
  if (status.state === "unavailable") return "The record of " + what + " can't be read just now. Nothing here means it could not be read, not that nobody spoke.";
  const parts = [];
  if (status.partial) parts.push("Only the newest conversations were read here; older ones are not shown.");
  if (status.legacy) parts.push("This is the office's short in-memory record, so older speech isn't shown.");
  return parts.length ? parts.join(" ") : null;
}
