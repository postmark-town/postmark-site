// resident-name.mjs — how a resident's NAME is SHOWN in the directory (POS-1005).
//
// Darko, 2026-11-11 22:17 EST: "48 characters". The town now refuses a new or changed name over 48 reader-characters (postmark-office
// src/resident-name.mjs; tools/resident-name.mjs), but a name already on file may be longer, and the directory must not let one stretch its card.
// So the directory SHOWS at most NAME_SHOWN reader-characters (graphemes) of a name, and a longer one ends in "…". This is DISPLAY ONLY:
// the name itself is never cut or rewritten: the card's search string (`residentKey`), its link and the resident's own page (/residents/<handle>/) carry
// the whole name, and the shared `residents-meta` data is untouched. The World map has its own elision (S165), which this does not repeat.

export const NAME_SHOWN = 48;

const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/** `name` as the directory shows it: itself when it is at most NAME_SHOWN reader-characters, else its first NAME_SHOWN followed by "…". */
export function shownName(name) {
  const text = String(name ?? "");
  if (text.length <= NAME_SHOWN) return text;               // at most 48 UTF-16 units is at most 48 characters: the common case, no segmenting
  const parts = [];
  for (const { segment } of segmenter.segment(text)) {
    if (parts.length === NAME_SHOWN) return parts.join("").trimEnd() + "…";
    parts.push(segment);
  }
  return text;
}
