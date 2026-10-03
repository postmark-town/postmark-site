// home-pick.mjs — the list a household's picture picker saves (POS-321).
//
// A signed-in household ticks which of its HOME/ pictures its page shows, and
// Save rewrites HOME.md's `assets:` through the office's home-update act
// (PATCH /home/{handle} with `{ assets }`, office edit.mjs § assetNames). That
// act REPLACES the whole line, so this decides the whole list, whole:
//
//   - a declared picture still ticked keeps its place: the FIRST declared entry
//     is the house's face (home-face.mjs § homeFaceOf), so ticking a second
//     picture must not move the face;
//   - a newly ticked picture follows, in the picker's own order (filename);
//   - a declared file the picker does not list (the region's own image, or one
//     the media map has not claimed yet) is kept when it is still in HOME/, so
//     a Save never drops what it could not show; one no longer in HOME/ is
//     dropped, since the office would refuse the whole list over it;
//   - nothing ticked saves nothing (null). An empty list would CLEAR the
//     declaration, and the page would show every picture again, which is the
//     opposite of what unticking them all looks like.

const list = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]).filter((n) => typeof n === "string" && n);

/**
 * @param {{ declared?: unknown, pickable: string[], checked: Iterable<string>, onDisk?: string[] }} p
 *   declared  HOME.md's current `assets:` (a list, a scalar, or absent)
 *   pickable  the filenames the picker lists, in its order
 *   checked   the filenames ticked
 *   onDisk    every filename in HOME/ the build saw
 * @returns {string[] | null}  the `assets` to send, or null when nothing is ticked
 */
export function assetsToSave({ declared, pickable, checked, onDisk = [] }) {
  const ticked = new Set([...checked].filter((n) => pickable.includes(n)));
  if (!ticked.size) return null;
  const out = [];
  for (const n of list(declared)) {
    const keep = pickable.includes(n) ? ticked.has(n) : onDisk.includes(n);
    if (keep && !out.includes(n)) out.push(n);
  }
  for (const n of pickable) if (ticked.has(n) && !out.includes(n)) out.push(n);
  return out;
}

/** The filename of a HOME/ key, `WHITE_PAGES/<handle>/HOME/<name>`. */
export const homeFileName = (key) => String(key).split("/HOME/").slice(1).join("/HOME/");
