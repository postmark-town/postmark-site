// sentinel-board.mjs — the watchman's published board, read ONCE per page, and the late-settlement notice's one judgment (POS-1004).
//
// Darko, 2026-11-11 16:32 EST: residents wait an ambiguous time after the advertised settlement hours (06:00 and 18:00 UTC), and
// he wants "some kind of like temporary exclamation point ... on the site, like an alarm for the settlement being delayed."
// RULED, Darko 20:08 EST: "Yes, a small notice on the World page and the town's front page, cleared automatically when the
// settlement lands". Wright's 2026-11-12 02:14Z build approval, which replaces the earlier two-state proposal:
//
//   · the `settlement` probe reads DOWN on a board no more than 20 minutes old: show the notice;
//   · anything else (OK, STALE, UNKNOWN, INFO, a missing or unreadable board or timestamp, no `settlement` probe, an old board):
//     show NOTHING. No "unconfirmed" line and no last-known latch: a stale or missing board is OUR problem and stays an operator
//     alarm, as it is today (the header glyph).
//
// "Late" means what the sentinel already means (classifySettlement in postmark-office tools/site-sentinel.mjs: an hour after the
// sweep starts with no blessing). This file measures nothing and compares no receipt or tag in the browser: it reads the verdict
// the board already carries.
//
// TWO HALVES, KEPT APART so each can be falsified without a browser:
//   · pure: `settlementNoticeFromBoard` (the judgment) and `SETTLEMENT_NOTICE_TEXT` (the words, in this one home);
//   · the reader: `readBoardEvery` — one fetch of /ops/sentinel.json per page, shared by every consumer (the header glyph and
//     the notice), on load, once a minute while the page is visible, and on return to it.

import { parseBoard } from "./sentinel-alert.mjs";

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
