// hearth-v2.test.mjs — the Hearth contract v2 on the site (POS-1024, POS-1028).
//
// LAW (POS-1024, ruled by Darko 2026-11-13 09:07–09:21 EST):
//   09:17 "I want both": window-style freedom (the house's own scripted part, reading public Postmark data) AND new site-drawn slots.
//   09:21 "make sure we aren't drifting and doing some weird sandboxing for thee scripted portions. the 100 stamp min and our close manual pr
//         review is the security that precisely lets us AVOID the sandboxing friction of iframes or whatever. DONT do that".
//   /d    "just let them script it however they want, it's their thing".
//   body  "Private parts still stay out of anything a script can read, so the bundle a script gets is public data only."

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SLOTS, SLOT_NAMES, slotTag, LIMITS } from "../src/lib/hearth/slots.mjs";
import { sanitizeHtml } from "../src/lib/hearth/sanitize-html.mjs";
import { sanitizeCss, stageFor } from "../src/lib/hearth/sanitize-css.mjs";
import { prepareEntry, fingerprint } from "../src/lib/hearth/entries.mjs";
import { dataOf, collectionOf, pairsOf, tiesOf, wentOf, feedOf, dayOf, humanLogOf, partsFor, safeHref, bundleUrl, bundleFrom, unavailable } from "../src/lib/hearth/bundle.mjs";
import { scriptUrlOf, hearthApi, runEntryScript, emit, NOT_YOUR_HOUSE } from "../src/lib/hearth/script.mjs";
import { syncHearths } from "../tools/sync-hearths.mjs";
import { CHANNEL_HEADER } from "../src/lib/office-write.mjs";
import { hearthPolicy } from "../tools/lib/hearth-csp.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const D921 = "Darko 09:21: no sandboxing for the scripted part: no iframe, no separate origin";

// ── the slots ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

test("the v2 slots are slots: the residents' windows, ties, stamps that went, the town feed, a resident's day, and the house's pane", () => {
  for (const n of ["windows", "ties", "stamps-went", "town", "day", "pane"]) {
    assert.ok(SLOT_NAMES.includes(n), `${n} is a slot`);
    assert.equal(sanitizeHtml(`<${slotTag(n)}></${slotTag(n)}>`).html, `<div data-hearth-slot="${n}"></div>`);
    assert.equal(SLOTS[n].private, false, `${n} is public`);
  }
  // control: a name off the list is still not a slot
  assert.deepEqual(sanitizeHtml("<hearth-desk></hearth-desk>").problems, ["slot:hearth-desk"]);
  assert.deepEqual(SLOT_NAMES.filter((n) => SLOTS[n].private).sort(), ["mail", "needs-you"], "v2 adds no private slot");
});

test("every v2 part but the pane ships hidden, so a part whose data has not come draws nothing; the pane is an empty box", () => {
  const slot = read("src/components/hearth/HearthSlot.astro");
  for (const n of ["windows", "ties", "stamps-went", "town", "day"]) {
    const open = new RegExp(`<section [^>]*data-hearth-slot="${n}"[^>]*>`).exec(slot)?.[0];
    assert.ok(open, `${n} has its section`);
    assert.match(open, /\shidden[\s>]/, `${n} ships hidden`);
  }
  assert.match(slot, /<div class="hx hx-pane" data-hearth-slot="pane"><\/div>/, "the pane is an empty box the house's script draws into");
});

// ── gaps 9 and 10: the owner's view, the caption hook ───────────────────────────────────────────────────────────────────────────────────────

test("a design may style the owner's view apart from a visitor's (data-hearth-view) and every caption (data-hearth-part); other attributes stay refused", () => {
  const id = "t";
  const { css, problems } = sanitizeCss(':root[data-hearth-view="owner"] .x { color: red } [data-hearth-part="caption"] { display: none }', id);
  assert.deepEqual(problems, []);
  assert.ok(css.includes(`${stageFor(id)}[data-hearth-view="owner"] .u-x{color:red}`), "the owner's view, on the stage itself: " + css);
  assert.ok(css.includes(`${stageFor(id)} [data-hearth-part="caption"]{display:none}`), "the caption hook, inside the stage: " + css);
  // control: an attribute off the list is still dropped, so the two above are allowed by name, not by a widened rule
  assert.deepEqual(sanitizeCss('[data-hd-view="owner"] { color: red }', id).problems, ['css:selector:[data-hd-view="owner"]']);
  // the page sets the hook, and every slot caption carries the part name
  assert.match(read("src/components/hearth/Hearth.astro"), /data-hearth-view="public"/);
  assert.match(read("src/lib/hearth/stage.mjs"), /stage\.dataset\.hearthView = owner \? "owner" : "public";/);
  const slot = read("src/components/hearth/HearthSlot.astro");
  assert.equal((slot.match(/<p class="hd-meta">/g) ?? []).length, 0, "no slot caption is left without the hook");
  assert.ok((slot.match(/data-hearth-part="caption"/g) ?? []).length >= 10);
});

