// main-rail-pages-browser.test.mjs — a main-rail seat's page list, RENDERED and driven with real input on the built page (CORE-164).
//
//   run-heavy node --test test/main-rail-pages-browser.test.mjs      (a browser test is a heavy run: CRAFT/LANE-DISCIPLINE, STAR-223)
//
// Darko, 2026-11-23 08:37 EST: "can we make it so you can hover over any of the main rail headers to see their pages as a vertical list?"
// It serves the built site (dist-town/; the built-pages CI job builds it first), drives headless Chrome over CDP (Node's global WebSocket; a
// throwaway profile, no sync, no extensions) with REAL input: a pointer that moves, Tab/Shift-Tab/Enter/Space/Escape key events, a touch tap.
// Every request to /api/ is refused: the rail is static, nobody is signed in. WHAT IT PROVES that test/main-rail-pages.test.mjs cannot:
//   · pointing at a seat with pages shows ITS list, the pointer can travel from the header into the list without it closing, and leaving
//     shuts it; a one-door seat shows nothing; its button says expanded exactly while the list is shown, pointing included;
//   · mixed input: pointed at, Tabbed into, then the pointer moves away, the list and the focused page stay until focus leaves or Escape;
//   · the keyboard reaches the seat, its button, and the list's pages by Tab, and Shift-Tab back; a shut list's pages are not in the tab
//     order; Escape shuts it and leaves focus on the button; Tab past the last page shuts it; the button is out of sight until keyboard
//     focus lands on it, and there is no caret on the rail (Darko, 2026-11-24 08:24 EST: "remove carets from rail, they look bad");
//   · on a phone (touch, no hover) the first tap on a seat opens its list inside the screen (the page stays), a tap elsewhere shuts it,
//     and a second tap on the seat while its list is shown goes to the seat;
//   · every list fits the window at 1440 and 390, the rail still counts six seats in two rows at most, and nothing scrolls sideways;
//   · with JavaScript off the seats are plain links (no button) and pointing still shows a list.
// WITHOUT dist-town the test SKIPS and says so; WITH built pages and no browser it FAILS (built-pages cannot turn a skip into a pass).

import test, { after } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import http from "node:http";
import { homedir, tmpdir } from "node:os";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { RAIL } from "../src/lib/nav.mjs";
import { railPages } from "../src/lib/rail-pages.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DIST = join(ROOT, "dist-town");
const SKIP = existsSync(join(DIST, "docs", "index.html")) ? false : "no built pages (dist-town/): nothing to render";
const WORLD = RAIL.find((s) => s.key === "world");
const EXPECT_WORLD = railPages(WORLD).map((r) => r.label);

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
  const profile = mkdtempSync(join(tmpdir(), "core164-profile-"));
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

