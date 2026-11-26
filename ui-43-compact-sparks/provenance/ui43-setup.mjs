// ui43-setup.mjs: site-prep `shots --setup` module for UI-43 (the compact unpictured Spark in /sparks/), BEFORE and AFTER with the same module and cache.
//
// PICTURES (Facet 19:00Z): the gallery's pictured cards load their pictures from the public media door. site-prep aborts every off-origin request a module
// does not answer, so this module ANSWERS exactly those GETs: each media.postmark.town URL the register's pictured Sparks name is fulfilled with the bytes an
// anonymous public GET returned before the batch (scratchpad cache-images.mjs; manifest.json records url, status, content type, size, sha256), unchanged, with
// the served content type. Nothing is continued off-origin; any other media request is aborted, as site-prep aborts everything else. Page URLs are not rewritten
// and no image is substituted.
//
// 375px (the ruled phone width; site-prep's own sizes are 390 and 1440): in the 390 context (site-prep's mobile emulation), `after` sets a 375x812 viewport,
// takes the whole frame and the full page itself, then site-prep resets the viewport to 390 and takes its own. The 1440 and 390 frames are site-prep's.
//
// No sign-in, no fixture, no resident act, no write: the data is the build's own (the public register, read anonymously into sparks.json for the local build).
import { readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const CACHE = process.env.UI43_CACHE, OUT = process.env.UI43_OUT;
if (!CACHE || !OUT) throw new Error("ui43-setup: set UI43_CACHE (the image cache) and UI43_OUT (where the 375 frames go)");
const manifest = JSON.parse(readFileSync(join(CACHE, "manifest.json"), "utf8"));
const byUrl = new Map(manifest.images.filter((i) => i.file).map((i) => [i.url, i]));
const TIDEMARK = "tidemark/spark-the-third-try-water-going-up";
const nameOf = (path) => path.replace(/^\/|\/$/g, "").replace(/[^a-z0-9]+/gi, "-") || "home";

/** Before goto: the media door answered from the cache, and only from it. */
export default async function setup({ context }) {
  await context.route(/^https:\/\/media\.postmark\.town\//, (route) => {
    const req = route.request();
    const hit = req.method() === "GET" ? byUrl.get(req.url()) : null;
    if (!hit) { console.log(`UI43-MEDIA aborted (not cached): ${req.method()} ${req.url()}`); return route.abort(); }
    return route.fulfill({ status: 200, contentType: hit.contentType, body: readFileSync(join(CACHE, hit.file)) });
  });
}

/** What the page itself says: the viewport, the pictures' load, and Tidemark's card and its row. */
const facts = (page) => page.evaluate((id) => {
  const imgs = [...document.images].filter((i) => i.closest(".spark-card"));
  const out = { viewport: `${innerWidth}x${innerHeight}`, cardPictures: imgs.length, loaded: imgs.filter((i) => i.complete && i.naturalWidth > 0).length };
  const card = document.querySelector(`[data-spark="${id}"]`);
  if (!card) return out;
  const r = (el) => el.getBoundingClientRect();
  out.tidemark = { compact: card.hasAttribute("data-spark-compact"), height: Math.round(r(card).height),
    has: ["data-spark-recounting", "data-spark-credit", "data-spark-when", "data-spark-rooms", "data-spark-flares", "data-spark-event"].filter((a) => card.querySelector(`[${a}]`)),
    recountingChars: (card.querySelector("[data-spark-recounting]")?.textContent ?? "").length };
  const cell = card.closest("[data-spark-cell]");
  if (cell) {
    const top = Math.round(r(cell).top + scrollY);
    out.row = [...document.querySelectorAll("[data-spark-cell]")].filter((c) => !c.hidden && Math.round(r(c).top + scrollY) === top).map((c) => {
      const k = c.querySelector(".spark-card"), img = k?.querySelector("img");
      return { id: k?.dataset.spark, height: Math.round(r(c).height), pictured: !!img, ...(img ? { picture: Math.round(r(img).height), well: Math.round(r(k.querySelector(".spark-pic")).height - r(img).height) } : {}) };
    });
  }
  return out;
}, TIDEMARK);

/** After goto: wait for the pictures, record, take the 375 frames (390 context only), and bring Tidemark's card into the gallery frame. */
export async function after({ page, path, size }) {
  await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(500);
  const focus = async () => { await page.evaluate((id) => document.querySelector(`[data-spark="${id}"]`)?.closest("[data-spark-cell]")?.scrollIntoView({ block: "center" }), TIDEMARK); await page.waitForTimeout(300); };
  if (size === "390") {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(600);
    await focus();
    console.log("UI43-FACTS " + JSON.stringify({ path, size: "375", ...(await facts(page)) }));
    mkdirSync(OUT, { recursive: true });
    await page.screenshot({ path: join(OUT, `${nameOf(path)}-375.png`) });
    await page.screenshot({ path: join(OUT, `${nameOf(path)}-375-full.png`), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });   // back to site-prep's own phone size before its shots (it resets it too)
    await page.waitForTimeout(600);
  }
  await focus();
  console.log("UI43-FACTS " + JSON.stringify({ path, size, ...(await facts(page)) }));
}
