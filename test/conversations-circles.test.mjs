// conversations-circles.test.mjs — the conversations page and the World's one circle reader, in a real browser (CORE-82).
//
//   node --test test/conversations-circles.test.mjs
//
// LAW (CORE-70, Darko 2026-11-13/14, as CORE-82 quotes it): "A circle is any say plus all its replies, recursively." "A back-and-forth with no
// fork is a strand, drawn flat." "A visitor sees the room's top circles in the order they started and picks one." "Every existing field keeps its
// name, meaning and order." And the producer contract (/var/tmp/POS-1035-envelopes.md): the browser never derives a reply link, a parent, a
// circle or a name link; it follows what the office serves and shows the receipt's `said.note` as served.
//
// HOW. The page's own markup and its two scripts (the inline poller and the module that hands it the reader) are READ OUT OF the .astro source
// and served in a minimal harness page (no build is needed, so this runs in the plain `test` job and in the built-pages job alike); the site's
// own src/lib modules are served as they are. Headless Chrome is driven over CDP (Node's global WebSocket; a throwaway profile, no sync, no
// extensions) and answers every /api/* request itself with INVENTED answers (the CORE-70 worked example, test/fixtures/circles.sample.json,
// "invented speech"); the live office is never read. THE READER is served from CORE82_WORLD_READER (a file path), else the pinned
// postmark-world package (node_modules/postmark-world/spectator/circle-reader.mjs), else it is NOT served (404): a pinned World that predates it.
// No test skips. Each behaviour is asserted for whichever world it runs in: with the reader, the circles; always (with the reader withheld on
// purpose, whether or not the real one exists) the honest floor: today's flat transcript, said to be the floor, never an empty room.
// A Chrome that cannot be found FAILS the file (a skipped render is not a passed one).

import test, { after } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import http from "node:http";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PAGE_SRC = readFileSync(join(ROOT, "town/pages/conversations/index.astro"), "utf8");
const FX = JSON.parse(readFileSync(join(ROOT, "test/fixtures/circles.sample.json"), "utf8"));

// ── the harness page, read out of the real one ──────────────────────────────────────────────────────────────────────────

const between = (s, a, b, from = 0) => { const i = s.indexOf(a, from); const j = s.indexOf(b, i + a.length); assert.ok(i > -1 && j > i, `the page still carries ${a}`); return s.slice(i + a.length, j); };
const MAIN = between(PAGE_SRC, '<main class="pm-wrap convo">', "</main>");
const INLINE = between(PAGE_SRC, "<script is:inline>", "</script>");
const MODULE = between(PAGE_SRC, "\n  <script>\n", "</script>", PAGE_SRC.indexOf("</script>", PAGE_SRC.indexOf("<script is:inline>")));
const HARNESS = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>harness</title></head><body class="pm convo">
<main class="pm-wrap convo">${MAIN}</main>
<script>${INLINE}</script>
<script type="module">${MODULE.replaceAll('from "@/lib/', 'from "/src/lib/')}</script>
</body></html>`;

// ── the reader this run may use ─────────────────────────────────────────────────────────────────────────────────────────

const READER_FILE = [process.env.CORE82_WORLD_READER, join(ROOT, "node_modules/postmark-world/spectator/circle-reader.mjs")].filter(Boolean).find((p) => existsSync(p)) ?? null;
const HAS_READER = READER_FILE !== null;
const readerNote = HAS_READER ? `the real reader (${READER_FILE.includes("node_modules") ? "the pinned World" : "CORE82_WORLD_READER"})` : "NO reader (the pinned World predates it)";

// CORE-128: the public residents list the page reads for its faces (/world-engine/residents-meta.json): null = not served (names only), set per test, optionally late
let RESIDENTS_META = null, RESIDENTS_META_DELAY_MS = 0;
function serve({ withReader }) {
  const server = http.createServer((req, res) => {
    const path = decodeURIComponent((req.url || "/").split("?")[0]);
    const send = (code, type, body) => { res.writeHead(code, { "content-type": type, "cache-control": "no-store" }); res.end(body); };
    if (path === "/world-engine/residents-meta.json" && RESIDENTS_META) { setTimeout(() => send(200, "application/json", JSON.stringify(RESIDENTS_META)), RESIDENTS_META_DELAY_MS); return; }
    if (path === "/conversations/") return send(200, "text/html; charset=utf-8", HARNESS);
    if (path.startsWith("/src/lib/") && /^\/src\/lib\/[A-Za-z0-9._-]+\.mjs$/.test(path) && existsSync(join(ROOT, path))) return send(200, "text/javascript", readFileSync(join(ROOT, path)));
    if (path === "/world-engine/spectator/circle-reader.mjs" && withReader && HAS_READER) return send(200, "text/javascript", readFileSync(READER_FILE));
    send(404, "text/plain", "not found");
  });
  return new Promise((ok) => server.listen(0, "127.0.0.1", () => ok(server)));
}

// ── a minimal, bounded CDP client (the repo's browser tests' own) ───────────────────────────────────────────────────────────

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

// `startMs` is the real 20 s startup limit; the argument exists only so the test of the failure path below need not wait it out.
async function launch(chrome, { startMs = 20_000 } = {}) {
  const profile = mkdtempSync(join(tmpdir(), "core82-convo-profile-"));
  const child = spawn(chrome, ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-sync", "--disable-extensions", "--hide-scrollbars",
    "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { stdio: ["ignore", "ignore", "pipe"], detached: true });
  child.unref();
  // CORE-144: the child is detached and its stderr is piped, so a start that fails (the 20 s timeout, an early exit, a refused socket) must reap
  // both, or the dead launch keeps the process alive and the job hangs instead of failing with its real error.
  const reap = () => {
    if (child.exitCode === null && child.signalCode === null) { try { process.kill(-child.pid, "SIGKILL"); } catch { try { child.kill("SIGKILL"); } catch { /* gone */ } } }
    try { child.stderr.destroy(); } catch { /* gone */ }
    rmSync(profile, { recursive: true, force: true });
  };
  let ws;
  try {
    const wsUrl = await new Promise((ok, no) => {
      let buf = "";
      const t = setTimeout(() => no(new Error(`no DevTools url within ${startMs / 1000} s`)), startMs);
      child.stderr.on("data", (d) => { buf += d; const m = /DevTools listening on (ws:\/\/\S+)/.exec(buf); if (m) { clearTimeout(t); ok(m[1]); } });
      child.on("exit", (c) => { clearTimeout(t); no(new Error(`the browser exited early (${c})`)); });
    });
    ws = new WebSocket(wsUrl);
    await new Promise((ok, no) => { ws.onopen = ok; ws.onerror = no; });
  } catch (e) { try { ws?.close(); } catch { /* gone */ } reap(); throw e; }
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

/** Open the harness. `office(method, pathAndQuery, bodyText)` answers every /api/* request: `{ status, body }`, or "fail" for a network failure. */
async function openPage(b, base, { hash = "", office, signedIn = false, width = 1000, height = 900 } = {}) {
  const { targetId } = await b.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await b.send("Target.attachToTarget", { targetId, flatten: true });
  const S = (m, p) => b.send(m, p, sessionId);
  await S("Page.enable"); await S("Runtime.enable");
  await S("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
  if (signedIn) await S("Page.addScriptToEvaluateOnNewDocument", { source: `localStorage.setItem("pm.oauth.token", JSON.stringify({ access_token: "invented-token", obtained: Date.now(), expires_in: 3600 })); window.__pwned = 0;` });
  else await S("Page.addScriptToEvaluateOnNewDocument", { source: "window.__pwned = 0;" });
  await S("Fetch.enable", { patterns: [{ urlPattern: "*/api/*", requestStage: "Request" }] });
  const calls = [];
  const listener = (m) => {
    if (m.sessionId !== sessionId || m.method !== "Fetch.requestPaused") return;
    const { requestId, request } = m.params;
    const u = new URL(request.url);
    const key = u.pathname.replace(/^\/api/, "") + u.search;
    calls.push({ method: request.method, path: key, body: request.postData ?? null });
    const a = office(request.method, key, request.postData ?? null);
    if (a === "fail") { S("Fetch.failRequest", { requestId, errorReason: "ConnectionRefused" }).catch(() => {}); return; }
    S("Fetch.fulfillRequest", { requestId, responseCode: a.status, responseHeaders: [{ name: "content-type", value: "application/json" }, { name: "access-control-allow-origin", value: "*" }], body: Buffer.from(JSON.stringify(a.body)).toString("base64") }).catch(() => {});
  };
  b.listeners.push(listener);
  await S("Page.navigate", { url: `${base}/conversations/${hash}` });
  const evalJs = async (expression) => {
    const r = await S("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(`page threw: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
    return r.result.value;
  };
  const until = async (js, what, ms = 15_000) => {
    // a predicate that reads an element the page has not drawn yet throws inside the page: that is "not yet", never a failure (the wait still has to come true)
    for (const t0 = Date.now(); Date.now() - t0 < ms;) { let ok = false; try { ok = await evalJs(js); } catch { /* the page is not that far yet */ } if (ok) return; await new Promise((r) => setTimeout(r, 80)); }
    throw new Error(`timed out waiting for ${what}`);
  };
  const tick = () => evalJs(`document.dispatchEvent(new CustomEvent("pm:spoke")); true`);      // the page's own "ask for a repaint now"
  return { evalJs, until, calls, tick, close: async () => { b.listeners.splice(b.listeners.indexOf(listener), 1); await b.send("Target.closeTarget", { targetId }).catch(() => {}); } };
}

