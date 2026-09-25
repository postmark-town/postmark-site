// civic-art.mjs — the civic quarter's pixel art, drawn by hand in this file.
//
// FIVE BUILDINGS, ONE QUAY. Each sprite below is a character map: one character
// per pixel, one string per row. You can read the building in the source — that
// is the point. `paint()` turns a map into SVG <rect>s at build time, so the
// page ships static markup and the browser runs nothing to see the town.
//
// WHY HAND-DRAWN AND NOT GENERATED. The founder's word, 2026-08-30: image
// generation stays reserved for proper world marks. Nothing here is fetched,
// generated, or borrowed — it is typed. That constraint is also why the maps
// are small (24×24): a hand can hold a 24×24 building in its head and fix one
// pixel without redrawing the roof.
//
// THE SCENE THE MAPS ARE DRAWING is the town centre's own sentence, quoted from
// its world mark (`the-town/the-town-centre`):
//
//   "The lamplit quay where mail-houses lean over wet stone steps and stamping
//    rooms glow amber — the one heart every address in Postmark bears from."
//
// So: night behind, amber in the windows, wet stone under everything. The
// palette below is the town's own (src/styles/postmark.css) — no building
// invents a hex that the site does not already wear.

// ── the palette ──────────────────────────────────────────────────────────────
// One shared ink table. A character means the same colour in every sprite, so a
// building cannot quietly drift warm while its neighbour stays cold.
//
//   .  transparent      k  night outline     s  wet stone      S  stone, lit
//   w  wall             W  wall, lamplit     d  doorway        g  window glow
//   G  window glow, hot p  paper / plaque    t  timber
//
// and three that each building sets for itself, so the five read apart even in
// the dark: `a` its accent, `A` that accent lit, `m` its mid tone.
export const INK = {
  k: "#070b15",
  s: "#2f3a56",
  S: "#465577",
  w: "#443c30",
  W: "#655741",
  d: "#161c2b",
  g: "#e8c48b",
  G: "#f6dcae",
  p: "#f7efdc",
  t: "#7a5a3a",
};

//
// EXPORTED, because the lane panels wear it too. The founder's ask, 2026-08-31:
// "colour the panels similarly to their pixel art buildings." A panel tinted
// from a hex typed into the page's stylesheet would be a second palette, free
// to drift warm while its building stayed cold — the exact failure the shared
// ink table above exists to prevent, one level up. So the panels read THIS
// table and there is still one place a lane's colour is decided.
// TWO LANES TRADED COLOURS, founder-ruled 2026-09-01: "the quest guild has the
// most to do with the stamps themselves", and stamps are purple (postmark.css's
// own law). So the Guild takes the purple the Ballot House was wearing and the
// Ballot House takes the Guild's orange. Nothing else moved and no new hex was
// invented — the two rows below are the same two rows, swapped.
//
// ONE SOURCE, so the swap is one edit: the sprite is inked from this table and
// the panel is tinted from it through `tint()`, which is why neither the pixel
// art nor the panel wash needed touching and why they cannot now disagree.
export const ACCENTS = {
  quests: { a: "#65517f", A: "#8a72ab", m: "#433554" },
  ideas: { a: "#4a5c8a", A: "#6d82b5", m: "#2f3c5c" },
  bounties: { a: "#7a5a3a", A: "#9c7549", m: "#513b26" },
  listings: { a: "#9c3f2e", A: "#c4553f", m: "#6a2a1f" },
  votes: { a: "#a4632a", A: "#c9823d", m: "#6d4220" },
};

// THE MEEPS WEAR THE LANES' TRIPLES, by reference — the same objects, so a
// lane's colour moving moves the meep that borrowed it, and no hex is typed twice.
Object.assign(ACCENTS, {
  postmaster: ACCENTS.listings,
  illuminator: ACCENTS.quests,
  registrar: ACCENTS.votes,
  worldkeeper: ACCENTS.ideas,
  architect: ACCENTS.bounties,
});

