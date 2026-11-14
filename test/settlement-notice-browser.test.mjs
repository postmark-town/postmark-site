// settlement-notice-browser.test.mjs — the late-settlement notice, RENDERED in a real browser on the real built pages (POS-1004).
//
//   node --test test/settlement-notice-browser.test.mjs
//
// WHAT THIS PROVES that test/settlement-notice.test.mjs (the component's script against the real reader, in a vm) cannot: that
// the BUILT World page carries the notice in the right seat, that it renders the exact words, that it appears under a forced
// fresh `settlement` DOWN board and nowhere else, that it clears WITHOUT A RELOAD when the board goes OK, and that it fits a
// phone-width view without overlapping a control or widening the page. And, for the front page (Darko, 2026-11-12 09:06 EST:
// "1004 should just be lumped into the red exclamation point that already exists on the main site. world page version is fine"):
// that it has NO line of its own, and that the same forced DOWN lights the header's existing red mark, whose popover says the
// plain words, and that OK clears the mark without a reload.
//
// HOW: it serves the built site (dist-town/, the same one `npm run build` makes; the built-pages CI job builds it first) from a
// tiny static server, drives headless Chrome over CDP (Node's global WebSocket; a throwaway profile, no sync, no extensions),
// and answers GET /ops/sentinel.json itself through CDP's Fetch domain with a FORCED payload that this test changes between
// steps. Board data is forced here and nowhere else: the live sentinel is never touched. Set SETTLEMENT_NOTICE_BASE_URL to
// point it at a running dev server instead of dist-town (the same forced payloads apply).
//
// WITHOUT dist-town AND without a base url the test SKIPS and says so (a plain `npm test` has no build). WITH built pages and
// no browser it FAILS, so that the built-pages job cannot turn a skip into a pass.

import test from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import http from "node:http";
import { homedir, tmpdir } from "node:os";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DIST = join(ROOT, "dist-town");
const BASE_URL = process.env.SETTLEMENT_NOTICE_BASE_URL || null;
const WORDS = "The latest World settlement is running late. It will show here as soon as it's published.";
const GLYPH_WORDS = "The latest World settlement is running late. It will show as soon as it's published.";   // the header mark's row (no "here": it is never on the World page)

const MAYBE_WORDS = "The latest World settlement may be running late. It will show as soon as it's published.";   // the same row when the board cannot call it late (STALE, an old board)

const builtPages =existsSync(join(DIST, "index.html")) && existsSync(join(DIST, "world", "index.html"));
const SKIP = BASE_URL || builtPages ? false : "no built pages (dist-town/) and no SETTLEMENT_NOTICE_BASE_URL: nothing to render";

function findChrome() {
  const named = [process.env.CHROME_BIN, ...["google-chrome-stable", "google-chrome", "chromium", "chromium-browser"].map((n) => {
    const r = spawnSync("sh", ["-c", `command -v ${n}`], { encoding: "utf8" });
    return r.status === 0 ? r.stdout.trim() : null;
  })].filter(Boolean);
  if (named.length) return named[0];
  try {
    const cache = join(homedir(), ".cache", "ms-playwright");
    for (const d of readdirSync(cache).filter((n) => n.startsWith("chromium-")).sort().reverse()) {
      const bin = join(cache, d, "chrome-linux64", "chrome");
      if (existsSync(bin)) return bin;
    }
  } catch { /* none */ }
  return null;
}

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2", ".txt": "text/plain" };
// OPTIONAL: SETTLEMENT_NOTICE_WORLD_DIR names a read-only checkout's tree that holds `spectator/` (and `tools/`), e.g. an export of
// postmark-world's settlement/S165. Its files are served over /world-engine/spectator/** and /world-engine/tools/**, so the World page
// renders the viewer that carries POS-1006's "In town by mail" button, which the package pin alone does not (POS-1004 round 2).
// Unset (CI), the built page's own viewer is what is rendered. Nothing is written there and nothing in it is copied into the repo.
const WORLD_DIR = process.env.SETTLEMENT_NOTICE_WORLD_DIR || null;
function serveDist() {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent((req.url || "/").split("?")[0]);
    let file = normalize(join(DIST, p));
    if (!file.startsWith(DIST + sep) && file !== DIST) { res.writeHead(403); return res.end(); }
    if (WORLD_DIR && /^\/world-engine\/(spectator|tools)\//.test(p)) {
      const over = normalize(join(WORLD_DIR, p.replace("/world-engine/", "")));
      if (over.startsWith(normalize(WORLD_DIR) + sep) && existsSync(over) && statSync(over).isFile()) { res.writeHead(200, { "content-type": MIME[extname(over)] || "application/octet-stream" }); return res.end(readFileSync(over)); }
    }
    try { if (statSync(file).isDirectory()) file = join(file, "index.html"); } catch { /* maybe a file */ }
    if (!existsSync(file)) { res.writeHead(404, { "content-type": "text/plain" }); return res.end("not found"); }
    res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream" });
    res.end(readFileSync(file));
  });
  return new Promise((ok) => server.listen(0, "127.0.0.1", () => ok(server)));
}

// ── a minimal, bounded CDP client ─────────────────────────────────────────────────────────────────────────────────────

