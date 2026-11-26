// contrast.mjs — scratch readout from site-prep's own frames: in a text region, the backdrop is the darker 40% of pixels (worst case: their 90th
// percentile, the lightest real backdrop); the text is either the DECLARED colour (blended by the element's opacity over that backdrop) or, for
// text whose colour is inherited, the region's 99th-percentile glyph pixel (an under-estimate: antialiased cores rarely reach the full colour).
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
function decode(file) {
  const b = readFileSync(file); let o = 8, w, h, ct, idat = [];
  while (o < b.length) { const len = b.readUInt32BE(o), t = b.toString("ascii", o + 4, o + 8), d = b.subarray(o + 8, o + 8 + len);
    if (t === "IHDR") { w = d.readUInt32BE(0); h = d.readUInt32BE(4); ct = d[9]; } if (t === "IDAT") idat.push(d); o += 12 + len; }
  const bpp = ct === 6 ? 4 : 3, raw = inflateSync(Buffer.concat(idat)), px = Buffer.alloc(w * h * bpp), stride = w * bpp;
  for (let y = 0; y < h; y++) { const f = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) { const v = raw[y * (stride + 1) + 1 + x], a = x >= bpp ? px[y * stride + x - bpp] : 0, up = y ? px[(y - 1) * stride + x] : 0, c = y && x >= bpp ? px[(y - 1) * stride + x - bpp] : 0;
      const p = a + up - c, pa = Math.abs(p - a), pb = Math.abs(p - up), pc = Math.abs(p - c);
      px[y * stride + x] = (v + [0, a, up, (a + up) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? up : c][f]) & 255; } }
  return { w, h, at: (x, y) => [px[(y * w + x) * bpp], px[(y * w + x) * bpp + 1], px[(y * w + x) * bpp + 2]] };
}
const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const L = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => { const [x, y] = [L(a), L(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
const hex = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
const R = [
  ["refused-390", "name refusal (#ff9d8f)", [38, 326, 340, 400], "#ff9d8f", 1],
  ["toolong-1440", "length refusal (#ff9d8f)", [322, 572, 872, 592], "#ff9d8f", 1],
  ["upload-refused-390", "upload refusal (.ap-note, #ff9d8f at .85)", [38, 650, 345, 725], "#ff9d8f", 0.85],
  ["refused-390", "caption 'the household's own' (inherited, .8)", [38, 604, 165, 621], null],
  ["refused-390", "caption name 'Julian' (inherited, 600, .8)", [38, 182, 82, 197], null],
  ["refused-390", "label 'Who this sheet shows'", [38, 640, 180, 659], null],
  ["upload-refused-390", "label 'Who this sheet shows (optional)'", [38, 208, 272, 228], null],
];
for (const [shot, what, [x0, y0, x1, y1], fg, op] of R) {
  const img = decode(`${process.argv[2]}/residents-qa-fixture-core175-appearance-shot-${shot}.png`);
  const all = []; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) all.push(img.at(x, y));
  all.sort((a, b) => L(a) - L(b));
  const bgs = all.slice(0, Math.floor(all.length * 0.4)), bg = bgs[Math.floor(bgs.length * 0.9)];
  const text = fg ? hex(fg).map((c, i) => Math.round(op * c + (1 - op) * bg[i])) : all[Math.floor(all.length * 0.99)];
  console.log(`${shot.padEnd(19)} ${what.padEnd(46)} text rgb(${text}) on rgb(${bg}) = ${ratio(text, bg).toFixed(2)}:1${fg ? "" : " (glyph estimate)"}`);
}
