// household-one-page.test.mjs — one household page: the Hearth under the shell, with one thin strip of the site's own (POS-984).
//
// Darko, 2026-11-09 14:34 EST (POS-684 sitting, call 1): "the household profile or page and the household hearth are not
// supposed to be two different … it needs to become the first class center for how a human gets a sense of what is
// going on". Then, on his dev walk, 2026-11-10 17:14: "My intent is for the resident-submitted household hearth theme to be
// the only thing for the household dashboard"; 17:28: "How do we make room, as much room as possible, such that the resident
// designed submissions take up the vast majority of the visual space in the household page, and we literally just have the
// bare minimum that … we couldn't include in the template."
// The sitting's "site's own band for the signed-in human" was withdrawn (POS-984's description says so); until 2026-11-10 this file held the band.
//
// WHAT THIS HOLDS, and what reads what:
//   - the SEAM: the page asks ONE function which design to draw (which-design.mjs); the function is run, and the built page
//     is checked against its answer;
//   - the ONE PAGE: no band, no old tab rail, no quests, no ballots; the strip (the breadcrumb, the household's sub-rail with the Hearth dropdown for
//     everyone and the owner's + and settings, POS-999, held in full by test/house-rail.test.mjs) above the design; the old /hearth/ address forwarding with the preview's query riding across (the
//     forwarder's own script is RUN); `?resident=` redirecting to the resident's own page (that script is RUN too); the ways in (the
//     layout's household link, a resident page's rail);
//   - the strip is OUT OF A DESIGN'S REACH: through the real sanitizer, a hostile stylesheet cannot name it;
//   - the dropdown is on the household page ONLY, and legible: every ink of the strip is a token paired with its surface (contrast computed).
// The built arms read the pages a reader gets and skip without a build (run `npm run build` first), like the funding tests;
// the source arms are text pins and say so. qa-shots/hearth-walk.mjs proves the rest in a real browser.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { whichDesign } from "../src/lib/hearth/which-design.mjs";
import { prepareEntry, prepareEntries } from "../src/lib/hearth/entries.mjs";
import { DEFAULT_ENTRY } from "../src/lib/hearth/slots.mjs";
import { householdHome } from "../src/lib/house-home.mjs";
import { notYours, meAnswered } from "../src/lib/hearth/not-yours.mjs";
import { housePath } from "../src/lib/houses.mjs";
import { ENTRY_OPEN, ENTRY_CLOSE, withoutEntryRegion, inlineScripts } from "../tools/lib/hearth-csp.mjs";

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const DIST = path.join(ROOT, "dist-town");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const built = fs.existsSync(path.join(DIST, "households"));
const HEARTHS = JSON.parse(read("src/data/postmark/hearths.json"));   // the registered designs, as the town records them (title, author)
const dist = (...segs) => fs.readFileSync(path.join(DIST, ...segs), "utf8");
const rows = JSON.parse(read("src/data/postmark/hearths.json"));
const { entries } = prepareEntries(rows);
const slugsBuilt = () => (built ? fs.readdirSync(path.join(DIST, "households")).filter((s) => fs.existsSync(path.join(DIST, "households", s, "index.html"))) : []);

// ── the seam ───────────────────────────────────────────────────────────────

test("whichDesign: the default unless a registered entry is asked for; an unknown id is the default; no entries at all is null", () => {
  assert.equal(whichDesign(entries).id, DEFAULT_ENTRY, "nothing asked: Postmark's own, the design every household has");
  assert.equal(whichDesign(entries, { entry: null }).id, DEFAULT_ENTRY);
  const second = entries.find((e) => e.id !== DEFAULT_ENTRY);
  assert.ok(second, "a second entry is registered, so a preview has something to ask for");
  assert.equal(whichDesign(entries, { entry: second.id }).id, second.id, "a registered entry asked for is the preview");
  assert.equal(whichDesign(entries, { entry: "no-such-entry" }).id, DEFAULT_ENTRY, "an unknown id never draws nothing: it draws the default");
  assert.equal(whichDesign([], { entry: "x" }), null);
  const noDefault = entries.filter((e) => e.id !== DEFAULT_ENTRY);
  assert.equal(whichDesign(noDefault).id, noDefault[0].id, "with no default registered the first stands in, as the registry says");
});

