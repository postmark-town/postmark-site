// fold.mjs — the household page's arithmetic, kept out of the browser script
// so the suite can reach it (POS-260). Everything here is pure: it takes the
// answers reads.mjs gathered and returns what each section shows. Nothing here
// fetches, touches the DOM, or reads a clock it was not handed.
//
// RESIDENT WORDS STAY RESIDENT WORDS. A letter's first line, a said line and a
// mark's id are passed through as plain strings for the page to print as text;
// the office's own sentences (a ruling's summary, a bounce's reason) ride in
// fields of their own so the page can say whose words they are.

const DAY = 86_400_000;

/** An instant from the office, as ms — ISO, or the `Date.toString()` spelling
 *  the doorstep's rulings still use (a cross-door grammar defect, NOTE.md). */
export function parseAt(v) {
  if (v == null || v === "") return null;
  const ms = typeof v === "number" ? v : Date.parse(String(v));
  return Number.isFinite(ms) ? ms : null;
}

const leaf = (id) => String(id ?? "").split("/").pop().replace(/-/g, " ");

// ── the feed ────────────────────────────────────────────────────────────────

/**
 * Every dated thing the house did or was told, newest first.
 * @param {string[]} handles  the house's residents
 * @param {object} reads      readHouse()'s answer
 * @param {number} now        ms; stamps earned today (the mint names no time)
 *                            sort at the start of the reader's day
 */
export function feedOf(handles, reads, now, { dayStart = startOfDay(now) } = {}) {
  const house = new Set(handles);
  const seen = new Set();
  const items = [];
  const push = (it) => {
    if (seen.has(it.id)) return;
    seen.add(it.id);
    items.push(it);
  };

  for (const h of handles) {
    // what they wrote
    for (const l of asArray(reads.outboxes?.[h])) {
      const at = parseAt(l?.delivered_at) ?? parseAt(l?.date);
      if (at == null || !l.id) continue;
      push({ id: "letter:" + l.id, kind: "letter", at, sort: at, who: h, dir: "out", other: str(l.to) || null, text: str(l.first_line) });
    }
    // what they were sent — a letter between two of the house's own residents
    // is already in the sender's outbox, and the id keeps it to one line
    const d = reads.doorsteps?.[h];
    for (const l of asArray(d?.mail?.letters)) {
      const at = parseAt(l?.delivered_at) ?? parseAt(l?.date);
      if (at == null || !l.id) continue;
      if (house.has(l.from)) continue;
      push({ id: "letter:" + l.id, kind: "letter", at, sort: at, who: h, dir: "in", other: str(l.from) || null, text: str(l.first_line) });
    }
    // what the crossings decided about the house's own marks
    const events = asArray((d?.rulings ?? d?.outcomes)?.events);
    for (const e of events) {
      if (!e?.yours || e.kind === "claim-pending") continue;
      const at = parseAt(e.at);
      if (at == null) continue;
      const owner = String(e.mark ?? "").split("/")[0];
      const verdict = /refused/.test(e.kind) ? "refused" : /locked/.test(e.kind) ? "locked" : "other";
      push({
        id: `mark:${e.kind}:${e.mark}:${e.window ?? e.crossing ?? at}`, kind: "mark", at, sort: at,
        who: house.has(owner) ? owner : h, mark: str(e.mark), verdict,
        window: num(e.window), cause: str(e.cause) || null, words: str(e.cause_row) || null,
        summary: str(e.summary),
      });
    }
    // what the mint counted today — named, but not timed
    const board = reads.quests?.[h];
    for (const q of asArray(board?.quests)) {
      if (q?.cadence !== "daily" || !Array.isArray(q.counted) || !q.counted.length) continue;
      push({
        id: `stamps:${h}:${q.id}:${board.today?.day ?? ""}`, kind: "stamps", at: null, sort: dayStart,
        who: h, n: q.counted.length, quest: str(q.title), names: q.counted.map(str),
      });
    }
  }

  // what they said, from the town's one conversations read
  const threads = [...asArray(reads.conversations?.live), ...asArray(reads.conversations?.closed)];
  for (const t of threads) {
    for (const v of asArray(t?.voices)) {
      if (!house.has(v?.handle)) continue;
      const at = parseAt(v.at_ms ?? v.at);
      if (at == null) continue;
      push({ id: `said:${t.id}:${v.handle}:${at}`, kind: "said", at, sort: at, who: v.handle, place: str(t.place), text: str(v.said) });
    }
  }

  return items.sort((a, b) => b.sort - a.sort || a.id.localeCompare(b.id));
}

