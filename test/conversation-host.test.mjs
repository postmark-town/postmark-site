// conversation-host.test.mjs — one theme and one reader setup for every page that hosts a room's circles (CORE-177).
//
//   node --test test/conversation-host.test.mjs
//
// Darko, 2026-11-24 08:48 EST: the event page's conversations "would just need to take literally the same theme as like how it looks in
// the conversations page". Facet's ruling (15:24Z): share the Conversations styles and reader setup, both hosts consuming the same theme,
// the same setup and the actual World reader, not a copied approximate theme. WHAT THIS HOLDS (pure: no browser, no build):
//   (1) the theme MOVED: the card, head, faces and reader-host rules live once, in src/styles/conversation-host.css, and both pages import it;
//   (2) the reader setup is ONE: the Conversations page's door mounts through circle-reader-mount.mjs mountRoom, as the event page does, and
//       mountRoom hands the reader exactly the host options it is given (bare callers keep the bare defaults);
//   (3) the host options (conversation-host.mjs): the face provider behind the Conversations page's own guards, held identical to that page's
//       inline copy, and the host's own header.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mountRoom } from "../src/lib/circle-reader-mount.mjs";
import { FACES_WAIT_MS, faceNode, faceProvider, hostFaces, hostReaderOptions, inkOn, loadFaces, monogramOf, RESIDENTS_META, safeAvatarUrl, safeHexColor } from "../src/lib/conversation-host.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const CONVO = read("town/pages/conversations/index.astro");
const EVENT = read("town/pages/events/[host]/[slug].astro");
const CSS = read("src/styles/conversation-host.css");
const HOST = read("src/lib/conversation-host.mjs");

// ── (1) one theme ─────────────────────────────────────────────────────────

const MOVED = [".convo .c-thread {", ".convo .c-thread.is-live {", ".convo .c-thread-head {", ".convo .c-place {", ".convo .c-place-link {", ".convo .c-perma {",
  ".convo .c-chip {", ".convo .c-meta {", ".convo .c-face {", ".convo .cr-head-line > .c-face {", ".convo .c-face.is-human {", ".convo .c-fine {", ".convo .c-circles {"];

test("the card, its head, the faces and the reader's host are ONE stylesheet, imported by both pages, and no longer kept on the Conversations page", () => {
  for (const sel of MOVED) {
    assert.equal(CSS.split(sel).length - 1, 1, `${sel} is in conversation-host.css once`);
    assert.equal(CONVO.includes(sel), false, `${sel} is no longer a second copy on the Conversations page`);
    assert.equal(EVENT.includes(sel), false, `${sel} is not copied onto the event page`);
  }
  for (const [name, page] of [["conversations", CONVO], ["event", EVENT]]) assert.match(page, /^import "@\/styles\/conversation-host\.css";$/m, `the ${name} page imports the shared theme`);
  // the card chrome only the Conversations page draws stays there (the room's pane, sized as its chat window, included)
  for (const own of [".convo .c-people {", ".convo .c-voices {", ".convo .c-more {"]) assert.equal(CONVO.includes(own), true, `${own} stays on the Conversations page`);
  // CORE-177: READING A ROOM (CORE-156's B) moved here beside its one drawing, src/lib/room-drawing.mjs
  for (const sel of [".convo .c-voice {", ".convo .c-said {", ".convo .c-acts {", ".convo .c-act {", ".convo .c-fold {", ".convo .c-kids {", ".convo .c-ring {", ".convo .c-voice.is-new {"]) {
    assert.equal(CSS.split("\n" + sel).length - 1, 1, `${sel} is a top-level rule in conversation-host.css once (its phone rule sits in the media block)`);
    assert.equal(CONVO.includes(sel), false, `${sel} is no longer kept on the Conversations page`);
  }
});

