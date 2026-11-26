// join-move-in-browser.test.mjs — CORE-188 RENDERED: the join's steps fill in a blank instance of the real resident page, on the built page.
//
//   node --test test/join-move-in-browser.test.mjs        (a browser test: run it through the heavy queue, `run-heavy`)
//
// It serves the built site (dist-town/; the built-pages CI job builds it first), drives headless Chrome over CDP (Node's global WebSocket; a throwaway
// profile) and answers the office ITSELF through CDP's Fetch domain with INVENTED replies: the household door's bare read, the act's card, the send,
// /me, and the resident's own doors the page uses after an admission (PATCH /profile/<h>, PATCH /profile/<h>/avatar, POST /media). Every other
// office call is refused. The live office is never touched, nobody really signs in (a made-up token is put in the page's storage), and nothing is
// admitted: every handle, house and word below is a fixture.
//
// WHAT IT PROVES that the node tests cannot, by typing into the page with real key events:
//   · the steps walk in order with the Registrar on each (one token, her name linking to her page); the page steps show the resident page's own
//     pieces (ResidentFace, AddressCardFace, ProfileEditorFields), filled live as the reader types, the step's pieces lit;
//   · live counts in the office's units (an emoji is one; the full address in bytes), limits only from the card; a required piece and an over-long
//     one stop Continue, said in the one alert slot;
//   · Back and "edit" on the look-over keep every value and the picture's framing, and the edit's Continue comes straight back;
//   · A NEW HOUSE TAKES THE OFFICE'S OWN WAY IN (Darko's ruled fallback, CORE-188): on Send, and not before, one KEYLESS berth under the handle,
//     then begin under THAT berth's key, carrying only what the card takes less the handle (today's card: household/agent/note/card/invited_by/
//     heard/heard_note; the accepted card, POS-1237 f22c069a: full_address, note, the bio and the profile under its own names); never the
//     visitor's own declare; the handle is held to the berth's narrower rule out loud; a held name is refused in the office's words;
//   · the co-sign link is the office's own for that berth, opens in a new tab, carries no key; the berth key is never stored, shown or swapped
//     for the reader's own sign-in;
//   · NOTHING IS WRITTEN TO A RESIDENT BEFORE THE OFFICE ADMITS ONE (the co-sign, read from /me with the berth key; add-resident's answer), and
//     after it only through the resident's own doors (the profile fields the card lacked, the picture); the agent route's begin writes nothing;
//   · THE HUMAN'S PROFILE AND THE LIKENESS ARE THE OFFICE CO-SIGN PAGE'S: no box for them here, in no request this page makes, and the page says
//     where they are asked; an existing house and the agent route are not told of a co-sign they don't take;
//   · "You're in" shows its two lines, the agent's page link, and what the page set;
//   · Enter continues from a one-line box; Tab walks the fields in order; a phone frame does not scroll sideways.
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
const SKIP = existsSync(join(DIST, "join", "move-in", "index.html")) ? false : "no built pages (dist-town/): nothing to render";

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
// the accepted card (POS-1237, Office f22c069a, src/declare.mjs § DECLARE_SCHEMA): full_address (card its alias), the directory line as note, the
// bio and the profile at the join, each limit in its own unit (x-limit; maxLength where it counts characters)
const chars = (max) => ({ maxLength: max, "x-limit": { max, unit: "characters" } });
const NEXT = {
  household: { type: "string", required: true, ...chars(60), "x-group": "household" },
  handle: { type: "string", required: true, maxLength: 40, "x-limit": { max: 40, unit: "characters" } },
  full_address: { type: "string", required: true, "x-multiline": true, "x-limit": { max: 50000, unit: "bytes" }, description: "The whole of them, for anyone who wants it: the Address card on their resident page." },
  agent: { type: "string", "x-limit": { max: 48, unit: "reader-characters" } },
  note: { type: "string", title: "Directory line", ...chars(120), description: "Their one line: it is their line in the town directory and the line on their Address card." },
  bio: { type: "string", ...chars(400) },
  pronouns: { type: "string", ...chars(56) },
  color: { type: "string", pattern: "^(#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6}))?$" },
  color_name: { type: "string", ...chars(56) },
  runtime: { type: "string", ...chars(72) },
  invited_by: { type: "string", ...chars(64) },
  heard: HEARD,
  heard_note: { type: "string", ...chars(280) },
  motto: { type: "string", ...chars(30), title: "A motto", description: "A field this site does not place: it still reaches the form." },
};
const ADD = { handle: { type: "string", required: true, maxLength: 40 }, card: { type: "string", required: true }, agent: { type: "string" }, note: { type: "string" } };
// a berth's begin: the berth is the handle, so no handle field
const BEGIN = { household: { type: "string", required: true, "x-group": "household" }, card: { type: "string", required: true }, agent: { type: "string" }, note: { type: "string" } };

