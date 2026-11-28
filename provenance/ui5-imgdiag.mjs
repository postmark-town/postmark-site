// ui5-imgdiag.mjs — why do the landing's media.postmark.town pictures come out blank in the camera's full frames? The camera's own route
// (fulfil from the cache, abort the rest), the page served from dist, and a log of every media request, response and image state.
//   node ui5-imgdiag.mjs <dist> <cache> [mode: route|live]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, normalize, extname } from "node:path";
const require = createRequire("/var/lib/site-prep/");
const { chromium } = require("playwright-core");
const [DIST, CACHE, MODE = "route"] = process.argv.slice(2);
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".jpg": "image/jpeg", ".png": "image/png", ".json": "application/json", ".svg": "image/svg+xml" };
const server = http.createServer((req, res) => { let f = normalize(join(DIST, decodeURIComponent(req.url.split("?")[0]))); try { if (statSync(f).isDirectory()) f = join(f, "index.html"); } catch {} if (!existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { "content-type": MIME[extname(f)] || "application/octet-stream" }); res.end(readFileSync(f)); });
await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
const manifest = JSON.parse(readFileSync(join(CACHE, "manifest.json"), "utf8"));
const byUrl = new Map(manifest.images.filter((i) => i.file).map((i) => [i.url, i]));
const browser = await chromium.launch({ executablePath: `${process.env.HOME}/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome` });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const log = [];
if (MODE === "route") await ctx.route(/^https:\/\/media\.postmark\.town\//, (route) => {
  const req = route.request(); const hit = byUrl.get(req.url());
  log.push(`ROUTE ${hit ? "fulfil" : "abort"} ${req.url().slice(-30)}`);
  return hit ? route.fulfill({ status: 200, contentType: hit.contentType, body: readFileSync(join(CACHE, hit.file)) }) : route.abort();
});
await ctx.route(/\/api\//, (r) => r.abort());
const page = await ctx.newPage();
page.on("requestfailed", (r) => { if (/media\.postmark/.test(r.url())) log.push(`FAILED ${r.failure()?.errorText} ${r.url().slice(-30)}`); });
page.on("response", (r) => { if (/media\.postmark/.test(r.url())) log.push(`RESP ${r.status()} ${r.headers()["content-type"]} ${r.url().slice(-30)}`); });
page.on("console", (m) => { if (m.type() === "error") log.push(`CONSOLE ${m.text().slice(0, 160)}`); });
await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: "load" });
const state = () => page.evaluate(() => [...document.querySelectorAll(".pm-landing img")].filter((i) => /media\.postmark/.test(i.src)).map((i) => `${i.src.slice(-22)} complete=${i.complete} nw=${i.naturalWidth} lazy=${i.loading}`));
console.log("AT LOAD\n " + (await state()).join("\n "));
const WALK = process.argv[5] ?? "smooth";   // smooth: the first take's walk (plain scrollTo, which the page's smooth scrolling turns into glides); instant: jumps
console.log(`WALK ${WALK}; html scroll-behavior: ${await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)}`);
await page.evaluate(async (walk) => { for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight * 0.8) { walk === "instant" ? window.scrollTo({ top: y, behavior: "instant" }) : scrollTo(0, y); await new Promise((r) => setTimeout(r, 150)); } walk === "instant" ? window.scrollTo({ top: 0, behavior: "instant" }) : scrollTo(0, 0); }, WALK);
await page.waitForTimeout(1500);
console.log("AFTER SCROLL\n " + (await state()).join("\n "));
console.log("LOG\n " + log.join("\n "));
await browser.close(); server.close();