// ── the bundle: POS-1027's settled envelope (Rivet, 2026-11-13) ──────────────────────────────────────────────────────────────────────────────
// Until 2026-11-13 these tests read the proposal's draft shape (closer rows per resident with out/in, pairs as rows with quote_a/quote_b, a `day`
// map). The office settled `{ read: "hearth", household, parts }`, each part `{ via, data }` with `data` the standalone read's own answer; the
// tests below hold the same rules on that shape.

const HOUSE = ["fox", "owl"];
const via = (door, read, args = {}) => ({ door, read, args });
const part = (door, read, data, args) => ({ via: via(door, read, args), data });
const BUNDLE = {
  read: "hearth", household: "fox-and-owl",
  parts: {
    closer: part("household", "closer", { read: "closer", household: "fox-and-owl", rows: [
      { with: "hare", of: "The Warren", letters: 7, milestones: [{ by: "fox", rung: "first letter", day: "2026-11-01" }], stamps_between: 5, last_at: "2026-11-12T10:00:00Z" },
      { with: "wren", of: null, letters: 1, last_at: "2026-11-10T00:00:00Z" },
      { with: "robin", of: null, letters: 2, last_at: "2026-11-09T00:00:00Z" },
      { with: "owl", letters: 50 },        // a housemate: the office never lists one (closerRows), and the site never draws one
      { with: "hare", letters: 3 },        // a correspondent listed twice: one row
    ] }, { household: "fox-and-owl", limit: 10 }),
    pairs: [
      part("town", "pair", { a: "fox", b: "hare", letters: { a_to_b: 4, b_to_a: 3 }, milestones: [],
        latest: { a_to_b: { id: "l1", delivered_at: "2026-11-11T12:00:00Z", line: "I will, at dusk." }, b_to_a: { id: "l2", delivered_at: "2026-11-12T10:00:00Z", line: "Come by the mill." } } }, { a: "fox", b: "hare" }),
      part("town", "pair", { a: "owl", b: "hare", letters: { a_to_b: 1, b_to_a: 0 }, latest: { a_to_b: { line: "Hello, hare." }, b_to_a: null } }, { a: "owl", b: "hare" }),
      part("town", "pair", { a: "owl", b: "wren", letters: { a_to_b: 1, b_to_a: 0 }, latest: { a_to_b: null, b_to_a: null } }, { a: "owl", b: "wren" }),
    ],
    went: part("household", "stamps", { read: "stamps", view: "went", rows: [
      { at: "2026-11-10T00:00:00Z", date: "2026-11-10", from: "fox", to: "meeps-fund", stamps: 5, for: "the-meeps-fund", kind: "pot", href: "/fund/meeps-fund/" },
      { at: "2026-11-11T00:00:00Z", date: "2026-11-11", from: "owl", to: "wren/a-bigger-porch", stamps: 2, for: "a-bigger-porch", kind: "idea", href: "https://evil.example/" },
      { at: "2026-11-11T00:00:00Z", date: "2026-11-11", from: "fox", to: "meeps-fund", stamps: 3, for: "again", kind: "pot" },
      { from: "fox", stamps: 0, kind: "pot" },
      { from: "stranger", to: "x", stamps: 9, kind: "gift" },
    ] }),
    happened: part("household", "happened", { read: "happened", rows: [
      { at: "2026-11-13T10:00:00Z", hand: "human", for: "fox", verb: "rsvp", object: "bread-night", by: "Fox and Owl's human for fox" },
      { at: "2026-11-13T11:00:00Z", hand: "owl", for: "owl", verb: "say", object: null },
    ] }),
    feed: part("town", "feed", { sort: "newest", kinds: null, cursor: "c1", rows: [
      { id: "i1", kind: "idea", at: "2026-11-12T00:00:00Z", title: "Lanterns on the quay", href: "/posts/x/", backing: 2 },
      { id: "e1", kind: "event", at: "2026-11-13T00:00:00Z", title: "Bread night", backing: 9 },
      { id: "x", kind: "idea", title: "" },
    ] }),
    days: [
      part("household", "day", { handle: "fox", date: "2026-11-13", sentences: ["wrote 2 letters, to hare and wren"], counts: { letters: 2 } }, { handle: "fox", date: "2026-11-13" }),
      part("household", "day", { handle: "owl", date: "2026-11-13", sentences: ["A quiet day."], counts: {} }, { handle: "owl", date: "2026-11-13" }),
    ],
  },
};

