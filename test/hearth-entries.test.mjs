// hearth-entries.test.mjs — the registered entries, their intake, and the page's own guards (POS-959).
//
// An entry is a folder in the town repo, copied here by tools/sync-hearths.mjs, made safe by entries.mjs. This
// holds: the committed entries are clean and complete; a second, PR-style entry from a synthetic household is
// accepted through the same road as the default; a bad folder is refused by name without taking the others
// down; the intake tool skips infrastructure and says what it skipped; and the page's source keeps the rules
// the walk proves in a browser (nothing a resident wrote through set:html, private slots shipped hidden).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { prepareEntry, prepareEntries, pickEntry, segmentsOf } from "../src/lib/hearth/entries.mjs";
import { readMeta, syncHearths } from "../tools/sync-hearths.mjs";
import { SLOT_NAMES, SLOTS, DEFAULT_ENTRY, ENTRY_ID, BEHAVIOR_NAMES } from "../src/lib/hearth/slots.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const rows = JSON.parse(read("src/data/postmark/hearths.json"));

test("the committed entries: a default, a second, both clean (the sanitizers removed nothing), every id valid", () => {
  const { entries, rejected } = prepareEntries(rows);
  assert.deepEqual(rejected, []);
  assert.ok(entries.some((e) => e.id === DEFAULT_ENTRY), "every household opens on a default");
  assert.ok(entries.length >= 2, "an entry other than the default is registered, so a preview has something to preview");
  assert.equal(entries[0].id, DEFAULT_ENTRY, "the default sorts first");
  for (const e of entries) {
    assert.match(e.id, ENTRY_ID);
    assert.deepEqual(e.problems, [], `${e.id}: the sanitizer removed ${e.problems}`);
    assert.ok(e.title && e.line, `${e.id} has a title and a public line`);
    assert.ok(e.slots.length > 0 && e.slots.every((s) => SLOT_NAMES.includes(s)));
  }
});

test("the default entry places every household section, so the default IS the household's page", () => {
  const def = prepareEntries(rows).entries.find((e) => e.id === DEFAULT_ENTRY);
  for (const s of ["house", "residents", "happened", "needs-you", "stamps", "posts", "marks", "closer", "mail", "around-town"]) {
    assert.ok(def.slots.includes(s), `the default places ${s}`);
  }
});

test("between them the committed entries use all six behaviors (tabs, accordion, countdown, map, stamps chart; sort in the STARTER)", () => {
  const { entries } = prepareEntries(rows);
  const used = new Set(entries.flatMap((e) => e.slots));
  for (const s of ["map", "stamps-chart", "countdown"]) assert.ok(used.has(s), `a registered entry uses ${s}`);
  const html = entries.map((e) => e.html).join("");
  assert.match(html, /data-hearth-behavior="tabs"/);
  assert.match(html, /data-hearth-behavior="accordion"/);
  // sort is the third wrapping behavior; the starter kit teaches it, and the town repo's README lists all three
  assert.deepEqual(BEHAVIOR_NAMES, ["tabs", "accordion", "sort"]);
});

test("a second PR-style entry, from a synthetic household, is accepted by the same road and stands beside the default", () => {
  const synthetic = {
    id: "the-synthetic-house", title: "The Synthetic House", author: "the-synthetic-house", line: "A design for a made-up house.",
    html: `<main class="s"><h1>A synthetic house</h1><hearth-house></hearth-house>` +
      `<div data-hearth-behavior="tabs"><section data-tab="Who"><hearth-residents></hearth-residents></section><section data-tab="What"><hearth-happened></hearth-happened></section></div>` +
      `<hearth-mail></hearth-mail><hearth-needs-you></hearth-needs-you></main>`,
    css: `:root { --hx-accent: #7fd; } .s { display: grid; gap: 1em } hearth-residents { display: block }`,
  };
  const { entries, rejected } = prepareEntries([...rows, synthetic]);
  assert.deepEqual(rejected, []);
  const e = entries.find((x) => x.id === "the-synthetic-house");
  assert.deepEqual(e.problems, []);
  assert.deepEqual(e.slots, ["house", "residents", "happened", "mail", "needs-you"]);
  assert.deepEqual(e.segments.filter((s) => s.slot).map((s) => s.slot), e.slots, "the page cuts the markup at each slot, in order");
  assert.equal(pickEntry(entries, "the-synthetic-house").id, "the-synthetic-house");
  assert.equal(pickEntry(entries, "nope").id, DEFAULT_ENTRY, "an unknown entry shows the default");
  assert.equal(pickEntry([], "x"), null);
});