/** One page, every /api/ call refused. `touch` emulates a phone's touch screen (no hover); `noScript` turns JavaScript off. */
async function openPage(b, base, path, { width, height = 900, touch = false, noScript = false } = {}) {
  const { targetId } = await b.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await b.send("Target.attachToTarget", { targetId, flatten: true });
  const S = (m, p) => b.send(m, p, sessionId);
  await S("Page.enable"); await S("Runtime.enable");
  await S("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: touch });
  if (touch) await S("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
  if (noScript) await S("Emulation.setScriptExecutionDisabled", { value: true });
  await S("Fetch.enable", { patterns: [{ urlPattern: "*/api/*", requestStage: "Request" }] });
  b.listeners.push((m) => {
    if (m.sessionId !== sessionId || m.method !== "Fetch.requestPaused") return;
    S("Fetch.failRequest", { requestId: m.params.requestId, errorReason: "BlockedByClient" }).catch(() => {});
  });
  // a document navigation destroys the evaluation context: a step that navigates waits for the new document's load (POS-1060's barrier)
  const landing = (ms = 30_000) => new Promise((ok, no) => {
    let url = null;
    const done = (fn, v) => { clearTimeout(t); b.listeners.splice(b.listeners.indexOf(l), 1); fn(v); };
    const l = (m) => {
      if (m.sessionId !== sessionId) return;
      if (m.method === "Page.frameNavigated" && !m.params.frame.parentId) url = m.params.frame.url;
      else if (m.method === "Page.loadEventFired" && url) done(ok, url);
    };
    const t = setTimeout(() => done(no, new Error(`the page did not finish loading within ${ms / 1000} s`)), ms);
    b.listeners.push(l);
  });
  const first = landing();
  first.catch(() => {});
  const nav = await S("Page.navigate", { url: base + path });
  assert.equal(nav.errorText, undefined, `the page did not open: ${nav.errorText}`);
  await first;
  // (with the page's scripts off, DevTools' own evaluation still runs: the probe reads the page, the page's scripts stay off)
  const evalJs = async (expression) => {
    const r = await S("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(`page threw: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
    return r.result.value;
  };
  const until = async (expr, what, ms = 10_000) => {
    const end = Date.now() + ms;
    for (;;) { if (await evalJs(expr)) return; if (Date.now() > end) throw new Error(`timed out waiting for ${what}`); await new Promise((r) => setTimeout(r, 60)); }
  };
  const centre = (selector) => evalJs(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e) return null; const b = e.getBoundingClientRect();
    const x = b.left + b.width / 2, y = b.top + b.height / 2; const hit = document.elementFromPoint(x, y); return { x, y, hit: !!hit && (hit === e || e.contains(hit)), covered: hit ? hit.tagName + "." + hit.className : null }; })()`);
  const move = (x, y) => S("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
  const pointAt = async (selector) => { const c = await centre(selector); assert.ok(c?.hit, `${selector} is not under its own centre (${c?.covered})`); await move(c.x, c.y); return c; };
  const KEYS = { Tab: [9, "Tab", ""], Enter: [13, "Enter", "\r"], Escape: [27, "Escape", ""], " ": [32, "Space", " "] };
  const press = async (key, { shift = false } = {}) => {
    const [vk, code, text] = KEYS[key];
    await S("Input.dispatchKeyEvent", { type: text ? "keyDown" : "rawKeyDown", key, code, windowsVirtualKeyCode: vk, text: text || undefined, modifiers: shift ? 8 : 0 });
    await S("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode: vk, modifiers: shift ? 8 : 0 });
  };
  const tap = async (selector) => {
    const c = await centre(selector);
    assert.ok(c?.hit, `${selector} is not under its own centre (${c?.covered})`);
    await S("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: c.x, y: c.y }] });
    await S("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  };
  return { evalJs, until, centre, move, pointAt, press, tap, landing, S, close: () => S("Target.closeTarget", { targetId }).catch(() => {}) };
}

const SEAT = (key) => `.pm-townnav-links a[data-rail-top][href="/${key === "town" ? "bulletin" : key}/"]`;
const LIST = (key) => `#pm-rail-pages-${key}`;
const BTN = (key) => `.pm-rail-seat:has(> ${SEAT(key).replace(".pm-townnav-links ", "")}) > [data-rail-more]`;
const SHOWN = (key) => `(() => { const l = document.querySelector(${JSON.stringify(LIST(key))}); return !!l && getComputedStyle(l).display !== "none" && l.getClientRects().length > 0; })()`;
const ANY_SHOWN = `[...document.querySelectorAll(".pm-rail-pages")].filter((l) => getComputedStyle(l).display !== "none").map((l) => l.id)`;
const FOCUS = `(() => { const a = document.activeElement; return a ? (a.matches("[data-rail-more]") ? "button:" + a.getAttribute("aria-controls") : (a.textContent || "").trim().replace(/\\s*beta$/, "")) : null; })()`;

let server = null, browser = null, base = null;
const chrome = SKIP ? null : findChrome();
async function setup() {
  if (browser) return;
  assert.ok(chrome, "built pages exist but no Chrome was found (set CHROME_BIN): this must fail, not skip");
  server = await serveDist(); base = `http://127.0.0.1:${server.address().port}`;
  browser = await launch(chrome);
}
after(() => { browser?.close(); server?.close(); });

test("pointing at The World shows its pages; the pointer travels from the header into the list without it closing; leaving shuts it; a one-door seat shows nothing", { skip: SKIP }, async () => {
  await setup();
  const p = await openPage(browser, base, "/docs/", { width: 1440 });
  await p.until(`!document.querySelector(${JSON.stringify(BTN("world"))}).hidden`, "the script");
  assert.deepEqual(await p.evalJs(ANY_SHOWN), [], "nothing is open at rest");
  const head = await p.pointAt(SEAT("world"));
  await p.until(SHOWN("world"), "The World's list, pointed at");
  assert.equal(await p.evalJs(`document.querySelector(${JSON.stringify(BTN("world"))}).getAttribute("aria-expanded")`), "true", "shown by pointing, and its button says so");
  assert.deepEqual(await p.evalJs(`[...document.querySelectorAll(${JSON.stringify(LIST("world") + " a")})].map((a) => a.textContent.trim().replace(/\\s*beta$/, ""))`), EXPECT_WORLD, "its pages, in the rail source's order");
  // THE POINTER'S PATH: from the header's centre to the first page's centre, in small steps; the list stays shown at every one
  const firstRow = await p.centre(LIST("world") + " li:first-child a");
  for (let i = 1; i <= 16; i++) {
    await p.move(head.x + ((firstRow.x - head.x) * i) / 16, head.y + ((firstRow.y - head.y) * i) / 16);
    assert.equal(await p.evalJs(SHOWN("world")), true, `the list closed on the way down, at step ${i} of 16`);
  }
  // its words read on its own surface (computed colour against the list's opaque background)
  const contrast = await p.evalJs(`(() => { const rgb = (s) => (s.match(/[\\d.]+/g) || []).map(Number); const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const l = document.querySelector(${JSON.stringify(LIST("world"))}), bg = rgb(getComputedStyle(l).backgroundColor);
    return [...l.querySelectorAll("a")].map((a) => { const c = rgb(getComputedStyle(a).color), al = c[3] ?? 1, m = c.slice(0, 3).map((v, i) => v * al + bg[i] * (1 - al)); const [x, y] = [lum(m), lum(bg)].sort((p, q) => q - p); return { t: a.textContent.trim(), r: (x + 0.05) / (y + 0.05), bgA: bg[3] ?? 1 }; }); })()`);
  for (const c of contrast) { assert.equal(c.bgA, 1, "the list's surface is opaque"); assert.ok(c.r >= 4.5, `"${c.t}" reads at ${c.r.toFixed(1)}:1`); }
  await p.move(720, 700);
  await p.until(`!${SHOWN("world")}`, "the list shut, the pointer gone");
  assert.equal(await p.evalJs(`document.querySelector(${JSON.stringify(BTN("world"))}).getAttribute("aria-expanded")`), "false", "and its button says so");
  await p.pointAt(SEAT("mail"));
  await new Promise((r) => setTimeout(r, 200));
  assert.deepEqual(await p.evalJs(ANY_SHOWN), [], "The Mail has no pages to list: nothing opens");
  assert.equal(await p.evalJs(`document.querySelector(${JSON.stringify(SEAT("mail"))}).closest(".pm-rail-seat")`), null, "and it has no control");
  await p.close();
});

test("pointed at, Tabbed into, then the pointer moves away: the list and the focused page stay until focus leaves or Escape", { skip: SKIP }, async () => {
  await setup();
  const p = await openPage(browser, base, "/docs/", { width: 1440 });
  await p.until(`!document.querySelector(${JSON.stringify(BTN("world"))}).hidden`, "the script");
  const expanded = () => p.evalJs(`document.querySelector(${JSON.stringify(BTN("world"))}).getAttribute("aria-expanded")`);
  await p.pointAt(SEAT("world"));
  await p.until(SHOWN("world"), "The World's list, pointed at");
  let at = null;
  for (let i = 0; i < 40 && at !== EXPECT_WORLD[0]; i++) { await p.press("Tab"); at = await p.evalJs(FOCUS); }
  assert.equal(at, EXPECT_WORLD[0], "real Tab reaches the pointed-at list's first page");
  await p.press("Tab");
  assert.equal(await p.evalJs(FOCUS), EXPECT_WORLD[1]);
  await p.move(720, 700);
  await new Promise((r) => setTimeout(r, 200));
  assert.equal(await p.evalJs(SHOWN("world")), true, "the pointer left, but keyboard focus is still using the list");
  assert.equal(await p.evalJs(FOCUS), EXPECT_WORLD[1], "and the focused page is still focused, on screen");
  assert.equal(await p.evalJs(`document.activeElement.getClientRects().length > 0`), true, "not stranded in a hidden list");
  assert.equal(await expanded(), "true", "the button says the list is shown");
  await p.pointAt(SEAT("docs"));
  await new Promise((r) => setTimeout(r, 200));
  assert.deepEqual(await p.evalJs(ANY_SHOWN), ["pm-rail-pages-world"], "pointing at another seat leaves the list focus is using");
  await p.move(720, 700);
  for (let i = 2; i < EXPECT_WORLD.length; i++) await p.press("Tab");
  await p.press("Tab");
  assert.equal(await p.evalJs(FOCUS), "The Mail", "Tab past the last page");
  await p.until(`!${SHOWN("world")}`, "focus leaving lets the list go");
  assert.equal(await expanded(), "false");
  // again, closed by Escape: point, Shift-Tab back into the list's last page, pointer away, Escape
  await p.pointAt(SEAT("world"));
  await p.until(SHOWN("world"), "pointed at again");
  await p.press("Tab", { shift: true });
  assert.equal(await p.evalJs(FOCUS), EXPECT_WORLD.at(-1), "Shift-Tab from the next seat enters the shown list at its last page");
  await p.move(720, 700);
  await new Promise((r) => setTimeout(r, 200));
  assert.equal(await p.evalJs(SHOWN("world")), true, "held by focus, the pointer gone");
  await p.press("Escape");
  await p.until(`!${SHOWN("world")}`, "Escape lets it go");
  assert.equal(await p.evalJs(FOCUS), "button:pm-rail-pages-world", "focus returns to the button");
  assert.equal(await expanded(), "false");
  await p.close();
});

// The race the test above lost on CI 1 run in 3 (runs 45410445933, 45423133313): Tab lands on The Town's button, its "pages" word shows over
// The World's name, under the resting mouse; when the browser re-hit-tests (it does so on its own after a layout change, at its own time)
// the mouse is "on" The Town, so The World's list goes and The Town's comes, and the next Tabs skip The World's pages. A zero-distance mouse
// move forces that re-hit-test now, so this fails every time the button takes the pointer, not one time in three.
test("a mouse resting on The World keeps The World while Tab passes The Town's button: the shown button never takes the pointer", { skip: SKIP }, async () => {
  await setup();
  const p = await openPage(browser, base, "/docs/", { width: 1440 });
  await p.until(`!document.querySelector(${JSON.stringify(BTN("town"))}).hidden`, "the script");
  const head = await p.pointAt(SEAT("world"));
  await p.until(SHOWN("world"), "The World's list, pointed at");
  let at = null;
  for (let i = 0; i < 40 && at !== "button:pm-rail-pages-town"; i++) { await p.press("Tab"); at = await p.evalJs(FOCUS); }
  assert.equal(at, "button:pm-rail-pages-town", "Tab reaches The Town's button");
  const pill = await p.evalJs(`(() => { const b = document.querySelector(${JSON.stringify(BTN("town"))}).getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom }; })()`);
  assert.ok(pill.l <= head.x && head.x <= pill.r && pill.t <= head.y && head.y <= pill.b,
    `control: the shown button lies under the resting mouse (${JSON.stringify({ pill, head })}), so this test can see the race`);
  await p.move(head.x, head.y);
  await new Promise((r) => setTimeout(r, 200));
  assert.equal(await p.evalJs(`!!document.elementFromPoint(${head.x}, ${head.y})?.closest(${JSON.stringify(BTN("town"))})`), false, "the mouse is not on The Town's button");
  assert.deepEqual(await p.evalJs(ANY_SHOWN), ["pm-rail-pages-world"], "The World's list stays, The Town's doesn't come");
  const seen = [];
  for (let i = 0; i < 2 + EXPECT_WORLD.length; i++) { await p.press("Tab"); seen.push(await p.evalJs(FOCUS)); }
  assert.deepEqual(seen.slice(2), EXPECT_WORLD, "and Tab walks on through The World's link, its button, then its pages");
  await p.close();
});

test("the keyboard reaches the seat, its button and its pages by Tab and Shift-Tab; a shut list is not in the tab order; Escape shuts it onto its button", { skip: SKIP }, async () => {
  await setup();
  const p = await openPage(browser, base, "/docs/", { width: 1440 });
  await p.until(`!document.querySelector(${JSON.stringify(BTN("world"))}).hidden`, "the script");
  // NO CARET: nothing drawn in a seat but its own link's words, and the button out of sight (it covers no pixel) until it is focused
  const looks = () => p.evalJs(`[...document.querySelectorAll("[data-rail-more]")].map((b) => { const r = b.getBoundingClientRect(), w = b.querySelector(".pm-rail-more-word");
    return { w: Math.round(r.width), h: Math.round(r.height), clipped: getComputedStyle(b).clipPath !== "none", svg: b.querySelectorAll("svg").length,
      word: w ? Math.round(w.getBoundingClientRect().width) : -1, wordText: w?.textContent.trim(), focused: b === document.activeElement }; })`);
  for (const b of await looks()) assert.deepEqual([b.w <= 1, b.h <= 1, b.clipped, b.svg], [true, true, true, 0], `a button is in sight at rest: ${JSON.stringify(b)}`);
  assert.equal(await p.evalJs(`[...document.querySelectorAll(".pm-rail-seat")].map((s) => s.innerText).join("|")`).then((t) => /[▾▼⌄⌃›❯▸▿]/.test(t)), false, "no caret character in a seat");
  let at = null;
  for (let i = 0; i < 40 && at !== "The World"; i++) { await p.press("Tab"); at = await p.evalJs(FOCUS); }
  assert.equal(at, "The World", "Tab reaches The World's own link");
  await p.press("Tab");
  assert.equal(await p.evalJs(FOCUS), "button:pm-rail-pages-world", "then its button");
  assert.equal(await p.evalJs(`document.activeElement.getAttribute("aria-expanded")`), "false");
  const shown = (await looks()).find((b) => b.focused);
  assert.deepEqual([shown.w > 10, shown.h > 10, shown.clipped, shown.word > 10, shown.wordText], [true, true, false, true, "pages"],
    `focused, the button is in sight and says what it opens: ${JSON.stringify(shown)}`);
  await p.press("Tab");
  assert.equal(await p.evalJs(FOCUS), "The Mail", "a SHUT list's pages are skipped: Tab goes on to the next seat");
  await p.press("Tab", { shift: true });
  assert.equal(await p.evalJs(FOCUS), "button:pm-rail-pages-world", "Shift-Tab comes back to the button");
  await p.press("Enter");
  await p.until(SHOWN("world"), "Enter opens the list");
  assert.equal(await p.evalJs(`document.activeElement.getAttribute("aria-expanded")`), "true", "and the button says so");
  const seen = [];
  for (let i = 0; i < EXPECT_WORLD.length; i++) { await p.press("Tab"); seen.push(await p.evalJs(FOCUS)); }
  assert.deepEqual(seen, EXPECT_WORLD, "Tab walks its pages in order");
  await p.press("Tab", { shift: true });
  assert.equal(await p.evalJs(FOCUS), EXPECT_WORLD.at(-2), "Shift-Tab walks back up the list");
  await p.press("Tab"); await p.press("Tab");
  assert.equal(await p.evalJs(FOCUS), "The Mail", "Tab past the last page reaches the next seat");
  await p.until(`!${SHOWN("world")}`, "and the list shuts behind it");
  await p.press("Tab", { shift: true });
  await p.press(" ");
  await p.until(SHOWN("world"), "Space opens it too");
  await p.press("Tab");
  assert.equal(await p.evalJs(FOCUS), EXPECT_WORLD[0]);
  await p.press("Escape");
  await p.until(`!${SHOWN("world")}`, "Escape shuts it");
  assert.equal(await p.evalJs(FOCUS), "button:pm-rail-pages-world", "focus lands on the button, not in a hidden list");
  await p.close();
});

test("on a phone (touch, no hover) the first tap on a seat opens its list inside the screen, a tap elsewhere shuts it, and a second tap on the seat goes to the seat", { skip: SKIP }, async () => {
  await setup();
  const p = await openPage(browser, base, "/docs/stamps/", { width: 390, height: 844, touch: true });
  await p.until(`!document.querySelector(${JSON.stringify(BTN("world"))}).hidden`, "the script");
  assert.equal(await p.evalJs(`matchMedia("(hover: hover) and (pointer: fine)").matches`), false, "this is a device that cannot hover");
  const c = await p.centre(BTN("world"));
  assert.equal(c.hit, false, "there is no button to tap: it is out of sight");
  const path = () => p.evalJs("location.pathname");
  await p.tap(SEAT("world"));
  await p.until(SHOWN("world"), "the first tap on The World opens its list");
  assert.equal(await path(), "/docs/stamps/", "and the page stays where it was");
  assert.equal(await p.evalJs(`document.querySelector(${JSON.stringify(BTN("world"))}).getAttribute("aria-expanded")`), "true", "the button says the list is shown");
  const r = await p.evalJs(`(() => { const b = document.querySelector(${JSON.stringify(LIST("world"))}).getBoundingClientRect(); return { l: b.left, r: b.right, w: innerWidth, sw: document.documentElement.scrollWidth }; })()`);
  assert.ok(r.l >= 0 && r.r <= r.w, `the list runs off a 390 screen: ${JSON.stringify(r)}`);
  assert.ok(r.sw <= r.w, `the page scrolls sideways: ${JSON.stringify(r)}`);
  await p.tap("main h1");
  await p.until(`!${SHOWN("world")}`, "a tap elsewhere shuts it");
  await p.tap(SEAT("world"));
  await p.until(SHOWN("world"), "and the next first tap opens it again");
  await p.tap("main h1");                                    // (at 390 The World's open list lies over Docs, as a reader would see)
  await p.until(`!${SHOWN("world")}`, "shut again");
  await p.tap(SEAT("docs"));
  await p.until(SHOWN("docs"), "a first tap on Docs opens Docs' list");
  assert.deepEqual(await p.evalJs(ANY_SHOWN), ["pm-rail-pages-docs"], "and only Docs'");
  assert.equal(await path(), "/docs/stamps/", "still on the page");
  const landed = p.landing(); landed.catch(() => {});
  await p.tap(SEAT("docs"));
  assert.equal(new URL(await landed).pathname, "/docs/", "the second tap on the seat, its list shown, goes to the seat");
  await p.close();
});

test("every list fits the window at 1440 and at 390; the rail still counts every seat, and only the seats, in at most two rows; nothing scrolls sideways", { skip: SKIP }, async () => {
  await setup();
  for (const [width, height, touch] of [[1440, 900, false], [390, 844, true]]) {
    const p = await openPage(browser, base, "/docs/", { width, height, touch });
    await p.until(`!document.querySelector(${JSON.stringify(BTN("world"))}).hidden`, "the script");
    const seats = await p.evalJs(`(() => { const tops = [...document.querySelectorAll(".pm-townnav-links [data-rail-top]")].map((a) => Math.round(a.getBoundingClientRect().top)); return { n: tops.length, rows: new Set(tops).size }; })()`);
    assert.equal(seats.n, RAIL.filter((s) => !s.lantern).length, `${width}: the nav's seats, every one, and no list's link among them`);
    if (width === 1440) assert.ok(seats.rows <= 2, `${width}: the seats sit in ${seats.rows} rows`);
    for (const key of ["town", "world", "docs"]) {
      await p.evalJs(`document.querySelector(${JSON.stringify(BTN(key))}).click(), true`);
      await p.until(SHOWN(key), `${key}'s list at ${width}`);
      const m = await p.evalJs(`(() => { const b = document.querySelector(${JSON.stringify(LIST(key))}).getBoundingClientRect(); return { l: Math.round(b.left), r: Math.round(b.right), w: innerWidth, sw: document.documentElement.scrollWidth }; })()`);
      assert.ok(m.l >= 0 && m.r <= m.w, `${width}: ${key}'s list leaves the window: ${JSON.stringify(m)}`);
      assert.ok(m.sw <= m.w, `${width}: ${key}'s list scrolls the page sideways: ${JSON.stringify(m)}`);
    }
    await p.close();
  }
});

// (Without the script, pointing shows a list only where the device's media report says it can hover. This headless browser reports no
// hover and no fine pointer, and CDP cannot emulate those two features, so that half is held by the stylesheet pin in the node test.)
test("with JavaScript off the seats are plain links to their own pages, with no button, and every list is shut", { skip: SKIP }, async () => {
  await setup();
  const p = await openPage(browser, base, "/docs/", { width: 1440, noScript: true });
  assert.equal(await p.evalJs(`[...document.querySelectorAll("[data-rail-more]")].every((b) => b.hidden && getComputedStyle(b).display === "none")`), true, "no button without the script");
  assert.deepEqual(await p.evalJs(`[...document.querySelectorAll(".pm-townnav-links [data-rail-top]")].map((a) => a.getAttribute("href"))`),
    RAIL.filter((s) => !s.lantern).map((s) => s.href), "every seat is its own plain link");
  assert.deepEqual(await p.evalJs(ANY_SHOWN), [], "and no list covers the page");
  await p.close();
});
