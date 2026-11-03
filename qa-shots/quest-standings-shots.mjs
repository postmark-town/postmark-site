// quest-standings-shots.mjs — rendered QA for the Quest Guild's standings,
// 2026-10-22 (#3514 the full board, #3515 the phone row).
//
//   npm run dev -- --port 4471 &
//   PHASE=before node qa-shots/quest-standings-shots.mjs   # on the base
//   PHASE=after  node qa-shots/quest-standings-shots.mjs   # on the branch
//   OUT=<dir> to write somewhere other than qa-shots/quest-standings/
//
// WHAT THIS JUDGES that the source checks in test/quest-standings.test.mjs
// cannot: whether any child of a standings row overlaps another once the page
// is laid out. The bug in #3515 was text, not boxes: "be reached 2/5" kept
// `nowrap` in a ~24px cell and ran out of it into the ✦. So each child is
// measured by the extent of its CONTENT (a Range over the child), which
// includes text that overflows its own box, and every pair in a row is
// checked for intersection.
//
// TWO WIDTHS: 375 (Lyra's phone) and 1280 (the desktop row, which must not
// change). The row boxes go to <PHASE>-rows.json so a before/after pair can be
// compared at 1280. PNGs are ignored by the repo (.gitignore), as everywhere
// under qa-shots/.
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const require = createRequire("G:/Wright-HQ/package.json");
const { chromium } = require("playwright");

const BASE = process.env.BASE ?? "http://localhost:4471";
const PHASE = process.env.PHASE ?? "after";
const OUT = process.env.OUT ?? join(process.cwd(), "qa-shots", "quest-standings");
mkdirSync(OUT, { recursive: true });

const PAGES = PHASE === "before" ? ["/town/"] : ["/town/", "/town/quests/"];
const WIDTHS = [375, 1280];

// every row's five children, by content extent, and any pair that intersects
const MEASURE = `(() => {
  const scope = document.querySelector("#quests") ?? document; // /town/: the Guild lane only, never the dashboards
  const rows = [...scope.querySelectorAll("ol.q-stand > li")]
    .filter((li) => li.children.length === 5 && li.querySelector(".q-rank"));
  const ext = (el) => { const r = document.createRange(); r.selectNodeContents(el); const b = r.getBoundingClientRect();
    return { x: +b.left.toFixed(1), y: +b.top.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1) }; };
  const hit = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0.5
    && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0.5;
  const out = [];
  for (const li of rows) {
    const kids = [...li.children].map((c) => ({ cls: c.className.split(" ").find((k) => k.startsWith("q-")), box: ext(c) }));
    const overlaps = [];
    for (let i = 0; i < kids.length; i++) for (let j = i + 1; j < kids.length; j++)
      if (hit(kids[i].box, kids[j].box)) overlaps.push(kids[i].cls + "×" + kids[j].cls);
    const top = li.getBoundingClientRect().top + scrollY;
    out.push({ rank: li.querySelector(".q-rank").textContent.trim(), top: +top.toFixed(1),
      kids: kids.map((k) => ({ ...k, box: { ...k.box, y: +(k.box.y + scrollY - top).toFixed(1) } })), overlaps });
  }
  return { rows: out, scrollWidth: document.documentElement.scrollWidth, innerWidth };
})()`;

const browser = await chromium.launch();
const report = {};
let bad = 0;
try {
  for (const path of PAGES) {
    for (const width of WIDTHS) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 120000 });
      const m = await page.evaluate(MEASURE);
      const key = `${path} @${width}`;
      const overlapping = m.rows.filter((r) => r.overlaps.length);
      bad += overlapping.length;
      report[key] = m;
      console.log(`${PHASE} ${key}: ${m.rows.length} rows, ${overlapping.length} with an overlap` +
        (overlapping.length ? ` (first: #${overlapping[0].rank} ${overlapping[0].overlaps.join(", ")})` : "") +
        `, scrollWidth ${m.scrollWidth}/${m.innerWidth}`);
      const ol = page.locator(path === "/town/" ? "#quests ol.q-stand" : "ol.q-stand").first();
      const slug = path.replace(/\//g, "-").replace(/^-|-$/g, "") || "home";
      await ol.scrollIntoViewIfNeeded();
      await ol.screenshot({ path: join(OUT, `${PHASE}-${slug}-${width}.png`) });
      await page.close();
    }
  }
} finally {
  await browser.close();
}
writeFileSync(join(OUT, `${PHASE}-rows.json`), JSON.stringify(report, null, 2));
console.log(`${PHASE}: ${bad} overlapping rows in all; shots and ${PHASE}-rows.json in ${OUT}`);
