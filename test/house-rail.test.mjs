// house-rail.test.mjs — the household's two rails (POS-999): the main rail's corner (a round household icon and the residents' faces, honeycombed)
// and ONE sub-rail, the same component on the household page and on every resident page.
//
// Darko, on his dev walk, 2026-11-11 10:48 EST: "I think the solution I want to go for is to just use icons. So we should just have like a household,
// you know, icon, pretty simple, and a bunch of circles. So the icon itself should be a circle and a bunch of circles just for the profile pictures of
// each of your residents that just kind of cluster up in the top right next to the like notification bell of the main rail." And: "We need to unify
// the subrail of the household and each resident page … instead of having just a phrase add a resident that's underscored with a plus sign as the
// link, we could just have like a plus sign pill next to all of the resident chips … that says, you know, maybe add a resident on hover … the drop-down
// selector for the hearth … should be like all the way in the corner, and a little button for the likeness or like consent question. Maybe actually
// within like a little settings panel in the household." 10:57: every resident, "up to 10 … They can be pretty small circles … maybe like honeycombed";
// "a settings button that opens a panel and then has the likeness question there"; on a resident page "we can just keep the corner empty".
//
// WHAT READS WHAT:
//   - the corner's plan is LIFTED from the layout's first-paint script (between its markers) and RUN, at 1, 3, 9, 10 and 12 residents; its painter is
//     run too, over a small document shim, and what it builds is read;
//   - the honeycomb is the layout's stylesheet: its numbers are read and the placement computed for 1, 3, 9 and 10 faces against the bell's height
//     (a TEXT PIN with arithmetic; the walk in the lane's report measures the render);
//   - the sub-rail is read on the BUILT pages (they skip without a build: run `npm run build` first), every household page and every resident page;
//   - the reading mark is painted by the real painter over a shim.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { paintReadingMark } from "../src/lib/household-dashboard/paint.mjs";
import { NOT_READING } from "../src/lib/household-dashboard/fold.mjs";
import { buildHouses, housePath } from "../src/lib/houses.mjs";
import { ENTRY_OPEN } from "../tools/lib/hearth-csp.mjs";

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const DIST = path.join(ROOT, "dist-town");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const built = fs.existsSync(path.join(DIST, "households")) && fs.existsSync(path.join(DIST, "residents"));
const dist = (...segs) => fs.readFileSync(path.join(DIST, ...segs), "utf8");
const plain = (v) => JSON.parse(JSON.stringify(v));   // a value from the vm's realm, compared as data

// ── the corner's plan and painter, lifted from the layout ───────────────────

const LAYOUT = read("src/layouts/PostmarkLayout.astro");
const OPEN = "// pm-house-corner:plan", CLOSE = "// /pm-house-corner:plan";
const planSrc = LAYOUT.slice(LAYOUT.indexOf(OPEN) + OPEN.length, LAYOUT.indexOf(CLOSE));
const plan = (handles, house, home) => plain(vm.runInNewContext(`${planSrc}\npmHouseCornerPlan(handles, house, home);`, { handles, house, home, encodeURIComponent }));

const HOME = "/households/the-fixture-house/";
const houseOf = (n) => {
  const handles = Array.from({ length: n }, (_, i) => `fx-${i + 1}`);
  return { handles, house: { home: HOME, plate: "The Fixture House", residents: handles.map((h, i) => ({ handle: h, name: `Fixture ${i + 1}`, avatar: i % 2 ? `/media/${h}-card.jpg` : null, monogram: "F" })) } };
};

