// hearth-script-badge.test.mjs — a Hearth design that runs its own script carries a badge in the dropdown, and only such a design (Darko, 2026-11-13).
//
// LAW (Darko, 2026-11-13 13:24 EST): "any hearths that have any scripting in it needs to be disclosed ... via a little badge next to the hearth's name in the
// dropdown. Let's put it to the right. And on hover ... not using the browser Chrome hover, I mean like an actual site UI pane hover ... super concise ...
// the site has other scripts. Postmark does review them, but use at your own risk."
//
// What runs here: isScripted (which designs carry the badge), the listbox's key machine (createListbox, pure), and bindListbox on a small hand-rolled DOM
// (the site carries no DOM library) with the markup HearthPicker.astro renders. The built arm reads every built household page, when a build is present.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isScripted, createListbox, bindListbox, paintListbox, SCRIPT_NOTE, SCRIPT_BADGE } from "../src/lib/hearth/listbox.mjs";
import { scriptUrlOf } from "../src/lib/hearth/script.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const D1324 = "Darko 13:24: a scripted Hearth is disclosed by a badge to the right of its name in the dropdown";

// ── which designs carry the badge ────────────────────────────────────────────────────────────────────────────────────────────────────────────
test("isScripted: exactly the designs whose script the page would run (scriptUrlOf), never one without", () => {
  const cases = [
    [{ id: "glow", script: { hash: "0123456789abcdef", bytes: 10 } }, true],
    [{ id: "plain", script: null }, false],
    [{ id: "plain" }, false],
    [{ id: "bad", script: { hash: "not-hex!" } }, false],          // a script the page would not run is not disclosed as running
    [{ id: "../x", script: { hash: "0123456789abcdef" } }, false],
  ];
  for (const [e, want] of cases) {
    assert.equal(isScripted(e), want, `${e.id}: ${D1324}`);
    assert.equal(isScripted(e), scriptUrlOf(e) !== null, `${e.id}: the badge and the run are one test`);
  }
});

test("the pane's words are short and say what Darko said: its own script, reviewed, your own risk", () => {
  assert.ok(SCRIPT_NOTE.length <= 100, `super concise (${SCRIPT_NOTE.length} chars)`);
  assert.match(SCRIPT_NOTE, /runs its own script/);
  assert.match(SCRIPT_NOTE, /Postmark reviews/);
  assert.match(SCRIPT_NOTE, /at your own risk/);
});

// ── the key machine ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const OPTS = [
  { id: "default", title: "Postmark's default", scripted: false },
  { id: "ledger", title: "The ledger", scripted: false },
  { id: "glow", title: "Glow", scripted: true },
  { id: "garden", title: "Garden", scripted: false },
];

test("keys, closed: Down, Up, Enter and Space open on the current design; Home and End open at the ends; other keys pass through", () => {
  for (const k of ["ArrowDown", "ArrowUp", "Enter", " "]) {
    const m = createListbox({ options: OPTS, value: "ledger" });
    assert.deepEqual(m.key(k), { handled: true, chose: null }, k);
    assert.equal(m.view().open, true, `${k} opens`);
    assert.equal(m.view().activeId, "ledger", `${k} opens on the current design`);
  }
  const h = createListbox({ options: OPTS, value: "ledger" }); h.key("Home"); assert.equal(h.view().activeId, "default");
  const e = createListbox({ options: OPTS, value: "ledger" }); e.key("End"); assert.equal(e.view().activeId, "garden");
  const t = createListbox({ options: OPTS, value: "ledger" });
  assert.deepEqual(t.key("Tab"), { handled: false, chose: null });
  assert.equal(t.view().open, false);
});

