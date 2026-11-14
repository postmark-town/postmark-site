// hearth-picker-focus.test.mjs: after the check or the x, keyboard focus lands on the dropdown, and a save that landed is said to a screen reader (CORE-40).
//
// The check and the x hide themselves once they have done their work (picker.mjs § paint: the acts show only while a choice is pending), so the button
// that had focus disappears under the reader. A keyboard press on a button is a click, so each test presses the button by firing its click, then reads
// where focus is and what the status says. No browser: a small stand-in for the picker's own elements, the ones HearthPicker.astro draws.

import test from "node:test";
import assert from "node:assert/strict";
import { mountHearthPicker } from "../src/lib/hearth/picker.mjs";

const ENTRIES = [{ id: "default", author: null }, { id: "lantern", author: "someone" }];

function el(page, { hidden = false } = {}) {
  const on = {};
  return {
    hidden, disabled: false, value: "", textContent: "", title: "", dataset: {}, attrs: {},
    setAttribute(k, v) { this.attrs[k] = String(v); }, removeAttribute(k) { delete this.attrs[k]; }, hasAttribute(k) { return k in this.attrs; },
    addEventListener(type, fn) { on[type] = fn; },
    fire(type) { return on[type]?.(); },
    focus() { page.focused = this; },
  };
}

function page() {
  const p = { focused: null };
  p.parts = {
    "[data-hearth-pick]": el(p, { hidden: true }),
    "[data-hearth-lb-btn]": el(p),
    "[data-hearth-by]": el(p),
    "[data-hearth-acts]": el(p, { hidden: true }),
    "[data-hearth-keep]": el(p),
    "[data-hearth-back]": el(p),
    "[data-hearth-refused]": el(p, { hidden: true }),
    "[data-hearth-said]": el(p),
  };
  p.root = { dataset: {}, querySelector: (s) => p.parts[s] ?? null, querySelectorAll: () => [] };
  return p;
}

const answer = (status, body) => async () => ({ ok: status < 400, status, json: async () => body });

function mounted(fetchImpl) {
  const p = page();
  mountHearthPicker(p.root, { entries: ENTRIES, slug: "house", saved: null, token: "t", api: "https://office.test", signedIn: true, fetchImpl });
  const pick = p.parts["[data-hearth-pick]"];
  pick.value = "lantern"; pick.fire("change");            // a preview: the check and the x show
  assert.equal(p.parts["[data-hearth-acts]"].hidden, false, "the check and the x show while a choice is pending");
  return p;
}

test("the check: the save lands, the buttons hide, focus goes to the dropdown and the status says Saved", async () => {
  const p = mounted(answer(200, { hearth: "lantern" }));
  const keep = p.parts["[data-hearth-keep]"];
  keep.focus();
  await keep.fire("click");
  assert.equal(p.parts["[data-hearth-acts]"].hidden, true, "the buttons are gone after a save");
  assert.equal(p.focused, p.parts["[data-hearth-lb-btn]"], "focus is on the dropdown, not dropped to the page");
  assert.equal(p.parts["[data-hearth-said]"].textContent, "Saved");
});

test("the x: the buttons hide and focus goes to the dropdown; nothing is said, since nothing was saved", async () => {
  const p = mounted(answer(200, { hearth: "lantern" }));
  const back = p.parts["[data-hearth-back]"];
  back.focus();
  await back.fire("click");
  assert.equal(p.parts["[data-hearth-acts]"].hidden, true);
  assert.equal(p.focused, p.parts["[data-hearth-lb-btn]"]);
  assert.equal(p.parts["[data-hearth-said]"].textContent, "");
});

test("a refused save: the buttons stay, focus stays on the check, and the status keeps the office's reason, never Saved", async () => {
  const p = mounted(answer(403, { hint: "Only this house's own human may choose its Hearth." }));
  const keep = p.parts["[data-hearth-keep]"];
  keep.focus();
  await keep.fire("click");
  assert.equal(p.parts["[data-hearth-acts]"].hidden, false, "the check and the x stay for another try");
  assert.equal(p.focused, keep);
  assert.equal(p.parts["[data-hearth-said]"].textContent, "Only this house's own human may choose its Hearth.");
});

test("an unconfirmed save is not said as Saved either", async () => {
  const p = mounted(answer(200, {}));
  const keep = p.parts["[data-hearth-keep]"];
  keep.focus();
  await keep.fire("click");
  assert.notEqual(p.parts["[data-hearth-said]"].textContent, "Saved");
  assert.equal(p.focused, keep);
});
