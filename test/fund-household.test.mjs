// fund-household.test.mjs — the fund page credits the payer's HOUSEHOLD (POS-317, Keemin 2026-10-02).
//
//   node --test test/fund-household.test.mjs
//
// "A signed-in payer sees their household's name and types nothing; a signed-out payer is an outside
// gift." In order:
//   1. the reference: card `<pot>_g<id>`, PayPal `<pot>|g<id>`, bare `<pot>` signed out — the same
//      literal cases postmark-office test/fund-household.test.mjs pins for its reader;
//   2. the row: signed in with a household → "for <name>", and every rail carries the account;
//      signed in with none → an outside gift, said so; signed out → the sign-in line, bare rails;
//   3. the page asks GET /me with the layout's own token, and asks nothing when there is no fresh token;
//   4. nothing on the page asks the payer to type a handle.
//
// The site has no DOM library, so the document is hand-rolled: exactly the calls fund-for.mjs makes.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fundRefFor, cardHref, accountRef } from "../src/lib/fund-ref.mjs";
import { fundFor, paintFundFor, mountFundFor, freshToken } from "../src/lib/fund-for.mjs";

const PAGE = readFileSync(new URL("../town/pages/fund/[pot].astro", import.meta.url), "utf8");
const STRIPE = "https://buy.stripe.com/test_link";

// ── a document with the surface fund-for.mjs touches ────────────────────────
function el(attrs = {}, kids = []) {
  const listeners = {};
  const e = {
    attrs: { ...attrs }, hidden: "hidden" in attrs, textContent: "", value: attrs.value ?? "", children: kids,
    getAttribute: (k) => (k in e.attrs ? e.attrs[k] : null),
    setAttribute: (k, v) => { e.attrs[k] = String(v); },
    removeAttribute: (k) => { delete e.attrs[k]; },
    addEventListener: (ev, fn) => { (listeners[ev] ??= []).push(fn); },
    click: () => (listeners.click ?? []).forEach((fn) => fn()),
    querySelector: (sel) => all([e], sel, true)[0] ?? null,
    querySelectorAll: (sel) => all(kids, sel),
  };
  return e;
}
function matches(e, sel) {
  const m = /^\[([\w-]+)\]$/.exec(sel);
  if (!m) throw new Error(`the stub answers [attr] selectors only, not ${sel}`);
  return m[1] in e.attrs;
}
function all(list, sel, deep = true) {
  const out = [];
  for (const e of list) { if (matches(e, sel)) out.push(e); if (deep) out.push(...all(e.children, sel)); }
  return out;
}
function fundPage() {
  const row = el({ "data-fund-for": "", "data-stripe": STRIPE }, [
    el({ "data-for-when": "household", hidden: "" }, [el({ "data-for-name": "" })]),
    el({ "data-for-when": "no-household", hidden: "" }),
    el({ "data-for-when": "signed-out" }, [el({ "data-for-signin": "" })]),
  ]);
  const body = el({}, [
    row,
    el({ "data-card": "", "data-pot": "keeping-ec2", href: `${STRIPE}?client_reference_id=keeping-ec2` }),
    el({ "data-pp-client": "sb" }),
    el({ "data-usdc-household": "", value: "" }),
    el({ "data-usdc-when": "signed-out" }), el({ "data-usdc-when": "household", hidden: "" }),
    el({ "data-ledger-when": "household", hidden: "" }), el({ "data-ledger-when": "outside" }),
    el({ "data-auth-signin": "" }),
  ]);
  return { querySelector: (s) => body.querySelector(s), querySelectorAll: (s) => all([body], s), body };
}
const pick = (doc, sel, val) => doc.querySelectorAll(sel).find((e) => e.getAttribute(sel.slice(1, -1)) === val);

// ── 1 ───────────────────────────────────────────────────────────────────────

