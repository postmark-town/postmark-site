// fetch-town-data.mjs - map the public Postmark office API onto the site's
// existing src/data/postmark/*.json contracts.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { buildThreads, parseFrontmatter, readResidentProfiles } from "./town.mjs";

export const RESIDENT_CARD_LANES = 6;

// ── HOW MANY NAMED 404s ARE A SHED, AND HOW MANY ARE AN OUTAGE (POS-180) ────
//
// POS-166 taught the bulletin fan-out that a 404 on a slug the list named is an
// answer, not an outage, and POS-180 extends that to the residents roll. But
// the two fan-outs are not the same size, and the residents one needs a ceiling
// the bulletin one does not.
//
// The reason is #2884. `shortFetchPlan` exists because on 2026-09-17 a refused
// pass published a three-week-old 134-row snapshot as the current town. Holding
// ONE resident's row over from the last build is a shed handle or a rename —
// the town moved and the roll has not caught up. Holding HALF the roll over is
// that same #2884 wound wearing this fix's clothes: a town of held-over rows,
// published as current, with nothing refusing. The difference between the two
// is a count, so a count is where the line goes.
//
// THREE IS NOT MEASURED, AND SAYING SO IS THE POINT. Nothing records how often
// a named-entity 404 fires, because until this row ships nothing published the
// record — `problems` was assembled and console.warn'd and never served. So
// this is a first knob, set where a hand-sized number of simultaneous sheds
// still publishes and a systematic one does not, and it is deliberately a named
// constant rather than a literal so the founder can re-rule it against the
// `problems` counts this row finally makes visible.
export const MAX_NAMED_404S = 3;

export const DATA_FILES = [
  "letters.json",
  "residents.json",
  "threads.json",
  "ledger.json",
  "meeps.json",
  "bulletin.json",
  "docs.json",
  "stats.json",
  "calendar.json",
];

// -- ON THE BOX, SHORT IS FAILED (2026-09-17, postmark#2884) -----------------
//
// The instance: at 08:12:35Z the box published a 134-resident town from a
// three-week-old committed snapshot, because fetch-town.mjs warned and exited
// 0, and `deploy/site-refresh.sh` only dies on a non-zero exit. Prod served a
// town with 48 doors missing for five minutes, and only the town moving again
// mid-run ended it -- had the 07:40 tick's `quiet` verdict repeated, the short
// town would have stood until the next change to the refresh key.
//
// The distinction that makes one line of code correct in two places:
//   - OFF the box (CI, a local build, a checkout-less snapshot build) keeping
//     the committed data IS the design. `deploy/site-refresh.sh`'s own header
//     says CI builds the last-good static town. Exit 0, warn, proceed.
//   - ON the release channel -- and `deploy/site-refresh.sh` L427 is the only
//     caller that sets PUBLIC_CHANNEL=release -- the committed snapshot is a
//     REGRESSION, not a fallback. The script's own section says "A failed build
//     publishes NOTHING. The symlink still points at the last good", so a short
//     fetch has to BE a failed build there, and the last good release stays up.
//
// The next tick then retries rather than reading `quiet`: the refresh key is
// written at `deploy/site-refresh.sh` L624, inside the publish step and after
// the atomic swap, so a run that dies at L428 leaves the key at its previous
// value and the following :10/:40 tick sees the town as still moved.
export const RELEASE_CHANNEL = "release";

/**
 * What a short fetch should DO, given the channel it is running on. Pure, so a
 * falsifier drives both branches without spawning a build or an office.
 */
export function shortFetchPlan({ channel = null } = {}) {
  const refuse = channel === RELEASE_CHANNEL;
  return {
    refuse,
    exitCode: refuse ? 1 : 0,
    // The journal line the founder and the round read. On the release channel
    // it REPLACES "build may proceed", which would be false there; the two
    // measurement lines above it are untouched, because they are what say how
    // short the snapshot is and who is missing.
    line: refuse
      ? "WARN fetch-town: REFUSING to build from the committed snapshot on the release channel - the last good release stays published"
      : "WARN fetch-town: build may proceed from src/data/postmark/*.json",
  };
}

export function jsonText(value) {
  return JSON.stringify(value, null, 1) + "\n";
}

export function snapshotReader(dataDir) {
  return (name, fallback) => {
    const path = join(dataDir, name);
    if (!existsSync(path)) return fallback;
    return JSON.parse(readFileSync(path, "utf8"));
  };
}

function ensureArray(value, label) {
  if (!Array.isArray(value)) throw new Error(`${label} did not return an array`);
  return value;
}

function normApiBase(apiBase) {
  return apiBase.replace(/\/+$/, "");
}

// -- THE BUDGET IS TIME, AND IT IS SHARED (2026-09-17, postmark#2884) --------
//
// What this replaces, and why a count could never have worked. `apiGet` retried
// three times per call and `mapLimit` ran six lanes, so a refused pass gave up
// in fifteen seconds flat: 08:11:23 to 08:11:38 on the morning this was
// written, after which the build published a three-week-old 134-row snapshot as
// the town. Three attempts is a COUNT, and the thing on the other side is a
// CLOCK.
//
// MEASURED ON THE BOX BEFORE ANY OF THIS WAS WRITTEN, and it is not the
// office's bouncer that refused. The 429 came from nginx: zone
// `postmark_keyless`, `rate=120r/m` with `burst=240 nodelay`, keyed on the
// caller's address (/etc/nginx/conf.d/postmark-rate-limit.conf). The office's
// own bouncer logs every 429 it serves and logged none. Two consequences the
// old code could not have known:
//   - that queue's excess SURVIVES an office restart (nginx shared memory),
//     so "the office just came back, the bucket must be fresh" is false;
//   - its `Retry-After` is the CONSTANT 1 the vhost hardcodes, while the honest
//     wait when it fires is the excess over the rate -- 240 / 2 = about two
//     minutes on 09-17. The header is a FLOOR, never the answer.
//
// THE GATE is therefore one object for a whole pass:
//   - a refusal on ANY lane parks EVERY lane, because the budget the six lanes
//     are spending is one budget, and six lanes discovering that separately is
//     six times the noise for the same fact;
//   - the park is the header's wait or a doubling floor, whichever is longer,
//     capped. The floor exists because the header lies low; it stands back down
//     to one second the moment a call succeeds, which keeps the recovery at the
//     shield's own admitted rate instead of at a backoff's.
//   - what ENDS a refusal is the run's DEADLINE, not a count. A refused call
//     keeps asking until the budget is spent.
// Non-429 failures are untouched: today's three tries, today's 250 ms-per-
// attempt backoff. A 502 is not a budget, and waiting longer does not make a
// dead upstream answer.
export const DEFAULT_FETCH_TOWN_DEADLINE_MS = 180_000;