test("a bad entry is refused by name and takes no other down; a hostile one is drawn only as safe", () => {
  const { entries, rejected } = prepareEntries([
    ...rows,
    { id: "Bad Id!", html: "<p>x</p>" },
    { id: "empty", html: "<script>alert(1)</script>" },
    { id: DEFAULT_ENTRY, html: "<p>a second default</p>" },
    { id: "hostile", title: "<img src=x onerror=alert(1)>", author: "a‮b", html: `<p onclick="x">hi</p><script>alert(1)</script>`, css: `p{background:url(x)}` },
  ]);
  assert.deepEqual(rejected.map((r) => r.id).sort(), ["Bad Id!", DEFAULT_ENTRY, "empty"].sort());
  assert.ok(entries.some((e) => e.id === DEFAULT_ENTRY), "the first default still stands");
  const h = entries.find((e) => e.id === "hostile");
  assert.equal(h.html, "<p>hi</p>");
  assert.equal(h.css, "");
  assert.ok(h.problems.length >= 3, "and what was removed is named: " + h.problems);
  assert.ok(!/[<>‮]/.test(h.title + h.author), "title and author are plain text");
  assert.equal(prepareEntry({ id: "x", html: "" }).ok, false);
  assert.equal(prepareEntries(null).entries.length, 0);
});

test("segmentsOf cuts only at the sanitizer's own placeholders, never at template text", () => {
  const html = `<p>a</p><div data-hearth-slot="house"></div><p>&lt;div data-hearth-slot="x"&gt;&lt;/div&gt;</p>`;
  assert.deepEqual(segmentsOf(html), [{ html: "<p>a</p>" }, { slot: "house" }, { html: `<p>&lt;div data-hearth-slot="x"&gt;&lt;/div&gt;</p>` }]);
});

// ── the intake tool ─────────────────────────────────────────────────────────

test("readMeta reads the front matter and the first paragraph, with the folder's name for a missing title", () => {
  assert.deepEqual(readMeta("---\ntitle: The Ledger\nauthor: postmark\n---\n\nOne line\nover two.\n\nSecond paragraph.", "ledger"),
    { title: "The Ledger", author: "postmark", line: "One line over two." });
  assert.deepEqual(readMeta("just words", "x"), { title: "x", author: null, line: "just words" });
  assert.deepEqual(readMeta("", "x"), { title: "x", author: null, line: "" });
});

test("syncHearths copies entries, skips capitalised infrastructure, and says out loud what it skipped", () => {
  const town = fs.mkdtempSync(path.join(os.tmpdir(), "hearth-town-"));
  const dir = path.join(town, "PROJECTS", "household-hearths");
  const mk = (name, files) => { fs.mkdirSync(path.join(dir, name), { recursive: true }); for (const [f, c] of Object.entries(files)) fs.writeFileSync(path.join(dir, name, f), c); };
  mk("STARTER", { "hearth.html": "<p>starter</p>" });
  mk("zeta", { "hearth.html": "<p>z</p>", "hearth.css": "p{color:red}", "hearth.md": "---\ntitle: Zeta\nauthor: zeta\n---\nA line." });
  mk("alpha", { "hearth.html": "<p>a</p>" });
  mk("no-html", { "hearth.css": "p{}" });
  fs.writeFileSync(path.join(dir, "README.md"), "# readme");
  const warn = console.warn; const said = []; console.warn = (m) => said.push(m);
  let out;
  try { out = syncHearths(town); } finally { console.warn = warn; }
  assert.deepEqual(out.rows.map((r) => r.id), ["alpha", "zeta"], "sorted, STARTER and the no-html folder left out");
  assert.deepEqual(out.skipped, ["no-html"]);
  assert.ok(said.some((m) => /no-html\/ has no hearth.html/.test(m)), "the skip is said, not silent");
  assert.deepEqual(out.rows[1], { id: "zeta", title: "Zeta", author: "zeta", line: "A line.", html: "<p>z</p>", css: "p{color:red}" });
  assert.deepEqual(syncHearths(path.join(town, "nowhere")).rows, [], "no town checkout, no entries, no throw");
});

// ── the page's own guards, read from source (the walk proves them in a browser) ──

