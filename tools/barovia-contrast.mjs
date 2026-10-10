#!/usr/bin/env node
// barovia-contrast.mjs — the Barovia palette's text contrast at a ramp k (0.35
// at the Mists' first crossing, 1 from 284; default 1), against WCAG AA (4.5).
// The token mixes are src/components/BaroviaShell.astro's, then its multiply
// grade over everything (a `color` blend keeps luminance, so it is left out).
//   node tools/barovia-contrast.mjs [k]
const k = Number(process.argv[2] ?? 1);
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, p) => hex(a).map((v, i) => Math.round(v + (hex(b)[i] - v) * p));
const a = 0.12 + 0.2 * k, g = hex("#2a2340");
const grade = (rgb) => rgb.map((v, i) => Math.round(v * (1 - a + (a * g[i]) / 255)));
const lum = (rgb) => { const c = rgb.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (x, y) => { const [p, q] = [lum(x), lum(y)].sort((m, n) => n - m); return (p + 0.05) / (q + 0.05); };
const P = (n) => Math.round(k * n) / 100;
const T = {
  paper: mix("#f7efdc", "#d6d0dc", P(70)), "paper-deep": mix("#efe3c8", "#c9c2d1", P(70)),
  "ink-soft": mix("#6d5c44", "#2e2417", P(60)), accent: mix("#a4632a", "#7a3a0e", (60 + 40 * k) / 100), wax: mix("#9c3f2e", "#6e1f18", P(80)),
  gold: mix("#e8c48b", "#f0a24a", P(85)), "gold-bright": mix("#f6dcae", "#ffc77a", P(85)),
  night: mix("#070b15", "#05040b", P(100)), harbor: mix("#0d1426", "#110d1f", P(100)), ink: hex("#2e2417"),
};
const PAIRS = [["ink", "paper"], ["ink", "paper-deep"], ["ink-soft", "paper"], ["ink-soft", "paper-deep"], ["accent", "paper"], ["wax", "paper"], ["gold", "night"], ["gold", "harbor"], ["gold-bright", "harbor"]];
let fail = 0;
for (const [fg, bg] of PAIRS) {
  const r = ratio(grade(T[fg]), grade(T[bg]));
  if (r < 4.5) fail += 1;
  console.log(`${(fg + " on " + bg).padEnd(26)} ${r.toFixed(2)} ${r >= 4.5 ? "AA" : "BELOW AA"}`);
}
process.exitCode = fail ? 1 : 0;