test("1 · the reference: card `<pot>_g<id>`, PayPal `<pot>|g<id>`, bare `<pot>` signed out (the office pins the same cases)", () => {
  assert.equal(fundRefFor("keep", 101, "stripe"), "keep_g101");
  assert.equal(fundRefFor("keep", 101, "paypal"), "keep|g101");
  assert.equal(fundRefFor("keep", null, "stripe"), "keep");
  assert.equal(accountRef(273009068), "g273009068");
  assert.equal(cardHref(STRIPE, "keeping-ec2", 273009068), `${STRIPE}?client_reference_id=keeping-ec2_g273009068`);
  assert.equal(cardHref(STRIPE, "keeping-ec2", null), `${STRIPE}?client_reference_id=keeping-ec2`);
  assert.ok(/^[A-Za-z0-9_-]+$/.test(fundRefFor("keeping-ec2", 273009068, "stripe")), "Stripe's alphabet: letters, digits, - and _");
});

// ── 2 ───────────────────────────────────────────────────────────────────────

test("2 · signed in with a household: \"for <name>\", and the card, PayPal and USDC all carry the account", () => {
  const doc = fundPage();
  const f = fundFor({ verified_github: { id: 273009068, login: "harvey" }, fund_holder: { household: "house-of-harvey", name: "House of Harvey", handle: "amia-semper", rule: "first-resident" } });
  assert.deepEqual(f, { state: "household", account: "273009068", name: "House of Harvey" });
  paintFundFor(doc, f, { stripeLink: STRIPE });
  assert.equal(doc.querySelector("[data-for-name]").textContent, "House of Harvey");
  assert.equal(pick(doc, "[data-for-when]", "household").hidden, false);
  assert.equal(pick(doc, "[data-for-when]", "signed-out").hidden, true);
  assert.equal(doc.querySelector("[data-card]").getAttribute("href"), `${STRIPE}?client_reference_id=keeping-ec2_g273009068`);
  assert.equal(doc.querySelector("[data-pp-client]").getAttribute("data-pp-account"), "273009068");
  assert.equal(doc.querySelector("[data-usdc-household]").value, "g273009068");
  assert.equal(pick(doc, "[data-usdc-when]", "household").hidden, false, "the hash form shows, filled");
  assert.equal(pick(doc, "[data-ledger-when]", "household").hidden, false, "\"Recorded in your name\" shows");
});

test("2 · signed in with no household → an outside gift, said so; signed out → the sign-in line, bare rails", () => {
  const none = fundPage();
  paintFundFor(none, fundFor({ verified_github: { id: 5, login: "new" } }), { stripeLink: STRIPE });
  assert.equal(pick(none, "[data-for-when]", "no-household").hidden, false);
  assert.equal(none.querySelector("[data-card]").getAttribute("href"), `${STRIPE}?client_reference_id=keeping-ec2`, "no household: the bare pot, which the watcher files as an outside gift");
  assert.equal(none.querySelector("[data-pp-client]").getAttribute("data-pp-account"), null);

  const out = fundPage();
  paintFundFor(out, fundFor(null), { stripeLink: STRIPE });
  assert.equal(pick(out, "[data-for-when]", "signed-out").hidden, false);
  assert.equal(out.querySelector("[data-usdc-household]").value, "");
  assert.equal(pick(out, "[data-usdc-when]", "household").hidden, true, "the hash form waits for a household");
  assert.equal(pick(out, "[data-ledger-when]", "outside").hidden, false, "it says outside gift, not \"your name\"");
});

// ── 3 ───────────────────────────────────────────────────────────────────────

test("3 · the page asks GET /me with the layout's token, and asks nothing without a fresh one; the sign-in line presses the layout's", async () => {
  const asked = [];
  const fetchImpl = async (url, init) => { asked.push({ url, auth: init.headers.authorization }); return { ok: true, json: async () => ({ verified_github: { id: 101 }, fund_holder: { name: "The Harbor" } }) }; };
  const store = (t) => ({ getItem: () => (t ? JSON.stringify(t) : null) });
  const doc = fundPage();
  const f = await mountFundFor(doc, { storage: store({ access_token: "tok", obtained: 1000, expires_in: 3600 }), fetchImpl, api: "/api", now: 2000 });
  assert.deepEqual(asked, [{ url: "/api/me", auth: "Bearer tok" }]);
  assert.equal(f.name, "The Harbor");

  const before = asked.length;
  const stale = fundPage();
  const g = await mountFundFor(stale, { storage: store({ access_token: "old", obtained: 1000, expires_in: 1 }), fetchImpl, api: "/api", now: 10_000 });
  assert.equal(asked.length, before, "an expired token asks nothing");
  assert.equal(g.state, "signed-out");
  assert.equal(freshToken(store(null)), null);

  let pressed = 0;
  stale.querySelector("[data-auth-signin]").addEventListener("click", () => { pressed += 1; });
  stale.querySelector("[data-for-signin]").click();
  assert.equal(pressed, 1, "the row's sign-in presses the layout's own");
});

