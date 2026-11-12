// sentinel-alert.test.mjs - the header's alert glyph is held to its own law.
//
//   node --test test/sentinel-alert.test.mjs
//
// THE LAW: the glyph appears when, and only when, the town's own watchman says
// something is bad; and a missing watchman is silence, never an alarm and never
// a throw. The founder asked for the glyph on 2026-09-17 after postmark.town
// served a 134-resident town for five minutes behind a fourteen-green board.
//
// The three falsifiers the brief named are the first three tests. The fixture
// board is the SHAPE THE BOX ACTUALLY PUBLISHES, copied from
// /srv/postmark-sentinel/status.json at 2026-09-17T08:30:35Z - `schema`,
// `generated_at`, `status`, `summary`, `headline`, `alerting`, `counts`,
// `probes[{key,label,kind,verdict,reason}]`, `published_at` - not a shape
// invented here. An invented shape is how a stub passes while prod fails.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { alertFromBoard, parseBoard, REBAKE_LINE, SENTINEL_BAD } from "../src/lib/sentinel-alert.mjs";

const LAYOUT = new URL("../src/layouts/PostmarkLayout.astro", import.meta.url);

/** The live board, trimmed to four probes, verdicts as served. */
const liveBoard = (probes) => ({
  schema: 1,
  generated_at: "2026-09-17T08:30:35.044Z",
  status: "OK",
  summary: "14 green. 1 parked (see the board).",
  headline: "OK \u00b7 14 green. 1 parked (see the board). (2026-09-17T08:30:35.044Z)",
  alerting: { channel: "discord", configured: true, notes: [] },
  counts: { OK: 14, DOWN: 0, STALE: 0, INFO: 1, UNKNOWN: 0 },
  probes,
  published_at: "/srv/postmark-sentinel/status.json",
});

const OK_PROBES = [
  { key: "site_home", label: "postmark.town", kind: "up", verdict: "OK", reason: "HTTP 200", url: "https://postmark.town/" },
  { key: "dev_site", label: "dev.postmark.town", kind: "up", verdict: "INFO", reason: "302 to the Cloudflare Access login \u2014 its healthy shape, gated as designed", url: "https://dev.postmark.town/" },
  { key: "workflow_read", label: "the site's workflow conclusions", kind: "workflow", verdict: "UNKNOWN", reason: "GitHub did not answer: socket hang up" },
  { key: "usdc_watch", label: "the usdc-watch timer", kind: "watcher", verdict: "OK", reason: "ticked 0 min ago" },
];

test("ONE DOWN PROBE: the glyph shows, and the popover carries the board's headline and that probe's own words", () => {
  const board = liveBoard([
    ...OK_PROBES,
    {
      key: "site_refresh",
      label: "the box's site refresh",
      kind: "refresh",
      verdict: "DOWN",
      reason: "the last refresh failed: fetch-town.mjs tripped",
      detail: "SNAPSHOT SHORT \u2014 residents.json keeps 134 rows; the checkout has 182 households; 48 doors are missing",
    },
  ]);
  board.status = "DOWN";
  board.headline = "DOWN \u00b7 1 down, 0 stale, 13 green. 1 parked (see the board). (2026-09-17T08:30:35.044Z)";

  const view = alertFromBoard(board);
  assert.equal(view.show, true, "a DOWN probe must raise the glyph");
  assert.equal(view.status, "DOWN");
  assert.match(view.headline, /1 down, 0 stale, 13 green/);
  assert.equal(view.rows.length, 1, "only the bad probe is listed \u2014 the popover is not the whole board");
  assert.equal(view.rows[0].label, "the box's site refresh");
  assert.match(view.rows[0].detail, /48 doors are missing/, "the refresh's own detail is what the founder reads, not the word 'failed'");
  assert.equal(view.rebake, REBAKE_LINE);
  assert.match(view.rebake, /rebake at :10 and :40/);
});

