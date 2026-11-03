// harbor-sky.mjs — the Sky Harbor chart's geometry (POS-769, option B).
//
// The chart is drawn twice, once wide and once tall for a phone, and both
// drawings come from here so the page stays presentation. Postmark's postbox
// stands at the top, the harbor's dock sits at the middle, and each chartered
// town hangs on a cloud below with its own flight path: a loop that leaves the
// dock, rounds the town's tower and comes home. Two towns make the mock's
// figure-eight exactly; a third or fourth town hangs beside its side's first.
//
// A loop is the mock's own hand-drawn curve, carried into each town's frame:
// every control point is stored as (along, across) the dock-to-tower line, in
// units of that line's length, and rebuilt along the line to the new tower. A
// tower on the left takes the mirror, so the two loops turn opposite ways and
// meet at the dock the way the mock draws them.

const r1 = (v) => Math.round(v * 10) / 10;

// The two drawings. `petal` is the mock's right-hand loop (the city's), with
// `tower` the point inside it the loop is drawn around; everything else is the
// mock's own placement, in its own viewBox.
export const FRAMES = {
  wide: {
    vb: { w: 1200, h: 650 },
    dock: { x: 600, y: 372 },
    petalTower: { x: 975, y: 410 },
    petal: [
      [700, 300], [850, 250], [930, 300],
      [1010, 350], [990, 420], [900, 430],
      [800, 440], [680, 420], [600, 372],
    ],
    // where a town's tower and labels sit, relative to its centre x
    sideX: { left: 225, right: 975 },
    sideStep: 180,
    tower: { y: 330, w: 110, h: 165 },
    badgeY: 468, nameY: 528, tagY: 551, countY: 591, unitY: 614, activityY: 636,
    host: { x: 555, y: 116, w: 90, h: 135, badgeY: 232, kickY: 26, nameY: 58, countY: 85, lineY: 106 },
    dockUse: { x: 512, y: 318, w: 176, h: 110 },
    shipParked: { x: 790, y: 280 },
    ship: { x: -75, y: -98, w: 150, h: 196 },
    dur: 44,
  },
  tall: {
    vb: { w: 360, h: 680 },
    dock: { x: 180, y: 296 },
    petalTower: { x: 280, y: 470 },
    petal: [
      [230, 326], [306, 330], [308, 392],
      [310, 448], [258, 452], [248, 424],
      [236, 390], [214, 340], [180, 296],
    ],
    sideX: { left: 80, right: 280 },
    sideStep: 70,
    tower: { y: 410, w: 80, h: 120 },
    badgeY: 510, nameY: 557, tagY: 576, countY: 608, unitY: 627, activityY: 646, measuredY: 662,
    host: { x: 144, y: 104, w: 72, h: 108, badgeY: 198, kickY: 20, nameY: 46, countY: 70, lineY: 89 },
    dockUse: { x: 116, y: 252, w: 128, h: 80 },
    shipParked: { x: 255, y: 345 },
    ship: { x: -46, y: -60, w: 92, h: 120 },
    dur: 34,
  },
};

// The mock's loop as (along, across) the dock-to-tower line.
function petalFrame(frame) {
  const D = frame.dock;
  const T = frame.petalTower;
  const dx = T.x - D.x, dy = T.y - D.y;
  const len = Math.hypot(dx, dy);
  const ux = dx / len, uy = dy / len;
  return frame.petal.map(([x, y]) => {
    const px = x - D.x, py = y - D.y;
    return [(px * ux + py * uy) / len, (-px * uy + py * ux) / len];
  });
}

// One town's loop, as the cubic segments after a move to the dock.
export function petalPath(frame, tower) {
  const D = frame.dock;
  const dx = tower.x - D.x, dy = tower.y - D.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  const mirror = tower.x >= D.x ? 1 : -1;
  const pts = petalFrame(frame).map(([a, b]) => {
    const across = b * mirror;
    return [r1(D.x + (a * ux - across * uy) * len), r1(D.y + (a * uy + across * ux) * len)];
  });
  // the last point is the dock itself; write it exactly, never as a rounding of it
  pts[pts.length - 1] = [D.x, D.y];
  const segs = [];
  for (let i = 0; i < pts.length; i += 3) {
    segs.push(`C${pts[i][0]} ${pts[i][1]} ${pts[i + 1][0]} ${pts[i + 1][1]} ${pts[i + 2][0]} ${pts[i + 2][1]}`);
  }
  return segs.join(" ");
}

// Where each chartered town stands. Towns alternate sides, the first to the
// right (the mock's city), and a side's second town steps outward from its
// first. `towns` is the chartered, non-host list in registry order.
export function layoutTowns(frame, towns) {
  const sides = { right: [], left: [] };
  towns.forEach((t, i) => sides[i % 2 === 0 ? "right" : "left"].push(t));
  const out = [];
  for (const side of ["right", "left"]) {
    const list = sides[side];
    const dir = side === "right" ? 1 : -1;
    list.forEach((t, i) => {
      // a lone town stands at the mock's spot; a pair spreads about it
      const offset = (i - (list.length - 1) / 2) * frame.sideStep * dir;
      const cx = frame.sideX[side] + offset;
      const centre = { x: cx, y: frame.petalTower.y };
      out.push({
        ...t,
        side,
        cx: r1(cx),
        towerUse: { x: r1(cx - frame.tower.w / 2), y: frame.tower.y, w: frame.tower.w, h: frame.tower.h },
        loop: `M${frame.dock.x} ${frame.dock.y} ${petalPath(frame, centre)}`,
        segs: petalPath(frame, centre),
      });
    });
  }
  return out;
}

// The night mail flies every loop in turn, right side first, and comes home.
export function shipPath(frame, placed) {
  if (!placed.length) return "";
  return `M${frame.dock.x} ${frame.dock.y} ` + placed.map((t) => t.segs).join(" ");
}

// A tower's colours, by town: CSS values, mixed from the site's own tokens
// (src/styles/postmark.css, the default palette), never a hex of their own, so
// the towers follow the site. The city wears the site's gold band under its
// copper accent and the forum its sealing wax; a town chartered later takes the
// next pair in turn rather than a borrowed one.
const mixOf = (a, p, b) => `color-mix(in srgb, ${a} ${p}%, ${b})`;
const TOWER_INKS = {
  "1f3d9": { band: "var(--pm-gold)", roof: "var(--pm-accent)", flag: "var(--pm-gold-bright)" },
  "1f916": { band: "var(--pm-wax)", roof: mixOf("var(--pm-wax)", 60, "var(--pm-night)"), flag: "var(--pm-gold-bright)" },
};
const SPARE_INKS = [
  { band: mixOf("var(--pm-harbor-2)", 55, "var(--pm-paper)"), roof: "var(--pm-harbor-2)", flag: "var(--pm-gold)" },
  { band: "var(--pm-accent)", roof: mixOf("var(--pm-accent)", 55, "var(--pm-night)"), flag: "var(--pm-gold-bright)" },
];
export function towerInks(slug, i = 0) {
  return TOWER_INKS[slug] ?? SPARE_INKS[i % SPARE_INKS.length];
}

// "1f916, the forum — …" → "the forum": a charter names its town's epithet in
// its first clause. A charter that does not reads with no epithet, never a
// made-up one.
export function epithetOf(body) {
  const m = /^[^,—]+,\s*([^—,.]{2,40}?)\s*—/.exec(String(body || ""));
  return m ? m[1].trim() : "";
}
