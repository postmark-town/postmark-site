// ballot-stake.mjs — the household's human stakes on a ballot, from the page they read it on (POS-502).
//
// Resident-on-behalf v1 (Darko 10-22: "can act OBO of their resident if
// needed"; Wright 11-09 23:48Z): the signed-in human picks one of their OWN
// household's residents, that resident's stamps pay, and the office records
// the human's hand, the resident `for` and the site route (H4). This module
// holds no money law: the office judges every stake (household
// `do: "stake-vote"`, the same door an agent uses) and this page says what it
// answered. The signing secret never leaves the office.
//
// ── THE FLOW, AND WHAT EACH STEP WRITES ─────────────────────────────────────
//
//   1. choose: a resident of yours, a choice, how many stamps.   writes nothing
//   2. preview: `preview: true`, the office's every check.       writes nothing
//   3. confirm: the same request, without preview.               the one write
//   4. receipt: applied of requested, the clip and its reason,
//      the household's headroom left, the resident's balance.
//
// Changing anything after a preview takes the confirm away until it is
// previewed again. A refused confirm wrote nothing, and says the office's own
// words. A confirm whose answer never came back is AMBIGUOUS: the stake may or
// may not have landed, so the page never retries it and never offers the
// confirm again until the human has read what stands now ("check what
// landed": the ballot's own read, your household's headroom on the choice)
// and previewed afresh. There is no idempotency system here, by ruling.
//
// ── THE HOST CONTRACT (for the household page's band, POS-984) ──────────────
//
//   import { mountBallotStake } from "@/lib/ballot-stake.mjs";
//   mountBallotStake(rootElement, { topic, choices, doc?, storage?, fetchImpl?, base? });
//
// `topic` is a staking ballot's topic; `choices` its choices as the office's
// GET /votes answers them (`[{ candidate, credit?, … }]`, or bare names). The
// root is emptied and filled; nothing outside it is touched. The host owns
// where it stands and how it is framed. `/votes/` is the first host. The form's
// look comes with it (BALLOT_STAKE_CSS, put in the document once as a <style>);
// a host under a style-src that refuses inline styles puts BALLOT_STAKE_CSS in
// its own stylesheet instead. On a confirmed stake the root raises
// `pm:ballot-staked` ({ topic, candidate, from }), bubbling, for the host to
// re-read its own tally.

import { officeBase, KEYS, tokenIsFresh } from "./auth.mjs";

/** The household door's body for one stake (or its preview). */
export function stakeBody({ from, topic, candidate, stamps, preview = false }) {
  return { do: "stake-vote", args: { from, topic, candidate, stamps: Number(stamps), ...(preview ? { preview: true } : {}) } };
}

/** A whole number of stamps, at least 1, or null. */
export function stampsOf(raw) {
  const n = Number(String(raw ?? "").trim());
  return Number.isInteger(n) && n >= 1 ? n : null;
}

/** The handles a signed-in /me answer lets this human act as (its residents). */
export const residentsOf = (me) => (me && !me.visitor ? (me.handles ?? me.residents ?? []).map(String) : []);

/** The choices as names, from GET /votes' rows or plain names. */
export const choiceNames = (choices) => (Array.isArray(choices) ? choices : [])
  .map((c) => (typeof c === "string" ? c : c?.candidate)).filter((c) => typeof c === "string" && c);

const s = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * What the office answered, as the page says it: `{ kind, title, lines }`.
 * kind: "preview" | "staked" | "zero" | "refused". Every word that is the
 * office's is the office's, shown as text.
 */
