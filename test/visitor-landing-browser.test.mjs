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
//   · THE CHROME (Facet's return on c71116a2): a visitor gets the mockup's nav row and exactly one footer, the social one, with Privacy
//     and Terms; the town's header and footer stand down for them and stay for a signed-in reader;
//   · THE LETTER: its FROM · TO · date line never runs under the stamp, at 375 and 1440;
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
  sideways: document.documentElement.scrollWidth > innerWidth,
  townHeader: ${SHOWN(".pm-townhead .pm-townnav-links")} || ${SHOWN(".pm-townhead .pm-townmark")}, landingNav: ${SHOWN(".pm-landing nav")}, townFooter: ${SHOWN(".pm-doorfoot")},
  footers: [...document.querySelectorAll("footer")].filter((f) => getComputedStyle(f).display !== "none" && f.getClientRects().length > 0)
    .map((f) => ({ landing: f.hasAttribute("data-landing-footer"), legal: [...f.querySelectorAll("a[data-legal-link]")].filter((a) => a.getClientRects().length).map((a) => a.getAttribute("href")),
      socials: [...f.querySelectorAll("a")].filter((a) => /discord|youtube|bsky|reddit|tiktok|x\\.com/.test(a.href)).length })) })`;
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
    // the visitor's chrome is the mockup's: its nav row (its links fold away on a phone, as the mockup's do), one footer, the town's stood down
    assert.equal(s.landingNav, true, "the mockup's nav row is shown");
    assert.equal(s.townHeader, false, "the town's header (its mark and its rail) stands down for a visitor");
    // the header's red mark is all it keeps for a visitor: hidden while the town is well (settlement-notice-browser drives it DOWN)
    assert.equal(await p.evalJs(`[...document.querySelectorAll(".pm-townhead > *")].filter((e) => getComputedStyle(e).display !== "none" && !e.hidden).map((e) => e.className)`).then((l) => l.length), 0,
      "nothing of the header is drawn while the sentinel is quiet");
    assert.equal(s.townFooter, false, "the town's footer stands down for a visitor");
    assert.equal(s.footers.length, 1, `one footer for a visitor at ${width}, not two`);
    assert.equal(s.footers[0].landing, true);
    assert.ok(s.footers[0].socials >= 5, "it is the social footer");
    assert.deepEqual(s.footers[0].legal, ["/privacy/", "/terms/"], "Privacy and Terms stay within reach");
    assert.equal(await p.evalJs(`getComputedStyle(document.querySelector(".pm-landing .navlinks")).display`), width < 820 ? "none" : "flex");
    await p.close();
  }
});

test("THE LETTER: its FROM · TO · date line stays clear of the stamp, at 375 and 1440", { skip: SKIP }, async () => {
  await setup();
  for (const [width, touch] of [[375, true], [1440, false]]) {
    const p = await openPage(browser, base, "/", { width, touch });
    const r = await p.evalJs(`(() => { const l = document.querySelector(".pm-landing .letter"), m = l.querySelector(".meta"); const st = getComputedStyle(l, "::after");
      const lb = l.getBoundingClientRect(); const stampLeft = lb.right - parseFloat(st.right) - parseFloat(st.width); const stampBottom = lb.top + parseFloat(st.top) + parseFloat(st.height);
      const rg = document.createRange(); rg.selectNodeContents(m); const words = [...rg.getClientRects()]; const mb = m.getBoundingClientRect();
      return { stampLeft, stampBottom, textRight: Math.max(...words.map((w) => w.right)), metaTop: mb.top, transform: getComputedStyle(l).transform }; })()`);
    assert.ok(r.transform === "none" || width > 820, "measured unrotated (on a phone the card is not turned)");
    if (r.metaTop < r.stampBottom) assert.ok(r.textRight <= r.stampLeft + 0.5, `at ${width} the meta line runs to ${r.textRight.toFixed(1)}, under the stamp from ${r.stampLeft.toFixed(1)}`);
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
    assert.equal(s.townHeader, true, "the signed-in reader keeps the town's header");
    assert.equal(s.townFooter, true, "and the town's footer");
    assert.equal(s.landingNav, false);
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
  assert.ok(before > 600, `the Letters start well down the page, under the hero (at ${before})`);
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

// ── THE SITE'S ONE MENTION IN EVERY GENERATED SLOT (CORE-178; Facet's FIX at a4efa808) ──────────────────────────────────────────────────
// Read from whatever the build holds (CI's committed snapshot, or a fresh read): every slot's person is either the mention (`.rm`, its picture
// and its current name, for a handle the build has a resident for) or the handle's plain word (one it has none for), never a raw name.
const SLOTS = `(() => { const L = document.querySelector(".pm-landing"); const out = {};
  for (const s of ["letter-people", "ledger-people", "home-owner", "home-chip", "event-host", "room-speaker", "rsvp-face"]) {
    out[s] = [...L.querySelectorAll('[data-landing-slot="' + s + '"]')].map((el) => ({
      mentions: [...el.querySelectorAll(".rm")].map((m) => ({ handle: m.dataset.rm, tag: m.tagName, href: m.getAttribute("href"), face: !!m.querySelector(".rm-face"),
        name: (m.querySelector(".rm-name")?.textContent ?? "").trim(), neutral: m.classList.contains("is-neutral"), styled: /--rm-c/.test(m.getAttribute("style") || "") })),
      text: el.textContent.replace(/\\s+/g, " ").trim(), title: el.getAttribute("title") }));
  }
  out.nested = L.querySelectorAll("a a").length;
  return out; })()`;

test("THE MENTIONS: every generated person slot is the site's one mention or the handle's plain word; no link sits inside another", { skip: SKIP }, async () => {
  await setup();
  const p = await openPage(browser, base, "/", { width: 1440 });
  const roll = new Set(JSON.parse(readFileSync(join(ROOT, "src/data/postmark/residents.json"), "utf8")).map((r) => r.handle));
  const s = await p.evalJs(SLOTS);
  assert.equal(s.nested, 0, "no link inside a link anywhere on the landing");
  for (const key of ["letter-people", "ledger-people", "home-owner", "home-chip", "room-speaker", "rsvp-face"]) assert.ok(s[key].length > 0, `the ${key} slot is drawn`);
  // the letter's two people and every ledger line's: spans (the card and the line are the links), each a mention when the roll has them
  assert.equal(s["letter-people"][0].mentions.every((m) => m.tag === "SPAN"), true, "the letter's people are spans inside the letter's own link");
  for (const line of s["ledger-people"]) assert.equal(line.mentions.every((m) => m.tag === "SPAN"), true, `a ledger line's people are spans (${line.text})`);
  // the owner line and the chip: the first home's owner, its picture and current name; the chip's is the link to their page
  const owner = s["home-owner"][0].mentions[0];
  assert.ok(owner && roll.has(owner.handle) && owner.face && owner.name, `the owner line is the mention (${JSON.stringify(owner)})`);
  const chip = s["home-chip"][0].mentions[0];
  assert.equal(chip.handle, owner.handle);
  assert.equal(chip.href, `/residents/${owner.handle}/`);
  // the room's speakers: a known one is a linked mention with its face; any handle the roll lacks is its plain word
  for (const line of s["room-speaker"]) {
    const m = line.mentions[0];
    if (m) { assert.ok(roll.has(m.handle) && m.tag === "A" && m.href === `/residents/${m.handle}/` && m.face, `speaker ${m.handle} is the linked mention`); }
    else assert.ok(!roll.has(line.text), `speaker "${line.text}" has no resident, so it is a plain word`);
  }
  // the hosts: the same rule (CI's snapshot draws the example events, whose hosts mix known and unknown handles)
  for (const h of s["event-host"]) {
    const m = h.mentions[0];
    if (m) assert.ok(roll.has(m.handle) && m.href === `/residents/${m.handle}/`, `host ${m.handle} is the linked mention`);
    else assert.ok(!roll.has(h.text), `host "${h.text}" has no resident, so it is a plain word`);
  }
  // the RSVP pile: portraits only; a known resident is the mention (its face, its name kept off the page for the tooltip and a screen reader)
  for (const f of s["rsvp-face"]) {
    const m = f.mentions[0];
    if (m) {
      assert.ok(roll.has(m.handle) && m.face && m.href === `/residents/${m.handle}/`, `face ${m.handle} is the mention`);
      assert.ok(f.title && f.title.length > 0, `face ${m.handle} has its name as the tooltip`);
    } else assert.ok(!roll.has(f.title) && f.text.length === 1, `face "${f.title}" has no resident: its plain initial, unlinked`);
  }
  const hidden = await p.evalJs(`[...document.querySelectorAll('.pm-landing [data-landing-slot="rsvp-face"] .rm-name')].map((n) => { const r = n.getBoundingClientRect(); return r.width <= 1 && r.height <= 1 && n.textContent.trim().length > 0; })`);
  assert.ok(hidden.length > 0 && hidden.every(Boolean), "the pile draws no visible names, and keeps each one for a screen reader");
  // every mention's link goes to a page the build made
  const hrefs = await p.evalJs(`[...new Set([...document.querySelectorAll(".pm-landing a.rm")].map((a) => a.getAttribute("href")))]`);
  for (const h of hrefs) assert.ok(existsSync(join(DIST, h, "index.html")), `${h} is a built page`);
  await p.close();
});

