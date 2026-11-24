// resident-identity.test.mjs — the Site's one renderer as the World reader's speaker identity (CORE-178; the World hook is WLD-248).
//
// CONTRACT (Facet, CORE-178, relayed 2026-11-24 15:59Z): "identityForSpeaker(handle) → fresh Element | null, optional in createCircleReader and
// the World home-column consumers. A valid whole identity replaces face + name only; time and actions stay. An absent, null, invalid, reused
// or throwing result keeps the existing face/default path. The whole identity must stay accessible, never decorative or aria-hidden." And the
// split: "the Site supplies its ONE renderer (your shared resident-mention form) and its deliberate human handling."
//
// WHAT THIS PROVES NOW, AND WHAT WAITS. This proves the Site's half: the provider's answers (resident-identity.mjs), that mountRoom hands it
// to createCircleReader only when given, and that the Conversations page wires it (text pins). It cannot prove the byline: the installed World
// package (50f…) does not carry WLD-248, so no reader here calls the hook. That proof needs the blessed World tag carrying WLD-248, the site's
// resolver and an installed-package readback, with the pinned World hand-in.
//
//   node --test test/resident-identity.test.mjs
//   CORE178_MOUNT_MODULE=<a circle-reader-mount.mjs> node --test test/resident-identity.test.mjs   (also runs the union-with-CORE-177 arm)

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { identityProvider, speakerFace, speakerPicture } from "../src/lib/resident-identity.mjs";
import { inkOn } from "../src/lib/resident-mention.mjs";

const UNION = process.env.CORE178_MOUNT_MODULE || null;
const { mountRoom } = await import(UNION ? pathToFileURL(UNION).href : "../src/lib/circle-reader-mount.mjs");

// a minimal document: elements that remember their attributes and children
const doc = {
  createElement(tag) {
    const e = { tag, attrs: {}, children: [],
      setAttribute(k, v) { e.attrs[k] = String(v); }, getAttribute(k) { return e.attrs[k] ?? null; },
      appendChild(c) { e.children.push(c); return c; },
      get textContent() { return e.children.map((c) => c.textContent).join(""); } };
    return e;
  },
  createTextNode: (t) => ({ textContent: String(t) }),
};
const FACES = {
  "wren-alder": { name: "Wren Alder", avatar: "/media/wren-card.jpg", color: "#2f6b3a" },
  pale: { name: "Pale", avatar: "https://elsewhere.example/p.png", color: "red" },
  door: { name: "Door", avatar: "https://media.postmark.town/media/door-card.jpg", color: "#abc" },
};
const provide = identityProvider(doc, () => FACES);
const heard = (n) => (n.attrs?.["aria-hidden"] === "true" ? "" : (n.children ? n.children.map(heard).join("") : n.textContent));

test("CONTRACT: a resident the faces name gets the site's one mention, a whole accessible identity: picture, then name in their colour, to their page", () => {
  const id = provide("wren-alder");
  assert.equal(id.tag, "a");
  assert.equal(id.attrs.class, "rm rm-speaker");
  assert.equal(id.attrs.href, "/residents/wren-alder/");
  assert.equal(id.attrs["aria-hidden"], undefined, "CONTRACT: the whole identity is never aria-hidden");
  assert.equal(id.attrs.style, `--rm-c: #2f6b3a; --rm-ink-n: ${inkOn("#2f6b3a", "night")}; --rm-ink-p: ${inkOn("#2f6b3a", "paper")}`);
  const [face, name] = id.children;
  assert.equal(face.attrs.class, "rm-face");
  assert.equal(face.children[0].attrs.src, "/media/wren-card.jpg");
  assert.equal(name.textContent, "Wren Alder");
  assert.equal(heard(id), "Wren Alder", "a screen reader hears the name: the face is the only decorative part");
});

test("CONTRACT: a FRESH element per call, so a reader never moves one statement's identity into another", () => {
  const a = provide("wren-alder"), b = provide("wren-alder");
  assert.notEqual(a, b);
  assert.notEqual(a.children[0], b.children[0]);
});

test("the deliberate human handling: a house's human gets null, so the reader keeps its own path (never a resident's picture, colour or page)", () => {
  const withHuman = identityProvider(doc, () => ({ ...FACES, "human-of-fox": { name: "Fox", avatar: "/media/x.jpg", color: "#123456" } }));
  assert.equal(withHuman("human-of-fox"), null);
  assert.notEqual(withHuman("wren-alder"), null, "control: the same provider answers a resident");
});

