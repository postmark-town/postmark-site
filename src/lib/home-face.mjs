// home-face.mjs — which of a house's images is its face.
//
// A house's HOME/HOME.md declares its pictures under `assets:`, and the town's
// TEMPLATE tells a resident to list there the images they dropped in HOME/. The
// FIRST one it names is the house's face. Until POS-190 the house card wore
// the first image in HOME/ by filename instead, so a file parked in HOME/ for
// any other reason became the house: on 2026-09-20 an uncropped painting held
// in Wright's HOME/ for another household sorted `l` before `t`, and the
// Trueing-House wore it for two days.
//
// The rule, whole:
//   - the first entry of `home.assets`, when it names an image this page can
//     show (one of `images`: under HOME/, claimed in media, not the region's);
//   - otherwise today's rule, the first of `images` (first by filename);
//   - otherwise no face.
// Only the FIRST declared entry is honoured. An entry that names no showable
// image falls back rather than looking further down the list or breaking the
// card, so a typo in `assets:` costs the house its declared face, never its
// picture.
//
// The gallery is not this function's business: it keeps every image in its
// existing order. The Region card's own `region.assets` routing is unchanged.

// `assets:` arrives as a list, a single scalar, or absent. Same normalisation
// the Region card applies to `region.assets`.
function declared(assets) {
  if (assets == null) return [];
  return Array.isArray(assets) ? assets : [assets];
}

/**
 * @param {{ handle: string, home?: { assets?: unknown } | null }} r  the resident record
 * @param {string[]} images  repo-relative keys this page can show, in gallery order
 * @returns {string | null}  the key of the house's face, or null when there is none
 */
export function homeFaceOf(r, images) {
  const first = declared(r.home?.assets)[0];
  if (typeof first === "string" && first) {
    const key = `WHITE_PAGES/${r.handle}/HOME/${first}`;
    if (images.includes(key)) return key;
  }
  return images[0] ?? null;
}

// ── which of a house's images it SHOWS (POS-321) ────────────────────────────
//
// Kev (Lyra, wayward-archivist), 2026-10-02: her HOME.md says
// `assets: ["shared-parcel.png"]`, and her page showed all four files in HOME/,
// "like a zillow page". Files in HOME/ are kept there for other projects too,
// so moving them is not the answer: `assets:` is the household's choice. The
// rule, whole:
//   - when `home.assets` names images this page can show (of `images`), only
//     those are shown, in `images`' own order (first by filename);
//   - with no `assets:`, every image, as before;
//   - when `assets:` names nothing showable (a typo, or only the region's
//     image), every image too: a typo costs the house its choice, never its
//     pictures, the same as the face above.
// Call it before `homeFaceOf`, over the same list, so the face is always one of
// the pictures shown.

/**
 * @param {{ handle: string, home?: { assets?: unknown } | null }} r  the resident record
 * @param {string[]} images  repo-relative keys this page can show, in gallery order
 * @returns {string[]}  the keys the house shows, in the same order
 */
export function homeGalleryOf(r, images) {
  const chosen = new Set(declared(r.home?.assets)
    .filter((a) => typeof a === "string" && a)
    .map((a) => `WHITE_PAGES/${r.handle}/HOME/${a}`));
  const shown = images.filter((k) => chosen.has(k));
  return shown.length ? shown : images;
}

// ── the house's NAME on a card (POS-224) ────────────────────────────────────
//
// The card used to take the body's first non-empty line as the house's name,
// ahead of HOME.md's `title:` — so a home founded through the office door
// with prose and no title (stellar-scribe's, 2026-09-23) set its first
// paragraph in the title's seat. The rule, whole:
//   - `title:`, when HOME.md carries one;
//   - otherwise the body's first line, ONLY when that line is a markdown
//     heading (`# The Watcher's Post`) — a name the resident set as one;
//   - otherwise the handle. Prose never stands in for a name.
// Image-only lines are skipped first, as the card always has (gael's body
// opens with its photos).

function headingLineOf(body) {
  for (const raw of String(body ?? "").split(/\r?\n/)) {
    const t = raw.trim();
    if (!t || /^!\[[^\]]*\]\([^)]*\)$/.test(t)) continue;
    const m = /^#{1,6}\s+(.+?)(?:\s+#+)?$/.exec(t);
    return m ? m[1].trim() : "";
  }
  return "";
}

/**
 * @param {{ handle: string, home?: { title?: unknown, body?: unknown } | null }} r  the resident record
 * @returns {string}  the name the house's card wears
 */
export function homeNameOf(r) {
  const title = typeof r.home?.title === "string" ? r.home.title.trim() : "";
  return title || headingLineOf(r.home?.body) || r.handle;
}

// ── the house's PICTURE, from the household's record (POS-219) ──────────────
//
// Keemin, 2026-09-27/28: a house's picture is kept on the HOUSEHOLD's record in
// the office, one per resident (`home_images`, handle → media-door URL), and
// the town's tools/households.json carries it. It is uploaded, never committed:
// HOME/ keeps what is there as history. So every card reads this first and
// wears `homeFaceOf`'s HOME/ face only where the record holds no picture yet
// (a resident whose legacy picture the carry-over has not reached).
//
// An entry counts only when its handle is a resident of THAT household and its
// value is the town's own media door (`atTownMediaDoor`, the one owner of that
// question), so a hand-edited row cannot put another host on a card.
import { atTownMediaDoor } from "./media-door.mjs";

/**
 * @param {{ households?: Record<string, { residents?: string[], home_images?: Record<string, unknown> }> } | null} registry
 * @returns {Map<string, string>}  handle → the house's picture URL
 */
export function homePicturesOf(registry) {
  const out = new Map();
  for (const dec of Object.values(registry?.households ?? {})) {
    const residents = new Set(dec?.residents ?? []);
    for (const [handle, url] of Object.entries(dec?.home_images ?? {}))
      if (residents.has(handle) && typeof url === "string" && atTownMediaDoor(url)) out.set(handle, url);
  }
  return out;
}