test("A STALE PROBE counts as bad too \u2014 the set is the sentinel's, copied not widened", () => {
  const view = alertFromBoard(liveBoard([
    ...OK_PROBES,
    { key: "stripe_watch", label: "the stripe-watch timer", kind: "watcher", verdict: "STALE", reason: "last wrote its state 91 min ago against a 15-min cadence" },
  ]));
  assert.equal(view.show, true);
  assert.deepEqual([...SENTINEL_BAD].sort(), ["DOWN", "STALE"],
    "site-sentinel.mjs declares BAD = new Set([\"DOWN\", \"STALE\"]) and there is no FAILED verdict; if that file grows a third, add it HERE and the glyph keeps agreeing with Discord");
});

test("AN ALL-GREEN BOARD renders nothing \u2014 INFO and UNKNOWN are not outages", () => {
  const view = alertFromBoard(liveBoard(OK_PROBES));
  assert.equal(view.show, false, "the board that was live at 08:30Z must raise nothing");
  assert.deepEqual(view.rows, []);
  // and the reason it must not: the sentinel's own alert machine does not page
  // on either verdict, so a glyph that did would disagree with Discord.
  assert.ok(OK_PROBES.some((p) => p.verdict === "INFO"), "the fixture HAS an INFO probe, or this proves nothing");
  assert.ok(OK_PROBES.some((p) => p.verdict === "UNKNOWN"), "and an UNKNOWN one");
});

test("A 404 / NO BOARD / A BROKEN BOARD all render nothing, and none of them throws", () => {
  for (const raw of [null, undefined, "", "   ", "not json at all", "[1,2,3]", "null", "42", '"a string"']) {
    const parsed = parseBoard(raw);
    const view = alertFromBoard(parsed);
    assert.equal(view.show, false, `must stay silent for: ${JSON.stringify(raw)}`);
  }
  // a well-formed board with no probes array at all - an older or truncated write
  assert.equal(alertFromBoard(parseBoard(JSON.stringify({ schema: 1, status: "OK" }))).show, false);
  assert.equal(alertFromBoard(parseBoard(JSON.stringify({ probes: "soon" }))).show, false);
  // and junk INSIDE the probes array does not take the glyph down with it
  const mixed = alertFromBoard(liveBoard([null, 7, "x", { verdict: "DOWN", key: "site_home", reason: "HTTP 503" }]));
  assert.equal(mixed.show, true);
  assert.equal(mixed.rows.length, 1);
  assert.equal(mixed.rows[0].label, "site_home", "a probe with no label falls back to its key rather than rendering 'undefined'");
});

test("`since` is shown when the board carries it and omitted when it does not", () => {
  const withSince = alertFromBoard(
    liveBoard([{ key: "site_home", label: "postmark.town", verdict: "DOWN", reason: "HTTP 503", since: "2026-09-17T06:30:35.044Z" }]),
    { nowMs: Date.parse("2026-09-17T08:30:35.044Z") },
  );
  assert.equal(withSince.rows[0].age, "2 h", "two hours of outage reads as two hours");
  const without = alertFromBoard(liveBoard([{ key: "site_home", label: "postmark.town", verdict: "DOWN", reason: "HTTP 503" }]));
  assert.equal(without.rows[0].age, null,
    "TODAY'S BOARD CARRIES NO `since` \u2014 the sentinel keeps a probe's onset in its own state file, not on the published board. The popover must omit the age rather than invent one; most reasons say it in prose (\"ticked 8 min ago\").");
});

// ---------------------------------------------------------------------------
// source pins on the half that needs a browser to run
// ---------------------------------------------------------------------------

test("the layout's glyph is HIDDEN in the markup and revealed only by the script \u2014 a source pin, labelled as one", () => {
  const src = readFileSync(LAYOUT, "utf8");
  assert.match(src, /<div class="pm-alert" data-pm-alert data-pm-alert-origin=\{P\} hidden>/, "hidden in the HTML, so a page with no script and no board shows nothing");
  assert.match(src, /wrap\.hidden = false;/, "and the only thing that reveals it is the script");
  // the reveal is the LAST statement of the success path: a throw between the
  // fetch and the paint must leave the glyph hidden, not half-filled.
  const script = src.slice(src.indexOf("THE SENTINEL'S GLYPH"));
  assert.ok(script.indexOf("wrap.hidden = false;") > script.indexOf("footEl.textContent = view.rebake;"),
    "the glyph is revealed only after the popover is filled");
});