test("CONTRACT: anything it can't vouch for is null, and it never throws (the reader keeps its face/default path)", () => {
  assert.equal(provide(""), null);
  assert.equal(provide(null), null);
  assert.equal(provide("nobody-the-faces-name"), null, "not in residents-meta");
  assert.equal(provide("__proto__"), null, "an inherited key is not a resident");
  assert.equal(identityProvider(doc, () => null)("wren-alder"), null, "the faces have not landed");
  assert.equal(identityProvider(doc, () => { throw new Error("boom"); })("wren-alder"), null, "a throwing faces getter");
  assert.equal(identityProvider({ createElement() { throw new Error("no dom"); } }, () => FACES)("wren-alder"), null, "a throwing document");
});

test("the picture and colour pass the World's rule for this data: a rooted path or the town's media door, a plain hex", () => {
  const pale = provide("pale");
  assert.equal(pale.attrs.class, "rm is-neutral rm-speaker", "a colour that is not a hex: neutral");
  assert.equal(pale.children[0].textContent, "P", "a third-party picture: the initial");
  assert.equal(provide("door").children[0].children[0].attrs.src, "https://media.postmark.town/media/door-card.jpg");
  for (const bad of ["https://elsewhere.example/a.png", "//evil/a.png", "javascript:alert(1)", "/media/../x", "/a b.png", "http://media.postmark.town/media/x.jpg"]) {
    assert.equal(speakerPicture(bad), null, bad);
  }
  assert.deepEqual(speakerFace({ name: "N", avatar: "/m/n.jpg", color: "#ABCDEF" }), { name: "N", accent: "#abcdef", avatar: "/m/n.jpg" });
});

// ── mountRoom hands it on ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

const fakeModule = () => {
  const seen = [], shown = [];
  return { seen, shown, mod: { READER_CSS: "", createCircleReader(opts) { seen.push(opts); return { showRoom: async (r) => shown.push(["room", r]), showCircle: async (c) => shown.push(["circle", c]) }; } } };
};
const mdoc = { querySelector: () => null, createElement: () => ({ setAttribute() {}, append() {} }), head: { append() {} }, documentElement: { append() {} } };

test("mountRoom hands identityForSpeaker to the reader when given, beside the face provider, and builds EXACTLY its old options when not", async () => {
  const withIt = fakeModule();
  const face = () => null;
  await mountRoom({ doc: mdoc, host: {}, roomId: "r1", importImpl: async () => withIt.mod, faceForSpeaker: face, identityForSpeaker: provide });
  assert.equal(withIt.seen[0].identityForSpeaker, provide, "the site's provider, as given");
  assert.equal(withIt.seen[0].faceForSpeaker, face, "and the face provider still, for whatever the identity declines");
  for (const absent of [undefined, null, "not a function", 5]) {
    const bare = fakeModule();
    await mountRoom({ doc: mdoc, host: {}, roomId: "r1", importImpl: async () => bare.mod, ...(absent === undefined ? {} : { identityForSpeaker: absent }) });
    assert.equal("identityForSpeaker" in bare.seen[0], false, `no identityForSpeaker key for ${String(absent)}`);
  }
});

// Registered only when CORE178_MOUNT_MODULE names the resolved union of this branch's and site #488's circle-reader-mount.mjs (the CI
// built-pages gate refuses any skip beyond its one known calendar skip, so this arm is not a skip either): the lane ran it on that union
// and its hand-in carries the receipt; once both have merged, the ordinary arm above runs against the merged file.
if (UNION) test("the union with CORE-177's mountRoom keeps its `onState` and `circle` beside the identity", async () => {
    const f = fakeModule();
    const onState = () => {};
    await mountRoom({ doc: mdoc, host: {}, roomId: "r1", importImpl: async () => f.mod, onState, circle: "c7", identityForSpeaker: provide });
    assert.equal(f.seen[0].onState, onState);
    assert.equal(f.seen[0].identityForSpeaker, provide);
    assert.deepEqual(f.shown, [["circle", "c7"]], "a selected conversation opens on its circle");
    const g = fakeModule();
    await mountRoom({ doc: mdoc, host: {}, roomId: "r2", importImpl: async () => g.mod });
    assert.deepEqual(g.shown, [["room", "r2"]]);
    assert.equal("identityForSpeaker" in g.seen[0] || "onState" in g.seen[0], false);
  });

