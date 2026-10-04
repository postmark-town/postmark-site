// paypal-button.test.mjs — the fund page's PayPal choice (POS-183 part 2).
//
//   node --test test/paypal-button.test.mjs
//
// The brief's gate, and its order:
//   1. no PayPal script loads before the giver chooses PayPal — not in the
//      page's source, not on mount; pressing the button adds exactly one, once;
//   2. the order's custom_id carries `<pot>|<handle>` (the handle the giver
//      typed, trimmed, or empty), in whole US dollars, naming the pot's title;
//   3. the page offers PayPal only when the build carries the public client ID,
//      and only inside the open pot's money moment.
//
// The site has no DOM library (test/quest-board-render.test.mjs's rule), so the
// document here is hand-rolled: exactly the calls mountPaypal makes.
//
// THE SPELLING IS SHARED with the office: postmark-office
// tools/paypal-watch.mjs § customIdFor reads the same custom_id back, and its
// test pins the same cases written out below. A constant that agrees with
// itself proves nothing, so the cases are literal on both sides.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SDK_HOST, sdkUrl, customIdFor, wholeUsd, orderFor, mountPaypal, CUSTOM_MAX } from "../src/lib/paypal.mjs";

const PAGE = readFileSync(new URL("../town/pages/fund/[pot].astro", import.meta.url), "utf8");

