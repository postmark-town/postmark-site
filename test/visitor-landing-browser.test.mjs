// visitor-landing-browser.test.mjs — the signed-out front page, RENDERED and driven with real input on the built site (UI-5).
//
//   run-heavy node --test test/visitor-landing-browser.test.mjs      (a browser test is a heavy run: CRAFT/LANE-DISCIPLINE, STAR-223)
//
// It serves dist-town/ (the built-pages CI job builds it first) and drives headless Chrome over CDP, the harness of
// test/main-rail-pages-browser.test.mjs. Every request that leaves the local server, and every /api/ call, is refused: nobody is really signed
// in, and the signed-in reader is an invented token in this browser's own storage, which the layout's first paint reads (no office answers).
// WHAT IT PROVES (Facet's acceptance and falsifiers for UI-5):
//   · THE SEPARATION: a visitor sees the landing and not the signed-in page; a signed-in reader sees the signed-in page, its personal hero
//     ("Welcome back,") included, and not the landing; signing out on the page swaps back with no reload. Reverse the selection rule in
//     town/pages/index.astro and these fail;
//   · THE BUTTONS: "See how it works", pressed from the keyboard, brings the Letters section to the top of the window; "Give your agent an
//     address" is a link to /join/; Regina's choices go to /join/#hands and /join/#chat. A page with no #letters fails;
//   · THE MAP: the pins are buttons reached by Tab and pressed by Enter or Space, and tapped on a phone: each opens its own home's card,
//     and says which is pressed;
//   · at 375 and 1440 nothing scrolls sideways.
// WITHOUT dist-town the test SKIPS and says so; WITH built pages and no browser it FAILS (built-pages cannot turn a skip into a pass).

import test, { after } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import http from "node:http";
import { homedir, tmpdir } from "node:os";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DIST = join(ROOT, "dist-town");
const SKIP = existsSync(join(DIST, "index.html")) ? false : "no built pages (dist-town/): nothing to render";

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

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2" };
function serveDist() {
  const server = http.createServer((req, res) => {
    const p = decodeURIComponent((req.url || "/").split("?")[0]);
    let file = normalize(join(DIST, p));
    if (!file.startsWith(DIST + sep) && file !== DIST) { res.writeHead(403); return res.end(); }
    try { if (statSync(file).isDirectory()) file = join(file, "index.html"); } catch { /* maybe a file */ }
    if (!existsSync(file)) { res.writeHead(404, { "content-type": "text/plain" }); return res.end("not found"); }
    res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream" });
    res.end(readFileSync(file));
  });
  return new Promise((ok) => server.listen(0, "127.0.0.1", () => ok(server)));
}

// DETACHED, so the whole browser is one process group that `close` kills as one
async function launch(chrome) {
  const profile = mkdtempSync(join(tmpdir(), "ui5-profile-"));
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
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } else listeners.forEach((l) => l(m)); };
  const send = (method, params = {}, sessionId) => new Promise((ok, no) => {
    const i = ++id;
    pending.set(i, (m) => (m.error ? no(new Error(`${method}: ${m.error.message}`)) : ok(m.result)));
    ws.send(JSON.stringify({ id: i, method, params, ...(sessionId ? { sessionId } : {}) }));
    setTimeout(() => { if (pending.delete(i)) no(new Error(`${method}: no answer in 30 s`)); }, 30_000);
  });
  return { send, listeners, close: () => {
    try { ws.close(); } catch { /* gone */ }
    try { process.kill(-child.pid, "SIGKILL"); } catch { try { child.kill("SIGKILL"); } catch { /* gone */ } }
    try { child.stderr.destroy(); } catch { /* gone */ }
    rmSync(profile, { recursive: true, force: true });
  } };
}

// The invented sign-in: what the layout's first paint reads (a fresh token, and the handles GET /me would have given). Not a credential.
const SIGNED_IN = `localStorage.setItem("pm.oauth.token", JSON.stringify({ access_token: "invented-ui5-test", obtained: Date.now(), expires_in: 3600 }));
  sessionStorage.setItem("pm.oauth.handles", JSON.stringify(["wright"]));`;

