// mail.mjs — pure helpers for The Mail page + the all-mail explorer.
//
// Shared by build-time rendering (Astro pages) and the client islands. No deps,
// no DOM, no network — every function here is testable in isolation
// (test/mail.test.mjs). The office API and the static build agree because both
// derive from the same shapes.

// ── office classification (is_office roster from step 2) ─────────────────────
// residents.json carries is_office per resident. A letter/thread is
// "office-involved" if any participant is a town office. Until town PR #224
// merges, every flag is false, so nothing is excluded yet — the logic is live
// and fixture-tested, and lights up the moment the roster flags land.
export function officeHandles(residents) {
  return new Set((residents ?? []).filter((r) => r.is_office === true).map((r) => r.handle));
}

// a letter's participants: sender + every recipient (toList wins over to)
export function letterParticipants(l) {
  return [l.from, ...(l.toList?.length ? l.toList : [l.to])].filter(Boolean);
}

export function isOfficeInvolved(participants, officeSet) {
  return (participants ?? []).some((h) => officeSet.has(h));
}

export function threadIsOffice(thread, officeSet) {
  return isOfficeInvolved(thread?.participants, officeSet);
}

// ── region map (from residents.json REGION.md frontmatter: `region:`) ────────
export function regionOfFn(residents) {
  const m = new Map();
  for (const r of residents ?? []) {
    const name = r.region?.region ?? null;
    if (name) m.set(r.handle, name);
  }
  return (handle) => m.get(handle) ?? null;
}

export function regionList(residents) {
  return [...new Set((residents ?? []).map((r) => r.region?.region).filter(Boolean))].sort();
}

// ── date helpers (UTC-pinned, YYYY-MM-DD string math) ────────────────────────
export function shiftDate(iso, deltaDays) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso;
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + deltaDays * 86400000).toISOString().slice(0, 10);
}

// ── metrics aggregation (build-time twin of /api/metrics/mail) ───────────────
// Deterministic: "today" is the newest ledger date, never the wall clock, so
// the static render and the live island report the same numbers for the same
// ledger. Days are gap-filled between the first and last ledger date.
export function metricsFromLedger(ledger, threads = [], { activeWithinDays = 14 } = {}) {
  const byDay = new Map();
  let deliveries = 0;
  let bounces = 0;
  for (const e of ledger ?? []) {
    if (e.kind === "delivery") deliveries++;
    else if (e.kind === "bounce") bounces++;
    if (!e.date) continue;
    const d = byDay.get(e.date) ?? { date: e.date, deliveries: 0, bounces: 0 };
    if (e.kind === "delivery") d.deliveries++;
    else if (e.kind === "bounce") d.bounces++;
    byDay.set(e.date, d);
  }
  const dates = [...byDay.keys()].sort();
  const asOf = dates.length ? dates[dates.length - 1] : null;
  const days = [];
  if (dates.length) {
    let cur = dates[0];
    const end = dates[dates.length - 1];
    for (let guard = 0; cur <= end && guard < 100000; guard++, cur = shiftDate(cur, 1)) {
      days.push(byDay.get(cur) ?? { date: cur, deliveries: 0, bounces: 0 });
    }
  }
  // "last letter within N days of as-of" — matches the office /metrics contract
  const cut = asOf ? shiftDate(asOf, -activeWithinDays) : null;
  const activeThreads = cut ? (threads ?? []).filter((t) => (t.lastDate ?? "") >= cut).length : 0;
  return {
    as_of: asOf,
    days,
    totals: { deliveries, bounces },
    active_threads: activeThreads,
  };
}

// most recent `n` days of the series (for the sparkline)
export function recentDays(days, n = 30) {
  return (days ?? []).slice(-n);
}

// deliveries recorded on the as-of day (the "today so far" figure)
export function deliveriesOn(days, date) {
  const d = (days ?? []).find((x) => x.date === date);
  return d ? d.deliveries : 0;
}

// ── explorer filter state <-> URL (round-trip stable) ────────────────────────
// The URL is the source of truth for a filtered view, so any view is shareable.
// String fields carry their value; `office` is a boolean ("1" = show office
// traffic). queryToState(stateToQuery(s)) === s for any canonical state.
const STRING_FIELDS = ["resident", "region", "since", "until", "thread", "q"];

export function queryToState(search) {
  const p = new URLSearchParams((search || "").replace(/^\?/, ""));
  const state = {};
  for (const f of STRING_FIELDS) {
    const v = p.get(f);
    if (v) state[f] = v;
  }
  state.office = p.get("office") === "1";
  return state;
}

export function stateToQuery(state) {
  const p = new URLSearchParams();
  for (const f of STRING_FIELDS) {
    if (state?.[f]) p.set(f, state[f]);
  }
  if (state?.office) p.set("office", "1");
  const s = p.toString();
  return s ? `?${s}` : "";
}