test("keys, open: arrows move and stop at the ends; Enter or Space chooses and closes; Escape closes and chooses nothing; Tab closes and lets focus go", () => {
  const m = createListbox({ options: OPTS, value: "default" });
  m.key("ArrowDown");                                   // open on default
  m.key("ArrowUp"); assert.equal(m.view().activeId, "default", "stops at the top");
  m.key("ArrowDown"); m.key("ArrowDown"); assert.equal(m.view().activeId, "glow");
  m.key("End"); m.key("ArrowDown"); assert.equal(m.view().activeId, "garden", "stops at the bottom");
  m.key("Home"); assert.equal(m.view().activeId, "default");
  m.key("PageDown"); assert.equal(m.view().activeId, "garden", "a page down past the end lands on the end");
  m.key("ArrowUp");
  assert.deepEqual(m.key("Enter"), { handled: true, chose: "glow" });
  assert.equal(m.view().open, false);
  assert.equal(m.view().value, "glow");
  m.key(" "); m.key("ArrowDown");
  assert.deepEqual(m.key("Escape"), { handled: true, chose: null });
  assert.equal(m.view().value, "glow", "Escape chose nothing");
  assert.equal(m.view().activeId, "glow", "and the active option is the value again");
  m.key("ArrowDown"); m.key("ArrowDown");
  assert.deepEqual(m.key("Tab"), { handled: false, chose: null });
  assert.equal(m.view().value, "glow");
  m.key("ArrowDown"); m.key("ArrowUp", { alt: false });
  assert.deepEqual(m.key("ArrowUp", { alt: true }), { handled: true, chose: "ledger" }, "Alt+Up chooses the active option, as a native select does");
});

test("typing jumps to a design by its name, as a native select does: letters within a pause build a word; one letter again cycles", () => {
  const m = createListbox({ options: OPTS, value: "default" });
  m.key("g", { now: 1000 }); assert.equal(m.view().open, true, "a letter opens the list");
  assert.equal(m.view().activeId, "glow");
  m.key("g", { now: 1100 }); assert.equal(m.view().activeId, "garden", "g again: the next g");
  m.key("t", { now: 3000 }); assert.equal(m.view().activeId, "ledger", "after a pause, a new word: 'The ledger'");
  m.key("h", { now: 3100 }); m.key("e", { now: 3200 }); assert.equal(m.view().activeId, "ledger", "'the' still matches");
  m.key("x", { now: 9000 }); assert.equal(m.view().activeId, "ledger", "no match: the active option stays");
  assert.equal(m.view().value, "default", "typing moves the active option only; nothing is chosen");
});

test("a click picks; an empty list never opens", () => {
  const m = createListbox({ options: OPTS, value: "default" });
  m.toggle();
  assert.deepEqual(m.pick(2), { chose: "glow" });
  assert.equal(m.view().open, false);
  const none = createListbox({ options: [], value: null });
  none.key("ArrowDown");
  assert.equal(none.view().open, false);
});

