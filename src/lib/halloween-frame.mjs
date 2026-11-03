// halloween-frame.mjs — the front page's Halloween frame (Darko 2026-10-24 14:33; reworked
// 2026-10-24 for the SEASONAL theme): jack-o'-lanterns, webs, a witch hat and broom, bats,
// a pale moon and candles in the side gutters of the town's front page, drawn in the
// Mists skin's palette (halloween-skin.mjs variant 2: plum-grey ground, candle orange,
// violet, a rare blood-red accent), not the everyday harbour-night one. Hand-built inline
// SVG, no text, decorative only (aria-hidden, pointer-events none).
//
// THE ONE SWITCH, TWICE. The frame wears the same switch as the skin: siteMists() in
// mists-season.mjs (the build's crossing is inside the world's Mists schedule), so the
// skin and the frame always appear together. AND the calendar: it is also off from UNTIL,
// 2026-11-01 07:00Z = 03:00 EDT, an hour past the town's Halloween ending at 02:00 EDT on
// Nov 1, because the Mists may outlast Halloween and the frame must not. Both are checked
// at build (off, the component emits nothing, byte for byte), and the calendar once more
// in the browser (a page baked before UNTIL removes its own frame once the clock passes it).
// Locally: BUILD_CROSSING=300 npm run dev puts the skin and the frame on.
// TO REMOVE IT ALTOGETHER: delete the two <HalloweenFrame/> lines and the import in
// src/layouts/PostmarkLayout.astro, then this file, the component and its test.
import { VARIANTS, mix } from "./halloween-skin.mjs";

export const HALLOWEEN_FRAME = { from: "2026-10-01T00:00:00Z", until: "2026-11-01T07:00:00Z" };

/** Is the calendar window open at `now` (a Date or ms)? */
export function frameOn(now = Date.now(), { from, until } = HALLOWEEN_FRAME) {
  const t = +now;
  return Number.isFinite(t) && t >= Date.parse(from) && t < Date.parse(until);
}

/** The frame's whole switch: the skin's (`mists`, siteMists()'s answer, truthy when the
 *  Mists stand for this build) AND the calendar window. */
export const frameShows = (mists, now = Date.now(), cfg = HALLOWEEN_FRAME) => !!mists && frameOn(now, cfg);

const V = VARIANTS[2];
const P = {
  pumpkin: V.orange, pumpkinLo: mix(V.orange, V.base, 0.6), pumpkinHi: mix(V.orange, V.base, 0.12),
  glow: mix(V.orange, V.ink, 0.78), ink: V.base,
  stem: mix(V.violet, V.base, 0.55), fog: mix(V.quiet, V.violet, 0.25), violet: V.violet,
  wood: mix(V.quiet, V.base, 0.6), straw: mix(V.orange, V.quiet, 0.45), strawLo: mix(V.orange, V.base, 0.45),
  hat: mix(V.panel, V.base, 0.4), hatRim: V.violet, blood: V.blood, gold: V.orange, cream: mix(V.ink, V.quiet, 0.2),
  bat: mix(V.panel, V.violet, 0.28), moon: mix(V.ink, V.violet, 0.12), plate: V.panel,
};
const svg = (vb, body, cls = "") =>
  `<svg class="pm-hwf-art ${cls}" viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">${body}</svg>`;

/** A jack-o'-lantern, lit from inside. `mood` varies the face (0 grin, 1 round-eyed, 2 sleepy). */
export function pumpkin(mood = 0) {
  const faces = [
    `<path d="M33 52 L45 38 L55 54 Z M65 54 L75 38 L87 52 Z M60 62 L54 72 L66 72 Z M30 78 Q60 106 90 78 L84 76 L78 84 L70 78 L60 86 L50 78 L42 84 L36 76 Z"/>`,
    `<circle cx="42" cy="52" r="9"/><circle cx="78" cy="52" r="9"/><path d="M60 62 L54 72 L66 72 Z M38 80 Q60 98 82 80 Q60 90 38 80 Z"/>`,
    `<path d="M32 54 Q42 46 52 54 Q42 50 32 54 Z M68 54 Q78 46 88 54 Q78 50 68 54 Z M60 64 L55 72 L65 72 Z M44 84 Q60 92 76 84 Q60 96 44 84 Z"/>`,
  ];
  return svg("0 0 120 112", `
    <path fill="${P.stem}" d="M56 22 C54 12 58 6 66 4 C65 10 66 14 69 18 C66 24 60 26 56 22 Z"/>
    <path fill="none" stroke="${P.stem}" stroke-width="2.4" stroke-linecap="round" d="M69 8 C78 4 84 8 82 14 C80 18 76 16 77 13"/>
    <ellipse cx="60" cy="66" rx="52" ry="40" fill="${P.pumpkinLo}"/>
    <ellipse cx="34" cy="66" rx="30" ry="39" fill="${P.pumpkin}"/>
    <ellipse cx="86" cy="66" rx="30" ry="39" fill="${P.pumpkin}"/>
    <ellipse cx="60" cy="66" rx="25" ry="40" fill="${P.pumpkinHi}"/>
    <path fill="none" stroke="${P.pumpkinLo}" stroke-width="1.6" opacity="0.7" d="M60 26 C50 44 50 88 60 106 M60 26 C70 44 70 88 60 106"/>
    <g fill="${P.glow}">${faces[mood % 3]}</g>`, "pm-hwf-pumpkin");
}

