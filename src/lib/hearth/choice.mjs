// choice.mjs — WHICH registered Hearth a house draws: the ONE function, and the saved choice's read and write (POS-962).
//
// The office keeps a household's choice (households.hearth, office migration 093): the id of a registered entry, public, NULL when the house chose
// nothing. This module is the site's whole side of it, in three small pure-ish functions, and the page asks `resolveHearth` and nothing else:
//
//   resolveHearth({ entries, saved, asked })   which entry to DRAW, and why   (pure: no fetch, no DOM)
//   readSavedHearth({ handles, ... })          the saved choice, signed out    (GET /households?h=, public)
//   saveHearth({ slug, id, token, ... })       the signed-in human's save      (PATCH /households/<slug>/hearth)
//
// THE CALLER CONTRACT (POS-984's household page, and the Hearth page today):
//
//   1. `saved` is what readSavedHearth answered: an id (a string), null (the house chose nothing), or undefined (the read failed: say so, do not
//      guess "nothing"). `asked` is the preview in the address (`?entry=<id>`) or the picker's current preview, or null.
//   2. resolveHearth answers { entry, id, source, savedId, unavailable, note }. Draw `entry`. `source` is "preview" (asked, registered: a
//      preview, NOT saved), "saved" (the house's own choice), or "default". `savedId` is what is actually saved (never the preview).
//   3. A PREVIEW IS NEVER SAVED. Nothing here turns `asked` into a write; the only write is saveHearth, called by the picker's confirmed button.
//   4. After a successful save call resolveHearth again with `saved` = the id saveHearth answered and `asked` = null.
//
// What is saved is an ID. A saved id this build does not know (an entry registered after this build) draws the default, said in `note`; an id
// asked in the address that is not registered draws the saved/default, said in `note`. The office, not the picker, decides who may save.

import { DEFAULT_ENTRY, ENTRY_ID } from "./slots.mjs";

const entryOf = (entries, id) => (typeof id === "string" ? entries.find((e) => e.id === id) ?? null : null);

/** The default entry, or the first there is. */
const defaultOf = (entries) => entryOf(entries, DEFAULT_ENTRY) ?? entries[0] ?? null;

/**
 * @param {{ entries: {id:string,title?:string}[], saved?: string|null|undefined, asked?: string|null }} p
 * @returns {{ entry: object|null, id: string|null, source: "preview"|"saved"|"default", savedId: string|null, unavailable: boolean, note: string }}
 */
export function resolveHearth({ entries = [], saved, asked = null } = {}) {   // `saved` has NO default: undefined means "the read failed", not "chose nothing"
  const unavailable = saved === undefined;
  const savedEntry = unavailable ? null : entryOf(entries, saved);
  const savedId = savedEntry && savedEntry.id !== DEFAULT_ENTRY ? savedEntry.id : null;
  let note = "";
  if (!unavailable && saved !== null && saved !== DEFAULT_ENTRY && !savedEntry) note = "This house's saved Hearth is not in this version of the site yet; showing the default.";
  if (unavailable) note = "The house's saved Hearth could not be read just now; showing the default.";

  const preview = asked ? entryOf(entries, asked) : null;
  if (asked && !preview) note = `No Hearth entry is registered as “${String(asked).slice(0, 40)}”; showing ${(savedEntry ?? defaultOf(entries))?.title ?? "the default"}.`;
  if (preview && preview.id !== (savedEntry ?? defaultOf(entries))?.id) return { entry: preview, id: preview.id, source: "preview", savedId, unavailable, note: "" };

  const drawn = savedEntry ?? defaultOf(entries);
  return { entry: drawn, id: drawn?.id ?? null, source: savedId ? "saved" : "default", savedId, unavailable, note };
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

/**
 * THE ONLY WRITE: the signed-in human saves `id` (a registered entry's id) or null (back to the default). The office decides who may: a refusal
 * comes back as { ok: false, status, message } in the office's own words. Never called by a preview.
 */
export async function saveHearth({ slug, id, token, api, fetchImpl = globalThis.fetch } = {}) {
  if (!token) return { ok: false, status: 401, message: "Sign in to choose this house's Hearth." };
  try {
    const r = await fetchImpl(`${api}/households/${encodeURIComponent(slug)}/hearth`, {
      method: "PATCH",
      headers: { "content-type": "application/json", accept: "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ hearth: id === null || id === DEFAULT_ENTRY ? null : id }),
    });
    const body = await r.json().catch(() => null);
    if (!r.ok) return { ok: false, status: r.status, message: String(body?.hint ?? body?.defect ?? "The office could not keep that.").slice(0, 300) };
    return { ok: true, status: r.status, hearth: typeof body?.hearth === "string" ? body.hearth : null };
  } catch {
    return { ok: false, status: 0, message: "The office could not be reached; nothing was saved." };
  }
}