// ── a hand-rolled DOM, just enough for the listbox ───────────────────────────────────────────────────────────────────────────────────────────
class El {
  constructor(tag, attrs = {}, kids = []) {
    this.tag = tag; this.attrs = {}; this.kids = []; this.parent = null; this.listeners = {}; this.style = {}; this._text = ""; this.value = "";
    this.classList = { set: new Set(), toggle: (c, on) => { if (on) this.classList.set.add(c); else this.classList.set.delete(c); }, contains: (c) => this.classList.set.has(c) };
    for (const [k, v] of Object.entries(attrs)) this.setAttribute(k, v);
    for (const k of kids) this.append(k);
  }
  append(k) { if (typeof k === "string") { this._text += k; return; } k.parent = this; this.kids.push(k); }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  removeAttribute(k) { delete this.attrs[k]; }
  hasAttribute(k) { return k in this.attrs; }
  get id() { return this.attrs.id ?? ""; }
  get hidden() { return "hidden" in this.attrs; }
  set hidden(v) { if (v) this.attrs.hidden = ""; else delete this.attrs.hidden; }
  get disabled() { return "disabled" in this.attrs; }
  set disabled(v) { if (v) this.attrs.disabled = ""; else delete this.attrs.disabled; }
  get dataset() {
    const d = {};
    for (const [k, v] of Object.entries(this.attrs)) if (k.startsWith("data-")) d[k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = v;
    return d;
  }
  get textContent() { return this._text + this.kids.map((k) => k.textContent).join(""); }
  set textContent(v) { this._text = String(v); this.kids = []; }
  get offsetWidth() { return 200; }
  getBoundingClientRect() { return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }; }
  contains(n) { for (let x = n; x; x = x.parent) if (x === this) return true; return false; }
  closest(sel) { for (let x = this; x; x = x.parent) if (matchOne(x, sel)) return x; return null; }
  *all() { for (const k of this.kids) { yield k; yield* k.all(); } }
  querySelectorAll(sel) {
    const parts = sel.trim().split(/\s+/);
    return [...this.all()].filter((el) => {
      if (!matchOne(el, parts.at(-1))) return false;
      let i = parts.length - 2;
      for (let x = el.parent; x && i >= 0; x = x.parent) if (x !== this.parent && matchOne(x, parts[i])) i--;
      return i < 0;
    });
  }
  querySelector(sel) { return this.querySelectorAll(sel)[0] ?? null; }
  addEventListener(t, f) { (this.listeners[t] ??= []).push(f); }
  dispatchEvent(ev) { for (const f of this.listeners[ev.type] ?? []) f(ev); return true; }
  focus() { FOCUSED.el = this; }
  scrollIntoView() {}
}
const FOCUSED = { el: null };
function matchOne(el, sel) {
  const m = /^\[([a-z-]+)(?:="([^"]*)")?\]$/.exec(sel);
  if (!m) return false;
  return m[1] in el.attrs && (m[2] === undefined || el.attrs[m[1]] === m[2]);
}
function fire(el, type, extra = {}) {
  const ev = { type, target: extra.target ?? el, key: extra.key, altKey: !!extra.altKey, detail: extra.detail ?? 1, pointerType: extra.pointerType, prevented: false, preventDefault() { this.prevented = true; }, stopPropagation() {} };
  for (const f of el.listeners[type] ?? []) f(ev);
  return ev;
}

/** The markup HearthPicker.astro renders, for `entries` with `selected` current. */
function pickerDom(entries, selected) {
  const select = new El("select", { "data-hearth-pick": "", disabled: "", hidden: "" });
  select.value = selected;
  const lis = entries.map((e) => new El("li", {
    role: "option", id: `hearth-opt-${e.id}`, "data-value": e.id, "data-title": e.title, "aria-selected": String(e.id === selected),
    ...(e.scripted ? { "data-scripted": "", "aria-describedby": "hearth-script-tip" } : {}),
  }, [new El("span", { class: "hearth-lb-name" }, [e.title]), ...(e.scripted ? [new El("span", { "data-hearth-script": "", "aria-hidden": "true" }, ["script"])] : [])]));
  const list = new El("ul", { "data-hearth-lb-list": "", role: "listbox", hidden: "" }, lis);
  const label = new El("span", { "data-hearth-lb-label": "" }, [entries.find((e) => e.id === selected)?.title ?? ""]);
  const btn = new El("button", { "data-hearth-lb-btn": "", role: "combobox", "aria-expanded": "false", disabled: "" }, [label]);
  const wrap = new El("span", { "data-hearth-lb": "" }, [btn, list]);
  const now = new El("button", { "data-hearth-script-now": "", "aria-describedby": "hearth-script-tip", ...(entries.find((e) => e.id === selected)?.scripted ? {} : { hidden: "" }) }, ["script"]);
  const tip = new El("span", { "data-hearth-script-tip": "", role: "tooltip", hidden: "" }, [SCRIPT_NOTE]);
  const root = new El("div", { "data-hearth-picker": "" }, [select, wrap, now, tip]);
  const doc = new El("doc");
  return { root, select, list, lis, label, btn, now, tip, doc };
}
const badgeIn = (li) => li.querySelector("[data-hearth-script]");

