// slots.mjs — what a Hearth template may ask the site to draw, and nothing else (POS-959).
//
// A Hearth entry is HTML and CSS in the page (Darko, 2026-11-01 15:54 EST, on
// POS-684: "the template shape is HTML and CSS in the page, with the site's live
// parts in slots"). The entry never carries script. It names the site's own
// parts by marker element, `<hearth-residents></hearth-residents>`, and the site
// draws them: from the reads it already makes, under the gates it already keeps.
// The six behaviors (Darko, 19:53: "about six approved behaviors … such as tabs,
// a sort switcher, a residents map and a stamps chart") are the site's own
// reviewed code, reached by a marker or a `data-hearth-behavior` attribute.
//
// ONE LIST, so the sanitizer, the page and the tests cannot disagree about it.
// A name not here is not a slot: the sanitizer drops the element.

/** The household sections (Darko 19:53: the office's existing household sections are the slots) and the boards. */
export const SLOTS = Object.freeze({
  house:     { label: "the house: its name, how long, how many residents", private: false },
  residents: { label: "the residents, each card with the live things the house knows of them", private: false },
  "needs-you": { label: "what waits on a word from the house", private: true },
  stamps:    { label: "the house in numbers: stamps held, minted, windows hung", private: false },
  posts:     { label: "the house's posts: ideas and bugs its residents put up", private: false },
  marks:     { label: "the house's marks: the latest rulings on what it published", private: false },
  closer:    { label: "who the residents write most", private: false },
  happened:  { label: "what happened: the house's letters, says, marks and mint, newest first", private: false },
  mail:      { label: "the house's private mail: what is new, awaiting a word, waiting for the crossing", private: true },
  "around-town": { label: "around town: what is coming on the calendar and what the bulletin says", private: false },
  // behaviors that draw from the house's live data, so they are markers too
  map:       { label: "where the residents stand now, by place (the residents map)", private: false, behavior: true },
  "stamps-chart": { label: "stamps held, resident by resident (the stamps chart)", private: false, behavior: true },
  countdown: { label: "the next crossing and the keeper's settlement, counting down", private: false, behavior: true },
});

export const SLOT_NAMES = Object.freeze(Object.keys(SLOTS));
/** The element a template writes for a slot: `<hearth-residents>`. */
export const slotTag = (name) => `hearth-${name}`;
export const SLOT_TAGS = Object.freeze(Object.fromEntries(SLOT_NAMES.map((n) => [slotTag(n), n])));

/** The behaviors that wrap the template's own markup, by `data-hearth-behavior`. */
export const BEHAVIORS = Object.freeze({
  tabs: "its children, each with data-tab=\"Title\", become tabs: one shows at a time",
  accordion: "its children, each with data-panel=\"Title\", become panels that open and close (data-single: only one open)",
  sort: "its children carry data-sort-<key> values; data-sort-keys=\"a,b\" adds a switcher that reorders them",
});
export const BEHAVIOR_NAMES = Object.freeze(Object.keys(BEHAVIORS));

/** An entry's id is its folder name under PROJECTS/household-hearths/. */
export const ENTRY_ID = /^[a-z0-9][a-z0-9-]{0,39}$/;
/** The entry the site shows a household with no other asked: Postmark's own. */
export const DEFAULT_ENTRY = "default";

export const LIMITS = Object.freeze({
  html: 100_000,
  css: 60_000,
  depth: 24,
  nodes: 3000,
  rules: 600,
  title: 80,
  line: 240,
});