async function launch(chrome) {
  const profile = mkdtempSync(join(tmpdir(), "pos1004-profile-"));
  // DETACHED, so the whole browser (its renderer, GPU and zygote helpers too) is one process group that `close` kills as one: a
  // helper that outlived the main process would keep its inherited stderr pipe open and hold this test process's event loop (and
  // so the whole `node --test` run) open for ever. The first CI run of this file hung exactly there.
  const child = spawn(chrome, ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-sync", "--disable-extensions", "--hide-scrollbars",
    "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { stdio: ["ignore", "ignore", "pipe"], detached: true });
  child.unref();
  const wsUrl = await new Promise((ok, no) => {
    let buf = "";
    const t = setTimeout(() => no(new Error("no DevTools url within 20 s")), 20_000);
    child.stderr.on("data", (d) => { buf += d; const m = /DevTools listening on (ws:\/\/\S+)/.exec(buf); if (m) { clearTimeout(t); ok(m[1]); } });
    child.on("exit", (c) => no(new Error(`the browser exited early (${c})`)));
  });
  const ws = new WebSocket(wsUrl);
  await new Promise((ok, no) => { ws.onopen = ok; ws.onerror = no; });
  let id = 0;
  const pending = new Map(), listeners = [];
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } else listeners.forEach((l) => l(m));
  };
  const send = (method, params = {}, sessionId) => new Promise((ok, no) => {
    const i = ++id;
    pending.set(i, (m) => (m.error ? no(new Error(`${method}: ${m.error.message}`)) : ok(m.result)));
    ws.send(JSON.stringify({ id: i, method, params, ...(sessionId ? { sessionId } : {}) }));
    setTimeout(() => { if (pending.delete(i)) no(new Error(`${method}: no answer in 30 s`)); }, 30_000);
  });
  return {
    send, listeners,
    close: () => {
      try { ws.close(); } catch { /* gone */ }
      try { process.kill(-child.pid, "SIGKILL"); } catch { try { child.kill("SIGKILL"); } catch { /* gone */ } }   // the whole group
      try { child.stderr.destroy(); } catch { /* gone */ }
      rmSync(profile, { recursive: true, force: true });
    },
  };
}

