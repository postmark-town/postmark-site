// rsvp.test.mjs — the RSVP form on the event page (POS-211, second half, 2026-09-25).
//
//   node --test test/rsvp.test.mjs
//
// The rules live in src/lib/rsvp.mjs and are judged here with a stubbed fetch
// standing in for the office: CI runs these. The built-page arms read
// dist-town/ when the event pages are built and SKIP when they are not
// (POS-177's guard: on the page each arm reads), and are judged against the
// committed calendar.json, whatever it holds. That is the empty calendar until
// the office's door lands, so the fixture's rendered proof is the lane's
// variant build, as calendar.test.mjs says of the first half.

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  rsvpGate, handleChoice, harnessOf, budgetOf, rsvpBody, receiptOf, submitRsvp,
  BUDGET_DEFAULT, BUDGET_MAX, OPEN_PHASES, SECRET_LINE, REBUILD_LINE,
} from "../src/lib/rsvp.mjs";
import { eventsOf, eventParams } from "../src/lib/calendar.mjs";

const ROOT = join(import.meta.dirname, "..");
const read = (...p) => readFileSync(join(ROOT, ...p), "utf8");
const SAMPLE = JSON.parse(read("test", "fixtures", "calendar.sample.json"));
const COMMITTED = JSON.parse(read("src", "data", "postmark", "calendar.json"));
const COMING = SAMPLE.coming[0];
const PAGE = read("town", "pages", "calendar", "[host]", "[slug].astro");

// A stand-in for the office: records every call, answers with `answer`.
function stubFetch(answer = { status: 200, json: { did: "rsvp", result: { harness: { kind: "mail" }, budget: 6, receipt: "ok" } } }) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, method: init?.method, headers: init?.headers, body: init?.body === undefined ? undefined : JSON.parse(init.body) });
    if (answer instanceof Error) throw answer;
    return { ok: answer.status >= 200 && answer.status < 300, status: answer.status, json: async () => answer.json };
  };
  return { calls, fetchImpl };
}

// ── which events take the form ───────────────────────────────────────────────

test("the form is offered while the event is announced, doors-open or underway, and not cancelled", () => {
  assert.deepEqual([...OPEN_PHASES], ["announced", "doors-open", "underway"]);
  for (const phase of OPEN_PHASES) assert.equal(rsvpGate({ phase, cancelled: false }).open, true, phase);
  assert.equal(rsvpGate(COMING).open, true, "the fixture's coming event");
  assert.equal(rsvpGate(SAMPLE.now[0]).open, true, "the fixture's doors-open event");
});

test("no form on an ended event, and none on a cancelled one: one line each", () => {
  const ended = rsvpGate({ ...COMING, phase: "ended" });
  assert.equal(ended.open, false);
  assert.match(ended.line, /^RSVPs closed/);
  const cancelled = rsvpGate({ ...COMING, cancelled: true });
  assert.equal(cancelled.open, false);
  assert.match(cancelled.line, /^Cancelled/);
  assert.equal(rsvpGate({ phase: "underway", cancelled: true }).open, false, "cancelled wins over an open phase");
  assert.equal(rsvpGate({ phase: "something-new" }).open, false, "a phase the site does not know takes no form");
});

// ── the resident ─────────────────────────────────────────────────────────────

test("one resident is prefilled and read-only; several are a choice with none chosen; none is no form", () => {
  assert.deepEqual(handleChoice(["wright"]), { mode: "one", handles: ["wright"], value: "wright" });
  assert.deepEqual(handleChoice(["wright", "rei"]), { mode: "several", handles: ["wright", "rei"], value: null });
  assert.equal(handleChoice([]).mode, "none");
  assert.equal(handleChoice(undefined).mode, "none");
  assert.equal(handleChoice(["wright", "wright", " "]).mode, "one", "a repeated or blank handle is not a second resident");
});

// ── the exact body ───────────────────────────────────────────────────────────

