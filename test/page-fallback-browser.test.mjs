// page-fallback-browser.test.mjs — the kind 404 page, BUILT and RENDERED in a real browser behind a real HTTP 404 (CORE-79).
//
//   node --test test/page-fallback-browser.test.mjs
//
// Darko, 2026-11-13: "she's getting a 404 nginx error on her resident page … we shouldn't just be displaying 404s. There should be like
// some kind of graceful fallback, like your resident is still being processed or something."
// Wright's go, 2026-11-14: "A resident or household page that isn't built yet shows a kind page instead of nginx's 404: say the page is on
// its way and point to what exists." and, of the build: "Stay a real HTTP 404; don't redirect an unknown resident to success or index the
// placeholder. If the existence check fails, say it couldn't be checked rather than inventing 'unknown' or 'arrived.'"
// LAW (the disclosure law, src/lib/page-fallback.mjs): "An answer given without its inputs must never wear the grammar of an answer that had them."
//
// ⚑ THE SERVER CONFIGURATION THIS TEST ASSUMES, named because the site cannot install it: the web server answers a path the site did not
// build with the site's own /404.html and the status 404 (nginx `error_page 404 /404.html;`, the office's half of CORE-79, requested
// from Rivet on the issue and NOT installed by this PR). The server below does exactly that and nothing more: every path that is a file
// (or a directory with an index.html) is 200, every other path is 404 carrying /404.html's bytes. What the real box does is proven only when
// that mapping is installed; what THIS test proves is the site's half: that the build emits 404.html, that the page renders the right
// answer for each case, and that the status stays 404 and nothing redirects.
//
// HOW: it serves the built site (dist-town/, or PAGE_FALLBACK_DIST for another build, e.g. the base commit's) from a tiny static server, drives
// headless Chrome over CDP (Node's global WebSocket; a throwaway profile, no sync, no extensions), and answers GET /api/* itself through
// CDP's Fetch domain with an INVENTED office (invented residents and households, never the live office). WITHOUT dist-town the test SKIPS
// and says so (a plain `npm test` has no build). WITH built pages and no 404.html, or no browser, it FAILS: the built-pages job cannot turn
// a skip into a pass, and a build without the page (the base commit's) is the red this file exists to show.

import test from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import http from "node:http";
import { homedir, tmpdir } from "node:os";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DIST = process.env.PAGE_FALLBACK_DIST || join(ROOT, "dist-town");
const built = existsSync(join(DIST, "index.html"));
const SKIP = built ? false : "no built pages (dist-town/): nothing to render";

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

/** The static server, with the one server-config assumption: an absent path is 404 carrying /404.html (`withheld`: the control that does not map it, as the base build has no such page). */
function serveDist({ withheld = false } = {}) {
  const page404 = existsSync(join(DIST, "404.html")) ? readFileSync(join(DIST, "404.html")) : null;
  const server = http.createServer((req, res) => {
    const p = decodeURIComponent((req.url || "/").split("?")[0]);
    let file = normalize(join(DIST, p));
    if (!file.startsWith(DIST + sep) && file !== DIST) { res.writeHead(403); return res.end(); }
    try { if (statSync(file).isDirectory()) file = join(file, "index.html"); } catch { /* maybe a file */ }
    if (existsSync(file) && statSync(file).isFile()) { res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream" }); return res.end(readFileSync(file)); }
    if (page404 && !withheld) { res.writeHead(404, { "content-type": "text/html; charset=utf-8" }); return res.end(page404); }
    res.writeHead(404, { "content-type": "text/plain" }); res.end("not found");
  });
  return new Promise((ok) => server.listen(0, "127.0.0.1", () => ok(server)));
}

// ── a minimal, bounded CDP client ─────────────────────────────────────────────────────────────────────────────────────

async function launch(chrome) {
  const profile = mkdtempSync(join(tmpdir(), "core79-profile-"));
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
      try { process.kill(-child.pid, "SIGKILL"); } catch { try { child.kill("SIGKILL"); } catch { /* gone */ } }
      try { child.stderr.destroy(); } catch { /* gone */ }
      rmSync(profile, { recursive: true, force: true });
    },
  };
}