// ── 4 ───────────────────────────────────────────────────────────────────────

test("4 · nothing on the fund page asks the payer to type a handle; the stale card note is gone", () => {
  assert.ok(!/name="handle"/.test(PAGE), "the USDC form asks for no handle");
  assert.ok(!/name="pp-handle"/.test(PAGE), "the PayPal fold asks for no handle");
  assert.ok(!/Say which handle it is for/.test(PAGE));
  assert.ok(!/a person does the\s+witnessing, so it is not instant/.test(PAGE), "the Stripe watcher witnesses on its timer");
  assert.ok(!/which is which — the two rails/.test(PAGE), "the which-is-which box is gone");
  assert.match(PAGE, /data-fund-for/);
  assert.match(PAGE, /Recorded in your household's name on the town's public ledger\./);
  // an outside gift mints nothing: the signed-out lead says so, and never promises stamps
  const outside = PAGE.match(/<span data-ledger-when="outside">([^]*?)<\/span>/)?.[1] ?? "";
  assert.match(outside, /as a gift from outside the town; it mints no stamps\./);
  const ledgerLine = PAGE.match(/<p class="f-ledger-line">([^]*?)<\/p>/)?.[1] ?? "";
  const shownSignedOut = ledgerLine.replace(/<span data-ledger-when="household" hidden>[^]*?<\/span>/, "");
  assert.ok(ledgerLine && !/stamps it mints/.test(shownSignedOut), "the signed-out lead never says \"stamps it mints\"");
  // the PayPal and USDC buttons open their panels; no separate disclosure row repeats them
  assert.ok(!/<summary>[^]*?PayPal<\/span>/.test(PAGE) && !/<summary><span class="f-usdc-sum">USDC/.test(PAGE), "no summary row repeats a rail button");
  assert.match(PAGE, /aria-controls="usdc" aria-expanded="false" data-open="usdc">USDC</);
  // the three rails, in order: Card · PayPal · USDC
  const card = PAGE.indexOf(">Card ↗<"), pp = PAGE.indexOf('data-open="pay-paypal">PayPal<'), usdc = PAGE.indexOf('data-open="usdc">USDC<');
  assert.ok(PAGE.indexOf('id="pay-paypal"') > usdc && PAGE.indexOf('id="usdc"') > usdc, "the panels sit right under the button row");
  assert.ok(card > 0 && card < pp && pp < usdc, "Card · PayPal · USDC");
});

test("signed in is signed in: with a fresh token the stake island hides its sign-in before it reads, so a failed read never offers a sign-in already done", () => {
  // Wright's visual review of #213: the signed-in shot showed "Sign in with GitHub to stake" beside
  // the header's signed-in state, because the island only hid its sign-in on a SUCCESSFUL estate read.
  const load = PAGE.slice(PAGE.indexOf("function load() {"), PAGE.indexOf("sform.addEventListener(\"submit\""));
  const freshGate = load.indexOf("if (!fresh(t)) { signinWrap.hidden = false; sform.hidden = true; return; }");
  const hidden = load.indexOf("signinWrap.hidden = true;", freshGate);
  const fetchAt = load.indexOf("fetch(API + \"/household?read=stamps\"");
  assert.ok(freshGate > 0 && hidden > freshGate && hidden < fetchAt, "the sign-in is hidden once the token is fresh, before the read");
});
