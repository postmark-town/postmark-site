// hearth-coming-up.test.mjs — the public Coming up slot, restored (POS-1068).
//
//   node --test test/hearth-coming-up.test.mjs
//
// Darko, 2026-11-15 20:11 EST (via POS-1067): the old household page showed which events residents RSVP'd to and which are coming up, and "we
// kind of lost that functionality ... we should hotfix it into all of the default/postmark-designed hearths as well as the template". This is
// the SITE half: a public `<hearth-coming-up>` slot over the existing road (reads.calendar -> fold.mjs comingUpOf -> paint.mjs paintComing).
// The six designs that place it are POS-1069 (a town PR, later): the committed town entries carry no marker yet, on purpose, so every check
// of the slot here runs on a SYNTHETIC entry. Synthetic invented events and residents throughout; nothing reads the office.
//
//   § 1  the registry and the markup: one public slot, the same markup on the first draw and in the preview template, no gate
//   § 2  the road is unchanged: the hosting-or-going filter and order, cancelled and unrelated events kept out, the right resident chips
//   § 3  the painter (run against the smallest document, the habit of household-reads-progress.test.mjs): still reading, did not answer,
//        and nothing coming are three different sentences, and none of them is a hidden slot
//   § 4  compatibility both ways, independent of the committed data: a design without the marker and the same design with it are each accepted,
//        the default's must-place list is unchanged, and a synthetic entry places the slot

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { prepareEntries } from "../src/lib/hearth/entries.mjs";
import { sanitizeHtml } from "../src/lib/hearth/sanitize-html.mjs";
import { SLOTS, SLOT_NAMES, slotTag } from "../src/lib/hearth/slots.mjs";
import { comingUpOf, readingOf, NOT_READING } from "../src/lib/household-dashboard/fold.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(resolve(ROOT, p), "utf8");

// ── the smallest document ────────────────────────────────────────────────────────────────────────────────────────────────────────
function node(tag, attrs = {}) {
  const el = {
    tag, className: "", hidden: "hidden" in attrs, attrs: { ...attrs }, children: [], dataset: {}, style: { setProperty() {} }, href: "",
    classList: { add(c) { el.className = (el.className + " " + c).trim(); }, toggle() {} }, _text: "",
    appendChild(child) { el.children.push(child); return child; },
    append(...xs) { for (const x of xs) el.children.push(typeof x === "string" ? text(x) : x); },
    // as a DOM does: `class` and `href` are reflected to their properties (the mention, CORE-178, sets them as attributes)
    setAttribute(k, v) { el.attrs[k] = String(v); if (k === "class") el.className = String(v); if (k === "href") el.href = String(v); }, removeAttribute(k) { delete el.attrs[k]; },
    remove() {},
    get textContent() { return el._text + el.children.map((c) => c.textContent).join(""); },
    set textContent(v) { el._text = String(v); el.children.length = 0; },
    querySelector(sel) { return find(el, sel); }, querySelectorAll() { return []; },
  };
  return el;
}
const text = (t) => { const n = node("#text"); n.textContent = t; return n; };
function find(root, sel) {
  const m = /^\[([\w-]+)(?:="([^"]*)")?\]$/.exec(sel);
  if (!m) return null;
  const walk = (n) => { for (const c of n.children) { if (m[1] in c.attrs && (m[2] == null || c.attrs[m[1]] === m[2])) return c; const hit = walk(c); if (hit) return hit; } return null; };
  return walk(root);
}
const all = (n, pred, out = []) => { for (const c of n.children) { if (pred(c)) out.push(c); all(c, pred, out); } return out; };
// what a reader hears: a mention's face (its picture or initial) is aria-hidden (CORE-178)
const heard = (n) => (n.attrs?.["aria-hidden"] === "true" ? "" : n._text + n.children.map(heard).join(""));
globalThis.document = { createElement: (t) => node(t), createTextNode: text };
globalThis.CSS = { escape: (s) => s };
const { paintHouse } = await import("../src/lib/household-dashboard/paint.mjs");