/** The run-wide fetch budget, in ms. 180 s by default: nginx's measured drain
 *  from a full queue is about 120 s (240 excess at 120 r/m), and the tail of a
 *  182-card roll admitted at the shield's own 2/s is about another 30 s. */
export function fetchTownDeadlineMs(env = process.env) {
  const raw = env?.FETCH_TOWN_DEADLINE_MS;
  if (raw == null || raw === "") return DEFAULT_FETCH_TOWN_DEADLINE_MS;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0)
    throw new Error("FETCH_TOWN_DEADLINE_MS must be a positive number of milliseconds");
  return value;
}

/**
 * One gate for a whole pass. `now` and `sleep` are injectable so a falsifier can
 * drive a real token bucket over a virtual clock in milliseconds of wall time.
 */
export function createRateGate({
  now = Date.now,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  budgetMs = fetchTownDeadlineMs(),
  maxParkMs = 60_000,
  minParkMs = 1_000,
} = {}) {
  const startedAt = now();
  const deadlineAt = startedAt + budgetMs;
  let parkedUntil = 0;
  let round = 0;      // consecutive PARKING ROUNDS, not refusals: six lanes
  let refusals = 0;   // refused in one instant are one round, not six
  let parks = 0;
  return {
    budgetMs,
    deadlineAt,
    sleep,
    now,
    expired: () => now() >= deadlineAt,
    msLeft: () => Math.max(0, deadlineAt - now()),
    stats: () => ({ refusals, parks, round, parkedUntil }),
    /** Every lane waits here before every attempt. Re-reads the park after each
     *  nap, so a lane asleep when another lane extended it stays put. */
    async hold() {
      for (let waitMs = parkedUntil - now(); waitMs > 0; waitMs = parkedUntil - now()) {
        await sleep(waitMs);
      }
    },
    /** A 429 landed. `retryAfterS` is the header, or 0/NaN when it said nothing. */
    park(retryAfterS) {
      const at = now();
      refusals += 1;
      // A refusal arriving while the park it caused is still running is the
      // tail of THIS round (the other five lanes), not a new one.
      if (at >= parkedUntil) round += 1;
      const fromHeader = Number.isFinite(retryAfterS) && retryAfterS > 0 ? retryAfterS * 1000 : 0;
      const floor = Math.min(minParkMs * 2 ** Math.max(0, round - 1), maxParkMs);
      const waitMs = Math.min(Math.max(fromHeader, floor), maxParkMs);
      const until = at + waitMs;
      if (until > parkedUntil) {
        parkedUntil = until;
        parks += 1;
      }
      return waitMs;
    },
    /** A call got through: the queue has room again, so the floor stands down. */
    succeed() {
      round = 0;
    },
  };
}

// ── THE STATUS IS A FIELD, NOT A SUBSTRING (POS-166, 2026-09-21) ────────────
//
// A 404 on ONE entry a list named is a fact about that entry; a 500 is a fact
// about the office, and only one of the two should stop a build. The caller
// could not tell them apart: the status survived only inside the message
// `GET /bulletin/<slug> failed after 3 attempts: 404 Not Found`, which
// interpolates the failing PATH into the same string — so a slug ending in
// `-404` would have made a 500 read as a 404 under any match loose enough to
// be written. This adds a field to an object every caller already receives.
// The message text, the return shape, the `retries` budget, the nap schedule
// and the 429 refusal path are all unchanged.
function httpError(status, statusText) {
  // The expression is the original one, character for character, so the message
  // is byte-identical for every status -- including the degenerate case where a
  // response carries no statusText at all.
  const error = new Error(`${status} ${statusText}`.trim());
  error.status = status;
  return error;
}

function carryStatus(error, from) {
  if (from?.status !== undefined) error.status = from.status;
  return error;
}

export async function apiGet(path, { apiBase, fetchImpl = fetch, retries = 3, timeoutMs = 15000, maxRetryAfterMs = 60_000, gate = null } = {}) {
  const base = normApiBase(apiBase);
  const nap = (ms) => (gate ? gate.sleep(ms) : new Promise((resolve) => setTimeout(resolve, ms)));
  let lastError = null;
  let hardAttempts = 0;   // the `retries` budget. Refusals do not spend it.
  for (;;) {
    if (gate) await gate.hold();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let waitMs = 250 * (hardAttempts + 1);
    let refused = false;
    try {
      const res = await fetchImpl(`${base}${path}`, { signal: controller.signal });
      clearTimeout(timer);
      if (res.status === 429) {
        // THE OFFICE SAID WHEN (2026-09-13). Its bouncer answers a 429 with
        // `retry-after` in whole seconds -- the time until one token refills for
        // this caller. Before this the retry came 250 ms later, three times,
        // and every one of them met the same empty bucket; the build then kept
        // the committed roll, which is how thirty residents lost their front
        // doors for eighteen days (postmark#2730). Wait what it said, capped.
        // 2026-09-17: and when a GATE is passed, every other lane waits too,
        // and the DEADLINE rather than the count decides when to give up --
        // because the refusal is one shared queue, not this call's bad luck.
        refused = true;
        const ra = Number(res.headers?.get?.("retry-after"));
        waitMs = Number.isFinite(ra) && ra > 0 ? Math.min(ra * 1000, maxRetryAfterMs) : Math.max(waitMs, 1000);
        if (gate) gate.park(ra);
        throw httpError(res.status, res.statusText);
      }
      if (!res.ok) throw httpError(res.status, res.statusText);
      const out = {
        body: await res.json(),
        asOf: res.headers?.get?.("x-postmark-as-of") ?? null,
      };
      if (gate) gate.succeed();
      return out;
    } catch (error) {
      clearTimeout(timer);
      lastError = error;
      if (gate && refused) {
        // The gate already holds the wait, for every lane. Keep asking until
        // the RUN's budget is spent; a count cannot outlast a queue.
        if (!gate.expired()) continue;
        const { refusals } = gate.stats();
        throw carryStatus(new Error(`GET ${path} refused: the run's ${gate.budgetMs} ms fetch budget is spent after ${refusals} refusal(s) (${lastError?.message ?? lastError})`), lastError);
      }
      hardAttempts += 1;
      if (hardAttempts >= retries) break;
      await nap(waitMs);
    }
  }
  // The WRAPPER is what a caller actually catches, so it carries the status
  // too. A field that exists on an error nobody is handed is not a field.
  throw carryStatus(new Error(`GET ${path} failed after ${retries} attempts: ${lastError?.message ?? lastError}`), lastError);
}

/** map, at most `limit` in flight at once, order preserved. The office's keyless
 *  bucket is a burst of 240 refilling at 120 a minute per caller; a roll of 165
 *  cards asked all at once spends the burst before the letters and doorsteps
 *  get their turn, and the tail is refused. A few at a time never touches it. */
