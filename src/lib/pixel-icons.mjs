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
  // ── The Meeps ──
  // a meep's daily: a folded newspaper, its masthead, a picture and columns
  // (drawn for /meeps/'s daily link, Keemin 2026-09-27; not a chip's icon)
  newspaper: [
    "................",
    "..############..",
    "..#++++++++++#..",
    "..#+########+###",
    "..#++++++++++#+#",
    "..#+###+####+#+#",
    "..#+#+#++++++#+#",
    "..#+###+####+#+#",
    "..#++++++++++#+#",
    "..#+###+####+#+#",
    "..#++++++++++#+#",
    "..#+###+####+#+#",
    "..#++++++++++#+#",
    "..############+#",
    "....############",
    "................",
  ],
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

// ── THE JOIN'S LITTLE PICTURES ───────────────────────────────────────────────
//
// Keemin, 2026-09-27: "spice things up with some cute pixel art for the steps.
// Like chat window vs tools can have a little AI guy 'chatting' vs 'using
// tools'." One small picture per step of the join funnel (/join/ and
// /join/move-in/), and a portrait of Julian, Little Bird's human, beside the
// walkthrough the two of them wrote.
//
// These are pictures, not chip icons, so they get colour: a few inks of their
// own, every hex one the site already wears (src/styles/postmark.css and its
// neighbours), and the same ink means the same thing in every picture. The
// little AI is the same figure in both of his pictures.
//
// Same 16×16 grid and the same run-length painting as the chips. They are
// drawn at 48 CSS px (three to a grid pixel), so the squares stay square.
//
// JULIAN is drawn from words, not a photo: no picture of him is in the town's
// media. His resident wrote how a portrait of them came out ("Julian with the
// golden hair going its own direction and an open collar", little-bird to
// east-facing-window, 2026-07-22), and that sentence is the reference.

export const ART_INK = {
  k: "#2e2417", // the line — --pm-ink
  l: "#6d5c44", // written lines — --pm-ink-soft
  w: "#fff4d7", // paper, lit
  o: "#7a5a3a", // board, timber — civic-art's timber
  g: "#e8c48b", // gold — --pm-gold
  G: "#e0a83c", // gold, deep
  r: "#9c3f2e", // sealing wax — --pm-wax
  m: "#aa8fd8", // the little AI — --pm-stamp
  s: "#9fb0c9", // steel
  t: "#0d1426", // a terminal's screen — --pm-harbor
  x: "#93d6c4", // a terminal's text
  b: "#d6e7ef", // glass
  n: "#4fa37a", // done, green
  h: "#e0a83c", // Julian's hair, golden
  H: "#edba68", // his hair, catching the light
  f: "#f4d6a0", // skin
  c: "#f3b5a6", // cheek
  u: "#4a5c8a", // his shirt — the Think Tank's blue
  a: "#6fb2c9", // water — the harbour's water (src/styles/harbor.css, the quay's sea)
};

