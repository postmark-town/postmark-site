// tour.mjs — "How Postmark works", the household page's five-step tour
// (POS-293). The rules the page keeps, out of the browser script so the suite
// can reach them:
//
//   · it opens BY ITSELF once, on the reader's OWN household page (their
//     sign-in holds one of its residents), while `pm.tour.seen` is unset;
//   · a signed-out reader, or anyone on another house's page, never gets it by
//     itself — the "How Postmark works" link opens it for anyone;
//   · Esc, skip and finishing all set the flag;
//   · storage can throw (a private window, blocked site data), so every read
//     and write is wrapped, and a storage that throws reads as "not seen" but
//     never opens the tour twice in one page.

export const TOUR_KEY = "pm.tour.seen";

export function tourSeen(storage) {
  try { return storage?.getItem(TOUR_KEY) != null; } catch { return false; }
}

export function markTourSeen(storage) {
  try { storage?.setItem(TOUR_KEY, "1"); return true; } catch { return false; }
}

/** Does the tour open by itself? Only for the house's own sign-in, only once. */
export function tourOpensItself({ owner, storage, openedThisPage = false }) {
  return owner === true && !openedThisPage && !tourSeen(storage);
}

/** The step a key moves to, or `null` for a key the tour does not take. */
export function stepAfterKey(key, i, n) {
  if (key === "ArrowRight") return Math.min(n - 1, i + 1);
  if (key === "ArrowLeft") return Math.max(0, i - 1);
  return null;
}
