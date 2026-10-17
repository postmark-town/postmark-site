// fund-cap.test.mjs — a capped pot's fund page asks for no more than the pot can take (POS-661).
//
//   node --test test/fund-cap.test.mjs
//
// Settled A (POS-661, 2026-10-16): D5's refusal stays (a gift past a capped
// pot's posted need is refused whole, and no rail hands a payment back by
// itself), so the PAGE holds the gift at the pot's headroom:
//   1. PayPal: the amount field's max is the headroom, and src/lib/paypal.mjs
//      refuses a larger amount before PayPal is asked, and again at the order;
//   2. card and USDC: the page says "at most $X" where the payer chooses them.
//      The card's amount is typed on Stripe's own page, which no page can hold;
//   3. headroom 0: no rail and no input, only "this pot has what it asked for";
//   4. an uncapped pot (the DARKO box) is unchanged: no cap, no max.
// The rule is funding.mjs § fundCapOf, pure; the page's use of it is pinned in
// its source (fund-page.test.mjs's idiom: the site has no DOM library, and the
// container cannot render the layout without a site URL).
//
// THE FLIPS: fundCapOf answering cap null and § 1–2 go red; drop the PayPal
// guard in paypal.mjs and § 5 goes red.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { capOf, overCap, mountPaypal } from "../src/lib/paypal.mjs";
import { fundCapOf } from "../src/lib/funding.mjs";

const PAGE = readFileSync(new URL("../town/pages/fund/[pot].astro", import.meta.url), "utf8");
// the template only: the frontmatter above the second `---` renders nothing (fund-page.test.mjs's rule)
const BODY = PAGE.slice(PAGE.indexOf("---", PAGE.indexOf("---") + 3));

// a pot row as funding.mjs § toPot shapes it
const POT = (over = {}) => ({ pot: "meeps-home", status: "open", cadence: "once", uncapped: false, target: 859, received: 800, ...over });

test("1 · a capped open pot's cap is its headroom: $59 left caps a gift at $59; a once pot says so", () => {
  assert.deepEqual(fundCapOf(POT()), { cap: 59, full: false, once: true });
  assert.deepEqual(fundCapOf(POT({ cadence: "monthly", target: 200, received: 100 })), { cap: 100, full: false, once: false });
});

test("2 · headroom 0 is full: the page offers no way to pay", () => {
  assert.deepEqual(fundCapOf(POT({ received: 859 })), { cap: 0, full: true, once: true });
  assert.deepEqual(fundCapOf(POT({ received: 900 })), { cap: 0, full: true, once: true }, "a roll past the need is still full, never negative");
});

test("3 · an uncapped pot, a targetless one and a pot not open carry no cap: today's behaviour", () => {
  assert.deepEqual(fundCapOf(POT({ pot: "darko-fund", cadence: "monthly", uncapped: true, target: null, received: 40 })), { cap: null, full: false, once: false });
  assert.equal(fundCapOf(POT({ target: null })).cap, null);
  assert.equal(fundCapOf(POT({ status: "draft" })).cap, null, "a draft takes no dollars at all, so it has no cap to hold");
  assert.equal(fundCapOf(POT({ status: "draft", received: 859 })).full, false);
});

test("4 · the page holds every rail to the cap, and at full renders none of them", () => {
  const has = (text, what) => assert.ok(BODY.includes(text) || PAGE.includes(text), `the page lost ${what}: ${text}`);
  has("const { cap, full, once } = fundCapOf(pot);", "the one rule");
  // PayPal: the box and the field carry the cap; its default amount never passes it
  has("data-pp-max={cap ?? undefined}", "PayPal's cap");
  has('name="pp-usd" type="number" min="1" max={cap ?? undefined}', "the field's max");
  has("value={cap != null ? Math.min(10, cap) : 10}", "the field's capped default");
  // card and USDC: said where the payer chooses them, only on a capped pot
  has("{cap != null && (", "the capped-only notes");
  has("data-fund-cap={cap}", "the card's at-most line");
  has("data-usdc-cap={cap}", "USDC's at-most line");
  has("refunds it by hand", "what happens to a larger USDC send");
  // full: the rails, both panels, the address and the witness form sit in the branch a full pot never takes
  const at = BODY.indexOf("{full ? (");
  assert.ok(at > 0, "the pay section branches on full");
  const branch = BODY.slice(at, BODY.indexOf("</>)}", at));
  const fullSide = branch.slice(0, branch.indexOf(") : (<>"));
  assert.ok(fullSide.includes("data-fund-full"), "the full side says the pot has what it asked for");
  for (const rail of ["data-card", 'data-open="usdc"', "data-pp-max", 'name="pp-usd"', "{intake}", 'id="pm-fund-form"']) {
    assert.ok(!fullSide.includes(rail), `a full pot still offers ${rail}`);
    assert.ok(branch.includes(rail), `${rail} moved out of the not-full branch`);
  }
  // a once pot promises no next epoch
  has('{once ? "" : " this epoch"}', "the once wording");
});

