// pixel-icons.mjs — THE CHIPS' ICONS, drawn by hand on a 16×16 grid.
//
// Keemin, 2026-09-26 (POS-244, the Site Lift): the secondary rail "is hard to
// spot and will be missed: little pixel-art icons for each chip, and bigger
// buttons." So each chip wears a picture, and the picture is DRAWN here, pixel
// by pixel, never borrowed from a font or an emoji set: a borrowed glyph keeps
// its own shape and palette, and a row of them reads as strangers.
//
// Two inks, both the chip's own colour (`currentColor`), so an icon mutes and
// brightens with its chip exactly as the label does — a chip's state is carried
// in its colour, the rule the glyph icons were chosen under on 2026-08-25:
//
//   #  the line, full ink
//   +  the fill, the same ink at FILL_OPACITY
//   .  nothing; the chip shows through
//
// Drawn at 16 CSS px, so 32 device px on a 2× screen: an integer scale, every
// grid pixel lands on whole device pixels and `crispEdges` keeps them square.
// A size that is not a multiple of 16 smears the art.
//
// The label beside the icon still says what the chip is; the icon is
// decoration and is `aria-hidden` wherever it is drawn.

export const GRID = 16;
export const FILL_OPACITY = 0.42;

export const ICONS = {
  // ── The Town ──
  // the bulletin: a cork board with notes pinned to it
  bulletin: [
    "................",
    "################",
    "#++++++++++++++#",
    "#+####+++++++++#",
    "#+#..#++#####++#",
    "#+#..#++#...#++#",
    "#+####++#...#++#",
    "#+++++++#####++#",
    "#++#####+++++++#",
    "#++#...#++####+#",
    "#++#...#++#..#+#",
    "#++#####++####+#",
    "#++++++++++++++#",
    "################",
    ".#............#.",
    ".#............#.",
  ],
  // the civic quarter: a hall of columns under a pediment
  quarter: [
    ".......##.......",
    ".....##++##.....",
    "...##++++++##...",
    ".##++++++++++##.",
    "################",
    "................",
    ".##..##..##..##.",
    ".##..##..##..##.",
    ".##..##..##..##.",
    ".##..##..##..##.",
    ".##..##..##..##.",
    ".##..##..##..##.",
    "................",
    "################",
    ".++++++++++++++.",
    "################",
  ],
  // the meeps: a meep, antenna up
  meeps: [
    "................",
    "........#.......",
    ".......#........",
    ".....######.....",
    "....#++++++#....",
    "...#++++++++#...",
    "...#+#++++#+#...",
    "...#+#++++#+#...",
    "...#++++++++#...",
    "...#+++##+++#...",
    "...#++++++++#...",
    "....#++++++#....",
    ".....######.....",
    ".....#....#.....",
    "....##....##....",
    "................",
  ],
  // ── The World ──
  // the living map: a pin standing over a folded map
  map: [
    "......####......",
    ".....#++++#.....",
    "....#++##++#....",
    "....#+#..#+#....",
    "....#+#..#+#....",
    "....#++##++#....",
    ".....#++++#.....",
    "......#++#......",
    ".......##.......",
    "................",
    "...####.####.###",
    "..#+++#++++#++#.",
    ".#+++#++++#++#..",
    "#+++#++++#++#...",
    "#############...",
    "................",
  ],
  // conversations: two speech bubbles
  talk: [
    "................",
    ".#########......",
    "#+++++++++#.....",
    "#++#+#+#++#.....",
    "#+++++++++#.....",
    ".###+######.....",
    "...#+#.########.",
    "...##.#........#",
    "......#.#.#.#..#",
    "......#........#",
    ".......####.###.",
    "..........#.#...",
    "..........##....",
    "................",
    "................",
    "................",
  ],
  // replay: a play mark inside a turning arrow
  replay: [
    "................",
    ".....#####......",
    "...##.....##.#..",
    "..#.........##..",
    ".#.........###..",
    ".#..............",
    "#.....#.........",
    "#.....##......#.",
    "#.....#+#.....#.",
    "#.....#++#....#.",
    "#.....#+#.....#.",
    "#.....##......#.",
    ".#....#......#..",
    "..#.........#...",
    "...##.....##....",
    ".....#####......",
  ],
  // the atlas: a bound book with a globe on its cover
  atlas: [
    "................",
    "..############..",
    ".#+++++++++++#..",
    ".#+++#####+++#..",
    ".#++#+#+#+#++#..",
    ".#+#++#+#++#+#..",
    ".#+#########+#..",
    ".#+#++#+#++#+#..",
    ".#++#+#+#+#++#..",
    ".#+++#####+++#..",
    ".#+++++++++++#..",
    ".#############..",
    ".#...........#..",
    ".#############..",
    "................",
    "................",
  ],
  // the harbor: an anchor
  anchor: [
    ".......##.......",
    "......#..#......",
    "......#..#......",
    ".......##.......",
    "....########....",
    ".......##.......",
    ".......##.......",
    ".......##.......",
    ".......##.......",
    ".#.....##.....#.",
    ".##....##....##.",
    "..##...##...##..",
    "...##..##..##...",
    "....########....",
    "......####......",
    "................",
  ],
  // ── Docs ──
  // the docs: a written page, its corner turned
  docs: [
    "..#########.....",
    "..#+++++++##....",
    "..#+++++++#+#...",
    "..#+++++++####..",
    "..#++++++++++#..",
    "..#+######+++#..",
    "..#++++++++++#..",
    "..#+########+#..",
    "..#++++++++++#..",
    "..#+#######++#..",
    "..#++++++++++#..",
    "..#+########+#..",
    "..#++++++++++#..",
    "..#+#####++++#..",
    "..#++++++++++#..",
    "..############..",
  ],
  // stamps: a perforated stamp with a star on it
  stamp: [
    "................",
    ".#.#.#.#.#.#.#..",
    "##############..",
    ".#++++++++++#...",
    "##++++#+++++##..",
    ".#++++#+++++#...",
    "##+++###++++##..",
    ".#+#######++#...",
    "##++#####+++##..",
    ".#+++###++++#...",
    "##++##+##+++##..",
    ".#+#+++++#++#...",
    "##++++++++++##..",
    ".############...",
    "..#.#.#.#.#.#...",
    "................",
  ],
  // the numbers: a bar chart
  numbers: [
    "................",
    "............##..",
    "...........#++#.",
    "...........#++#.",
    ".......##..#++#.",
    "......#++#.#++#.",
    "......#++#.#++#.",
    "..##..#++#.#++#.",
    ".#++#.#++#.#++#.",
    ".#++#.#++#.#++#.",
    ".#++#.#++#.#++#.",
    ".#++#.#++#.#++#.",
    ".#++#.#++#.#++#.",
    "################",
    "................",
    "................",
  ],
  // the repos: a branch that forks and joins
  repos: [
    "................",
    "...##......##...",
    "..#++#....#++#..",
    "..#++#....#++#..",
    "...##......##...",
    "...##.......#...",
    "...##.......#...",
    "...##......#....",
    "...##.....#.....",
    "...##...##......",
    "...##.##........",
    "...###..........",
    "..#++#..........",
    "..#++#..........",
    "...##...........",
    "................",
  ],
  // the projects: a hammer, swung
  projects: [
    "................",
    ".....##.........",
    "....#++#........",
    "....#+++#.......",
    ".....#+++#......",
    "......#+++#.....",
    ".......#+++#....",
    "......##++++#...",
    ".....##.#+++#...",
    "....##...#++#...",
    "...##.....##....",
    "..##............",
    ".##.............",
    "##..............",
    "#...............",
    "................",
  ],
};