// a stage holding only the slot's hooks, as HearthSlot.astro draws them (hidden until painted)
const stage = () => {
  const root = node("div");
  const sec = node("section", { "data-hd-coming": "", hidden: "" });
  const list = node("div", { "data-hd-events": "" });
  sec.appendChild(list); root.appendChild(sec);
  return { root, sec, list };
};

const HOUSE = ["mari", "wren"];
const FACES = { mari: { handle: "mari", name: "Mari", monogram: "M" }, wren: { handle: "wren", name: "Wren", monogram: "W" } };
const ctx = (extra = {}) => ({ handles: HOUSE, faces: FACES, slug: "the-synthetic-house", owner: false, now: Date.parse("2031-05-01T12:00:00Z"), seatHref: (h) => `/residents/${h}/`, ...extra });
const ev = (o) => ({ phase: "announced", starts: "2031-05-03T19:00:00Z", rsvps: { residents: [] }, ...o });
const CAL = { now: [], coming: [
  ev({ id: "mari/lantern-walk", title: "Lantern walk", host: "mari", place: { name: "the-old-well" }, rsvps: { residents: ["wren", "stranger"] } }),
  ev({ id: "other/tea", title: "Tea at the quay", host: "other", starts: "2031-05-02T15:00:00Z", rsvps: { residents: ["wren"] } }),
  ev({ id: "other/not-ours", title: "Not ours", host: "other", rsvps: { residents: ["stranger"] } }),
  ev({ id: "mari/gone", title: "Cancelled walk", host: "mari", cancelled: true }),
] };