test("PIN the seam: the server and the browser both ask whichDesign, and nothing beside it decides the design", () => {
  const page = read("src/components/hearth/Hearth.astro");
  assert.match(page, /import \{ whichDesign \} from "@\/lib\/hearth\/which-design\.mjs";/);
  assert.match(page, /const entry = whichDesign\(entries, \{ saved: house\.hearth \?\? null \}\);/, "the server asks it, with the house's baked choice");
  assert.ok(!/defaultEntry/.test(page), "the page no longer reads the registry's default itself");
  const stage = read("src/lib/hearth/stage.mjs");
  // POS-962 folded in (until 2026-11-09 this counted two calls): compose(), the first draw and the draw after the saved choice is read each ask the one function
  assert.equal((stage.match(/whichDesign\(entries, \{ entry: /g) ?? []).length, 3, "compose(), the first draw and the saved-choice draw each ask the one function");
  assert.match(stage, /whichDesign\(entries, \{ entry: asked, saved \}\)/, "the saved choice goes in as an input to it");
  const decider = (src) => /entries\.find\(\(e\) => e\.id ===|entries\.some\(\(e\) => e\.id ===|DEFAULT_ENTRY\)/.test(src);
  for (const f of ["src/lib/hearth/stage.mjs", "src/components/hearth/Hearth.astro", "town/components/HouseholdPage.astro"]) assert.ok(!decider(read(f)), `${f} decides no design of its own`);
  assert.match(read("src/components/hearth/Hearth.astro"), /selected=\{entry\?\.id \?\? null\}/, "the dropdown starts on what the server draws: the one function's answer, `entry`");
  assert.ok(!/\bpickEntry\(/.test(stage), "the stage keeps no choice of its own");
  // Truey's review of ba023e9d9: the first draw must not hand the default over what whichDesign answers (a saved choice later)
  assert.ok(!/asked \|\| DEFAULT/.test(stage), "nothing passes the default explicitly: whichDesign answers for 'nothing asked'");
  assert.match(stage, /\} else compose\(asked, \{ asked \}\);/);
});

test("built: every household page is drawn in the design whichDesign names (the default, with no preview asked)", { skip: !built }, () => {
  const want = whichDesign(entries).id;
  const slugs = slugsBuilt();
  assert.ok(slugs.length > 10);
  for (const slug of slugs) {
    const m = /data-hearth-stage data-hearth-entry="([^"]+)"/.exec(dist("households", slug, "index.html"));
    assert.ok(m, `${slug}: the page draws a design`);
    assert.equal(m[1], want, `${slug}: the design drawn is the one the seam names`);
  }
});

// ── no band; the strip ─────────────────────────────────────────────────────

const outsideTemplates = (html) => html.replace(/<template\b[\s\S]*?<\/template>/g, "");

// Until 2026-11-11 this held that a household page carried no rail of residents. Darko's dev walk that day (POS-999, 10:48 EST: "We need to unify the
// subrail of the household and each resident page") put the household's sub-rail in the strip; test/house-rail.test.mjs holds it. The old tab rail stays gone.
test("built: no household page carries a band, the old tab rail, a nav chip row, the day's quests, a ballot or a managing-the-house list: the design is the page, under the strip", { skip: !built }, () => {
  for (const slug of slugsBuilt()) {
    const html = dist("households", slug, "index.html");
    for (const gone of ["data-hband", "hband", "data-house-tabs", "data-house-tab=", "pm-chiprow", "data-quests", "data-hb-edit", "data-hband-manage", "Managing the house", "Open ballots", "data-hd-quests", "data-profile-bubble"]) {
      assert.ok(!html.includes(gone), `${slug}: the page does not carry ${gone}`);
    }
    assert.equal((html.match(/data-house-rail\b/g) ?? []).length, 1, `${slug}: its one row of chips is the household's sub-rail`);
    // the sentence "the design draws the house" has a witness: the stage is the page's only body, and every resident is drawn by it, once
    assert.equal((outsideTemplates(html).match(/data-hearth-stage /g) ?? []).length, 1, `${slug}: one stage`);
  }
});

// Until 2026-11-11 the strip carried a reading line and, for the owner, two underlined links ("+ add a resident" and the likeness answer). POS-999 (Darko,
// 10:48 and 10:57 EST) made the reading line a mark in the sub-rail, the + a round pill after the residents' chips, and the likeness answer a settings panel
// in the corner; test/house-rail.test.mjs holds each.
test("built: the strip sits above the design and outside the entry's region: the breadcrumb, the sub-rail with its reading mark and its +, and in its corner the dropdown and the settings, the owner's parts shipped hidden", { skip: !built }, () => {
  for (const slug of slugsBuilt()) {
    const html = dist("households", slug, "index.html");
    const bar = html.indexOf("data-hearth-bar");
    assert.ok(bar > 0, `${slug}: the page carries the strip`);
    assert.ok(bar < html.indexOf(ENTRY_OPEN) && html.indexOf(ENTRY_OPEN) < html.indexOf("data-hearth-stage "), `${slug}: strip, then the entry's region, then the design`);
    assert.ok(withoutEntryRegion(html).includes("data-hearth-bar"), `${slug}: the strip is the host's, not the entry's`);
    const strip = html.slice(bar, html.indexOf(ENTRY_OPEN));
    assert.match(strip, /<a href="\/households\/"[^>]*>Residents<\/a>/, `${slug}: the breadcrumb`);
    assert.ok(strip.indexOf("hearth-crumbs") < strip.indexOf("data-house-rail"), `${slug}: the breadcrumb, then the sub-rail`);
    assert.equal((html.match(/data-hearth-picker/g) ?? []).length, 1, `${slug}: one dropdown`);
    assert.match(strip, /<select data-hearth-pick disabled /, `${slug}: the dropdown ships disabled and is enabled when it is bound`);
    assert.match(strip, /<span class="pm-subrail-reading" data-hd-reading-mark role="status" hidden[ >]/, `${slug}: the one reading mark`);
    assert.ok(/data-hearth-own data-hearth-settings hidden/.test(strip) && /<span class="hearth-acts" data-hearth-acts hidden>/.test(strip), `${slug}: the settings, and the check and the x, ship hidden`);
    assert.match(strip, /<a class="pm-subrail-add" data-house-add href="\/join\/move-in\/"[^>]*\bhidden\b/, `${slug}: the round +, shipped hidden`);
    assert.match(strip.slice(strip.indexOf("data-hearth-settings")), /(Answer|Change) the likeness question/, `${slug}: the likeness answer, in the settings (a declared house)`);
    const acts = strip.slice(strip.indexOf("data-hearth-acts"), strip.indexOf("</span>", strip.indexOf("data-hearth-keep")));
    assert.ok(acts.includes("data-hearth-keep") && acts.includes("data-hearth-back"), `${slug}: the check and the x are inside that hidden group`);
    // the design's credit (Darko, 2026-11-12 08:57 EST: "listing Designed by {author}"), from the design's own record (the town's hearth.md, synced to hearths.json)
    const chosen = /<option value="([^"]+)" selected/.exec(strip)?.[1];
    const author = HEARTHS.find((h) => h.id === chosen)?.author;
    assert.ok(chosen, `${slug}: the dropdown has the design it opens on selected`);
    if (author) assert.ok(strip.includes(`<span class="hearth-by" data-hearth-by>Designed by ${author}</span>`), `${slug}: "Designed by ${author}", the record's credit for ${chosen}`);
    else assert.match(strip, /<span class="hearth-by" data-hearth-by hidden><\/span>/, `${slug}: no recorded author for ${chosen}, so no line`);
  }
});