test("THE ENVELOPE (POS-1027): only { read: \"hearth\", household, parts } is a bundle; each part's data is read through its { via, data }", () => {
  // LAW (POS-1027, Rivet): "The response is `{ read: \"hearth\", household: \"<canonical slug>\", parts }`." "Each part is `{ via: { door, read, args }, data }`".
  assert.equal(bundleFrom(BUNDLE), BUNDLE);
  assert.equal(bundleFrom({ ...BUNDLE, read: "house" }), null, "another read is not the bundle");
  assert.equal(bundleFrom({ household: "fox-and-owl", parts: BUNDLE.parts }), null, "no `read`: not the bundle (the draft shape had none)");
  assert.equal(bundleFrom({ read: "hearth", parts: BUNDLE.parts }), null, "no household: not the bundle");
  assert.equal(bundleFrom({ read: "hearth", household: "x" }), null, "no parts: not the bundle");
  assert.equal(bundleFrom({ read: "hearth", household: "x", parts: [] }), null, "parts must be keyed, not a list");
  assert.equal(bundleFrom({ error: "no such read" }), null, "a refusal (the read not shipped yet) is not a bundle");
  assert.equal(bundleFrom([]), null);
  assert.equal(dataOf(BUNDLE, "closer").rows.length, 5, "a part's data is the standalone read's answer");
  assert.equal(dataOf({ ...BUNDLE, parts: { closer: { via: via("household", "closer") } } }, "closer"), null, "a part with no data is no answer");
  assert.equal(dataOf({ ...BUNDLE, parts: { closer: BUNDLE.parts.closer.data } }, "closer"), null, "a bare answer without its { via, data } is not a part");
  assert.equal(collectionOf(BUNDLE, "days").length, 2);
  assert.equal(collectionOf({ ...BUNDLE, parts: { days: { unavailable: "the house could not be read" } } }, "days"), null,
    "a named unavailability (not an array) is no collection: 'return its named unavailability rather than inventing an empty `days` or `pairs`'");
  assert.equal(bundleUrl("https://postmark.town/api", "fox+owl"), "https://postmark.town/api/household?read=hearth&household=fox%2Bowl");
});

test("a bundle that did not come, or a part it does not carry, folds to null: its slot draws nothing", () => {
  for (const f of [tiesOf, wentOf, dayOf, pairsOf]) assert.equal(f(null, HOUSE), null);
  assert.equal(feedOf(null), null);
  assert.equal(humanLogOf(null), null);
  assert.equal(tiesOf({ ...BUNDLE, parts: {} }, HOUSE), null, "no closer part: no ties, not 'no ties'");
  assert.equal(dayOf({ ...BUNDLE, parts: { days: { unavailable: "x" } } }, HOUSE), null, "an unavailable collection draws nothing, not a quiet day");
  assert.deepEqual(Object.keys(partsFor(BUNDLE, HOUSE)).sort(), ["days", "feed", "humanLog", "pairs", "ties", "went"], "what a house's script reads as hearth.parts");
  assert.deepEqual(Object.values(partsFor(null, HOUSE)), [null, null, null, null, null, null]);
});

