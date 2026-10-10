// halloween-motifs.mjs — the season's motifs as small inline SVGs (POS-553,
// Darko 09:17: "no pumpkins, but bats, wolves, and crows are fair game").
// Silhouettes in currentColor, each ONE path drawn for this (no clip-art), and
// checked as renders at 24 px and 120 px: the wolf redrawn 10-10 after Darko
// (10:56) found the first one had "three snouts". The World map's creatures
// (postmark-world spectator/mists-render.mjs) are the same shapes.
const SVG = (viewBox, inner) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" aria-hidden="true">${inner}</svg>`;

// a bat, wings spread
export const BAT = SVG("2 25 96 30", `<path fill="currentColor" d="M50 34 L48 29 L46.5 36 C43 34 36 30 26 29 C22 29 14 31 4 37 C9 38 13 40 15 43 C19 41 24 41 27 44 C31 42 36 43 39 46 C43 45 46 47 48 50 L50 53 L52 50 C54 47 57 45 61 46 C64 43 69 42 73 44 C76 41 81 41 85 43 C87 40 91 38 96 37 C86 31 78 29 74 29 C64 30 57 34 53.5 36 L52 29 Z"/>`);

// a crow perched on a roofline
export const CROW = SVG("4 30 92 54", `<path fill="currentColor" d="M8 64 L30 55 C38 45 50 40 60 40 C64 36 69 34 74 35 C77 36 79 38 80 40 L94 44 L80 49 C79 56 74 62 66 65 C58 68 48 68 40 66 L44 80 L41 80 L37 66 L33 65 L35 79 L32 79 L30 64 C24 64 16 66 10 68 Z"/><path d="M4 81.5h92" stroke="currentColor" stroke-width="2.4" opacity="0.85"/>`);

// a crow lifting off
export const CROW_FLY = SVG("6 14 80 52", `<path fill="currentColor" d="M10 60 L20 53 C28 49 34 47 40 47 C44 40 46 28 52 16 C62 24 66 36 62 48 C62 47 66 46 70 46 L82 47 L71 51 C66 57 58 60 48 60 C40 61 30 60 22 59 L12 64 Z"/>`);

// the howling wolf against the moon: sitting, head back, one snout up at it
export const WOLF_MOON = SVG("0 0 100 100", `<circle cx="64" cy="30" r="27" fill="var(--moon, #f0e6d6)" opacity="0.94"/>`
  + `<path fill="currentColor" d="M5 95 C8 88 16 84 28 84 C26 72 30 62 38 56 C44 50 48 44 50 38 C51 33 51 29 52 26 L47 16 L56 22 L55 11 L61 19 C64 15 68 11 72 7 L86 2 L88 5 L74 18 C70 24 68 30 67 36 C70 44 71 52 69 60 L69 95 L62 95 L61 66 L59 66 L59 95 L53 95 L53 70 C50 72 48 76 48 80 C48 87 52 92 56 95 L38 95 C32 94 26 95 22 95 C14 96 8 96 5 95 Z"/><path d="M0 96.5h100" stroke="currentColor" stroke-width="2"/>`);

export const WAX_SEAL = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" aria-hidden="true">`
  + `<path fill="var(--seal, #9b1f2a)" d="M24 3c3 0 4.4 2.6 7 3.2 2.8.6 5.2-.6 7 1.4 1.8 2-.2 4.6.8 7.2 1 2.6 3.8 3.6 4 6.4.2 2.8-2.4 4-3 6.6-.6 2.8 1 5.4-.8 7.6-2 2.2-4.8.6-7.4 1.6-2.6 1-3.8 3.8-6.8 4s-4.4-2.4-7-3c-2.8-.6-5.4.8-7.2-1.2-1.8-2 .2-4.6-.8-7.2-1-2.6-3.8-3.6-4-6.6-.2-2.8 2.6-4 3.2-6.6.6-2.8-1-5.2.8-7.4C11 6 13.6 7.4 16.2 6.6 19 5.8 21 3 24 3z"/>`
  + `<circle cx="24" cy="24" r="12.5" fill="none" stroke="#000" stroke-opacity="0.28" stroke-width="1.6"/>`
  + `<path d="M27.5 16.5a8.5 8.5 0 1 0 0 15 7 7 0 1 1 0-15z" fill="#000" fill-opacity="0.3"/></svg>`;

/** a data: URI of an SVG string, for CSS backgrounds */
export const svgURI = (svg) => `url("data:image/svg+xml,${encodeURIComponent(svg.replace("var(--seal, #9b1f2a)", "#9b1f2a"))}")`;
