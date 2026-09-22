import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { readFileSync, readdirSync } from "node:fs";
import { extname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import {
  STORAGE_PREFIX,
  emptyState,
  evaluate,
  markDone,
  markShown,
  normalizeState,
  storageKey,
  validateRegistry,
} from "../src/lib/tutorial.mjs";
import { REGISTRY, DEMO_REGISTRY } from "../src/lib/tutorial-registry.mjs";

const content = { title: "A title", body: "A body" };

test("validateRegistry rejects missing fields and duplicate ids", () => {
  assert.throws(() => validateRegistry([{ trigger: "page:enter", content }]), /<missing>.*id/);
  assert.throws(() => validateRegistry([{ id: "no-trigger", content }]), /no-trigger.*trigger/);
  assert.throws(() => validateRegistry([
    { id: "same", trigger: "page:enter", content },
    { id: "same", trigger: "auth:signed-in", content },
  ]), /same.*duplicate/);
});

test("validateRegistry rejects invalid optional controls", () => {
  assert.throws(() => validateRegistry([{ id: "bad-when", trigger: "page:enter", when: true, content }]), /bad-when.*when/);
  assert.throws(() => validateRegistry([{ id: "bad-priority", trigger: "page:enter", priority: Infinity, content }]), /bad-priority.*priority/);
});

test("evaluate picks highest priority and breaks ties by registry order", () => {
  const registry = validateRegistry([
    { id: "first-high", trigger: "page:enter", priority: 4, content },
    { id: "second-high", trigger: "page:enter", priority: 4, content },
    { id: "low", trigger: "page:enter", priority: -1, content },
    { id: "other-event", trigger: "auth:signed-in", priority: 99, content },
  ]);
  assert.equal(evaluate(registry, emptyState(), "page:enter", {}), registry[0]);
});

test("evaluate skips shown and done tutorials", () => {
  const registry = validateRegistry([
    { id: "shown", trigger: "page:enter", priority: 9, content },
    { id: "done", trigger: "page:enter", priority: 8, content },
    { id: "unseen", trigger: "page:enter", content },
  ]);
  const state = {
    v: 1,
    tutorials: {
      shown: { status: "shown", shownAt: 10 },
      done: { status: "done", doneAt: 20 },
    },
  };
  assert.equal(evaluate(registry, state, "page:enter", {}), registry[2]);
});

test("a throwing when is ineligible without crashing evaluate", () => {
  const registry = validateRegistry([
    { id: "throws", trigger: "page:enter", priority: 10, when: () => { throw new Error("no"); }, content },
    { id: "fallback", trigger: "page:enter", when: (ctx) => ctx.ready, content },
  ]);
  assert.equal(evaluate(registry, emptyState(), "page:enter", { ready: true }), registry[1]);
  assert.equal(evaluate(registry, emptyState(), "page:enter", { ready: false }), null);
});

test("markShown is immutable, idempotent, and never regresses done", () => {
  const initial = emptyState();
  const shown = markShown(initial, "welcome", 100);
  assert.notEqual(shown, initial);
  assert.deepEqual(initial, { v: 1, tutorials: {} });
  assert.deepEqual(shown.tutorials.welcome, { status: "shown", shownAt: 100 });
  assert.equal(markShown(shown, "welcome", 200), shown);

  const done = markDone(shown, "welcome", 300);
  assert.equal(markShown(done, "welcome", 400), done);
  assert.deepEqual(done.tutorials.welcome, { status: "done", shownAt: 100, doneAt: 300 });
});

test("markDone preserves shownAt, creates missing records, and is idempotent", () => {
  const shown = markShown(emptyState(), "welcome", 100);
  const done = markDone(shown, "welcome", 200);
  assert.notEqual(done, shown);
  assert.deepEqual(done.tutorials.welcome, { status: "done", shownAt: 100, doneAt: 200 });
  assert.equal(markDone(done, "welcome", 300), done);

  assert.deepEqual(markDone(emptyState(), "direct", 400).tutorials.direct, { status: "done", doneAt: 400 });
});

test("normalizeState rejects malformed and wrong-version data but passes valid state through", () => {
  assert.deepEqual(normalizeState(null), emptyState());
  assert.deepEqual(normalizeState({ v: 1, tutorials: [] }), emptyState());
  assert.deepEqual(normalizeState({ v: 2, tutorials: {} }), emptyState());
  assert.deepEqual(normalizeState({ v: 1, tutorials: { broken: null } }), emptyState());

  const valid = { v: 1, tutorials: { welcome: { status: "shown", shownAt: 100 } } };
  assert.equal(normalizeState(valid), valid);
  assert.deepEqual(normalizeState(JSON.parse(JSON.stringify(valid))), valid);
});

test("storageKey namespaces tutorial state by household", () => {
  assert.equal(STORAGE_PREFIX, "pm.tutorial.state.");
  assert.equal(storageKey("wright,keemin"), "pm.tutorial.state.wright,keemin");
  assert.notEqual(storageKey("wright"), storageKey("keemin"));
});

// ── EVERY REGISTERED TRIGGER HAS AN EMITTER ──────────────────────────────────
//
// THE BUG THIS EXISTS FOR (postmark#1792, found 2026-08-15, fixed 2026-09-21).
// The registry held six join-page notes and three of them rode events nothing
// in the site ever emitted — `join:lane-chosen` twice and `prompt:copied` once.
// Half the authored onboarding content had never once appeared for any reader,
// and nothing said so: every engine test above runs against its own fixture
// registry, so the LIVE registry's triggers were never compared to the source
// at all. TUTORIALS.md's event list was honest; the registry was not, and an
// author following the guide could add a note on a made-up event and ship green.
//
// So this is the check that would have caught it on the day: the registry's
// triggers, against the `pmTutorialEmit(...)` call sites in the source. It lives
// in the file TUTORIALS.md's authoring loop already tells a contributor to run,
// because the moment the defect is born is the moment a new entry is written.
//
// ONE DIRECTION ONLY, on purpose. A trigger with no emitter is a note that can
// never appear — the defect. An emitter with no trigger is an event standing
// open for a note nobody has written yet, which is what a contribution surface
// looks like; `join:lane-chosen` is exactly that today, after both of its notes
// were found to describe a join page that no longer exists, and it must not go
// red for it. Asserting the reverse would make the site harder to author for in
// the name of catching nothing.

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SRC_ROOTS = ["src", "town"];
const SRC_EXT = new Set([".astro", ".mjs", ".js", ".ts"]);

function sourceFiles(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      sourceFiles(full, out);
    } else if (SRC_EXT.has(extname(entry.name))) {
      out.push(full);
    }
  }
  return out;
}

