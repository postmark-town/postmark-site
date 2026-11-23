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
// No test skips. Each behaviour is asserted for whichever world it runs in: with the reader, the one-conversation view (a #circle- link) and a long
// room's fallback; always (with the reader withheld on purpose, whether or not the real one exists) READING A ROOM, which needs no reader.
// A Chrome that cannot be found FAILS the file (a skipped render is not a passed one).
//
// READING A ROOM (CORE-156; Darko 2026-11-22, of three versions: "Let's go with B"): a card's room is drawn by the PAGE from the lines its own read
// carries (each line's `id` and `reply_to`, as the office serves them): every opening message whole, its replies behind one button that opens the whole
// circle in place. The "B ·" tests below hold it, and that none of it asks the office for anything. Until then every card mounted the World's reader.
// Each B test's guarded line has been removed in a COPY of the page and the test seen red (CORE156_PAGE; the PR lists the flips).

import test, { after } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import http from "node:http";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
// CORE-156: the page is read with LF line ends (a Windows checkout under core.autocrlf holds CRLF, and the slices below are cut at "\n", so the file
// could not even load there); CORE156_PAGE points a run at a COPY of the page (a flip is made on a copy, never in the tree)
const PAGE_SRC = readFileSync(process.env.CORE156_PAGE || join(ROOT, "town/pages/conversations/index.astro"), "utf8").replace(/\r\n/g, "\n");
const FX = JSON.parse(readFileSync(join(ROOT, "test/fixtures/circles.sample.json"), "utf8"));

// ── the harness page, read out of the real one ──────────────────────────────────────────────────────────────────────────

const between = (s, a, b, from = 0) => { const i = s.indexOf(a, from); const j = s.indexOf(b, i + a.length); assert.ok(i > -1 && j > i, `the page still carries ${a}`); return s.slice(i + a.length, j); };
const MAIN = between(PAGE_SRC, '<main class="pm-wrap convo">', "</main>");
const INLINE = between(PAGE_SRC, "<script is:inline>", "</script>");
const MODULE = between(PAGE_SRC, "\n  <script>\n", "</script>", PAGE_SRC.indexOf("</script>", PAGE_SRC.indexOf("<script is:inline>")));
const STYLE = between(PAGE_SRC, "<style is:global>", "</style>");     // CORE-156: the page's own stylesheet, for the tests that measure the drawing (openPage's `styled`)
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
      // CORE-156: Windows holds the profile for a moment after the kill (EPERM); a throw here used to skip closing the servers, and the file never exited.
      // The folder is this run's own mkdtemp: retried, and a leftover temp folder is not a failed test.
      try { rmSync(profile, { recursive: true, force: true, maxRetries: 20, retryDelay: 150 }); } catch { /* left in the temp dir */ }
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
  // CORE-156: a visitor is really signed out. The pages of one run share a browser profile, so a token an earlier signed-in page left for this origin is removed.
  else await S("Page.addScriptToEvaluateOnNewDocument", { source: `try { localStorage.removeItem("pm.oauth.token"); } catch (e) { /* about:blank has none */ } window.__pwned = 0;` });
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
  // CORE-156: `tick` is the reader's OWN say (pm:spoke), and a reply that lands on that paint is shown at once. `poll` is an ordinary ask of the list (the
  // page's hashchange path, the same tick the 7 s timer makes), with nobody having spoken: new replies wait behind "N new".
  let polls = 0;
  const poll = () => evalJs(`history.replaceState(null, "", "#poll-${++polls}"); window.dispatchEvent(new HashChangeEvent("hashchange")); true`);
  // the harness page carries no stylesheet; a test that measures what is DRAWN (a message uncut, a row inside its pane) adds the page's own, read out of the source
  const styled = () => evalJs(`(() => { const s = document.createElement("style"); s.textContent = ${JSON.stringify(STYLE)}; document.head.appendChild(s); document.body.style.margin = "0"; return true; })()`);
  return { evalJs, until, calls, tick, poll, styled, close: async () => { b.listeners.splice(b.listeners.indexOf(listener), 1); await b.send("Target.closeTarget", { targetId }).catch(() => {}); } };
}

// ── the invented office (the CORE-70 worked example; INVENTED speech) ──────────────────────────────────────────────────────

const ROOM = "t1794686460000-pica";
const ROOM_B = "t1794690000000-noe";
const FLAT = FX.views.flat_lines;                                   // 14 says, 7 speakers
// a thread's `voices` as the office serves them since POS-1035 (office src/circles.mjs `sayLine`): the flat line, plus each line's own `id`, the `reply_to` it
// answers and its top `circle`. (Until CORE-156 this helper dropped `reply_to` and `circle`: the page did not read them then; it draws the room from them now.)
const voicesOf = (lines = FLAT) => lines.map((l) => ({ handle: l.handle, standing: l.standing, said: l.said, at: l.at, at_ms: l.at_ms, x: l.x ?? 0, y: l.y ?? 0, ...(l.id ? { id: l.id } : {}), ...(l.reply_to ? { reply_to: l.reply_to } : {}), ...(l.circle ? { circle: l.circle } : {}) }));
// CORE-161: where a walker stands, in the shape the office serves `GET /world/walkers` (office src/world.mjs worldWalkers); `state.walkers` is what the
// invented office answers (unset: 404, so the page cannot tell where anyone stands); `state.me` is who is signed in (unset: one resident, claran)
const walker = (handle, x, y, over = {}) => ({ handle, x, y, source: "walk", moving: false, toward: null, remaining_m: 0, eta_crossings: 0, mark_id: null, standing: "resident", ...over });
const walkerAsks = (p) => p.calls.filter((c) => c.path === "/world/walkers").length;
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
      if (state.circleSays) page.find.circle_read.says = state.circleSays;      // CORE-156: the office's own count of the circle, when a test lets it grow
      // CORE-117: `echoCircle` makes the invented office answer a DIFFERENT circle id as itself (same invented lines), so a reader that navigates to another circle
      // in the one view reads what it asked for, not a page that names circle 50101
      if (state.echoCircle) { const id = Number(m[1]); page.find.circle = id; page.find.circle_read.circle = id; page.find.circle_read.path = [id]; }
      return { status: m[2] ? 200 : 200, body: page };
    }
    if (path === "/world/conversations") return { status: 200, body: conversations(state.live, state.closed ?? []) };
    if (path === "/me") return { status: 200, body: state.me ?? { handles: ["claran"], household: "test-house", households: { claran: { slug: "test-house" } } } };
    if (path === "/world/walkers") return state.walkers ? { status: 200, body: { at: 1, walkers: state.walkers } } : { status: 404, body: { error: "bounce", code: 404 } };
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
// CORE-156: a card's room is drawn by the page itself. These read it the way a visitor does.
const ROOM_SHOWN = `(() => { const c = ${CARD}; const l = c && c.querySelector(".c-voices"); return !!l && l.querySelectorAll(".c-voice").length > 0; })()`;
const ROWS = `[...${CARD}.querySelectorAll(".c-voices .c-voice")]`;
const SAYS = `${ROWS}.map((r) => Number(r.dataset.say))`;
const FOLD = (id) => `${CARD}.querySelector('button.c-fold[data-fold="s${id}"]')`;      // the replies button (the circle on an open circle's line folds too: RING)
const RING = (id) => `${CARD}.querySelector('ol.c-kids[data-circle] .c-ring[data-fold="s${id}"]')`;
const press = (p, js) => p.evalJs(`(${js}).click(); true`);
const findReads = (p) => p.calls.map((c) => c.path).filter((x) => /[?&](room|circle)=/.test(x));      // every read that names a room or a circle
// the fixture room, as the office served it: who answers whom, and how deep each say sits
const SERVED = Object.fromEntries(FLAT.map((l) => [l.id, l.reply_to ?? null]));
const depthOf = (id, served = SERVED) => { let d = 0; for (let at = served[id]; at !== null && at !== undefined; at = served[at]) d += 1; return d; };
const topCircleOf = (id) => { let at = id; while (SERVED[at] !== null && SERVED[at] !== undefined) at = SERVED[at]; return at; };
const OPENERS = FLAT.filter((l) => !l.reply_to).map((l) => l.id);                       // 50101, 50107, 50114
const under = (top) => FLAT.filter((l) => l.id !== top && topCircleOf(l.id) === top).map((l) => l.id);
// what the page drew: for every reply on screen, the message its list hangs under, and how many lists deep it sits
const DRAWN = `Object.fromEntries(${ROWS}.filter((r) => r.parentElement.matches("ol.c-kids")).map((r) => { const wrap = r.parentElement.parentElement; let d = 0; for (let n = r.parentElement; n && n.matches && !n.matches(".c-voices"); n = n.parentElement) if (n.matches("ol.c-kids")) d += 1; return [r.dataset.say, { under: wrap.previousElementSibling?.dataset.say ?? null, deep: d }]; }))`;

// ── READING A ROOM (CORE-156): Emily's words and Darko's pick ──────────────────────────────────────────────────────────────
//
// Emily, a Core Team human, 2026-11-22: "I see at most one unfinished line of everyone's chat. When I click on open … it goes to a whole new screen just to
// read the original message … I have to click on "view replies" for every level of reply to read them." and "clicking on "1 New" item in a circle doesn't
// actually open the reply." Darko, 17:38 EST: "Let's keep the circles and replies in, but try to keep the individual messages displayed similarly"; 17:47 EST,
// of the three versions: "Let's go with B". B, in the mock-up's own words: "Every opening message in full. Its replies wait behind one button, and that
// button opens the whole circle in place, every level at once."

