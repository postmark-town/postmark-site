// conversations-reader-faces.test.mjs — the conversations page hands the World's circle reader a speaker-face provider (CORE-128).
//
// Darko, 2026-11-19 15:36 EST: "I think we really need profile pictures next to speakers"; his go on the mock-ups: "facets mockups look really good".
// The reader (postmark-world spectator/circle-reader.mjs) takes an OPTIONAL `faceForSpeaker(handle) -> a fresh decorative DOM node | null` and puts the node
// inline in each statement's byline; this page is its caller. The provider is the page's own faceNode (the guarded public picture, the letter fallback, the
// dashed `human-of-` chip with no photo): these pin what the provider hands over and that the option reaches the reader only when given. The reader's own
// drawing of the node (every depth, opener or reply) is the World's, and is shown by the lane's pictures once the published package carries the hook.
//
// The provider is read OUT OF the page and run over a tiny DOM shim (no browser): the page's own guard, colour, ink and letter code, unchanged.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mountRoom } from "../src/lib/circle-reader-mount.mjs";

const page = readFileSync(new URL("../town/pages/conversations/index.astro", import.meta.url), "utf8");
const MOUNT = readFileSync(new URL("../src/lib/circle-reader-mount.mjs", import.meta.url), "utf8");

// ── the page's provider, run over a DOM shim ──
const slice = (from, to) => { const a = page.indexOf(from); const b = page.indexOf(to, a); assert.ok(a > -1 && b > a, `the page still carries ${from}`); return page.slice(a, b); };
const CODE = [
  slice("      function el(tag, cls, text)", "      function humanOf"),
  slice("      function humanOf", "      // ── faces"),
  slice("      var AVATAR_PATH", "      function threadNode"),
].join("\n");
const makeNode = (tag) => ({ tag, className: "", textContent: "", style: {}, attrs: {}, width: null, height: null, src: null, alt: null, loading: null, setAttribute(k, v) { this.attrs[k] = v; } });
function provider(residents) {
  const doc = { createElement: makeNode };
  return new Function("document", `${CODE}\nfaces = ${JSON.stringify(residents)};\nreturn { faceForSpeaker, setFaces(f) { faces = f; } };`)(doc);
}

const RESIDENTS = {
  pica: { name: "Pica", avatar: "/media/pica-avatar-card.jpg", color: "#2f5aa8" },
  noe: { name: "Noe", avatar: null, color: "#c0703c" },
  bad: { name: "Bad", avatar: "javascript:alert(1)", color: "#00bfff" },
};

test("a resident with a public picture gets the picture: a fresh node per call, so a repeated speaker never takes an earlier statement's face", () => {
  const { faceForSpeaker } = provider(RESIDENTS);
  const a = faceForSpeaker("pica"), b = faceForSpeaker("pica");
  assert.equal(a.tag, "img");
  assert.equal(a.src, "/media/pica-avatar-card.jpg");
  assert.equal(a.alt, "", "decorative");
  assert.match(a.className, /\bc-face\b/);
  assert.notEqual(a, b, "a fresh node every call");
});

test("no picture, or a picture nobody can vouch for, is the letter on the resident's colour; the words are never held back", () => {
  const { faceForSpeaker } = provider(RESIDENTS);
  const noe = faceForSpeaker("noe");
  assert.equal(noe.tag, "span");
  assert.equal(noe.textContent, "N");
  assert.match(noe.className, /\bis-mono\b/);
  assert.equal(noe.style.background, "#c0703c");
  assert.equal(noe.attrs["aria-hidden"], "true", "decorative");
  const bad = faceForSpeaker("bad");
  assert.equal(bad.tag, "span", "a refused address is a letter, never an <img>");
  assert.equal(bad.textContent, "B");
  const unknown = faceForSpeaker("someone-new");
  assert.equal(unknown.textContent, "S", "a handle the residents list does not hold: its first letter");
});

test("the human of a house is the dashed chip with their letter and never a photo, whatever the residents list says", () => {
  const { faceForSpeaker } = provider({ ...RESIDENTS, "human-of-pica": { name: "x", avatar: "/media/should-never-show.jpg", color: "#fff" } });
  const h = faceForSpeaker("human-of-pica");
  assert.equal(h.tag, "span");
  assert.match(h.className, /\bis-human\b/);
  assert.equal(h.textContent, "P");
  assert.equal(h.src, null, "no picture");
  assert.equal(h.attrs["aria-hidden"], "true");
});

