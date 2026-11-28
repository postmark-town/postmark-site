// render the approved mockup file itself (off-network: its remote fonts and pictures are aborted; layout only) and measure its nav
import { createRequire } from "node:module";
const require = createRequire("/var/lib/site-prep/");
const { chromium } = require("playwright-core");
const [file, out] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: `${process.env.HOME}/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome` });
for (const w of [1440, 375]) {
  const p = await b.newPage({ viewport: { width: w, height: 900 } });
  await p.route(/^https?:/, (r) => r.abort());
  await p.goto("file://" + file);
  console.log(w, JSON.stringify(await p.evaluate(() => { const r = (s) => { const b = document.querySelector(s).getBoundingClientRect(); return [Math.round(b.left), Math.round(b.right)]; };
    return { navWrap: r("header.hero > .wrap"), nav: r("nav"), brand: r(".brand"), links: r(".navlinks"), heroBody: r(".hero-body"), h1: r("h1") }; })));
  await p.screenshot({ path: `${out}-${w}.png` });
}
await b.close();