test("the layout reads the sentinel's own published board, and fails to console.debug and nothing louder", () => {
  const src = readFileSync(LAYOUT, "utf8");
  assert.match(src, /data-pm-alert-origin=\{P\}/, "the origin crosses into the browser as an ATTRIBUTE");
  // POS-1004: the ONE fetch of the board lives in the shared reader (src/lib/sentinel-board.mjs), which the glyph and the
  // late-settlement notice both subscribe to; the layout hands it the origin and keeps the alert judgment.
  const reader = readFileSync(new URL("../src/lib/sentinel-board.mjs", import.meta.url), "utf8");
  assert.match(reader, /\(origin \|\| ""\) \+ BOARD_PATH/, "the town's board, at the town's origin \u2014 which keeps the harbor's mirrored vhost reading the TOWN's board");
  assert.match(reader, /export const BOARD_PATH = "\/ops\/sentinel\.json"/);
  assert.match(src, /readBoardEvery\(origin, paint\)/, "the glyph reads the board through the shared reader, not a second fetch");
  assert.ok(!/fetch\(origin/.test(src), "the layout makes no board fetch of its own");
  // THE BUG THIS LINE EXISTS FOR, found by the rendered check and by nothing
  // else: the first cut wrote `fetch(`${P}/ops/sentinel.json`)` INSIDE the
  // client script. `P` is Astro frontmatter and does not cross into a browser
  // module, so every page threw `P is not defined`, the glyph never appeared,
  // and every source pin above passed because every string it looked for was
  // there. A server variable interpolated into a client script is the class.
  const clientScript = src.slice(src.indexOf("THE SENTINEL'S GLYPH"), src.indexOf("The notification bell"));
  assert.ok(!/\$\{P\}/.test(clientScript), "no frontmatter variable may be interpolated into the client script");
  assert.match(reader, /cache: "no-store"/, "no-store: the board is published with Cache-Control: no-cache and a stale board is a wrong alarm");
  const script = src.slice(src.indexOf("THE SENTINEL'S GLYPH"), src.indexOf("The notification bell"));
  assert.ok(script.includes("console.debug"), "the failure paths speak at debug");
  for (const loud of ["console.warn", "console.error", "console.log", "alert("]) {
    assert.ok(!script.includes(loud), `nothing in the glyph's script may speak at ${loud} \u2014 a dev build has no sentinel and must be quiet`);
  }
  assert.match(src, /@\/lib\/sentinel-alert\.mjs/, "the decision comes from the module this file falsifies, not from a copy in the layout");
});

test("the popover is built with textContent, never innerHTML \u2014 probe reasons are prose, not markup", () => {
  const src = readFileSync(LAYOUT, "utf8");
  const script = src.slice(src.indexOf("THE SENTINEL'S GLYPH"), src.indexOf("The notification bell"));
  assert.ok(!script.includes("innerHTML"), "a probe's reason and a refresh report's detail both come off the box as free text");
  assert.ok(script.includes("textContent"));
});

test("hover, keyboard focus AND tap all open it \u2014 touch has no hover", () => {
  const src = readFileSync(LAYOUT, "utf8");
  const script = src.slice(src.indexOf("THE SENTINEL'S GLYPH"), src.indexOf("The notification bell"));
  assert.match(script, /addEventListener\("click"/, "tap and click");
  assert.match(script, /addEventListener\("pointerenter"/, "hover, on a mouse");
  assert.match(script, /e\.pointerType === "mouse"/, "and ONLY on a mouse, or a tap opens on enter and closes on click in one gesture");
  assert.match(script, /addEventListener\("focusin"/, "keyboard");
  assert.match(script, /aria-expanded/, "and the button says which state it is in");
});