test("THE MENTIONS: each name reads at 4.5:1 on its own surface, in the resident's colour where they chose one", { skip: SKIP }, async () => {
  await setup();
  for (const width of [375, 1440]) {
    const p = await openPage(browser, base, "/", { width, touch: width < 800 });
    // the name's computed ink against the first solid background under it (the paper of the letter and the parcel, the night of the ledger and the
    // cards); the owner line on the home's photograph is a picture, not a measurable surface, and is left to the eye
    const rows = await p.evalJs(`(() => { const rgb = (s) => (s.match(/[\\d.]+/g) || []).map(Number); const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
      const bgOf = (el) => { for (let e = el; e; e = e.parentElement) { const c = rgb(getComputedStyle(e).backgroundColor); if (c.length >= 3 && (c[3] ?? 1) === 1) return c; } return [10, 18, 34]; };
      return [...document.querySelectorAll(".pm-landing .rm .rm-name")].filter((n) => n.getClientRects().length && n.getBoundingClientRect().width > 1 && !n.closest(".pwho"))
        .map((n) => { const m = n.closest(".rm"), c = rgb(getComputedStyle(n).color), b = bgOf(m); const [x, y] = [lum(c), lum(b)].sort((p, q) => q - p);
          return { h: m.dataset.rm, r: (x + 0.05) / (y + 0.05), neutral: m.classList.contains("is-neutral"), ink: getComputedStyle(m).color, accent: (m.getAttribute("style") || "").match(/--rm-c: (#[0-9a-f]+)/)?.[1] ?? null }; }); })()`);
    assert.ok(rows.length >= 5, `names are drawn at ${width} (${rows.length})`);
    for (const r of rows) assert.ok(r.r >= 4.5, `${r.h} reads at ${r.r.toFixed(2)}:1 at ${width}`);
    assert.ok(rows.some((r) => !r.neutral && r.accent), "at least one resident wears their own colour");
    await p.close();
  }
});

