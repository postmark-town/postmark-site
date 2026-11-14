// sentinel-alert.mjs - what the town's own watchman is saying, for the header.
//
// THE FOUNDER'S SENTENCE, 2026-09-17: "please have postmark sentinel notify when
// degradation like this happens and make it obvious on the site too (like an
// alert icon that you can hover to find out more)." He had just watched
// postmark.town serve a 134-resident town for five minutes while the sentinel's
// board read fourteen green.
//
// This file is the DECISION half, kept out of the layout's inline script so it
// can be falsified without a browser. The layout owns the fetch, the markup and
// the popover; this owns "is anything actually wrong, and what should it say".
//
// -- WHERE THE BAD SET COMES FROM, AND WHY IT IS NOT LONGER ------------------
//
// `tools/site-sentinel.mjs` in postmark-office declares `export const BAD = new
// Set(["DOWN", "STALE"])` and uses it for the Discord alert machine. Those are
// the two verdicts, and there is no FAILED. INFO and UNKNOWN are deliberately
// absent, quoting that file's own reasoning: "an info-only door and an
// unreadable reference are not site outages, and alarming on them teaches the
// reader to ignore the channel." The glyph must agree with Discord or the town
// has two watchmen telling it different things, so the set is copied, not
// widened. If the sentinel ever grows a third bad verdict, it belongs here too
// and the test below is where that is asserted.
export const SENTINEL_BAD = new Set(["DOWN", "STALE"]);

/** The one standing sentence, on every popover: what the reader can do about
 *  it, which is wait for the next bake. `postmark-site-refresh.timer` is
 *  `OnCalendar=*:10,40`. */
export const REBAKE_LINE = "the town's pages rebake at :10 and :40";

/**
 * A board, or null. NEVER throws: a dev build has no sentinel, a local build
 * has no sentinel, and a header that throws over a missing ops file is a worse
 * outage than the one it was built to report.
 */
export function parseBoard(text) {
  if (typeof text !== "string" || text.trim() === "") return null;
  let board;
  try {
    board = JSON.parse(text);
  } catch {
    return null;
  }
  if (board == null || typeof board !== "object" || Array.isArray(board)) return null;
  return board;
}

/** "3 min", "2 h 10 min", "4 d" - the same shape site-sentinel prints. */
export function humanAge(ms) {
  if (!Number.isFinite(ms) || ms < 0) return null;
  const min = Math.round(ms / 60_000);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return min % 60 ? `${h} h ${min % 60} min` : `${h} h`;
  return `${Math.floor(h / 24)} d`;
}

// ── THE WORDS (CORE-41) ────────────────────────────────────────────────────────────────────────────────────────────────────────
// What a resident reads for each bad probe: a short topic and one sentence, by the probe's `key`, then its `kind`, then the
// generic line. They say the CONDITION and what it means for the reader, and they carry no operator instruction, private repo,
// section, path, command or timestamp. The board's own `reason`/`detail` are never printed (see alertFromBoard); the only things
// taken out of them are the counts in COUNTS below, which are numbers a resident can use.

/** The line for a probe this file has no words for (a new probe, an unknown kind): nothing from the board is printed. */
export const GENERIC_ROW = { label: "part of the town", detail: "Part of the town isn't working as it should." };

// An entry is `{ label, detail }`, or `{ label, DOWN, STALE }` when the producer's two bad verdicts mean different things (DOWN: it
// reports a fault; STALE: it has not reported). A sentence says only what the board establishes: no cause, and no word that someone
// is already fixing it. Every lookup below is an OWN-property read (`own`): a probe whose key or kind is `constructor` or `__proto__`
// is an unknown probe, never a table hit and never a throw.
const own = (table, k) => (typeof k === "string" && Object.hasOwn(table, k) ? table[k] : undefined);

