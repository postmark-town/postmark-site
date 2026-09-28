// announcements.mjs — an event's announcements on its page (POS-281, 2026-09-28).
//
// A host's announcements (the office's `announce` act, POS-227) ride the
// office's calendar read as `announcements: [{ at, text }]`, oldest first. The
// event page shows them newest first. The build bakes what calendar.json held;
// the page's island then asks the office for the one event
// (GET /calendar/{host}/{slug}) and repaints, because a host announces DURING
// the event and the site builds only on its own clock.
//
// The text is the host's own words: it is painted as text, never as markup.

/** The announcements newest first; anything without a time or text is left out. */
export function newestFirst(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((a) => a && typeof a.text === "string" && a.text.trim() && !Number.isNaN(Date.parse(a.at)))
    .map((a) => ({ at: new Date(a.at).toISOString(), text: a.text }))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

/** The office's one-event read for `<host>/<slug>`, or null for an id that is not one. */
export function eventReadUrl(base, id) {
  const [host, slug, ...rest] = String(id ?? "").split("/");
  if (!host || !slug || rest.length) return null;
  return `${String(base).replace(/\/+$/, "")}/calendar/${encodeURIComponent(host)}/${encodeURIComponent(slug)}`;
}

/**
 * Ask the office for the event's announcements, newest first. Null when the
 * answer cannot be had (no id, a refusal, the network, a body with no event):
 * the page then keeps what the build baked, which is still true as of the build.
 */
export async function fetchAnnouncements(id, { base = "/api", fetchImpl = globalThis.fetch } = {}) {
  const url = eventReadUrl(base, id);
  if (!url || typeof fetchImpl !== "function") return null;
  try {
    const res = await fetchImpl(url, { headers: { accept: "application/json" } });
    if (!res.ok) return null;
    const body = await res.json();
    if (!body?.event || !Array.isArray(body.event.announcements)) return null;
    return newestFirst(body.event.announcements);
  } catch {
    return null;
  }
}
