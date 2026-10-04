#!/usr/bin/env node
// bug-strip-art.mjs — draws the bug strip's seven panel pictures and the jar's
// silhouette in the page's own pixel kit (pixel-icons.mjs § ART_INK), and
// writes them where src/lib/bug-strip.mjs's PANELS and JAR_ART point. The
// pixel pictures are the pictures (Keemin, 2026-09-29: "pixel is fine").
//
//   node tools/bug-strip-art.mjs           write the SVGs
//   node tools/bug-strip-art.mjs --check   exit 1 if a committed SVG differs

import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ART_INK, GRID } from "../src/lib/pixel-icons.mjs";
import { PANELS, JAR_ART } from "../src/lib/bug-strip.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = join(ROOT, "public", "atelier", "postmark");

// k line · l soft line · w paper · o timber · g gold · G deep gold · r wax ·
// m the little AI · s steel · t screen · x screen text · b glass · n green ·
// f skin · c cheek · u blue
export const SCENES = {
  // 1 · something's broken: a glitching screen, a resident frowning under it
  1: [
    "................",
    ".kkkkkkkkkkkkkk.",
    ".kttttttttttttk.",
    ".ktxxxttttrrttk.",
    ".kttttttrrttttk.",
    ".ktxxrrttttxxtk.",
    ".kttttrrtxxxttk.",
    ".kkkkkkkkkkkkkk.",
    "......kkkk......",
    ".....kffffk.....",
    "....kfkffkfk....",
    "....kffffffk....",
    "....kffkkffk....",
    "....kfkffkfk....",
    ".....kffffk.....",
    "......kkkk......",
  ],
  // 2 · tell the Bug Catcher: three arrows flying into his net
  2: [
    "................",
    "...........kkk..",
    "...G......kbbbk.",
    "GGGGG....kbbbbbk",
    "...G.....kbbbbbk",
    ".........kbbbbbk",
    "...G......kbbbk.",
    "GGGGG......kkk..",
    "...G.......o....",
    "..........o.....",
    "...G.....o......",
    "GGGGG...o.......",
    "...G...o........",
    "......o.........",
    ".....o..........",
    "................",
  ],
  // 3 · caught: a jar with the bug in it, lid on
  3: [
    "................",
    ".....oooooo.....",
    ".....kkkkkk.....",
    "....kbbbbbbk....",
    "...kbbbbbbbbk...",
    "...kbbbbbbbbk...",
    "...kbbkbbkbbk...",
    "...kbbbknkbbk...",
    "...kbbknnnkbk...",
    "...kbkknnnkkk...",
    "...kbbknnnkbk...",
    "...kbbbkkkbbk...",
    "...kbbkbbbkbk...",
    "...kbbbbbbbbk...",
    "....kkkkkkkk....",
    "................",
  ],
  // 4 · show me: a numbered list of steps, a finger pointing at one
  4: [
    "................",
    "kkkkkkkkkk......",
    "kwwwwwwwwk......",
    "kwgwllllwk......",
    "kwwwwwwwwk......",
    "kwgwllllwk..kkk.",
    "kwwwwwwwwk.kfffk",
    "kwgwllllkkkkfffk",
    "kwwwwwwkffffffk.",
    "kwwwwwwwkkkkfffk",
    "kkkkkkkkkk.kfffk",
    "...........kffk.",
    "............kk..",
    "................",
    "................",
    "................",
  ],
  // 5 · why it broke, how to fix it: a magnifying glass, then a drawn plan
  5: [
    "................",
    "..kkkk..........",
    ".kbbbbk.........",
    "kbkbbkbk........",
    "kbbnnbbk.kkkkkk.",
    "kbknnkbk.kwwwwk.",
    ".kbbbbk..kwllwk.",
    "..kkkkk..kwwwwk.",
    "......kk.kwllwk.",
    ".......k.kwwwnk.",
    "........oknwnwk.",
    ".........kwnwwk.",
    ".........kkkkkk.",
    "................",
    "................",
    "................",
  ],
  // 6 · fixed: a brick wall with a gold patch where the crack was
  6: [
    "................",
    "kkkkkkkkkkkkkkkk",
    "korrrkrrrrkrrrok",
    "kkkkkkkkkkkkkkkk",
    "krrkrrrrkrrrrkrk",
    "kkkkkkkkkkkkkkkk",
    "korrrkkGGGkrrrok",
    "kkkkkkGgggGkkkkk",
    "krrkrrGgggGrrkrk",
    "kkkkkkkGGGkkkkkk",
    "korrrkrrrrkrrrok",
    "kkkkkkkkkkkkkkkk",
    "krrkrrrrkrrrrkrk",
    "kkkkkkkkkkkkkkkk",
    "................",
    "................",
  ],
  // 7 · the stamps arrive: an envelope, stamps spilling out of it
  7: [
    "................",
    "..kkkkk..kkkkk..",
    "..kuuuk..kgggk..",
    "..kuwuk..kgrgk..",
    "..kuuuk..kgggk..",
    "..kkkkk..kkkkk..",
    "................",
    "kkkkkkkkkkkkkkkk",
    "kwkwwwwwwwwwwkwk",
    "kwwkwwwwwwwwkwwk",
    "kwwwkwwwwwwkwwwk",
    "kwwwwkkwwkkwwwwk",
    "kwwwwwwkkwwwwwwk",
    "kwwwwwwwwwwwwwwk",
    "kkkkkkkkkkkkkkkk",
    "................",
  ],
};
// 3-spotted · the bug on its letter, under a magnifying glass (panel 3 since
// Keemin's 2026-09-29 word: confirming a bug is SPOTTING it; it is caught at the
// fix, when it goes into the jar, which is scene 3 above)
SCENES.spotted = [
  "................",
  ".kkkkkkkkk......",
  ".kwwwwwwwk......",
  ".kwlllllwk......",
  ".kwwwwwwwk......",
  ".kwwkrkwwk......",
  ".kwkrrrkwk.kkkk.",
  ".kwwkrkwwkkbbbbk",
  ".kwlllllwkbbrbbk",
  ".kwwwwwwwkbrrrbk",
  ".kkkkkkkkkbbrbbk",
  "..........kbbbbk",
  "...........kkkk.",
  "..............o.",
  "...............o",
  "................",
];
// the jar's loose bug: the jar (scene 3), its bug a silhouette until the fixer names it
SCENES["jar-open"] = SCENES[3].map((row) => row.replaceAll("n", "k"));