// ── the invented office (the CORE-70 worked example; INVENTED speech) ──────────────────────────────────────────────────────

const ROOM = "t1794686460000-pica";
const ROOM_B = "t1794690000000-noe";
const FLAT = FX.views.flat_lines;                                   // 14 says, 7 speakers
const voicesOf = (lines = FLAT) => lines.map((l) => ({ handle: l.handle, standing: l.standing, said: l.said, at: l.at, at_ms: l.at_ms, ...(l.id ? { id: l.id } : {}) }));
const thread = (over = {}) => ({
  id: ROOM, live: true, place: "Cave Interior", at: { x: 0, y: 0 }, started: "2026-11-14T20:01:00.000Z", latest: "2026-11-14T20:14:00.000Z",
  voice_count: 14, participants: [...new Set(FLAT.map((l) => l.handle))], voices: voicesOf(), ...over,
});
const roomHeader = (id = ROOM) => ({ id, live: true, place: "Cave Interior", at: { x: 0, y: 0 }, aboard: false, extent: { x0: 0, y0: 0, x1: 0, y1: 0 }, started: "2026-11-14T20:01:00.000Z", latest: "2026-11-14T20:14:00.000Z", participants: ["pica", "seth", "claran"], voice_count: 14 });
const roomFind = (id = ROOM, over = {}) => ({ now: 1, earshot_m: 60, settlement_since: "2026-11-14T06:00:00.000Z", find: { room: roomHeader(id), history: "complete", source: "record", circles: FX.views.spectator, ...over } });
const WHOLE = FX.views.default_claran.lines;                        // circle 50101 whole: 10 says with depth (a fork at 50101, three branches)
const circlePage = (n) => {
  const first = n === 1;
  const lines = first ? WHOLE.slice(0, 6) : WHOLE.slice(6);
  return { now: 1, earshot_m: 60, find: { circle: 50101, ...(first ? {} : { after: WHOLE[5].id }), history: "complete", source: "record", room: roomHeader(),
    circle_read: { circle: 50101, path: [50101], says: 10, people: 5, lines, next: first ? { circle: 50101, after: WHOLE[5].id } : null, complete: !first, budget: { bytes: 8192, used: 3000 } }, sparks: null } };
};
const conversations = (threads, closed = []) => ({ now: 1, earshot_m: 60, settlement_since: "2026-11-14T06:00:00.000Z", live: threads, closed, pinned: [], earlier: { source: "memory", remaining: 0, before: null } });

/** a configurable office: `state.live` is what the poll answers (mutated between polls); `reader` says whether ?room=/?circle= are served */
function makeOffice(state) {
  return (method, path, body) => {
    if (state.down) return "fail";
    if (path.startsWith("/world/conversations?closed=")) return { status: 200, body: conversations(state.live, state.closed ?? []) };
    if (path.startsWith("/world/conversations?room=")) return state.room ? { status: 200, body: state.room(decodeURIComponent(path.split("room=")[1])) } : { status: 404, body: { error: "bounce", code: 404 } };
    let m;
    if ((m = /^\/world\/conversations\?circle=(\d+)(?:&after=(\d+))?$/.exec(path))) {
      if (state.circleRoom) return { status: 200, body: { now: 1, find: { circle: Number(m[1]), history: "complete", source: "record", room: roomHeader(state.circleRoom), circle_read: { circle: Number(m[1]), path: [Number(m[1])], says: 1, people: 1, lines: [], next: null, complete: true, budget: { bytes: 8192, used: 1 } }, sparks: null } } };
      const page = circlePage(m[2] ? 2 : 1);
      // CORE-117: `echoCircle` makes the invented office answer a DIFFERENT circle id as itself (same invented lines), so a reader that navigates to another circle
      // in the one view reads what it asked for, not a page that names circle 50101
      if (state.echoCircle) { const id = Number(m[1]); page.find.circle = id; page.find.circle_read.circle = id; page.find.circle_read.path = [id]; }
      return { status: m[2] ? 200 : 200, body: page };
    }
    if (path === "/world/conversations") return { status: 200, body: conversations(state.live, state.closed ?? []) };
    if (path === "/me") return { status: 200, body: { handles: ["claran"], household: "test-house", households: { claran: { slug: "test-house" } } } };
    if (path === "/world/say" && method === "POST") { state.said = (state.said ?? []).concat(JSON.parse(body)); return state.sayAnswer ? state.sayAnswer(JSON.parse(body)) : { status: 200, body: { spoke: true, where: { place: "Cave Interior" }, listeners: ["pica"] } }; }
    return { status: 404, body: { error: "bounce", code: 404 } };
  };
}

// ── the browser, once ────────────────────────────────────────────────────────────────────────────────────────────────────

let browser = null; const servers = {};
async function boot(withReader) {
  if (!browser) {
    const chrome = findChrome();
    assert.ok(chrome, "no Chrome/Chromium was found: set CHROME_BIN. (This fails rather than skips: a skipped render is not a passed one.)");
    browser = await launch(chrome);
  }
  const key = withReader ? "with" : "without";
  if (!servers[key]) { const s = await serve({ withReader }); servers[key] = { s, base: `http://127.0.0.1:${s.address().port}` }; }
  return { b: browser, base: servers[key].base };
}
after(async () => {
  browser?.close();
  for (const { s } of Object.values(servers)) {
    s.closeAllConnections?.();
    await Promise.race([new Promise((ok) => s.close(ok)), new Promise((ok) => setTimeout(ok, 3000).unref())]);
  }
});

const CARD = `document.querySelector('[data-thread="${ROOM}"]')`;
const SELECTED = `document.querySelector("[data-selected-card]")`;          // CORE-117: the page's one-conversation view (a #circle-<id> link)
const SELECTED_READY = `(() => { const c = ${SELECTED}; const r = c && c.querySelector("[data-circle-reader]"); return !!r && r.dataset.state === "circle"; })()`;
const READY = (extra = "") => `(() => { const c = ${CARD}; return !!c ${extra}; })()`;
const MOUNTED = `(() => { const c = ${CARD}; return !!c && !!c.querySelector("[data-circle-reader]") && c.querySelector("[data-circle-reader]").dataset.state !== "loading"; })()`;
const FLAT_SHOWN = `(() => { const c = ${CARD}; const l = c && c.querySelector(".c-voices"); return !!l && !l.hidden && l.children.length > 0; })()`;
const FLAT_NOTE = `(() => { const n = ${CARD}?.querySelector("[data-circles-note]"); return n && !n.hidden ? n.textContent : null; })()`;

// ── the honest floor: the reader withheld on purpose (a pinned World that predates it), in every environment ───────────────

