// world-bymail-panel.mjs — "In town by mail" behind a button beside Time travel (POS-1006).
//
// Darko, 2026-11-11 22:10 EST: "I'm generally just not really a fan of having all of the non-walking residents in a giant blob at the bottom of the
// world page. Can we just hide it behind a button next to time travel, and then if you click it, it just opens like a panel that has the names, and
// you can click off of it. Let's just hotfix this."
//
// THE VIEWER KEEPS FILLING ITS ONE LIST. The World viewer (spectator/viewer.mjs § renderByMail) queries `.wv-bymail` within its root, replaces the
// `.wv-bymail-list` contents and toggles the section's `hidden` flag, including back to empty. The site does NOT copy that list or keep a second
// source: it only (a) hides the section unless the reader opened it, (b) restyles the very same section as a panel while open (world.astro's
// stylesheet), and (c) reads the section to decide whether to show the button and what its count is. These are the pure parts of that.

/** The names the viewer's list holds right now: its `li` count, 0 when the section is hidden (the viewer's own "nobody is in town by mail"), absent or empty. */
export function bymailCount(section) {
  if (!section || section.hidden) return 0;
  const n = section.querySelector?.(".wv-bymail-list")?.children?.length ?? 0;
  return Number.isFinite(n) ? n : 0;
}

/** The button's words: "In town by mail" with the count. */
export const bymailLabel = (n) => `In town by mail · ${n}`;

/**
 * Where the open panel sits, from the button's box and the window's: ABOVE the button when the controls hang from the bottom (desktop), BELOW it when
 * they hang from the top (a phone). Fixed coordinates, clamped so the panel is wholly inside the window with a 10px margin and never wider than 22rem
 * (352px) or the window less its margins. `maxHeight` is what is left on its side of the button, at most 30rem, so a long list scrolls inside the card.
 */
export function panelBox(btn, { width, height, fromTop = false }) {
  const M = 10, GAP = 8, CAP = 480;   // a card, not a column: at most 30rem tall, however tall the window
  const w = Math.max(160, Math.min(352, width - 2 * M));
  const left = Math.min(Math.max(M, btn.left), Math.max(M, width - M - w));
  if (fromTop) {
    const top = Math.min(btn.bottom + GAP, height - M - 80);
    return { left: Math.round(left), top: Math.round(top), width: Math.round(w), maxHeight: Math.min(CAP, Math.max(80, Math.round(height - M - top))) };
  }
  const bottom = Math.max(M, height - btn.top + GAP);
  return { left: Math.round(left), bottom: Math.round(bottom), width: Math.round(w), maxHeight: Math.min(CAP, Math.max(80, Math.round(height - M - bottom))) };
}

/** Is `target` outside both the panel and the button (so a press there should close the panel)? `contains(a, b)` is Node.contains. */
export function isOutside(target, panel, button) {
  const inside = (box) => Boolean(box && target && (box === target || box.contains?.(target)));
  return !(inside(panel) || inside(button));
}

/**
 * How many of the card's three columns a name takes, from its length: an ordinary short handle (the real list's median is 6 characters and 95 in 100 are at
 * most 20) is ONE column; a longer one takes TWO (up to 26); a longer one takes all THREE, and ends in an ellipsis only when even that is not enough.
 */
export function nameSpan(text) {
  const n = String(text ?? "").length;
  return n <= 12 ? 1 : n <= 26 ? 2 : 3;
}
