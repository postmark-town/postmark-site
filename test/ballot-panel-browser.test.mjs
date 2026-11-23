// ballot-panel-browser.test.mjs — the Civic Quarter's Ballot House, RENDERED from the office's answer on the built page (POS-1060).
//
//   node --test test/ballot-panel-browser.test.mjs
//
// It serves the built site (dist-town/, what `npm run build` makes; the built-pages CI job builds it first) from a tiny static server,
// drives headless Chrome over CDP (Node's global WebSocket; a throwaway profile, no sync, no extensions) and answers GET /api/votes ITSELF
// through CDP's Fetch domain with INVENTED replies that a step can change; every other /api call is refused. The live board is never
// touched, nothing is signed in, and nothing is staked. The page's static shell holds no tally, so whatever shows in the panel came from
// the answer given here, and a second answer changes it WITHOUT a rebuild.
//
// WHAT IT PROVES that test/ballot-panel.test.mjs (the helper, in node) cannot: the panel is the page's visible panel when the Ballot House
// is opened; its states (open / none / could not be read) are different sentences on the real page; a changed answer shows without a reload
// when the panel is opened again; the Ballot House card opens its panel and is not "coming soon"; the Bounty Board and the Marketplace
// wear exactly one "works today · likely to change soon" chip each (POS-1065) and both still open their own panels; and the page fits a phone-width view.
//
// BALLOT_PANEL_BASE_URL points it at a running dev server instead of dist-town. WITHOUT dist-town and without a base url the test SKIPS
// and says so; WITH built pages and no browser it FAILS (so the built-pages job cannot turn a skip into a pass).

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
const BASE_URL = process.env.BALLOT_PANEL_BASE_URL || null;
const SKIP = BASE_URL || existsSync(join(DIST, "town", "index.html")) ? false : "no built pages (dist-town/) and no BALLOT_PANEL_BASE_URL: nothing to render";

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

// DETACHED, so the whole browser is one process group that `close` kills as one (a helper that outlived the main process would hold the
// test process's event loop open: the settlement-notice browser test hung exactly there once).
async function launch(chrome) {
  const profile = mkdtempSync(join(tmpdir(), "pos1060-profile-"));
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

/** One page with `/api/votes` answered by `box` (read at request time, so a step can change it); any other /api call is refused and counted. */
async function openPage(b, base, path, { width, height = 900, box }) {
  const { targetId } = await b.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await b.send("Target.attachToTarget", { targetId, flatten: true });
  const S = (m, p) => b.send(m, p, sessionId);
  await S("Page.enable"); await S("Runtime.enable");
  await S("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 600 });
  await S("Fetch.enable", { patterns: [{ urlPattern: "*/api/*", requestStage: "Request" }] });
  b.listeners.push((m) => {
    if (m.sessionId !== sessionId || m.method !== "Fetch.requestPaused") return;
    const { requestId, request } = m.params;
    const p = new URL(request.url).pathname;
    box.asked.push(`${request.method} ${p}`);
    if (request.method === "GET" && /\/api\/votes$/.test(p)) {
      const r = box.reply();
      S("Fetch.fulfillRequest", { requestId, responseCode: r.status, responseHeaders: [{ name: "content-type", value: r.type ?? "application/json" }, { name: "cache-control", value: "no-store" }], body: Buffer.from(r.body ?? "").toString("base64") }).catch(() => {});
    } else S("Fetch.failRequest", { requestId, errorReason: "BlockedByClient" }).catch(() => {});
  });
  // A DOCUMENT NAVIGATION DESTROYS THE PAGE'S EVALUATION CONTEXT, and a Runtime.evaluate in flight when that happens fails with "Inspected
  // target navigated or closed" (a CDP answer about the TARGET, not an assertion about the page). So a step that starts a navigation, the
  // first Page.navigate or a real click on a link, WAITS for the new document to be loaded before anything evaluates in it: `landing()` is
  // registered BEFORE the step (so the event cannot be missed) and settles with the main frame's new URL when its load event fires.
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
  first.catch(() => {});                     // if the navigate itself fails, the assertion below is the failure, not this promise's late timeout
  const nav = await S("Page.navigate", { url: base + path });
  assert.equal(nav.errorText, undefined, `the page did not open: ${nav.errorText}`);
  await first;
  const evalJs = async (expression) => {
    const r = await S("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(`page threw: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
    return r.result.value;
  };
  const until = async (expr, what, ms = 15_000) => {
    const end = Date.now() + ms;
    for (;;) { if (await evalJs(expr)) return; if (Date.now() > end) throw new Error(`timed out waiting for ${what}`); await new Promise((r) => setTimeout(r, 100)); }
  };
  // a REAL click: a coordinate mouse event at the element's centre (a synthetic element.click() ignores layout and pointer-events)
  const click = async (selector) => {
    const pt = await evalJs(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e) return null; e.scrollIntoView({ block: "center", behavior: "instant" }); const b = e.getBoundingClientRect();
      const x = b.left + b.width / 2, y = b.top + b.height / 2; const hit = document.elementFromPoint(x, y); return { x, y, hit: !!hit && (hit === e || e.contains(hit)), covered: hit ? (hit.tagName + "." + hit.className + "#" + hit.id) : null, rect: [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)] }; })()`);
    assert.ok(pt, `no element ${selector}`);
    assert.ok(pt.hit, `${selector}'s centre is covered by ${pt.covered} (rect ${pt.rect}, point ${Math.round(pt.x)},${Math.round(pt.y)})`);
    for (const type of ["mousePressed", "mouseReleased"]) await S("Input.dispatchMouseEvent", { type, x: pt.x, y: pt.y, button: "left", clickCount: 1 });
  };
  // the same REAL click, for a link that opens another document: resolves with that document's URL once it has loaded
  const clickToNavigate = async (selector) => {
    const landed = landing();
    landed.catch(() => {});                  // a click that never navigates fails below, at `await landed`, not as an unhandled rejection
    await click(selector);
    return landed;
  };
  return { evalJs, until, click, clickToNavigate, S, close: () => S("Target.closeTarget", { targetId }).catch(() => {}) };
}