// ── a document with exactly the surface mountPaypal touches ─────────────────
function el(tag, attrs = {}) {
  const listeners = {};
  const kids = [];
  const e = {
    tagName: tag.toUpperCase(), attrs: { ...attrs }, value: attrs.value ?? "", textContent: "", hidden: false, disabled: false, children: kids,
    getAttribute: (k) => (k in e.attrs ? e.attrs[k] : null),
    setAttribute: (k, v) => { e.attrs[k] = String(v); },
    addEventListener: (ev, fn) => { (listeners[ev] ??= []).push(fn); },
    fire: async (ev) => { for (const fn of listeners[ev] ?? []) await fn(); },
    appendChild: (c) => { kids.push(c); return c; },
    querySelector: (sel) => find(kids, sel),
    set src(v) { e.attrs.src = v; }, get src() { return e.attrs.src; },
  };
  return e;
}
function matches(e, sel) {
  const m = /^(\w+)?(?:\[([\w-]+)(?:='([^']*)')?\])?$/.exec(sel);
  if (!m) throw new Error(`the stub does not answer selector ${sel}`);
  const [, tag, attr, val] = m;
  if (tag && e.tagName !== tag.toUpperCase()) return false;
  if (attr === "name") return e.attrs.name === val;
  if (attr) return attr in e.attrs && (val == null || e.attrs[attr] === val);
  return true;
}
function find(list, sel) {
  for (const e of list) {
    if (matches(e, sel)) return e;
    const hit = find(e.children, sel);
    if (hit) return hit;
  }
  return null;
}
function fundPage({ withPaypal = true } = {}) {
  const head = el("head");
  const body = el("body");
  const doc = {
    head, body,
    createElement: (t) => el(t),
    querySelector: (sel) => find([head, body], sel),
    scripts: () => head.children.filter((c) => c.tagName === "SCRIPT"),
  };
  if (withPaypal) {
    // POS-317: the "for" row (fund-for.mjs) puts the signed-in account on the box; nobody types a handle
    const box = body.appendChild(el("details", { "data-pp-client": "sb-client-id", "data-pp-pot": "darko-fund", "data-pp-title": "Keep the lights on", "data-pp-account": "273009068" }));
    box.appendChild(el("input", { name: "pp-usd", value: "25" }));
    box.appendChild(el("button", { "data-pp-go": "" }));
    box.appendChild(el("div", { "data-pp-buttons": "" }));
    box.appendChild(el("p", { "data-pp-out": "" }));
  }
  return doc;
}
/** A PayPal SDK that records what the page asked of it. */
function fakeSdk(doc, win) {
  const made = [];
  return {
    made,
    // the "load": the test plays the browser, running the script once it is appended
    arrive: async () => {
      win.paypal = { Buttons: (cfg) => ({ render: async (target) => { made.push({ cfg, target }); } }) };
      for (const s of doc.scripts()) await s.fire("load");
    },
  };
}

// ── 1 ───────────────────────────────────────────────────────────────────────

test("1 · no PayPal script is in the page's source, and none loads on mount — only pressing the button adds one, once", async () => {
  assert.ok(!PAGE.includes("paypal.com"), "the page source names no paypal.com URL; the SDK URL is built only in src/lib/paypal.mjs");
  assert.ok(!/<script[^>]*src=[^>]*paypal/i.test(PAGE));
  const doc = fundPage();
  const win = {};
  mountPaypal(doc, { win });
  assert.equal(doc.scripts().length, 0, "mounting loaded the SDK");
  const sdk = fakeSdk(doc, win);
  const go = doc.querySelector("[data-pp-go]");
  const pressed = go.fire("click");
  await new Promise((r) => setImmediate(r));
  assert.equal(doc.scripts().length, 1, "pressing adds exactly one script");
  assert.equal(doc.scripts()[0].src, `${SDK_HOST}?client-id=sb-client-id&currency=USD&intent=capture&components=buttons&disable-funding=paylater`);
  await sdk.arrive();
  await pressed;
  assert.equal(sdk.made.length, 1, "the buttons render once the SDK arrives");
  await go.fire("click");
  assert.equal(doc.scripts().length, 1, "a second press adds no second script");
});

test("1 · a page with no PayPal choice mounts nothing and loads nothing", () => {
  const doc = fundPage({ withPaypal: false });
  assert.equal(mountPaypal(doc, { win: {} }), null);
  assert.equal(doc.scripts().length, 0);
});

// ── 2 ───────────────────────────────────────────────────────────────────────

test("2 · the order carries custom_id <pot>|g<id> (the signed-in account), whole US dollars, and the pot's title", async () => {
  const doc = fundPage();
  const win = {};
  mountPaypal(doc, { win });
  const sdk = fakeSdk(doc, win);
  const pressed = doc.querySelector("[data-pp-go]").fire("click");
  await new Promise((r) => setImmediate(r));
  await sdk.arrive();
  await pressed;
  let order = null;
  await sdk.made[0].cfg.createOrder({}, { order: { create: async (o) => { order = o; return "ORDER-1"; } } });
  assert.deepEqual(order, { intent: "CAPTURE", purchase_units: [{
    custom_id: "darko-fund|g273009068", description: "Postmark · Keep the lights on", amount: { currency_code: "USD", value: "25.00" } }] });
  // signed out after all (the row removes the account): the order is the bare pot, an outside gift
  delete doc.querySelector("[data-pp-client]").attrs["data-pp-account"];
  await sdk.made[0].cfg.createOrder({}, { order: { create: async (o) => { order = o; } } });
  assert.equal(order.purchase_units[0].custom_id, "darko-fund");
});

test("2 · custom_id is `<pot>|g<id>` signed in and the bare pot signed out — the office's fund-holder pins the same cases", () => {
  assert.equal(customIdFor("darko-fund", "273009068"), "darko-fund|g273009068");
  assert.equal(customIdFor("darko-fund", null), "darko-fund");
  assert.equal(customIdFor("darko-fund", ""), "darko-fund");
  assert.ok(customIdFor("keep", "99999999999999999999").length <= CUSTOM_MAX);
  assert.equal(CUSTOM_MAX, 127);
  assert.equal(sdkUrl("a b"), `${SDK_HOST}?client-id=a%20b&currency=USD&intent=capture&components=buttons&disable-funding=paylater`);
});

test("2 · Pay Later is off, and only Pay Later: the SDK is asked to disable exactly paylater (Keemin, 2026-09-29)", () => {
  const u = new URL(sdkUrl("sb-client-id"));
  assert.equal(u.searchParams.get("disable-funding"), "paylater", "exactly paylater: the card and the PayPal balance stay on");
  assert.equal(u.searchParams.get("enable-funding"), null, "nothing is force-enabled");
});

test("2 · only a whole number of dollars, at least one, opens PayPal", async () => {
  for (const bad of ["0", "2.5", "", "abc", "-3"]) assert.equal(wholeUsd(bad), null, bad);
  assert.equal(wholeUsd("10"), 10);
  assert.equal(orderFor({ pot: "keep", title: null, handle: null, usd: 7 }).purchase_units[0].amount.value, "7.00");
  const doc = fundPage();
  doc.querySelector("[name='pp-usd']").value = "2.5";
  mountPaypal(doc, { win: {} });
  await doc.querySelector("[data-pp-go]").fire("click");
  assert.equal(doc.scripts().length, 0, "a bad amount loads nothing");
  assert.match(doc.querySelector("[data-pp-out]").textContent, /whole number of dollars/);
});

// ── 3 ───────────────────────────────────────────────────────────────────────

test("3 · the page offers PayPal only with the build's public client ID, and only inside the open pot's money moment", () => {
  assert.match(PAGE, /const PAYPAL_CLIENT_ID = import\.meta\.env\.PUBLIC_PAYPAL_CLIENT_ID \?\? "";/);
  const at = PAGE.indexOf("{PAYPAL_CLIENT_ID && (");
  assert.ok(at > 0, "the PayPal choice is gated on the client ID");
  const open = PAGE.indexOf("{open && (<>");
  const closeOpen = PAGE.indexOf("</>)}", open);
  assert.ok(open > 0 && open < at && at < closeOpen, "it sits inside the open pot's money moment, never on a draft");
  assert.match(PAGE.slice(at, at + 400), /data-pp-client=\{PAYPAL_CLIENT_ID\} data-pp-pot=\{pot\.pot\}/);
  assert.match(PAGE, /import \{ mountPaypal \} from "@\/lib\/paypal\.mjs";/);
});

test("3 · no element on the page is id=\"paypal\": an id becomes a window property and would shadow the SDK's own window.paypal", () => {
  // Caught in the lane's own render (2026-09-29): with the fold at id="paypal",
  // window.paypal was the <details> element, the SDK's global never took, and
  // pressing the button answered "Buttons is not a function".
  assert.ok(!/\bid=["']paypal["']/.test(PAGE), 'the page carries id="paypal"');
  assert.match(PAGE, /id="pay-paypal"/);
});