/**
 * Open `path` on `base` in a fresh page. `office(url)` answers every /api/* request (CDP Fetch): `{ status, body }` (an object is JSON, a string
 * is sent as HTML), or `"fail"` for a network failure. `noJs` runs the page with scripts off. `docStatus` is the main document's HTTP status.
 */
async function openPage(b, base, path, { width = 1280, height = 900, office = null, noJs = false } = {}) {
  const { targetId } = await b.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await b.send("Target.attachToTarget", { targetId, flatten: true });
  const S = (m, p) => b.send(m, p, sessionId);
  await S("Page.enable"); await S("Network.enable");
  await S("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 600 });
  if (noJs) await S("Emulation.setScriptExecutionDisabled", { value: true });
  const asked = [];
  const state = { office, docStatus: null };
  await S("Fetch.enable", { patterns: [{ urlPattern: "*/api/*", requestStage: "Request" }] });
  const listener = (m) => {
    if (m.sessionId !== sessionId) return;
    if (m.method === "Network.responseReceived" && m.params.type === "Document" && state.docStatus === null) state.docStatus = m.params.response.status;
    if (m.method !== "Fetch.requestPaused") return;
    const { requestId } = m.params;
    const url = new URL(m.params.request.url);
    asked.push(url.pathname + url.search);
    const a = state.office ? state.office(url.pathname + url.search) : { status: 404, body: { error: "bounce", code: 404 } };
    if (a === "fail") { S("Fetch.failRequest", { requestId, errorReason: "ConnectionRefused" }).catch(() => {}); return; }
    const isHtml = typeof a.body === "string";
    S("Fetch.fulfillRequest", { requestId, responseCode: a.status, responseHeaders: [{ name: "content-type", value: isHtml ? "text/html" : "application/json" }, { name: "access-control-allow-origin", value: "*" }],
      body: Buffer.from(isHtml ? a.body : JSON.stringify(a.body)).toString("base64") }).catch(() => {});
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
  return { evalJs, until, asked, state, get docStatus() { return state.docStatus; }, close: async () => { b.listeners.splice(b.listeners.indexOf(listener), 1); await b.send("Target.closeTarget", { targetId }).catch(() => {}); } };
}

// ── invented offices (no live read, ever) ────────────────────────────────────────────────────────────

const REGISTRY = { read: "households", registry: { schema_version: 1, households: {
  "fox-hearth-test": { name: "Fox Hearth Test", residents: ["ada-test"] },
  "nameless-test": { residents: ["bo-test"] },
} } };
const known = (h, agent) => ({ status: 200, body: { handle: h, address: { data: { handle: h, agent } }, profile: {} } });
const NO = { status: 404, body: { error: "bounce", code: 404, defect: "no resident", refused: true } };
/** an office that knows `residents` ({ handle: name }) and the invented registry */
const officeKnowing = (residents = {}) => (u) => {
  let m;
  if ((m = /^\/api\/residents\/([^/?]+)$/.exec(u))) return residents[decodeURIComponent(m[1])] ? known(decodeURIComponent(m[1]), residents[decodeURIComponent(m[1])]) : NO;
  if (u === "/api/households") return { status: 200, body: REGISTRY };
  return { status: 404, body: { error: "bounce", code: 404 } };
};

const VIEW = `(() => { const r = document.querySelector("[data-fallback]"); if (!r) return null; const q = (s) => r.querySelector(s); const shown = (e) => !!e && !e.hidden && getComputedStyle(e).display !== "none";
  return { state: r.dataset.state, title: q("[data-fallback-title]").textContent, lead: q("[data-fallback-lead]").textContent, hedgeShown: shown(q("[data-fallback-hedge]")), recordShown: shown(q("[data-fallback-record]")), record: q("[data-fallback-record]").textContent,
    retryShown: shown(q("[data-fallback-retry-row]")), links: [...q("[data-fallback-links]").querySelectorAll("a")].map((a) => a.getAttribute("href")), docTitle: document.title, imgs: r.querySelectorAll("img,script,svg").length }; })()`;
const waitState = (p, s) => p.until(`document.querySelector("[data-fallback]")?.dataset.state === ${JSON.stringify(s)}`, `the page to reach state ${s}`);

let chrome = null, server = null, browser = null, base = null, control = null, controlBase = null;
async function boot() {
  if (browser) return;
  assert.ok(existsSync(join(DIST, "404.html")), `the build in ${DIST} has no 404.html: town/pages/404.astro is what makes it (the base commit has no such page, and a missing path then shows the web server's bare 404)`);
  chrome = findChrome();
  assert.ok(chrome, "built pages exist but no Chrome/Chromium was found: set CHROME_BIN. (This fails rather than skips: a skipped render is not a passed one.)");
  server = await serveDist(); base = `http://127.0.0.1:${server.address().port}`;
  browser = await launch(chrome);
}
async function bootControl() {
  if (control) return;
  control = await serveDist({ withheld: true }); controlBase = `http://127.0.0.1:${control.address().port}`;
}
test.after(async () => {
  browser?.close();
  for (const s of [server, control]) if (s) {
    s.closeAllConnections?.();
    await Promise.race([new Promise((ok) => s.close(ok)), new Promise((ok) => setTimeout(ok, 3000).unref())]);
  }
});

// ── the status stays 404; nothing is replaced, redirected or indexed ─────────────────────────────────────────

test("the build emits /404.html, and a REAL request to an absent path is a 404 carrying it, with no redirect and noindex", { skip: SKIP, timeout: 120_000 }, async () => {
  await boot();
  assert.ok(existsSync(join(DIST, "404.html")));
  for (const path of ["/residents/ada-test/", "/households/fox-hearth-test/", "/no/such/page/"]) {
    const res = await fetch(base + path, { redirect: "manual" });
    assert.equal(res.status, 404, `${path} stays a real 404, not a redirect (${res.status}) and not a 200`);
    const html = await res.text();
    assert.match(html, /data-fallback/, `${path}: the custom page is what renders`);
    assert.match(html, /<meta name="robots" content="noindex"/, "the placeholder is never indexed");
    assert.doesNotMatch(html, /http-equiv="refresh"/i, "and nothing redirects");
  }
  // existing pages are not replaced
  for (const path of ["/", "/households/", "/bulletin/"]) {
    const res = await fetch(base + path, { redirect: "manual" });
    assert.equal(res.status, 200, `${path} still answers 200`);
    assert.doesNotMatch(await res.text(), /data-fallback/, `${path} is its own page, not the fallback`);
  }
  const resDirs = readdirSync(join(DIST, "residents"), { withFileTypes: true }).filter((d) => d.isDirectory() && existsSync(join(DIST, "residents", d.name, "index.html")));
  assert.ok(resDirs.length > 0, "the build has resident pages (control: the walk found some)");
  const one = await fetch(`${base}/residents/${resDirs[0].name}/`, { redirect: "manual" });
  assert.equal(one.status, 200, "a built resident page is untouched");
  assert.doesNotMatch(await one.text(), /data-fallback/);
});

// ── known before the build: the case that fails against base ──────────────────────────────────────────────

test("CONTROL: a resident the office knows, on a server with no 404 page (what the base build gives), shows no waiting answer at all", { skip: SKIP, timeout: 120_000 }, async () => {
  await boot(); await bootControl();
  const p = await openPage(browser, controlBase, "/residents/ada-test/", { office: officeKnowing({ "ada-test": "Ada Test" }) });
  try {
    await new Promise((ok) => setTimeout(ok, 800));
    assert.equal(p.docStatus, 404, "the same 404");
    assert.equal(await p.evalJs(`document.querySelector("[data-fallback]")`), null, "but with the page withheld there is nothing to say 'on its way'");
    assert.equal(await p.evalJs(`document.body.innerText.trim()`), "not found", "only the server's bare line");
  } finally { await p.close(); }
});

test("a resident the office knows, with no page built: 'on its way' by name, still a 404, the record linked, and the unknown names are not shown", { skip: SKIP, timeout: 120_000 }, async () => {
  await boot();
  const p = await openPage(browser, base, "/residents/ada-test/", { office: officeKnowing({ "ada-test": "Ada Test" }) });
  try {
    await waitState(p, "waiting");
    const v = await p.evalJs(VIEW);
    assert.equal(p.docStatus, 404, "the document status is the 404 the server sent");
    assert.equal(v.title, "Ada Test's page is on its way");
    assert.match(v.lead, /^Ada Test is in the town's record already\./);
    assert.equal(v.docTitle, "Ada Test's page is on its way — Postmark");
    assert.equal(v.recordShown, true); assert.equal(v.record, "Their record is readable now: /api/residents/ada-test.");
    assert.equal(v.hedgeShown, false); assert.equal(v.retryShown, false);
    assert.ok(v.links.includes("/households/") && v.links.includes("/"), "it points to what exists");
    assert.deepEqual(p.asked, ["/api/residents/ada-test"], "one anonymous read of exactly that handle");
  } finally { await p.close(); }
});

test("a resident's name is shown as TEXT: markup in a name makes no element, and a long name is cut", async () => {
  if (SKIP) return;
  await boot();
  const evil = `<img src=x onerror=window.__pwned=1>&<b>b</b>`;     // 45 characters: under the 48 a name is shown at, so it comes back whole
  const p = await openPage(browser, base, "/residents/ada-test/", { office: officeKnowing({ "ada-test": evil }) });
  try {
    await waitState(p, "waiting");
    const v = await p.evalJs(VIEW);
    assert.equal(v.title, `${evil}'s page is on its way`, "the name, literally");
    assert.equal(v.imgs, 0, "no img, script or svg was made from a name");
    assert.equal(await p.evalJs(`window.__pwned ?? null`), null, "and nothing ran");
    assert.equal(await p.evalJs(`document.querySelectorAll("[data-fallback] b").length`), 0);
  } finally { await p.close(); }
  const q = await openPage(browser, base, "/residents/ada-test/", { office: officeKnowing({ "ada-test": "N".repeat(90) }) });
  try {
    await waitState(q, "waiting");
    assert.equal((await q.evalJs(VIEW)).title, `${"N".repeat(48)}…'s page is on its way`);
  } finally { await q.close(); }
});

test("a registered household, with no page built: 'on its way' by its name; a registry row with no name plates by its key", async () => {
  if (SKIP) return;
  await boot();
  const p = await openPage(browser, base, "/households/fox-hearth-test/", { office: officeKnowing() });
  try {
    await waitState(p, "waiting");
    const v = await p.evalJs(VIEW);
    assert.equal(p.docStatus, 404);
    assert.equal(v.title, "Fox Hearth Test's page is on its way");
    assert.match(v.lead, /^The household Fox Hearth Test is in the town's registry already\./);
    assert.equal(v.recordShown, false, "a household has no per-house record link");
    assert.deepEqual(p.asked, ["/api/households"]);
  } finally { await p.close(); }
  const q = await openPage(browser, base, "/households/nameless-test/", { office: officeKnowing() });
  try { await waitState(q, "waiting"); assert.equal((await q.evalJs(VIEW)).title, "Nameless Test's page is on its way"); } finally { await q.close(); }
});

// ── unknown: only when the office answered no ─────────────────────────────────────────────────────────────────

test("an identity the office does not know is 'isn't here', never 'on its way' (resident and household)", async () => {
  if (SKIP) return;
  await boot();
  for (const path of ["/residents/nobody-test/", "/households/no-such-house/"]) {
    const p = await openPage(browser, base, path, { office: officeKnowing({ "ada-test": "Ada Test" }) });
    try {
      await waitState(p, "unknown");
      const v = await p.evalJs(VIEW);
      assert.equal(p.docStatus, 404);
      assert.equal(v.title, "That page isn't here");
      assert.doesNotMatch(v.title + v.lead, /on its way/i);
      assert.equal(v.retryShown, false);
      assert.ok(v.links.includes("/households/"));
    } finally { await p.close(); }
  }
});

// ── the check failed: said, separately for each failure, never unknown and never arrived ───────────────────────

test("an existence check that cannot be answered says it could not be checked, for every way it fails, and Check again recovers", async () => {
  if (SKIP) return;
  await boot();
  const fails = {
    "network failure": () => "fail",
    "429": () => ({ status: 429, body: { error: "bounce", code: 429 } }),
    "503": () => ({ status: 503, body: { error: "bounce", code: 503 } }),
    "an HTML 404 from a server with no /api behind it": () => ({ status: 404, body: "<html><center><h1>404 Not Found</h1></center></html>" }),
    "a 200 that is not the resident's record": () => ({ status: 200, body: { hello: "world" } }),
  };
  for (const [why, office] of Object.entries(fails)) {
    const p = await openPage(browser, base, "/residents/ada-test/", { office });
    try {
      await waitState(p, "unchecked");
      const v = await p.evalJs(VIEW);
      assert.equal(p.docStatus, 404, `${why}: still the 404`);
      assert.equal(v.title, "We couldn't check this page", why);
      assert.doesNotMatch(v.title, /on its way|isn't here/, `${why}: it claims neither arrival nor absence`);
      assert.doesNotMatch(v.lead, /isn't here|doesn't know|is on its way\./, why);
      assert.equal(v.retryShown, true, `${why}: it offers to try again`);
    } finally { await p.close(); }
  }
  // Check again: the office was down, then answers; the same document goes to the waiting answer without a reload
  let up = false;
  const p = await openPage(browser, base, "/residents/ada-test/", { office: (u) => (up ? officeKnowing({ "ada-test": "Ada Test" })(u) : { status: 503, body: { error: "bounce", code: 503 } }) });
  try {
    await waitState(p, "unchecked");
    await p.evalJs(`window.__same = "yes"; true`);
    up = true;
    await p.evalJs(`document.querySelector("[data-fallback-retry]").click(); true`);
    await waitState(p, "waiting");
    assert.equal(await p.evalJs(`window.__same`), "yes", "without a reload");
  } finally { await p.close(); }
  // a household check that fails is unchecked too
  const h = await openPage(browser, base, "/households/fox-hearth-test/", { office: () => ({ status: 503, body: { error: "bounce", code: 503 } }) });
  try { await waitState(h, "unchecked"); } finally { await h.close(); }
});

// ── every other missing path, and no JavaScript ────────────────────────────────────────────────────────────────

test("an ordinary missing path says it isn't here and points to what exists, and never asks the office", async () => {
  if (SKIP) return;
  await boot();
  for (const path of ["/no/such/page/", "/households/fox-hearth-test/hearth/", "/mail/ada-test/"]) {
    const p = await openPage(browser, base, path, { office: officeKnowing({ "ada-test": "Ada Test" }) });
    try {
      await waitState(p, "other");
      const v = await p.evalJs(VIEW);
      assert.equal(p.docStatus, 404);
      assert.equal(v.title, "That page isn't here");
      assert.equal(v.hedgeShown, false);
      assert.deepEqual(v.links, ["/households/", "/bulletin/", "/"]);
      assert.deepEqual(p.asked, [], `${path} is not a resident's or a household's page: the office is not asked`);
    } finally { await p.close(); }
  }
});

test("WITHOUT JAVASCRIPT the baked page stands: still a 404, 'isn't here' with the places that exist and the one hedge about new pages", async () => {
  if (SKIP) return;
  await boot();
  for (const path of ["/residents/ada-test/", "/no/such/page/"]) {
    const p = await openPage(browser, base, path, { noJs: true, office: officeKnowing({ "ada-test": "Ada Test" }) });
    try {
      await new Promise((ok) => setTimeout(ok, 600));
      const v = await p.evalJs(VIEW);
      assert.equal(p.docStatus, 404);
      assert.equal(v.state, "floor", "the script did not run");
      assert.equal(v.title, "That page isn't here");
      assert.equal(v.hedgeShown, true, "the floor says a new page can arrive after its resident");
      assert.deepEqual(v.links, ["/households/", "/bulletin/", "/"]);
      assert.deepEqual(p.asked, [], "no script, no office read");
    } finally { await p.close(); }
  }
});

// ── the picture: a phone, and the contrast the reader gets ────────────────────────────────────────────────────

const GEOM = `(() => { const r = document.querySelector("[data-fallback]"), c = r.getBoundingClientRect();
  const targets = [...r.querySelectorAll("a, button")].filter((e) => !e.closest("[hidden]") && e.getBoundingClientRect().width > 0).map((e) => { const b = e.getBoundingClientRect(); const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return { text: e.textContent.trim(), left: b.left, right: b.right, hits: hit === e || e.contains(hit) }; });
  return { vw: window.innerWidth, docW: document.documentElement.scrollWidth, card: { left: c.left, right: c.right }, targets }; })()`;
const CONTRAST = `(() => {
  const rgb = (s) => { const m = /rgba?\\(([^)]+)\\)/.exec(s); if (!m) return null; const [r, g, b, a = 1] = m[1].split(/[ ,\\/]+/).filter(Boolean).map(Number); return { r, g, b, a }; };
  const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  // the surface a text sits on: its own and its ancestors' background colours, translucent washes composited over the first opaque one (a gradient image is not counted)
  const bgOf = (el) => { const layers = []; let base = { r: 255, g: 255, b: 255, a: 1 };
    for (let e = el; e; e = e.parentElement) { const c = rgb(getComputedStyle(e).backgroundColor); if (c && c.a > 0) { layers.push(c); if (c.a === 1) break; } }
    if (layers.length && layers[layers.length - 1].a === 1) base = layers.pop();
    for (const c of layers.reverse()) base = { r: c.r * c.a + base.r * (1 - c.a), g: c.g * c.a + base.g * (1 - c.a), b: c.b * c.a + base.b * (1 - c.a), a: 1 };
    return base; };
  const out = [];
  for (const el of document.querySelectorAll("[data-fallback] h1, [data-fallback] p, [data-fallback] a, [data-fallback] li, [data-fallback] button, [data-fallback] .pf-note")) {
    if (el.closest("[hidden]") || !el.textContent.trim() || el.getBoundingClientRect().width === 0) continue;
    const fg = rgb(getComputedStyle(el).color), bg = bgOf(el), L1 = lum(fg), L2 = lum(bg);
    out.push({ el: el.tagName.toLowerCase() + (el.className ? "." + String(el.className).split(" ")[0] : ""), size: parseFloat(getComputedStyle(el).fontSize), ratio: (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05) });
  }
  return out; })()`;

for (const [label, width] of [["desktop 1280", 1280], ["phone 390", 390]]) {
  test(`${label}: the waiting page fits the screen, every target is clickable, and its text reads (>= 4.5:1 against the surface it sits on)`, async () => {
    if (SKIP) return;
    await boot();
    const p = await openPage(browser, base, "/residents/ada-test/", { width, office: officeKnowing({ "ada-test": "Ada Test" }) });
    try {
      await waitState(p, "waiting");
      const g = await p.evalJs(GEOM);
      assert.ok(g.docW <= g.vw, `${label}: the page does not scroll sideways (${g.docW} > ${g.vw})`);
      assert.ok(g.card.left >= 0 && g.card.right <= g.vw, `${label}: the card is inside the screen`);
      assert.ok(g.targets.length >= 4, "the record link and the three places are drawn");
      for (const t of g.targets) assert.ok(t.hits, `${label}: "${t.text}" is what a click at its centre lands on`);
      const rows = await p.evalJs(CONTRAST);
      assert.ok(rows.length >= 6, "the measure found the card's text");
      for (const r of rows) assert.ok(r.ratio >= 4.5, `${label}: ${r.el} reads ${r.ratio.toFixed(2)}:1, under 4.5:1 (the site draws one colour scheme; this is the one a reader gets)`);
    } finally { await p.close(); }
    // the unchecked answer draws the one button ("Check again"): it must read too, and be inside the screen
    const u = await openPage(browser, base, "/residents/ada-test/", { width, office: () => ({ status: 503, body: { error: "bounce", code: 503 } }) });
    try {
      await waitState(u, "unchecked");
      const g = await u.evalJs(GEOM);
      assert.ok(g.docW <= g.vw && g.targets.some((t) => t.text === "Check again" && t.hits && t.left >= 0 && t.right <= g.vw), `${label}: Check again is inside the screen and clickable`);
      for (const r of await u.evalJs(CONTRAST)) assert.ok(r.ratio >= 4.5, `${label} (unchecked): ${r.el} reads ${r.ratio.toFixed(2)}:1, under 4.5:1`);
    } finally { await u.close(); }
  });
}
