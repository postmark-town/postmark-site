// events-archive-state.mjs — WHERE THE EVENT ARCHIVE LIVES BETWEEN BUILDS (CORE-174 FIX).
//
// The archive (src/lib/event-archive.mjs) keeps every event page the build has made and the evidence it holds. That only means something if the NEXT build can read what the
// last one wrote. The tracked `src/data/postmark/events.json` cannot be that place on the box: the refresh (Office deploy/site-refresh.sh `build_once`) force-checks-out and
// cleans the tree before it runs tools/fetch-town.mjs, so the tracked file is the empty committed one on every pass, and what the extractor writes is ephemeral. The same
// reason POSTMARK_LETTER_CACHE lives outside the tree. So the archive's home is a file NAMED BY THE CALLER, outside the tree: `POSTMARK_EVENTS_ARCHIVE` (tools/fetch-town.mjs,
// the way POSTMARK_LETTER_CACHE is read). Unset, nothing here runs and the ordinary bare call behaves exactly as it always did.
//
// THE FILE is `{ "version": 1, "events": <the events.json shape> }`. It is also read if it is a BARE events.json (`{ as_of, past, evidence }`), which is the BOOTSTRAP SEAM: the
// first run after the hook lands can be seeded by saving the currently published `https://postmark.town/data/events.json` to that path; without a seed, a first run starts
// from the committed snapshot plus the capped batch, and cannot recover a page the batch no longer reaches and the published file is the only place still holding.
//
// FAILURE FAILS THE PASS, NEVER A FALSE EMPTY: a file that is absent is a first run (seed from the committed snapshot); a file that EXISTS but cannot be read or is not an archive is
// "unreadable": fetchEventsArchived THROWS (the file is left untouched, it would otherwise be replaced by a batch-only archive), and so does a failed write; the throw takes the
// existing short-fetch path, so on the release channel the publisher keeps the last good release. The write is a temp file in the same directory renamed over the old one, so a
// reader never sees half a file.

import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export const ARCHIVE_VERSION = 1;

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
/** the events.json shape the site reads: `past.events` an array and `evidence` an object */
const isEventsShape = (v) => isObj(v) && isObj(v.past) && Array.isArray(v.past.events) && isObj(v.evidence);

/**
 * @returns {{ state: "unset"|"none"|"ok"|"unreadable", events?: object, reason?: string }}
 *   unset      no path given: the caller does nothing
 *   none       a path with no file yet: a first run
 *   ok         the archived events (events.json shape)
 *   unreadable the file exists but could not be read, parsed, or is not an archive: never overwritten
 */
export function readEventsArchive(path) {
  if (!path) return { state: "unset" };
  if (!existsSync(path)) return { state: "none" };
  try {
    const body = JSON.parse(readFileSync(path, "utf8"));
    const events = isObj(body) && body.version === ARCHIVE_VERSION && isEventsShape(body.events) ? body.events : isEventsShape(body) ? body : null;
    return events ? { state: "ok", events } : { state: "unreadable", reason: "it is not an events archive (version 1) or an events.json" };
  } catch (error) {
    return { state: "unreadable", reason: String(error?.message ?? error).slice(0, 160) };
  }
}

/** Writes the archive atomically (a temp file beside it, renamed over it). @returns {{ ok: true } | { ok: false, reason: string }} */
export function writeEventsArchive(path, events) {
  if (!path) return { ok: false, reason: "no path" };
  const tmp = `${path}.tmp`;
  try {
    if (!isEventsShape(events)) return { ok: false, reason: "refused to write something that is not the events shape" };
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(tmp, `${JSON.stringify({ version: ARCHIVE_VERSION, events })}\n`);
    renameSync(tmp, path);
    return { ok: true };
  } catch (error) {
    try { unlinkSync(tmp); } catch { /* nothing to clean */ }
    return { ok: false, reason: String(error?.message ?? error).slice(0, 160) };
  }
}