const UP = (what) => ({ label: what, detail: "It isn't loading as it should right now." });
const BY_KEY = {
  site_home: UP("the town's front page"),
  site_daily: UP("the Daily page"),
  site_world: UP("the World page"),
  site_bulletin: UP("the bulletin"),
  office_api: { label: "the town's office", detail: "It isn't answering as it should, so signing in and sending mail may not work right now." },
  site_crossing: { label: "the site's crossing", detail: "The site is showing an older crossing than the town's latest." },
  site_code: { label: "the site", detail: "The site is running older code than it should." },
  site_town_data: { label: "the town's data on the site", detail: "The site is showing older town data than the town has." },
  office_as_of: { label: "the town's records", detail: "The town's records are behind, so the newest changes may not show yet." },
  site_daily_content: { label: "Ferry's Daily", detail: "The Daily on the site isn't the latest one." },
  usdc_watch: { label: "payment checks", detail: "A background check on payments hasn't run when it should." },
  stripe_watch: { label: "payment checks", detail: "A background check on payments hasn't run when it should." },
  town_clone: { label: "the town's records", detail: "The office's copy of the town isn't in the state it should be, so the newest changes may not show yet." },
  disk_root: { label: "the server", detail: "The server is running low on space." },
  // the helper watch: DOWN is the record REPORTING a problem; STALE is the record missing, unreadable or old
  meeps: { label: "the town's helpers", DOWN: "The town's helper agents are reporting a problem.", STALE: "The watch on the town's helper agents hasn't reported in lately." },
  // the law pen: DOWN is a refused law, a held pin or a bad last run; STALE is a pen that has not run or has stopped writing
  law_pen: { label: "the town's law", DOWN: "A change to the town's law isn't taking effect right now.", STALE: "The check on the town's law hasn't reported in lately, so a recent change may not have taken effect yet." },
  // the site's own Deploy workflow (kind "workflow" is shared with the Linear handler's per-repo rows, which are operator tooling and
  // say nothing about the site: those, and any other workflow key, are unknown probes and get the generic line)
  workflow_deploy: { label: "the site's updates", detail: "The site's last automatic update didn't go through, so a recent change may not have reached it." },
  // PUBLISHED, but its build could not get N things: not a freshness probe, though its kind is "fresh"
  site_build_problems: { label: "the site's build", detail: "The site was published without everything it asked for, so some pages may be missing details." },
};
// By kind only where the kind alone is unambiguous. "workflow" and "fresh" are NOT here: each is shared by probes that mean
// different things, so a key this file does not know under them is the generic line.
const BY_KIND = {
  watcher: { label: "a background check", detail: "A background check hasn't run when it should." },
  refresh: { label: "the site's rebuild", detail: "The site isn't rebuilding as it should, so its pages may be out of date." },
  up: { label: "a page", detail: "It isn't loading as it should right now." },
};
// The counts a resident can use, read out of the operator's prose (never the prose itself). Each takes the probe's `reason` and
// `detail` text and answers a sentence, or null.
const COUNTS = {
  refresh: (s) => {
    const m = /(\d[\d,]*)\s+doors?\s+(?:is|are)\s+missing/i.exec(s);
    return m ? `${m[1]} ${m[1] === "1" ? "household's page is" : "households' pages are"} missing from the site.` : null;
  },
  site_build_problems: (s) => {
    const m = /with (\d+) problems?/i.exec(s);
    return m ? `${m[1]} ${m[1] === "1" ? "thing" : "things"} couldn't be fetched.` : null;
  },
};

/** `{ label, detail }`, in resident words, for one bad probe. Pure; never throws; never returns a board string. */
export function plainRow(p, { lateSettlement = false } = {}) {
  const key = typeof p?.key === "string" ? p.key : "";
  const kind = typeof p?.kind === "string" ? p.kind : "";
  if (key === SETTLEMENT_PROBE_KEY) {
    return { label: "the settlement", detail: lateSettlement && p.verdict === "DOWN" ? SETTLEMENT_LATE_LINE : SETTLEMENT_MAYBE_LATE_LINE };
  }
  // the refresh probe is known by its key as well as its kind, so a board that omits `kind` still gets its words
  const as = key === "site_refresh" ? "refresh" : kind;
  const base = own(BY_KEY, key) ?? own(BY_KIND, as) ?? GENERIC_ROW;
  const known = base !== GENERIC_ROW;
  const said = (typeof base.detail === "string" ? base.detail : own(base, p?.verdict)) ?? GENERIC_ROW.detail;
  const prose = `${typeof p?.reason === "string" ? p.reason : ""}\n${typeof p?.detail === "string" ? p.detail : ""}`;
  const counted = known ? (own(COUNTS, key) ?? own(COUNTS, as))?.(prose) ?? null : null;
  return { label: base.label, detail: counted ? `${said} ${counted}` : said };
}