test("before the residents list lands the provider still answers (letters); an empty or missing handle is no face, and it never throws", () => {
  const p = provider(null);
  assert.equal(p.faceForSpeaker("pica").textContent, "P");
  for (const none of ["", "   ", null, undefined]) assert.equal(p.faceForSpeaker(none), null);
  assert.doesNotThrow(() => p.faceForSpeaker({ toString() { throw new Error("hostile"); } }));
  assert.equal(p.faceForSpeaker({ toString() { throw new Error("hostile"); } }), null);
});

// ── the option reaches the reader only when given ──
const fakeModule = () => { const seen = []; return { seen, mod: { READER_CSS: "", createCircleReader(opts) { seen.push(opts); return { showRoom: async () => {} }; } } }; };
const doc = { querySelector: () => null, createElement: () => ({ setAttribute() {}, append() {} }), head: { append() {} }, documentElement: { append() {} } };

test("mountRoom hands the provider on when given, and builds the reader with EXACTLY its old options when it is not (the event page, the gallery)", async () => {
  const provide = () => null;
  const withIt = fakeModule();
  await mountRoom({ doc, host: {}, roomId: "r1", importImpl: async () => withIt.mod, faceForSpeaker: provide });
  assert.equal(withIt.seen[0].faceForSpeaker, provide);
  for (const absent of [undefined, null, "not a function", 5]) {
    const bare = fakeModule();
    await mountRoom({ doc, host: {}, roomId: "r1", importImpl: async () => bare.mod, ...(absent === undefined ? {} : { faceForSpeaker: absent }) });
    assert.deepEqual(Object.keys(bare.seen[0]).sort(), ["canReply", "doc", "host", "hrefForCircle", "onNavigate", "onReply", "roomId", "source"], `no faceForSpeaker key for ${String(absent)}`);
  }
});

test("mountRoom hands `hostOwnsHeader` on ONLY when it is strictly true; every other caller (the event page, the gallery) builds the reader with its old options", async () => {
  const owned = fakeModule();
  await mountRoom({ doc, host: {}, roomId: "r1", importImpl: async () => owned.mod, hostOwnsHeader: true });
  assert.equal(owned.seen[0].hostOwnsHeader, true);
  for (const notTrue of [undefined, false, null, "true", 1, {}]) {
    const bare = fakeModule();
    await mountRoom({ doc, host: {}, roomId: "r1", importImpl: async () => bare.mod, ...(notTrue === undefined ? {} : { hostOwnsHeader: notTrue }) });
    assert.equal("hostOwnsHeader" in bare.seen[0], false, `no hostOwnsHeader key for ${JSON.stringify(notTrue)}`);
    assert.deepEqual(Object.keys(bare.seen[0]).sort(), ["canReply", "doc", "host", "hrefForCircle", "onNavigate", "onReply", "roomId", "source"]);
  }
});

test("the page's mount door forwards the provider the same way, and the inline poller gives it on every mount (live and closed cards alike)", () => {
  assert.match(page, /async mount\(host, roomId, \{ onState = null, faceForSpeaker = null, hostOwnsHeader = false \} = \{\}\)/);
  assert.match(page, /\.\.\.\(typeof faceForSpeaker === "function" \? \{ faceForSpeaker \} : \{\}\)/, "only when the page gave one");
  assert.match(page, /\.\.\.\(hostOwnsHeader === true \? \{ hostOwnsHeader: true \} : \{\}\)/, "the header option goes on only when strictly true");
  assert.match(page, /rec\.ready = h\.mount\(host, String\(t\.id\), \{\s*faceForSpeaker: faceForSpeaker,\s*hostOwnsHeader: true,/, "ensureReader is the one mount, for every card, and the page says it owns the header");
  assert.match(MOUNT, /\.\.\.\(typeof faceForSpeaker === "function" \? \{ faceForSpeaker \} : \{\}\)/);
  assert.match(page, /refreshReaders\(liveBox, true\); refreshReaders\(closedBox, true\);\s*\}\s*\}\)/, "the pictures landing after a reader drew ask it to redraw");
});

test("the face sits in the byline's own flow (about 20px, no gutter), and the human chip keeps the page's dashed style", () => {
  const css = page.match(/\.convo \.cr-head-line > \.c-face \{([^}]*)\}/)?.[1] ?? "";
  assert.match(css, /width: 20px; height: 20px/);
  assert.match(css, /display: inline-grid/);
  assert.ok(!/position:\s*absolute|padding-left|margin-left/.test(css), "no gutter on the statement");
  assert.match(page, /\.convo \.c-face\.is-human \{/);
});