/** A spider web for the top-left corner (flip it with CSS for the right). */
export function web() {
  const R = 150, n = 6;
  const pts = (r) => Array.from({ length: n }, (_, i) => { const a = (i / (n - 1)) * Math.PI / 2; return [r * Math.cos(a), r * Math.sin(a)]; });
  const f = (x) => x.toFixed(1);
  let d = pts(R).map(([x, y]) => `M0 0 L${f(x)} ${f(y)}`).join(" ");
  for (const r of [34, 66, 98, 128]) {
    const p = pts(r);
    for (let i = 0; i < n - 1; i++) {
      const [x1, y1] = p[i], [x2, y2] = p[i + 1], mx = (x1 + x2) / 2 * 0.86, my = (y1 + y2) / 2 * 0.86;
      d += ` M${f(x1)} ${f(y1)} Q${f(mx)} ${f(my)} ${f(x2)} ${f(y2)}`;
    }
  }
  return svg("0 0 160 160", `
    <path d="${d}" fill="none" stroke="${P.fog}" stroke-width="1.15" stroke-linecap="round" opacity="0.6"/>
    <path d="M104 84 L104 112" stroke="${P.fog}" stroke-width="1" opacity="0.7"/>
    <g class="pm-hwf-spider" fill="${P.ink}" stroke="${P.fog}" stroke-width="0.8" stroke-opacity="0.7">
      <ellipse cx="104" cy="118" rx="6" ry="7"/><circle cx="104" cy="109" r="3.6"/>
      <path fill="none" d="M98 114 L91 109 L88 114 M98 119 L90 121 L88 127 M110 114 L117 109 L120 114 M110 119 L118 121 L120 127"/>
    </g>
    <circle cx="102.4" cy="108.4" r="0.9" fill="${P.glow}" stroke="none"/><circle cx="105.6" cy="108.4" r="0.9" fill="${P.glow}" stroke="none"/>`, "pm-hwf-web");
}

export function witchHat() {
  return svg("0 0 140 124", `
    <path fill="${P.hat}" stroke="${P.hatRim}" stroke-opacity="0.7" stroke-width="1.4" stroke-linejoin="round" d="M40 90 C50 62 58 42 70 26 C78 15 90 10 102 14 C95 18 92 25 94 33 C98 52 104 72 112 90 Z"/>
    <path fill="${P.hat}" stroke="${P.hatRim}" stroke-opacity="0.7" stroke-width="1.4" stroke-linejoin="round" d="M12 96 C30 84 92 80 130 96 C114 112 38 116 12 96 Z"/>
    <path fill="${P.blood}" d="M44 80 C62 85 92 85 109 80 L112 90 C92 96 62 96 41 90 Z"/>
    <rect x="68" y="80" width="16" height="14" rx="2" fill="none" stroke="${P.gold}" stroke-width="2.4" transform="rotate(3 76 87)"/>`, "pm-hwf-hat");
}

export function broom() {
  return svg("0 0 64 176", `
    <path d="M47 2 L33 112" stroke="${P.wood}" stroke-width="5" stroke-linecap="round" fill="none"/>
    <path fill="${P.straw}" d="M22 106 L44 106 L58 172 Q44 164 36 171 Q28 163 20 171 Q12 164 4 172 Z"/>
    <path fill="none" stroke="${P.strawLo}" stroke-width="1.3" stroke-linecap="round" d="M28 112 L18 166 M34 112 L33 168 M40 112 L48 166 M23 110 L9 168 M44 110 L56 168"/>
    <path fill="${P.violet}" opacity="0.85" d="M22 104 L45 104 L46 116 L21 116 Z"/>`, "pm-hwf-broom");
}