test("FLOOR: with no reader the card keeps TODAY'S flat transcript and SAYS it is the plain transcript; a hostile line is text, never markup", async () => {
  const { b, base } = await boot(false);
  const evil = `<img src=x onerror="window.__pwned=1"> & <b>bold</b>`;
  const state = { live: [thread({ voices: voicesOf().map((v, i) => (i === 0 ? { ...v, said: evil } : v)) })] };
  const p = await openPage(b, base, { office: makeOffice(state) });
  try {
    await p.until(FLAT_SHOWN, "the flat transcript");
    await p.until(`(${FLAT_NOTE}) !== null`, "the note that this is the plain transcript");
    assert.match(await p.evalJs(FLAT_NOTE), /the circle reader isn't available on this page/);
    assert.equal(await p.evalJs(`${CARD}.querySelectorAll(".c-voice").length`), 14, "every statement the poll holds is still there");
    assert.equal(await p.evalJs(`${CARD}.querySelector("[data-circle-reader]")`), null, "no reader, so no reader and no empty room");
    assert.equal(await p.evalJs(`${CARD}.querySelector(".c-voice .c-said").textContent`), evil, "the words, literally");
    assert.equal(await p.evalJs(`${CARD}.querySelectorAll("img").length`), 0, "no element was made from a say");
    assert.equal(await p.evalJs(`window.__pwned`), 0, "and nothing ran");
  } finally { await p.close(); }
});

test("RECONCILE: a poll KEEPS a card for the same thread (same node), adds the new one, removes the one that left, and a no-change poll moves nothing", async () => {
  const { b, base } = await boot(false);
  const A = thread({ id: ROOM }), Bt = thread({ id: ROOM_B, place: "The Quay", at: { x: 5, y: 5 }, voice_count: 3, voices: voicesOf().slice(0, 3), participants: ["pica", "seth"] });
  const state = { live: [A, Bt] };
  const p = await openPage(b, base, { office: makeOffice(state) });
  try {
    await p.until(`document.querySelectorAll("[data-live] [data-thread]").length === 2`, "two cards");
    await p.evalJs(`window.__keep = { a: document.querySelector('[data-thread="${ROOM}"]'), b: document.querySelector('[data-thread="${ROOM_B}"]') }; true`);
    // (1) nothing changed: not one node added, removed or moved in the live box
    await p.evalJs(`window.__muts = 0; new MutationObserver((r) => { for (const m of r) window.__muts += m.addedNodes.length + m.removedNodes.length; }).observe(document.querySelector("[data-live]"), { childList: true }); true`);
    const before = (await p.calls.filter((c) => c.path.startsWith("/world/conversations?closed=")).length);
    await p.tick();
    await p.until(`true`, "-", 1);
    await new Promise((ok) => setTimeout(ok, 600));
    assert.ok(p.calls.filter((c) => c.path.startsWith("/world/conversations?closed=")).length > before, "control: the poll DID run");
    assert.equal(await p.evalJs(`window.__muts`), 0, "a poll that changed nothing moved nothing in the live box");
    // (2) a number moves: the same node, its count in place
    state.live = [{ ...A, voice_count: 15, latest: "2026-11-14T20:15:00.000Z" }, Bt];
    await p.tick();
    await p.until(`document.querySelector('[data-thread="${ROOM}"] [data-c-count]').textContent === "15 statements"`, "the count moved in place");
    assert.equal(await p.evalJs(`document.querySelector('[data-thread="${ROOM}"]') === window.__keep.a`), true, "the same card node");
    // (3) a new room joins at the top, an old one leaves: B and A stay the same nodes where they stay
    const C = thread({ id: "t1794695000000-new", place: "New Place", voice_count: 1, voices: voicesOf().slice(0, 1), participants: ["pica"] });
    state.live = [C, { ...A, voice_count: 15, latest: "2026-11-14T20:15:00.000Z" }];
    await p.tick();
    await p.until(`document.querySelectorAll("[data-live] [data-thread]").length === 2 && !document.querySelector('[data-thread="${ROOM_B}"]')`, "C in, B out");
    assert.deepEqual(await p.evalJs(`[...document.querySelectorAll("[data-live] [data-thread]")].map((c) => c.getAttribute("data-thread"))`), ["t1794695000000-new", ROOM], "order is the office's");
    assert.equal(await p.evalJs(`document.querySelector('[data-thread="${ROOM}"]') === window.__keep.a`), true, "the kept card is still the same node after the reorder");
  } finally { await p.close(); }
});

test("OFFICE DOWN: an unanswered poll keeps the cards and says the office is silent; it is not 'nobody is talking'", async () => {
  const { b, base } = await boot(false);
  const state = { live: [thread()] };
  const p = await openPage(b, base, { office: makeOffice(state) });
  try {
    await p.until(READY(), "the card");
    await p.evalJs(`window.__keep = ${CARD}; true`);
    state.down = true;
    await p.tick();
    await p.until(`!!document.querySelector("[data-live] [data-office-down]")`, "the silence said");
    assert.match(await p.evalJs(`document.querySelector("[data-live] [data-office-down]").textContent`), /isn't answering/);
    assert.equal(await p.evalJs(`${CARD} === window.__keep`), true, "the card (and any reader in it) is still there");
    state.down = false;
    await p.tick();
    await p.until(`!document.querySelector("[data-live] [data-office-down]")`, "the note clears when the office answers");
  } finally { await p.close(); }
});

// ── the reader in the page (when the world's reader exists in this environment) ────────────────────────────────────────────

test(`READER (${readerNote}): the room's top circles come in the order they started, the flat transcript steps aside, and a poll keeps the reader, its focus and its state`, async () => {
  const { b, base } = await boot(true);
  const state = { live: [thread()], room: (id) => roomFind(id) };
  const p = await openPage(b, base, { office: makeOffice(state) });
  try {
    if (!HAS_READER) {
      // no reader in this world: the floor, said (the same assertion as FLOOR, reached through the ordinary server)
      await p.until(`(${FLAT_NOTE}) !== null`, "the floor's note");
      assert.equal(await p.evalJs(`${CARD}.querySelector("[data-circle-reader]")`), null);
      assert.equal(await p.evalJs(`${CARD}.querySelectorAll(".c-voice").length`), 14);
      return;
    }
    await p.until(MOUNTED, "the reader mounted");
    assert.deepEqual(await p.evalJs(`[...${CARD}.querySelectorAll("[data-circle-stub]")].map((s) => Number(s.dataset.circle))`), [50101, 50107, 50114], "the office's start order, none ranked or chosen");
    assert.equal(await p.evalJs(`${CARD}.querySelector(".c-voices").hidden`), true, "the flat transcript steps aside");
    assert.equal(await p.evalJs(`${CARD}.querySelectorAll("[data-yours], [data-your-circle]").length`), 0, "no invented 'your circle'");
    // the visitor picks one; a poll with new talk must not rebuild the reader or take their place
    // the published reader (WLD-178, S180): a room's circle is a list item with its OWN "Open" button; that button is what a visitor focuses
    await p.evalJs(`document.querySelector('[data-circle-open="50107"]').focus(); window.__keep = { root: ${CARD}.querySelector("[data-circle-reader]"), btn: document.activeElement }; true`);
    const asked = p.calls.filter((c) => c.path.startsWith("/world/conversations?room=")).length;
    state.live = [thread({ voice_count: 15, latest: "2026-11-14T20:16:00.000Z" })];
    await p.tick();
    await p.until(`${CARD}.querySelector("[data-c-count]").textContent === "15 statements"`, "the room's number moved");
    await p.until(`true`, "-", 1);
    await new Promise((ok) => setTimeout(ok, 700));
    assert.ok(p.calls.filter((c) => c.path.startsWith("/world/conversations?room=")).length > asked, "the poll refreshed the reader's room, by the office's own read");
    assert.equal(await p.evalJs(`${CARD}.querySelector("[data-circle-reader]") === window.__keep.root`), true, "the reader is the same node");
    // the reader redraws its buttons and puts focus back on the equivalent one (by its stable key): the visitor is where they left themselves
    assert.equal(await p.evalJs(`document.activeElement?.getAttribute("data-key")`), "open-50107", "the keyboard focus is where the visitor left it");
    assert.equal(await p.evalJs(`document.activeElement.isConnected && ${CARD}.contains(document.activeElement)`), true, "on a live button inside the same card");
  } finally { await p.close(); }
});

test(`FALSIFIER (${readerNote}): a forked room with paged history is a comment thread (each say inside the say it replied to), not one flattened transcript, and no statement is lost at the page fold`, async () => {
  const { b, base } = await boot(true);
  const state = { live: [thread()], room: (id) => roomFind(id) };
  const p = await openPage(b, base, { office: makeOffice(state), hash: "#circle-50101" });
  const CARD = SELECTED;           // CORE-117: a circle is read in the page's one-conversation view (the card's "Open" goes there)
  try {
    if (!HAS_READER) { await p.until(`!!document.querySelector("[data-selected-note]:not([hidden])")`, "the floor"); return; }
    await p.until(`!!${CARD}?.querySelector("[data-circle-reader][data-state=circle]")`, "circle 50101 open");
    assert.ok((await p.evalJs(`!!${CARD}.querySelector("[data-crumbs]")`)), "a named path back to the room");
    // THE PUBLISHED READER IS A CLASSIC COMMENT THREAD (WLD-178, Darko 2026-11-19 13:19–13:39): a statement carries its replies folded under it ("View N
    // replies"), a reply opens its own thread, and the circle is that nesting. The old fork/flat-strand drawing predates the accepted shape, so what this proves
    // now is that the nesting IS the served ancestry (each say sits inside the say it replied to, as the office served `reply_to`), that nothing is lost at
    // the page fold, and that opening is the visitor's act.
    const says = () => p.evalJs(`[...${CARD}.querySelectorAll("li[data-say]")].map((s) => Number(s.dataset.say))`);
    // a visitor opens every folded thread (the thread's circle on its line), until none is folded
    const openAll = async () => {
      for (let i = 0; i < 20; i++) {
        const folded = await p.evalJs(`(() => { const t = [...${CARD}.querySelectorAll('[data-thread][data-open="false"] > [data-thread-dot]')]; t.forEach((d) => d.click()); return t.length; })()`);
        if (!folded) return;
      }
      assert.fail("threads kept appearing folded after 20 rounds of opening");
    };
    // page 1 of 2, folded: the circle's opening statement alone, its replies one "View N replies" away (the count the reader drew from page one's lines)
    assert.deepEqual(await says(), [50101], "everything starts folded: only the circle's own opening statement shows");
    assert.equal(await p.evalJs(`${CARD}.querySelectorAll("[data-thread-list]").length`), 1, "the thread list");
    assert.equal(await p.evalJs(`${CARD}.querySelector('[data-thread="t-50101"] [data-thread-view]').textContent.trim()`), "View 5 replies", "page one's five replies, folded under the opener");
    assert.equal(await p.evalJs(`${CARD}.querySelector('[data-thread="t-50101"]').dataset.open`), "false");
    // the office served `next`; the reader offers it, and follows ONLY that
    await p.until(`!!${CARD}.querySelector("[data-next]")`, "the continuation the office served");
    await openAll();
    assert.deepEqual((await says()).sort(), [50101, 50102, 50103, 50104, 50105, 50106], "page one's says, all of them, once opened");
    await p.evalJs(`${CARD}.querySelector("[data-next]").click(); true`);
    await p.until(`!${CARD}.querySelector("[data-next]") && ${CARD}.querySelectorAll('[data-thread][data-open="false"]').length > 0`, "page two loaded (its threads folded)");
    await openAll();
    await p.until(`${CARD}.querySelectorAll("li[data-say]").length === 10`, "page two's says, opened");
    assert.deepEqual((await says()).sort(), [50101, 50102, 50103, 50104, 50105, 50106, 50110, 50111, 50112, 50113], "every statement of the circle: none lost at the fold");
    const asked = p.calls.map((c) => c.path).filter((x) => x.includes("circle=50101"));
    // the page asks once which room the circle is in, the reader reads it; the only other read is the served continuation
    assert.deepEqual([...new Set(asked)], ["/world/conversations?circle=50101", `/world/conversations?circle=50101&after=${WHOLE[5].id}`], "only served continuations were asked");
    assert.equal(asked.filter((x) => x.includes("&after=")).length, 1, "the continuation once");
    // THE ANCESTRY: every say is drawn inside the say it replied to (the served `reply_to`), the opener inside nothing: not a flattened transcript
    const served = Object.fromEntries(WHOLE.map((l) => [l.id, l.reply_to ?? null]));
    const drawn = await p.evalJs(`Object.fromEntries([...${CARD}.querySelectorAll("li[data-say]")].map((li) => [li.dataset.say, li.parentElement.closest("li[data-say]")?.dataset.say ?? null]))`);
    assert.deepEqual(Object.fromEntries(Object.entries(drawn).map(([k, v]) => [Number(k), v === null ? null : Number(v)])), served, "each say sits inside the say the office served it as a reply to");
    // the fork at the opener: its direct replies are exactly the three the office served, in served order
    assert.deepEqual(await p.evalJs(`[...${CARD}.querySelectorAll('[data-thread="t-50101"] > ul > li[data-say]')].map((li) => Number(li.dataset.say))`),
      WHOLE.filter((l) => l.reply_to === 50101).map((l) => l.id), "the opener's direct replies, as served");
    // the seth/pica back-and-forth is a chain, each reply opening its own thread: 50104 is three deep, 50111 four
    const depthOf = (id) => { let d = 0; for (let at = served[id]; at !== null; at = served[at]) d += 1; return d; };
    const depths = await p.evalJs(`Object.fromEntries([...${CARD}.querySelectorAll("li[data-say]")].map((li) => { let d = 0; for (let n = li.parentElement.closest("li[data-say]"); n; n = n.parentElement.closest("li[data-say]")) d += 1; return [li.dataset.say, d]; }))`);
    for (const l of WHOLE) assert.equal(depths[l.id], depthOf(l.id), `say ${l.id} is drawn ${depthOf(l.id)} deep`);
    assert.equal(depths[50104], 3); assert.equal(depths[50111], 4);
    assert.equal(await p.evalJs(`${CARD}.querySelectorAll("[data-loose]").length`), 0, "no say was re-parented or left loose");
    // CONTROL: a naive flatten of these 10 says is ONE list in id order; the page's drawing is not (several parents, several depths)
    assert.ok(new Set(Object.values(drawn)).size >= 5, "more than one parent: not a single flattened transcript");
    assert.ok(new Set(Object.values(depths)).size >= 4, "more than one depth");
  } finally { await p.close(); }
});

// ── the reply target, through the speak box ──────────────────────────────────────────────────────────────────────────────

const REPLY = { id: 50105, handle: "claran", said: "Who painted the sign outside?", at_ms: 1794686700000, circle: 50101 };
const SAY = `(() => { const f = document.querySelector("[data-say-form]"); return !!f && !f.hidden; })()`;
const sendSay = (p, text) => p.evalJs(`(() => { const t = document.querySelector("[data-say-text]"); t.value = ${JSON.stringify(text)}; document.querySelector("[data-say-form]").requestSubmit(); return true; })()`);

test("REPLY: a chosen target shows 'replying to …' with Clear; reply_to rides the say only while chosen; the receipt's note is shown as served; the target clears on success", async () => {
  const { b, base } = await boot(false);       // the reply plumbing is the page's, reached by the reader's own event (the reader is not needed for it)
  const state = {
    live: [thread()],
    sayAnswer: (body) => ({ status: 200, body: { spoke: true, where: { place: "Cave Interior" }, listeners: ["pica"], said: body.reply_to ? { id: 50115, reply_to: body.reply_to, linked: "name", note: "Linked to pica's say by name, as the office reads it." } : { id: 50116 } } }),
  };
  const p = await openPage(b, base, { office: makeOffice(state), signedIn: true });
  try {
    await p.until(SAY, "the speak box (signed in)");
    // no target: no reply_to key at all
    await sendSay(p, "hello room");
    await p.until(`!document.querySelector("[data-say-heard]").hidden`, "the first say landed");
    assert.equal("reply_to" in state.said[0], false, "absent unless chosen");
    assert.equal(await p.evalJs(`document.querySelector("[data-say-linked]").hidden`), true, "no link sentence when the office served none");
    // a Reply pressed in a circle (the reader's own event)
    await p.evalJs(`document.dispatchEvent(new CustomEvent("pm:reply-target", { detail: ${JSON.stringify(REPLY)} })); true`);
    assert.equal(await p.evalJs(`document.querySelector("[data-say-reply]").hidden`), false);
    assert.equal(await p.evalJs(`document.querySelector("[data-say-reply-text]").textContent`), "replying to claran: Who painted the sign outside?");
    // Clear removes it, and the next say has no reply_to again
    await p.evalJs(`document.querySelector("[data-say-reply-clear]").click(); true`);
    assert.equal(await p.evalJs(`document.querySelector("[data-say-reply]").hidden`), true);
    await sendSay(p, "after clear");
    await p.until(`document.querySelector("[data-say-text]").value === ""`, "the second say landed");
    assert.equal("reply_to" in state.said[1], false, "Clear really clears");
    // choose again: reply_to is exactly the served id, and the office's note is shown as served
    await p.evalJs(`document.dispatchEvent(new CustomEvent("pm:reply-target", { detail: ${JSON.stringify(REPLY)} })); true`);
    await sendSay(p, "the third say, a reply");
    await p.until(`!document.querySelector("[data-say-linked]").hidden`, "the office's link sentence");
    assert.equal(state.said[2].reply_to, 50105);
    assert.equal(await p.evalJs(`document.querySelector("[data-say-linked]").textContent`), "Linked to pica's say by name, as the office reads it.");
    assert.equal(await p.evalJs(`document.querySelector("[data-say-reply]").hidden`), true, "a reply is answered once: the target is cleared");
    await sendSay(p, "a fourth, plain");
    await p.until(`document.querySelector("[data-say-text]").value === ""`, "the fourth say landed");
    assert.equal("reply_to" in state.said[3], false, "the next say starts clean");
  } finally { await p.close(); }
});

test("REPLY: the office's refusal (422) is shown verbatim and the target is kept; a long said is cut for the row and shown as text", async () => {
  const { b, base } = await boot(false);
  const state = { live: [thread()], sayAnswer: () => ({ status: 422, body: { spoke: false, error: "bounce", code: 422, defect: "say 50105 is not in the room you are speaking into", hint: "walk to where it was said, or reply to a say you can hear" } }) };
  const p = await openPage(b, base, { office: makeOffice(state), signedIn: true });
  try {
    await p.until(SAY, "the speak box");
    const long = `${"L".repeat(120)}<b>x</b>`;
    await p.evalJs(`document.dispatchEvent(new CustomEvent("pm:reply-target", { detail: ${JSON.stringify({ ...REPLY, said: long })} })); true`);
    assert.equal(await p.evalJs(`document.querySelector("[data-say-reply-text]").textContent`), `replying to claran: ${"L".repeat(80)}…`);
    assert.equal(await p.evalJs(`document.querySelectorAll("[data-say-reply] b").length`), 0, "their words are text");
    await sendSay(p, "this will be refused");
    await p.until(`!document.querySelector("[data-say-bounce]").hidden`, "the refusal");
    assert.equal(await p.evalJs(`document.querySelector("[data-say-bounce] b").textContent`), "say 50105 is not in the room you are speaking into", "the office's defect, verbatim");
    assert.match(await p.evalJs(`document.querySelector("[data-say-bounce]").textContent`), /walk to where it was said/);
    assert.equal(state.said[0].reply_to, 50105, "the refused say did carry the chosen id");
    assert.equal(await p.evalJs(`document.querySelector("[data-say-reply]").hidden`), false, "and the target stands (nothing was said)");
    assert.equal(await p.evalJs(`document.querySelector("[data-say-linked]").hidden`), true);
  } finally { await p.close(); }
});

test(`REPLY (${readerNote}): a Reply button on a circle's own line sets the target; a visitor who is not signed in has no Reply buttons at all`, async () => {
  const { b, base } = await boot(true);
  const state = { live: [thread()], room: (id) => roomFind(id) };
  const CARD = SELECTED;
  const out = await openPage(b, base, { office: makeOffice(state), signedIn: false, hash: "#circle-50101" });
  try {
    if (!HAS_READER) { await out.until(`!!document.querySelector("[data-selected-note]:not([hidden])")`, "the floor"); return; }
    await out.until(`${CARD}?.querySelectorAll("li[data-say]").length > 0`, "a circle open");
    // open the opener's replies too, so the check is over every line a visitor can reach (the thread is folded until opened)
    await out.evalJs(`${CARD}.querySelector('[data-thread="t-50101"] > [data-thread-dot]').click(); true`);
    await out.until(`${CARD}.querySelectorAll("li[data-say]").length > 1`, "the opener's replies, opened");
    assert.equal(await out.evalJs(`document.querySelectorAll("[data-reply]").length`), 0, "no Reply for a visitor");
  } finally { await out.close(); }
  const inn = await openPage(b, base, { office: makeOffice(state), signedIn: true, hash: "#circle-50101" });
  try {
    await inn.until(SAY, "the speak box");
    await inn.until(`!!${CARD}.querySelector('[data-thread="t-50101"] > [data-thread-dot]')`, "the opener's thread");
    // say 50105 is a reply to the opener, so it is reached the way a visitor reaches it: by opening the opener's thread
    assert.equal(await inn.evalJs(`!!${CARD}.querySelector('[data-reply="50105"]')`), false, "folded: not reachable yet");
    await inn.evalJs(`${CARD}.querySelector('[data-thread="t-50101"] > [data-thread-dot]').click(); true`);
    await inn.until(`!!${CARD}.querySelector('[data-reply="50105"]')`, "Reply on say 50105");
    await inn.evalJs(`${CARD}.querySelector('[data-reply="50105"]').click(); true`);
    assert.equal(await inn.evalJs(`document.querySelector("[data-say-reply-text]").textContent`), "replying to claran: Who painted the sign outside?");
  } finally { await inn.close(); }
});

// ── a link into a circle ────────────────────────────────────────────────────────────────────────────────────────────────

test(`#circle-<id> (${readerNote}): the office says which room the circle is in; the page scrolls to that card and opens THAT circle; an unheld room or an unavailable reader is said plainly`, async () => {
  const { b, base } = await boot(true);
  const state = { live: [thread()], room: (id) => roomFind(id), circleRoom: ROOM };
  const p = await openPage(b, base, { office: makeOffice(state), hash: "#circle-50105" });
  try {
    await p.until(`!!${SELECTED}`, "the one-conversation view");
    if (HAS_READER) {
      await p.until(SELECTED_READY, "the circle opened");
      assert.ok(p.calls.map((c) => c.path).includes("/world/conversations?circle=50105"), "the page ASKED the office which room circle 50105 is in; it did not work it out");
      assert.equal(await p.evalJs(`!!document.querySelector("[data-selected-note]:not([hidden])")`), false, "no unavailable note");
      // ONLY this conversation is on the page: the lists, the pins and the intro have stepped aside
      assert.equal(await p.evalJs(`document.documentElement.classList.contains("c-selecting")`), true);
      assert.match(PAGE_SRC, /html\.c-selecting \.convo > \*:not\(\.c-head\):not\(\[data-selected\]\) \{ display: none; \}/, "the stylesheet puts the lists, the pins and the intro away (the harness carries no stylesheet, so this is a source pin)");
      assert.equal(await p.evalJs(`document.querySelector(".c-head h1").textContent`), "One conversation");
      assert.equal(await p.evalJs(`${SELECTED}.querySelector(".c-selected-back").getAttribute("href")`), "/conversations/", "an ordinary link back to all conversations");
      assert.ok(await p.evalJs(`!!${SELECTED}.querySelector("[data-crumbs]")`), "and the reader's own named way back to the room");
    } else {
      await p.until(`!!document.querySelector("[data-selected-note]:not([hidden])")`, "the floor's note");
      assert.match(await p.evalJs(`document.querySelector("[data-selected-note]").textContent`), /circle reader isn't available on this page/);
    }
  } finally { await p.close(); }
  // a circle in a room this page does NOT hold (an earlier page of finished talk): it still opens, from the circle's own served identity, no list paging first
  const away = await openPage(b, base, { office: makeOffice({ ...state, circleRoom: "t1-elsewhere" }), hash: "#circle-50105" });
  try {
    if (HAS_READER) {
      await away.until(SELECTED_READY, "the circle opened although its room is on no held page");
      assert.equal(await away.evalJs(`!!document.getElementById("t1-elsewhere")`), false, "that room's card is not on the page");
      assert.equal(await away.evalJs(`!!document.querySelector("[data-selected-note]:not([hidden])")`), false, "and nothing is said to be missing");
      assert.ok(!away.calls.some((c) => /closed=/.test(c.path) && /before=/.test(c.path)), "no list page was crawled to find it");
    }
  } finally { await away.close(); }
  // the office cannot say: that is not 'empty'
  const lost = await openPage(b, base, { office: (m, path, body) => (path.startsWith("/world/conversations?circle=") ? { status: 422, body: { error: "bounce", code: 422, defect: "no such circle" } } : makeOffice(state)(m, path, body)), hash: "#circle-50105" });
  try {
    await lost.until(`!!document.querySelector("[data-selected-note]:not([hidden])")`, "the note");
    assert.match(await lost.evalJs(`document.querySelector("[data-selected-note]").textContent`), /no such circle.*not the same as it being empty/);
    assert.equal(await lost.evalJs(`!!document.querySelector("[data-selected-retry]")`), true, "and it can be tried again");
    assert.equal(await lost.evalJs(`${SELECTED}.querySelectorAll("li[data-say]").length`), 0, "no statement is drawn as if the circle were empty");
    assert.equal(await lost.evalJs(`document.querySelector("[data-say-reply]").hidden`), true, "and no reply target stands");
  } finally { await lost.close(); }
});

test(`ONE CONVERSATION (${readerNote}): another room's new talk and the poll never replace the view, and folds, focus and the draft stay; Back returns the lists and the speaking area home`, async () => {
  if (!HAS_READER) return;
  const { b, base } = await boot(true);
  const state = { live: [thread()], room: (id) => roomFind(id) };
  const p = await openPage(b, base, { office: makeOffice(state), signedIn: true, hash: "#circle-50101" });
  try {
    await p.until(SELECTED_READY, "the conversation");
    await p.until(SAY, "the speak box");
    const where = (sel) => `(() => { const c = ${SELECTED}; const e = document.querySelector(${JSON.stringify(sel)}); return !!c && !!e && c.contains(e); })()`;
    assert.equal(await p.evalJs(where("section[data-say]")), true, "the speaking area is in the page's flow under the reader, in the same card");
    assert.equal(await p.evalJs(`${SELECTED}.lastElementChild.matches("[data-say]")`), true, "after the reader");
    // the visitor opens a thread, types a draft and puts focus in the box
    await p.evalJs(`${SELECTED}.querySelector('[data-thread="t-50101"] > [data-thread-dot]').click(); true`);
    await p.until(`${SELECTED}.querySelectorAll("li[data-say]").length > 1`, "opened");
    await p.evalJs(`(() => { const t = document.querySelector("[data-say-text]"); t.value = "a draft I am still writing"; t.focus(); t.setSelectionRange(2, 7); return true; })()`);
    const before = await p.evalJs(`${SELECTED}.querySelectorAll("li[data-say]").length`);
    // unrelated NEW room + an update to the shown one arrive on the poll
    state.live = [thread({ voice_count: 15, latest: "2026-11-14T20:20:00.000Z" }), thread({ id: ROOM_B, place: "The Quay", voice_count: 3, latest: "2026-11-14T20:21:00.000Z", voices: voicesOf().slice(0, 3) })];
    await p.tick(); await new Promise((r) => setTimeout(r, 1500));
    assert.equal(await p.evalJs(`document.querySelector("[data-selected-card]").dataset.selectedCard`), "50101", "still the chosen conversation");
    assert.equal(await p.evalJs(`document.querySelectorAll("[data-selected-card]").length`), 1);
    assert.equal(await p.evalJs(`${SELECTED}.querySelectorAll("li[data-say]").length`), before, "its opened thread kept (not folded, not replaced)");
    assert.equal(await p.evalJs(`document.querySelector("[data-say-text]").value`), "a draft I am still writing", "the draft stays");
    assert.equal(await p.evalJs(`document.activeElement === document.querySelector("[data-say-text]")`), true, "focus stays in the box");
    assert.equal(await p.evalJs(`document.querySelector("[data-say-text]").selectionStart + "-" + document.querySelector("[data-say-text]").selectionEnd`), "2-7", "and so does the selection");
    assert.equal(await p.evalJs(`!!${SELECTED}.querySelector('[data-thread="t-50101"] > [data-thread-view]')`), false, "no fold re-appeared for the opened thread");
    // Back (the lists return and the speaking area goes home, draft intact)
    await p.evalJs(`location.hash = ""; true`);
    await p.until(`!document.querySelector("[data-selected-card]")`, "the view left");
    assert.equal(await p.evalJs(`document.documentElement.classList.contains("c-selecting")`), false);
    assert.equal(await p.evalJs(`document.querySelector("section[data-say]").parentElement.matches("main")`), true, "the speaking area is home");
    assert.equal(await p.evalJs(`document.querySelector("[data-say-text]").value`), "a draft I am still writing", "the draft survived the round trip");
    await p.until(`!!${CARD}`, "the lists are back");
  } finally { await p.close(); }
});

test(`ONE CONVERSATION (${readerNote}): a card's Open goes to that conversation's own view; choosing another conversation clears a stale reply target`, async () => {
  if (!HAS_READER) return;
  const { b, base } = await boot(true);
  const state = { live: [thread()], room: (id) => roomFind(id) };
  const p = await openPage(b, base, { office: makeOffice(state), signedIn: true });
  try {
    await p.until(MOUNTED, "the reader on the card");
    await p.until(SAY, "the speak box");
    await p.evalJs(`document.querySelector('[data-circle-open="50101"]').click(); true`);
    await p.until(`location.hash === "#circle-50101"`, "Open is the circle link");
    await p.until(SELECTED_READY, "the one-conversation view");
    await p.until(`!!${SELECTED}.querySelector('[data-thread="t-50101"] > [data-thread-dot]')`, "the opener's thread");
    await p.evalJs(`${SELECTED}.querySelector('[data-thread="t-50101"] > [data-thread-dot]').click(); true`);
    await p.until(`!!${SELECTED}.querySelector('[data-reply="50105"]')`, "Reply on 50105");
    await p.evalJs(`${SELECTED}.querySelector('[data-reply="50105"]').click(); true`);
    assert.equal(await p.evalJs(`document.querySelector("[data-say-reply]").hidden`), false, "a target is chosen");
    // another conversation is chosen: the target (a say of the first) must not follow
    await p.evalJs(`location.hash = "#circle-50107"; true`);
    await p.until(`${SELECTED}?.dataset.selectedCard === "50107"`, "the other conversation");
    assert.equal(await p.evalJs(`document.querySelector("[data-say-reply]").hidden`), true, "no stale reply target");
    // and the card's reader went back to its room (not left in a circle under the lists)
    await p.evalJs(`location.hash = ""; true`);
    await p.until(`!!${CARD}`, "lists back");
    await p.until(`${CARD}.querySelector("[data-circle-reader]")?.dataset.state === "room"`, "the card reads as a room again");
  } finally { await p.close(); }
});

test(`ONE CONVERSATION (${readerNote}): the reader's own Back to the room and Open FOLLOW in the one view: the address and the selected conversation move with what is on screen, a stale reply target is dropped, the draft, actor and form stay, the room step shows ONE metadata group, and a say carries only the target chosen THERE`, async () => {
  if (!HAS_READER) return;
  const { b, base } = await boot(true);
  const state = { live: [thread()], room: (id) => roomFind(id), echoCircle: true };
  const p = await openPage(b, base, { office: makeOffice(state), signedIn: true, hash: "#circle-50101" });
  try {
    await p.until(SELECTED_READY, "the conversation");
    await p.until(SAY, "the speak box");
    await p.evalJs(`(() => { window.__sayNode = document.querySelector("section[data-say]"); window.__formNode = document.querySelector("[data-say-form]"); window.__as = document.querySelector("[data-say-as]")?.value ?? null; document.querySelector("[data-say-text]").value = "a draft that must survive"; return true; })()`);
    const actor = await p.evalJs(`window.__as`);
    // Reply on a say of the FIRST conversation, on the reader's own button
    await p.until(`!!${SELECTED}.querySelector('[data-thread="t-50101"] > [data-thread-dot]')`, "the opener's thread");
    await p.evalJs(`${SELECTED}.querySelector('[data-thread="t-50101"] > [data-thread-dot]').click(); true`);
    await p.until(`!!${SELECTED}.querySelector('[data-reply="50105"]')`, "Reply on 50105");
    await p.evalJs(`${SELECTED}.querySelector('[data-reply="50105"]').click(); true`);
    assert.equal(await p.evalJs(`document.querySelector("[data-say-reply]").hidden`), false, "a target is chosen in the first conversation");
    // the reader's ACTUAL "Back to the room" (not a hash set by the test)
    await p.evalJs(`${SELECTED}.querySelector("[data-back]").click(); true`);
    await p.until(`${SELECTED}.querySelector("[data-circle-reader]")?.dataset.state === "room"`, "the room step");
    assert.equal(await p.evalJs(`document.querySelector("[data-say-reply]").hidden`), true, "the stale reply target is dropped when the reader moves away");
    assert.equal(await p.evalJs(`location.hash`), "#circle-50101", "the room step keeps the selected conversation's address");
    // ONE effective metadata group on the room step: the reader's own room header, and the page's partial place + live line stands down beside it
    assert.equal(await p.evalJs(`${SELECTED}.classList.contains("is-room-step")`), true);
    assert.equal(await p.evalJs(`${SELECTED}.querySelectorAll(".cr-head").length`), 1, "the reader's room header");
    // (this harness page carries no stylesheet, so the rule is shown by matching the page's own selector against the live DOM, and pinned in the page's CSS below; the built pictures show it drawn)
    assert.equal(await p.evalJs(`document.querySelectorAll('.c-selected.is-room-step [data-selected-place], .c-selected.is-room-step > .c-chip').length`), 2, "the page's partial place and live chip are exactly what the room step's rule stands down");
    assert.match(PAGE_SRC, /\.convo \.c-selected\.is-room-step \[data-selected-place\], \.convo \.c-selected\.is-room-step > \.c-chip \{ display: none; \}/, "the stylesheet stands them down beside the reader's own room header");
    // the reader's ACTUAL "Open" on the other conversation
    await p.until(`!!${SELECTED}.querySelector('[data-circle-open="50107"]')`, "Open on the other conversation");
    await p.evalJs(`${SELECTED}.querySelector('[data-circle-open="50107"]').click(); true`);
    await p.until(`location.hash === "#circle-50107" && ${SELECTED}?.dataset.selectedCard === "50107"`, "the address and the selected conversation follow");
    await p.until(`${SELECTED}.querySelector("[data-circle-reader]")?.dataset.state === "circle"`, "the circle is on screen");
    assert.equal(await p.evalJs(`${SELECTED}.classList.contains("is-room-step")`), false, "the room step is left");
    assert.equal(await p.evalJs(`(() => { const e = ${SELECTED}.querySelector("[data-selected-place]"); return !!e && getComputedStyle(e).display !== "none" && e.textContent === "Cave Interior"; })()`), true, "the page's place line is back, from the office's own answer for THIS circle");
    assert.equal(await p.evalJs(`document.querySelectorAll("[data-selected-card]").length`), 1, "one selected card");
    assert.equal(await p.evalJs(`document.querySelector("[data-say-reply]").hidden`), true, "still no stale target");
    // the page's one form, its draft and its actor are the same ones
    assert.equal(await p.evalJs(`document.querySelector("section[data-say]") === window.__sayNode && document.querySelector("[data-say-form]") === window.__formNode`), true, "the same speaking-area nodes");
    assert.equal(await p.evalJs(`document.querySelector("[data-say-text]").value`), "a draft that must survive", "the draft stayed");
    assert.equal(await p.evalJs(`document.querySelector("[data-say-as]")?.value ?? null`), actor, "the actor stayed");
    // a say now (fixture office, no real act) rides NO target: the first conversation's was dropped
    await p.evalJs(`document.querySelector("[data-say-form]").requestSubmit(); true`);
    await p.until(`document.querySelector("[data-say-text]").value === ""`, "the first say landed");
    assert.equal(state.said.length, 1);
    assert.equal("reply_to" in state.said[0], false, "no stale reply_to rode the say");
    assert.equal(state.said[0].text, "a draft that must survive");
    // and a Reply chosen in THIS conversation rides exactly its id
    await p.until(`!!${SELECTED}.querySelector('[data-thread="t-50101"] > [data-thread-dot]')`, "the opener's thread in the other conversation");
    // open it only if it is folded (the reader keeps a thread's fold by its key, and the visitor's own say refreshed the view)
    await p.evalJs(`(() => { const t = ${SELECTED}.querySelector('[data-thread="t-50101"]'); if (t && t.getAttribute("data-open") === "false") t.querySelector(":scope > [data-thread-dot]").click(); return true; })()`);
    await p.until(`!!${SELECTED}.querySelector('[data-reply="50105"]')`, "Reply on 50105 here");
    await p.evalJs(`${SELECTED}.querySelector('[data-reply="50105"]').click(); true`);
    await sendSay(p, "a reply chosen here");
    await p.until(`document.querySelector("[data-say-text]").value === ""`, "the second say landed");
    assert.equal(state.said[1].reply_to, 50105, "the target chosen in the conversation on screen is the one that rides");
  } finally { await p.close(); }
});

test(`ONE CONVERSATION (${readerNote}): the visible "← All conversations" leaves IN PLACE on an ordinary press (no reload; the form, draft and actor stay) and keeps ordinary link semantics for a modified press and the browser's Back`, async () => {
  if (!HAS_READER) return;
  const { b, base } = await boot(true);
  const state = { live: [thread()], room: (id) => roomFind(id) };
  const p = await openPage(b, base, { office: makeOffice(state), signedIn: true, hash: "#circle-50101" });
  try {
    await p.until(SELECTED_READY, "the conversation");
    await p.until(SAY, "the speak box");
    await p.evalJs(`(() => { window.__noReload = 7; window.__sayNode = document.querySelector("section[data-say]"); window.__as = document.querySelector("[data-say-as]")?.value ?? null; document.querySelector("[data-say-text]").value = "keep me"; return true; })()`);
    const actor = await p.evalJs(`window.__as`);
    assert.equal(await p.evalJs(`${SELECTED}.querySelector(".c-selected-back").getAttribute("href")`), "/conversations/", "an ordinary link, href intact");
    // a MODIFIED press is the link's own business: the page does not cancel it (the test cancels it afterwards so this page stays put)
    await p.evalJs(`(() => { const a = ${SELECTED}.querySelector(".c-selected-back"); window.__mod = null; a.addEventListener("click", (e) => { window.__mod = { prevented: e.defaultPrevented }; e.preventDefault(); }, { once: true }); a.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, ctrlKey: true, button: 0 })); return true; })()`);
    assert.deepEqual(await p.evalJs(`window.__mod`), { prevented: false }, "a ctrl-press is left to the browser's own new-tab handling");
    assert.equal(await p.evalJs(`!!document.querySelector("[data-selected-card]")`), true, "and it did not leave the view");
    // an ORDINARY primary press: in place
    await p.evalJs(`${SELECTED}.querySelector(".c-selected-back").click(); true`);
    await p.until(`!document.querySelector("[data-selected-card]")`, "the view left");
    assert.equal(await p.evalJs(`window.__noReload`), 7, "the page was not reloaded");
    assert.equal(await p.evalJs(`location.pathname + location.hash`), "/conversations/", "the address is the plain list");
    assert.equal(await p.evalJs(`document.querySelector("section[data-say]") === window.__sayNode && document.querySelector("section[data-say]").parentElement.matches("main")`), true, "the same speaking area, home");
    assert.equal(await p.evalJs(`document.querySelector("[data-say-text]").value`), "keep me", "the draft stayed");
    assert.equal(await p.evalJs(`document.querySelector("[data-say-as]")?.value ?? null`), actor, "the actor stayed");
    await p.until(`!!${CARD}`, "the lists are back");
    // the browser's own Back returns to the conversation, draft still intact
    await p.evalJs(`history.back(); true`);
    await p.until(SELECTED_READY, "Back returns to the one conversation");
    assert.equal(await p.evalJs(`document.querySelector("[data-say-text]").value`), "keep me", "the draft survived the whole round trip");
  } finally { await p.close(); }
});

test("CORE-117: an event page's circle links to the Conversations page's one-conversation view (a source pin on the event page's mount)", () => {
  const EVENT_SRC = readFileSync(join(ROOT, "town/pages/events/[host]/[slug].astro"), "utf8");
  assert.match(EVENT_SRC, /hrefForCircle: \(c\) => `\/conversations\/#circle-\$\{encodeURIComponent\(c\)\}`/);
});

test("CORE-128: a card's metadata is ONE group above the talk (counts, began, latest; no relative 'last … ago' narration), and each speaker is a face and a name, the faces arriving in place", async () => {
  const { b, base } = await boot(false);
  RESIDENTS_META = { residents: {
    pica: { name: "Pica", avatar: "/media/pica-avatar-card.jpg", color: "#2f5aa8" },
    noe: { name: "Noe", avatar: "javascript:alert(1)", color: "#c0703c" },
  } };
  RESIDENTS_META_DELAY_MS = 1500;                                   // the names are drawn first; the public list lands after, through the page's own poll/cache path
  const withHuman = thread({ participants: ["pica", "noe", "human-of-pica", "seth"] });
  const state = { live: [withHuman] };
  const p = await openPage(b, base, { office: makeOffice(state) });
  try {
    await p.until(`${CARD}?.querySelectorAll(".c-people .c-person").length === 4`, "the speakers list");
    // ONE metadata group, above the talk: place + live in the head; counts, began, latest in .c-meta; nothing relative, no second group
    const meta = await p.evalJs(`(() => { const c = ${CARD}; const m = c.querySelector(".c-meta"); return { text: m.textContent.replace(/\\s+/g, " ").trim(), order: [...c.children].map((e) => e.className.split(" ")[0]).slice(0, 4), live: c.querySelectorAll(".c-chip.live").length, groups: c.querySelectorAll(".c-meta").length, whole: c.textContent }; })()`);
    assert.match(meta.text, /14 statements/);
    assert.match(meta.text, /4 speakers/);
    assert.match(meta.text, /began 2026-11-14 20:01Z/);
    assert.match(meta.text, /latest 2026-11-14 20:14Z/);
    assert.doesNotMatch(meta.whole.split("There is")[0], /\blast \d+[smhd] ago\b|\bjust now\b/, "no relative 'last … ago / now' narration in the card's metadata");
    assert.deepEqual(meta.order.slice(0, 3), ["c-thread-head", "c-meta", "c-people"], "title/live, then the metadata, then the speakers, all above the talk");
    assert.equal(meta.live, 1, "the live mark once");
    assert.equal(meta.groups, 1, "one metadata group");
    // the names first (names-only until the list lands), then the faces are swapped in IN PLACE: the same link node, the same focus
    await p.evalJs(`window.__link = ${CARD}.querySelector(".c-person a.c-who"); window.__link.focus(); true`);
    assert.equal(await p.evalJs(`${CARD}.querySelectorAll(".c-person > img.c-face").length`), 0, "no picture before the list lands (letters, not blocked words)");
    await p.until(`${CARD}.querySelectorAll(".c-person > img.c-face").length === 1`, "the public picture arrived");
    const after = await p.evalJs(`(() => { const c = ${CARD}; const ppl = [...c.querySelectorAll(".c-person")].map((i) => ({ handle: i.dataset.handle, face: i.firstElementChild.tagName + "." + i.firstElementChild.className.replace(/\\s+/g, "."), letter: i.firstElementChild.textContent, src: i.firstElementChild.getAttribute("src"), hasLink: !!i.querySelector("a.c-who, .c-who") })); return { ppl, sameLink: c.querySelector(".c-person a.c-who") === window.__link, focus: document.activeElement === window.__link }; })()`);
    assert.equal(after.sameLink, true, "the names were not rebuilt");
    assert.equal(after.focus, true, "the keyboard focus stayed on the link it was on");
    const by = Object.fromEntries(after.ppl.map((x) => [x.handle, x]));
    assert.equal(by.pica.face.startsWith("IMG."), true);
    assert.equal(by.pica.src, "/media/pica-avatar-card.jpg");
    assert.equal(by.noe.face.startsWith("SPAN."), true, "a refused picture address is a letter");
    assert.equal(by.noe.letter, "N");
    assert.match(by["human-of-pica"].face, /is-human/, "the house's human: the dashed chip");
    assert.equal(by["human-of-pica"].src, null, "never a photo");
    assert.equal(by.seth.letter, "S", "a speaker the list does not hold: a letter");
    assert.ok(after.ppl.every((x) => x.hasLink || x.handle.startsWith("human-of-")), "every speaker keeps their name");
    // a poll with new talk moves the numbers in place and does not rebuild the speakers
    state.live = [{ ...withHuman, voice_count: 15, latest: "2026-11-14T20:16:00.000Z" }];
    await p.tick();
    await p.until(`${CARD}.querySelector("[data-c-count]").textContent === "15 statements" && ${CARD}.querySelector("[data-c-latest]").textContent === "latest 2026-11-14 20:16Z"`, "the numbers moved in place");
    assert.equal(await p.evalJs(`${CARD}.querySelector(".c-person a.c-who") === window.__link`), true, "the speakers were not rebuilt by the poll");
  } finally { RESIDENTS_META = null; RESIDENTS_META_DELAY_MS = 0; await p.close(); }
});

test(`CORE-128 (${readerNote}): the host owns the room's header (none repeated inside the reader, no 'now' row) and every byline the reader draws, a room's circle list and an opened circle alike, carries its face inline`, async () => {
  const { b, base } = await boot(true);
  RESIDENTS_META = { residents: { pica: { name: "Pica", avatar: "/media/pica-avatar-card.jpg", color: "#2f5aa8" }, noe: { name: "Noe", avatar: null, color: "#c0703c" } } };
  const p = await openPage(b, base, { office: makeOffice({ live: [thread()], room: (id) => roomFind(id) }) });
  try {
    if (!HAS_READER) return;                      // a pinned World that predates the reader: the FLOOR tests above are what runs
    await p.until(MOUNTED, "the reader mounted");
    // the room's one header is the host's: the reader draws none of its own (WLD-215 hostOwnsHeader), so the metadata is said once, above the talk
    assert.equal(await p.evalJs(`${CARD}.querySelectorAll(".cr-head").length`), 0, "no second header inside the reader");
    assert.equal(await p.evalJs(`${CARD}.querySelectorAll(".c-thread-head").length`), 1, "the host's one title/live group");
    assert.equal(await p.evalJs(`${CARD}.querySelectorAll(".c-meta").length`), 1, "the host's one counts/began/latest group");
    assert.equal(await p.evalJs(`/\\bnow\\b/i.test(${CARD}.querySelector(".c-thread-head").textContent + " " + ${CARD}.querySelector(".c-meta").textContent)`), false, "no 'now' row");
    // the room's circle list: each opener's byline wears a face, inline, first (a fresh node per line)
    const bylines = `[...${CARD}.querySelectorAll("[data-circle-reader] .cr-head-line")]`;
    assert.equal(await p.evalJs(`${bylines}.length > 0 && ${bylines}.every((l) => l.firstElementChild?.classList.contains("c-face"))`), true, "every listed opener has its face first in the byline");
    // an opened circle: every statement, replies included. CORE-117: a statement's "Open" goes to that conversation's OWN view (the #circle- link: the one-conversation view),
    // so the opened circle is read THERE, in the page's one selected card, wearing the same provider the lists do
    const picked = `[...${SELECTED}.querySelectorAll("[data-circle-reader] .cr-head-line")]`;
    await p.evalJs(`document.querySelector('[data-circle-open="50101"]').click(); true`);
    await p.until(SELECTED_READY, "the circle opened (in the one-conversation view)");
    // the visitor opens every folded thread (the replies), as the FALSIFIER test does, until none is folded
    for (let i = 0; i < 20; i++) {
      const folded = await p.evalJs(`(() => { const t = [...${SELECTED}.querySelectorAll('[data-thread][data-open="false"] > [data-thread-dot]')]; t.forEach((d) => d.click()); return t.length; })()`);
      if (!folded) break;
    }
    // the lists' card keeps its ONE room header (the host's group), unchanged by opening a circle elsewhere; the one view's own header is the place and the live chip
    assert.equal(await p.evalJs(`${CARD}.querySelectorAll(".c-thread-head").length`), 1, "the host's one room header, unchanged by opening a circle");
    assert.equal(await p.evalJs(`${picked}.length > 1 && ${picked}.every((l) => l.firstElementChild?.classList.contains("c-face"))`), true, "every statement of the opened circle, replies included, has its face first in the byline");
    assert.equal(await p.evalJs(`new Set(${picked}.map((l) => l.firstElementChild)).size === ${picked}.length`), true, "a fresh node per line: no repeated speaker took an earlier line's face");
    // the names stay: each byline keeps its speaker's name after the face (in the one view the names are the reader's own `.cr-who`; the host's `.c-who` links belong to the lists' speakers line)
    assert.equal(await p.evalJs(`${picked}.every((l) => (l.querySelector(".cr-who")?.textContent ?? "").trim().length > 0)`), true, "the names stay");
  } finally { RESIDENTS_META = null; await p.close(); }
});

test("the header no longer says a conversation closes after five quiet minutes, and the page's own wording keeps 'letter threads' and 'circles' apart", () => {
  assert.doesNotMatch(PAGE_SRC, /closes itself after five\s+quiet minutes|living five minutes/i, "the stale claim is gone (the office's record says a conversation lasts the settlement)");
  assert.match(PAGE_SRC, /lasts until the\s+settlement/);
  assert.doesNotMatch(MAIN, /letter threads?/i, "this page is spoken talk: circles, never letter threads");
});

// CORE-144 (Wright 2026-11-20 23:59Z): a Chrome that never reports its DevTools URL must FAIL the launch with that real error, promptly, and leave nothing
// behind. The launcher's child is detached with a piped stderr; before the fix the timeout rejected and left both alive, so the file never exited (CI held
// open until cancelled). The "browser" here is a shell script that records its pid and sleeps, so no Chrome is needed and the real 20 s limit is not waited out.
test("CORE-144: a Chrome that never reports a DevTools URL fails the launch with its real error and leaves no child or pipe behind", async () => {
  const dir = mkdtempSync(join(tmpdir(), "core144-fake-chrome-"));
  const pidFile = join(dir, "pid"), fake = join(dir, "fake-chrome");
  writeFileSync(fake, `#!/bin/sh\necho $$ > "${pidFile}"\nexec sleep 300\n`, { mode: 0o755 });
  const pipes = () => process.getActiveResourcesInfo().filter((r) => r === "PipeWrap").length;
  const before = pipes();
  let pid = null;
  try {
    await assert.rejects(launch(fake, { startMs: 1500 }), /^Error: no DevTools url within 1\.5 s$/, "the original timeout error, unchanged");
    pid = Number(readFileSync(pidFile, "utf8"));
    assert.ok(pid > 1, "the fake browser started");
    const alive = () => { try { process.kill(pid, 0); return true; } catch { return false; } };
    for (let i = 0; i < 75 && (alive() || pipes() > before); i++) await new Promise((r) => setTimeout(r, 40));
    assert.equal(alive(), false, "the spawned child is reaped on the failed start");
    assert.ok(pipes() <= before, "its piped stderr is closed");
    pid = null;
  } finally {
    if (pid) { try { process.kill(pid, "SIGKILL"); } catch { /* gone */ } }   // only reached with a live child: the assertion above failed
    rmSync(dir, { recursive: true, force: true });
  }
});
