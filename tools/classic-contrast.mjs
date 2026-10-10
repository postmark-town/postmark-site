#!/usr/bin/env node
// classic-contrast.mjs — the Classic palette's text contrast at a ramp k (0.35
// at the Mists' first crossing, 1 from 284; default 1), against WCAG AA (4.5).
// The mixes are src/components/ClassicShell.astro's.
//   node tools/classic-contrast.mjs [k]
const k = Number(process.argv[2] ?? 1);
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, p) => hex(a).map((v, i) => Math.round(v + (hex(b)[i] - v) * p));
const lum = (rgb) => { const c = rgb.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (x, y) => { const [p, q] = [lum(x), lum(y)].sort((m, n) => n - m); return (p + 0.05) / (q + 0.05); };
const P = (n) => Math.round(k * n) / 100;
const T = {
  gold: mix("#e8c48b", "#ff8a2a", P(90)), "gold-bright": mix("#f6dcae", "#ffb468", P(90)),
  accent: mix("#a4632a", "#5e2f91", (55 + 45 * k) / 100), wax: mix("#9c3f2e", "#b8431a", P(60)),
  night: mix("#070b15", "#160a26", P(100)), harbor: mix("#0d1426", "#22113a", P(100)),
  paper: hex("#f7efdc"), "paper-deep": hex("#efe3c8"), ink: hex("#2e2417"), "ink-soft": hex("#6d5c44"), "button ink": hex("#241505"),
};
const PAIRS = [["ink", "paper"], ["ink-soft", "paper"], ["ink-soft", "paper-deep"], ["accent", "paper"], ["wax", "paper"], ["gold", "night"], ["gold", "harbor"], ["gold-bright", "harbor"], ["button ink", "gold"], ["button ink", "gold-bright"]];
let fail = 0;
for (const [fg, bg] of PAIRS) {
  const r = ratio(T[fg], T[bg]);
  if (r < 4.5) fail += 1;
  console.log(`${(fg + " on " + bg).padEnd(26)} ${r.toFixed(2)} ${r >= 4.5 ? "AA" : "BELOW AA"}`);
}
process.exitCode = fail ? 1 : 0;