// a visitor is still signed in: /me answers with no handles (a 401 here would sign the page's own header out, as it should). Once an act admits a
// resident, /me answers with that handle too, as the office's sign-in then acts for it. Every request's body is kept, to show what never travels.
// THE BERTH ROAD (Office f22c069a): POST /berth mints a key for a free slug (409 for a held one); POST /household { do: "begin" } with that key
// parks the args and answers the co-sign link; /me with that key is the berth until `o.cosign()` plays the human's click on the office's page,
// and the household's (naming the handle) after it. The writes after admission are allowed only for a credential /me says holds the handle.
function officeFor({ tier = "visitor", act = "declare", fields = TODAY, me = { handles: [], households: {} }, held = [], refuseDescribe = null } = {}) {
  const o = { asked: [], sent: [], me, writes: [], bodies: [], events: [], auths: [], boarded: [], begun: [], berths: {}, cosigned: false, held, refuseDescribe };
  o.cosign = () => { o.cosigned = true; o.events.push("cosign"); };
  o.meFor = (auth) => {
    const slug = Object.keys(o.berths).find((s) => auth === `Bearer ${o.berths[s]}`);
    if (!slug) return o.me;
    return o.cosigned ? { handles: [slug], household: "fixture-house", households: { [slug]: { slug: "fixture-house" } } } : { berth: slug, handles: [] };
  };
  o.answer = (msg) => {
    if (msg.method === "initialize") return { jsonrpc: "2.0", id: msg.id, result: { protocolVersion: "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "fixture-office", version: "0" } } };
    if (msg.method !== "tools/call") return msg.id == null ? null : { jsonrpc: "2.0", id: msg.id, result: {} };
    const a = msg.params?.arguments ?? {};
    const text = (v) => ({ jsonrpc: "2.0", id: msg.id, result: { content: [{ type: "text", text: JSON.stringify(v) }] } });
    if (a.read_shape === "v1") return text({ tier, standing: tier, acts: [{ act, teaches: "Move an agent in.", fields }], next: ["Fill in the form; the office answers."] });
    if (a.read === act) return text({ card: { action: act, blurb: "Move an agent in.", fields } });
    if (a.do === act) {
      o.sent.push(a.args); o.events.push("send");
      if (act !== "begin" && a.args.handle) o.me = { ...o.me, handles: [...(o.me?.handles ?? []), a.args.handle] };
      return text(act === "begin" ? { parked: true, note: "Fixture: parked. Your human co-signs at the link." } : { admitted: true, note: "Fixture: admitted. Welcome to the fixture town.", handle: a.args.handle ?? null });
    }
    return text({ defect: "fixture: not asked for" });
  };
  return o;
}

async function openPage(b, base, path, { width, height = 900, office }) {
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
    office.bodies.push(request.postData ?? "");
    const auth = Object.entries(request.headers ?? {}).find(([k]) => k.toLowerCase() === "authorization")?.[1] ?? null;
    office.auths.push({ at: `${request.method} ${u.pathname}`, auth });
    if (local && request.method === "POST" && u.pathname === "/api/mcp") { const msg = JSON.parse(request.postData || "{}"); const r = office.answer(msg); return r ? reply(200, r) : reply(202, null); }
    if (local && request.method === "GET" && u.pathname === "/api/me") { const m = office.meFor(auth); return m ? reply(200, m) : reply(401, { defect: "fixture: signed out" }); }
    // the berth road: keyless board, then begin under the berth's key
    if (local && request.method === "POST" && u.pathname === "/api/berth") {
      const slug = JSON.parse(request.postData || "{}").slug;
      office.boarded.push(slug); office.events.push("board");
      if (office.held.includes(slug)) return reply(409, { defect: `"${slug}" is already held — it is a live berth`, hint: "names are single-occupancy across the whole town; pick another" });
      office.berths[slug] = `fixture-berth-key-${slug}`;
      return reply(201, { berth: slug, speaker: `berth-${slug}`, key: office.berths[slug], expires_at: new Date(Date.now() + 7 * 864e5).toISOString() });
    }
    if (local && request.method === "POST" && u.pathname === "/api/household") {
      const body = JSON.parse(request.postData || "{}");
      const slug = Object.keys(office.berths).find((s) => auth === `Bearer ${office.berths[s]}`);
      if (body.do !== "begin" || !slug) return reply(403, { defect: "begin is a berth's act", hint: "board first" });
      office.begun.push(body.args); office.events.push("begin");
      return reply(200, { declared: body.args.household, handle: slug, cosign_url: `${base}/api/oauth/berth-cosign?slug=${slug}&b=1764100000`, note: "Calling begin again replaces the parked declaration." });
    }
    // the resident's own doors, after an admission (src/lib/join-after.mjs): only for a credential /me says holds the handle
    const own = (h) => (office.meFor(auth)?.handles ?? []).includes(decodeURIComponent(h));
    const prof = /^\/api\/profile\/([^/]+)(\/avatar)?$/.exec(u.pathname);
    if (local && request.method === "PATCH" && prof) {
      office.writes.push({ path: u.pathname.slice(4), body: request.postData ?? "", auth }); office.events.push("write");
      return own(prof[1]) ? reply(200, { saved: true }) : reply(403, { defect: "fixture: not yours" });
    }
    // the appearance (CORE-188, Wright 2026-11-26): the world door's web twin, describe as an agent's goes (office entity-predicates.mjs § worldDescribe):
    // the resident's own household only; it answers the node it described; `refuseDescribe` plays a refusal (the harbor's, below)
    if (local && request.method === "POST" && u.pathname === "/api/world/apex") {
      const a = JSON.parse(request.postData || "{}").args ?? {};
      office.writes.push({ path: "/world/apex", body: request.postData ?? "", auth }); office.events.push("write");
      if (office.refuseDescribe) return reply(office.refuseDescribe.status, office.refuseDescribe.body);
      if (!own(a.handle ?? "")) return reply(403, { defect: `"${a.handle}" is not one of your residents` });
      return reply(200, { described: a.slot === "appearance" ? `${a.handle}/appearance` : `${a.handle}/appearance.${a.slot}`, canon: "live" });
    }
    if (local && request.method === "POST" && u.pathname === "/api/media") {
      office.writes.push({ path: "/media" + u.search, body: "(bytes)", auth }); office.events.push("write");
      return reply(200, { url: `https://media.postmark.town/media/${u.searchParams.get("by")}/fixture-sheet.webp` });
    }
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
function pngFile() {
  const w = 32, h = 32, raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = y * (w * 3 + 1) + 1 + x * 3; raw[o] = 232; raw[o + 1] = 196; raw[o + 2] = 139; }
  const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const file = join(mkdtempSync(join(tmpdir(), "core188-pic-")), "fixture.png");
  writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]));
  return file;
}

let browser = null, server = null, base = null;
async function setup() {
  if (browser) return;
  const chrome = findChrome();
  assert.ok(chrome, "built pages are here but no Chrome/Chromium was found: this test fails rather than skip, so the built-pages job cannot pass on a skip");
  server = await serveDist();
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await launch(chrome);
}
after(() => { browser?.close(); server?.close(); });

const STEP = (n) => `!document.querySelector('[data-step="${n}"]').hidden`;
const text = (sel) => `(document.querySelector(${JSON.stringify(sel)})?.textContent ?? "").trim()`;

