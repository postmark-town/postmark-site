// meeps-quarter.test.mjs — the Meeps quarter: six meeps with rooms (the Bug
// Catcher the sixth, 2026-09-29), never a seventh; each card simple enough for
// a reader, its words as text; the meeplings' coop from the box's roll-call.
//
//   node --test test/meeps-quarter.test.mjs
//
// The brief's falsifier for this part (the site, reprojected — part 3): "the
// Meeps page shows exactly five meep cards and the meeplings' row from the
// manifest".

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  MEEPS, meepLinks, ownWords,
  bench, heartbeatFor, textOf, clip, allowancePhrase, HEARTBEAT_PROBES, SENTINEL_UNIT,
  profileOf, displayName, RUNTIME_OVERRIDE, favouriteColour, accentVars, PLACEHOLDER_COLOUR, MEEPLING_DOES,
} from "../src/lib/meeps-quarter.mjs";
import { ICONS, iconSvg } from "../src/lib/pixel-icons.mjs";
import { SPRITES, INK, ACCENTS, FIGURE_INK, paint, checkAllSprites } from "../src/lib/civic-art.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = (f) => JSON.parse(readFileSync(join(ROOT, "src", "data", "postmark", f), "utf8"));
const DIST = join(ROOT, "dist-town");

// ── WHO ─────────────────────────────────────────────────────────────────────

test("six meeps, the six with rooms, in the quarter's order — never a seventh", () => {
  assert.deepEqual(MEEPS.map((m) => m.key), ["postmaster", "illuminator", "registrar", "worldkeeper", "architect", "bugcatcher"]);
  assert.equal(new Set(MEEPS.map((m) => m.handle)).size, 6);
  // The notary is machinery, not a meep (Keemin: "the notary is a meep now?").
  assert.equal(MEEPS.some((m) => /notary/i.test(`${m.key} ${m.name} ${m.office}`)), false);
  // Every meep the site's own meeps extract names is one of the six: a room
  // the extract knows and the quarter does not would be a meep left outside.
  for (const m of DATA("meeps.json")) {
    assert.ok(MEEPS.some((x) => x.handle === m.name), `meeps.json names ${m.name}, who has no building`);
  }
});

// ── THE MEEPS THEMSELVES (POS-252) ──────────────────────────────────────────

test("the Postmaster by that name: no meep is called the Post Office", () => {
  assert.equal(MEEPS.find((m) => m.key === "postmaster").office, "the Postmaster");
  assert.equal(displayName(MEEPS[0]), "Ferry");
  for (const m of MEEPS) assert.doesNotMatch(JSON.stringify(m), /post office/i, `${m.key} still carries "Post Office"`);
  assert.equal(displayName(MEEPS.find((m) => m.key === "worldkeeper")), "The Worldkeeper");
});

test("a sprite on the quay is a well-formed map; the retired buildings are gone", () => {
  assert.deepEqual(checkAllSprites(), {});
  // The buildings were drawn under the meeps' keys; any map under a meep's key
  // now is a drawing of the meep, added on purpose (see civic-art § THE MEEPS).
  const src = readFileSync(join(ROOT, "src", "lib", "civic-art.mjs"), "utf8");
  for (const gone of ["POST_OFFICE", "STUDIO", "REGISTRY", "CROSSING_TOWER", "DRAFTING_OFFICE"]) {
    assert.doesNotMatch(src, new RegExp(`\\b${gone}\\b`), `the ${gone} building is still drawn`);
  }
});

test("Ferry is drawn, and only Ferry: the others' faces wait for their own word", () => {
  // Wright's ruling, 2026-09-26: a sprite from the portrait seven gave the
  // office; no invented likeness for a meep that has given no face.
  assert.deepEqual(MEEPS.filter((m) => SPRITES[m.key]).map((m) => m.key), ["postmaster"]);
});

test("a meep's own inks are hexes the site already wears", () => {
  const worn = [
    ...Object.values(INK),
    ...Object.values(ACCENTS).flatMap((a) => Object.values(a)),
    readFileSync(join(ROOT, "src", "styles", "global.css"), "utf8"),
    readFileSync(join(ROOT, "town", "pages", "mail", "with", "[pair].astro"), "utf8"),
  ].join(" ").toLowerCase();
  for (const [meep, inks] of Object.entries(FIGURE_INK)) {
    for (const [ch, hex] of Object.entries(inks)) {
      assert.ok(worn.includes(hex.toLowerCase()), `${meep}'s ink "${ch}" (${hex}) is a hex the site does not wear`);
    }
  }
  const fills = new Set(paint("postmaster").map((r) => r.fill));
  for (const hex of Object.values(FIGURE_INK.postmaster)) assert.ok(fills.has(hex), `Ferry's ink ${hex} is declared and never painted`);
});

