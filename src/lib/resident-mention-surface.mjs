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
// A GRADIENT is colours: each of its stops is a shade the name may sit on (the page's own night is a radial gradient, lighter at the top than its
// background colour), so each stop is composited in its layer like a colour, and the mention takes the ink that reads on EVERY shade measured
// (CORE-178 FIX: on the Hearth's compact card the ink met 4.5:1 against the body's colour and fell short of the gradient drawn over it).
// What it can't see: a background PICTURE (`url(…)`, a design's picture behind its glass) is not a colour, so the layers under it count; the page's
// night is the floor when no layer is opaque. Neutral mentions (no colour chosen) are left alone: no invented colour.
//
// Pure: the DOM pass takes `getStyle(el)` (window.getComputedStyle in the page), so a test can drive it with any surfaces.

import { contrast, hexOf, inkOn } from "./resident-mention.mjs";

/** The page's night (postmark.css --pm-night): the floor under every translucent layer when nothing above it is opaque. */
export const FLOOR = "#070b15";

/** A computed CSS colour (`rgb(r, g, b)`, `rgba(r, g, b, a)`, `rgb(r g b / a)`, `#hex`, `transparent`) as { r, g, b, a }, or null. */
export function parseColour(value) {
  const s = String(value ?? "").trim().toLowerCase();
  if (!s) return null;
  if (s === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
  const hex = hexOf(s);
  if (hex) return { r: parseInt(hex.slice(1, 3), 16), g: parseInt(hex.slice(3, 5), 16), b: parseInt(hex.slice(5, 7), 16), a: 1 };
  // what getComputedStyle hands back for a resolved color-mix(): color(srgb r g b / a), channels 0..1
  const srgb = /^color\(\s*srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+)(%?))?\s*\)$/.exec(s);
  if (srgb) {
    const [r, g, b] = [srgb[1], srgb[2], srgb[3]].map((x) => Math.max(0, Math.min(255, Number(x) * 255)));
    const a = srgb[4] === undefined ? 1 : srgb[5] === "%" ? Number(srgb[4]) / 100 : Number(srgb[4]);
    return [r, g, b, a].every(Number.isFinite) ? { r, g, b, a: Math.max(0, Math.min(1, a)) } : null;
  }
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

const STOP = /rgba?\([^)]*\)|color\(srgb[^)]*\)|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/gi;

/** A computed `background-image`'s gradient colour stops, as { r, g, b, a } (nothing for `none` or a picture). */
export function gradientStops(image) {
  const s = String(image ?? "");
  if (!/gradient\(/i.test(s)) return [];
  const out = [];
  for (const m of s.matchAll(STOP)) { const c = parseColour(m[0]); if (c && c.a > 0) out.push(c); }
  return out;
}

/**
 * Every shade actually under `el`: the composite of its and its ancestors' background colours (surfaceUnder's answer), and the same composite with
 * each gradient stop laid in its own layer, down to the first opaque background. Hexes, the colours' composite first.
 */
export function surfacesUnder(el, getStyle, floor = FLOOR) {
  const walk = [];   // nearest first: { c: its background colour or null, stops: its gradient's }
  for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
    let st = null;
    try { st = getStyle(n); } catch { st = null; }
    const c = parseColour(st?.backgroundColor);
    const stops = gradientStops(st?.backgroundImage);
    const colour = c && c.a > 0 ? c : null;
    if (!colour && !stops.length) continue;
    walk.push({ c: colour, stops });
    if (colour && colour.a >= 0.999) break;
  }
  const out = [composite(walk.map((w) => w.c).filter(Boolean), floor)];
  walk.forEach((w, i) => {
    for (const s of w.stops) {
      const hexed = composite([...walk.slice(0, i).map((x) => x.c), s, ...walk.slice(i).map((x) => x.c)].filter(Boolean), floor);
      if (!out.includes(hexed)) out.push(hexed);
    }
  });
  return out;
}

/** The ink of `accent` that reads best on every one of `surfaces` (the one whose weakest contrast across them is highest), or null. */
export function inkForAll(accent, surfaces) {
  let best = null, bestMin = -1;
  for (const s of surfaces) {
    const ink = inkOn(accent, s);
    if (!ink) continue;
    const min = Math.min(...surfaces.map((t) => contrast(ink, t)));
    if (min > bestMin) { best = ink; bestMin = min; }
  }
  return best;
}

const ACCENT = /--rm-c:\s*(#[0-9a-fA-F]{6})/;

/**
 * Re-ink every coloured mention under `root` for the background it actually sits on. Returns how many it inked.
 * @param {Element} root
 * @param {{ getStyle: (el: Element) => { backgroundColor?: string, backgroundImage?: string } | null, floor?: string }} o
 */
export function inkOnActualSurface(root, { getStyle, floor = FLOOR } = {}) {
  if (!root || typeof root.querySelectorAll !== "function" || typeof getStyle !== "function") return 0;
  let n = 0;
  for (const m of root.querySelectorAll(".rm")) {
    if (m.classList?.contains("is-neutral")) continue;
    const accent = ACCENT.exec(m.getAttribute("style") ?? "")?.[1];
    if (!accent) continue;
    const ink = inkForAll(accent, surfacesUnder(m, getStyle, floor));
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
    const ink = inkForAll(accent, surfacesUnder(e, getStyle, floor));
    if (!ink) continue;
    e.style.setProperty("--hd-c", ink);
    n++;
  }
  return n;
}