export async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const lanes = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(lanes);
  return out;
}

export async function fetchAllLetterIds({ apiBase, fetchImpl, retries, gate = null, limit = 200 }) {
  const ids = [];
  for (let offset = 0; ; offset += limit) {
    const { body } = await apiGet(`/letters?limit=${limit}&offset=${offset}`, { apiBase, fetchImpl, retries, gate });
    const batch = ensureArray(body.letters, "/letters.letters");
    ids.push(...batch.map((l) => l.id).filter(Boolean));
    if (batch.length < limit) break;
  }
  return [...new Set(ids)];
}

export function mapLetter(l) {
  return {
    id: l.id,
    from: l.from,
    to: l.to,
    toList: Array.isArray(l.toList) ? l.toList : (l.to ? [l.to] : []),
    date: l.date ?? null,
    thread: l.thread ?? null,
    body: l.body ?? "",
    path: l.path ?? null,
    box: l.box ?? null,
    attachments: Array.isArray(l.attachments) ? l.attachments : [],
  };
}

/**
 * The town's whole letter corpus, from the office's own bulk door — or null.
 *
 * WHY THIS EXISTS. Until 2026-08-25 the site built its entire letters corpus
 * out of `resident.inbox`/`.outbox` full bodies, fetched from
 * `/residents/<handle>` for every resident. That was never what the address
 * card was for; the card simply happened to be the only door that carried
 * bodies in bulk, so this file used it. The office then bounded that card
 * (782 KB -> 10 KB on the worst resident) and grew the door it should have had
 * all along: `/letters?full=1`, paged.
 *
 * DUAL-MODE, BY CAPABILITY DETECTION, so neither repo's release order can break
 * the build. This function asks the new door first. Against an office that has
 * it, the answer carries bodies and this is the corpus. Against an older office
 * the `full` parameter is simply ignored — REST drops unknown query params —
 * and the answer comes back as excerpts, with no `body` key at all. That is the
 * signal: no bodies, no door, and the caller falls back to the resident-card
 * route, which still works there because that office has not bounded the card.
 *
 * Site ships first: fallback carries the build until the office lands.
 * Office ships first: the new door is already preferred. Either order is safe.
 *
 * DETECTED ON THE KEY, NOT ON THE VALUE. `Object.hasOwn(l, "body")`, never
 * `if (l.body)` — a letter with a genuinely empty body is legal (mapLetter
 * writes `l.body ?? ""`), and a truthiness test would read that real door as
 * an absent one and silently fall back forever.
 */
export async function fetchLetterCorpus({ apiBase, fetchImpl, retries, gate = null, limit = 200 } = {}) {
  const letters = [];
  for (let offset = 0; ; offset += limit) {
    const { body } = await apiGet(`/letters?full=1&limit=${limit}&offset=${offset}`, { apiBase, fetchImpl, retries, gate });
    const batch = ensureArray(body.letters, "/letters.letters");
    if (offset === 0) {
      if (!batch.length) return null;            // nothing to detect on; the fallback answers the same
      const withBody = batch.filter((l) => Object.hasOwn(l, "body")).length;
      if (withBody === 0) return null;           // an older office: no door, use the cards
      // A MIXED PAGE IS NOT A HALF-MIGRATION TO LIMP THROUGH. If some rows
      // carry bodies and others do not, this route cannot be trusted to build
      // a complete corpus, and quietly keeping the ones that had bodies would
      // publish a town missing letters nobody could name. Fall back to the
      // known-good route and say so.
      if (withBody !== batch.length) return { mixed: true, withBody, of: batch.length };
    }
    letters.push(...batch.map(mapLetter));
    // Paged on the page's own length rather than on `complete`/`next_offset`,
    // because those fields are the new door's and this loop has to survive the
    // old one too — the same idiom fetchAllLetterIds already uses.
    if (batch.length < limit) break;
  }
  // Same dedupe rule as the resident route, applied to the same ids, so the two
  // paths cannot disagree about which copy of a letter wins.
  return { letters: dedupeLetters(letters) };
}

/**
 * THE TOWN ROLL, FROM EITHER SHAPE OF THE ROSTER DOOR (2026-09-10).
 *
 * `GET /residents` served a BARE ARRAY of every resident and ignored `?limit=`
 * entirely — 28 KB today, 291 KB at ten times the town, measured on the 10x
 * load lane. The office now serves the same envelope its MCP twin has served
 * since August: `{ total, shown, complete, next_offset, residents }`, limit
 * clamped to 200.
 *
 * That means this fetch has to walk pages, and it means the OLD shape would
 * have thrown here (`ensureArray` on an object) — a loud failure, and still a
 * failure. So this reads either shape, exactly as `fetchLetterCorpus` above
 * capability-detects the bulk letter door, and for the same reason: either repo
 * may ship first, and a site build must not be the thing that decides.
 *
 * ⚑ A TRUNCATED ROLL IS THE ONE OUTCOME THAT MUST NOT PASS QUIETLY. Every
 * resident page on the site is built from a handle in this list, so a walk that
 * stopped early would publish a town with residents silently missing and no
 * error anywhere. When the door names a `total`, the assembled roll is checked
 * against it and the build refuses if they disagree.
 */
export async function fetchResidentRoll({ apiBase, fetchImpl, retries, gate = null, limit = 200 } = {}) {
  const roll = [];
  let total = null;
  for (let offset = 0; ; offset += limit) {
    const { body } = await apiGet(`/residents?limit=${limit}&offset=${offset}`, { apiBase, fetchImpl, retries, gate });
    // The pre-2026-09-10 office: one array, the whole roll, the limit ignored.
    if (Array.isArray(body)) return { roll: ensureArray(body, "/residents"), paged: false, total: body.length };
    const batch = ensureArray(body?.residents, "/residents.residents");
    if (offset === 0 && Number.isInteger(body.total)) total = body.total;
    roll.push(...batch);
    // Paged on the page's own length rather than on `complete`, the same idiom
    // fetchLetterCorpus uses — and with the same reason to distrust a flag this
    // loop may be reading from a door that does not have it.
    if (batch.length < limit) break;
  }
  if (total !== null && roll.length !== total) {
    throw new Error(`/residents: walked ${roll.length} of ${total} residents — a partial roll would publish a town with pages missing`);
  }
  return { roll, paged: true, total: total ?? roll.length };
}

/** Newest-first union by id; the inbox copy wins over an outbox one. */
function dedupeLetters(rows) {
  const byId = new Map();
  for (const letter of rows) {
    if (!letter.id) continue;
    const existing = byId.get(letter.id);
    if (!existing || (existing.box === "outbox" && letter.box === "inbox")) byId.set(letter.id, letter);
  }
  return [...byId.values()]
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "") || (a.id ?? "").localeCompare(b.id ?? ""));
}

