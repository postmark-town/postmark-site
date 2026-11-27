// core178-setup.mjs: site-prep `shots --setup` module for the CORE-178 supplement (#491 at 49cee70e against train a69717f0), the same module on both sides.
//
// The same camera as UI-43's (review/ui43/ui43-setup.mjs, published at 81ce90b3): site-prep aborts every off-origin request a module does not answer,
// so the gallery's pictures (the media.postmark.town URLs the register's pictured Sparks name) are answered from a cache of unchanged bytes (UI-43's,
// reused by URL with sha256 re-checked, plus the register's three new pictures read by anonymous GET; manifest.json). Nothing is continued
// off-origin; any other media request is aborted and logged. Page URLs are not rewritten and no image is substituted.
//
// What it does after goto: waits for the pictures, brings the named content into the viewport (Iris's figure on the quay for the two meep views,
// Tidemark's unpictured card on /sparks/), records what the page itself shows (CORE178-FACTS), and on /sparks/ only takes the ruled 375x812
// frame in site-prep's 390 mobile context before handing the viewport back. No sign-in, no fixture, no resident act, no write.
import { readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const CACHE = process.env.CORE178_CACHE, OUT = process.env.CORE178_OUT;
if (!CACHE || !OUT) throw new Error("core178-setup: set CORE178_CACHE (the image cache) and CORE178_OUT (where the 375 frames go)");
const manifest = JSON.parse(readFileSync(join(CACHE, "manifest.json"), "utf8"));
const byUrl = new Map(manifest.images.filter((i) => i.file).map((i) => [i.url, i]));
const TIDEMARK = "tidemark/spark-the-third-try-water-going-up";
const nameOf = (path) => path.replace(/[#?].*$/, "").replace(/^\/|\/$/g, "").replace(/[^a-z0-9]+/gi, "-") + (path.includes("#") ? "-" + path.split("#")[1] : "") || "home";

export default async function setup({ context }) {
  await context.route(/^https:\/\/media\.postmark\.town\//, (route) => {
    const req = route.request();
    const hit = req.method() === "GET" ? byUrl.get(req.url()) : null;
    if (!hit) { console.log(`CORE178-MEDIA aborted (not cached): ${req.method()} ${req.url()}`); return route.abort(); }
    return route.fulfill({ status: 200, contentType: hit.contentType, body: readFileSync(join(CACHE, hit.file)) });
  });
}

/** The named content: Iris's figure (the first visible one) on a meep view, Tidemark's cell on the gallery. */
const focus = (page, path) => page.evaluate(({ path, id }) => {
  const visible = (el) => el && el.offsetParent !== null;
  const el = path.startsWith("/sparks/")
    ? document.querySelector(`[data-spark="${id}"]`)?.closest("[data-spark-cell]")
    : [...document.querySelectorAll('.cq-b[data-meep="illuminator"]')].find(visible);
  if (el) el.scrollIntoView({ block: "center" });
  return Boolean(el);
}, { path, id: TIDEMARK });

/** What the page itself shows for the named content. */
const facts = (page, path) => page.evaluate(({ path, id }) => {
  const out = { viewport: `${innerWidth}x${innerHeight}` };
  const imgs = [...document.images].filter((i) => i.closest(".spark-card"));
  if (path.startsWith("/sparks/")) {
    out.cardPictures = imgs.length; out.loaded = imgs.filter((i) => i.complete && i.naturalWidth > 0).length;
    const card = document.querySelector(`[data-spark="${id}"]`);
    if (card) {
      const credit = card.querySelector("[data-spark-credit]");
      out.tidemark = { compact: card.hasAttribute("data-spark-compact"), height: Math.round(card.getBoundingClientRect().height),
        credit: (credit?.textContent ?? "").replace(/\s+/g, " ").trim(), creditMention: credit ? Boolean(credit.querySelector(".rm")) : null,
        mentionClass: credit?.querySelector(".rm")?.className ?? null };
      const cell = card.closest("[data-spark-cell]"), top = Math.round(cell.getBoundingClientRect().top + scrollY);
      out.row = [...document.querySelectorAll("[data-spark-cell]")].filter((c) => !c.hidden && Math.round(c.getBoundingClientRect().top + scrollY) === top)
        .map((c) => ({ id: c.querySelector(".spark-card")?.dataset.spark, height: Math.round(c.getBoundingClientRect().height), pictured: !!c.querySelector("img") }));
    }
  } else {
    const visible = (el) => el && el.offsetParent !== null;
    out.quay = [...document.querySelectorAll(".cq-b[data-meep]")].filter(visible).map((b) => ({ meep: b.dataset.meep, face: b.dataset.face ?? null,
      sprite: Boolean(b.querySelector("svg")), name: (b.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 60), mention: Boolean(b.querySelector(".rm")) }));
    out.mentionsOnPage = [...document.querySelectorAll(".rm")].filter(visible).length;
  }
  return out;
}, { path, id: TIDEMARK });

/** /bulletin/#meeps draws the quay in an iframe of /meeps/ (the board's framed view): find Iris's figure inside it and scroll the board so the figure
 *  sits mid-viewport; the facts are the frame's own. */
async function bulletinMeeps(page, path, size) {
  await page.waitForFunction(() => [...document.querySelectorAll("iframe")].some((f) => /\/meeps\//.test(f.src) && f.hasAttribute("data-ready")), null, { timeout: 20000 }).catch(() => {});
  const fr = page.frames().find((f) => /\/meeps\/(\?embed)?(#|$)/.test(f.url()));   // the board frames /meeps/?embed (town-views.mjs FRAMED)
  if (!fr) { console.log("CORE178-FACTS " + JSON.stringify({ path, size, found: false, note: "no /meeps/ frame on the board" })); return; }
  await fr.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 20000 }).catch(() => {});
  const y = await fr.evaluate(() => { const el = [...document.querySelectorAll('.cq-b[data-meep="illuminator"]')].find((e) => e.offsetParent !== null); if (!el) return null; const r = el.getBoundingClientRect(); return r.top + r.height / 2; });
  const off = await page.evaluate(() => { const f = [...document.querySelectorAll("iframe")].find((x) => /\/meeps\//.test(x.src)); return f ? f.getBoundingClientRect().top + scrollY : null; });
  if (y !== null && off !== null) await page.evaluate(([o, yy]) => window.scrollTo(0, Math.max(0, o + yy - innerHeight / 2)), [off, y]);
  await page.waitForTimeout(400);
  const inner = await facts(fr, "/meeps/");
  console.log("CORE178-FACTS " + JSON.stringify({ path, size, found: y !== null, frame: fr.url().replace(/^https?:\/\/[^/]+/, ""), viewport: await page.evaluate(() => `${innerWidth}x${innerHeight}`), quay: inner.quay, mentionsInFrame: inner.mentionsOnPage }));
}

export async function after({ page, path, size }) {
  await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(600);
  if (path.startsWith("/bulletin/")) return bulletinMeeps(page, path, size);
  if (size === "390" && path.startsWith("/sparks/")) {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(600);
    const found = await focus(page, path); await page.waitForTimeout(300);
    console.log("CORE178-FACTS " + JSON.stringify({ path, size: "375", found, ...(await facts(page, path)) }));
    mkdirSync(OUT, { recursive: true });
    await page.screenshot({ path: join(OUT, `${nameOf(path)}-375.png`) });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(600);
  }
  const found = await focus(page, path); await page.waitForTimeout(300);
  console.log("CORE178-FACTS " + JSON.stringify({ path, size, found, ...(await facts(page, path)) }));
}