test("the badge is on the scripted designs only, in the list and beside the current design's name; it follows the drawn design", () => {
  const d = pickerDom(OPTS, "default");
  bindListbox(d.root, { doc: d.doc, win: { innerWidth: 1024, addEventListener() {} } });
  assert.deepEqual(d.lis.map((li) => [li.dataset.value, !!badgeIn(li)]), OPTS.map((o) => [o.id, o.scripted]), D1324);
  for (const li of d.lis) {
    assert.equal(li.getAttribute("aria-describedby") === "hearth-script-tip", !!badgeIn(li), `${li.dataset.value}: a reader of the list hears the pane's sentence where the badge is`);
    if (badgeIn(li)) assert.equal(badgeIn(li).getAttribute("aria-hidden"), "true", "and the mark itself is not read twice");
  }
  assert.equal(d.now.hidden, true, "the default runs no script: no badge beside its name");
  // the page draws glow (a preview, or the saved choice): the stage sets the select and repaints
  d.select.value = "glow"; paintListbox(d.root);
  assert.equal(d.now.hidden, false, "glow runs its own script: the badge beside its name");
  assert.equal(d.label.textContent, "Glow");
  d.select.value = "ledger"; paintListbox(d.root);
  assert.equal(d.now.hidden, true, "back to a design without a script: no badge");
});

test("before it is bound, paintListbox still draws the current design's name and badge from the select", () => {
  const d = pickerDom(OPTS, "default");
  d.select.value = "glow"; paintListbox(d.root);
  assert.equal(d.label.textContent, "Glow");
  assert.equal(d.now.hidden, false);
  assert.equal(d.btn.disabled, true, "unbound: still disabled, as it ships");
});

test("the listbox stands for the select: it mirrors disabled and a failed save's mark, hides the select, and a choice sets the select and fires its change", () => {
  const d = pickerDom(OPTS, "default");
  const changes = [];
  d.select.addEventListener("change", () => changes.push(d.select.value));
  bindListbox(d.root, { doc: d.doc, win: { innerWidth: 1024, addEventListener() {} } });
  assert.equal(d.select.hidden, true);
  assert.equal(d.btn.disabled, true, "the select is disabled until the picker mounts, and so is the button");
  d.select.disabled = false; paintListbox(d.root);
  assert.equal(d.btn.disabled, false);
  fire(d.btn, "click");
  assert.equal(d.list.hidden, false, "a click opens the list");
  assert.equal(d.btn.getAttribute("aria-expanded"), "true");
  fire(d.lis[2], "click");
  assert.deepEqual(changes, ["glow"], "choosing glow set the select and fired its change (picker.mjs hears it: a preview)");
  assert.equal(d.list.hidden, true);
  assert.equal(d.lis[2].getAttribute("aria-selected"), "true");
  assert.equal(d.lis[0].getAttribute("aria-selected"), "false");
  fire(d.btn, "click"); fire(d.lis[2], "click");
  assert.deepEqual(changes, ["glow"], "choosing the design already shown fires nothing");
  d.select.setAttribute("aria-invalid", "true"); paintListbox(d.root);
  assert.equal(d.btn.getAttribute("aria-invalid"), "true", "a save that did not land marks the button, as it marked the select");
  // the keyboard: Down opens, Down moves (aria-activedescendant names it), Enter chooses
  fire(d.btn, "keydown", { key: "ArrowDown" });
  assert.equal(d.btn.getAttribute("aria-activedescendant"), "hearth-opt-glow");
  const ev = fire(d.btn, "keydown", { key: "ArrowDown" });
  assert.equal(ev.prevented, true, "a handled key does not also click or scroll");
  assert.equal(d.btn.getAttribute("aria-activedescendant"), "hearth-opt-garden");
  fire(d.btn, "keydown", { key: "Enter" });
  assert.deepEqual(changes, ["glow", "garden"]);
});