/**
 * What the header should show for this board.
 *
 * `show: false` is the ordinary answer and must be the answer for every one of:
 * no board at all, an unparsable board, a board whose probes are missing or not
 * an array, and a board on which nothing is DOWN or STALE. The glyph exists to
 * be absent.
 *
 * `since` is read WHEN THE BOARD CARRIES IT and omitted otherwise. Today it does
 * not: the sentinel keeps a bad probe's onset in its own state file, and its
 * published probe entries carry `key/label/kind/verdict/reason` (+ `url`,
 * `workflow`, and `detail` for the refresh probe). Most reasons already say the
 * age in prose - "ticked 8 min ago", "published 3 min ago" - which is where a
 * reader gets "how long" today.
 */
export function alertFromBoard(board, { nowMs = Date.now() } = {}) {
  const none = { show: false, status: null, headline: null, rows: [], rebake: REBAKE_LINE };
  if (board == null || typeof board !== "object") return none;
  const probes = Array.isArray(board.probes) ? board.probes : null;
  if (!probes) return none;

  // A LATE SETTLEMENT IS SAID IN PLAIN WORDS (POS-1004; Darko, 2026-11-12 09:06 EST: "1004 should just be lumped into the red
  // exclamation point that already exists on the main site"). The `settlement` probe's DOWN already raises the glyph, as every DOWN
  // does; what changes is its row: under the notice's one judgment (settlementNoticeFromBoard, below) the row says
  // SETTLEMENT_LATE_LINE instead of the sentinel's operator reason. Whether the glyph shows is untouched.
  const late = settlementNoticeFromBoard(board, { nowMs }).show;
  const rows = [];
  for (const p of probes) {
    if (p == null || typeof p !== "object") continue;
    if (!SENTINEL_BAD.has(p.verdict)) continue;
    const sinceMs = typeof p.since === "number" ? p.since : Date.parse(p.since ?? "");
    // EVERY ROW IS IN RESIDENT WORDS (CORE-41; Wright, 2026-11-12: "Whoever fixes the tap gives every resident-facing reason in that
    // popover plain words, with no private repo or section named"). A probe's own `reason` and `detail` are the sentinel's operator
    // prose (they name private repos, sections, paths and commands), so they are NEVER printed: plainRow says the condition in
    // resident words by the probe's key and kind, takes only the COUNTS it recognises out of that prose, and anything it does not
    // know says the generic line. A settlement that is bad but cannot be called late (STALE, a board over BOARD_MAX_AGE_MS old, or
    // one dated ahead of a visitor's clock) says it MAY be.
    const plain = plainRow(p, { lateSettlement: late });
    rows.push({
      key: typeof p.key === "string" ? p.key : null,
      verdict: p.verdict,
      label: plain.label,
      reason: "",
      detail: plain.detail,
      age: Number.isFinite(sinceMs) ? humanAge(nowMs - sinceMs) : null,
    });
  }
  if (rows.length === 0) return none;

  // The board's own headline is the sentinel's operator summary ("DOWN · 1 down, 13 green … (see the board) (2026-…Z)"): it is
  // not printed. The popover opens with a plain count of what is not right, which is the rows below it. The rows are not all pages
  // (a disk, payment checks, the helpers, the law), so the count says "things", never "pages".
  const headline = rows.length === 1 ? "One thing isn't working as it should." : `${rows.length} things aren't working as they should.`;

  return {
    show: true,
    status: typeof board.status === "string" ? board.status : null,
    headline,
    rows,
    rebake: REBAKE_LINE,
  };
}