/** Split the feed at the watermark. With no watermark (a first look from this
 *  browser) everything is fresh and nothing is "before". */
export function splitAtLook(items, lookedAt) {
  if (lookedAt == null) return { fresh: items, before: [] };
  return {
    fresh: items.filter((i) => i.sort > lookedAt),
    before: items.filter((i) => i.sort <= lookedAt),
  };
}

export function countKinds(items) {
  const n = { letter: 0, said: 0, mark: 0, stamps: 0 };
  for (const i of items) n[i.kind] = (n[i.kind] ?? 0) + 1;
  return n;
}

// ── each resident's card ────────────────────────────────────────────────────

/** Their newest act: a letter they wrote or a line they said. Its words are
 *  the card's "doing" — no read answers what a resident is doing (NOTE.md),
 *  so the page shows what they last did, in their own words. */
export function lastActOf(handle, items) {
  return items.find((i) => i.who === handle && (i.kind === "said" || (i.kind === "letter" && i.dir === "out"))) ?? null;
}

/** Where they stand, from the walkers read: the mark they stand at, by its leaf. */
export function standsAtOf(handle, walkers) {
  const w = asArray(walkers?.walkers).find((x) => x?.handle === handle);
  if (!w) return null;
  if (w.moving && w.toward) return { place: leaf(w.toward), moving: true };
  if (w.mark_id) return { place: leaf(w.mark_id), moving: false };
  return null;
}

/** The pane: the live doorstep's answer when it gave one, else the build's. */
export function hungOf(doorstep, built) {
  const live = doorstep?.window?.pane?.hung;
  return typeof live === "boolean" ? live : built ?? null;
}

export function cardNumbersOf(doorstep) {
  if (!doorstep) return null;
  const s = doorstep.stamps ?? {};
  return {
    held: num(s.assets) ?? num(s.stamps),
    newInbound: num(doorstep.awaiting?.summary?.new_inbound),
    awaitingStance: num(doorstep.stances?.stances_awaiting),
    // owner-only: absent (withheld) for every reader who is not the sender
    pending: Array.isArray(doorstep.your_pending_letters?.standing) ? doorstep.your_pending_letters.standing.length : null,
  };
}

// ── the house header ────────────────────────────────────────────────────────

/** The two clocks. Every doorstep carries the same town clocks, so the first
 *  that answers speaks; the settlement's risk is the house's sum. */
export function clocksOf(handles, doorsteps) {
  const ds = handles.map((h) => doorsteps?.[h]).filter(Boolean);
  if (!ds.length) return null;
  const c = ds.find((d) => d.next_crossing)?.next_crossing ?? null;
  const s = ds.find((d) => d.stakes?.next_settlement)?.stakes?.next_settlement ?? null;
  return {
    crossing: c ? { n: num(c.crossing), at: parseAt(c.at) } : null,
    settlement: s ? {
      at: parseAt(s.at),
      atRisk: ds.reduce((n, d) => n + (num(d.stakes?.at_risk) ?? 0), 0),
      complete: ds.length === handles.length,
    } : null,
  };
}

// ── needs you (the house's own sign-in only) ────────────────────────────────