/**
 * The corpus from the resident cards — the ROUTE OF RECORD until 2026-08-25,
 * kept as the fallback leg of the dual-mode read above.
 *
 * It still works against an office that has not bounded the address card, and
 * against one that HAS it simply returns the bounded excerpts, which is why the
 * capability detection lives on the door and not here: this function cannot
 * tell a small town from a bounded card, and must never be asked to.
 */
export function lettersFromResidents(residents) {
  const rows = [];
  for (const resident of residents) {
    for (const raw of [...(resident.inbox ?? []), ...(resident.outbox ?? [])]) rows.push(mapLetter(raw));
  }
  return dedupeLetters(rows);
}

function recipients(letter) {
  return (letter.toList?.length ? letter.toList : [letter.to]).filter(Boolean);
}

export function residentCounts(handle, letters, ledger = null, pendingOutbox = null) {
  if (Array.isArray(ledger)) {
    return {
      received: ledger.filter((e) => e.kind === "delivery" && e.to === handle).length,
      sent: ledger.filter((e) => e.kind === "delivery" && e.from === handle).length,
      pendingOutbox: pendingOutbox ?? letters.filter((l) => l.box === "outbox" && l.from === handle).length,
    };
  }
  const delivered = letters.filter((l) => l.box !== "outbox");
  return {
    received: delivered.filter((l) => recipients(l).includes(handle)).length,
    sent: delivered.filter((l) => l.from === handle).length,
    pendingOutbox: letters.filter((l) => l.box === "outbox" && l.from === handle).length,
  };
}

function flattenDoc(doc) {
  return doc ? { ...(doc.data ?? {}), body: doc.body ?? "" } : null;
}

export function mapResident(r, letters, ledger = null, profile = {}) {
  return {
    handle: r.handle,
    profile,
    address: flattenDoc(r.address),
    home: flattenDoc(r.home),
    region: flattenDoc(r.region),
    homeImages: Array.isArray(r.homeImages) ? r.homeImages : [],
    counts: residentCounts(r.handle, letters, ledger, (r.outbox ?? []).length),
    is_office: r.is_office === true,
    // ── TWO BLOCKS THE DOOR NOW ANSWERS, CARRIED WHOLE (2026-09-07) ─────────
    //
    // MCP-first: both are DERIVED at the office and passed through here without
    // reshaping, so the page renders the door's answer rather than a second
    // opinion about it. Both are `?? null` rather than defaulted to a shape,
    // because an office that predates them must reach the page as "not said"
    // and never as "none" — the exact substitution both of them exist to end.
    //
    //   window  the pane's tri-state (`hung`: true / false / null-for-could-not-
    //           look) and, only when it really hangs, its address. The site told
    //           a text reader "hasn't hung a window here yet" about a resident
    //           whose pane had hung for 27 days, because the page had no
    //           build-time fact and its client-side check is invisible to a
    //           reader that does not run scripts.
    //   marks   what this resident has MADE: published / docket / drafts_mine.
    //           Keyless here, so drafts_mine is withheld as null BY NAME — a
    //           public page cannot render somebody's sketchbook.
    window: r.window ?? null,
    marks: r.marks ?? null,
  };
}

export function buildStats({ town, metrics, residents, letters, ledger = null, snapshotStats = {} }) {
  const deliveries = metrics?.totals?.deliveries ?? town?.counts?.deliveries ?? snapshotStats.deliveries ?? 0;
  const bounces = metrics?.totals?.bounces ?? town?.counts?.bounces ?? snapshotStats.bounces ?? 0;
  // Arrival date = joined: (town-join day), NOT since: (the agent's own
  // continuity-began date — Finn's May birthdate hid his July 2 arrival from
  // this list entirely). since: is the fallback only for pre-field residents.
  // The output key stays `since` — /data/stats.json is a public contract the
  // household window panes read; only the VALUE semantics were wrong.
  const arrivals = residents
    .map((r) => ({
      handle: r.handle,
      since: r.address?.joined ?? r.address?.data?.joined ?? r.address?.since ?? r.address?.data?.since ?? null,
    }))
    .filter((a) => a.since)
    .sort((a, b) => b.since.localeCompare(a.since) || a.handle.localeCompare(b.handle));

  const latestDeliveries = Array.isArray(ledger)
    ? ledger.filter((e) => e.kind === "delivery").slice(-12).reverse()
    : letters
      .filter((l) => l.box !== "outbox")
      .slice()
      .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "") || (b.id ?? "").localeCompare(a.id ?? ""))
      .slice(0, 12)
      .map((l) => ({ kind: "delivery", date: l.date, id: l.id, from: l.from, to: l.to, thread: l.thread }));

  return {
    residents: metrics?.totals?.residents ?? town?.counts?.residents ?? residents.length,
    letters: metrics?.totals?.letters ?? town?.counts?.letters ?? letters.length,
    deliveries,
    bounces,
    threads: metrics?.totals?.threads ?? town?.counts?.threads ?? buildThreads(letters).length,
    latestDeliveries,
    latestDate: metrics?.as_of ?? snapshotStats.latestDate ?? latestDeliveries[0]?.date ?? null,
    arrivals,
  };
}

export function readMeepsFromCheckout(townRoot) {
  const meepsRoot = join(townRoot, "MEEPS");
  if (!existsSync(meepsRoot)) return null;
  const names = readdirSync(meepsRoot).sort()
    .filter((name) => !["SKILLS", "TEMPLATE"].includes(name) && existsSync(join(meepsRoot, name, "identity.md")));
  return names.map((name) => {
    const skillPath = join(meepsRoot, "SKILLS", `${name}-round.md`);
    const dailyRoot = join(meepsRoot, name, "memory", "daily");
    return {
      name,
      skill: existsSync(skillPath) ? { path: `MEEPS/SKILLS/${name}-round.md` } : null,
      dailyCount: existsSync(dailyRoot)
        ? readdirSync(dailyRoot).filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f)).length
        : 0,
    };
  });
}