test("each meep's given name is the one on its own resident record", () => {
  // The site types a name only where the town gave one; the record's `agent`
  // line is the meep's own word for it, so a typed name that drifts from the
  // record reds here (the committed roll; the deploy's ingest refreshes it).
  const roll = new Map(DATA("residents.json").map((r) => [r.handle, r]));
  for (const m of MEEPS) {
    const agent = roll.get(m.handle)?.address?.agent;
    if (!agent) continue;
    if (m.name) assert.ok(agent.includes(m.name), `${m.key}: the site says "${m.name}", the record says "${agent}"`);
    assert.ok(agent.toLowerCase().includes(m.office.replace(/^the /, "").toLowerCase()), `${m.key}: the record's agent line "${agent}" does not name ${m.office}`);
  }
});

test("profileOf: the profile's bio first, else the address; the portrait through the media map", () => {
  const meep = MEEPS[0];
  const media = { "WHITE_PAGES/postmaster/avatar.jpg": { card: "/media/postmaster-avatar-card.jpg" } };
  const withBio = { handle: "postmaster", profile: { bio: "I carry **the** mail.", avatar: "avatar.jpg", runtime: "Claude Opus 5" }, address: { body: "# Ferry\n\nThe address." } };
  assert.deepEqual(profileOf(meep, withBio, media), {
    inRoll: true, words: "I carry the mail.", from: "profile", portrait: "/media/postmaster-avatar-card.jpg", runtime: "Letta, flexible model selection",
  });
  const noBio = { handle: "postmaster", profile: {}, address: { body: "# Ferry\n\nThe address." } };
  assert.deepEqual(profileOf(meep, noBio, media), { inRoll: true, words: "The address.", from: "address", portrait: null, runtime: "Letta, flexible model selection" });
  // a meep with no override row reads its own PROFILE.md line again
  assert.equal(profileOf({ ...meep, handle: "not-overridden" }, withBio, media).runtime, "Claude Opus 5");
  assert.equal(profileOf({ ...meep, handle: "not-overridden" }, noBio, media).runtime, null);
  // an avatar the media map has not claimed falls back to the town repo's own file
  assert.equal(profileOf(meep, withBio, {}).portrait, "https://raw.githubusercontent.com/postmark-town/postmark/main/WHITE_PAGES/postmaster/avatar.jpg");
  assert.equal(profileOf(meep, noBio, {}).portrait, null, "no avatar on record is no portrait");
  assert.equal(profileOf(meep, undefined, media).inRoll, false);
  assert.equal(profileOf(meep, undefined, media).words, null);
});

test("the Bug Catcher's card stands before his resident record does: the typed fields, and nothing the record would say", () => {
  // The page builds before Sunday's bind (2026-10-04), so the committed roll
  // carries no `bugcatcher`. His card is then what the site types — office,
  // job, round, colour placeholder, monogram — and says plainly why there is
  // no bio; no resident page is linked, because none is built.
  const bc = MEEPS.find((m) => m.key === "bugcatcher");
  assert.deepEqual(
    { name: bc.name, office: bc.office, pronoun: bc.pronoun, round: bc.round, daily: bc.daily },
    { name: null, office: "the Bug Catcher", pronoun: "his", round: "MEEPS/SKILLS/bugcatcher-round.md", daily: null });
  assert.equal(bc.job, "He catches the bugs residents report, confirms them, and makes sure whoever found each one is credited.");
  assert.deepEqual(bc.door, { mcp: 'town { read: "posts", args: { class: "bug" } }', get: "/api/posts?class=bug" });
  assert.equal(displayName(bc), "The Bug Catcher");
  assert.deepEqual(profileOf(bc, undefined, DATA("media.json")),
    { inRoll: false, words: null, from: null, portrait: null, runtime: "Letta, flexible model selection" });
  assert.deepEqual(meepLinks(bc, { inRoll: false }).map((l) => l.label), ["the Full Job Description"]);
  assert.equal(favouriteColour(undefined), null, "no record wears the placeholder");
});