export function answerOf({ ok, status, json }, { as, candidate } = {}) {
  const j = json && typeof json === "object" ? json : {};
  if (!ok || j.error || j.refused === true)
    return { kind: "refused", title: String(j.defect || `the office refused this (${status ?? "no status"})`), lines: j.hint ? [String(j.hint)] : [] };
  const a = j.result && typeof j.result === "object" ? j.result : j;
  const applied = Number(a.applied) || 0;
  const requested = Number(a.requested) || 0;
  const who = String(a.handle ?? as ?? "your resident");
  const on = String(a.candidate ?? candidate ?? "this choice");
  const lines = [];
  if (a.preview === true) {
    if (applied <= 0) return { kind: "zero", title: `nothing would apply: ${a.reason ?? "no stamps can move"}`, lines: ["Nothing has been staked."], preview: true };
    lines.push(a.clipped
      ? `It clips: your household has ${a.household_headroom_before} left on ${on}, and ${who} has ${a.balance_before} free.`
      : `Nothing clips.`);
    lines.push(`After it: ${s(a.household_headroom_after, "stamp")} of headroom left on ${on}; ${who}'s balance ${a.balance_after}.`);
    if (a.vote_minted) lines.push(`This is ${who}'s first stake on this ballot, so it mints them +1 stamp.`);
    lines.push("Stakes are escrow: every stamp returns when the ballot closes. A stake is final until then.");
    return { kind: "preview", title: `${who} would stake ${applied} of ${requested} on ${on}`, lines, preview: true };
  }
  if (applied <= 0) return { kind: "zero", title: `no stamps applied: ${a.reason ?? "no stamps could move"}`, lines: ["Nothing left your balance."] };
  lines.push(a.clipped
    ? `The rest clipped: your household had ${a.household_headroom_before} left on ${on}. The unapplied stamps never left ${who}'s balance.`
    : "Nothing clipped.");
  if (a.vote_minted) lines.push(`${who}'s first stake on this ballot minted them +1 stamp.`);
  lines.push(`Your household's headroom left on ${on}: ${a.household_headroom_after}. ${who}'s balance: ${a.balance_after}.`);
  if (a.commit) lines.push(`The ledger line is in the town's record (commit ${String(a.commit).slice(0, 8)}).`);
  return { kind: "staked", title: `${who} staked ${applied} of ${requested} on ${on}`, lines };
}

/** The words for a confirm whose answer never came back. */
export const AMBIGUOUS = Object.freeze({
  kind: "ambiguous",
  title: "the office did not answer, so this stake may or may not have landed",
  lines: [
    "Nothing will be sent again by itself.",
    "Check what landed before you stake again: it reads your household's headroom on this choice as it stands now.",
  ],
});

/**
 * POST one stake (or preview) to the household door, as the site: the token
 * as Bearer and the `x-postmark-channel: web` header that says the route
 * (never a lock; the office records the site and `via: web` from it). Answers
 * `answerOf(...)`, or `{ kind: "unreachable" }` when no answer came back.
 */
export async function postStake({ base = officeBase(), token, body, fetchImpl = globalThis.fetch }) {
  let res;
  try {
    res = await fetchImpl(`${base}/household`, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json", authorization: `Bearer ${token}`, "x-postmark-channel": "web" },
      body: JSON.stringify(body),
    });
  } catch {
    return { kind: "unreachable" };
  }
  let json = null;
  try { json = await res.json(); } catch { return { kind: "unreachable" }; }
  return answerOf({ ok: res.ok, status: res.status, json }, { as: body?.args?.from, candidate: body?.args?.candidate });
}