test("built: the house slot carries the sign-in line and the not-your-house line, once each outside the preview templates; the strip carries neither", { skip: !built }, () => {
  for (const slug of slugsBuilt()) {
    const html = outsideTemplates(dist("households", slug, "index.html"));
    const visit = html.indexOf("Is this your house?");
    assert.ok(visit > html.indexOf("data-hearth-stage "), `${slug}: the invitation is in the design's house slot, not the strip`);
    // the question is the sign-in button's own text, so a reader without the button never reads a bare question
    assert.match(html.slice(visit - 160, visit), /<button[^>]*data-hd-signin[^>]*>$/, `${slug}: the question is inside the sign-in button`);
    assert.equal((html.match(/data-hd-signin/g) ?? []).length, 1, `${slug}: one sign-in button`);
    assert.match(html, /<span class="hx-notyours" data-hx-notyours hidden>This isn’t your house/, `${slug}: a signed-in reader of another house is told so, and it ships hidden`);
    assert.ok(html.includes("Signing in with GitHub needs scripts"), `${slug}: without scripts it says sign-in needs them`);
    // nothing private is in the static page: Needs you ships hidden and empty, the edit links hidden
    assert.match(html.slice(html.indexOf("data-hd-needs-box")), /^data-hd-needs-box hidden/, `${slug}: Needs you ships hidden`);
    assert.match(html.slice(html.indexOf("data-hd-needs-box")), /<ul data-hd-needs><\/ul>/, `${slug}: and empty`);
    assert.ok(!/data-hd-edit(?![^>]*\bhidden\b)[^>]*>/.test(html), `${slug}: every Edit profile link ships hidden`);
  }
});

test("the strip is out of a design's reach: through the real sanitizer, a stylesheet that names the strip's classes or hooks scopes or is refused", () => {
  const e = prepareEntry({
    id: "hostile", title: "h", html: "<p>a</p>",
    css: ".hearth-bar, [data-hearth-bar], .hearth-pickerband, .hearth-own, [data-hearth-pick], body, html, :root, * { display: none !important; }\n.hearth-bar { visibility: hidden; }\n@media (max-width: 700px) { .hearth-bar { display: none; } }",
  });
  assert.ok(e.ok);
  const scope = '.hearth-stage[data-hearth-entry="hostile"]';
  for (const rule of e.css.split("}")) {
    const sel = rule.split("{")[0].replace(/@media[^{]*$/, "").trim();
    if (sel) assert.ok(sel.startsWith(scope), `a rule that is not under the stage: ${sel}`);
  }
  assert.ok(/\.u-hearth-bar\b/.test(e.css), "a class a template writes is namespaced `u-`: its `.hearth-bar` is `.u-hearth-bar`, a class nothing on the page wears");
  assert.ok(!/(^|[^-\w])\.hearth-bar\b/.test(e.css), "no rule carries the strip's own class");
  assert.ok(!/data-hearth-bar|data-hearth-pick/.test(e.css), "no rule carries the strip's hooks");
  assert.ok(e.problems.some((p) => /data-hearth-bar/.test(p)), "the attribute selector on the strip's hook is refused, by name");
});

test("built: the Hearth dropdown is on the household page ONLY: no other page on the site carries one, and no household page carries two", { skip: !built }, () => {
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(path.join(dir, d.name)) : d.name.endsWith(".html") ? [path.join(dir, d.name)] : []));
  const pages = walk(DIST);
  assert.ok(pages.length > 1000, `the whole site is read (${pages.length} pages)`);
  const governed = new Set(slugsBuilt().map((s) => path.join(DIST, "households", s, "index.html")));
  const carrying = pages.filter((p) => /data-hearth-pick/.test(fs.readFileSync(p, "utf8")));
  assert.deepEqual(carrying.filter((p) => !governed.has(p)).map((p) => path.relative(DIST, p)), [], "no page outside the household pages carries the dropdown");
  assert.equal(carrying.length, governed.size, "and every household page does");
});

test("the design's own Needs you and boat line are on: the host stands down no slot, and the default design places the slots that carry them", () => {
  const css = read("src/components/hearth/hearth-host.css");
  assert.ok(!/data-hearth-slot="needs-you"\][^{]*\{[^}]*display:\s*none/.test(css), "no rule hides the needs-you slot");
  assert.ok(!/data-hearth-slot="mail"\][^{]*\{[^}]*display:\s*none/.test(css), "nor the mail slot");
  assert.ok(!/\[data-hd-boat\][^{]*\{[^}]*display:\s*none/.test(css), "nor the waiting-mail (boat) line");
  const def = prepareEntries(rows).entries.find((e) => e.id === DEFAULT_ENTRY);
  for (const s of ["needs-you", "happened", "mail"]) assert.ok(def.slots.includes(s), `the default design places ${s}`);
  assert.match(read("src/components/hearth/HearthSlot.astro"), /<p class="hd-boat" data-private data-hd-boat hidden><\/p>/, "the boat line is in the happened slot, private, shipped hidden");
});

// ── no ballot on the household page (moved here from test/band-ballots.test.mjs, which goes with the retired band-ballots.mjs and HouseBand.astro) ──
// Until 2026-11-10 the band hosted POS-502's stake form for the signed-in human. The band is gone (Darko, 17:14–17:28 EST: the theme is the page; the stake form is
// off the household page and on /votes/), so these hold the inversion: nothing a household page loads carries the ballots, and /votes/ is where the form is mounted.

test("PIN the household page carries no ballots: the stage imports neither module, and /votes/ is where the stake form is mounted", () => {
  const stage = read("src/lib/hearth/stage.mjs");
  assert.ok(!/band-ballots|ballot-stake|mountBandBallots|pm:ballot-staked/.test(stage), "the household page's script has no ballots and no stake form");
  for (const f of ["src/components/hearth/Hearth.astro", "town/components/HouseholdPage.astro", "town/components/Household.astro", "town/pages/households/[slug].astro"]) {
    assert.ok(!/band-ballots|ballot-stake|data-hb-|hband/.test(read(f)), `${f} names no ballots and no band`);
  }
  const votes = read("town/pages/votes/index.astro");
  assert.match(votes, /import \{ mountBallotStake \} from "@\/lib\/ballot-stake\.mjs";/, "the form is /votes/'s");
  assert.match(votes, /mountBallotStake\(slot, \{ topic: t\.topic, choices: t\.candidates \}\)/, "mounted under each STAKING ballot");
  assert.match(votes, /if \(t\.status !== "staking"\) return;/);
});

test("built: no household page carries a ballots section or a stake form, and /votes/ still ships the slot the form mounts into", { skip: !built }, () => {
  const slugs = slugsBuilt();
  assert.ok(slugs.length > 10, `household pages read: ${slugs.length}`);
  for (const slug of slugs) {
    const html = dist("households", slug, "index.html");
    assert.ok(!/data-hband|hband-|data-hb-ballot|data-hb-stake|class="bs[ "]|bs-form|bs-confirm/.test(html), `${slug}: no band, no ballots section and no stake form (a resident’s own prose may say stake-vote, so the form’s markers are what is looked for)`);
  }
  assert.ok(dist("votes", "index.html").includes("data-votes"), "/votes/ is built, with the box the tally and the form are drawn into");
});