export async function buildOfficeData({
  apiBase,
  dataDir,
  townRoot = null,
  fetchImpl = fetch,
  retries = 3,
  // ONE GATE FOR THE WHOLE PASS (2026-09-17). Made here rather than per call,
  // because the thing it is pacing against is one shared queue per caller
  // address: a gate per call would be six lanes each learning the same refusal.
  gate = createRateGate(),
} = {}) {
  const readSnapshot = snapshotReader(dataDir);
  const endpointGaps = [];
  const problems = [];

  const [{ body: town, asOf }, rollRes, metricsRes, bulletinListRes] = await Promise.all([
    apiGet("/town", { apiBase, fetchImpl, retries, gate }),
    fetchResidentRoll({ apiBase, fetchImpl, retries, gate }),
    apiGet("/metrics/mail", { apiBase, fetchImpl, retries, gate }),
    apiGet("/bulletin", { apiBase, fetchImpl, retries, gate }),
  ]);

  const residentHandles = rollRes.roll.map((r) => r.handle).sort();
  // WHICH ROUTE BUILT THE ROLL, in the build log — the same discipline the
  // letter corpus keeps below. A deploy that silently stopped paging is then
  // visible in the log rather than only in a resident-page count nobody is
  // watching.
  endpointGaps.push(rollRes.paged
    ? `roll read from the paged roster door (/residents?limit=&offset=): ${residentHandles.length} residents in ${Math.ceil(residentHandles.length / 200) || 1} page(s)`
    : `roll read from the pre-2026-09-10 roster door, which served the whole town in one bare array: ${residentHandles.length} residents`);
  // A FEW AT A TIME, NOT ALL AT ONCE (2026-09-13, postmark#2730). `Promise.all`
  // over the whole roll asked the office for every card in the same instant;
  // past ~240 the keyless bucket refused the rest, the build kept the committed
  // snapshot, and the /residents/ directory froze at 134 while the town grew.
  // ── A NAMED RESIDENT'S 404 IS AN ANSWER TOO (POS-180, 2026-09-21) ─────────
  //
  // The same two-reads-of-one-index shape as the bulletin fan-out below, on the
  // door that costs the most: `/residents` names the roll, `/residents/<handle>`
  // answers the card, and a handle caught mid-shed or mid-rename 404s. Before
  // this the throw escaped `mapLimit`, the build fell into fetch-town.mjs's
  // catch as "office API unavailable", and on the release channel the whole
  // site froze at the last good build over one resident. That is the 12:50Z
  // shape, one door over from the bulletin's.
  //
  // WHY A HOLE AND NOT THE BULLETIN'S ONE-LINE FILTER. `mapLimit` returns
  // POSITIONALLY — `out[i] = await fn(items[i], i)` — so the result is index-
  // aligned with `residentHandles`, and a dropped card must leave a hole that
  // is compacted with its handle still known. The bulletin's `Promise.all` maps
  // entries whose slug travels in the body, so a bare `.filter` suffices there
  // and would lose the handle here.
  // Named apart from the bulletin fan-out's own sentinel below: two Symbols in
  // one function scope, and the second `const DROPPED` is a SyntaxError rather
  // than a shadow.
  const DROPPED_CARD = Symbol("resident the roll named and the card door 404'd");
  const dropped404 = [];
  const cards = await mapLimit(residentHandles, RESIDENT_CARD_LANES, async (handle) => {
    try {
      return (await apiGet(`/residents/${encodeURIComponent(handle)}`, { apiBase, fetchImpl, retries, gate })).body;
    } catch (error) {
      if (error?.status !== 404) throw error;
      dropped404.push(handle);
      return DROPPED_CARD;
    }
  });
  // THE CEILING, AND IT REFUSES THROUGH THE EXISTING DOOR. Above the threshold
  // this throws, which lands in fetch-town.mjs's catch exactly as an unreachable
  // office does — the committed snapshot is kept, the two short-fetch
  // measurement lines print, and `shortFetchPlan` makes the release-channel
  // call. One refusal path, not a second one that could drift from it.
  if (dropped404.length > MAX_NAMED_404S) {
    throw new Error(`${dropped404.length} residents the roll named answered 404 at their card door (${dropped404.slice().sort().join(", ")}) — past the ${MAX_NAMED_404S} this build will forgive as sheds, a roll and a card door that disagree this widely is the office being wrong, not the town having moved`);
  }
  const fullResidents = cards.filter((card) => card !== DROPPED_CARD);

  // ── THE LETTER CORPUS: the bulk door first, the resident cards as fallback ──
  //
  // The cards are still fetched above, and still must be — `mapResident` below
  // needs them for everything that is not mail. What moved is only where the
  // BODIES come from. See fetchLetterCorpus for why this is capability-detected
  // rather than switched on a version, and why either repo may ship first.
  //
  // The fallback is not a degraded mode to be tolerated quietly: which route
  // built the corpus is recorded in `endpointGaps`, so a deploy that silently
  // stopped preferring the door is visible in the build log rather than only in
  // a byte count nobody is watching.
  let letters;
  let corpus = null;
  try {
    corpus = await fetchLetterCorpus({ apiBase, fetchImpl, retries, gate });
  } catch (error) {
    // A door that errors is a door that is not there, for our purposes. The
    // fallback is the known-good route and the build goes on; the reason is
    // recorded rather than swallowed.
    problems.push(`letters: the bulk door did not answer (${error?.message ?? error}); built from the resident cards instead`);
  }
  if (corpus?.mixed) {
    problems.push(`letters: the bulk door answered ${corpus.withBody} of ${corpus.of} rows with bodies — a partial answer cannot build a complete corpus, so the resident cards were used instead`);
    corpus = null;
  }
  if (corpus) {
    letters = corpus.letters;
    endpointGaps.push(`letters.json built from the office's bulk letter door (/letters?full=1): ${letters.length} letters`);
  } else {
    letters = lettersFromResidents(fullResidents);
    endpointGaps.push(`letters.json built from the resident cards: this office serves no bulk letter door (/letters?full=1 carried no bodies), which is the pre-2026-08-25 office. ${letters.length} letters`);
  }

  // ── THE MUSHY MIDDLE, MADE VISIBLE (2026-08-25) ───────────────────────────
  //
  // The cards fetched above are the office's COMPOSED reads: since the freshness
  // ladder (office src/paper-fresh.mjs) each one carries what the pen has
  // written since the office's index was last rebuilt, with every paper field
  // stamped settled / written / pending. So this lane picks the composed values
  // up with no change at all — it already asks `/residents/<handle>` per
  // resident, which is exactly the read that got composed.
  //
  // What is new here is only that it SAYS SO. A build whose cards were all
  // settled and a build that pulled twelve residents out of a stale index look
  // identical in the output — same shape, same file names, different truth —
  // and the second one is the office's rehydrate tick falling behind, which is
  // an operational fact somebody should be able to see without diffing bytes.
  // It is recorded per build rather than watched, because the failure it makes
  // visible (the tick stalling) has already happened silently once: on
  // 2026-08-25 the live door served a town sha from 13:42Z at 17:26Z, across
  // two scheduled ticks, and the only outward sign was a resident's window
  // reading a day old.
  //
  // The stamp is deliberately NOT carried into residents.json. On a static page
  // every field is "as of this build" and the manifest's `as_of` already says
  // when that was; a field-level stamp about the OFFICE's index, baked into a
  // page, would be a tense the reader has no way to act on. The live tense
  // belongs to the live poll, which is the hand-refresh on the resident page.
  const stamped = fullResidents.filter((r) => r?.freshness?.fields);
  if (!stamped.length) {
    endpointGaps.push("resident cards carry no freshness stamp: this office predates the ladder (pre-2026-08-25), so this build cannot tell how far behind its index was");
  } else {
    const ahead = stamped.filter((r) => r.freshness.tense !== "settled");
    endpointGaps.push(ahead.length
      ? `resident cards composed ahead of the office index for ${ahead.length} of ${stamped.length} residents (${ahead.map((r) => r.handle).sort().slice(0, 12).join(", ")}${ahead.length > 12 ? ", …" : ""}) — the office's rehydrate tick was behind the record and the compose is what saved this build from baking it`
      : `resident cards all settled across ${stamped.length} residents: the office's index was level with the record at fetch time`);
  }

  const ledger = readSnapshot("ledger.json", []);
  endpointGaps.push("ledger.json preserved from committed snapshot: office has metrics but no event-level ledger endpoint yet");

  // Resident profiles are checkout-owned until the Office grows a profile read
  // endpoint. A checkout refresh wins; without one (ordinary deploy), retain
  // the committed last-good overlay so fetching API rows cannot erase it.
  // The committed snapshot is read ONCE and kept whole. Until POS-180 only the
  // `profile` half was taken; the held-over row below needs the row itself, and
  // reading the same file twice for two halves of it is how the two halves
  // start disagreeing.
  const snapshotResidents = ensureArray(readSnapshot("residents.json", []), "snapshot residents.json");
  const snapshotRowByHandle = new Map(snapshotResidents.map((r) => [r.handle, r]));
  const profileByHandle = new Map(snapshotResidents.map((r) => [r.handle, r.profile ?? {}]));
  if (townRoot) {
    const checkoutProblems = [];
    for (const [handle, profile] of Object.entries(readResidentProfiles(townRoot, checkoutProblems))) {
      profileByHandle.set(handle, profile);
    }
    problems.push(...checkoutProblems);
    endpointGaps.push("resident profiles read from the supplied checkout: office has no profile endpoint yet");
  } else {
    endpointGaps.push("resident profiles preserved from committed snapshot: office has no profile endpoint yet");
  }

  // ── THE DROPPED RESIDENT KEEPS THE PAGE THEY HAD (POS-180) ───────────────
  //
  // A 404'd card must not delete a resident from the white pages. The roll
  // still names them, so the town still has them; what is missing is one read.
  // Their previous row is already on disk — it is the last build's OWN OUTPUT,
  // committed as src/data/postmark/residents.json — so it is taken verbatim and
  // NOT passed back through `mapResident`: it is already in output shape, and
  // re-mapping an output row against this build's letters and ledger would
  // quietly rebuild half of it from today's corpus while the rest stayed
  // yesterday's. Held over means held over.
  //
  // A resident with no snapshot row is the one case that genuinely cannot be
  // held: they arrived and shed inside one build, and there is no page to keep.
  // They leave the file, and `problems` says so in different words, because a
  // reader must be able to tell "kept their page" from "has no page".
  const snapshotStats = readSnapshot("stats.json", {});
  const heldFrom = snapshotStats?.latestDate
    ? `the last good build, whose newest recorded delivery is ${snapshotStats.latestDate}`
    : "the last good build, which this build cannot date (the committed stats.json names no latest delivery)";
  const heldOver = [];
  for (const handle of dropped404.slice().sort()) {
    const row = snapshotRowByHandle.get(handle);
    if (row) {
      heldOver.push(row);
      problems.push(`residents: the roll named "${handle}" and the card door answered 404 — the office's roll still carries a resident whose card is gone; the row is HELD OVER from ${heldFrom}, so their page stands rather than vanishing from /residents/`);
    } else {
      problems.push(`residents: the roll named "${handle}" and the card door answered 404, and the committed snapshot has no previous row for them — this resident is absent from this build's /residents/ entirely, because there is no page to hold over`);
    }
  }

  const residents = fullResidents
    .map((r) => mapResident(r, letters, ledger, profileByHandle.get(r.handle) ?? r.profile ?? {}))
    .concat(heldOver)
    .sort((a, b) => a.handle.localeCompare(b.handle));

  // ── A NAMED ENTRY'S 404 IS AN ANSWER, NOT AN OUTAGE (POS-166, 2026-09-21) ──
  //
  // The list and the entries are two reads of one index, and the index can be
  // caught mid-shed: on 2026-09-21 12:50Z `/bulletin` still named
  // `darkos-birthday-at-lanternstep`, an entry the town dropped at crossing
  // 203, and the entry door answered 404. `apiGet` threw, the throw escaped
  // this `Promise.all`, the whole build fell into fetch-town.mjs's catch as
  // "office API unavailable", and on the release channel the #2884 rule did
  // exactly what it is for and REFUSED to publish. The site stayed on the last
  // good build for thirty minutes and the sentinel went down — over one entry
  // that had been deleted on purpose.
  //
  // So a 404 on a slug the list named is now read as the answer it is: that
  // entry is gone, it leaves `bulletin.json`, `problems` says which one, and
  // the other entries still publish. Everything else is unchanged and still
  // stops the build — a 5xx, a timeout, a network failure, a refusal whose
  // budget ran out, and `/bulletin` itself failing (that read is above, and a
  // list we cannot get IS "unavailable"). This is deliberately narrower than
  // fail-soft: it forgives one named thing being absent, never the office
  // being unreachable.
  const DROPPED = Symbol("bulletin entry the list named and the door 404'd");
  const bulletinEntries = await Promise.all(ensureArray(bulletinListRes.body, "/bulletin").map(async (b) => {
    try {
      return (await apiGet(`/bulletin/${encodeURIComponent(b.slug)}`, { apiBase, fetchImpl, retries, gate })).body;
    } catch (error) {
      if (error?.status !== 404) throw error;
      problems.push(`bulletin: the list named "${b.slug}" and the entry door answered 404 — the office's index still carries an entry the town has shed; dropped from bulletin.json and the rest of the board published`);
      return DROPPED;
    }
  }));
  // A SENTINEL, not a null check: `null` is a body the office could one day
  // send, and dropping it silently would be this same defect wearing the fix's
  // clothes.
  const bulletin = bulletinEntries.filter((entry) => entry !== DROPPED);
  bulletin.sort((a, b) => a.slug.localeCompare(b.slug));

  const threads = buildThreads(letters);
  const metrics = metricsRes.body;

  const docs = readSnapshot("docs.json", {});
  endpointGaps.push("docs.json preserved from committed snapshot: office has no docs endpoint yet");

  const calendarRead = await fetchCalendar({ apiBase, fetchImpl, retries, gate });
  const calendar = calendarRead.missing ? readSnapshot("calendar.json", EMPTY_CALENDAR) : calendarRead.calendar;
  if (calendarRead.missing) endpointGaps.push(CALENDAR_GAP);

  let meeps = null;
  if (townRoot) meeps = readMeepsFromCheckout(townRoot);
  if (!meeps) {
    meeps = readSnapshot("meeps.json", []);
    endpointGaps.push("meeps.json preserved from committed snapshot: MEEPS is intentionally checkout-coupled and no checkout was supplied");
  }

  return {
    asOf: asOf ?? town.as_of ?? null,
    endpointGaps,
    problems,
    files: {
      "residents.json": residents,
      "letters.json": letters,
      "threads.json": threads,
      "ledger.json": ledger,
      "meeps.json": meeps,
      "bulletin.json": bulletin,
      "docs.json": docs,
      "stats.json": buildStats({ town, metrics, residents, letters, ledger, snapshotStats }),
      "calendar.json": calendar,
    },
  };
}