test("ties: one row per correspondent, most letters first, joined to the resident who writes them most, with the newest line each way, the right way round", () => {
  const t = tiesOf(BUNDLE, HOUSE);
  assert.deepEqual(t.rows.map((r) => [r.handle, r.with, r.letters]), [["fox", "hare", 7], [null, "robin", 2], ["owl", "wren", 1]],
    "a housemate is never drawn; a correspondent listed twice is one row; one with no pair on the page is the house's");
  // fox wrote hare "I will, at dusk." (a_to_b, fox being a) and hare wrote fox "Come by the mill." (b_to_a)
  assert.deepEqual([t.rows[0].out, t.rows[0].in, t.rows[0].quoteOut, t.rows[0].quoteIn], [4, 3, "I will, at dusk.", "Come by the mill."]);
  assert.deepEqual(t.rows[0].milestones, ["first letter"]);
  assert.equal(t.rows[0].stamps, 5);
  assert.deepEqual([t.rows[1].out, t.rows[1].in], [null, null], "no pair: no direction is made up");
  assert.deepEqual([t.rows[2].quoteOut, t.rows[2].quoteIn], [null, null], "a pair with no letter delivered either way has no quote");
  assert.deepEqual(tiesOf({ ...BUNDLE, parts: { closer: part("household", "closer", { rows: [] }) } }, HOUSE).rows, [], "an answered closer with no rows is an honest none");
  // the strongest pair wins whichever order the office lists them in (until 2026-11-13: the in-house pair from either side, on the draft shape)
  const flipped = { ...BUNDLE, parts: { ...BUNDLE.parts, pairs: [...BUNDLE.parts.pairs].reverse() } };
  assert.equal(tiesOf(flipped, HOUSE).rows[0].handle, "fox");
  // eight rows, quotes on the first three only (Darko 2026-11-11 on small text)
  const many = { ...BUNDLE, parts: {
    closer: part("household", "closer", { rows: Array.from({ length: 11 }, (_, i) => ({ with: "w" + i, letters: 20 - i })) }),
    pairs: Array.from({ length: 11 }, (_, i) => part("town", "pair", { a: "fox", b: "w" + i, letters: { a_to_b: 20 - i, b_to_a: 0 }, latest: { a_to_b: { line: "q" + i }, b_to_a: null } })),
  } };
  const m = tiesOf(many, HOUSE);
  assert.deepEqual([m.rows.length, m.total], [8, 11]);
  assert.deepEqual(m.rows.map((r) => r.quoteOut), ["q0", "q1", "q2", null, null, null, null, null]);
});

test("pairs (what a script draws ties from): the house's residents to outsiders only, letters each way, strongest first", () => {
  const p = pairsOf(BUNDLE, HOUSE);
  assert.deepEqual(p.map((r) => [r.handle, r.with, r.out, r.in]), [["fox", "hare", 4, 3], ["owl", "hare", 1, 0], ["owl", "wren", 1, 0]]);
  const odd = { ...BUNDLE, parts: { pairs: [part("town", "pair", { a: "fox", b: "owl", letters: { a_to_b: 9, b_to_a: 9 } }), part("town", "pair", { a: "stranger", b: "hare", letters: { a_to_b: 9 } })] } };
  assert.deepEqual(pairsOf(odd, HOUSE), [], "a pair inside the house, or one whose `a` is not the house's, is not drawn");
});

test("stamps that went: grouped by kind, totals from the rows, zero rows dropped, another house's row dropped, an outside link never carried", () => {
  const w = wentOf(BUNDLE, HOUSE);
  assert.deepEqual(w.groups.map((g) => [g.kind, g.total, g.rows.length]), [["pot", 8, 2], ["idea", 2, 1]]);
  assert.equal(w.total, 10);
  assert.equal(w.groups[1].rows[0].href, null, "a https link from the bundle is not put on the page");
  assert.equal(w.groups[0].rows.find((r) => r.title === "the meeps fund").href, "/fund/meeps-fund/");
  assert.equal(wentOf({ ...BUNDLE, parts: { went: part("household", "stamps", { rows: [{ from: "fox", stamps: 4 }] }) } }, HOUSE).groups[0].kind, "other", "a row with no kind yet is 'elsewhere', not dropped");
  assert.equal(safeHref("//evil.example/"), null);
  assert.equal(safeHref("javascript:alert(1)"), null);
});

test("the town feed: titled rows only, newest first, backing read; 'nearest' offered only when a row carries a distance", () => {
  const f = feedOf(BUNDLE);
  assert.deepEqual(f.rows.map((r) => [r.title, r.backed]), [["Bread night", 9], ["Lanterns on the quay", 2]]);
  assert.deepEqual(f.sorts, ["newest", "backed"]);
  assert.deepEqual(feedOf({ ...BUNDLE, parts: { feed: part("town", "feed", { rows: [{ title: "x", distance: 40 }] }) } }).sorts, ["newest", "backed", "near"]);
});

