// front-ticker.mjs — which deliveries the front page's ticker shows, and what it
// calls them (POS-855, Site UX). Pure: no imports of data, no DOM.
//
//   node --test test/front-ticker.test.mjs
//
// Two things were wrong with the strip. (1) It took the newest 8 deliveries
// straight off stats.latestDeliveries, so one chatty resident could fill 7 of
// the 8 slots. (2) It titled each one with threadTitle(id), which breathes the
// id's dashes out into spaces; an id never carried its title's apostrophes
// ("you-d-like-one"), so "you'd like one" read "you d like one".
//
// The letters and threads the page imports carry no title field at all (their
// shape is id, from, to, toList, date, thread, body, path, box, attachments;
// tools/lib/fetch-town-data.mjs mapLetter, tools/lib/town.mjs buildThreads), so
// the id slug is the only source of a title, and the apostrophe can only be put
// back by rule. D19: a missing apostrophe beats a wrong one. So the rule is a
// whitelist of whole two-word pairs and nothing generic: "p s your bag" (a P.S.)
// and "model s review" stay as they are, because a lone "s" after an arbitrary
// word is as likely a letter or a possessive as a contraction.

import { threadTitle } from "../../tools/lib/ids.mjs";

const APOS = "’"; // the page's own quotes are curly (“ ”), so the apostrophe is too

// pair -> suffix: the first word, then the lone fragment the apostrophe cut off
const PAIRS = new Map();
const add = (firsts, suffix) => { for (const f of firsts) PAIRS.set(`${f} ${suffix}`, suffix); };

// n't
add(["can", "don", "won", "isn", "aren", "wasn", "weren", "didn", "doesn", "hasn", "haven", "hadn", "couldn", "shouldn", "wouldn", "mustn", "ain"], "t");
// pronoun contractions ("i d" is left out: it is as likely "i d card")
add(["i"], "m");
add(["i", "you", "we", "they", "he", "she", "it"], "ll");
add(["i", "you", "we", "they"], "ve");
add(["you", "we", "they"], "re");
add(["you", "we", "they", "he", "she"], "d");
// 's only after these (never a possessive, never after a single letter)
add(["it", "that", "what", "there", "here", "let", "who", "where", "he", "she"], "s");

// "you d like one" -> "you’d like one". Whole pairs only; a merged word never
// matches again, so "it s s" gains one apostrophe, not two.
export function restoreApostrophes(title) {
  const out = [];
  for (const w of String(title ?? "").split(" ")) {
    const prev = out.length ? out[out.length - 1] : null;
    if (prev !== null && PAIRS.get(`${prev.toLowerCase()} ${w}`) === w) {
      out[out.length - 1] = prev + APOS + w;
    } else {
      out.push(w);
    }
  }
  return out.join(" ");
}

// the ticker's title for one delivery: the id's slug, with the whitelisted
// apostrophes restored
export function deliveryTitle(delivery) {
  return restoreApostrophes(threadTitle(delivery.id));
}

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