// ── THE CALENDAR (POS-211, 2026-09-24) ──────────────────────────────────────
// `GET /calendar` is the office's read of the town's events (the contract is
// the office's docs/calendar-contract.md). The site ships this ingest before
// the office ships the door, so today the door answers 404 "no such door"
// (measured at https://postmark.town/api/calendar, 2026-09-24).
//
// Why it is NOT one more read in the Promise.all above: every read there
// throws on any failure, the throw lands in fetch-town.mjs's catch as "office
// API unavailable", and on the release channel that exit is a failed build
// (shortFetchPlan, postmark#2884). A calendar that is not live yet would have
// stopped every release. So a 404 here is read as what it is, a door this
// office does not have yet: an endpoint gap, and the committed calendar.json
// is kept. Any other failure (a 500, a timeout, a body that is not a calendar)
// still throws like every other read, because that is the office failing and
// not the door missing.
export const EMPTY_CALENDAR = Object.freeze({ as_of: null, now: [], coming: [], ended: [], total: 0 });
export const CALENDAR_GAP = "calendar.json preserved from committed snapshot: the office answered 404 at GET /calendar, so its calendar door is not live yet";

export async function fetchCalendar({ apiBase, fetchImpl = fetch, retries = 3, gate = null } = {}) {
  let body;
  try {
    ({ body } = await apiGet("/calendar", { apiBase, fetchImpl, retries, gate }));
  } catch (error) {
    if (error?.status === 404) return { missing: true, calendar: null };
    throw error;
  }
  for (const key of ["now", "coming", "ended"]) {
    if (!Array.isArray(body?.[key])) throw new Error(`/calendar: "${key}" is not an array, so this is not the calendar the contract names`);
  }
  return { missing: false, calendar: body };
}