test("a resident's day: in the house's order, the office's own sentences; a quiet day is the office's quiet sentence, a resident it did not read is not read", () => {
  const d = dayOf(BUNDLE, [...HOUSE, "newt"]);
  assert.deepEqual(d.rows.map((r) => [r.handle, r.lines, r.answered]),
    [["fox", ["wrote 2 letters, to hare and wren"], true], ["owl", ["A quiet day."], true], ["newt", [], false]]);
});

// ── UNAVAILABLE IS MISSING, NOT EMPTY (review of #420 at 40993488), one test per slot so a red names its slot ──────────────────────────────
// LAW (POS-1027, Rivet): "unavailable history must not masquerade as a quiet day"; the office's marker is `unavailable: "<why>"` beside its rows
// (office house-bundle.mjs: `{ rows: [], unavailable: "… unknown, not none" }`). Each slot: the marked answer folds to null (its slot hidden),
// rows beside the marker are not shown as if whole, and the control (the same answer without the marker) is an honest none.
const U = "the store could not be read: unknown, not none";
const with1 = (key, data) => ({ ...BUNDLE, parts: { ...BUNDLE.parts, [key]: part("household", key, data) } });
const SOME = [{ with: "hare", letters: 2, from: "fox", stamps: 2, title: "t", hand: "human", verb: "x" }];
for (const [name, key, fold, isNone] of [
  ["ties (closer)", "closer", (b) => tiesOf(b, HOUSE), (r) => r.rows.length === 0],
  ["stamps-went", "went", (b) => wentOf(b, HOUSE), (r) => r.groups.length === 0],
  ["town (feed)", "feed", (b) => feedOf(b), (r) => r.rows.length === 0],
  ["the human's record (happened)", "happened", (b) => humanLogOf(b), (r) => r.length === 0],
]) {
  test(`unavailable is missing, not empty: ${name}`, () => {
    assert.equal(fold(with1(key, { rows: [], unavailable: U })), null, `${name}: an unavailable answer is missing, so its slot stays hidden`);
    assert.equal(fold(with1(key, { rows: SOME, unavailable: U })), null, `${name}: rows beside the marker are not shown as if whole`);
    assert.ok(isNone(fold(with1(key, { rows: [] }))), `${name}: control, the same answer without the marker is an honest none`);
  });
}

test("unavailable is missing, not empty: a resident's day the office could not read is 'not read', never quiet", () => {
  const days = { ...BUNDLE, parts: { ...BUNDLE.parts, days: [
    part("household", "day", { handle: "fox", date: "2026-11-13", sentences: ["wrote 2 letters, to hare and wren"] }),
    part("household", "day", { handle: "owl", date: "2026-11-13", sentences: [], counts: {}, unavailable: U }),
  ] } };
  assert.deepEqual(dayOf(days, HOUSE).rows.map((r) => [r.handle, r.answered]), [["fox", true], ["owl", false]]);
});

test("unavailable is missing, not empty: a pair the office could not read is left out, and its correspondent shows the house's total only", () => {
  const pairs = { ...BUNDLE, parts: { ...BUNDLE.parts, pairs: [
    part("town", "pair", { a: "fox", b: "hare", letters: { a_to_b: 4, b_to_a: 3 }, latest: { a_to_b: { line: "x" }, b_to_a: null }, unavailable: U }),
  ] } };
  assert.deepEqual(pairsOf(pairs, HOUSE), []);
  const hare = tiesOf(pairs, HOUSE).rows.find((r) => r.with === "hare");
  assert.deepEqual([hare.handle, hare.out, hare.quoteOut, hare.letters], [null, null, null, 7]);
  assert.equal(unavailable({ rows: [], unavailable: "" }), false, "an empty marker is no marker");
});

test("the human's own record: the public happened rows whose hand is the human's", () => {
  assert.deepEqual(humanLogOf(BUNDLE).map((r) => [r.words, r.for]), [["rsvp bread night", "fox"]]);
  assert.deepEqual(humanLogOf({ ...BUNDLE, parts: { happened: part("household", "happened", { rows: [] }) } }), [], "answered, none: an honest none");
});

// ── the house's own script ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────