test("TODAY'S CARD: the steps fill the real page, count and refuse in the office's measure, keep values across Back and edit, and send only what the card takes", { skip: SKIP }, async () => {
  await setup();
  const office = officeFor();
  const p = await openPage(browser, base, "/join/move-in/", { width: 1440, office });
  try {
    await p.until(STEP("household"), "step 1");
    // the Registrar, her name linked to her page, and her step-1 words, her welcome first (Darko, 2026-11-26: "intro sentence first")
    assert.equal(await p.js(`document.querySelector('[data-reg-at="act"] a.jd-reg-name')?.getAttribute("href")`), "/residents/registrar/", "her name links to her page, on every step");
    // her name is Regina (Darko, 2026-11-26: "we also should call the registrar Regina the Registrar, and use Regina")
    assert.equal(await p.js(text('[data-reg-at="act"] a.jd-reg-name')), "Regina the Registrar");
    assert.equal(await p.js(`[...document.querySelectorAll(".jd-reg-name")].every((a) => a.textContent.trim() === "Regina the Registrar")`), true, "a bubble still says The Registrar");
    assert.match(await p.js(text('[data-reg-at="act"] [data-reg-words]')), /^Welcome to Postmark! I'm Regina, the Registrar, and I'll help your agent move in\. This first step is yours, the human's/);
    // ONE COUNT: five dots for five steps, "Step 1 of 5", #step-1
    assert.equal(await p.js(text("[data-jd-kicker]")), "Step 1 of 5 · Your household");
    assert.equal(await p.js(`document.querySelectorAll("[data-jf-dots] span").length`), 5, "a dot per step, none for the look-over");
    assert.equal(await p.js("location.hash"), "#step-1");
    // CONTINUE LIVES IN HER BUBBLE (Darko, 2026-11-26), on screen at the top of the step, and nothing of it is left at the bottom of the page
    assert.equal(await p.js(`!!document.querySelector('[data-reg-at="act"] .jd-reg-bubble [data-jf-next]') && !!document.querySelector('[data-reg-at="act"] .jd-reg-bubble [data-form-error]')`), true, "Continue or the error slot left her bubble");
    assert.equal(await p.js(`(() => { const r = document.querySelector("[data-jf-next]").getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; })()`), true, "Continue is not on screen");
    assert.equal(await p.js(`document.querySelectorAll("[data-jf-next], [data-submit]").length`), 2, "a second Continue or Send is on the page");
    assert.equal(await p.js(`document.getElementById("jd-household").getAttribute("aria-required")`), "true", "the card's required flag reaches the box");
    // a required piece stops Continue, in the one alert slot
    await p.click("[data-jf-next]");
    assert.match(await p.js(text("[data-form-error]")), /Household name is needed before you go on/);
    assert.equal(await p.js(`document.querySelector("[data-form-error]").getAttribute("role")`), "alert");
    await p.type("#jd-household", "Fixture Hollow");
    assert.equal(await p.js(text('[data-count-for="household"]')), "14 characters", "a live count; today's card names no limit, so none is made up");
    // THE HUMAN'S OWN ARE THE OFFICE CO-SIGN PAGE'S (the ruled fallback): no box for them here, and the step says where they are asked
    assert.equal(await p.js(`!!document.querySelector("#jd-town_name, #jd-short_line, #jd-human_pronouns, input[name=likeness]")`), false, "a human box is back on the site");
    assert.equal(await p.js(`document.querySelector("[data-human-later]").hidden`), false);
    assert.match(await p.js(text("[data-human-later]")), /You give both at the end, on the office's co-sign page/);
    assert.match(await p.js(text('[data-reg-at="act"] [data-reg-words]')), /office's co-sign page/);
    // ONE Registrar on the page, her own profile picture (Darko, 2026-11-26: "we should really use her profile picture"), and nothing of the page
    // inside her link (Astro once re-opened her <a> after a <template>, CORE-188)
    assert.equal(await p.js(`[...document.querySelectorAll("a.jd-reg-face")].filter((a) => a.offsetParent !== null).length`), 1, "one Registrar shows");
    assert.equal(await p.js(`[...document.querySelectorAll("a.jd-reg-face")].every((a) => a.children.length === 1 && a.firstElementChild.tagName.toLowerCase() === "img")`), true, "her link holds her picture and nothing else");
    assert.match(await p.js(`document.querySelector('[data-reg-at="act"] a.jd-reg-face img').getAttribute("src")`), /^https:\/\/media\.postmark\.town\/media\//, "her picture is not her profile's own");
    assert.equal(await p.js(`!!document.querySelector("svg.px")`), false, "the drawn token is back");
    await p.key("Enter");
    await p.until(STEP("who"), "step 2, by Enter");
    assert.equal(await p.js("location.hash"), "#step-2");
    // the step's line, without the welcome now
    assert.match(await p.js(text('[data-reg-at="act"] [data-reg-words]')), /^Here's your agent's page, still blank\./);
    // the page steps show the resident page's own pieces, its top lit; THE PIECES ARE THE BOXES: no form of their own under the page
    assert.equal(await p.js(`!document.querySelector("[data-blank-page]").hidden && !!document.querySelector("[data-blank-page] .profile-bubble[data-profile-bubble]") && !!document.querySelector("[data-blank-page] .bcard[data-kind=Address]")`), true);
    for (const id of ["agent", "handle", "runtime", "architecture", "since", "line", "bio", "full_address", "pronouns", "color", "color_name"])
      assert.equal(await p.js(`!!document.querySelector('[data-blank-page] [data-fill="${id}"] #jd-${id}') && !document.querySelector('[data-drawer] #jd-${id}')`), true, `${id} is not typed into on the page itself`);
    assert.equal(await p.js(`document.querySelector('[data-blank-page] [data-fill="agent"]').classList.contains("is-lit")`), true);
    // only the step's pieces are lit and typed into; the rest read as the page
    assert.equal(await p.js(`document.getElementById("jd-agent").readOnly`), false);
    assert.equal(await p.js(`document.getElementById("jd-bio").readOnly && document.getElementById("jd-bio").tabIndex === -1 && !document.querySelector('[data-fill="bio"]').classList.contains("is-lit")`), true, "a later step's piece is open on step 2");
    // the box says what the page says: one name for the blank piece
    assert.equal(await p.js(`document.getElementById("jd-agent").placeholder`), "Your agent's name");
    // the page's buttons are a picture of them
    assert.equal(await p.js(`getComputedStyle(document.querySelector("[data-blank-page] .profile-actions .pm-btn")).pointerEvents`), "none", "Write to looks live");
    assert.equal(await p.js(text('[data-blank-page] [data-show="household"]')), "Fixture Hollow", "the house's chip carries the house typed on step 1");
    await p.type("#jd-agent", "Quillon");
    assert.equal(await p.js(`document.querySelector('[data-blank-page] h1 #jd-agent').value`), "Quillon", "the name is typed into the page's title");
    assert.equal(await p.js(text('[data-blank-page] .bcard-title')), "Quillon", "and shows on the Address card");
    // she says what a piece is for when the reader moves into it (the hints come from her), and the step's line comes back when they leave
    await p.js(`document.getElementById("jd-handle").focus(), true`);
    assert.match(await p.js(text('[data-reg-at="act"] [data-reg-words]')), /^Where letters find them.*2–31/, "she says nothing about the handle");
    await p.type("#jd-handle", "quillon-fixture");
    assert.equal(await p.js(`document.querySelector('[data-blank-page] .profile-handle #jd-handle').value`), "quillon-fixture");
    // the count shows beside the piece while it has focus
    assert.equal(await p.js(`getComputedStyle(document.querySelector('[data-count-for="handle"]')).display`), "block");
    assert.equal(await p.js(text('[data-count-for="handle"]')), "15 / 31");
    // Tab walks the lit pieces in the page's own reading order
    await p.js(`document.getElementById("jd-agent").focus(), true`);
    await p.key("Tab");
    assert.equal(await p.js("document.activeElement.id"), "jd-runtime", "Tab from the name goes to the next lit piece on the page (its chip)");
    await p.js(`document.activeElement.blur(), true`);
    await p.until(`/^Here's your agent's page/.test(${text('[data-reg-at="act"] [data-reg-words]')})`, "her step line back after the reader leaves the pieces");
    await p.type("#jd-runtime", "a fixture runtime");
    assert.equal(await p.js(`document.querySelector('[data-blank-page] [data-profile-runtime] #jd-runtime').value`), "a fixture runtime");
    // the dropped field is not on the form
    assert.equal(await p.js(`[...document.querySelectorAll("[data-extra]")].map((e) => e.dataset.extra).join(",")`), "", "from_town is off the form, and nothing else is unplaced");
    await p.click("[data-jf-next]");
    await p.until(STEP("describe"), "step 3");
    await p.type("#jd-line", "A fixture who answers every letter.");
    assert.equal(await p.js(`document.querySelector('[data-blank-page] .bcard-line #jd-line').value`), "A fixture who answers every letter.");
    await p.type("#jd-bio", "🌊".repeat(401));
    assert.equal(await p.js(text('[data-count-for="bio"]')), "401 / 400 — 1 too many", "an emoji is one character, the office's measure");
    // THE PROBLEM SHOWS BESIDE THE PIECE AS SOON AS IT'S WRONG, before any Continue
    assert.equal(await p.js(text('[data-problem-for="bio"]')), "Bio is 1 too long: 401 of 400 characters.");
    assert.equal(await p.js(`getComputedStyle(document.querySelector('[data-problem-for="bio"]')).display`), "block", "the bio's problem is written but not shown");
    assert.equal(await p.js(`document.querySelector("[data-form-error]").hidden`), true, "the alert spoke before anyone pressed Continue");
    await p.click("[data-jf-next]");
    assert.match(await p.js(text("[data-form-error]")), /Bio is 1 too long: 401 of 400 characters/);
    assert.equal(await p.js(STEP("describe")), true, "an over-long bio stops Continue");
    // a required piece says it's needed beside itself only once the reader has been stopped for it
    assert.equal(await p.js(text('[data-problem-for="full_address"]')), "Full address is needed before you go on.", "the stop didn't mark every piece it stopped on");
    await p.type("#jd-bio", "I keep a fixture garden of notes.");
    assert.equal(await p.js(text('[data-problem-for="bio"]')), "", "a fixed piece still says it's wrong");
    await p.type("#jd-full_address", "I'm Quillon, a fixture. Write to me plainly.");
    assert.equal(await p.js(`document.querySelector('[data-blank-page] .jd-full #jd-full_address').value`), "I'm Quillon, a fixture. Write to me plainly.");
    assert.equal(await p.js(text('[data-problem-for="full_address"]')), "");
    await p.click("[data-jf-next]");
    await p.until(STEP("more"), "step 4");
    // the drawer under the page: the Edit profile form's own picture row; the colour and pronouns are the page's own boxes
    assert.equal(await p.js(`!document.querySelector("[data-drawer]").hidden && !!document.querySelector('[data-drawer] [data-step="more"] .profile-edit-avatar-row [data-profile-avatar-input]')`), true);
    await p.type("#jd-color", "#7ea1ff");
    assert.equal(await p.js(`document.querySelector("[data-blank-page] [data-profile-bubble]").style.getPropertyValue("--profile-color")`), "#7ea1ff", "the colour reaches the page's edge");
    await p.type("#jd-color", "blue");
    assert.match(await p.js(text('[data-problem-for="color"]')), /3 or 6 hex digits/, "a colour that isn't one isn't said beside it");
    await p.type("#jd-color", "#7ea1ff");
    await p.type("#jd-pronouns", "they/them");
    assert.equal(await p.js(`document.querySelector('[data-blank-page] [data-profile-pronouns] #jd-pronouns').value`), "they/them");
    await p.setFile("[data-profile-avatar-input]", pngFile());
    await p.until(`!!document.querySelector('[data-blank-page] [data-fill="picture"] img')`, "the picture on the page");
    await p.js(`(() => { const z = document.querySelector("[data-profile-avatar-zoom]"); z.value = "2"; z.dispatchEvent(new Event("input", { bubbles: true })); return true; })()`);
    const framed = await p.js(`document.querySelector('[data-blank-page] [data-fill="picture"] img').style.transform`);
    assert.match(framed, /scale\(2\)/);
    // THE APPEARANCE: the two sentences and Wright's three companions, each with a live count
    await p.type("#jd-glance", "A fixture heron in a moss-green coat.");
    await p.type("#jd-glance_value", "a fixture heron");
    assert.equal(await p.js(text('[data-count-for="glance_value"]')), "15 characters", "a value has no cap at the office, so the count names none");
    await p.type("#jd-sign", "A brass thimble on one claw.");
    await p.type("#jd-sign_slot", "Left Claw");
    assert.equal(await p.js(text('[data-count-for="sign_slot"]')), "9 / 48", "the office's slot grammar, counted");
    await p.type("#jd-sign_value", "brass, worn smooth");
    await p.click("[data-jf-next]");
    await p.until(STEP("found"), "step 5");
    await p.type("#jd-invited_by", "fixture-friend");
    await p.js(`(() => { const s = document.getElementById("jd-heard"); s.value = "friend"; s.dispatchEvent(new Event("input", { bubbles: true })); return true; })()`);
    assert.equal(await p.js(`[...document.getElementById("jd-heard").options].map((o) => o.textContent).join("|")`), "Pick one|YouTube|Discord|A friend or another resident|Other", "the office's own options");
    await p.type("#jd-heard_note", "a fixture note");
    await p.click("[data-jf-next]");
    await p.until(STEP("review"), "the look-over: five steps, the likeness is the co-sign page's");
    assert.equal(await p.js("location.hash"), "#review");
    // the finished page is the same page, filled, under the review
    assert.equal(await p.js(`!!document.querySelector('[data-review-page-slot] [data-blank-page]') && !document.querySelector("[data-blank-page]").hidden`), true);
    assert.match(await p.js(text("[data-review-sends-words]")), /^8 fields, under the office's own names: household, agent, handle, note, card, invited_by, heard, heard_note\. A box left blank is not sent\. The handle also names your agent's berth\./);
    // what Send will do, said before it does it
    assert.equal(await p.js(`document.querySelector("[data-review-road]").hidden`), false);
    assert.match(await p.js(text("[data-review-road]")), /takes a berth for your agent under the handle quillon-fixture.*co-sign page.*asks your own profile and the likeness answer/s);
    assert.match(await p.js(text('[data-reg-at="act"] [data-reg-words]')), /office's co-sign page/);
    // every other piece, by its fate: what this page sets once the co-sign admits the agent, and what is not sent
    const names = (sel) => p.js(`[...document.querySelectorAll(${JSON.stringify(sel)})].map((b) => b.textContent).join("|")`);
    const after = (await names("[data-review-after-list] li > b")).split("|");
    for (const k of ["Runtime", "Bio", "Favorite color", "Pronouns", "Profile picture", "Your appearance", "What the appearance is", "The detail people know you by", "Its part", "What that part is"]) assert.ok(after.includes(k), `${k} is listed as set after admission (${after})`);
    assert.match(await p.js(text("[data-review-after-list]")), /Its part left-claw/, "the part is shown as the word it is sent as");
    assert.match(await p.js(text("[data-review-after-list]")), /under the glance .*, right after the glance lands \(never without it\)/);
    assert.match(await p.js(text("[data-review-after-list]")), /once you've co-signed on the office's page/);
    assert.equal(await p.js(`document.querySelectorAll(".jd-tag.is-wip").length`), 0, "work-in-progress words are left over from the held human transfer");
    assert.equal(await p.js(`getComputedStyle(document.querySelector("[data-review-after-list] li > b")).color === getComputedStyle(document.querySelector("[data-review-after-list] li")).color`), true, "a piece's name is in ink, not the paper's refusal red");
    // edit · the three sizes goes back to step 3 with every value, and the picture's framing, still there; its Continue comes straight back
    await p.click('[data-edit-step="describe"]');
    await p.until(STEP("describe"), "edit to step 3");
    assert.equal(await p.js(`document.getElementById("jd-bio").value`), "I keep a fixture garden of notes.");
    assert.equal(await p.js(`document.querySelector('[data-blank-page] [data-fill="picture"] img').style.transform`), framed, "the picture's framing is kept");
    assert.equal(await p.js(text("[data-jf-next]")), "Back to Look it over");
    assert.equal(await p.js(`document.querySelector("[data-jf-skip]").hidden`), true, "an edit has no Skip");
    await p.click("[data-jf-next]");
    await p.until(STEP("review"), "straight back to the look-over");
    // and the browser's Back from an edit lands on the look-over too
    await p.click('[data-edit-step="more"]');
    await p.until(STEP("more"), "edit to step 4");
    await p.js("history.back(), true");
    await p.until(STEP("review"), "Back to the look-over");
    assert.deepEqual(office.boarded, [], "a berth was taken while the reader was still typing");
    assert.equal(office.writes.length, 0, "a resident write before the office was asked anything");
    // SEND: a berth under the handle (keyless), then begin under that berth's key; never the visitor's own declare
    await p.click("[data-submit]");
    await p.until(`!document.querySelector("[data-gate-cosign]").hidden`, "the co-sign screen");
    assert.deepEqual(office.boarded, ["quillon-fixture"], "one berth, under the handle");
    assert.equal(office.auths.find((a) => a.at === "POST /api/berth").auth, null, "the reader's own sign-in rode the keyless board");
    assert.equal(office.auths.find((a) => a.at === "POST /api/household").auth, "Bearer fixture-berth-key-quillon-fixture", "begin went with something other than the berth's own key");
    assert.equal(office.sent.length, 0, "the visitor's own declare was called");
    assert.equal(office.begun.length, 1);
    assert.deepEqual(Object.keys(office.begun[0]).sort(), ["agent", "card", "handle", "heard", "heard_note", "household", "invited_by", "note"], "begin carries what today's card takes, the chosen handle with it");
    // the chosen resident rides begin (the receiver, Office #1237 candidate c1bd858b, parks it apart from the berth; this fixture is today's office,
    // which answers the slug); under the 31 rule it is the berth's own name
    assert.equal(office.begun[0].handle, "quillon-fixture");
    assert.equal(office.begun[0].card, "I'm Quillon, a fixture. Write to me plainly.");
    for (const never of ["bio", "pronouns", "color", "color_name", "runtime", "town_name", "short_line", "human_pronouns", "likeness", "glance", "sign", "from_town"]) assert.equal(never in office.begun[0], false, `${never} rode begin on today's card`);
    // the co-sign screen names the resident the office answered; it agrees with what was asked, so no difference is said
    assert.equal(await p.js(text("[data-cosign-handle]")), "quillon-fixture");
    assert.equal(await p.js(`document.querySelector("[data-cosign-resident]").hidden`), true);
    // the handoff: the office's own co-sign link for THIS berth, in a new tab, carrying no key; the Registrar says what that page asks
    assert.equal(await p.js(`document.querySelector("[data-cosign-link]").getAttribute("href")`), `${base}/api/oauth/berth-cosign?slug=quillon-fixture&b=1764100000`);
    assert.equal(await p.js(`document.querySelector("[data-cosign-link]").target`), "_blank");
    // she's there end to end: the co-sign's link and its check sit in her bubble
    assert.equal(await p.js(`!!document.querySelector('[data-reg-at="cosign"] .jd-reg-bubble [data-cosign-link]') && !!document.querySelector('[data-reg-at="cosign"] .jd-reg-bubble [data-cosign-check]')`), true);
    assert.match(await p.js(text('[data-reg-at="cosign"] [data-reg-words]')), /co-sign page.*sign in with GitHub.*your own profile.*short videos.*Keep this tab open/s);
    assert.equal(await p.js(`document.querySelector("[data-gate-cosign]").textContent.includes("fixture-berth-key")`), false, "the berth key is on the page");
    assert.equal(await p.js(`JSON.stringify({ ...localStorage }).includes("fixture-berth-key") || JSON.stringify({ ...sessionStorage }).includes("fixture-berth-key")`), false, "the berth key was stored");
    assert.equal(await p.js(`JSON.parse(localStorage.getItem("pm.oauth.token")).access_token`), "invented-token", "the reader's own sign-in was overwritten");
    // before the human's click: asked, not admitted, nothing written
    await p.click("[data-cosign-check]");
    await p.until(`/Not yet/.test(document.querySelector("[data-cosign-status]").textContent)`, "not yet");
    assert.equal(office.writes.length, 0, "a resident write before the co-sign admitted anyone");
    // THE HUMAN CO-SIGNS on the office's page (played by the fixture); this tab finishes through the resident's own doors
    office.cosign();
    await p.click("[data-cosign-check]");
    await p.until(`!document.querySelector("[data-gate-in]").hidden`, "you're in, after the co-sign");
    assert.deepEqual(office.events.filter((e) => e !== "write").slice(0, 3), ["board", "begin", "cosign"]);
    assert.ok(office.events.indexOf("write") > office.events.indexOf("cosign"), "a resident write went before the co-sign");
    assert.deepEqual(office.writes.map((w) => w.path), ["/profile/quillon-fixture", "/profile/quillon-fixture/avatar", "/world/apex", "/world/apex"]);
    assert.ok(office.writes.every((w) => w.auth === "Bearer fixture-berth-key-quillon-fixture"), "the after-admission writes went with another credential");
    // the glance, then the detail under it, as the describe door takes them: the author's own values, the slot as its word
    assert.deepEqual(JSON.parse(office.writes[2].body), { do: "describe", args: { handle: "quillon-fixture", slot: "appearance", value: "a fixture heron", body: "A fixture heron in a moss-green coat." } });
    assert.deepEqual(JSON.parse(office.writes[3].body), { do: "describe", args: { handle: "quillon-fixture", slot: "left-claw", value: "brass, worn smooth", body: "A brass thimble on one claw." } });
    assert.deepEqual(Object.keys(JSON.parse(office.writes[0].body)).sort(), ["bio", "color", "pronouns", "runtime"]);
    assert.equal(JSON.parse(office.writes[0].body).color, "#7ea1ff");
    const pic = JSON.parse(office.writes[1].body);
    assert.equal(pic.type, "image/jpeg", "the framed picture is re-encoded, as Edit profile does");
    assert.ok(pic.image.length > 100, "the picture travels");
    assert.equal(office.asked.filter((a) => !/^(POST \/api\/mcp|GET \/api\/me|POST \/api\/berth|POST \/api\/household|PATCH \/api\/profile\/quillon-fixture(\/avatar)?|POST \/api\/world\/apex)$/.test(a)).length, 0, `no other office call: ${office.asked.join(", ")}`);
    // THE HUMAN'S OWN, IN NO REQUEST THIS PAGE MADE (the office's co-sign page asks them)
    for (const f of ["town_name", "short_line", "human_pronouns", "likeness"]) assert.ok(!office.bodies.some((b) => b.includes(`"${f}"`)), `a request carried ${f}`);
    assert.ok(!office.asked.some((a) => /oauth\/(consent|human|likeness)/.test(a)), "the page posted to a human-only door");
    // you're in: two lines, the page's link, and what the page set
    assert.match(await p.js(text('[data-reg-at="in"] [data-reg-words]')), /^Welcome in!/);
    assert.equal(await p.js(`!!document.querySelector('[data-reg-at="in"] .jd-reg-bubble [data-in-go]')`), true, "You're in's button left her bubble");
    assert.match(await p.js(text("[data-in-page]")), /about half an hour/);
    assert.match(await p.js(text("[data-in-letters]")), /about 15 minutes.*7 AM and 7 PM Eastern/);
    assert.equal(await p.js(`document.querySelector("[data-in-page-link]").getAttribute("href")`), "/residents/quillon-fixture/");
    assert.equal(await p.js(`[...document.querySelectorAll("[data-in-after-list] li")].map((li) => li.querySelector("b").textContent + ":" + li.querySelector(".jd-kept-value").textContent).join("|")`), "Profile:set|Picture:set|Appearance:set|Appearance detail:set");
  } finally { await p.close(); }
});

test("THE ACCEPTED CARD (POS-1237, f22c069a): its limits count in their own units, its names carry them, and a field the design does not place still reaches the form", { skip: SKIP }, async () => {
  await setup();
  const office = officeFor({ fields: NEXT });
  const p = await openPage(browser, base, "/join/move-in/", { width: 1440, office });
  try {
    await p.until(STEP("household"), "step 1");
    await p.type("#jd-household", "Fixture Two");
    await p.click("[data-jf-next]");
    await p.until(STEP("who"), "step 2");
    // ON THE CO-SIGN ROAD THE HANDLE BOARDS THE BERTH FIRST: the card's 40 is counted against the berth's 31, out loud, and refused before any mint
    await p.type("#jd-handle", "a-fixture-handle-that-runs-too-long");
    assert.equal(await p.js(text('[data-count-for="handle"]')), "35 / 31 — 4 too many");
    await p.click("[data-jf-next]");
    assert.match(await p.js(text("[data-form-error]")), /Handle is 4 too long: 35 of 31 characters/);
    assert.match(await p.js(text("[data-berth-note]")), /first boards your agent's berth.*2–31 lowercase letters/, "the berth's narrower rule is said on the step, not only in a refusal");
    assert.equal(await p.js(STEP("who")), true, "an over-long handle went on");
    await p.type("#jd-handle", "the-fixture");
    await p.click("[data-jf-next]");
    assert.match(await p.js(text("[data-form-error]")), /can't start with the- or berth-/);
    assert.deepEqual(office.boarded, [], "a berth was taken for a handle that could never be the handle");
    await p.type("#jd-handle", "fixture-two");
    assert.equal(await p.js(`[...document.querySelectorAll("[data-extra]")].map((e) => e.dataset.extra).join(",")`), "motto", "the office's unplaced field is drawn");
    await p.type("#jd-extra-motto", "Slow and true.");
    assert.equal(await p.js(text('[data-count-for="extra:motto"]')), "14 / 30");
    await p.click("[data-jf-next]");
    await p.until(STEP("describe"), "step 3");
    await p.type("#jd-line", "A line");
    assert.equal(await p.js(text('[data-count-for="line"]')), "6 / 120", "the card's own limit, in characters");
    // no small label over a piece of the page: the box is named for a screen reader, and she says what it's for
    assert.equal(await p.js(`document.getElementById("jd-line").getAttribute("aria-label")`), "One line");
    assert.equal(await p.js(`!!document.getElementById("jd-line").closest("label")`), false, "a label is back over the page's own piece");
    await p.type("#jd-bio", "A bio.");
    await p.type("#jd-full_address", "The whole of mé.");
    assert.equal(await p.js(text('[data-count-for="full_address"]')), "17 / 50,000 bytes", "the full address counts UTF-8 bytes, as the office does");
    for (let i = 0; i < 4; i++) await p.click("[data-jf-next]").then(() => new Promise((r) => setTimeout(r, 150)));
    await p.until(STEP("review"), "the look-over");
    await p.click("[data-submit]");
    await p.until(`!document.querySelector("[data-gate-cosign]").hidden`, "the co-sign screen");
    assert.equal(office.begun.length, 1);
    assert.equal(office.begun[0].full_address, "The whole of mé.");
    assert.equal(office.begun[0].note, "A line", "the directory line under the card's own name");
    assert.equal(office.begun[0].bio, "A bio.", "a card that takes the bio gets it");
    assert.equal(office.begun[0].motto, "Slow and true.");
    assert.equal("card" in office.begun[0], false, "never the old name beside the new one");
    // the chosen resident rides begin beside the berth (Office #1237 candidate c1bd858b parks it apart; under the 31 rule it is the berth's name)
    assert.equal(office.begun[0].handle, "fixture-two");
    assert.deepEqual(office.boarded, ["fixture-two"], "the berth is still boarded under the handle while the 31 rule stands");
    office.cosign();
    await p.click("[data-cosign-check]");
    await p.until(`!document.querySelector("[data-gate-in]").hidden`, "you're in");
    assert.equal(office.writes.length, 0, "the card carried the profile itself: nothing left for the resident's doors");
    assert.equal(await p.js(`document.querySelector("[data-in-after]").hidden`), true, "You're in claims a part the page never set");
  } finally { await p.close(); }
});

test("AN EXISTING HOUSE (add-resident): no house to name, no human profile, and the look-over says which house", { skip: SKIP }, async () => {
  await setup();
  const office = officeFor({ tier: "resident", act: "add-resident", fields: ADD, me: { handles: ["keeper-fixture"], households: { "keeper-fixture": { slug: "fixture-keep" } } } });
  const p = await openPage(browser, base, "/join/move-in/", { width: 1440, office });
  try {
    await p.until(STEP("who"), "the first step is who's moving in");
    assert.equal(await p.js(text("[data-jd-kicker]")), "Step 1 of 3 · Who's moving in", "the steps counted are this reader's: no house, and no found-us on an act that takes neither answer");
    // ONE COUNT (Wright's walk, 2026-11-26: four dots, "Step 1 of 3", #step-2): three dots, the first lit, and #step-1
    assert.equal(await p.js("location.hash"), "#step-1");
    assert.equal(await p.js(`[...document.querySelectorAll("[data-jf-dots] span")].map((s) => s.className || "-").join(",")`), "is-now,-,-");
    // a keeper's first bubble: her welcome, why there's no house to name, then the page's own line
    assert.match(await p.js(text('[data-reg-at="act"] [data-reg-words]')), /^Welcome to Postmark! .*no house to name.*Here's your agent's page/);
    await p.type("#jd-handle", "added-fixture");
    await p.click("[data-jf-next]");
    await p.until(STEP("describe"), "step 2 of 5");
    await p.type("#jd-full_address", "Added to a fixture house.");
    for (let i = 0; i < 3; i++) await p.click("[data-jf-next]").then(() => new Promise((r) => setTimeout(r, 150)));
    await p.until(STEP("review"), "the look-over");
    assert.match(await p.js(text("[data-review-house-list]")), /Adding to/);
    await p.click("[data-submit]");
    await p.until(`!document.querySelector("[data-gate-reply]").hidden`, "the sent screen");
    assert.equal("household" in office.sent[0], false, "a keeper is not asked for a house");
    assert.equal(office.sent[0].card, "Added to a fixture house.");
  } finally { await p.close(); }
});

test("THE APPEARANCE REFUSED: the part can't be the root's name; a glance the office refuses sends no detail, claims nothing, and says back what was written", { skip: SKIP }, async () => {
  await setup();
  // the harbor's own refusal (office harbor-gate.mjs § HARBOR_BOUNCE): what a house still at the harbor gets for any durable act, describe included
  const harbor = { status: 403, body: { defect: "the harbor is read + ephemeral", hint: "durable acts come ashore with settlement" } };
  const office = officeFor({ tier: "resident", act: "add-resident", fields: ADD, me: { handles: ["keeper-fixture"], households: { "keeper-fixture": { slug: "fixture-keep" } } }, refuseDescribe: harbor });
  const p = await openPage(browser, base, "/join/move-in/", { width: 1440, office });
  try {
    await p.until(STEP("who"), "who's moving in");
    await p.type("#jd-handle", "looked-fixture");
    await p.click("[data-jf-next]");
    await p.until(STEP("describe"), "describe");
    await p.type("#jd-full_address", "A fixture who describes itself.");
    await p.click("[data-jf-next]");
    await p.until(STEP("more"), "more about you");
    await p.type("#jd-glance", "A fixture lantern with a cracked pane.");
    await p.type("#jd-glance_value", "a fixture lantern");
    await p.type("#jd-sign", "The crack runs corner to corner.");
    await p.type("#jd-sign_value", "a hairline crack");
    // the root's own name as a part: refused before anything is sent, in the one alert slot
    await p.type("#jd-sign_slot", "appearance");
    await p.click("[data-jf-next]");
    assert.equal(await p.js(STEP("more")), true, "a part named appearance went on");
    assert.match(await p.js(text("[data-form-error]")), /can't be "appearance": that's the glance's own name/);
    await p.type("#jd-sign_slot", "pane");
    await p.click("[data-jf-next]");
    await p.until(STEP("review"), "the look-over");
    await p.click("[data-submit]");
    await p.until(`!document.querySelector("[data-gate-reply]").hidden`, "the sent screen");
    await p.click("[data-show-in]");
    await p.until(`!document.querySelector("[data-gate-in]").hidden`, "you're in");
    // THE FALSIFIER: one describe (the glance), refused; no detail write; neither part claimed
    assert.deepEqual(office.writes.map((w) => w.path), ["/world/apex"], "a detail went out after a refused glance");
    assert.equal(JSON.parse(office.writes[0].body).args.slot, "appearance");
    const rows = await p.js(`[...document.querySelectorAll("[data-in-after-list] li")].map((li) => [li.querySelector("b").textContent, li.querySelector(".jd-kept-value").textContent, li.querySelector(".jd-kept-where").textContent])`);
    assert.deepEqual(rows.map((r) => r.slice(0, 2)), [["Appearance", "not set"], ["Appearance detail", "not set"]]);
    assert.match(rows[0][2], /^Not set: the harbor is read \+ ephemeral — durable acts come ashore with settlement\. You wrote “A fixture lantern with a cracked pane\.” \(what it is: “a fixture lantern”\)\. Your agent can describe themselves/);
    assert.match(rows[1][2], /^Not sent: a detail hangs under the glance, which didn't land\. You wrote “The crack runs corner to corner\.” \(pane: “a hairline crack”\)/);
    assert.doesNotMatch(await p.js(text("[data-in-after-list]")), /:\s*set\b|Set as your agent's appearance/, "a refused part was claimed");
  } finally { await p.close(); }
});

test("A BERTH (begin): no handle, no human profile and no likeness step here (its human gives them on the office's co-sign page), and nothing is written after", { skip: SKIP }, async () => {
  await setup();
  const office = officeFor({ tier: "berth", act: "begin", fields: BEGIN });
  const p = await openPage(browser, base, "/join/move-in/", { width: 1440, office });
  try {
    await p.until(STEP("household"), "step 1");
    assert.equal(await p.js(`document.querySelector("[data-human-later]").hidden`), true, "the agent route's step 1 speaks of a co-sign this page doesn't run");
    assert.equal(await p.js(`!!document.querySelector("#jd-town_name, input[name=likeness]")`), false, "a berth's human was asked their profile here");
    await p.type("#jd-household", "Fixture Berth");
    await p.click("[data-jf-next]");
    await p.until(STEP("who"), "step 2");
    assert.equal(await p.js(`document.getElementById("jd-handle").offsetParent === null`), true, "a berth was asked a handle its card does not take");
    await p.type("#jd-runtime", "a berth runtime");
    await p.click("[data-jf-next]");
    await p.until(STEP("describe"), "step 3");
    await p.type("#jd-full_address", "A berth's whole self.");
    await p.click("[data-jf-next]");
    await p.until(STEP("more"), "step 4");
    await p.setFile("[data-profile-avatar-input]", pngFile());
    await p.click("[data-jf-next]");
    await p.until(STEP("review"), "the look-over: no found-us, no likeness step");
    assert.equal(await p.js(text("[data-jd-kicker]")), "Look it over");
    assert.match(await p.js(text("[data-review-held-list]")), /co-sign/, "what waits for the co-sign says so");
    assert.equal(await p.js(`document.querySelector("[data-review-after]").hidden`), true, "a berth promised a write after");
    await p.click("[data-submit]");
    await p.until(`!document.querySelector("[data-gate-reply]").hidden`, "the sent screen");
    assert.deepEqual(Object.keys(office.sent[0]).sort(), ["card", "household"]);
    assert.equal(await p.js(`document.querySelector("[data-to-in]").hidden`), true, "no You're in before the human co-signs");
    assert.equal(office.writes.length, 0, "a berth's begin wrote to a resident");
  } finally { await p.close(); }
});

test("A HELD NAME: the board's refusal is said in the office's words, nothing is parked, and a second Send asks again", { skip: SKIP }, async () => {
  await setup();
  const office = officeFor({ held: ["held-fixture"] });
  const p = await openPage(browser, base, "/join/move-in/", { width: 1440, office });
  try {
    await p.until(STEP("household"), "step 1");
    await p.type("#jd-household", "Fixture Held");
    await p.click("[data-jf-next]");
    await p.until(STEP("who"), "step 2");
    await p.type("#jd-handle", "held-fixture");
    await p.click("[data-jf-next]");
    await p.until(STEP("describe"), "step 3");
    await p.type("#jd-full_address", "A fixture whose name is taken.");
    for (let i = 0; i < 3; i++) await p.click("[data-jf-next]").then(() => new Promise((r) => setTimeout(r, 150)));
    await p.until(STEP("review"), "the look-over");
    await p.click("[data-submit]");
    await p.until(`!document.querySelector("[data-form-error]").hidden`, "the refusal");
    assert.match(await p.js(text("[data-form-error]")), /"held-fixture" is already held — it is a live berth.*frees itself after seven days; pick another handle/);
    assert.equal(office.begun.length, 0, "begin ran without a berth");
    assert.equal(await p.js(STEP("review")), true, "the reader was moved off the look-over");
    assert.equal(await p.js(`document.querySelector("[data-submit]").disabled`), false, "Send stays dead after a refusal");
    await p.click("[data-submit]");
    await new Promise((r) => setTimeout(r, 400));
    assert.deepEqual(office.boarded, ["held-fixture", "held-fixture"], "a second Send asked again, and nothing else");
  } finally { await p.close(); }
});

test("A PHONE FRAME: every step fits 375 wide with no sideways scroll, her button on screen", { skip: SKIP }, async () => {
  await setup();
  const office = officeFor();
  const p = await openPage(browser, base, "/join/move-in/", { width: 375, height: 812, office });
  const fits = async (where) => {
    assert.ok(await p.js("document.documentElement.scrollWidth <= window.innerWidth + 1"), `sideways scroll at 375 on ${where} (${await p.js("document.documentElement.scrollWidth")})`);
    assert.equal(await p.js(`(() => { const b = [...document.querySelectorAll('[data-reg-at="act"] [data-jf-next], [data-reg-at="act"] [data-submit]')].find((e) => !e.hidden); const r = b.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && r.right <= innerWidth; })()`), true, `her button is off screen on ${where}`);
  };
  try {
    await p.until(STEP("household"), "step 1");
    await fits("step 1");
    await p.type("#jd-household", "Fixture Phone");
    await p.click("[data-jf-next]");
    await p.until(STEP("who"), "step 2");
    await p.type("#jd-agent", "A rather long fixture name");
    await p.type("#jd-handle", "fixture-phone");
    await fits("step 2");
    // scrolled down the page, she and her button are still there (sticky)
    await p.js("window.scrollTo(0, document.body.scrollHeight), true");
    await new Promise((r) => setTimeout(r, 150));
    await fits("step 2, scrolled");
    await p.click("[data-jf-next]");
    await p.until(STEP("describe"), "step 3");
    await p.type("#jd-full_address", "A fixture's whole self, long enough to wrap onto a second line on a phone.");
    await fits("step 3");
    await p.click("[data-jf-next]");
    await p.until(STEP("more"), "step 4");
    await fits("step 4");
    await p.click("[data-jf-skip]");
    await p.until(STEP("found"), "step 5");
    await p.click("[data-jf-skip]");
    await p.until(STEP("review"), "the look-over");
    await fits("the look-over");
  } finally { await p.close(); }
});
