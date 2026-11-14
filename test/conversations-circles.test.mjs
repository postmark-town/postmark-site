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
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
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

function serve({ withReader }) {
  const server = http.createServer((req, res) => {
    const path = decodeURIComponent((req.url || "/").split("?")[0]);
    const send = (code, type, body) => { res.writeHead(code, { "content-type": type, "cache-control": "no-store" }); res.end(body); };
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

async function launch(chrome) {
  const profile = mkdtempSync(join(tmpdir(), "core82-convo-profile-"));
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
    for (const t0 = Date.now(); Date.now() - t0 < ms;) { if (await evalJs(js)) return; await new Promise((ok) => setTimeout(ok, 80)); }
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
      return { status: m[2] ? 200 : 200, body: circlePage(m[2] ? 2 : 1) };
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
    await p.evalJs(`document.querySelector('[data-circle-stub][data-circle="50107"]').focus(); window.__keep = { root: ${CARD}.querySelector("[data-circle-reader]"), btn: document.activeElement }; true`);
    const asked = p.calls.filter((c) => c.path.startsWith("/world/conversations?room=")).length;
    state.live = [thread({ voice_count: 15, latest: "2026-11-14T20:16:00.000Z" })];
    await p.tick();
    await p.until(`${CARD}.querySelector("[data-c-count]").textContent === "15 statements"`, "the room's number moved");
    await p.until(`true`, "-", 1);
    await new Promise((ok) => setTimeout(ok, 700));
    assert.ok(p.calls.filter((c) => c.path.startsWith("/world/conversations?room=")).length > asked, "the poll refreshed the reader's room, by the office's own read");
    assert.equal(await p.evalJs(`${CARD}.querySelector("[data-circle-reader]") === window.__keep.root`), true, "the reader is the same node");
    // the reader redraws its buttons and puts focus back on the equivalent one (by its stable key): the visitor is where they left themselves
    assert.equal(await p.evalJs(`document.activeElement?.getAttribute("data-key")`), "stub-50107", "the keyboard focus is where the visitor left it");
    assert.equal(await p.evalJs(`document.activeElement.isConnected && ${CARD}.contains(document.activeElement)`), true, "on a live button inside the same card");
  } finally { await p.close(); }
});

test(`FALSIFIER (${readerNote}): a forked room with flat strands and paged history is not one flattened transcript, and no statement is lost at the page fold`, async () => {
  const { b, base } = await boot(true);
  const state = { live: [thread()], room: (id) => roomFind(id) };
  const p = await openPage(b, base, { office: makeOffice(state) });
  try {
    if (!HAS_READER) { await p.until(`(${FLAT_NOTE}) !== null`, "the floor"); return; }
    await p.until(MOUNTED, "the reader mounted");
    await p.evalJs(`document.querySelector('[data-circle-stub][data-circle="50101"]').click(); true`);
    await p.until(`!!${CARD}.querySelector("[data-circle-reader][data-state=circle]")`, "circle 50101 open");
    assert.ok((await p.evalJs(`!!${CARD}.querySelector("[data-crumbs]")`)), "a named path back to the room");
    // page 1 of 2: the office served `next`; the reader offers it, and follows ONLY that
    const says = (js) => p.evalJs(`[...${CARD}.querySelectorAll("[data-say]")].map((s) => Number(s.dataset.say))`);
    assert.deepEqual((await says()).sort(), [50101, 50102, 50103, 50104, 50105, 50106], "page one's says, all of them");
    await p.until(`!!${CARD}.querySelector("[data-next]")`, "the continuation the office served");
    await p.evalJs(`${CARD}.querySelector("[data-next]").click(); true`);
    await p.until(`${CARD}.querySelectorAll("[data-say]").length === 10`, "page two loaded");
    assert.deepEqual((await says()).sort(), [50101, 50102, 50103, 50104, 50105, 50106, 50110, 50111, 50112, 50113], "every statement of the circle: none lost at the fold");
    const asked = p.calls.map((c) => c.path).filter((x) => x.includes("circle=50101"));
    assert.deepEqual(asked, ["/world/conversations?circle=50101", `/world/conversations?circle=50101&after=${WHOLE[5].id}`], "only served continuations were asked");
    // the circle is its structure, not a flat list: a fork at the opener, strands drawn flat
    assert.ok(await p.evalJs(`${CARD}.querySelectorAll("[data-fork]").length >= 1`), "the fork at 50101 is a fork");
    const strands = await p.evalJs(`[...${CARD}.querySelectorAll("[data-strand]")].map((u) => [...u.querySelectorAll("[data-say]")].map((s) => Number(s.dataset.say)))`);
    assert.ok(strands.some((s) => s.join() === "50102,50103,50104"), "the seth/pica back-and-forth is one flat strand");
    assert.ok(strands.some((s) => s.join() === "50112,50113"), "and so is amia/pica");
    assert.equal(await p.evalJs(`${CARD}.querySelectorAll("[data-loose]").length`), 0, "no say was re-parented or left loose");
    // CONTROL: a naive flatten of these 10 says is ONE list in id order; the page's drawing differs from it
    assert.ok(strands.length >= 3, "more than one strand: not a single flattened transcript");
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
  const out = await openPage(b, base, { office: makeOffice(state), signedIn: false });
  try {
    if (!HAS_READER) { await out.until(`(${FLAT_NOTE}) !== null`, "the floor"); return; }
    await out.until(MOUNTED, "the reader (signed out)");
    await out.evalJs(`document.querySelector('[data-circle-stub][data-circle="50101"]').click(); true`);
    await out.until(`${CARD}.querySelectorAll("[data-say]").length > 0`, "a circle open");
    assert.equal(await out.evalJs(`document.querySelectorAll("[data-reply]").length`), 0, "no Reply for a visitor");
  } finally { await out.close(); }
  const inn = await openPage(b, base, { office: makeOffice(state), signedIn: true });
  try {
    await inn.until(MOUNTED, "the reader (signed in)");
    await inn.until(SAY, "the speak box");
    await inn.evalJs(`document.querySelector('[data-circle-stub][data-circle="50101"]').click(); true`);
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
    await p.until(`!!document.getElementById("${ROOM}")`, "the room's card");
    await p.until(`${CARD}.classList.contains("is-anchored") || !!document.querySelector("[data-circle-note]:not([hidden])")`, "the link resolved");
    const asked = p.calls.map((c) => c.path);
    assert.ok(asked.includes("/world/conversations?circle=50105"), "the page ASKED the office which room circle 50105 is in; it did not work it out");
    if (HAS_READER) {
      await p.until(`!!${CARD}.querySelector("[data-circle-reader][data-state=circle]")`, "the circle opened");
      assert.equal(await p.evalJs(`document.querySelector("[data-circle-note]").hidden`), true);
    } else {
      assert.match(await p.evalJs(`document.querySelector("[data-circle-note]").textContent`), /circle reader isn't available on this page/);
    }
  } finally { await p.close(); }
  // a circle in a room this page does not hold: said plainly, the page stands
  const away = await openPage(b, base, { office: makeOffice({ ...state, circleRoom: "t1-elsewhere" }), hash: "#circle-50105" });
  try {
    await away.until(`!document.querySelector("[data-circle-note]").hidden`, "the note");
    assert.match(await away.evalJs(`document.querySelector("[data-circle-note]").textContent`), /isn't holding right now \(t1-elsewhere\).*Show earlier/);
    assert.equal(await away.evalJs(`!!${CARD}`), true, "the page stands");
  } finally { await away.close(); }
  // the office cannot say: that is not 'empty'
  const lost = await openPage(b, base, { office: (m, path, body) => (path.startsWith("/world/conversations?circle=") ? { status: 422, body: { error: "bounce", code: 422, defect: "no such circle" } } : makeOffice(state)(m, path, body)), hash: "#circle-50105" });
  try {
    await lost.until(`!document.querySelector("[data-circle-note]").hidden`, "the note");
    assert.match(await lost.evalJs(`document.querySelector("[data-circle-note]").textContent`), /no such circle.*not the same as the circle being empty/);
  } finally { await lost.close(); }
});

test("the header no longer says a conversation closes after five quiet minutes, and the page's own wording keeps 'letter threads' and 'circles' apart", () => {
  assert.doesNotMatch(PAGE_SRC, /closes itself after five\s+quiet minutes|living five minutes/i, "the stale claim is gone (the office's record says a conversation lasts the settlement)");
  assert.match(PAGE_SRC, /lasts until the\s+settlement/);
  assert.doesNotMatch(MAIN, /letter threads?/i, "this page is spoken talk: circles, never letter threads");
});