// ── 5 · the PayPal guard itself (paypal-button.test.mjs's hand-rolled document) ──

function el(tag, attrs = {}) {
  const listeners = {}; const kids = [];
  const e = {
    tagName: tag.toUpperCase(), attrs: { ...attrs }, value: attrs.value ?? "", textContent: "", hidden: false, disabled: false, children: kids,
    getAttribute: (k) => (k in e.attrs ? e.attrs[k] : null), setAttribute: (k, v) => { e.attrs[k] = String(v); },
    addEventListener: (ev, fn) => { (listeners[ev] ??= []).push(fn); }, fire: async (ev) => { for (const fn of listeners[ev] ?? []) await fn(); },
    appendChild: (c) => { kids.push(c); return c; }, querySelector: (sel) => find(kids, sel),
  };
  return e;
}
function find(list, sel) {
  const m = /^\[([\w-]+)(?:='([^']*)')?\]$/.exec(sel);
  for (const e of list) {
    if (m && (m[1] === "name" ? e.attrs.name === m[2] : m[1] in e.attrs)) return e;
    const hit = find(e.children, sel);
    if (hit) return hit;
  }
  return null;
}
function page(max) {
  const head = el("head"); const body = el("body");
  const doc = { head, body, createElement: (t) => el(t), querySelector: (sel) => find([head, body], sel) };
  const box = body.appendChild(el("div", { "data-pp-client": "sb", "data-pp-pot": "meeps-home", "data-pp-title": "Give the meeps a home", ...(max == null ? {} : { "data-pp-max": String(max) }) }));
  box.appendChild(el("input", { name: "pp-usd", value: "60" }));
  box.appendChild(el("button", { "data-pp-go": "" }));
  box.appendChild(el("div", { "data-pp-buttons": "" }));
  box.appendChild(el("p", { "data-pp-out": "" }));
  return doc;
}

test("5 · PayPal is never asked for more than the cap: refused before the SDK loads, and again at the order", async () => {
  assert.equal(capOf({ getAttribute: () => "59" }), 59);
  assert.equal(capOf({ getAttribute: () => null }), null, "no cap attribute is an uncapped pot");
  const doc = page(59);
  mountPaypal(doc, { win: {} });
  void doc.querySelector("[data-pp-go]").fire("click");   // a click that did load the SDK would wait on it forever
  await new Promise((ok) => setImmediate(ok));
  assert.equal(doc.head.children.length, 0, "$60 against a $59 cap loads nothing");
  assert.equal(doc.querySelector("[data-pp-out]").textContent, overCap(59));

  // at the cap the SDK loads; raising the amount after the buttons drew is refused at the order
  const win = {};
  const doc2 = page(59);
  doc2.querySelector("[name='pp-usd']").value = "59";
  mountPaypal(doc2, { win });
  const made = [];
  const click = doc2.querySelector("[data-pp-go]").fire("click");
  win.paypal = { Buttons: (cfg) => ({ render: async () => { made.push(cfg); } }) };
  await new Promise((ok) => setImmediate(ok));   // the click's handler appends the script on its next turn
  for (const s of doc2.head.children) await s.fire("load");
  await click;
  assert.equal(made.length, 1, "the buttons drew at the cap");
  doc2.querySelector("[name='pp-usd']").value = "60";
  assert.throws(() => made[0].createOrder({}, { order: { create: () => "made" } }), /at most \$59/);
  assert.equal(doc2.querySelector("[data-pp-out]").textContent, overCap(59));
  made[0].onError();
  assert.equal(doc2.querySelector("[data-pp-out]").textContent, overCap(59), "PayPal's own error does not overwrite why");

  // an uncapped pot takes the $60, as before
  const doc3 = page(null);
  mountPaypal(doc3, { win: {} });
  void doc3.querySelector("[data-pp-go]").fire("click");   // the SDK never "arrives" here: the click waits on it, and only the request matters
  assert.equal(doc3.head.children.length, 1, "no cap: the SDK is asked for, for $60");
});