test("an entry's hearth.js rides as a fingerprint, never as code on the page; over the window's cap it is not served, and said", () => {
  const base = { id: "glow", title: "Glow", author: "fox", line: "a line", html: "<hearth-pane></hearth-pane><hearth-house></hearth-house>", css: "" };
  const plain = prepareEntry(base);
  assert.equal(plain.script, null, "no hearth.js, no script");
  const js = "export default function (h) { h.pane.textContent = 'hi'; }";
  const e = prepareEntry({ ...base, js });
  assert.deepEqual(e.problems, []);
  assert.equal(e.script.hash, fingerprint(js));
  assert.notEqual(fingerprint(js), fingerprint(js + " "), "a changed script has a new address");
  assert.ok(!JSON.stringify(e).includes("textContent"), "the prepared entry carries no code");
  const big = prepareEntry({ ...base, js: "x".repeat(LIMITS.script + 1) });
  assert.equal(big.script, null);
  assert.deepEqual(big.problems, ["script:size-limit"]);
  assert.equal(LIMITS.script, 150_000, "a window's own cap (office src/edit.mjs)");
});

test("the intake copies hearth.js from the town folder, and an entry without one carries no js field", () => {
  const town = fs.mkdtempSync(path.join(os.tmpdir(), "hearth-v2-"));
  try {
    const dir = path.join(town, "PROJECTS", "household-hearths");
    fs.mkdirSync(path.join(dir, "glow"), { recursive: true });
    fs.mkdirSync(path.join(dir, "plain"), { recursive: true });
    fs.writeFileSync(path.join(dir, "glow", "hearth.html"), "<hearth-pane></hearth-pane>");
    fs.writeFileSync(path.join(dir, "glow", "hearth.js"), "export default function () {}\r\n");
    fs.writeFileSync(path.join(dir, "plain", "hearth.html"), "<hearth-house></hearth-house>");
    const { rows } = syncHearths(town);
    assert.equal(rows.find((r) => r.id === "glow").js, "export default function () {}\n");
    assert.equal("js" in rows.find((r) => r.id === "plain"), false);
  } finally { fs.rmSync(town, { recursive: true, force: true }); }   // the test's own mkdtemp folder (LANE-DISCIPLINE: a script's own temp folder)
});

test("the script's address is the site's own origin, versioned by content; a bad id or fingerprint gets none", () => {
  assert.equal(scriptUrlOf({ id: "glow", script: { hash: "0123456789abcdef" } }), "/hearths/glow.js?v=0123456789ab");
  assert.equal(scriptUrlOf({ id: "glow", script: null }), null);
  assert.equal(scriptUrlOf({ id: "../x", script: { hash: "0123456789abcdef" } }), null);
  assert.equal(scriptUrlOf({ id: "glow", script: { hash: "nothex!" } }), null);
});

function fakeStage() {
  const pane = { textContent: "" };
  return { querySelector: (sel) => (sel === '[data-hearth-slot="pane"]' ? pane : null), pane };
}

test("the script runs with the public bundle, hears it land, and its stop runs when another design is drawn; a script that throws takes nothing down", async () => {
  const stage = fakeStage();
  const state = { bundle: null, owner: false, token: () => null };
  const listeners = { bundle: new Set(), view: new Set() };
  const hearth = hearthApi({ entryId: "glow", stage, house: { slug: "fox", key: "fox", handles: ["fox"], residents: [] }, api: "https://o.test", state, listeners });
  let stopped = 0, heard = null;
  const entry = { id: "glow", script: { hash: "0123456789abcdef" } };
  const loaded = [];
  const stop = await runEntryScript(entry, hearth, { load: async (url) => { loaded.push(url); return { default: (h) => { h.pane.textContent = "drawn"; h.on("bundle", (b) => { heard = b; }); return () => { stopped++; }; } }; } });
  assert.deepEqual(loaded, ["/hearths/glow.js?v=0123456789ab"]);
  assert.equal(stage.pane.textContent, "drawn", "the script draws in the page's own pane: it is on the page, not in a frame");
  assert.equal(hearth.bundle, null);
  state.bundle = BUNDLE;
  emit(listeners, "bundle", BUNDLE);
  assert.equal(heard, BUNDLE);
  assert.equal(hearth.bundle, BUNDLE, "the getter reads the newest");
  // hearth.parts: the same bundle, folded by the site, so a script never parses the office's rows (this house is fox alone: owl's pairs are not its)
  assert.equal(hearth.parts.pairs[0].with, "hare");
  assert.equal(hearth.parts.humanLog[0].words, "rsvp bread night");
  stop();
  assert.equal(stopped, 1);
  const quiet = console.error; console.error = () => {};
  try {
    const s2 = await runEntryScript(entry, hearth, { load: async () => ({ default: () => { throw new Error("boom"); } }) });
    assert.equal(typeof s2, "function");
    const s3 = await runEntryScript(entry, hearth, { load: async () => { throw new Error("404"); } });
    assert.equal(typeof s3, "function");
  } finally { console.error = quiet; }
  assert.equal(typeof (await runEntryScript({ id: "plain", script: null }, hearth, { load: async () => { throw new Error("must not load"); } })), "function", "no script, nothing loaded");
});

