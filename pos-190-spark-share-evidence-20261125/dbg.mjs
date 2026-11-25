// dbg.mjs: ONE anonymous visit of a public opengraph debugger (opengraph.xyz) on the filed public Spark, a desktop 1440x900 viewport frame of its preview. The only interaction is the
// debugger's own cookie banner ("Deny"), which otherwise covers the preview. Reads a public page; no login, no post, no credential. Uses site-prep's playwright-core and the box's chromium.
// usage: node dbg.mjs <out dir> <url to debug> <log json>
import { createRequire } from "node:module";
import { writeFileSync, mkdirSync } from "node:fs";
const require = createRequire("/var/lib/site-prep/");
const { chromium } = require("playwright-core");
const [OUT, TARGET, LOG] = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const log = { target: TARGET, started: new Date().toISOString(), steps: [] };
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto("https://www.opengraph.xyz/url/" + encodeURIComponent(TARGET), { waitUntil: "networkidle", timeout: 90000 });
  log.steps.push("loaded " + page.url());
  const deny = page.getByRole("button", { name: /^deny$/i });
  if (await deny.count()) { await deny.first().click(); log.steps.push("pressed the debugger's cookie banner Deny"); await page.waitForTimeout(1500); } else log.steps.push("no cookie banner found");
  await page.waitForTimeout(2500);
  // the debugger's own reading of the tags, as text on its page
  log.pageText = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " ").slice(0, 2500));
  await page.screenshot({ path: OUT + "/debugger-viewport-1440x900.png" });
  await page.screenshot({ path: OUT + "/debugger-full-1440.png", fullPage: true });
  await ctx.close();
} finally { await browser.close(); log.ended = new Date().toISOString(); writeFileSync(LOG, JSON.stringify(log, null, 2)); }