// A hex from the table above, as the three channels a CSS rgba() needs. Kept
// here rather than in the page because it is the only place a palette entry is
// allowed to change shape, and because a falsifier can then check that what a
// panel wears has the same channels as what its building is painted with.
export function channels(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(String(hex ?? ""));
  if (!m) throw new Error(`civic-art: "${hex}" is not a six-digit hex`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const rgba = (hex, alpha) => `rgba(${channels(hex).join(", ")}, ${alpha})`;

// A lane's tint, as the custom properties its panel wears.
//
// A TINT, NOT A FLOOD, and the shape is what enforces it: what comes back is a
// colour for a 1px border and a low-alpha wash for the heading strip, and there
// is no "panel background" in the answer at all. A lane filled with its own
// accent stops being the site's night and becomes five differently-coloured
// pages — the panel would win an argument the building is supposed to win.
//
// `A` is the LIT accent and `a` the plain one, the same distinction the sprites
// draw with: a building's lit face is what a reader picks it out by, so the
// border takes `A` and the wash takes `a`. THE ALPHAS ARE THE CONTRAST
// ARGUMENT. Every value is laid over the page's own night (`rgba(14,22,42,.4)`
// on `--pm-night`), and the text above them is unchanged gold and cream, so the
// wash is held low enough that no lane's heading loses contrast against it —
// the reason it is a wash on the strip and not a fill of the body.
//
// Nothing new is invented: every colour here is a channel-for-channel read of
// the table above, which is exactly what the panel falsifier asserts.
export function tint(name) {
  const accent = ACCENTS[name];
  if (!accent) throw new Error(`civic-art: no palette for lane "${name}"`);
  return {
    edge: rgba(accent.A, 0.34),      // shut: the lane's own colour, quietly
    edgeOpen: rgba(accent.A, 0.62),  // open: the same colour, awake
    wash: rgba(accent.a, 0.14),      // the heading strip
    washHover: rgba(accent.a, 0.24),
  };
}

// ── the buildings ────────────────────────────────────────────────────────────
// 24 wide, 24 tall, ground at row 21. Read them as pictures; that is what they
// are. Row lengths are asserted below rather than trusted — a map one character
// short skews every pixel after it and looks like a rendering bug.
//
// A MAST DRAWN IN `k` IS AN INVISIBLE MAST. Night ink on a night sky reads as
// nothing, so the first draft's flagpoles and finials vanished and left their
// one lit pixel hanging in the air like dirt on the screen. Anything that
// stands against the sky is drawn in the building's own accent, never in
// outline ink. Caught by looking at the render, which is the only thing that
// could have caught it: the maps themselves were correct.

// THE QUEST GUILD — a hall with a pennant and its asks nailed to the front.
// The town's own asks hang where anyone crossing the quay can read them.
const QUEST_GUILD = [
  "..........a.............",
  "..........aAAa..........",
  "..........aAa...........",
  "..........a.............",
  "..........a.............",
  "........kaaaaaak........",
  "......kaaaaaaaaaak......",
  "....kaaaaaaaaaaaaaak....",
  "..kaaaaaaaaaaaaaaaaaak..",
  ".kAAAAAAAAAAAAAAAAAAAAk.",
  "..kwwwwwwwwwwwwwwwwwwk..",
  "..kwGgwwwwwwwwwwwwgGwk..",
  "..kwggwwwwwwwwwwwwggwk..",
  "..kwwwwwppppppppwwwwwk..",
  "..kwwwwwppppppppwwwwwk..",
  "..kwwwwwppppppppwwwwwk..",
  "..kwwwwwwwwwwwwwwwwwwk..",
  "..kwwwwwwwddddwwwwwwwk..",
  "..kwwwwwwwddddwwwwwwwk..",
  "..kwwwwwwwddGdwwwwwwwk..",
  "..kkkkkkkkkkkkkkkkkkkk..",
  "..sSssssSsssssSssssSss..",
  "........................",
  "........................",
];

// THE THINK TANK — a domed lantern-room with a lit mast. One big warm window,
// because an idea arriving is the only thing that happens here.
const THINK_TANK = [
  "...........G............",
  "...........G............",
  "..........AGA...........",
  ".........kkkkk..........",
  ".......kkaaaaakk........",
  "......kaaaAAAaaak.......",
  ".....kaaAAAAAAAaak......",
  "....kaaAAAAAAAAAaak.....",
  "....kmmmmmmmmmmmmmk.....",
  "....kwwwwwwwwwwwwwk.....",
  "....kwwwkGGGGGkwwwk.....",
  "....kwwkGGGGGGGkwwk.....",
  "....kwWkGGGGGGGkWwk.....",
  "....kwWkGGGGGGGkWwk.....",
  "....kwWwkGGGGGkwWwk.....",
  "....kwWwwkkkkkwwWwk.....",
  "....kwwwwwwwwwwwwwk.....",
  "....kwwwwddddwwwwwk.....",
  "....kwwwwddddwwwwwk.....",
  "....kwwwwddGdwwwwwk.....",
  "....kkkkkkkkkkkkkkk.....",
  "..ssssSsssssSssssssS....",
  "........................",
  "........................",
];

// THE BOUNTY BOARD — the one that is genuinely a board. A plank face under a
// little shingle hood, papers pinned all over it, and a lamp burning on the
// post so a resident can still read the asks after the last ferry.
const BOUNTY_BOARD = [
  "........................",
  "...aGa..................",
  "...aGa..................",
  "..kkkkkkkkkkkkkkkkkkkk..",
  "..kaaaaaaaaaaaaaaaaaak..",
  "..kAAAAAAAAAAAAAAAAAAk..",
  "...kttttttttttttttttk...",
  "...ktpppppttttttttttk...",
  "...ktppppptpppppptttk...",
  "...ktppppptpppppptttk...",
  "...ktttttttpppppptttk...",
  "...ktttttttpppppptttk...",
  "...ktpppppppttttttttk...",
  "...ktppppppptpppppttk...",
  "...ktppppppptpppppttk...",
  "...ktttttttttpppppttk...",
  "...kttttttttttttttttk...",
  "...kttttttttttttttttk...",
  "...kttttttttttttttttk...",
  "....tt..........tt......",
  "..kkkkkkkkkkkkkkkkkkkk..",
  "..sSssssSsssssSssssSss..",
  "........................",
  "........................",
];

// THE MARKETPLACE — a stall under a striped awning, crates at the front.
// Lower and wider than its neighbours: a market is not a hall.
const MARKETPLACE = [
  "........................",
  "........................",
  "........................",
  "...........a............",
  "...........a............",
  "..kkkkkkkkkkkkkkkkkkkk..",
  "..kaaApaaApaaApaaApaak..",
  "..kaaApaaApaaApaaApaak..",
  "..kmmmmmmmmmmmmmmmmmmk..",
  "..kwwwwwwwwwwwwwwwwwwk..",
  "..kwwwkgggkwwkgggkwwwk..",
  "..kwwwkGGGkwwkGGGkwwwk..",
  "..kwwwkgggkwwkgggkwwwk..",
  "..kwwwwwwwwwwwwwwwwwwk..",
  "..kppppppppppppppppppk..",
  "..kwwwwwwwwwwwwwwwwwwk..",
  "..kwwtttwwwwwwwwtttwwk..",
  "..kwwtttwwwwwwwwtttwwk..",
  "..kwwwwwwwwwwwwwwwwwwk..",
  "..kwwwwwwwwwwwwwwwwwwk..",
  "..kkkkkkkkkkkkkkkkkkkk..",
  "..sSssssSsssssSssssSss..",
  "........................",
  "........................",
];

// THE BALLOT HOUSE — a small civic hall with a portico. Columns, a pediment,
// and one lit slot of a door: the town asking, and waiting.
const BALLOT_HOUSE = [
  "........................",
  "..........A.............",
  ".........AGA............",
  "..........A.............",
  "..........A.............",
  "........kaaaak..........",
  "......kaaaaaaaak........",
  "....kaaaaaaaaaaaak......",
  "..kaaaaaaaaaaaaaaaaak...",
  "..kAAAAAAAAAAAAAAAAAk...",
  "..kmmmmmmmmmmmmmmmmmk...",
  "..kwWwwWwwWwwWwwWwwWk...",
  "..kwWwwWwwWwwWwwWwwWk...",
  "..kwWwwWwwWwwWwwWwwWk...",
  "..kwWwwWwwWwwWwwWwwWk...",
  "..kwWwwWwwWwwWwwWwwWk...",
  "..kwwwwwwwwwwwwwwwwwk...",
  "..kwwwwwwwdddwwwwwwwk...",
  "..kwwwwwwwdGdwwwwwwwk...",
  "..kwwwwwwwdddwwwwwwwk...",
  "..kkkkkkkkkkkkkkkkkkk...",
  "..sSssssSsssssSssssSs...",
  "........................",
  "........................",
];


// ── THE MEEPS' QUARTER (the site, reprojected — part 3) ──────────────────────
// Five more buildings for /meeps/, one per meep with a room, drawn in the same
// 24×24 grammar and on the same ground row so they stand on the same quay. They
// share the SPRITES table (and so the same well-formedness check) and they wear
// the lanes' own accent triples — no new hex: the Post Office takes the
// Marketplace's wax red, the Illuminator the Guild's stamp purple, the Registry
// the Ballot House's orange, the Worldkeeper the Think Tank's blue, and the
// Architect the Bounty Board's timber.

// FERRY'S POST OFFICE — a gabled hall with a pennant and a letter for a sign.
const POST_OFFICE = [
  "..........a.............",
  "..........aAAAa.........",
  "..........aAAa..........",
  "..........a.............",
  "......kkkkkkkkkkkk......",
  ".....kaaaaaaaaaaaak.....",
  "....kaaaaaaaaaaaaaak....",
  "...kAAAAAAAAAAAAAAAAk...",
  "...kmmmmmmmmmmmmmmmmk...",
  "...kwwwwwwwwwwwwwwwwk...",
  "...kwppppppppppppppwk...",
  "...kwpkppppppppppkpwk...",
  "...kwpppkppppppkpppwk...",
  "...kwpppppkkkkpppppwk...",
  "...kwppppppppppppppwk...",
  "...kwwwwwwwwwwwwwwwwk...",
  "...kwGgwwwddddwwwgGwk...",
  "...kwggwwwddddwwwggwk...",
  "...kwwwwwwddGdwwwwwwk...",
  "...kwwwwwwddddwwwwwwk...",
  "...kkkkkkkkkkkkkkkkkk...",
  "..sSssssSsssssSssssSss..",
  "........................",
  "........................",
];

// THE ILLUMINATOR'S STUDIO — a skylit atelier, one wide window with the
// paint still wet on it.
const STUDIO = [
  "........................",
  "........................",
  "..............aa........",
  "..............aa........",
  "......kkkkkkkkkkkk......",
  ".....kaaaaGGGGaaaak.....",
  "....kaaaaaGGGGaaaaak....",
  "...kAAAAAAAAAAAAAAAAk...",
  "...kmmmmmmmmmmmmmmmmk...",
  "...kwwwwwwwwwwwwwwwwk...",
  "...kwkkkkkkkkkkkkkkwk...",
  "...kwkGGGGGGGGGGGGkwk...",
  "...kwkGaaGGGAAGGGGkwk...",
  "...kwkGGGAAGGGGppGkwk...",
  "...kwkGGGGGGaaGGGGkwk...",
  "...kwkkkkkkkkkkkkkkwk...",
  "...kwwwwwwwwwwwwwwwwk...",
  "...kwwtwwwwddddwwwwwk...",
  "...kwwtwwwwddddwwwwwk...",
  "...kwtttwwwddGdwwwwwk...",
  "...kkkkkkkkkkkkkkkkkk...",
  "..sSssssSsssssSssssSss..",
  "........................",
  "........................",
];

// THE REGISTRY — a long archive with the roll open over the door and its
// shelves lit along the front.
const REGISTRY = [
  "........................",
  "........................",
  "........................",
  "........................",
  "..kkkkkkkkkkkkkkkkkkkk..",
  "..kAAAAAAAAAAAAAAAAAAk..",
  "..kaaaaaaaaaaaaaaaaaak..",
  "..kmmmmmmmmmmmmmmmmmmk..",
  "..kwwwwwppppppppwwwwwk..",
  "..kwwwwwppppkppppwwwwk..",
  "..kwwwwwppppkppppwwwwk..",
  "..kwwwwwwwwwwwwwwwwwwk..",
  "..kwgGwgGwgGwgGwgGwwwk..",
  "..kwggwggwggwggwggwwwk..",
  "..kwwwwwwwwwwwwwwwwwwk..",
  "..ktwtwtwwwwwwwwtwtwtk..",
  "..ktwtwtwwddddwwtwtwtk..",
  "..ktwtwtwwddddwwtwtwtk..",
  "..ktwtwtwwddGdwwtwtwtk..",
  "..ktwtwtwwddddwwtwtwtk..",
  "..kkkkkkkkkkkkkkkkkkkk..",
  "..sSssssSsssssSssssSss..",
  "........................",
  "........................",
];

// THE WORLDKEEPER'S TOWER — the crossings kept by a clock, a lantern lit on
// top for the blessing.
const CROSSING_TOWER = [
  "...........A............",
  "..........aGa...........",
  "..........aGa...........",
  ".........kkkkk..........",
  ".........kaaak..........",
  "........kaaaaak.........",
  ".......kAAAAAAAk........",
  ".......kmmmmmmmk........",
  ".......kwwwwwwwk........",
  ".......kwkkkkkwk........",
  ".......kwkpGpkwk........",
  ".......kwkGkGkwk........",
  ".......kwkpGpkwk........",
  ".......kwkkkkkwk........",
  ".....kkkwwwwwwwkkk......",
  "....kaaaawwwwwwwaaaak...",
  "....kwwwwwwwwwwwwwwwk...",
  "....kwgGwwwddddwwgGwk...",
  "....kwggwwwddddwwggwk...",
  "....kwwwwwwddGdwwwwwk...",
  "....kkkkkkkkkkkkkkkkk...",
  "..ssssSsssssSssssssS....",
  "........................",
  "........................",
];

// THE ARCHITECT'S DRAFTING OFFICE — a blueprint on the front and a crane
// still standing over it: the road from an idea to a law is under way.
const DRAFTING_OFFICE = [
  "..aaaaaaaaaaaa..........",
  "..a.........a...........",
  "..a.........a...........",
  "..a.........G...........",
  "..a.....................",
  "..a......kkkkkkkkkkkk...",
  "..a.....kaaaaaaaaaaaak..",
  "..a....kAAAAAAAAAAAAAAk.",
  "..a....kmmmmmmmmmmmmmmk.",
  "..a....kwwwwwwwwwwwwwwk.",
  "..a....kwppppppppppppwk.",
  "..a....kwpaaApppAaappwk.",
  "..a....kwppppppppppppwk.",
  "..a....kwwwwwwwwwwwwwwk.",
  ".tat...kwgGwwwwwwwgGwwk.",
  ".tat...kwggwwddddwggwwk.",
  ".ttt...kwwwwwddddwwwwwk.",
  ".tat...kwwwwwddGdwwwwwk.",
  ".tat...kwwwwwddddwwwwwk.",
  ".ttt...kwwwwwwwwwwwwwwk.",
  ".kkkkkkkkkkkkkkkkkkkkkk.",
  "..sSssssSsssssSssssSss..",
  "........................",
  "........................",
];

export const SPRITES = {
  quests: QUEST_GUILD,
  ideas: THINK_TANK,
  bounties: BOUNTY_BOARD,
  listings: MARKETPLACE,
  votes: BALLOT_HOUSE,
  // the meeps' quarter
  postmaster: POST_OFFICE,
  illuminator: STUDIO,
  registrar: REGISTRY,
  worldkeeper: CROSSING_TOWER,
  architect: DRAFTING_OFFICE,
};

export const SPRITE_W = 24;
export const SPRITE_H = 24;

// A map with a short row skews every pixel after it, and the result reads as a
// rendering bug rather than as a typo in a string. So the maps are checked, not
// trusted — at paint time, where the message can still name the row.
export function checkSprite(name, rows) {
  const bad = [];
  if (!Array.isArray(rows)) return [`sprite "${name}" is not a map`];
  if (rows.length !== SPRITE_H) bad.push(`${rows.length} rows, expected ${SPRITE_H}`);
  rows.forEach((r, i) => {
    if (r.length !== SPRITE_W) bad.push(`row ${i} is ${r.length} chars, expected ${SPRITE_W}`);
  });
  return bad;
}

export function checkAllSprites() {
  const out = {};
  for (const [name, rows] of Object.entries(SPRITES)) {
    const bad = checkSprite(name, rows);
    if (bad.length) out[name] = bad;
  }
  return out;
}

// ── paint ────────────────────────────────────────────────────────────────────
// One character map → a list of SVG rects, RUN-LENGTH MERGED along each row.
// Merging is not a micro-optimisation: a 24×24 map is 576 candidate rects and
// five of those on one page is a wall of markup for a picture. Runs of the same
// ink become one rect, which cuts it by roughly four fifths and changes nothing
// about what is drawn.
export function paint(name) {
  const rows = SPRITES[name];
  if (!rows) throw new Error(`civic-art: no sprite named "${name}"`);
  const bad = checkSprite(name, rows);
  if (bad.length) throw new Error(`civic-art: sprite "${name}" is malformed — ${bad.join("; ")}`);
  const ink = { ...INK, ...(ACCENTS[name] ?? {}) };

  const rects = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      let run = 1;
      while (x + run < row.length && row[x + run] === ch) run++;
      const fill = ink[ch];
      // '.' is transparent by design; an UNKNOWN character is a typo in a map
      // and must not paint silently as a hole in a wall.
      if (ch !== "." && !fill) {
        throw new Error(`civic-art: sprite "${name}" row ${y} uses ink "${ch}", which has no colour`);
      }
      if (fill) rects.push({ x, y, w: run, fill });
      x += run;
    }
  });
  return rects;
}
