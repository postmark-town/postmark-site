// ui5-setup.mjs: site-prep `shots --setup` module for UI-5's before/after pictures of the front page, the same module on both sides.
//
// The camera of UI-43/CORE-178: site-prep aborts every off-origin request a module does not answer, so the media.postmark.town pictures the page
// can show (the landing's Sparks, the calendar's faces, Regina) are answered from a cache of unchanged bytes read by anonymous GET (UI5_CACHE/
// manifest.json, each sha256 recorded); any other media request is aborted and logged. Nothing is continued off-origin.
//
// Two readers, by path: `/` is a visitor (nobody signed in); `/?signed` is a signed-in reader, an INVENTED sign-in in this browser's own
// storage that the layout's first paint reads (the token is the string "invented-ui5-camera"; every /api/ call, GET /me included, is aborted by
// site-prep, so no office ever sees it). After goto: wait for the pictures, record what the page shows (UI5-FACTS), and at site-prep's 390
// context also take the ruled 375x812 frame and its full page (UI5_OUT) before handing the viewport back. No resident act, no write.
import { readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const CACHE = process.env.UI5_CACHE, OUT = process.env.UI5_OUT;
if (!CACHE || !OUT) throw new Error("ui5-setup: set UI5_CACHE (the picture cache) and UI5_OUT (where the 375 frames go)");
const manifest = JSON.parse(readFileSync(join(CACHE, "manifest.json"), "utf8"));
const byUrl = new Map(manifest.images.filter((i) => i.file).map((i) => [i.url, i]));
const signed = (path) => /[?&]signed\b/.test(path);
const nameOf = (path) => (signed(path) ? "root-signed" : "root-visitor");

export default async function setup({ context, path }) {
  await context.route(/^https:\/\/media\.postmark\.town\//, (route) => {
    const req = route.request();
    const hit = req.method() === "GET" ? byUrl.get(req.url()) : null;
    if (!hit) { console.log(`UI5-MEDIA aborted (not cached): ${req.method()} ${req.url()}`); return route.abort(); }
    return route.fulfill({ status: 200, contentType: hit.contentType, body: readFileSync(join(CACHE, hit.file)) });
  });
  if (signed(path)) await context.addInitScript(() => {
    localStorage.setItem("pm.oauth.token", JSON.stringify({ access_token: "invented-ui5-camera", obtained: Date.now(), expires_in: 3600 }));
    sessionStorage.setItem("pm.oauth.handles", JSON.stringify(["wright"]));
  });
}

const facts = (page) => page.evaluate(() => {
  const shown = (s) => { const e = document.querySelector(s); return !!e && getComputedStyle(e).display !== "none" && e.getClientRects().length > 0; };
  const land = document.querySelector(".pm-landing");
  return {
    viewport: `${innerWidth}x${innerHeight}`, lens: document.documentElement.getAttribute("data-lens"), sideways: document.documentElement.scrollWidth > innerWidth,
    landing: land ? shown(".pm-landing") : "absent", resident: shown(".pm-index"),
    hero: (document.querySelector("[data-hero-title]")?.textContent ?? "").trim() || null,
    examples: land ? [...land.querySelectorAll("[data-example]")].map((e) => e.dataset.example) : [],
    placeholders: land ? [...land.querySelectorAll("[data-placeholder]")].map((e) => e.dataset.placeholder) : [],
    pictures: [...document.images].filter((i) => i.getClientRects().length && i.loading !== "lazy").length,
    broken: [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && i.getClientRects().length).map((i) => i.src).slice(0, 8),
  };
});

/** Every picture loaded: lazy ones are brought in by scrolling the page through once, then back to the top. */
async function settle(page) {
  await page.evaluate(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight * 0.8) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); } scrollTo(0, 0); });
  await page.waitForFunction(() => [...document.images].filter((i) => i.getClientRects().length).every((i) => i.complete), null, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(600);
}

export async function after({ page, path, size }) {
  if (signed(path)) await page.waitForFunction(() => (document.querySelector("[data-hero-title]")?.textContent ?? "").trim() === "Welcome back,", null, { timeout: 15000 }).catch(() => {});
  await settle(page);
  if (size === "390") {
    await page.setViewportSize({ width: 375, height: 812 });
    await settle(page);
    console.log("UI5-FACTS " + JSON.stringify({ path, size: "375", ...(await facts(page)) }));
    mkdirSync(OUT, { recursive: true });
    await page.screenshot({ path: join(OUT, `${nameOf(path)}-375.png`) });
    await page.screenshot({ path: join(OUT, `${nameOf(path)}-375-full.png`), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await settle(page);
  }
  console.log("UI5-FACTS " + JSON.stringify({ path, size, ...(await facts(page)) }));
}
