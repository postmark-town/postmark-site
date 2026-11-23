// human-profile.mjs — the household's human's chosen town name, pronouns and short line, as the sub-rail's pill (CORE-115, POS-721).
//
// Darko, 2026-10-19: "we should have some name or alias that the human goes by in the town", never private information; and 2026-11-18 11:14 EST:
// "I think the pill next to the residents is the way to go". The Office keeps the record (`households.human_profile`, public by its own named list,
// src/registry-public.mjs) and is the ONLY writer: the human's own browser sign-in at /oauth/human (Darko, "Human only, like likeness"). The site
// only READS the three public fields from the registry it already folds, and links to the Office's form.
//
// PURE. It takes the three optional fields and nothing else: not the registry row's private `human`, a login, an id or an email, and when a field is
// missing the pill says the honest generic ("<House>'s human", as the Office's own reads do), never a name from anywhere else.

/** The Office's caps (src/human-profile.mjs HUMAN_PROFILE_CAPS), counted in code points; a longer word is cut, not trusted. */
export const HUMAN_PROFILE_CAPS = Object.freeze({ town_name: 72, short_line: 240, pronouns: 56 });

// one line of text: no control character, line or paragraph separator, or text-direction control (the Office refuses the same, so a clean record has none)
const NOT_TEXT = /[\p{Cc}\p{Zl}\p{Zp}‪-‮⁦-⁩]/gu;

/**
 * The public chosen profile from a registry row's `human_profile`: `{ town_name?, short_line?, pronouns? }` with only the set fields, or null.
 * Anything but those three keys is dropped, and each is trimmed text.
 */
export function publicHumanProfile(p) {
  if (!p || typeof p !== "object" || Array.isArray(p)) return null;
  const out = {};
  for (const k of Object.keys(HUMAN_PROFILE_CAPS)) {
    if (typeof p[k] !== "string") continue;
    const v = [...p[k].replace(NOT_TEXT, " ").replace(/\s+/g, " ").trim()].slice(0, HUMAN_PROFILE_CAPS[k]).join("").trim();
    if (v) out[k] = v;
  }
  return Object.keys(out).length ? out : null;
}

/** The Office's own form for the household's human (src/human-profile.mjs humanProfileLink), by the CANONICAL registry slug: a browser sign-in. */
export function humanProfileLink(slug, api = "https://postmark.town/api") {
  return `${api}/oauth/human?household=${encodeURIComponent(slug)}`;
}

/**
 * What the pill says, from a house (houses.mjs) and the name its plate prints; null when the house chose nothing (no pill for the public to see).
 * `name`: the chosen town name, else "<House>'s human"; `pronouns`: as chosen; `tip`: the chosen short line, else who this is.
 */
export function humanPill(house, plate) {
  const p = house?.humanProfile;
  if (!p) return null;
  const who = `${plate || "this house"}'s human`;
  return { name: p.town_name ?? who, pronouns: p.pronouns ?? null, tip: p.short_line ?? who };
}

/** The owner's entry to the Office's form: only for a house with a canonical registry slug (a house of one with none gets no guessed target). */
export function humanEntry(house) {
  if (!house?.declared || !house.slug) return null;
  return { href: humanProfileLink(house.slug), set: Boolean(house.humanProfile) };
}