test("PIN the event page's own fallbacks stop at the room card's chrome, so the shared .c-perma and .c-fine win on a baked card as on an island-built one", () => {
  const css = EVENT.slice(EVENT.lastIndexOf("<style>"), EVENT.lastIndexOf("</style>"));
  // the page's scoped rules out-rank `.convo .c-perma` / `.convo .c-fine` on a baked card (its scope attribute) but not on an island-built one: so they must not reach them
  assert.match(css, /^\s*\.ev-sec:not\(\.pm-paper\) a:not\(\.c-perma\) \{ color: var\(--pm-gold-bright\); \}$/m);
  assert.match(css, /^\s*\.ev-sec:not\(\.pm-paper\) \.ev-note:not\(\.c-fine\), \.ev-sec:not\(\.pm-paper\) \.soft \{ color: var\(--pm-paper\); \}$/m);
  for (const rule of css.match(/^[^{}\n]*\{[^}]*\bcolor\s*:/gm) ?? []) {
    const sel = rule.slice(0, rule.indexOf("{"));
    if (!/\.ev-sec:not\(\.pm-paper\)/.test(sel)) continue;
    for (const part of sel.split(",")) {
      if (/\ba\b\s*$/.test(part.trim()) || /\ba:(?!not\(\.c-perma\))/.test(part)) assert.fail(`a dark-ground link rule that reaches the room's whole-talk link: ${part.trim()}`);
      if (/\.ev-note(?!:not\(\.c-fine\))\s*$/.test(part.trim())) assert.fail(`a dark-ground note rule that reaches the room's fine print: ${part.trim()}`);
    }
  }
  // both paths draw the chrome with the shared classes: the baked card and the island's build()
  assert.match(EVENT, /<a class="c-perma" href=\{roomPermalink\(id\)\}>/); assert.match(EVENT, /a\.className = "c-perma";/);
  assert.match(EVENT, /<p class="c-fine ev-note" data-ev-floor>/); assert.match(EVENT, /note\.className = "c-fine ev-note";/);
});

// ── (2) one reader setup ──────────────────────────────────────────────────

function fakeDoc() {
  const node = (tag) => ({ tag, className: "", textContent: "", style: {}, attrs: {}, setAttribute(k, v) { this.attrs[k] = String(v); }, append() {} });
  return { createElement: node, head: { appended: [], append(n) { this.appended.push(n); } }, querySelector: () => null };
}
function fakeReader(log) {
  return {
    READER_CSS: ".cr{}",
    createCircleReader(opts) {
      log.push(["create", opts]);
      return { showRoom: async (r) => log.push(["showRoom", r]), showCircle: async (c) => log.push(["showCircle", c]) };
    },
  };
}

test("mountRoom hands the reader exactly the host options it is given, and a bare caller still gets the bare defaults", async () => {
  const log = [];
  const face = () => null, onState = () => {};
  const m = await mountRoom({ doc: fakeDoc(), host: {}, roomId: "r1", importImpl: async () => fakeReader(log), faceForSpeaker: face, hostOwnsHeader: true, onState, circle: "42" });
  assert.equal(m.ok, true);
  const opts = log.find((l) => l[0] === "create")[1];
  assert.equal(opts.faceForSpeaker, face); assert.equal(opts.hostOwnsHeader, true); assert.equal(opts.onState, onState);
  assert.deepEqual(log.filter((l) => l[0] !== "create"), [["showCircle", "42"]], "a selected conversation opens on its circle");
  const bare = [];
  await mountRoom({ doc: fakeDoc(), host: {}, roomId: "r2", importImpl: async () => fakeReader(bare) });
  const b = bare.find((l) => l[0] === "create")[1];
  for (const k of ["faceForSpeaker", "hostOwnsHeader", "onState"]) assert.equal(k in b, false, `a bare mount passes no ${k}`);
  assert.equal(b.canReply, false, "and no Reply");
  assert.deepEqual(bare.filter((l) => l[0] !== "create"), [["showRoom", "r2"]], "it opens on its room");
  // a caller's own reads (the Conversations door's CORE-156 source) are used only when they answer both reads; anything else is the keyless office reads
  const own = { room: async () => ({}), circle: async () => ({}) };
  const given = [];
  await mountRoom({ doc: fakeDoc(), host: {}, roomId: "r3", importImpl: async () => fakeReader(given), source: own });
  assert.equal(given.find((l) => l[0] === "create")[1].source, own);
  for (const half of [{ room: async () => ({}) }, "x", null]) {
    const l = [];
    await mountRoom({ doc: fakeDoc(), host: {}, roomId: "r4", importImpl: async () => fakeReader(l), source: half });
    const s = l.find((x) => x[0] === "create")[1].source;
    assert.notEqual(s, half); assert.equal(typeof s.room, "function"); assert.equal(typeof s.circle, "function");
  }
});