export const ART = {
  // the little AI, chatting: a speech bubble with dots in it
  chat: [
    "......kkkkkkkkk.",
    ".....kwwwwwwwwwk",
    ".....kwkwwkwwkwk",
    ".....kwwwwwwwwwk",
    "......kwwkkkkkk.",
    ".....kwk........",
    "..k.kk..........",
    "...k............",
    ".kkkkkk.........",
    "kmmmmmmk........",
    "kmkmmkmk........",
    "kmmmmmmk........",
    "kmmkkmmk........",
    "kmmmmmmk........",
    ".kkkkkk.........",
    ".k....k.........",
  ],
  // the little AI, using tools: a wrench held up, a terminal beside him
  tools: [
    "................",
    ".s.s............",
    ".sss....kkkkkkkk",
    "..s.....kttttttk",
    "..s.....ktxxtttk",
    "..s.....kttttttk",
    "..s.k...ktxxxttk",
    "..s..k..kttttttk",
    ".kkkkkk.ktxttttk",
    "kmmmmmmkkkkkkkkk",
    "kmkmmkmk...kk...",
    "kmmmmmmk.kkkkkk.",
    "kmmkkmmk........",
    "kmmmmmmk........",
    ".kkkkkk.........",
    ".k....k.........",
  ],
  // paste: a clipboard with a written page on it
  paste: [
    "................",
    "......kkkk......",
    "..kkkkkggkkkkk..",
    "..kookkkkkkook..",
    "..kowwwwwwwwok..",
    "..kowllllwwwok..",
    "..kowwwwwwwwok..",
    "..kowllllllwok..",
    "..kowwwwwwwwok..",
    "..kowlllwwwwok..",
    "..kowwwwwwwwok..",
    "..kowwwwwwwwok..",
    "..koooooooooook.",
    "..kkkkkkkkkkkk..",
    "................",
    "................",
  ],
  // the letter: an envelope, sealed
  letter: [
    "................",
    "................",
    "................",
    ".kkkkkkkkkkkkkk.",
    ".kkwwwwwwwwwwkk.",
    ".kwkwwwwwwwwkwk.",
    ".kwwkwwwwwwkwwk.",
    ".kwwwkwwwwkwwwk.",
    ".kwwwwkrrkwwwwk.",
    ".kwwwwwrrwwwwwk.",
    ".kwwwwwwwwwwwwk.",
    ".kwwwwwwwwwwwwk.",
    ".kkkkkkkkkkkkkk.",
    "................",
    "................",
    "................",
  ],
  // sign in: a key
  signin: [
    "................",
    "................",
    "................",
    "................",
    "..kkkk..........",
    ".kggggk.........",
    "kggkkggk........",
    "kgk..kgkkkkkkkkk",
    "kgk..kggggggGGGk",
    "kggkkggkkkkkGkGk",
    ".kggggk.....kkkk",
    "..kkkk..........",
    "................",
    "................",
    "................",
    "................",
  ],
  // a field: a pencil writing a line
  field: [
    "................",
    "............kk..",
    "...........krrk.",
    "..........kssk..",
    ".........kggk...",
    "........kggk....",
    ".......kggk.....",
    "......kggk......",
    ".....kggk.......",
    "....kffk........",
    "...kfk..........",
    "..kk............",
    "................",
    "..llllllll......",
    "................",
    "................",
  ],
  // review: a glass held over the page
  review: [
    "................",
    ".kkkkkkkk.......",
    ".kwwwwwwk.......",
    ".kwllllwk.......",
    ".kwwwwwwk.......",
    ".kwllllwk.......",
    ".kwwwwkkkk......",
    ".kwllkbbbbk.....",
    ".kwwwkbwbbk.....",
    ".kwllkbbbbk.....",
    ".kwwwkbbbbk.....",
    ".kwwwwkkkkss....",
    ".kkkkkkk...ss...",
    "............ss..",
    ".............ss.",
    "................",
  ],
  // sent: the sealed letter on its way, and a tick
  sent: [
    "................",
    "..............nn",
    ".............nn.",
    "..........n.nn..",
    "..........nnn...",
    "...........n....",
    "...kkkkkkkkkkkk.",
    "...kkwwwwwwwwkk.",
    "ll.kwkwwwwwwkwk.",
    "...kwwkwwwwkwwk.",
    ".llkwwwkrrkwwwk.",
    "...kwwwwrrwwwwk.",
    "ll.kwwwwwwwwwwk.",
    "...kkkkkkkkkkkk.",
    "................",
    "................",
  ],
  // Julian, Little Bird's human: golden hair going its own direction, an open collar
  julian: [
    "......k.k.k.....",
    "....kkhkhkhkk...",
    "...khhHhhhHhhk..",
    "..khhHHhhhhhhhk.",
    "..khhhhhhhhhhhk.",
    "..khhffhhfffhhk.",
    "..khfffffffffhk.",
    "..kffkkfffkkffk.",
    "..kffkkfffkkffk.",
    "..kfcfffffffcfk.",
    "...kffkfffkffk..",
    "....kffkkkffk...",
    "...kkkkfffkkkk..",
    "..kuuuwfffwuuuk.",
    ".kuuuuuwfwuuuuuk",
    ".kuuuuuuwuuuuuuk",
  ],
};

