#!/usr/bin/env node
// dusk-contrast.mjs — the dusk palette's text contrast at a veil (default the
// deepest, 0.50), against WCAG AA (4.5 for body text). The mixes are
// src/components/Dusk.astro's, in sRGB as color-mix(in srgb) computes them.
//   node tools/dusk-contrast.mjs [veil]
const veil = Number(process.argv[2] ?? 0.5);
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, p) => hex(a).map((v, i) => Math.round(v + (hex(b)[i] - v) * p));
const lum = (rgb) => { const c = rgb.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const k = (n) => Math.round(veil * n) / 100;
const T = {
  paper: mix("#f7efdc", "#6b7686", k(52)), "paper-deep": mix("#efe3c8", "#6b7686", k(52)),
  "ink-soft": mix("#6d5c44", "#2e2417", k(100)), harbor: mix("#0d1426", "#263040", k(70)),
  gold: mix("#e8c48b", "#b7bec8", k(40)), accent: mix("#a4632a", "#4f2a0c", k(100)), wax: mix("#9c3f2e", "#5e2016", k(80)), ink: hex("#2e2417"), night: mix("#070b15", "#1a222e", k(60)),
};
const PAIRS = [["ink", "paper"], ["ink", "paper-deep"], ["ink-soft", "paper"], ["ink-soft", "paper-deep"], ["accent", "paper"], ["wax", "paper"], ["gold", "night"], ["gold", "harbor"]];
let fail = 0;
for (const [fg, bg] of PAIRS) {
  const r = ratio(T[fg], T[bg]);
  if (r < 4.5) fail += 1;
  console.log(`${(fg + " on " + bg).padEnd(24)} ${r.toFixed(2)} ${r >= 4.5 ? "AA" : "BELOW AA"}`);
}
process.exitCode = fail ? 1 : 0;
