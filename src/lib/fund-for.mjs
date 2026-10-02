// fund-for.mjs — the fund page's one "for" row (POS-317, Keemin 2026-10-02).
//
// "A signed-in payer sees their household's name and types nothing; a
// signed-out payer is an outside gift." So the page asks the office who is
// signed in (GET /me, with the layout's own token) and paints ONE row above the
// three rails:
//
//   signed in, with a household  →  "for <household name>", and every rail's
//                                    reference carries the account (fund-ref.mjs)
//   signed in, no household      →  an outside gift, said so
//   signed out                   →  "Sign in to put it in your household's name",
//                                    and the rails still work, as an outside gift
//
// The household's name is the office's `fund_holder`, from the SAME function
// the payment watchers resolve the reference through (postmark-office
// src/fund-holder.mjs), so the page never names a household the watcher would
// not credit.

import { officeBase } from "./auth.mjs";
import { cardHref, accountRef } from "./fund-ref.mjs";

const TOKEN_KEY = "pm.oauth.token";

/** The layout's stored token, if it is still fresh (the stake island's own rule). */
export function freshToken(storage, now = Date.now()) {
  let t = null;
  try { t = JSON.parse(storage?.getItem(TOKEN_KEY) || "null"); } catch { return null; }
  if (!t || !t.access_token) return null;
  if (t.obtained && t.expires_in && now >= t.obtained + t.expires_in * 1000) return null;
  return t;
}

/**
 * What the row says and what the rails carry, from GET /me's answer (or null
 * when signed out or the read failed). Pure.
 */
export function fundFor(me) {
  const id = me?.verified_github?.id ?? null;
  const holder = me?.fund_holder ?? null;
  if (id != null && holder?.name) return { state: "household", account: String(id), name: holder.name };
  if (id != null) return { state: "no-household", account: null, name: null };
  return { state: "signed-out", account: null, name: null };
}

/** Paint the row and mint the account into every rail on the page. */
export function paintFundFor(doc, f, { stripeLink }) {
  const row = doc.querySelector("[data-fund-for]");
  if (!row) return;
  row.setAttribute("data-state", f.state);
  const name = row.querySelector("[data-for-name]");
  if (name) name.textContent = f.name ?? "";
  for (const el of row.querySelectorAll("[data-for-when]")) el.hidden = el.getAttribute("data-for-when") !== f.state;
  const card = doc.querySelector("[data-card]");
  if (card) card.setAttribute("href", cardHref(stripeLink, card.getAttribute("data-pot"), f.account));
  const pp = doc.querySelector("[data-pp-client]");
  if (pp) { if (f.account) pp.setAttribute("data-pp-account", f.account); else pp.removeAttribute("data-pp-account"); }
  const hh = doc.querySelector("[data-usdc-household]");
  if (hh) hh.value = f.account ? accountRef(f.account) : "";
  for (const el of doc.querySelectorAll("[data-usdc-when]")) el.hidden = el.getAttribute("data-usdc-when") !== (f.account ? "household" : "signed-out");
  for (const el of doc.querySelectorAll("[data-ledger-when]")) el.hidden = el.getAttribute("data-ledger-when") !== (f.account ? "household" : "outside");
}

/** Ask the office who is signed in, then paint. The signed-out row stands until it answers. */
export async function mountFundFor(doc, { storage = globalThis.localStorage, fetchImpl = globalThis.fetch, api = officeBase(), now = Date.now() } = {}) {
  const row = doc.querySelector("[data-fund-for]");
  if (!row) return null;
  const stripeLink = row.getAttribute("data-stripe");
  const signin = row.querySelector("[data-for-signin]");
  signin?.addEventListener("click", () => doc.querySelector("[data-auth-signin]")?.click());
  const t = freshToken(storage, now);
  let me = null;
  if (t) {
    try {
      const r = await fetchImpl(`${api}/me`, { headers: { accept: "application/json", authorization: `Bearer ${t.access_token}` } });
      if (r.ok) me = await r.json();
    } catch { /* unreachable: the row stays signed out, and the rails stay outside gifts */ }
  }
  const f = fundFor(me);
  paintFundFor(doc, f, { stripeLink });
  return f;
}
