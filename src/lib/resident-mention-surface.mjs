// resident-mention-surface.mjs — a resident mention's ink, measured on the surface it actually sits on (CORE-178).
//
// Darko, 2026-11-24 12:25 EST (a): "get everything to readable darkness". Wright's 17:29 reading (Facet's ruling, 17:38Z): every coloured part
// uses the favourite hue at readable darkness "on its actual surface, including authored light-glass surfaces … Support the actual host surface;
// night/paper assumptions alone do not cover glass."
//
// The site's own surfaces are known at build time (resident-mention.mjs carries a night and a paper ink). A Hearth design's are not: its template
// sets the stage's glass and paper (`--hx-glass`, `--hx-paper`) to any colour, light ones included. So where a page hosts authored surfaces, it asks
// this module, in the browser, after it paints: for each coloured mention, the background actually under it (the first opaque layer up its
// ancestors, with every translucent layer above composited onto it), and the ink of the mention's colour for THAT background, written as the
// mention's `--rm-ink` with the class `on-ink` (resident-mention.css). Ring, underline and name follow it (currentColor).
//
// What it can't see: a background IMAGE (a design's picture behind its glass) is not a colour, so the layer under it counts; the page's night is the
// floor when no layer is opaque. Neutral mentions (no colour chosen) are left alone: no invented colour.
//
// Pure: the DOM pass takes `getStyle(el)` (window.getComputedStyle in the page), so a test can drive it with any surfaces.

import { hexOf, inkOn } from "./resident-mention.mjs";

/** The page's night (postmark.css --pm-night): the floor under every translucent layer when nothing above it is opaque. */
export const FLOOR = "#070b15";

/** A computed CSS colour (`rgb(r, g, b)`, `rgba(r, g, b, a)`, `rgb(r g b / a)`, `#hex`, `transparent`) as { r, g, b, a }, or null. */
export function parseColour(value) {
  const s = String(value ?? "").trim().toLowerCase();
  if (!s) return null;
  if (s === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
  const hex = hexOf(s);
  if (hex) return { r: parseInt(hex.slice(1, 3), 16), g: parseInt(hex.slice(3, 5), 16), b: parseInt(hex.slice(5, 7), 16), a: 1 };
  const m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+)(%?))?\s*\)$/.exec(s);
  if (!m) return null;
  const a = m[4] === undefined ? 1 : m[5] === "%" ? Number(m[4]) / 100 : Number(m[4]);
  const [r, g, b] = [m[1], m[2], m[3]].map((x) => Math.max(0, Math.min(255, Number(x))));
  if (![r, g, b, a].every(Number.isFinite)) return null;
  return { r, g, b, a: Math.max(0, Math.min(1, a)) };
}

const toHex = ({ r, g, b }) => "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

/** `layers` from the nearest (top) to the farthest (bottom), each { r, g, b, a }: their composite over `floor`, as a hex. */
export function composite(layers, floor = FLOOR) {
  const base = parseColour(floor) ?? parseColour(FLOOR);
  let out = { r: base.r, g: base.g, b: base.b };
  for (const l of [...layers].reverse()) {
    if (!l || !(l.a > 0)) continue;
    out = { r: l.r * l.a + out.r * (1 - l.a), g: l.g * l.a + out.g * (1 - l.a), b: l.b * l.a + out.b * (1 - l.a) };
  }
  return toHex(out);
}

/** The background actually under `el`: its own and its ancestors' background colours, down to the first opaque one, composited. */
export function surfaceUnder(el, getStyle, floor = FLOOR) {
  const layers = [];
  for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
    let c = null;
    try { c = parseColour(getStyle(n)?.backgroundColor); } catch { c = null; }
    if (!c || c.a === 0) continue;
    layers.push(c);
    if (c.a >= 0.999) break;
  }
  return composite(layers, floor);
}

const ACCENT = /--rm-c:\s*(#[0-9a-fA-F]{6})/;

/**
 * Re-ink every coloured mention under `root` for the background it actually sits on. Returns how many it inked.
 * @param {Element} root
 * @param {{ getStyle: (el: Element) => { backgroundColor?: string } | null, floor?: string }} o
 */
export function inkOnActualSurface(root, { getStyle, floor = FLOOR } = {}) {
  if (!root || typeof root.querySelectorAll !== "function" || typeof getStyle !== "function") return 0;
  let n = 0;
  for (const m of root.querySelectorAll(".rm")) {
    if (m.classList?.contains("is-neutral")) continue;
    const accent = ACCENT.exec(m.getAttribute("style") ?? "")?.[1];
    if (!accent) continue;
    const ink = inkOn(accent, surfaceUnder(m, getStyle, floor));
    if (!ink) continue;
    m.style.setProperty("--rm-ink", ink);
    m.classList.add("on-ink");
    n++;
  }
  // the household card's other coloured parts (its portrait's ring, its wash, a feed line's accent: `--hd-c`), which carry their colour as
  // `data-rm-accent`: the same ink, for the background under THEM
  for (const e of root.querySelectorAll("[data-rm-accent]")) {
    const accent = hexOf(e.getAttribute("data-rm-accent"));
    if (!accent) continue;
    const ink = inkOn(accent, surfaceUnder(e, getStyle, floor));
    if (!ink) continue;
    e.style.setProperty("--hd-c", ink);
    n++;
  }
  return n;
}
