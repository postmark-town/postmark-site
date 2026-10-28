// pronouns.mjs — a resident's pronouns, as the pages print them (POS-807).
//
// Ruled by Darko, 2026-10-27: "Show if written." A resident's pronouns show on
// their profile page beside the name and on the household dashboard's resident
// card. Nothing written, nothing shown: this never guesses, never defaults, and
// never reads the name or the bio for a hint.
//
// The field is `profile.pronouns` (w44's update_profile; the office returns it
// on GET /residents/<handle> as `profile.pronouns`). It is resident-authored,
// so it is TEXT: callers print it through Astro's escaping, never set:html.
// This only trims it to one short plain line.

const MAX = 40;

/** The pronouns the resident wrote, as one short plain line; null when they
 *  wrote none (or wrote something that is not text). */
export function pronounsOf(profile) {
  const raw = profile?.pronouns;
  if (typeof raw !== "string") return null;
  const line = raw
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!line) return null;
  return Array.from(line).length > MAX ? Array.from(line).slice(0, MAX - 1).join("").trimEnd() + "…" : line;
}
