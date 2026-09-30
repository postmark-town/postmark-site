// replay-scrub — the replay's clock as a thing you can hold (w41, Keemin
// 2026-09-30: "it's impossible to scrub manually through a day … whenever
// there's an event, the browser auto scrolls to that event … it'll be better
// if we have like the events pop up … chronologically upwards").
//
// Three jobs, all pure, so node can test them without a browser:
//
//   walkersAt   — where everyone stood at ONE instant of a crossing, computed
//                 from the crossing's own record rather than played through to.
//                 The frame holds the snapshot taken as the crossing opened and
//                 every departure inside it; a position at time t is the
//                 world's own law (tools/walk.mjs positionAt) applied to each
//                 walker's latest departure at or before t. The law is handed
//                 in, never restated here: the page passes the walk.mjs the
//                 viewer itself imports, the tests pass the pinned package's.
//   timeline /
//   feedRows    — the crossing's moments in order, and the newest `cap` of
//                 them at or before t, newest first. A jump is a binary search,
//                 not a replay of every moment in between.
//   paintFeed   — reconcile a list element with those rows: new rows go in at
//                 the top, rows past the cap come off the bottom, and a row
//                 already drawn is never rebuilt. The DOM can never hold more
//                 than `cap` rows, whatever the speed.
//
// Nothing here scrolls the page. The feed's own scroll position belongs to the
// reader; the page's code may only hold it still (holdFeedPlace, at the end).

export const FEED_CAP = 200;
// One press of ← or → moves the crossing's clock this far.
export const STEP_MS = 5 * 60 * 1000;
// PageUp / PageDown, when the rail has focus.
export const PAGE_MS = 60 * 60 * 1000;

// A moment's time off the record: `at_ms` is written beside every `at` by
// replay-record, and the ISO string is the fallback.
export function momentOf(row) {
  const ms = Number(row?.at_ms);
  if (Number.isFinite(ms)) return ms;
  const parsed = Date.parse(row?.at);
  return Number.isFinite(parsed) ? parsed : NaN;
}

// The crossing's said and moved, as one list in the order they happened. Each
// entry keeps its index into the frame's own array, which is also its key: a
// row is the same row however many times the clock passes it.
export function timeline(frame) {
  const out = [];
  (frame?.voices ?? []).forEach((row, i) => out.push({ kind: "voice", i, key: `v${i}`, at: momentOf(row), row }));
  (frame?.moves ?? []).forEach((row, i) => out.push({ kind: "move", i, key: `m${i}`, at: momentOf(row), row }));
  return out.filter((e) => Number.isFinite(e.at)).sort((a, b) => a.at - b.at || (a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : a.i - b.i));
}

