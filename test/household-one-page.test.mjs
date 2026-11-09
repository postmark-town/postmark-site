// household-one-page.test.mjs — one household page, drawn by the Hearth, with the site's own band (POS-984).
//
// Darko, 2026-11-09 14:34 EST (POS-684 sitting, call 1): "the household profile or page and the household hearth are not
// supposed to be two different … it needs to become the first class center for how a human gets a sense of what is
// going on". Call 2, 14:51: "the household's design draws the house for everyone; the site draws its own band only for
// the signed-in human … No design can hide the controls, and every entry made today stays valid."
//
// WHAT THIS HOLDS, and what reads what:
//   - the SEAM: the page asks ONE function which design to draw (which-design.mjs); the function is run, and the built page
//     is checked against its answer;
//   - the ONE PAGE: the band above the design (private body, visitor line), the old /hearth/ address forwarding with the
//     preview's query riding across (the forwarder's own script is RUN), the ways in (the layout's household link, a
//     resident page's rail);
//   - the band is OUT OF A DESIGN'S REACH: through the real sanitizer, a hostile stylesheet cannot name it.
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
import { housePath } from "../src/lib/houses.mjs";
import { ENTRY_OPEN, ENTRY_CLOSE, withoutEntryRegion } from "../tools/lib/hearth-csp.mjs";

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const DIST = path.join(ROOT, "dist-town");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const built = fs.existsSync(path.join(DIST, "households"));
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
  assert.match(page, /const entry = whichDesign\(entries\);/);
  assert.ok(!/defaultEntry/.test(page), "the page no longer reads the registry's default itself");
  const stage = read("src/lib/hearth/stage.mjs");
  assert.equal((stage.match(/whichDesign\(entries, \{ entry: /g) ?? []).length, 2, "compose() and the first draw each ask the one function");
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

// ── the band ───────────────────────────────────────────────────────────────

test("built: the band sits above the design, outside the entry's region; its body is private, its visitor line is not", { skip: !built }, () => {
  for (const slug of slugsBuilt()) {
    const html = dist("households", slug, "index.html");
    const band = html.indexOf("data-hband ");
    assert.ok(band > 0, `${slug}: the page carries the band`);
    assert.ok(band < html.indexOf(ENTRY_OPEN) && html.indexOf(ENTRY_OPEN) < html.indexOf("data-hearth-stage "), `${slug}: band, then the entry's region, then the design`);
    assert.ok(withoutEntryRegion(html).includes("data-hband "), `${slug}: the band is the host's, not the entry's`);
    const own = html.indexOf('class="hband-own" data-private');
    assert.ok(own > band, `${slug}: the band's body is private`);
    for (const need of ["data-hd-needs-box", "data-hd-boat", "data-quests ", "data-hband-manage", "data-hb-edit=", "data-house-add"]) {
      const at = html.indexOf(need, own);
      assert.ok(at > own && at < html.indexOf(ENTRY_OPEN), `${slug}: ${need} is in the private band`);
    }
    // the visitor's line is outside the private body and there is exactly one sign-in button on the page
    const visit = html.indexOf("Is this your house?");
    assert.ok(visit > band && visit < own, `${slug}: the visitor line is the band's, before its private body`);
    // the question is the sign-in button's own text, so a reader without the button never reads a bare question (review, paper cut)
    assert.match(html.slice(visit - 160, visit), /<button[^>]*data-hd-signin[^>]*>$/, `${slug}: the question is inside the sign-in button`);
    assert.match(html, /<p class="hband-notyours"[^>]*data-hband-notyours hidden[^>]*>This isn’t your house/, `${slug}: a signed-in reader of another house is told so, and it ships hidden`);
    assert.ok(html.includes("Signing in with GitHub needs scripts"), `${slug}: without scripts it says sign-in needs them`);
    assert.equal((html.match(/data-hd-signin/g) ?? []).length, 1, `${slug}: one sign-in line, so a design that leaves its house slot out loses nothing`);
    // nothing private is in the static page: Needs you ships hidden and empty, the edit links hidden
    assert.match(html.slice(html.indexOf("data-hd-needs-box")), /^data-hd-needs-box hidden/, `${slug}: Needs you ships hidden`);
    assert.match(html.slice(html.indexOf("data-hd-needs-box")), /<ul data-hd-needs><\/ul>/, `${slug}: and empty`);
    assert.ok(!/data-hb-edit="[^"]*"(?![^>]*\bhidden\b)[^>]*>/.test(html), `${slug}: every Edit profile link ships hidden`);
  }
});

test("the band is out of a design's reach: through the real sanitizer, a stylesheet that names the band's classes or hooks scopes or is refused", () => {
  const e = prepareEntry({
    id: "hostile", title: "h", html: "<p>a</p>",
    css: ".hband, [data-hband], .hd-needs, .hband-own, .hd-boat, body, html, :root, * { display: none !important; }\n.hband { visibility: hidden; }\n@media (max-width: 700px) { .hband { display: none; } }",
  });
  assert.ok(e.ok);
  const scope = '.hearth-stage[data-hearth-entry="hostile"]';
  for (const rule of e.css.split("}")) {
    const sel = rule.split("{")[0].replace(/@media[^{]*$/, "").trim();
    if (sel) assert.ok(sel.startsWith(scope), `a rule that is not under the stage: ${sel}`);
  }
  assert.ok(/\.u-hband\b/.test(e.css), "a class a template writes is namespaced `u-`: its `.hband` is `.u-hband`, a class nothing on the page wears");
  assert.ok(!/(^|[^-\w])\.hband\b/.test(e.css), "no rule carries the band's own class");
  assert.ok(!/data-hband/.test(e.css), "no rule carries the band's hook");
  assert.ok(e.problems.some((p) => /data-hband/.test(p)), "the attribute selector on the band's hook is refused, by name");
});

// Truey's review of ba023e9d9: a `:root`, `html` or `body` rule is rewritten onto the design's own stage, where `margin` and `transform` are
// allowed (and need no `!important`), and the stage's `contain: paint` clips its children, not itself: a design could move up over the band.
// The host's frame around the region clips the stage itself. qa-shots/hearth-walk.mjs scenario ⑫ proves it in a browser (red without the rule).
test("the sanitizer lets a rooted margin or transform through, so the host's frame is what keeps a design off the band: the frame wraps the region and clips", () => {
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
    assert.ok(frame > html.indexOf("data-hband ") && frame < html.indexOf(ENTRY_OPEN), `${slug}: band, then the frame, then the entry's region`);
    assert.ok(html.indexOf(ENTRY_CLOSE) < html.indexOf("</div>", html.indexOf(ENTRY_CLOSE)) && /<div class="hearth-frame">\s*<\/div>/.test(withoutEntryRegion(html)), `${slug}: the frame is the host's: taking the region out leaves it empty`);
  }
});

test("a design cannot take the band's Needs you away: the page host hides the design's own copy, once, and the band is the one shown", () => {
  const css = read("src/components/hearth/hearth-host.css");
  assert.match(css, /\.hearth-stage \[data-hearth-slot="needs-you"\], \.hearth-stage \[data-hd-boat\] \{ display: none !important; \}/);
});

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

test("PIN the header: the layout asks householdHome from /me, keeps what it found, and its first paint reads the same key", () => {
  const layout = read("src/layouts/PostmarkLayout.astro");
  assert.match(layout, /import \{ householdHome \} from "@\/lib\/house-home\.mjs";/);
  assert.match(layout, /const home = householdHome\(me, handles\);/);
  assert.match(layout, /sessionStorage\.setItem\("pm\.oauth\.household", home\)/);
  assert.match(layout, /localStorage\.setItem\("pm\.oauth\.household\.cache", home\)/);
  assert.match(layout, /sessionStorage\.getItem\("pm\.oauth\.household"\) \|\| localStorage\.getItem\("pm\.oauth\.household\.cache"\)/, "the synchronous first paint and the island read one key");
  assert.equal((layout.match(/a\.textContent = "your household"|h0\.textContent = "your household"/g) ?? []).length, 2, "both painters draw the one link home");
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

test("built: the household page keeps its rail, the Household seat and a tab per resident, and ?resident= still picks the tab", { skip: !built }, () => {
  const html = dist("households", "starforge", "index.html");
  assert.ok(html.includes('data-house-tab="__house"'), "the Household seat chip");
  assert.ok(/data-member="__house"/.test(html), "and the seat itself");
  for (const h of ["wright", "rei"]) assert.ok(html.includes(`data-house-tab="${h}"`), `a tab for ${h}`);
  const hh = read("town/components/Household.astro");
  assert.match(hh, /new URLSearchParams\(location\.search\)\.get\("resident"\)/, "PIN: the tab the address asks for is still read here");
  assert.match(hh, /routeKind === "household"/, "PIN: only on the household's own route");
});
