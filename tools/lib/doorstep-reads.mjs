// doorstep-reads.mjs — every resident's doorstep from the office, in bulk where
// the office has the bulk read, one by one where it does not (2026-10-13).
//
// extract-town.mjs asked `GET /doorstep/<handle>` once per resident: 259
// requests a pass on the box. The office now answers `GET /doorsteps?handles=`
// with up to 25 at once, each exactly what the single door answers a keyless
// caller, and null where that door says 404. An older office has no such door
// (it answers 404, "no such door"), and then every doorstep is read singly, as
// before. A bulk read that fails any other way falls back to single reads for
// that chunk only.
//
// Each answer is returned with the moment it arrived: the clock is read once
// per response, immediately after the body parses. That is the only true
// answer-time the file can carry, because the office stamps its bundle with a
// commit sha rather than a time. A failed handle carries its reason instead,
// and the caller keeps that resident's previous file.

export const DOORSTEPS_PER_READ = 25;

const HEADERS = { "user-agent": "starforge-atelier-extractor", accept: "application/json" };

/** One doorstep from the single door: `{ body, fetchedAt }`, or a throw naming why not. */
export async function readDoorstep(handle, { apiBase, fetchImpl = fetch, now = () => new Date().toISOString() }) {
  const res = await fetchImpl(`${apiBase}/doorstep/${handle}`, { headers: HEADERS, signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.json();
  if (!body || typeof body !== "object" || body.handle !== handle) {
    throw new Error(`the door answered for "${body?.handle}", not "${handle}"`);
  }
  return { body, fetchedAt: now() };
}

/**
 * Every named doorstep: `{ doorsteps: Map handle → { body, fetchedAt } | { error }, inBulk }`,
 * where `inBulk` counts the handles the office's bulk read answered.
 */
export async function readDoorsteps(handles, { apiBase, fetchImpl = fetch, now = () => new Date().toISOString(), per = DOORSTEPS_PER_READ } = {}) {
  const doorsteps = new Map();
  let bulk = true;
  let inBulk = 0;
  const single = async (handle) => {
    try { doorsteps.set(handle, await readDoorstep(handle, { apiBase, fetchImpl, now })); }
    catch (e) { doorsteps.set(handle, { error: e.message }); }
  };
  for (let i = 0; i < handles.length; i += per) {
    const chunk = handles.slice(i, i + per);
    let answered = null;
    if (bulk) {
      try {
        const res = await fetchImpl(`${apiBase}/doorsteps?handles=${chunk.join(",")}`, { headers: HEADERS, signal: AbortSignal.timeout(60000) });
        if (res.status === 404) bulk = false; // an office with no bulk door
        else if (res.ok) {
          const body = await res.json();
          const at = now();
          if (Array.isArray(body?.doorsteps) && body.doorsteps.length === chunk.length
              && body.doorsteps.every((d, j) => d?.handle === chunk[j])) answered = { rows: body.doorsteps, at };
        }
      } catch { /* this chunk is read singly */ }
    }
    if (!answered) { for (const handle of chunk) await single(handle); continue; }
    inBulk += chunk.length;
    for (const { handle, doorstep } of answered.rows) {
      if (!doorstep) doorsteps.set(handle, { error: "HTTP 404" });
      else if (doorstep.handle !== handle) doorsteps.set(handle, { error: `the door answered for "${doorstep.handle}", not "${handle}"` });
      else doorsteps.set(handle, { body: doorstep, fetchedAt: answered.at });
    }
  }
  return { doorsteps, inBulk };
}
