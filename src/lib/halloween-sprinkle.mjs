// halloween-sprinkle.mjs — the season's motifs sprinkled around the site while
// the Mists stand (POS-553; Darko 2026-10-11 11:03: "maybe the site hints are
// *too* subtle. Could we add a couple more of the motifs sprinkled around the
// site?"). Motifs only: no palette, nothing the page's text or controls sit
// under, each one small, in a corner or a margin, one per page:
//
//   home      three crows on the hero picture's rooftops (the post office's,
//             and two more), left off on a phone where the picture is cropped
//   header    on about one page load in three, one bat crossing the top of the
//             page once, above the nav's line (every page in the layout)
//   bulletin  a crow perched on the top edge of the board's timber frame (not
//             on a phone, where the plaque fills that edge)
//   world     a bat hanging under the World rail's head (the rail is a
//             desktop thing; on a phone there is no rail and no bat)
//   resident  a crow lifting off the top edge of a resident's card
//   jar       a tiny bat beside the Bug Catcher's jar heading on /meeps/
//
// Pure: every answer is "" when `mists` is null (before the Mists' first
// crossing, a local build, CI), so each page is byte for byte the page it was.
// Decorative only: aria-hidden, pointer-events none; every motion stops under
// prefers-reduced-motion.
import { VARIANTS, mix } from "./halloween-skin.mjs";
import { BAT, CROW, CROW_FLY } from "./halloween-motifs.mjs";

const v = VARIANTS[2];   // the motifs' ink only; the site keeps its own palette this release
const INK = mix(v.base, v.quiet, 0.15);
const GLOW = `drop-shadow(0 0 1px ${mix(v.violet, v.base, 0.4)}) drop-shadow(0 0 8px rgba(0,0,0,.75))`;
const REDUCED = "@media (prefers-reduced-motion: reduce)";

/** where a crow perches on the home hero, as a share of the picture: [left, top, width, flip] */
export const PERCHES = [[14.6, 9.4, 3.0, true], [62.5, 4.6, 2.6, false], [83.2, 12.8, 2.4, true]];

/** The home hero's crows, or "". */
export function homeCrowsHTML(mists) {
  if (!mists) return "";
  const crows = PERCHES.map(([l, t, w, flip]) => `<div class="pm-hw-crow" style="left:${l}%;top:${t}%;width:${w}%${flip ? ";transform:scaleX(-1)" : ""}">${CROW}</div>`).join("");
  return `<div aria-hidden="true">${crows}</div><style>
  .pm-hw-crow { position: absolute; min-width: 30px; color: ${INK}; pointer-events: none; filter: ${GLOW}; }
  .pm-hw-crow svg { display: block; width: 100%; }
  @media (max-width: 700px) { .pm-hw-crow { display: none; } }
</style>`;
}

// the bat: one, crossing once after a while, on about one load in three; never under reduced motion
const BAT_SCRIPT = `(function(){try{if(matchMedia("(prefers-reduced-motion: reduce)").matches||Math.random()>0.34)return;var b=document.querySelector(".pm-hw-bat");if(!b)return;b.style.animationDelay=(6+Math.random()*14).toFixed(1)+"s";b.classList.add("go");}catch(e){}})();`;

/** The header's bat, or "". It flies in the strip above the nav's line (the
 *  header's top padding, 0 to 26 px at every width), never across the links. */
export function navBatHTML(mists) {
  if (!mists) return "";
  return `<div class="pm-hw-bats" aria-hidden="true"><span class="pm-hw-bat">${BAT}</span></div><script>${BAT_SCRIPT}</script><style>
  .pm-hw-bats { position: absolute; left: 0; right: 0; top: 0; height: 26px; overflow: hidden; pointer-events: none; z-index: 6000; }
  .pm-hw-bat { position: absolute; left: -60px; top: 4px; width: 25px; color: ${v.base}; opacity: 0; filter: drop-shadow(0 0 2px ${v.violet}); }
  .pm-hw-bat.go { animation: pm-hw-bat 8s cubic-bezier(.45,.05,.55,.95) 1 both; }
  .pm-hw-bat svg { display: block; width: 100%; animation: pm-hw-flap .28s ease-in-out infinite alternate; }
  @keyframes pm-hw-bat { 0% { opacity: 1; transform: translate(0, 0); } 35% { transform: translate(38vw, -3px); } 70% { transform: translate(72vw, 2px); } 99% { opacity: 1; } 100% { opacity: 0; transform: translate(calc(100vw + 100px), -2px); } }
  @keyframes pm-hw-flap { from { transform: scaleY(1); } to { transform: scaleY(.35); } }
  ${REDUCED} { .pm-hw-bats { display: none; } }
</style>`;
}

