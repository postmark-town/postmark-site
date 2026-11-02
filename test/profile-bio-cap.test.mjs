// profile-bio-cap.test.mjs — the bio editor keeps the draft, shows count and cap, and refuses over 400 (POS-862).
//
//   node --test test/profile-bio-cap.test.mjs      (wholly synthetic: a hand-made DOM, a stubbed transport, no page, no data)
//
// LAW (Darko 2026-11-01 via Wright): "yes ok to fix, and yes on 2 for the clear refusal; we should also just show the
// char cap and current char when they're filling it." The office's rule stays: trim, then count code points, 400 allowed,
// 401 refused (postmark-office src/edit.mjs profileValue; the office remains the judge).
//
// WHAT THIS RUNS. The component's script is inline in town/components/Household.astro and cannot be imported, so (the
// WIRING-AND-PINS "lift the lines and run them" idiom) this slices the REAL source between its own markers, and runs it in
// a function whose free names are stubs: the bio wiring block and the actual Save (submit) handler. Nothing here is a copy
// of the rule. A name the lifted source needs and the stubs lack throws ReferenceError, which is what keeps the harness
// honest. NOT covered, and said so: the browser's own paste insertion (a paste is simulated as a value change plus the
// `input` event the browser fires; that no native `maxlength` is left to clip it is pinned in the markup below, a text
// pin, the weakest instrument) and the page's rendering/CSS.
//
// Every string below is invented for this file.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BIO_MAX, bioCount, bioProblem, paintBioCount, profilePayload, profileRequest, officeRefusal } from "../src/lib/profile-edit.mjs";

const SRC = readFileSync(new URL("../town/components/Household.astro", import.meta.url), "utf8");

// ── lift the real lines ──────────────────────────────────────────────────────
const between = (text, from, to) => {
  const a = text.indexOf(from);
  assert.ok(a >= 0, `marker not found: ${from}`);
  const b = text.indexOf(to, a);
  assert.ok(b > a, `end marker not found: ${to}`);
  return text.slice(a, b + to.length);
};
const BIO_BLOCK = between(SRC, "// POS-862 bio wiring begin", "// POS-862 bio wiring end");
const SUBMIT = between(SRC, 'form.addEventListener("submit", async (ev) => {', "setResult(message);\n      });");

const NAMES = [
  "form", "field", "setStatus", "paintBioCount", "bioProblem", "clearPronouns", "getTok", "tokenIsFresh", "profilePayload",
  "saved", "framing", "preparedAvatar", "previewUrl", "bubbleObjectUrl", "renderFramed", "saveBtn", "cancelBtn", "avatarInput",
  "setAvatarStatus", "profileRequest", "OFFICE_BASE", "handle", "fetch", "officeRefusal", "fill", "paint", "avatar", "showAvatar",
  "blobBase64", "close", "setResult",
];

