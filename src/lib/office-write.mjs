// office-write.mjs — the ONE way the site writes to the office: every act carries the site's header (POS-1024, POS-1028).
//
// The office files a request's route from `x-postmark-channel: web` (office src/act-provenance.mjs § routeOfRequest; channel.mjs): with it, an
// act the human takes on the site reads "by <House>'s human for <resident>", and the human's own log is whole. Without it the same act files
// as the resident's own, by the REST API. It is honesty machinery, never a lock: the office reads it to SAY the route, never to grant or deny.
//
// Darko, 2026-11-13 09:07 EST: "I'd much rather we keep writes unified and update the existing write path". So the site has no second write
// path: the Hearth's acts, the RSVP, the compose page's letter, the pot stake, the ballot stake and the World page's acts all send what this
// file builds. A page that cannot import a module (an `is:inline` script, like the fund page's) writes the same header by name, and
// test/office-write.test.mjs holds every office write in the site to it.

import { APEX_PATH } from "./world-cockpit-door.mjs";

/** The header, and its one value. */
export const CHANNEL_HEADER = "x-postmark-channel";
export const CHANNEL_WEB = "web";

/** The headers of a site write: JSON both ways, the site's channel, and the reader's bearer when there is one. */
export function siteWriteHeaders(token, extra = {}) {
  const h = { accept: "application/json", "content-type": "application/json", [CHANNEL_HEADER]: CHANNEL_WEB, ...extra };
  if (token) h.authorization = `Bearer ${token}`;
  return h;
}

/** The three doors' web twins: the same code an agent's MCP call runs (office src/server.mjs § POST /household, /world/apex, /town/apex). The world
 * door's path has one speller in the site, world-cockpit-door.mjs (its test, "THE CLASS: one place spells the apex's path"), so it is taken from there. */
export const DOOR_PATHS = Object.freeze({ household: "/household", world: APEX_PATH, town: "/town/apex" });

/**
 * One act through a door's web twin, as the site: `{ do, args }` exactly as an agent sends it over MCP.
 * Answers `{ ok, status, body }`, or `{ ok: false, status: 0, body: null, unreachable: true }` when no answer came back (the act may or may
 * not have landed: say so, never retry blind). Never throws.
 */
export async function sendAct({ base, door, body, token, fetchImpl = globalThis.fetch }) {
  const path = DOOR_PATHS[door];
  if (!path) return { ok: false, status: 400, body: { defect: `no door named "${String(door).slice(0, 20)}"`, hint: "household, world or town" } };
  let res;
  try {
    res = await fetchImpl(`${base}${path}`, { method: "POST", headers: siteWriteHeaders(token), body: JSON.stringify(body) });
  } catch {
    return { ok: false, status: 0, body: null, unreachable: true };
  }
  let json = null;
  try { json = await res.json(); } catch { json = null; }
  return { ok: res.ok, status: res.status, body: json };
}