// ── THE LATE-SETTLEMENT NOTICE, AND THE BOARD'S ONE READER (POS-1004, part 2 of 2) ──────────────────────────────────────────
//
// Darko, 2026-11-11 16:32 EST: residents wait an ambiguous time after the advertised settlement hours (06:00 and 18:00 UTC), and
// he wants "some kind of like temporary exclamation point ... on the site, like an alarm for the settlement being delayed."
// RULED, Darko 20:08 EST: "Yes, a small notice on the World page and the town's front page, cleared automatically when the
// settlement lands". Then, 2026-11-12 09:06 EST, after the pictures: "1004 should just be lumped into the red exclamation point that
// already exists on the main site. world page version is fine". So the World page keeps its notice, and the front page has no line
// of its own: there a late settlement is the header glyph's row, in plain words (alertFromBoard, above).
// Wright's 2026-11-12 02:14Z build approval, which replaces the earlier two-state proposal:
//
//   · the `settlement` probe reads DOWN on a board no more than 20 minutes old: show the notice;
//   · anything else (OK, STALE, UNKNOWN, INFO, a missing or unreadable board or timestamp, no `settlement` probe, an old board):
//     show NOTHING. No "unconfirmed" line and no last-known latch: a stale or missing board is OUR problem and stays an operator
//     alarm, as it is today (the header glyph above).
//
// "Late" means what the sentinel already means (classifySettlement in postmark-office tools/site-sentinel.mjs: an hour after the
// sweep starts with no blessing). Nothing here measures anything or compares a receipt or tag in the browser: it reads the verdict
// the board already carries.
//
// THIS LIVES IN THIS FILE and not in a file of its own for one concrete reason: the render proof (tools/pos394-render-proof.mjs)
// builds the household pages from a code-only projection with a fixed list of the layout's imports, and a new module the layout
// imports would be missing from it (it was: the first cut failed that proof's build). The layout already imports this file.
//
// TWO HALVES, KEPT APART so each can be falsified without a browser:
//   · pure: `settlementNoticeFromBoard` (the judgment) and `SETTLEMENT_NOTICE_TEXT` (the words, in this one home);
//   · the reader: `readBoardEvery`, one fetch of /ops/sentinel.json per page, shared by every consumer on it (the header glyph on
//     layout pages, the notice on the World page), on load, once a minute while the page is visible, and on return to it.

/** The notice's words, exactly as approved. The ONE home: the World page renders this constant. */
export const SETTLEMENT_NOTICE_TEXT = "The latest World settlement is running late. It will show here as soon as it's published.";

/** The same words for the header glyph's row (alertFromBoard, above), less "here": the glyph is on the front page and every other
 *  layout page, never on the World page, which is where the settlement shows. */
export const SETTLEMENT_LATE_LINE = "The latest World settlement is running late. It will show as soon as it's published.";

/** The header mark's row when the settlement probe is bad but the board cannot say it is late: STALE, a board older than
 *  BOARD_MAX_AGE_MS, or one dated ahead of the visitor's clock. Plain words, and no claim the board cannot back. */
export const SETTLEMENT_MAYBE_LATE_LINE = "The latest World settlement may be running late. It will show as soon as it's published.";

/** A board older than this says nothing about the settlement: the watchman's own beat is the board's `generated_at`. */
export const BOARD_MAX_AGE_MS = 20 * 60 * 1000;

/** The one probe the notice reads. Another probe's DOWN never triggers it. */
export const SETTLEMENT_PROBE_KEY = "settlement";

/**
 * `{ show }` for a parsed board. `show` is true only for a readable board, no more than BOARD_MAX_AGE_MS old (and not from the
 * future), whose `settlement` probe has the verdict exactly "DOWN". Every other input is `{ show: false }`; it never throws.
 */