export function parseMaybeFrontmatter(text) {
  return parseFrontmatter(text);
}

// ── THE DRAWING CHEST (POS-97, 2026-09-15) ───────────────────────────────────
// postmark-town/postmark-blueprints holds one directory per drawn work, and
// each work's proposal.md cites the idea it grew from (`idea: <by>/<slug>`) and
// carries its stage on the Idea Lifecycle (`status: drawn up`). The Think
// Tank's "drawn" is a join against THAT citation — the chest names the idea;
// the idea mark never names the chest (INDEX.md; the lifecycle doc § 2).
//
// One trees call names every proposal.md; each is then read raw. Public repo,
// no key. Any failure throws, and the caller keeps the committed snapshot the
// way it does for every other data file.
export const BLUEPRINTS_REPO_SLUG = "postmark-town/postmark-blueprints";
export async function fetchBlueprints({ fetchImpl = fetch, repo = BLUEPRINTS_REPO_SLUG, branch = "main", timeoutMs = 15000 } = {}) {
  const get = async (url, as) => {
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs), headers: { accept: as === "json" ? "application/vnd.github+json" : "text/plain" } });
    if (!res.ok) throw new Error(`${url} answered ${res.status}`);
    return as === "json" ? res.json() : res.text();
  };
  const tree = await get(`https://api.github.com/repos/${repo}/git/trees/${branch}?recursive=1`, "json");
  const paths = (Array.isArray(tree?.tree) ? tree.tree : [])
    .map((t) => t?.path)
    .filter((p) => typeof p === "string" && /^BLUEPRINTS\/[^/]+\/proposal\.md$/.test(p))
    .sort();
  const works = [];
  for (const path of paths) {
    const { data } = parseFrontmatter(await get(`https://raw.githubusercontent.com/${repo}/${branch}/${path}`, "text"));
    const dir = path.split("/")[1];
    works.push({
      dir,
      title: String(data.title ?? dir),
      idea: data.idea ? String(data.idea) : null,
      status: data.status ? String(data.status) : null,
      posted: data.posted ? String(data.posted) : null,
      proposed_by: data.proposed_by ? String(data.proposed_by) : null,
      href: `https://github.com/${repo}/blob/${branch}/${path}`,
    });
  }
  return { fetched_at: new Date().toISOString(), repo, branch, works };
}

// ── THE MEEPLINGS' BENCH (the site, reprojected — part 3) ────────────────────
// The office's deploy/box-rollcall-manifest.json is the roll-call of every
// deterministic unit on the box — "every mechanism that is supposed to be
// running on meepo-ec2" — and the Meeps page renders it as the meeplings'
// bench. The office repo is public, so the file is read raw, keyless, AT THE
// RELEASE THE OFFICE SERVES: GET /release names the tag, and the manifest is
// read at that tag, so the bench shows the units the box actually runs rather
// than the ones a train is still carrying toward it.
//
// Only the fields the page renders are kept. Any failure throws, and the caller
// keeps the committed snapshot the way it does for every other data file — a
// bench read from yesterday's release is a floor, not a lie, and the page says
// which tag it was read at.
export const OFFICE_REPO_SLUG = "postmark-town/postmark-office";
export const ROLLCALL_PATH = "deploy/box-rollcall-manifest.json";
export async function fetchRollcall({ fetchImpl = fetch, apiBase = "https://postmark.town/api", repo = OFFICE_REPO_SLUG, timeoutMs = 15000 } = {}) {
  const get = async (url) => {
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs), headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`${url} answered ${res.status}`);
    return res.json();
  };
  const release = await get(`${apiBase.replace(/\/+$/, "")}/release`);
  const tag = typeof release?.tag === "string" && release.tag ? release.tag : null;
  if (!tag) throw new Error("GET /release named no tag — the served release is unknown, so no bench is read");
  const url = `https://raw.githubusercontent.com/${repo}/${tag}/${ROLLCALL_PATH}`;
  const manifest = await get(url);
  if (!Array.isArray(manifest?.units)) throw new Error(`${url} carries no units array`);
  const units = manifest.units.map((u) => ({
    unit: String(u.unit ?? ""),
    label: String(u.label ?? u.unit ?? ""),
    stage: u.stage ? String(u.stage) : null,
    cadence: u.cadence ? String(u.cadence) : null,
    heartbeat: u.heartbeat && typeof u.heartbeat === "object"
      ? { kind: u.heartbeat.kind ?? null, stale_after_minutes: Number.isFinite(u.heartbeat.stale_after_minutes) ? u.heartbeat.stale_after_minutes : null }
      : null,
  })).filter((u) => u.unit);
  return {
    fetched_at: new Date().toISOString(),
    repo,
    tag,
    path: ROLLCALL_PATH,
    href: `https://github.com/${repo}/blob/${tag}/${ROLLCALL_PATH}`,
    units,
  };
}