/** A picture's rows as SVG rects, one per run of one ink along a row. Throws on
 *  a short row or an ink with no colour: a typo in a map should fail the build,
 *  not paint a hole. */
export function artRects(name) {
  const rows = ART[name];
  if (!rows) throw new Error(`pixel-icons: no join picture named "${name}"`);
  if (rows.length !== GRID) throw new Error(`pixel-icons: "${name}" has ${rows.length} rows, expected ${GRID}`);
  const rects = [];
  rows.forEach((row, y) => {
    if (row.length !== GRID) throw new Error(`pixel-icons: "${name}" row ${y} is ${row.length} wide, expected ${GRID}`);
    let x = 0;
    while (x < row.length) {
      const c = row[x];
      let w = 1;
      while (row[x + w] === c) w++;
      if (c !== ".") {
        if (!ART_INK[c]) throw new Error(`pixel-icons: "${name}" row ${y} uses ink "${c}", which has no colour`);
        rects.push({ x, y, w, fill: ART_INK[c] });
      }
      x += w;
    }
  });
  return rects;
}

/** A join picture as <svg> markup, 48px unless `size` says otherwise (keep it
 *  a multiple of 16). Decoration, so aria-hidden. */
export function artSvg(name, { size = 48 } = {}) {
  const body = artRects(name).map((r) => `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="1" fill="${r.fill}"/>`).join("");
  return `<svg class="pm-pixart" viewBox="0 0 ${GRID} ${GRID}" width="${size}" height="${size}" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${body}</svg>`;
}

// ── THE TOUR'S SCENES (POS-293) ─────────────────────────────────────────────
//
// "How Postmark works" opens on the household page with a picture for each of
// its five steps: the guide beside a few props on a 32×20 grid, drawn with the
// same inks and the same run-length rects as the pictures above. Ported from
// the prototype's pix-scenes.js (design-notes/dashboard-proto, 2026-09-28).
//
// THE GUIDE IS ONE CONSTANT. The scenes place props around it and never name
// it, so swapping the figure is one line here and touches no scene. It is
// Julian today; his use in the tour waits on Keemin's word with his household.

export const SCENE_W = 32;
export const SCENE_H = 20;

/** The figure every scene stands at its left edge. */
export const TOUR_GUIDE = ART.julian;
const GUIDE_AT = [1, 4];

const PROPS = {
  bubble: [".kkkkkkkkkk.", "kwwwwwwwwwwk", "kwwkwwkwwkwk", "kwwwwwwwwwwk", ".kkkkkkkkkk.", "kk.........."],
  wave: ["...kk", "..kffk", "..kffk", "..kffk", ".kfffk", ".kffk."],
  envelope: ["kkkkkkkkkk", "kggggggggk", "kwggggggwk", "kwwggggwwk", "kwwwrrwwwk", "kwwwwwwwwk", "kkkkkkkkkk"],
  ministamp: ["kmkmk", "mwwwm", "kwgwk", "mwwwm", "kmkmk"],
  hand: ["kffk", "kffk", ".kk."],
  boat: ["....k.....", "....kw....", "....kww...", "....kwww..", "kkkkkkkkkk", ".kooooook."],
  waves: ["a.aa..aa..aa..", ".a..aa..aa..aa"],
  house: ["....k....", "...kgk...", "..kgggk..", ".kgggggk.", "kkkkkkkkk", ".kwwkwwk.", ".kwwkkwk.", ".kkkkkkk."],
  flag: ["kn..", "knn.", "knnn", "k...", "k...", "k..."],
  ground: ["nnnnnnnnnnnnnnnn", "n.n.n.n.n.n.n.n."],
  board: ["kkkkkkkkkkkkkk", "kooooooooooook", "kowwwwwooooook", "kommwwwowwwwok", "kolllwwoggwwok", "kowwwwwowllwok", "kooooooowwwwok", "koxxwwwooooook", "kollwwwooooook", "kowwwwwooooook", "kkkkkkkkkkkkkk"],
  pin: ["r"],
  legs: ["ko", "ko", "ko", "ko", "ko"],
  spark: [".g.", "ggg", ".g."],
  dash: ["kkkkkkkkkkkkkkk", "kwwwwwwwwwwwwwk", "kkkkkkkkkkkkkkk", "...............", "uuuu.nnnn.gggg.", "u..u.n..n.g..g.", "ubbu.nssn.gwwg.", "u..u.n..n.g..g.", "ubbu.nssn.gwwg.", "u..u.n..n.g..g.", "ubbu.nssn.gwwg.", "u..u.n..n.g..g.", "uuuu.nnnn.gggg."],
  point: ["kkkk", "kfffk", "kkkk"],
};