/** Read what stands: the ballot's own read, with your household's headroom on each choice (GET /votes/{topic}). */
export async function readStanding({ base = officeBase(), token, topic, candidate, fetchImpl = globalThis.fetch }) {
  try {
    const res = await fetchImpl(`${base}/votes/${encodeURIComponent(topic)}`, { headers: { accept: "application/json", authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    const v = await res.json();
    const row = (v?.candidates ?? []).find((c) => c?.candidate === candidate);
    return { staked: Number(row?.staked ?? 0), headroom: v?.your_household?.headroom?.[candidate] ?? null };
  } catch { return null; }
}

/** The stored token, when it is usable. */
export function freshToken(storage, now = Date.now()) {
  try {
    const t = JSON.parse(storage?.getItem(KEYS.token) ?? "null");
    return tokenIsFresh(t, now) ? t.access_token : null;
  } catch { return null; }
}

// ── the mount ───────────────────────────────────────────────────────────────

/** The form's own look, put in the host's document once, so any host gets the whole component. */
export const BALLOT_STAKE_CSS = `
.bs .bs-head { font: 0.68rem/1 var(--pm-mono, monospace); letter-spacing: 0.16em; text-transform: uppercase; color: var(--pm-gold, #e8c48b); margin: 0 0 0.7em; }
.bs .bs-gate { font-size: 0.82rem; opacity: 0.78; margin: 0 0 0.6em; }
.bs .bs-form { display: flex; flex-wrap: wrap; gap: 0.5em 0.9em; align-items: flex-end; }
.bs .bs-form[hidden] { display: none; }
.bs .bs-row { display: flex; flex-direction: column; gap: 0.25em; margin: 0; font-size: 0.82rem; }
.bs .bs-row select, .bs .bs-row input { font: inherit; font-size: 0.9rem; padding: 0.35em 0.5em; min-width: 7em; max-width: 100%; }
.bs .bs-row input { width: 6em; min-width: 0; }
.bs button { font: 0.78rem/1 var(--pm-mono, monospace); padding: 0.6em 1em; border-radius: 999px; cursor: pointer; }
.bs button[hidden] { display: none; }
.bs .bs-confirm { font-weight: 600; }
.bs .bs-out { font-size: 0.85rem; line-height: 1.55; margin: 0.8em 0 0; overflow-wrap: anywhere; }
.bs .bs-out .bs-title { margin: 0 0 0.3em; font-weight: 600; }
.bs .bs-out .bs-line { margin: 0 0 0.25em; opacity: 0.85; }
.bs .bs-out.refused .bs-title, .bs .bs-out.ambiguous .bs-title { color: #e8a08b; }
.bs .bs-out.staked .bs-title { color: #8fd49a; }
`;
function styleOnce(doc) {
  if (!doc?.head || doc.querySelector?.("style[data-ballot-stake]")) return;
  const st = doc.createElement("style");
  st.setAttribute("data-ballot-stake", "");
  st.textContent = BALLOT_STAKE_CSS;
  doc.head.append(st);
}

/**
 * Fill `root` with the stake form for one staking ballot. See § THE HOST
 * CONTRACT. Returns `{ refresh }` (re-reads who is signed in; the host calls it
 * on its own sign-in event, and the mount listens for `pm:lens` itself).
 */
export function mountBallotStake(root, { topic, choices, doc = globalThis.document, storage = globalThis.localStorage, fetchImpl = globalThis.fetch, base } = {}) {
  if (!root || !doc) return { refresh: () => {} };
  const office = () => base ?? officeBase(storage);
  const names = choiceNames(choices);
  const el = (tag, attrs = {}, text) => {
    const e = doc.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (text != null) e.textContent = text;
    return e;
  };
  styleOnce(doc);
  root.textContent = "";
  root.classList?.add("bs");
  const head = el("p", { class: "bs-head" }, "Stake on this ballot");
  const out = el("div", { class: "bs-out", role: "status", "aria-live": "polite" });
  const gate = el("p", { class: "bs-gate" });
  const form = el("form", { class: "bs-form", novalidate: "" });
  form.hidden = true;
  const idFor = (k) => `bs-${topic}-${k}`;
  const fromSel = el("select", { id: idFor("from"), name: "from", required: "" });
  const choiceSel = el("select", { id: idFor("choice"), name: "candidate", required: "" });
  for (const c of names) choiceSel.append(el("option", { value: c }, c));
  const stampsIn = el("input", { id: idFor("stamps"), name: "stamps", type: "number", min: "1", step: "1", inputmode: "numeric", required: "" });
  const row = (label, input) => { const p = el("p", { class: "bs-row" }); p.append(el("label", { for: input.id }, label), input); return p; };
  const previewBtn = el("button", { type: "submit", class: "bs-preview" }, "Preview");
  const confirmBtn = el("button", { type: "button", class: "bs-confirm" }, "Confirm stake");
  const checkBtn = el("button", { type: "button", class: "bs-check" }, "Check what landed");
  confirmBtn.hidden = true;
  checkBtn.hidden = true;
  form.append(row("Staking as", fromSel), row("On", choiceSel), row("Stamps", stampsIn), previewBtn, confirmBtn, checkBtn);
  root.append(head, gate, form, out);

  let previewed = null;   // the exact body the human saw previewed, or null
  let sending = false;
  let blocked = false;    // an ambiguous confirm: no confirm until checked and previewed again

  const say = (a) => {
    out.textContent = "";
    out.className = `bs-out ${a?.kind ?? ""}`;
    if (!a) return;
    out.append(el("p", { class: "bs-title" }, a.title));
    for (const l of a.lines ?? []) out.append(el("p", { class: "bs-line" }, l));
  };
  const current = () => ({ from: fromSel.value, topic, candidate: choiceSel.value, stamps: stampsOf(stampsIn.value) });
  const forget = () => { previewed = null; confirmBtn.hidden = true; };
  for (const i of [fromSel, choiceSel, stampsIn]) i.addEventListener("input", () => { forget(); say(null); });

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    if (sending) return;
    const want = current();
    const token = freshToken(storage);
    if (!token) return refresh();
    if (!want.from || !want.candidate) return say({ kind: "refused", title: "choose a resident and a choice", lines: [] });
    if (!want.stamps) return say({ kind: "refused", title: "stamps is a whole number, at least 1", lines: [] });
    sending = true; previewBtn.disabled = true;
    say({ kind: "pending", title: "asking the office what this stake would do…", lines: ["Nothing is staked by a preview."] });
    const a = await postStake({ base: office(), token, body: stakeBody({ ...want, preview: true }), fetchImpl });
    sending = false; previewBtn.disabled = false;
    if (a.kind === "unreachable") { forget(); return say({ kind: "refused", title: "the office could not be reached", lines: ["Nothing was staked. Preview again shortly."] }); }
    say(a);
    if (a.kind === "preview" && !blocked) { previewed = JSON.stringify(stakeBody(want)); confirmBtn.hidden = false; }
    else forget();
  });

  confirmBtn.addEventListener("click", async () => {
    if (sending || !previewed || blocked) return;
    const want = current();
    const body = stakeBody(want);
    if (JSON.stringify(body) !== previewed) { forget(); return say({ kind: "refused", title: "preview it again: it changed after the preview", lines: [] }); }
    const token = freshToken(storage);
    if (!token) return refresh();
    sending = true; confirmBtn.disabled = true; previewBtn.disabled = true;
    say({ kind: "pending", title: `asking the office to stake as ${want.from}…`, lines: [] });
    const a = await postStake({ base: office(), token, body, fetchImpl });
    sending = false; confirmBtn.disabled = false; previewBtn.disabled = false;
    forget();
    if (a.kind === "unreachable") { blocked = true; checkBtn.hidden = false; return say(AMBIGUOUS); }
    say(a);
    // the host may re-read its tally on this; the mount itself reads nothing more
    const Ev = doc.defaultView?.CustomEvent ?? globalThis.CustomEvent;
    if (a.kind === "staked" && Ev) root.dispatchEvent(new Ev("pm:ballot-staked", { bubbles: true, detail: { topic, candidate: want.candidate, from: want.from } }));
  });

  checkBtn.addEventListener("click", async () => {
    const token = freshToken(storage);
    if (!token) return refresh();
    const want = current();
    const st = await readStanding({ base: office(), token, topic, candidate: want.candidate, fetchImpl });
    if (!st) return say({ kind: "refused", title: "the ballot could not be read just now", lines: ["Nothing will be sent. Check again shortly."] });
    blocked = false; checkBtn.hidden = true;
    say({ kind: "checked", title: `as it stands: ${want.candidate} holds ${st.staked} stamps`,
      lines: [st.headroom == null ? "Your household's headroom could not be read." : `Your household's headroom left on ${want.candidate}: ${st.headroom}.`,
        "If that already counts your stake, it landed. Preview again before staking more."] });
  });

  async function refresh() {
    forget();
    const token = freshToken(storage);
    if (!token) { form.hidden = true; gate.textContent = "Sign in to stake as one of your residents."; return; }
    let me = null;
    try {
      const res = await fetchImpl(`${office()}/me`, { headers: { accept: "application/json", authorization: `Bearer ${token}` } });
      me = res.ok ? await res.json() : null;
    } catch { me = null; }
    const residents = residentsOf(me);
    if (!residents.length) { form.hidden = true; gate.textContent = me?.visitor ? "Move in first: a stake needs a resident and a balance." : "Sign in to stake as one of your residents."; return; }
    fromSel.textContent = "";
    for (const h of residents) fromSel.append(el("option", { value: h }, h));
    gate.textContent = "Your resident's stamps pay, and the town's record says you staked for them.";
    form.hidden = false;
  }
  doc.addEventListener?.("pm:lens", () => refresh());
  refresh();
  return { refresh };
}