const VOTES = {
  topics: [
    { topic: "harbor-lantern", title: "Pick the harbor lantern", status: "staking", window: "Backing closes at the 12:00 crossing on 2026-11-19", cap_per_household_per_candidate: 5,
      candidates: [{ candidate: "Brass Fox", staked: 14, backing_households: 4 }, { candidate: "Reed Heron", staked: 9, backing_households: 3 }, { candidate: "Tin Moth", staked: 0, backing_households: 0 }] },
    { topic: "ferry-name", title: "Name the new ferry", status: "submissions", window: "Designs are taken until 2026-11-18", candidates: [{ candidate: "Low Tide", staked: 0, backing_households: 0 }] },
    { topic: "quay-banner", title: "Choose the quay banner", status: "closed", window: "Closed 2026-11-10", candidates: [{ candidate: "Sea Green", staked: 21, backing_households: 6 }] },
  ],
};
const json = (o) => ({ status: 200, body: JSON.stringify(o) });
const PANEL_TEXT = `(document.querySelector("[data-ballot-panel]")?.innerText ?? "")`;

let server = null, browser = null, base = null;
const chrome = SKIP ? null : findChrome();
async function setup() {
  if (browser) return;
  assert.ok(chrome, "built pages exist but no Chrome was found (set CHROME_BIN): this must fail, not skip");
  if (BASE_URL) base = BASE_URL.replace(/\/+$/, "");
  else { server = await serveDist(); base = `http://127.0.0.1:${server.address().port}`; }
  browser = await launch(chrome);
}
after(() => { browser?.close(); server?.close(); });