async function openPage(b, base, path, { width, height = 900, board, walkers = null, touch = false }) {
  const { targetId } = await b.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await b.send("Target.attachToTarget", { targetId, flatten: true });
  const S = (m, p) => b.send(m, p, sessionId);
  await S("Page.enable");
  await S("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 600 });
  if (touch) await S("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });   // touch EMULATION: real input events, not a phone (CORE-41)
  // THE FORCED BOARD: this test answers /ops/sentinel.json. `board.body()` is read at request time, so a step can change it.
  // `walkers` (invented handles, no position) is answered for the viewer's by-mail list, so the button has names to show.
  await S("Fetch.enable", { patterns: [{ urlPattern: "*/ops/sentinel.json*", requestStage: "Request" }, ...(walkers ? [{ urlPattern: "*/api/*", requestStage: "Request" }] : [])] });
  const listener = (m) => {
    if (m.sessionId !== sessionId || m.method !== "Fetch.requestPaused") return;
    const { requestId } = m.params;
    const asked = m.params.request?.url ?? "";
    if (/\/api\//.test(asked)) {     // the viewer's office reads: the walkers get the invented list, anything else a JSON "none", as an office would say it
      const walkersRead = /\/api\/world\/walkers/.test(asked);
      const answer = walkersRead ? { at: Date.now(), walkers: walkers.map((handle) => ({ handle, placeholder: true })), standing: [] } : { error: "none" };
      S("Fetch.fulfillRequest", { requestId, responseCode: walkersRead ? 200 : 404, responseHeaders: [{ name: "content-type", value: "application/json" }, { name: "access-control-allow-origin", value: "*" }], body: Buffer.from(JSON.stringify(answer)).toString("base64") }).catch(() => {});
      return;
    }
    const body = board.body();
    if (body === null) S("Fetch.fulfillRequest", { requestId, responseCode: 404, responseHeaders: [{ name: "content-type", value: "text/plain" }], body: Buffer.from("no board").toString("base64") }).catch(() => {});
    else S("Fetch.fulfillRequest", { requestId, responseCode: 200, responseHeaders: [{ name: "content-type", value: "application/json" }, { name: "cache-control", value: "no-cache" }], body: Buffer.from(body).toString("base64") }).catch(() => {});
    board.reads += 1;
  };
  b.listeners.push(listener);
  await S("Page.navigate", { url: base + path });
  const evalJs = async (expression) => {
    const r = await S("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(`page threw: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
    return r.result.value;
  };
  const until = async (predicateJs, what, ms = 15_000) => {
    for (const t0 = Date.now(); Date.now() - t0 < ms;) { if (await evalJs(predicateJs)) return; await new Promise((ok) => setTimeout(ok, 100)); }
    throw new Error(`timed out waiting for ${what}`);
  };
  // REAL INPUT at a point, through the browser's own input pipeline (CORE-41): a touch tap (touchStart, touchEnd: the browser makes the
  // focus and the click itself) or a coordinate mouse click. `centre` is an element's middle, so a tap lands where a finger would.
  const centre = async (selector) => {
    const c = await evalJs(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    return c;
  };
  const tapAt = async (x, y) => {
    await S("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
    await S("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await new Promise((ok) => setTimeout(ok, 350));   // the whole gesture, the synthesised click and any handler it wakes
  };
  const clickAt = async (x, y) => {
    await S("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
    await S("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
    await S("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
    await new Promise((ok) => setTimeout(ok, 350));
  };
  const key = async (k, code) => {
    await S("Input.dispatchKeyEvent", { type: "keyDown", key: k, code, windowsVirtualKeyCode: k === "Escape" ? 27 : 9 });
    await S("Input.dispatchKeyEvent", { type: "keyUp", key: k, code, windowsVirtualKeyCode: k === "Escape" ? 27 : 9 });
    await new Promise((ok) => setTimeout(ok, 250));
  };
  return { evalJs, until, send: S, centre, tapAt, clickAt, key, close: async () => { b.listeners.splice(b.listeners.indexOf(listener), 1); await b.send("Target.closeTarget", { targetId }).catch(() => {}); } };
}

const state = { bodyFn: () => null, reads: 0 };
const fresh = (settlement, { ageMin = 2, extra = [] } = {}) => () => JSON.stringify({
  schema: 1, generated_at: new Date(Date.now() - ageMin * 60_000).toISOString(),
  probes: [{ key: "site_home", verdict: "OK" }, ...(settlement ? [{ key: "settlement", label: "the settlement", verdict: settlement, reason: "forced by the test" }] : []), ...extra],
});
const board = { body: () => state.bodyFn(), get reads() { return state.reads; }, set reads(v) { state.reads = v; } };

const NOTICE = `(() => { const e = document.querySelector("[data-settlement-notice]"); if (!e) return null; const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return { hiddenAttr: e.hidden, shown: !e.hidden && cs.display !== "none" && cs.visibility !== "hidden" && r.width > 0 && r.height > 0, text: e.textContent.trim().replace(/\\s+/g, " "), rect: { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height } }; })()`;
// THE HEADER'S RED MARK (src/layouts/PostmarkLayout.astro, the sentinel's glyph since 2026-09-17): shown, open, its colour at rest, and its popover's rows.
const GLYPH = `(() => { const w = document.querySelector("[data-pm-alert]"); if (!w) return null; const g = w.querySelector("[data-pm-alert-glyph]"), pop = w.querySelector("[data-pm-alert-pop]"); const r = g.getBoundingClientRect(), pr = pop.getBoundingClientRect(); return { shown: !w.hidden && getComputedStyle(w).display !== "none" && r.width > 0 && r.height > 0, open: !pop.hidden && pr.width > 0, color: getComputedStyle(g).color, rows: [...w.querySelectorAll(".pm-alert-row")].map((li) => li.textContent.replace(/\\s+/g, " ").trim()), pop: { left: pr.left, right: pr.right, top: pr.top, bottom: pr.bottom } }; })()`;

let chrome = null, server = null, browser = null, base = null;
async function boot() {
  if (browser) return;
  chrome = findChrome();
  assert.ok(chrome, "built pages (or a base url) exist but no Chrome/Chromium was found: set CHROME_BIN. (This fails rather than skips: a skipped render is not a passed one.)");
  if (BASE_URL) base = BASE_URL.replace(/\/+$/, "");
  else { server = await serveDist(); base = `http://127.0.0.1:${server.address().port}`; }
  browser = await launch(chrome);
}
// Teardown that cannot hang the run: kill the browser group, drop every connection, and give the server's close a bound.
test.after(async () => {
  browser?.close();
  if (server) {
    server.closeAllConnections?.();
    await Promise.race([new Promise((ok) => server.close(ok)), new Promise((ok) => setTimeout(ok, 3000).unref())]);
  }
});

// Until 2026-11-12 the front page was a second entry here, with its own notice line. It is now read through the header's red
// mark (the front-page tests after this loop).
const PAGES = [["the World page", "/world/"]];

for (const [name, path] of PAGES) {
  test(`${name}: hidden in the built markup, then a forced fresh settlement DOWN shows the exact words, and OK clears it WITHOUT A RELOAD`, { skip: SKIP, timeout: 120_000 }, async () => {
    await boot();
    state.bodyFn = fresh("DOWN");
    const p = await openPage(browser, base, path, { width: 1280, board });
    try {
      await p.until(`document.querySelector("[data-settlement-notice]") !== null`, "the notice's markup in the built page");
      await p.until(`(${NOTICE})?.shown === true`, "the notice to show under a forced DOWN board");
      const shown = await p.evalJs(NOTICE);
      assert.equal(shown.text.replace(/^!\s*/, ""), WORDS, "the exact words (after the small ! mark)");
      assert.equal((await p.evalJs(`document.querySelectorAll("[data-settlement-notice]").length`)), 1, "one notice on the page");
      // clear without a reload: mark the document, flip the board to OK, return to the page, and wait
      await p.evalJs(`window.__noReload = "still here"; true`);
      const readsBefore = board.reads;
      state.bodyFn = fresh("OK");
      await p.evalJs(`document.dispatchEvent(new Event("visibilitychange")); window.dispatchEvent(new Event("pageshow")); true`);
      await p.until(`(${NOTICE})?.shown === false`, "the notice to clear after the board reads OK");
      assert.equal(await p.evalJs(`window.__noReload`), "still here", "the same document: it cleared without a reload");
      assert.ok(board.reads > readsBefore, "by reading the board again");
      assert.equal((await p.evalJs(NOTICE)).hiddenAttr, true);
    } finally { await p.close(); }
  });

  test(`${name}: CONTROLS, nothing shows for OK, STALE, UNKNOWN, INFO, no settlement probe, an old board, another probe's DOWN, a 404 or garbage`, { skip: SKIP, timeout: 120_000 }, async () => {
    await boot();
    const controls = [
      ["OK", fresh("OK")], ["STALE", fresh("STALE")], ["UNKNOWN", fresh("UNKNOWN")], ["INFO", fresh("INFO")], ["no settlement probe", fresh(null)],
      ["a 25-minute-old DOWN", fresh("DOWN", { ageMin: 25 })], ["another probe's DOWN", fresh("OK", { extra: [{ key: "site_refresh", verdict: "DOWN" }, { key: "settlement_tag", verdict: "DOWN" }] })],
      ["no board (404)", () => null], ["garbage", () => "<html>not a board"],
    ];
    for (const [label, bodyFn] of controls) {
      state.bodyFn = bodyFn;
      const reads0 = board.reads;
      const p = await openPage(browser, base, path, { width: 1280, board });
      try {
        await p.until(`document.querySelector("[data-settlement-notice]") !== null`, "the notice's markup");
        await p.until(`true`, "settle");
        for (const t0 = Date.now(); board.reads === reads0 && Date.now() - t0 < 10_000;) await new Promise((ok) => setTimeout(ok, 100));
        assert.ok(board.reads > reads0, `${label}: the page asked for the board`);
        await new Promise((ok) => setTimeout(ok, 600));                 // let the answer be applied
        const n = await p.evalJs(NOTICE);
        assert.equal(n.shown, false, `${label}: nothing shows`);
        assert.equal(n.hiddenAttr, true, `${label}: still hidden by the markup's own attribute`);
      } finally { await p.close(); }
    }
  });

  test(`${name}: at PHONE width (390 px) the notice fits the view, overlaps no control and does not widen the page`, { skip: SKIP, timeout: 120_000 }, async () => {
    await boot();
    // the baseline: the same page, no notice, at 390 px
    state.bodyFn = fresh("OK");
    const base0 = await openPage(browser, base, path, { width: 390, board });
    let baseWidth;
    try { await base0.until(`document.querySelector("[data-settlement-notice]") !== null`, "markup"); await new Promise((ok) => setTimeout(ok, 800)); baseWidth = await base0.evalJs(`document.documentElement.scrollWidth`); } finally { await base0.close(); }
    state.bodyFn = fresh("DOWN");
    const p = await openPage(browser, base, path, { width: 390, board });
    try {
      await p.until(`(${NOTICE})?.shown === true`, "the notice to show at 390 px");
      const n = await p.evalJs(NOTICE);
      assert.ok(n.rect.left >= 0 && n.rect.right <= 390, `inside the 390 px view (left ${n.rect.left}, right ${n.rect.right})`);
      assert.equal(n.text.replace(/^!\s*/, ""), WORDS, "the same words on a phone");
      assert.ok(n.rect.height < 140, `a small notice, not a banner (${Math.round(n.rect.height)} px tall)`);
      assert.ok(await p.evalJs(`document.documentElement.scrollWidth`) <= Math.max(baseWidth, 390), "the notice did not widen the page");
      // no overlap with any control: the layout's links/buttons (front) or the World's own top controls cluster (World)
      const hit = await p.evalJs(`(() => { const n = document.querySelector("[data-settlement-notice]").getBoundingClientRect();
        const sel = "a[href], button, input, select, summary, [role=button], #pm-world-auth";
        const over = [...document.querySelectorAll(sel)].filter((e) => { if (e.closest("[data-settlement-notice]") || e.closest("svg")) return false; /* the map's own marks are the VIEW the floating notice lies over, and it takes no clicks */ const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
          if (r.width === 0 || r.height === 0 || cs.visibility === "hidden" || cs.display === "none" || e.hidden) return false;
          return r.left < n.right && r.right > n.left && r.top < n.bottom && r.bottom > n.top; });
        return over.map((e) => { const r = e.getBoundingClientRect(); return (e.id || e.className || e.tagName).toString().slice(0, 40) + " [" + [r.left, r.top, r.right, r.bottom].map(Math.round).join(",") + "] vs notice [" + [n.left, n.top, n.right, n.bottom].map(Math.round).join(",") + "]"; }); })()`);
      assert.deepEqual(hit.filter((h) => !/^$/.test(h)), [], "the floating notice sits clear of the World's top controls");
    } finally { await p.close(); }
  });
}

// ── THE RED MARK ON A PHONE TAP (CORE-41) ────────────────────────────────────────────────────────────────────────────────────────
// Wright, 2026-11-14: "On a phone, tapping the site's red '!' mark opens it and keeps it open until it's dismissed, so its words can
// be read." The oracle is a REAL tap through the browser's input pipeline (Input.dispatchTouchEvent on a touch-emulating 390 px view:
// the browser raises the focus, then the click, itself), never element.click(), which skips focus and so skipped the bug. Touch
// EMULATION is not a phone: no test here is a physical-phone pass.
const OPEN = `(${GLYPH})?.open === true`, SHUT = `(${GLYPH})?.open === false`;
const outsidePoint = `(() => { const pt = [[200, 700], [60, 600], [300, 500], [195, 850]].find(([x, y]) => { const e = document.elementFromPoint(x, y); return e && !e.closest("[data-pm-alert]") && !e.closest("a[href], button, input, summary"); }); return pt ? { x: pt[0], y: pt[1] } : null; })()`;

test("a PHONE TAP (390 px, touch, a real tap) on the red mark opens its popover and LEAVES IT OPEN with the words readable; the next tap, or a tap outside, shuts it", { skip: SKIP, timeout: 120_000 }, async () => {
  await boot();
  state.bodyFn = fresh("DOWN");
  const p = await openPage(browser, base, "/", { width: 390, board, touch: true });
  try {
    await p.until(`(${GLYPH})?.shown === true`, "the red mark at 390 px");
    assert.equal(await p.evalJs(`navigator.maxTouchPoints > 0 && matchMedia("(pointer: coarse)").matches`), true, "the view is touch-emulating (a coarse pointer), so the tap below is a touch");
    const g0 = await p.centre("[data-pm-alert-glyph]");
    // 1. one tap opens, and it is STILL open a second later (at base the tap's focus opened it and its click shut it in the same gesture)
    await p.tapAt(g0.x, g0.y);
    await new Promise((ok) => setTimeout(ok, 800));
    assert.equal((await p.evalJs(GLYPH)).open, true, "one real tap opens the popover and it stays open");
    const g = await p.evalJs(GLYPH);
    assert.ok(g.rows.some((r) => r.endsWith(GLYPH_WORDS)), `its words are there to read (${JSON.stringify(g.rows)})`);
    assert.ok(g.pop.left >= 0 && g.pop.right <= 390, `and inside the 390 px view (left ${g.pop.left}, right ${g.pop.right})`);
    assert.equal(await p.evalJs(`document.querySelector("[data-pm-alert-glyph]").getAttribute("aria-expanded")`), "true");
    // a tap INSIDE the popover (to read, or to select its words) keeps it open
    const row = await p.centre(".pm-alert-row");
    await p.tapAt(row.x, row.y);
    assert.equal((await p.evalJs(GLYPH)).open, true, "a tap on its own words does not close it");
    // 2. the next tap on the mark closes it: a later deliberate tap is NOT swallowed
    await p.tapAt(g0.x, g0.y);
    assert.equal((await p.evalJs(GLYPH)).open, false, "the next tap on the mark shuts it");
    assert.equal(await p.evalJs(`document.querySelector("[data-pm-alert-glyph]").getAttribute("aria-expanded")`), "false");
    // ... and the one after that opens it again, so every tap does what it says
    await p.tapAt(g0.x, g0.y);
    assert.equal((await p.evalJs(GLYPH)).open, true, "a third tap opens it again");
    // 3. a tap outside shuts it
    const out = await p.evalJs(outsidePoint);
    assert.ok(out, "found a plain point outside the mark and the popover");
    await p.tapAt(out.x, out.y);
    assert.equal((await p.evalJs(GLYPH)).open, false, "a tap outside dismisses it");
    // and a tap on the mark after an outside dismissal opens it first time (no swallowed tap)
    await p.tapAt(g0.x, g0.y);
    assert.equal((await p.evalJs(GLYPH)).open, true, "and the next tap on the mark opens it, none swallowed");
  } finally { await p.close(); }
});

test("KEYBOARD and DESKTOP MOUSE are unchanged: Tab to the mark opens it, Escape shuts it; hovering opens it and leaving shuts it; a click is a toggle", { skip: SKIP, timeout: 120_000 }, async () => {
  await boot();
  state.bodyFn = fresh("DOWN");
  const p = await openPage(browser, base, "/", { width: 1280, board });
  try {
    await p.until(`(${GLYPH})?.shown === true`, "the red mark at 1280 px");
    // keyboard: real Tab presses until the mark has focus
    for (let i = 0; i < 40 && !(await p.evalJs(`document.activeElement === document.querySelector("[data-pm-alert-glyph]")`)); i += 1) await p.key("Tab", "Tab");
    assert.equal(await p.evalJs(`document.activeElement === document.querySelector("[data-pm-alert-glyph]")`), true, "Tab reached the mark");
    assert.equal((await p.evalJs(GLYPH)).open, true, "keyboard focus opens the popover");
    await p.key("Escape", "Escape");
    assert.equal((await p.evalJs(GLYPH)).open, false, "Escape shuts it");
    await p.evalJs(`document.activeElement && document.activeElement.blur(); true`);
    // mouse: hover opens, leaving shuts
    const c = await p.centre("[data-pm-alert-glyph]");
    await p.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: c.x, y: c.y });
    await p.until(OPEN, "the popover to open on hover");
    await p.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 640, y: 700 });
    await p.until(SHUT, "the popover to shut when the pointer leaves");
    // mouse click: a toggle, as on base (hover opened it, so the click shuts it; a second click opens it)
    await p.clickAt(c.x, c.y);
    const afterFirst = (await p.evalJs(GLYPH)).open;
    await p.clickAt(c.x, c.y);
    assert.notEqual((await p.evalJs(GLYPH)).open, afterFirst, "two real clicks leave the popover in opposite states: a click toggles");
  } finally { await p.close(); }
});

// ── THE FRONT PAGE: no line of its own; a late settlement is the header's red mark (Darko, 2026-11-12 09:06 EST) ─────────────
// Until 2026-11-12 these asserted a notice line below the live ticker and above the hero, that never stepped aside for the World's lists.

test("the front page: NO line of its own; a forced fresh settlement DOWN lights the header's red mark, its popover says the plain words, and OK clears it WITHOUT A RELOAD", { skip: SKIP, timeout: 120_000 }, async () => {
  await boot();
  state.bodyFn = fresh("DOWN");
  const p = await openPage(browser, base, "/", { width: 1280, board });
  try {
    await p.until(`(${GLYPH})?.shown === true`, "the header's red mark to light under a forced settlement DOWN");
    assert.equal(await p.evalJs(`document.querySelectorAll("[data-settlement-notice]").length`), 0,
      "Darko 2026-11-12 09:06 EST: \"1004 should just be lumped into the red exclamation point that already exists on the main site\": the front page grows no notice line of its own");
    const rest = await p.evalJs(GLYPH);
    assert.equal(rest.color, "rgb(224, 132, 107)", "it is the existing red mark, its look unchanged (#e0846b)");
    assert.equal(rest.open, false, "closed until a reader hovers, focuses or taps it");
    await p.evalJs(`document.querySelector("[data-pm-alert-glyph]").click(); true`);
    await p.until(`(${GLYPH})?.open === true`, "its popover to open on a click (element.click(), which does not focus; a real tap's focusin opens it and its click shuts it, as on the train base before this PR)");
    const g = await p.evalJs(GLYPH);
    assert.equal(g.rows.length, 1, `one row, the settlement's (${JSON.stringify(g.rows)})`);
    assert.ok(g.rows[0].endsWith("the settlement — " + GLYPH_WORDS), `the row says the plain words (${g.rows[0]})`);
    assert.ok(!g.rows[0].includes("forced by the test"), "and not the sentinel's own reason");
    // clear without a reload: mark the document, flip the board to OK, return to the page, and wait
    await p.evalJs(`window.__noReload = "still here"; true`);
    const readsBefore = board.reads;
    state.bodyFn = fresh("OK");
    await p.evalJs(`document.dispatchEvent(new Event("visibilitychange")); window.dispatchEvent(new Event("pageshow")); true`);
    await p.until(`(${GLYPH})?.shown === false`, "the red mark to clear after the board reads OK");
    assert.equal(await p.evalJs(`window.__noReload`), "still here", "the same document: it cleared without a reload");
    assert.ok(board.reads > readsBefore, "by reading the board again");
    assert.equal(await p.evalJs(`document.querySelectorAll("[data-settlement-notice]").length`), 0, "and no notice line appeared on the way");
  } finally { await p.close(); }
});

test("the front page: CONTROLS, the plain words appear for a fresh settlement DOWN only; OK shows no mark; STALE, an old board and another probe's DOWN keep the mark's own words", { skip: SKIP, timeout: 120_000 }, async () => {
  await boot();
  const controls = [
    ["OK", fresh("OK"), false], ["STALE", fresh("STALE"), true], ["a 25-minute-old DOWN", fresh("DOWN", { ageMin: 25 }), true],
    ["another probe's DOWN", fresh("OK", { extra: [{ key: "settlement_tag", label: "the settlement tag", verdict: "DOWN", reason: "forced by the test" }] }), true],
  ];
  for (const [label, bodyFn, lit] of controls) {
    state.bodyFn = bodyFn;
    const reads0 = board.reads;
    const p = await openPage(browser, base, "/", { width: 1280, board });
    try {
      for (const t0 = Date.now(); board.reads === reads0 && Date.now() - t0 < 10_000;) await new Promise((ok) => setTimeout(ok, 100));
      assert.ok(board.reads > reads0, `${label}: the page asked for the board`);
      if (lit) await p.until(`(${GLYPH})?.shown === true`, `${label}: the mark (the sentinel's own judgment, unchanged)`);
      else await new Promise((ok) => setTimeout(ok, 600));
      const g = await p.evalJs(GLYPH);
      assert.equal(g.shown, lit, `${label}: the mark ${lit ? "shows" : "does not show"}`);
      assert.ok(!g.rows.some((r) => r.includes(GLYPH_WORDS)), `${label}: no plain settlement line (${JSON.stringify(g.rows)})`);
      // CORE-41: a bad settlement the board cannot call late is still said in plain words ("may be"), never the sentinel's reason
      if (label === "STALE" || label === "a 25-minute-old DOWN") {
        assert.ok(g.rows.some((r) => r.endsWith("the settlement — " + MAYBE_WORDS)), `${label}: the hedged plain line (${JSON.stringify(g.rows)})`);
        assert.ok(!g.rows.some((r) => r.includes("forced by the test")), `${label}: the probe's own reason is not shown`);
      }
      assert.equal(await p.evalJs(`document.querySelectorAll("[data-settlement-notice]").length`), 0, `${label}: no notice line`);
    } finally { await p.close(); }
  }
});

test("the front page at PHONE width (390 px): the red mark's open popover with the plain words fits the view and does not widen the page", { skip: SKIP, timeout: 120_000 }, async () => {
  await boot();
  state.bodyFn = fresh("OK");
  const base0 = await openPage(browser, base, "/", { width: 390, board });
  let baseWidth;
  try { await new Promise((ok) => setTimeout(ok, 1500)); baseWidth = await base0.evalJs(`document.documentElement.scrollWidth`); } finally { await base0.close(); }
  state.bodyFn = fresh("DOWN");
  const p = await openPage(browser, base, "/", { width: 390, board });
  try {
    await p.until(`(${GLYPH})?.shown === true`, "the red mark at 390 px");
    await p.evalJs(`document.querySelector("[data-pm-alert-glyph]").click(); true`);
    await p.until(`(${GLYPH})?.open === true`, "its popover to open on a click (element.click(), which does not focus)");
    const g = await p.evalJs(GLYPH);
    assert.ok(g.rows.some((r) => r.endsWith(GLYPH_WORDS)), "the same words on a phone");
    assert.ok(g.pop.left >= 0 && g.pop.right <= 390, `the popover is inside the 390 px view (left ${g.pop.left}, right ${g.pop.right})`);
    assert.ok(await p.evalJs(`document.documentElement.scrollWidth`) <= Math.max(baseWidth, 390), "the mark did not widen the page");
    assert.equal(await p.evalJs(`document.querySelectorAll("[data-settlement-notice]").length`), 0, "no notice line on a phone either");
  } finally { await p.close(); }
});

test("the World page: the floating notice is fixed, takes no clicks, and sits under the painting's top controls (right-aligned over the painting in the app frame)", { skip: SKIP, timeout: 120_000 }, async () => {
  await boot();
  state.bodyFn = fresh("DOWN");
  const p = await openPage(browser, base, "/world/", { width: 1280, board });
  try {
    await p.until(`(${NOTICE})?.shown === true`, "the notice");
    const g = await p.evalJs(`(() => { const e = document.querySelector("[data-settlement-notice]"), r = e.getBoundingClientRect(), cs = getComputedStyle(e); return { top: r.top, left: r.left, right: r.right, pointer: cs.pointerEvents, position: cs.position }; })()`);
    assert.equal(g.position, "fixed");
    assert.equal(g.pointer, "none", "it never takes a click meant for the view");
    assert.ok(g.top >= 95, `below the painting's search and icon row, which end near 90 px (top ${g.top})`);
    assert.ok(Math.abs(g.right - (1280 - 12)) < 2, `right-aligned over the painting (right ${g.right})`);
  } finally { await p.close(); }
});

// CLEARANCE, measured and not assumed (click-through is not clearance): the notice's box against the boxes of the controls the viewer
// ACTUALLY draws: the Telling's filter chips, the Time travel opener and body, the by-mail button and its open card, and (app frame)
// the whole Telling column. Every layout the viewer has is walked: the app frame, the stacked page, and the phone painting.
// The by-mail controls come from the viewer that carries POS-1006: set SETTLEMENT_NOTICE_WORLD_DIR (see above). Without it (CI, on the
// package pin) the chips, Time travel and the Telling are still checked, and the by-mail ones are asserted absent so a silent
// downgrade of this test is named rather than passed.
// FOREGROUND, not rectangles: what is painted on top at the centre of each row of the open card. The notice takes no clicks, so it is made to take them for
// the length of the probe (that is what lets elementFromPoint see it at all) and put back. A row whose topmost element is the notice is masked.
const FOREGROUND = `(() => {
  const n = document.querySelector("[data-settlement-notice]"), card = document.querySelector(".wv-bymail");
  const saved = n.style.pointerEvents; n.style.pointerEvents = "auto";
  try {
    const c = card.getBoundingClientRect(), nr = n.getBoundingClientRect();
    const overlaps = c.left < nr.right && c.right > nr.left && c.top < nr.bottom && c.bottom > nr.top;
    const masked = []; let sampled = 0;
    for (const a of [card.querySelector(".wv-bymail-head"), ...card.querySelectorAll(".wv-bymail-link")].filter(Boolean)) {
      const r = a.getBoundingClientRect(), x = (r.left + r.right) / 2, y = (r.top + r.bottom) / 2;
      if (x < c.left || x > c.right || y < c.top || y > c.bottom || x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue;   /* scrolled out of the card's own window */
      sampled += 1;
      const top = document.elementFromPoint(x, y);
      if (top && top.closest("[data-settlement-notice]")) masked.push((a.textContent || "").trim().slice(0, 20));
    }
    return { overlaps, sampled, masked };
  } finally { n.style.pointerEvents = saved; }
})()`;
const LONG = Array.from({ length: 64 }, (_, i) => `resident-${String(i + 1).padStart(2, "0")}`);

// THE REAL-LENGTH CARD at the short sizes Truey reproduced the masking at: 64 names make the released card as tall as its window.
for (const [width, height] of [[375, 667], [360, 640], [1024, 600], [844, 390]]) {
  test(`the World page at ${width}x${height}: a 64-name by-mail card is wholly in front of the notice (and the check bites when the notice is raised above it)`, { skip: SKIP, timeout: 120_000 }, async () => {
    await boot();
    state.bodyFn = fresh("DOWN");
    const p = await openPage(browser, base, "/world/", { width, height, board, walkers: LONG });
    try {
      await p.until(`(${NOTICE})?.shown === true`, "the notice");
      await new Promise((ok) => setTimeout(ok, 2800));
      if (!WORLD_DIR) {   // CI on the pinned viewer: there is no by-mail card to look through (a skip would fail built-pages), so say so by asserting its absence
        assert.equal(await p.evalJs(`document.querySelector(".pm-bymail-btn") === null`), true, "no by-mail button on the pinned viewer: this run did not check the long card (set SETTLEMENT_NOTICE_WORLD_DIR)");
        return;
      }
      await p.evalJs(`document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); true`);
      await p.until(`(() => { const b = document.querySelector(".pm-bymail-btn"); return !!b && !b.hidden; })()`, "the by-mail button");
      await p.evalJs(`document.querySelector(".pm-bymail-btn").click(); true`);
      await p.until(`(() => { const c = document.querySelector(".wv-bymail"); return !!c && c.getClientRects().length > 0; })()`, "the by-mail card to open");
      assert.equal(await p.evalJs(`document.querySelectorAll(".wv-bymail-link").length`), 64, "the real-length list");
      const fg = await p.evalJs(FOREGROUND);
      assert.ok(fg.sampled > 0, "rows of the card were sampled");
      assert.deepEqual(fg.masked, [], `no row of the card is under the notice (rectangles overlap: ${fg.overlaps})`);
      assert.equal((await p.evalJs(NOTICE)).shown, false, "the World notice steps aside while the card is open");
      if (fg.overlaps) {   // the falsifier: the d29 paint order (the notice above the card, not stepping aside) must be caught by this very check
        await p.evalJs(`(() => { const n = document.querySelector("[data-settlement-notice]"); n.style.zIndex = "8500"; n.style.visibility = "visible"; })(); true`);
        const old = await p.evalJs(FOREGROUND);
        assert.ok(old.masked.length > 0, "with the step-aside undone and the notice raised to the old z-index 8500 the same check finds masked rows");
      }
    } finally { await p.close(); }
  });
}

// R1 (Wright, 06:46Z): the WORLD notice steps aside while the by-mail card, the search-results list or the bell menu is open, and returns on close. The
// bell's menu is the viewer's phone control, so it is opened at phone width; the by-mail card needs the S165 viewer (SETTLEMENT_NOTICE_WORLD_DIR).
for (const [width, height, lists] of [[390, 844, ["search", "bell", "bymail"]], [1280, 800, ["search", "bymail"]]]) {
  test(`the World page at ${width}x${height}: DOWN shows, then each open list (${lists.join(", ")}) hides the notice and closing it brings it back`, { skip: SKIP, timeout: 120_000 }, async () => {
    await boot();
    state.bodyFn = fresh("DOWN");
    const p = await openPage(browser, base, "/world/", { width, height, board, walkers: INVENTED });
    try {
      await p.until(`(${NOTICE})?.shown === true`, "the notice");
      await p.until(`document.querySelector(".pm-tt-open") !== null`, "the viewer");
      await new Promise((ok) => setTimeout(ok, 2800));
      await p.evalJs(`document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); true`);
      const shown = async () => (await p.evalJs(NOTICE)).shown;
      assert.equal(await shown(), true, "DOWN: shown before any list is open");
      const steps = {
        search: [`(() => { const i = document.querySelector(".wv-search-input"); i.value = "a"; i.dispatchEvent(new Event("input", { bubbles: true })); return true; })()`, `(() => { const r = document.querySelector(".wv-search-results"); return !!r && !r.hidden; })()`,
          `(() => { const i = document.querySelector(".wv-search-input"); i.value = ""; i.dispatchEvent(new Event("input", { bubbles: true })); return true; })()`],
        bell: [`(() => { document.querySelector(".wv-bell").click(); return true; })()`, `(() => { const m = document.querySelector(".wv-bell-menu"); return !!m && !m.hidden; })()`, `(() => { document.querySelector(".wv-bell").click(); return true; })()`],
        bymail: [`(() => { document.querySelector(".pm-bymail-btn").click(); return true; })()`, `(() => { const c = document.querySelector(".wv-bymail"); return !!c && c.classList.contains("pm-bymail-open") && c.getClientRects().length > 0; })()`, `(() => { document.querySelector(".pm-bymail-btn").click(); return true; })()`],
      };
      for (const list of lists) {
        if ((list === "bymail" || list === "bell") && !WORLD_DIR) continue;   // the pinned viewer has neither the by-mail card nor the phone bell menu (CI): the search list is still checked
        const [open, isOpen, close] = steps[list];
        await p.evalJs(open);
        await p.until(isOpen, `the ${list} list to be open`);
        await p.until(`(${NOTICE})?.shown === false`, `the notice to step aside for the open ${list} list`);
        const hidden = await p.evalJs(`getComputedStyle(document.querySelector("[data-settlement-notice]")).visibility`);
        assert.equal(hidden, "hidden", `${list}: hidden while open`);
        await p.evalJs(close);
        await p.until(`!(${isOpen})`, `the ${list} list to close`);
        await p.until(`(${NOTICE})?.shown === true`, `the notice to return when the ${list} list closes`);
      }
      // the predicate is unchanged: a list that is open does not make an OK board show anything, and OK still clears a shown one
      state.bodyFn = fresh("OK");
      await p.evalJs(`document.dispatchEvent(new Event("visibilitychange")); window.dispatchEvent(new Event("pageshow")); true`);
      await p.until(`(${NOTICE})?.shown === false`, "OK to clear it");
    } finally { await p.close(); }
  });
}

const INVENTED = ["ash", "birch", "wren", "cedar", "fern", "moss", "pike", "quill", "rook", "sage", "tern", "vale"];
const CLEARANCE = `(() => {
  const n = document.querySelector("[data-settlement-notice]").getBoundingClientRect();
  const box = (el) => { const r = el.getBoundingClientRect(); return { l: Math.round(r.left), t: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom) }; };
  const live = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && !el.hidden; };
  const sets = { chips: ".wv-fchip", timeTravelButton: ".pm-tt-open", timeTravelBody: ".pm-tt-body", byMailButton: ".pm-bymail-btn", byMailCard: ".wv-bymail", tellingColumn: ".wv-telling" };
  const out = { notice: box(document.querySelector("[data-settlement-notice]")), present: {}, hits: [], vw: innerWidth };
  for (const [k, sel] of Object.entries(sets)) {
    const els = [...document.querySelectorAll(sel)].filter(live);
    out.present[k] = els.length;
    if (k === "tellingColumn" && innerWidth < 1161) continue;           /* below the app frame the Telling is a page above the painting, not a column beside it */
    for (const e of els) { const r = box(e); if (r.l < n.right && r.r > n.left && r.t < n.bottom && r.b > n.top) out.hits.push(k + " " + JSON.stringify(r)); }
  }
  return out;
})()`;

for (const [width, height] of [[1280, 800], [1920, 1080], [1180, 800], [1024, 800], [721, 800], [390, 844], [360, 640]]) {
  test(`the World page at ${width}x${height}: the notice is clear of the Telling's chips, Time travel and the by-mail row and its open card`, { skip: SKIP, timeout: 120_000 }, async () => {
    await boot();
    state.bodyFn = fresh("DOWN");
    const p = await openPage(browser, base, "/world/", { width, height, board, walkers: INVENTED });
    try {
      await p.until(`(${NOTICE})?.shown === true`, "the notice");
      await p.until(`document.querySelector(".pm-tt-open") !== null`, "the viewer's Time travel opener");
      await new Promise((ok) => setTimeout(ok, 2800));                 // the viewer's first-visit tour opens on its own; Escape is how a visitor puts it away
      await p.evalJs(`document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); true`);
      if (WORLD_DIR) await p.until(`(() => { const b = document.querySelector(".pm-bymail-btn"); return !!b && !b.hidden; })()`, "the by-mail button (the S165 viewer, with invented residents)");
      await new Promise((ok) => setTimeout(ok, 500));
      const closed = await p.evalJs(CLEARANCE);
      assert.ok(closed.present.timeTravelButton > 0, "Time travel is drawn, so it is checked");
      if (width > 720) assert.ok(closed.present.chips > 0, "the Telling's filter chips are drawn, so they are checked");
      if (WORLD_DIR) assert.ok(closed.present.byMailButton > 0, "the by-mail button is drawn, so it is checked");
      else assert.equal(closed.present.byMailButton, 0, "no by-mail button on the pinned viewer: this run did not check it (set SETTLEMENT_NOTICE_WORLD_DIR)");
      assert.deepEqual(closed.hits, [], `the notice ${JSON.stringify(closed.notice)} covers no control`);
      if (width >= 1161) assert.ok(closed.notice.l >= (await p.evalJs(`document.querySelector(".wv-telling").getBoundingClientRect().right`)), "right of the Telling column");
      if (WORLD_DIR) {
        await p.evalJs(`document.querySelector(".pm-bymail-btn").click(); true`);
        await p.until(`(() => { const c = document.querySelector(".wv-bymail"); return !!c && c.getClientRects().length > 0; })()`, "the by-mail card to open");
        const open = await p.evalJs(CLEARANCE);
        assert.ok(open.present.byMailCard > 0, "the open by-mail card is drawn, so it is checked");
        // the open card is an interactive panel and paints ABOVE the passive notice, so a rectangle that overlaps it is harmless: what must hold is that
        // nothing ELSE is covered, and (FOREGROUND, below) that no row of the card is masked.
        assert.deepEqual(open.hits.filter((h) => !h.startsWith("byMailCard")), [], `with the by-mail card open, the notice ${JSON.stringify(open.notice)} covers no other control`);
        const fg = await p.evalJs(FOREGROUND);
        assert.deepEqual(fg.masked, [], "no row of the open card is under the notice");
      }
      const view = await p.evalJs(`(() => { const r = document.querySelector("[data-settlement-notice]").getBoundingClientRect(); return { l: r.left, r: r.right, b: r.bottom, w: innerWidth, h: innerHeight }; })()`);
      assert.ok(view.l >= 0 && view.r <= view.w && view.b <= view.h, `the notice is wholly inside the view ${JSON.stringify(view)}`);
    } finally { await p.close(); }
  });
}
