// rsvp.mjs — the RSVP form's rules (POS-211, second half, 2026-09-25).
//
// The event page's form posts the office's rsvp act from a signed-in browser.
// This module is the pure, testable surface: which events take the form, what
// the handle choice is, the exact body the form posts, and the receipt a
// response becomes. The page's island only reads fields and paints; the fetch
// is injected so the tests can stand in for the office.
//
// THE CALL (the office's calendar contract, postmark-office
// docs/calendar-contract.md § The acts, and src/events.mjs judgeRsvp on
// pos-207/the-calendar): `POST /household` with the MCP door's own body,
//   { do: "rsvp", args: { event, handle, harness, budget } }
// harness is { kind: "mail" } | { kind: "webhook", url } | { kind: "letta",
// conversation }. The webhook's field is `url`: the office refuses any other
// key on a webhook harness by name (422 "a webhook harness does not take: …").
//
// THE RECEIPT is the act's answer. The household apex wraps a successful act as
// { did, dispatched_to, card?, result } with the act's own answer INSIDE
// result (postmark-town/postmark#2880, the fund page's lesson); a bounce comes
// back flat as { error, defect, hint }. Both are read here, once.

export const OPEN_PHASES = Object.freeze(["announced", "doors-open", "underway"]);
export const BUDGET_DEFAULT = 6;
export const BUDGET_MAX = 60;
export const HARNESS_KINDS = Object.freeze(["mail", "webhook", "letta"]);

// The one line under a receipt: the page is built, not live.
export const REBUILD_LINE =
  "This page's list of who is coming does not change until the site's next build after the office has your RSVP.";
export const SECRET_LINE = "Copy it now; it is not shown again.";

/**
 * Does this event take the form? `phase` and `cancelled` are the office's, as
 * the calendar read carried them into the build. A closed event gets one line
 * and no form. The office judges again at the moment of the post, so a page
 * built before an event ended can only offer a form the office then refuses
 * by name.
 */
export function rsvpGate(event) {
  if (!event) return { open: false, line: "RSVPs closed." };
  if (event.cancelled) return { open: false, line: "Cancelled: there is nothing to RSVP to." };
  if (!OPEN_PHASES.includes(event.phase)) return { open: false, line: "RSVPs closed: this event has ended." };
  return { open: true, line: null };
}

/**
 * The resident field, from the handles the signed-in key holds (`/me`'s
 * `handles`). One resident: prefilled and read-only. Several: a choice, and
 * nothing chosen for the resident. None: no form, because there is nobody to
 * RSVP as.
 */
export function handleChoice(handles) {
  const hs = [...new Set((handles ?? []).map((h) => String(h ?? "").trim()).filter(Boolean))];
  if (hs.length === 0) return { mode: "none", handles: [], value: null };
  if (hs.length === 1) return { mode: "one", handles: hs, value: hs[0] };
  return { mode: "several", handles: hs, value: null };
}

/**
 * The harness a choice names. Only the field that kind takes rides along: the
 * office refuses a harness carrying a key its kind does not take.
 */
export function harnessOf({ kind, url, conversation } = {}) {
  const k = HARNESS_KINDS.includes(kind) ? kind : "mail";
  if (k === "webhook") return { kind: "webhook", url: String(url ?? "").trim() };
  if (k === "letta") return { kind: "letta", conversation: String(conversation ?? "").trim() };
  return { kind: "mail" };
}

/**
 * The budget as posted: the number the reader typed, or the default when the
 * field is empty. A number outside 1–60 is posted as typed and the office
 * refuses it in its own words; the form's min/max stop most of those first.
 */
export function budgetOf(value) {
  if (value === undefined || value === null || String(value).trim() === "") return BUDGET_DEFAULT;
  return Number(value);
}

/** The exact body the form posts to `POST /household`. */
export function rsvpBody({ event, handle, kind, url, conversation, budget }) {
  return {
    do: "rsvp",
    args: {
      event: String(event),
      handle: String(handle),
      harness: harnessOf({ kind, url, conversation }),
      budget: budgetOf(budget),
    },
  };
}

/**
 * What a response becomes on the page. Every string is the office's own,
 * shown as text. `secret` is shown only when the answer carries one.
 */
export function receiptOf({ ok, status, json }) {
  const j = json && typeof json === "object" ? json : {};
  if (!ok || j.error) {
    return { kind: "bounce", title: j.defect || `refused (${status ?? "no status"})`, body: j.hint || "" };
  }
  const a = j.result && typeof j.result === "object" ? j.result : j;
  const harness = a.harness && typeof a.harness === "object" ? a.harness : {};
  return {
    kind: "recorded",
    title: `recorded as ${harness.kind ?? "mail"}`,
    receipt: typeof a.receipt === "string" ? a.receipt : "",
    fellBack: typeof a.fell_back === "string" && a.fell_back ? a.fell_back : null,
    budget: a.budget ?? null,
    budgetNote: typeof a.budget_note === "string" ? a.budget_note : "",
    secret: typeof a.secret === "string" && a.secret ? a.secret : null,
    rebuild: REBUILD_LINE,
  };
}

/**
 * Post the RSVP and read the answer. `base` is the office base (auth.mjs's
 * officeBase), `token` the signed-in access token. The network failing is its
 * own receipt: nothing was recorded.
 */
export async function submitRsvp({ base, token, body, fetchImpl = globalThis.fetch }) {
  let res;
  try {
    res = await fetchImpl(`${base}/household`, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
  } catch {
    return { kind: "unreachable", title: "the town could not be reached", body: "nothing was recorded. Try again shortly." };
  }
  let json = null;
  try { json = await res.json(); } catch { json = null; }
  return receiptOf({ ok: res.ok, status: res.status, json });
}
