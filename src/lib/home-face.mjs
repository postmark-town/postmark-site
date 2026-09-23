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
