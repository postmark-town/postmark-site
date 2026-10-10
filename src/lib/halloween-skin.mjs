// halloween-skin.mjs — the season's skin as tokens (POS-553, Darko's ruling
// 2026-10-10 09:17: "the gray-purple instead of deep blue of the site, ... some
// violet and orange and rare blood red as accents ... the barovia night with a
// hint of classic halloween"). A MOCKUP for the board; two variants of one
// palette, and the CSS that lays a variant over the site's own tokens at a
// ramp `k` (0 = the site as it is, 1 = the full skin).
//
// Pure: the board's swatches and contrast table import this file too, so the
// numbers it prints are the colours the pages wear.

export const VARIANTS = {
  1: {
    name: "Slate-violet (cooler)",
    base: "#221f2b", panel: "#2d2939", ink: "#e9e3d8", quiet: "#aaa3b8",
    violet: "#a58ad8", orange: "#e8913f", blood: "#9b1f2a",
    link: "#c9b2f2", focus: "#f2b25c",
    paper: "#e7e1d6", paperInk: "#2a2430", paperQuiet: "#5b5266", paperAccent: "#5f448f",
  },
  2: {
    name: "Plum-grey (warmer, candle orange)",
    base: "#29222a", panel: "#362c36", ink: "#f0e6d6", quiet: "#b8a9a6",
    violet: "#bd8fd0", orange: "#f39a3d", blood: "#a3222a",
    link: "#e5b4d6", focus: "#ffc06a",
    paper: "#ece2d4", paperInk: "#2e2328", paperQuiet: "#62535a", paperAccent: "#74397f",
  },
};

// the site's own colours each token walks from, so k = 0 is the site unchanged
export const SITE = {
  night: "#070b15", harbor: "#0d1426", harbor2: "#1c2c4f", gold: "#e8c48b", goldBright: "#f6dcae",
  paper: "#f7efdc", paperDeep: "#efe3c8", line: "#e3d4b8", ink: "#2e2417", inkSoft: "#6d5c44", accent: "#a4632a", wax: "#9c3f2e",
  // the World page's frame (viewer.mjs .wv)
  wvNight: "#14171d", wvPanel: "#1c2129", wvPanel2: "#20262f", wvLine: "#2e3542", wvPaper: "#e8e0cf", wvDim: "#9a9280", wvAmber: "#e8c56a",
};

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (rgb) => "#" + rgb.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
/** sRGB mix, as color-mix(in srgb, a, b p) computes it. */
export function mix(a, b, p) { const A = hex(a), B = hex(b); return toHex(A.map((v, i) => v + (B[i] - v) * p)); }
function lum(h) { const c = hex(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
/** WCAG contrast ratio of two hex colours. */
export function contrast(a, b) { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); }

/** The text/background pairs a variant is used in, with what each is for. */
export function pairsOf(v) {
  return [
    ["ink", "base", "body text on the page"], ["ink", "panel", "body text on a panel"],
    ["quiet", "base", "secondary text"], ["quiet", "panel", "secondary text on a panel"],
    ["violet", "base", "violet accent text"], ["violet", "panel", "violet accent on a panel"],
    ["orange", "base", "orange accent text"], ["orange", "panel", "orange accent on a panel"],
    ["link", "base", "links"], ["link", "panel", "links on a panel"],
    ["base", "orange", "button label on orange"], ["ink", "blood", "text on a blood seal or alert"],
    ["paperInk", "paper", "body text on a letter card"], ["paperQuiet", "paper", "secondary text on a card"],
    ["paperAccent", "paper", "accent text on a card"],
  ].map(([fg, bg, use]) => ({ fg, bg, use, ratio: contrast(v[fg], v[bg]) }));
}

/** The site's token overrides for a variant at ramp k (0..1). */
export function siteSkinCSS(v, k) {
  const m = (a, b) => mix(a, b, k);
  return `
  body .pm {
    --pm-night: ${m(SITE.night, v.base)}; --pm-harbor: ${m(SITE.harbor, v.panel)}; --pm-harbor-2: ${m(SITE.harbor2, mix(v.panel, v.violet, 0.25))};
    --pm-gold: ${m(SITE.gold, v.orange)}; --pm-gold-bright: ${m(SITE.goldBright, mix(v.orange, v.ink, 0.45))};
    --pm-paper: ${m(SITE.paper, v.paper)}; --pm-paper-deep: ${m(SITE.paperDeep, mix(v.paper, v.quiet, 0.18))}; --pm-line: ${m(SITE.line, mix(v.paper, v.quiet, 0.4))};
    --pm-ink: ${m(SITE.ink, v.paperInk)}; --pm-ink-soft: ${m(SITE.inkSoft, v.paperQuiet)}; --pm-accent: ${m(SITE.accent, v.paperAccent)}; --pm-wax: ${m(SITE.wax, v.blood)};
  }
  body { background: radial-gradient(1100px 600px at 82% -10%, ${mix(v.base, v.violet, 0.22 * k)}, transparent 70%), ${m("#0d1426", v.base)} !important; }
  .pm :focus-visible { outline: 2px solid ${v.focus}; outline-offset: 2px; }`;
}

/** The World page's frame (never the map) for a variant at ramp k. */
export function worldFrameCSS(v, k) {
  const m = (a, b) => mix(a, b, k);
  return `
  .wv { --night: ${m(SITE.wvNight, v.base)}; --panel: ${m(SITE.wvPanel, v.panel)}; --panel2: ${m(SITE.wvPanel2, mix(v.panel, v.violet, 0.12))};
    --line: ${m(SITE.wvLine, mix(v.panel, v.quiet, 0.3))}; --paper: ${m(SITE.wvPaper, v.ink)}; --dim: ${m(SITE.wvDim, v.quiet)}; --amber: ${m(SITE.wvAmber, v.orange)}; }`;
}
