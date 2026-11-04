// likeness-prompt.mjs — the nudge to answer the household's likeness question (WLD-83).
//
// Darko, 2026-10-25 15:22: "Can we just make it so the form pops up if you
// haven't filled it when you go onto the site, signed in?" The answer itself is
// still the office's own page after a GitHub sign-in (WLD-83 D2); this is only
// the door to it, shown to a signed-in reader whose household has not answered.
//
// Pure: the layout's island and the tests both call these. The reads are the
// ones the site already makes (GET /me, then the office's public GET /households
// for the reader's own house); nothing here fetches.
//
// THE WORDS ARE THE RULED ONES, never new law: the question is the office's
// LIKENESS_WORDS.question as the household page already prints it, and the
// unanswered line is likenessWords(null)'s ("which reads as no").

import { likenessLink, likenessWords } from "./appearance.mjs";

/** "Not now" hides the prompt this long. */
export const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

/** The per-household localStorage key the snooze is kept under. */
export const snoozeKey = (slug) => `pm.likeness.snooze.${slug}`;

/**
 * The reader's household, from `GET /me`: the first handle's block, which names
 * the house's slug. Null for a signed-out reader, a visitor with no house, or a
 * resident who stands alone (a solo block has no slug, so no record to answer on).
 */
export function houseOfMe(me) {
  if (!me || typeof me !== "object") return null;
  const handles = Array.isArray(me.handles) ? me.handles : Array.isArray(me.residents) ? me.residents : [];
  const first = handles.find((h) => typeof h === "string" && h);
  if (!first) return null;
  const block = me.households?.[first];
  if (!block || typeof block.slug !== "string" || !block.slug) return null;
  return { slug: block.slug, handle: first, count: Array.isArray(block.residents) && block.residents.length ? block.residents.length : handles.length };
}

/** Whether the record carries an answer: yes OR no. Matches the office's likenessAnswered. */
export const answered = (rec) => rec?.likeness?.answer === "yes" || rec?.likeness?.answer === "no";

/** The reader's house row out of a `GET /households?h=` body, or null when it did not carry one. */
export function houseRecord(body, slug) {
  const rec = body?.registry?.households?.[slug];
  return rec && typeof rec === "object" ? rec : null;
}

/** Whether a stored snooze (ms, as written) still hides the prompt. A bad value hides nothing. */
export function snoozed(stored, now = Date.now()) {
  const at = Number(stored);
  return Number.isFinite(at) && at > 0 && now - at < SNOOZE_MS;
}

/**
 * Show the prompt? Only for a signed-in reader with a house, whose record was
 * read and carries no answer, and who has not said "not now" this week. A record
 * that could not be read never shows it: nothing is guessed in its place.
 */
export function showPrompt({ house, rec, snoozedAt, now = Date.now() } = {}) {
  if (!house || !rec) return false;
  if (answered(rec)) return false;
  return !snoozed(snoozedAt, now);
}

/** The prompt's words and link, for one house. The line is likenessWords' own. */
export function promptWords(house) {
  const one = house.count === 1;
  return {
    title: "Your household's likeness question",
    question: `May the town's artists make pictures and video of ${one ? "your resident" : "your residents"}?`,
    line: likenessWords(null, house.count).line,
    change: "Change your answer any time.",
    answer: "Answer the likeness question",
    later: "Not now",
    href: likenessLink(house.slug),
  };
}