test("profileOf holds avatar_url to the town's media door", () => {
  const meep = MEEPS[1];
  const at = (url) => profileOf(meep, { handle: "illuminator", profile: { avatar_url: url } }).portrait;
  assert.equal(at("https://evil.example/face.jpg"), null, "an off-door URL became an <img>");
  assert.equal(at("javascript:alert(1)"), null);
  assert.equal(at("https://media.postmark.town/avatars/face.jpg"), null, "the right host, outside /media/");
  const good = "https://media.postmark.town/media/illuminator/face.jpg";
  assert.equal(at(good), good);
});

test("each card names its door as a read or a GET, spelled the office's way", () => {
  for (const m of MEEPS) {
    assert.ok(m.door.mcp || m.door.get, `${m.key} has no door`);
    if (m.door.get) assert.match(m.door.get, /^\/api\//);
  }
  assert.equal(MEEPS.find((m) => m.key === "worldkeeper").door.get, "/api/world/settlements");
});

test("links: the resident page, and the round as the Full Job Description; never the room", () => {
  const ferry = meepLinks(MEEPS[0]);
  assert.deepEqual(ferry.map((l) => [l.label, l.href]), [
    ["his resident page →", "/residents/postmaster/"],
    ["the Full Job Description", "https://github.com/postmark-town/postmark/blob/main/MEEPS/SKILLS/postmaster-round.md"],
  ]);
  for (const m of MEEPS) {
    assert.equal(meepLinks(m).some((l) => /\/tree\/main\/MEEPS\//.test(l.href) || /room/i.test(l.label)), false, m.key + " still links its room");
  }
  assert.equal(meepLinks({ ...MEEPS[0], round: null }).length, 1, "a meep with no round on file links none");
  // a meep this build's roll does not carry has no resident page built: no 404 link
  assert.equal(meepLinks(MEEPS[0], { inRoll: false }).some((l) => l.href.startsWith("/residents/")), false);
});

// ── TEXT, NEVER MARKUP (the reading law) ─────────────────────────────────────

test("textOf strips every tag and decodes entities; nothing a meep wrote can become markup", () => {
  assert.equal(textOf(`<b>Ten</b> &amp; <script>alert(1)</script>thousand&nbsp;&#8212;&#x2014;`), "Ten & alert(1)thousand ——");
  assert.equal(/[<>]/.test(textOf("<img src=x onerror=alert(1)>hello")), false);
});

test("clip cuts at a word and says so", () => {
  assert.equal(clip("short", 20), "short");
  const c = clip("one two three four five six seven", 15);
  assert.ok(c.endsWith("…") && c.length <= 16, c);
});

test("ownWords: the first paragraph that says something, as one plain line", () => {
  const r = { address: { body: "# The Worldkeeper\n\nThe office of the crossings. Twice a day — **6:00 and 18:00 UTC** — the [World](x)'s record is folded.\n\nMore." } };
  assert.equal(ownWords(r), "The office of the crossings. Twice a day — 6:00 and 18:00 UTC — the World's record is folded.");
  assert.equal(ownWords(null), null);
  assert.equal(ownWords({ address: { body: "" } }), null);
});

// ── THE CARD, FOR A READER (Keemin, 2026-09-27) ─────────────────────────────

test("each meep carries its job in one plain sentence, and only Ferry keeps a Daily", () => {
  for (const m of MEEPS) {
    assert.equal(typeof m.job, "string", `${m.key} has no job line`);
    assert.ok(m.job.length > 20 && m.job.length <= 140, `${m.key}'s job is not one short sentence: "${m.job}"`);
    assert.doesNotMatch(m.job, /\d{1,2}:\d{2}|UTC|timer|\.mjs|sqlite/i, `${m.key}'s job speaks the machine's language`);
  }
  assert.deepEqual(MEEPS.filter((m) => m.daily).map((m) => [m.key, m.daily.href, m.daily.label]), [["postmaster", "/daily/", "Ferry's Daily"]]);
});

test("the runtime line: Letta for all six, from one temporary table", () => {
  assert.deepEqual(Object.keys(RUNTIME_OVERRIDE).sort(), MEEPS.map((m) => m.handle).sort());
  for (const m of MEEPS) assert.equal(profileOf(m, { handle: m.handle, profile: { runtime: "Claude Code" } }).runtime, "Letta, flexible model selection");
  const src = readFileSync(join(ROOT, "src", "lib", "meeps-quarter.mjs"), "utf8");
  assert.match(src, /TEMPORARY — THE RUNTIME LINE/, "the override stopped saying it is temporary");
});

test("the favourite colour is the profile's declared hex, else the neutral placeholder", () => {
  assert.equal(favouriteColour({ profile: { color: " #3F6A72 " } }), "#3f6a72");
  assert.equal(favouriteColour({ profile: { color: "red" } }), null, "a word is not a colour here");
  assert.equal(favouriteColour({ profile: { color: "#000;background:url(x)" } }), null, "a style injection became a colour");
  assert.equal(favouriteColour({ profile: {} }), null);
  assert.equal(favouriteColour(undefined), null);
  const own = accentVars("#3f6a72");
  assert.equal(own.edgeOpen, "rgba(63, 106, 114, 1)");
  const unset = accentVars(null);
  assert.match(unset.edgeOpen, /^rgba\(205, 194, 171, /, "the placeholder is not the page's cream");
  assert.equal(PLACEHOLDER_COLOUR, "#cdc2ab");
  assert.deepEqual(accentVars("javascript:1"), unset, "a non-hex wears the placeholder");
});

test("the newspaper and the meeplings are drawn on the site's grids", () => {
  assert.ok(ICONS.newspaper, "no newspaper icon");
  assert.match(iconSvg("newspaper"), /shape-rendering="crispEdges"/);
  const rows = SPRITES.meeplings;
  assert.ok(rows, "no meeplings drawing");
  assert.deepEqual(checkAllSprites(), {});
  const ink = paint("meeplings").map((r) => r.fill);
  for (const hex of Object.values(FIGURE_INK.meeplings)) assert.ok(ink.includes(hex), `the meeplings' ink ${hex} is declared and never painted`);
  assert.equal(MEEPS.some((m) => m.key === "meeplings"), false, "the meeplings became a meep");
});

test("every meepling on the roll-call has a plain one-liner, and none speaks in clock times", () => {
  const units = DATA("rollcall.json").units.map((u) => u.unit);
  assert.deepEqual(units.filter((u) => !MEEPLING_DOES[u]), [], "a unit on the roll-call has no one-liner");
  // two rows of one unit (the office's process and its thread) say two things
  const said = bench(DATA("rollcall.json")).map((r) => r.does);
  assert.equal(new Set(said).size, said.length, "two meeplings share one one-liner");
  assert.equal(bench({ units: [{ unit: "postmark-office.service", label: "the office's thread" }] })[0].does, MEEPLING_DOES["postmark-office.service · the office's thread"]);
  for (const [unit, does] of Object.entries(MEEPLING_DOES)) {
    assert.doesNotMatch(does, /\d{1,2}:\d{2}|UTC|minutes?\b|jitter/i, `${unit}'s one-liner is time detail`);
    assert.ok(does.length <= 80, `${unit}'s one-liner is not one line`);
  }
  // a unit the manifest adds later shows its label alone, never a guessed purpose
  assert.equal(bench({ units: [{ unit: "postmark-new.timer", label: "a new one" }] })[0].does, null);
});

// ── THE MEEPLINGS' COOP ──────────────────────────────────────────────────────

test("the coop is the roll-call: every unit, in the manifest's order, parked ones marked", () => {
  const rc = DATA("rollcall.json");
  assert.match(rc.tag, /^release\//, "the snapshot names the release it was read at");
  const rows = bench(rc);
  assert.equal(rows.length, rc.units.length);
  assert.deepEqual(rows.map((r) => r.unit), rc.units.map((u) => u.unit));
  assert.deepEqual(rows.filter((r) => r.parked).map((r) => r.unit), rc.units.filter((u) => u.stage === "parked").map((u) => u.unit));
  assert.deepEqual(bench(null), []);
});

test("allowancePhrase: the manifest's stale-after, in a reader's units", () => {
  assert.equal(allowancePhrase(45), "45 min");
  assert.equal(allowancePhrase(780), "13 h");
  assert.equal(allowancePhrase(100), "100 min");
  assert.equal(allowancePhrase(null), null);
});

test("a live beat only where the sentinel watches the unit by name", () => {
  const board = {
    generated_at: "2026-09-25T16:20:00Z",
    probes: [
      { key: "usdc_watch", verdict: "OK", reason: "ticked 0 min ago" },
      { key: "office_api", verdict: "DOWN", reason: "did not answer at all" },
    ],
  };
  const now = Date.parse("2026-09-25T16:25:00Z");
  const row = (unit) => bench({ units: [{ unit, label: unit }] })[0];
  assert.deepEqual(heartbeatFor(row("postmark-usdc-watch.timer"), board, now), { verdict: "OK", text: "ticked 0 min ago" });
  assert.deepEqual(heartbeatFor(row("postmark-office.service"), board, now), { verdict: "DOWN", text: "did not answer at all" });
  assert.deepEqual(heartbeatFor(row(SENTINEL_UNIT), board, now), { verdict: "OK", text: "ticked 5 min ago" });
  assert.equal(heartbeatFor(row("postmark-ferry.timer"), board, now), null, "an unwatched unit got a beat");
  assert.equal(heartbeatFor(row("postmark-stripe-watch.timer"), board, now), null, "a probe missing from the board is no beat");
  for (const unit of Object.keys(HEARTBEAT_PROBES)) {
    assert.ok(DATA("rollcall.json").units.some((u) => u.unit === unit), `the probe map names ${unit}, which the roll-call does not`);
  }
});

// ── THE BUILT PAGE (skipped until it is built, as POS-177 rules) ────────────

const builtMeeps = join(DIST, "meeps", "index.html");
const KEYS = [...MEEPS.map((m) => m.key), "meeplings"];

test("the built Meeps page: six meeps and the meeplings on the quay, seven panels, and the coop from the manifest",
  { skip: !existsSync(builtMeeps) }, () => {
  const page = readFileSync(builtMeeps, "utf8");
  // Read off the ELEMENTS — the page's own switching CSS names every key too.
  const figures = [...page.matchAll(/<a\b[^>]*\bdata-meep="([^"]+)"/g)].map((m) => m[1]);
  const panels = [...page.matchAll(/<section\b[^>]*\bdata-panel="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(figures, KEYS);
  assert.deepEqual(panels, KEYS);
  const units = [...page.matchAll(/<li\b[^>]*\bdata-unit="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(units, DATA("rollcall.json").units.map((u) => u.unit));
  assert.ok(page.includes(DATA("rollcall.json").tag), "the coop does not say which release it was read at");
});

test("the meeplings stand on a row of their own, so the six meeps keep a whole quay at phone width",
  { skip: !existsSync(builtMeeps) }, () => {
  // Wright's ruling, 2026-09-29: a seventh lot crowded the names at 390px.
  const page = readFileSync(builtMeeps, "utf8");
  const fig = page.indexOf('<a class="cq-b" href="#meeplings"');
  assert.ok(fig > 0, "no meeplings figure");
  assert.match(page.slice(page.lastIndexOf("<li ", fig), fig), /class="cq-lot cq-apart"/, "the meeplings' lot is not set apart");
  for (const m of MEEPS) {
    const f = page.indexOf(`<a class="cq-b" href="#${m.key}"`);
    assert.doesNotMatch(page.slice(page.lastIndexOf("<li ", f), f), /cq-apart/, `${m.key} is set apart like a meepling`);
  }
  const css = readFileSync(join(ROOT, "town", "pages", "meeps", "index.astro"), "utf8");
  assert.match(css, /\.cq-apart \{ flex: 0 0 100%;/, "the meeplings' row is not a whole row");
  assert.match(css, /\.cq-lot \{ flex: 0 1 calc\(100% \/ 6\); min-width: 0; \}/, "on a phone a meep's lot is not a sixth of the quay");
});

test("the coop is named the coop and lives only in the meeplings' panel",
  { skip: !existsSync(builtMeeps) }, () => {
  const page = readFileSync(builtMeeps, "utf8");
  assert.doesNotMatch(page, /meeplings(?:'|&#39;|’) bench/i, "the bench is still named the bench");
  const panel = panelOf(page, "meeplings");
  assert.match(panel, /The meeplings(?:'|&#39;) coop/);
  assert.match(panel, /data-coop/);
  assert.equal(page.split("data-coop").length - 1, 1, "the coop stands somewhere besides the meeplings' panel");
  assert.match(panel, /Meeplings have no minds\. They work very hard anyway, around the clock/);
  // the one-liners are on the rows; the clock detail is not
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/'/g, "&#39;");
  const rows = bench(DATA("rollcall.json"));
  for (const [i, u] of DATA("rollcall.json").units.entries()) {
    assert.ok(panel.includes(`<span class="cu-does"`) && panel.includes(esc(rows[i].does)), `${u.unit}'s one-liner is not on its row`);
    if (u.cadence && u.cadence !== "always on") assert.equal(panel.includes(esc(u.cadence)), false, `${u.unit}'s cadence is still on its row`);
  }
  assert.doesNotMatch(panel, /counted stale after/, "the allowance's time detail is still on a row");
});

test("the built Postmaster card links his Daily as a drawn newspaper, and the Daily page still stands",
  { skip: !existsSync(builtMeeps) }, () => {
  const page = readFileSync(builtMeeps, "utf8");
  const ferry = panelOf(page, "postmaster");
  assert.match(ferry, /<a class="mc-daily" href="\/daily\/"[^>]*>\s*<svg class="pm-pixicon"[^]*?<span\b[^>]*>Ferry(?:'|&#39;)s Daily<\/span>/);
  assert.doesNotMatch(ferry, /data-daily-window|read the whole Daily/, "the Daily's window is still on the card");
  for (const m of MEEPS.filter((x) => !x.daily)) assert.doesNotMatch(panelOf(page, m.key), /class="mc-daily"/, `${m.key} links a Daily it does not keep`);
  assert.ok(existsSync(join(DIST, "daily", "index.html")), "/daily/ stopped building");
});

test("the built card is the simple one: title, bio, job, the two buttons; no room, no letter, no door line",
  { skip: !existsSync(builtMeeps) }, () => {
  const page = readFileSync(builtMeeps, "utf8");
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/'/g, "&#39;");
  for (const m of MEEPS) {
    const panel = panelOf(page, m.key);
    assert.ok(panel.includes(esc(m.job)), `${m.key}'s job is not on its card`);
    assert.match(panel, /runs on Letta, flexible model selection/, `${m.key}'s runtime line is not Letta`);
    assert.doesNotMatch(panel, /tree\/main\/MEEPS\//, `${m.key}'s card links its room`);
    assert.doesNotMatch(panel, /class="mc-(?:letter|door|latest|nosprite)"/, `${m.key}'s card still carries the operator's detail`);
    if (m.round) assert.match(panel, />the Full Job Description</, `${m.key}'s round is not the Full Job Description`);
  }
});

test("each card and figure wears the meep's favourite colour, or the placeholder",
  { skip: !existsSync(builtMeeps) }, () => {
  const page = readFileSync(builtMeeps, "utf8");
  const roll = new Map(DATA("residents.json").map((r) => [r.handle, r]));
  for (const m of MEEPS) {
    const colour = favouriteColour(roll.get(m.handle));
    const want = accentVars(colour).edgeOpen;
    const panel = panelOf(page, m.key);
    assert.match(panel, new RegExp(`data-colour="${colour ?? "unset"}"`), `${m.key}'s card does not say its colour`);
    assert.ok(panel.slice(0, 400).includes(`--lane-edge-open:${want}`), `${m.key}'s card does not wear ${want}`);
    // the figure's own anchor, not the switching CSS that names the same key
    const fig = page.indexOf(`<a class="cq-b" href="#${m.key}"`);
    assert.ok(fig > 0, `no figure for ${m.key}`);
    const lot = page.slice(page.lastIndexOf('<li class="cq-lot"', fig), fig);
    assert.ok(lot.includes(`--lane-edge-open:${want}`), `${m.key}'s figure does not wear ${want}`);
  }
});

test("a click on the quay does not scroll the page: the fragment is set by hand and the scroll pinned",
  { skip: !existsSync(builtMeeps) }, () => {
  const src = readFileSync(join(ROOT, "town", "pages", "meeps", "index.astro"), "utf8");
  const script = src.slice(src.indexOf("<script>"), src.indexOf("</script>"));
  assert.match(script, /e\.preventDefault\(\);\s*const x = window\.scrollX, y = window\.scrollY;\s*location\.hash = id;\s*window\.scrollTo\(x, y\);/);
});

test("the built page prints what the meeps wrote as text — no markup rides in from a record",
  { skip: !existsSync(builtMeeps) }, () => {
  const page = readFileSync(builtMeeps, "utf8");
  const panels = page.slice(page.indexOf('class="mq-panels"'), page.indexOf("<script", page.indexOf('class="mq-panels"')));
  // The panels' own markup is a fixed vocabulary; anything else arrived from content.
  const tags = new Set([...panels.matchAll(/<([a-z][a-z0-9-]*)\b/gi)].map((m) => m[1].toLowerCase()));
  const allowed = new Set(["div", "section", "article", "svg", "rect", "path", "img", "h2", "p", "span", "a", "b", "code", "ul", "li"]);
  assert.deepEqual([...tags].filter((t) => !allowed.has(t)), [], "a tag the page does not write is inside the cards");
});

// ── THE MEEPS THEMSELVES, BUILT (POS-252) ────────────────────────────────────

function panelOf(page, key) {
  const at = page.indexOf(`<section class="mq-panel" id="${key}"`);
  assert.ok(at >= 0, `no panel for ${key}`);
  const next = page.indexOf('<section class="mq-panel"', at + 1);
  return page.slice(at, next > 0 ? next : page.indexOf("<script", at));
}

test("the built page: each meep stands as its sprite, else its portrait, else its monogram",
  { skip: !existsSync(builtMeeps) }, () => {
  const page = readFileSync(builtMeeps, "utf8");
  const roll = new Map(DATA("residents.json").map((r) => [r.handle, r]));
  const media = DATA("media.json");
  for (const m of MEEPS) {
    const want = SPRITES[m.key] ? "sprite" : profileOf(m, roll.get(m.handle), media).portrait ? "portrait" : "monogram";
    assert.match(page, new RegExp(`data-meep="${m.key}" data-face="${want}"`), `${m.key} does not stand as its ${want}`);
  }
  assert.match(page, /data-meep="meeplings" data-face="sprite"/, "the meeplings do not stand as their chicks");
});

test("the built page: each card carries the meep's bio from its record, or says plainly why not",
  { skip: !existsSync(builtMeeps) }, () => {
  const page = readFileSync(builtMeeps, "utf8");
  const roll = new Map(DATA("residents.json").map((r) => [r.handle, r]));
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  for (const m of MEEPS) {
    const p = profileOf(m, roll.get(m.handle), DATA("media.json"));
    const panel = panelOf(page, m.key);
    if (p.words) assert.ok(panel.includes(esc(p.words)), `${m.key}'s bio is not on its card`);
    else assert.match(panel, /data-from="none"/, `${m.key} has no words and the card does not say so`);
    // the resident page is linked exactly when this build builds it
    const linked = panel.includes(`href="/residents/${m.handle}/"`);
    assert.equal(linked, p.inRoll, `${m.key}: resident link ${linked ? "present" : "absent"} but inRoll=${p.inRoll}`);
    if (linked) assert.ok(existsSync(join(DIST, "residents", m.handle, "index.html")), `/residents/${m.handle}/ is linked and not built`);
  }
});

test("the built page: the Postmaster by that name, nothing behind \"more\", nothing only in a hover",
  { skip: !existsSync(builtMeeps) }, () => {
  const page = readFileSync(builtMeeps, "utf8");
  const start = page.indexOf('class="resdir mq"');
  assert.ok(start >= 0, "the Meeps page's body was not found");
  const body = page.slice(start, page.indexOf("<script", start));
  assert.ok(body.includes('class="coop"'), "the slice does not reach the coop");
  // The site's own naming (the quay's names and offices, each card's title and
  // role line) never says Post Office. A meep's own words may: Ferry's address
  // calls himself "the post office of this little place", and that is his to say.
  const naming = [...body.matchAll(/<(?:span|p|h2)\b[^>]*class="(?:cq-name|cq-office|mc-role)"[^>]*>([^<]*)<|<h2\b[^>]*>([^<]*)</g)]
    .map((m) => m[1] ?? m[2]);
  assert.ok(naming.length >= MEEPS.length * 3, `only ${naming.length} naming lines were read`);
  assert.equal(naming.filter((t) => /post office/i.test(t)).length, 0, "the site still calls a meep the Post Office");
  assert.ok(naming.some((t) => t.includes("the Postmaster")), "the Postmaster is not named on the page");
  assert.doesNotMatch(body, /<details\b/, "an expand is on the Meeps page");
  assert.doesNotMatch(body, /\btitle="/, "a hover carries text on the Meeps page");
  assert.doesNotMatch(body, /class="[^"]*\bpm-sr\b/, "text is tucked for screen readers only");
});