test("the pane: hover shows it and leaving hides it; keyboard focus shows it; a tap pins it until a tap elsewhere; Escape closes it", () => {
  const d = pickerDom(OPTS, "glow");
  const inst = bindListbox(d.root, { doc: d.doc, win: { innerWidth: 1024, addEventListener() {} } });
  d.select.disabled = false; paintListbox(d.root);
  assert.equal(d.tip.hidden, true, "closed at first");
  assert.equal(d.tip.textContent, SCRIPT_NOTE);
  assert.equal(d.tip.getAttribute("role"), "tooltip", "a pane on the page, not a title attribute");
  assert.equal(d.now.getAttribute("title"), null);
  fire(d.now, "pointerenter", { pointerType: "mouse" }); assert.equal(d.tip.hidden, false, "hover");
  fire(d.now, "pointerleave", { pointerType: "mouse" }); assert.equal(d.tip.hidden, true, "away");
  fire(d.now, "focus"); assert.equal(d.tip.hidden, false, "keyboard focus");
  fire(d.now, "blur"); assert.equal(d.tip.hidden, true);
  // a tap: the touch's focus, then its click: pinned open
  fire(d.now, "focus"); fire(d.now, "click", { pointerType: "touch" });
  assert.equal(d.tip.hidden, false); assert.equal(inst.tip.pinned, true);
  fire(d.now, "blur"); assert.equal(d.tip.hidden, false, "a pinned pane stays when focus moves");
  fire(d.doc, "pointerdown", { target: d.now }); assert.equal(d.tip.hidden, false, "a tap on the badge itself is not 'elsewhere'");
  fire(d.doc, "pointerdown", { target: d.label }); assert.equal(d.tip.hidden, true, "a tap elsewhere closes it");
  fire(d.now, "click"); assert.equal(d.tip.hidden, false, "tap again: open");
  fire(d.now, "click"); assert.equal(d.tip.hidden, true, "and tap again: closed (a tap toggles)");
  fire(d.now, "click"); fire(d.doc, "keydown", { key: "Escape" }); assert.equal(d.tip.hidden, true, "Escape");
  // in the list: a badge's hover shows the pane, and a click on the badge is the pane's, not a choice
  const changes = [];
  d.select.addEventListener("change", () => changes.push(d.select.value));
  fire(d.btn, "click");   // the current design is glow, scripted: the list opens with glow active
  assert.equal(d.list.hidden, false);
  assert.equal(d.btn.getAttribute("aria-activedescendant"), "hearth-opt-glow", "the active option is the scripted one");
  assert.equal(d.tip.hidden, true, "a pointer that opens the list opens no pane over it");
  fire(d.btn, "click");   // closed again
  d.select.value = "default"; paintListbox(d.root);
  fire(d.btn, "click");
  const b = badgeIn(d.lis[2]);
  fire(b, "pointerenter", { pointerType: "mouse" }); assert.equal(d.tip.hidden, false);
  fire(b, "click"); fire(d.lis[2], "click", { target: b });
  assert.deepEqual(changes, [], "clicking the badge chose nothing");
  assert.equal(d.list.hidden, false, "and the list stays open");
});

test("by keyboard in the list, the pane shows while a scripted design is active, and goes when the active design has none", () => {
  const d = pickerDom(OPTS, "ledger");
  bindListbox(d.root, { doc: d.doc, win: { innerWidth: 1024, addEventListener() {} } });
  d.select.disabled = false; paintListbox(d.root);
  fire(d.btn, "keydown", { key: "ArrowDown" });   // open on ledger
  assert.equal(d.tip.hidden, true, "ledger has no script");
  fire(d.btn, "keydown", { key: "ArrowDown" });   // glow
  assert.equal(d.tip.hidden, false, "glow is active: its pane shows");
  fire(d.btn, "keydown", { key: "ArrowDown" });   // garden
  assert.equal(d.tip.hidden, true, "garden: gone");
  fire(d.btn, "keydown", { key: "ArrowUp" }); fire(d.btn, "keydown", { key: "Escape" });
  assert.equal(d.tip.hidden, true, "the list closed: the list's pane goes with it");
});