test("no resident's or template's words reach the page through set:html, innerHTML or document.write, except the sanitizer's own output", () => {
  const slot = read("src/components/hearth/HearthSlot.astro");
  assert.ok(!/set:html=/.test(slot), "HearthSlot draws names, titles and bios through Astro's escaping only");
  const page = read("src/components/hearth/Hearth.astro");
  const setHtml = [...page.matchAll(/set:html=\{\s*([A-Za-z.]+)/g)].map((m) => m[1]);
  assert.deepEqual(setHtml.sort(), ["entry.css", "json", "json", "s.html"],
    "the only set:html are the entry's sanitized css and html and two JSON blobs, escaped for script context");
  assert.match(page, /split\("<"\)\.join\("\\\\u003c"\)/, "the JSON blobs cannot close their own script element");
  for (const f of ["src/lib/hearth/paint.mjs", "src/lib/hearth/behaviors.mjs"]) {
    assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(|new Function/.test(read(f)), `${f} builds elements and sets text only`);
  }
  const stage = read("src/lib/hearth/stage.mjs");
  assert.deepEqual([...stage.matchAll(/(\w+)\.innerHTML\s*=/g)].map((m) => m[0]), ["tpl.innerHTML ="], "the stage's one innerHTML is the sanitized entry markup, into an inert <template>");
  assert.ok(!/eval\(|new Function|document\.write/.test(stage));
});

test("private slots ship hidden and marked private, in the static page and in every preview template", () => {
  const slot = read("src/components/hearth/HearthSlot.astro");
  for (const name of SLOT_NAMES.filter((n) => SLOTS[n].private)) {
    const block = slot.slice(slot.indexOf(`name === "${name}"`));
    const open = block.slice(0, block.indexOf(">") + 1);
    const tag = block.slice(0, block.search(/\n\s*<h2|\n\s*<p class="hd-meta"/));
    assert.match(tag, /data-private/, `${name} is marked data-private`);
    assert.match(tag, /\bhidden\b/, `${name} ships hidden`);
    assert.ok(open.length > 0);
  }
  assert.deepEqual(SLOT_NAMES.filter((n) => SLOTS[n].private).sort(), ["mail", "needs-you"]);
  const css = read("src/components/hearth/hearth-host.css");
  assert.match(css, /\.hearth-stage\[data-hd-view="public"\] \[data-private\] \{ display: none !important; \}/, "a public view hides private parts and a template cannot unhide them");
  const paint = read("src/lib/hearth/paint.mjs");
  assert.match(paint, /if \(!ctx\.owner\) \{ box\.hidden = true; return; \}/, "the mail slot is painted for the house's own sign-in only");
});

test("the stage reads with the reader's bearer only on residents the sign-in holds, and nowhere else", () => {
  const stage = read("src/lib/hearth/stage.mjs");
  assert.match(stage, /readHouse\(handles, \{ token: own\.length \? token\(\) : null, mine: own \}\)/);
  assert.match(stage, /const mine = \(\) => \(token\(\) \? held\(\)\.filter\(\(h\) => handles\.includes\(h\)\) : \[\]\)/);
  const reads = read("src/lib/household-dashboard/reads.mjs");
  assert.match(reads, /getJSON\(`\$\{api\}\/doorstep\/\$\{e\(h\)\}`, token && own\.has\(h\) \? token : null\)/);
  assert.ok(!/authorization|Bearer/i.test(reads.slice(reads.indexOf("export async function readHearthExtras"))), "the Hearth's own extra reads are public and carry no bearer");
});

// POS-984 (Darko, 2026-11-09 14:34 EST): the Hearth is the household's page, not a page beside it. Until 2026-11-09 this asserted the Hearth had its
// own route and that the household page linked to it ("the Hearth →"). /households/<slug>/hearth/ forwards now (test/household-one-page.test.mjs
// runs the forwarder), the household page draws the Hearth as its seat, and nothing links to a second page.
test("the Hearth is the household page's seat, not a page beside it: the old route forwards, the seat draws the Hearth, and no link to a second page remains", () => {
  const route = read("town/pages/households/[slug]/hearth.astro");
  assert.match(route, /declaredHouses\(\)\.map/, "only declared houses have the old address; any other slug 404s");
  assert.match(route, /location\.replace\(to \+ location\.search \+ location\.hash\)/, "it forwards, and the preview's query rides across");
  assert.ok(!/Hearth \/>|<Hearth\b/.test(route), "the old route draws nothing of its own");
  assert.ok(fs.existsSync(path.join(ROOT, "town/pages/households/[slug].astro")), "the household page stays");
  const house = read("town/components/Household.astro");
  assert.match(house, /<Hearth house=\{house\} members=\{members\} plate=\{plate\}>/, "the household's seat is the Hearth");
  assert.match(house, /<HouseBand slot="band" house=\{house\}/, "with the site's band in its band slot");
  assert.ok(!/hearth\/`|\/hearth\//.test(read("src/components/household-dashboard/HouseDashboard.astro")), "the dashboard no longer links to a second page");
  assert.ok(!/The household’s page →/.test(read("src/components/hearth/Hearth.astro")), "and the Hearth no longer links back to one");
});