test("FALSIFIER: webhook, one resident, budget 10 posts exactly POST /household { do: rsvp, args: { event, handle, harness, budget } }", async () => {
  const { calls, fetchImpl } = stubFetch();
  const choice = handleChoice(["wright"]);
  const body = rsvpBody({ event: COMING.id, handle: choice.value, kind: "webhook", url: "https://hooks.example.net/pm", conversation: "ignored", budget: "10" });
  await submitRsvp({ base: "/api", token: "tok-1", body, fetchImpl });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "/api/household");
  assert.equal(calls[0].method, "POST");
  assert.equal(calls[0].headers.authorization, "Bearer tok-1");
  assert.deepEqual(calls[0].body, {
    do: "rsvp",
    args: { event: "wright/reading-by-the-lamp", handle: "wright", harness: { kind: "webhook", url: "https://hooks.example.net/pm" }, budget: 10 },
  });
});

test("mail posts { kind: mail } and nothing else in the harness; an empty budget posts the default", async () => {
  const { calls, fetchImpl } = stubFetch();
  await submitRsvp({ base: "/api", token: "t", body: rsvpBody({ event: COMING.id, handle: "wright", kind: "mail", url: "https://x.example", conversation: "c1", budget: "" }), fetchImpl });
  assert.deepEqual(calls[0].body, { do: "rsvp", args: { event: COMING.id, handle: "wright", harness: { kind: "mail" }, budget: BUDGET_DEFAULT } });
});

test("letta posts its conversation and nothing else in the harness", async () => {
  const { calls, fetchImpl } = stubFetch();
  await submitRsvp({ base: "/api", token: "t", body: rsvpBody({ event: COMING.id, handle: "rei", kind: "letta", url: "https://x.example", conversation: " conv-42 ", budget: 60 }), fetchImpl });
  assert.deepEqual(calls[0].body, { do: "rsvp", args: { event: COMING.id, handle: "rei", harness: { kind: "letta", conversation: "conv-42" }, budget: 60 } });
});

test("the webhook's field is `url`, the key the office's judgeRsvp takes; an unknown kind posts mail", () => {
  assert.deepEqual(Object.keys(harnessOf({ kind: "webhook", url: "https://a.example" })), ["kind", "url"]);
  assert.deepEqual(harnessOf({ kind: "carrier-pigeon" }), { kind: "mail" });
  assert.equal(budgetOf(null), BUDGET_DEFAULT);
  assert.equal(budgetOf("12"), 12);
  assert.equal(BUDGET_MAX, 60);
});

// ── the receipt ──────────────────────────────────────────────────────────────

test("a recorded RSVP reads the act's answer inside the door's envelope: kind, receipt, budget", async () => {
  const { fetchImpl } = stubFetch({ status: 200, json: { did: "rsvp", dispatched_to: "rsvp", result: {
    event: COMING.id, handle: "wright", harness: { kind: "letta", conversation: "c" }, budget: 9,
    budget_note: "at most 9 wakes for this event", receipt: `RSVPed to ${COMING.id} by letta`,
  } } });
  const r = await submitRsvp({ base: "/api", token: "t", body: rsvpBody({ event: COMING.id, handle: "wright", kind: "letta", conversation: "c", budget: 9 }), fetchImpl });
  assert.equal(r.kind, "recorded");
  assert.equal(r.title, "recorded as letta");
  assert.equal(r.receipt, `RSVPed to ${COMING.id} by letta`);
  assert.equal(r.budget, 9);
  assert.equal(r.fellBack, null);
  assert.equal(r.secret, null);
  assert.equal(r.rebuild, REBUILD_LINE);
});

test("a webhook that did not echo: recorded as mail, and fell_back carried with its sentence", () => {
  const r = receiptOf({ ok: true, status: 200, json: { result: {
    harness: { kind: "mail" }, fell_back: "url did not echo the nonce", budget: 6,
    receipt: `RSVPed to ${COMING.id} by mail: url did not echo the nonce, so the ferry carries it`,
  } } });
  assert.equal(r.title, "recorded as mail");
  assert.equal(r.fellBack, "url did not echo the nonce");
  assert.match(r.receipt, /so the ferry carries it$/);
});

