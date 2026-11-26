// sheet-names-browser.test.mjs — CORE-175 RENDERED: a household names who each reference sheet shows, on the built appearance page.
//
//   node --test test/sheet-names-browser.test.mjs        (a browser test: run it through the heavy queue, `run-heavy`)
//
// It serves the built site (dist-town/; the built-pages CI job builds it first), drives headless Chrome over CDP (Node's global WebSocket; a throwaway
// profile) and answers the office ITSELF through CDP's Fetch domain with an INVENTED office that keeps POS-1202's contract (accepted Office #1213,
// f0ea0fab, src/depictions.mjs § sheetNameOf / keepSheet, src/edit.mjs § updateProfileAct): PATCH /profile/{h} { sheet, sheet_name } sets or corrects
// a kept sheet's name, "" or blank clears it, omission leaves it; trimmed, at most 80 code points, no controls (422); the sheet read carries
// sheets[].name, the keep answer sheet.name; the single anchor never moves. The live office is never touched and nobody really signs in.
//
// THE INVENTED RESIDENTS. The committed data has no invented resident, and this page is built per resident, so the server serves ONE built appearance
// page under two invented handles (`qa-many-test`, a handle that is three people; `qa-solo-test`, one): the build's own bytes with the source
// resident's handle, name and face taken out and the invented one put in. The script, the styles and the markup are the build's; no real resident is
// shown, and /me only ever says this browser's sign-in holds an invented handle. Owning a real resident is never mocked.
//
// WHAT IT PROVES, with real key events on the real page:
//   · an unnamed one-person sheet reads exactly as before (no label, no box, today's caption and alt); a visitor and another household see names as
//     text and no box; a markup-looking name stays literal text;
//   · the owner (ownerGate: /me holds the handle; never the sheet's own/maker flag, so the town-made sheet gets a box too) names sheet 1, corrects it,
//     clears it, by keyboard: one PATCH each with the kept URL and nothing else; sheet 2, both image URLs and the anchor stay as they were;
//   · 81 code points are refused before the network, 80 emoji are taken; a blank Save on an unnamed sheet sends nothing; the office's 422 and 503
//     are shown in its words with the typed text and the shown name kept, never "cleared" or "saved";
//   · both upload paths: the link path with a name keeps it on the same PATCH; the file path with the box untouched sends the bare { sheet }; a
//     re-kept named URL with no name keeps its name; a refused keep keeps the typed name;
//   · an unanswerable sheet read (503) is said in the office's words, never "no sheet" or unnamed;
//   · Tab walks a name box in order; a phone frame does not scroll sideways.
//
// WITHOUT dist-town the test SKIPS and says so; WITH built pages and no browser it FAILS.

import test, { after } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import http from "node:http";
import { homedir, tmpdir } from "node:os";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DIST = join(ROOT, "dist-town");
const SOURCE = (() => {
  try { const d = readdirSync(join(DIST, "residents")).sort().find((h) => existsSync(join(DIST, "residents", h, "appearance", "index.html"))); return d ? join(DIST, "residents", d, "appearance", "index.html") : null; }
  catch { return null; }
})();
const SKIP = SOURCE ? false : "no built pages (dist-town/): nothing to render";

const MANY = "qa-many-test", SOLO = "qa-solo-test";
const NAMES = { [MANY]: "Qa Many", [SOLO]: "Qa Solo" };

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

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** The built appearance page, as the invented resident's: the source's handle, name and face out, the invented ones in. */
function inventedPage(handle) {
  let html = readFileSync(SOURCE, "utf8");
  const real = /data-ap-handle="([^"]+)"/.exec(html)[1];
  const name = /<h1[^>]*>([^<]+)<\/h1>/.exec(html)[1];
  html = html.replace(/(<div class="ap-face"[^>]*>)[\s\S]*?(<\/div>)/, `$1<span>Q</span>$2`)
    .replace(new RegExp(`(?<![a-z0-9-])${esc(real)}(?![a-z0-9-])`, "g"), handle)
    .replace(new RegExp(`(?<![A-Za-z])${esc(name)}(?![a-z])`, "g"), NAMES[handle])
    .replace(/(<script type="application\/json" data-ap-house[^>]*>)[^<]*/, `$1${JSON.stringify({ likeness: { answer: "yes", at: "2026-11-01T00:00:00Z" }, count: handle === MANY ? 3 : 1 })}`);
  assert.ok(!html.includes(`data-ap-handle="${real}"`) && html.includes(`data-ap-handle="${handle}"`), "the invented handle replaced the source's");
  return html;
}

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2" };
function serveDist() {
  const server = http.createServer((req, res) => {
    const p = decodeURIComponent((req.url || "/").split("?")[0]);
    const inv = /^\/residents\/(qa-many-test|qa-solo-test)\/appearance\/?$/.exec(p);
    if (inv) { res.writeHead(200, { "content-type": MIME[".html"] }); return res.end(inventedPage(inv[1])); }
    let file = normalize(join(DIST, p));
    if (!file.startsWith(DIST + sep) && file !== DIST) { res.writeHead(403); return res.end(); }
    try { if (statSync(file).isDirectory()) file = join(file, "index.html"); } catch { /* maybe a file */ }
    if (!existsSync(file)) { res.writeHead(404, { "content-type": "text/plain" }); return res.end("not found"); }
    res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream" });
    res.end(readFileSync(file));
  });
  return new Promise((ok) => server.listen(0, "127.0.0.1", () => ok(server)));
}