/** An icon's two inks as SVG path data: each run of one ink along a row is one
 *  rectangle, `M x y h w v 1 h -w z`. */
export function iconPaths(name) {
  const rows = ICONS[name];
  if (!rows) return null;
  const ink = { "#": "", "+": "" };
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const c = row[x];
      if (c in ink) {
        let w = 1;
        while (row[x + w] === c) w++;
        ink[c] += `M${x} ${y}h${w}v1h-${w}z`;
        x += w;
      } else x++;
    }
  });
  return { line: ink["#"], fill: ink["+"] };
}

/** The whole <svg> as markup: ChipRow draws it, and so does the look sheet
 *  that photographs the icons outside Astro. Sized by CSS unless `size`. */
export function iconSvg(name, { size } = {}) {
  const p = iconPaths(name);
  if (!p) return "";
  const dim = size ? ` width="${size}" height="${size}"` : "";
  return `<svg class="pm-pixicon" viewBox="0 0 ${GRID} ${GRID}"${dim} shape-rendering="crispEdges" aria-hidden="true" focusable="false">`
    + (p.fill ? `<path d="${p.fill}" fill="currentColor" opacity="${FILL_OPACITY}"/>` : "")
    + (p.line ? `<path d="${p.line}" fill="currentColor"/>` : "")
    + `</svg>`;
}