test("B · WHOLE: an opening message is drawn WHOLE (every word to its last, its line breaks kept, nothing clipped at phone width), as face and name, the words, the time; a hostile line is text", async () => {
  const { b, base } = await boot(false);                 // the reader withheld on purpose: reading a room needs no reader at all
  // real-shaped: the say's own limit is 500 characters (the office's text_max), so this is as long as an opening message gets
  const LONG = `${"This opening message runs long, and every word of it has to be on the page. ".repeat(5).trim()}\nA second paragraph, after a line break, <b>bold</b> & <img src=x onerror="window.__pwned=1">, down to THE-LAST-WORD`;
  assert.ok(LONG.length > 400 && LONG.length <= 500, `a real-shaped long say (${LONG.length} characters)`);
  const state = { live: [thread({ voices: voicesOf().map((v) => (v.id === 50101 ? { ...v, said: LONG } : v)) })] };
  const p = await openPage(b, base, { office: makeOffice(state), width: 390, height: 844 });
  try {
    await p.until(ROOM_SHOWN, "the room");
    await p.styled();
    const row = `${CARD}.querySelector('.c-voice[data-say="50101"]')`;
    // LAW (Darko, 2026-11-22, B): "Every opening message in full."
    assert.equal(await p.evalJs(`${row}.querySelector(".c-said").textContent`), LONG, "B: \"Every opening message in full\": the words on the page are the words served, all of them (not the 80-character opener, no ellipsis)");
    assert.equal(await p.evalJs(`${row}.querySelector(".c-said").textContent.length`), LONG.length, "and it is NOT a cut of them");
    const drawn = await p.evalJs(`(() => {
      const said = ${row}.querySelector(".c-said"), cs = getComputedStyle(said), box = said.getBoundingClientRect();
      const text = said.firstChild, last = document.createRange(); last.setStart(text, text.length - 1); last.setEnd(text, text.length);
      const lr = last.getBoundingClientRect();
      return { whiteSpace: cs.whiteSpace, textOverflow: cs.textOverflow, clamp: cs.webkitLineClamp, overflow: cs.overflow, lines: Math.round(box.height / parseFloat(cs.lineHeight)),
        lastInside: lr.height > 0 && lr.bottom <= box.bottom + 1 && lr.right <= box.right + 1, wider: said.scrollWidth > said.clientWidth + 1, taller: said.scrollHeight > said.clientHeight + 1,
        pageWide: document.documentElement.scrollWidth > window.innerWidth + 1 };
    })()`);
    assert.equal(drawn.whiteSpace, "pre-wrap", "wrapped, its own line breaks kept (never one line)");
    assert.equal(drawn.textOverflow, "clip", "no ellipsis rule on the words");
    assert.equal(drawn.clamp, "none", "no line clamp on the words");
    assert.ok(drawn.lines >= 8, `the message takes the lines it needs at phone width (${drawn.lines}), not one`);
    assert.equal(drawn.lastInside, true, "its LAST word is laid out inside the message's own box");
    assert.deepEqual([drawn.wider, drawn.taller, drawn.pageWide], [false, false, false], "nothing of it is clipped, and the page does not scroll sideways on a phone");
    // drawn the way this page always drew a line: face and name, the words, the time
    const parts = await p.evalJs(`(() => { const r = ${row}; return { cls: r.className, who: r.querySelector(".c-voice-who .c-who")?.textContent, face: !!r.querySelector(".c-voice-who .c-face"), time: r.querySelector("time.c-ago")?.textContent, iso: r.querySelector("time.c-ago")?.getAttribute("datetime"), order: [...r.children].slice(0, 3).map((e) => e.className.split(" ")[0]) }; })()`);
    assert.deepEqual(parts, { cls: "c-voice", who: "pica", face: true, time: "20:01Z", iso: "2026-11-14T20:01:00.000Z", order: ["c-voice-who", "c-said", "c-ago"] }, "the old row: who, what they said, when");
    // every opening message is there, in the order they were said, and none of them is a reader's one-line stub
    assert.deepEqual(await p.evalJs(SAYS), OPENERS, "the room's opening messages, in the order they started");
    assert.equal(await p.evalJs(`${CARD}.querySelector("[data-circle-reader]")`), null, "no circle reader in the card, and none needed");
    assert.equal(await p.evalJs(`${CARD}.querySelectorAll("[data-circles-note], [data-room-earlier]").length`), 0, "and no note: nothing is missing");
    // speech is the most user-authored text on the site: it is text, never markup
    assert.equal(await p.evalJs(`${CARD}.querySelectorAll(".c-said b, .c-said img").length`), 0, "no element was made from a say");
    assert.equal(await p.evalJs(`window.__pwned`), 0, "and nothing ran");
  } finally { await p.close(); }
});

test("B · COUNT: the one button under a message says how many replies its WHOLE circle holds (every level), and a message with no replies has no button", async () => {
  const { b, base } = await boot(false);
  const p = await openPage(b, base, { office: makeOffice({ live: [thread()] }) });
  try {
    await p.until(ROOM_SHOWN, "the room");
    // derived from the served lines, never hand-copied: everything under each opener, however deep
    const want = Object.fromEntries(OPENERS.map((id) => [id, under(id).length]));
    assert.deepEqual(want, { 50101: 9, 50107: 2, 50114: 0 }, "control: the fixture's circles are 9, 2 and 0 replies deep");
    const direct = FLAT.filter((l) => l.reply_to === 50101).length;
    assert.equal(direct, 3, "control: only 3 of the 9 answer the opener directly, so a count of direct replies would read 3");
    assert.deepEqual(await p.evalJs(`Object.fromEntries([...${CARD}.querySelectorAll("[data-fold]")].map((f) => [f.dataset.fold, f.textContent]))`), { s50101: "9 replies", s50107: "2 replies" },
      "B: \"Its replies wait behind one button\": the count is the whole circle, every level, and it is NOT the 3 direct replies; the message with none has no button");
    assert.equal(await p.evalJs(`${CARD}.querySelectorAll('[data-fold="s50114"]').length`), 0, "no button under a message nobody answered");
    // each button sits directly under its own message, and starts folded
    assert.deepEqual(await p.evalJs(`[...${CARD}.querySelectorAll("[data-fold]")].map((f) => [f.closest("li").previousElementSibling.dataset.say, f.getAttribute("aria-expanded")])`), [["50101", "false"], ["50107", "false"]]);
    // one reply reads "1 reply"
    const one = await openPage(b, base, { office: makeOffice({ live: [thread({ voices: voicesOf().filter((v) => [50107, 50108].includes(v.id)), voice_count: 2 })] }) });
    try {
      await one.until(ROOM_SHOWN, "the room");
      assert.equal(await one.evalJs(`${FOLD(50107)}.textContent`), "1 reply");
    } finally { await one.close(); }
  } finally { await p.close(); }
});

test("B · OPEN AND FOLD: ONE press opens the whole circle in place, every level at once, each reply whole and under the message it answers; a second press folds it; the office is asked nothing", async () => {
  const { b, base } = await boot(true);
  const state = { live: [thread()], room: (id) => roomFind(id) };
  const p = await openPage(b, base, { office: makeOffice(state) });
  try {
    await p.until(ROOM_SHOWN, "the room");
    assert.deepEqual(await p.evalJs(SAYS), OPENERS, "folded: the opening messages only");
    const callsBefore = p.calls.length;
    await press(p, FOLD(50101));                         // ONE press
    const circle = under(50101);
    assert.deepEqual((await p.evalJs(SAYS)).sort(), [...OPENERS, ...circle].sort(), "B: \"that button opens the whole circle in place, every level at once\": all 9 replies after one press, and the other circle still folded");
    assert.equal(await p.evalJs(`location.hash`), "", "in place: the reader is still in the room, not in another view");
    assert.equal(await p.evalJs(`!!document.querySelector("[data-selected-card]")`), false);
    // each reply sits under the message the office served it as a reply to, as deep as its ancestry
    const drawn = await p.evalJs(DRAWN);
    for (const id of circle) {
      assert.equal(Number(drawn[id]?.under), SERVED[id], `say ${id} is drawn under say ${SERVED[id]}, the one it answers (the served reply_to)`);
      assert.equal(drawn[id].deep, depthOf(id), `say ${id} sits ${depthOf(id)} level(s) in`);
    }
    assert.equal(Math.max(...circle.map((id) => drawn[id].deep)), 4, "every level: the deepest reply of this circle is four levels in, and it is on the page");
    // each reply whole
    const words = await p.evalJs(`Object.fromEntries(${ROWS}.map((r) => [r.dataset.say, r.querySelector(".c-said").textContent]))`);
    for (const l of FLAT.filter((x) => circle.includes(x.id))) assert.equal(words[l.id], l.said, `reply ${l.id} is whole`);
    assert.equal(await p.evalJs(`${FOLD(50101)}.getAttribute("aria-expanded")`), "true");
    assert.equal(await p.evalJs(`!!document.getElementById(${FOLD(50101)}.getAttribute("aria-controls"))`), true, "the button names the list it opened");
    assert.equal(await p.evalJs(`${CARD}.querySelectorAll("button.c-fold[data-fold]").length`), 2, "one button per circle: no reply inside the circle has a fold of its own");
    assert.equal(await p.evalJs(`${CARD}.querySelectorAll("[data-thread-view], [data-thread-dot]").length`), 0, "no per-level 'View replies'");
    // THE CIRCLE ON THE LINE (Darko, 2026-11-22 19:02 EST: "have the circle design of the expandable replies reincorporated in"): the open circle's own
    // line carries one small circle, at its midpoint, as the World's reader drew it; the levels inside carry none (they open and fold with the circle)
    await p.styled();
    assert.equal(await p.evalJs(`${CARD}.querySelectorAll("ol.c-kids[data-circle] .c-ring").length`), 1, "the open circle's line carries its circle");
    const ring = await p.evalJs(`(() => {
      const list = document.getElementById(${FOLD(50101)}.getAttribute("aria-controls")), r = ${RING(50101)}, line = list.querySelector(".c-ring-line");
      const lb = list.getBoundingClientRect(), rb = r.getBoundingClientRect(), cs = getComputedStyle(r), pill = getComputedStyle(${FOLD(50107)}, "::before");
      return { rings: ${CARD}.querySelectorAll(".c-ring").length, lines: ${CARD}.querySelectorAll(".c-ring-line").length, onOpenCircle: r.closest("ol") === list, round: cs.borderRadius, square: Math.abs(rb.width - rb.height) < 1 && rb.width >= 12,
        midway: Math.abs((rb.top + rb.height / 2) - (lb.top + lb.height / 2)) <= 2, atTheLeft: rb.left >= lb.left - 1 && rb.right <= list.querySelector(".c-voice").getBoundingClientRect().left + 1,
        lineFull: Math.abs(line.getBoundingClientRect().height - lb.height) <= 1, hidden: r.closest("li").getAttribute("aria-hidden"), tab: [r.tabIndex, line.tabIndex], pillRing: [pill.content !== "none", pill.borderRadius] };
    })()`);
    assert.deepEqual(ring, { rings: 1, lines: 1, onOpenCircle: true, round: "50%", square: true, midway: true, atTheLeft: true, lineFull: true, hidden: "true", tab: [-1, -1], pillRing: [true, "50%"] },
      "one circle on the open circle's line: round, at the line's midpoint, left of the replies; the line runs the circle's whole height; both are a pointer's convenience (the button is the control); and the folded button wears a small circle too");
    // pressing the circle folds the WHOLE circle, as the button does; so does pressing the line
    await press(p, RING(50101));
    assert.deepEqual(await p.evalJs(SAYS), OPENERS, "the circle on the line folds the whole circle");
    assert.equal(await p.evalJs(`${CARD}.querySelectorAll(".c-ring, .c-ring-line").length`), 0, "a folded circle has no line");
    await press(p, FOLD(50101));
    await press(p, `${CARD}.querySelector('ol.c-kids[data-circle] .c-ring-line')`);
    assert.deepEqual(await p.evalJs(SAYS), OPENERS, "and so does its line");
    await press(p, FOLD(50101));
    // a second press folds it
    await press(p, FOLD(50101));
    assert.deepEqual(await p.evalJs(SAYS), OPENERS, "a second press folds the circle again");
    assert.equal(await p.evalJs(`${FOLD(50101)}.getAttribute("aria-expanded")`), "false");
    // and again, to the same whole circle; then both circles open at once
    await press(p, FOLD(50101)); await press(p, FOLD(50107));
    assert.equal(await p.evalJs(`${ROWS}.length`), FLAT.length, "both circles open: every statement of the room is on the page");
    // THE OFFICE WAS ASKED NOTHING for any of it: the room's own read carried every line
    await new Promise((ok) => setTimeout(ok, 300));
    assert.deepEqual(findReads(p), [], "no ?room= and no ?circle= read: opening a circle costs no read");
    assert.deepEqual([...new Set(p.calls.slice(callsBefore).map((c) => c.path))].filter((x) => !x.startsWith("/world/conversations?closed=")), [], "nothing but the page's ordinary list poll was asked while pressing");
  } finally { await p.close(); }
});