test("the panel draws the OPEN ballots from the office's answer, in the page's visible panel, with the door to the full view", { skip: SKIP }, async () => {
  await setup();
  const box = { asked: [], reply: () => json(VOTES) };
  const p = await openPage(browser, base, "/town/#ballot-house", { width: 1280, box });
  await p.until(`document.querySelector("[data-ballot-state='open']") !== null`, "the open ballots");
  const text = await p.evalJs(PANEL_TEXT);
  for (const want of ["Pick the harbor lantern", "Name the new ferry", "Brass Fox", "14 stamps", "4 households backing", "Tin Moth", "0 stamps", "Backing closes at the 12:00 crossing on 2026-11-19", "Low Tide"])
    assert.ok(text.includes(want), `the panel says "${want}": ${text.slice(0, 300)}`);
  assert.ok(!/quay banner|Sea Green/i.test(text), "a closed ballot is past: it stays in the full view");
  assert.deepEqual(await p.evalJs(`[...document.querySelectorAll("[data-ballot-panel] [data-ballot]")].map((e) => e.getAttribute("data-ballot"))`), ["harbor-lantern", "ferry-name"], "in the office's order");
  // the panel is the VISIBLE panel, and exactly one is
  const shown = await p.evalJs(`[...document.querySelectorAll(".cq-panels > .c-lane")].filter((e) => getComputedStyle(e).display !== "none").map((e) => e.id)`);
  assert.deepEqual(shown, ["ballot-house"]);
  // nothing is baked: the static HTML the server sent holds none of it
  const html = await (await fetch(`${base}/town/`)).text();
  assert.ok(!/harbor-lantern|Brass Fox|Pick the harbor lantern/.test(html), "the page's shell holds no tally");
  // the door to the full view is a real, clickable link
  assert.equal(await p.evalJs(`document.querySelector("#ballot-house a.c-door").getAttribute("href")`), "/votes/");
  const landedOn = await p.clickToNavigate("#ballot-house a.c-door");   // a real click that opens /votes/ (a document navigation): wait for it to load
  assert.equal(new URL(landedOn).pathname, "/votes/", `the door opened ${landedOn}`);
  await p.until(`location.pathname === "/votes/"`, "the full view");
  assert.deepEqual(box.asked.filter((a) => !a.startsWith("GET ")), [], "no write was ever made from the page or the door");
  await p.close();
});

test("a second answer changes the panel with no rebuild and no reload: more backing, a ballot closing, then none open", { skip: SKIP }, async () => {
  await setup();
  const box = { asked: [], reply: () => json(VOTES) };
  const p = await openPage(browser, base, "/town/#ballot-house", { width: 1280, box });
  await p.until(`document.querySelector("[data-ballot-state='open']") !== null`, "the first answer");
  assert.ok((await p.evalJs(PANEL_TEXT)).includes("14 stamps"));
  // the office's answer changes; the reader opens the panel again (the fragment changes away and back). The helper re-reads at most every
  // 20 s of the page's clock, so the page's clock is moved on (the test's way of saying a page was left open a while).
  box.reply = () => json({ topics: [{ ...VOTES.topics[0], candidates: [{ candidate: "Brass Fox", staked: 31, backing_households: 8 }, { candidate: "Reed Heron", staked: 9, backing_households: 3 }] }, VOTES.topics[2]] });
  await p.evalJs(`(() => { const now = Date.now; Date.now = () => now() + 60000; location.hash = "#quests"; return true; })()`);
  await p.evalJs(`(location.hash = "#ballot-house", true)`);
  await p.until(`${PANEL_TEXT}.includes("31 stamps")`, "the new backing");
  const t2 = await p.evalJs(PANEL_TEXT);
  assert.ok(t2.includes("8 households backing") && !t2.includes("Tin Moth") && !t2.includes("Name the new ferry"), t2.slice(0, 300));
  assert.equal(await p.evalJs(`performance.getEntriesByType("navigation").length`), 1, "no reload happened");
  // every open ballot closes: none, and it is said as none
  box.reply = () => json({ topics: [VOTES.topics[2]] });
  await p.evalJs(`(() => { const now = Date.now; Date.now = () => now() + 60000; location.hash = "#quests"; return true; })()`);
  await p.evalJs(`(location.hash = "#ballot-house", true)`);
  await p.until(`document.querySelector("[data-ballot-state='none']") !== null`, "none open");
  const t3 = await p.evalJs(PANEL_TEXT);
  assert.ok(/No open ballots right now/.test(t3) && !/harbor lantern|Sea Green/i.test(t3), t3.slice(0, 300));
  await p.close();
});