test("the secret renders only when the envelope carries it", () => {
  const note = "shown once; not shown again — keep it where your harness can read it";
  const withSecret = receiptOf({ ok: true, status: 200, json: { result: { harness: { kind: "webhook", url: "https://a.example" }, budget: 10, receipt: "r", secret: "a".repeat(64), secret_note: note } } });
  assert.equal(withSecret.secret, "a".repeat(64));
  assert.equal(withSecret.secretNote, note, "the office's own note rides with the secret");
  assert.equal(receiptOf({ ok: true, status: 200, json: { result: { harness: { kind: "webhook" }, secret_note: note } } }).secretNote, "", "no secret, no note");
  for (const secret of [undefined, null, "", 42]) {
    const r = receiptOf({ ok: true, status: 200, json: { result: { harness: { kind: "webhook" }, budget: 10, receipt: "r", ...(secret === undefined ? {} : { secret }) } } });
    assert.equal(r.secret, null, `secret ${JSON.stringify(secret)} must not render`);
  }
  assert.equal(SECRET_LINE, "Copy it now; it is not shown again.");
});

test("a bounce is the office's own words: defect as the title, hint as the body", async () => {
  const { fetchImpl } = stubFetch({ status: 422, json: { error: "bounce", defect: "a webhook url is https", hint: "got http://" } });
  const r = await submitRsvp({ base: "/api", token: "t", body: rsvpBody({ event: COMING.id, handle: "wright", kind: "webhook", url: "http://a.example" }), fetchImpl });
  assert.deepEqual(r, { kind: "bounce", title: "a webhook url is https", body: "got http://" });
  assert.equal(receiptOf({ ok: false, status: 500, json: null }).title, "refused (500)", "a bounce with no words still says it bounced");
});

test("the office unreachable is its own answer: nothing was recorded", async () => {
  const { fetchImpl } = stubFetch(new Error("offline"));
  const r = await submitRsvp({ base: "/api", token: "t", body: rsvpBody({ event: COMING.id, handle: "wright" }), fetchImpl });
  assert.equal(r.kind, "unreachable");
  assert.match(r.body, /nothing was recorded/);
});

// ── the page's island ────────────────────────────────────────────────────────

test("the event page's island posts through rsvpBody/submitRsvp and paints with textContent, never innerHTML", () => {
  const island = PAGE.slice(PAGE.indexOf("THE RSVP ISLAND"));
  assert.ok(island.length > 100, "the island is on the page");
  assert.match(island, /rsvpBody\(/);
  assert.match(island, /submitRsvp\(/);
  assert.match(island, /handleChoice\(/);
  assert.match(island, /textContent/);
  assert.equal(/innerHTML|insertAdjacentHTML|outerHTML/.test(island), false, "the office's words reach the page as markup");
  assert.equal(/\sset:html\s*=/.test(PAGE), false);
});

// ── the built pages ──────────────────────────────────────────────────────────

const DIST = join(ROOT, "dist-town");
const eventFile = (e) => { const p = eventParams(e.id); return p && join(DIST, "calendar", p.host, p.slug, "index.html"); };
const committedEvents = eventsOf(COMMITTED).filter((e) => eventParams(e.id));
const builtEvents = committedEvents.filter((e) => existsSync(eventFile(e)));
const notBuilt = committedEvents.length === 0 ? "the committed calendar holds no events" : builtEvents.length === 0 && "dist-town/calendar/<host>/<slug>/ is not built";

test("BUILT: an open event carries the form; a cancelled or ended one carries its line and no form", { skip: notBuilt }, () => {
  for (const e of builtEvents) {
    const html = readFileSync(eventFile(e), "utf8");
    const gate = rsvpGate(e);
    assert.match(html, /data-rsvp\b/, `${e.id}: no RSVP section`);
    if (gate.open) {
      assert.match(html, /data-rsvp-form/, `${e.id} is open and has no form`);
      assert.doesNotMatch(html, /data-rsvp-closed/, `${e.id} is open and says closed`);
      assert.match(html, /name="budget"[^>]*value="6"|value="6"[^>]*name="budget"/, `${e.id}: the budget does not default to 6`);
      for (const kind of ["mail", "webhook", "letta"]) assert.match(html, new RegExp(`name="kind" value="${kind}"`), `${e.id}: no ${kind} choice`);
    } else {
      assert.doesNotMatch(html, /data-rsvp-form/, `${e.id} is ${e.cancelled ? "cancelled" : e.phase} and still has a form`);
      assert.match(html, /data-rsvp-closed/, `${e.id}: closed with no line saying so`);
      assert.ok(html.includes(gate.line.replace(/'/g, "&#39;")) || html.includes(gate.line), `${e.id}: the closed line is not "${gate.line}"`);
    }
  }
});