test("B · N NEW: a reply that lands in a folded circle is counted and offered as '1 new' on that circle; pressing it opens the circle with the new reply ON SCREEN, marked; an open circle takes a new reply at once", async () => {
  const { b, base } = await boot(true);
  const state = { live: [thread()], room: (id) => roomFind(id) };
  const p = await openPage(b, base, { office: makeOffice(state), width: 390, height: 844 });
  try {
    await p.until(ROOM_SHOWN, "the room");
    await p.styled();
    assert.equal(await p.evalJs(`${CARD}.querySelectorAll("[data-new]").length`), 0, "what the reader arrived to is not 'new'");
    // a reply to the LAST line of pica's circle (50113), three levels down, lands while the circle is folded
    const fresh = { handle: "seth", standing: "resident", said: "An invented new reply, deep in the circle.", at: "2026-11-14T20:20:00.000Z", at_ms: 1794687600000, id: 50120, reply_to: 50113, circle: 50101 };
    state.live = [thread({ voice_count: 15, latest: fresh.at, voices: [...voicesOf(), fresh] })];
    await p.poll();
    await p.until(`!!${CARD}.querySelector('[data-new="s50101"]')`, "the circle offers what is new");
    assert.equal(await p.evalJs(`${CARD}.querySelector('[data-new="s50101"]').textContent`), "1 new");
    assert.equal(await p.evalJs(`${FOLD(50101)}.textContent`), "10 replies", "and the count is the whole circle, the new reply included");
    assert.equal(await p.evalJs(`${CARD}.querySelectorAll('[data-new]').length`), 1, "only the circle that got the reply says so");
    assert.equal(await p.evalJs(`!!${CARD}.querySelector('.c-voice[data-say="50120"]')`), false, "before the press the new reply is not on the page (its circle is folded)");
    const before = p.calls.length;
    await press(p, `${CARD}.querySelector('[data-new="s50101"]')`);
    // Emily: "clicking on "1 New" item in a circle doesn't actually open the reply." Now it does.
    const seen = await p.evalJs(`(() => {
      const row = ${CARD}.querySelector('.c-voice[data-say="50120"]'); if (!row) return null;
      const pane = ${CARD}.querySelector(".c-voices").getBoundingClientRect(), r = row.getBoundingClientRect();
      return { said: row.querySelector(".c-said").textContent, isNew: row.classList.contains("is-new"), inPane: r.top >= pane.top - 1 && r.bottom <= pane.bottom + 1, inWindow: r.top >= -1 && r.bottom <= window.innerHeight + 1, edges: [Math.round(r.top), Math.round(r.bottom), window.innerHeight],
        under: row.parentElement.parentElement.previousElementSibling.dataset.say, open: ${FOLD(50101)}.getAttribute("aria-expanded"), chip: ${CARD}.querySelectorAll("[data-new]").length, scrolled: ${CARD}.querySelector(".c-voices").scrollTop };
    })()`);
    assert.ok(seen, "after the press the new reply IS on the page");
    assert.equal(seen.said, fresh.said, "whole");
    assert.equal(seen.under, "50113", "under the message it answers");
    assert.equal(seen.open, "true", "its circle is open, in place");
    assert.equal(seen.isNew, true, "marked as new");
    assert.deepEqual([seen.inPane, seen.inWindow], [true, true], `and it is ON SCREEN: inside its pane and inside the window, not merely in the page (its top and bottom sit at ${seen.edges?.[0]} and ${seen.edges?.[1]} of a ${seen.edges?.[2]}px window; a pixel of rounding is allowed, as for the pane)`);
    assert.ok(seen.scrolled > 0, `control: it sat below the pane's first screen (the pane moved ${seen.scrolled}px to show it), so 'on screen' is the press's doing`);
    assert.equal(seen.chip, 0, "the offer is spent");
    assert.equal(await p.evalJs(`${ROWS}.filter((r) => r.classList.contains("is-new")).length`), 1, "only the new reply is marked");
    assert.deepEqual(findReads(p), [], "and the press asked the office nothing");
    assert.deepEqual([...new Set(p.calls.slice(before).map((c) => c.path))].filter((x) => !x.startsWith("/world/conversations?closed=")), []);
    // the circle is OPEN now: the next reply to it is shown at once, marked, with no offer to press
    const next = { handle: "pica", standing: "resident", said: "An invented answer to it.", at: "2026-11-14T20:21:00.000Z", at_ms: 1794687660000, id: 50121, reply_to: 50120, circle: 50101 };
    state.live = [thread({ voice_count: 16, latest: next.at, voices: [...voicesOf(), fresh, next] })];
    await p.poll();
    await p.until(`!!${CARD}.querySelector('.c-voice[data-say="50121"]')`, "an open circle takes its new reply at once");
    assert.equal(await p.evalJs(`${CARD}.querySelector('.c-voice[data-say="50121"]').classList.contains("is-new")`), true);
    assert.equal(await p.evalJs(`${CARD}.querySelectorAll("[data-new]").length`), 0, "nothing to press: it is already shown");
    // a NEW OPENING message is simply shown, in its place at the end, as this page always showed new talk
    const opener = { handle: "noe", standing: "resident", said: "An invented new opening message.", at: "2026-11-14T20:22:00.000Z", at_ms: 1794687720000, id: 50122, circle: 50122 };
    state.live = [thread({ voice_count: 17, latest: opener.at, voices: [...voicesOf(), fresh, next, opener] })];
    await p.poll();
    await p.until(`!!${CARD}.querySelector('.c-voice[data-say="50122"]')`, "a new opening message is shown at once");
    assert.equal(await p.evalJs(`${CARD}.querySelector(".c-voices").lastElementChild.dataset.say`), "50122", "last, where it was said");
    // folding spends the marks
    await press(p, FOLD(50101)); await press(p, FOLD(50101));
    assert.equal(await p.evalJs(`${ROWS}.filter((r) => r.classList.contains("is-new")).length`), 0, "a circle folded and opened again shows nothing as new");
  } finally { await p.close(); }
});

test("B · READS: a page of rooms asks the office for the LIST and nothing else: no read per room on load, and none for opening or folding any circle (until CORE-156 every card read its own ?room=); Open is another view, and is the one ask the control at the end sees", async () => {
  const { b, base } = await boot(true);                  // the reader IS available here, and the office WOULD answer ?room= and ?circle=: the page simply does not ask
  const second = thread({ id: ROOM_B, place: "The Quay", at: { x: 5, y: 5 } });
  const closed = [thread({ id: "t1794600000000-old", live: false, place: "An Earlier Room" }), thread({ id: "t1794500000000-older", live: false, place: "An Older Room" })];
  const state = { live: [thread(), second], closed, room: (id) => roomFind(id) };
  const p = await openPage(b, base, { office: makeOffice(state) });
  try {
    await p.until(`document.querySelectorAll(".c-thread .c-voices .c-voice").length >= 12`, "four rooms, drawn");
    await new Promise((ok) => setTimeout(ok, 1200));     // long enough for any read a card would make on load (the old page mounted live cards at once)
    assert.deepEqual(findReads(p), [], "on load: not one ?room= or ?circle= read (four rooms on the page)");
    assert.deepEqual([...new Set(p.calls.map((c) => c.path))], ["/world/conversations?closed=40"], "the office was asked for the list, and only the list");
    // every circle of every room, opened, folded and opened again
    const pressed = await p.evalJs(`(() => { let n = 0; for (let round = 0; round < 3; round++) for (const [room, fold] of [...document.querySelectorAll(".c-thread button.c-fold[data-fold]")].map((f) => [f.closest(".c-thread").dataset.thread, f.dataset.fold])) { document.querySelector('.c-thread[data-thread="' + room + '"] [data-fold="' + fold + '"]').click(); n++; } return n; })()`);
    assert.equal(pressed, 24, "control: 8 circles (2 in each of 4 rooms) were each pressed three times");
    assert.equal(await p.evalJs(`document.querySelectorAll(".c-thread .c-voices .c-voice").length`), 4 * FLAT.length, "and every statement of all four rooms is on the page");
    await new Promise((ok) => setTimeout(ok, 500));
    assert.deepEqual(findReads(p), [], "at most one read per circle press was allowed; a press costs NONE");
    assert.deepEqual([...new Set(p.calls.map((c) => c.path))], ["/world/conversations?closed=40"], "still only the list");
    // CONTROL: this instrument does see such a read when one is made (a #circle- link is the one-circle view, which asks the office about that circle).
    // (Until CORE-161 this pressed a message's own "Open"; a message has none now, and the links other pages hold still arrive this way.)
    await p.evalJs(`location.hash = "#circle-50101"; true`);
    for (const t0 = Date.now(); Date.now() - t0 < 5000 && !findReads(p).length;) await new Promise((ok) => setTimeout(ok, 80));
    assert.ok(findReads(p).includes("/world/conversations?circle=50101"), "control: a ?circle= read is recorded when the page makes one");
  } finally { await p.close(); }
});

// ── REPLYING AND OPENING (CORE-161): Darko's words after using the page ────────────────────────────────────────────────────
//
// Darko, 2026-11-22: "How do we know which resident is actually near enough to even be able to reply?" (20:10 EST) · "fake reply buttons that lead
// nowhere, as well as the actual speaking, typing box being at the top of the page and forcing you to like keep scrolling up and down in order to
// actually reply and read things" (20:14 EST) · "there's an open line next to every reply button … really all we need is to just be able to open each
// main room conversation" (20:15 EST) · "it's just so hard to tell which of your residents are even present in which of like the rooms or
// conversations" (20:17 EST). The office's rule the page follows (office src/circles.mjs resolveReplyTo): "`roomVoices` is the room the speaker is
// speaking into … a say outside it is refused, never linked".
//
// (Until 2026-11-22 a test here, "B · REPLY AND OPEN stay", asserted Reply on EVERY message for any signed-in reader, the top box as the place a reply
// was typed, and an "Open" link on each opening message. CORE-161 retires all three; the three tests below hold what replaced them.)

// a household of three, and four rooms: A where claran stands, B (5 km east) where amia stands, C (9 km east) where nobody of the house is, and a
// GONE-QUIET room on the very spot claran stands; liv is placed, far from every conversation; pica is somebody else's resident, standing in A
const HOUSE = { handles: ["claran", "amia", "liv"], household: "test-house", households: { claran: { slug: "test-house" } } };
const ROOM_C = "t1794700000000-far";
const ROOM_OLD = "t1794600000000-old";
const eastOf = (dx) => voicesOf().map((v) => ({ ...v, x: v.x + dx }));
const fourRooms = () => ({
  live: [thread(), thread({ id: ROOM_B, place: "The Quay", at: { x: 5000, y: 0 }, voices: eastOf(5000) }), thread({ id: ROOM_C, place: "Far Field", at: { x: 9000, y: 0 }, voices: eastOf(9000) })],
  closed: [thread({ id: ROOM_OLD, live: false, place: "An Earlier Room" })],
});
const STANDING = () => [walker("claran", 30, 40), walker("amia", 5010, 0), walker("liv", 20000, 0), walker("pica", 0, 0)];
const cardOf = (id) => `document.querySelector('[data-thread="${id}"]')`;
const repliesIn = (id) => `${cardOf(id)}.querySelectorAll("[data-reply]").length`;
const hereLine = (id) => `(() => { const l = ${cardOf(id)}.querySelector("[data-mine-here]"); if (!l) return null; const c = l.cloneNode(true); c.querySelectorAll(".c-face").forEach((f) => f.remove()); return c.textContent.replace(/\\s+/g, " ").trim(); })()`;
const RB = `document.querySelector("[data-rb]")`;
const rbOptions = `[...document.querySelectorAll("[data-rb] [data-rb-as] option")].map((o) => o.value)`;