async function launch(chrome) {
  const profile = mkdtempSync(join(tmpdir(), "core175-profile-"));
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

// ── the invented office: POS-1202's contract, and nothing else ──────────────────────────────────────────────────────────────────────────
const media = (h, f) => `https://media.postmark.town/media/${h}/${f}`;
// eslint-disable-next-line no-control-regex
const CONTROLS = /[\u0000-\u001f\u007f-\u009f]/;
/** Office src/depictions.mjs § sheetNameOf, as the contract states it: trimmed; "" clears; over 80 code points or a control is a 422. */
function sheetNameOf(raw) {
  const t = String(raw).trim();
  if ([...t].length > 80) return { defect: `a sheet's name is at most 80 characters; this one is ${[...t].length}`, hint: "name who the sheet shows, shortly" };
  if (CONTROLS.test(t)) return { defect: "a sheet's name is one line of text", hint: "take out the line breaks" };
  return { name: t };
}

function officeFor({ handle = MANY, sheets, me = "owner", read = "ok" } = {}) {
  const o = {
    handle, me, read, writes: [], asked: [], refuseNext: null, mediaNext: null, uploads: 0,
    sheets: sheets ?? [
      { id: "s1", url: media(handle, "julian.webp"), made_by: handle, made_at: "2026-11-20T10:00:00Z", own: true },
      { id: "s2", url: media(handle, "vex.webp"), made_by: handle, made_at: "2026-11-21T10:00:00Z", own: true },
    ],
  };
  o.anchor = o.sheets[0]?.url ?? null;
  o.shape = (s) => ({ id: s.id, url: s.url, made_by: s.made_by, made_at: s.made_at, own: s.own, ...(s.name ? { name: s.name } : {}) });
  o.sheetRead = () => ({ read: "sheet", handle: o.handle, household: "qa-house-test", likeness: "given", sheets: o.sheets.map(o.shape), held_until_yes: 0, anchor: o.anchor,
    template: "Make ONE image: a fixture template.", how: "fixture" });
  o.meAnswer = () => (o.me === "owner" ? { handles: [o.handle], household: "qa-house-test", households: { [o.handle]: { slug: "qa-house-test" } } }
    : o.me === "other" ? { handles: ["qa-elsewhere-test"], household: "qa-other-house-test", households: {} } : null);
  o.patch = (body) => {
    if (o.refuseNext) { const r = o.refuseNext; o.refuseNext = null; return r; }
    if (o.me !== "owner") return { status: 403, body: { defect: "that is not your resident" } };
    if (typeof body.sheet !== "string") return { status: 422, body: { defect: "fixture: only the sheet is served here" } };
    let named;
    if ("sheet_name" in body) { const n = sheetNameOf(body.sheet_name ?? ""); if (n.defect) return { status: 422, body: n }; named = n.name; }
    let s = o.sheets.find((x) => x.url === body.sheet);
    if (!s) { s = { id: `s${o.sheets.length + 1}`, url: body.sheet, made_by: o.handle, made_at: "2026-11-26T01:00:00Z", own: true }; o.sheets.push(s); }
    if (named !== undefined) s.name = named || undefined;           // a name sets or corrects; "" clears; omission leaves it
    return { status: 200, body: { updated: ["sheet"], sheet: o.shape(s) } };
  };
  return o;
}

async function openPage(b, base, path, { width = 1440, height = 1000, office, signedIn = true }) {
  const { targetId } = await b.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await b.send("Target.attachToTarget", { targetId, flatten: true });
  const S = (m, p) => b.send(m, p, sessionId);
  await S("Page.enable"); await S("Runtime.enable"); await S("DOM.enable");
  const faults = [];
  b.listeners.push((m) => {
    if (m.sessionId !== sessionId) return;
    if (m.method === "Runtime.exceptionThrown") faults.push(m.params.exceptionDetails?.exception?.description?.split("\n")[0] ?? m.params.exceptionDetails?.text);
  });
  await S("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 600 });
  await S("Page.addScriptToEvaluateOnNewDocument", { source: signedIn
    ? `try { localStorage.setItem("pm.oauth.token", JSON.stringify({ access_token: "invented-token", obtained: Date.now(), expires_in: 3600 })); } catch {}`
    : `try { localStorage.removeItem("pm.oauth.token"); } catch {}` });
  await S("Fetch.enable", { patterns: [{ urlPattern: "*/api/*", requestStage: "Request" }, { urlPattern: "https://media.postmark.town/*", requestStage: "Request" }] });
  b.listeners.push((m) => {
    if (m.sessionId !== sessionId || m.method !== "Fetch.requestPaused") return;
    const { requestId, request } = m.params;
    const u = new URL(request.url);
    const reply = (status, json) => S("Fetch.fulfillRequest", { requestId, responseCode: status,
      responseHeaders: [{ name: "content-type", value: "application/json" }, { name: "access-control-allow-origin", value: "*" }, { name: "cache-control", value: "no-store" }],
      body: Buffer.from(json == null ? "" : JSON.stringify(json)).toString("base64") }).catch(() => {});
    if (u.hostname === "media.postmark.town") return S("Fetch.fulfillRequest", { requestId, responseCode: 200, responseHeaders: [{ name: "content-type", value: "image/png" }], body: PNG.toString("base64") }).catch(() => {});
    office.asked.push(`${request.method} ${u.pathname}`);
    const h = encodeURIComponent(office.handle);
    if (request.method === "GET" && u.pathname === `/api/residents/${h}`) return reply(200, { handle: office.handle, appearance: { body: "Three people share this fixture handle." } });
    if (request.method === "GET" && u.pathname === `/api/residents/${h}/sheet`) {
      if (office.read === "503") return reply(503, { defect: "the sheet names can't be read just now", hint: "try again in a minute" });
      return reply(200, office.sheetRead());
    }
    if (request.method === "GET" && u.pathname === "/api/me") { const me = office.meAnswer(); return me ? reply(200, me) : reply(401, { defect: "fixture: signed out" }); }
    if (request.method === "PATCH" && u.pathname === `/api/profile/${h}`) {
      const body = JSON.parse(request.postData || "{}");
      office.writes.push({ path: u.pathname, body });
      const r = office.patch(body);
      return reply(r.status, r.body);
    }
    if (request.method === "POST" && u.pathname === "/api/media") {
      office.uploads += 1;
      office.writes.push({ path: "/media" + u.search, body: (request.headers["Content-Type"] ?? request.headers["content-type"] ?? "").startsWith("application/json") ? JSON.parse(request.postData || "{}") : "(bytes)" });
      const url = office.mediaNext ?? media(office.handle, `upload-${office.uploads}.webp`); office.mediaNext = null;
      return reply(200, { url, via: "fixture" });
    }
    return S("Fetch.failRequest", { requestId, errorReason: "BlockedByClient" }).catch(() => {});
  });
  await S("Page.navigate", { url: base + path });
  const js = async (expr) => { const r = await S("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(`page: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`); return r.result.value; };
  const until = async (expr, what, ms = 15000) => {
    const t0 = Date.now();
    for (;;) {
      try { if (await js(expr)) return; } catch { /* not yet */ }
      if (Date.now() - t0 > ms) throw new Error(`waited ${ms} ms for ${what}; the office was asked: ${office.asked.slice(-5).join(", ")}; page faults: ${faults.join(" | ") || "none"}`);
      await new Promise((r) => setTimeout(r, 100));
    }
  };
  const key = async (k, mods = 0) => {
    const codes = { Enter: [13, "\r"], Tab: [9, ""], " ": [32, " "] };
    const [vk, text] = codes[k] ?? [0, ""];
    await S("Input.dispatchKeyEvent", { type: "keyDown", key: k, code: k === " " ? "Space" : k, windowsVirtualKeyCode: vk, text: text || undefined, modifiers: mods });
    await S("Input.dispatchKeyEvent", { type: "keyUp", key: k, code: k === " " ? "Space" : k, windowsVirtualKeyCode: vk, modifiers: mods });
  };
  const type = async (sel, text) => { await js(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); e.focus(); e.select?.(); return true; })()`); await S("Input.insertText", { text }); };
  const clearBox = (sel) => js(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); e.focus(); e.value = ""; return true; })()`);
  const setFile = async (sel, file) => {
    const { root } = await S("DOM.getDocument", { depth: -1, pierce: true });
    const { nodeId } = await S("DOM.querySelector", { nodeId: root.nodeId, selector: sel });
    await S("DOM.setFileInputFiles", { nodeId, files: [file] });
  };
  return { S, js, until, key, type, clearBox, setFile, faults, close: () => b.send("Target.closeTarget", { targetId }).catch(() => {}) };
}

// a small real PNG (a gold square): the sheets' pixels and the file path's upload
function pngBytes() {
  const w = 24, h = 16, raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = y * (w * 3 + 1) + 1 + x * 3; raw[o] = 232; raw[o + 1] = 196; raw[o + 2] = 139; }
  const T = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = T[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
const PNG = pngBytes();

let browser = null, server = null, base = null, picDir = null;
async function setup() {
  if (browser) return;
  const chrome = findChrome();
  assert.ok(chrome, "built pages are here but no Chrome/Chromium was found: this test fails rather than skip, so the built-pages job cannot pass on a skip");
  server = await serveDist();
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await launch(chrome);
}
after(() => { browser?.close(); server?.close(); if (picDir) rmSync(picDir, { recursive: true, force: true }); });

const PAGE = (h) => `/residents/${h}/appearance/`;
const figs = `[...document.querySelectorAll("[data-ap-sheets] figure")]`;
/** What each painted sheet shows a reader: its caption, its name span, its alt and image URL, and whether its box shows. */
const sheetsNow = `${figs}.map((f) => ({ cap: f.querySelector("figcaption").textContent, name: f.querySelector("[data-ap-sheet-name]")?.textContent ?? null,
  alt: f.querySelector("img").alt, src: f.querySelector("img").getAttribute("src"), href: f.querySelector("a").getAttribute("href"),
  box: !!f.querySelector("[data-ap-name-edit]") && !f.querySelector("[data-ap-name-edit]").hidden, input: f.querySelector("[data-ap-name-input]")?.value ?? null,
  status: f.querySelector("[data-ap-name-status]")?.textContent ?? "", tags: [...f.querySelector("figcaption").querySelectorAll("*")].map((e) => e.tagName.toLowerCase()) }))`;
const painted = (n) => `${figs}.length === ${n}`;
const sheetPatches = (o) => o.writes.filter((w) => w.path.startsWith("/api/profile/")).map((w) => w.body);

test("UNNAMED, ONE PERSON: today's presentation exactly, no label and no box; a visitor's page never asks /me", { skip: SKIP }, async () => {
  await setup();
  const office = officeFor({ handle: SOLO, sheets: [{ id: "s1", url: media(SOLO, "one.webp"), made_by: SOLO, made_at: "2026-11-20T10:00:00Z", own: true }] });
  const p = await openPage(browser, base, PAGE(SOLO), { office, signedIn: false });
  try {
    await p.until(painted(1), "the one sheet");
    const [s] = await p.js(sheetsNow);
    assert.equal(s.cap, "the household's own", "the caption is today's words, nothing more");
    assert.equal(s.name, null); assert.deepEqual(s.tags, [], "no label element at all");
    assert.equal(s.alt, `${SOLO}'s reference sheet`);
    assert.equal(s.box, false, "no box for a visitor");
    assert.equal(await p.js(`document.querySelector("[data-ap-set]").hidden`), true);
    assert.equal(await p.js(`document.querySelector("[data-ap-sheets-unread]").hidden`), true);
    assert.equal(office.asked.includes("GET /api/me"), false, "no token, no /me");
    assert.deepEqual(p.faults, []);
  } finally { await p.close(); }
});

test("NAMES ARE TEXT: a visitor and another household see names, a markup-looking one literally, and no box", { skip: SKIP }, async () => {
  await setup();
  const evil = `<img src=x onerror="window.__core175=1"><b>Vex</b>`;
  for (const me of ["visitor", "other"]) {
    const office = officeFor({ me: me === "other" ? "other" : null });
    office.sheets[0].name = evil;
    const p = await openPage(browser, base, PAGE(MANY), { office, signedIn: me === "other" });
    try {
      await p.until(painted(2), "two sheets");
      // let the gate answer (another household: /me says no) before reading what shows
      for (let t = 0; me === "other" && !office.asked.includes("GET /api/me") && t < 100; t++) await new Promise((r) => setTimeout(r, 100));
      await new Promise((r) => setTimeout(r, 300));
      const [a, b] = await p.js(sheetsNow);
      assert.equal(a.name, evil, `${me}: the name is the literal text`);
      assert.equal(a.cap, `${evil} · the household's own`);
      assert.deepEqual(a.tags, ["span"], `${me}: the name never became markup`);
      assert.equal(a.alt, `${MANY}'s reference sheet: ${evil}`);
      assert.equal(b.name, null); assert.equal(b.cap, "the household's own", "the unnamed sheet beside it reads as today");
      assert.equal(a.box || b.box, false, `${me}: no box; the gate is /me, not the sheet's own flag (both sheets are own: true)`);
      assert.equal(await p.js(`window.__core175 === undefined && !document.querySelector("figcaption img, figcaption b")`), true);
      if (me === "other") assert.ok(office.asked.includes("GET /api/me"), "another household was asked /me and refused");
      assert.deepEqual(office.writes, []);
    } finally { await p.close(); }
  }
});

test("THE FALSIFIER: the owner names sheet 1, corrects it, clears it, by keyboard; sheet 2, both URLs and the anchor never move", { skip: SKIP }, async () => {
  await setup();
  const office = officeFor();
  office.sheets.push({ id: "s3", url: media("the-town", "made.webp"), made_by: "the-town", made_at: "2026-11-01T10:00:00Z", own: false });
  const p = await openPage(browser, base, PAGE(MANY), { office });
  try {
    await p.until(painted(3), "three sheets");
    await p.until(`${figs}.every((f) => !f.querySelector("[data-ap-name-edit]").hidden)`, "the owner's boxes, one per shown sheet, the town-made one too");
    const before = await p.js(sheetsNow);
    const anchor = office.anchor;
    const box1 = "#ap-name-0";
    // the label names the box; Tab walks box, Save; Clear is not offered while unnamed
    assert.equal(await p.js(`document.querySelector('label[for="ap-name-0"]').textContent`), "Who this sheet shows");
    assert.equal(await p.js(`document.querySelector("[data-ap-name-edit]").getAttribute("aria-label")`), "Name sheet 1 of 3");
    await p.js(`document.querySelector("${box1}").focus(), true`);
    await p.key("Tab");
    assert.equal(await p.js(`document.activeElement.dataset.apNameSave !== undefined && document.activeElement.closest("figure") === ${figs}[0]`), true, "Tab from the box reaches its Save");
    await p.key("Tab");
    assert.equal(await p.js(`document.activeElement.closest("figure") === ${figs}[1] && document.activeElement.tagName === "A"`), true,
      `Clear is not offered while unnamed: Tab goes on to the next sheet (its full-size link); focus is on ${await p.js(`document.activeElement.outerHTML.slice(0, 120)`)}`);
    assert.equal(await p.js(`getComputedStyle(${figs}[0].querySelector("[data-ap-name-clear]")).display`), "none", "an unnamed sheet's Clear does not show (.pm-btn's display once beat [hidden])");
    // 1. NAME, by typing and Enter
    await p.type(box1, "Julian");
    await p.key("Enter");
    await p.until(`${figs}[0].querySelector("[data-ap-sheet-name]")?.textContent === "Julian"`, "the name painted from the office's answer");
    let now = await p.js(sheetsNow);
    assert.equal(now[0].cap, "Julian · the household's own"); assert.equal(now[0].alt, `${MANY}'s reference sheet: Julian`); assert.equal(now[0].status, "Saved.");
    // 2. CORRECT
    await p.type(box1, "Vex Alaric");
    await p.key("Enter");
    await p.until(`${figs}[0].querySelector("[data-ap-sheet-name]")?.textContent === "Vex Alaric"`, "the corrected name");
    // Clear is offered now, and reachable: box → Save → Clear
    await p.js(`document.querySelector("${box1}").focus(), true`);
    await p.key("Tab"); await p.key("Tab");
    assert.equal(await p.js(`document.activeElement.dataset.apNameClear !== undefined`), true, "Tab reaches Clear name once named");
    // 3. CLEAR, by Space on the focused Clear button
    await p.key(" ");
    await p.until(`!${figs}[0].querySelector("[data-ap-sheet-name]")`, "the name cleared");
    now = await p.js(sheetsNow);
    assert.equal(now[0].cap, "the household's own", "cleared reads as today"); assert.equal(now[0].alt, `${MANY}'s reference sheet`);
    assert.equal(now[0].input, ""); assert.equal(now[0].status, "Name cleared.");
    assert.equal(await p.js(`${figs}[0].querySelector("[data-ap-name-clear]").hidden`), true);
    // the town-made sheet is the household's to name too (the gate, not the maker)
    await p.type("#ap-name-2", "Alaric");
    await p.key("Enter");
    await p.until(`${figs}[2].querySelector("[data-ap-sheet-name]")?.textContent === "Alaric"`, "the town-made sheet named");
    assert.equal((await p.js(sheetsNow))[2].cap, "Alaric · the town's", "its maker and source still read whole");
    // what travelled: one PATCH per act, the kept URL and the name, nothing else; no upload
    assert.deepEqual(sheetPatches(office), [
      { sheet: before[0].src, sheet_name: "Julian" }, { sheet: before[0].src, sheet_name: "Vex Alaric" }, { sheet: before[0].src, sheet_name: "" }, { sheet: before[2].src, sheet_name: "Alaric" }]);
    assert.equal(office.uploads, 0, "naming a kept sheet never uploads");
    now = await p.js(sheetsNow);
    assert.deepEqual(now.map((s) => [s.src, s.href]), before.map((s) => [s.src, s.href]), "both image URLs (and the town's) unchanged");
    assert.deepEqual(now[1], before[1], "sheet 2 untouched");
    assert.equal(office.anchor, anchor, "the anchor never moved");
    assert.equal(office.sheets.length, 3, "no sheet added");
    assert.deepEqual(p.faults, []);
  } finally { await p.close(); }
});

test("REFUSALS KEEP WHAT WAS TYPED: 81 code points stop before the network, 80 emoji go; blank on unnamed sends nothing; a 422 and a 503 are the office's words", { skip: SKIP }, async () => {
  await setup();
  const office = officeFor();
  office.sheets[1].name = "Vex";
  const p = await openPage(browser, base, PAGE(MANY), { office });
  try {
    await p.until(`${painted(2)} && !${figs}[0].querySelector("[data-ap-name-edit]").hidden`, "the owner's boxes");
    // a blank Save on an unnamed sheet: nothing sent, a prompt
    await p.js(`document.querySelector("#ap-name-0").focus(), true`); await p.key("Enter");
    await p.until(`${figs}[0].querySelector("[data-ap-name-status]").textContent !== ""`, "the prompt");
    assert.equal((await p.js(sheetsNow))[0].status, "Type who this sheet shows, then save.");
    // 81 astral characters (162 UTF-16 units): refused here, in the office's measure, with nothing sent
    await p.type("#ap-name-0", "🐦".repeat(81)); await p.key("Enter");
    await p.until(`/at most 80/.test(${figs}[0].querySelector("[data-ap-name-status]").textContent)`, "the length said");
    assert.equal((await p.js(sheetsNow))[0].input, "🐦".repeat(81), "the typed text stays");
    assert.equal(sheetPatches(office).length, 0, "nothing sent for a blank or an over-long name");
    // 80 of them (160 UTF-16 units, which a maxlength=80 would have cut): taken
    await p.type("#ap-name-0", "🐦".repeat(80)); await p.key("Enter");
    await p.until(`${figs}[0].querySelector("[data-ap-sheet-name]")?.textContent === ${JSON.stringify("🐦".repeat(80))}`, "80 code points saved");
    // the office's own 422: shown whole; the typed correction and the shown name both kept
    office.refuseNext = { status: 422, body: { defect: "a sheet's name is one line of text", hint: "take out the line breaks" } };
    await p.type("#ap-name-0", "Julian"); await p.key("Enter");
    await p.until(`/422/.test(${figs}[0].querySelector("[data-ap-name-status]").textContent)`, "the 422 said");
    let s = (await p.js(sheetsNow))[0];
    assert.match(s.status, /The office said no while naming the sheet \(422\): a sheet's name is one line of text: take out the line breaks/);
    assert.equal(s.input, "Julian", "the typed text is kept"); assert.equal(s.name, "🐦".repeat(80), "the shown name is what stands");
    assert.equal(await p.js(`${figs}[0].querySelector("[data-ap-name-status]").classList.contains("ap-name-status-warn")`), true);
    // a 503 on a CLEAR of sheet 2: never "cleared", never unnamed
    office.refuseNext = { status: 503, body: { defect: "the sheet names can't be read just now", hint: "try again in a minute" } };
    await p.js(`${figs}[1].querySelector("[data-ap-name-clear]").click(), true`);
    await p.until(`/503/.test(${figs}[1].querySelector("[data-ap-name-status]").textContent)`, "the 503 said");
    s = (await p.js(sheetsNow))[1];
    assert.match(s.status, /\(503\): the sheet names can't be read just now: try again in a minute/);
    assert.doesNotMatch(s.status, /cleared|saved/i);
    assert.equal(s.name, "Vex", "still shown named"); assert.equal(s.input, "Vex");
    assert.equal(office.sheets[1].name, "Vex");
    assert.deepEqual(p.faults, []);
  } finally { await p.close(); }
});

test("A CLEAR THE OFFICE DIDN'T ACKNOWLEDGE: 2xx with no body, or no sheet, keeps the name, the alt, the box and Clear; a real acknowledgement still clears", { skip: SKIP }, async () => {
  await setup();
  const office = officeFor();
  office.sheets[0].name = "Julian";
  const p = await openPage(browser, base, PAGE(MANY), { office });
  try {
    await p.until(`${painted(2)} && !${figs}[0].querySelector("[data-ap-name-edit]").hidden`, "the owner's boxes");
    const before = (await p.js(sheetsNow))[0];
    for (const [what, answer] of [["a 200 with no body", { status: 200, body: null }], ["a 200 with no sheet", { status: 200, body: { updated: ["sheet"] } }]]) {
      office.refuseNext = answer;
      await p.js(`${figs}[0].querySelector("[data-ap-name-status]").textContent = "", ${figs}[0].querySelector("[data-ap-name-clear]").click(), true`);
      await p.until(`${figs}[0].querySelector("[data-ap-name-status]").textContent !== "" && !/Saving/.test(${figs}[0].querySelector("[data-ap-name-status]").textContent)`, `the answer to ${what}`);
      const s = (await p.js(sheetsNow))[0];
      assert.equal(s.status, "The office answered, but its answer doesn't show that name as saved. Reload the page to see what stands.", what);
      assert.equal(s.name, "Julian", `${what}: the shown name was erased`); assert.equal(s.cap, before.cap); assert.equal(s.alt, before.alt);
      assert.equal(s.input, "Julian", `${what}: the box was emptied`);
      assert.equal(await p.js(`getComputedStyle(${figs}[0].querySelector("[data-ap-name-clear]")).display !== "none"`), true, `${what}: Clear went away`);
      assert.equal(await p.js(`${figs}[0].querySelector("[data-ap-name-status]").classList.contains("ap-name-status-warn")`), true);
    }
    // the invented office's real acknowledgement of the cleared sheet: cleared, as before
    await p.js(`${figs}[0].querySelector("[data-ap-name-clear]").click(), true`);
    await p.until(`!${figs}[0].querySelector("[data-ap-sheet-name]")`, "the acknowledged clear");
    const s = (await p.js(sheetsNow))[0];
    assert.equal(s.status, "Name cleared."); assert.equal(s.cap, "the household's own"); assert.equal(s.input, "");
    assert.deepEqual(sheetPatches(office).map((b) => b.sheet_name), ["", "", ""], "three clears sent, each the explicit \"\"");
    assert.deepEqual(p.faults, []);
  } finally { await p.close(); }
});

test("BOTH UPLOAD PATHS: a name rides the link path's keep; the file path untouched sends the bare keep; a re-kept named URL keeps its name; a refused keep keeps the typed name", { skip: SKIP }, async () => {
  await setup();
  picDir = mkdtempSync(join(tmpdir(), "core175-pic-"));
  const file = join(picDir, "sheet.png"); writeFileSync(file, PNG);
  const office = officeFor();
  office.sheets[0].name = "Julian";
  const p = await openPage(browser, base, PAGE(MANY), { office });
  try {
    await p.until(`!document.querySelector("[data-ap-set]").hidden && ${painted(2)}`, "the owner's upload section");
    assert.equal(await p.js(`document.querySelector('label[for="ap-sheet-name"]').textContent`), "Who this sheet shows (optional)");
    assert.equal(await p.js(`document.querySelector("#ap-sheet-name").getAttribute("aria-describedby")`), "ap-sheet-name-hint");
    // the link path, named
    await p.type("#ap-sheet-name", "  Alaric ");
    await p.type("#ap-link", "https://example.org/alaric.png");
    await p.js(`document.querySelector("[data-ap-send-link]").click(), true`);
    await p.until(painted(3), "the page reloaded with the new sheet", 20000);
    let w = office.writes.slice(-2);
    assert.deepEqual(w[0].body, { image_url: "https://example.org/alaric.png", by: MANY });
    assert.deepEqual(w[1].body, { sheet: media(MANY, "upload-1.webp"), sheet_name: "Alaric" }, "the name rides the same keep, trimmed");
    assert.equal((await p.js(sheetsNow))[2].name, "Alaric");
    // the file path, the name box untouched: the bare keep, exactly { sheet }
    await p.until(`!document.querySelector("[data-ap-set]").hidden`, "the section again");
    await p.setFile("#ap-file", file);
    await p.js(`document.querySelector("[data-ap-send-file]").click(), true`);
    await p.until(painted(4), "the file's sheet", 20000);
    w = office.writes.slice(-2);
    assert.equal(w[0].path, `/media?by=${MANY}`); assert.equal(w[0].body, "(bytes)");
    assert.deepEqual(w[1].body, { sheet: media(MANY, "upload-2.webp") }, "no sheet_name on an untouched box");
    assert.equal((await p.js(sheetsNow))[3].name, null, "unnamed, as today");
    // a re-kept named URL (the media door hands back the kept one) with no name: the bare keep, and its name stands
    await p.until(`!document.querySelector("[data-ap-set]").hidden`, "the section again");
    office.mediaNext = office.sheets[0].url;
    await p.type("#ap-link", "https://example.org/julian-again.png");
    await p.js(`window.__beforeReload = 1, document.querySelector("[data-ap-send-link]").click(), true`);
    await p.until(`/Set\\. This page now shows it\\./.test(document.querySelector("[data-ap-set-status]").textContent)`, "the re-keep answered");
    assert.deepEqual(office.writes.at(-1).body, { sheet: office.sheets[0].url });
    assert.equal(office.sheets[0].name, "Julian", "the re-kept sheet's name stands");
    await p.until(`window.__beforeReload === undefined && ${painted(4)} && ${figs}[0].querySelector("[data-ap-sheet-name]")?.textContent === "Julian"`, "still named after the reload", 20000);
    // a refused keep: the office's words, the typed name kept, no reload
    await p.until(`!document.querySelector("[data-ap-set]").hidden`, "the section again");
    office.refuseNext = { status: 503, body: { defect: "the sheet names can't be read just now", hint: "try again in a minute" } };
    await p.type("#ap-sheet-name", "Vex");
    await p.type("#ap-link", "https://example.org/vex.png");
    await p.js(`document.querySelector("[data-ap-send-link]").click(), true`);
    await p.until(`/503/.test(document.querySelector("[data-ap-set-status]").textContent)`, "the refusal said");
    await new Promise((r) => setTimeout(r, 1600));
    assert.match(await p.js(`document.querySelector("[data-ap-set-status]").textContent`), /The office said no while setting the sheet \(503\): the sheet names can't be read just now/);
    assert.equal(await p.js(`document.querySelector("#ap-sheet-name").value`), "Vex", "the typed name survives (no reload)");
    // an over-long name on the upload: said before any bytes travel
    const uploads = office.uploads;
    await p.type("#ap-sheet-name", "x".repeat(81));
    await p.js(`document.querySelector("[data-ap-send-link]").click(), true`);
    assert.match(await p.js(`document.querySelector("[data-ap-set-status]").textContent`), /at most 80 characters; this is 81/);
    assert.equal(office.uploads, uploads, "no upload for a name the office would refuse");
    assert.deepEqual(p.faults, []);
  } finally { await p.close(); }
});

test("UNAVAILABLE: a 503 sheet read is said in the office's words, never 'no sheet' and never an unnamed sheet", { skip: SKIP }, async () => {
  await setup();
  const office = officeFor({ read: "503" });
  const p = await openPage(browser, base, PAGE(MANY), { office });
  try {
    await p.until(`!document.querySelector("[data-ap-sheets-unread]").hidden`, "the unread line");
    assert.equal(await p.js(`document.querySelector("[data-ap-sheets-unread]").textContent`),
      "Couldn't read the reference sheets just now (503): the sheet names can't be read just now: try again in a minute.");
    assert.equal(await p.js(`document.querySelector("[data-ap-sheets-unread]").getAttribute("role")`), "status");
    assert.equal(await p.js(painted(0)), true, "nothing painted as if unnamed");
    assert.equal(await p.js(`document.querySelector("[data-ap-sheet-none]").hidden`), true, "not 'no sheet yet'");
    assert.deepEqual(p.faults, []);
  } finally { await p.close(); }
});

test("A PHONE FRAME: the owner's boxes and a long name fit 390px with no sideways scroll", { skip: SKIP }, async () => {
  await setup();
  const office = officeFor();
  office.sheets[0].name = "Julian-Vex-Alaric-of-the-long-hyphenated-household-name-that-goes-on";
  const p = await openPage(browser, base, PAGE(MANY), { office, width: 390, height: 844 });
  try {
    await p.until(`${painted(2)} && !${figs}[0].querySelector("[data-ap-name-edit]").hidden && !document.querySelector("[data-ap-set]").hidden`, "the owner's page");
    assert.equal(await p.js(`document.documentElement.scrollWidth <= 390`), true, `the page is ${await p.js("document.documentElement.scrollWidth")}px wide`);
    assert.equal(await p.js(`[...document.querySelectorAll("[data-ap-name-edit] input, [data-ap-name-edit] button, #ap-sheet-name")].every((e) => e.getBoundingClientRect().right <= 390)`), true);
  } finally { await p.close(); }
});