test("a script reads public data signed out, and acts only for the house's own signed-in human, through the doors' web twins with the site header", async () => {
  const seen = [];
  const fetchImpl = async (url, init) => { seen.push({ url, init }); return { ok: true, status: 200, json: async () => ({ fine: true }) }; };
  const state = { bundle: null, owner: false, token: () => "reader-token" };
  const hearth = hearthApi({ entryId: "glow", stage: fakeStage(), house: {}, api: "https://o.test", state, listeners: { bundle: new Set(), view: new Set() }, fetchImpl });
  assert.deepEqual(await hearth.read("/mail/fox?box=outbox"), { fine: true });
  assert.equal(seen[0].url, "https://o.test/mail/fox?box=outbox");
  assert.equal("authorization" in seen[0].init.headers, false, "a read never carries the reader's bearer: public data only");
  assert.equal(await hearth.read("https://elsewhere.test/x"), null, "a read is an office path, never an outside address");
  // a visitor's sign-in (another house's, or none): refused, nothing sent
  assert.equal(await hearth.act({ door: "household", do: "rsvp", args: {} }), NOT_YOUR_HOUSE);
  assert.equal(seen.length, 1, "a refused act sends nothing");
  // the house's own human: one act to the door's web twin, as MCP sends it
  state.owner = true;
  const r = await hearth.act({ door: "town", do: "stake", args: { post: "p", stamps: 1 } });
  assert.equal(r.ok, true);
  assert.equal(seen[1].url, "https://o.test/town/apex");
  assert.equal(seen[1].init.headers.authorization, "Bearer reader-token");
  assert.equal(seen[1].init.headers[CHANNEL_HEADER], "web", "the act files as the human's, on the site");
  assert.deepEqual(JSON.parse(seen[1].init.body), { do: "stake", args: { post: "p", stamps: 1 } });
  assert.equal(hearth.view, "owner");
});

test("NO SANDBOX (text pin, comments stripped): the scripted part is a module of the page, never a frame; the windows slot keeps the windows' own frame", () => {
  const code = (f) => read(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'])\/\/[^\n]*/g, "$1");
  for (const f of ["src/lib/hearth/script.mjs", "town/pages/hearths/[id].js.js"]) {
    const src = code(f);
    assert.ok(src.length > 200, `${f}: the strip left the code (a control that it ate comments, not code)`);
    assert.ok(!/iframe|sandbox|srcdoc|createElement\(|panes\.postmark/.test(src), `${f}: ${D921}`);
  }
  assert.match(code("src/lib/hearth/script.mjs"), /import\(\/\* @vite-ignore \*\/ url\)|import\(url\)|load = \(url\) => import\(/, "the script is imported as a module of this page");
  assert.match(read("town/pages/hearths/[id].js.js"), /"content-type": "text\/javascript; charset=utf-8"/, "served from the site's own origin, as a script");
  // the policy is not touched: no new script source, no unsafe-inline, nothing added for the house's script
  const scriptSrc = hearthPolicy(["sha256-abc"]).split("; ").find((d) => d.startsWith("script-src "));
  assert.equal(scriptSrc, "script-src 'self' 'sha256-abc'", "the page's script policy is the site's own files and the host's hashes: unchanged by v2, and enough for a house script served from /hearths/");
  // the residents' windows are not the Hearth's script: hung through the office without review, each keeps its own origin and sandbox
  assert.match(read("src/lib/hearth/paint-v2.mjs"), /frame\.setAttribute\("sandbox", "allow-scripts"\)/);
});