class El extends EventTarget {
  constructor() { super(); this.value = ""; this.attrs = {}; this.dataset = {}; this.textContent = ""; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
}

function mount(initialBio = "") {
  const textarea = new El(); textarea.value = initialBio;
  const counter = new El();
  const others = { color: new El(), color_name: new El(), runtime: new El(), pronouns: new El() };
  const form = new El();
  form.querySelector = (sel) => (sel === "[data-profile-bio-count]" ? counter : null);
  let submit = null;
  const realAdd = form.addEventListener.bind(form);
  form.addEventListener = (type, fn, ...r) => { if (type === "submit") submit = fn; return realAdd(type, fn, ...r); };
  const log = { status: [], fetches: [], closed: 0, results: [] };
  const scope = {
    form, field: (n) => (n === "bio" ? textarea : others[n]),
    setStatus: (msg, cls) => log.status.push([msg, cls ?? null]),
    paintBioCount, bioProblem, clearPronouns: false, getTok: () => ({ access_token: "tok" }), tokenIsFresh: () => true,
    profilePayload, saved: {}, framing: null, preparedAvatar: null, previewUrl: null, bubbleObjectUrl: null,
    renderFramed: async () => { throw new Error("no framing in this test"); },
    saveBtn: new El(), cancelBtn: new El(), avatarInput: new El(), setAvatarStatus: () => {},
    profileRequest, OFFICE_BASE: "/api", handle: "wick",
    fetch: async (url, init) => { log.fetches.push({ url, init }); return { ok: true, status: 200, json: async () => ({ profile: {} }) }; },
    officeRefusal, fill: () => {}, paint: () => {}, avatar: null, showAvatar: () => {}, blobBase64: async () => "",
    close: () => { log.closed++; }, setResult: (m) => log.results.push(m),
  };
  // the bio block and the handler are lifted into ONE function scope, as they share it in the component
  const run = new Function(...NAMES, `${BIO_BLOCK}\n${SUBMIT}\nreturn { showBio };`);
  const { showBio } = run(...NAMES.map((n) => scope[n]));
  return {
    textarea, counter, log, showBio,
    type(value) { textarea.value = value; textarea.dispatchEvent(new Event("input")); }, // a keystroke, or a paste once the browser has inserted it
    async save() { const ev = new Event("submit", { cancelable: true }); await submit(ev); return ev; },
  };
}

const chars = (n, ch = "a") => ch.repeat(n);

test("the real source: no native maxlength is left on the bio box, and the count has a place (TEXT PIN)", () => {
  const textarea = SRC.split("\n").find((l) => l.includes('<textarea name="bio"'));
  assert.ok(textarea, "the bio textarea line was found");
  assert.doesNotMatch(textarea, /maxlength/, "a native maxlength would silently clip a paste");
  assert.match(SRC, /data-profile-bio-count/);
  assert.equal(BIO_MAX, 400, "the cap is the office's, unchanged");
});

test("typing or pasting keeps the whole draft and shows count / cap; over the cap marks it, correcting clears it", () => {
  const m = mount();
  assert.equal(m.counter.textContent, "0 / 400", "the count is there before anything is typed");
  m.type(chars(400));
  assert.equal(m.counter.textContent, "400 / 400");
  assert.equal(m.textarea.attrs["aria-invalid"], "false");
  const paste = chars(650) + "tail";
  m.type(paste);
  assert.equal(m.textarea.value, paste, "an over-cap paste is kept whole, not clipped");
  assert.equal(m.counter.textContent, "654 / 400 — 254 too many");
  assert.equal(m.counter.dataset.over, "1");
  assert.equal(m.textarea.attrs["aria-invalid"], "true");
  m.type(chars(120));
  assert.equal(m.counter.textContent, "120 / 400");
  assert.equal(m.counter.dataset.over, "");
});

test("the real Save refuses an over-cap bio: no request, the draft stays, a clear message; correcting it saves", async () => {
  const m = mount();
  m.type(chars(401));
  const ev = await m.save();
  assert.equal(ev.defaultPrevented, true, "the form's own submit is handled, not left to the browser");
  assert.equal(m.log.fetches.length, 0, "no request went out");
  assert.equal(m.log.closed, 0, "the editor stayed open");
  assert.equal(m.textarea.value.length, 401, "the draft is intact");
  const [msg, cls] = m.log.status.at(-1);
  assert.match(msg, /401 characters.*limit is 400.*shorten it by 1/);
  assert.equal(cls, "warn");

  m.type(chars(400)); // corrected: the refusal goes
  assert.deepEqual(m.log.status.at(-1), ["", null], "the error was cleared on correction");
  await m.save();
  assert.equal(m.log.fetches.length, 1, "exactly one request, now");
  assert.equal(m.log.fetches[0].init.method, "PATCH");
  assert.equal(JSON.parse(m.log.fetches[0].init.body).bio, chars(400), "the whole 400 went, unclipped");
  assert.equal(m.log.closed, 1);
});

test("exactly 400 is allowed and 401 refused, by the office's own rule: trim, then code points", async () => {
  for (const [bio, sends] of [[chars(400), true], [chars(401), false], ["  " + chars(400) + "  \n", true], [chars(400) + " b", false]]) {
    const m = mount();
    m.type(bio);
    await m.save();
    assert.equal(m.log.fetches.length, sends ? 1 : 0, JSON.stringify([bio.length, sends]));
  }
  assert.equal(bioCount("  " + chars(3) + " \n"), 3, "the count is of the trimmed text");
});

test("non-BMP characters count once each, not as UTF-16 units: 400 emoji go, 401 do not", async () => {
  const E = "\u{1F600}"; // one code point, two UTF-16 units
  assert.equal(E.length, 2);
  const ok = mount();
  ok.type(chars(400, E));
  assert.equal(ok.counter.textContent, "400 / 400");
  await ok.save();
  assert.equal(ok.log.fetches.length, 1, "800 UTF-16 units but 400 characters: allowed");
  assert.equal(JSON.parse(ok.log.fetches[0].init.body).bio, chars(400, E));
  const over = mount();
  over.type(chars(401, E));
  await over.save();
  assert.equal(over.log.fetches.length, 0);
  assert.match(over.log.status.at(-1)[0], /401 characters/);
});

test("an empty bio still clears and saves; other fields and the existing request are unchanged", async () => {
  const m = mount("an invented earlier bio");
  assert.equal(m.counter.textContent, `${bioCount("an invented earlier bio")} / 400`, "the initial text is counted, not truncated");
  m.type("");
  await m.save();
  assert.equal(m.log.fetches.length, 1);
  const body = JSON.parse(m.log.fetches[0].init.body);
  assert.equal(body.bio, "", "an empty string clears, as before");
  assert.deepEqual(Object.keys(body).sort(), ["bio", "color", "color_name", "runtime"]);
  assert.equal(m.log.fetches[0].init.headers.authorization, "Bearer tok");
});

test("a long legacy bio is not truncated by showing the editor; it reads over and the Save refuses until shortened", async () => {
  const legacy = chars(430);
  const m = mount(legacy);
  assert.equal(m.textarea.value, legacy, "rendering the editor kept it whole");
  assert.equal(m.counter.textContent, "430 / 400 — 30 too many");
  await m.save();
  assert.equal(m.log.fetches.length, 0);
});

test("the helpers alone: bioProblem is null through 400 and names the surplus after", () => {
  assert.equal(bioProblem(chars(400)), null);
  assert.equal(bioProblem(chars(402)).includes("shorten it by 2"), true);
  assert.equal(bioProblem(undefined), null);
});