/** an SVG as a CSS background, its currentColor inked in */
const inked = (svg, ink) => `url("data:image/svg+xml,${encodeURIComponent(svg.replaceAll("currentColor", ink))}")`;

// the bat turned over, hanging by its feet
const HANGING = BAT.replace("<path ", '<path transform="rotate(180 50 50)" ');

/** One motif for one page, or "". */
export const SPOTS = {
  // perched on the board's frame, toward its right corner; the frame is 14 px (8 on a phone)
  bulletin: () => `<span class="pm-hw-spot pm-hw-board-crow" data-hw-motif="bulletin" aria-hidden="true">${CROW}</span><style>
  .pm-hw-board-crow { position: absolute; right: 9%; bottom: calc(100% + 13px); width: 34px; color: ${INK}; pointer-events: none; transform: scaleX(-1); filter: ${GLOW}; }
  .pm-hw-board-crow svg { display: block; width: 100%; }
  @media (max-width: 760px) { .pm-hw-board-crow { width: 24px; bottom: calc(100% + 7px); right: 5%; } }
  @media (max-width: 480px) { .pm-hw-board-crow { display: none; } }   /* the plaque fills the frame's top on a phone */
</style>`,
  // hanging (upside down) under the rail's head, at its right, clear of the crossing line's words
  world: () => `<style>
  .wv-worldline { position: relative; }
  .wv-worldline::after { content: ""; position: absolute; top: calc(100% + 1px); right: 6px; width: 20px; height: 15px; pointer-events: none;
    background: ${inked(HANGING, mix(v.base, v.quiet, 0.3))} center top / contain no-repeat; transform-origin: 50% 0;
    filter: drop-shadow(0 0 2px ${mix(v.violet, v.base, 0.3)}); animation: pm-hw-sway 4.5s ease-in-out infinite alternate; }
  @keyframes pm-hw-sway { from { transform: rotate(-4deg); } to { transform: rotate(4deg); } }
  ${REDUCED} { .wv-worldline::after { animation: none; } }
</style>`,
  // lifting off the top edge of the card, at its right, in the margin above it
  resident: () => `<div class="pm-hw-perch" aria-hidden="true"><span class="pm-hw-spot pm-hw-card-crow" data-hw-motif="resident">${CROW_FLY}</span></div><style>
  .pm-hw-perch { position: relative; height: 0; pointer-events: none; }
  .pm-hw-card-crow { position: absolute; right: 22px; bottom: -3px; width: 34px; color: ${INK}; pointer-events: none; filter: ${GLOW}; }
  .pm-hw-card-crow svg { display: block; width: 100%; }
  @media (max-width: 760px) { .pm-hw-card-crow { width: 26px; right: 14px; } }
</style>`,
  // a tiny bat beside the jar's heading, bobbing a little
  jar: () => `<span class="pm-hw-spot pm-hw-jar-bat" data-hw-motif="jar" aria-hidden="true">${BAT}</span><style>
  .pm-hw-jar-bat { display: inline-block; width: 17px; margin: 0 calc(-17px - 0.7em) 0 0.7em; vertical-align: 0.35em; color: ${mix(v.base, v.quiet, 0.3)}; pointer-events: none;
    filter: drop-shadow(0 0 2px ${mix(v.violet, v.base, 0.3)}); animation: pm-hw-bob 3.2s ease-in-out infinite alternate; }
  .pm-hw-jar-bat svg { display: block; width: 100%; }
  @keyframes pm-hw-bob { from { transform: translateY(0) rotate(-6deg); } to { transform: translateY(-4px) rotate(4deg); } }
  ${REDUCED} { .pm-hw-jar-bat { animation: none; } }
</style>`,
};

export function motifHTML(spot, mists) {
  if (!mists || !SPOTS[spot]) return "";
  return SPOTS[spot]();
}