// ── legible: every ink of the strip is a token paired with its surface, and the pairs are computed ─────────
// The site has ONE colour scheme: `color-scheme: dark` (src/styles/global.css), the page's night behind the strip, no light scheme and no toggle. The walk (qa-shots/hearth-walk.mjs ⑱)
// reads the rendered contrast of every visible text in the default design and the strip, signed in and out, with the browser asked for both schemes.
const lin = (c) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
const hex = (h) => { const m = /^#([0-9a-f]{6})$/i.exec(h); assert.ok(m, `a six-digit hex: ${h}`); return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)); };

test("legible: the strip's inks are tokens, each paired with the surface it is read on, and every pair passes AA (4.5:1) as computed from the css", () => {
  const css = read("src/components/hearth/hearth-host.css");
  const tokens = Object.fromEntries([...css.matchAll(/(--hx-chrome-[a-z-]+):\s*(#[0-9a-f]{6}|rgba?\([^)]*\))/gi)].map((m) => [m[1], m[2]]));
  for (const t of ["--hx-chrome-ink", "--hx-chrome-link", "--hx-chrome-field", "--hx-chrome-field-ink", "--hx-chrome-line"]) assert.ok(tokens[t], `${t} is defined`);
  const strip = css.slice(css.indexOf("── the site's own strip above the stage"));
  const rules = strip.slice(strip.indexOf("}")).replace(/\/\*[\s\S]*?\*\//g, "");   // everything after the token block: no colour literal may be here
  assert.ok(!/#[0-9a-f]{3,8}\b|rgba?\(/i.test(rules), "no strip rule carries a colour literal: every ink is a token");
  const NIGHT = hex("#0d1426");   // the page's own night behind the strip (PostmarkLayout's body gradient runs #1c2c4f → #0d1426 → #070b15; its lightest stop is the worst case)
  const WORST_NIGHT = hex("#1c2c4f");
  for (const [what, ink, surface] of [
    ["strip text on the page's night", tokens["--hx-chrome-ink"], WORST_NIGHT],
    ["strip links on the page's night", tokens["--hx-chrome-link"], WORST_NIGHT],
    ["the dropdown's text on its field", tokens["--hx-chrome-field-ink"], hex(tokens["--hx-chrome-field"])],
    ["strip text on the page's night (darkest)", tokens["--hx-chrome-ink"], NIGHT],
  ]) assert.ok(ratio(hex(ink), surface) >= 4.5, `${what}: ${ink} on ${surface} is ${ratio(hex(ink), surface).toFixed(2)}:1`);
  // the paper note (Needs you): its ink and its calm green are read on the paper, never on the dark glass the other inks are for
  const stage = css.slice(0, css.indexOf("/* ── the host's frame"));
  const paper = hex(/--hx-paper:\s*(#[0-9a-f]{6})/i.exec(stage)[1]), paperInk = hex(/--hx-paper-ink:\s*(#[0-9a-f]{6})/i.exec(stage)[1]);
  assert.ok(ratio(paperInk, paper) >= 4.5, `Needs you's ink on its paper: ${ratio(paperInk, paper).toFixed(2)}:1`);
  const calm = hex(/\.hd-needs \.hd-calm \{ color: (#[0-9a-f]{6})/i.exec(stage)[1]);
  assert.ok(ratio(calm, paper) >= 4.5, `the calm line on the paper: ${ratio(calm, paper).toFixed(2)}:1 (it was 4.3:1 in #3a7d3a)`);
  const kind = hex(/\.hd-needs \.k \{[^}]*color: (#[0-9a-f]{6})/i.exec(stage)[1]);
  assert.ok(ratio(kind, paper) >= 4.5, `the kind label on the paper: ${ratio(kind, paper).toFixed(2)}:1`);
});

// Truey's review of ba023e9d9: a `:root`, `html` or `body` rule is rewritten onto the design's own stage, where `margin` and `transform` are
// allowed (and need no `!important`), and the stage's `contain: paint` clips its children, not itself: a design could move up over what is above it
// (then the band, now the strip). The host's frame around the region clips the stage itself. qa-shots/hearth-walk.mjs scenario ⑫ proves it in a browser (red without the rule).
test("the sanitizer lets a rooted margin or transform through, so the host's frame is what keeps a design off the strip: the frame wraps the region and clips", () => {
  for (const css of [":root { margin-top: -900px; background: #0b0f1c; }", "html { transform: translateY(-900px); }", "body { margin-top: -900px; position: relative; top: -50px; }"]) {
    const e = prepareEntry({ id: "rooted", title: "r", html: "<p>a</p>", css });
    assert.ok(e.ok && /margin-top:-900px|translateY\(-900px\)/.test(e.css) && e.css.startsWith('.hearth-stage[data-hearth-entry="rooted"]{'), `the rule lands on the stage itself: ${e.css}`);
  }
  const host = read("src/components/hearth/hearth-host.css");
  assert.match(host, /\.hearth-frame \{ contain: paint; display: flow-root; \}/, "the frame clips the stage and is its own formatting context");
  const page = read("src/components/hearth/Hearth.astro");
  const open = page.indexOf('<div class="hearth-frame">');
  assert.ok(open > 0 && open < page.indexOf("<!--hearth-entry-->") && page.indexOf("<!--/hearth-entry-->") < page.indexOf("</div>", page.indexOf("<!--/hearth-entry-->")), "the frame stands around both markers");
});

test("built: every household page's entry region sits inside the host's clipping frame, which the entry does not write", { skip: !built }, () => {
  for (const slug of slugsBuilt()) {
    const html = dist("households", slug, "index.html");
    const frame = html.indexOf('<div class="hearth-frame">');
    assert.ok(frame > html.indexOf("data-hearth-bar") && frame < html.indexOf(ENTRY_OPEN), `${slug}: strip, then the frame, then the entry's region`);
    assert.ok(html.indexOf(ENTRY_CLOSE) < html.indexOf("</div>", html.indexOf(ENTRY_CLOSE)) && /<div class="hearth-frame">\s*<\/div>/.test(withoutEntryRegion(html)), `${slug}: the frame is the host's: taking the region out leaves it empty`);
  }
});

// review, small: "This isn't your house" waits for /me. A first sign-in's owner has a token and no handles yet, and must never read it.
test("notYours: only a signed-in reader whose /me has answered and who holds none of this house's residents; a first sign-in's owner never sees it", () => {
  assert.equal(notYours({ signedIn: true, answered: true, owner: false }), true, "signed in, answered, not one of ours");
  assert.equal(notYours({ signedIn: true, answered: false, owner: false }), false, "signed in, /me not answered yet: no verdict, so the owner never sees a flash");
  assert.equal(notYours({ signedIn: true, answered: true, owner: true }), false, "the house's own human");
  assert.equal(notYours({ signedIn: false, answered: true, owner: false }), false, "a visitor has the sign-in line instead");
  assert.equal(notYours({ signedIn: false, answered: false, owner: false }), false);
  const store = (v) => ({ getItem: (k) => (k === "pm.oauth.handles" ? v : "WRONG-KEY") });
  assert.equal(meAnswered(store(null)), false, "the layout has not stored the handles");
  assert.equal(meAnswered(store("[]")), true, "an answer with no handles is still an answer");
  assert.equal(meAnswered(store('["wick"]')), true);
  assert.equal(meAnswered({ getItem() { throw new Error("storage refused"); } }), false, "storage that throws is no answer");
  const stage = read("src/lib/hearth/stage.mjs");
  assert.match(stage, /n\.hidden = !notYours\(\{ signedIn: !!token\(\), answered: meAnswered\(sessionStorage\), owner: ctx\.owner \}\);/, "PIN: the stage asks the one function, with the layout's own key");
  assert.match(read("src/layouts/PostmarkLayout.astro"), /sessionStorage\.setItem\("pm\.oauth\.handles", JSON\.stringify\(handles\)\);[\s\S]{0,1200}document\.dispatchEvent\(new CustomEvent\("pm:lens"/, "PIN: the layout stores the handles before it announces them, so pm:lens always finds the answer");
});

// Until 2026-11-10 a test here held that the page host HID the design's own Needs you, mail summary and boat line, so the band's copies were the ones shown, once.
// The band is gone: the design's copies are the only ones, and "the design's own Needs you and boat line are on" (above) holds that nothing hides them.

// ── the old address forwards ────────────────────────────────────────────────

test("the forwarder is the household page's twin: only declared houses have a page, and so only they have the old address", () => {
  const page = read("town/pages/households/[slug].astro");
  const old = read("town/pages/households/[slug]/hearth.astro");
  const paths = (s) => /export function getStaticPaths\(\) \{\s*return (declaredHouses\(\)\.map\(\(house\) => \(\{ params: \{ slug: house\.path \}, props: \{ house \} \}\)\));/.exec(s)?.[1];
  assert.ok(paths(page) && paths(old), "both enumerate the declared houses");
  assert.equal(paths(page), paths(old), "by one expression");
});

test("built: /households/<slug>/hearth/ forwards to /households/<slug>/ with the query and fragment riding across, run as the browser runs it", { skip: !built }, () => {
  const slugs = slugsBuilt();
  for (const slug of slugs) {
    const html = dist("households", slug, "hearth", "index.html");
    assert.ok(!/Content-Security-Policy/i.test(html), `${slug}: the forwarder carries no policy (it carries no entry)`);
    assert.match(html, new RegExp(`<meta http-equiv="refresh" content="0;url=/households/${slug.replace(/[.]/g, "\\.")}/">`), `${slug}: the no-script fallback`);
  }
  const html = dist("households", slugs[0], "hearth", "index.html");
  const script = /<script>([\s\S]*?)<\/script>/.exec(html)[1];
  const go = (search, hash) => {
    const seen = [];
    vm.runInNewContext(script, { location: { search, hash, replace: (u) => seen.push(u) } });
    return seen;
  };
  assert.deepEqual(go("?entry=ledger", ""), [`/households/${slugs[0]}/?entry=ledger`], "the preview keeps working on the one page");
  assert.deepEqual(go("", "#window"), [`/households/${slugs[0]}/#window`]);
  assert.deepEqual(go("?entry=ledger&resident=wick", "#x"), [`/households/${slugs[0]}/?entry=ledger&resident=wick#x`]);
  assert.deepEqual(go("", ""), [`/households/${slugs[0]}/`]);
});

// ── the ways in ─────────────────────────────────────────────────────────────

test("householdHome: signed in, 'your household' is the declared house's page; an undeclared house has none, and a long key keeps its hashed path", () => {
  const me = { handles: ["wright", "rei"], households: { wright: { key: "k", slug: "starforge", residents: ["rei", "wright"] }, rei: { key: "k", slug: "starforge", residents: ["rei", "wright"] } } };
  assert.equal(householdHome(me, me.handles), "/households/starforge/");
  assert.equal(householdHome({ handles: ["solo"], households: { solo: { key: "solo:solo", slug: null, residents: ["solo"] } } }, ["solo"]), "", "an undeclared house has no page: the caller keeps its link per resident");
  assert.equal(householdHome({ handles: ["a"] }, ["a"]), "", "/me without the garnish");
  assert.equal(householdHome(null, ["a"]), "");
  assert.equal(householdHome({ households: { a: { slug: "x" } } }, []), "", "no held handle, no house");
  const long = "the-house-with-a-very-long-name-".repeat(4);
  assert.notEqual(housePath(long), long);
  assert.equal(householdHome({ households: { a: { slug: long } } }, ["a"]), `/households/${housePath(long)}/`, "the page is at the path the build gave it, not at the key");
  assert.equal(householdHome({ households: { a: { slug: "plain" }, b: { slug: "other" } } }, ["b", "a"]), "/households/other/", "the first held handle's house");
});

// Until 2026-11-11 the header drew "your household" as a link, from two painters (the first paint's and the island's). POS-999 made the corner a round
// household icon and the residents' faces, drawn by ONE painter both call; test/house-rail.test.mjs runs it.
test("PIN the header: the layout asks householdHome from /me, keeps what it found, and the one painter (the first paint's) reads the same key", () => {
  const layout = read("src/layouts/PostmarkLayout.astro");
  assert.match(layout, /import \{ householdHome \} from "@\/lib\/house-home\.mjs";/);
  assert.match(layout, /const home = householdHome\(me, handles\);/);
  assert.match(layout, /sessionStorage\.setItem\("pm\.oauth\.household", home\)/);
  assert.match(layout, /localStorage\.setItem\("pm\.oauth\.household\.cache", home\)/);
  assert.match(layout, /var home = text\(true, "pm\.oauth\.household"\) \|\| text\(false, "pm\.oauth\.household\.cache"\);/, "the painter reads that key, the session's first");
  assert.equal((layout.match(/window\.pmHouseCorner = function/g) ?? []).length, 1, "one painter");
  assert.equal((layout.match(/window\.pmHouseCorner\(|window\.pmHouseCorner\?\.\(/g) ?? []).length, 2, "the first paint and the island both call it");
  assert.ok(!/textContent = "your household"/.test(layout), "and nothing draws the old words as a link");
  assert.match(layout, /sessionStorage\.removeItem\("pm\.oauth\.household"\)/, "a sign-out forgets it");
});

test("built: a resident's page of a declared shared house has a rail whose first chip links to its household page, and never also carries a seat", { skip: !built }, () => {
  const households = new Set(slugsBuilt());
  let linked = 0;
  for (const h of fs.readdirSync(path.join(DIST, "residents"))) {
    const p = path.join(DIST, "residents", h, "index.html");
    if (!fs.existsSync(p)) continue;
    const html = fs.readFileSync(p, "utf8");
    const link = /<a class="pm-chip is-first" data-house-link href="\/households\/([^"/]+)\/"/.exec(html);
    if (link) {
      linked += 1;
      assert.ok(households.has(link[1]), `${h}: the household link goes to a page that exists (${link[1]})`);
      assert.ok(!html.includes('data-house-tab="__house"'), `${h}: a link and a seat are never both on a resident's page`);
      assert.ok(!html.includes("data-hband "), `${h}: no band on a resident's page`);
    }
  }
  assert.ok(linked > 5, `the shared declared houses' resident pages link home (${linked})`);
});

// Until 2026-11-10 the household page kept a rail, the Household seat and a tab per resident, and `?resident=<h>` picked the tab in place. The design draws each
// resident once now, and its card links to the resident's own page; the old address redirects there (Darko, 17:28 EST: "Residents are drawn once, by the theme").
test("built: ?resident=<handle> on a household page redirects to the resident's own page, the rest of the query and the fragment riding across; a handle of another house, or none, stays put", { skip: !built }, () => {
  const html = dist("households", "starforge", "index.html");
  const outside = withoutEntryRegion(html);
  const scripts = inlineScripts(outside).map((s) => s.text).filter((t) => /location\.replace\("\/residents\//.test(t));
  assert.equal(scripts.length, 1, "one redirect script, outside the entry's region (the page's policy trusts it by its hash)");
  const go = (search, hash = "") => {
    const seen = [];
    vm.runInNewContext(scripts[0], { location: { search, hash, replace: (u) => seen.push(u) }, URLSearchParams, encodeURIComponent });
    return seen;
  };
  assert.deepEqual(go("?resident=wright"), ["/residents/wright/"], "a resident of this house: their own page");
  assert.deepEqual(go("?resident=rei&edit=profile", "#home"), ["/residents/rei/?edit=profile#home"], "the editor's ask and the fragment ride across (wantsProfileEditor reads /residents/<h>/?edit=profile)");
  assert.deepEqual(go("?entry=ledger&resident=wright"), ["/residents/wright/?entry=ledger"], "nothing else of the query is lost");
  assert.deepEqual(go("?resident=somebody-else"), [], "a handle that is not of this house is ignored: the household page shows");
  assert.deepEqual(go("?resident="), [], "an empty one too");
  assert.deepEqual(go(""), [], "and no ask is no redirect");
  assert.deepEqual(go("?resident=wright%2F..%2Fx"), [], "a handle is matched whole against the house's members: a path is never built from an unmatched one");
  // and what it redirects TO is a page that exists
  for (const h of ["wright", "rei"]) assert.ok(fs.existsSync(path.join(DIST, "residents", h, "index.html")), `/residents/${h}/ is built`);
  assert.match(read("town/components/HouseholdPage.astro"), /handles\.indexOf\(h\) < 0/, "PIN: only a member of this house is redirected to");
});

test("built: a resident's card, name and mentions on the household page link to that resident's own page, never to a tab of this one", { skip: !built }, () => {
  for (const slug of slugsBuilt()) {
    const html = dist("households", slug, "index.html");
    assert.ok(!html.includes("?resident="), `${slug}: no link to ?resident=`);
    assert.match(html, /data-hd-card="[^"]+"[\s\S]{0,400}href="\/residents\/[^"/]+\/"/, `${slug}: a card links to /residents/<handle>/`);
  }
  const stage = read("src/lib/hearth/stage.mjs");
  assert.match(stage, /const seatHref = \(h\) => `\/residents\/\$\{encodeURIComponent\(h\)\}\/`;/, "PIN: the live parts (feed names, posts, mentions) link there too");
  assert.ok(!/\?resident=/.test(stage + read("src/components/hearth/HearthSlot.astro")), "and nothing of the page's own builds a ?resident= address");
});

// ── POS-962's saved Hearth, folded into the one page (the dropdown is every reader's to preview with; only the signed-in human saves) ──

import { designNote, readSavedHearth } from "../src/lib/hearth/choice.mjs";
import { createPicker } from "../src/lib/hearth/picker.mjs";
const DESIGNS = [{ id: "default", title: "Postmark's default" }, { id: "ledger", title: "The ledger" }, { id: "orchard", title: "Orchard" }];

test("a saved choice is what the page draws; ?entry= previews over it WITHOUT saving; the preview wins only on that visit", async () => {
  assert.equal(whichDesign(DESIGNS, { saved: "ledger" }).id, "ledger", "the house's kept choice, with nothing asked");
  assert.equal(whichDesign(DESIGNS, { entry: "orchard", saved: "ledger" }).id, "orchard", "?entry= previews over the saved choice");
  assert.equal(whichDesign(DESIGNS, { entry: "no-such", saved: "ledger" }).id, "ledger", "an unregistered preview draws the kept choice, not the default");
  assert.equal(whichDesign(DESIGNS, { saved: null }).id, "default", "a house that chose nothing draws the default");
  // the preview, through the real picker with a write spy: previewing sends nothing; only keep(), the green check, writes, once
  const writes = [];
  const drawn = [];
  const p = createPicker({ entries: DESIGNS, slug: "dreme-mynd", saved: "ledger", signedIn: true, onDraw: (id) => drawn.push(id), save: async (a) => { writes.push(a); return { ok: true, status: 200, hearth: a.id }; } });
  p.preview("orchard");
  assert.deepEqual(drawn, ["orchard"]);
  assert.equal(p.view().savedId, "ledger", "the kept choice is untouched by a preview");
  assert.equal(p.view().pending, true, "the check and the x show");
  assert.deepEqual(writes, [], "a preview writes nothing");
  await p.keep();
  assert.deepEqual(writes, [{ slug: "dreme-mynd", id: "orchard" }], "the one write, the green check");
  assert.equal(p.view().savedId, "orchard", "and only now is the kept choice the previewed one");
  assert.deepEqual(drawn, ["orchard", "orchard"], "drawn on the preview, and again on the successful save");
});

test("a failed choice read falls back to the default AND says so; a choice this build does not know says so too", async () => {
  const down = async () => { throw new Error("offline"); };
  const refused = async () => ({ ok: false, status: 503, json: async () => ({}) });
  const html = async () => ({ ok: true, status: 200, json: async () => { throw new Error("not json"); } });
  for (const [what, fetchImpl] of [["no answer", down], ["a refusal", refused], ["an answer that is not JSON", html]]) {
    const saved = await readSavedHearth({ handles: ["wick"], slug: "dreme-mynd", api: "/api", fetchImpl });
    assert.equal(saved, undefined, `${what}: the read FAILED (undefined), which is not "chose nothing" (null)`);
    assert.equal(whichDesign(DESIGNS, { saved }).id, "default", `${what}: the default is drawn`);
    assert.match(designNote(DESIGNS, { saved }), /saved Hearth could not be read just now; showing the default/, `${what}: and the page says so`);
  }
  const ok = await readSavedHearth({ handles: ["wick"], slug: "dreme-mynd", api: "/api", fetchImpl: async (u) => ({ ok: true, status: 200, json: async () => ({ registry: { households: { "dreme-mynd": { hearth: "ledger" } } } }), u }) });
  assert.equal(ok, "ledger");
  assert.equal(designNote(DESIGNS, { saved: "ledger" }), "", "a kept choice that is drawn says nothing");
  assert.match(designNote(DESIGNS, { saved: "future-entry" }), /not in this version of the site yet; showing the default/);
  assert.equal(whichDesign(DESIGNS, { saved: "future-entry" }).id, "default");
});

// Until 2026-11-10 (Darko, 17:28 EST: "anyone can preview another Hearth with it (as ?entry= does now); only the house's own signed-in human saves") a visitor had no
// dropdown at all. A visitor's dropdown previews, and that is all it does: no save control, no question, no write.
test("a visitor, or a reader who is not the house's human, previews with the dropdown but has no save: the preview draws, and nothing can be asked or written", async () => {
  const writes = [];
  for (const signedIn of [false, () => false]) {
    const drawn = [];
    const p = createPicker({ entries: DESIGNS, slug: "dreme-mynd", saved: "ledger", signedIn, onDraw: (id) => drawn.push(id), save: async (a) => { writes.push(a); return { ok: true, hearth: a.id }; } });
    assert.equal(p.view().controls, false, "no save controls");
    p.preview("orchard");
    assert.deepEqual(drawn, ["orchard"], "the preview DRAWS for a visitor: anyone may preview");
    assert.equal(p.view().shown, "orchard");
    assert.deepEqual([p.view().pending, p.view().canKeep], [false, false], "no check and no x");
    const v = await p.keep();
    assert.deepEqual(writes, [], `a forced keep() writes nothing (${JSON.stringify(v.failed)})`);
  }
  assert.equal(whichDesign(DESIGNS, { saved: "ledger" }).id, "ledger", "and the kept design is what a visitor draws");
});

test("a picker mounted over a design the page is already previewing starts on THAT one, so the human can save what they are looking at", async () => {
  const writes = [];
  const p = createPicker({ entries: DESIGNS, slug: "dreme-mynd", saved: "ledger", shown: "orchard", signedIn: true, save: async (a) => { writes.push(a); return { ok: true, hearth: a.id }; } });
  assert.equal(p.view().shown, "orchard", "the page opened on ?entry=orchard");
  assert.equal(p.view().pending, true, "another design than the kept one: the check and the x show");
  assert.equal(p.view().canKeep, true, "and it can be saved without choosing it again");
  await p.keep();
  assert.deepEqual(writes, [{ slug: "dreme-mynd", id: "orchard" }]);
  const unknown = createPicker({ entries: DESIGNS, slug: "x", saved: "ledger", shown: "no-such" });
  assert.equal(unknown.view().shown, "ledger", "an unregistered design on screen is not taken as shown");
});

test("built: the dropdown is in the strip, above the design, outside the entry's region, once, and the page's one Hearth section is the strip's", { skip: !built }, () => {
  for (const slug of slugsBuilt()) {
    const html = dist("households", slug, "index.html");
    const at = html.indexOf("data-hearth-picker");
    assert.ok(at > html.indexOf("data-hearth-bar") && at < html.indexOf(ENTRY_OPEN), `${slug}: the dropdown is inside the strip, above the design`);
    assert.equal((html.match(/data-hearth-picker/g) ?? []).length, 1, `${slug}: one dropdown`);
    assert.ok(/data-hearth-acts hidden/.test(html), `${slug}: its check and x ship hidden`);
    assert.ok(!/data-hearth-picker/.test(html.slice(html.indexOf(ENTRY_OPEN), html.indexOf(ENTRY_CLOSE))), `${slug}: none in the entry's region`);
    assert.ok(!/data-hband-hearth/.test(html), `${slug}: and no band's Hearth section`);
  }
});

// ── review of 80af398fb: the save is the owner's, never on a failed read; the saved choice baked at build ──

import { buildHouses } from "../src/lib/houses.mjs";

test("PIN the stage: the dropdown binds for every reader, once, after the choice read answered (or failed); the SAVE controls are the owner's, and never on a failed read", () => {
  const stage = read("src/lib/hearth/stage.mjs");
  const fn = stage.slice(stage.indexOf("function mountPicker()"), stage.indexOf("const onDraw"));
  assert.match(fn, /if \(mounted \|\| !pickerRoot \|\| !savedDone\) return;/, "once, after the read, for any reader (until 2026-11-10: not for a non-owner)");
  assert.ok(!/mine\(\)/.test(fn.replace(/signedIn: \(\) => readOk && mine\(\)\.length > 0/, "")), "the owner's check is the save's alone: it is not a condition of binding");
  assert.match(fn, /signedIn: \(\) => readOk && mine\(\)\.length > 0/, "the save controls show for a sign-in that holds one of this house's residents, and never on a failed read");
  assert.match(fn, /saved: readOk \? \(savedRead \?\? null\) : baked/, "on a failed read the picker starts from what the build carried, not from 'nothing'");
  assert.match(fn, /shown: root\.dataset\.hearthShowing/, "and over the design already on screen");
  assert.equal((stage.match(/mountHearthPicker\(/g) ?? []).length, 1, "one call site, inside mountPicker");
  assert.match(stage, /mountPicker\(\);\s*paintHouse\(stage/, "draw() binds it (and so again on pm:lens, which calls load() then draw())");
  assert.match(stage, /mountPicker\(\);\s*if \(picker && drawn\)/, "and the saved read binds it when it lands");
  assert.ok(!/signedIn: \(\) => true/.test(stage), "its sign-in check is the owner's, never a constant");
  assert.match(read("src/lib/hearth/picker.mjs"), /if \(select\) select\.disabled = false;/, "the dropdown ships disabled and is enabled when it is bound");
});

test("the saved choice is baked at build: the registry's `hearth` is on the house, the server and the dropdown draw it, and the stage starts from it", () => {
  const reg = { households: { "dreme-mynd": { residents: ["wick"], hearth: "ledger" }, plain: { residents: ["fen"] }, odd: { residents: ["oak"], hearth: 7 }, blank: { residents: ["elm"], hearth: "" } } };
  const res = ["wick", "fen", "oak", "elm"].map((handle) => ({ handle }));
  const { bySlug } = buildHouses(res, reg);
  assert.equal(bySlug.get("dreme-mynd").hearth, "ledger");
  assert.equal(bySlug.get("plain").hearth, null, "no saved choice in the registry: null");
  assert.equal(bySlug.get("odd").hearth, null, "a value that is not an id is not a choice");
  assert.equal(bySlug.get("blank").hearth, null);
  assert.equal(whichDesign(DESIGNS, { saved: bySlug.get("dreme-mynd").hearth }).id, "ledger", "the server's answer for that house");
  assert.equal(whichDesign(DESIGNS, { saved: bySlug.get("plain").hearth }).id, "default");
  const page = read("src/components/hearth/Hearth.astro"), stage = read("src/lib/hearth/stage.mjs");
  assert.match(page, /const entry = whichDesign\(entries, \{ saved: house\.hearth \?\? null \}\);/);
  assert.match(page, /data-hearth-baked=\{house\.hearth \?\? ""\}/, "the build's own copy has its own attribute: data-hearth-saved is the picker root's saved id");
  assert.match(page, /selected=\{entry\?\.id \?\? null\}/, "the dropdown starts on what the server draws");
  assert.match(stage, /const baked = root\.dataset\.hearthBaked \|\| null;/);
  assert.match(stage, /const first = whichDesign\(entries, \{ entry: asked, saved: baked \}\);/, "the first draw starts from the baked choice");
  assert.match(stage, /const saved = readOk \? read : baked;/, "a failed read keeps the baked choice (else the default)");
});

test("built: every household page carries the baked-saved hook the stage reads (empty until the office's registry carries a choice)", { skip: !built }, () => {
  for (const slug of slugsBuilt()) {
    const html = dist("households", slug, "index.html");
    assert.match(html, /<section class="hearth" data-hearth data-hearth-slug="[^"]*" data-hearth-baked(="[^"]*")?[ >]/, `${slug}: the hook is on the Hearth root (Astro prints an empty value as the bare attribute)`);
    assert.match(html, /<select data-hearth-pick disabled /, `${slug}: the dropdown ships disabled until it is bound`);
  }
});

// review of bfddcd08f: the fold holds the registry's `hearth` to the same shape the browser read holds it to (ENTRY_ID), so one house's bad value is not baked
// into a page (and cannot fail the whole build at the policy hook, which fails closed on an inline handler).
import { ENTRY_ID } from "../src/lib/hearth/slots.mjs";

test("the fold bakes a saved Hearth only if it is an entry id: a hostile or malformed value is null, a good one stays", () => {
  const hostile = ['ledger" onerror="alert(1)', "x onerror=alert(1)", "<img src=x onerror=alert(1)>", "javascript:alert(1)", "Ledger", "led ger", "-ledger", "a".repeat(41), "../etc", "ledger\n", ""];
  const good = ["ledger", "default", "my-entry-2", "a", "a".repeat(40)];
  const reg = { households: Object.fromEntries([...hostile, ...good].map((h, i) => [`house-${i}`, { residents: [`r${i}`], hearth: h }])) };
  const { bySlug } = buildHouses([...hostile, ...good].map((_, i) => ({ handle: `r${i}` })), reg);
  hostile.forEach((h, i) => assert.equal(bySlug.get(`house-${i}`).hearth, null, `not baked: ${JSON.stringify(h)}`));
  good.forEach((h, i) => assert.equal(bySlug.get(`house-${hostile.length + i}`).hearth, h, `baked: ${h}`));
  for (const h of good) assert.match(h, ENTRY_ID, "and every baked value is an id the browser read would accept too");
  assert.match(read("src/lib/houses.mjs"), /typeof dec\.hearth === "string" && ENTRY_ID\.test\(dec\.hearth\)/, "PIN: the one test is ENTRY_ID, shared with choice.mjs's read");
});