export function bat() {
  return svg("0 0 60 30", `<path fill="${P.bat}" stroke="${P.hatRim}" stroke-opacity="0.45" stroke-width="0.7" d="M30 10 C27 5 25 3 22 3 L23 9 C16 4 8 4 2 10 C8 10 11 13 12 18 C16 14 20 14 22 19 C26 17 28 18 30 24 C32 18 34 17 38 19 C40 14 44 14 48 18 C49 13 52 10 58 10 C52 4 44 4 37 9 L38 3 C35 3 33 5 30 10 Z"/>`, "pm-hwf-bat");
}

export function moon() {
  return svg("0 0 100 100", `<path fill="${P.moon}" opacity="0.92" d="M68 6 A44 44 0 1 0 94 68 A34 34 0 1 1 68 6 Z"/>
    <g fill="${P.violet}" opacity="0.9"><path d="M82 14 l1.6 4 4 1.6 -4 1.6 -1.6 4 -1.6 -4 -4 -1.6 4 -1.6 z"/><path d="M92 36 l1 2.4 2.4 1 -2.4 1 -1 2.4 -1 -2.4 -2.4 -1 2.4 -1 z"/></g>`, "pm-hwf-moon");
}

export function candles() {
  const flame = (x, y) => `<path class="pm-hwf-flame" fill="${P.glow}" d="M${x} ${y} c-4 -6 -3 -12 0 -17 c3 5 4 11 0 17 z"/>`;
  return svg("0 0 96 112", `
    <ellipse cx="48" cy="100" rx="42" ry="8" fill="${P.plate}" stroke="${P.hatRim}" stroke-opacity="0.6"/>
    <g fill="${P.cream}"><rect x="14" y="56" width="16" height="44" rx="2"/><rect x="40" y="36" width="16" height="64" rx="2"/><rect x="66" y="64" width="16" height="36" rx="2"/></g>
    <g fill="${P.straw}" opacity="0.8"><path d="M14 62 h16 v6 q-3 7 -6 0 q-3 5 -6 -1 q-2 3 -4 0 z"/><path d="M40 44 h16 v8 q-4 8 -8 0 q-4 5 -8 -2 z"/></g>
    <g stroke="${P.ink}" stroke-width="1.2"><path d="M22 56 v-5 M48 36 v-5 M74 64 v-5"/></g>
    ${flame(22, 51)}${flame(48, 31)}${flame(74, 59)}`, "pm-hwf-candles");
}

// the decoration, once: the wide-screen gutters (fixed), and the narrow top and foot bands (in flow)
const fixedLayer = () => `<div class="pm-hwf-gutters" aria-hidden="true">
  <div class="pm-hwf-side pm-hwf-l">${web()}<div class="pm-hwf-stack">${bat()}${candles()}${pumpkin(0)}</div></div>
  <div class="pm-hwf-side pm-hwf-r">${web()}<div class="pm-hwf-stack">${moon()}<div class="pm-hwf-pair">${witchHat()}${broom()}</div>${pumpkin(1)}</div></div>
</div>`;
const topBand = () => `<div class="pm-hwf-top" aria-hidden="true">${web()}${bat()}${bat()}${web()}</div>`;
const footBand = () => `<div class="pm-hwf-foot" aria-hidden="true">${pumpkin(0)}${witchHat()}${candles()}${pumpkin(2)}${moon()}</div>`;

