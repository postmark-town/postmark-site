// shoot.mjs <dist dir> <out dir> — scratch: walk the join with fixture values and screenshot each step (review only; the PR's pictures come from site-prep)
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import http from "node:http";
import { homedir, tmpdir } from "node:os";
import { extname, join, normalize, sep } from "node:path";
const DIST = process.argv[2], OUT = process.argv[3];
mkdirSync(OUT, { recursive: true });
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

async function launch(chrome) {
  const profile = mkdtempSync(join(tmpdir(), "core188-profile-"));
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

// ── the invented office ──────────────────────────────────────────────────────
const HEARD = { type: "string", enum: ["youtube", "discord", "friend", "other"], "x-enum-titles": ["YouTube", "Discord", "A friend or another resident", "Other"], description: "Where did you hear about Postmark? (private)" };
// today's card, as the office's DECLARE_SCHEMA projects it (no maxLength anywhere; card and note are today's names)
const TODAY = {
  household: { type: "string", required: true, title: "Household name", "x-group": "household" },
  handle: { type: "string", required: true, title: "Handle" },
  card: { type: "string", required: true, title: "Address Card", "x-multiline": true },
  agent: { type: "string", title: "Agent's name" },
  architecture: { type: "string", title: "How they persist" },
  since: { type: "string", title: "Since" },
  note: { type: "string", title: "Directory line" },
  from_town: { type: "string", title: "Town you came from" },
  invited_by: { type: "string", title: "Who invited you?" },
  heard: HEARD,
  heard_note: { type: "string", title: "Anything to add?", maxLength: 280 },
};
// a card in POS-1237's shape: full_address (card kept as its alias), the line, the bio and the profile at the join, each with its limit
const NEXT = {
  household: { type: "string", required: true, maxLength: 60, "x-group": "household" },
  handle: { type: "string", required: true, maxLength: 40 },
  full_address: { type: "string", required: true, maxLength: 50000, description: "Your full address: the Address card, as long as you like. Agents read it when they want the whole of you." },
  agent: { type: "string", maxLength: 48 },
  line: { type: "string", maxLength: 120, description: "One line, for lists: the directory and every list that names you (120 characters)." },
  bio: { type: "string", maxLength: 400 },
  pronouns: { type: "string", maxLength: 56 },
  color: { type: "string" },
  color_name: { type: "string", maxLength: 56 },
  runtime: { type: "string", maxLength: 72 },
  invited_by: { type: "string", maxLength: 64 },
  heard: HEARD,
  heard_note: { type: "string", maxLength: 280 },
  motto: { type: "string", maxLength: 30, title: "A motto", description: "A field this site does not place: it still reaches the form." },
};
const ADD = { handle: { type: "string", required: true, maxLength: 40 }, card: { type: "string", required: true }, agent: { type: "string" }, note: { type: "string" } };

// a visitor is still signed in: /me answers with no handles (a 401 here would sign the page's own header out, as it should)
function officeFor({ tier = "visitor", act = "declare", fields = TODAY, me = { handles: [], households: {} } } = {}) {
  const o = { asked: [], sent: [], me };
  o.answer = (msg) => {
    if (msg.method === "initialize") return { jsonrpc: "2.0", id: msg.id, result: { protocolVersion: "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "fixture-office", version: "0" } } };
    if (msg.method !== "tools/call") return msg.id == null ? null : { jsonrpc: "2.0", id: msg.id, result: {} };
    const a = msg.params?.arguments ?? {};
    const text = (v) => ({ jsonrpc: "2.0", id: msg.id, result: { content: [{ type: "text", text: JSON.stringify(v) }] } });
    if (a.read_shape === "v1") return text({ tier, standing: tier, acts: [{ act, teaches: "Move an agent in.", fields }], next: ["Fill in the form; the office answers."] });
    if (a.read === act) return text({ card: { action: act, blurb: "Move an agent in.", fields } });
    if (a.do === act) { o.sent.push(a.args); return text({ admitted: true, note: "Fixture: admitted. Welcome to the fixture town.", handle: a.args.handle ?? null }); }
    return text({ defect: "fixture: not asked for" });
  };
  return o;
}

export async function openPage(b, base, path, { width, height = 900, office }) {
  const { targetId } = await b.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await b.send("Target.attachToTarget", { targetId, flatten: true });
  const S = (m, p) => b.send(m, p, sessionId);
  await S("Page.enable"); await S("Runtime.enable"); await S("DOM.enable");
  const faults = [];
  b.listeners.push((m) => {
    if (m.sessionId !== sessionId) return;
    if (m.method === "Runtime.exceptionThrown") faults.push(m.params.exceptionDetails?.exception?.description?.split("\n")[0] ?? m.params.exceptionDetails?.text);
    if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") faults.push(m.params.args?.map((a) => a.value ?? a.description).join(" "));
  });
  await S("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 600 });
  await S("Page.addScriptToEvaluateOnNewDocument", { source: `try { localStorage.setItem("pm.oauth.token", JSON.stringify({ access_token: "invented-token", obtained: Date.now(), expires_in: 3600 })); localStorage.removeItem("pm.invite"); localStorage.removeItem("mcp-proto.history"); } catch {}` });
  await S("Fetch.enable", { patterns: [{ urlPattern: "*/api/*", requestStage: "Request" }] });
  b.listeners.push((m) => {
    if (m.sessionId !== sessionId || m.method !== "Fetch.requestPaused") return;
    const { requestId, request } = m.params;
    const u = new URL(request.url);
    const reply = (status, json) => S("Fetch.fulfillRequest", { requestId, responseCode: status, responseHeaders: [{ name: "content-type", value: "application/json" }, { name: "cache-control", value: "no-store" }],
      body: Buffer.from(json == null ? "" : JSON.stringify(json)).toString("base64") }).catch(() => {});
    const local = u.origin === base;
    office.asked.push(`${request.method} ${local ? "" : u.origin}${u.pathname}`);
    if (local && request.method === "POST" && u.pathname === "/api/mcp") { const msg = JSON.parse(request.postData || "{}"); const r = office.answer(msg); return r ? reply(200, r) : reply(202, null); }
    if (local && request.method === "GET" && u.pathname === "/api/me") return office.me ? reply(200, office.me) : reply(401, { defect: "fixture: signed out" });
    return S("Fetch.failRequest", { requestId, errorReason: "BlockedByClient" }).catch(() => {});
  });
  await S("Page.navigate", { url: base + path });
  const js = async (expr) => { const r = await S("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(`page: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`); return r.result.value; };
  const until = async (expr, what, ms = 15000) => {
    const t0 = Date.now();
    for (;;) {
      try { if (await js(expr)) return; } catch { /* not yet */ }
      if (Date.now() - t0 > ms) {
        const where = await js(`JSON.stringify({ hash: location.hash, error: document.querySelector("[data-form-error]")?.hidden ? null : document.querySelector("[data-form-error]")?.textContent, shown: [...document.querySelectorAll("[data-step]")].filter((e) => !e.hidden).map((e) => e.dataset.step), status: document.querySelector("[data-status]")?.textContent, sendDisabled: document.querySelector("[data-submit]")?.disabled, gates: [...document.querySelectorAll("[data-gate-signedout],[data-gate-asking],[data-gate-act],[data-gate-noact],[data-gate-doorshut],[data-gate-reply],[data-gate-in]")].filter((e) => !e.hidden).map((e) => [...e.attributes].find((a) => a.name.startsWith("data-gate"))?.name) })`).catch(() => "?");
        throw new Error(`waited ${ms} ms for ${what}; the page: ${where}; the office got ${office.sent.length} send(s), asked: ${office.asked.slice(-4).join(", ")}; its faults: ${faults.join(" | ") || "none"}`);
      }
      await new Promise((r) => setTimeout(r, 100));
    }
  };
  const key = async (k, mods = 0) => {
    const codes = { Enter: [13, "\r"], Tab: [9, ""] };
    const [vk, text] = codes[k] ?? [0, ""];
    await S("Input.dispatchKeyEvent", { type: "keyDown", key: k, code: k, windowsVirtualKeyCode: vk, text: text || undefined, modifiers: mods });
    await S("Input.dispatchKeyEvent", { type: "keyUp", key: k, code: k, windowsVirtualKeyCode: vk, modifiers: mods });
  };
  const type = async (sel, text) => { await js(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); e.focus(); e.value = ""; e.dispatchEvent(new Event("input", { bubbles: true })); return true; })()`); await S("Input.insertText", { text }); };
  const click = (sel) => js(`(() => { document.querySelector(${JSON.stringify(sel)}).click(); return true; })()`);
  const setFile = async (sel, file) => {
    const { root } = await S("DOM.getDocument", { depth: -1, pierce: true });
    const { nodeId } = await S("DOM.querySelector", { nodeId: root.nodeId, selector: sel });
    await S("DOM.setFileInputFiles", { nodeId, files: [file] });
  };
  return { S, js, until, key, type, click, setFile, close: () => b.send("Target.closeTarget", { targetId }).catch(() => {}) };
}

// a small real PNG (a gold square) for the picture
// ── CORE-188 contrast readout: the real rendered state, text made transparent to sample its own backdrop, composited, WCAG ratio ──
const chrome = findChrome();
const server = await serveDist();
const base = `http://127.0.0.1:${server.address().port}`;
const b = await launch(chrome);
const rows = [];
// the measuring half, in the page: the target's text colour (pseudo-element where it lives) and its whole opacity chain, its font, its box
const READ = `(sel, pseudo) => {
  const el = document.querySelector(sel); if (!el) return null;
  const cs = getComputedStyle(el, pseudo || null);
  const parse = (c) => { const m = c.match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  let a = 1; for (let n = el; n && n.nodeType === 1; n = n.parentElement) a *= Number(getComputedStyle(n).opacity);
  if (pseudo === "::before") a *= Number(cs.opacity);
  const fg = parse(cs.color);
  const r = el.getBoundingClientRect();
  return { fg, alpha: a * (fg ? fg.a : 1), fontSize: parseFloat(cs.fontSize), fontWeight: cs.fontWeight, rect: { x: r.x + window.scrollX, y: r.y + window.scrollY, w: r.width, h: r.height }, text: pseudo === "::placeholder" ? el.placeholder : pseudo === "::before" ? cs.content : el.textContent.trim().slice(0, 40) };
}`;
const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const ratio = (x, y) => { const [l1, l2] = [lum(x), lum(y)].sort((p, q) => q - p); return (l1 + 0.05) / (l2 + 0.05); };
async function measure(p, width, scene, sel, pseudo, kind) {
  await p.js(`document.querySelector(${JSON.stringify(sel)})?.scrollIntoView({ block: "center" }), true`);
  await new Promise((r) => setTimeout(r, 150));
  const m = await p.js(`(${READ})(${JSON.stringify(sel)}, ${JSON.stringify(pseudo)})`);
  if (!m || !m.fg) { rows.push({ width, scene, sel, pseudo, missing: true }); return; }
  // the backdrop the text actually sits on: the same pixels with this text made transparent, sampled at the median
  const hide = pseudo === "::placeholder" ? `${sel}::placeholder{color:transparent!important}` : pseudo === "::before" ? `${sel}::before{color:transparent!important}` : `${sel}{color:transparent!important}`;
  await p.js(`(() => { const s = document.createElement("style"); s.id = "qa-hide-core188"; s.textContent = ${JSON.stringify(hide)}; document.head.appendChild(s); return true; })()`);
  await new Promise((r) => setTimeout(r, 80));
  const box = { x: Math.max(0, m.rect.x + 4), y: Math.max(0, m.rect.y + 2), width: Math.max(4, Math.min(m.rect.w - 8, 300)), height: Math.max(4, m.rect.h - 4), scale: 1 };
  const shot = await p.S("Page.captureScreenshot", { format: "png", clip: box });
  await p.js(`(document.getElementById("qa-hide-core188")?.remove(), true)`);
  const bg = await p.js(`(async () => { const i = new Image(); i.src = "data:image/png;base64,${shot.data}"; await i.decode(); const c = document.createElement("canvas"); c.width = i.width; c.height = i.height; const g = c.getContext("2d"); g.drawImage(i, 0, 0); const d = g.getImageData(0, 0, c.width, c.height).data; const rs = [], gs = [], bs = []; for (let k = 0; k < d.length; k += 4) { rs.push(d[k]); gs.push(d[k + 1]); bs.push(d[k + 2]); } const med = (v) => v.sort((x, y) => x - y)[v.length >> 1]; return { r: med(rs), g: med(gs), b: med(bs) }; })()`);
  const a = Math.min(1, m.alpha);
  const comp = { r: Math.round(a * m.fg.r + (1 - a) * bg.r), g: Math.round(a * m.fg.g + (1 - a) * bg.g), b: Math.round(a * m.fg.b + (1 - a) * bg.b) };
  const cr = ratio(comp, bg);
  const large = m.fontSize >= 24 || (m.fontSize >= 18.66 && Number(m.fontWeight) >= 700);
  rows.push({ width, scene, kind, sel, pseudo: pseudo || "", text: String(m.text).replace(/^"|"$/g, "").slice(0, 34), fg: `rgba(${m.fg.r},${m.fg.g},${m.fg.b},${+a.toFixed(3)})`, backdrop: `rgb(${bg.r},${bg.g},${bg.b})`, composited: `rgb(${comp.r},${comp.g},${comp.b})`, px: m.fontSize, ratio: +cr.toFixed(2), need: large ? 3 : 4.5, pass: cr >= (large ? 3 : 4.5) });
}
try {
  for (const width of [1440, 390]) {
    const p = await openPage(b, base, "/join/move-in/", { width, height: width < 600 ? 844 : 900, office: officeFor() });
    await p.until(`!document.querySelector('[data-step="household"]').hidden`, "step 1");
    await measure(p, width, "step 1", '[data-reg-at="act"] .jd-reg-name', null, "Registrar label on her paper bubble");
    await measure(p, width, "step 1", "#jd-household", "::placeholder", "placeholder (join form)");
    await p.type("#jd-household", "Hollow Oak");
    await p.click("[data-jf-next]"); await p.until(`!document.querySelector('[data-step="who"]').hidden`, "2");
    await measure(p, width, "step 2", "#jd-agent", "::placeholder", "placeholder (shared editor field)");
    for (const [sel, kind] of [['[data-blank-page] h1[data-fill="agent"]', "ghost: name"], ['[data-blank-page] [data-fill="pronouns"]', "ghost: pronouns"], ['[data-blank-page] .profile-handle[data-fill="handle"]', "ghost: handle"], ['[data-blank-page] [data-fill="runtime"]', "ghost: runtime chip"], ['[data-blank-page] [data-fill="color_name"]', "ghost: colour chip"], ['[data-blank-page] [data-fill="bio"]', "ghost: bio"], ['[data-blank-page] .bcard [data-fill="line"]', "ghost: Address card line"], ['[data-blank-page] .jd-full[data-fill="full_address"]', "ghost: full address paper"]])
      await measure(p, width, "step 2", sel, "::before", kind);
    await p.type("#jd-agent", "Quillon"); await p.type("#jd-handle", "quillon");
    await p.click("[data-jf-next]"); await p.until(`!document.querySelector('[data-step="describe"]').hidden`, "3");
    await measure(p, width, "step 3", "#jd-full_address", "::placeholder", "placeholder (shared editor textarea)");
    await p.type("#jd-full_address", "I'm Quillon.");
    await p.click("[data-jf-next]"); await p.until(`!document.querySelector('[data-step="more"]').hidden`, "4");
    await measure(p, width, "step 4", '[data-step="more"] input[name="color"]', "::placeholder", "placeholder (the editor's own colour field)");
    await p.click("[data-jf-next]"); await p.until(`!document.querySelector('[data-step="found"]').hidden`, "5");
    await measure(p, width, "step 5", "#jd-invited_by", "::placeholder", "placeholder (join form)");
    await p.close();
  }
} finally { b.close(); server.close(); }
writeFileSync(join(OUT, "readout.json"), JSON.stringify(rows, null, 2));
for (const r of rows) console.log([r.width, r.scene, r.kind, r.text, r.fg, r.backdrop, r.composited, r.px + "px", r.ratio, r.pass ? "PASS" : "FAIL"].join(" | "));
