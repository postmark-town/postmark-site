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
// the id slug is the only source of a title today. deliveryTitle still prefers
// a letter's own `title` should the office ever serve one, then falls back to
// the slug with its apostrophes put back.

import { threadTitle } from "../../tools/lib/ids.mjs";

const APOS = "’"; // the page's own quotes are curly (“ ”), so the apostrophe is too

// "n't": the word before a lone "t" must be one of these (a bare "plan t" is not a contraction)
const NT = new Set([
  "don", "can", "won", "isn", "aren", "wasn", "weren", "didn", "doesn", "couldn",
  "wouldn", "shouldn", "hasn", "haven", "hadn", "mustn", "needn", "ain",
]);
const SUBJECTS = new Set(["i", "you", "he", "she", "we", "they", "it", "who", "that", "there", "what", "where", "how", "everyone", "someone", "nobody"]);
// a lone letter after a subject: "you d" -> "you'd" (but "vitamin d" stays)
const AFTER_SUBJECT = new Set(["d", "ll"]);
const RE_VE = { re: new Set(["you", "we", "they", "who", "what", "where", "there"]), ve: new Set(["i", "you", "we", "they", "would", "could", "should", "might", "must", "who"]) };

// "you d like one" -> "you’d like one". Only the shapes a dropped apostrophe
// leaves behind: n't, 's, 'd, 'll, 'm, 're, 've. Everything else is untouched.
export function restoreApostrophes(title) {
  const words = String(title ?? "").split(" ");
  const out = [];
  for (const w of words) {
    const prev = out.length ? out[out.length - 1] : null;
    const p = prev === null ? null : prev.toLowerCase();
    const prevBare = p === null ? null : p.replace(/[^a-z]/g, "");
    if (prev !== null && w === "t" && NT.has(p)) { out[out.length - 1] = prev + APOS + "t"; continue; }
    if (prev !== null && w === "s" && /[a-z0-9]$/i.test(prev)) { out[out.length - 1] = prev + APOS + "s"; continue; }
    if (prev !== null && AFTER_SUBJECT.has(w) && SUBJECTS.has(prevBare)) { out[out.length - 1] = prev + APOS + w; continue; }
    if (prev !== null && w === "m" && prevBare === "i") { out[out.length - 1] = prev + APOS + "m"; continue; }
    if (prev !== null && (w === "re" || w === "ve") && RE_VE[w].has(prevBare)) { out[out.length - 1] = prev + APOS + w; continue; }
    out.push(w);
  }
  return out.join(" ");
}

// the ticker's title for one delivery: the letter's own title if it has one,
// else the id's slug with its apostrophes restored
export function deliveryTitle(delivery, letterById) {
  const own = letterById?.get?.(delivery.id)?.title;
  if (typeof own === "string" && own.trim() !== "") return own.trim();
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
