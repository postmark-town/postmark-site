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
import { partOf, tiesOf, wentOf, feedOf, dayOf, safeHref, bundleUrl, bundleFrom } from "../src/lib/hearth/bundle.mjs";
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

// ── the bundle (coded against the proposal's draft shape; POS-1027 had posted none) ──────────────────────────────────────────────────────────

const HOUSE = ["fox", "owl"];
const BUNDLE = {
  household: "fox+owl",
  parts: {
    closer: { read: "closer", rows: [
      { handle: "fox", with: "hare", out: 4, in: 3, stamps: 5, latest_at: "2026-11-12T10:00:00Z", milestones: [{ name: "first letter" }] },
      { handle: "owl", with: "wren", out: 1, in: 0 },
      { handle: "stranger", with: "hare", out: 50, in: 50 },
    ] },
    pairs: { read: "pair", rows: [{ a: "hare", b: "fox", quote_a: "Come by the mill.", quote_b: "I will, at dusk." }] },
    went: { read: "stamps", view: "went", rows: [
      { at: "2026-11-10T00:00:00Z", handle: "fox", kind: "pot", stamps: 5, title: "the meeps fund", href: "/fund/meeps-fund/" },
      { at: "2026-11-11T00:00:00Z", handle: "owl", kind: "idea", stamps: 2, title: "a bigger porch", href: "https://evil.example/" },
      { at: "2026-11-11T00:00:00Z", handle: "fox", kind: "pot", stamps: 3, title: "again" },
      { handle: "fox", kind: "pot", stamps: 0 },
    ] },
    feed: { read: "feed", rows: [
      { kind: "idea", at: "2026-11-12T00:00:00Z", title: "Lanterns on the quay", href: "/posts/x/", backed: 2 },
      { kind: "event", at: "2026-11-13T00:00:00Z", title: "Bread night", backed: 9 },
      { kind: "idea", title: "" },
    ] },
    day: { read: "day", residents: { fox: { date: "2026-11-13", lines: ["wrote 2 letters, to hare and wren"] }, owl: { date: "2026-11-13", lines: [] } } },
  },
};

test("a bundle that did not come, or a part it does not carry, folds to null: its slot draws nothing", () => {
  for (const f of [tiesOf, wentOf, dayOf]) assert.equal(f(null, HOUSE), null);
  assert.equal(feedOf(null), null);
  assert.equal(tiesOf({ parts: {} }, HOUSE), null, "no closer part: no ties, not 'no ties'");
  assert.equal(partOf({ closer: { rows: [] } }, "closer").rows.length, 0, "a flat answer reads the same way");
  assert.equal(bundleFrom({ error: "no such read" }), null, "a refusal (the read not shipped yet) is not a bundle");
  assert.equal(bundleFrom([]), null);
  assert.ok(bundleFrom(BUNDLE));
  assert.equal(bundleUrl("https://postmark.town/api", "fox+owl"), "https://postmark.town/api/household?read=hearth&household=fox%2Bowl");
});

test("ties: the house's own residents only, most letters first, with the newest line each way by rule, the right way round", () => {
  const t = tiesOf(BUNDLE, HOUSE);
  assert.deepEqual(t.rows.map((r) => [r.handle, r.with, r.letters]), [["fox", "hare", 7], ["owl", "wren", 1]], "a resident of another house is not drawn here");
  // the pair is stored hare→fox; for fox's row, fox's own line is quote_b
  assert.equal(t.rows[0].quoteOut, "I will, at dusk.");
  assert.equal(t.rows[0].quoteIn, "Come by the mill.");
  assert.deepEqual(t.rows[0].milestones, ["first letter"]);
  assert.deepEqual(tiesOf({ parts: { closer: { rows: [] } } }, HOUSE).rows, [], "an answered closer with no rows is an honest none");
  // two residents of the house who write each other: one row, not one from each side (control: a pair with an outsider keeps its row)
  const inside = tiesOf({ parts: { closer: { rows: [{ handle: "fox", with: "owl", out: 2, in: 1 }, { handle: "owl", with: "fox", out: 1, in: 2 }, { handle: "owl", with: "hare", out: 1, in: 0 }] } } }, HOUSE);
  assert.deepEqual(inside.rows.map((r) => `${r.handle}>${r.with}`), ["fox>owl", "owl>hare"]);
  // eight rows, quotes on the first three only (Darko 2026-11-11 on small text)
  const many = { parts: { closer: { rows: Array.from({ length: 11 }, (_, i) => ({ handle: "fox", with: "w" + i, out: 20 - i, in: 0 })) }, pairs: { rows: Array.from({ length: 11 }, (_, i) => ({ a: "fox", b: "w" + i, quote_a: "q" + i })) } } };
  const m = tiesOf(many, HOUSE);
  assert.deepEqual([m.rows.length, m.total], [8, 11]);
  assert.deepEqual(m.rows.map((r) => r.quoteOut), ["q0", "q1", "q2", null, null, null, null, null]);
});

test("stamps that went: grouped by kind, totals from the rows, zero rows dropped, and an outside link never carried", () => {
  const w = wentOf(BUNDLE, HOUSE);
  assert.deepEqual(w.groups.map((g) => [g.kind, g.total, g.rows.length]), [["pot", 8, 2], ["idea", 2, 1]]);
  assert.equal(w.total, 10);
  assert.equal(w.groups[1].rows[0].href, null, "a https link from the bundle is not put on the page");
  assert.equal(w.groups[0].rows.find((r) => r.title === "the meeps fund").href, "/fund/meeps-fund/");
  assert.equal(safeHref("//evil.example/"), null);
  assert.equal(safeHref("javascript:alert(1)"), null);
});

test("the town feed: titled rows only, newest first, and 'nearest' offered only when a row carries a distance", () => {
  const f = feedOf(BUNDLE);
  assert.deepEqual(f.rows.map((r) => r.title), ["Bread night", "Lanterns on the quay"]);
  assert.deepEqual(f.sorts, ["newest", "backed"]);
  assert.deepEqual(feedOf({ parts: { feed: { rows: [{ title: "x", near: 40 }] } } }).sorts, ["newest", "backed", "near"]);
});

test("a resident's day: in the house's order; a quiet day is said as answered, a missing one as not read", () => {
  const d = dayOf(BUNDLE, [...HOUSE, "newt"]);
  assert.deepEqual(d.rows.map((r) => [r.handle, r.lines.length, r.answered]), [["fox", 1, true], ["owl", 0, true], ["newt", 0, false]]);
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