export function settlementNoticeFromBoard(board, { nowMs = Date.now() } = {}) {
  const hide = { show: false };
  if (board == null || typeof board !== "object" || Array.isArray(board)) return hide;
  const at = typeof board.generated_at === "string" ? Date.parse(board.generated_at) : NaN;
  if (!Number.isFinite(at)) return hide;
  const age = nowMs - at;
  if (age < 0 || age > BOARD_MAX_AGE_MS) return hide;
  const probes = Array.isArray(board.probes) ? board.probes : null;
  if (!probes) return hide;
  const probe = probes.find((p) => p != null && typeof p === "object" && p.key === SETTLEMENT_PROBE_KEY);
  return probe && probe.verdict === "DOWN" ? { show: true } : hide;
}

export const BOARD_PATH = "/ops/sentinel.json";
export const POLL_MS = 60 * 1000;

const SHARED = Symbol.for("postmark.sentinel-board.readers");

/**
 * Subscribe to the board of an origin (`""` on the town itself, the town's origin on the harbor's mirrored vhost). All
 * subscribers of one origin on one page share ONE reader and one fetch: it reads on subscribe, every `pollMs` while the page is
 * visible, and when the page returns (visibilitychange to visible, pageshow, online). `listener(board|null)` receives the parsed
 * board, or null when there is none (a failed or non-OK read, a body that is not a board); the judgment is the listener's.
 * Returns `unsubscribe`. The reader never throws and never speaks above console.debug.
 *
 * `env` is the browser's surface, injectable so a test drives a fake clock, fetch and visibility: { fetch, setInterval,
 * clearInterval, document, addEventListener }.
 */
export function readBoardEvery(origin, listener, { pollMs = POLL_MS, env = globalThis } = {}) {
  const registry = (env[SHARED] ??= new Map());
  let reader = registry.get(origin);
  if (!reader) {
    reader = { listeners: new Set(), last: undefined, timer: null, inflight: null, stop: null };
    registry.set(origin, reader);
    const visible = () => !env.document || env.document.visibilityState !== "hidden";
    const read = async () => {
      if (reader.inflight) return reader.inflight;
      reader.inflight = (async () => {
        let board = null;
        try {
          const res = await env.fetch((origin || "") + BOARD_PATH, { cache: "no-store" });
          if (res && res.ok) board = parseBoard(await res.text());
          else console.debug("pm-board: no sentinel board (" + (res && res.status) + ")");
        } catch (error) {
          console.debug("pm-board: stood down (" + (error && error.message) + ")");
        }
        reader.last = board;
        for (const l of [...reader.listeners]) { try { l(board); } catch (error) { console.debug("pm-board: a listener threw (" + (error && error.message) + ")"); } }
      })().finally(() => { reader.inflight = null; });
      return reader.inflight;
    };
    reader.read = read;
    // Each beat re-judges the board already in hand, whether or not a fetch is pending: a warning's age never waits on the network.
    const announce = () => { if (reader.last === undefined) return; for (const l of [...reader.listeners]) { try { l(reader.last); } catch (error) { console.debug("pm-board: a listener threw (" + (error && error.message) + ")"); } } };
    reader.timer = env.setInterval(() => { if (!visible()) return; announce(); read(); }, pollMs);
    const onReturn = () => { if (!visible()) return; announce(); read(); };
    env.document?.addEventListener?.("visibilitychange", onReturn);
    env.addEventListener?.("pageshow", onReturn);
    env.addEventListener?.("online", onReturn);
    reader.stop = () => {
      env.clearInterval(reader.timer);
      env.document?.removeEventListener?.("visibilitychange", onReturn);
      env.removeEventListener?.("pageshow", onReturn);
      env.removeEventListener?.("online", onReturn);
      registry.delete(origin);
    };
    reader.listeners.add(listener);
    read();
  } else {
    reader.listeners.add(listener);
    if (reader.last !== undefined) { try { listener(reader.last); } catch { /* a listener's own fault */ } }
  }
  return () => {
    reader.listeners.delete(listener);
    if (reader.listeners.size === 0) reader.stop();
  };
}
