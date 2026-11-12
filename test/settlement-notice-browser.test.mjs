// settlement-notice-browser.test.mjs — the late-settlement notice, RENDERED in a real browser on the real built pages (POS-1004).
//
//   node --test test/settlement-notice-browser.test.mjs
//
// WHAT THIS PROVES that test/settlement-notice.test.mjs (the component's script against the real reader, in a vm) cannot: that
// the BUILT front page and World page carry the notice in the right seat, that it renders the exact words, that it appears under
// a forced fresh `settlement` DOWN board and nowhere else, that it clears WITHOUT A RELOAD when the board goes OK, and that it
// fits a phone-width view without overlapping a control or widening the page.
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

const builtPages = existsSync(join(DIST, "index.html")) && existsSync(join(DIST, "world", "index.html"));
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
function serveDist() {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent((req.url || "/").split("?")[0]);
    let file = normalize(join(DIST, p));
    if (!file.startsWith(DIST + sep) && file !== DIST) { res.writeHead(403); return res.end(); }
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

async function openPage(b, base, path, { width, board }) {
  const { targetId } = await b.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await b.send("Target.attachToTarget", { targetId, flatten: true });
  const S = (m, p) => b.send(m, p, sessionId);
  await S("Page.enable");
  await S("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 600 });
  // THE FORCED BOARD: this test answers /ops/sentinel.json. `board.body()` is read at request time, so a step can change it.
  await S("Fetch.enable", { patterns: [{ urlPattern: "*/ops/sentinel.json*", requestStage: "Request" }] });
  const listener = (m) => {
    if (m.sessionId !== sessionId || m.method !== "Fetch.requestPaused") return;
    const { requestId } = m.params;
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
  return { evalJs, until, close: async () => { b.listeners.splice(b.listeners.indexOf(listener), 1); await b.send("Target.closeTarget", { targetId }).catch(() => {}); } };
}

const state = { bodyFn: () => null, reads: 0 };
const fresh = (settlement, { ageMin = 2, extra = [] } = {}) => () => JSON.stringify({
  schema: 1, generated_at: new Date(Date.now() - ageMin * 60_000).toISOString(),
  probes: [{ key: "site_home", verdict: "OK" }, ...(settlement ? [{ key: "settlement", label: "the settlement", verdict: settlement, reason: "forced by the test" }] : []), ...extra],
});
const board = { body: () => state.bodyFn(), get reads() { return state.reads; }, set reads(v) { state.reads = v; } };

const NOTICE = `(() => { const e = document.querySelector("[data-settlement-notice]"); if (!e) return null; const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return { hiddenAttr: e.hidden, shown: !e.hidden && cs.display !== "none" && cs.visibility !== "hidden" && r.width > 0 && r.height > 0, text: e.textContent.trim().replace(/\\s+/g, " "), rect: { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height } }; })()`;

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

const PAGES = [["the front page", "/"], ["the World page", "/world/"]];

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
      if (name === "the front page") assert.deepEqual(hit, [], "a flow notice sits between the ticker and the hero and covers no control");
      else assert.deepEqual(hit.filter((h) => !/^$/.test(h)), [], "the floating notice sits clear of the World's top controls");
    } finally { await p.close(); }
  });
}

test("the front page: the notice sits BELOW the live ticker and ABOVE the hero", { skip: SKIP, timeout: 120_000 }, async () => {
  await boot();
  state.bodyFn = fresh("DOWN");
  const p = await openPage(browser, base, "/", { width: 1280, board });
  try {
    await p.until(`(${NOTICE})?.shown === true`, "the notice");
    const order = await p.evalJs(`(() => { const t = document.querySelector("section.ticker").getBoundingClientRect(), n = document.querySelector("[data-settlement-notice]").getBoundingClientRect(), h = document.querySelector("section.hero").getBoundingClientRect(); return { tickerBottom: t.bottom, noticeTop: n.top, noticeBottom: n.bottom, heroTop: h.top }; })()`);
    assert.ok(order.noticeTop >= order.tickerBottom - 1, `below the ticker (${order.noticeTop} >= ${order.tickerBottom})`);
    assert.ok(order.noticeBottom <= order.heroTop + 1, `above the hero (${order.noticeBottom} <= ${order.heroTop})`);
  } finally { await p.close(); }
});

test("the World page: the floating notice is centred, under the top row, and in front of nothing it could hide (it takes no clicks)", { skip: SKIP, timeout: 120_000 }, async () => {
  await boot();
  state.bodyFn = fresh("DOWN");
  const p = await openPage(browser, base, "/world/", { width: 1280, board });
  try {
    await p.until(`(${NOTICE})?.shown === true`, "the notice");
    const g = await p.evalJs(`(() => { const e = document.querySelector("[data-settlement-notice]"), r = e.getBoundingClientRect(), cs = getComputedStyle(e); return { top: r.top, left: r.left, right: r.right, pointer: cs.pointerEvents, position: cs.position }; })()`);
    assert.equal(g.position, "fixed");
    assert.equal(g.pointer, "none", "it never takes a click meant for the view");
    assert.ok(g.top >= 40, `below the top controls row (top ${g.top})`);
    assert.ok(Math.abs((g.left + g.right) / 2 - 640) < 4, "centred");
  } finally { await p.close(); }
});