// PROSE ABOUT AN EVENT IS NOT AN EMITTER. A comment naming a call would satisfy
// a bare grep, and a check a comment can satisfy is not a check — the registry
// now carries several paragraphs about `join:lane-chosen` precisely because its
// notes were deleted. Only whole comment LINES are dropped, never a trailing
// `//` mid-line: a `//` inside a string or a URL is not a comment opener, and an
// emit call is never written on a line that begins with one.
const stripCommentLines = (text) =>
  text.split(/\r?\n/).filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line)).join("\n");

function emitSites() {
  const sites = new Map();
  for (const dir of SRC_ROOTS) {
    for (const file of sourceFiles(join(ROOT, dir))) {
      const code = stripCommentLines(readFileSync(file, "utf8"));
      for (const m of code.matchAll(/pmTutorialEmit\s*\(\s*["'`]([^"'`]+)["'`]/g)) {
        const where = relative(ROOT, file).split(sep).join("/");
        const seen = sites.get(m[1]) ?? [];
        if (!seen.includes(where)) seen.push(where);
        sites.set(m[1], seen);
      }
    }
  }
  return sites;
}

test("every registered trigger has an emitter in the source", () => {
  // CAN FAIL: delete either emit line — PostmarkLayout's `prompt:copied` or the
  // join page's `join:lane-chosen` — and this names the orphaned trigger, the
  // entry that rides it, and every event the source still does emit.
  const sites = emitSites();
  assert.ok(sites.size > 0, "no pmTutorialEmit call sites found at all — the scan is looking in the wrong place");

  const orphans = [];
  for (const [label, registry] of [["REGISTRY", REGISTRY], ["DEMO_REGISTRY", DEMO_REGISTRY]]) {
    for (const entry of registry) {
      if (!sites.has(entry.trigger)) orphans.push(`${label}: ${entry.id} triggers on "${entry.trigger}", which nothing emits`);
    }
  }
  assert.deepEqual(orphans, [],
    `a tutorial can never appear, because no source file emits its event:\n  ${orphans.join("\n  ")}\n  ` +
    `(events the source does emit: ${[...sites.keys()].sort().join(", ")})`);
});

test("each event is emitted from the file the note's moment lives in", () => {
  // CAN FAIL: move either emit to another file and the path named here goes
  // stale. The point is not that SOME file emits — it is that the emit sits at
  // the moment the note describes, which is a claim about WHICH file.
  const sites = emitSites();
  assert.deepEqual(sites.get("page:enter"), ["src/layouts/PostmarkLayout.astro"]);
  assert.deepEqual(sites.get("auth:signed-in"), ["src/layouts/PostmarkLayout.astro"]);
  assert.deepEqual(sites.get("resident:first-recognized"), ["src/layouts/PostmarkLayout.astro"]);
  assert.deepEqual(sites.get("prompt:copied"), ["src/layouts/PostmarkLayout.astro"],
    "the copy button's emit left the layout, where every .prompt-box on the site is wired");
  assert.deepEqual(sites.get("join:lane-chosen"), ["town/pages/join/index.astro"],
    "the lane card's emit left the join page, the only page that has lane cards");
});

// ── THE EMITTERS, RUN ────────────────────────────────────────────────────────
//
// A path in a file is not a click. These slice the two real handlers out of the
// real sources and run them in a `vm` against the smallest document that can
// hold a button, then click it — the same shape test/quest-board-render.test.mjs
// uses for Household.astro, and for the same reason: both scripts live inline in
// an .astro file, so neither can be imported, and a regex over the file cannot
// answer "does the click emit".

function slice(file, open, close) {
  const text = readFileSync(new URL(`../${file}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
  const a = text.indexOf(open);
  assert.ok(a >= 0, `${file} no longer contains the opening anchor: ${open}`);
  const b = text.indexOf(close, a + open.length);
  assert.ok(b > a, `${file} no longer contains the closing anchor: ${close}`);
  return text.slice(a, b);
}

const node = (attrs = {}) => ({
  attrs,
  listeners: {},
  hidden: false,
  textContent: "",
  classList: { add() {}, remove() {}, toggle() {} },
  getAttribute(k) { return this.attrs[k] ?? null; },
  setAttribute(k, v) { this.attrs[k] = String(v); },
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); },
  querySelector: () => null,
  click() { (this.listeners.click || []).forEach((fn) => fn.call(this, {})); },
});

const docOf = (map) => ({
  querySelector: (sel) => (map[sel] ?? [])[0] ?? null,
  querySelectorAll: (sel) => map[sel] ?? [],
  createRange: () => ({ selectNodeContents() {} }),
});

const CHOOSER = ["town/pages/join/index.astro", "// the two-door chooser", "// copy-the-prompt is wired sitewide"];

function runChooser(hash) {
  const tabs = [node({ "data-lane-tab": "hands" }), node({ "data-lane-tab": "chat" })];
  const lanes = [node({ "data-lane": "hands" }), node({ "data-lane": "chat" })];
  const document = docOf({ "[data-lane-tab]": tabs, "[data-lane]": lanes, ".lane-pick": [node()] });
  const seen = [];
  const window = {
    pmPageCtx: () => ({ path: "/join/", page: "join" }),
    pmTutorialEmit: (name, ctx) => seen.push({ name, ctx }),
  };
  vm.runInContext(slice(...CHOOSER), vm.createContext({
    document, window, location: { hash }, Array, Object, String, Boolean,
  }), { filename: "join/index.astro#chooser" });
  return { tabs, seen };
}

test("clicking a lane card emits join:lane-chosen carrying the lane key", () => {
  // CAN FAIL: drop the emit from the chooser and `seen` stays empty.
  const { tabs, seen } = runChooser("");
  tabs[0].click();
  tabs[1].click();

  assert.deepEqual(seen.map((e) => e.name), ["join:lane-chosen", "join:lane-chosen"]);
  assert.deepEqual(seen.map((e) => e.ctx.lane), ["hands", "chat"],
    "the event no longer says WHICH door was taken, which is the only thing a lane note can read");
  assert.equal(seen[0].ctx.page, "join",
    "the lane event dropped the page context every `when:` clause is written against");
});

test("a #hands deep-link opens its lane without emitting — the click is the moment", () => {
  // CAN FAIL: move the emit inside pick() and this goes red, because pick() is
  // also what the deep-link calls. A reader who arrived on /join/#hands already
  // knows which door they took; a note about the choice would answer a question
  // they did not ask here.
  const { tabs, seen } = runChooser("#hands");
  assert.deepEqual(seen, [], "arriving on /join/#hands fired a note about a choice made elsewhere");
  assert.equal(tabs[0].getAttribute("aria-selected"), "true", "the deep-link stopped opening its lane");
});

test("clicking a copy button emits prompt:copied, and the clipboard's answer cannot swallow it", () => {
  // CAN FAIL: delete the emit line in the layout's copy handler, or move it into
  // the `.then(...)`, and the refusing-clipboard case below stays empty. Firing
  // only on the happy path would hide the note from exactly the reader having
  // the worse time.
  const source = slice("src/layouts/PostmarkLayout.astro", "// Copy-the-prompt — wires EVERY .prompt-box", "</script>");

  for (const [what, clipboard] of [
    ["a clipboard that takes it", { writeText: () => Promise.resolve() }],
    ["a clipboard that refuses", { writeText: () => Promise.resolve().then(() => { throw new Error("denied"); }) }],
  ]) {
    const label = node();
    const btn = node({ "data-copy-prompt": "" });
    btn.querySelector = () => label;
    const pre = node();
    pre.textContent = "  paste me  ";
    const box = node();
    box.querySelector = (sel) => (sel === "[data-copy-prompt]" ? btn : sel === "[data-prompt-text]" ? pre : null);

    const seen = [];
    const window = { pmTutorialEmit: (name, ctx) => seen.push({ name, ctx }) };
    vm.runInContext(source, vm.createContext({
      document: docOf({ ".prompt-box": [box] }), window, navigator: { clipboard },
      setTimeout: () => {}, getSelection: () => ({ removeAllRanges() {}, addRange() {} }),
      Promise, Error, String, Object, Array,
    }), { filename: "PostmarkLayout.astro#copy" });

    btn.click();
    assert.deepEqual(seen.map((e) => e.name), ["prompt:copied"], `${what}: the copy button did not tell the tutorial bus`);
  }
});

// ── AND THE NOTE ACTUALLY COMES BACK ─────────────────────────────────────────

test("the live registry answers the emitters' events with the notes that ride them", () => {
  // The whole point of #1792 is that an event and a note have to MEET, so the
  // last check is the meeting itself: the real REGISTRY through the real
  // evaluate(). CAN FAIL: change join-two-knocks' trigger or its `when:`.
  const onJoin = { path: "/join/", page: "join" };

  assert.equal(evaluate(REGISTRY, emptyState(), "prompt:copied", onJoin)?.id, "join-two-knocks",
    "copying a prompt on /join/ raises no note");
  assert.equal(evaluate(REGISTRY, emptyState(), "prompt:copied", { path: "/", page: "home" }), null,
    "the copy note escaped the join page");

  // The three that already worked, unchanged.
  assert.equal(evaluate(REGISTRY, emptyState(), "page:enter", onJoin)?.id, "join-two-doors");
  assert.equal(evaluate(REGISTRY, emptyState(), "auth:signed-in", { path: "/mail/", page: "mail" })?.id, "signed-in-move-them-in");
  assert.equal(evaluate(REGISTRY, emptyState(), "resident:first-recognized", { path: "/mail/", page: "mail" })?.id, "first-recognized-doorstep");

  // And the two the daylight killed stay dead, so nothing aims at the old page.
  const ids = REGISTRY.map((e) => e.id);
  assert.ok(!ids.includes("join-github-already-yours"),
    "a note about a numbered step the join page no longer prints is back in the registry");
  assert.ok(!ids.includes("join-no-git-needed"),
    "a note about a git door the join page no longer offers is back in the registry");

  // Every surviving note is dismissible the same way the three working ones are:
  // the no-replay record is keyed on the id, and markDone is what the × writes.
  for (const entry of REGISTRY) {
    assert.notEqual(evaluate(REGISTRY, markDone(emptyState(), entry.id, 1), entry.trigger, onJoin)?.id, entry.id,
      `${entry.id} can be shown again after it was dismissed`);
  }
});