export const FRAME_CSS = `
.pm-hwf-art { display: block; overflow: visible; }
.pm-hwf-gutters { display: none; }
.pm-hwf-top, .pm-hwf-foot { pointer-events: none; display: flex; align-items: center; justify-content: space-between; }
.pm-hwf-top { height: 54px; margin: 0 0 -6px; padding: 0; overflow: hidden; }
.pm-hwf-top .pm-hwf-web { width: 54px; height: 54px; opacity: 0.85; }
.pm-hwf-top .pm-hwf-web:last-child { transform: scaleX(-1); }
.pm-hwf-top .pm-hwf-bat { width: 26px; margin: 0 auto; animation: pm-hwf-bob 7s ease-in-out infinite; }
.pm-hwf-foot { justify-content: center; gap: 18px; padding: 8px 1em 26px; flex-wrap: nowrap; overflow: hidden; }
.pm-hwf-foot .pm-hwf-art { height: 54px; width: auto; flex: 0 0 auto; filter: drop-shadow(0 0 10px rgba(243, 154, 61, 0.34)); }
@media (max-width: 480px) { .pm-hwf-foot { gap: 12px; } .pm-hwf-foot .pm-hwf-art { height: 44px; } .pm-hwf-foot .pm-hwf-moon { display: none; } }
@media (min-width: 1360px) {
  .pm-hwf-top, .pm-hwf-foot { display: none; }
  .pm-hwf-gutters { display: block; position: fixed; inset: 0; z-index: 0; pointer-events: none; overflow: hidden; }
  .pm-hwf-side { position: absolute; top: 0; bottom: 0; width: calc((100vw - 1080px) / 2 - 28px); max-width: 360px; display: flex; flex-direction: column; align-items: center; }
  .pm-hwf-l { left: 0; } .pm-hwf-r { right: 0; }
  .pm-hwf-side .pm-hwf-web { position: absolute; top: 0; width: min(150px, 62%); opacity: 0.7; }
  .pm-hwf-l .pm-hwf-web { left: 0; } .pm-hwf-r .pm-hwf-web { right: 0; transform: scaleX(-1); }
  .pm-hwf-stack { flex: 1; width: 100%; display: flex; flex-direction: column; align-items: center; justify-content: space-evenly; padding: 190px 0 28px; gap: 14px; }
  .pm-hwf-stack .pm-hwf-art { max-width: 100%; height: auto; filter: drop-shadow(0 0 16px rgba(243, 154, 61, 0.3)); }
  .pm-hwf-stack .pm-hwf-bat { width: 38%; animation: pm-hwf-bob 8s ease-in-out infinite; }
  .pm-hwf-l .pm-hwf-stack .pm-hwf-bat { align-self: flex-start; margin-left: 18%; }
  .pm-hwf-stack .pm-hwf-candles { width: 46%; }
  .pm-hwf-stack .pm-hwf-pumpkin { width: min(78%, 190px); }
  .pm-hwf-r .pm-hwf-stack .pm-hwf-pumpkin { width: min(64%, 160px); }
  .pm-hwf-stack .pm-hwf-moon { width: min(40%, 96px); filter: drop-shadow(0 0 22px rgba(196, 135, 221, 0.4)); }
  .pm-hwf-pair { display: flex; align-items: flex-end; justify-content: center; gap: 6%; width: 100%; }
  .pm-hwf-pair .pm-hwf-hat { width: 52%; transform: rotate(-8deg); }
  .pm-hwf-pair .pm-hwf-broom { width: 20%; transform: rotate(14deg); }
}
.pm-hwf-flame { transform-box: fill-box; transform-origin: 50% 100%; animation: pm-hwf-flick 2.6s ease-in-out infinite; }
.pm-hwf-candles .pm-hwf-flame:nth-of-type(2) { animation-delay: -0.9s; } .pm-hwf-candles .pm-hwf-flame:nth-of-type(3) { animation-delay: -1.7s; }
.pm-hwf-pumpkin g { animation: pm-hwf-lit 5s ease-in-out infinite; }
@keyframes pm-hwf-flick { 0%, 100% { transform: scale(1, 1); opacity: 1; } 40% { transform: scale(0.9, 1.08); opacity: 0.85; } 70% { transform: scale(1.05, 0.94); opacity: 1; } }
@keyframes pm-hwf-lit { 0%, 100% { opacity: 1; } 50% { opacity: 0.8; } }
@keyframes pm-hwf-bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(7px); } }
@media (prefers-reduced-motion: reduce) { .pm-hwf-flame, .pm-hwf-pumpkin g, .pm-hwf-bat { animation: none !important; } }
`;

/** The frame's HTML for one part ("top": gutters + top band; "foot": the foot band), or "" when it is off (the Mists are not standing, or the calendar is past UNTIL). */
export function frameHTML(part = "top", now = Date.now(), cfg = HALLOWEEN_FRAME, mists = null) {
  if (!frameShows(mists, now, cfg)) return "";
  const until = Date.parse(cfg.until);
  const guard = `<script>(function(){if(Date.now()>=${until}){var e=document.querySelectorAll("[data-pm-hwf]");for(var i=0;i<e.length;i++)e[i].remove();}})();</script>`;
  if (part === "foot") return `<div data-pm-hwf>${footBand()}</div>`;
  return `<style data-pm-hwf>${FRAME_CSS}</style><div data-pm-hwf>${fixedLayer()}${topBand()}</div>${guard}`;
}