/** One page; every request off the local server, and every /api/ call, refused. Motion is reduced so a scroll lands at once. */
async function openPage(b, base, path, { width, height = 900, touch = false, signedIn = false } = {}) {
  const { targetId } = await b.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await b.send("Target.attachToTarget", { targetId, flatten: true });
  const S = (m, p) => b.send(m, p, sessionId);
  await S("Page.enable"); await S("Runtime.enable");
  await S("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: touch });
  await S("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  if (touch) await S("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
  if (signedIn) await S("Page.addScriptToEvaluateOnNewDocument", { source: SIGNED_IN });
  await S("Fetch.enable", { patterns: [{ urlPattern: "*", requestStage: "Request" }] });
  b.listeners.push((m) => {
    if (m.sessionId !== sessionId || m.method !== "Fetch.requestPaused") return;
    const u = m.params.request.url;
    const local = u.startsWith(base + "/") && !new URL(u).pathname.startsWith("/api/");
    (local ? S("Fetch.continueRequest", { requestId: m.params.requestId }) : S("Fetch.failRequest", { requestId: m.params.requestId, errorReason: "BlockedByClient" })).catch(() => {});
  });
  const loaded = new Promise((ok) => { const l = (m) => { if (m.sessionId === sessionId && m.method === "Page.loadEventFired") { b.listeners.splice(b.listeners.indexOf(l), 1); ok(); } }; b.listeners.push(l); });
  const nav = await S("Page.navigate", { url: base + path });
  assert.equal(nav.errorText, undefined, `the page did not open: ${nav.errorText}`);
  await loaded;
  const evalJs = async (expression) => {
    const r = await S("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(`page threw: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
    return r.result.value;
  };
  const until = async (expr, what, ms = 10_000) => {
    const end = Date.now() + ms;
    for (;;) { if (await evalJs(expr)) return; if (Date.now() > end) throw new Error(`timed out waiting for ${what}`); await new Promise((r) => setTimeout(r, 60)); }
  };
  const KEYS = { Tab: [9, "Tab", ""], Enter: [13, "Enter", "\r"], " ": [32, "Space", " "] };
  const press = async (key, { shift = false } = {}) => {
    const [vk, code, text] = KEYS[key];
    await S("Input.dispatchKeyEvent", { type: text ? "keyDown" : "rawKeyDown", key, code, windowsVirtualKeyCode: vk, text: text || undefined, modifiers: shift ? 8 : 0 });
    await S("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode: vk, modifiers: shift ? 8 : 0 });
  };
  const centre = (selector) => evalJs(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e) return null; e.scrollIntoView({ block: "center" }); const b = e.getBoundingClientRect();
    const x = b.left + b.width / 2, y = b.top + b.height / 2; const hit = document.elementFromPoint(x, y); return { x, y, hit: !!hit && (hit === e || e.contains(hit)) }; })()`);
  const tap = async (selector) => {
    const c = await centre(selector);
    assert.ok(c?.hit, `${selector} is not under its own centre`);
    await S("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: c.x, y: c.y }] });
    await S("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  };
  return { evalJs, until, press, tap, close: () => S("Target.closeTarget", { targetId }).catch(() => {}) };
}

const SHOWN = (sel) => `(() => { const e = document.querySelector(${JSON.stringify(sel)}); return !!e && getComputedStyle(e).display !== "none" && e.getClientRects().length > 0; })()`;
const STATE = `({ lens: document.documentElement.getAttribute("data-lens"), landing: ${SHOWN(".pm-landing")}, resident: ${SHOWN(".pm-index")},
  headline: (() => { const h = document.querySelector(".pm-landing h1"); return h && h.getClientRects().length ? h.innerText.replace(/\\s+/g, " ").trim() : null; })(),
  hero: (() => { const t = document.querySelector("[data-hero-title]"); return t && t.getClientRects().length ? t.textContent.trim() : null; })(),
  sideways: document.documentElement.scrollWidth > innerWidth })`;
const PARCEL = `({ title: document.querySelector("[data-p-title]").textContent.trim(), pressed: [...document.querySelectorAll(".pin[aria-pressed='true']")].map((p) => p.dataset.home) })`;

let server = null, browser = null, base = null;
const chrome = SKIP ? null : findChrome();
async function setup() {
  if (browser) return;
  assert.ok(chrome, "built pages exist but no Chrome was found (set CHROME_BIN): this must fail, not skip");
  server = await serveDist(); base = `http://127.0.0.1:${server.address().port}`;
  browser = await launch(chrome);
}
after(() => { browser?.close(); server?.close(); });

test("THE SEPARATION: a visitor sees the landing and not the signed-in page, at 375 and 1440", { skip: SKIP }, async () => {
  await setup();
  for (const [width, touch] of [[375, true], [1440, false]]) {
    const p = await openPage(browser, base, "/", { width, touch });
    const s = await p.evalJs(STATE);
    assert.equal(s.lens, null, "nobody is signed in");
    assert.equal(s.landing, true, `the landing is shown to a visitor at ${width}`);
    assert.equal(s.resident, false, `the signed-in page is hidden from a visitor at ${width}`);
    assert.equal(s.headline, "Postmark is a town for AI agents.");
    assert.equal(s.hero, null, "the signed-in page's hero is not on screen");
    assert.equal(s.sideways, false, `nothing scrolls sideways at ${width}`);
    await p.close();
  }
});

test("THE SEPARATION: a signed-in reader keeps the signed-in page, its personal hero included, and never sees the landing; signing out swaps back", { skip: SKIP }, async () => {
  await setup();
  for (const width of [375, 1440]) {
    const p = await openPage(browser, base, "/", { width, touch: width < 800, signedIn: true });
    await p.until(`document.documentElement.getAttribute("data-lens") === "wright"`, "the lens");
    await p.until(`(document.querySelector("[data-hero-title]")?.textContent || "").trim() === "Welcome back,"`, "the personal hero");
    const s = await p.evalJs(STATE);
    assert.equal(s.resident, true, `the signed-in page is shown at ${width}`);
    assert.equal(s.landing, false, `the landing is hidden from a signed-in reader at ${width}`);
    assert.equal(s.hero, "Welcome back,");
    assert.equal(s.sideways, false);
    if (width === 1440) {
      // the layout's own sign-out: the lens comes off and the landing returns, no reload
      await p.evalJs(`document.querySelector("[data-auth-signout]").click()`);
      await p.until(`!document.documentElement.hasAttribute("data-lens")`, "the lens off");
      const out = await p.evalJs(STATE);
      assert.equal(out.landing, true, "signed out, the landing is back");
      assert.equal(out.resident, false, "and the signed-in page has gone");
    }
    await p.close();
  }
});

test("THE BUTTONS: 'See how it works' from the keyboard brings the Letters to the top; the join and Regina's roads are links to the join", { skip: SKIP }, async () => {
  await setup();
  const p = await openPage(browser, base, "/", { width: 1440 });
  assert.equal(await p.evalJs(`!!document.getElementById("letters") && document.getElementById("letters").closest(".pm-landing") !== null`), true, "the landing holds #letters");
  const before = await p.evalJs(`Math.round(document.getElementById("letters").getBoundingClientRect().top)`);
  assert.ok(before > 900, "the Letters start below the first screen");
  await p.evalJs(`document.querySelector("[data-landing-how]").focus()`);
  await p.press("Enter");
  await p.until(`location.hash === "#letters"`, "the hash");
  await p.until(`Math.abs(document.getElementById("letters").getBoundingClientRect().top) < 40`, "the Letters at the top of the window");
  const links = await p.evalJs(`({ join: document.querySelector("[data-landing-join]").getAttribute("href"), how: document.querySelector("[data-landing-how]").textContent.trim(),
    roads: [...document.querySelectorAll("[data-landing-road]")].map((a) => a.getAttribute("href")) })`);
  assert.deepEqual(links, { join: "/join/", how: "See how it works ↓", roads: ["/join/#hands", "/join/#chat"] });
  await p.close();
});

test("THE MAP: the pins are reached by Tab and pressed by Enter or Space, and tapped on a phone; each opens its own home", { skip: SKIP }, async () => {
  await setup();
  const p = await openPage(browser, base, "/", { width: 1440 });
  const homes = Object.fromEntries((await p.evalJs(`JSON.parse(document.querySelector("[data-landing-homes]").textContent)`)).map((h) => [h.key, h]));
  const first = await p.evalJs(PARCEL);
  assert.equal(first.pressed.length, 1, "one pin is pressed at rest");
  assert.equal(first.title, homes[first.pressed[0]].title, "and the card is that home's");
  const keys = await p.evalJs(`[...document.querySelectorAll(".pin[data-home]")].map((p) => p.dataset.home)`);
  assert.ok(keys.length >= 2, "more than one home is pinned");
  // Tab from the element before the first pin lands on it: the pins are in the tab order, in the map's order
  await p.evalJs(`document.querySelector("[data-landing-how]").focus()`);
  let reached = null;
  for (let i = 0; i < 80 && reached === null; i++) { await p.press("Tab"); reached = await p.evalJs(`document.activeElement?.matches(".pin") ? document.activeElement.dataset.home : null`); }
  assert.equal(reached, keys[0], "Tab reaches the first pin");
  const other = keys.find((k) => k !== first.pressed[0] && k !== keys[0]) ?? keys[1];
  await p.evalJs(`document.querySelector('.pin[data-home="${keys[0]}"]').focus()`);
  await p.press("Enter");
  assert.deepEqual(await p.evalJs(PARCEL), { title: homes[keys[0]].title, pressed: [keys[0]] }, "Enter opens the focused pin's home");
  await p.evalJs(`document.querySelector('.pin[data-home="${other}"]').focus()`);
  await p.press(" ");
  assert.deepEqual(await p.evalJs(PARCEL), { title: homes[other].title, pressed: [other] }, "Space opens it too");
  await p.close();
  const phone = await openPage(browser, base, "/", { width: 375, height: 812, touch: true });
  await phone.tap(`.pin[data-home="${keys[0]}"]`);
  await phone.until(`document.querySelector("[data-p-title]").textContent.trim() === ${JSON.stringify(homes[keys[0]].title)}`, "the tapped home's card");
  assert.deepEqual((await phone.evalJs(PARCEL)).pressed, [keys[0]]);
  await phone.close();
});
