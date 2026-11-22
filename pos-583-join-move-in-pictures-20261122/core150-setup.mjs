// core150-setup.mjs: the site-prep `shots --setup` module for CORE-150 (POS-583 whole-page pictures of the REAL /join/move-in/ page).
// INVENTED fixtures only: no real sign-in, join, operator act, credential or production office. Everything the page asks of "the office" is answered HERE, on the
// preview's own origin, through route mocks (network seam), and the page is signed in by a fixture session in localStorage (session seam); nothing is inserted into the DOM
// by this module except what a reader does (typing into the page's own boxes and pressing its own buttons).
//
// The state is chosen by the path's query, `?fx=<state>`:
//   declare-before | declare-after    the declaring visitor (tier "visitor" -> act `declare`), review screen, cards of office 7e4e078b / 08ede635
//   add-before     | add-after        the house's keeper (tier "resident" -> act `add-resident`), review screen
//   declare-step   | add-step         (after cards only) the one-question screen of "What they run on" itself
//   reply-pr       | reply-boarding   add-resident with a runtime offered, sent through the page's own button; the office's pinned reply shown by the page
//
// Cards: fixtures/cards-before.json (postmark-office train/2026-w48 7e4e078b3af9353ea6cc1fe9b35f0db2df321792) and fixtures/cards-after.json (#1175 08ede63547823823c3d7d5937033bffe14690be4),
// Rivet's extraction of the act cards' human `fields` (household-apex.mjs fieldsForAct, human: true), validated against the pinned sources (see PREP.md).
// Replies: fixtures/replies.json, built from the pinned src/residency.mjs strings (build-replies.mjs).
import { readFileSync } from "node:fs";

const FX = "/var/tmp/core-150/fixtures/";
const J = (f) => JSON.parse(readFileSync(FX + f, "utf8"));
const CARDS = { before: J("cards-before.json"), after: J("cards-after.json") };
const REPLIES = J("replies.json");
const BLURB = { declare: "Found a household at the door.", "add-resident": "Add a resident to the house you already keep." };   // the captured cards' own sentences (site test/join-move-in.test.mjs), the same before and after

const stateOf = (path) => new URL(path, "http://x.invalid").searchParams.get("fx") ?? "";
const which = (fx) => (fx.startsWith("declare") ? "declare" : "add-resident");
const side = (fx) => (/-after$|-step$|^reply-/.test(fx) ? "after" : "before");

// the abridged act line of the bare answer: names, types, required; no human hints (the index never carries them)
const abridged = (fields) => Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, { type: v.type, description: v.description, ...(v.required ? { required: true } : {}) }]));
const cardOf = (cards, act) => ({ act, blurb: BLURB[act], teaches: BLURB[act], fields: cards[act], dispatches_to: act === "declare" ? "declare_household" : "request_residency" });

const text = (obj) => ({ result: { content: [{ type: "text", text: JSON.stringify(obj) }] } });

