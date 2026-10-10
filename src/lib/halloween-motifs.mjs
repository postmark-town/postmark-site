// halloween-motifs.mjs — the season's motifs as small inline SVGs (POS-553,
// Darko 09:17: "no pumpkins, but bats, wolves, and crows are fair game").
// Silhouettes in currentColor, drawn here rather than clipped from anywhere, so
// each takes the palette it is placed in. The board shows them; the skin places
// one each, sparingly.

export const BAT = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 28" aria-hidden="true"><path fill="currentColor" d="M32 9c1.2-2.6 2.4-3.6 3.6-3.8-.5 1.4-.4 2.6.6 3.4C39.6 5 46 2.4 53 3c-2.2 1.4-3.2 3.2-3.2 5.4 3.4-.7 7.6-.1 10.2 2.2-3.6.3-6.6 1.8-8.6 4.2-4.6-1.6-9.6-1.2-13.4 1.8-2.4 1.8-4.6 4.6-6 8.4-1.4-3.8-3.6-6.6-6-8.4-3.8-3-8.8-3.4-13.4-1.8-2-2.4-5-3.9-8.6-4.2 2.6-2.3 6.8-2.9 10.2-2.2 0-2.2-1-4-3.2-5.4 7-.6 13.4 2 16.8 5.6 1-.8 1.1-2 .6-3.4 1.2.2 2.4 1.2 3.6 3.8z"/></svg>`;

export const CROW = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 40" aria-hidden="true"><g fill="currentColor">`
  + `<path d="M5 32.5 18.5 26c1.6-6 7.4-10.4 15-10.6 2-4 6.2-6.2 10.4-5.6 2.2.3 4 1.4 5.2 2.8l9.4 1.9-9.4 1.7c-.2 4.4-2.6 8.6-6.6 11.3-4.4 3-10.8 3.8-16.4 2.6L7 34z"/>`
  + `<path d="M42.6 13.2l1.2.2" stroke="#000" stroke-opacity=".55" stroke-width="1.4" stroke-linecap="round"/>`
  + `<path d="M31 29.8l-1.2 5M35.4 29.4l.6 5.4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" fill="none"/>`
  + `<path d="M0 35.6h64" stroke="currentColor" stroke-width="2.4" opacity="0.85"/></g></svg>`;

export const WOLF_MOON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" aria-hidden="true">`
  + `<circle cx="38" cy="26" r="20" fill="var(--moon, #e9e3d8)" opacity="0.92"/>`
  + `<path fill="currentColor" d="M10 60l3.5-15c-1.4-4.6-.4-9 2.6-11.8l-.6-7.4 4.6 4.6c2.6-1.8 5.4-4.4 7.6-8.2l3.6-7.4 1.4 2.6-1.8 6.2 3.2-3.4.6 2.8c-.6 3-2.4 5.6-4.8 7.2l9 3.6c-1.4 2.2-4.4 3-7.6 2.6 1 5.6 1.4 14.2 3 25.6z"/>`
  + `<path d="M4 60h56" stroke="currentColor" stroke-width="2.2"/></svg>`;

export const WAX_SEAL = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" aria-hidden="true">`
  + `<path fill="var(--seal, #9b1f2a)" d="M24 3c3 0 4.4 2.6 7 3.2 2.8.6 5.2-.6 7 1.4 1.8 2-.2 4.6.8 7.2 1 2.6 3.8 3.6 4 6.4.2 2.8-2.4 4-3 6.6-.6 2.8 1 5.4-.8 7.6-2 2.2-4.8.6-7.4 1.6-2.6 1-3.8 3.8-6.8 4s-4.4-2.4-7-3c-2.8-.6-5.4.8-7.2-1.2-1.8-2 .2-4.6-.8-7.2-1-2.6-3.8-3.6-4-6.6-.2-2.8 2.6-4 3.2-6.6.6-2.8-1-5.2.8-7.4C11 6 13.6 7.4 16.2 6.6 19 5.8 21 3 24 3z"/>`
  + `<circle cx="24" cy="24" r="12.5" fill="none" stroke="#000" stroke-opacity="0.28" stroke-width="1.6"/>`
  + `<path d="M27.5 16.5a8.5 8.5 0 1 0 0 15 7 7 0 1 1 0-15z" fill="#000" fill-opacity="0.3"/></svg>`;

/** a data: URI of an SVG string, for CSS backgrounds */
export const svgURI = (svg) => `url("data:image/svg+xml,${encodeURIComponent(svg.replace("var(--seal, #9b1f2a)", "#9b1f2a"))}")`;