test("PIN both hosts mount the World's reader through mountRoom: the Conversations door with its own options, the event page with the shared host options", () => {
  // the door's own reads (CORE-156: the primed answer, the page told of each circle read) are the office source it hands the one setup
  assert.match(CONVO, /import \{ mountRoom, officeSource \} from "@\/lib\/circle-reader-mount\.mjs";/);
  assert.match(CONVO, /const m = await mountRoom\(\{[\s\S]*?source,[\s\S]*?onState, onNavigate, circle,[\s\S]*?faceForSpeaker, hostOwnsHeader,\s*\}\);/, "the door delegates, passing what it was given");
  assert.equal(/loadReader\(/.test(CONVO), false, "and does not load the reader itself");
  assert.equal(/createCircleReader\(/.test(CONVO), false, "the door no longer builds the reader itself");
  assert.match(EVENT, /import \{ hostFaces, hostReaderOptions \} from "@\/lib\/conversation-host\.mjs";/);
  assert.match(EVENT, /await mountRoom\(\{ doc: document, host: reader, roomId: id,[^\n]*?\.\.\.hostReaderOptions\(document, faces\.get\) \}\);/, "the event page mounts with the Conversations host's options");
  assert.equal(/createCircleReader\(/.test(EVENT), false, "and never builds a reader of its own");
});

// ── (3) the host options ──────────────────────────────────────────────────

test("the face guards are the Conversations page's, word for word, so the two copies cannot drift", () => {
  const fn = (src, name) => { const m = new RegExp(`function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n\\s*\\}\\n`).exec(src); assert.ok(m, `no ${name}`); return m[0].replace(/^\s+/gm, "").replace(/^export /, ""); };
  for (const name of ["safeAvatarUrl", "safeHexColor", "monogramOf", "inkOn", "humanOf"]) assert.equal(fn(HOST, name), fn(CONVO, name), `${name} differs from the Conversations page's`);
  const line = (src, v) => new RegExp(`^\\s*var ${v} = .*$`, "m").exec(src)?.[0].trim();
  for (const v of ["AVATAR_PATH", "TOWN_MEDIA_DOOR", "DOOR_PATH", "HEX", "DEFAULT_FACE_COLOR"]) assert.equal(line(HOST, v), line(CONVO, v), `${v} differs`);
  assert.match(CONVO, /fetch\("\/world-engine\/residents-meta\.json"/); assert.equal(RESIDENTS_META, "/world-engine/residents-meta.json", "the same residents-meta");
});

test("a face: the guarded picture, else the colour and letter, and the dashed chip for a house's human; a fresh node each call and never a throw", () => {
  const doc = fakeDoc();
  const faces = { "pic-test": { name: "Pic", avatar: "/media/pic.png" }, "evil-test": { name: "Evil", avatar: "javascript:alert(1)", color: "red;background:url(x)" }, "hue-test": { name: "Hue", color: "#123" } };
  const pic = faceNode(doc, "pic-test", faces);
  assert.equal(pic.tag, "img"); assert.equal(pic.src, "/media/pic.png"); assert.equal(pic.alt, ""); assert.equal(pic.className, "c-face");
  const evil = faceNode(doc, "evil-test", faces);
  assert.equal(evil.tag, "span", "an unsafe picture is refused"); assert.equal(evil.style.background, "#e8c48b", "and an unsafe colour falls back"); assert.equal(evil.textContent, "E");
  const hue = faceNode(doc, "hue-test", faces);
  assert.equal(hue.style.background, "#123"); assert.equal(hue.style.color, inkOn("#123"));
  const human = faceNode(doc, "human-of-fox-hearth", faces);
  assert.equal(human.className, "c-face is-human"); assert.equal(human.textContent, "F"); assert.equal(human.attrs["aria-hidden"], "true");
  assert.equal(faceNode(doc, "nobody-test", null).textContent, "N", "no residents-meta: letters only");
  const provide = faceProvider(doc, () => faces);
  assert.notEqual(provide("pic-test"), provide("pic-test"), "a fresh node per call");
  assert.equal(provide(""), null); assert.equal(provide(null), null);
  assert.equal(faceProvider({ createElement() { throw new Error("x"); } })("pic-test"), null, "a failure is no face, never a throw");
  assert.equal(safeAvatarUrl("https://media.postmark.town/media/a/b.png"), "https://media.postmark.town/media/a/b.png");
  assert.equal(safeAvatarUrl("//evil.example/x.png"), null); assert.equal(safeHexColor("#zzz"), "#e8c48b"); assert.equal(monogramOf("", "🦊fox"), "🦊");
});

test("the host's options are its faces and its own header; residents-meta that cannot be had is letters only, never a blocked room", async () => {
  const o = hostReaderOptions(fakeDoc(), () => null);
  assert.equal(o.hostOwnsHeader, true); assert.equal(typeof o.faceForSpeaker, "function");
  assert.deepEqual(Object.keys(o).sort(), ["faceForSpeaker", "hostOwnsHeader"], "nothing else: no Reply, no navigation of its own");
  assert.deepEqual(await loadFaces(async () => ({ ok: true, json: async () => ({ residents: { a: { name: "A" } } }) })), { a: { name: "A" } });
  assert.equal(await loadFaces(async () => ({ ok: false, json: async () => ({}) })), null);
  assert.equal(await loadFaces(async () => { throw new Error("offline"); }), null);
  assert.equal(await loadFaces(async () => ({ ok: true, json: async () => ({}) })), null);
});

// ── a face never holds a room (CORE-177 FIX F1) ───────────────────────────

// timers the test fires by hand: `armed` is what is still pending, `fire()` runs it
function fakeTimers() {
  const armed = new Map(); let n = 0;
  return { armed, setTimeout(fn, ms) { armed.set(++n, { fn, ms }); return n; }, clearTimeout(id) { armed.delete(id); }, fire() { for (const [id, t] of [...armed]) { armed.delete(id); t.fn(); } } };
}
const never = () => new Promise(() => {});
const tick = () => new Promise((r) => setImmediate(r));

test("FALSIFIER: a residents-meta read that NEVER settles (headers, or a pending body) still lets the actual reader mount once the bounded wait has passed", async () => {
  for (const [name, fetchImpl] of [["headers never come", () => never()], ["the body never comes", async () => ({ ok: true, json: never })]]) {
    const timers = fakeTimers(); const log = [];
    const faces = hostFaces({ fetchImpl, timers });
    // the event page's drawRoom, in its order: the bounded wait, then the site's one setup with the host's options
    const opened = faces.ready().then(() => mountRoom({ doc: fakeDoc(), host: {}, roomId: "r1", importImpl: async () => fakeReader(log), ...hostReaderOptions(fakeDoc(), faces.get) }));
    await tick();
    assert.equal(log.length, 0, `${name}: control, the room is waiting on the bounded faces`);
    assert.deepEqual([...timers.armed.values()].map((t) => t.ms), [FACES_WAIT_MS], "one deadline, the host's");
    timers.fire();
    const m = await opened;
    assert.equal(m.ok, true, `${name}: the reader mounted`);
    assert.deepEqual(log.filter((l) => l[0] !== "create"), [["showRoom", "r1"]], `${name}: and opened its room`);
    assert.equal(faces.get(), null, "with letters: no faces were had");
  }
});

test("an early result clears its deadline, faces that land LATE reach the provider, and every room shares ONE read and ONE deadline", async () => {
  const timers = fakeTimers(); let reads = 0;
  const fast = hostFaces({ fetchImpl: async () => { reads++; return { ok: true, json: async () => ({ residents: { "pic-test": { name: "Pic", avatar: "/media/pic.png" } } }) }; }, timers });
  await fast.ready();
  assert.equal(timers.armed.size, 0, "no timer left alive after an early result");
  assert.equal(fast.get()["pic-test"].name, "Pic");
  await Promise.all([fast.ready(), fast.ready()]);
  assert.equal(reads, 1, "one residents-meta read for the page, however many rooms open");
  // refused / thrown: letters, at once, and no timer left
  for (const fetchImpl of [async () => ({ ok: false }), async () => { throw new Error("offline"); }]) {
    const t = fakeTimers(); const f = hostFaces({ fetchImpl, timers: t });
    await f.ready(); assert.equal(f.get(), null); assert.equal(t.armed.size, 0);
  }
  // late: the deadline passes first, the room mounts with letters, and the faces then land for every byline drawn after
  let land; const t2 = fakeTimers();
  const late = hostFaces({ fetchImpl: () => new Promise((r) => { land = r; }), timers: t2 });
  const waited = late.ready(); await tick(); t2.fire(); await waited;
  const provide = hostReaderOptions(fakeDoc(), late.get).faceForSpeaker;
  assert.equal(provide("pic-test").tag, "span", "letters while the read is out");
  land({ ok: true, json: async () => ({ residents: { "pic-test": { name: "Pic", avatar: "/media/pic.png" } } }) }); await tick(); await tick();
  assert.equal(provide("pic-test").tag, "img", "the picture once it lands, through the same getter: no remount, no second read");
});

test("PIN the event page's room waits only on the bounded faces, never on the read itself, and mounts through the one setup with the same getter", () => {
  const draw = EVENT.slice(EVENT.indexOf("const drawRoom = async"), EVENT.indexOf("const build = (ids)"));
  assert.match(EVENT, /const faces = hostFaces\(\{ fetchImpl: \(u, o\) => fetch\(u, o\) \}\);/, "one host faces for the page");
  assert.deepEqual([...draw.matchAll(/await ([\w.]+)\(/g)].map((m) => m[1]), ["faces.ready", "mountRoom"], "the bounded wait, then the mount: nothing else is awaited");
  assert.equal(/loadFaces|readFaces/.test(EVENT), false, "no unbounded read left on the page");
});