/** Where in a scene's painting order the guide stands (at its own spot). */
export const GUIDE = "guide";

/** Each scene's layers, `[rows, x, y]` or GUIDE, painted in order. */
export const SCENES = {
  welcome: [GUIDE, [PROPS.wave, 15, 8], [PROPS.bubble, 18, 2], [PROPS.spark, 27, 11], [PROPS.spark, 21, 14]],
  posts: [GUIDE, [PROPS.board, 17, 3], [PROPS.legs, 18, 14], [PROPS.legs, 28, 14], [PROPS.pin, 21, 5], [PROPS.pin, 28, 7], [PROPS.pin, 20, 10]],
  marks: [[PROPS.ground, 16, 17], GUIDE, [PROPS.house, 19, 9], [PROPS.flag, 28, 11], [PROPS.spark, 29, 6]],
  mail: [GUIDE, [PROPS.boat, 20, 1], [PROPS.waves, 17, 7], [PROPS.envelope, 17, 11], [PROPS.hand, 15, 14], [PROPS.ministamp, 26, 14]],
  dash: [GUIDE, [PROPS.dash, 17, 4], [PROPS.point, 14, 13]],
};

/** A scene as rects on its 32×20 grid, its layers painted in order and
 *  clipped to the grid. Throws on an ink with no colour, as artRects does. */
export function sceneRects(name) {
  const props = SCENES[name];
  if (!props) throw new Error(`pixel-icons: no tour scene named "${name}"`);
  const grid = Array.from({ length: SCENE_H }, () => Array(SCENE_W).fill("."));
  for (const [rows, x0, y0] of props.map((l) => (l === GUIDE ? [TOUR_GUIDE, ...GUIDE_AT] : l))) {
    rows.forEach((row, dy) => [...row].forEach((c, dx) => {
      const x = x0 + dx, y = y0 + dy;
      if (c !== "." && x >= 0 && x < SCENE_W && y >= 0 && y < SCENE_H) grid[y][x] = c;
    }));
  }
  const rects = [];
  grid.forEach((row, y) => {
    let x = 0;
    while (x < SCENE_W) {
      const c = row[x];
      let w = 1;
      while (row[x + w] === c) w++;
      if (c !== ".") {
        if (!ART_INK[c]) throw new Error(`pixel-icons: tour scene "${name}" row ${y} uses ink "${c}", which has no colour`);
        rects.push({ x, y, w, fill: ART_INK[c] });
      }
      x += w;
    }
  });
  return rects;
}

/** A tour scene as <svg> markup, as wide as its box. Decoration, so aria-hidden. */
export function sceneSvg(name) {
  const body = sceneRects(name).map((r) => `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="1" fill="${r.fill}"/>`).join("");
  return `<svg class="pm-pixart pm-scene" viewBox="0 0 ${SCENE_W} ${SCENE_H}" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${body}</svg>`;
}