test("the plan is lifted from between its markers, once, and is the function the painter calls", () => {
  assert.ok(LAYOUT.indexOf(OPEN) > 0 && LAYOUT.indexOf(CLOSE) > LAYOUT.indexOf(OPEN), "both markers are in the layout");
  assert.equal(LAYOUT.split(OPEN).length, 2, "one opening marker");
  assert.match(planSrc, /^\s*function pmHouseCornerPlan\(handles, house, home\) \{/, "the slice is the plan, whole");
  assert.equal((LAYOUT.match(/pmHouseCornerPlan\(/g) ?? []).length, 2, "defined once and called once (by window.pmHouseCorner)");
});

test("the corner at 1, 3, 9 and 10 residents shows every one; at 12 it shows ten, in the house's own order, and the household icon reaches the rest", () => {
  for (const n of [1, 3, 9, 10, 12]) {
    const { handles, house } = houseOf(n);
    const p = plan(handles, house, HOME);
    assert.equal(p.faces.length, Math.min(n, 10), `${n} residents: ${Math.min(n, 10)} faces`);
    assert.equal(p.home, HOME, `${n}: the household icon goes to the house's page`);
    assert.equal(p.name, "The Fixture House", `${n}: the icon's title and accessible name is the house's name`);
    assert.deepEqual(p.faces.map((f) => f.href), handles.slice(0, 10).map((h) => `/residents/${h}/`), `${n}: each face links to its resident's own page`);
    assert.deepEqual(p.faces.map((f) => f.name), handles.slice(0, 10).map((_, i) => `Fixture ${i + 1}`), `${n}: each face's name is its title and accessible name`);
    p.faces.forEach((f, i) => assert.equal(f.avatar, i % 2 ? `/media/fx-${i + 1}-card.jpg` : "", `${n}: face ${i + 1} wears its picture, or none`));
    p.faces.forEach((f) => assert.equal(f.initial, "F", "and its initial where there is no picture"));
  }
});

test("the house's order wins; a resident /me knows that this build has not drawn comes last, as its initial; a stranger in the faces file is not drawn", () => {
  const { house } = houseOf(3);
  const p = plan(["new-arrival", "fx-3", "fx-1", "fx-2"], { ...house, residents: [...house.residents, { handle: "not-mine", name: "Not mine" }] }, HOME);
  assert.deepEqual(p.faces.map((f) => f.href), ["/residents/fx-1/", "/residents/fx-2/", "/residents/fx-3/", "/residents/new-arrival/"]);
  assert.deepEqual(p.faces.at(-1), { href: "/residents/new-arrival/", name: "new-arrival", avatar: "", initial: "N" }, "named by its handle, its initial from its handle");
});

test("faces kept for ANOTHER house are not worn; a house with no page has no icon and its residents are their initials; nothing signed in is no corner", () => {
  const { handles, house } = houseOf(3);
  const other = plan(handles, { ...house, home: "/households/somewhere-else/" }, HOME);
  assert.equal(other.home, HOME, "the icon still goes home");
  assert.equal(other.name, "your household", "but the name kept is another house's, so it is not used");
  assert.ok(other.faces.every((f) => f.avatar === "" && f.name.startsWith("fx-")), "and no face from another house's file");
  const undeclared = plan(["solo"], null, "");
  assert.equal(undeclared.home, "", "no page, no icon");
  assert.deepEqual(undeclared.faces, [{ href: "/residents/solo/", name: "solo", avatar: "", initial: "S" }]);
  assert.equal(plan([], house, HOME).faces.length, 0, "no handles, no faces");
  assert.equal(plan(null, house, HOME).faces.length, 0);
  assert.equal(plan(["a"], house, "https://elsewhere.example/households/x/").home, "", "a home that is not this site's household path is not linked");
  assert.equal(plan(["a"], house, "/households/x/../../evil/").home, "", "nor one that climbs out");
});

test("a picture is worn only from this site or https: a hostile or odd one is dropped, and the initial shows", () => {
  for (const bad of ["javascript:alert(1)", "//evil.example/x.jpg", "data:image/png;base64,AAAA", "http://plain.example/x.jpg", " /media/x.jpg", 7, null]) {
    const p = plan(["a"], { home: HOME, plate: "P", residents: [{ handle: "a", name: "A", avatar: bad, monogram: "A" }] }, HOME);
    assert.equal(p.faces[0].avatar, "", `dropped: ${JSON.stringify(bad)}`);
  }
  for (const good of ["/media/a-card.jpg", "https://postmark.town/media/a.jpg"]) {
    assert.equal(plan(["a"], { home: HOME, residents: [{ handle: "a", avatar: good }] }, HOME).faces[0].avatar, good, `worn: ${good}`);
  }
});

// a small document: enough of one for the painter to build into, and for the test to read what it built
function el(tag) {
  return {
    tag, attrs: {}, children: [], className: "",
    setAttribute(k, v) { this.attrs[k] = String(v); },
    append(...c) { this.children.push(...c); },
    set textContent(v) { this.children = v === "" ? [] : [String(v)]; },
    get textContent() { return this.children.map((c) => (typeof c === "string" ? c : c.textContent)).join(""); },
  };
}
function store(map) { return { getItem: (k) => (k in map ? map[k] : null), setItem() {}, removeItem() {} }; }
function firstPaintScript() {
  const scripts = [...LAYOUT.matchAll(/<script is:inline>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const mine = scripts.filter((s) => s.includes(OPEN));
  assert.equal(mine.length, 1, "one first-paint script carries the corner");
  return mine[0];
}
function paintCorner({ handles, house, home }) {
  const window = {};
  const local = { "pm.oauth.handles.cache": JSON.stringify(handles), "pm.oauth.household.cache": home, "pm.oauth.house.cache": JSON.stringify(house) };
  const document = { createElement: el, querySelector: () => null, documentElement: { setAttribute() {} } };
  vm.runInNewContext(firstPaintScript(), { window, document, sessionStorage: store({}), localStorage: store(local), JSON, Date, encodeURIComponent });
  assert.equal(typeof window.pmHouseCorner, "function", "the first paint defines the one painter");
  const wrap = el("span");
  window.pmHouseCorner(wrap);
  return wrap;
}

test("the painter draws what the plan says: the round icon (named), then one face per resident (named, a picture or an initial), and nothing else", () => {
  for (const n of [1, 3, 9, 10]) {
    const { handles, house } = houseOf(n);
    const wrap = paintCorner({ handles, house, home: HOME });
    const [icon, faces] = wrap.children;
    assert.equal(wrap.children.length, 2, `${n}: the icon and the faces, nothing more (no words)`);
    assert.equal(icon.className, "pm-corner-house");
    assert.equal(icon.href, HOME);
    assert.equal(icon.attrs["aria-label"], "The Fixture House");
    assert.equal(icon.title, "The Fixture House");
    assert.equal(faces.className, "pm-corner-faces");
    assert.equal(faces.children.length, n, `${n}: one face per resident`);
    faces.children.forEach((a, i) => {
      assert.equal(a.className, "pm-corner-face");
      assert.equal(a.href, `/residents/fx-${i + 1}/`);
      assert.equal(a.attrs["aria-label"], `Fixture ${i + 1}`, "the name is its accessible name");
      assert.equal(a.title, `Fixture ${i + 1}`, "and its title (the hover words)");
      const [inside] = a.children;
      if (i % 2) assert.ok(inside.tag === "img" && inside.src === `/media/fx-${i + 1}-card.jpg` && inside.alt === "", "a picture, with no alt of its own (the link is named)");
      else assert.ok(inside.tag === "span" && inside.textContent === "F" && inside.attrs["aria-hidden"] === "true", "an initial, hidden from a screen reader (the link is named)");
    });
  }
  const signedInNoResidents = paintCorner({ handles: [], house: null, home: "" });
  assert.equal(signedInNoResidents.textContent, "✦ signed in", "a sign-in with no residents keeps the words it had");
});

// ── the honeycomb (a text pin with arithmetic: the numbers are the stylesheet's own) ───────────────────

// Until 2026-11-11 12:50 EST this held the faces (then 14px) under the bell's 30px height; then, briefly, ten 22px faces inside the 174px the header
// left with the nav on one row. Darko, on dev, 12:50: "make their circles around twice as large"; 12:52: "two rows in the top rail is actually totally
// fine". So the faces are twice the first 14px, the cluster is taller than the bell (the header's row grows with it), and no width bound holds the
// corner: when the rail cannot hold it on one row, the nav's links wrap inside the nav (postmark.css § the town header; the split's pin is below).
test("TEXT PIN + arithmetic: the faces honeycomb in two offset rows at 1, 3, 9 and 10 faces, twice the first size, no two faces touch, and none leaves its box", () => {
  const css = LAYOUT.slice(LAYOUT.indexOf("THE HOUSE'S CORNER (POS-999)"));
  const num = (re, what) => { const m = re.exec(css); assert.ok(m, `the stylesheet says ${what}`); return Number(m[1]); };
  const rows = /grid-template-rows: (\d+)px (\d+)px;/.exec(css);
  assert.ok(rows, "two rows");
  const [rowA, rowB] = [Number(rows[1]), Number(rows[2])];
  const pitch = num(/grid-auto-columns: ([\d.]+)px;/, "the column pitch");
  const d = num(/\.pm-corner-face \{[^}]*width: ([\d.]+)px;/, "a face's size");
  const half = num(/\.pm-corner-face:nth-child\(even\) \{ transform: translateX\(([\d.]+)px\); \}/, "the lower row's half step");
  const pad = num(/:last-child\) \{ padding-right: ([\d.]+)px; \}/, "the box's widening when the last face is in the lower row");
  const solo = num(/\.pm-corner-face:only-child \{[^}]*width: (\d+)px;/, "one face alone");
  assert.match(css, /grid-auto-flow: column;/, "the faces run down the two rows, column by column");
  const soloColumn = num(/\.pm-corner-faces:has\(> \.pm-corner-face:only-child\) \{ grid-auto-columns: (\d+)px; \}/, "the lone face's column");
  const icon = num(/\.pm-corner-house \{[^}]*width: (\d+)px;/, "the household icon's size");
  for (const n of [1, 3, 9, 10]) {
    if (n === 1) {
      assert.ok(solo <= rowA + rowB, `one face (${solo}px) within the two rows' height (${rowA + rowB}px)`);
      assert.ok(solo <= soloColumn, `and inside its own column (${soloColumn}px), so it does not spill toward "sign out" (it did, at the 16px pitch, until the walk measured it)`);
      continue;
    }
    const cols = Math.ceil(n / 2);
    const box = { w: cols * pitch + (n % 2 === 0 ? pad : 0), h: rowA + rowB };
    const at = Array.from({ length: n }, (_, i) => ({ x: Math.floor(i / 2) * pitch + (i % 2 ? half : 0), y: i % 2 ? rowA : 0 }));
    assert.ok(box.h < 2 * d, `${n} faces: ${box.h}px tall, the lower row nesting into the upper (two stacked rows would be ${2 * d}px)`);
    for (const p of at) assert.ok(p.x + d <= box.w && p.y + d <= box.h, `${n} faces: a face at ${p.x},${p.y} stays inside its ${box.w}×${box.h} box`);
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const dist = Math.hypot(at[i].x - at[j].x, at[i].y - at[j].y);
      assert.ok(dist >= d, `${n} faces: faces ${i + 1} and ${j + 1} are ${dist.toFixed(1)}px apart, centre to centre (they would overlap under ${d})`);
    }
    if (n === 10) assert.equal(d, 2 * 14, `the faces are twice the first size (14px, which Darko found "way too small"): ${d}px`);
    // until 2026-11-12 the icon was the faces' size (28px); Darko, 08:47 EST: "we should also make the household icon stand out more"
    if (n === 10) assert.ok(icon > d && icon <= rowA + rowB, `and the household icon (${icon}px) is larger than a face (${d}px), within the faces' two rows (${rowA + rowB}px), so the header does not grow for it`);
    // honeycombed: the lower row sits between the upper row's faces, not under them
    if (n >= 3) assert.ok(Math.abs(Math.hypot(half, rowA) - pitch) <= 1, "a lower face is as far from its two upper neighbours as they are from each other");
  }
});

// ── the reading mark ────────────────────────────────────────────────────────

test("the reading mark: shown while anything is out, its words its title and its status text; gone once every read has answered", () => {
  const words = { textContent: "" };
  const mark = { hidden: true, title: "", querySelector: (s) => (s === "[data-hd-reading-words]" ? words : null) };
  const root = { querySelector: (s) => (s === "[data-hd-reading-mark]" ? mark : null) };
  paintReadingMark(root, { residents: ["a", "b"], house: [] });
  assert.equal(mark.hidden, false);
  assert.equal(mark.title, "still reading 2 residents…", "the words the strip used to print, as the mark's title");
  assert.equal(words.textContent, "still reading 2 residents…", "and as its status text");
  paintReadingMark(root, { residents: [], house: ["walkers"] });
  assert.equal(mark.title, "still reading the town’s record…");
  paintReadingMark(root, NOT_READING);
  assert.equal(mark.hidden, true, "nothing out: the mark goes");
  assert.equal(mark.title, "");
  paintReadingMark({ querySelector: () => null }, { residents: ["a"], house: [] });   // a page without the mark: nothing to do, nothing thrown
});

// ── the sub-rail, on the built pages ────────────────────────────────────────

const residents = JSON.parse(read("src/data/postmark/residents.json"));
const { houseOf: houseFor, bySlug } = buildHouses(residents, JSON.parse(read("src/data/postmark/households.json")));
const rails = (html) => html.match(/<nav class="pm-subrail" data-house-rail\b/g) ?? [];
const railOf = (html) => { const a = html.indexOf("data-house-rail"); return html.slice(a, html.indexOf("</nav>", html.indexOf("pm-subrail-corner", a)) + 6); };
const chipHandles = (rail) => [...rail.matchAll(/data-rail-chip="([^"]+)"/g)].map((m) => m[1]);
const currentOf = (rail) => [...rail.matchAll(/<a class="pm-chip[^"]*"[^>]*?(?:data-rail-chip="([^"]+)"|data-house-link)[^>]*aria-current="page"/g)].map((m) => m[1] ?? "HOUSE");
const cornerOf = (rail) => rail.slice(rail.indexOf('class="pm-subrail-corner"'));

test("built: every household page carries ONE sub-rail, in the strip, above the design: its own chip lit, a chip per resident, the + and the reading mark shipped hidden", { skip: !built }, () => {
  let pages = 0;
  for (const [p, house] of bySlug) {
    const file = path.join(DIST, "households", p, "index.html");
    if (!fs.existsSync(file)) continue;
    pages += 1;
    const html = fs.readFileSync(file, "utf8");
    assert.equal(rails(html).length, 1, `${p}: one sub-rail`);
    const at = html.indexOf("data-house-rail");
    assert.ok(at > html.indexOf("data-hearth-bar") && at < html.indexOf(ENTRY_OPEN), `${p}: inside the strip, above the design`);
    const rail = railOf(html);
    assert.match(rail, new RegExp(`<a class="pm-chip is-first" data-house-link href="/households/${p.replace(/[.]/g, "\\.")}/" aria-current="page"`), `${p}: the household's chip is this page's, lit`);
    assert.deepEqual(currentOf(rail), ["HOUSE"], `${p}: and no resident's is`);
    assert.deepEqual(chipHandles(rail), house.residents, `${p}: a chip per resident, in the house's order`);
    assert.ok(!/pm-chip-sub|pm-chip-txt/.test(rail), `${p}: a chip is its picture and its name, with no line under the name`);
    assert.match(rail, /<a class="pm-subrail-add" data-house-add href="\/join\/move-in\/" title="add a resident" aria-label="add a resident" hidden[ >]/, `${p}: the round +, its words its title and its name, shipped hidden`);
    assert.match(rail, /<span class="pm-subrail-reading" data-hd-reading-mark role="status" hidden[ >]/, `${p}: the reading mark, shipped hidden`);
  }
  assert.ok(pages > 10, `household pages read: ${pages}`);
});

test("built: the household page's far corner holds the Hearth dropdown and the settings, whose panel holds the likeness answer; the settings ship hidden; the strip's old links are gone", { skip: !built }, () => {
  for (const [p, house] of bySlug) {
    const file = path.join(DIST, "households", p, "index.html");
    if (!fs.existsSync(file)) continue;
    const html = fs.readFileSync(file, "utf8");
    const corner = cornerOf(railOf(html));
    assert.ok(corner.includes("data-hearth-picker") && /<select data-hearth-pick disabled /.test(corner), `${p}: the dropdown is in the corner, for every reader`);
    const settings = /<details class="hearth-settings" data-hearth-own data-hearth-settings hidden>([\s\S]*?)<\/details>/.exec(corner);
    assert.ok(settings, `${p}: the settings, shipped hidden, the house's own human's`);
    assert.match(settings[1], /<summary class="hearth-gear" title="settings">/, `${p}: a small button whose words are its title`);
    assert.match(settings[1], /<div class="hearth-settings-panel">\s*<span class="hearth-likeness" data-hd-likeness="(given|not given)"[^>]*>\s*likeness: \1 · <a href="https:\/\/postmark\.town\/api\/oauth\/likeness\?household=[^"]+">(Answer|Change) the likeness question<\/a>/, `${p}: the panel holds the likeness answer`);
    assert.ok(corner.indexOf("data-hearth-picker") < corner.indexOf("data-hearth-settings"), `${p}: the dropdown, then the settings at the very corner`);
    const strip = html.slice(html.indexOf("data-hearth-bar"), html.indexOf(ENTRY_OPEN));
    assert.equal((strip.match(/hearth-likeness/g) ?? []).length, 1, `${p}: the likeness answer is in the panel only`);
    assert.ok(!/class="hearth-own"|class="hearth-reading"|class="house-add"|\+ add a resident/.test(strip), `${p}: the strip's underlined + add a resident, its likeness line and its reading line are gone`);
    assert.equal(house.declared, true);
  }
});

test("built: every resident page carries the SAME sub-rail: its own chip lit, a chip per housemate, the corner empty, no dropdown, no settings, and no second header", { skip: !built }, () => {
  let pages = 0, solos = 0;
  for (const r of residents) {
    const file = path.join(DIST, "residents", r.handle, "index.html");
    if (!fs.existsSync(file)) continue;
    pages += 1;
    const html = fs.readFileSync(file, "utf8");
    assert.equal(rails(html).length, 1, `${r.handle}: one sub-rail`);
    const rail = railOf(html);
    const house = houseFor.get(r.handle);
    assert.deepEqual(chipHandles(rail).filter((h) => h !== "__house"), house.residents, `${r.handle}: a chip per resident of the house, in its order`);
    assert.deepEqual(currentOf(rail), [r.handle], `${r.handle}: this resident's chip is lit, and only it`);
    if (house.declared) assert.match(rail, new RegExp(`<a class="pm-chip is-first" data-house-link href="/households/${housePath(house.slug).replace(/[.]/g, "\\.")}/"`), `${r.handle}: the household chip goes to the house's page`);
    else assert.ok(!/data-house-link/.test(rail), `${r.handle}: an undeclared house has no page, so no link to one`);
    if (house.residents.length === 1) solos += 1;
    assert.match(cornerOf(rail), /^class="pm-subrail-corner"[^>]*><\/div>/, `${r.handle}: the far corner is empty`);
    assert.ok(!/data-hearth-pick|data-hearth-settings|hearth-likeness/.test(html), `${r.handle}: no Hearth dropdown, no settings, no likeness answer on a resident page`);
    assert.ok(!/data-house-plate|house-plate|class="house-tabs|data-house-add-row/.test(html), `${r.handle}: the second header (the house's name, the count, + add a resident) is gone, and the old rail with it`);
    assert.ok(!/pm-chip-sub|pm-chip-txt/.test(rail), `${r.handle}: no handle line under a name`);
    assert.match(rail, /<a class="pm-subrail-add" data-house-add href="\/join\/move-in\/" title="add a resident" aria-label="add a resident" hidden[ >]/, `${r.handle}: the round +, shipped hidden`);
    assert.ok(!/data-hd-reading-mark/.test(rail), `${r.handle}: no reading mark (nothing reads it here)`);
    assert.ok(html.indexOf("data-house-rail") < html.indexOf("data-profile-bubble"), `${r.handle}: the sub-rail stands above the profile`);
  }
  assert.ok(pages > 50 && solos > 10, `resident pages read: ${pages}, of houses of one: ${solos}`);
});

test("built: each declared house's faces file is the household page's own faces: the same residents in the same order, the same picture, nothing private", { skip: !built }, () => {
  let count = 0;
  for (const [p, house] of bySlug) {
    const page = path.join(DIST, "households", p, "index.html");
    if (!fs.existsSync(page)) continue;
    const file = path.join(DIST, "households", p, "faces.json");
    assert.ok(fs.existsSync(file), `${p}: a faces file beside the page`);
    const faces = JSON.parse(fs.readFileSync(file, "utf8"));
    count += 1;
    assert.deepEqual(Object.keys(faces).sort(), ["plate", "residents"], `${p}: the name and the faces, nothing else`);
    assert.deepEqual(faces.residents.map((f) => f.handle), house.residents, `${p}: the house's residents, in its order`);
    for (const f of faces.residents) {
      assert.deepEqual(Object.keys(f).sort(), ["avatar", "handle", "monogram", "name"], `${p}/${f.handle}: four public fields`);
      const chip = new RegExp(`data-rail-chip="${f.handle.replace(/[.]/g, "\\.")}"[^>]*>\\s*<span class="pm-chip-face"[^>]*>\\s*(?:<img src="([^"]+)"|<span[^>]*>([^<]*)</span>)`).exec(railOf(fs.readFileSync(page, "utf8")));
      assert.ok(chip, `${p}/${f.handle}: the household page's chip`);
      assert.equal(chip[1] ?? null, f.avatar, `${p}/${f.handle}: one picture on the sub-rail and in the corner`);
      if (!f.avatar) assert.equal(chip[2], f.monogram, `${p}/${f.handle}: one initial too`);
    }
  }
  assert.ok(count > 10, `faces files read: ${count}`);
  assert.match(dist("households", "starforge", "faces.json"), /"plate":"Starforge"/, "the house's name rides with its faces");
});

// ── the owner's parts and the resident page's chips (TEXT PINS: the walk in the lane's report reads the behaviour) ─────────

test("TEXT PIN: the + and the settings are the house's own human's: the household page's script and the resident page's each show them only for a sign-in that holds one of this house's residents", () => {
  const stage = read("src/lib/hearth/stage.mjs");
  assert.match(stage, /const owner = mine\(\)\.length > 0;\s*for \(const e of bar\?\.querySelectorAll\("\[data-hearth-own\], \[data-house-add\]"\) \?\? \[\]\) e\.hidden = !owner;/, "household page: the settings and the + follow the owner check");
  assert.match(stage, /const mine = \(\) => \(token\(\) \? held\(\)\.filter\(\(h\) => handles\.includes\(h\)\) : \[\]\);/, "and the owner is a fresh sign-in holding one of this house's residents");
  assert.match(stage, /if \(bar\) paintReadingMark\(bar, ctx\.reading\);/, "the stage paints the reading mark from the same reading state");
  const house = read("town/components/Household.astro");
  assert.match(house, /const owner = handles\.some\(\(h\) => here\.has\(h\)\);\s*for \(const link of links\) link\.hidden = !owner;/, "resident page: the + follows /me's handles against this house's");
  assert.equal((read("src/components/HouseRail.astro").match(/data-house-add/g) ?? []).length, 1, "one + in the component");
});

// ── the top rail's end, and how it splits into two rows (POS-999) ──
// Darko, 2026-11-11 12:52 EST: "join is a special button that we want to keep at the top and like near the sign in or like auth stuff".
test("TEXT PIN: Join is rendered from the rail's own lantern seat at the rail's end, outside the nav's links and outside the hidden auth block", () => {
  assert.match(LAYOUT, /\{RAIL\.filter\(\(n\) => !n\.lantern\)\.map\(/, "the nav's links are every seat but the lantern");
  const end = LAYOUT.indexOf('<div class="pm-townhead-end" data-townhead-end>');
  assert.ok(end > LAYOUT.indexOf('<nav class="pm-townnav-links"'), "the end follows the nav");
  const join = LAYOUT.indexOf('{RAIL.filter((n) => n.lantern).map((n) => (', end);
  assert.ok(join > end && join < LAYOUT.indexOf('<div class="pm-auth" data-auth hidden>'), "Join is in the end, before the auth block (which ships hidden), so it shows with no script");
  assert.match(LAYOUT.slice(join, join + 300), /class="pm-nav-join" aria-current=\{here\?\.key === n\.key \? "page" : undefined\}/, "it keeps its lantern class and lights when it is the page");
});

// THE SPLIT. Darko, 2026-11-12 08:46 EST, on dev, with ten residents: "top corner with 10 residents is still bad for the hearth; please look at how
// the main rail would overflow into a second row when there wasn't enough horizontal space before we even incorporated the household and resident
// icons. I want the main rail to split into a top and bottom row; not put the whole thing in the bottom and put a giant empty space in the middle".
// The rail before the faces (site 6488d659, measured in a browser): on a desktop the header is one row that never wraps, and the nav's own box narrows
// while its links wrap inside it, the first row keeping as many as fit. Until 2026-11-12 a first-paint script set data-rows="2" when the rail was full,
// and the stylesheet then gave the nav's links a row of their own (flex-basis: 100%), all six under the end, the middle of the first row empty.
// TEXT PIN over the stylesheet's rules (the site's CI has no browser): the lane's sweep measures the render at every width from 861 to 1568 px, signed
// out and at 1 to 10 faces. This reads every rule that sets the header's or the nav's own layout on a desktop, and compares the whole verdict.
function cssRules(css) {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const out = [];
  const walk = (s, media) => {
    let i = 0;
    for (;;) {
      const open = s.indexOf("{", i);
      if (open < 0) return;
      let head = s.slice(i, open);
      head = head.slice(head.lastIndexOf(";") + 1).trim();
      let depth = 1, j = open + 1;
      while (j < s.length && depth) { if (s[j] === "{") depth += 1; else if (s[j] === "}") depth -= 1; j += 1; }
      const body = s.slice(open + 1, j - 1);
      if (/^@(media|supports)\b/.test(head)) walk(body, [...media, head.replace(/\s+/g, " ")]);
      else if (!head.startsWith("@")) {
        const decls = {};
        for (const d of body.split(";")) { const k = d.indexOf(":"); if (k > 0) decls[d.slice(0, k).trim()] = d.slice(k + 1).trim(); }
        out.push({ media, selectors: head.split(",").map((x) => x.trim().replace(/\s+/g, " ")), decls });
      }
      i = j;
    }
  };
  walk(src, []);
  return out;
}
const PHONE = "@media (max-width: 860px)";
const HEADER = /\.pm-townhead(\[[^\]]*\])*$/, NAV = /\.pm-townnav-links(\[[^\]]*\])*$/;
function railVerdict(css, script) {
  const v = { headerWraps: [], headerQualified: [], navWrap: [], navOwnRow: [], scriptSetsRows: /data-rows|pmRailRows/.test(script) };
  for (const r of cssRules(css)) {
    const desktop = !r.media.includes(PHONE);
    for (const s of r.selectors) {
      if (desktop && HEADER.test(s)) {
        if (/wrap/.test(r.decls["flex-wrap"] ?? "") && r.decls["flex-wrap"] !== "nowrap") v.headerWraps.push(s);
        if (/\[[^\]]*\]$/.test(s)) v.headerQualified.push(s);
      }
      if (desktop && NAV.test(s)) {
        if ("flex-wrap" in r.decls) v.navWrap.push(`${s} ${r.decls["flex-wrap"]}`);
        for (const p of ["flex-basis", "width", "order", "flex"]) if (p in r.decls) v.navOwnRow.push(`${s} ${p}: ${r.decls[p]}`);
      }
    }
  }
  return v;
}
const SPLIT_LIKE_BEFORE = { headerWraps: [], headerQualified: [], navWrap: [".pm .pm-townnav-links wrap"], navOwnRow: [], scriptSetsRows: false };
test("TEXT PIN: on a desktop the top rail splits as it did before the faces: the header never wraps and the nav's links wrap inside the nav, so the links that fit stay on the first row and no rule sends all six to a row of their own", () => {
  const css = read("src/styles/postmark.css");
  assert.deepEqual(railVerdict(css, firstPaintScript()), SPLIT_LIKE_BEFORE,
    "the header is one row on a desktop; its nav wraps its own links; nothing gives the nav a row to itself, and no script decides the rows");
  // the reader sees the phone's rules where they are (a presence control: the same instrument finds a full-width nav and a wrapping header there)
  const phone = cssRules(css).filter((r) => r.media.includes(PHONE));
  assert.ok(phone.some((r) => r.selectors.some((s) => NAV.test(s)) && r.decls["flex-basis"] === "100%"), "the phone's own stacking is read, and stands");
  assert.ok(phone.some((r) => r.selectors.some((s) => HEADER.test(s)) && r.decls["flex-wrap"] === "wrap"), "and its header wraps");
});
test("the split's verdict goes red on the two-row rule it replaced (until 2026-11-12, every link under the end) and on a header that wraps the nav whole", () => {
  const css = read("src/styles/postmark.css");
  const script = firstPaintScript();
  // a7535457's own block, verbatim, and the script line that set the attribute it keys on
  const twoRows = `@media (min-width: 861px) {
  .pm .pm-townhead[data-rows="1"] .pm-townnav-links { flex-wrap: nowrap; }
  .pm .pm-townhead[data-rows="2"] { flex-wrap: wrap; row-gap: 0.3em; }
  .pm .pm-townhead[data-rows="2"] .pm-townhead-end { order: 1; }
  .pm .pm-townhead[data-rows="2"] .pm-townnav-links { order: 2; flex-basis: 100%; margin-left: 0; flex-wrap: nowrap; }
}`;
  const old = railVerdict(css + "\n" + twoRows, script + '\nhead.setAttribute("data-rows", over ? "2" : "1");');
  assert.deepEqual(old.headerWraps, ['.pm .pm-townhead[data-rows="2"]'], "the old rule's wrapping header is seen");
  assert.ok(old.navOwnRow.includes('.pm .pm-townhead[data-rows="2"] .pm-townnav-links flex-basis: 100%') && old.scriptSetsRows, "and its nav row of their own, and its script");
  assert.notDeepEqual(old, SPLIT_LIKE_BEFORE);
  const whole = railVerdict(css + "\n.pm .pm-townhead { flex-wrap: wrap; }\n.pm .pm-townnav-links { flex-basis: 100%; }", script);
  assert.deepEqual([whole.headerWraps, whole.navOwnRow], [[".pm .pm-townhead"], [".pm .pm-townnav-links flex-basis: 100%"]], "a desktop header that wraps the nav whole onto its own row is seen");
});

test("TEXT PIN: on a resident page a resident's chip is a link; a plain click switches the tab in place (the address moves to its page), any other click is the browser's", () => {
  const house = read("town/components/Household.astro");
  const at = house.indexOf('b.addEventListener("click", function (e) {');
  assert.ok(at > 0 && house.lastIndexOf('house.querySelectorAll("[data-rail-chip]")', at) > 0, "the chips are bound");
  const bind = house.slice(at, at + 800);
  assert.match(bind, /if \(e\.defaultPrevented \|\| e\.button !== 0 \|\| e\.metaKey \|\| e\.ctrlKey \|\| e\.shiftKey \|\| e\.altKey\) return;/, "a modified click opens the page as a link would");
  assert.match(bind, /if \(!\(h === HOUSE_TAB && hasHouseSeat\) && memberHandles\.indexOf\(h\) < 0\) return;\s*e\.preventDefault\(\);\s*show\(h, true\);/, "a housemate's chip, or the seat's, switches in place");
  assert.match(house, /if \(b\.getAttribute\("data-rail-chip"\) === handle\) b\.setAttribute\("aria-current", "page"\);\s*else b\.removeAttribute\("aria-current"\);/, "and the lit chip follows the tab");
  assert.match(house, /if \(push && path\) history\.pushState\(\{ handle: handle \}, "", path\);/, "the address moves to the resident's own page");
});