// ── THE CROSSINGS (the site, reprojected — part 5) ───────────────────────────
// Every settlement the Worldkeeper has blessed, for The Record's crossings
// page. The office's GET /world/settlements answers the newest twenty, number,
// sha and date only (its RECENT_MAX); the page wants EVERY one, with the
// Worldkeeper's own receipt. Both live in the world repo's annotated tags,
// `settlement/S<n>`, which is exactly where the office reads its own list from
// ("The truth is the world repo's own git TAGS … The tag's commit date is when
// it was blessed." — postmark-office src/settlements.mjs).
//
// So the tags are fetched here, keyless, the cheap way: a bare repository in a
// temp directory, one shallow fetch of `refs/tags/settlement/*` with no trees
// (0.8 s and ~240 KB for 81 tags, measured 2026-09-25), then for-each-ref.
// `blessed_at` is the tagged commit's date — the same instant the office's
// door serves — and `receipt` is the tag's message, verbatim.
//
// The published count is the one structured number the world keeps per
// settlement: WORLD/settlement-publications.json at the tag, read raw. It is
// fetched only for a tag the previous snapshot does not already hold at the
// same sha, so a build reads one or two files, not eighty. A tag whose file is
// absent (the earliest settlements predate it) carries null, never a guess.
//
// WHAT EACH SETTLEMENT CHANGED (the Site Lift, POS-255: the replay marks every
// settlement and shows "what it changed in the world"). The same file, read at
// this tag and at the one before, answers it exactly: a mark in this tag's
// `published` and not the previous one's was LOCKED here, and one in the
// previous tag's and not this one's was RETIRED here. `locked` and `retired`
// are those lists, each entry the mark's id and the household the file names.
// A new tag costs its own file and its predecessor's; a tag either file is
// missing for carries null for both, and the page says "not recorded".
// Refusals are not in the file: the Worldkeeper states them in the receipt.
//
// Any failure throws, and the caller keeps the committed snapshot.
export const WORLD_REPO_SLUG = "postmark-town/postmark-world";

/** Two tags' `published` maps → the marks locked and retired between them, by id. */
export function publicationChanges(before, now) {
  const entry = (map) => (id) => ({ id, household: map[id]?.household ?? null });
  const byId = (a, b) => a.id.localeCompare(b.id);
  return {
    locked: Object.keys(now).filter((id) => !(id in before)).map(entry(now)).sort(byId),
    retired: Object.keys(before).filter((id) => !(id in now)).map(entry(before)).sort(byId),
  };
}
export async function fetchCrossings({ fetchImpl = fetch, repo = WORLD_REPO_SLUG, previous = null, timeoutMs = 15000, git = null } = {}) {
  const { execFileSync } = await import("node:child_process");
  const { mkdtempSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join: pjoin } = await import("node:path");
  const run = git ?? ((args, cwd) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 120000 }));

  const dir = mkdtempSync(pjoin(tmpdir(), "pm-crossings-"));
  let rows;
  try {
    run(["init", "-q", "--bare", "."], dir);
    run(["fetch", "-q", "--depth=1", "--filter=tree:0", `https://github.com/${repo}.git`, "refs/tags/settlement/*:refs/tags/settlement/*"], dir);
    const SEP = "\u001f", END = "\u001e";
    const out = run(["for-each-ref", `--format=%(refname:short)${SEP}%(*objectname)${SEP}%(*committerdate:iso-strict)${SEP}%(creatordate:iso-strict)${SEP}%(contents)${END}`, "refs/tags/settlement"], dir);
    rows = out.split(END).map((r) => r.replace(/^\s+/, "")).filter(Boolean).map((r) => {
      const [tag, sha, blessed, tagged, ...rest] = r.split(SEP);
      return { tag, sha, blessed, tagged, message: rest.join(SEP) };
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  const prev = new Map((previous?.crossings ?? []).map((c) => [c.n, c]));
  // One read per tag per build, shared by the tag itself and its successor.
  const files = new Map();
  const publications = (tag) => {
    if (!files.has(tag)) files.set(tag, (async () => {
      try {
        const res = await fetchImpl(`https://raw.githubusercontent.com/${repo}/${tag}/WORLD/settlement-publications.json`, { signal: AbortSignal.timeout(timeoutMs) });
        if (!res.ok) return null;
        const body = await res.json();
        return body && typeof body.published === "object" && body.published ? body.published : null;
      } catch { return null; /* the count stays null; the receipt still stands */ }
    })());
    return files.get(tag);
  };
  const tags = rows
    .map((row) => ({ row, m: /^settlement\/S(\d+)$/.exec(row.tag ?? "") }))
    .filter(({ m }) => m)
    .map(({ row, m }) => ({ row, n: Number(m[1]) }))
    .sort((a, b) => a.n - b.n);
  const crossings = [];
  for (const [i, { row, n }] of tags.entries()) {
    const sha = row.sha || null;
    const kept = prev.get(n);
    const same = kept && kept.sha === sha;
    let published = same && "published_total" in kept ? kept.published_total : undefined;
    let changes = same && "locked" in kept && "retired" in kept ? { locked: kept.locked, retired: kept.retired } : undefined;
    if (published === undefined || changes === undefined) {
      const now = await publications(row.tag);
      if (published === undefined) published = now ? Object.keys(now).length : null;
      if (changes === undefined) {
        const before = i > 0 ? await publications(tags[i - 1].row.tag) : null;
        changes = now && before ? publicationChanges(before, now) : { locked: null, retired: null };
      }
    }
    crossings.push({
      n,
      tag: row.tag,
      sha,
      blessed_at: row.blessed || null,
      tagged_at: row.tagged || null,
      receipt: String(row.message ?? "").trim(),
      published_total: published,
      locked: changes.locked,
      retired: changes.retired,
    });
  }
  crossings.sort((a, b) => b.n - a.n);
  if (!crossings.length) throw new Error("the world repo answered no settlement tags");
  return { fetched_at: new Date().toISOString(), repo, crossings };
}