test("THE MENTIONS: a pin's redraw names the new home's owner with the same mention the build draws, and Tab reaches a mention's link", { skip: SKIP }, async () => {
  await setup();
  const p = await openPage(browser, base, "/", { width: 1440 });
  const homes = (await p.evalJs(`JSON.parse(document.querySelector("[data-landing-homes]").textContent)`));
  const first = await p.evalJs(`document.querySelector('[data-landing-slot="home-chip"] .rm').outerHTML`);
  const other = homes.find((h) => h.owner && h.owner.kind === "resident" && !first.includes(`data-rm="${h.owner.handle}"`));
  assert.ok(other, "a second resident's home is pinned");
  await p.evalJs(`document.querySelector('.pin[data-home="${other.key}"]').focus()`);
  await p.press("Enter");
  const drawn = await p.evalJs(`(() => { const who = document.querySelector('[data-landing-slot="home-owner"]'), chip = document.querySelector('[data-landing-slot="home-chip"]');
    const w = who.querySelector(".rm"), c = chip.querySelector(".rm"); return { whoHandle: w?.dataset.rm, whoTag: w?.tagName, whoText: who.textContent.replace(/\\s+/g, " ").trim(), chipHandle: c?.dataset.rm, chipHref: c?.getAttribute("href"),
      chipStyle: c?.getAttribute("style"), chipClass: c?.className, face: !!c?.querySelector(".rm-face"), regionChip: chip.firstElementChild?.textContent }; })()`);
  assert.equal(drawn.whoHandle, other.owner.handle, "the owner line is the new owner's mention");
  assert.equal(drawn.whoTag, "SPAN", "inside the card, not a second link");
  assert.ok(drawn.whoText.endsWith(`'s home, ${other.region}`), `the line keeps its words: ${drawn.whoText}`);
  assert.equal(drawn.chipHandle, other.owner.handle);
  assert.equal(drawn.chipHref, other.owner.href);
  assert.ok(drawn.face, "the chip's mention wears the face");
  assert.ok(/\brm\b/.test(drawn.chipClass) && (other.owner.accent ? /--rm-c/.test(drawn.chipStyle) : /is-neutral/.test(drawn.chipClass)), "the same form the build draws: its colour, or neutral");
  assert.equal(drawn.regionChip, `✦ ${other.region}`);
  // the keyboard reaches a mention's own link (the room's first speaker or an event's host), and its target is the resident's page
  await p.evalJs(`document.querySelector("[data-landing-how]").focus()`);
  let reached = null;
  for (let i = 0; i < 200 && !reached; i++) { await p.press("Tab"); reached = await p.evalJs(`document.activeElement?.matches(".pm-landing a.rm") ? document.activeElement.getAttribute("href") : null`); }
  assert.ok(reached && /^\/residents\/[a-z0-9-]+\/$/.test(reached), `Tab reaches a mention's link (${reached})`);
  await p.close();
});