/** The fixture office: JSON-RPC at /mcp and GET /me, answered on the preview's own origin. */
function office({ fx, base }) {
  const cards = CARDS[side(fx)];
  const act = which(fx);
  const tier = act === "declare" ? "visitor" : "resident";
  const card = cardOf(cards, act);
  const bare = act === "declare"
    ? { tier, next: ["Found your household at the door: the form below is this act's card."], acts: [{ act, blurb: card.blurb, teaches: card.teaches, dispatches_to: card.dispatches_to, fields: abridged(cards.declare) }] }
    : { tier, household: "fixture-house", residents: ["fixture-resident"], acts: [{ act, blurb: card.blurb, teaches: card.teaches, dispatches_to: card.dispatches_to, fields: abridged(cards["add-resident"]) }] };
  const replyFor = fx === "reply-boarding" ? REPLIES.boarding : REPLIES.pr;
  const me = { handles: ["fixture-resident"], households: { "fixture-resident": { slug: "fixture-house" } } };
  const calls = [];
  const handler = async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const json = (status, body) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (url.pathname === "/me") return json(200, me);
    if (url.pathname !== "/mcp" || req.method() !== "POST") return json(404, { error: "no such door in the fixture office" });
    let msg = {}; try { msg = JSON.parse(req.postData() || "{}"); } catch { /* an unreadable body is answered as nothing */ }
    calls.push(msg.method + (msg.params?.name ? ":" + msg.params.name : ""));
    const reply = (res) => json(200, { jsonrpc: "2.0", id: msg.id, ...res });
    if (msg.method === "notifications/initialized") return route.fulfill({ status: 202, body: "" });
    if (msg.method === "initialize") return reply({ result: { protocolVersion: "2025-06-18", serverInfo: { name: "fixture-office", version: "cards of postmark-office " + (side(fx) === "after" ? "08ede635 (#1175)" : "7e4e078b (w48)") }, capabilities: {} } });
    if (msg.method === "tools/list") return reply({ result: { tools: [{ name: "household", description: "fixture", inputSchema: { type: "object" } }] } });
    if (msg.method === "tools/call" && msg.params?.name === "household") {
      const a = msg.params.arguments ?? {};
      if (a.do) {   // the act itself: answered by the PINNED reply, wrapped as household-apex.mjs wraps every act's receipt ({ did, dispatched_to, card, result }); nothing is joined
        if (a.do === "add-resident") return reply(text({ did: "add-resident", dispatched_to: "request_residency", card, result: replyFor }));
        return reply(text({ defect: "the fixture office does not perform " + a.do, hint: "evidence fixture" }));
      }
      if (a.read === act) return reply(text({ read: act, card }));
      if (a.read) return reply(text({ defect: "the fixture office reads only " + act }));
      return reply(text(bare));
    }
    return json(200, { jsonrpc: "2.0", id: msg.id, error: { code: -32601, message: "method not in the fixture office" } });
  };
  return { handler, calls };
}

/** Before goto: the fixture session and the fixture office. */
export default async function setup({ page, context, path, base }) {
  const fx = stateOf(path);
  if (!fx) return;
  await context.addInitScript(({ base: b }) => {
    try {
      localStorage.setItem("pm.office.base", b);
      localStorage.setItem("pm.oauth.token", JSON.stringify({ access_token: "fixture-invented-session", obtained: Date.now(), expires_in: 3600 }));
      localStorage.removeItem("pm.oauth.client_id");
    } catch { /* a private window runs without memory */ }
  }, { base });
  const o = office({ fx, base });
  await context.route(base + "/mcp", o.handler);
  await context.route(base + "/me", o.handler);
  page.__core150 = o;
}

const FILL = { household: "Fixture House (invented)", handle: "fixture-fledgling", card: "An invented fixture resident, made for the CORE-150 pictures. Nothing here is a real person or a real request." };

/** One reader's pass through the page's own funnel: type in the required boxes, press Continue/Skip, until `stopAt` is current or the review is up. */
async function walk(page, { stopAt = null, runtime = null } = {}) {
  for (let i = 0; i < 40; i++) {
    const st = await page.evaluate(() => {
      const review = document.querySelector("[data-jf-review]");
      const cur = document.querySelector("[data-form-host] .field.is-current");
      const c = cur && cur.querySelector("input, textarea, select");
      return { review: !!review && !review.hidden, field: cur ? cur.getAttribute("data-field") : null, required: !!(cur && cur.querySelector('[aria-required="true"]')), empty: c ? !String(c.value).trim() : true };
    });
    if (st.review) return st;
    if (stopAt && st.field === stopAt) return st;
    const value = st.field === "runtime" ? runtime : (st.required && st.empty ? FILL[st.field] ?? "invented" : null);
    if (st.field && value) await page.fill(`[data-form-host] .field.is-current input, [data-form-host] .field.is-current textarea`, value);
    await page.click("[data-jf-next]");
    await page.waitForTimeout(150);
  }
  throw new Error("core150-setup: the funnel never reached its review");
}

/** After goto, before the shots: take the page to the state asked for. */
export async function after({ page, path }) {
  const fx = stateOf(path);
  if (!fx) return;
  await page.waitForSelector("[data-gate-act]:not([hidden])", { timeout: 25000 });
  if (/-step$/.test(fx)) { await walk(page, { stopAt: "runtime" }); await page.waitForTimeout(400); return; }
  if (/^reply-/.test(fx)) {
    await walk(page, { runtime: "Fixture model on a fixture platform (invented)" });
    await page.click("[data-submit]");
    await page.waitForSelector("[data-gate-reply]:not([hidden])", { timeout: 15000 });
    await page.waitForTimeout(1500);   // the page scrolls to the top smoothly once it has shown the reply
    return;
  }
  await walk(page);
  await page.waitForTimeout(400);
}
