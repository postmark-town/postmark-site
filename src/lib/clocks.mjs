// clocks.mjs — the two clocks every page wears: the next ferry and the next
// settlement (the site, reprojected — part 7).
//
// THE DESIGN (G:/Starstory/docs/2026-09-25/design-notes/the-site-reprojected.md):
// "A day that turns twice — the ferry at 00/12Z, the settlement at
// 05:45/17:45Z … Two clocks on every page: next ferry, next settlement." The
// settlement moved to 06:00/18:00Z with the w39 ship; the record says so, and
// the record is what is read here.
//
// WHERE THE MARKS COME FROM — never typed as the truth, always read:
//   the ferry      — the office's own crossing derivation, GET /api/ →
//                    crossing.derivation ("12h crossings (00:00/12:00 UTC) …"),
//                    the one clock the town keeps (postmark-office
//                    src/crossings.mjs). Its marks are parsed out of that
//                    sentence.
//   the settlement — the hours the Worldkeeper actually blessed at, read off
//                    GET /api/world/settlements' recent dates. A mark counts
//                    only when two or more recent blessings landed on it, so
//                    one late blessing cannot invent a third mark.
// The constants below are the FLOOR, printed before any read lands and kept
// when a read fails; they are what those two reads answer today.
//
// THE WINDOW'S NUMBER is the office's count: crossing.number from GET /api/,
// the same number every doorstep carries as its crossing. The world repo's own
// crossing log counts the same half-days one lower (at S81 it stops at 210
// while the office says 211, measured 2026-09-25); the office's is the one a
// resident's doorstep reads, so it is the one a reader is shown.
//
// Pure: every function takes the instant it reasons about, so a test can stand
// at 23:59 and ask what comes after midnight.

export const FERRY_MARKS = [0, 12];
export const SETTLEMENT_MARKS = [6, 18];

const HOUR = 3_600_000;
const MIN = 60_000;

/**
 * The ferry's marks, read from the office's own derivation sentence:
 * "12h crossings (00:00/12:00 UTC) …" → [0, 12]. Anything unreadable → null.
 */
export function marksFromDerivation(text) {
  const m = /\(([\d:\s/]+)\s*UTC\)/i.exec(String(text ?? ""));
  if (!m) return null;
  const hours = m[1].split("/").map((t) => /^\s*(\d{1,2}):(\d{2})\s*$/.exec(t)).filter(Boolean)
    .map((x) => Number(x[1]) + Number(x[2]) / 60)
    .filter((h) => h >= 0 && h < 24);
  return hours.length ? [...new Set(hours)].sort((a, b) => a - b) : null;
}

/**
 * The settlement's marks, read from the hours recent blessings landed on. A
 * blessing is placed on the half hour it fell nearest ("06:00:24Z" → 6); a mark
 * needs two blessings. Fewer than one agreed mark → null.
 */
export function marksFromSettlements(body) {
  const count = new Map();
  for (const r of Array.isArray(body?.recent) ? body.recent : []) {
    const t = Date.parse(String(r?.date ?? ""));
    if (!Number.isFinite(t)) continue;
    const d = new Date(t);
    const h = Math.round((d.getUTCHours() + d.getUTCMinutes() / 60) * 2) / 2 % 24;
    count.set(h, (count.get(h) ?? 0) + 1);
  }
  const marks = [...count].filter(([, n]) => n >= 2).map(([h]) => h).sort((a, b) => a - b);
  return marks.length ? marks : null;
}

/**
 * The next mark strictly after `nowMs`, as a Date. Marks are UTC hours
 * (fractions allowed). Across midnight it rolls to tomorrow's first mark.
 */
export function nextMark(nowMs, marks) {
  const list = (Array.isArray(marks) && marks.length ? marks : []).slice().sort((a, b) => a - b);
  if (!list.length || !Number.isFinite(nowMs)) return null;
  const d = new Date(nowMs);
  const dayStart = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  for (let day = 0; day < 2; day++) {
    for (const h of list) {
      const t = dayStart + day * 24 * HOUR + Math.round(h * HOUR);
      if (t > nowMs) return new Date(t);
    }
  }
  return null;
}

/** "in 3 h 12 min" / "in 12 min" / "in under a minute" — a reader's units. */
export function untilPhrase(ms) {
  if (!Number.isFinite(ms) || ms < 0) return "";
  if (ms < MIN) return "in under a minute";
  const total = Math.floor(ms / MIN);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h ? `in ${h} h${m ? ` ${m} min` : ""}` : `in ${m} min`;
}

/** "00:00 & 12:00 UTC" — the floor's printed marks. */
export function marksPhrase(marks) {
  const hm = (h) => `${String(Math.floor(h)).padStart(2, "0")}:${String(Math.round((h % 1) * 60)).padStart(2, "0")}`;
  return `${(marks ?? []).map(hm).join(" & ")} UTC`;
}

/** The office's window count from GET /api/, or null. */
export function windowNumber(root) {
  const n = root?.crossing?.number;
  return Number.isInteger(n) ? n : null;
}