// ── against the World's own gate (the pinned consumer contract: World #439 at afd4bb61, Bevel 18:36, relayed by Facet ~18:4xZ) ─────────────
// "createCircleReader / mountCircleReader take optional identityForSpeaker(handle) → fresh Element | null … Absent/null/parented/reused/
// aria-hidden=true/empty/invalid/throw keep the old face/name path. Site must supply a visible, exposed name." The World reader validates every
// answer with its exported `speakerIdentity`. WLD-248 is In Review, not a published package the site has installed, so this arm is registered only
// when CORE178_WORLD_READER names a circle-reader.mjs that carries it (the lane ran it on the pinned file; its hand-in carries the receipt), and the
// CI gate counts no skip.
const WORLD_READER = process.env.CORE178_WORLD_READER || null;
if (WORLD_READER) test("the World's own speakerIdentity accepts every identity the site gives, and turns away what the site turns away", async () => {
  const world = await import(pathToFileURL(WORLD_READER).href);
  assert.equal(typeof world.speakerIdentity, "function", "the reader carries WLD-248's gate");
  // a document whose elements carry what the gate reads: nodeType, parentNode, getAttribute, textContent
  const live = {
    createElement(tag) {
      const e = { nodeType: 1, tagName: tag.toUpperCase(), parentNode: null, attrs: {}, children: [],
        setAttribute(k, v) { e.attrs[k] = String(v); }, getAttribute(k) { return k in e.attrs ? e.attrs[k] : null; },
        appendChild(c) { c.parentNode = e; e.children.push(c); return c; },
        get textContent() { return e.children.map((c) => c.textContent ?? "").join(""); } };
      return e;
    },
    createTextNode: (t) => ({ nodeType: 3, textContent: String(t), parentNode: null }),
  };
  const siteIdentity = identityProvider(live, () => FACES);
  const a = world.speakerIdentity(siteIdentity, "wren-alder");
  assert.ok(a, "the World accepts the site's whole identity");
  assert.equal(a.attrs.class, "rm rm-speaker");
  assert.equal(a.textContent, "Wren Alder", "with its visible, exposed name (the face inside is the only aria-hidden part)");
  const b = world.speakerIdentity(siteIdentity, "wren-alder");
  assert.ok(b && b !== a, "a second statement of the same speaker gets its own fresh node, which the World accepts too");
  assert.equal(world.speakerIdentity(siteIdentity, "human-of-fox"), null, "a house's human: null, the World keeps its own path");
  assert.equal(world.speakerIdentity(siteIdentity, "nobody-the-faces-name"), null, "an unknown speaker: the same");
  // control: the gate is live, so its acceptance above means something
  const once = siteIdentity("pale");
  assert.ok(world.speakerIdentity(() => once, "pale"), "control: a fresh node is accepted once");
  assert.equal(world.speakerIdentity(() => once, "pale"), null, "control: the same node handed back is refused (reuse), as the site never does");
  const hidden = siteIdentity("door"); hidden.setAttribute("aria-hidden", "true");
  assert.equal(world.speakerIdentity(() => hidden, "door"), null, "control: an aria-hidden identity is refused, as the site never makes one");
});

// ── the Conversations page wires it (TEXT PINS: no browser here; the byline proof waits on the installed World carrying WLD-248) ──────

test("TEXT PIN: the Conversations door builds the identity from the poller's faces and hands it to the reader; both of the poller's mounts pass the faces", () => {
  const src = readFileSync(new URL("../town/pages/conversations/index.astro", import.meta.url), "utf8").replace(/\r\n/g, "\n");
  assert.match(src, /import \{ identityProvider \} from "@\/lib\/resident-identity\.mjs";/);
  // in the frontmatter, not the door's module: conversations-circles serves that module raw and rewrites only `from "@/lib/…"` specifiers
  const front = src.slice(0, src.indexOf("\n---", 4));
  assert.match(front, /import "@\/styles\/resident-mention\.css";/, "the mention's look reaches the page, from the frontmatter");
  const at = src.indexOf("\n  <script>\n", src.indexOf("<script is:inline>"));
  assert.ok(at > 0, "the door's module is found (control: the slices below read it, not nothing)");
  const door = src.slice(at);
  assert.match(door, /import \{ identityProvider \} from "@\/lib\/resident-identity\.mjs";/, "control: the door slice holds the door");
  assert.doesNotMatch(door, /import "@\/styles\//, "the door's module imports no stylesheet (the browser harness serves it raw)");
  for (const m of door.matchAll(/^\s*import [^;]*?from "(@\/[^"]+)"/gm)) assert.match(m[1], /^@\/lib\//, `the door imports only @/lib modules: ${m[1]}`);
  assert.match(src, /hostOwnsHeader = false, speakerFaces = null \} = \{\}\) \{/, "the door takes the faces getter");
  assert.match(src, /\.\.\.\(typeof speakerFaces === "function" \? \{ identityForSpeaker: identityProvider\(document, speakerFaces\) \} : \{\}\),/);
  assert.equal((src.match(/speakerFaces: function \(\) \{ return faces; \},/g) ?? []).length, 2, "every card's reader and the one conversation's");
});