// ── § 1 ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
test("§ 1 a public coming-up slot is registered; the first draw and the preview template are one component with the dashboard's own hooks", () => {
  assert.ok(SLOT_NAMES.includes("coming-up"));
  assert.equal(SLOTS["coming-up"].private, false, "public: no bearer, no owner gate");
  assert.deepEqual(SLOT_NAMES.filter((n) => SLOTS[n].private).sort(), ["mail", "needs-you"], "no private slot was added");
  const slot = read("src/components/hearth/HearthSlot.astro");
  const block = slot.slice(slot.indexOf('{name === "coming-up" && ('), slot.indexOf('{name === "around-town" && ('));
  assert.match(block, /data-hearth-slot="coming-up" data-hd-coming hidden/, "ships hidden; the painter shows it");
  assert.match(block, /<div class="hd-events" data-hd-events><\/div>/);
  assert.ok(!/data-private|bearer|token/.test(block), "no owner or sign-in gate on the slot");
  // the page draws every slot twice from this one component: on the stage and in a <template> per slot for the preview
  const hearth = read("src/components/hearth/Hearth.astro");
  assert.match(hearth, /\{SLOT_NAMES\.map\(\(name\) => \(\s*<template data-hearth-slot-tpl=\{name\}><HearthSlot name=\{name\} \{\.\.\.slotProps\} \/><\/template>/, "the preview template is the same component, for every slot name");
  // the markers are the dashboard's own, so the one painter reaches both hosts
  assert.match(read("src/components/household-dashboard/HouseDashboard.astro"), /data-hd-coming hidden[\s\S]*data-hd-events/);
});

test("§ 1 the host CSS carries the event look (.hd-event, .hd-date, .hd-going) in the Hearth's own tokens, with a phone rule", () => {
  const css = read("src/components/hearth/hearth-host.css");
  for (const sel of [".hearth-stage .hd-events .hd-event", ".hearth-stage .hd-events .hd-date", ".hearth-stage .hd-events .hd-going"]) assert.ok(css.includes(sel), `${sel} is styled`);
  assert.match(css, /@media \(max-width: 760px\) \{\s*\.hearth-stage \.hd-events \.hd-event \{ grid-template-columns: 4em/, "and a phone layout");
  const rule = css.slice(css.indexOf(".hearth-stage .hd-events .hd-event {"));
  assert.ok(/var\(--hx-glass\)/.test(rule) && /var\(--hx-hair\)/.test(rule), "in the Hearth's tokens, not the dashboard's");
});

// ── § 2 ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
test("§ 2 the road is unchanged: hosting-or-going only, soonest first, cancelled and unrelated events kept out, only the house's own residents as chips", () => {
  const events = comingUpOf(CAL, HOUSE);
  assert.deepEqual(events.map((e) => e.id), ["other/tea", "mari/lantern-walk"], "a RSVP'd event and a hosted one, soonest first");
  assert.deepEqual(events.find((e) => e.id === "mari/lantern-walk").going, ["wren"], "a stranger who RSVP'd is not one of the house's chips");
  assert.ok(!events.some((e) => e.id === "other/not-ours"), "an unrelated event does not leak in");
  assert.ok(!events.some((e) => e.id === "mari/gone"), "a cancelled event does not leak in");
  assert.equal(events[1].place, "the old well", "the place reads as words");
});

// ── § 3 ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
test("§ 3 events draw: date, an event-linked title, time/place/host, and the going residents' chips; the slot is shown", () => {
  const { root, sec, list } = stage();
  paintHouse(root, { calendar: CAL }, ctx());
  assert.equal(sec.hidden, false);
  const rows = all(list, (n) => n.className === "hd-event");
  assert.equal(rows.length, 2);
  const lantern = rows[1];
  const link = all(lantern, (n) => n.tag === "a")[0];
  assert.equal(link.textContent, "Lantern walk");
  assert.equal(link.href, "/calendar/mari/lantern-walk/", "the title links to the event");
  assert.match(lantern.textContent, /the old well/);
  assert.match(heard(lantern), /hosted by Mari/);
  // CORE-178: the house's host is named as every resident is, a mention to their seat
  const host = all(lantern, (n) => String(n.className).split(" ").includes("rm") && n.attrs["data-rm"] === "mari")[0];
  assert.ok(host, "the host is a resident mention");
  assert.equal(host.href, "/residents/mari/");
  const going = all(lantern, (n) => n.className === "hd-going")[0];
  assert.match(going.textContent, /Wren/, "the house's resident who is going");
  assert.ok(!/stranger/.test(lantern.textContent), "never an outsider's chip");
});

test("§ 3 PENDING says 'still reading', FAILED says it did not answer, EMPTY says nothing is coming: three different sentences, none hidden", () => {
  const words = (reads, reading) => {
    const { root, sec, list } = stage();
    paintHouse(root, reads, ctx(reading ? { reading } : {}));
    return { hidden: sec.hidden, said: list.textContent };
  };
  const pending = words({ calendar: null }, readingOf({ waiting: ["calendar"], pending: [] }));
  const failed = words({ calendar: null }, readingOf({ waiting: [], pending: [] }));
  const failedNoCtx = words({ calendar: null });
  const empty = words({ calendar: { now: [], coming: [] } });
  const unrelatedOnly = words({ calendar: { now: [], coming: [ev({ id: "other/x", title: "X", host: "other" })] } });
  assert.equal(pending.hidden, false, "pending is not hidden");
  assert.equal(pending.said, "Still reading the calendar…");
  assert.equal(failed.hidden, false, "failure is not hidden");
  assert.match(failed.said, /^The calendar did not answer/);
  assert.equal(failedNoCtx.said, failed.said, "no reading context at all is a failure, not a pending");
  assert.equal(empty.hidden, false);
  assert.equal(empty.said, "Nothing on the calendar that the house is hosting or going to.");
  assert.equal(unrelatedOnly.said, empty.said, "a calendar of other people's events is empty for this house");
  assert.equal(new Set([pending.said, failed.said, empty.said]).size, 3, "three sentences");
  assert.ok(!/did not answer/.test(pending.said) && !/nothing/i.test(pending.said), "pending is not called failure or empty");
  assert.ok(!/still reading/i.test(failed.said + empty.said), "failure and empty never say they are still reading");
  assert.ok(!/Nothing on the calendar/.test(failed.said), "failure is never called empty");
  // an OTHER pending read (a resident's) does not make the calendar "still reading"
  assert.match(words({ calendar: null }, readingOf({ waiting: [], pending: ["mari"] })).said, /did not answer/);
  assert.equal(readingOf({ waiting: ["calendar"] }).house.includes("calendar"), true);
  assert.equal(NOT_READING.house.length, 0);
});

test("§ 3 the painter and the slot stay public: the slot's path reads no bearer, and the dashboard host is unchanged in shape", () => {
  const paint = read("src/lib/household-dashboard/paint.mjs");
  const fn = paint.slice(paint.indexOf("function paintComing("), paint.indexOf("// The day's quest cards"));
  assert.ok(!/owner|bearer|token/.test(fn), "paintComing has no owner or bearer branch");
  assert.match(fn, /\[data-hd-coming\]/);
  assert.match(fn, /\[data-hd-events\]/);
});

// ── § 4 ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// Compatibility, stated in BOTH directions and independent of the committed town data (it must stay true the day POS-1069's marker placements
// arrive, and while they have not): a design WITHOUT the marker and the same design WITH it are each accepted whole, each keeps every slot
// the default must place, and the marker adds exactly one slot. The committed rows supply the design; the marker is added to a copy here.
const MUST_PLACE = ["house", "residents", "happened", "needs-you", "stamps", "posts", "marks", "closer", "mail", "around-town"];
test("§ 4 the default design is accepted whether or not it carries the marker: the old (no marker) and the restored (with marker) both pass, and the marker adds one slot", () => {
  const rows = JSON.parse(read("src/data/postmark/hearths.json"));
  const row = rows.find((r) => r.id === "default");
  assert.ok(row, "the default entry's row is there to start from");
  const bare = { ...row, html: String(row.html).replace(/<hearth-coming-up\s*><\/hearth-coming-up>/g, "") };         // the old shape: no marker, whatever the data holds today
  const withMarker = { ...bare, html: bare.html.replace(/(<hearth-residents\s*><\/hearth-residents>)/, `$1<hearth-coming-up></hearth-coming-up>`) };
  assert.notEqual(withMarker.html, bare.html, "the fixture really did place the marker");
  const old = prepareEntries([bare]), restored = prepareEntries([withMarker]);
  assert.deepEqual([old.rejected, restored.rejected], [[], []]);
  assert.deepEqual([old.entries[0].problems, restored.entries[0].problems], [[], []], "the sanitizers remove nothing either way");
  for (const e of [old.entries[0], restored.entries[0]]) for (const s of MUST_PLACE) assert.ok(e.slots.includes(s), `${e.id} still places ${s}`);
  assert.ok(!old.entries[0].slots.includes("coming-up"), "the old shape has no coming-up and nothing requires it");
  assert.deepEqual(restored.entries[0].slots.filter((s) => s !== "coming-up"), old.entries[0].slots, "the marker changes no other slot, nor their order");
  assert.equal(restored.entries[0].slots.filter((s) => s === "coming-up").length, 1);
});

test("§ 4 a SYNTHETIC entry places <hearth-coming-up> through the same road: accepted, no problems, in order", () => {
  assert.equal(sanitizeHtml(`<${slotTag("coming-up")}></${slotTag("coming-up")}>`).html, `<div data-hearth-slot="coming-up"></div>`);
  const synthetic = { id: "synthetic-coming", title: "Synthetic coming up", author: "synthetic-coming", line: "A made-up design.",
    html: `<main><hearth-house></hearth-house><hearth-coming-up></hearth-coming-up><hearth-residents></hearth-residents></main>`, css: `main { display: grid }` };
  const { entries, rejected } = prepareEntries([synthetic]);
  assert.deepEqual(rejected, []);
  assert.deepEqual(entries[0].problems, []);
  assert.deepEqual(entries[0].slots, ["house", "coming-up", "residents"]);
});
