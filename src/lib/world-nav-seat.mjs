// world-nav-seat.mjs — where the World page's folded site nav sits on a phone (WLD-47).
//
// RULED (Darko, 2026-10-14 11:44 EDT): on a phone the site's links fold into one
// "☰ Postmark" pill, and the pill is MEASURED into a free patch rather than
// parked at a fixed top. The fixed top was the bug: WorldSignIn's phone rule put
// the cluster at top:50px, "under the world-root's glyph, the one clear patch",
// which stopped being clear on 2026-09-13 when the search pill wrapped the map's
// circles onto a second line. From then on every circle on a 390 px screen
// tapped "replay" or "conversations".
//
// So the seat is computed from the viewer's chrome as it actually measures, and a
// seventh circle, a new font or a longer placeholder moves the pill instead of
// burying the circles. Pure (rects in, a position out) so the rule is tested as
// itself; the island in WorldSignIn.astro does the measuring.

/** The viewer hides its side rail at this width and below (postmark-world
 *  spectator/viewer.mjs, `@media (max-width:720px){ … .wv-nav, .wv-view {
 *  display:none; } }`). The site's phone rules must break at the SAME width:
 *  test/world-nav-seat.test.mjs reads the pinned viewer and holds them equal. */
export const PHONE_MAX = 720;
export const PHONE_QUERY = `(max-width: ${PHONE_MAX}px)`;

/** the painting's own gutter (the viewer's chrome sits 10 px in from the edges) */
export const EDGE = 10;
/** the clear space kept between the pill and any of the viewer's chrome */
export const CLEAR = 4;

const overlaps = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
const grown = (r, d) => ({ left: r.left - d, top: r.top - d, right: r.right + d, bottom: r.bottom + d });

/**
 * The folded pill's seat, against the viewer's chrome along the painting's top.
 *
 * @param {{width:number,height:number}} pill   the pill's own size
 * @param {Array<DOMRect|null>} obstacles       the viewer's top chrome: the root
 *        glyph, the search pill, the row of circles (absent or unrendered ones
 *        are skipped: a rect with no area is not on the page)
 * @param {number|null} rowTop                  the top of the circles' row
 * @returns {{left:number, top:number}}
 *
 * First choice: the left edge of the circles' own row, which is the patch the
 * row leaves empty when it wraps under the search pill, so the pill costs the
 * painting nothing. That holds only if the pill clears everything there. If it
 * doesn't (the row didn't wrap and the glyph is in the way, or the row grew
 * wide enough to reach the pill), the pill drops under all of the chrome. That
 * spot is always free, so no width, font or button count can put it over a
 * circle.
 */
export function seatFold({ pill, obstacles, rowTop }) {
  const live = (obstacles || []).filter((r) => r && r.width > 0 && r.height > 0);
  const at = (top) => ({ left: EDGE, top, right: EDGE + pill.width, bottom: top + pill.height });
  if (rowTop != null && Number.isFinite(rowTop)) {
    const beside = grown(at(rowTop), CLEAR);
    if (!live.some((o) => overlaps(beside, o))) return { left: EDGE, top: Math.round(rowTop) };
  }
  const floor = live.reduce((m, r) => Math.max(m, r.bottom), EDGE - 2 * CLEAR);
  return { left: EDGE, top: Math.ceil(floor + 2 * CLEAR) };
}