// ── letter preview (skip the salutation/address so the card says something) ──
// The opening lines of a letter are almost always a greeting ("Dear Ferry,"),
// a bare name-comma, or blank — useless in a preview card. Drop those leading
// lines, then keep the first `maxLines` lines that actually carry content.
// Pure + line-based so it's shared by the mail page island and testable.
function isSalutationLine(t) {
  if (t === "") return true;
  // "Dear Ferry," / "Hi," / "Hello there," / "To the town," — a greeting opener
  if (/^(dear|dearest|hi|hello|hey|greetings|to|good (morning|evening|day))\b[^.!?]*[,:]?\s*$/i.test(t)) return true;
  // a bare name-comma line ("Ferry," / "Dear neighbours,") with no sentence in it
  if (/^[^.!?]{1,40},\s*$/.test(t)) return true;
  return false;
}

export function stripSalutationLines(body) {
  const lines = String(body ?? "").replace(/\r\n/g, "\n").split("\n");
  let i = 0;
  while (i < lines.length && isSalutationLine(lines[i].trim())) i++;
  return lines.slice(i);
}

// first `maxLines` real (non-empty) content lines, light markdown stripped
export function previewLines(body, maxLines = 5) {
  const out = [];
  for (const raw of stripSalutationLines(body)) {
    const l = raw.replace(/[#>*_`]/g, "").trim();
    if (!l) continue;
    out.push(l);
    if (out.length >= maxLines) break;
  }
  return out;
}

// ── the explorer filter (client-side over the full committed corpus) ─────────
// Full-text search is a substring match over the embedded corpus (id/from/to/
// body) — complete for the build-time mail and degradation-safe offline; the
// office /api/search verb is the live-freshness hook for mail newer than the
// last build.
export function filterLetters(letters, state, { officeSet = new Set(), regionOf = () => null } = {}) {
  const q = (state?.q || "").toLowerCase().trim();
  return (letters ?? []).filter((l) => {
    const parts = letterParticipants(l);
    if (!state?.office && isOfficeInvolved(parts, officeSet)) return false;
    if (state?.resident && !parts.includes(state.resident)) return false;
    if (state?.region && !parts.some((h) => regionOf(h) === state.region)) return false;
    if (state?.thread && l.thread !== state.thread && l.id !== state.thread) return false;
    // date filters run on the town's clock: the ledger's DELIVERY date when
    // the letter has one (so a heatmap-bar click matches the bar's count),
    // falling back to the written date for mail still crossing
    const when = l.delivered ?? l.date ?? "";
    if (state?.since && when < state.since) return false;
    if (state?.until && when > state.until) return false;
    if (q) {
      const hay = `${l.id} ${l.from} ${l.to} ${l.body ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

// ── the conversation list in parts (POS-254) ─────────────────────────────────
// /mail/ is page 1; /mail/page/2/ onward are their own static pages, so every
// page works without JavaScript. The list arrives newest-first (threads.json is
// sorted by each conversation's newest letter); the pages keep that order.
// MAIL_PAGE_SIZE, measured (2026-09-26, 1,626 conversations): a card is ~624
// bytes, so 50 cards are ~31 KB, the same order as the ~43 KB of frame every
// page carries; /mail/ went from 1,072,675 bytes to 78,981 (22 town pages).
export const MAIL_PAGE_SIZE = 50;

export function mailPageCount(total, size = MAIL_PAGE_SIZE) {
  return Math.max(1, Math.ceil((total ?? 0) / size));
}

export function mailPageSlice(items, page, size = MAIL_PAGE_SIZE) {
  const start = (page - 1) * size;
  return (items ?? []).slice(start, start + size);
}

// `base` is the run's first page ("/mail/"); page N lives at <base>page/N/
export function mailPageHref(page, base = "/mail/") {
  return page <= 1 ? base : `${base}page/${page}/`;
}

// the numbered links a pager shows: the first and last page, the pages around
// the current one, and a gap ("…") wherever pages are skipped
export function mailPagerItems(current, total, { around = 2 } = {}) {
  const keep = new Set([1, total]);
  for (let p = current - around; p <= current + around; p++) if (p >= 1 && p <= total) keep.add(p);
  const pages = [...keep].sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i < pages.length; i++) {
    if (i > 0 && pages[i] - pages[i - 1] > 1) out.push("gap");
    out.push(pages[i]);
  }
  return out;
}

// the two runs The Mail pages through: the town's own conversations (the
// default view) and the office's traffic, each keeping threads.json's order
export function mailRuns(threads, officeSet) {
  const town = [], office = [];
  for (const t of threads ?? []) (threadIsOffice(t, officeSet) ? office : town).push(t);
  return { town, office };
}

// the filtered letters, newest first on the town's clock (delivery date, else
// the written date), so a capped result shows the newest mail, not the oldest
export function newestLettersFirst(rows) {
  const when = (l) => l.delivered ?? l.date ?? "";
  return [...(rows ?? [])].sort((a, b) => when(b).localeCompare(when(a)));
}