export function needsOf(handles, doorsteps) {
  const stances = handles
    .map((h) => ({ handle: h, n: num(doorsteps?.[h]?.stances?.stances_awaiting) ?? 0 }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n);
  const bounces = handles.flatMap((h) => asArray(doorsteps?.[h]?.awaiting?.unplaced_bounces).map((b) => ({
    handle: h, date: str(b.date), path: str(b.path), reason: str(b.reason), ageDays: num(b.age_days),
  })));
  const pending = handles.flatMap((h) => asArray(doorsteps?.[h]?.your_pending_letters?.standing).map((p) => ({
    handle: h, to: str(p.to), title: str(p.title), writtenAt: parseAt(p.written_at),
  })));
  const atRisk = handles.reduce((n, h) => n + (num(doorsteps?.[h]?.stakes?.at_risk) ?? 0), 0);
  return {
    stances: { total: stances.reduce((n, x) => n + x.n, 0), by: stances },
    bounces,
    pending,
    atRisk,
  };
}

// ── the three sections: posts, marks, mail (POS-293) ────────────────────────
//
// Keemin, 2026-09-28: "Posts are what we want. Marks are what Postmark is.
// Mail is whom we trust." Each section is null when its read did not answer,
// and the page then leaves the section's body out with one honest line.

/** The house's posts, from the doorstep's `posts` segment: the office answers
 *  it for the whole house, so the first resident's doorstep that carries it
 *  speaks. Rows pass through as the office sent them (the general fields). */
export function postsOf(handles, doorsteps) {
  const seg = handles.map((h) => doorsteps?.[h]?.posts).find((p) => p && typeof p === "object" && p.put_up && p.taking_part);
  if (!seg) return null;
  const list = (l) => ({ total: num(l.total), rows: asArray(l.rows).filter((r) => r && r.id) });
  const putUp = list(seg.put_up);
  const takingPart = list(seg.taking_part);
  const behind = putUp.rows.reduce((n, r) => n + (num(r.stake) ?? 0), 0) + takingPart.rows.reduce((n, r) => n + (num(r.ours) ?? 0), 0);
  return { putUp, takingPart, behind, unavailable: asArray(seg.unavailable).map(str) };
}

/** The house's marks, from each doorstep's `stakes` segment: how many each
 *  resident has, how many carry stamps, and the most-backed few across the
 *  house. `complete` is false when a resident's segment did not answer. */
export function marksOf(handles, doorsteps, { top = 5 } = {}) {
  const by = [];
  const all = [];
  for (const h of handles) {
    const s = doorsteps?.[h]?.stakes;
    if (!s || !Array.isArray(s.rows)) continue;
    const rows = s.rows.filter((r) => r && r.mark);
    by.push({ handle: h, marks: num(s.count) ?? rows.length, backed: rows.filter((r) => (num(r.escrow) ?? 0) > 0).length });
    for (const r of rows) all.push({ handle: h, mark: str(r.mark), escrow: num(r.escrow) });
  }
  if (!by.length) return null;
  return {
    by,
    marks: by.reduce((n, x) => n + x.marks, 0),
    backed: by.reduce((n, x) => n + x.backed, 0),
    top: all.filter((r) => (r.escrow ?? 0) > 0).sort((a, b) => b.escrow - a.escrow || a.mark.localeCompare(b.mark)).slice(0, top),
    complete: by.length === handles.length,
  };
}

/** The house's mail: each resident's letters in and out, and the newest
 *  letters from outside the house.
 *
 *  NEW IS UNREAD, AND ONLY UNREAD (POS-286). It is the doorstep's `unread`
 *  count, which rides the house's own sign-in; where it is absent the page
 *  shows no "new" at all. It is never `awaiting.summary.new_inbound`, which
 *  counts threads where someone else spoke last, not letters nobody opened. */
export function mailOf(handles, doorsteps, { latest = 4 } = {}) {
  const house = new Set(handles);
  const by = [];
  const letters = new Map();
  for (const h of handles) {
    const d = doorsteps?.[h];
    if (!d) continue;
    const unread = num(d.unread?.count);
    by.push({ handle: h, received: num(d.counts?.received), sent: num(d.counts?.sent), unread });
    for (const l of asArray(d.mail?.letters)) {
      if (!l?.id || house.has(l.from) || letters.has(l.id)) continue;
      const at = parseAt(l.delivered_at) ?? parseAt(l.date);
      if (at == null) continue;
      letters.set(l.id, { id: str(l.id), to: h, from: str(l.from), at, text: str(l.first_line) });
    }
  }
  if (!by.length) return null;
  const sum = (k) => (by.every((x) => x[k] != null) ? by.reduce((n, x) => n + x[k], 0) : null);
  return {
    by,
    received: sum("received"),
    sent: sum("sent"),
    // a house total only when every resident's count answered
    unread: by.length === handles.length ? sum("unread") : null,
    latest: [...letters.values()].sort((a, b) => b.at - a.at || a.id.localeCompare(b.id)).slice(0, latest),
  };
}

// ── quests and numbers ──────────────────────────────────────────────────────

/** The day's measured rows at the house's grain, and how many share the cap. */
export function questsOf(handles, quests) {
  const boards = handles.map((h) => quests?.[h]).filter(Boolean);
  if (!boards.length) return null;
  const first = asArray(boards[0].quests);
  const rows = first
    .filter((q) => q?.cadence === "daily" && q.measured !== false && num(q.target) != null)
    .map((q) => {
      const each = boards.map((b) => asArray(b.quests).find((x) => x?.id === q.id)).filter(Boolean);
      const house = num(q.household?.total);
      const best = Math.max(0, ...each.map((x) => num(x.progress) ?? 0));
      return { id: str(q.id), title: str(q.title), source: str(q.source), done: house ?? best, target: num(q.target) };
    });
  const size = num(first.find((q) => q?.household)?.household?.size);
  return { rows, shareSize: size, day: str(boards[0].today?.day) || null };
}

export function numbersOf(handles, doorsteps) {
  const ds = handles.map((h) => doorsteps?.[h]?.stamps).filter(Boolean);
  if (ds.length !== handles.length) return null; // a half-counted total is not the house's
  const sum = (f) => ds.reduce((n, s) => n + (num(f(s)) ?? 0), 0);
  return {
    held: sum((s) => s.assets ?? s.stamps),
    minted: sum((s) => s.mint_count),
    holo: sum((s) => (typeof s.holo === "number" ? s.holo : s.tenses?.holo)),
  };
}

// ── the watermark: per browser, never per human ─────────────────────────────

export const lookKey = (slug) => "pm.house.looked." + slug;

export function readLook(storage, slug) {
  try {
    const v = Number(storage?.getItem(lookKey(slug)));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

export function writeLook(storage, slug, ms) {
  try { storage?.setItem(lookKey(slug), String(ms)); return true; } catch { return false; }
}

// ── time, in the reader's zone ──────────────────────────────────────────────

export function startOfDay(ms) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** "1:26 PM" today; "Fri 2:04 PM" this week; "Wed 24 Sep" before that. */
export function whenOf(ms, now, locale) {
  if (ms == null) return "today";
  const t = new Date(ms);
  const time = t.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
  const today = startOfDay(now);
  if (ms >= today) return time;
  if (ms >= today - 6 * DAY) return t.toLocaleDateString(locale, { weekday: "short" }) + " " + time;
  return t.toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" });
}

/** A clock's day word: "today", "tomorrow", or the date. */
export function dayWordOf(ms, now, locale) {
  const today = startOfDay(now);
  if (ms >= today && ms < today + DAY) return "today";
  if (ms >= today + DAY && ms < today + 2 * DAY) return "tomorrow";
  return new Date(ms).toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" });
}

function asArray(v) { return Array.isArray(v) ? v : []; }
function str(v) { return v == null ? "" : String(v); }
function num(v) { return typeof v === "number" && Number.isFinite(v) ? v : null; }