test("REPLY ONLY WHERE IT CAN WORK: Reply is on the messages of a live room one of the household's residents can hear, and nowhere else; each live card says who of the house is there, or that none is; one line at the top names their rooms; where they stand is asked ONCE per load and once per reply box, never by a poll", async () => {
  const { b, base } = await boot(false);
  const state = { ...fourRooms(), me: HOUSE, walkers: STANDING() };
  const p = await openPage(b, base, { office: makeOffice(state), signedIn: true });
  const MINE = `document.querySelector("[data-mine]")`;
  const answeredPoll = async (change) => {
    const before = p.calls.filter((c) => c.path.startsWith("/world/conversations?closed=")).length;
    if (change) change();
    await p.poll();
    for (const t0 = Date.now(); Date.now() - t0 < 9000 && p.calls.filter((c) => c.path.startsWith("/world/conversations?closed=")).length === before;) await new Promise((ok) => setTimeout(ok, 60));
    await new Promise((ok) => setTimeout(ok, 400));
  };
  try {
    await p.until(`!!${MINE} && !${MINE}.hidden`, "the page knows where the household's residents are");
    // CONTROL: every one of the four rooms is drawn, with the same fourteen invented lines (three opening messages each)
    assert.deepEqual(await p.evalJs(`[${cardOf(ROOM)}, ${cardOf(ROOM_B)}, ${cardOf(ROOM_C)}, ${cardOf(ROOM_OLD)}].map((c) => c.querySelectorAll(".c-voices > .c-voice").length)`), [3, 3, 3, 3]);
    // Reply only where it can work
    assert.deepEqual(await p.evalJs(`[${repliesIn(ROOM)}, ${repliesIn(ROOM_B)}, ${repliesIn(ROOM_C)}, ${repliesIn(ROOM_OLD)}]`), [3, 3, 0, 0],
      "Reply on the rooms claran and amia can hear; NONE on the live room nobody of the house is near, and none on a room that has gone quiet (the office refuses a reply into either)");
    // each live card says who of the house is there
    assert.equal(await p.evalJs(hereLine(ROOM)), "Your resident here: claran", "the card says which of your residents can hear it (pica stands there too, and is not yours)");
    assert.equal(await p.evalJs(hereLine(ROOM_B)), "Your resident here: amia");
    assert.equal(await p.evalJs(hereLine(ROOM_C)), "None of your residents is near this conversation, so there is no Reply here.", "one plain line where none is near");
    assert.equal(await p.evalJs(hereLine(ROOM_OLD)), "This conversation has ended, so it can't be answered.", "a gone-quiet room has no Reply and says why, in one plain line (claran stands on its very spot: it is still ended)");
    assert.equal(await p.evalJs(`${cardOf(ROOM)}.querySelector("[data-mine-here] .c-person .c-face") !== null`), true, "with the page's usual face beside the name");
    // one line at the top names their rooms, and who is near none
    assert.equal(await p.evalJs(`${MINE}.textContent`), "Your residents are in: Cave Interior (claran) · The Quay (amia). Not near a conversation: liv.");
    await p.evalJs(`window.__y = window.scrollY; ${MINE}.querySelector('[data-mine-room="${ROOM_B}"]').click(); true`);
    assert.equal(await p.evalJs(`${cardOf(ROOM_B)}.classList.contains("is-anchored")`), true, "a room's name there jumps to its card");
    // the reply box lists ONLY the voices that can hear that conversation
    await press(p, FOLD(50101));
    assert.equal(await p.evalJs(repliesIn(ROOM)), 12, "Reply on every message of the open circle too (replies at every level)");
    assert.equal(walkerAsks(p), 1, "where they stand was asked ONCE on load");
    await press(p, `${cardOf(ROOM)}.querySelector('[data-reply="50105"]')`);
    await p.until(`!!${RB}`, "the reply box");
    assert.deepEqual(await p.evalJs(rbOptions), ["claran", "__human__"], "claran, and the house's human (who will stand beside claran): not amia or liv, who cannot hear it");
    // the human stands beside a housemate who can hear, and the box says so in plain words (Wright, 2026-11-22 20:24 EST: "say so in the box")
    const beside = (pg) => pg.evalJs(`(() => { const box = ${RB}, as = box.querySelector("[data-rb-as]"); as.value = "__human__"; as.dispatchEvent(new Event("change", { bubbles: true }));
      const row = box.querySelector("[data-rb-beside-row]"), pick = box.querySelector("[data-rb-beside]");
      return { shown: !row.hidden, words: box.querySelector("[data-rb-beside-words]").textContent, choose: pick.hidden ? null : [...pick.options].map((o) => o.value), beside: pick.value }; })()`);
    assert.deepEqual(await beside(p), { shown: true, words: "You'll speak beside claran.", choose: null, beside: "claran" }, "one housemate can hear: named, nothing to choose (never amia or liv, whom the office might otherwise pick)");
    await p.evalJs(`(() => { const as = ${RB}.querySelector("[data-rb-as]"); as.value = "claran"; as.dispatchEvent(new Event("change", { bubbles: true })); return ${RB}.querySelector("[data-rb-beside-row]").hidden; })()`);
    for (const t0 = Date.now(); Date.now() - t0 < 5000 && walkerAsks(p) < 2;) await new Promise((ok) => setTimeout(ok, 60));
    assert.equal(walkerAsks(p), 2, "and once more when the reader opened a reply box");
    // three answered polls, the rooms moving: NOT ONE more ask of where anyone stands
    await answeredPoll();
    await answeredPoll(() => { state.live = [thread({ voice_count: 15, latest: "2026-11-14T20:16:00.000Z" }), ...state.live.slice(1)]; });
    await answeredPoll();
    assert.equal(walkerAsks(p), 2, "three answered polls, moved and unmoved: where they stand is never asked on the timer");
    assert.deepEqual(findReads(p), [], "and nothing here asked ?room= or ?circle=");
    assert.deepEqual([...new Set(p.calls.map((c) => c.method + " " + c.path))].sort(), ["GET /me", "GET /world/conversations?closed=40", "GET /world/walkers"], "every ask this page made: who is signed in, the list, and where they stand");
    // claran walks away to the far field; the page learns it at the next reply box, and both rooms follow
    await p.evalJs(`${RB}.querySelector("[data-rb-text]").value = "a draft, half written"; true`);
    state.walkers = [walker("claran", 9005, 0), walker("amia", 5010, 0), walker("liv", 20000, 0)];
    await press(p, `${cardOf(ROOM)}.querySelector('[data-reply="50101"]')`);
    await p.until(`${repliesIn(ROOM)} === 0`, "the room claran left has no Reply any more");
    assert.equal(await p.evalJs(hereLine(ROOM)), "None of your residents is near this conversation, so there is no Reply here.");
    assert.equal(await p.evalJs(`[${repliesIn(ROOM_C)}, ${hereLine(ROOM_C)}].join(" | ")`), "3 | Your resident here: claran", "and the room they walked to has it");
    assert.deepEqual(await p.evalJs(`[${RB}.querySelector("[data-rb-send]").disabled, /any more/.test(${RB}.querySelector("[data-rb-note]").textContent), ${RB}.querySelector("[data-rb-text]").value]`), [true, true, "a draft, half written"],
      "the box that was open says so kindly, will not send, and keeps the words");
    assert.equal(walkerAsks(p), 3);
  } finally { await p.close(); }
  // THE HOUSE'S HUMAN is offered only where the office's own pick cannot miss: here both placed residents can hear the room
  const both = await openPage(b, base, { office: makeOffice({ live: [thread()], me: { ...HOUSE, handles: ["claran", "amia"] }, walkers: [walker("claran", 3, 4), walker("amia", -20, 0)] }), signedIn: true });
  try {
    await both.until(`${cardOf(ROOM)}?.querySelectorAll("[data-reply]").length === 3`, "Reply");
    assert.equal(await both.evalJs(hereLine(ROOM)), "Your residents here: claran amia");
    await press(both, `${cardOf(ROOM)}.querySelector('[data-reply="50101"]')`);
    assert.deepEqual(await both.evalJs(rbOptions), ["claran", "amia", "__human__"]);
    assert.deepEqual(await both.evalJs(`(() => { const box = ${RB}, as = box.querySelector("[data-rb-as]"); as.value = "__human__"; as.dispatchEvent(new Event("change", { bubbles: true }));
      const pick = box.querySelector("[data-rb-beside]"); return { shown: !box.querySelector("[data-rb-beside-row]").hidden, words: box.querySelector("[data-rb-beside-words]").textContent, choose: pick.hidden ? null : [...pick.options].map((o) => o.value), beside: pick.value }; })()`),
      { shown: true, words: "You'll speak beside", choose: ["claran", "amia"], beside: "claran" }, "two housemates can hear: the reader chooses whom to stand beside, the first by default");
  } finally { await both.close(); }
  // where they stand could not be read: NO Reply anywhere, and the page says so (it does not guess)
  const blind = await openPage(b, base, { office: makeOffice({ ...fourRooms(), me: HOUSE }), signedIn: true });
  try {
    await blind.until(`!!${MINE} && !${MINE}.hidden`, "the page says it could not read where they stand");
    assert.match(await blind.evalJs(`${MINE}.textContent`), /couldn't read where your residents are standing, so it is not offering Reply/);
    assert.equal(await blind.evalJs(`document.querySelectorAll("[data-reply]").length`), 0);
    assert.deepEqual(await blind.evalJs(`[${hereLine(ROOM)}, ${hereLine(ROOM_C)}]`), [null, null], "and no card claims to know who is there");
    assert.equal(walkerAsks(blind), 1, "asked once; a failure is not retried on the timer");
  } finally { await blind.close(); }
  // a reader who is not signed in sees none of it, and nothing is asked for them
  const out = await openPage(b, base, { office: makeOffice({ ...fourRooms(), walkers: STANDING() }), signedIn: false });
  try {
    await out.until(`!!${cardOf(ROOM_C)}`, "the rooms");
    await new Promise((ok) => setTimeout(ok, 900));
    assert.equal(await out.evalJs(`document.querySelectorAll("[data-reply], [data-mine-here], [data-rb]").length`), 0, "no Reply, no line");
    assert.equal(await out.evalJs(`${MINE}.hidden`), true);
    assert.equal(walkerAsks(out), 0, "and where anyone stands was not asked");
  } finally { await out.close(); }
});

test("THE REPLY BOX OPENS WHERE REPLY IS PRESSED: directly under that message, the message still in view, at phone width; one box on the page, which moves with its draft; a poll keeps it; the say carries exactly that message's id; the office's answer shows there; the box at the top is untouched", async () => {
  const { b, base } = await boot(false);
  const state = { live: [thread()], walkers: [walker("claran", 0, 0)] };       // one resident, standing in the room: the house's human can reply too
  const p = await openPage(b, base, { office: makeOffice(state), signedIn: true, width: 390, height: 844 });
  const box = (js) => p.evalJs(`(() => { const box = ${RB}; return ${js}; })()`);
  try {
    await p.until(ROOM_SHOWN, "the room");
    await p.styled();
    await p.until(`${repliesIn(ROOM)} === 3`, "Reply");
    assert.equal(await p.evalJs(`!!${RB}`), false, "no box until Reply is pressed");
    await press(p, FOLD(50101));
    await press(p, `${CARD}.querySelector('[data-reply="50105"]')`);
    assert.deepEqual(await p.evalJs(`[document.querySelectorAll(".c-thread [data-rb]").length, document.querySelector("[data-say-reply]").hidden]`), [1, true], "Reply pressed: a reply box is in the room, and the box at the top of the page was not turned into one");
    const at = await box(`(() => { const row = ${CARD}.querySelector('.c-voice[data-say="50105"]'), r = row.getBoundingClientRect(), x = box.getBoundingClientRect(), pane = ${CARD}.querySelector(".c-voices").getBoundingClientRect();
      return { under: box.previousElementSibling === row, boxes: document.querySelectorAll("[data-rb]").length, to: box.querySelector("[data-rb-to]").textContent, focus: document.activeElement === box.querySelector("[data-rb-text]"),
        messageInView: r.top >= pane.top - 1 && r.bottom <= pane.bottom + 1 && r.top >= 0, boxInView: x.bottom <= Math.min(pane.bottom, window.innerHeight) + 1 && x.top >= 0, fits: x.left >= 0 && x.right <= window.innerWidth && document.documentElement.scrollWidth <= window.innerWidth + 1,
        parts: ["[data-rb-as]", "[data-rb-text]", "[data-rb-send]", "[data-rb-cancel]"].map((s) => !!box.querySelector(s)), count: box.querySelector(".c-say-count").textContent, max: box.querySelector("[data-rb-text]").maxLength }; })()`);
    assert.deepEqual(at, { under: true, boxes: 1, to: "Replying to claran", focus: true, messageInView: true, boxInView: true, fits: true, parts: [true, true, true, true], count: "500 left", max: 500 },
      "the box is directly under the message being answered, that message and the box both on screen at phone width, with its chooser, its count, Reply and Cancel");
    assert.deepEqual(await p.evalJs(rbOptions), ["claran", "__human__"]);
    assert.deepEqual(await p.evalJs(`[document.querySelector("[data-say-reply]").hidden, document.querySelector("[data-say-text]").value, document.activeElement === document.querySelector("[data-say-text]")]`), [true, "", false], "the box at the top of the page is not involved");
    // ONE box: Reply on another message moves the same box, and the draft goes with it
    await p.evalJs(`window.__box = ${RB}; ${RB}.querySelector("[data-rb-text]").value = "my draft"; true`);
    await press(p, `${CARD}.querySelector('[data-reply="50101"]')`);
    assert.deepEqual(await box(`[document.querySelectorAll("[data-rb]").length, box === window.__box, box.previousElementSibling.dataset.say, box.querySelector("[data-rb-text]").value, box.querySelector("[data-rb-to]").textContent]`), [1, true, "50101", "my draft", "Replying to pica"]);
    // a poll that redraws the room (a new opening message) keeps the box: the same node, its draft, its place, the keyboard still in it
    await p.evalJs(`${RB}.querySelector("[data-rb-text]").focus(); ${RB}.querySelector("[data-rb-text]").setSelectionRange(2, 5); true`);
    const opener = { handle: "noe", standing: "resident", said: "An invented new opening message.", at: "2026-11-14T20:22:00.000Z", at_ms: 1794687720000, x: 0, y: 0, id: 50122, circle: 50122 };
    state.live = [thread({ voice_count: 15, latest: opener.at, voices: [...voicesOf(), opener] })];
    await p.poll();
    await p.until(`!!${CARD}.querySelector('.c-voice[data-say="50122"]')`, "the room was redrawn with the new message");
    assert.deepEqual(await box(`[box === window.__box, box.previousElementSibling.dataset.say, box.querySelector("[data-rb-text]").value, document.activeElement === box.querySelector("[data-rb-text]"), box.querySelector("[data-rb-text]").selectionStart + "-" + box.querySelector("[data-rb-text]").selectionEnd]`),
      [true, "50101", "my draft", true, "2-5"], "the redraw kept the box where it was, with the draft, the focus and the selection");
    // the say: exactly the id the office served on that message, as the chosen voice; the town's answer shows IN the box
    await press(p, `${RB}.querySelector("[data-rb-send]")`);
    await p.until(`!${RB}.querySelector("[data-rb-heard]").hidden`, "the town's answer, in the box");
    assert.deepEqual(state.said, [{ handle: "claran", text: "my draft", reply_to: 50101 }], "the say is claran's, with reply_to exactly the id on that message");
    assert.equal(await box(`box.querySelector("[data-rb-heard]").textContent`), "Heard at Cave Interior — one within earshot.");
    assert.deepEqual(await box(`[box.querySelector("[data-rb-text]").value, box.querySelector("[data-rb-bounce]").hidden]`), ["", true]);
    assert.deepEqual(await p.evalJs(`[document.querySelector("[data-say-heard]").hidden, document.querySelector("[data-say-bounce]").hidden]`), [true, true], "nothing was written into the box at the top");
    // as the house's human
    await p.evalJs(`(() => { const box = ${RB}; box.querySelector("[data-rb-as]").value = "__human__"; box.querySelector("[data-rb-text]").value = "and from me"; box.querySelector("[data-rb-send]").click(); return true; })()`);
    for (const t0 = Date.now(); Date.now() - t0 < 5000 && (state.said ?? []).length < 2;) await new Promise((ok) => setTimeout(ok, 60));
    assert.deepEqual(state.said[1], { human: true, with: "claran", text: "and from me", reply_to: 50101 }, "the human's say NAMES the housemate they stand beside (`with:`), one who can hear this conversation: the office is not left to pick one who cannot");
    // the office says no (the speaker walked away since the page looked): its own words, and one kind line; the words are kept
    state.sayAnswer = () => ({ status: 422, body: { spoke: false, error: "bounce", code: 422, defect: "say 50101 is not in the room you are speaking into", hint: "a reply must come from the same room as the say it answers (call 21): walk back within earshot of that conversation" } });
    await p.evalJs(`(() => { const box = ${RB}; box.querySelector("[data-rb-as]").value = "claran"; box.querySelector("[data-rb-text]").value = "too late"; box.querySelector("[data-rb-send]").click(); return true; })()`);
    await p.until(`!${RB}.querySelector("[data-rb-bounce]").hidden`, "the refusal, in the box");
    assert.deepEqual(await box(`[box.querySelector("[data-rb-bounce] b").textContent, /walk back within earshot/.test(box.querySelector("[data-rb-bounce]").textContent), box.querySelector("[data-rb-note]").textContent, box.querySelector("[data-rb-text]").value, box.querySelector("[data-rb-heard]").hidden]`),
      ["say 50101 is not in the room you are speaking into", true, "It looks like claran moved out of earshot of this conversation after this page last looked. Nothing was said, and your words are still in the box.", "too late", true],
      "the office's defect and hint verbatim, one kind line saying what happened, and the words kept");
    // Cancel puts the box away, and the keyboard goes back to the Reply it came from
    await press(p, `${RB}.querySelector("[data-rb-cancel]")`);
    assert.deepEqual(await p.evalJs(`[document.querySelectorAll("[data-rb]").length, document.activeElement?.getAttribute("data-reply")]`), [0, "50101"]);
    // THE DRAFT IS NOT LOST when the message the box sits under leaves the page (Wright, 2026-11-22 21:10 EST: "keep the draft and move it to the top
    // box with a line saying so"). Here the room's read moves on and no longer holds noe's conversation.
    const TOP = `document.querySelector("[data-say-text]")`, MOVED = `document.querySelector("[data-say-moved]")`;
    await press(p, `${CARD}.querySelector('[data-reply="50107"]')`);
    await p.evalJs(`${RB}.querySelector("[data-rb-text]").value = "half a thought about the harbour"; true`);
    assert.deepEqual(await p.evalJs(`[${TOP}.value, !!${MOVED}]`), ["", false], "control: the top box is empty and says nothing yet");
    const without = (circle) => voicesOf().filter((v) => v.circle !== circle);
    const saidBefore = state.said.length;
    state.live = [thread({ voice_count: 11, voices: without(50107) })];
    await p.poll();
    await p.until(`!${CARD}.querySelector('.c-voice[data-say="50107"]')`, "the message being answered is gone from the page");
    assert.deepEqual(await p.evalJs(`[document.querySelectorAll("[data-rb]").length, ${TOP}.value, ${MOVED}.hidden, ${MOVED}.textContent, document.querySelector("[data-say-count]").textContent]`),
      [0, "half a thought about the harbour", false, "The message you were replying to is no longer on this page, so your reply was moved here. It has not been sent, and from this box it would be a new line of talk, not a reply.", "468 left"],
      "the box is gone, and its words are in the top box with a line saying so (and the top box's own count followed)");
    assert.equal(state.said.length, saidBefore, "nothing was sent by the move");
    // the top box already holds words: the reply's draft is NOT poured over them; it stays in the reply box and comes back with the next Reply
    await press(p, `${CARD}.querySelector('[data-reply="50101"]')`);
    await p.evalJs(`${RB}.querySelector("[data-rb-text]").value = "a second draft"; true`);
    state.live = [thread({ voice_count: 1, voices: without(50107).filter((v) => v.circle !== 50101) })];
    await p.poll();
    await p.until(`!${CARD}.querySelector('.c-voice[data-say="50101"]')`, "that message is gone too");
    assert.deepEqual(await p.evalJs(`[document.querySelectorAll("[data-rb]").length, ${TOP}.value, ${MOVED}.textContent]`),
      [0, "half a thought about the harbour", "The message you were replying to is no longer on this page. Your reply is kept: it will be in the reply box the next time you press Reply."], "the top box's own words are untouched, and the line says where the reply is");
    await press(p, `${CARD}.querySelector('[data-reply="50114"]')`);
    assert.equal(await p.evalJs(`${RB}.querySelector("[data-rb-text]").value`), "a second draft", "and there it is");
    assert.deepEqual(findReads(p), [], "and none of it asked ?room= or ?circle=");
  } finally { await p.close(); }
});

test("ONE OPEN PER ROOM, NONE PER MESSAGE: no message has an Open; each room's card has one 'Show only this conversation', which shows that room by itself, whole, from the list the page holds (no ask of its own); the way back, an arriving link, and a room the page does not hold", async () => {
  const { b, base } = await boot(true);
  const state = { live: [thread(), thread({ id: ROOM_B, place: "The Quay" })], closed: [thread({ id: ROOM_OLD, live: false, place: "An Earlier Room" })], room: (id) => roomFind(id) };
  const p = await openPage(b, base, { office: makeOffice(state) });
  const shown = `[...document.querySelectorAll(".c-thread")].filter((c) => getComputedStyle(c).display !== "none").map((c) => c.dataset.thread)`;
  try {
    await p.until(`document.querySelectorAll(".c-thread").length === 3`, "three rooms");
    await p.styled();
    await press(p, FOLD(50101));
    assert.equal(await p.evalJs(`document.querySelectorAll(".c-thread .c-voices [data-circle-open], .c-thread .c-voices a[href^='#circle-']").length`), 0, "no Open on any message, opening message or reply");
    assert.deepEqual(await p.evalJs(`[...document.querySelectorAll(".c-thread")].map((c) => [...c.querySelectorAll("[data-open-room]")].map((a) => [a.textContent, a.getAttribute("href"), a.tagName]))`),
      [ROOM, ROOM_B, ROOM_OLD].map((id) => [["Show only this conversation", `#room-${id}`, "A"]]), "each room's card has ONE plainly worded control, a link with the room's own address");
    await press(p, FOLD(50101));                                           // folded again: the room view opens every circle itself
    await p.evalJs(`window.__card = ${CARD}; window.__noReload = 7; true`);
    const notTheList = () => p.calls.filter((c) => !c.path.startsWith("/world/conversations?closed=")).length;
    const asked = notTheList();
    await press(p, `${CARD}.querySelector("[data-open-room]")`);
    const alone = await p.evalJs(`(() => { const c = ${CARD}, pane = c.querySelector(".c-voices"), cs = getComputedStyle(pane);
      return { hash: location.hash, rooming: document.documentElement.classList.contains("c-rooming"), shown: ${shown}, same: c === window.__card, rows: c.querySelectorAll(".c-voices .c-voice").length, maxHeight: cs.maxHeight, scrolls: pane.scrollHeight > pane.clientHeight + 1,
        h1: document.querySelector(".c-head h1").textContent, back: getComputedStyle(document.querySelector("[data-alone-back]")).display !== "none", sayBox: getComputedStyle(document.querySelector("section[data-say]")).display, control: getComputedStyle(c.querySelector("[data-open-room]")).display, note: document.querySelector("[data-alone-note]").hidden }; })()`);
    assert.deepEqual(alone, { hash: `#room-${ROOM}`, rooming: true, shown: [ROOM], same: true, rows: FLAT.length, maxHeight: "none", scrolls: false, h1: "One conversation", back: true, sayBox: "none", control: "none", note: true },
      "that room by itself: the same card, every one of its fourteen statements on the page (each circle opened), its pane's height lifted, the other rooms and the lists put away, and a way back");
    await new Promise((ok) => setTimeout(ok, 400));
    assert.equal(notTheList(), asked, "showing a room by itself made no ask of its own: no ?room=, no ?circle=, nothing but the page's ordinary list poll");
    // the poll keeps it current, as it does any card
    const opener = { handle: "noe", standing: "resident", said: "An invented new opening message.", at: "2026-11-14T20:22:00.000Z", at_ms: 1794687720000, x: 0, y: 0, id: 50122, circle: 50122 };
    state.live = [thread({ voice_count: 15, latest: opener.at, voices: [...voicesOf(), opener] }), state.live[1]];
    await p.tick();
    await p.until(`${CARD}.querySelectorAll(".c-voices .c-voice").length === ${FLAT.length + 1}`, "new talk arrives in the room shown by itself");
    assert.deepEqual(await p.evalJs(shown), [ROOM], "and it is still the only room on the page");
    assert.deepEqual(findReads(p), [], "still no ?room= or ?circle= read");
    // the way back: in place
    await press(p, `document.querySelector("[data-alone-back]")`);
    assert.deepEqual(await p.evalJs(`[location.pathname + location.hash, document.documentElement.classList.contains("c-rooming"), ${shown}.length, ${CARD} === window.__card, window.__noReload, document.querySelector(".c-head h1").textContent]`), ["/conversations/", false, 3, true, 7, "Conversations"]);
    // a link to ONE CIRCLE still works exactly as before (spark pages, the World page and event pages hold these)
    if (HAS_READER) {
      await p.evalJs(`location.hash = "#circle-50107"; true`);
      await p.until(SELECTED_READY, "the one-circle view, as at 32a68fd3");
      assert.deepEqual(await p.evalJs(`[document.documentElement.classList.contains("c-selecting"), document.documentElement.classList.contains("c-rooming"), ${SELECTED}.dataset.selectedCard]`), [true, false, "50107"]);
    }
  } finally { await p.close(); }
  // arriving on a room's link shows it by itself once the list has painted; a room this page does not hold says so plainly
  const q = await openPage(b, base, { office: makeOffice(state), hash: `#room-${ROOM_OLD}` });
  try {
    await q.until(`!!${cardOf(ROOM_OLD)}?.classList.contains("is-alone")`, "the gone-quiet room, by itself");
    await q.styled();
    assert.deepEqual(await q.evalJs(`[${shown}, ${cardOf(ROOM_OLD)}.querySelectorAll(".c-voices .c-voice").length]`), [[ROOM_OLD], FLAT.length]);
    assert.deepEqual(findReads(q), []);
    await q.evalJs(`location.hash = "#room-t1-nowhere"; true`);
    await q.until(`!document.querySelector("[data-alone-note]").hidden`, "the page says it does not hold that room");
    assert.match(await q.evalJs(`document.querySelector("[data-alone-note]").textContent`), /is not among the ones this page holds now/);
    assert.deepEqual(await q.evalJs(shown), [], "and draws no room in its place");
    assert.deepEqual(findReads(q), [], "without asking the office for it");
  } finally { await q.close(); }
});

test("B · THE POLL DOES NOT DISTURB A READER: a poll that moved nothing redraws nothing; a reply that lands ABOVE the line they are on does not move it; their own reply lands in view", async () => {
  const { b, base } = await boot(false);
  const state = { live: [thread()] };
  const p = await openPage(b, base, { office: makeOffice(state), width: 390, height: 600 });
  try {
    await p.until(ROOM_SHOWN, "the room");
    await p.styled();
    await press(p, FOLD(50101));
    // the reader puts focus on the other circle's button and reads claran's reply (50105, in the MIDDLE of the open circle): that is the line they are on
    await p.evalJs(`(() => { const list = ${CARD}.querySelector(".c-voices"), row = ${CARD}.querySelector('.c-voice[data-say="50105"]'); list.scrollTop += row.getBoundingClientRect().top - list.getBoundingClientRect().top - 10; ${FOLD(50107)}.focus({ preventScroll: true }); window.__keep = { btn: ${FOLD(50107)}, row }; window.__muts = 0; new MutationObserver((r) => { for (const m of r) window.__muts += m.addedNodes.length + m.removedNodes.length; }).observe(list, { childList: true, subtree: true }); return true; })()`);
    const where = () => p.evalJs(`(() => { const list = ${CARD}.querySelector(".c-voices"), row = ${CARD}.querySelector('.c-voice[data-say="50105"]'); return { off: Math.round(row.getBoundingClientRect().top - list.getBoundingClientRect().top), top: Math.round(list.scrollTop) }; })()`);
    const at = await where();
    assert.equal(at.off, 10, "control: the line they are on sits at the top of the pane");
    assert.ok(at.top > 100, `control: the reader has climbed into the room (the pane is scrolled ${at.top}px)`);
    const below = await p.evalJs(`(() => { const list = ${CARD}.querySelector(".c-voices"); return Math.round(list.scrollHeight - list.scrollTop - list.clientHeight); })()`);
    assert.ok(below > 60, `control: and is NOT at the bottom (${below}px of the room is still below the pane), so nothing here is the "following" rule's doing`);
    // (1) a poll that moved nothing
    const polled = p.calls.length;
    await p.poll();
    for (const t0 = Date.now(); Date.now() - t0 < 5000 && p.calls.length === polled;) await new Promise((ok) => setTimeout(ok, 60));
    await new Promise((ok) => setTimeout(ok, 400));
    assert.ok(p.calls.length > polled, "control: the poll DID run");
    assert.equal(await p.evalJs(`window.__muts`), 0, "a poll that moved nothing rebuilt nothing in the pane");
    assert.deepEqual(await where(), at, "the pane is where the reader left it");
    assert.equal(await p.evalJs(`document.activeElement === window.__keep.btn && ${FOLD(50107)} === window.__keep.btn`), true, "focus is on the very button it was on");
    // (2) a reply lands inside the open circle, ABOVE the line the reader is on
    // (seth's "Then I'm in." (50104) is drawn before claran's line, so a reply to it lands above the reader)
    const fresh = { handle: "seth", standing: "resident", said: "An invented reply that lands above the reader. ".repeat(4).trim(), at: "2026-11-14T20:20:00.000Z", at_ms: 1794687600000, id: 50120, reply_to: 50104, circle: 50101 };
    state.live = [thread({ voice_count: 15, latest: fresh.at, voices: [...voicesOf(), fresh] })];
    await p.poll();
    await p.until(`!!${CARD}.querySelector('.c-voice[data-say="50120"]')`, "the new reply is in the open circle");
    const after = await where();
    const grew = await p.evalJs(`Math.round(${CARD}.querySelector('.c-voice[data-say="50120"]').getBoundingClientRect().height)`);
    assert.ok(grew > 40, `control: ${grew}px of new talk was added above the reader's line`);
    assert.ok(Math.abs(after.off - at.off) <= 1, `the line the reader was on did not move (it sat ${at.off}px from the pane's top, and sits ${after.off}px)`);
    assert.ok(after.top - at.top >= grew - 2, "because the pane took up exactly what was added above it");
    assert.equal(await p.evalJs(`document.activeElement === ${FOLD(50107)}`), true, "and the keyboard focus is on the same button, redrawn");
    // (3) the reader speaks (pm:spoke), and their reply lands in the OTHER, folded circle: it is opened and brought into view where it sits
    const own = { handle: "claran", standing: "resident", said: "My own invented reply.", at: "2026-11-14T20:23:00.000Z", at_ms: 1794687780000, id: 50123, reply_to: 50109, circle: 50107 };
    await p.evalJs(`${CARD}.querySelector(".c-voices").scrollTop = 0; true`);
    state.live = [thread({ voice_count: 16, latest: own.at, voices: [...voicesOf(), fresh, own] })];
    await p.tick();
    await p.until(`!!${CARD}.querySelector('.c-voice[data-say="50123"]')`, "their own reply is shown without a press");
    const mine = await p.evalJs(`(() => { const pane = ${CARD}.querySelector(".c-voices").getBoundingClientRect(), r = ${CARD}.querySelector('.c-voice[data-say="50123"]').getBoundingClientRect(); return { inPane: r.top >= pane.top - 1 && r.bottom <= pane.bottom + 1, open: ${FOLD(50107)}.getAttribute("aria-expanded") }; })()`);
    assert.deepEqual(mine, { inPane: true, open: "true" }, "its circle opened and the reply is inside the pane");
  } finally { await p.close(); }
});

test(`B · A ROOM LONGER THAN ITS READ (${readerNote}): the card says how many statements the room holds and how many are here; listing its conversations costs ONE read, on the press, and none on any poll after it, however the room moves (never twice, never while the office is not answering); a room of older talk says there is nothing to open`, async () => {
  const { b, base } = await boot(true);
  const long = () => thread({ voice_count: 94, voices_earlier: { remaining: 80, before_ms: 1794686460000, before: "2026-11-14T20:01:00.000Z", note: "pass voices_before=1794686460000 for the 80 before these" } });
  const state = { live: [long()], room: (id) => roomFind(id) };
  const p = await openPage(b, base, { office: makeOffice(state) });
  try {
    await p.until(ROOM_SHOWN, "the room");
    await p.until(`!!${CARD}.querySelector("[data-room-earlier-words]")`, "the room says it is longer than its read");
    assert.deepEqual(await p.evalJs(SAYS), OPENERS, "the lines the read carries are drawn as any room's are");
    await p.until(`!!${CARD}.querySelector("[data-room-earlier-show]")`, "the way to the earlier conversations");
    // the card says plainly what it holds, what is here, and what the button does
    assert.equal(await p.evalJs(`${CARD}.querySelector("[data-room-earlier-words]").textContent`), "This room holds 94 statements. The newest 14 are shown below in full. The 80 said before them are not shown on this page; the button lists this room's conversations by their first line.");
    assert.equal(await p.evalJs(`${CARD}.querySelector("[data-room-earlier-show]").textContent`), "List this room's conversations");
    if (!HAS_READER) return;                    // a pinned World that predates the reader: the last part below (the reader withheld on purpose) is what holds
    await new Promise((ok) => setTimeout(ok, 600));
    assert.deepEqual(findReads(p), [], "nothing was read for it on load");
    // two presses at once: ONE read
    await p.evalJs(`(() => { const b = ${CARD}.querySelector("[data-room-earlier-show]"); b.click(); b.click(); b.dispatchEvent(new MouseEvent("click", { bubbles: true })); return true; })()`);
    await p.until(`${CARD}.querySelector("[data-circle-reader]")?.dataset.state === "room"`, "the World's reader lists the room's conversations");
    assert.deepEqual(findReads(p), [`/world/conversations?room=${ROOM}`], "ONE ?room= read for three presses");
    assert.deepEqual(await p.evalJs(`[...${CARD}.querySelectorAll("[data-circle-reader] [data-circle-stub]")].map((s) => Number(s.dataset.circle))`), OPENERS, "the room's conversations, in the office's start order (the reader's own list)");
    assert.equal(await p.evalJs(`${CARD}.querySelectorAll("[data-room-earlier-show]").length`), 0, "the button is spent");
    assert.equal(await p.evalJs(`${CARD}.querySelectorAll(".cr-head").length`), 0, "the reader repeats no header (the card owns it)");
    assert.deepEqual(await p.evalJs(SAYS), OPENERS, "and the room's own messages are still drawn whole beside it");
    // ONE READ MEANS ONE: the room keeps talking, and several real polls answer after the mount (until CORE-156's review the page re-read ?room= on
    // every poll that moved a room whose reader was mounted). The list is read each time; the room is never read again.
    const listReads = () => p.calls.filter((c) => c.path.startsWith("/world/conversations?closed=")).length;
    for (let i = 1; i <= 3; i++) {
      const before = listReads();
      const said = { handle: "noe", standing: "resident", said: `An invented new opening message, number ${i}.`, at: `2026-11-14T20:3${i}:00.000Z`, at_ms: 1794688200000 + i * 60000, id: 50130 + i, circle: 50130 + i };
      state.live = [{ ...long(), voice_count: 94 + i, latest: said.at, voices: [...voicesOf(), ...Array.from({ length: i }, (_, k) => ({ ...said, id: 50131 + k, circle: 50131 + k, said: `An invented new opening message, number ${k + 1}.` }))] }];
      await p.poll();
      for (const t0 = Date.now(); Date.now() - t0 < 9000 && listReads() === before;) await new Promise((ok) => setTimeout(ok, 60));
      await p.until(`${CARD}.querySelector("[data-c-count]").textContent === "${94 + i} statements"`, `poll ${i} moved the room`);
      await new Promise((ok) => setTimeout(ok, 400));
    }
    assert.equal(await p.evalJs(`${ROWS}.length`), 3 + 3, "control: the room moved three times, and its own pane took each new message");
    assert.deepEqual(findReads(p), [`/world/conversations?room=${ROOM}`], "three polls that each moved the room: still ONE ?room= read, the press's, and no ?circle=");
  } finally { await p.close(); }
  // the office is not answering: the press asks it nothing more, and says so
  const down = { live: [long()], room: (id) => roomFind(id) };
  const q = await openPage(b, base, { office: makeOffice(down) });
  try {
    if (!HAS_READER) return;
    await q.until(`!!${CARD}?.querySelector("[data-room-earlier-show]")`, "the button");
    down.down = true;
    await q.poll();
    await q.until(`!!document.querySelector("[data-live] [data-office-down]")`, "the page is waiting out a failed read");
    const asked = q.calls.length;
    await press(q, `${CARD}.querySelector("[data-room-earlier-show]")`);
    await new Promise((ok) => setTimeout(ok, 400));
    assert.match(await q.evalJs(`${CARD}.querySelector("[data-room-earlier-note]").textContent`), /isn't answering just now/);
    assert.equal(q.calls.length, asked, "no ask was made while the page is backing off");
    assert.equal(await q.evalJs(`${CARD}.querySelector("[data-circle-reader]")`), null);
  } finally { await q.close(); }
  // A ROOM OF OLDER TALK (its lines carry no id): the World's reader lists CONVERSATIONS, and such a room has none to list, so there is NO button that
  // could show nothing; the card still says what it holds. (Darko on dev, 2026-11-22 19:02 EST, of a 1,992-statement room of this kind: "a gigantic block
  // … that I can't interact with": its one button led to "We couldn't read this".)
  const oldTalk = () => thread({ voice_count: 1992, voices: voicesOf().map(({ id, reply_to, circle, ...v }) => v), voices_earlier: { remaining: 1978, before_ms: 1794686460000, before: "2026-11-14T20:01:00.000Z", note: "pass voices_before" } });
  const o = await openPage(b, base, { office: makeOffice({ live: [oldTalk()], room: (id) => roomFind(id) }), signedIn: true });
  try {
    await o.until(ROOM_SHOWN, "the room");
    await o.until(SAY, "the speak box (so the page's module, and with it the reader's hook, has loaded)");
    await o.poll();
    await new Promise((ok) => setTimeout(ok, 700));
    assert.equal(await o.evalJs(`${CARD}.querySelector("[data-room-earlier-words]").textContent`), "This room holds 1992 statements. The newest 14 are shown below in full. The 1978 said before them are not shown on this page. The messages in this room can't be replied to, so there is nothing here to open, fold or answer.",
      "the card says in one plain line that nothing in it opens, so nobody presses at nothing");
    assert.equal(await o.evalJs(`${CARD}.querySelectorAll("[data-fold], [data-circle-open], [data-reply]").length`), 0, "and indeed nothing in it opens, folds or takes a reply, signed in or not");
    assert.equal(await o.evalJs(`${CARD}.querySelectorAll("[data-room-earlier-show]").length`), 0, "no button that could only fail");
    assert.equal(await o.evalJs(`${ROWS}.length`), 14, "its lines are all there, whole, in order (plain lines: nothing to fold)");
    assert.deepEqual(findReads(o), [], "and nothing was read for it");
  } finally { await o.close(); }
  // THE READER WITHHELD (a pinned World that predates it): the press says so, and asks the office nothing
  const bare = await boot(false);
  const n = await openPage(bare.b, bare.base, { office: makeOffice({ live: [long()], room: (id) => roomFind(id) }) });
  try {
    await n.until(`!!${CARD}?.querySelector("[data-room-earlier-show]")`, "the button");
    await press(n, `${CARD}.querySelector("[data-room-earlier-show]")`);
    await n.until(`/isn't available on this page/.test(${CARD}.querySelector("[data-room-earlier-note]")?.textContent ?? "")`, "the page says the reader is not here");
    assert.equal(await n.evalJs(`${CARD}.querySelectorAll("[data-room-earlier-show]").length`), 0);
    assert.deepEqual(findReads(n), [], "no read was made for a reader that is not there");
  } finally { await n.close(); }
});

// Darko on dev, 2026-11-22 19:02 EST: "I see a gigantic block for the evening lantern, the harbor reach, with 1,992 statements that I can't interact with."
// Measured there: the block was the speakers list, 242 names, 1,672px at 1440 and 6,873px on a phone, above the room's first message.
test("B · A CROWDED ROOM'S SPEAKERS ARE CAPPED: a first run of names and 'and N more', which opens the rest in place and folds them again; no ask; a poll keeps what the reader opened", async () => {
  const { b, base } = await boot(false);
  const crowd = Array.from({ length: 242 }, (_, i) => `speaker-${String(i + 1).padStart(3, "0")}`);
  const state = { live: [thread({ participants: crowd }), thread({ id: ROOM_B, place: "The Quay", participants: crowd.slice(0, 14) })] };
  const p = await openPage(b, base, { office: makeOffice(state), width: 390, height: 844 });
  try {
    await p.until(ROOM_SHOWN, "the room");
    await p.styled();
    const people = `${CARD}.querySelector(".c-people")`;
    const names = () => p.evalJs(`[...${people}.querySelectorAll(".c-person")].map((x) => x.dataset.handle)`);
    const more = `${people}.querySelector("[data-people-more]")`;
    assert.deepEqual(await names(), crowd.slice(0, 12), "the first twelve speakers, in the office's order");
    assert.deepEqual(await p.evalJs(`[${more}.textContent, ${more}.getAttribute("aria-expanded"), ${more}.tagName]`), ["and 230 more", "false", "BUTTON"], "and the rest behind one press that says how many");
    assert.equal(await p.evalJs(`${CARD}.querySelector("[data-c-speakers]").textContent`), "242 speakers", "the count above still says all of them");
    const capped = await p.evalJs(`Math.round(${people}.getBoundingClientRect().height)`);
    assert.ok(capped < 400, `the speakers block is short at phone width (${capped}px), not thousands of pixels`);
    // a room with a couple more than twelve shows them all: no "and 2 more"
    assert.deepEqual(await p.evalJs(`(() => { const c = document.querySelector('[data-thread="${ROOM_B}"] .c-people'); return [c.querySelectorAll(".c-person").length, c.querySelectorAll("[data-people-more]").length]; })()`), [14, 0]);
    // the press opens the rest IN PLACE, and asks the office nothing
    const asked = p.calls.length;
    await p.evalJs(`${more}.focus(); ${more}.click(); true`);
    assert.deepEqual(await names(), crowd, "all 242, in place");
    assert.deepEqual(await p.evalJs(`[${more}.textContent, ${more}.getAttribute("aria-expanded"), document.activeElement === ${more}]`), ["show fewer", "true", true], "the same press folds them again, and the keyboard is still on it");
    const opened = await p.evalJs(`Math.round(${people}.getBoundingClientRect().height)`);
    assert.ok(opened > capped * 5, `control: uncapped, the block is ${opened}px tall at phone width`);
    await new Promise((ok) => setTimeout(ok, 300));
    assert.deepEqual([...new Set(p.calls.slice(asked).map((c) => c.path))].filter((x) => !x.startsWith("/world/conversations?closed=")), [], "no ask for the names: they are the thread's own");
    assert.deepEqual(findReads(p), []);
    // a poll that moves the room keeps the list as the reader left it
    state.live = [thread({ participants: crowd, voice_count: 15, latest: "2026-11-14T20:16:00.000Z" }), state.live[1]];
    await p.poll();
    await p.until(`${CARD}.querySelector("[data-c-count]").textContent === "15 statements"`, "the poll moved the room");
    assert.equal((await names()).length, 242, "still open after the poll");
    await p.evalJs(`${more}.click(); true`);
    assert.deepEqual(await names(), crowd.slice(0, 12), "folded again");
    assert.equal(await p.evalJs(`${more}.textContent`), "and 230 more");
  } finally { await p.close(); }
});

// Truey's review of ed999477f (2026-11-22): "The one-conversation view asks `?circle=` on load and again on every poll … one tab resting in this view asks
// the office for a circle about every 7 seconds for as long as it stays open." On the w48 office each such ask scans the whole record.
test(`ONE CONVERSATION · ASKS (${readerNote}): arriving asks the office for the circle ONCE; no poll asks for it again, moved or unmoved; new lines are offered from the list the page already holds; one press is one ask, and none while the office is not answering`, async () => {
  if (!HAS_READER) return;
  const { b, base } = await boot(true);
  const state = { live: [thread()], room: (id) => roomFind(id) };
  const p = await openPage(b, base, { office: makeOffice(state), hash: "#circle-50101" });
  const circleAsks = () => p.calls.map((c) => c.path).filter((x) => /[?&]circle=/.test(x));
  const roomAsks = () => p.calls.map((c) => c.path).filter((x) => /[?&]room=/.test(x));
  const listAsks = () => p.calls.filter((c) => c.path.startsWith("/world/conversations?closed=")).length;
  // one REAL poll, answered: the page's own ask of the list (its hashchange path, the same tick the 7 s timer makes), waited for
  const polled = async (change) => {
    const before = listAsks();
    if (change) change();
    await p.evalJs(`window.dispatchEvent(new HashChangeEvent("hashchange")); true`);
    for (const t0 = Date.now(); Date.now() - t0 < 9000 && listAsks() === before;) await new Promise((ok) => setTimeout(ok, 60));
    assert.ok(listAsks() > before, "control: the poll ran");
    await new Promise((ok) => setTimeout(ok, 500));
  };
  const FRESH = `${SELECTED}.querySelector("[data-selected-fresh]")`;
  const says = () => p.evalJs(`(() => { const r = ${FRESH}; return r && !r.hidden ? [r.querySelector("[data-selected-fresh-words]").textContent, r.querySelector("[data-selected-refresh]").textContent] : null; })()`);
  try {
    await p.until(SELECTED_READY, "the conversation");
    await p.until(`!!${FRESH} && !${FRESH}.hidden`, "the view says how it updates");
    await new Promise((ok) => setTimeout(ok, 500));
    assert.deepEqual(circleAsks(), ["/world/conversations?circle=50101"], "arriving on the link: exactly ONE ask for the circle (the page's; the reader is handed that answer, not sent to ask again)");
    assert.deepEqual(roomAsks(), [], "and none for the room");
    assert.ok(await p.evalJs(`${SELECTED}.querySelectorAll("li[data-say]").length`) >= 1, "control: the reader drew the circle from that one answer");
    assert.deepEqual(await says(), ["This view does not update by itself.", "Refresh"], "the view says plainly that it does not update by itself, with its one press");
    // three answered polls: nothing moved; another room spoke and this room took a new OPENING message; nothing moved again
    await polled();
    const opener = { handle: "noe", standing: "resident", said: "An invented new opening message.", at: "2026-11-14T20:22:00.000Z", at_ms: 1794687720000, id: 50122, circle: 50122 };
    await polled(() => { state.live = [thread({ voice_count: 15, latest: opener.at, voices: [...voicesOf(), opener] }), thread({ id: ROOM_B, place: "The Quay", voice_count: 3, voices: voicesOf().slice(0, 3) })]; });
    await polled();
    assert.deepEqual(circleAsks(), ["/world/conversations?circle=50101"], "three answered polls, moved and unmoved: NOT ONE more ask for the circle");
    assert.deepEqual(roomAsks(), []);
    assert.deepEqual(await says(), ["This view does not update by itself.", "Refresh"], "a new opening message elsewhere in the room is not new in THIS conversation");
    // a reply lands IN this conversation: the list the page already holds shows it, and the view offers it. Still no ask.
    const fresh = { handle: "seth", standing: "resident", said: "An invented new reply, deep in the circle.", at: "2026-11-14T20:25:00.000Z", at_ms: 1794687900000, id: 50120, reply_to: 50113, circle: 50101 };
    await polled(() => { state.live = [thread({ voice_count: 16, latest: fresh.at, voices: [...voicesOf(), opener, fresh] })]; });
    assert.deepEqual(await says(), ["1 new in this conversation.", "Show"], "offered from the list read: the office's count for this conversation was 10, the list now holds 11");
    assert.equal(circleAsks().length, 1, "and offering it asked nothing");
    // the press: ONE ask, however fast it is pressed
    state.circleSays = 11;
    await p.evalJs(`(() => { const b = ${FRESH}.querySelector("[data-selected-refresh]"); b.click(); b.click(); b.dispatchEvent(new MouseEvent("click", { bubbles: true })); return true; })()`);
    await p.until(`${FRESH}.querySelector("[data-selected-fresh-words]").textContent === "This view does not update by itself."`, "the press read the conversation again, and the offer is spent");
    await new Promise((ok) => setTimeout(ok, 400));
    assert.deepEqual(circleAsks(), ["/world/conversations?circle=50101", "/world/conversations?circle=50101"], "three presses at once: ONE more ask");
    // and the polls after it ask nothing more
    await polled(); await polled();
    assert.equal(circleAsks().length, 2, "two more polls: still two asks in all (arriving, and the one press)");
    assert.deepEqual(roomAsks(), []);
    // the office stops answering: a press asks it nothing, and says so
    state.down = true;
    await p.evalJs(`window.dispatchEvent(new HashChangeEvent("hashchange")); true`);
    await p.until(`!!document.querySelector("[data-live] [data-office-down]")`, "the page is waiting out a failed read");
    const attempts = p.calls.length;
    await press(p, `${FRESH}.querySelector("[data-selected-refresh]")`);
    await new Promise((ok) => setTimeout(ok, 400));
    assert.equal(p.calls.length, attempts, "no ask of any kind was made while the page is backing off");
    assert.match((await says())[0], /isn't answering just now/);
  } finally { await p.close(); }
  // arriving by a message's Open (the press B puts on every opening message): the same ONE ask
  const q = await openPage(b, base, { office: makeOffice({ live: [thread()], room: (id) => roomFind(id) }) });
  try {
    await q.until(ROOM_SHOWN, "the room");
    await q.evalJs(`location.hash = "#circle-50107"; true`);      // (a message's own Open is gone, CORE-161; a link to one circle arrives the same way)
    await q.until(SELECTED_READY, "the one conversation");
    await new Promise((ok) => setTimeout(ok, 600));
    assert.deepEqual(q.calls.map((c) => c.path).filter((x) => /[?&](circle|room)=/.test(x)), ["/world/conversations?circle=50107"], "Open: ONE ask");
  } finally { await q.close(); }
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

// ── the World's reader in the page (when it exists in this environment): the one-conversation view, and a long room's fallback ────
//
// Until 2026-11-22 (CORE-156) a test here, "READER: the room's top circles come in the order they started, the flat transcript steps aside, and a poll keeps
// the reader, its focus and its state", asserted that EVERY card mounted the World's reader (one ?room= read each) and hid the page's own lines. Darko's B
// retires that: a card draws its room itself (the B tests above: the order they started, no invented "your circle", the poll keeping focus and place), and
// the reader is mounted in a card only for a room longer than its read (B · A ROOM LONGER THAN ITS READ above, which holds the office's start order and the
// one read). This one holds the other half: a room that fits its read never mounts the reader, however long the page is open.
test(`READER (${readerNote}): a room that fits its read never mounts the World's reader in its card, on load or on any poll; the order is the order the messages were said, with no invented 'your circle'`, async () => {
  const { b, base } = await boot(true);
  const state = { live: [thread()], room: (id) => roomFind(id) };
  const p = await openPage(b, base, { office: makeOffice(state), signedIn: true });
  try {
    await p.until(ROOM_SHOWN, "the room");
    await p.until(SAY, "the speak box (the module script has run, so the reader's hook is there)");
    assert.deepEqual(await p.evalJs(SAYS), OPENERS, "the office's order, none ranked or chosen");
    assert.equal(await p.evalJs(`${CARD}.querySelectorAll("[data-yours], [data-your-circle]").length`), 0, "no invented 'your circle'");
    await p.evalJs(`window.__keep = ${CARD}.querySelector(".c-voices"); true`);
    state.live = [thread({ voice_count: 15, latest: "2026-11-14T20:16:00.000Z" })];
    await p.poll();
    await p.until(`${CARD}.querySelector("[data-c-count]").textContent === "15 statements"`, "the room's number moved");
    await new Promise((ok) => setTimeout(ok, 700));
    assert.equal(await p.evalJs(`${CARD}.querySelector("[data-circle-reader]")`), null, "no reader in the card");
    assert.equal(await p.evalJs(`${CARD}.querySelectorAll("[data-room-earlier]").length`), 0, "and no 'earlier' note: the read holds the room");
    assert.equal(await p.evalJs(`${CARD}.querySelector(".c-voices") === window.__keep && !window.__keep.hidden`), true, "the room's own pane is the same node, and shown");
    assert.deepEqual(findReads(p), [], "no ?room= read, by the load or by the poll");
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
    // CORE-156: the card's "Open" is the page's own link on the opening message (until then it was the reader's button in the card)
    await p.until(ROOM_SHOWN, "the room on the card");
    await p.until(SAY, "the speak box");
    // (From CORE-156 until CORE-161 this pressed the "Open" link on the opening message itself. Darko, 2026-11-22 20:15 EST: "there's an open line next to
    // every reply button … really all we need is to just be able to open each main room conversation": a message has no Open now, and a circle's own
    // link, which spark pages, the World page and event pages hold, still arrives here.)
    assert.equal(await p.evalJs(`document.querySelectorAll(".c-thread .c-voice [data-circle-open]").length`), 0, "no Open on a message");
    await p.evalJs(`location.hash = "#circle-50101"; true`);
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
    // and the card reads as its room when the lists come back (until CORE-156: "the card's reader went back to its room")
    await p.evalJs(`location.hash = ""; true`);
    await p.until(`!!${CARD}`, "lists back");
    await p.until(ROOM_SHOWN, "the card reads as a room again");
    assert.deepEqual(await p.evalJs(SAYS), OPENERS, "its opening messages, as before");
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
    if (!HAS_READER) return;                      // a pinned World that predates the reader: the B tests above are what runs
    await p.until(ROOM_SHOWN, "the room");
    // the room's one header is the card's own, said once, above the talk. (Until CORE-156 the card held the World's reader, told `hostOwnsHeader` so it drew
    // none of its own; a long room's fallback still mounts it that way, and "B · A ROOM LONGER THAN ITS READ" holds that there is no second header.)
    assert.equal(await p.evalJs(`${CARD}.querySelectorAll(".cr-head").length`), 0, "no second header in the card");
    assert.equal(await p.evalJs(`${CARD}.querySelectorAll(".c-thread-head").length`), 1, "the host's one title/live group");
    assert.equal(await p.evalJs(`${CARD}.querySelectorAll(".c-meta").length`), 1, "the host's one counts/began/latest group");
    assert.equal(await p.evalJs(`/\\bnow\\b/i.test(${CARD}.querySelector(".c-thread-head").textContent + " " + ${CARD}.querySelector(".c-meta").textContent)`), false, "no 'now' row");
    // the room's messages: each wears its speaker's face first, beside the name (a fresh node per line), openers and replies alike
    await press(p, FOLD(50101));
    const bylines = `[...${CARD}.querySelectorAll(".c-voices .c-voice-who")]`;
    assert.equal(await p.evalJs(`${bylines}.length === 12 && ${bylines}.every((l) => l.firstElementChild?.classList.contains("c-face") && l.lastElementChild?.classList.contains("c-who"))`), true, "every message, replies included, has its face first and its name after");
    assert.equal(await p.evalJs(`new Set(${bylines}.map((l) => l.firstElementChild)).size === ${bylines}.length`), true, "a fresh face node per line");
    await p.until(`${CARD}.querySelectorAll(".c-voices img.c-face").length >= 1`, "the public picture arrives on the lines too");
    assert.equal(await p.evalJs(`${CARD}.querySelector('.c-voice[data-say="50101"] img.c-face').getAttribute("src")`), "/media/pica-avatar-card.jpg");
    assert.equal(await p.evalJs(`${FOLD(50101)}.getAttribute("aria-expanded")`), "true", "and the pictures landing did not fold what the reader opened");
    // an opened circle: every statement, replies included. CORE-117: a statement's "Open" goes to that conversation's OWN view (the #circle- link: the one-conversation view),
    // so the opened circle is read THERE, in the page's one selected card, wearing the same provider the lists do
    const picked = `[...${SELECTED}.querySelectorAll("[data-circle-reader] .cr-head-line")]`;
    await p.evalJs(`location.hash = "#circle-50101"; true`);
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
