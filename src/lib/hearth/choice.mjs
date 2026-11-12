// choice.mjs — the household's saved Hearth: its read, its write, and what to SAY about them (POS-962).
//
// The office keeps a household's choice (households.hearth, office migration 093): the id of a registered entry, public, NULL when the house chose
// nothing. WHICH DESIGN TO DRAW is not decided here: that is ONE function, `whichDesign(entries, { entry, saved })` in which-design.mjs (the POS-984
// seam), and this module has no selection policy. It holds the transport and the words:
//
//   readSavedHearth({ handles, slug, api })    the saved choice, signed out   (GET /households?h=, public)  -> id | null | undefined
//   saveHearth({ slug, id, token, api })       the signed-in human's save     (PATCH /households/<slug>/hearth)
//   designNote(entries, { entry, saved })      the line to say beside the drawing, or ""
//
// THE SAVED-CHOICE CONTRACT for a caller of whichDesign (the household page and the Hearth page):
//   saved = await readSavedHearth(...)   // an id (string), null (chose nothing), or undefined (the read FAILED: say so, do not guess "nothing")
//   draw  = whichDesign(entries, { entry: asked, saved })      // asked = ?entry= / the picker's preview, or null
//   say   = designNote(entries, { entry: asked, saved })
// A PREVIEW IS NEVER SAVED: nothing here turns `entry` into a write; the only write is saveHearth, called by the picker's green check.
// After a successful save call whichDesign again with saved = the id saveHearth answered and entry = null. The office, not the picker, decides who may save.

import { DEFAULT_ENTRY, ENTRY_ID } from "./slots.mjs";

/** The line to say beside the drawing: a saved id this build does not know, a preview that is not registered, a failed read. "" when there is nothing to say. */
export function designNote(entries = [], { entry = null, saved } = {}) {   // `saved` has NO default: undefined means "the read failed"
  const known = (id) => entries.find((e) => e.id === id);
  const savedKnown = saved ? known(saved) : null;
  const fallback = savedKnown ?? known(DEFAULT_ENTRY) ?? entries[0];
  if (entry && !known(entry)) return `No Hearth entry is registered as “${String(entry).slice(0, 40)}”; showing ${fallback?.title ?? "the default"}.`;
  if (saved === undefined) return "The house's saved Hearth could not be read just now; showing the default.";
  if (saved && saved !== DEFAULT_ENTRY && !savedKnown) return "This house's saved Hearth is not in this version of the site yet; showing the default.";
  return "";
}

/** The saved id in a GET /households answer for this house, or null (chose nothing, or no such key). undefined when the answer is not a registry. */
export function savedHearthFrom(answer, slug) {
  const houses = answer?.registry?.households;
  if (!houses || typeof houses !== "object") return undefined;
  const id = houses[slug]?.hearth;
  return typeof id === "string" && ENTRY_ID.test(id) ? id : null;
}

/**
 * The house's saved choice, read signed out (public, keyless). Narrowed to the house by one of its residents (`?h=`), so the answer is one house.
 * Resolves to an id, null (chose nothing), or undefined (the read failed): never throws.
 */
export async function readSavedHearth({ handles = [], slug, api, fetchImpl = globalThis.fetch } = {}) {
  try {
    const h = handles[0];
    if (!h || !slug || !api) return undefined;
    const r = await fetchImpl(`${api}/households?h=${encodeURIComponent(h)}`, { headers: { accept: "application/json" } });
    if (!r.ok) return undefined;
    return savedHearthFrom(await r.json(), slug);
  } catch { return undefined; }
}

/** The words for a save whose outcome is not known: the request may have landed, so nothing is claimed either way (POS-962 lead FIX). */
export const UNCONFIRMED_SAVE = Object.freeze({
  noAnswer: "The office did not answer, so this save could not be confirmed. Reload the page to see the Hearth this house has saved.",
  unreadable: "The office answered, but its answer could not be read, so this save could not be confirmed. Reload the page to see the Hearth this house has saved.",
});

/**
 * THE ONLY WRITE: the signed-in human saves `id` (a registered entry's id) or null (back to the default). The office decides who may: a refusal
 * comes back as { ok: false, status, message } in the office's own words. Never called by a preview.
 *
 * AN UNKNOWN OUTCOME IS SAID AS ONE: { ok: false, unconfirmed: true, status, message }. No answer at all (the request may still have landed),
 * or a success whose body cannot be read or does not carry `hearth` (an id, or null for the default): neither is "nothing was saved", and
 * neither is a saved default. The reader is pointed at the public saved choice, which a reload reads. One value is set, so nothing retries.
 */
export async function saveHearth({ slug, id, token, api, fetchImpl = globalThis.fetch } = {}) {
  if (!token) return { ok: false, status: 401, message: "Sign in to choose this house's Hearth." };
  try {
    const r = await fetchImpl(`${api}/households/${encodeURIComponent(slug)}/hearth`, {
      method: "PATCH",
      headers: { "content-type": "application/json", accept: "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ hearth: id === null || id === DEFAULT_ENTRY ? null : id }),
    });
    const body = await r.json().catch(() => undefined);
    if (!r.ok) return { ok: false, status: r.status, message: String(body?.hint ?? body?.defect ?? "The office could not keep that.").slice(0, 300) };
    // a success says what is now saved: an id, or null (the default). Anything else is not a confirmation of either.
    const said = body && typeof body === "object" && Object.hasOwn(body, "hearth") ? body.hearth : undefined;
    if (said === null) return { ok: true, status: r.status, hearth: null };
    if (typeof said === "string" && ENTRY_ID.test(said)) return { ok: true, status: r.status, hearth: said };
    return { ok: false, unconfirmed: true, status: r.status, message: UNCONFIRMED_SAVE.unreadable };
  } catch {
    return { ok: false, unconfirmed: true, status: 0, message: UNCONFIRMED_SAVE.noAnswer };
  }
}