test("could not be read is a different sentence from none open, for every unreadable shape; and a readable empty list says none", { skip: SKIP }, async () => {
  await setup();
  const SHAPES = [
    ["a 500", { status: 500, type: "text/plain", body: "boom" }],
    ["a 503 refusal naming an intake", { status: 503, body: JSON.stringify({ error: "bounce", awaiting_intake: ["harbor-lantern"] }) }],
    ["not JSON", { status: 200, type: "text/html", body: "<html>gateway</html>" }],
    ["JSON without topics", { status: 200, body: "{}" }],
    ["topics that is not a list", { status: 200, body: JSON.stringify({ topics: "none" }) }],
  ];
  for (const [name, reply] of SHAPES) {
    const box = { asked: [], reply: () => reply };
    const p = await openPage(browser, base, "/town/#ballot-house", { width: 1280, box });
    await p.until(`document.querySelector("[data-ballot-panel] [data-ballot-state]") !== null`, `${name}: an answer drawn`);
    const t = await p.evalJs(PANEL_TEXT);
    assert.equal(await p.evalJs(`document.querySelector("[data-ballot-state]").getAttribute("data-ballot-state")`), "unreadable", name);
    assert.ok(/could not be read/.test(t) && !/No open ballots/.test(t), `${name}: ${t.slice(0, 200)}`);
    assert.ok(await p.evalJs(`!!document.querySelector("#ballot-house a.c-door")`), `${name}: the door is still there`);
    await p.close();
  }
  for (const [name, body] of [["an empty list", { topics: [] }], ["only closed ballots", { topics: [VOTES.topics[2]] }]]) {
    const box = { asked: [], reply: () => json(body) };
    const p = await openPage(browser, base, "/town/#ballot-house", { width: 1280, box });
    await p.until(`document.querySelector("[data-ballot-state='none']") !== null`, name);
    assert.ok(/No open ballots right now/.test(await p.evalJs(PANEL_TEXT)), name);
    await p.close();
  }
});

test("the three cards: the Ballot House is not 'coming soon' and opens its panel; the Bounty Board and the Marketplace wear one 'works today · likely to change soon' chip each (POS-1065) and still open theirs, under the same words", { skip: SKIP }, async () => {
  await setup();
  const box = { asked: [], reply: () => json(VOTES) };
  const p = await openPage(browser, base, "/town/", { width: 1280, box });
  await p.until(`document.querySelector(".cq-b[data-lane='votes']") !== null`, "the quarter");
  const chips = await p.evalJs(`[...document.querySelectorAll(".cq-b")].map((a) => ({ lane: a.getAttribute("data-lane"), chips: [...a.querySelectorAll(".cq-coming, .cq-change")].map((c) => c.className + ":" + c.textContent.trim()) }))`);
  const by = Object.fromEntries(chips.map((c) => [c.lane, c.chips]));
  assert.deepEqual(by.votes, [], "the Ballot House card carries no coming-soon chip");
  const WORDS = "works today · likely to change soon";
  assert.deepEqual(by.bounties, [`cq-change:${WORDS}`]);
  assert.deepEqual(by.listings, [`cq-change:${WORDS}`], "the Marketplace card shows it IN PLACE OF 'coming soon' (one chip)");
  assert.equal(await p.evalJs(`document.querySelectorAll(".cq-coming").length`), 0, "no coming-soon chip is left on any card");
  assert.equal(await p.evalJs(`document.querySelectorAll(".cq-change").length`), 2, "exactly two chips on the page");
  // BOTH CLAUSES LEGIBLE: the chip wraps, and neither clause is clipped or runs out of its building's cell
  const fit = await p.evalJs(`[...document.querySelectorAll(".cq-change")].map((c) => { const cell = c.closest(".cq-b").getBoundingClientRect(), r = c.getBoundingClientRect();
    return { clipped: c.scrollWidth > c.clientWidth + 1 || c.scrollHeight > c.clientHeight + 1, inside: r.left >= cell.left - 1 && r.right <= cell.right + 1, lines: Math.round(r.height / parseFloat(getComputedStyle(c).lineHeight)) }; })`);
  for (const f of fit) assert.ok(!f.clipped && f.inside, `a chip is clipped or outside its building: ${JSON.stringify(fit)}`);
  // the opened panels' headings: the two lanes say the same two clauses (never Coming soon), the others carry no such pill
  assert.deepEqual(await p.evalJs(`["bounty-board", "marketplace", "ballot-house", "quests"].map((id) => [id, [...document.querySelectorAll("#" + id + " .c-coming-head")].map((e) => e.textContent.trim())])`),
    [["bounty-board", [WORDS]], ["marketplace", [WORDS]], ["ballot-house", []], ["quests", []]]);
  // the building's fragment, and the panel it opens (the Bounty Board's building points at #board, a block INSIDE the bounty-board panel, which :has() opens)
  for (const [lane, id, panel] of [["bounties", "board", "bounty-board"], ["listings", "marketplace", "marketplace"], ["votes", "ballot-house", "ballot-house"]]) {
    await p.evalJs(`(location.hash = "", history.replaceState(null, "", "/town/"), true)`);
    assert.ok(await p.evalJs(`getComputedStyle(document.querySelector(".cq-b[data-lane='${lane}']")).pointerEvents !== "none" && !document.querySelector(".cq-b[data-lane='${lane}']").hasAttribute("aria-disabled")`), `${lane}: the card is not disabled`);
    await p.click(`.cq-b[data-lane='${lane}']`);
    await p.until(`location.hash === "#${id}"`, `${lane}: the click opened #${id}`);
    const shown = await p.evalJs(`[...document.querySelectorAll(".cq-panels > .c-lane")].filter((e) => getComputedStyle(e).display !== "none").map((e) => e.id)`);
    assert.deepEqual(shown, [panel], `${lane}: its own panel shows`);
  }
  assert.ok(!(await p.evalJs(`document.querySelector("#ballot-house").innerText`)).match(/coming soon/i), "and the Ballot House panel does not say coming soon");
  await p.close();
});