export function svgOf(n) {
  const rows = SCENES[n];
  if (!rows || rows.length !== GRID) throw new Error(`bug-strip-art: scene ${n} has ${rows?.length} rows, expected ${GRID}`);
  const rects = [];
  rows.forEach((row, y) => {
    if (row.length !== GRID) throw new Error(`bug-strip-art: scene ${n} row ${y} is ${row.length} wide, expected ${GRID}`);
    let x = 0;
    while (x < GRID) {
      const c = row[x];
      let w = 1;
      while (row[x + w] === c) w++;
      if (c !== ".") {
        if (!ART_INK[c]) throw new Error(`bug-strip-art: scene ${n} row ${y} uses ink "${c}", which has no colour`);
        rects.push(`<rect x="${x}" y="${y}" width="${w}" height="1" fill="${ART_INK[c]}"/>`);
      }
      x += w;
    }
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${GRID} ${GRID}" shape-rendering="crispEdges">${rects.join("")}</svg>\n`;
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("tools/bug-strip-art.mjs")) {
  const check = process.argv.includes("--check");
  let drift = 0;
  const pictures = [...PANELS.map((p) => [p.art ?? p.n, p.img]), [3, JAR_ART.finished], ["jar-open", JAR_ART.open]];
  for (const [key, img] of pictures) {
    const file = join(PUBLIC, ...img.split("/").filter(Boolean));
    const want = svgOf(key);
    if (check) {
      // a Windows checkout may hold the file CRLF; the picture is the same
      if (!existsSync(file) || readFileSync(file, "utf8").replace(/\r\n/g, "\n") !== want) { console.error(`drift: ${img}`); drift++; }
    } else {
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, want);
      console.log(`wrote ${img}`);
    }
  }
  if (drift) process.exit(1);
}