// How many moments of an ascending timeline are at or before t.
export function countAt(line, t, atOf = (e) => e.at) {
  let lo = 0, hi = line.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (atOf(line[mid]) <= t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

// The newest `cap` moments at or before t, newest first, and how many there
// were in all — so the feed can say when it is showing only the newest.
export function feedRows(line, t, cap = FEED_CAP) {
  const n = countAt(line, t);
  const rows = line.slice(Math.max(0, n - cap), n).reverse();
  return { rows, total: n };
}

// ── where everyone stood at t ───────────────────────────────────────────────

// A departure as the walk law reads it. The record's event carries the
// fractional crossing it was declared at, the target's extent (`within`) and
// its own stride (`pace`); a frame from an older build that lacks the
// fraction is placed by its instant, which is the same number by definition.
function legOf(move, law) {
  if (!move?.from || !move?.toward) return null;
  const at = Number.isFinite(Number(move.crossing)) ? Number(move.crossing) : law.fractionalCrossing(momentOf(move));
  return { from: move.from, toward: move.toward, at, targetExtent: move.within ?? null, pace: move.pace ?? null, to: move.to ?? null };
}

function walkerFrom(base, handle, leg, now, law) {
  const p = law.positionAt(leg, now);
  return {
    ...(base ?? { handle, source: "walk" }),
    handle,
    x: p.x,
    y: p.y,
    moving: !p.arrived && !p.standing,
    toward: leg.toward,
    remaining_m: p.remainingM,
    eta_crossings: p.etaCrossings,
    mark_id: leg.to ?? base?.mark_id ?? null,
  };
}

// The walkers the lens hands the viewer for instant t. A walker with no
// departure in this crossing stands where the snapshot put them, or, if they
// were mid-walk as the crossing opened, where their open leg has carried them
// by t. A walker whose latest departure at or before t is inside the crossing
// is where that departure has carried them. Someone who first departs inside
// the crossing and was not in the snapshot joins the list when they do.
export function walkersAt(frame, t, law) {
  const now = law.fractionalCrossing(t);
  const latest = new Map();
  for (const m of frame?.moves ?? []) {
    const at = momentOf(m);
    if (!(at <= t)) continue;
    const prev = latest.get(m.handle);
    if (!prev || momentOf(prev) <= at) latest.set(m.handle, m);
  }
  const legs = frame?.legs ?? {};
  const out = [];
  const seen = new Set();
  for (const w of frame?.walkers ?? []) {
    seen.add(w.handle);
    const move = latest.get(w.handle);
    const leg = move ? legOf(move, law) : legs[w.handle] ?? null;
    out.push(leg ? walkerFrom(w, w.handle, leg, now, law) : w);
  }
  for (const [handle, move] of latest) {
    if (seen.has(handle)) continue;
    const leg = legOf(move, law);
    if (leg) out.push(walkerFrom(null, handle, leg, now, law));
  }
  return out;
}

// A cheap fingerprint of a walker list, so the page only asks the viewer to
// redraw when somebody actually moved.
export function walkersKey(walkers) {
  return walkers.map((w) => `${w.handle}@${Math.round(w.x)},${Math.round(w.y)}`).join("|");
}

// ── who was inside, as of t ─────────────────────────────────────────────────

// The town's passage record (the enter/exit ledger) as it stood at t: the
// prose around it, and every passage line whose own time is at or before t.
// A passage is history with its own timestamp, so this is exactly what the
// town had recorded by then. A passage line with no readable time is dropped:
// a past frame never keeps a line it cannot place. (Wright, 2026-09-30.)
export function ledgerUpTo(text, t) {
  const out = [];
  for (const line of String(text ?? "").replace(/\r\n/g, "\n").split("\n")) {
    if (!line.startsWith("- ")) { out.push(line); continue; }
    const at = Date.parse(line.slice(2).split(" · ")[0].trim());
    if (Number.isFinite(at) && at <= t) out.push(line);
  }
  return out.join("\n");
}

// The readable passage times, ascending, so "how many passages by t" is a
// binary search the page can ask on every paint.
export function passageTimes(text) {
  const out = [];
  for (const line of String(text ?? "").replace(/\r\n/g, "\n").split("\n")) {
    if (!line.startsWith("- ")) continue;
    const at = Date.parse(line.slice(2).split(" · ")[0].trim());
    if (Number.isFinite(at)) out.push(at);
  }
  return out.sort((a, b) => a - b);
}
export function passagesBy(times, t) {
  return countAt(times, t, (x) => x);
}

// ── the rail as a slider ────────────────────────────────────────────────────

export const clamp = (t, from, to) => Math.min(to, Math.max(from, t));

// A pointer's x on the rail, as a moment of the crossing.
export function timeAtPointer(clientX, rect, from, to) {
  const w = Math.max(1, rect.width);
  const f = clamp((clientX - rect.left) / w, 0, 1);
  return from + Math.round(f * (to - from));
}

// What a key does to the clock, or null when the key is not the rail's.
// ← → step, PageUp/PageDown step an hour, Home/End go to the ends.
export function keyTime(key, t, from, to, { rail = false } = {}) {
  if (key === "ArrowLeft") return clamp(t - STEP_MS, from, to);
  if (key === "ArrowRight") return clamp(t + STEP_MS, from, to);
  if (!rail) return null;
  if (key === "PageUp") return clamp(t - PAGE_MS, from, to);
  if (key === "PageDown") return clamp(t + PAGE_MS, from, to);
  if (key === "Home") return from;
  if (key === "End") return to;
  return null;
}

// ── the feed ────────────────────────────────────────────────────────────────

// Make `list` hold exactly `rows`, in order, reusing every node already drawn
// (matched by `data-key`). `build(entry)` makes a new row's node. Returns the
// nodes it created, so the caller can count what is new and mark it.
export function paintFeed(list, rows, build) {
  const want = new Set(rows.map((r) => r.key));
  const have = new Map();
  for (const node of [...list.children]) {
    const key = node.dataset ? node.dataset.key : undefined;
    if (key && want.has(key) && !have.has(key)) have.set(key, node);
    else list.removeChild(node);
  }
  const created = [];
  rows.forEach((entry, i) => {
    let node = have.get(entry.key);
    if (!node) {
      node = build(entry);
      node.dataset.key = entry.key;
      created.push(node);
    }
    if (list.children[i] !== node) list.insertBefore(node, list.children[i] ?? null);
  });
  return created;
}

// "Away from the top" — the reader has scrolled the feed to read something
// older. A few pixels of slack so a trackpad's rest is not read as a scroll.
export const awayFromTop = (list) => (list.scrollTop || 0) > 4;

// Run `paint`, and if the reader had scrolled the feed away from its top, keep
// the row they were looking at exactly where it was. Rows arriving above it
// would otherwise push it down out from under them. This writes only the
// feed's own scrollTop, and only to cancel a shift the paint caused; at the
// top it does nothing, so a new row simply appears there. (The feed is
// `position: relative`, so a row's offsetTop is measured inside it.)
export function holdFeedPlace(list, paint) {
  if (!awayFromTop(list)) return paint();
  const top = list.scrollTop;
  const anchor = [...list.children].find((n) => n.offsetTop + n.offsetHeight > top);
  const key = anchor?.dataset?.key;
  const offset = anchor ? anchor.offsetTop - top : 0;
  const out = paint();
  const again = key ? [...list.children].find((n) => n.dataset?.key === key) : null;
  if (again) list.scrollTop = again.offsetTop - offset;
  return out;
}
