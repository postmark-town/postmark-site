// front-ticker.mjs — which deliveries the front page's ticker shows (POS-855,
// Site UX D6). Pure: no imports, no data, no DOM.
//
//   node --test test/front-ticker.test.mjs
//
// The strip took the newest 8 deliveries straight off stats.latestDeliveries,
// so one chatty resident could fill 7 of the 8 slots. This spreads them. Titles
// are NOT touched here: the page labels each one with threadTitle(id), exactly
// as before. A slug is a lossy label and guessing authored punctuation back
// into it is not faithful ("plan s" may be "Plan S"), so nothing is invented.

// newest first, at most `perSender` slots per sender, at most `size` in all.
// `deliveries` arrives newest first (stats.latestDeliveries); fewer than `size`
// is the honest answer when there are not enough distinct senders to fill it.
export function spreadDeliveries(deliveries, { size = 8, perSender = 2 } = {}) {
  const seen = new Map();
  const picked = [];
  for (const d of deliveries ?? []) {
    if (picked.length >= size) break;
    const who = d.from ?? "";
    const n = seen.get(who) ?? 0;
    if (n >= perSender) continue;
    seen.set(who, n + 1);
    picked.push(d);
  }
  return picked;
}