test("a phone-width page: the panel and the cards fit, and no horizontal scroll appears", { skip: SKIP }, async () => {
  await setup();
  const box = { asked: [], reply: () => json({ topics: [{ ...VOTES.topics[0], candidates: [{ candidate: "A very long design name that has to wrap on a narrow screen without widening the page", staked: 123456, backing_households: 12 }, ...VOTES.topics[0].candidates] }, VOTES.topics[1]] }) };
  const p = await openPage(browser, base, "/town/#ballot-house", { width: 390, height: 800, box });
  await p.until(`document.querySelector("[data-ballot-state='open']") !== null`, "the open ballots");
  const m = await p.evalJs(`(() => { const root = document.documentElement, panel = document.querySelector("[data-ballot-panel]").getBoundingClientRect();
    const over = [...document.querySelectorAll("[data-ballot-panel] *")].filter((e) => e.getBoundingClientRect().right > innerWidth + 0.5).map((e) => e.className);
    return { scrollW: root.scrollWidth, w: innerWidth, panelRight: panel.right, over }; })()`);
  assert.ok(m.scrollW <= m.w, `the page scrolls sideways: ${JSON.stringify(m)}`);
  assert.deepEqual(m.over, [], `something in the panel runs past the screen: ${JSON.stringify(m)}`);
  await p.evalJs(`(location.hash = "", history.replaceState(null, "", "/town/"), true)`);
  const cards = await p.evalJs(`[...document.querySelectorAll(".cq-b")].map((a) => { const r = a.getBoundingClientRect(); return { lane: a.getAttribute("data-lane"), l: r.left, r: r.right }; })`);
  for (const c of cards) assert.ok(c.l >= 0 && c.r <= 390.5, `the ${c.lane} card is on screen: ${JSON.stringify(c)}`);
  // POS-1065: both clauses of the two chips stay whole at 390 px (wrapped, not clipped, inside their building's cell and the screen)
  const chips = await p.evalJs(`[...document.querySelectorAll(".cq-change")].map((c) => { const cell = c.closest(".cq-b").getBoundingClientRect(), r = c.getBoundingClientRect();
    return { text: c.textContent.trim(), clipped: c.scrollWidth > c.clientWidth + 1 || c.scrollHeight > c.clientHeight + 1, inside: r.left >= Math.max(0, cell.left - 1) && r.right <= Math.min(390.5, cell.right + 1) }; })`);
  assert.equal(chips.length, 2);
  for (const c of chips) assert.ok(c.text === "works today · likely to change soon" && !c.clipped && c.inside, `a chip is clipped or off screen at 390 px: ${JSON.stringify(chips)}`);
  await p.close();
});
