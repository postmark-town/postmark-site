// halloween-motifs.mjs — the season's motifs as small inline SVGs (POS-553,
// Darko 09:17: "no pumpkins, but bats, wolves, and crows are fair game").
// The four creatures are Rei's originals, used as drawn (Darko picked them
// 2026-10-10 12:39; motifs-rei/README.md: original vector drawings, no traced
// or external source, no licence dependency): one path each in a 100-unit box,
// in currentColor here so each takes the palette it is placed in. The World
// map's creatures (postmark-world spectator/mists-render.mjs) are the same.
const SVG = (viewBox, inner) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" aria-hidden="true">${inner}</svg>`;

// a bat, wings spread (Rei: bat.svg)
export const BAT = SVG("0 14 100 72", `<path fill="currentColor" d="M50 39 L44 28 L41 44 C32 37 24 24 7 18 C12 31 11 44 3 57 C17 52 24 56 25 65 C35 60 41 65 43 73 L50 83 L57 73 C59 65 65 60 75 65 C76 56 83 52 97 57 C89 44 88 31 93 18 C76 24 68 37 59 44 L56 28 Z"/>`);

// a crow perched on a roofline (Rei: crow-perched.svg; the roofline is ours)
export const CROW = SVG("4 14 92 80", `<path fill="currentColor" d="M8 80 L25 59 C30 52 36 49 42 44 C47 40 48 31 53 25 C58 18 68 17 75 22 L79 27 L94 32 L94 35 L78 36 C79 43 75 48 74 53 L78 55 L73 57 L75 60 L69 60 C65 66 60 70 53 73 L54 83 L63 86 L62 89 L49 88 L48 76 L41 77 L39 86 L45 89 L43 92 L34 88 L35 77 L13 87 Z"/><path d="M4 91h92" stroke="currentColor" stroke-width="2.4" opacity="0.85"/>`);

// a crow lifting off (Rei: crow-lifting.svg)
export const CROW_FLY = SVG("2 2 96 90", `<path fill="currentColor" d="M6 78 L29 58 C28 43 21 29 17 20 Q18 16 22 20 L29 29 L27 13 Q28 9 32 13 L41 26 L40 8 Q42 5 45 10 L55 28 L55 13 Q58 10 60 16 L63 44 C66 40 73 40 77 44 L81 48 L96 52 L96 55 L81 57 C75 66 68 69 57 69 L51 79 L55 82 L53 85 L45 80 L48 71 L41 74 L34 88 L29 87 L34 76 L12 85 Z"/>`);

// the howling wolf against the moon (Rei: wolf-howling.svg; the moon is ours)
export const WOLF_MOON = SVG("0 0 100 100", `<circle cx="70" cy="30" r="24" fill="var(--moon, #f0e6d6)" opacity="0.94"/>`
  + `<path fill="currentColor" d="M8 91 C12 83 22 79 32 81 C28 72 30 61 38 53 C44 47 47 38 47 31 L43 18 L54 24 L58 17 L63 20 L74 8 L82 7 L84 12 L73 21 L81 17 L82 22 L69 33 C66 38 67 43 70 48 L66 46 L70 57 L65 54 L65 83 L70 88 L70 92 L57 92 L55 62 C51 66 48 72 48 77 C49 82 51 86 55 88 L54 92 L35 92 C25 96 14 96 8 91 Z"/><path d="M0 95h100" stroke="currentColor" stroke-width="2"/>`);

export const WAX_SEAL = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" aria-hidden="true">`
  + `<path fill="var(--seal, #9b1f2a)" d="M24 3c3 0 4.4 2.6 7 3.2 2.8.6 5.2-.6 7 1.4 1.8 2-.2 4.6.8 7.2 1 2.6 3.8 3.6 4 6.4.2 2.8-2.4 4-3 6.6-.6 2.8 1 5.4-.8 7.6-2 2.2-4.8.6-7.4 1.6-2.6 1-3.8 3.8-6.8 4s-4.4-2.4-7-3c-2.8-.6-5.4.8-7.2-1.2-1.8-2 .2-4.6-.8-7.2-1-2.6-3.8-3.6-4-6.6-.2-2.8 2.6-4 3.2-6.6.6-2.8-1-5.2.8-7.4C11 6 13.6 7.4 16.2 6.6 19 5.8 21 3 24 3z"/>`
  + `<circle cx="24" cy="24" r="12.5" fill="none" stroke="#000" stroke-opacity="0.28" stroke-width="1.6"/>`
  + `<path d="M27.5 16.5a8.5 8.5 0 1 0 0 15 7 7 0 1 1 0-15z" fill="#000" fill-opacity="0.3"/></svg>`;

/** a data: URI of an SVG string, for CSS backgrounds */
export const svgURI = (svg) => `url("data:image/svg+xml,${encodeURIComponent(svg.replace("var(--seal, #9b1f2a)", "#9b1f2a"))}")`;
