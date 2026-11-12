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

  const rows = [];
  for (const p of probes) {
    if (p == null || typeof p !== "object") continue;
    if (!SENTINEL_BAD.has(p.verdict)) continue;
    const sinceMs = typeof p.since === "number" ? p.since : Date.parse(p.since ?? "");
    rows.push({
      key: typeof p.key === "string" ? p.key : null,
      verdict: p.verdict,
      label: typeof p.label === "string" && p.label !== "" ? p.label : (p.key ?? "a probe"),
      reason: typeof p.reason === "string" ? p.reason : "",
      // `detail` is the refresh report's own sentence, carried onto the board by
      // the office's site_refresh probe so this popover can say "48 doors are
      // missing" rather than only "failed".
      detail: typeof p.detail === "string" && p.detail !== "" ? p.detail : null,
      age: Number.isFinite(sinceMs) ? humanAge(nowMs - sinceMs) : null,
    });
  }
  if (rows.length === 0) return none;

  const headline = typeof board.headline === "string" && board.headline !== ""
    ? board.headline
    : (typeof board.summary === "string" ? board.summary : null);

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
// settlement lands". Wright's 2026-11-12 02:14Z build approval, which replaces the earlier two-state proposal:
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
//   · the reader: `readBoardEvery`, one fetch of /ops/sentinel.json per page, shared by every consumer (the header glyph and the
//     notice), on load, once a minute while the page is visible, and on return to it.

/** The notice's words, exactly as approved. The ONE home: both pages render this constant. */
export const SETTLEMENT_NOTICE_TEXT = "The latest World settlement is running late. It will show here as soon as it's published.";

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
    reader.timer = env.setInterval(() => { if (visible()) read(); }, pollMs);
    const onReturn = () => { if (visible()) read(); };
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
