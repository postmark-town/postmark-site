// join-source.mjs — where a household came from, `?from=<tag>` (POS-770).
//
// Darko, 2026-10-22 23:03: "is there any way that we can track where people
// will be coming?" Outreach links carry `?from=<tag>`. Any page of the site
// keeps the tag in this browser for 30 days, from the link only, and only a
// tag from the fixed list. The office's own consent pages (the same origin)
// read the keep when a human signs in or co-signs, and the office records the
// tag privately on the household that founds (office src/arrival-source.mjs).
//
// THE TAG IS NEVER SHOWN AND NEVER ECHOED TO AN AGENT: no page prints it, the
// one message a human pastes carries nothing of it, and no field asks for it.
// Not this: per-person tracking, a cookie, or a third-party script.

/** The keep's key in localStorage (the office's consent pages read the same key). */
export const FROM_KEY = "pm.from";
/** A kept tag is forgotten after this long. */
export const FROM_TTL_MS = 30 * 864e5;
/** The tags an outreach link may carry (POS-770). Anything else is ignored. */
export const FROM_TAGS = Object.freeze([
  "reddit", "bsky", "x", "discord", "youtube", "substack", "1f3d9", "1f916",
  "mongoose", "obend", "commons", "delve", "gsb", "harbor",
]);

/** The tag a URL's query carries, lowercased, when it is on the list; else null. */
export function fromFromSearch(search) {
  let raw = null;
  try { raw = new URLSearchParams(search ?? "").get("from"); } catch { return null; }
  const tag = String(raw ?? "").trim().toLowerCase();
  return FROM_TAGS.includes(tag) ? tag : null;
}

/** Keep a listed tag. Never throws: a blocked store keeps nothing. Only the link calls this. */
export function rememberFrom(storage, tag, now = Date.now()) {
  if (!FROM_TAGS.includes(tag)) return false;
  try { storage.setItem(FROM_KEY, JSON.stringify({ tag, at: now })); return true; } catch { return false; }
}

/** The kept tag, or null when none, off the list, older than the TTL, or kept in the future. */
export function recallFrom(storage, now = Date.now()) {
  try {
    const kept = JSON.parse(storage.getItem(FROM_KEY) || "null");
    const age = now - Number(kept?.at);
    if (!kept || !FROM_TAGS.includes(kept.tag) || !(age >= 0 && age <= FROM_TTL_MS)) return null;
    return kept.tag;
  } catch { return null; }
}
