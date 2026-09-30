// fund-close.mjs — when a pot closes, said for the reader's month (POS-231,
// 2026-09-29).
//
// THE BUG THIS CLOSES. Every pot card and the pot page said "closes end of
// September" from the pot file's fixed `first_close: 2026-09-30`, and "dollars
// arriving now belong to the September 2026 epoch". The pages are static, so
// after the September close (2026-09-30 20:00 EDT = 2026-10-01 00:00 UTC) they
// would have told a giver the wrong month for as long as the build stood.
//
// THE RULE (the brief, Wright 2026-09-29): a pot closes at the end of the month
// its current epoch is in. While `first_close` is ahead, say it (the first
// epoch rounds forward: § _first_close); once it has passed, say the end of
// the CURRENT month. Months are UTC, because the close is 00:00 UTC. "Now" is
// the reader's: the static page carries the answer as of its build, and
// `paintCloses` rewrites it in the browser at the reader's time.
//
// Browser-safe on purpose (no node imports), so the page's script and the
// build read the same function. funding.mjs re-exports the two formatters, so
// there is still ONE formatter for this moment.

const EPOCH_RE = /^\d{4}-\d{2}$/;
const FIRST_CLOSE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTHS = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

// "2026-09" → "September 2026". The epoch a surface NAMES, for the places that
// are speaking to a reader rather than stamping a row; the raw YYYY-MM stays the
// identity everywhere it is one.
export function epochLabel(epoch) {
  const s = String(epoch ?? "").trim();
  if (!EPOCH_RE.test(s)) return null;
  const [y, m] = s.split("-").map(Number);
  return m >= 1 && m <= 12 ? `${MONTHS[m - 1]} ${y}` : null;
}

// The first close, as a sentence rather than a date stamp — "end of September".
// "end of <Month>" is said only when the date IS the month's last day, which is
// what the founder's ruling describes ("the first month closes at the END of
// September"). Any other day gets the plain date instead of being rounded into
// a phrase that would be false — a close on the 12th is not the end of anything.
export function firstCloseLabel(firstClose) {
  const s = String(firstClose ?? "").trim();
  if (!FIRST_CLOSE_RE.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (m < 1 || m > 12) return null;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return d === lastDay ? `end of ${MONTHS[m - 1]}` : `${d} ${MONTHS[m - 1]}`;
}

/**
 * When this pot closes, as of `now` (ms): `{ closeLabel, epochLabel, epoch }`,
 * or null for a pot with no posted first close. Before the first close, the
 * first close and its month's epoch; after it, the end of `now`'s UTC month and
 * that month's epoch.
 */
export function closeAt(firstClose, now = Date.now()) {
  const s = String(firstClose ?? "").trim();
  if (!FIRST_CLOSE_RE.test(s) || !firstCloseLabel(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  const closesAt = Date.UTC(y, m - 1, d + 1); // the close runs at 00:00 UTC after the day
  if (now < closesAt) {
    const epoch = `${y}-${String(m).padStart(2, "0")}`;
    return { closeLabel: firstCloseLabel(s), epoch, epochLabel: epochLabel(epoch) };
  }
  const at = new Date(now);
  const epoch = `${at.getUTCFullYear()}-${String(at.getUTCMonth() + 1).padStart(2, "0")}`;
  return { closeLabel: `end of ${MONTHS[at.getUTCMonth()]}`, epoch, epochLabel: epochLabel(epoch) };
}

/**
 * The browser's half: every `[data-first-close]` element on the page gets its
 * words from `closeAt` at the reader's now. `data-say` picks which words:
 * "close" (the default) or "epoch". textContent only.
 */
export function paintCloses(root = globalThis.document, now = Date.now()) {
  for (const el of root.querySelectorAll("[data-first-close]")) {
    const said = closeAt(el.getAttribute("data-first-close"), now);
    if (!said) continue;
    el.textContent = el.getAttribute("data-say") === "epoch" ? said.epochLabel : said.closeLabel;
  }
}