// ── legible ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const rgba = (s) => { const m = /rgba\(\s*(\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\s*\)/.exec(s); return { c: [+m[1], +m[2], +m[3]], a: +m[4] }; };
const over = ({ c, a }, base) => c.map((v, i) => Math.round(v * a + base[i] * (1 - a)));
const lum = (rgb) => { const [r, g, b] = rgb.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

test("legible: the list's names, the active option, the badge in the list and the pane each pass AA (4.5:1), computed from the css's tokens", () => {
  const css = read("src/components/hearth/hearth-host.css");
  const tok = (n) => new RegExp(`${n}:\\s*([^;]+);`).exec(css)[1].trim();
  const field = hex(tok("--hx-chrome-field")), fieldInk = hex(tok("--hx-chrome-field-ink")), link = hex(tok("--hx-chrome-link"));
  const active = over(rgba(tok("--hx-chrome-hover")), field);
  for (const [what, ink, bg] of [
    ["a design's name on the list's field", fieldInk, field],
    ["the active option's name", fieldInk, active],
    ["the badge in the list", link, field],
    ["the badge on the active option", link, active],
    ["the pane's sentence", fieldInk, field],
  ]) assert.ok(ratio(ink, bg) >= 4.5, `${what}: ${ratio(ink, bg).toFixed(2)}:1`);
  assert.match(css, /\.hearth-lb-list > li\.is-active, \.hearth-lb-list > li:hover \{ background: var\(--hx-chrome-hover\); \}/, "the active option wears the token measured above");
});

// ── the markup ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
test("PIN (text) the picker renders the badge only for a scripted design, to the right of its name, and the page hands it `scripted` from isScripted", () => {
  const picker = read("src/components/hearth/HearthPicker.astro");
  assert.match(picker, /<span class="hearth-lb-name">\{e\.title\}<\/span>\s*\{e\.scripted && <span class="hearth-script" data-hearth-script aria-hidden="true">\{SCRIPT_BADGE\}<\/span>\}/, "the badge after the name, only when scripted");
  assert.match(picker, /<button type="button" class="hearth-script hearth-script-now" data-hearth-script-now aria-describedby="hearth-script-tip" hidden=\{!current\?\.scripted\}>\{SCRIPT_BADGE\}<\/button>/, "and beside the current design's name");
  assert.equal(SCRIPT_BADGE, "script");
  assert.match(picker, /role="tooltip" data-hearth-script-tip hidden>\{SCRIPT_NOTE\}/, "one pane, in the site's own markup");
  assert.match(read("src/components/hearth/Hearth.astro"), /scripted: isScripted\(e\)/);
  assert.doesNotMatch(picker, /title=\{SCRIPT_NOTE\}|title="This design/, "not the browser's own hover");
});

test("built: on every household page, a design's badge is in the list exactly when the page carries a script for it", { skip: !fs.existsSync(path.join(ROOT, "dist-town", "households")) && "no dist-town build here" }, () => {
  const dir = path.join(ROOT, "dist-town", "households");
  const pages = fs.readdirSync(dir).map((s) => path.join(dir, s, "index.html")).filter((p) => fs.existsSync(p));
  assert.ok(pages.length > 10, `built household pages: ${pages.length}`);
  let scripted = 0, plain = 0;
  for (const p of pages) {
    const html = fs.readFileSync(p, "utf8");
    const entries = JSON.parse(/<script type="application\/json" data-hearth-entries>([\s\S]*?)<\/script>/.exec(html)[1]);
    const lis = [...html.matchAll(/<li role="option"[^>]*data-value="([^"]+)"[^>]*>([\s\S]*?)<\/li>/g)];
    assert.equal(lis.length, entries.length, `${p}: one option per design`);
    for (const [, id, body] of lis) {
      const want = isScripted(entries.find((e) => e.id === id));
      assert.equal(/data-hearth-script/.test(body), want, `${p}: ${id}: ${D1324}`);
      if (want) scripted++; else plain++;
    }
  }
  assert.ok(plain > 0, `designs without a script were read too (${plain} options)`);
  console.log(`# built: ${pages.length} pages, ${scripted} scripted options, ${plain} without`);
});
